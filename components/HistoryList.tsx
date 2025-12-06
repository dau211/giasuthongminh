
import React, { useEffect, useState } from 'react';
import { X, Clock, Trash2, ChevronRight, BookOpen } from 'lucide-react';
import { HistoryEntry } from '../types';
import { getHistory, deleteFromCache } from '../services/storageService';

interface HistoryListProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ isOpen, onClose, onSelect }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoading(true);
    const data = await getHistory();
    setHistory(data);
    setIsLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Bạn có chắc muốn xóa bài học này khỏi lịch sử?')) {
      await deleteFromCache(id);
      loadHistory();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`
        fixed top-0 right-0 h-full w-full sm:w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <div className="flex items-center text-white font-semibold text-lg">
            <Clock className="w-5 h-5 mr-2 text-blue-400" />
            Lịch Sử Học Tập
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isLoading ? (
            <div className="text-center text-slate-500 mt-10">Đang tải...</div>
          ) : history.length === 0 ? (
            <div className="text-center text-slate-500 mt-10 flex flex-col items-center">
              <BookOpen className="w-12 h-12 mb-3 opacity-20" />
              <p>Chưa có bài học nào được lưu.</p>
              <p className="text-sm mt-2">Hãy tải lên tài liệu để bắt đầu.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className="group bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 rounded-lg p-3 cursor-pointer transition-all relative overflow-hidden"
                >
                   <div className="flex justify-between items-start">
                     <div className="flex-1 pr-8">
                       <p className="text-slate-200 font-medium text-sm line-clamp-2 mb-2">
                         {item.title}
                       </p>
                       <p className="text-xs text-slate-500 flex items-center">
                         {formatDate(item.timestamp)}
                       </p>
                     </div>
                     <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors mt-1" />
                   </div>
                   
                   <button
                    onClick={(e) => handleDelete(e, item.id)}
                    className="absolute top-2 right-2 p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-900/50 rounded transition-all opacity-0 group-hover:opacity-100"
                    title="Xóa"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800/30 text-xs text-slate-500 text-center">
          Dữ liệu được lưu trữ an toàn trên trình duyệt của bạn.
        </div>
      </div>
    </>
  );
};

export default HistoryList;
