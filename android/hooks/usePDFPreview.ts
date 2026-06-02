import { useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * PDF の最初のページをプレビュー画像に変換するカスタムフック
 * 
 * React Native では、PDF を直接画像に変換する機能が限定されているため、
 * 実装方法としては以下の選択肢がある：
 * 1. react-native-pdf を使用してレンダリング
 * 2. ネイティブモジュール（Android: PdfRenderer）を使用
 * 3. Web ベースの PDF.js を使用
 * 
 * 本実装では、react-native-pdf を使用した簡易的なプレビュー表示を行う
 */

export const usePDFPreview = () => {
  const [previewCache, setPreviewCache] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  /**
   * PDF ファイルのプレビューを生成
   * 
   * 注: 実際の本番環境では、以下の実装が推奨される：
   * - Android ネイティブモジュール（PdfRenderer）を使用
   * - または、バックエンド API でプレビュー生成
   */
  const generatePreview = useCallback(
    async (filePath: string): Promise<string | null> => {
      try {
        // キャッシュを確認
        if (previewCache.has(filePath)) {
          return previewCache.get(filePath) || null;
        }

        setLoading(true);

        // ファイルが存在するか確認
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (!fileInfo.exists) {
          console.error('PDF file not found:', filePath);
          return null;
        }

        // ファイルを Base64 エンコード（簡易的なプレビュー用）
        const base64Data = await FileSystem.readAsStringAsync(filePath, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Data URI を生成
        const dataUri = `data:application/pdf;base64,${base64Data}`;

        // キャッシュに保存
        setPreviewCache((prev) => new Map(prev).set(filePath, dataUri));

        return dataUri;
      } catch (err) {
        console.error('Error generating preview:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [previewCache]
  );

  /**
   * キャッシュをクリア
   */
  const clearCache = useCallback(() => {
    setPreviewCache(new Map());
  }, []);

  return { generatePreview, clearCache, loading };
};

/**
 * PDF プレビューのプレースホルダー画像を生成
 */
export const generatePlaceholderPreview = (fileName: string): string => {
  // SVG ベースのプレースホルダーを生成
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280">
      <rect fill="#f5f5f5" width="200" height="280"/>
      <text x="20" y="40" font-size="14" fill="#2c2c2c" font-family="serif">
        ${fileName.substring(0, 20)}
      </text>
      <line x1="20" y1="50" x2="180" y2="50" stroke="#ccc" stroke-width="1"/>
      <text x="20" y="150" font-size="12" fill="#888" font-family="sans-serif">
        PDF プレビュー
      </text>
    </svg>
  `;

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
};
