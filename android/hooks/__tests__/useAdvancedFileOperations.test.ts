import {
  isContentUri,
  getFileNameFromUri,
  performMoveFile,
} from '../useAdvancedFileOperations';
import * as FileSystem from 'expo-file-system/legacy';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/com.pdfflick.app/files/',
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  StorageAccessFramework: {
    createFileAsync: jest.fn(),
  },
}));

const mockFS = FileSystem as jest.Mocked<typeof FileSystem> & {
  StorageAccessFramework: { createFileAsync: jest.Mock };
};

const SAF_DIR =
  'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FHozon';
const SAF_FILE =
  'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FHozon/document/primary%3ADownload%2FHozon%2Ftest_01.pdf';

describe('isContentUri', () => {
  it('content:// URI を判定できる', () => {
    expect(isContentUri(SAF_DIR)).toBe(true);
  });

  it('file:// URI は false', () => {
    expect(isContentUri('file:///storage/emulated/0/Download/')).toBe(false);
  });
});

describe('getFileNameFromUri', () => {
  it('file:// パスからファイル名を取得できる', () => {
    expect(
      getFileNameFromUri('file:///storage/emulated/0/Download/test_01.pdf')
    ).toBe('test_01.pdf');
  });

  it('SAF URI（%2F エンコード）からファイル名を取得できる', () => {
    expect(getFileNameFromUri(SAF_FILE)).toBe('test_01.pdf');
  });

  it('空文字は null', () => {
    expect(getFileNameFromUri('')).toBeNull();
  });
});

describe('performMoveFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('file:// フォルダへの移動', () => {
    const source = 'file:///storage/emulated/0/Download/test_01.pdf';
    const destDir = 'file:///storage/emulated/0/Download/Hozon/';

    it('copyAsync + deleteAsync で移動する', async () => {
      (mockFS.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true }) // 移動先ディレクトリ
        .mockResolvedValueOnce({ exists: false }); // 同名ファイルなし

      const result = await performMoveFile(source, destDir);

      expect(result).toEqual({
        path: destDir + 'test_01.pdf',
        fileName: 'test_01.pdf',
      });
      expect(mockFS.copyAsync).toHaveBeenCalledWith({
        from: source,
        to: destDir + 'test_01.pdf',
      });
      expect(mockFS.deleteAsync).toHaveBeenCalledWith(source);
      expect(mockFS.StorageAccessFramework.createFileAsync).not.toHaveBeenCalled();
    });

    it('移動先ディレクトリが無ければ作成する', async () => {
      (mockFS.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: false });

      await performMoveFile(source, destDir);

      expect(mockFS.makeDirectoryAsync).toHaveBeenCalledWith(destDir, {
        intermediates: true,
      });
    });

    it('同名ファイルが存在する場合はエラー', async () => {
      (mockFS.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValueOnce({ exists: true }); // 同名ファイルあり

      await expect(performMoveFile(source, destDir)).rejects.toThrow(
        '既に存在します'
      );
      expect(mockFS.copyAsync).not.toHaveBeenCalled();
      expect(mockFS.deleteAsync).not.toHaveBeenCalled();
    });
  });

  describe('content://（SAF）フォルダへの移動', () => {
    const source = 'file:///storage/emulated/0/Download/test_01.pdf';

    it('createFileAsync + Base64 読み書きで移動する（getInfoAsync を呼ばない）', async () => {
      mockFS.StorageAccessFramework.createFileAsync.mockResolvedValue(SAF_FILE);
      (mockFS.readAsStringAsync as jest.Mock).mockResolvedValue('cGRmZGF0YQ==');

      const result = await performMoveFile(source, SAF_DIR);

      expect(result).toEqual({ path: SAF_FILE, fileName: 'test_01.pdf' });
      expect(mockFS.StorageAccessFramework.createFileAsync).toHaveBeenCalledWith(
        SAF_DIR,
        'test_01.pdf',
        'application/pdf'
      );
      expect(mockFS.writeAsStringAsync).toHaveBeenCalledWith(
        SAF_FILE,
        'cGRmZGF0YQ==',
        { encoding: 'base64' }
      );
      expect(mockFS.deleteAsync).toHaveBeenCalledWith(source);
      // SAF URI に getInfoAsync を呼ぶと IllegalArgumentException になる（修正前のバグ）
      expect(mockFS.getInfoAsync).not.toHaveBeenCalled();
      expect(mockFS.copyAsync).not.toHaveBeenCalled();
    });

    it('SAF ファイル URI を元の file:// フォルダへ戻せる（Undo）', async () => {
      (mockFS.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValueOnce({ exists: false });

      const result = await performMoveFile(
        SAF_FILE,
        'file:///storage/emulated/0/Download/'
      );

      // SAF URI 内の %2F エンコードされたパスからファイル名のみ抽出される
      expect(result.fileName).toBe('test_01.pdf');
      expect(result.path).toBe(
        'file:///storage/emulated/0/Download/test_01.pdf'
      );
      expect(mockFS.deleteAsync).toHaveBeenCalledWith(SAF_FILE);
    });
  });
});
