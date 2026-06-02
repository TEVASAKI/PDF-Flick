# PDF Flick

Androidのダウンロードフォルダに溜まったPDFファイルを、直感的なフリック操作で素早く整理するアプリです。

---

## プロジェクト構成

```
PDF-Flick/
├── android/          # Androidアプリ（メイン成果物）
├── client/           # Webプロトタイプ（React + Vite）
├── server/           # バックエンド（プレースホルダー）
├── shared/           # 共有型定義
└── docs/             # 検証レポート等
```

> **現在の主成果物は `android/` です。** Webプロトタイプ（`client/`）はUI検討用の初期実装です。

---

## Androidアプリ

### 機能概要

| 機能 | 内容 |
|------|------|
| ダウンロードフォルダスキャン | `file:///storage/emulated/0/Download/` 内の PDF を自動検出 |
| フリック操作 | 右 → 保存フォルダへ移動　／　左 → ゴミ箱へ移動 |
| Undo/Redo | 最大50操作の履歴管理、誤操作を即座に取り消し |
| ゴミ箱 | 削除したファイルをアプリ内に退避、一覧・復元・完全削除 |
| 保存先設定 | Storage Access Framework でフォルダをユーザーが選択 |

### 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | React Native 0.81.5 + Expo SDK 54 |
| 言語 | TypeScript 5.9.2 |
| ナビゲーション | Expo Router (Stack) |
| ファイルシステム | expo-file-system/legacy |
| ビルド | EAS Build (preview profile → APK) |
| パッケージID | `com.pdfflick.app` |

### ビルド手順（Windows）

```powershell
git clone https://github.com/TEVASAKI/PDF-Flick.git
cd PDF-Flick
git checkout claude/continue-pdf-flick-d0KVf

cd android
npm install

# EAS Build でAPK生成
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

APKをダウンロードしてAndroid端末にサイドロードしてください。

詳細は [`android/README_ANDROID.md`](android/README_ANDROID.md) を参照してください。

---

## Webプロトタイプ

```bash
pnpm install
pnpm dev
# http://localhost:3000
```

| 項目 | 内容 |
|------|------|
| フレームワーク | React 19 + Vite |
| スタイリング | Tailwind CSS 4 + shadcn/ui |
| ルーティング | Wouter |

---

## デザイン哲学

「エレガント・プロフェッショナル型」を採用。

| 要素 | 値 |
|------|-----|
| 背景 | 白 `#FFFFFF` |
| テキスト | 墨色 `#2C2C2C` |
| 保存アクション | 深い緑 `#1B4332` |
| 削除アクション | 薄い紅色 `#D62828` |
| 補助線 | 薄いグレー `#E0E0E0` |

---

## ドキュメント

| ファイル | 内容 |
|---------|------|
| [`android/README_ANDROID.md`](android/README_ANDROID.md) | Androidアプリ詳細 |
| [`android/SPECIFICATION_ANDROID.md`](android/SPECIFICATION_ANDROID.md) | 機能仕様書 |
| [`android/CHANGELOG_ANDROID.md`](android/CHANGELOG_ANDROID.md) | 更新履歴 |
| [`android/TESTING_GUIDE.md`](android/TESTING_GUIDE.md) | テストガイド |
| [`docs/verification-report.md`](docs/verification-report.md) | ビルド検証レポート |

---

## ライセンス

MIT License
