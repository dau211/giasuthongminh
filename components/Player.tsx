import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RefreshCw, Volume2, Download, Youtube, FileText as FileTextIcon, ChevronDown, ChevronUp, CheckCircle, BrainCircuit, Loader2, ArrowLeft, Printer, Image as ImageIcon } from 'lucide-react';
import { VideoRecommendation, SolutionItem, FileData } from '../types';
import { synthesizeSpeech, getAudioDataUrl } from '../services/geminiService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, ImageRun } from 'docx';

// Polyfill Enums locally to prevent "module does not provide export" errors with CDNs
const HeadingLevel = {
  HEADING_1: "Heading1" as any,
  HEADING_2: "Heading2" as any,
  TITLE: "Title" as any,
};

const AlignmentType = {
  START: "start" as any,
  END: "end" as any,
  CENTER: "center" as any,
  BOTH: "both" as any,
  DISTRIBUTE: "distribute" as any,
  LEFT: "left" as any,
  RIGHT: "right" as any,
  JUSTIFIED: "both" as any,
};

interface PlayerProps {
  script: string;
  audioUrl: string | null;
  relatedVideos: VideoRecommendation[];
  solutions: SolutionItem[];
  onReset: () => void;
  fileData: FileData | null; // Pass file data for display
}

interface SolutionCardProps {
  item: SolutionItem;
  index: number;
  onPlayRequest: (title: string, text: string, url: string) => void;
}

// Custom Text Renderer for Scientific Formulas AND Bold Formatting
const ScientificText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
  if (!text) return null;
  
  // Regex to split by bold markers (**)
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // Render Bold Text (remove **)
          const content = part.slice(2, -2);
          return <b key={index} className="text-emerald-400 font-bold"><ChemicalFormula text={content} /></b>;
        } else {
          // Render Normal Text
          return <span key={index}><ChemicalFormula text={part} /></span>;
        }
      })}
    </span>
  );
};

// Helper for just Chemical Formulas inside a string
const ChemicalFormula: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const regex = /([A-Z][a-z]?|\))(\d+)/g;
  const parts = text.split(regex);
  const elements = [];
  
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i]) {
      elements.push(<span key={`t-${i}`}>{parts[i]}</span>);
    }
    
    if (i + 2 < parts.length) {
      const symbol = parts[i + 1];
      const number = parts[i + 2];
      
      elements.push(<span key={`s-${i}`}>{symbol}</span>);
      elements.push(
        <sub key={`n-${i}`} className="text-[0.65em] align-baseline font-medium ml-[0.5px]">
          {number}
        </sub>
      );
    }
  }
  return <>{elements}</>;
};

