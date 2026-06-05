# PDF Flick Android - 更新履歴

---

## [1.1.0] - 2026-06-02

### 修正（Fixed）

#### ビルド・型エラー
- `expo-file-system` v55 の API 変更に対応。全ファイルで `expo-file-system` からインポートするよう変更
  - `hooks/usePDFFiles.ts`
  - `hooks/useAdvancedFileOperations.ts`
  - `hooks/usePDFPreview.ts`
  - `app/settings.tsx`
- `getInfoAsync` の非対応オプション `{ size: true }` を削除
- `Colors.light.icon` → `Colors.light.primary` に修正（`collapsible.tsx`）
- `Colors.text` → `Colors.foreground` に修正（`themed-text.tsx`）

#### パス・API
- Downloads フォルダパスを `Paths.document + 'Downloads'`（アプリ内部ストレージ）から `file:///storage/emulated/0/Download/`（実際の外部Downloadsフォルダ）に修正
- `useAdvancedFileOperations.ts`: `Paths` import を削除し、`FileSystem.documentDirectory` ベースのゴミ箱パスに変更
- `app/settings.tsx`: `expo-document-picker` を削除し、`StorageAccessFramework.requestDirectoryPermissionsAsync()` に変更

#### ナビゲーション
- タブナビゲーション（`(tabs)/`）を Stack ナビゲーションに変更
- `app/_layout.tsx` を `Stack`（index / settings / trash）構成に刷新

#### 状態管理
- `app/index.tsx`: `processedFiles` state（`useState<Set<string>>`）を追加
- `app/index.tsx`: `restoreFromTrash`、`refresh` を適切に import・使用

### 追加（Added）

- `app/index.tsx`: ランタイムストレージ権限リクエスト（`PermissionsAndroid.requestMultiple`）を起動時に実行
- `app/trash.tsx`: ゴミ箱からDownloadsフォルダへの復元を実装（`file:///storage/emulated/0/Download/`）
- `constants/theme.ts`: `Colors.white`, `Colors.black` など直接参照用フラットエイリアスを追加
- `app.json`: `"package": "com.pdfflick.app"` および必要な Android 権限を追加
- `eas.json`: EAS Build 設定（`preview` プロファイルで APK 生成）を追加
- `android/android/`: `npx expo prebuild --platform android --clean` で生成したネイティブプロジェクトを追加

### 削除（Removed）

- `app/(tabs)/` ディレクトリ（タブナビゲーション構成）を削除
- `app/index-enhanced.tsx`（index.tsx にマージ済み）を削除
- `app/modal.tsx`（未使用）を削除
- `import { Paths } from 'expo-file-system'`（v55 で削除された API）を全ファイルから除去

### テスト結果（v1.1.0）

| 項目 | 結果 |
|------|------|
| TypeScript（通常・strict） | ✅ エラー 0 |
| Expo Lint | ✅ エラー 0 / 警告 5（未使用変数、軽微） |
| Android バンドルビルド | ✅ 2.96 MB 生成成功 |
| API 整合性 | ✅ 全 hook・screen の import/export 確認済み |
| AndroidManifest 権限 | ✅ 7権限すべて反映確認済み |

詳細は [`docs/verification-report.md`](../docs/verification-report.md) を参照。

---

## [1.0.0] - 2026-03-02

### 追加（Added）

#### コア機能
- ダウンロードフォルダスキャン機能（PDFファイルの自動検出と一覧表示）
- PDFプレビュー表示（`usePDFPreview` による Base64 プレビュー生成）
- フリック操作（左右のフリックで「削除」「保存」を実行）
- Undo 機能（`useUndoHistory` による直前操作の取り消し）
- 保存先フォルダ設定（`expo-document-picker` によるフォルダ選択）

#### UI/UX
- エレガント・プロフェッショナル型デザイン（白背景・墨色テキスト・深緑/薄紅アクセント）
- メイン画面（PDFカード・フリックガイド・操作ボタン）
- 設定画面（保存先フォルダ設定・アプリ情報・使い方）
- 完了画面（処理済み件数の統計表示）

#### 技術基盤
- React Native (Expo) + TypeScript による実装
- `PanResponder` によるジェスチャー検出（閾値 50px）
- カスタムフック: `usePDFFiles`, `usePDFPreview`, `useUndoHistory`

#### ドキュメント
- `README_ANDROID.md`, `SPECIFICATION_ANDROID.md`, `ANDROID_SETUP.md` 初版

### 既知の問題（v1.0.0 時点）

- Downloads パスがアプリ内部ストレージを参照していた（→ v1.1.0 で修正）
- `expo-file-system` v55 の API 変更未対応（→ v1.1.0 で修正）
- タブナビゲーション構成が不要（→ v1.1.0 で Stack に変更）

---

## 開発環境

| ツール | バージョン |
|--------|-----------|
| Node.js | 22.x |
| npm | 10.x |
| React Native | 0.81.5 |
| Expo SDK | 54.0.33 |
| TypeScript | 5.9.2 |
| EAS CLI | 20.0.0 |
