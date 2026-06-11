/**
 * メイン画面の統合テスト
 *
 * エミュレータなしで検証できる範囲の画面フロー：
 * - PDFプレビュー（react-native-pdf）に現在のファイルが渡されること
 * - 削除ボタン → moveToTrash → 履歴にtrashPathが保存され次のカードへ
 * - 保存ボタン → moveFile(SAFフォルダ) → 履歴に実移動先URIが保存される
 * - 元に戻す → 削除はrestoreFromTrash、保存はmoveFileで復元される
 */
import React from 'react';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Alert, TouchableOpacity, Text } from 'react-native';

const FILES = [
  {
    id: 'test_01.pdf',
    name: 'test_01.pdf',
    path: 'file:///storage/emulated/0/Download/test_01.pdf',
    size: 1024,
    modifiedDate: 1750000000000,
  },
  {
    id: 'test_02.pdf',
    name: 'test_02.pdf',
    path: 'file:///storage/emulated/0/Download/test_02.pdf',
    size: 2048,
    modifiedDate: 1750000001000,
  },
];

const SAF_DIR =
  'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FHozon';
const SAF_DEST_FILE = SAF_DIR + '/document/primary%3ADownload%2FHozon%2Ftest_01.pdf';
const TRASH_PATH =
  'file:///data/user/0/com.pdfflick.app/files/trash/1750000000000_test_01.pdf';

