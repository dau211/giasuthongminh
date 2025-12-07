import React, { useState } from 'react';
import { AppState, InputMode, FileData, ProcessingResult } from './types';
import InputSection from './components/InputSection';
import Player from './components/Player';
import HistoryList from './components/HistoryList';
import { readFileToBase64 } from './services/fileUtils';
import { generateReadingScript, synthesizeSpeech, getAudioDataUrl, getRelatedVideoQueries, analyzeAndSolve } from './services/geminiService';
import { computeContentHash } from './services/hashUtils';
import { getFromCache, saveToCache } from './services/storageService';
import { BookOpen, Sparkles, Database, History as HistoryIcon } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [mode, setMode] = useState<InputMode>(InputMode.FILE);
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState<FileData | null>(null);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isCachedResult, setIsCachedResult] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setResult(null);
    setFile(null);
    setTextInput('');
    setIsCachedResult(false);
  };

  const loadFromHistory = async (id: string) => {
    try {
      setShowHistory(false);
      setStatusMessage('Đang tải từ lịch sử...');
      setAppState(AppState.ANALYZING); // Use temporary state for loader

      const cachedResult = await getFromCache(id);
      
      if (cachedResult) {
        // Regenerate Blob URL from Base64
        const restoredAudioUrl = cachedResult.audioBase64 ? getAudioDataUrl(cachedResult.audioBase64) : null;
        
        // Short timeout for smoother transition
        setTimeout(() => {
          setResult({
            ...cachedResult,
            audioBase64: restoredAudioUrl
          });
          setIsCachedResult(true);
          setAppState(AppState.PLAYING);
        }, 500);
      } else {
        alert("Không tìm thấy dữ liệu bài học này.");
        setAppState(AppState.IDLE);
      }
    } catch (error) {
      console.error(error);
      setAppState(AppState.ERROR);
      setStatusMessage("Lỗi khi tải lịch sử.");
    }
  };

  const processContent = async () => {
    try {
      setAppState(AppState.ANALYZING);
      
      let base64File = undefined;
      let mimeType = undefined;
      let inputContentForHash = '';

      // Prepare input data
      if (mode === InputMode.FILE && file) {
        setStatusMessage('Đang xử lý file...');
        base64File = await readFileToBase64(file.file);
        mimeType = file.mimeType;
        inputContentForHash = base64File; // Hash the file content
      } else {
        inputContentForHash = textInput.trim(); // Hash the text content
      }

      // --- CACHE CHECK START ---
      setStatusMessage('Đang kiểm tra bộ nhớ đệm...');
      const contentHash = await computeContentHash(inputContentForHash);
      const cachedResult = await getFromCache(contentHash);

      if (cachedResult) {
        console.log("Cache hit! Loading from storage.");
        // If audio url is blob/local, we might need to regenerate the blob URL object 
        // because blob URLs expire when the page refreshes.
        // However, we stored base64 in `audioBase64` inside ProcessingResult, so we can regenerate the URL.
        const restoredAudioUrl = cachedResult.audioBase64 ? getAudioDataUrl(cachedResult.audioBase64) : null;
        
        // Use a timeout to simulate a tiny loading phase so the UI doesn't flash too fast
        setTimeout(() => {
            setResult({
                ...cachedResult,
                audioBase64: restoredAudioUrl // Update URL just in case
            });
            setIsCachedResult(true);
            setAppState(AppState.PLAYING);
        }, 800);
        return;
      }
      // --- CACHE CHECK END ---

      setIsCachedResult(false);
      setStatusMessage('Gia sư AI Studio đang phân tích tài liệu...');

      // Step 1: Analyze & Generate DUAL Script (Display vs Reading)
      const { displayScript, readingScript } = await generateReadingScript(
        mode === InputMode.TEXT ? textInput : '',
        base64File,
        mimeType
      );

      setAppState(AppState.SYNTHESIZING);
      setStatusMessage('Đang tạo giọng đọc chuẩn Anh-Việt và giải bài tập...');

      // Step 2, 3 & 4: TTS (using readingScript), Video suggestions and Solutions (using displayScript)
      const [audioBase64, relatedVideos, solutions] = await Promise.all([
        synthesizeSpeech(readingScript), // Use the specialized script for audio
        getRelatedVideoQueries(displayScript), // Use original content for context
        analyzeAndSolve(displayScript) // Use original content for solving
      ]);

      // Note: We store the raw base64 string in the result object for caching, 
      // but convert to URL for playback.
      
      const finalResult: ProcessingResult = {
        script: displayScript, // Show original content in UI
        audioBase64: audioBase64, // Keep base64 for storage
        relatedVideos,
        solutions
      };

      // --- SAVE TO CACHE ---
      await saveToCache(contentHash, finalResult);

      // Create playable URL
      const audioUrl = getAudioDataUrl(audioBase64);
      
      setResult({
          ...finalResult,
          audioBase64: audioUrl
      });
      
      setAppState(AppState.PLAYING);

    } catch (error) {
      console.error(error);
      setAppState(AppState.ERROR);
      setStatusMessage(error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <header className="relative mb-16 space-y-4">
          <div className="absolute top-0 right-0">
             <button
               onClick={() => setShowHistory(true)}
               className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition-all hover:shadow-lg text-sm font-medium"
             >
               <HistoryIcon className="w-4 h-4 mr-2 text-blue-400" />
               Lịch Sử
             </button>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl mb-4 border border-blue-500/20 shadow-lg shadow-blue-500/10">
              <BookOpen className="w-8 h-8 text-blue-400 mr-3" />
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                Gia Sư <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Thông Minh</span>
              </h1>
            </div>
            <p className="max-w-2xl mx-auto text-lg text-slate-400">
              Tải lên tài liệu pdf, Word, Hình ảnh để Gia sư phân tích và hướng dẫn học tập
            </p>
          </div>
        </header>

        {/* History Sidebar */}
        <HistoryList 
          isOpen={showHistory} 
          onClose={() => setShowHistory(false)} 
          onSelect={loadFromHistory}
        />

        {/* Status Overlay for Loading */}
        {(appState === AppState.ANALYZING || appState === AppState.SYNTHESIZING) && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md transition-opacity">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
              </div>
            </div>
            <h2 className="mt-8 text-xl font-semibold text-white">{statusMessage}</h2>
            <p className="mt-2 text-slate-400 text-sm">Vui lòng không tắt trình duyệt</p>
          </div>
        )}

        {/* Main Interface */}
        <main className="transition-all duration-500">
          {appState === AppState.ERROR ? (
            <div className="max-w-lg mx-auto bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
              <h3 className="text-red-400 font-bold text-lg mb-2">Đã xảy ra lỗi</h3>
              <p className="text-slate-300 mb-6">{statusMessage}</p>
              <button 
                onClick={handleReset}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-medium transition-colors"
              >
                Thử lại
              </button>
            </div>
          ) : result && appState === AppState.PLAYING ? (
            <div className="space-y-4">
                {isCachedResult && (
                    <div className="max-w-5xl mx-auto flex items-center justify-center p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm animate-fade-in">
                        <Database className="w-4 h-4 mr-2" />
                        <span>Nội dung được tải ngay lập tức từ kho lưu trữ (Không cần phân tích lại).</span>
                    </div>
                )}
                <Player 
                  script={result.script}
                  audioUrl={result.audioBase64}
                  relatedVideos={result.relatedVideos}
                  solutions={result.solutions}
                  onReset={handleReset}
                  fileData={file} // Pass the file data to display raw image/pdf
                />
            </div>
          ) : (
            <InputSection
              mode={mode}
              setMode={setMode}
              text={textInput}
              setText={setTextInput}
              file={file}
              setFile={setFile}
              isProcessing={appState !== AppState.IDLE}
              onProcess={processContent}
            />
          )}
        </main>

        <footer className="mt-20 text-center text-slate-600 text-sm">
          <p>Phát triển bởi nhóm học sinh THPT Đào Duy Từ</p>
        </footer>
      </div>
    </div>
  );
};

export default App;