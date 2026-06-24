# PDF Flick - Android 版仕様説明書

**バージョン**: 1.2.1  
**更新日**: 2026年6月24日  
**対象OS**: Android 8.0 (API 26) 以上

---

## 目次

1. [システム概要](#システム概要)
2. [機能仕様](#機能仕様)
3. [画面設計](#画面設計)
4. [データ構造](#データ構造)
5. [フックAPI仕様](#フックapi仕様)
6. [エラーハンドリング](#エラーハンドリング)
7. [パフォーマンス要件](#パフォーマンス要件)
8. [セキュリティ要件](#セキュリティ要件)

---

## システム概要

### 目的

Androidのダウンロードフォルダ（`file:///storage/emulated/0/Download/`）に溜まったPDFファイルを、フリック操作で効率よく整理するアプリケーション。

### 対象ユーザー

- 個人用途でPDFを整理したいユーザー
- ダウンロードフォルダを定期的に整理したいユーザー

### 主要機能

1. **ダウンロードフォルダのスキャン** — PDFファイルを自動検出
2. **PDFプレビュー** — カード上部に1ページ目をリアルタイムレンダリング
3. **フリック操作** — 右フリックで保存、左フリックでゴミ箱
4. **Undo/Redo** — 最大50件の操作履歴
5. **ゴミ箱管理** — 削除ファイルの退避・復元・完全削除
6. **保存先フォルダ設定** — Storage Access Framework でフォルダ選択

---

## 機能仕様

### 1. ファイルスキャン機能

#### スキャン対象

| 項目 | 仕様 |
|------|------|
| スキャンパス | `file:///storage/emulated/0/Download/` |
| 対象拡張子 | `.pdf`（大文字小文字不問） |
| 除外ファイル | `.` で始まる隠しファイル |
| ソート順 | ファイル名昇順（日本語ロケール） |
| スキャンタイミング | アプリ起動時、手動リフレッシュ時 |

#### 取得情報

| フィールド | 型 | 内容 |
|-----------|-----|------|
| `id` | `string` | ファイル名（一意キー） |
| `name` | `string` | ファイル名 |
| `path` | `string` | フルパス |
| `size` | `number` | バイト単位サイズ |
| `modifiedDate` | `number` | 更新日時（ms タイムスタンプ） |

### 2. フリック操作機能

| 操作 | 閾値 | 動作 |
|------|------|------|
| 右フリック | dx > 50px | `handleKeep()` — 保存フォルダへ移動 |
| 左フリック | dx < -50px | `handleDelete()` — ゴミ箱へ移動 |
| 50px 未満 | — | カードが元の位置に戻る（スプリングアニメ） |

カードは `PanResponder` で実装。スワイプ量に応じて `keepOverlay`（緑）または `deleteOverlay`（赤）が表示される。

### 3. Undo 機能

| 項目 | 仕様 |
|------|------|
| 管理フック | `useUndoRedoHistory` |
| 最大履歴サイズ | 50件（デフォルト） |
| 対象操作 | `keep`（保存）、`delete`（ゴミ箱） |
| 保存アクションの取り消し | 保存先から元のDownloadsパスへ移動 |
| 削除アクションの取り消し | ゴミ箱（`DocumentDirectory/trash/`）から復元 |

### 4. ゴミ箱機能

| 項目 | 仕様 |
|------|------|
| 保存先 | `FileSystem.documentDirectory + 'trash/'` |
| ファイル命名 | `{timestamp}_{originalFileName}` |
| 復元先 | `file:///storage/emulated/0/Download/{originalFileName}` |
| ゴミ箱一覧画面 | 個別操作（復元/完全削除）、一括削除 |

### 5. 保存先フォルダ設定機能

| 項目 | 仕様 |
|------|------|
| 選択方法 | `FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()` |
| 設定ファイル保存先 | `FileSystem.documentDirectory + 'pdf_flick_config.json'` |
| 設定ファイル形式 | `{ "saveFolderPath": "<SAF URI>" }` |

---

## 画面設計

### 画面1: メイン画面（`app/index.tsx`）

```
┌────────────────────────────────────┐
│ PDF Flick           [設定⚙]        │  ← ヘッダー
│ 1 / 12                              │
│ [✓ 3 保存] [🗑 2 削除]             │  ← 統計バッジ
├────────────────────────────────────┤
│                                     │
│   ┌──────────────────────────┐      │
│   │    [保存オーバーレイ]     │      │  ← 右フリック時 緑
│   │    [削除オーバーレイ]     │      │  ← 左フリック時 赤
│   │                          │      │
│   │  [ PDF 1ページ目プレビュー │      │  ← react-native-pdf
│   │    (読込中: スピナー)     │      │     ロード中は ActivityIndicator
│   │    (エラー時: 🗎 アイコン)│      │     失敗時はフォールバック
│   │                          │      │
│   │ ──────────────────────── │      │
│   │  report_2026.pdf         │      │
│   │  2.3 MB  ·  2026/05/01  │      │
│   │ ──────────────────────── │      │
│   │  ← 削除        保存 →    │      │
│   └──────────────────────────┘      │
│                                     │
├────────────────────────────────────┤
│ [🗑 削除]  [↩ 元に戻す]  [✓ 保存] │  ← ボタンエリア
└────────────────────────────────────┘
```

### 画面2: 設定画面（`app/settings.tsx`）

```
┌────────────────────────────────────┐
│ ← 設定                              │
├────────────────────────────────────┤
│ 保存先フォルダ                       │
│ ┌──────────────────────────────┐   │
│ │ 📁 設定済み                   │   │  ← フォルダ選択後
│ │ content://com.android...     │   │
│ │ [変更]  [クリア]              │   │
│ └──────────────────────────────┘   │
│ または                               │
│ ┌──────────────────────────────┐   │
│ │ 📂 未設定です                 │   │  ← 未設定時
│ │ [フォルダを選択]              │   │
│ └──────────────────────────────┘   │
├────────────────────────────────────┤
│ 使い方 / アプリ情報                  │
└────────────────────────────────────┘
```

### 画面3: ゴミ箱画面（`app/trash.tsx`）

```
┌────────────────────────────────────┐
│ ← ゴミ箱                     [3]   │
├────────────────────────────────────┤
│ ☐  1716000000_report.pdf          │  ← タップで選択
│    58.00 KB · 2026/05/18          │
│                      [↩] [🗑]     │
├────────────────────────────────────┤
│ ...                                 │
├────────────────────────────────────┤
│ [☑ すべて選択] [↩ 復元] [🗑 削除] │
│ または                               │
│ [☐ すべて選択] [🗑 ゴミ箱を空に]   │
└────────────────────────────────────┘
```

### 画面4: 完了画面（メイン画面内）

```
┌────────────────────────────────────┐
│          ✅ 処理完了！              │
│    すべてのファイルを処理しました    │
│                                     │
│    ✓ 保存: 5     🗑 削除: 3        │
│                                     │
│    [🔄 もう一度整理する]            │
└────────────────────────────────────┘
```

---

## データ構造

### `PDFFile`

```typescript
interface PDFFile {
  id: string;           // ファイル名（一意キー）
  name: string;         // ファイル名
  path: string;         // file:///storage/emulated/0/Download/{name}
  size: number;         // バイト単位
  modifiedDate: number; // Unix ms タイムスタンプ
  preview?: string;     // Base64 データURI（オプション）
}
```

### `HistoryEntry`

```typescript
interface HistoryEntry {
  action: 'keep' | 'delete';
  fileId: string;
  fileName: string;
  filePath: string;    // 元の Downloads パス
  timestamp: number;
  metadata?: {
    destinationPath?: string; // keep時の保存先SAF URI
    trashPath?: string;       // delete時のゴミ箱パス
  };
}
```

### 設定ファイル（`pdf_flick_config.json`）

```json
{
  "saveFolderPath": "content://com.android.externalstorage.documents/tree/..."
}
```

---

## フックAPI仕様

### `usePDFFiles()`

```typescript
import { usePDFFiles } from '@/hooks/usePDFFiles';
```

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `files` | `PDFFile[]` | スキャン結果 |
| `loading` | `boolean` | スキャン中フラグ |
| `error` | `string \| null` | エラーメッセージ |
| `refresh` | `() => void` | 再スキャントリガー |

### `useAdvancedFileOperations()`

```typescript
import { useAdvancedFileOperations } from '@/hooks/useAdvancedFileOperations';
```

| メソッド | 引数 | 戻り値 |
|---------|------|--------|
| `moveFile` | `(src: string, destFolder: string)` | `Promise<FileOperationResult>` |
| `moveToTrash` | `(filePath: string)` | `Promise<FileOperationResult>` |
| `restoreFromTrash` | `(trashPath: string, originalPath: string)` | `Promise<FileOperationResult>` |
| `deleteFile` | `(filePath: string)` | `Promise<FileOperationResult>` |
| `getTrashFiles` | `()` | `Promise<{ success, data: TrashFile[] }>` |
| `emptyTrash` | `()` | `Promise<FileOperationResult>` |
| `operationState` | — | `FileOperationState` |

```typescript
interface FileOperationData {
  path?: string;        // moveFile: 移動後の実際のファイルURI
  fileName?: string;    // moveFile / moveToTrash: ファイル名
  trashPath?: string;   // moveToTrash: ゴミ箱内パス（Undo用）
  filesDeleted?: number; // emptyTrash: 削除成功件数
  filesFailed?: number;  // emptyTrash: 削除失敗件数
  failures?: Array<{ filename: string; ok: false; error: string }>; // emptyTrash: 失敗詳細
}

interface FileOperationResult {
  success: boolean;
  error?: string;
  data?: FileOperationData;
}
```

### `useUndoRedoHistory(maxSize = 50)`

```typescript
import { useUndoRedoHistory } from '@/hooks/useUndoRedoHistory';
```

| メソッド | 戻り値 | 説明 |
|---------|--------|------|
| `addToHistory(entry)` | `void` | 操作を履歴に追加 |
| `undo()` | `HistoryEntry \| null` | 直前のエントリを取得・削除 |
| `canUndo()` | `boolean` | Undo 可能かどうか |
| `getStatistics()` | `{ total, keep, delete, undoable, redoable }` | 操作統計 |

---

## エラーハンドリング

| エラー | 原因 | 対処 |
|--------|------|------|
| Downloads スキャン失敗 | ストレージ権限未許可 | エラー画面でユーザーに通知、再試行ボタン表示 |
| PDF プレビュー失敗 | 破損PDF・権限不足 | フォールバックアイコン（🗎 PDF）を表示 |
| ファイル移動失敗（保存先） | `content://` URI 非対応 | Alert でエラーメッセージ表示（v1.3.0 で修正予定） |
| ファイル削除失敗（Downloads） | 外部ストレージ書き込み権限不足 | Alert でエラーメッセージ表示（v1.3.0 で修正予定） |
| ゴミ箱移動失敗 | DocumentDirectory が利用不可 | Alert でエラーメッセージ表示 |
| 設定フォルダ読み込み失敗 | JSON パース失敗 | `null` として扱い未設定状態に |

---

## パフォーマンス要件

| 操作 | 目標 |
|------|------|
| ファイル一覧表示 | 1秒以内（100ファイル以下） |
| フリック操作 | 2秒以内 |
| Undo 実行 | 500ms 以内 |
| ゴミ箱一覧表示 | 1秒以内 |

### メモリ

| 状態 | 目標 |
|------|------|
| 初期起動 | 50MB 以下 |
| 10ファイル処理後 | 100MB 以下 |

---

## セキュリティ要件

### 権限（`app.json` → `AndroidManifest.xml` 反映済み）

| 権限 | 対象バージョン |
|------|--------------|
| `READ_EXTERNAL_STORAGE` | Android ≤ 12 |
| `WRITE_EXTERNAL_STORAGE` | Android ≤ 12 |
| `MANAGE_EXTERNAL_STORAGE` | Android 11+ |

### データ保護

- ネットワーク通信なし（完全オフライン動作）
- 設定はデバイスローカルのみ保存
- ゴミ箱ファイルはアプリ内部ストレージ（他アプリからアクセス不可）

---

## 今後の拡張予定

### v1.3（次期バージョン）
- **削除バグ修正**: ネイティブモジュールで `MANAGE_EXTERNAL_STORAGE` を利用した外部ストレージ削除
- ゴミ箱の複数ファイル一括復元・削除

### v2.0
- ダークモード完全対応
- バッチ処理（複数ファイル選択・一括操作）
