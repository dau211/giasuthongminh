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
// (e.g., Biology anatomy, History wars, Literature texts) without false positives.
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
        safetySettings: STUDIO_SAFETY_SETTINGS, // Apply AI Studio safety config
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

    // Check for safety blocks immediately
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === "RECITATION" || candidate?.finishReason === "SAFETY") {
      console.warn(`Blocked by ${candidate.finishReason}. Retrying with safe prompt...`);
      return null; // Return null to trigger retry
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
 * Implements Retry Logic for RECITATION errors.
 */
export const generateReadingScript = async (
  textInput: string,
  fileBase64?: string,
  mimeType?: string
): Promise<DualScriptResponse> => {
  
  const model = "gemini-2.5-flash"; 
  
  // Base parts (File + Text Input)
  const parts: any[] = [];
  if (fileBase64 && mimeType) {
    parts.push({
      inlineData: { mimeType: mimeType, data: fileBase64 }
    });
  }
  if (textInput) parts.push({ text: textInput });

  // --- PROMPT STRATEGIES ---

  // Context for GDPT 2018 Chemistry Standard (UPDATED STRICT RULES)
  const CHEMISTRY_STANDARD = `
    QUY TẮC TỐI THƯỢNG (TUÂN THỦ CHƯƠNG TRÌNH GDPT 2018 MÔN HÓA HỌC VIỆT NAM):

    1. QUY TẮC NGÔN NGỮ & DANH PHÁP (BẮT BUỘC):
       - Tên chất hóa học: Phải viết 100% bằng TIẾNG ANH chuẩn quốc tế (IUPAC). 
         + Ví dụ đúng: Iron, Copper, Sulfuric acid, Sodium hydroxide.
         + Ví dụ sai (CẤM): Sắt, Đồng, Axit sunfuric, Natri hiđroxit.
       - Nếu người dùng nhập tên tiếng Việt, TỰ ĐỘNG DỊCH sang tên tiếng Anh tương ứng.
       - Các nội dung khác (lời dẫn, giải thích, hiện tượng): Viết bằng TIẾNG VIỆT.

    2. PHẠM VI KIẾN THỨC:
       - Chỉ sử dụng kiến thức Hóa học lớp 10, 11, 12 thuộc CTGD 2018 (Sách: Cánh Diều, Kết Nối Tri Thức, Chân Trời Sáng Tạo).
       - TUYỆT ĐỐI KHÔNG dùng kiến thức cũ (đã bỏ) hoặc kiến thức Đại học (cơ chế phản ứng phức tạp, lượng tử...).

    3. QUY TẮC XỬ LÝ PHẢN ỨNG HÓA HỌC:
       - Luôn viết phương trình với công thức chuẩn và tên chất tiếng Anh.
       - NẾU ĐỀ BÀI THIẾU ĐIỀU KIỆN (nhiệt độ, nồng độ...):
         + KHÔNG ĐƯỢC tự ý chọn một phương trình cụ thể.
         + PHẢI liệt kê các trường hợp xảy ra theo chương trình THPT.
         + Ví dụ: Fe + H2SO4 -> Phải xét trường hợp H2SO4 loãng và H2SO4 đặc nóng.
  `;

  // Strategy 1: Strict OCR / Accessibility (Preferred)
  const promptOCR = `
    Bạn là Hệ thống hỗ trợ Hóa học (GDPT 2018).
    
    ${CHEMISTRY_STANDARD}
    
    Nhiệm vụ: Chuyển đổi tài liệu thành văn bản số hóa chuẩn mực.
    
    Yêu cầu JSON output:
    1. "displayScript" (Văn bản hiển thị): 
       - Trích xuất nội dung từ tài liệu.
       - CHUYỂN TOÀN BỘ tên chất tiếng Việt sang tiếng Anh (IUPAC).
       - Giữ nguyên công thức (H2SO4, CaCO3...).
       - ĐỊNH DẠNG: KHÔNG dùng in đậm (**), dùng xuống dòng kép (\\n\\n) để tách đoạn.
    2. "readingScript" (Kịch bản đọc):
       - Đọc tên chất hoàn toàn bằng Tiếng Anh (IUPAC).
       - Lời dẫn đọc bằng tiếng Việt tự nhiên.
  `;

  // Strategy 2: Study Guide / Paraphrase (Fallback for RECITATION/Copyright)
  const promptSafe = `
    Bạn là Gia Sư Hóa Học Thông Minh (GDPT 2018).
    
    ${CHEMISTRY_STANDARD}
    
    Nhiệm vụ: Soạn thảo nội dung ôn tập từ tài liệu gốc.
    
    Yêu cầu JSON output:
    1. "displayScript": 
       - Diễn giải lại nội dung theo ngôn ngữ SGK mới.
       - BẮT BUỘC: Thay thế tên chất tiếng Việt sang tiếng Anh (IUPAC).
       - Nếu gặp phản ứng thiếu điều kiện, hãy liệt kê các trường hợp có thể.
       - Định dạng thoáng, rõ ràng (\\n\\n).
    2. "readingScript":
       - Văn bản đọc tự nhiên, chuẩn danh pháp Anh-Việt.
  `;

  const userInstruction = "Hãy thực hiện chuyển đổi nội dung theo định dạng JSON.";

  // --- EXECUTION FLOW ---

  // Attempt 1: Try strict OCR
  console.log("Attempting Strategy 1: OCR (GDPT 2018 Standards)...");
  const result1 = await callGeminiWithPrompt(model, promptOCR, userInstruction, parts);
  if (result1) return result1;

  // Attempt 2: Try Safe/Paraphrase mode
  console.log("Attempting Strategy 2: Safe Paraphrase (GDPT 2018 Standards)...");
  const result2 = await callGeminiWithPrompt(model, promptSafe, userInstruction, parts);
  if (result2) return result2;

  // If both fail, throw error
  throw new Error("Không thể xử lý tài liệu này. Vui lòng thử lại với ảnh rõ nét hơn.");
};

/**
 * Step 2: Convert the purified script into Audio using the TTS model.
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
            prebuiltVoiceConfig: { 
              voiceName: 'Kore' // Kore works well with mixed Vietnamese/English vocabulary
            },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("Không nhận được dữ liệu âm thanh từ hệ thống.");
    }

    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw new Error("Lỗi khi tạo giọng nói. Vui lòng thử lại.");
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
    
    Yêu cầu:
    1. Trả về JSON.
    2. "title": Mô tả ngắn.
    3. "query": Từ khóa tìm kiếm (Ưu tiên chứa tên chất hóa học bằng tiếng Anh IUPAC).
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
    
    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (e) {
    console.error("Video suggestion error", e);
    return [];
  }
};

/**
 * Step 4: Detect and Solve Questions in Content
 */
export const analyzeAndSolve = async (script: string): Promise<SolutionItem[]> => {
  const model = "gemini-2.5-flash";
  // Updated prompt for Solving with Strict GDPT 2018 Rules + SVG Drawing
  const prompt = `
    Bạn là Gia Sư Hóa Học Thông Minh (GDPT 2018 Việt Nam).
    
    QUY TẮC NGHIÊM NGẶT (TUÂN THỦ TUYỆT ĐỐI):
    1. NGÔN NGỮ: 
       - Tên chất hóa học: BẮT BUỘC tiếng Anh IUPAC.
       - Lời giải thích: Tiếng Việt.
    
    2. PHẠM VI: 
       - Chỉ dùng kiến thức SGK Hóa 10, 11, 12 MỚI.

    3. XỬ LÝ PHẢN ỨNG & HÌNH VẼ:
       - Nếu đề bài yêu cầu vẽ công thức cấu tạo, hình minh họa thí nghiệm, hoặc sơ đồ:
         -> HÃY TẠO MÃ SVG (String) để mô tả hình ảnh đó.
         -> Mã SVG phải: <svg viewBox="...">...</svg>, nền trong suốt, nét vẽ màu đen (stroke="black"), chữ màu đen.
         -> Giữ SVG đơn giản, chính xác về mặt hóa học (liên kết đơn/đôi, vòng benzen...).
       - Nếu không cần vẽ, để trường "illustrationSVG" là chuỗi rỗng.
    
    Nhiệm vụ:
    - Trích xuất câu hỏi và đưa ra LỜI GIẢI CHI TIẾT.
    - Định dạng Display: Không dùng Markdown in đậm (**).
    
    Nội dung input: 
    """
    ${script.substring(0, 10000)}
    """

    JSON Output (Array):
    [
      { 
        "questionDisplay": "Đề bài (Chuẩn IUPAC)",
        "questionReading": "Đề bài đọc (Chuẩn IUPAC)",
        "solutionDisplay": "Lời giải (Chuẩn IUPAC)", 
        "solutionReading": "Lời giải đọc (Chuẩn IUPAC)",
        "illustrationSVG": "Mã SVG của hình vẽ (hoặc để trống)"
      }
    ]
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
               questionDisplay: { type: Type.STRING },
               questionReading: { type: Type.STRING },
               solutionDisplay: { type: Type.STRING },
               solutionReading: { type: Type.STRING },
               illustrationSVG: { type: Type.STRING }
             }
           }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SolutionItem[];
    }
    return [];
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

// Helper to add WAV header to raw PCM data so standard <audio> tags can play it
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

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, chunkSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, subChunk2Size, true);

  // Write PCM data
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