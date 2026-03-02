import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, Shadows, BorderRadius } from '@/constants/theme';
import { usePDFFiles } from '@/hooks/usePDFFiles';
import { useUndoRedoHistory } from '@/hooks/useUndoRedoHistory';
import { useAdvancedFileOperations } from '@/hooks/useAdvancedFileOperations';
import { Ionicons } from '@expo/vector-icons';

/**
 * PDF Flick - 強化版メイン画面
 * 
 * デザイン哲学: エレガント・プロフェッショナル型
 * - Undo/Redo機能の完全実装
 * - 高度なファイル操作
 * - ゴミ箱機能
 */

const SWIPE_THRESHOLD = 50; // フリック判定の閾値（ピクセル）

export default function PDFFlickEnhancedScreen() {
  const { files, loading, error } = usePDFFiles();
  const { addToHistory, undo, redo, canUndo, canRedo, getStatistics } = useUndoRedoHistory();
  const { moveFile, moveToTrash, restoreFromTrash, operationState } = useAdvancedFileOperations();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveFolderPath, setSaveFolderPath] = useState<string | null>(null);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<Set<string>>(new Set());

  // アニメーション用
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (e, { dx }) => {
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
          if (dx > 0) {
            // 右フリック: 保存
            handleKeep();
          } else {
            // 左フリック: 削除
            handleDelete();
          }
        }

        // カードを元の位置に戻す
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  /**
   * ファイルを保存フォルダに移動
   */
  const handleKeep = async () => {
    if (currentIndex >= files.length) return;
    if (!saveFolderPath) {
      Alert.alert('エラー', '保存先フォルダが設定されていません');
      return;
    }

    const currentFile = files[currentIndex];

    // 操作履歴に追加
    addToHistory({
      action: 'keep',
      fileId: currentFile.id,
      fileName: currentFile.name,
      filePath: currentFile.path,
      metadata: {
        destinationPath: saveFolderPath,
        previousState: { processed: false },
      },
    });

    // ファイルを移動
    const result = await moveFile(currentFile.path, saveFolderPath);
    if (!result.success) {
      Alert.alert('エラー', `ファイル移動に失敗しました: ${result.error}`);
      return;
    }

    // 処理済みファイルに追加
    setProcessedFiles((prev) => new Set([...prev, currentFile.id]));
    moveToNext();
  };

  /**
   * ファイルをゴミ箱に移動
   */
  const handleDelete = async () => {
    if (currentIndex >= files.length) return;

    const currentFile = files[currentIndex];

    // 操作履歴に追加
    addToHistory({
      action: 'delete',
      fileId: currentFile.id,
      fileName: currentFile.name,
      filePath: currentFile.path,
      metadata: {
        previousState: { processed: false },
      },
    });

    // ゴミ箱に移動
    const result = await moveToTrash(currentFile.path);
    if (!result.success) {
      Alert.alert('エラー', `ファイル削除に失敗しました: ${result.error}`);
      return;
    }

    // 処理済みファイルに追加
    setProcessedFiles((prev) => new Set([...prev, currentFile.id]));
    moveToNext();
  };

  /**
   * 直前の操作を取り消す
   */
  const handleUndo = async () => {
    if (!canUndo()) {
      Alert.alert('情報', '取り消す操作がありません');
      return;
    }

    const lastEntry = undo();
    if (!lastEntry) return;

    // 操作を取り消す
    if (lastEntry.action === 'keep') {
      // 保存したファイルを元に戻す
      if (lastEntry.metadata?.destinationPath) {
        const result = await moveFile(
          lastEntry.metadata.destinationPath + lastEntry.fileName,
          lastEntry.filePath.substring(0, lastEntry.filePath.lastIndexOf('/') + 1)
        );
        if (!result.success) {
          Alert.alert('エラー', `取り消しに失敗しました: ${result.error}`);
        }
      }
    } else if (lastEntry.action === 'delete') {
      // ゴミ箱から復元
      if (lastEntry.metadata?.trashPath) {
        const result = await restoreFromTrash(lastEntry.metadata.trashPath, lastEntry.filePath);
        if (!result.success) {
          Alert.alert('エラー', `復元に失敗しました: ${result.error}`);
        }
      }
    }

    // 処理済みファイルから削除
    setProcessedFiles((prev) => {
      const newSet = new Set(prev);
      newSet.delete(lastEntry.fileId);
      return newSet;
    });

    // インデックスを戻す
    setCurrentIndex(Math.max(0, currentIndex - 1));
  };

  /**
   * 次のファイルに移動
   */
  const moveToNext = () => {
    if (currentIndex + 1 >= files.length) {
      setShowCompletionScreen(true);
    } else {
      setCurrentIndex(currentIndex + 1);
      pan.setValue({ x: 0, y: 0 });
    }
  };

  /**
   * 処理を最初からやり直す
   */
  const handleReset = () => {
    setCurrentIndex(0);
    setProcessedFiles(new Set());
    setShowCompletionScreen(false);
    pan.setValue({ x: 0, y: 0 });
  };

  // ローディング状態
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>ファイルをスキャン中...</Text>
      </View>
    );
  }

  // エラー状態
  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>エラーが発生しました</Text>
        <Text style={styles.errorDetailText}>{error}</Text>
      </View>
    );
  }

  // ファイルがない状態
  if (files.length === 0) {
    return (
      <View style={styles.container}>
        <Ionicons name="document-outline" size={48} color={Colors.muted} />
        <Text style={styles.emptyText}>PDFファイルが見つかりません</Text>
      </View>
    );
  }

  // 完了画面
  if (showCompletionScreen) {
    const stats = getStatistics();
    return (
      <View style={styles.container}>
        <View style={styles.completionCard}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          <Text style={styles.completionTitle}>処理完了！</Text>
          <Text style={styles.completionSubtitle}>すべてのファイルを処理しました</Text>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>保存</Text>
              <Text style={styles.statValue}>{stats.keep}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>削除</Text>
              <Text style={styles.statValue}>{stats.delete}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Ionicons name="refresh" size={20} color={Colors.white} />
            <Text style={styles.resetButtonText}>もう一度整理する</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentFile = files[currentIndex];
  const stats = getStatistics();

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>PDF Flick</Text>
        <Text style={styles.subtitle}>
          {currentIndex + 1} / {files.length}
        </Text>
      </View>

      {/* ファイルカード */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [{ translateX: pan.x }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={32} color={Colors.primary} />
            <Text style={styles.fileName} numberOfLines={2}>
              {currentFile.name}
            </Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ファイルサイズ:</Text>
              <Text style={styles.infoValue}>
                {(currentFile.size / 1024).toFixed(2)} KB
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>更新日時:</Text>
              <Text style={styles.infoValue}>
                {new Date(currentFile.modifiedDate).toLocaleDateString('ja-JP')}
              </Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.hint}>← スワイプして削除 | 保存 →</Text>
          </View>
        </View>
      </Animated.View>

      {/* 統計情報 */}
      <View style={styles.statsBar}>
        <View style={styles.statBadge}>
          <Ionicons name="checkmark" size={16} color={Colors.success} />
          <Text style={styles.statBadgeText}>{stats.keep}</Text>
        </View>
        <View style={styles.statBadge}>
          <Ionicons name="trash" size={16} color={Colors.error} />
          <Text style={styles.statBadgeText}>{stats.delete}</Text>
        </View>
      </View>

      {/* ボタンエリア */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={handleDelete}
          disabled={operationState.isProcessing}
        >
          <Ionicons name="trash-outline" size={20} color={Colors.white} />
          <Text style={styles.buttonText}>削除</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.undoButton, !canUndo() && styles.buttonDisabled]}
          onPress={handleUndo}
          disabled={!canUndo() || operationState.isProcessing}
        >
          <Ionicons name="arrow-undo" size={20} color={Colors.white} />
          <Text style={styles.buttonText}>元に戻す</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.keepButton]}
          onPress={handleKeep}
          disabled={operationState.isProcessing}
        >
          <Ionicons name="checkmark-outline" size={20} color={Colors.white} />
          <Text style={styles.buttonText}>保存</Text>
        </TouchableOpacity>
      </View>

      {/* ローディングインジケーター */}
      {operationState.isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.processingText}>処理中...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  header: {
    width: '100%',
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.muted,
  },
  cardContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.foreground,
    marginLeft: Spacing.md,
    flex: 1,
  },
  cardBody: {
    marginBottom: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.muted,
  },
  infoValue: {
    fontSize: 12,
    color: Colors.foreground,
    fontWeight: '500',
  },
  cardFooter: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  hint: {
    fontSize: 12,
    color: Colors.muted,
    fontStyle: 'italic',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  statBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.foreground,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  undoButton: {
    backgroundColor: Colors.muted,
  },
  keepButton: {
    backgroundColor: Colors.success,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  completionCard: {
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.foreground,
    marginTop: Spacing.md,
  },
  completionSubtitle: {
    fontSize: 14,
    color: Colors.muted,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.muted,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.foreground,
    marginTop: Spacing.xs,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  resetButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 14,
    color: Colors.muted,
    marginTop: Spacing.md,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.error,
    marginTop: Spacing.md,
  },
  errorDetailText: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: Spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.muted,
    marginTop: Spacing.md,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  processingText: {
    color: Colors.white,
    marginTop: Spacing.md,
    fontWeight: '600',
  },
});