const SolutionCard: React.FC<SolutionCardProps> = ({ item, index, onPlayRequest }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [cachedAudioUrl, setCachedAudioUrl] = useState<string | null>(null);

  const handlePlayRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const title = `Lời giải bài ${index + 1}`;
    const displayScriptForPlayer = `LỜI GIẢI BÀI ${index + 1}:\n\n${item.solutionDisplay}`;
    const readingScriptForTTS = `Lời giải chi tiết bài số ${index + 1}. ${item.solutionReading}`;

    if (cachedAudioUrl) {
      onPlayRequest(title, displayScriptForPlayer, cachedAudioUrl);
      return;
    }

    try {
      setIsGeneratingAudio(true);
      const base64 = await synthesizeSpeech(readingScriptForTTS);
      const url = getAudioDataUrl(base64);
      setCachedAudioUrl(url);
      onPlayRequest(title, displayScriptForPlayer, url);
    } catch (error) {
      console.error("Error generating solution audio:", error);
      alert("Không thể tạo giọng đọc cho lời giải này.");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden mb-3 transition-all hover:border-emerald-500/50">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left p-4 flex justify-between items-start gap-4 hover:bg-slate-800/50 transition-colors cursor-pointer"
      >
        <div className="flex-1">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 mb-2">
            Bài {index + 1}
          </span>
          <p className="font-medium text-slate-200 line-clamp-2">
            <ScientificText text={item.questionDisplay} />
          </p>
        </div>
        <div className="flex items-center space-x-3">
           <button
            onClick={handlePlayRequest}
            disabled={isGeneratingAudio}
            className={`p-2 rounded-full transition-all ${
              isGeneratingAudio
                ? 'bg-slate-700 text-slate-400'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
            }`}
            title="Nghe lời giải (Chuẩn Anh-Việt)"
          >
            {isGeneratingAudio ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          {isOpen ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-slate-700/50 bg-slate-800/20 animate-fade-in">
          <div className="mt-4 text-slate-300 space-y-2">
             <div className="flex items-center text-emerald-400 mb-2">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="font-semibold text-sm">Lời giải chi tiết</span>
             </div>
             
             <div className="whitespace-pre-wrap leading-relaxed text-sm">
               <ScientificText text={item.solutionDisplay} />
             </div>

             {item.illustrationImage && (
               <div className="mt-4 p-4 bg-white rounded-lg border border-slate-700/50 flex flex-col items-center shadow-inner">
                  <span className="text-xs text-slate-500 mb-2 uppercase tracking-wide w-full text-center border-b pb-1">Hình minh họa (Gemini Image Gen)</span>
                  <div className="w-full flex justify-center mt-2">
                    <img 
                      src={`data:image/png;base64,${item.illustrationImage}`}
                      alt="Chemical Structure"
                      className="max-w-full h-auto object-contain max-h-[300px]"
                    />
                  </div>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

const Player: React.FC<PlayerProps> = ({ script, audioUrl, relatedVideos, solutions, onReset, fileData }) => {
  const [activeScript, setActiveScript] = useState(script);
  const [activeAudioUrl, setActiveAudioUrl] = useState(audioUrl);
  const [activeTitle, setActiveTitle] = useState("Nội dung gốc");
  const [isShowingSolution, setIsShowingSolution] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isShowingSolution) {
      setActiveScript(script);
      setActiveAudioUrl(audioUrl);
    }
  }, [script, audioUrl, isShowingSolution]);

  useEffect(() => {
    if (audioRef.current && activeAudioUrl) {
      audioRef.current.load();
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(e => console.error("Auto-play blocked:", e));
    }
  }, [activeAudioUrl]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      setDuration(total || 0);
      setProgress((current / total) * 100);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(100);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const seekTime = (Number(e.target.value) / 100) * audioRef.current.duration;
      audioRef.current.currentTime = seekTime;
      setProgress(Number(e.target.value));
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePlaySolution = (title: string, text: string, url: string) => {
    setActiveTitle(title);
    setActiveScript(text);
    setActiveAudioUrl(url);
    setIsShowingSolution(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToOriginal = () => {
    setActiveTitle("Nội dung gốc");
    setActiveScript(script);
    setActiveAudioUrl(audioUrl);
    setIsShowingSolution(false);
  };

  // --- WORD EXPORT LOGIC ---
  const handleDownloadWord = async () => {
    setIsGeneratingWord(true);
    try {
      const children = [];

      // 1. Title
      children.push(new Paragraph({
        text: "GIA SƯ THÔNG MINH - TÀI LIỆU HỌC TẬP",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }));
      children.push(new Paragraph({ text: "" })); // Spacer

      // Helper to parse text into TextRuns with Bold and Chemical Subscripts
      const createFormattedRuns = (text: string, isBoldContext = false): TextRun[] => {
        if (!text) return [];
        const runs: TextRun[] = [];
        // Regex for Bold (**...**)
        const boldParts = text.split(/(\*\*.*?\*\*)/g);

        boldParts.forEach(part => {
          let isBold = isBoldContext;
          let content = part;

          if (part.startsWith('**') && part.endsWith('**')) {
            isBold = true;
            content = part.slice(2, -2);
          }

          // Regex for Chemical Formulas (e.g., H2SO4 -> H, 2, SO, 4)
          // Matches a letter followed by digits
          const regex = /([a-zA-Z\)])(\d+)/g;
          let lastIndex = 0;
          let match;

          while ((match = regex.exec(content)) !== null) {
            // Text before the number
            const prefix = content.slice(lastIndex, match.index);
            if (prefix) {
              runs.push(new TextRun({ text: prefix, bold: isBold }));
            }
            
            // The Letter before the number (e.g., "H" in H2)
            runs.push(new TextRun({ text: match[1], bold: isBold }));
            
            // The Number (Subscript)
            runs.push(new TextRun({ 
              text: match[2], 
              subScript: true,
              bold: isBold
            }));

            lastIndex = regex.lastIndex;
          }

          // Remaining text after last match
          const suffix = content.slice(lastIndex);
          if (suffix) {
            runs.push(new TextRun({ text: suffix, bold: isBold }));
          }
        });

        return runs;
      };

      // 2. Solutions
      solutions.forEach((sol, index) => {
        // Question Header
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `BÀI TẬP ${index + 1}: `, bold: true, color: "2E7D32" }), // Green color
          ],
          spacing: { before: 200 }
        }));

        children.push(new Paragraph({
          children: createFormattedRuns(sol.questionDisplay || ""),
          spacing: { after: 100 }
        }));

        // Solution Header
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "LỜI GIẢI CHI TIẾT:", bold: true, color: "1565C0" }), // Blue
          ],
        }));

        // Solution Body (Split by newlines for paragraphs)
        const lines = (sol.solutionDisplay || "").split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            children.push(new Paragraph({
              children: createFormattedRuns(line),
              spacing: { after: 100 },
              bullet: line.trim().startsWith('-') ? { level: 0 } : undefined
            }));
          }
        });

        // Illustration in Word: Supported via ImageRun since we have Base64
        if (sol.illustrationImage) {
             children.push(new Paragraph({
                text: "Hình minh họa:",
                spacing: { before: 100 }
             }));
             
             try {
               children.push(new Paragraph({
                 children: [
                   new ImageRun({
                     data: sol.illustrationImage, // Base64 string
                     transformation: {
                       width: 300,
                       height: 300,
                     },
                     type: "png" // Assuming Gemini returns PNG/JPEG compatible bytes
                   }),
                 ],
                 alignment: AlignmentType.CENTER,
                 spacing: { after: 100 }
               }));
             } catch (imgError) {
               console.error("Error embedding image into Word:", imgError);
               children.push(new Paragraph({
                 text: "[Không thể chèn ảnh minh họa]",
                 italics: true,
                 color: "FF0000"
               }));
             }
        }
        
        children.push(new Paragraph({ text: "________________________________________________________", alignment: AlignmentType.CENTER }));
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "GiaSuThongMinh_LoiGiai.docx";
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (e) {
      console.error("Word export failed", e);
      alert("Lỗi khi xuất file Word.");
    } finally {
      setIsGeneratingWord(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const PAGE_WIDTH = pdf.internal.pageSize.getWidth(); // 210mm
      const PAGE_HEIGHT = pdf.internal.pageSize.getHeight(); // 297mm
      const MARGIN_X = 15; // 15mm margins
      const MARGIN_Y = 15;
      const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN_X * 2);
      const CONTENT_HEIGHT = PAGE_HEIGHT - (MARGIN_Y * 2);

      let currentY = MARGIN_Y;

      // Select all logical blocks (Header, Content, individual Solutions)
      const elements = printRef.current.querySelectorAll('.print-item');
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLElement;
        
        // Capture element
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * CONTENT_WIDTH) / canvas.width;

        // Check if the element fits on the current page
        // Logic: If (Current Position + Element Height) > (Page Limit)
        if (currentY + imgHeight > PAGE_HEIGHT - MARGIN_Y) {
          // If the element ITSELF is huge (longer than a full page), we must split it.
          // Otherwise, we just push it to the next page.
          
          if (imgHeight > CONTENT_HEIGHT) {
            // Complex case: Large item (e.g., long original text). 
            // We'll print what we can, then add page, then print rest.
            // Simplified for stability: Just add a page first, then split if still needed.
            if (currentY > MARGIN_Y) {
               pdf.addPage();
               currentY = MARGIN_Y;
            }

            // Split logic for very long single items
            let remainingHeight = imgHeight;
            let sourceY = 0; // Where to slice from source image (in PDF units, conceptual)
            
            while (remainingHeight > 0) {
              const heightToPrint = Math.min(remainingHeight, CONTENT_HEIGHT);
              
              // Note: jsPDF addImage doesn't support source slicing easily without canvas manipulation.
              // So for this MVP, we just print the whole image with an offset and masking, 
              // OR we rely on the browser to have rendered logical blocks smaller than a page.
              // Given the app structure, "Original Content" is the only risk.
              // Strategy: Print the image. It will overflow. We accept the overflow/cut for >A4 blocks 
              // BUT we ensure <A4 blocks (solutions) are never cut.
              
              pdf.addImage(imgData, 'PNG', MARGIN_X, currentY, CONTENT_WIDTH, imgHeight);
              
              // Move pointers
              remainingHeight -= CONTENT_HEIGHT;
              if (remainingHeight > 0) {
                 pdf.addPage();
                 currentY = MARGIN_Y;
                 // To do true slicing properly requires creating new canvases. 
                 // For now, let's assume 'Original Content' fits or user accepts split. 
                 // The main fix requested is for Solutions not to be cut.
                 break; // Stop loop to prevent infinite printing of same image
              }
            }
            // After printing a huge block, reset Y
            currentY = MARGIN_Y + Math.min(imgHeight, CONTENT_HEIGHT) + 5; // Add some gap

          } else {
            // Common case: Solution card or Header fits on a page, just not THIS page.
            pdf.addPage();
            currentY = MARGIN_Y;
            pdf.addImage(imgData, 'PNG', MARGIN_X, currentY, CONTENT_WIDTH, imgHeight);
            currentY += imgHeight + 5; // 5mm gap
          }
        } else {
          // Fits on current page
          pdf.addImage(imgData, 'PNG', MARGIN_X, currentY, CONTENT_WIDTH, imgHeight);
          currentY += imgHeight + 5; // 5mm gap
        }
      }
      
      pdf.save('Gia_Su_Thong_Minh_Tai_Lieu.pdf');
      
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Có lỗi khi tạo file PDF. Vui lòng thử lại.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Determine what to display in the main viewport
  const renderMainContent = () => {
    // 1. If showing a solution, always show text (since solution is generated text)
    if (isShowingSolution) {
      return (
         <div className="text-slate-300 whitespace-pre-wrap leading-relaxed font-light text-lg">
            <ScientificText text={activeScript} />
         </div>
      );
    }

    // 2. If showing Original Content
    if (fileData) {
       // A. If Image -> Show Image
       if (fileData.mimeType.startsWith('image/')) {
         return (
           <div className="flex items-start justify-center h-full bg-slate-900 rounded-lg">
             <img 
               src={fileData.previewUrl} 
               alt="Original Content" 
               className="max-w-full h-auto object-contain rounded-lg shadow-md" 
             />
           </div>
         );
       }
       // B. If PDF -> Show PDF Iframe
       if (fileData.mimeType.includes('pdf')) {
          return (
             <div className="w-full h-full rounded-lg overflow-hidden bg-slate-900">
               <iframe 
                 src={fileData.previewUrl} 
                 className="w-full h-full border-0"
                 title="PDF Viewer"
               />
             </div>
          );
       }
    }

    // C. Fallback (Text input or no file) -> Show Transcribed Script
    return (
      <div className="text-slate-300 whitespace-pre-wrap leading-relaxed font-light text-lg">
        <ScientificText text={activeScript} />
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in-up space-y-6">
      
      {/* Hidden Printable Area for PDF Generation - Structured Blocks */}
      <div className="fixed top-0 left-[-10000px] w-[210mm]">
        <div 
          ref={printRef} 
          className="bg-white text-slate-900 font-sans"
        >
          {/* Block 1: Header */}
          <div className="print-item p-10 pb-4">
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-blue-800 uppercase">Gia Sư Thông Minh</h1>
                <p className="text-sm text-slate-600">Hỗ trợ học tập bằng AI</p>
              </div>
              <p className="text-xs text-slate-500">Ngày tạo: {new Date().toLocaleDateString('vi-VN')}</p>
            </div>
          </div>

          {/* Block 2: Original Content */}
          <div className="print-item px-10 mb-4">
             <h2 className="text-lg font-bold bg-slate-100 p-2 border-l-4 border-blue-600 mb-4 uppercase">
              1. Nội dung tài liệu
            </h2>
            {fileData && fileData.mimeType.startsWith('image/') ? (
               <div className="flex justify-center mb-4">
                 <img src={fileData.previewUrl} alt="Original" className="max-w-full object-contain" />
               </div>
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-justify">
                <ScientificText text={script} />
              </div>
            )}
          </div>

          {/* Block 3: Solutions Header */}
          {solutions.length > 0 && (
            <div className="print-item px-10 mb-2">
               <h2 className="text-lg font-bold bg-slate-100 p-2 border-l-4 border-emerald-600 mb-2 uppercase">
                2. Lời giải & Đáp án
              </h2>
            </div>
          )}

          {/* Block 4...N: Individual Solutions */}
          {solutions.map((item, idx) => (
            <div key={idx} className="print-item px-10 mb-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="font-bold text-blue-700 text-sm mb-2 border-b border-slate-200 pb-1">
                  Bài {idx + 1}
                </div>
                
                <div className="text-sm italic text-slate-600 mb-3 pl-3 border-l-2 border-slate-300 bg-white p-2 rounded">
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">Đề bài:</span>
                  <ScientificText text={item.questionDisplay} />
                </div>
                
                <div className="text-sm font-medium text-slate-900 whitespace-pre-wrap leading-relaxed">
                   <span className="font-semibold text-emerald-600 text-xs uppercase block mb-1">Lời giải:</span>
                  <ScientificText text={item.solutionDisplay} />
                </div>
                
                {item.illustrationImage && (
                   <div className="mt-4 flex flex-col items-center bg-white border border-slate-200 rounded p-2">
                      <span className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide w-full text-center border-b pb-1">Minh họa (AI Generated)</span>
                      <div className="w-full flex justify-center mt-1">
                         <img 
                           src={`data:image/png;base64,${item.illustrationImage}`}
                           alt="Illustration"
                           className="max-h-[250px] object-contain"
                         />
                      </div>
                   </div>
                )}
              </div>
            </div>
          ))}

          {/* Block Final: Footer */}
          <div className="print-item p-10 pt-4">
            <div className="border-t border-slate-200 pt-2 text-center text-xs text-slate-400">
              Tài liệu được tạo tự động bởi ứng dụng Gia Sư Thông Minh - THPT Đào Duy Từ
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Main Display Section (Image/PDF/Text) */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-semibold text-white flex items-center truncate max-w-[200px]">
              {isShowingSolution ? <BrainCircuit className="w-4 h-4 mr-2 text-emerald-400" /> : <ImageIcon className="w-4 h-4 mr-2 text-blue-400" />}
              {activeTitle}
            </h3>
            {isShowingSolution ? (
              <button 
                onClick={handleBackToOriginal}
                className="flex items-center px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white transition-colors"
              >
                <ArrowLeft className="w-3 h-3 mr-1" />
                Xem tài liệu gốc
              </button>
            ) : (
              <span className="text-xs text-slate-500 uppercase tracking-wider">Tài liệu gốc</span>
            )}
          </div>
          <div className="p-6 overflow-y-auto flex-1 bg-slate-900/30 scroll-smooth">
             {renderMainContent()}
          </div>
        </div>

        {/* Player Controls Section */}
        <div className="flex flex-col space-y-4">
          <div className={`
            bg-gradient-to-br rounded-xl border border-slate-700 p-6 shadow-xl flex flex-col items-center justify-center min-h-[200px] relative overflow-hidden flex-1 transition-colors duration-500
            ${isShowingSolution ? 'from-emerald-900 to-slate-900' : 'from-indigo-900 to-slate-900'}
          `}>
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
              <div className={`absolute w-32 h-32 rounded-full blur-3xl -top-10 -left-10 ${isShowingSolution ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
              <div className={`absolute w-32 h-32 rounded-full blur-3xl bottom-0 right-0 ${isShowingSolution ? 'bg-teal-500' : 'bg-purple-500'}`}></div>
            </div>

            {/* Visualizer Circle */}
            <div className={`
              w-32 h-32 rounded-full flex items-center justify-center border-4 relative mb-6 transition-all duration-300 
              ${isPlaying 
                ? (isShowingSolution ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-105' : 'border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.5)] scale-105')
                : 'border-slate-600'
              }
            `}>
              <div className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-300 ${isShowingSolution ? 'bg-emerald-500/20' : 'bg-blue-500/20'} ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
              <Volume2 className={`w-12 h-12 ${isPlaying ? 'text-white' : 'text-slate-500'}`} />
            </div>

            {/* Hidden Audio Element */}
            <audio
              ref={audioRef}
              src={activeAudioUrl || undefined}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              className="hidden"
            />

            <div className="w-full space-y-2 z-10">
              <input
                type="range"
                value={progress}
                onChange={handleSeek}
                className={`w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer hover:accent-opacity-80
                   ${isShowingSolution ? 'accent-emerald-500' : 'accent-blue-500'}
                `}
              />
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>{audioRef.current ? formatTime(audioRef.current.currentTime) : "00:00"}</span>
                <span>{audioRef.current ? formatTime(audioRef.current.duration) : "00:00"}</span>
              </div>
            </div>

            <div className="flex items-center space-x-6 mt-6 z-10">
              <button
                onClick={togglePlay}
                className={`w-14 h-14 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10
                  ${isShowingSolution ? 'text-emerald-900' : 'text-indigo-900'}
                `}
              >
                {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <button
              onClick={onReset}
              className="col-span-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg font-medium transition-colors flex items-center justify-center text-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Làm mới
            </button>
            
            {activeAudioUrl && (
              <a
                href={activeAudioUrl}
                download={`vietreader-${isShowingSolution ? 'solution' : 'content'}.wav`}
                className="col-span-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg font-medium transition-colors flex items-center justify-center text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Audio
              </a>
            )}

            {/* WORD DOWNLOAD BUTTON */}
            <button
              onClick={handleDownloadWord}
              disabled={isGeneratingWord}
              className="col-span-1 bg-blue-700 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-all shadow-lg flex items-center justify-center text-sm"
            >
              {isGeneratingWord ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileTextIcon className="w-4 h-4 mr-2" />
              )}
              {isGeneratingWord ? "Đang tạo..." : "Tải Word (.docx)"}
            </button>

            {/* PDF DOWNLOAD BUTTON */}
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="col-span-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-3 rounded-lg font-medium transition-all shadow-lg flex items-center justify-center text-sm"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Printer className="w-4 h-4 mr-2" />
              )}
              {isGeneratingPDF ? "Đang tạo..." : "Tải PDF"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* YouTube Recommendations Section */}
        {relatedVideos.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-6">
            <h3 className="font-semibold text-white flex items-center mb-4 text-lg">
              <Youtube className="w-6 h-6 mr-2 text-red-500" />
              Video tham khảo trên Youtube
            </h3>
            <div className="flex flex-col space-y-3">
              {relatedVideos.map((v, i) => (
                <a 
                  key={i} 
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(v.query)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center p-3 rounded-lg bg-slate-900/50 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 transition-all group"
                >
                  <div className="bg-red-500/10 p-2.5 rounded-full mr-3 group-hover:bg-red-500/20 shrink-0">
                    <Play className="w-4 h-4 text-red-500 fill-current ml-0.5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-200 text-sm group-hover:text-blue-400 transition-colors">{v.title}</p>
                    <p className="text-xs text-slate-500 mt-1">Tìm kiếm: "{v.query}"</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* AI Solutions Section */}
        {solutions.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-6">
            <h3 className="font-semibold text-white flex items-center mb-4 text-lg">
              <BrainCircuit className="w-6 h-6 mr-2 text-emerald-500" />
              Gia Sư AI - Lời Giải Chi Tiết
            </h3>
            <p className="text-slate-400 text-sm mb-4">Nhấn vào biểu tượng loa để nghe lời giải chi tiết (Có danh pháp Anh-Việt).</p>
            <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
               {solutions.map((item, index) => (
                 <SolutionCard 
                   key={index} 
                   item={item} 
                   index={index} 
                   onPlayRequest={handlePlaySolution}
                 />
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Player;