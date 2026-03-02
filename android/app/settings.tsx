import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

/**
 * PDF Flick - 設定画面
 * 
 * 保存先フォルダを設定するための画面
 */

export default function SettingsScreen() {
  const [saveFolderPath, setSaveFolderPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 初期化時に保存先フォルダを読み込む
  useEffect(() => {
    loadSaveFolderPath();
  }, []);

  /**
   * ローカルストレージから保存先フォルダパスを読み込む
   */
  const loadSaveFolderPath = async () => {
    try {
      const storagePath = new FileSystem.File(Paths.document, 'pdf_flick_config.json').uri;
      const fileInfo = await FileSystem.getInfoAsync(storagePath);

      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(storagePath);
        const config = JSON.parse(content);
        setSaveFolderPath(config.saveFolderPath || null);
      }
    } catch (error) {
      console.error('Error loading save folder path:', error);
    }
  };

  /**
   * 保存先フォルダを選択
   */
  const selectSaveFolder = async () => {
    try {
      setLoading(true);

      // ドキュメントピッカーを起動
      const result = await DocumentPicker.getDocumentAsync({
        type: 'folder',
      });

      if (result.type === 'success') {
        const folderUri = result.uri;

        // フォルダが存在するか確認
        const folderInfo = await FileSystem.getInfoAsync(folderUri);
        if (!folderInfo.isDirectory) {
          Alert.alert('エラー', 'フォルダを選択してください');
          return;
        }

        // 保存先フォルダパスを保存
        await saveFolderPathToStorage(folderUri);
        setSaveFolderPath(folderUri);

        Alert.alert('成功', `保存先フォルダを設定しました:\n${folderUri}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'フォルダ選択エラー';
      Alert.alert('エラー', errorMessage);
      console.error('Error selecting folder:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 保存先フォルダパスをローカルストレージに保存
   */
  const saveFolderPathToStorage = async (folderPath: string) => {
    try {
      const storagePath = new FileSystem.File(Paths.document, 'pdf_flick_config.json').uri;
      const config = { saveFolderPath: folderPath };
      await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving folder path:', error);
      throw error;
    }
  };

  /**
   * 保存先フォルダをクリア
   */
  const clearSaveFolder = async () => {
    Alert.alert('確認', '保存先フォルダをクリアしますか?', [
      {
        text: 'キャンセル',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: 'クリア',
        onPress: async () => {
          try {
            const storagePath = new FileSystem.File(Paths.document, 'pdf_flick_config.json').uri;
            const config = { saveFolderPath: null };
            await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(config));
            setSaveFolderPath(null);
            Alert.alert('成功', '保存先フォルダをクリアしました');
          } catch (error) {
              console.error('Error clearing folder:', error);
              Alert.alert('エラー', 'クリアに失敗しました');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>設定</Text>
        <Text style={styles.subtitle}>PDF Flick の設定を管理します</Text>
      </View>

      {/* 保存先フォルダ設定 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>保存先フォルダ</Text>

        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>保存先フォルダパス</Text>

          {saveFolderPath ? (
            <View style={styles.folderPathContainer}>
              <Ionicons name="folder-outline" size={20} color={Colors.light.secondary} />
              <Text style={styles.folderPath} numberOfLines={2}>
                {saveFolderPath}
              </Text>
            </View>
          ) : (
            <Text style={styles.noFolderText}>フォルダが設定されていません</Text>
          )}

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.settingButton, styles.selectButton]}
              onPress={selectSaveFolder}
              disabled={loading}
            >
              <Ionicons name="folder-open-outline" size={18} color={Colors.light.secondary} />
              <Text style={[styles.settingButtonText, { color: Colors.light.secondary }]}>
                フォルダを選択
              </Text>
            </TouchableOpacity>

            {saveFolderPath && (
              <TouchableOpacity
                style={[styles.settingButton, styles.clearButton]}
                onPress={clearSaveFolder}
                disabled={loading}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.light.error} />
                <Text style={[styles.settingButtonText, { color: Colors.light.error }]}>
                  クリア
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.settingDescription}>
          「保存」したPDFファイルを移動するフォルダを指定してください。
        </Text>
      </View>

      {/* アプリ情報 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アプリ情報</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>アプリ名</Text>
            <Text style={styles.infoValue}>PDF Flick</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>バージョン</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>開発者</Text>
            <Text style={styles.infoValue}>Manus AI</Text>
          </View>
        </View>
      </View>

      {/* 使用方法 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>使用方法</Text>

        <View style={styles.instructionCard}>
          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>1</Text>
            </View>
            <Text style={styles.instructionText}>
              上記で保存先フォルダを設定してください
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>2</Text>
            </View>
            <Text style={styles.instructionText}>
              メイン画面でPDFをプレビューして確認
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>3</Text>
            </View>
            <Text style={styles.instructionText}>
              右にフリック（保存）または左にフリック（削除）
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>4</Text>
            </View>
            <Text style={styles.instructionText}>
              「元に戻す」で操作を取り消せます
            </Text>
          </View>
        </View>
      </View>

      {/* フッター */}
      <View style={styles.footer} />
    </ScrollView>
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
  section: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.foreground,
    marginBottom: Spacing.md,
  },
  settingCard: {
    backgroundColor: Colors.light.muted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.foreground,
    marginBottom: Spacing.sm,
  },
  folderPathContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  folderPath: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.foreground,
  },
  noFolderText: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    fontStyle: 'italic',
    marginBottom: Spacing.md,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  settingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  selectButton: {
    backgroundColor: Colors.light.background,
    borderColor: Colors.light.secondary,
  },
  clearButton: {
    backgroundColor: Colors.light.background,
    borderColor: Colors.light.error,
  },
  settingButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
    marginTop: Spacing.sm,
  },
  infoCard: {
    backgroundColor: Colors.light.muted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.foreground,
  },
  instructionCard: {
    backgroundColor: Colors.light.muted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.background,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.foreground,
    marginTop: Spacing.xs,
  },
  footer: {
    height: Spacing.xl,
  },
});
