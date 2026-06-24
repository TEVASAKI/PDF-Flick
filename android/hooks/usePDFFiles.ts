import { useState, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { DOWNLOADS_DIR } from '@/constants/appConstants';

export type { } from '@/constants/appConstants';
export { DOWNLOADS_DIR } from '@/constants/appConstants';

export interface PDFFile {
  id: string;
  name: string;
  path: string;
  size: number;
  modifiedDate: number;
  preview?: string;
}

interface FileInfoExtended {
  exists: boolean;
  size?: number;
  modificationTime?: number;
}

export const usePDFFiles = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scanDownloadFolder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (!dirInfo.exists) {
        setFiles([]);
        setError('Downloadsフォルダにアクセスできません。ストレージ権限を確認してください。');
        setLoading(false);
        return;
      }

      const fileList = await FileSystem.readDirectoryAsync(DOWNLOADS_DIR);

      const pdfFiles = fileList.filter(
        (file) => !file.startsWith('.') && file.toLowerCase().endsWith('.pdf')
      );

      const filesWithInfo: PDFFile[] = await Promise.all(
        pdfFiles.map(async (filename) => {
          const filePath = DOWNLOADS_DIR + filename;
          try {
            const fileInfo = await FileSystem.getInfoAsync(filePath) as FileInfoExtended;
            return {
              id: filename,
              name: filename,
              path: filePath,
              size: fileInfo.exists ? (fileInfo.size ?? 0) : 0,
              modifiedDate: fileInfo.exists ? ((fileInfo.modificationTime ?? 0) * 1000) : 0,
            };
          } catch {
            return {
              id: filename,
              name: filename,
              path: filePath,
              size: 0,
              modifiedDate: 0,
            };
          }
        })
      );

      filesWithInfo.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

      setFiles(filesWithInfo);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ファイル取得エラー';
      setError(errorMessage);
      console.error('Error scanning download folder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scanDownloadFolder();
  }, [scanDownloadFolder]);

  return { files, loading, error, refresh: scanDownloadFolder };
};
