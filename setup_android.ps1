# =============================================================================
# PDF-Flick Android fix - セットアップスクリプト
# 実行場所: C:\Users\user\Project_root\PDF-Flick
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = "C:\Users\user\Project_root\PDF-Flick"

# ─────────────────────────────────────────────────────────────────────────────
# 1. ブランチ作成 & チェックアウト
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ">>> ブランチを作成してチェックアウト..." -ForegroundColor Cyan
Set-Location $projectRoot
git checkout -b claude/continue-pdf-flick-d0KVf

# ─────────────────────────────────────────────────────────────────────────────
# 2. ディレクトリ作成（存在しない場合）
# ─────────────────────────────────────────────────────────────────────────────
$null = New-Item -ItemType Directory -Force -Path "$projectRoot\android\app"
$null = New-Item -ItemType Directory -Force -Path "$projectRoot\android\constants"
$null = New-Item -ItemType Directory -Force -Path "$projectRoot\android\hooks"

# ─────────────────────────────────────────────────────────────────────────────
# 3. ファイル書き込み (UTF-8 BOM なし)
# ─────────────────────────────────────────────────────────────────────────────

# --- android/app.json ---
Write-Host ">>> android/app.json を書き込み..." -ForegroundColor Cyan
$content = @'
{
  "expo": {
    "name": "pdf_flick_android",
    "slug": "pdf_flick_android",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "pdfflickandroid",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "package": "com.pdfflick.app",
      "permissions": [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.MANAGE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO"
      ]
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
}
'@
[System.IO.File]::WriteAllText("$projectRoot\android\app.json", $content, [System.Text.Encoding]::UTF8)

# --- android/app/_layout.tsx ---
Write-Host ">>> android/app/_layout.tsx を書き込み..." -ForegroundColor Cyan
$content = @'
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{ title: '設定', headerBackTitle: '戻る' }}
        />
        <Stack.Screen
          name="trash"
          options={{ title: 'ゴミ箱', headerBackTitle: '戻る' }}
        />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
'@
[System.IO.File]::WriteAllText("$projectRoot\android\app\_layout.tsx", $content, [System.Text.Encoding]::UTF8)

