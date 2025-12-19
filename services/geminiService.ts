import { GoogleGenAI, Modality, Type } from "@google/genai";
import { SolutionItem } from "../types";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Interface for the dual-script output
 */
interface DualScriptResponse {
  displayScript: string;
  readingScript: string;
}

// --- GOOGLE AI STUDIO CONFIGURATION ---
// Disable safety filters to allow processing of educational materials 
const STUDIO_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

/**
 * Helper function to call Gemini with a specific system prompt
 */
const callGeminiWithPrompt = async (
  model: string,
  systemPrompt: string,
  userPrompt: string,
  parts: any[]
): Promise<DualScriptResponse | null> => {
  try {
    const finalParts = [...parts, { text: userPrompt }];

    const response = await ai.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: finalParts }], 
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1, 
        responseMimeType: "application/json",
        safetySettings: STUDIO_SAFETY_SETTINGS, 
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            displayScript: { type: Type.STRING },
            readingScript: { type: Type.STRING }
          },
          required: ["displayScript", "readingScript"]
        }
      }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === "RECITATION" || candidate?.finishReason === "SAFETY") {
      console.warn(`Blocked by ${candidate.finishReason}. Retrying with safe prompt...`);
      return null; 
    }

    if (response.text) {
      return JSON.parse(response.text) as DualScriptResponse;
    }

    return null;
  } catch (error) {
    console.warn("Attempt failed:", error);
    return null;
  }
};

/**
 * Step 1: Analyze content (Text, Image, PDF)
 */
export const generateReadingScript = async (
  textInput: string,
  fileBase64?: string,
  mimeType?: string
): Promise<DualScriptResponse> => {
  
  const model = "gemini-2.5-flash"; 
  
  const parts: any[] = [];
  if (fileBase64 && mimeType) {
    parts.push({
      inlineData: { mimeType: mimeType, data: fileBase64 }
    });
  }
  if (textInput) parts.push({ text: textInput });

  const promptOCR = `
    Bạn là công cụ trích xuất văn bản (OCR) và chuẩn hóa danh pháp hóa học.
    
    NHIỆM VỤ:
    1. Trích xuất nội dung từ tài liệu.
    2. Tạo 2 phiên bản văn bản:
    
    YÊU CẦU CHI TIẾT:
    
    A. "displayScript" (Để hiển thị):
       - Giữ nguyên công thức hóa học ngắn gọn (H2SO4, Cu, NaCl...).
       - Giữ nguyên cấu trúc đề bài.
    
    B. "readingScript" (Để đọc Audio - QUAN TRỌNG):
       - CHUYỂN ĐỔI TOÀN BỘ CÔNG THỨC HÓA HỌC SANG TÊN GỌI TIẾNG ANH (IUPAC).
       - TUYỆT ĐỐI KHÔNG đọc từng chữ cái (Ví dụ: KHÔNG đọc "Hờ hai ét ô bốn", KHÔNG đọc "Ca hát ca").
       - Nguyên tố: 
         + Cu -> đọc là "Copper" (không đọc Đồng).
         + Fe -> đọc là "Iron" (không đọc Sắt).
         + Na -> đọc là "Sodium" (không đọc Natri).
       - Hợp chất:
         + H2SO4 -> đọc là "Sulfuric Acid".
         + HCl -> đọc là "Hydrochloric Acid".
         + KMnO4 -> đọc là "Potassium Permanganate".
       - Các từ nối trong câu vẫn giữ Tiếng Việt bình thường.
       
    Ví dụ Output:
    {
      "displayScript": "Cho Fe tác dụng với dung dịch HCl...",
      "readingScript": "Cho Iron tác dụng với dung dịch Hydrochloric Acid..."
    }
  `;

  const userInstruction = "Hãy trích xuất và xử lý nội dung này theo đúng chuẩn danh pháp IUPAC tiếng Anh cho phần đọc.";

  console.log("Attempting OCR with IUPAC rules...");
  const result1 = await callGeminiWithPrompt(model, promptOCR, userInstruction, parts);
  if (result1) return result1;

  throw new Error("Không thể xử lý tài liệu này. Vui lòng thử lại.");
};

