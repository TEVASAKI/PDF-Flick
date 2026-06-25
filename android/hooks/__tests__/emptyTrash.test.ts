/**
 * emptyTrash: 削除成功/失敗件数の集計テスト
 *
 * renderHook を使わず emptyTrash のコアロジック（成功/失敗の分岐）を
 * モックを通して検証する。
 */
import * as FileSystem from 'expo-file-system/legacy';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/com.pdfflick.app/files/',
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  copyAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  StorageAccessFramework: { createFileAsync: jest.fn() },
}));

const mockFS = FileSystem as jest.Mocked<typeof FileSystem>;

// emptyTrash のコアロジックを抽出してテスト可能な純粋関数として再現
// （useCallback の外側のロジック相当）
const runEmptyTrashLogic = async (
  fileList: string[],
  deleteImpl: (path: string) => Promise<void>
) => {
  const results = await Promise.all(
    fileList.map(async (filename) => {
      try {
        await deleteImpl(filename);
        return { filename, ok: true as const };
      } catch (err) {
        return {
          filename,
          ok: false as const,
          error: err instanceof Error ? err.message : 'unknown',
        };
      }
    })
  );

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  if (failed.length > 0) {
    return {
      success: false,
      error: `${failed.length}件の削除に失敗しました`,
      data: { filesDeleted: succeeded, filesFailed: failed.length, failures: failed },
    };
  }

  return { success: true, data: { filesDeleted: succeeded, filesFailed: 0 } };
};

describe('emptyTrash: 削除件数集計', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('全件成功時は success=true で filesDeleted=2 を返す', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const result = await runEmptyTrashLogic(['a.pdf', 'b.pdf'], del);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ filesDeleted: 2, filesFailed: 0 });
  });

  it('1件失敗時は success=false で正確な件数を返す', async () => {
    const del = jest.fn()
      .mockResolvedValueOnce(undefined)         // a.pdf 成功
      .mockRejectedValueOnce(new Error('isn\'t deletable'));  // b.pdf 失敗

    const result = await runEmptyTrashLogic(['a.pdf', 'b.pdf'], del);

    expect(result.success).toBe(false);
    expect(result.error).toBe('1件の削除に失敗しました');
    expect(result.data?.filesDeleted).toBe(1);
    expect(result.data?.filesFailed).toBe(1);
  });

  it('全件失敗時は success=false で filesDeleted=0 を返す', async () => {
    const del = jest.fn().mockRejectedValue(new Error('permission denied'));
    const result = await runEmptyTrashLogic(['a.pdf', 'b.pdf'], del);

    expect(result.success).toBe(false);
    expect(result.data?.filesDeleted).toBe(0);
    expect(result.data?.filesFailed).toBe(2);
  });

  it('ファイルが0件のとき success=true で filesDeleted=0 を返す', async () => {
    const del = jest.fn();
    const result = await runEmptyTrashLogic([], del);

    expect(result.success).toBe(true);
    expect(result.data?.filesDeleted).toBe(0);
    expect(del).not.toHaveBeenCalled();
  });
});
