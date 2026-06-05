# PDF Flick - 実装ガイド

**最終更新**: 2026年6月5日  
**バージョン**: 1.2.0  
**対象**: React Native Android版

---

## 目次

1. [概要](#概要)
2. [PDFプレビュー](#pdfプレビュー)
3. [Undo/Redo機能](#undoredo機能)
4. [ファイル操作](#ファイル操作)
5. [ゴミ箱機能](#ゴミ箱機能)
6. [実装例](#実装例)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

PDF Flick v1.2.0 では、以下の機能が実装されています：

### **PDFリアルタイムプレビュー**（v1.2.0 追加）
- `react-native-pdf` による PDF 1ページ目のネイティブレンダリング
- ロード中スピナー・エラー時フォールバック対応

### **強化されたUndo/Redo機能**
- 複数ステップのUndo/Redo対応
- 操作履歴の詳細な管理
- 統計情報の取得

### **高度なファイル操作**
- ファイルの移動（※ SAF URI 対応は v1.3.0 予定）
- ファイルの削除（※ 外部ストレージ対応は v1.3.0 予定）
- ゴミ箱機能（復元可能）
- エラーハンドリング

### **ユーザーフレンドリーなUI**
- フリック操作でのファイル整理
- 直感的なボタン操作
- リアルタイム統計表示

---

## PDFプレビュー

**ファイル**: `app/index.tsx`  
**使用ライブラリ**: `react-native-pdf@^7.0.3`（package.json に既存）

### 実装詳細

カードの上部プレビュー領域に `Pdf` コンポーネントを配置し、PDF の 1ページ目を表示する。

```tsx
import Pdf from 'react-native-pdf';

// state（コンポーネント内）
const [pdfLoading, setPdfLoading] = useState(true);
const [pdfError, setPdfError] = useState(false);

// カード切り替え時にリセット
useEffect(() => {
  setPdfLoading(true);
  setPdfError(false);
}, [currentIndex]);

// JSX
<View style={styles.cardPreview}>
  <Pdf
    source={{ uri: currentFile.path }}  // file:// URI をそのまま渡す
    page={1}                            // 1ページ目のみ
    minScale={1.0}                      // ズーム禁止
    maxScale={1.0}
    scrollEnabled={false}               // スクロール禁止（スワイプと競合防止）
    enablePaging={false}
    fitPolicy={0}                       // 横幅フィット
    style={styles.pdfPreview}
    onLoadComplete={() => setPdfLoading(false)}
    onError={() => { setPdfLoading(false); setPdfError(true); }}
  />
  {/* ロード中オーバーレイ */}
  {pdfLoading && !pdfError && (
    <View style={styles.pdfLoadingOverlay}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  )}
  {/* エラー時フォールバック */}
  {pdfError && (
    <>
      <Ionicons name="document-text" size={80} color={Colors.border} />
      <Text style={styles.previewLabel}>PDF</Text>
    </>
  )}
</View>
```

### スタイル

```js
cardPreview: {
  flex: 1,
  backgroundColor: Colors.muted,
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',  // はみ出し防止
},
pdfPreview: {
  flex: 1,
  width: '100%',
},
pdfLoadingOverlay: {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: Colors.muted,
},
```

### 設計上の注意点

| 項目 | 理由 |
|------|------|
| `minScale/maxScale=1.0` | ユーザーのピンチズームを封印。親 `PanResponder` のスワイプ検出と競合しない |
| `scrollEnabled={false}` | PDF 内のスクロールを封印。スワイプ操作が正常に機能する |
| `useEffect` でリセット | 前のカードのローディング・エラー状態が次のカードに引き継がれないよう `currentIndex` 変化時に初期化 |
| `overflow: 'hidden'` | `cardPreview` の角丸外に PDF がはみ出さないよう制御 |

---

## Undo/Redo機能

### `useUndoRedoHistory` フック

**ファイル**: `hooks/useUndoRedoHistory.ts`

#### **インターフェース**

```typescript
interface HistoryEntry {
  id: string;
  action: 'keep' | 'delete';
  fileId: string;
  fileName: string;
  filePath: string;
  timestamp: number;
  metadata?: {
    destinationPath?: string;
    trashPath?: string;
    previousState?: any;
  };
}
```

#### **使用方法**

```typescript
import { useUndoRedoHistory } from '@/hooks/useUndoRedoHistory';

export default function MyComponent() {
  const {
    undoStack,
    redoStack,
    addToHistory,
    undo,
    redo,
    undoMultiple,
    redoMultiple,
    canUndo,
    canRedo,
    getStatistics,
  } = useUndoRedoHistory(50); // 最大50ステップ

  // 操作を履歴に追加
  const handleAction = () => {
    addToHistory({
      action: 'keep',
      fileId: 'file-123',
      fileName: 'document.pdf',
      filePath: '/path/to/document.pdf',
    });
  };

  // Undo
  const handleUndo = () => {
    const lastEntry = undo();
    if (lastEntry) {
      console.log('Undone:', lastEntry);
    }
  };

  // Redo
  const handleRedo = () => {
    const entry = redo();
    if (entry) {
      console.log('Redone:', entry);
    }
  };

  // 複数ステップUndo
  const handleUndoMultiple = () => {
    const entries = undoMultiple(3); // 3ステップ戻す
    console.log('Undone entries:', entries);
  };

  // 統計情報
  const stats = getStatistics();
  console.log(`Keep: ${stats.keep}, Delete: ${stats.delete}`);

  return (
    <View>
      <Button title="Undo" onPress={handleUndo} disabled={!canUndo()} />
      <Button title="Redo" onPress={handleRedo} disabled={!canRedo()} />
    </View>
  );
}
```

#### **主要メソッド**

| メソッド | 説明 | 戻り値 |
|---------|------|--------|
| `addToHistory(entry)` | 操作を履歴に追加 | `void` |
| `undo()` | 直前の操作を取り消す | `HistoryEntry \| null` |
| `redo()` | 取り消した操作をやり直す | `HistoryEntry \| null` |
| `undoMultiple(steps)` | 複数ステップ戻す | `HistoryEntry[]` |
| `redoMultiple(steps)` | 複数ステップやり直す | `HistoryEntry[]` |
| `canUndo()` | Undo可能かチェック | `boolean` |
| `canRedo()` | Redo可能かチェック | `boolean` |
| `getStatistics()` | 統計情報を取得 | `Statistics` |

---

## ファイル操作

### `useAdvancedFileOperations` フック

**ファイル**: `hooks/useAdvancedFileOperations.ts`

#### **インターフェース**

```typescript
interface FileOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}

interface FileOperationState {
  isProcessing: boolean;
  error: string | null;
  lastOperation: {
    type: 'move' | 'delete' | 'restore' | null;
    fileName: string;
    timestamp: number;
  } | null;
}
```

#### **使用方法**

```typescript
import { useAdvancedFileOperations } from '@/hooks/useAdvancedFileOperations';

export default function MyComponent() {
  const {
    operationState,
    moveFile,
    deleteFile,
    moveToTrash,
    restoreFromTrash,
    getTrashFiles,
    emptyTrash,
  } = useAdvancedFileOperations();

  // ファイルを移動
  const handleMoveFile = async () => {
    const result = await moveFile('/path/to/file.pdf', '/destination/');
    if (result.success) {
      console.log('File moved:', result.data.path);
    } else {
      console.error('Move failed:', result.error);
    }
  };

  // ファイルをゴミ箱に移動
  const handleDelete = async () => {
    const result = await moveToTrash('/path/to/file.pdf');
    if (result.success) {
      console.log('File moved to trash:', result.data.trashPath);
    }
  };

  // ゴミ箱から復元
  const handleRestore = async () => {
    const result = await restoreFromTrash(
      '/trash/timestamp_file.pdf',
      '/original/file.pdf'
    );
    if (result.success) {
      console.log('File restored');
    }
  };

  // ゴミ箱内のファイルを取得
  const handleGetTrash = async () => {
    const result = await getTrashFiles();
    if (result.success) {
      console.log('Trash files:', result.data);
    }
  };

  // ゴミ箱を空にする
  const handleEmptyTrash = async () => {
    const result = await emptyTrash();
    if (result.success) {
      console.log('Trash emptied:', result.data.filesDeleted);
    }
  };

  return (
    <View>
      <Button
        title="Move File"
        onPress={handleMoveFile}
        disabled={operationState.isProcessing}
      />
      <Button
        title="Delete"
        onPress={handleDelete}
        disabled={operationState.isProcessing}
      />
      {operationState.error && (
        <Text style={{ color: 'red' }}>{operationState.error}</Text>
      )}
    </View>
  );
}
```

#### **主要メソッド**

| メソッド | 説明 | 戻り値 |
|---------|------|--------|
| `moveFile(source, dest)` | ファイルを移動 | `Promise<FileOperationResult>` |
| `deleteFile(path)` | ファイルを完全に削除 | `Promise<FileOperationResult>` |
| `moveToTrash(path)` | ファイルをゴミ箱に移動 | `Promise<FileOperationResult>` |
| `restoreFromTrash(trash, original)` | ゴミ箱から復元 | `Promise<FileOperationResult>` |
| `getTrashFiles()` | ゴミ箱内のファイルを取得 | `Promise<FileOperationResult>` |
| `emptyTrash()` | ゴミ箱を空にする | `Promise<FileOperationResult>` |

---

## ゴミ箱機能

### 概要

ゴミ箱機能により、削除したファイルを復元できます。

### ファイル構造

```
Documents/
├── Trash/
│   ├── 1704067200000_document.pdf
│   ├── 1704067300000_report.pdf
│   └── ...
└── Downloads/
    ├── file1.pdf
    ├── file2.pdf
    └── ...
```

### 実装例

```typescript
// ファイルをゴミ箱に移動
const result = await moveToTrash('/path/to/file.pdf');
// ゴミ箱パス: /Documents/Trash/1704067200000_file.pdf

// ゴミ箱から復元
await restoreFromTrash(
  '/Documents/Trash/1704067200000_file.pdf',
  '/path/to/file.pdf'
);

// ゴミ箱を空にする
await emptyTrash();
```

### 注意事項

- ゴミ箱内のファイルは、タイムスタンプ付きで保存されます
- 同名ファイルが複数ある場合、タイムスタンプで区別されます
- ゴミ箱を空にすると、ファイルは完全に削除されます

---

## 実装例

### 完全な実装例

**ファイル**: `app/index-enhanced.tsx`

以下の機能を含む完全なメイン画面実装です：

1. **Undo/Redo機能**
   - 直前の操作を取り消し
   - 取り消した操作をやり直し

2. **ファイル操作**
   - ファイルの保存
   - ファイルの削除
   - ゴミ箱機能

3. **UI/UX**
   - フリック操作
   - ボタン操作
   - 統計表示
   - 完了画面

### 使用方法

```typescript
// app.json で index-enhanced.tsx を使用
import PDFFlickEnhancedScreen from '@/app/index-enhanced';

export default function App() {
  return <PDFFlickEnhancedScreen />;
}
```

---

## トラブルシューティング

### 問題1: Undo/Redo機能が動作しない

**症状**: Undo ボタンが常に無効

**原因**: 操作履歴が追加されていない

**対応**:
```typescript
// 操作後に必ず addToHistory を呼び出す
addToHistory({
  action: 'keep',
  fileId: file.id,
  fileName: file.name,
  filePath: file.path,
});
```

### 問題2: ファイル移動に失敗する

**症状**: `FileOperationResult.success === false`

**原因**: 
- 移動先ディレクトリが存在しない
- ファイルが既に存在する
- ファイルアクセス権限がない

**対応**:
```typescript
const result = await moveFile(source, destination);
if (!result.success) {
  console.error('Error:', result.error);
  // エラーハンドリング
}
```

### 問題3: ゴミ箱から復元できない

**症状**: `restoreFromTrash` が失敗する

**原因**: 
- ゴミ箱パスが正しくない
- 元のファイルが既に存在する

**対応**:
```typescript
// moveToTrash の戻り値から trashPath を取得
const moveResult = await moveToTrash(filePath);
if (moveResult.success) {
  const { trashPath } = moveResult.data;
  
  // 後で復元
  await restoreFromTrash(trashPath, originalPath);
}
```

### 問題4: パフォーマンスが低下する

**症状**: 大量のファイルで動作が遅い

**原因**: 履歴サイズが大きすぎる

**対応**:
```typescript
// 履歴サイズを制限
const { addToHistory } = useUndoRedoHistory(20); // デフォルト50から20に削減
```

---

## ベストプラクティス

### ✅ 推奨事項

1. **操作後に必ず履歴に追加**
   ```typescript
   addToHistory({ /* ... */ });
   ```

2. **エラーハンドリングを実装**
   ```typescript
   if (!result.success) {
     Alert.alert('エラー', result.error);
   }
   ```

3. **ローディング状態を表示**
   ```typescript
   {operationState.isProcessing && <ActivityIndicator />}
   ```

4. **ユーザーに確認を求める**
   ```typescript
   Alert.alert('確認', 'ファイルを削除しますか?', [
     { text: 'キャンセル' },
     { text: '削除', onPress: handleDelete },
   ]);
   ```

### ❌ 避けるべき行為

- ✗ 履歴に追加せずにファイル操作
- ✗ エラーを無視する
- ✗ ローディング状態を表示しない
- ✗ ユーザーに確認なく削除

---

## 参考資料

- [React Native ドキュメント](https://reactnative.dev/)
- [Expo File System API](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [React Hooks ベストプラクティス](https://react.dev/reference/react/hooks)