/**
 * Step 2: Convert script into Audio
 */
export const synthesizeSpeech = async (script: string): Promise<string> => {
  const model = "gemini-2.5-flash-preview-tts";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: script }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Không nhận được dữ liệu âm thanh.");
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw new Error("Lỗi khi tạo giọng nói.");
  }
};

/**
 * Step 3: Find related YouTube videos
 */
export const getRelatedVideoQueries = async (script: string): Promise<Array<{title: string, query: string}>> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    Dựa trên nội dung sau, đề xuất 3 từ khóa tìm kiếm Youtube.
    Nội dung: ${script.substring(0, 3000)}...
    Yêu cầu: Trả về JSON mảng [{"title": "...", "query": "..."}].
  `;
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        safetySettings: STUDIO_SAFETY_SETTINGS,
        responseSchema: {
           type: Type.ARRAY,
           items: {
             type: Type.OBJECT,
             properties: {
               title: { type: Type.STRING },
               query: { type: Type.STRING }
             }
           }
        }
      }
    });
    
    if (response.text) return JSON.parse(response.text);
    return [];
  } catch (e) {
    console.error("Video suggestion error", e);
    return [];
  }
};

/**
 * Helper: Generate Image from Prompt using Gemini Image Model
 */
const generateChemicalImage = async (imagePrompt: string): Promise<string | undefined> => {
  if (!imagePrompt) return undefined;
  
  // Use 'gemini-2.5-flash-image' for image generation as per guidelines
  const model = "gemini-2.5-flash-image"; 
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: imagePrompt }] },
      // Note: responseMimeType is not supported for nano banana series models for image output config usually, 
      // but we need to prompt it to generate an image. 
      // Actually, standard usage for image gen in this SDK is just generateContent with text prompt.
    });

    // Iterate to find image part
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          return part.inlineData.data; // Base64 string
        }
      }
    }
    return undefined;
  } catch (e) {
    console.error("Image generation failed:", e);
    return undefined;
  }
};

/**
 * Step 4: Detect, Solve Questions AND Generate Images
 */
export const analyzeAndSolve = async (
  script: string, 
  fileBase64?: string, 
  mimeType?: string
): Promise<SolutionItem[]> => {
  const model = "gemini-2.5-flash";
  
  // Prompt updated: STRICT "TRIGGER CONDITION" FOR DRAWING
  const prompt = `
    Bạn là Gia Sư Hóa Học Thông Minh (GDPT 2018 Việt Nam).
    
    QUY TẮC NGHIÊM NGẶT VỀ NGÔN NGỮ:
    1. HIỂN THỊ (Display): Dùng ký hiệu hóa học chuẩn (H2SO4, Cu, Fe...).
    2. ĐỌC (Reading): BẮT BUỘC DÙNG TÊN TIẾNG ANH IUPAC.

    3. XỬ LÝ HÌNH ẢNH MINH HỌA (QUAN TRỌNG - CHẾ ĐỘ TIẾT KIỆM - TRIGGER CONDITION):
       - CHỈ TẠO "imagePrompt" KHI VÀ CHỈ KHI đề bài hoặc lời giải CÓ YÊU CẦU CỤ THỂ như:
         + "Vẽ", "Viết công thức cấu tạo", "Minh họa", "Sơ đồ".
         + Hoặc nội dung là cấu trúc Hữu cơ cần hình ảnh để hiểu (đồng phân, liên kết không gian).
       
       - TRƯỜNG HỢP KHÔNG VẼ (BẮT BUỘC ĐỂ CHUỖI RỖNG ""):
         + Bài toán tính toán số liệu (tính mol, nồng độ, khối lượng...).
         + Bài lý thuyết nhận biết, chuỗi phản ứng đơn giản.
         + Câu hỏi trắc nghiệm không yêu cầu hình vẽ.

       - NẾU PHẢI VẼ (Khi thỏa điều kiện trên):
         + Prompt tiếng Anh, bao gồm SMILES hoặc Formula.
         + Style: "Scientific textbook diagram", "2D skeletal", "Explicit atoms", "Black lines", "White background".

    4. ĐỊNH DẠNG VĂN BẢN:
       - Dùng dấu gạch đầu dòng (-) cho các bước.
       - Dùng **In Đậm** cho tiêu đề.
    
    Nội dung văn bản (OCR) tham khảo: 
    """
    ${script.substring(0, 10000)}
    """

    JSON Output (Array):
    [
      { 
        "questionDisplay": "Đề bài",
        "questionReading": "Đề bài đọc IUPAC",
        "solutionDisplay": "Lời giải", 
        "solutionReading": "Lời giải đọc IUPAC",
        "imagePrompt": "Câu lệnh vẽ (Chỉ khi cần thiết, nếu không để trống)"
      }
    ]
  `;

  try {
     const parts: any[] = [];
    
     // Pass the original file if available so Gemini can "see" the structures
     if (fileBase64 && mimeType) {
       parts.push({
         inlineData: {
           mimeType: mimeType,
           data: fileBase64
         }
       });
     }
 
     parts.push({ text: prompt });

     // 1. Get Text Solutions and Image Prompts
     const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        safetySettings: STUDIO_SAFETY_SETTINGS, 
        responseSchema: {
           type: Type.ARRAY,
           items: {
             type: Type.OBJECT,
             properties: {
               questionDisplay: { type: Type.STRING },
               questionReading: { type: Type.STRING },
               solutionDisplay: { type: Type.STRING },
               solutionReading: { type: Type.STRING },
               imagePrompt: { type: Type.STRING }
             }
           }
        }
      }
    });

    let items: SolutionItem[] = [];
    if (response.text) {
      items = JSON.parse(response.text) as SolutionItem[];
    } else {
      return [];
    }

    // 2. Parallel Image Generation for each item with a prompt
    console.log("Generating images for solutions...");
    const itemsWithImages = await Promise.all(items.map(async (item) => {
      // Logic check: Only generate if prompt is substantial
      if (item.imagePrompt && item.imagePrompt.trim().length > 10 && item.imagePrompt.toLowerCase() !== "none") {
        try {
          // Force accuracy keywords
          const enforcedPrompt = `Scientifically accurate chemical structure, ${item.imagePrompt}, 2D flat view, high quality, white background`;
          const imageBase64 = await generateChemicalImage(enforcedPrompt);
          return { ...item, illustrationImage: imageBase64 };
        } catch (err) {
          console.warn(`Failed to generate image for: ${item.imagePrompt}`, err);
          return item;
        }
      }
      return item;
    }));

    return itemsWithImages;

  } catch (e) {
    console.error("Solver error", e);
    return [];
  }
};

/**
 * Helper to decode audio for playback
 */
export const getAudioDataUrl = (base64Audio: string): string => {
  return createWavUrlFromPcm(base64Audio);
};

function createWavUrlFromPcm(base64Pcm: string): string {
  const pcmData = atob(base64Pcm);
  const numChannels = 1;
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const blockAlign = numChannels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const subChunk2Size = dataSize;
  const chunkSize = 36 + subChunk2Size;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, chunkSize, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); 
  view.setUint16(22, numChannels, true); 
  view.setUint32(24, sampleRate, true); 
  view.setUint32(28, byteRate, true); 
  view.setUint16(32, blockAlign, true); 
  view.setUint16(34, bitsPerSample, true); 

  writeString(view, 36, 'data');
  view.setUint32(40, subChunk2Size, true);

  const pcmBytes = new Uint8Array(buffer, 44);
  for (let i = 0; i < dataSize; i++) {
    pcmBytes[i] = pcmData.charCodeAt(i);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}