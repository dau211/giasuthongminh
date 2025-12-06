
import { ProcessingResult, HistoryEntry } from '../types';

const DB_NAME = 'GiaSuThongMinh_DB';
const STORE_NAME = 'analysis_cache';
const DB_VERSION = 1;

/**
 * Open the IndexedDB database
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export interface CachedItem {
  id: string; // The SHA-256 hash of the input content
  timestamp: number;
  data: ProcessingResult;
}

/**
 * Save analysis result to cache
 */
export const saveToCache = async (hash: string, result: ProcessingResult): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const item: CachedItem = {
        id: hash,
        timestamp: Date.now(),
        data: result
      };

      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save to cache:', error);
  }
};

/**
 * Retrieve result from cache by hash
 */
export const getFromCache = async (hash: string): Promise<ProcessingResult | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(hash);

      request.onsuccess = () => {
        const result = request.result as CachedItem;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to read from cache:', error);
    return null;
  }
};

/**
 * Get all history entries (metadata only)
 */
export const getHistory = async (): Promise<HistoryEntry[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as CachedItem[];
        // Map to lighter objects for the UI list
        const history: HistoryEntry[] = results.map(item => ({
          id: item.id,
          timestamp: item.timestamp,
          // Create a title from the first line or first 50 chars of the script
          title: item.data.script.split('\n')[0].substring(0, 60) + (item.data.script.length > 60 ? '...' : '')
        })).sort((a, b) => b.timestamp - a.timestamp); // Sort newest first
        
        resolve(history);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get history:', error);
    return [];
  }
};

/**
 * Delete item from cache
 */
export const deleteFromCache = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete from cache:', error);
  }
};
