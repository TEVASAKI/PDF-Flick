import { useState, useCallback } from 'react';

/**
 * 操作履歴エントリのインターフェース
 */
export interface HistoryEntry {
  action: 'keep' | 'delete';
  fileId: string;
  fileName: string;
  filePath: string;
  timestamp: number;
  metadata?: {
    destinationPath?: string; // keep 操作時の保存先
    trashPath?: string; // delete 操作時のゴミ箱パス
  };
}

/**
 * Undo 機能を管理するカスタムフック
 */
export const useUndoHistory = (maxHistorySize: number = 50) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  /**
   * 操作を履歴に追加
   */
  const addToHistory = useCallback(
    (entry: Omit<HistoryEntry, 'timestamp'>) => {
      setHistory((prevHistory) => {
        const newHistory = [
          ...prevHistory,
          {
            ...entry,
            timestamp: Date.now(),
          },
        ];

        // 履歴サイズを制限
        if (newHistory.length > maxHistorySize) {
          return newHistory.slice(-maxHistorySize);
        }

        return newHistory;
      });
    },
    [maxHistorySize]
  );

  /**
   * 直前の操作を取得（削除しない）
   */
  const peekLastEntry = useCallback((): HistoryEntry | null => {
    return history.length > 0 ? history[history.length - 1] : null;
  }, [history]);

  /**
   * 直前の操作を取得して削除
   */
  const popLastEntry = useCallback((): HistoryEntry | null => {
    if (history.length === 0) return null;

    const lastEntry = history[history.length - 1];
    setHistory((prevHistory) => prevHistory.slice(0, -1));

    return lastEntry;
  }, [history]);

  /**
   * 履歴をクリア
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  /**
   * 履歴のサイズを取得
   */
  const getHistorySize = useCallback(() => {
    return history.length;
  }, [history]);

  /**
   * 操作別の統計情報を取得
   */
  const getStatistics = useCallback(() => {
    const keepCount = history.filter((entry) => entry.action === 'keep').length;
    const deleteCount = history.filter((entry) => entry.action === 'delete').length;

    return {
      total: history.length,
      keep: keepCount,
      delete: deleteCount,
    };
  }, [history]);

  return {
    history,
    addToHistory,
    peekLastEntry,
    popLastEntry,
    clearHistory,
    getHistorySize,
    getStatistics,
  };
};
