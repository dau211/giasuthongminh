import { FileData } from '../types';

export const readFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const getFileIconName = (mimeType: string): string => {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
  return 'file';
};

export const validateFile = (file: File): string | null => {
  const validTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    // Word docs
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'application/msword'
  ];
  
  if (!validTypes.includes(file.type)) {
    return 'Định dạng file không được hỗ trợ. Vui lòng sử dụng PDF, Hình ảnh hoặc Word.';
  }
  
  if (file.size > 20 * 1024 * 1024) {
    return 'Kích thước file quá lớn (Tối đa 20MB).';
  }

  return null;
};