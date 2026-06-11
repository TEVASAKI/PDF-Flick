import { useState, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

export interface PDFFile {
  id: string;
  name: string;
  path: string;
  size: number;
  modifiedDate: number;
  preview?: string;
}

// Androidの実際のDownloadsフォルダパス
export const DOWNLOADS_DIR = 'file:///storage/emulated/0/Download/';

export const usePDFFiles = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scanDownloadFolder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // ディレクトリの存在確認
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (!dirInfo.exists) {
        setFiles([]);
        setError('Downloadsフォルダにアクセスできません。ストレージ権限を確認してください。');
        setLoading(false);
        return;
      }

      // ディレクトリ内のファイルを取得
      const fileList = await FileSystem.readDirectoryAsync(DOWNLOADS_DIR);

      // PDFファイルのみフィルタリング（隠しファイル除外）
      const pdfFiles = fileList.filter(
        (file) => !file.startsWith('.') && file.toLowerCase().endsWith('.pdf')
      );

      // ファイル情報を取得
      const filesWithInfo: PDFFile[] = await Promise.all(
        pdfFiles.map(async (filename) => {
          const filePath = DOWNLOADS_DIR + filename;
          try {
            const fileInfo = await FileSystem.getInfoAsync(filePath);
            return {
              id: filename,
              name: filename,
              path: filePath,
              size: fileInfo.exists ? (fileInfo as any).size ?? 0 : 0,
              modifiedDate: fileInfo.exists ? ((fileInfo as any).modificationTime ?? 0) * 1000 : 0,
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

      // ファイル名でソート
      filesWithInfo.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

      setFiles(filesWithInfo);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ファイル取得エラー';
      setError(errorMessage);
      console.error('Error scanning download folder:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scanDownloadFolder();
  }, [scanDownloadFolder]);

  return { files, loading, error, refresh: scanDownloadFolder };
};

export const useFileOperations = () => {
  const moveFile = async (sourcePath: string, destinationFolder: string) => {
    try {
      const fileName = sourcePath.split('/').pop();
      if (!fileName) throw new Error('ファイル名を取得できません');

      // 末尾のスラッシュを正規化
      const destDir = destinationFolder.endsWith('/') ? destinationFolder : destinationFolder + '/';
      const destinationPath = destDir + fileName;

      await FileSystem.copyAsync({ from: sourcePath, to: destinationPath });
      await FileSystem.deleteAsync(sourcePath);

      return { success: true, path: destinationPath };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ファイル移動エラー';
      console.error('Error moving file:', err);
      return { success: false, error: errorMessage };
    }
  };

  const deleteFile = async (filePath: string) => {
    try {
      await FileSystem.deleteAsync(filePath);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ファイル削除エラー';
      console.error('Error deleting file:', err);
      return { success: false, error: errorMessage };
    }
  };

  const moveToTrash = async (filePath: string) => {
    try {
      // ゴミ箱はアプリ内部ストレージに保存（権限不要）
      const trashDir = (FileSystem.documentDirectory ?? '') + 'trash/';
      const dirInfo = await FileSystem.getInfoAsync(trashDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(trashDir, { intermediates: true });
      }

      const fileName = filePath.split('/').pop();
      if (!fileName) throw new Error('ファイル名を取得できません');

      // タイムスタンプを付与して重複を避ける
      const timestamp = Date.now();
      const trashPath = trashDir + timestamp + '_' + fileName;

      await FileSystem.copyAsync({ from: filePath, to: trashPath });
      await FileSystem.deleteAsync(filePath);

      return { success: true, trashPath };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ファイル削除エラー';
      console.error('Error moving to trash:', err);
      return { success: false, error: errorMessage };
    }
  };

  const restoreFromTrash = async (trashPath: string, originalPath: string) => {
    try {
      await FileSystem.copyAsync({ from: trashPath, to: originalPath });
      await FileSystem.deleteAsync(trashPath);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ファイル復元エラー';
      console.error('Error restoring from trash:', err);
      return { success: false, error: errorMessage };
    }
  };

  return { moveFile, deleteFile, moveToTrash, restoreFromTrash };
};
