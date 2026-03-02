import { useState, useRef, useEffect } from 'react';
import { RotateCcw, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * PDF Flick - デザイン哲学: エレガント・プロフェッショナル型
 * 
 * 日本的な「余白の美学」とモダンミニマリズムを融合させたデザイン。
 * 落ち着いた配色（白、墨色、深い緑、薄い紅色）で、ビジネスユースに適した雰囲気。
 * 非対称レイアウトにより、左右のフリック方向が自然に認識される。
 */

interface PDFFile {
  id: string;
  name: string;
  preview: string; // Base64 encoded preview image
}

interface HistoryEntry {
  action: 'keep' | 'delete';
  file: PDFFile;
}

export default function Home() {
  const [files, setFiles] = useState<PDFFile[]>([
    {
      id: '1',
      name: 'document_2024_01.pdf',
      preview: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280"%3E%3Crect fill="%23f5f5f5" width="200" height="280"/%3E%3Ctext x="20" y="40" font-size="14" fill="%232c2c2c" font-family="serif"%3E重要な契約書%3C/text%3E%3Cline x1="20" y1="50" x2="180" y2="50" stroke="%23ccc" stroke-width="1"/%3E%3Ctext x="20" y="80" font-size="12" fill="%23666" font-family="sans-serif"%3E2024年1月15日作成%3C/text%3E%3Ctext x="20" y="110" font-size="11" fill="%23888" font-family="sans-serif"%3E本契約書は、甲と乙の間で%3C/text%3E%3Ctext x="20" y="130" font-size="11" fill="%23888" font-family="sans-serif"%3E締結される契約の内容を%3C/text%3E%3Ctext x="20" y="150" font-size="11" fill="%23888" font-family="sans-serif"%3E記載しています。%3C/text%3E%3C/svg%3E',
    },
    {
      id: '2',
      name: 'report_Q4_2023.pdf',
      preview: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280"%3E%3Crect fill="%23f5f5f5" width="200" height="280"/%3E%3Ctext x="20" y="40" font-size="14" fill="%232c2c2c" font-family="serif"%3E2023年Q4レポート%3C/text%3E%3Cline x1="20" y1="50" x2="180" y2="50" stroke="%23ccc" stroke-width="1"/%3E%3Crect x="20" y="70" width="160" height="80" fill="%23e8f4fd" stroke="%231b4332" stroke-width="1"/%3E%3Ctext x="30" y="120" font-size="12" fill="%231b4332" font-family="sans-serif"%3E売上: +15%3C/text%3E%3C/svg%3E',
    },
    {
      id: '3',
      name: 'invoice_20240215.pdf',
      preview: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280"%3E%3Crect fill="%23f5f5f5" width="200" height="280"/%3E%3Ctext x="20" y="40" font-size="14" fill="%232c2c2c" font-family="serif"%3E請求書%3C/text%3E%3Cline x1="20" y1="50" x2="180" y2="50" stroke="%23ccc" stroke-width="1"/%3E%3Ctext x="20" y="80" font-size="11" fill="%23666" font-family="sans-serif"%3E請求番号: INV-2024-0215%3C/text%3E%3Ctext x="20" y="100" font-size="11" fill="%23666" font-family="sans-serif"%3E金額: ¥150,000%3C/text%3E%3Ctext x="20" y="120" font-size="11" fill="%23666" font-family="sans-serif"%3E期限: 2024年3月15日%3C/text%3E%3C/svg%3E',
    },
  ]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [swipeStart, setSwipeStart] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentFile = files[currentIndex];

  // フリック開始
  const handleTouchStart = (e: React.TouchEvent) => {
    setSwipeStart(e.touches[0].clientX);
  };

  // フリック中
  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStart === null) return;
    const currentX = e.touches[0].clientX;
    const offset = currentX - swipeStart;
    setSwipeOffset(offset);
  };

  // フリック終了
  const handleTouchEnd = () => {
    if (swipeStart === null) return;

    const threshold = 50; // 50px以上のフリックで判定

    if (swipeOffset > threshold) {
      // 右フリック: キープ
      handleKeep();
    } else if (swipeOffset < -threshold) {
      // 左フリック: 削除
      handleDelete();
    }

    setSwipeStart(null);
    setSwipeOffset(0);
  };

  // キープ処理
  const handleKeep = () => {
    if (!currentFile) return;
    setHistory([...history, { action: 'keep', file: currentFile }]);
    moveToNext();
  };

  // 削除処理
  const handleDelete = () => {
    if (!currentFile) return;
    setHistory([...history, { action: 'delete', file: currentFile }]);
    moveToNext();
  };

  // 次のファイルに移動
  const moveToNext = () => {
    if (currentIndex < files.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // すべてのファイルを処理済み
      setCurrentIndex(-1);
    }
  };

  // Undo処理
  const handleUndo = () => {
    if (history.length === 0) return;

    const lastEntry = history[history.length - 1];
    setHistory(history.slice(0, -1));

    // ファイルを戻す
    if (currentIndex === -1) {
      // 最後のファイルの場合
      setCurrentIndex(files.length - 1);
    } else {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // ファイルがない場合
  if (files.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            整理するファイルはありません
          </h1>
          <p className="text-muted-foreground">
            ダウンロードフォルダにPDFファイルを配置してください。
          </p>
        </div>
      </div>
    );
  }

  // すべてのファイルを処理済みの場合
  if (currentIndex === -1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            整理完了
          </h1>
          <p className="text-muted-foreground mb-6">
            すべてのファイルを処理しました。
          </p>
          <div className="space-y-2 text-sm">
            <p className="text-foreground">
              キープ: {history.filter((h) => h.action === 'keep').length} 件
            </p>
            <p className="text-foreground">
              削除: {history.filter((h) => h.action === 'delete').length} 件
            </p>
          </div>
          <Button
            onClick={() => {
              setCurrentIndex(0);
              setHistory([]);
            }}
            className="mt-8 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            もう一度整理する
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ヘッダー */}
      <header className="border-b border-border py-6 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground">PDF Flick</h1>
          <p className="text-sm text-muted-foreground mt-1">
            PDFを整理して、必要なファイルを保存しましょう
          </p>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 flex items-center justify-center py-12 px-6">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* 左側: フリック操作ガイド */}
          <div className="hidden lg:flex flex-col items-center justify-center text-center opacity-40">
            <div className="text-5xl mb-4">←</div>
            <p className="text-sm text-foreground font-semibold">削除</p>
            <p className="text-xs text-muted-foreground mt-2">左にフリック</p>
          </div>

          {/* 中央: PDFプレビューカード */}
          <div
            ref={containerRef}
            className="flex items-center justify-center"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="w-full max-w-sm bg-white rounded-sm shadow-lg overflow-hidden transition-transform duration-200"
              style={{
                transform: `translateX(${swipeOffset * 0.3}px)`,
              }}
            >
              {/* プレビュー画像 */}
              <div className="aspect-[3/4] bg-muted flex items-center justify-center overflow-hidden">
                <img
                  src={currentFile.preview}
                  alt={currentFile.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* ファイル情報 */}
              <div className="p-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">
                  {currentIndex + 1} / {files.length}
                </p>
                <h2 className="text-lg font-semibold text-foreground truncate">
                  {currentFile.name}
                </h2>
              </div>
            </div>
          </div>

          {/* 右側: フリック操作ガイド */}
          <div className="hidden lg:flex flex-col items-center justify-center text-center opacity-40">
            <div className="text-5xl mb-4">→</div>
            <p className="text-sm text-foreground font-semibold">保存</p>
            <p className="text-xs text-muted-foreground mt-2">右にフリック</p>
          </div>
        </div>
      </main>

      {/* ボタンエリア */}
      <div className="border-t border-border bg-muted/20 py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleDelete}
            variant="destructive"
            className="flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Trash2 className="w-4 h-4" />
            削除
          </Button>

          <Button
            onClick={handleKeep}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            <Save className="w-4 h-4" />
            保存
          </Button>

          <Button
            onClick={handleUndo}
            disabled={history.length === 0}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            元に戻す
          </Button>
        </div>
      </div>

      {/* 処理履歴表示（デバッグ用） */}
      <div className="border-t border-border py-4 px-6 bg-muted/10">
        <div className="max-w-6xl mx-auto text-xs text-muted-foreground">
          <p>
            処理済み: キープ {history.filter((h) => h.action === 'keep').length} 件 / 削除{' '}
            {history.filter((h) => h.action === 'delete').length} 件
          </p>
        </div>
      </div>
    </div>
  );
}
