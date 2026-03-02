import { useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';

/**
 * PDF ファイル情報インターフェース
 */
export interface PDFFile {
  id: string;
  name: string;
  path: string;
  size: number;
  modifiedDate: number;
  preview?: string; // Base64 encoded preview
}

/**
 * ダウンロードフォルダ内のPDFファイルを取得するカスタムフック
 */
export const usePDFFiles = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const scanDownloadFolder = async () => {
      try {
        setLoading(true);
        setError(null);

        // ダウンロードフォルダのパス
        // Expo では Paths.document を使用
        const downloadDir = new FileSystem.File(Paths.document, 'Downloads').uri + '/';

        // ディレクトリが存在するか確認
        const dirInfo = await FileSystem.getInfoAsync(downloadDir);
        if (!dirInfo.exists) {
          // ディレクトリが存在しない場合は作成
          await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
          setFiles([]);
          setLoading(false);
          return;
        }

        // ディレクトリ内のファイルを取得
        const fileList = await FileSystem.readDirectoryAsync(downloadDir);

        // PDF ファイルのみをフィルタリング
        const pdfFiles = fileList.filter((file) => file.toLowerCase().endsWith('.pdf'));

        // ファイル情報を取得
        const filesWithInfo: PDFFile[] = await Promise.all(
          pdfFiles.map(async (filename) => {
            const filePath = downloadDir + filename;
            const fileInfo = await FileSystem.getInfoAsync(filePath);

            return {
              id: filename, // ファイル名を ID として使用
              name: filename,
              path: filePath,
              size: fileInfo.size || 0,
              modifiedDate: fileInfo.modificationTime ? fileInfo.modificationTime * 1000 : 0,
            };
          })
        );

        // ファイル名でソート
        filesWithInfo.sort((a, b) => a.name.localeCompare(b.name));

        setFiles(filesWithInfo);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'ファイル取得エラー';
        setError(errorMessage);
        console.error('Error scanning download folder:', err);
      } finally {
        setLoading(false);
      }
    };

    scanDownloadFolder();
  }, []);

  return { files, loading, error };
};

/**
 * ファイル操作用のカスタムフック
 */
export const useFileOperations = () => {
  /**
   * ファイルを指定のフォルダに移動
   */
  const moveFile = async (sourcePath: string, destinationFolder: string) => {
    try {
      const fileName = sourcePath.split('/').pop();
      if (!fileName) throw new Error('ファイル名を取得できません');

      const destinationPath = destinationFolder + fileName;

      // ファイルをコピー
      await FileSystem.copyAsync({
        from: sourcePath,
        to: destinationPath,
      });

      // 元のファイルを削除
      await FileSystem.deleteAsync(sourcePath);

      return { success: true, path: destinationPath };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ファイル移動エラー';
      console.error('Error moving file:', err);
      return { success: false, error: errorMessage };
    }
  };

  /**
   * ファイルを削除
   */
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

  /**
   * ファイルをゴミ箱に移動（復元可能）
   */
  const moveToTrash = async (filePath: string) => {
    try {
      const trashDir = new FileSystem.File(Paths.document, 'Trash').uri + '/';
      const dirInfo = await FileSystem.getInfoAsync(trashDir);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(trashDir, { intermediates: true });
      }

      const fileName = filePath.split('/').pop();
      if (!fileName) throw new Error('ファイル名を取得できません');

      const trashPath = trashDir + fileName;

      // ファイルをコピー
      await FileSystem.copyAsync({
        from: filePath,
        to: trashPath,
      });

      // 元のファイルを削除
      await FileSystem.deleteAsync(filePath);

      return { success: true, trashPath };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ファイル削除エラー';
      console.error('Error moving to trash:', err);
      return { success: false, error: errorMessage };
    }
  };

  /**
   * ゴミ箱から復元
   */
  const restoreFromTrash = async (trashPath: string, originalPath: string) => {
    try {
      // ファイルをコピー
      await FileSystem.copyAsync({
        from: trashPath,
        to: originalPath,
      });

      // ゴミ箱から削除
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
