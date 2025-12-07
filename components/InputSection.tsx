import React, { useRef, useState, useEffect } from 'react';
import { Upload, FileText, Image as ImageIcon, X, FileType, StickyNote } from 'lucide-react';
import { FileData, InputMode } from '../types';
import { validateFile } from '../services/fileUtils';

interface InputSectionProps {
  mode: InputMode;
  setMode: (mode: InputMode) => void;
  text: string;
  setText: (text: string) => void;
  file: FileData | null;
  setFile: (file: FileData | null) => void;
  isProcessing: boolean;
  onProcess: () => void;
}

const InputSection: React.FC<InputSectionProps> = ({
  mode,
  setMode,
  text,
  setText,
  file,
  setFile,
  isProcessing,
  onProcess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (uploadedFile: File) => {
    const validationError = validateFile(uploadedFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    
    // Create local preview for BOTH Images and PDFs so they can be displayed in Player
    const previewUrl = URL.createObjectURL(uploadedFile);

    setFile({
      file: uploadedFile,
      mimeType: uploadedFile.type,
      previewUrl
    });
  };

  // Add Paste Event Listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Check if there are items in the clipboard
      if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;

        for (let i = 0; i < items.length; i++) {
          // If the item is an image
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              e.preventDefault(); // Prevent default paste behavior
              
              // Automatically switch to FILE mode if not already
              setMode(InputMode.FILE);
              
              // Handle the file
              handleFile(blob);
              return; // Stop after finding the first image
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);

    // Cleanup
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [setMode]); // Dependency ensures state updates correctly

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="flex p-1 bg-slate-800 rounded-lg w-fit mx-auto border border-slate-700">
        <button
          onClick={() => setMode(InputMode.FILE)}
          className={`flex items-center px-6 py-2.5 rounded-md text-sm font-medium transition-all ${
            mode === InputMode.FILE
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="w-4 h-4 mr-2" />
          Tải File
        </button>
        <button
          onClick={() => setMode(InputMode.TEXT)}
          className={`flex items-center px-6 py-2.5 rounded-md text-sm font-medium transition-all ${
            mode === InputMode.TEXT
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <StickyNote className="w-4 h-4 mr-2" />
          Nhập Văn Bản
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 min-h-[300px] flex flex-col justify-center shadow-xl">
        
        {mode === InputMode.FILE ? (
          <div className="h-full">
            {!file ? (
              <div
                className={`h-64 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors cursor-pointer
                  ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleChange}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                />
                <div className="p-4 rounded-full bg-slate-700/50 mb-4">
                  <Upload className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-lg font-medium text-slate-200">Kéo thả, Dán ảnh (Ctrl+V) hoặc nhấn để tải lên</p>
                <p className="text-sm text-slate-400 mt-2">Hỗ trợ PDF, Word, Ảnh (PNG, JPG)</p>
                {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
              </div>
            ) : (
              <div className="relative h-64 bg-slate-900 rounded-lg flex flex-col items-center justify-center border border-slate-700 p-4">
                <button
                  onClick={clearFile}
                  className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 rounded-full text-slate-400 transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {file.mimeType.startsWith('image/') ? (
                  <img src={file.previewUrl} alt="Preview" className="h-40 object-contain rounded mb-4" />
                ) : (
                   <div className="mb-4 flex flex-col items-center">
                     <FileType className="w-20 h-20 text-blue-400 mb-2" />
                     <span className="text-xs uppercase font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">
                       {file.mimeType.split('/')[1] || 'DOC'}
                     </span>
                   </div>
                )}
                <p className="font-medium text-slate-200 truncate max-w-xs">{file.file.name}</p>
                <p className="text-xs text-slate-500 mt-1">{(file.file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Dán văn bản của bạn vào đây (bao gồm cả công thức LaTeX, hóa học...)"
            className="w-full h-64 bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-mono text-sm leading-relaxed"
          />
        )}
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <button
          onClick={onProcess}
          disabled={isProcessing || (mode === InputMode.TEXT && !text.trim()) || (mode === InputMode.FILE && !file)}
          className={`
            px-8 py-4 rounded-full font-bold text-lg shadow-lg flex items-center space-x-3 transition-all transform hover:scale-105 active:scale-95
            ${isProcessing || (mode === InputMode.TEXT && !text.trim()) || (mode === InputMode.FILE && !file)
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25'}
          `}
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Đang xử lý AI...</span>
            </>
          ) : (
            <>
              <span>Chuyển Đổi Sang Giọng Nói</span>
              <div className="bg-white/20 p-1 rounded-full">
                <FileText className="w-4 h-4" />
              </div>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default InputSection;