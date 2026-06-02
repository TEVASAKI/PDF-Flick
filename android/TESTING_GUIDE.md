# PDF Flick Android - テスト・デバッグガイド

**更新日**: 2026年6月2日  
**バージョン**: 1.1.0

---

## 現在のテスト状況

| テスト種別 | 状態 | コマンド |
|-----------|------|---------|
| TypeScript 型チェック | ✅ エラー 0 | `npx tsc --noEmit` |
| TypeScript strict チェック | ✅ エラー 0 | `npx tsc --noEmit --strict` |
| Expo Lint | ✅ エラー 0 / 警告 5 | `npx expo lint` |
| Android バンドルビルド | ✅ 成功 (2.96 MB) | `npx expo export --platform android` |
| ユニットテスト | ⚠️ 未整備 | — |

---

## 静的解析の実行

```bash
cd android

# TypeScript 型チェック
npx tsc --noEmit

# Expo Lint（ESLint）
npx expo lint

# バンドルビルド確認
npx expo export --platform android
```

---

## ユニットテスト

> **前提**: `jest` および `@testing-library/react-native` のセットアップが必要です。

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
        filePath: 'file:///storage/emulated/0/Download/test.pdf',
      });
    });

    expect(result.current.canUndo()).toBe(true);
  });

  it('Undo が動作する', () => {
    const { result } = renderHook(() => useUndoRedoHistory());

    act(() => {
      result.current.addToHistory({
        action: 'keep',
        fileId: 'file-1',
        fileName: 'test.pdf',
        filePath: 'file:///storage/emulated/0/Download/test.pdf',
      });
    });

    let entry;
    act(() => {
      entry = result.current.undo();
    });

    expect(entry).not.toBeNull();
    expect(result.current.canUndo()).toBe(false);
  });

  it('統計情報が正確', () => {
    const { result } = renderHook(() => useUndoRedoHistory());

    act(() => {
      result.current.addToHistory({
        action: 'keep',
        fileId: 'f1',
        fileName: 'a.pdf',
        filePath: 'file:///storage/emulated/0/Download/a.pdf',
      });
      result.current.addToHistory({
        action: 'delete',
        fileId: 'f2',
        fileName: 'b.pdf',
        filePath: 'file:///storage/emulated/0/Download/b.pdf',
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
import * as FileSystem from 'expo-file-system/legacy';

jest.mock('expo-file-system/legacy');

describe('useAdvancedFileOperations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ファイルを移動できる', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAdvancedFileOperations());

    let moveResult: any;
    await act(async () => {
      moveResult = await result.current.moveFile(
        'file:///storage/emulated/0/Download/test.pdf',
        'content://com.android.externalstorage.documents/tree/...'
      );
    });

    expect(moveResult.success).toBe(true);
  });

  it('ゴミ箱への移動が動作する', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAdvancedFileOperations());

    let trashResult: any;
    await act(async () => {
      trashResult = await result.current.moveToTrash(
        'file:///storage/emulated/0/Download/test.pdf'
      );
    });

    expect(trashResult.success).toBe(true);
    expect(trashResult.data.trashPath).toContain('trash/');
  });

  it('エラー時に success: false を返す', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('Permission denied'));

    const { result } = renderHook(() => useAdvancedFileOperations());

    let moveResult: any;
    await act(async () => {
      moveResult = await result.current.moveFile(
        'file:///storage/emulated/0/Download/test.pdf',
        '/dest/'
      );
    });

    expect(moveResult.success).toBe(false);
    expect(moveResult.error).toBeTruthy();
  });
});
```

### `usePDFFiles` のテスト

```typescript
// hooks/__tests__/usePDFFiles.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { usePDFFiles } from '../usePDFFiles';
import * as FileSystem from 'expo-file-system/legacy';

jest.mock('expo-file-system/legacy');

const DOWNLOADS_DIR = 'file:///storage/emulated/0/Download/';

