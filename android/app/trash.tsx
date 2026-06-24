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
import { DOWNLOADS_DIR } from '@/constants/appConstants';
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
      // タイムスタンププレフィックス（{timestamp}_{originalName}）を除去して元ファイル名を復元
      // 正規表現による先頭数字削除は数字始まりファイル名（例: 2025invoice.pdf）を壊すため禁止
      const underscoreIndex = originalFileName.indexOf('_');
      const fileName = underscoreIndex >= 0 ? originalFileName.slice(underscoreIndex + 1) : originalFileName;
      const downloadDir = DOWNLOADS_DIR;

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
    marginLeft: 44, // checkbox width + gap
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
