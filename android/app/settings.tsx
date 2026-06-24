import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { CONFIG_PATH } from '@/constants/appConstants';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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
