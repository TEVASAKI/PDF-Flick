# PDF Flick - テスト・デバッグガイド

**作成日**: 2026年3月2日  
**バージョン**: 1.0.0  
**対象**: React Native Android版

---

## 目次

1. [テスト戦略](#テスト戦略)
2. [ユニットテスト](#ユニットテスト)
3. [統合テスト](#統合テスト)
4. [UIテスト](#uitest)
5. [デバッグテクニック](#デバッグテクニック)
6. [トラブルシューティング](#トラブルシューティング)

---

## テスト戦略

### テストピラミッド

```
        E2E テスト
      統合テスト
    ユニットテスト
```

### テスト対象

| 対象 | テスト種別 | 優先度 |
|------|----------|--------|
| Undo/Redo機能 | ユニット | 🔴 高 |
| ファイル操作 | 統合 | 🔴 高 |
| ゴミ箱機能 | 統合 | 🟡 中 |
| UI/UX | E2E | 🟡 中 |

---

## ユニットテスト

### `useUndoRedoHistory` のテスト

```typescript
// hooks/__tests__/useUndoRedoHistory.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useUndoRedoHistory } from '../useUndoRedoHistory';

describe('useUndoRedoHistory', () => {
  it('操作を履歴に追加できる', () => {
    const { result } = renderHook(() => useUndoRedoHistory());

    act(() => {
      result.current.addToHistory({
        action: 'keep',
        fileId: 'file-1',
        fileName: 'test.pdf',
        filePath: '/path/to/test.pdf',
      });
    });

    expect(result.current.getUndoSize()).toBe(1);
    expect(result.current.canUndo()).toBe(true);
  });

  it('Undo機能が動作する', () => {
    const { result } = renderHook(() => useUndoRedoHistory());

    act(() => {
      result.current.addToHistory({
        action: 'keep',
        fileId: 'file-1',
        fileName: 'test.pdf',
        filePath: '/path/to/test.pdf',
      });
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.getUndoSize()).toBe(0);
    expect(result.current.canRedo()).toBe(true);
  });

  it('Redo機能が動作する', () => {
    const { result } = renderHook(() => useUndoRedoHistory());

    act(() => {
      result.current.addToHistory({
        action: 'delete',
        fileId: 'file-1',
        fileName: 'test.pdf',
        filePath: '/path/to/test.pdf',
      });
    });

    act(() => {
      result.current.undo();
      result.current.redo();
    });

    expect(result.current.getUndoSize()).toBe(1);
    expect(result.current.canRedo()).toBe(false);
  });

  it('複数ステップUndo/Redoが動作する', () => {
    const { result } = renderHook(() => useUndoRedoHistory());

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addToHistory({
          action: i % 2 === 0 ? 'keep' : 'delete',
          fileId: `file-${i}`,
          fileName: `test${i}.pdf`,
          filePath: `/path/to/test${i}.pdf`,
        });
      }
    });

    act(() => {
      result.current.undoMultiple(3);
    });

    expect(result.current.getUndoSize()).toBe(2);
    expect(result.current.getRedoSize()).toBe(3);
  });

  it('統計情報が正確である', () => {
    const { result } = renderHook(() => useUndoRedoHistory());

    act(() => {
      result.current.addToHistory({
        action: 'keep',
        fileId: 'file-1',
        fileName: 'test1.pdf',
        filePath: '/path/to/test1.pdf',
      });
      result.current.addToHistory({
        action: 'delete',
        fileId: 'file-2',
        fileName: 'test2.pdf',
        filePath: '/path/to/test2.pdf',
      });
    });

    const stats = result.current.getStatistics();
    expect(stats.total).toBe(2);
    expect(stats.keep).toBe(1);
    expect(stats.delete).toBe(1);
  });
});
```

### `useAdvancedFileOperations` のテスト

```typescript
// hooks/__tests__/useAdvancedFileOperations.test.ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAdvancedFileOperations } from '../useAdvancedFileOperations';
import * as FileSystem from 'expo-file-system';

// FileSystem API をモック
jest.mock('expo-file-system');

describe('useAdvancedFileOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ファイルを移動できる', async () => {
    const { result } = renderHook(() => useAdvancedFileOperations());

    const mockCopy = jest.fn().mockResolvedValue(undefined);
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    const mockGetInfo = jest.fn().mockResolvedValue({ exists: true });

    (FileSystem.copyAsync as jest.Mock) = mockCopy;
    (FileSystem.deleteAsync as jest.Mock) = mockDelete;
    (FileSystem.getInfoAsync as jest.Mock) = mockGetInfo;

    let moveResult;
    act(() => {
      moveResult = result.current.moveFile('/source/file.pdf', '/dest/');
    });

    await waitFor(() => {
      expect(moveResult).resolves.toEqual(
        expect.objectContaining({
          success: true,
        })
      );
    });

    expect(mockCopy).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
  });

  it('ファイルをゴミ箱に移動できる', async () => {
    const { result } = renderHook(() => useAdvancedFileOperations());

    let moveToTrashResult;
    act(() => {
      moveToTrashResult = result.current.moveToTrash('/path/to/file.pdf');
    });

    await waitFor(() => {
      expect(moveToTrashResult).resolves.toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            trashPath: expect.any(String),
          }),
        })
      );
    });
  });

  it('エラーハンドリングが正常に動作する', async () => {
    const { result } = renderHook(() => useAdvancedFileOperations());

    (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(
      new Error('File not found')
    );

    let moveResult;
    act(() => {
      moveResult = result.current.moveFile('/nonexistent/file.pdf', '/dest/');
    });

    await waitFor(() => {
      expect(moveResult).resolves.toEqual(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
        })
      );
    });
  });
});
```

---

## 統合テスト

### ファイル操作フロー

```typescript
// __tests__/integration/fileOperationFlow.test.ts
describe('ファイル操作フロー', () => {
  it('ファイルを保存してから削除できる', async () => {
    // 1. ファイルを保存フォルダに移動
    const moveResult = await moveFile(sourcePath, destinationFolder);
    expect(moveResult.success).toBe(true);

    // 2. 操作を履歴に追加
    addToHistory({
      action: 'keep',
      fileId: 'file-1',
      fileName: 'test.pdf',
      filePath: sourcePath,
      metadata: { destinationPath: destinationFolder },
    });

    // 3. Undo
    const undoResult = undo();
    expect(undoResult).not.toBeNull();

    // 4. ファイルを元の位置に戻す
    const restoreResult = await moveFile(destinationPath, originalFolder);
    expect(restoreResult.success).toBe(true);
  });

  it('ゴミ箱機能が正常に動作する', async () => {
    // 1. ファイルをゴミ箱に移動
    const trashResult = await moveToTrash(filePath);
    expect(trashResult.success).toBe(true);

    // 2. ゴミ箱内のファイルを確認
    const trashFiles = await getTrashFiles();
    expect(trashFiles.success).toBe(true);
    expect(trashFiles.data.length).toBeGreaterThan(0);

    // 3. ファイルを復元
    const restoreResult = await restoreFromTrash(
      trashResult.data.trashPath,
      filePath
    );
    expect(restoreResult.success).toBe(true);

    // 4. ゴミ箱が空になったことを確認
    const emptyTrashResult = await emptyTrash();
    expect(emptyTrashResult.success).toBe(true);
  });
});
```

---

## UIテスト

### フリック操作のテスト

```typescript
// __tests__/ui/flickOperation.test.ts
import { render, fireEvent } from '@testing-library/react-native';
import PDFFlickEnhancedScreen from '@/app/index-enhanced';

describe('フリック操作', () => {
  it('右フリックで保存ボタンが動作する', async () => {
    const { getByTestId } = render(<PDFFlickEnhancedScreen />);

    const card = getByTestId('pdf-card');

    // 右フリック（50px以上）
    fireEvent(card, 'panResponderMove', {
      nativeEvent: { dx: 100 },
    });

    fireEvent(card, 'panResponderRelease', {
      nativeEvent: { dx: 100 },
    });

    // 保存ボタンが呼ばれたことを確認
    // 実装に応じて検証
  });

  it('左フリックで削除ボタンが動作する', async () => {
    const { getByTestId } = render(<PDFFlickEnhancedScreen />);

    const card = getByTestId('pdf-card');

    // 左フリック（-50px以下）
    fireEvent(card, 'panResponderMove', {
      nativeEvent: { dx: -100 },
    });

    fireEvent(card, 'panResponderRelease', {
      nativeEvent: { dx: -100 },
    });

    // 削除ボタンが呼ばれたことを確認
  });

  it('Undoボタンが動作する', async () => {
    const { getByTestId } = render(<PDFFlickEnhancedScreen />);

    const undoButton = getByTestId('undo-button');

    fireEvent.press(undoButton);

    // Undo処理が実行されたことを確認
  });
});
```

---

## デバッグテクニック

### ログ出力

```typescript
// デバッグ用ログ出力
console.log('Undo Stack:', undoStack);
console.log('Redo Stack:', redoStack);
console.log('Operation State:', operationState);
console.log('Statistics:', getStatistics());
```

### React DevTools

```bash
# React DevTools をインストール
npm install --save-dev @react-devtools/core

# デバッグ実行
npm run dev
```

### Android Studio デバッガ

```bash
# Android Studio でブレークポイント設定
# Logcat でログを確認
adb logcat | grep "PDF Flick"
```

### パフォーマンス計測

```typescript
// パフォーマンス計測
const startTime = performance.now();

// 処理
const result = await moveFile(source, dest);

const endTime = performance.now();
console.log(`File operation took ${endTime - startTime}ms`);
```

---

## トラブルシューティング

### テストが失敗する場合

**症状**: `TypeError: Cannot read property 'copyAsync' of undefined`

**原因**: FileSystem API がモックされていない

**対応**:
```typescript
jest.mock('expo-file-system');
```

### パフォーマンスが低下する場合

**症状**: 大量のファイルで操作が遅い

**原因**: 履歴サイズが大きすぎる

**対応**:
```typescript
const { addToHistory } = useUndoRedoHistory(20); // 50 から 20 に削減
```

### Undo/Redo が動作しない場合

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

---

## テスト実行コマンド

```bash
# すべてのテストを実行
npm test

# 特定のテストファイルを実行
npm test -- useUndoRedoHistory.test.ts

# カバレッジレポートを生成
npm test -- --coverage

# ウォッチモードで実行
npm test -- --watch
```

---

## テストカバレッジ目標

| 対象 | 目標 |
|------|------|
| ステートメント | 80% |
| ブランチ | 75% |
| 関数 | 80% |
| 行 | 80% |

---

## ベストプラクティス

### ✅ 推奨事項

1. **各機能に対してテストを作成**
2. **エッジケースをテスト**
3. **エラーハンドリングをテスト**
4. **パフォーマンステストを実施**
5. **定期的にテストを実行**

### ❌ 避けるべき行為

- ✗ テストなしでコミット
- ✗ テストカバレッジを無視
- ✗ エラーハンドリングをテストしない
- ✗ 手動テストのみに依存