# --- android/app/index.tsx ---
Write-Host ">>> android/app/index.tsx を書き込み..." -ForegroundColor Cyan
$content = @'
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
import { Colors, Spacing, Shadows, BorderRadius } from '@/constants/theme';
import { usePDFFiles } from '@/hooks/usePDFFiles';
import { useUndoRedoHistory } from '@/hooks/useUndoRedoHistory';
import { useAdvancedFileOperations } from '@/hooks/useAdvancedFileOperations';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

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
  const [saveFolderPath] = useState<string | null>(null);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<Set<string>>(new Set());

  // アニメーション用
  const pan = useRef(new Animated.ValueXY()).current;
  const swipeHintOpacity = useRef(new Animated.Value(0)).current;
  const swipeHintDirection = useRef<'keep' | 'delete' | null>(null);

  // ファイルアクセス権限をリクエスト
  useEffect(() => {
    const requestPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          ]);
        } catch (err) {
          console.warn('権限リクエストエラー:', err);
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

    const result = await moveFile(currentFile.path, saveFolderPath);
    if (!result.success) {
      Alert.alert('エラー', `ファイル移動に失敗しました: ${result.error}`);
      return;
    }

    setProcessedFiles((prev) => new Set([...prev, currentFile.id]));
    moveToNext();
  };

  const handleDelete = async () => {
    if (currentIndex >= files.length) return;

    const currentFile = files[currentIndex];

    addToHistory({
      action: 'delete',
      fileId: currentFile.id,
      fileName: currentFile.name,
      filePath: currentFile.path,
      metadata: {
        previousState: { processed: false },
      },
    });

    const result = await moveToTrash(currentFile.path);
    if (!result.success) {
      Alert.alert('エラー', `ファイル削除に失敗しました: ${result.error}`);
      return;
    }

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
      const destFile = lastEntry.metadata.destinationPath + lastEntry.fileName;
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
            <Ionicons name="document-text" size={80} color={Colors.border} />
            <Text style={styles.previewLabel}>PDF</Text>
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
'@
[System.IO.File]::WriteAllText("$projectRoot\android\app\index.tsx", $content, [System.Text.Encoding]::UTF8)

# --- android/app/settings.tsx ---
Write-Host ">>> android/app/settings.tsx を書き込み..." -ForegroundColor Cyan
$content = @'
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const CONFIG_PATH = (FileSystem.documentDirectory ?? '') + 'pdf_flick_config.json';

export default function SettingsScreen() {
  const router = useRouter();
  const [saveFolderPath, setSaveFolderPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSaveFolderPath();
  }, []);

  const loadSaveFolderPath = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(CONFIG_PATH);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(CONFIG_PATH);
        const config = JSON.parse(content);
        setSaveFolderPath(config.saveFolderPath ?? null);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const saveFolderPathToStorage = async (folderPath: string) => {
    try {
      const config = { saveFolderPath: folderPath };
      await FileSystem.writeAsStringAsync(CONFIG_PATH, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  };

  const selectSaveFolder = async () => {
    try {
      setLoading(true);

      // Storage Access Framework でフォルダ選択
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

      if (permissions.granted) {
        const folderUri = permissions.directoryUri;
        await saveFolderPathToStorage(folderUri);
        setSaveFolderPath(folderUri);
        Alert.alert('成功', '保存先フォルダを設定しました');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'フォルダ選択エラー';
      Alert.alert('エラー', errorMessage);
      console.error('Error selecting folder:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearSaveFolder = async () => {
    Alert.alert('確認', '保存先フォルダの設定をクリアしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'クリア',
        style: 'destructive',
        onPress: async () => {
          try {
            const fileInfo = await FileSystem.getInfoAsync(CONFIG_PATH);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(CONFIG_PATH);
            }
            setSaveFolderPath(null);
            Alert.alert('成功', '設定をクリアしました');
          } catch (error) {
            Alert.alert('エラー', 'クリアに失敗しました');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 保存先フォルダ設定 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>保存先フォルダ</Text>

        <View style={styles.card}>
          {saveFolderPath ? (
            <View style={styles.folderSelected}>
              <View style={styles.folderInfo}>
                <Ionicons name="folder" size={24} color={Colors.success} />
                <View style={styles.folderTextContainer}>
                  <Text style={styles.folderLabel}>設定済み</Text>
                  <Text style={styles.folderPath} numberOfLines={2}>
                    {saveFolderPath}
                  </Text>
                </View>
              </View>

              <View style={styles.folderActions}>
                <TouchableOpacity
                  style={[styles.button, styles.changeButton]}
                  onPress={selectSaveFolder}
                  disabled={loading}
                >
                  <Ionicons name="folder-open" size={16} color={Colors.white} />
                  <Text style={styles.buttonText}>変更</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.clearButton]}
                  onPress={clearSaveFolder}
                  disabled={loading}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.white} />
                  <Text style={styles.buttonText}>クリア</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.folderNotSet}>
              <Ionicons name="folder-open-outline" size={48} color={Colors.border} />
              <Text style={styles.folderNotSetText}>保存先フォルダが未設定です</Text>
              <Text style={styles.folderNotSetSubtext}>
                右フリックで「保存」操作をするにはフォルダを設定してください
              </Text>

              <TouchableOpacity
                style={[styles.button, styles.selectButton]}
                onPress={selectSaveFolder}
                disabled={loading}
              >
                <Ionicons name="folder-open" size={18} color={Colors.white} />
                <Text style={styles.buttonText}>
                  {loading ? '選択中...' : 'フォルダを選択'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* 使い方 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>使い方</Text>

        <View style={styles.card}>
          {[
            { icon: 'finger-print', text: '右にスワイプ → 保存フォルダに移動' },
            { icon: 'trash-outline', text: '左にスワイプ → ゴミ箱に移動' },
            { icon: 'arrow-undo', text: '「元に戻す」 → 直前の操作を取り消し' },
            { icon: 'folder-open-outline', text: 'ゴミ箱から復元可能' },
          ].map((item, index) => (
            <View key={index} style={styles.instructionRow}>
              <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
              <Text style={styles.instructionText}>{item.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* アプリ情報 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アプリ情報</Text>

        <View style={styles.card}>
          {[
            { label: 'アプリ名', value: 'PDF Flick' },
            { label: 'バージョン', value: '1.1.0' },
            { label: '対象', value: 'Android 8.0+' },
          ].map((item, index) => (
            <View key={index} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.muted,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  folderSelected: {
    gap: Spacing.md,
  },
  folderInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  folderTextContainer: {
    flex: 1,
  },
  folderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.success,
    marginBottom: 2,
  },
  folderPath: {
    fontSize: 12,
    color: Colors.mutedForeground,
    fontFamily: 'monospace',
  },
  folderActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  folderNotSet: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  folderNotSetText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.foreground,
    marginTop: Spacing.sm,
  },
  folderNotSetSubtext: {
    fontSize: 13,
    color: Colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  selectButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    flex: 0,
  },
  changeButton: {
    backgroundColor: Colors.primary,
  },
  clearButton: {
    backgroundColor: Colors.error,
  },
  buttonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  instructionText: {
    fontSize: 14,
    color: Colors.foreground,
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.foreground,
  },
});
'@
[System.IO.File]::WriteAllText("$projectRoot\android\app\settings.tsx", $content, [System.Text.Encoding]::UTF8)

# --- android/app/trash.tsx ---
Write-Host ">>> android/app/trash.tsx を書き込み..." -ForegroundColor Cyan
$content = @'
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Colors, Spacing, Shadows, BorderRadius } from '@/constants/theme';
import { useAdvancedFileOperations } from '@/hooks/useAdvancedFileOperations';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

/**
 * PDF Flick - ゴミ箱管理画面
 * 
 * 削除したファイルを管理・復元するための画面
 */

interface TrashFile {
  name: string;
  path: string;
  size: number;
  modifiedDate: number;
}

export default function TrashScreen() {
  const router = useRouter();
  const { getTrashFiles, restoreFromTrash, deleteFile, emptyTrash, operationState } =
    useAdvancedFileOperations();

  const [trashFiles, setTrashFiles] = useState<TrashFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  /**
   * ゴミ箱内のファイルを読み込む
   */
  useEffect(() => {
    loadTrashFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTrashFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getTrashFiles();
      if (result.success) {
        setTrashFiles(result.data || []);
      } else {
        setError(result.error || 'ゴミ箱の読み込みに失敗しました');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'エラーが発生しました';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * ファイルを選択/解除
   */
  const toggleFileSelection = (path: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  /**
   * すべてのファイルを選択
   */
  const selectAllFiles = () => {
    if (selectedFiles.size === trashFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(trashFiles.map((f) => f.path)));
    }
  };

  /**
   * ファイルを復元
   */
  const handleRestore = async (trashPath: string, originalFileName: string) => {
    try {
      // タイムスタンププレフィックスを除いた元ファイル名を取得
      const fileName = originalFileName.replace(/^\d+_/, '');
      const downloadDir = 'file:///storage/emulated/0/Download/';

      Alert.alert('確認', `「${fileName}」を復元しますか?`, [
        { text: 'キャンセル' },
        {
          text: '復元',
          onPress: async () => {
            const result = await restoreFromTrash(trashPath, downloadDir + fileName);
            if (result.success) {
              Alert.alert('成功', 'ファイルを復元しました');
              loadTrashFiles();
            } else {
              Alert.alert('エラー', `復元に失敗しました: ${result.error}`);
            }
          },
        },
      ]);
    } catch {
      Alert.alert('エラー', '復元処理中にエラーが発生しました');
    }
  };

  /**
   * ファイルを完全に削除
   */
  const handlePermanentDelete = async (path: string) => {
    Alert.alert('確認', 'このファイルを完全に削除しますか？この操作は取り消せません。', [
      { text: 'キャンセル' },
      {
        text: '削除',
        onPress: async () => {
          const result = await deleteFile(path);
          if (result.success) {
            Alert.alert('成功', 'ファイルを削除しました');
            loadTrashFiles();
          } else {
            Alert.alert('エラー', `削除に失敗しました: ${result.error}`);
          }
        },
      },
    ]);
  };

  /**
   * ゴミ箱を空にする
   */
  const handleEmptyTrash = () => {
    Alert.alert(
      '確認',
      'ゴミ箱内のすべてのファイルを削除しますか？この操作は取り消せません。',
      [
        { text: 'キャンセル' },
        {
          text: '削除',
          onPress: async () => {
            const result = await emptyTrash();
            if (result.success) {
              Alert.alert('成功', `${result.data.filesDeleted}個のファイルを削除しました`);
              loadTrashFiles();
            } else {
              Alert.alert('エラー', `削除に失敗しました: ${result.error}`);
            }
          },
        },
      ]
    );
  };

  /**
   * 選択したファイルを復元
   */
  const handleRestoreSelected = () => {
    if (selectedFiles.size === 0) {
      Alert.alert('情報', 'ファイルを選択してください');
      return;
    }

    Alert.alert(
      '確認',
      `${selectedFiles.size}個のファイルを復元しますか?`,
      [
        { text: 'キャンセル' },
        {
          text: '復元',
          onPress: async () => {
            // 実装: 複数ファイルの復元処理
            Alert.alert('情報', '複数ファイルの復元機能は準備中です');
          },
        },
      ]
    );
  };

  /**
   * 選択したファイルを削除
   */
  const handleDeleteSelected = () => {
    if (selectedFiles.size === 0) {
      Alert.alert('情報', 'ファイルを選択してください');
      return;
    }

    Alert.alert(
      '確認',
      `${selectedFiles.size}個のファイルを完全に削除しますか？この操作は取り消せません。`,
      [
        { text: 'キャンセル' },
        {
          text: '削除',
          onPress: async () => {
            // 実装: 複数ファイルの削除処理
            Alert.alert('情報', '複数ファイルの削除機能は準備中です');
          },
        },
      ]
    );
  };

  /**
   * ファイルアイテムのレンダリング
   */
  const renderTrashItem = ({ item }: { item: TrashFile }) => {
    const isSelected = selectedFiles.has(item.path);
    const sizeInKB = (item.size / 1024).toFixed(2);
    const modifiedDate = new Date(item.modifiedDate).toLocaleDateString('ja-JP');

    return (
      <TouchableOpacity
        style={[styles.trashItem, isSelected && styles.trashItemSelected]}
        onPress={() => toggleFileSelection(item.path)}
      >
        <View style={styles.trashItemContent}>
          <View style={styles.trashItemHeader}>
            <Ionicons
              name={isSelected ? 'checkbox' : 'checkbox-outline'}
              size={24}
              color={isSelected ? Colors.primary : Colors.muted}
            />
            <Text style={styles.trashFileName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>

          <View style={styles.trashItemInfo}>
            <Text style={styles.trashItemMeta}>
              {sizeInKB} KB • {modifiedDate}
            </Text>
          </View>
        </View>

        <View style={styles.trashItemActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleRestore(item.path, item.name)}
            disabled={operationState.isProcessing}
          >
            <Ionicons name="arrow-undo" size={20} color={Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePermanentDelete(item.path)}
            disabled={operationState.isProcessing}
          >
            <Ionicons name="trash" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ローディング状態
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.title}>ゴミ箱</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </View>
    );
  }

  // エラー状態
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.title}>ゴミ箱</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>エラーが発生しました</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTrashFiles}>
            <Text style={styles.retryButtonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ゴミ箱が空の状態
  if (trashFiles.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.title}>ゴミ箱</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.centerContent}>
          <Ionicons name="trash-outline" size={48} color={Colors.muted} />
          <Text style={styles.emptyText}>ゴミ箱は空です</Text>
        </View>
      </View>
    );
  }

  // 通常の表示
  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>ゴミ箱</Text>
        <Text style={styles.fileCount}>{trashFiles.length}</Text>
      </View>

      {/* ファイルリスト */}
      <FlatList
        data={trashFiles}
        renderItem={renderTrashItem}
        keyExtractor={(item) => item.path}
        contentContainerStyle={styles.listContent}
        scrollEnabled={true}
      />

      {/* ツールバー */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolbarButton, styles.selectAllButton]}
          onPress={selectAllFiles}
        >
          <Ionicons
            name={selectedFiles.size === trashFiles.length ? 'checkbox' : 'checkbox-outline'}
            size={20}
            color={Colors.foreground}
          />
          <Text style={styles.toolbarButtonText}>
            {selectedFiles.size === trashFiles.length ? 'すべて解除' : 'すべて選択'}
          </Text>
        </TouchableOpacity>

        {selectedFiles.size > 0 && (
          <>
            <TouchableOpacity
              style={[styles.toolbarButton, styles.restoreButton]}
              onPress={handleRestoreSelected}
              disabled={operationState.isProcessing}
            >
              <Ionicons name="arrow-undo" size={20} color={Colors.white} />
              <Text style={styles.toolbarButtonTextWhite}>復元</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolbarButton, styles.deleteButton]}
              onPress={handleDeleteSelected}
              disabled={operationState.isProcessing}
            >
              <Ionicons name="trash" size={20} color={Colors.white} />
              <Text style={styles.toolbarButtonTextWhite}>削除</Text>
            </TouchableOpacity>
          </>
        )}

        {selectedFiles.size === 0 && (
          <TouchableOpacity
            style={[styles.toolbarButton, styles.emptyTrashButton]}
            onPress={handleEmptyTrash}
            disabled={operationState.isProcessing}
          >
            <Ionicons name="trash" size={20} color={Colors.white} />
            <Text style={styles.toolbarButtonTextWhite}>ゴミ箱を空にする</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ローディングオーバーレイ */}
      {operationState.isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.foreground,
  },
  fileCount: {
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: Colors.mutedForeground,
    marginTop: Spacing.md,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
    marginTop: Spacing.md,
  },
  errorDetail: {
    fontSize: 12,
    color: Colors.mutedForeground,
    marginTop: Spacing.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.mutedForeground,
    marginTop: Spacing.md,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  trashItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  trashItemSelected: {
    backgroundColor: Colors.secondary,
  },
  trashItemContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  trashItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  trashFileName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.foreground,
    flex: 1,
  },
  trashItemInfo: {
    marginLeft: 44,
  },
  trashItemMeta: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  trashItemActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.sm,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  toolbarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  selectAllButton: {
    backgroundColor: Colors.secondary,
  },
  restoreButton: {
    backgroundColor: Colors.primary,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  emptyTrashButton: {
    backgroundColor: Colors.error,
  },
  toolbarButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.foreground,
  },
  toolbarButtonTextWhite: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
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
  },
});
'@
[System.IO.File]::WriteAllText("$projectRoot\android\app\trash.tsx", $content, [System.Text.Encoding]::UTF8)

# --- android/constants/theme.ts ---
Write-Host ">>> android/constants/theme.ts を書き込み..." -ForegroundColor Cyan
$content = @'
import { Platform } from 'react-native';

export const Colors = {
  light: {
    background: '#FFFFFF',
    foreground: '#2C2C2C',
    primary: '#2C2C2C',
    secondary: '#1B4332',
    accent: '#D62828',
    muted: '#F5F5F5',
    mutedForeground: '#808080',
    border: '#E0E0E0',
    success: '#1B4332',
    error: '#D62828',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  dark: {
    background: '#1A1A1A',
    foreground: '#F5F5F5',
    primary: '#F5F5F5',
    secondary: '#4CAF50',
    accent: '#FF6B6B',
    muted: '#333333',
    mutedForeground: '#CCCCCC',
    border: '#444444',
    success: '#4CAF50',
    error: '#FF6B6B',
    warning: '#FFC107',
    info: '#2196F3',
  },
  // ライトテーマのフラットエイリアス（直接参照用）
  white: '#FFFFFF',
  black: '#000000',
  background: '#FFFFFF',
  foreground: '#2C2C2C',
  primary: '#2C2C2C',
  secondary: '#1B4332',
  accent: '#D62828',
  muted: '#F5F5F5',
  mutedForeground: '#808080',
  border: '#E0E0E0',
  success: '#1B4332',
  error: '#D62828',
  warning: '#F59E0B',
  info: '#3B82F6',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  android: {
    sans: 'Roboto',
    serif: 'Noto Serif',
    rounded: 'Roboto',
    mono: 'Roboto Mono',
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
};

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};
'@
[System.IO.File]::WriteAllText("$projectRoot\android\constants\theme.ts", $content, [System.Text.Encoding]::UTF8)

# --- android/hooks/usePDFFiles.ts ---
Write-Host ">>> android/hooks/usePDFFiles.ts を書き込み..." -ForegroundColor Cyan
$content = @'
import { useState, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';

export interface PDFFile {
  id: string;
  name: string;
  path: string;
  size: number;
  modifiedDate: number;
  preview?: string;
}

// Androidの実際のDownloadsフォルダパス
const DOWNLOADS_DIR = 'file:///storage/emulated/0/Download/';

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
            const fileInfo = await FileSystem.getInfoAsync(filePath, { size: true });
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
'@
[System.IO.File]::WriteAllText("$projectRoot\android\hooks\usePDFFiles.ts", $content, [System.Text.Encoding]::UTF8)

# --- android/eas.json ---
Write-Host ">>> android/eas.json を書き込み..." -ForegroundColor Cyan
$content = @'
{
  "cli": {
    "version": ">= 16.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
'@
[System.IO.File]::WriteAllText("$projectRoot\android\eas.json", $content, [System.Text.Encoding]::UTF8)

# --- android/hooks/useAdvancedFileOperations.ts ---
Write-Host ">>> android/hooks/useAdvancedFileOperations.ts を書き込み..." -ForegroundColor Cyan
$null = New-Item -ItemType Directory -Force -Path "$projectRoot\android\hooks"
$content = @'
import { useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';

export interface FileOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface FileOperationState {
  isProcessing: boolean;
  error: string | null;
  lastOperation: {
    type: 'move' | 'delete' | 'restore' | null;
    fileName: string;
    timestamp: number;
  } | null;
}

export const useAdvancedFileOperations = () => {
  const [operationState, setOperationState] = useState<FileOperationState>({
    isProcessing: false,
    error: null,
    lastOperation: null,
  });

  const getTrashDir = useCallback(async (): Promise<string> => {
    const trashDir = (FileSystem.documentDirectory ?? '') + 'trash/';
    const dirInfo = await FileSystem.getInfoAsync(trashDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(trashDir, { intermediates: true });
    }
    return trashDir;
  }, []);

  const moveFile = useCallback(
    async (sourcePath: string, destinationFolder: string): Promise<FileOperationResult> => {
      try {
        setOperationState((prev) => ({ ...prev, isProcessing: true, error: null }));
        const fileName = sourcePath.split('/').pop();
        if (!fileName) throw new Error('ファイル名を取得できません');
        const destDirInfo = await FileSystem.getInfoAsync(destinationFolder);
        if (!destDirInfo.exists) {
          await FileSystem.makeDirectoryAsync(destinationFolder, { intermediates: true });
        }
        const destinationPath = destinationFolder + fileName;
        const existingFile = await FileSystem.getInfoAsync(destinationPath);
        if (existingFile.exists) {
          throw new Error(`ファイル "${fileName}" は既に存在します`);
        }
        await FileSystem.copyAsync({ from: sourcePath, to: destinationPath });
        await FileSystem.deleteAsync(sourcePath);
        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          lastOperation: { type: 'move', fileName, timestamp: Date.now() },
        }));
        return { success: true, data: { path: destinationPath, fileName } };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'ファイル移動エラー';
        setOperationState((prev) => ({ ...prev, isProcessing: false, error: errorMessage }));
        console.error('Error moving file:', err);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const deleteFile = useCallback(
    async (filePath: string): Promise<FileOperationResult> => {
      try {
        setOperationState((prev) => ({ ...prev, isProcessing: true, error: null }));
        const fileName = filePath.split('/').pop() || 'unknown';
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (!fileInfo.exists) throw new Error('ファイルが見つかりません');
        await FileSystem.deleteAsync(filePath);
        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          lastOperation: { type: 'delete', fileName, timestamp: Date.now() },
        }));
        return { success: true, data: { fileName } };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'ファイル削除エラー';
        setOperationState((prev) => ({ ...prev, isProcessing: false, error: errorMessage }));
        console.error('Error deleting file:', err);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const moveToTrash = useCallback(
    async (filePath: string): Promise<FileOperationResult> => {
      try {
        setOperationState((prev) => ({ ...prev, isProcessing: true, error: null }));
        const fileName = filePath.split('/').pop();
        if (!fileName) throw new Error('ファイル名を取得できません');
        const trashDir = await getTrashDir();
        const timestamp = Date.now();
        const trashFileName = `${timestamp}_${fileName}`;
        const trashPath = trashDir + trashFileName;
        await FileSystem.copyAsync({ from: filePath, to: trashPath });
        await FileSystem.deleteAsync(filePath);
        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          lastOperation: { type: 'delete', fileName, timestamp: Date.now() },
        }));
        return { success: true, data: { trashPath, originalFileName: fileName, originalPath: filePath } };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'ファイル削除エラー';
        setOperationState((prev) => ({ ...prev, isProcessing: false, error: errorMessage }));
        console.error('Error moving to trash:', err);
        return { success: false, error: errorMessage };
      }
    },
    [getTrashDir]
  );

  const restoreFromTrash = useCallback(
    async (trashPath: string, originalPath: string): Promise<FileOperationResult> => {
      try {
        setOperationState((prev) => ({ ...prev, isProcessing: true, error: null }));
        const fileName = originalPath.split('/').pop() || 'unknown';
        await FileSystem.copyAsync({ from: trashPath, to: originalPath });
        await FileSystem.deleteAsync(trashPath);
        setOperationState((prev) => ({
          ...prev,
          isProcessing: false,
          lastOperation: { type: 'restore', fileName, timestamp: Date.now() },
        }));
        return { success: true, data: { fileName } };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'ファイル復元エラー';
        setOperationState((prev) => ({ ...prev, isProcessing: false, error: errorMessage }));
        console.error('Error restoring from trash:', err);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

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

  const emptyTrash = useCallback(async (): Promise<FileOperationResult> => {
    try {
      setOperationState((prev) => ({ ...prev, isProcessing: true, error: null }));
      const trashDir = await getTrashDir();
      const fileList = await FileSystem.readDirectoryAsync(trashDir);
      await Promise.all(
        fileList.map((filename) =>
          FileSystem.deleteAsync(trashDir + filename).catch((err) => {
            console.error(`Error deleting ${filename}:`, err);
          })
        )
      );
      setOperationState((prev) => ({ ...prev, isProcessing: false }));
      return { success: true, data: { filesDeleted: fileList.length } };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ゴミ箱削除エラー';
      setOperationState((prev) => ({ ...prev, isProcessing: false, error: errorMessage }));
      console.error('Error emptying trash:', err);
      return { success: false, error: errorMessage };
    }
  }, [getTrashDir]);

  const resetOperationState = useCallback(() => {
    setOperationState({ isProcessing: false, error: null, lastOperation: null });
  }, []);

  return {
    operationState,
    moveFile,
    deleteFile,
    moveToTrash,
    restoreFromTrash,
    getTrashFiles,
    emptyTrash,
    resetOperationState,
    getTrashDir,
  };
};
'@
[System.IO.File]::WriteAllText("$projectRoot\android\hooks\useAdvancedFileOperations.ts", $content, [System.Text.Encoding]::UTF8)

Write-Host ">>> 全ファイル書き込み完了" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# 4. npm install
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ">>> npm install を実行..." -ForegroundColor Cyan
Set-Location "$projectRoot\android"
npm install

# ─────────────────────────────────────────────────────────────────────────────
# 5. expo prebuild
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ">>> npx expo prebuild --platform android --clean を実行..." -ForegroundColor Cyan
npx expo prebuild --platform android --clean

# ─────────────────────────────────────────────────────────────────────────────
# 6. git add / commit / push
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ">>> git add . を実行..." -ForegroundColor Cyan
Set-Location $projectRoot
git add .

Write-Host ">>> git commit を実行..." -ForegroundColor Cyan
git commit -m "feat(android): Android fixes and native project"

Write-Host ">>> git push を実行..." -ForegroundColor Cyan
git push -u origin claude/continue-pdf-flick-d0KVf

Write-Host ">>> 完了！" -ForegroundColor Green