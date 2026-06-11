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
  PermissionsAndroid,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Colors, Spacing, Shadows, BorderRadius } from '@/constants/theme';
import { usePDFFiles, DOWNLOADS_DIR } from '@/hooks/usePDFFiles';
import { useUndoRedoHistory } from '@/hooks/useUndoRedoHistory';
import { useAdvancedFileOperations } from '@/hooks/useAdvancedFileOperations';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Pdf from 'react-native-pdf';

const CONFIG_PATH = (FileSystem.documentDirectory ?? '') + 'pdf_flick_config.json';

/**
 * PDF Flick - 強化版メイン画面
 *
 * デザイン哲学: エレガント・プロフェッショナル型
 * - Undo/Redo機能の完全実装
 * - 高度なファイル操作
 * - ゴミ箱機能
 */

const SWIPE_THRESHOLD = 50;

export default function PDFFlickEnhancedScreen() {
  const { files, loading, error, refresh } = usePDFFiles();
  const { addToHistory, undo, canUndo, getStatistics } = useUndoRedoHistory();
  const { moveFile, moveToTrash, restoreFromTrash, operationState } = useAdvancedFileOperations();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveFolderPath, setSaveFolderPath] = useState<string | null>(null);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<Set<string>>(new Set());
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);

  // アニメーション用
  const pan = useRef(new Animated.ValueXY()).current;
  const swipeHintOpacity = useRef(new Animated.Value(0)).current;
  const swipeHintDirection = useRef<'keep' | 'delete' | null>(null);

  // 設定画面から戻ったときも含めて保存先フォルダを読み込む
  useFocusEffect(
    React.useCallback(() => {
      const loadConfig = async () => {
        try {
          const fileInfo = await FileSystem.getInfoAsync(CONFIG_PATH);
          if (fileInfo.exists) {
            const content = await FileSystem.readAsStringAsync(CONFIG_PATH);
            const config = JSON.parse(content);
            setSaveFolderPath(config.saveFolderPath ?? null);
          }
        } catch (e) {
          console.warn('設定読み込みエラー:', e);
        }
      };
      loadConfig();
    }, [])
  );

  // カードが変わるたびにPDFプレビューの状態をリセット
  useEffect(() => {
    setPdfLoading(true);
    setPdfError(false);
  }, [currentIndex]);

  // ファイルアクセス権限をリクエスト
  useEffect(() => {
    const requestPermissions = async () => {
      if (Platform.OS !== 'android') return;

      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);
      } catch (err) {
        console.warn('権限リクエストエラー:', err);
      }

      // Android 11+ では Downloads 内のファイル削除に「すべてのファイルへのアクセス」
      // （MANAGE_EXTERNAL_STORAGE）が必要。プローブ書き込みで権限有無を確認し、
      // 未許可ならシステム設定へ誘導する
      if (Platform.Version >= 30) {
        const probePath = DOWNLOADS_DIR + '.pdf_flick_probe';
        try {
          await FileSystem.writeAsStringAsync(probePath, 'probe');
          await FileSystem.deleteAsync(probePath);
        } catch {
          Alert.alert(
            'ファイルアクセス権限が必要です',
            'PDFの整理（移動・削除）には「すべてのファイルへのアクセス」の許可が必要です。設定画面で PDF Flick を許可してください。',
            [
              { text: 'あとで', style: 'cancel' },
              {
                text: '設定を開く',
                onPress: () => {
                  IntentLauncher.startActivityAsync(
                    'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
                    { data: 'package:com.pdfflick.app' }
                  ).catch(() => {
                    // 端末によっては個別画面が無いため一覧画面にフォールバック
                    IntentLauncher.startActivityAsync(
                      'android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION'
                    );
                  });
                },
              },
            ]
          );
        }
      }
    };
    requestPermissions();
  }, []);

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
            handleKeep();
          } else {
            handleDelete();
          }
        }

        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  const handleKeep = async () => {
    if (currentIndex >= files.length) return;
    if (!saveFolderPath) {
      Alert.alert(
        '保存先未設定',
        '設定画面で保存先フォルダを設定してください',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '設定へ', onPress: () => router.push('/settings') },
        ]
      );
      return;
    }

    const currentFile = files[currentIndex];

    const result = await moveFile(currentFile.path, saveFolderPath);
    if (!result.success) {
      Alert.alert('エラー', `ファイル移動に失敗しました: ${result.error}`);
      return;
    }

    // 移動成功後に履歴へ追加（Undo用に実際の移動先URIを保存）
    addToHistory({
      action: 'keep',
      fileId: currentFile.id,
      fileName: currentFile.name,
      filePath: currentFile.path,
      metadata: {
        destinationPath: result.data?.path ?? saveFolderPath,
        previousState: { processed: false },
      },
    });

    setProcessedFiles((prev) => new Set([...prev, currentFile.id]));
    moveToNext();
  };

  const handleDelete = async () => {
    if (currentIndex >= files.length) return;

    const currentFile = files[currentIndex];

    const result = await moveToTrash(currentFile.path);
    if (!result.success) {
      Alert.alert('エラー', `ファイル削除に失敗しました: ${result.error}`);
      return;
    }

    // ゴミ箱移動成功後に履歴へ追加（Undo用にtrashPathを保存）
    addToHistory({
      action: 'delete',
      fileId: currentFile.id,
      fileName: currentFile.name,
      filePath: currentFile.path,
      metadata: {
        trashPath: result.data?.trashPath,
        previousState: { processed: false },
      },
    });

    setProcessedFiles((prev) => new Set([...prev, currentFile.id]));
    moveToNext();
  };

  const handleUndo = async () => {
    if (!canUndo()) {
      Alert.alert('情報', '取り消す操作がありません');
      return;
    }

    const lastEntry = undo();
    if (!lastEntry) return;

    if (lastEntry.action === 'keep' && lastEntry.metadata?.destinationPath) {
      // destinationPath には移動先の実ファイルURI（SAF URI含む）が入っている
      const destFile = lastEntry.metadata.destinationPath;
      const origDir = lastEntry.filePath.substring(0, lastEntry.filePath.lastIndexOf('/') + 1);
      const result = await moveFile(destFile, origDir);
      if (!result.success) {
        Alert.alert('エラー', `取り消しに失敗しました: ${result.error}`);
      }
    } else if (lastEntry.action === 'delete' && lastEntry.metadata?.trashPath) {
      const result = await restoreFromTrash(lastEntry.metadata.trashPath, lastEntry.filePath);
      if (!result.success) {
        Alert.alert('エラー', `復元に失敗しました: ${result.error}`);
      }
    }

    setProcessedFiles((prev) => {
      const newSet = new Set(prev);
      newSet.delete(lastEntry.fileId);
      return newSet;
    });

    setCurrentIndex(Math.max(0, currentIndex - 1));
  };

  const moveToNext = () => {
    if (currentIndex + 1 >= files.length) {
      setShowCompletionScreen(true);
    } else {
      setCurrentIndex(currentIndex + 1);
      pan.setValue({ x: 0, y: 0 });
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setProcessedFiles(new Set());
    setShowCompletionScreen(false);
    pan.setValue({ x: 0, y: 0 });
    refresh();
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
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ファイルがない状態
  if (files.length === 0) {
    return (
      <View style={styles.container}>
        <Ionicons name="document-outline" size={64} color={Colors.muted} />
        <Text style={styles.emptyText}>Downloadsフォルダに</Text>
        <Text style={styles.emptyText}>PDFファイルが見つかりません</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Ionicons name="refresh" size={16} color={Colors.white} />
          <Text style={styles.retryButtonText}>再スキャン</Text>
        </TouchableOpacity>
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
              <Ionicons name="checkmark-circle-outline" size={24} color={Colors.success} />
              <Text style={styles.statLabel}>保存</Text>
              <Text style={styles.statValue}>{stats.keep}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="trash-outline" size={24} color={Colors.error} />
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

  // スワイプ方向のオーバーレイ色
  const cardRotation = pan.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-15deg', '0deg', '15deg'],
  });
  const keepOverlayOpacity = pan.x.interpolate({
    inputRange: [0, 80],
    outputRange: [0, 0.85],
    extrapolate: 'clamp',
  });
  const deleteOverlayOpacity = pan.x.interpolate({
    inputRange: [-80, 0],
    outputRange: [0.85, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>PDF Flick</Text>
          <Text style={styles.subtitle}>
            {currentIndex + 1} / {files.length}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color={Colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* 統計バッジ */}
      <View style={styles.statsBar}>
        <View style={[styles.statBadge, { backgroundColor: Colors.success + '20' }]}>
          <Ionicons name="checkmark" size={16} color={Colors.success} />
          <Text style={[styles.statBadgeText, { color: Colors.success }]}>{stats.keep} 保存</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: Colors.error + '20' }]}>
          <Ionicons name="trash" size={16} color={Colors.error} />
          <Text style={[styles.statBadgeText, { color: Colors.error }]}>{stats.delete} 削除</Text>
        </View>
      </View>

      {/* ファイルカード */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [
              { translateX: pan.x },
              { rotate: cardRotation },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* 保存オーバーレイ */}
        <Animated.View style={[styles.overlay, styles.keepOverlay, { opacity: keepOverlayOpacity }]}>
          <Text style={styles.overlayText}>保存</Text>
        </Animated.View>

        {/* 削除オーバーレイ */}
        <Animated.View style={[styles.overlay, styles.deleteOverlay, { opacity: deleteOverlayOpacity }]}>
          <Text style={styles.overlayText}>削除</Text>
        </Animated.View>

        <View style={styles.card}>
          <View style={styles.cardPreview}>
            <Pdf
              source={{ uri: currentFile.path }}
              page={1}
              minScale={1.0}
              maxScale={1.0}
              scrollEnabled={false}
              enablePaging={false}
              fitPolicy={0}
              style={styles.pdfPreview}
              onLoadComplete={() => setPdfLoading(false)}
              onError={() => { setPdfLoading(false); setPdfError(true); }}
            />
            {pdfLoading && !pdfError && (
              <View style={styles.pdfLoadingOverlay}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
            {pdfError && (
              <>
                <Ionicons name="document-text" size={80} color={Colors.border} />
                <Text style={styles.previewLabel}>PDF</Text>
              </>
            )}
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.fileName} numberOfLines={2}>
              {currentFile.name}
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="resize" size={14} color={Colors.mutedForeground} />
              <Text style={styles.infoValue}>
                {currentFile.size > 1024 * 1024
                  ? `${(currentFile.size / 1024 / 1024).toFixed(1)} MB`
                  : `${(currentFile.size / 1024).toFixed(0)} KB`}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color={Colors.mutedForeground} />
              <Text style={styles.infoValue}>
                {new Date(currentFile.modifiedDate).toLocaleDateString('ja-JP')}
              </Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.hint}>← 削除　　保存 →</Text>
          </View>
        </View>
      </Animated.View>

      {/* ボタンエリア */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={handleDelete}
          disabled={operationState.isProcessing}
        >
          <Ionicons name="trash-outline" size={22} color={Colors.white} />
          <Text style={styles.buttonText}>削除</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.undoButton, !canUndo() && styles.buttonDisabled]}
          onPress={handleUndo}
          disabled={!canUndo() || operationState.isProcessing}
        >
          <Ionicons name="arrow-undo" size={22} color={Colors.white} />
          <Text style={styles.buttonText}>元に戻す</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.keepButton]}
          onPress={handleKeep}
          disabled={operationState.isProcessing}
        >
          <Ionicons name="checkmark-outline" size={22} color={Colors.white} />
          <Text style={styles.buttonText}>保存</Text>
        </TouchableOpacity>
      </View>

      {/* 処理中オーバーレイ */}
      {operationState.isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={Colors.white} />
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
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.foreground,
    fontFamily: 'serif',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.mutedForeground,
    marginTop: 2,
  },
  settingsButton: {
    padding: Spacing.sm,
  },
  statsBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardContainer: {
    width: '100%',
    flex: 1,
    marginBottom: Spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.md,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keepOverlay: {
    backgroundColor: Colors.success,
  },
  deleteOverlay: {
    backgroundColor: Colors.error,
  },
  overlayText: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.white,
    fontFamily: 'serif',
    opacity: 0.9,
  },
  cardPreview: {
    flex: 1,
    backgroundColor: Colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pdfPreview: {
    flex: 1,
    width: '100%',
  },
  pdfLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.muted,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.border,
    marginTop: Spacing.sm,
    letterSpacing: 4,
  },
  cardInfo: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.foreground,
    marginBottom: Spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.mutedForeground,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  hint: {
    fontSize: 12,
    color: Colors.mutedForeground,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  undoButton: {
    backgroundColor: Colors.mutedForeground,
  },
  keepButton: {
    backgroundColor: Colors.success,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  completionCard: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
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
    color: Colors.mutedForeground,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.foreground,
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
    color: Colors.mutedForeground,
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
    color: Colors.mutedForeground,
    marginTop: Spacing.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.mutedForeground,
    marginTop: Spacing.sm,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: Colors.white,
    marginTop: Spacing.md,
    fontWeight: '600',
    fontSize: 16,
  },
});
