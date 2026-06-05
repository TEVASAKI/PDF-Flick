# PDF Flick - Android 版

**バージョン**: 1.1.0  
**フレームワーク**: React Native 0.81.5 + Expo SDK 54  
**対応OS**: Android 8.0 (API 26) 以上  
**パッケージID**: `com.pdfflick.app`

---

## 概要

Androidのダウンロードフォルダに溜まったPDFファイルを、フリック操作で素早く整理するアプリです。

### 主な機能

- **フリック操作** — 右フリックで保存フォルダへ移動、左フリックでゴミ箱へ移動
- **Undo/Redo** — 最大50件の操作履歴、誤操作を即座に取り消し
- **ゴミ箱** — 削除ファイルをアプリ内に退避。一覧・復元・完全削除が可能
- **保存先フォルダ設定** — Storage Access Framework でユーザーが任意のフォルダを選択

---

## ファイル構成

```
android/
├── app/
│   ├── _layout.tsx              # Stack ナビゲーション (index / settings / trash)
│   ├── index.tsx                # メイン画面（PDF フリック整理）
│   ├── settings.tsx             # 設定画面（保存先フォルダ設定）
│   └── trash.tsx                # ゴミ箱管理画面
├── hooks/
│   ├── usePDFFiles.ts           # Downloads フォルダスキャン・ファイル一覧
│   ├── useAdvancedFileOperations.ts  # ファイル移動・削除・ゴミ箱・復元
│   ├── useUndoRedoHistory.ts    # Undo/Redo 履歴管理（最大50件）
│   └── usePDFPreview.ts         # PDF プレビュー生成（キャッシュ付き）
├── constants/
│   └── theme.ts                 # カラー・スペーシング・シャドウ定義
├── components/                  # 汎用UIコンポーネント
├── assets/                      # アイコン・スプラッシュ画像
├── android/                     # expo prebuild 生成のネイティブプロジェクト
├── app.json                     # Expo設定（パッケージ名・権限等）
├── eas.json                     # EAS Build プロファイル
└── package.json
```

---

## 技術スタック

| 項目 | バージョン / 詳細 |
|------|-----------------|
| React Native | 0.81.5 |
| Expo | 54.0.33 |
| TypeScript | 5.9.2 |
| ナビゲーション | Expo Router 6 (Stack) |
| ファイルシステム | expo-file-system **55.x (legacy API)** |
| ジェスチャー | PanResponder（React Native 組み込み） |
| アイコン | @expo/vector-icons (Ionicons) |
| ビルド | EAS Build |

> **注意**: `expo-file-system` v55 で旧 API が非推奨になりました。本アプリでは `expo-file-system` からインポートしています。

---

## セットアップ

### 前提条件

- Node.js 22 以上
- npm 10 以上
- EAS CLI (`npm install -g eas-cli`)
- Expo アカウント（無料）

### インストール

```bash
git clone https://github.com/TEVASAKI/PDF-Flick.git
cd PDF-Flick
git checkout claude/continue-pdf-flick-d0KVf
cd android
npm install
```

### APK ビルド（EAS Build）

```bash
eas login
eas build --platform android --profile preview
```

ビルド完了（約10〜15分）後、表示されるURLからAPKをダウンロードします。

### ローカルビルド（Android Studio が必要）

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 使い方

### 初回起動

1. ストレージ権限ダイアログが表示される → **許可**
2. Android 11以上の場合、`MANAGE_EXTERNAL_STORAGE` を設定アプリから手動許可が必要な場合あり

### メイン画面

| 操作 | 動作 |
|------|------|
| 右にフリック | 設定した保存フォルダにファイルを移動 |
| 左にフリック | ファイルをゴミ箱に移動（復元可能） |
| 「元に戻す」ボタン | 直前の操作を取り消し（Undo） |
| 「保存」ボタン | 右フリックと同等 |
| 「削除」ボタン | 左フリックと同等 |
| 歯車アイコン | 設定画面へ移動 |

### 設定画面

- **フォルダを選択**: Storage Access Framework でフォルダピッカーを表示
- 設定は `DocumentDirectory/pdf_flick_config.json` に保存される

