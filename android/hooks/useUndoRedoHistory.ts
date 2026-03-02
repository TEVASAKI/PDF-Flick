import { useState, useCallback } from 'react';

/**
 * 操作履歴エントリのインターフェース
 */
export interface HistoryEntry {
  id: string;
  action: 'keep' | 'delete';
  fileId: string;
  fileName: string;
  filePath: string;
  timestamp: number;
  metadata?: {
    destinationPath?: string; // keep 操作時の保存先
    trashPath?: string; // delete 操作時のゴミ箱パス
    previousState?: any; // 前の状態（復元用）
  };
}

/**
 * Undo/Redo 機能を管理するカスタムフック
 * 複数ステップのUndo/Redo、および操作の詳細な追跡をサポート
 */
export const useUndoRedoHistory = (maxHistorySize: number = 50) => {
  // 過去の操作履歴
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  // 取り消した操作履歴（Redo用）
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  /**
   * 操作を履歴に追加
   * Redo スタックをクリア（新しい操作が行われたため）
   */
  const addToHistory = useCallback(
    (entry: Omit<HistoryEntry, 'timestamp' | 'id'>) => {
      const newEntry: HistoryEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
      };

      setUndoStack((prevHistory) => {
        const newHistory = [...prevHistory, newEntry];

        // 履歴サイズを制限
        if (newHistory.length > maxHistorySize) {
          return newHistory.slice(-maxHistorySize);
        }

        return newHistory;
      });

      // 新しい操作が行われたため、Redo スタックをクリア
      setRedoStack([]);
    },
    [maxHistorySize]
  );

  /**
   * 直前の操作を取得（削除しない）
   */
  const peekLastEntry = useCallback((): HistoryEntry | null => {
    return undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;
  }, [undoStack]);

  /**
   * 直前の操作を Undo
   */
  const undo = useCallback((): HistoryEntry | null => {
    if (undoStack.length === 0) return null;

    const lastEntry = undoStack[undoStack.length - 1];

    setUndoStack((prevHistory) => prevHistory.slice(0, -1));
    setRedoStack((prevRedo) => [...prevRedo, lastEntry]);

    return lastEntry;
  }, [undoStack]);

  /**
   * Undo した操作を Redo
   */
  const redo = useCallback((): HistoryEntry | null => {
    if (redoStack.length === 0) return null;

    const lastRedoEntry = redoStack[redoStack.length - 1];

    setRedoStack((prevRedo) => prevRedo.slice(0, -1));
    setUndoStack((prevHistory) => [...prevHistory, lastRedoEntry]);

    return lastRedoEntry;
  }, [redoStack]);

  /**
   * 複数ステップ Undo
   */
  const undoMultiple = useCallback(
    (steps: number): HistoryEntry[] => {
      const undoedEntries: HistoryEntry[] = [];
      let currentSteps = Math.min(steps, undoStack.length);

      setUndoStack((prevHistory) => {
        const newHistory = [...prevHistory];
        while (currentSteps > 0 && newHistory.length > 0) {
          const entry = newHistory.pop();
          if (entry) {
            undoedEntries.unshift(entry);
          }
          currentSteps--;
        }
        return newHistory;
      });

      setRedoStack((prevRedo) => [...prevRedo, ...undoedEntries]);

      return undoedEntries;
    },
    [undoStack]
  );

  /**
   * 複数ステップ Redo
   */
  const redoMultiple = useCallback(
    (steps: number): HistoryEntry[] => {
      const redoneEntries: HistoryEntry[] = [];
      let currentSteps = Math.min(steps, redoStack.length);

      setRedoStack((prevRedo) => {
        const newRedo = [...prevRedo];
        while (currentSteps > 0 && newRedo.length > 0) {
          const entry = newRedo.pop();
          if (entry) {
            redoneEntries.unshift(entry);
          }
          currentSteps--;
        }
        return newRedo;
      });

      setUndoStack((prevHistory) => [...prevHistory, ...redoneEntries]);

      return redoneEntries;
    },
    [redoStack]
  );

  /**
   * 履歴をクリア
   */
  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  /**
   * Undo スタックのサイズを取得
   */
  const getUndoSize = useCallback(() => {
    return undoStack.length;
  }, [undoStack]);

  /**
   * Redo スタックのサイズを取得
   */
  const getRedoSize = useCallback(() => {
    return redoStack.length;
  }, [redoStack]);

  /**
   * 操作別の統計情報を取得
   */
  const getStatistics = useCallback(() => {
    const allHistory = [...undoStack, ...redoStack];
    const keepCount = allHistory.filter((entry) => entry.action === 'keep').length;
    const deleteCount = allHistory.filter((entry) => entry.action === 'delete').length;

    return {
      total: allHistory.length,
      keep: keepCount,
      delete: deleteCount,
      undoable: undoStack.length,
      redoable: redoStack.length,
    };
  }, [undoStack, redoStack]);

  /**
   * 全履歴を取得（デバッグ用）
   */
  const getAllHistory = useCallback(() => {
    return {
      undo: undoStack,
      redo: redoStack,
    };
  }, [undoStack, redoStack]);

  /**
   * Undo 可能かチェック
   */
  const canUndo = useCallback(() => {
    return undoStack.length > 0;
  }, [undoStack]);

  /**
   * Redo 可能かチェック
   */
  const canRedo = useCallback(() => {
    return redoStack.length > 0;
  }, [redoStack]);

  return {
    // スタック
    undoStack,
    redoStack,
    // 基本操作
    addToHistory,
    peekLastEntry,
    undo,
    redo,
    // 複数ステップ操作
    undoMultiple,
    redoMultiple,
    // ユーティリティ
    clearHistory,
    getUndoSize,
    getRedoSize,
    getStatistics,
    getAllHistory,
    canUndo,
    canRedo,
  };
};