const mockMoveFile = jest.fn();
const mockMoveToTrash = jest.fn();
const mockRestoreFromTrash = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/com.pdfflick.app/files/',
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  StorageAccessFramework: { createFileAsync: jest.fn() },
}));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  // 実機同様、フォーカス時にコールバック（設定ロード等）を実行する
  useFocusEffect: (cb: () => void) => {
    const ReactActual = jest.requireActual('react');
    ReactActual.useEffect(cb, []);
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// PDFプレビュー: 受け取ったsourceを検証できるようにpropsを保持するモック
const pdfRenderedSources: any[] = [];
jest.mock('react-native-pdf', () => {
  const MockPdf = (props: any) => {
    pdfRenderedSources.push(props.source);
    return null;
  };
  return MockPdf;
});

jest.mock('@/hooks/usePDFFiles', () => ({
  DOWNLOADS_DIR: 'file:///storage/emulated/0/Download/',
  usePDFFiles: () => ({
    files: FILES,
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/hooks/useAdvancedFileOperations', () => ({
  useAdvancedFileOperations: () => ({
    moveFile: mockMoveFile,
    moveToTrash: mockMoveToTrash,
    restoreFromTrash: mockRestoreFromTrash,
    operationState: { isProcessing: false, error: null, lastOperation: null },
  }),
}));

import PDFFlickEnhancedScreen from '../index';

/** ボタンラベルからTouchableOpacityを探してonPressを実行 */
const pressButton = async (tree: ReactTestRenderer, label: string) => {
  const buttons = tree.root.findAllByType(TouchableOpacity);
  const target = buttons.find((btn) =>
    btn.findAllByType(Text).some((t) => t.props.children === label)
  );
  if (!target) throw new Error(`ボタン "${label}" が見つかりません`);
  await act(async () => {
    await target.props.onPress();
  });
};

describe('メイン画面の統合フロー', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    pdfRenderedSources.length = 0;
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  const renderScreen = async (): Promise<ReactTestRenderer> => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PDFFlickEnhancedScreen />);
    });
    return tree;
  };

  it('PDFプレビューに現在のファイルパスが渡される', async () => {
    await renderScreen();

    expect(pdfRenderedSources.length).toBeGreaterThan(0);
    expect(pdfRenderedSources[0]).toEqual({ uri: FILES[0].path });
  });

  it('削除 → moveToTrashが呼ばれ、次のカードのプレビューが表示される', async () => {
    mockMoveToTrash.mockResolvedValue({
      success: true,
      data: { trashPath: TRASH_PATH },
    });
    const tree = await renderScreen();

    await pressButton(tree, '削除');

    expect(mockMoveToTrash).toHaveBeenCalledWith(FILES[0].path);
    // 次のカード（test_02.pdf）のプレビューがレンダリングされる
    const lastSource = pdfRenderedSources[pdfRenderedSources.length - 1];
    expect(lastSource).toEqual({ uri: FILES[1].path });
  });

  it('削除 → 元に戻す → trashPathからrestoreFromTrashで復元される', async () => {
    mockMoveToTrash.mockResolvedValue({
      success: true,
      data: { trashPath: TRASH_PATH },
    });
    mockRestoreFromTrash.mockResolvedValue({ success: true });
    const tree = await renderScreen();

    await pressButton(tree, '削除');
    await pressButton(tree, '元に戻す');

    // 修正前のバグ: trashPathが履歴に保存されずundefinedになっていた
    expect(mockRestoreFromTrash).toHaveBeenCalledWith(TRASH_PATH, FILES[0].path);
    // 元のカードのプレビューに戻る
    const lastSource = pdfRenderedSources[pdfRenderedSources.length - 1];
    expect(lastSource).toEqual({ uri: FILES[0].path });
  });

  it('削除失敗時はエラーAlertを表示し、カードは進まない', async () => {
    mockMoveToTrash.mockResolvedValue({
      success: false,
      error: "Location 'file:///...' isn't deletable.",
    });
    const tree = await renderScreen();

    await pressButton(tree, '削除');

    expect(alertSpy).toHaveBeenCalledWith(
      'エラー',
      expect.stringContaining('ファイル削除に失敗しました')
    );
    const lastSource = pdfRenderedSources[pdfRenderedSources.length - 1];
    expect(lastSource).toEqual({ uri: FILES[0].path });
  });

  it('保存先未設定で保存 → 設定誘導Alertが表示されmoveFileは呼ばれない', async () => {
    const tree = await renderScreen();

    await pressButton(tree, '保存');

    expect(alertSpy).toHaveBeenCalledWith(
      '保存先未設定',
      expect.any(String),
      expect.any(Array)
    );
    expect(mockMoveFile).not.toHaveBeenCalled();
  });

  describe('保存先（SAFフォルダ）設定済みの場合', () => {
    beforeEach(() => {
      // pdf_flick_config.json から saveFolderPath が読み込まれる状態を再現
      const FS = require('expo-file-system/legacy');
      (FS.getInfoAsync as jest.Mock).mockImplementation((path: string) =>
        Promise.resolve({ exists: path.includes('pdf_flick_config.json') })
      );
      (FS.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({ saveFolderPath: SAF_DIR })
      );
    });

    it('保存 → moveFileがSAFフォルダ宛に呼ばれ、次のカードへ進む', async () => {
      mockMoveFile.mockResolvedValue({
        success: true,
        data: { path: SAF_DEST_FILE, fileName: 'test_01.pdf' },
      });
      const tree = await renderScreen();

      await pressButton(tree, '保存');

      expect(mockMoveFile).toHaveBeenCalledWith(FILES[0].path, SAF_DIR);
      const lastSource = pdfRenderedSources[pdfRenderedSources.length - 1];
      expect(lastSource).toEqual({ uri: FILES[1].path });
    });

    it('保存 → 元に戻す → 実際の移動先URIからDownloadsへ復元される', async () => {
      mockMoveFile.mockResolvedValue({
        success: true,
        data: { path: SAF_DEST_FILE, fileName: 'test_01.pdf' },
      });
      const tree = await renderScreen();

      await pressButton(tree, '保存');
      await pressButton(tree, '元に戻す');

      // 修正前のバグ: フォルダURI+ファイル名の不正な連結URIで復元しようとしていた
      expect(mockMoveFile).toHaveBeenLastCalledWith(
        SAF_DEST_FILE,
        'file:///storage/emulated/0/Download/'
      );
      const lastSource = pdfRenderedSources[pdfRenderedSources.length - 1];
      expect(lastSource).toEqual({ uri: FILES[0].path });
    });
  });
});