### ゴミ箱画面

- 削除したファイルの一覧表示
- 個別に復元（Downloads フォルダに戻す）または完全削除
- 「ゴミ箱を空にする」で一括削除

---

## Android 権限

`AndroidManifest.xml` に設定済みの権限:

| 権限 | 用途 |
|------|------|
| `READ_EXTERNAL_STORAGE` | Android ≤ 12 でのファイル読み取り |
| `WRITE_EXTERNAL_STORAGE` | Android ≤ 12 でのファイル書き込み |
| `MANAGE_EXTERNAL_STORAGE` | Downloads フォルダへの直接アクセス |
| `READ_MEDIA_IMAGES` | Android 13+ メディアアクセス |
| `READ_MEDIA_VIDEO` | 同上 |
| `READ_MEDIA_AUDIO` | 同上 |

---

## 主要フックのAPI

### `usePDFFiles()`

Downloads フォルダ（`file:///storage/emulated/0/Download/`）をスキャンします。

```typescript
const { files, loading, error, refresh } = usePDFFiles();
```

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `files` | `PDFFile[]` | PDFファイル一覧（名前順ソート） |
| `loading` | `boolean` | スキャン中フラグ |
| `error` | `string \| null` | エラーメッセージ |
| `refresh` | `() => void` | 再スキャン |

### `useAdvancedFileOperations()`

```typescript
const { moveFile, moveToTrash, restoreFromTrash, deleteFile,
        getTrashFiles, emptyTrash, operationState } = useAdvancedFileOperations();
```

| メソッド | 説明 |
|---------|------|
| `moveFile(src, destFolder)` | ファイルを指定フォルダに移動 |
| `moveToTrash(filePath)` | ゴミ箱に移動（`DocumentDirectory/trash/`） |
| `restoreFromTrash(trashPath, originalPath)` | ゴミ箱から復元 |
| `deleteFile(filePath)` | 完全削除 |
| `getTrashFiles()` | ゴミ箱内ファイル一覧取得 |
| `emptyTrash()` | ゴミ箱を空にする |

### `useUndoRedoHistory(maxSize = 50)`

```typescript
const { addToHistory, undo, canUndo, getStatistics } = useUndoRedoHistory();
```

| メソッド | 説明 |
|---------|------|
| `addToHistory(entry)` | 操作を履歴に追加 |
| `undo()` | 直前の操作エントリを取得して削除 |
| `canUndo()` | Undo 可能かどうか |
| `getStatistics()` | `{ total, keep, delete }` 統計 |

---

## カラーパレット

`constants/theme.ts` で定義:

| 用途 | 定数 | 値 |
|------|------|----|
| 背景 | `Colors.background` | `#FFFFFF` |
| テキスト | `Colors.foreground` | `#2C2C2C` |
| 保存アクション | `Colors.success` | `#1B4332` |
| 削除アクション | `Colors.error` | `#D62828` |
| 補助線 | `Colors.border` | `#E0E0E0` |
| ミュートテキスト | `Colors.mutedForeground` | `#808080` |

---

## トラブルシューティング

| 問題 | 原因 | 対処 |
|------|------|------|
| Downloads フォルダが空 | 権限が許可されていない | 設定アプリ → アプリ → PDF Flick → 権限 → ストレージを許可 |
| Android 11+ でアクセス拒否 | `MANAGE_EXTERNAL_STORAGE` が必要 | 設定 → プライバシー → 特別なアプリアクセス → すべてのファイルへのアクセス |
| EAS Build が失敗 | Expo アカウント未ログイン | `eas login` を再実行 |
| ビルドエラー（型エラー） | expo-file-system のインポート誤り | `expo-file-system` を使用していることを確認 |

---

## 関連ドキュメント

- [`SPECIFICATION_ANDROID.md`](./SPECIFICATION_ANDROID.md) — 機能仕様書
- [`CHANGELOG_ANDROID.md`](./CHANGELOG_ANDROID.md) — 更新履歴
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) — テストガイド
- [`../docs/verification-report.md`](../docs/verification-report.md) — ビルド検証レポート
