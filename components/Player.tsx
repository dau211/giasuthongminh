import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RefreshCw, Volume2, Download, Youtube, FileText as FileTextIcon, ChevronDown, ChevronUp, CheckCircle, BrainCircuit, Loader2, ArrowLeft, Printer } from 'lucide-react';
import { VideoRecommendation, SolutionItem } from '../types';
import { synthesizeSpeech, getAudioDataUrl } from '../services/geminiService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface PlayerProps {
  script: string;
  audioUrl: string | null;
  relatedVideos: VideoRecommendation[];
  solutions: SolutionItem[];
  onReset: () => void;
}

interface SolutionCardProps {
  item: SolutionItem;
  index: number;
  onPlayRequest: (title: string, text: string, url: string) => void;
}

// Custom Text Renderer for Scientific Formulas
// This detects patterns like "H2", "Fe3", "(OH)2" and renders numbers as subscripts.
// Also strips Markdown bold (**) for cleaner display.
const ScientificText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
  // 1. First, strip any markdown bolding symbols (**)
  const cleanText = text.replace(/\*\*/g, '');

  // 2. Regex for Chemical Elements and Subscripts
  // ([A-Z][a-z]?|\)) -> Group 1: Matches a Chemical Element (Upper or Upper+Lower) OR a closing parenthesis.
  // (\d+)             -> Group 2: Matches one or more digits following Group 1.
  const regex = /([A-Z][a-z]?|\))(\d+)/g;
  
  const parts = cleanText.split(regex);
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

  return <span className={className}>{elements}</span>;
};

const SolutionCard: React.FC<SolutionCardProps> = ({ item, index, onPlayRequest }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [cachedAudioUrl, setCachedAudioUrl] = useState<string | null>(null);

  const handlePlayRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // UPDATE: Only show and read the SOLUTION part.
    // We removed item.questionDisplay and item.questionReading from here.
    
    const title = `Lời giải bài ${index + 1}`;
    
    // The script displayed in the player text area (Visual) - Just the solution
    const displayScriptForPlayer = `LỜI GIẢI BÀI ${index + 1}:\n\n${item.solutionDisplay}`;
    
    // The text sent to TTS (Audio) - Just the solution with IUPAC names
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
          </div>
        </div>
      )}
    </div>
  );
};

const Player: React.FC<PlayerProps> = ({ script, audioUrl, relatedVideos, solutions, onReset }) => {
  const [activeScript, setActiveScript] = useState(script);
  const [activeAudioUrl, setActiveAudioUrl] = useState(audioUrl);
  const [activeTitle, setActiveTitle] = useState("Nội dung gốc");
  const [isShowingSolution, setIsShowingSolution] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
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

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPDF(true);
    
    try {
      const element = printRef.current;
      
      // Capture the element using html2canvas
      // useCORS is important for external images, scale 2 improves quality for printing
      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Initialize PDF (A4 Portrait)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // First Page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add extra pages if content overflows
      while (heightLeft > 0) {
        position = heightLeft - imgHeight; // Shift the image up
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save('Gia_Su_Thong_Minh_Tai_Lieu.pdf');
      
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Có lỗi khi tạo file PDF. Vui lòng thử lại.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in-up space-y-6">
      
      {/* Hidden Printable Area for PDF Generation */}
      {/* 
        CRITICAL FIX for Multipage:
        1. width: 210mm (Exact A4 width) to match jsPDF output.
        2. height: auto (Allow it to grow as long as needed).
        3. position: absolute & z-index: -1000 (Hide from user but keep in DOM for html2canvas).
        4. Do NOT use display:none or visibility:hidden.
      */}
      <div className="fixed top-0 left-0 -z-50 pointer-events-none opacity-0">
        <div 
          ref={printRef} 
          className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-10 font-sans"
          style={{ height: 'auto' }}
        >
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-blue-800 uppercase">Gia Sư Thông Minh</h1>
              <p className="text-sm text-slate-600">Hỗ trợ học tập bằng AI</p>
            </div>
            <p className="text-xs text-slate-500">Ngày tạo: {new Date().toLocaleDateString('vi-VN')}</p>
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-bold bg-slate-100 p-2 border-l-4 border-blue-600 mb-4 uppercase">
              1. Nội dung tài liệu
            </h2>
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-justify">
              <ScientificText text={script} />
            </div>
          </div>

          {solutions.length > 0 && (
            <div>
               <h2 className="text-lg font-bold bg-slate-100 p-2 border-l-4 border-emerald-600 mb-4 uppercase">
                2. Lời giải & Đáp án
              </h2>
              <div className="space-y-6">
                {solutions.map((item, idx) => (
                  <div key={idx} className="border-b border-slate-200 pb-4 last:border-0">
                    <div className="font-bold text-blue-700 text-sm mb-1">Bài {idx + 1}:</div>
                    <div className="text-sm italic text-slate-600 mb-2 pl-4 border-l-2 border-slate-300">
                      <ScientificText text={item.questionDisplay} />
                    </div>
                    <div className="text-sm pl-4 font-medium text-slate-800 whitespace-pre-wrap">
                      <ScientificText text={item.solutionDisplay} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
            Tài liệu được tạo tự động bởi ứng dụng Gia Sư Thông Minh - THPT Đào Duy Từ
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Transcript Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-semibold text-white flex items-center truncate max-w-[200px]">
              <FileTextIcon className="w-4 h-4 mr-2 text-blue-400 shrink-0" />
              {activeTitle}
            </h3>
            {isShowingSolution ? (
              <button 
                onClick={handleBackToOriginal}
                className="flex items-center px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white transition-colors"
              >
                <ArrowLeft className="w-3 h-3 mr-1" />
                Quay lại
              </button>
            ) : (
              <span className="text-xs text-slate-500 uppercase tracking-wider">Kịch bản đọc</span>
            )}
          </div>
          <div className="p-6 overflow-y-auto flex-1 bg-slate-900/30 scroll-smooth">
            <div className="text-slate-300 whitespace-pre-wrap leading-relaxed font-light text-lg">
              <ScientificText text={activeScript} />
            </div>
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

            {/* PDF DOWNLOAD BUTTON */}
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="col-span-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-3 rounded-lg font-medium transition-all shadow-lg shadow-red-500/20 flex items-center justify-center"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Printer className="w-4 h-4 mr-2" />
              )}
              {isGeneratingPDF ? "Đang tạo PDF..." : "Tải PDF Bài Học (Kèm Lời Giải)"}
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