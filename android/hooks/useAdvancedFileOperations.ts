import { useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';

/**
 * ファイル操作の結果インターフェース
 */
export interface FileOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * ファイル操作の状態インターフェース
 */
export interface FileOperationState {
  isProcessing: boolean;
  error: string | null;
  lastOperation: {
    type: 'move' | 'delete' | 'restore' | null;
    fileName: string;
    timestamp: number;
  } | null;
}

/**
 * 高度なファイル操作を提供するカスタムフック
 * - ファイルの移動・削除・復元
 * - ゴミ箱機能
 * - エラーハンドリング
 * - 操作状態の追跡
 */
export const useAdvancedFileOperations = () => {
  const [operationState, setOperationState] = useState<FileOperationState>({
    isProcessing: false,
    error: null,
    lastOperation: null,
  });

  /**
   * ゴミ箱ディレクトリのパスを取得
   */
  const getTrashDir = useCallback(async (): Promise<string> => {
    // アプリ内部ストレージにゴミ箱を作成（外部ストレージ権限不要）
    const trashDir = (FileSystem.documentDirectory ?? '') + 'trash/';
    const dirInfo = await FileSystem.getInfoAsync(trashDir);

    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(trashDir, { intermediates: true });
    }

    return trashDir;
  }, []);

  /**
   * ファイルを指定のフォルダに移動
   */
  const moveFile = useCallback(
    async (sourcePath: string, destinationFolder: string): Promise<FileOperationResult> => {
      try {
        setOperationState((prev) => ({
          ...prev,
          isProcessing: true,
          error: null,
        }));

        const fileName = sourcePath.split('/').pop();
        if (!fileName) throw new Error('ファイル名を取得できません');

        // 移動先ディレクトリが存在するか確認
        const destDirInfo = await FileSystem.getInfoAsync(destinationFolder);
        if (!destDirInfo.exists) {
          await FileSystem.makeDirectoryAsync(destinationFolder, { intermediates: true });
        }

        const destinationPath = destinationFolder + fileName;

        // 同名ファイルが存在する場合は上書き確認
        const existingFile = await FileSystem.getInfoAsync(destinationPath);
        if (existingFile.exists) {
          throw new Error(`ファイル "${fileName}" は既に存在します`);
        }

        // ファイルをコピー
        await FileSystem.copyAsync({
          from: sourcePath,
          to: destinationPath,
        });

        // 元のファイルを削除
        await FileSystem.deleteAsync(sourcePath);

        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          lastOperation: {
            type: 'move',
            fileName,
            timestamp: Date.now(),
          },
        }));

        return {
          success: true,
          data: { path: destinationPath, fileName },
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'ファイル移動エラー';
        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));
        console.error('Error moving file:', err);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  /**
   * ファイルを完全に削除
   */
  const deleteFile = useCallback(
    async (filePath: string): Promise<FileOperationResult> => {
      try {
        setOperationState((prev) => ({
          ...prev,
          isProcessing: true,
          error: null,
        }));

        const fileName = filePath.split('/').pop() || 'unknown';

        // ファイルが存在するか確認
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (!fileInfo.exists) {
          throw new Error('ファイルが見つかりません');
        }

        // ファイルを削除
        await FileSystem.deleteAsync(filePath);

        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          lastOperation: {
            type: 'delete',
            fileName,
            timestamp: Date.now(),
          },
        }));

        return { success: true, data: { fileName } };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'ファイル削除エラー';
        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));
        console.error('Error deleting file:', err);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  /**
   * ファイルをゴミ箱に移動（復元可能）
   */
  const moveToTrash = useCallback(
    async (filePath: string): Promise<FileOperationResult> => {
      try {
        setOperationState((prev) => ({
          ...prev,
          isProcessing: true,
          error: null,
        }));

        const fileName = filePath.split('/').pop();
        if (!fileName) throw new Error('ファイル名を取得できません');

        const trashDir = await getTrashDir();
        const timestamp = Date.now();
        const trashFileName = `${timestamp}_${fileName}`;
        const trashPath = trashDir + trashFileName;

        // ファイルをコピー
        await FileSystem.copyAsync({
          from: filePath,
          to: trashPath,
        });

        // 元のファイルを削除
        await FileSystem.deleteAsync(filePath);

        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          lastOperation: {
            type: 'delete',
            fileName,
            timestamp: Date.now(),
          },
        }));

        return {
          success: true,
          data: { trashPath, originalFileName: fileName, originalPath: filePath },
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'ファイル削除エラー';
        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));
        console.error('Error moving to trash:', err);
        return { success: false, error: errorMessage };
      }
    },
    [getTrashDir]
  );

  /**
   * ゴミ箱から復元
   */
  const restoreFromTrash = useCallback(
    async (trashPath: string, originalPath: string): Promise<FileOperationResult> => {
      try {
        setOperationState((prev) => ({
          ...prev,
          isProcessing: true,
          error: null,
        }));

        const fileName = originalPath.split('/').pop() || 'unknown';

        // ファイルをコピー
        await FileSystem.copyAsync({
          from: trashPath,
          to: originalPath,
        });

        // ゴミ箱から削除
        await FileSystem.deleteAsync(trashPath);

        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          lastOperation: {
            type: 'restore',
            fileName,
            timestamp: Date.now(),
          },
        }));

        return { success: true, data: { fileName } };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'ファイル復元エラー';
        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));
        console.error('Error restoring from trash:', err);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  /**
   * ゴミ箱内のファイル一覧を取得
   */
  const getTrashFiles = useCallback(async () => {
    try {
      const trashDir = await getTrashDir();
      const fileList = await FileSystem.readDirectoryAsync(trashDir);

      const trashFiles = await Promise.all(
        fileList.map(async (filename) => {
          const filePath = trashDir + filename;
          const fileInfo = await FileSystem.getInfoAsync(filePath);

          return {
            name: filename,
            path: filePath,
            size: (fileInfo as any).size ?? 0,
            modifiedDate: (fileInfo as any).modificationTime ? (fileInfo as any).modificationTime * 1000 : 0,
          };
        })
      );

      return { success: true, data: trashFiles };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ゴミ箱取得エラー';
      console.error('Error getting trash files:', err);
      return { success: false, error: errorMessage };
    }
  }, [getTrashDir]);

  /**
   * ゴミ箱を空にする
   */
  const emptyTrash = useCallback(async (): Promise<FileOperationResult> => {
    try {
      setOperationState((prev) => ({
        ...prev,
        isProcessing: true,
        error: null,
      }));

      const trashDir = await getTrashDir();
      const fileList = await FileSystem.readDirectoryAsync(trashDir);

      // すべてのファイルを削除
      await Promise.all(
        fileList.map((filename) =>
          FileSystem.deleteAsync(trashDir + filename).catch((err) => {
            console.error(`Error deleting ${filename}:`, err);
          })
        )
      );

      setOperationState((prev) => ({
        ...prev,
        isProcessing: false,
      }));

      return { success: true, data: { filesDeleted: fileList.length } };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ゴミ箱削除エラー';
      setOperationState((prev) => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
      }));
      console.error('Error emptying trash:', err);
      return { success: false, error: errorMessage };
    }
  }, [getTrashDir]);

  /**
   * 操作状態をリセット
   */
  const resetOperationState = useCallback(() => {
    setOperationState({
      isProcessing: false,
      error: null,
      lastOperation: null,
    });
  }, []);

  return {
    // 状態
    operationState,
    // 操作
    moveFile,
    deleteFile,
    moveToTrash,
    restoreFromTrash,
    getTrashFiles,
    emptyTrash,
    // ユーティリティ
    resetOperationState,
    getTrashDir,
  };
};
