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
    const cached = await getFromCache(id);
    if (cached) {
      setResult(cached);
      setIsCachedResult(true);
      setAppState(AppState.IDLE);
      setShowHistory(false);
    }
  };

  const handleProcess = async () => {
    if (mode === InputMode.TEXT && !textInput.trim()) return;
    if (mode === InputMode.FILE && !file) return;

    setAppState(AppState.ANALYZING);
    setStatusMessage('Đang phân tích tài liệu...');
    setResult(null);

    try {
      let contentHash = '';
      let fileBase64: string | undefined = undefined;
      let mimeType: string | undefined = undefined;

      if (mode === InputMode.FILE && file) {
        fileBase64 = await readFileToBase64(file.file);
        contentHash = await computeContentHash(fileBase64);
        mimeType = file.mimeType;
      } else {
        contentHash = await computeContentHash(textInput);
      }

      // Check cache
      const cached = await getFromCache(contentHash);
      if (cached) {
        setResult(cached);
        setIsCachedResult(true);
        setAppState(AppState.IDLE);
        return; 
      }

      // Step 1: Generate Script (OCR)
      setStatusMessage('Đang đọc nội dung (OCR)...');
      const { displayScript, readingScript } = await generateReadingScript(
        mode === InputMode.TEXT ? textInput : '',
        fileBase64,
        mimeType
      );

      // Step 2: Analyze and Solve
      setStatusMessage('Đang giải bài tập & vẽ hình minh họa...');
      const solutions = await analyzeAndSolve(displayScript, fileBase64, mimeType); 

      // Step 3: Videos
      setStatusMessage('Đang tìm video tham khảo...');
      const relatedVideos = await getRelatedVideoQueries(displayScript);

      // Step 4: TTS
      setStatusMessage('Đang tạo giọng đọc...');
      const audioBase64 = await synthesizeSpeech(readingScript);

      const newResult: ProcessingResult = {
        script: displayScript,
        audioBase64,
        relatedVideos,
        solutions
      };

      // Save to cache
      await saveToCache(contentHash, newResult);

      setResult(newResult);
      setAppState(AppState.IDLE);

    } catch (error) {
      console.error(error);
      setAppState(AppState.ERROR);
      setStatusMessage('Có lỗi xảy ra: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 hidden sm:block">
              Gia Sư Thông Minh
            </h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistory(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center space-x-2"
              title="Lịch sử"
            >
              <HistoryIcon className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">Lịch sử</span>
            </button>
            <div className="h-6 w-px bg-slate-700 mx-2"></div>
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-slate-300">Gemini 2.5 Flash</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4 max-w-7xl mx-auto">
        <HistoryList 
          isOpen={showHistory} 
          onClose={() => setShowHistory(false)}
          onSelect={loadFromHistory}
        />

        {!result && appState !== AppState.ERROR ? (
          <div className="animate-fade-in space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto mt-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                Gia Sư <span className="text-blue-500">Thông Minh</span>
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                Tải lên tài liệu pdf, Word, Hình ảnh để Gia sư phân tích và hướng dẫn học tập
              </p>
            </div>

            <div className="relative">
              {appState !== AppState.IDLE && (
                 <div className="absolute inset-0 z-10 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-fade-in">
                    <div className="relative mb-8">
                       <div className="w-20 h-20 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
                       <div className="absolute inset-0 flex items-center justify-center">
                         <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
                       </div>
                    </div>
                    <p className="text-xl font-medium text-blue-400 animate-pulse">{statusMessage}</p>
                    <p className="text-sm text-slate-500 mt-2">Quá trình này có thể mất vài giây...</p>
                 </div>
              )}
              
              <InputSection
                mode={mode}
                setMode={setMode}
                text={textInput}
                setText={setTextInput}
                file={file}
                setFile={setFile}
                isProcessing={appState !== AppState.IDLE}
                onProcess={handleProcess}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {appState === AppState.ERROR ? (
               <div className="p-6 bg-red-900/20 border border-red-800 rounded-xl text-center">
                  <p className="text-red-400 text-lg mb-4">{statusMessage}</p>
                  <button 
                    onClick={handleReset}
                    className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
                  >
                    Thử lại
                  </button>
               </div>
            ) : (
              result && (
                <>
                  {isCachedResult && (
                    <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-2 rounded-lg text-sm flex items-center justify-center mb-4 w-fit mx-auto">
                      <Database className="w-4 h-4 mr-2" />
                      Đã tải lại kết quả từ bộ nhớ đệm
                    </div>
                  )}
                  <Player
                    script={result.script}
                    audioUrl={result.audioBase64 ? getAudioDataUrl(result.audioBase64) : null}
                    relatedVideos={result.relatedVideos}
                    solutions={result.solutions}
                    onReset={handleReset}
                    fileData={file}
                  />
                </>
              )
            )}
          </div>
        )}
      </main>
       <footer className="mt-20 text-center text-slate-600 text-sm">
          <p>Phát triển bởi nhóm học sinh THPT Đào Duy Từ</p>
        </footer>
    </div>
  );
};

export default App;