describe('usePDFFiles', () => {
  it('PDFファイルのみを返す', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
      'report.pdf',
      'image.jpg',
      '.hidden.pdf',
      'doc.PDF',
    ]);

    const { result } = renderHook(() => usePDFFiles());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // .jpg と隠しファイルは除外される
    expect(result.current.files.map((f) => f.name)).toEqual(
      expect.arrayContaining(['report.pdf', 'doc.PDF'])
    );
    expect(result.current.files.map((f) => f.name)).not.toContain('image.jpg');
    expect(result.current.files.map((f) => f.name)).not.toContain('.hidden.pdf');
  });

  it('ディレクトリが存在しない場合はエラーを返す', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

    const { result } = renderHook(() => usePDFFiles());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.files).toHaveLength(0);
  });
});
```

---

## 統合テスト

### フリック操作 → ファイル移動フロー

```typescript
// __tests__/integration/swipeFlow.test.ts
describe('スワイプ操作フロー', () => {
  it('右スワイプで保存先に移動 → Undo で元に戻る', async () => {
    const { moveFile } = useAdvancedFileOperations();
    const { addToHistory, undo } = useUndoRedoHistory();

    const sourcePath = 'file:///storage/emulated/0/Download/test.pdf';
    const destFolder = 'content://...';

    // 1. ファイルを保存フォルダに移動
    const moveResult = await moveFile(sourcePath, destFolder);
    expect(moveResult.success).toBe(true);

    // 2. 履歴に記録
    addToHistory({
      action: 'keep',
      fileId: 'test.pdf',
      fileName: 'test.pdf',
      filePath: sourcePath,
      metadata: { destinationPath: destFolder },
    });

    // 3. Undo
    const entry = undo();
    expect(entry).not.toBeNull();
    expect(entry?.action).toBe('keep');
  });

  it('左スワイプでゴミ箱移動 → Undo で復元', async () => {
    const { moveToTrash, restoreFromTrash } = useAdvancedFileOperations();

    const filePath = 'file:///storage/emulated/0/Download/test.pdf';

    const trashResult = await moveToTrash(filePath);
    expect(trashResult.success).toBe(true);

    const restoreResult = await restoreFromTrash(
      trashResult.data.trashPath,
      filePath
    );
    expect(restoreResult.success).toBe(true);
  });
});
```

---

## デバッグ手法

### adb でのログ確認

```bash
# PDF Flick 関連のログを表示
adb logcat | grep -E "PDF Flick|ReactNative|expo"

# ファイルシステム操作のログ
adb logcat | grep -E "FileSystem|Storage"
```

### Expo Dev Tools

```bash
cd android
npx expo start --dev-client
```

### パフォーマンス計測

```typescript
const t0 = performance.now();
const result = await moveFile(src, dest);
console.log(`moveFile: ${(performance.now() - t0).toFixed(0)}ms`);
```

---

## API 整合性チェック（手動）

```bash
cd android

# expo-file-system/legacy を使っているか確認
grep -rn "from 'expo-file-system'" app/ hooks/ components/
# → 出力なしが正常（すべて /legacy を使用）

# 廃止 Paths API の残存確認
grep -rn "Paths\." app/ hooks/
# → 出力なしが正常

# 存在しない Colors キーの参照確認
grep -rn "Colors\.\(card\|tint\|icon\|text\b\)" app/ hooks/ components/
# → 出力なしが正常
```

---

## トラブルシューティング

| 問題 | 原因 | 対処 |
|------|------|------|
| `TypeError: copyAsync is not a function` | FileSystem のモックが不足 | `jest.mock('expo-file-system/legacy')` を追加 |
| Undo ボタンが常に無効 | `addToHistory` が呼ばれていない | 操作後に必ず `addToHistory` を呼んでいるか確認 |
| Downloads フォルダが空 | テスト環境でパスが存在しない | `getInfoAsync` をモックして `exists: true` を返す |
| TypeScript エラー | `expo-file-system` の import | `expo-file-system/legacy` に変更する |

---

## テストカバレッジ目標

| 対象 | 目標 | 優先度 |
|------|------|--------|
| `useUndoRedoHistory` | 90% | 🔴 高 |
| `useAdvancedFileOperations` | 80% | 🔴 高 |
| `usePDFFiles` | 80% | 🔴 高 |
| `app/index.tsx` | 60% | 🟡 中 |
| `app/trash.tsx` | 60% | 🟡 中 |
| `app/settings.tsx` | 50% | 🟢 低 |
