# PDF Flick - Android 版セットアップガイド

**バージョン**: 1.0.0  
**作成日**: 2026年3月2日  
**対象OS**: Android 8.0 以上

---

## 目次

1. [開発環境のセットアップ](#開発環境のセットアップ)
2. [プロジェクトの構築](#プロジェクトの構築)
3. [ビルド・デプロイ](#ビルドデプロイ)
4. [テスト](#テスト)
5. [トラブルシューティング](#トラブルシューティング)

---

## 開発環境のセットアップ

### 前提条件

- **Node.js**: 22.13.0 以上
- **npm**: 10.9.2 以上
- **Android Studio**: 最新版
- **Java Development Kit (JDK)**: 17 以上
- **Android SDK**: API 34 以上

### ステップ1: Android Studio のインストール

[Android Studio 公式サイト](https://developer.android.com/studio) から最新版をダウンロードしてインストールしてください。

### ステップ2: Android SDK のセットアップ

Android Studio を起動し、以下の SDK をインストールしてください。

- **Android SDK Platform 34** (API 34)
- **Android SDK Tools**
- **Android Emulator**
- **Android SDK Platform-Tools**

### ステップ3: 環境変数の設定

以下の環境変数を設定してください（macOS/Linux の場合）。

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Windows の場合は、システムの環境変数設定で同様に設定してください。

### ステップ4: Node.js と npm のインストール確認

```bash
node --version  # v22.13.0 以上
npm --version   # 10.9.2 以上
```

---

## プロジェクトの構築

### ステップ1: プロジェクトディレクトリに移動

```bash
cd /path/to/pdf_flick_android
```

### ステップ2: 依存パッケージをインストール

```bash
npm install
```

### ステップ3: Expo CLI を確認

```bash
npx expo --version
```

---

## ビルド・デプロイ

### 方法1: Expo Go を使用した開発（推奨）

Expo Go は、開発中にアプリを素早くテストできるツールです。

#### ステップ1: 開発サーバーを起動

```bash
npm run android
```

#### ステップ2: スマートフォンで Expo Go をインストール

[Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) から Expo Go をインストールしてください。

#### ステップ3: QR コードをスキャン

開発サーバーが起動すると、ターミナルに QR コードが表示されます。Expo Go でこの QR コードをスキャンしてアプリを実行してください。

### 方法2: ネイティブビルド（本番環境）

本番環境向けの APK ファイルをビルドします。

#### ステップ1: EAS CLI をインストール

```bash
npm install -g eas-cli
```

#### ステップ2: EAS アカウントにログイン

```bash
eas login
```

#### ステップ3: ビルド設定ファイルを初期化

```bash
eas build:configure
```

#### ステップ4: APK をビルド

```bash
eas build --platform android --local
```

ビルドが完了すると、APK ファイルが生成されます。

#### ステップ5: デバイスにインストール

```bash
adb install path/to/app-release.apk
```

---

## テスト

### ユニットテストの実行

```bash
npm test
```

### 手動テスト項目

以下の項目を確認してください。

| テスト項目 | 期待される動作 |
|-----------|-------------|
| アプリ起動 | アプリが正常に起動し、メイン画面が表示される |
| ファイル一覧 | ダウンロードフォルダ内の PDF ファイルが一覧表示される |
| プレビュー表示 | PDF の最初のページがプレビューとして表示される |
| 右フリック | ファイルが保存先フォルダに移動する |
| 左フリック | ファイルが削除される |
| Undo | 直前の操作が取り消される |
| 完了画面 | すべてのファイル処理後に完了画面が表示される |

---

## トラブルシューティング

### 問題1: ビルドが失敗する

**症状**: `npm run android` 実行時にビルドエラーが発生

**原因**: Android SDK が正しくインストールされていない、または環境変数が設定されていない

**対応**:
```bash
# Android SDK のパスを確認
echo $ANDROID_HOME

# 環境変数が設定されていない場合は設定
export ANDROID_HOME=$HOME/Library/Android/sdk
```

### 問題2: Expo Go でアプリが起動しない

**症状**: QR コードをスキャンしてもアプリが起動しない

**原因**: スマートフォンと開発マシンが同じネットワークに接続されていない

**対応**:
```bash
# ネットワークアドレスを確認
npm run android -- --tunnel
```

### 問題3: ファイルアクセス権限エラー

**症状**: ダウンロードフォルダにアクセスできない

**原因**: ファイルアクセス権限が許可されていない

**対応**:
1. アプリの設定 → 権限 → ファイルアクセスを許可
2. または、`app.json` で権限を定義

```json
{
  "plugins": [
    [
      "expo-file-system",
      {
        "photosPermission": "Allow PDF Flick to access your files"
      }
    ]
  ]
}
```

### 問題4: メモリ不足エラー

**症状**: 大きな PDF ファイルを処理する際にメモリ不足エラーが発生

**原因**: プレビュー画像がメモリに蓄積されている

**対応**:
- プレビュー画像のキャッシュサイズを制限
- または、大きなファイルは分割処理

---

## パフォーマンス最適化

### 推奨事項

1. **プレビュー生成の最適化**
   - PDF.js の代わりに Android ネイティブの PdfRenderer を使用
   - プレビュー画像の解像度を調整（現在: 200 DPI）

2. **メモリ管理**
   - プレビュー画像のキャッシュサイズを制限
   - 不要なメモリを定期的に解放

3. **ファイル操作の最適化**
   - 大きなファイルはバックグラウンドで処理
   - ファイル移動時に進捗表示を追加

---

## 次のステップ

1. **ネイティブモジュールの実装**: PDF プレビュー生成を Android ネイティブモジュールで実装
2. **テスト自動化**: Jest と Detox を使用したテスト自動化
3. **Google Play への公開**: アプリを Google Play Store に公開

---

## サポート

問題が解決しない場合は、以下のリソースを参照してください。

- **Expo ドキュメント**: https://docs.expo.dev/
- **React Native ドキュメント**: https://reactnative.dev/
- **Android ドキュメント**: https://developer.android.com/docs

---

## ライセンス

MIT License

---

## 作成者

Manus AI

