import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Colors, Spacing, Shadows, BorderRadius } from '@/constants/theme';
import { usePDFFiles, useFileOperations } from '@/hooks/usePDFFiles';
import { useUndoHistory } from '@/hooks/useUndoHistory';
import { Ionicons } from '@expo/vector-icons';

/**
 * PDF Flick - メイン画面
 * 
 * デザイン哲学: エレガント・プロフェッショナル型
 * ユーザーが PDF ファイルをフリック操作で整理できるメイン画面
 */

const SWIPE_THRESHOLD = 50; // フリック判定の閾値（ピクセル）

export default function PDFFlickScreen() {
  const { files, loading, error } = usePDFFiles();
  const { moveFile, moveToTrash, restoreFromTrash } = useFileOperations();
  const { addToHistory, popLastEntry, getStatistics } = useUndoHistory();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveFolderPath] = useState<string | null>(null);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);

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

  // 保存処理
  const handleKeep = async () => {
    if (!currentIndex || currentIndex >= files.length) return;
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
      metadata: { destinationPath: saveFolderPath },
    });

    // ファイルを移動
    const result = await moveFile(currentFile.path, saveFolderPath);
    if (!result.success) {
      Alert.alert('エラー', `ファイル移動に失敗しました: ${result.error}`);
      return;
    }

    moveToNext();
  };

  // 削除処理
  const handleDelete = async () => {
    if (!currentIndex || currentIndex >= files.length) return;

    const currentFile = files[currentIndex];

    // ゴミ箱に移動
    const result = await moveToTrash(currentFile.path);
    if (!result.success) {
      Alert.alert('エラー', `ファイル削除に失敗しました: ${result.error}`);
      return;
    }

    // 操作履歴に追加
    addToHistory({
      action: 'delete',
      fileId: currentFile.id,
      fileName: currentFile.name,
      filePath: currentFile.path,
      metadata: { trashPath: result.trashPath },
    });

    moveToNext();
  };

  // Undo 処理
  const handleUndo = async () => {
    const lastEntry = popLastEntry();
    if (!lastEntry) return;

    if (lastEntry.action === 'keep') {
      // 保存を取り消す: ファイルを保存先から元の位置に戻す
      if (lastEntry.metadata?.destinationPath) {
        const result = await moveFile(
          lastEntry.metadata.destinationPath + lastEntry.fileName,
          lastEntry.filePath.substring(0, lastEntry.filePath.lastIndexOf('/') + 1)
        );
        if (!result.success) {
          Alert.alert('エラー', `ファイル復元に失敗しました: ${result.error}`);
        }
      }
    } else if (lastEntry.action === 'delete') {
      // 削除を取り消す: ゴミ箱から復元
      if (lastEntry.metadata?.trashPath) {
        const result = await restoreFromTrash(lastEntry.metadata.trashPath, lastEntry.filePath);
        if (!result.success) {
          Alert.alert('エラー', `ファイル復元に失敗しました: ${result.error}`);
        }
      }
    }

    // 前のファイルに戻す
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (showCompletionScreen) {
      setShowCompletionScreen(false);
      setCurrentIndex(files.length - 1);
    }
  };

  // 次のファイルに移動
  const moveToNext = () => {
    if (currentIndex < files.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // すべてのファイルを処理済み
      setShowCompletionScreen(true);
    }
  };

  // 再度整理する
  const handleRestart = () => {
    setCurrentIndex(0);
    setShowCompletionScreen(false);
  };

  // ローディング状態
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>ファイルを読み込み中...</Text>
      </View>
    );
  }

  // エラー状態
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>エラー: {error}</Text>
      </View>
    );
  }

  // ファイルがない場合
  if (files.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyTitle}>整理するファイルはありません</Text>
        <Text style={styles.emptyText}>ダウンロードフォルダに PDF ファイルを配置してください</Text>
      </View>
    );
  }

  // 完了画面
  if (showCompletionScreen) {
    const stats = getStatistics();
    return (
      <View style={styles.container}>
        <Text style={styles.completionTitle}>整理完了</Text>
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>保存: {stats.keep} 件</Text>
          <Text style={styles.statsText}>削除: {stats.delete} 件</Text>
        </View>
        <TouchableOpacity style={styles.restartButton} onPress={handleRestart}>
          <Text style={styles.restartButtonText}>もう一度整理する</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentFile = files[currentIndex];

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>PDF Flick</Text>
        <Text style={styles.subtitle}>PDF を整理して、必要なファイルを保存しましょう</Text>
      </View>

      {/* メインコンテンツ */}
      <View style={styles.mainContent}>
        {/* 左側ガイド */}
        <View style={styles.guideLeft}>
          <Ionicons name="trash-outline" size={32} color={Colors.light.muted} />
          <Text style={styles.guideText}>削除</Text>
          <Text style={styles.guideSubText}>左にフリック</Text>
        </View>

        {/* PDF カード */}
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
            <View style={styles.cardPreview}>
              <Text style={styles.previewPlaceholder}>PDF プレビュー</Text>
              <Text style={styles.previewFileName}>{currentFile.name}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.fileProgress}>
                {currentIndex + 1} / {files.length}
              </Text>
              <Text style={styles.fileName} numberOfLines={1}>
                {currentFile.name}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* 右側ガイド */}
        <View style={styles.guideRight}>
          <Ionicons name="save-outline" size={32} color={Colors.light.muted} />
          <Text style={styles.guideText}>保存</Text>
          <Text style={styles.guideSubText}>右にフリック</Text>
        </View>
      </View>

      {/* ボタンエリア */}
      <View style={styles.buttonArea}>
        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={Colors.light.accent} />
          <Text style={[styles.buttonText, { color: Colors.light.accent }]}>削除</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.keepButton]} onPress={handleKeep}>
          <Ionicons name="save-outline" size={20} color={Colors.light.secondary} />
          <Text style={[styles.buttonText, { color: Colors.light.secondary }]}>保存</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleUndo}>
          <Ionicons name="arrow-undo-outline" size={20} color={Colors.light.foreground} />
          <Text style={styles.buttonText}>元に戻す</Text>
        </TouchableOpacity>
      </View>

      {/* フッター */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          処理済み: 保存 {getStatistics().keep} 件 / 削除 {getStatistics().delete} 件
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.foreground,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  guideLeft: {
    alignItems: 'center',
    opacity: 0.4,
  },
  guideRight: {
    alignItems: 'center',
    opacity: 0.4,
  },
  guideText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.foreground,
    marginTop: Spacing.sm,
  },
  guideSubText: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
    marginTop: Spacing.xs,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 280,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.md,
    ...Shadows.lg,
    overflow: 'hidden',
  },
  cardPreview: {
    aspectRatio: 3 / 4,
    backgroundColor: Colors.light.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlaceholder: {
    fontSize: 16,
    color: Colors.light.mutedForeground,
    marginBottom: Spacing.sm,
  },
  previewFileName: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
    textAlign: 'center',
  },
  cardInfo: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  fileProgress: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
    marginBottom: Spacing.xs,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.foreground,
  },
  buttonArea: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.muted,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: Spacing.sm,
  },
  deleteButton: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  keepButton: {
    backgroundColor: Colors.light.secondary,
    borderColor: Colors.light.secondary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.foreground,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.muted,
  },
  footerText: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.foreground,
    marginTop: Spacing.md,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.error,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.foreground,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    textAlign: 'center',
  },
  completionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.foreground,
    marginBottom: Spacing.lg,
  },
  statsContainer: {
    marginBottom: Spacing.xl,
  },
  statsText: {
    fontSize: 16,
    color: Colors.light.foreground,
    marginVertical: Spacing.sm,
  },
  restartButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.light.secondary,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  restartButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
    textAlign: 'center',
  },
});
