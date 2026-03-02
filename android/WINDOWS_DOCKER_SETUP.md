# PDF Flick - Windows 11 + Docker 開発環境セットアップガイド

**対象環境**: Windows 11  
**開発方法**: Docker + Android Studio  
**ビルド対象**: Google Play Store 公開用（署名付きAPK）  
**作成日**: 2026年3月2日

---

## 目次

1. [前提条件](#前提条件)
2. [Docker Desktop のインストール](#docker-desktop-のインストール)
3. [Android Studio コンテナの構築](#android-studio-コンテナの構築)
4. [開発環境のセットアップ](#開発環境のセットアップ)
5. [Google Play Store 公開向けビルド](#google-play-store-公開向けビルド)
6. [セキュリティベストプラクティス](#セキュリティベストプラクティス)
7. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

### システム要件

- **OS**: Windows 11 Pro / Enterprise / Education
- **CPU**: Intel VT-x または AMD-V 対応プロセッサ
- **RAM**: 最低 8GB（推奨 16GB以上）
- **ディスク空き容量**: 最低 50GB（推奨 100GB以上）
- **BIOS設定**: 仮想化機能（Hyper-V）が有効化されていること

### インストール済みソフトウェア

- Git for Windows
- PowerShell 7.0 以上（オプション）

---

## Docker Desktop のインストール

### ステップ1: Hyper-V の有効化

Windows 11では、Docker Desktop を実行するために Hyper-V を有効にする必要があります。

#### PowerShell（管理者権限）で実行

```powershell
# Hyper-V を有効化
Enable-WindowsOptionalFeature -FeatureName Microsoft-Hyper-V -All -Online

# コマンド実行後、再起動を求められます
# 「Y」を入力して再起動してください
```

または、**手動で有効化**：

1. **Windows の設定** → **アプリ** → **プログラムと機能**
2. **Windows の機能の有効化または無効化** をクリック
3. **Hyper-V** にチェックを入れる
4. **OK** をクリックして再起動

### ステップ2: Docker Desktop のダウンロード

[Docker 公式サイト](https://www.docker.com/products/docker-desktop) から **Docker Desktop for Windows** をダウンロードしてください。

### ステップ3: Docker Desktop のインストール

1. ダウンロードした `DockerDesktopInstaller.exe` をダブルクリック
2. インストールウィザードに従う
3. **Install required Windows components for WSL 2** にチェック（推奨）
4. **Install** をクリック
5. インストール完了後、再起動

### ステップ4: インストール確認

PowerShell または コマンドプロンプトで以下を実行：

```powershell
docker --version
docker run hello-world
```

正常にインストールされていれば、バージョン情報と "Hello from Docker!" メッセージが表示されます。

---

## Android Studio コンテナの構築

### ステップ1: Dockerfile の作成

プロジェクトディレクトリに `Dockerfile` を作成します。

```dockerfile
# ベースイメージ: Ubuntu 22.04
FROM ubuntu:22.04

# 環境変数の設定
ENV ANDROID_HOME=/opt/android-sdk \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

# タイムゾーン設定（対話的プロンプトを避けるため）
ENV DEBIAN_FRONTEND=noninteractive

# 基本パッケージのインストール
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    openjdk-17-jdk \
    android-sdk-platform-tools \
    && rm -rf /var/lib/apt/lists/*

# Android SDK のダウンロード
RUN mkdir -p $ANDROID_HOME && \
    cd $ANDROID_HOME && \
    wget https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip && \
    unzip commandlinetools-linux-10406996_latest.zip && \
    rm commandlinetools-linux-10406996_latest.zip && \
    mkdir -p cmdline-tools/latest && \
    mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true

# Android SDK コンポーネントのインストール
RUN yes | sdkmanager --sdk_root=$ANDROID_HOME \
    "platforms;android-34" \
    "build-tools;34.0.0" \
    "platform-tools" \
    "tools"

# Node.js と npm のインストール
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Expo CLI のインストール
RUN npm install -g expo-cli eas-cli

# 作業ディレクトリの設定
WORKDIR /app

# ポート公開
EXPOSE 8081 19000 19001

# デフォルトコマンド
CMD ["/bin/bash"]
```

### ステップ2: Docker イメージのビルド

PowerShell で以下を実行：

```powershell
# プロジェクトディレクトリに移動
cd C:\path\to\pdf_flick_android

# Docker イメージをビルド
docker build -t pdf-flick-android:latest .
```

ビルドには 10～20 分かかります。

### ステップ3: Docker コンテナの起動

```powershell
# コンテナを起動（ボリュームマウント付き）
docker run -it `
  -v C:\path\to\pdf_flick_android:/app `
  -v C:\Users\YourUsername\.android:/root/.android `
  -p 8081:8081 `
  -p 19000:19000 `
  -p 19001:19001 `
  --name pdf-flick-dev `
  pdf-flick-android:latest
```

**パラメータ説明:**
- `-v C:\path\to\pdf_flick_android:/app`: プロジェクトディレクトリをマウント
- `-v C:\Users\YourUsername\.android:/root/.android`: Android 設定をマウント
- `-p 8081:8081`: Metro バンドラーのポート
- `-p 19000:19000`: Expo のポート
- `-p 19001:19001`: Expo デバッグのポート
- `--name pdf-flick-dev`: コンテナ名

### ステップ4: コンテナ内での確認

コンテナが起動したら、以下を実行して環境を確認：

```bash
# Node.js と npm のバージョン確認
node --version
npm --version

# Android SDK のバージョン確認
sdkmanager --list_installed

# Java のバージョン確認
java -version
```

---

## 開発環境のセットアップ

### ステップ1: 依存パッケージのインストール

コンテナ内で以下を実行：

```bash
cd /app
npm install
```

### ステップ2: Expo プロジェクトの確認

```bash
npx expo --version
```

### ステップ3: 開発サーバーの起動（オプション）

```bash
npm run android
```

Expo Go アプリで QR コードをスキャンして、開発中のアプリをテストできます。

---

## Google Play Store 公開向けビルド

### ステップ1: キーストア（署名キー）の生成

**⚠️ セキュリティ注意**: このキーストアは、アプリの公開に必須です。絶対に紛失・漏洩させないでください。

コンテナ内で以下を実行：

```bash
# キーストアディレクトリを作成
mkdir -p /app/keystore

# キーストアを生成
keytool -genkey -v -keystore /app/keystore/pdf_flick.keystore \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10950 \
  -alias pdf_flick_key

# プロンプトで以下を入力：
# - キーストアパスワード: (強力なパスワードを設定)
# - キーパスワード: (同じパスワード)
# - 名前: (あなたの名前)
# - 組織単位: (会社名など)
# - 組織: (会社名)
# - 都市: (都市名)
# - 都道府県: (都道府県)
# - 国コード: (JP など)
```

### ステップ2: キーストア情報の確認

```bash
keytool -list -v -keystore /app/keystore/pdf_flick.keystore
```

### ステップ3: eas.json の設定

プロジェクトルートに `eas.json` を作成または編集：

```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "production": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:bundleRelease"
      }
    },
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "development": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### ステップ4: app.json の設定

`app.json` に以下を追加：

```json
{
  "expo": {
    "name": "PDF Flick",
    "slug": "pdf-flick",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "plugins": [
      [
        "expo-file-system",
        {
          "photosPermission": "Allow PDF Flick to access your files"
        }
      ]
    ],
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.manus.pdfflick",
      "versionCode": 1,
      "permissions": [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

### ステップ5: APK のビルド

コンテナ内で以下を実行：

```bash
# eas-cli にログイン
eas login

# APK をビルド
eas build --platform android --local
```

ビルド完了後、APK ファイルが生成されます。

### ステップ6: APK の署名確認

```bash
# APK が正しく署名されているか確認
jarsigner -verify -verbose /app/build/pdf_flick.apk
```

---

## セキュリティベストプラクティス

### 1. キーストア管理

#### ✅ 推奨事項

- **強力なパスワード**: 最低 16 文字、大文字・小文字・数字・記号を含む
- **バックアップ**: キーストアファイルを複数の場所に安全に保管
- **暗号化**: キーストアファイルを BitLocker で暗号化
- **アクセス制限**: キーストアファイルへのアクセスを制限

#### ❌ 避けるべき行為

- キーストアファイルを Git リポジトリにコミット
- キーストアパスワードをコード内に記述
- キーストアファイルをメール・クラウドストレージで共有
- 弱いパスワード（例: "123456"）の使用

### 2. 環境変数の管理

キーストアパスワードを環境変数で管理：

```powershell
# Windows PowerShell（管理者権限）
[Environment]::SetEnvironmentVariable("KEYSTORE_PASSWORD", "your-secure-password", "User")
[Environment]::SetEnvironmentVariable("KEY_PASSWORD", "your-secure-password", "User")
```

コンテナ内で環境変数を使用：

```bash
# build.gradle で環境変数を参照
keytool -genkey -v -keystore /app/keystore/pdf_flick.keystore \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10950 \
  -alias pdf_flick_key \
  -storepass $KEYSTORE_PASSWORD \
  -keypass $KEY_PASSWORD
```

### 3. コード署名の検証

APK が正しく署名されているか確認：

```bash
# APK の署名情報を表示
jarsigner -verify -verbose /app/build/pdf_flick.apk

# 署名証明書の詳細を表示
keytool -printcert -jarfile /app/build/pdf_flick.apk
```

### 4. Google Play Console での設定

#### App Signing by Google Play の有効化

1. Google Play Console にログイン
2. **設定** → **アプリ署名**
3. **Google Play App Signing を使用する** を有効化

これにより、Google Play が APK に再署名し、セキュリティが向上します。

#### セキュアな API キーの管理

1. **Google Cloud Console** で API キーを生成
2. API キーに IP 制限を設定
3. API キーを環境変数で管理

### 5. ファイアウォール・ネットワークセキュリティ

- Docker コンテナのネットワークを制限
- ホスト側のファイアウォールで不要なポートを閉じる
- VPN を使用して開発環境を保護

---

## トラブルシューティング

### 問題1: Docker が起動しない

**症状**: Docker Desktop を起動しても起動しない

**原因**: Hyper-V が有効化されていない

**対応**:
```powershell
# Hyper-V の状態を確認
Get-WindowsOptionalFeature -FeatureName Microsoft-Hyper-V -Online

# Hyper-V を有効化
Enable-WindowsOptionalFeature -FeatureName Microsoft-Hyper-V -All -Online
```

### 問題2: コンテナ内でファイルが見えない

**症状**: Windows 側のファイルがコンテナ内に表示されない

**原因**: ボリュームマウントが正しく設定されていない

**対応**:
```powershell
# マウント状態を確認
docker inspect pdf-flick-dev | findstr -A 10 "Mounts"

# コンテナを再起動
docker restart pdf-flick-dev
```

### 問題3: APK ビルドが失敗する

**症状**: `eas build` でビルドエラーが発生

**原因**: Android SDK コンポーネントが不足している

**対応**:
```bash
# SDK マネージャーで必要なコンポーネントをインストール
sdkmanager --install "platforms;android-34" "build-tools;34.0.0"
```

### 問題4: キーストアパスワードを忘れた

**症状**: キーストアにアクセスできない

**対応**: 
- 新しいキーストアを生成する必要があります
- ただし、Google Play Store に既に公開している場合、新しいキーストアでは更新できません
- Google Play Console の「App Signing」を使用して、新しいキーで署名し直してください

---

## パフォーマンス最適化

### Docker コンテナのメモリ設定

Docker Desktop の設定で、コンテナに割り当てるメモリを増やす：

1. Docker Desktop の **Settings**
2. **Resources**
3. **Memory**: 8GB 以上に設定（推奨）
4. **CPUs**: 4 以上に設定（推奨）

### ビルド時間の短縮

```bash
# キャッシュを活用したビルド
eas build --platform android --local --cache-from=remote
```

---

## Google Play Store への公開手順

### ステップ1: Google Play Console アカウントの作成

1. [Google Play Console](https://play.google.com/console) にアクセス
2. Google アカウントでログイン
3. 開発者登録（$25 の登録料が必要）

### ステップ2: アプリの作成

1. **アプリを作成** をクリック
2. アプリ名: "PDF Flick"
3. デフォルト言語: 日本語
4. アプリのカテゴリ: 仕事効率化
5. **作成** をクリック

### ステップ3: APK のアップロード

1. **リリース** → **本番環境**
2. **新しいリリースを作成** をクリック
3. APK ファイルをアップロード
4. リリース名とリリースノートを入力
5. **確認して公開** をクリック

### ステップ4: ストア掲載情報の入力

1. **ストア掲載情報**
2. アプリの説明、スクリーンショット、アイコン等を入力
3. コンテンツレーティング、プライバシーポリシーを設定

### ステップ5: 公開

1. **アプリを公開** をクリック
2. 審査が開始されます（通常 2～4 時間）

---

## 次のステップ

1. **継続的インテグレーション（CI）**: GitHub Actions で自動ビルドを設定
2. **テスト自動化**: Detox で E2E テストを自動化
3. **アナリティクス**: Firebase Analytics でユーザー行動を追跡

---

## 参考資料

- [Docker 公式ドキュメント](https://docs.docker.com/)
- [Android 公式ドキュメント](https://developer.android.com/docs)
- [Google Play Console ヘルプ](https://support.google.com/googleplay/android-developer)
- [Expo ドキュメント](https://docs.expo.dev/)

---

## サポート

問題が解決しない場合は、以下のリソースを参照してください。

- **Docker コミュニティ**: https://forums.docker.com/
- **Android 開発者コミュニティ**: https://stackoverflow.com/questions/tagged/android
- **Expo コミュニティ**: https://forums.expo.dev/

