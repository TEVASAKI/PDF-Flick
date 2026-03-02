# PDF Flick - 環境変数設定ガイド

**重要**: このドキュメントでは、開発環境での環境変数設定方法を説明します。本番環境では、より厳格なセキュリティ対策が必須です。

---

## 目次

1. [環境変数の概要](#環境変数の概要)
2. [Windows での設定](#windows-での設定)
3. [Docker コンテナでの設定](#docker-コンテナでの設定)
4. [セキュリティベストプラクティス](#セキュリティベストプラクティス)

---

## 環境変数の概要

PDF Flick では、以下の環境変数を使用します。

| 変数名 | 用途 | 必須 | 例 |
|--------|------|------|-----|
| `KEYSTORE_PASSWORD` | キーストアのパスワード | ✅ | `P@ssw0rd!2024#Secure` |
| `KEY_PASSWORD` | キーの個別パスワード | ✅ | `P@ssw0rd!2024#Secure` |
| `GOOGLE_PLAY_CONSOLE_API_KEY` | Google Play Console API キー | ❌ | `AIzaSyD...` |
| `SENTRY_DSN` | Sentry エラートラッキング | ❌ | `https://...@sentry.io/...` |
| `FIREBASE_API_KEY` | Firebase API キー | ❌ | `AIzaSyD...` |
| `FIREBASE_PROJECT_ID` | Firebase プロジェクトID | ❌ | `pdf-flick-12345` |

---

## Windows での設定

### 方法1: PowerShell（推奨）

#### ステップ1: PowerShell を管理者権限で起動

1. Windows キーを押して "PowerShell" を検索
2. **Windows PowerShell** を右クリック
3. **管理者として実行** をクリック

#### ステップ2: 環境変数を設定

```powershell
# ユーザー環境変数として設定（現在のユーザーのみ）
[Environment]::SetEnvironmentVariable("KEYSTORE_PASSWORD", "your-secure-password", "User")
[Environment]::SetEnvironmentVariable("KEY_PASSWORD", "your-secure-password", "User")

# または、システム環境変数として設定（すべてのユーザー）
[Environment]::SetEnvironmentVariable("KEYSTORE_PASSWORD", "your-secure-password", "Machine")
[Environment]::SetEnvironmentVariable("KEY_PASSWORD", "your-secure-password", "Machine")
```

#### ステップ3: 環境変数を確認

```powershell
# 設定した環境変数を確認
Get-ChildItem env:KEYSTORE_PASSWORD
Get-ChildItem env:KEY_PASSWORD

# すべての環境変数を表示
Get-ChildItem env: | Sort-Object Name
```

#### ステップ4: PowerShell を再起動

新しい PowerShell ウィンドウを開いて、環境変数が反映されているか確認します。

```powershell
echo $env:KEYSTORE_PASSWORD
```

### 方法2: Windows GUI

#### ステップ1: 環境変数の設定を開く

1. **Windows キー + X** を押して、**システム** をクリック
2. **詳細情報** をクリック
3. **環境変数** をクリック

#### ステップ2: ユーザー環境変数を設定

1. **新規** をクリック
2. **変数名**: `KEYSTORE_PASSWORD`
3. **変数値**: `your-secure-password`
4. **OK** をクリック

同様に、`KEY_PASSWORD` も設定します。

#### ステップ3: システムを再起動

環境変数が反映されるように、システムを再起動します。

### 方法3: .env ファイル（開発環境のみ）

**⚠️ 注意**: `.env` ファイルは、Git リポジトリにコミットしないでください。

#### ステップ1: .env ファイルを作成

プロジェクトルートに `.env` ファイルを作成：

```
KEYSTORE_PASSWORD=your-secure-password
KEY_PASSWORD=your-secure-password
```

#### ステップ2: .env ファイルを .gitignore に追加

```
# .gitignore
.env
.env.local
.env.*.local
```

#### ステップ3: PowerShell で .env ファイルを読み込む

```powershell
# .env ファイルから環境変数を読み込む
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
}
```

---

## Docker コンテナでの設定

### 方法1: docker-compose.yml で設定

`docker-compose.yml` で環境変数を定義：

```yaml
services:
  pdf-flick-dev:
    environment:
      - KEYSTORE_PASSWORD=${KEYSTORE_PASSWORD}
      - KEY_PASSWORD=${KEY_PASSWORD}
```

### 方法2: .env ファイルで設定

プロジェクトルートに `.env` ファイルを作成：

```
KEYSTORE_PASSWORD=your-secure-password
KEY_PASSWORD=your-secure-password
```

`docker-compose up` を実行すると、`.env` ファイルから自動的に環境変数が読み込まれます。

### 方法3: コマンドラインで設定

```powershell
# PowerShell
docker-compose run -e KEYSTORE_PASSWORD=$env:KEYSTORE_PASSWORD -e KEY_PASSWORD=$env:KEY_PASSWORD pdf-flick-dev

# または
docker run -it `
  -e KEYSTORE_PASSWORD=$env:KEYSTORE_PASSWORD `
  -e KEY_PASSWORD=$env:KEY_PASSWORD `
  pdf-flick-android:latest
```

### ステップ: コンテナ内で環境変数を確認

```bash
# コンテナ内で環境変数を確認
echo $KEYSTORE_PASSWORD
echo $KEY_PASSWORD
```

---

## セキュリティベストプラクティス

### ✅ 推奨事項

1. **強力なパスワード**
   - 最低 16 文字
   - 大文字、小文字、数字、記号を含む
   - 辞書に載っていない単語の組み合わせ

2. **環境変数の管理**
   - Windows の環境変数を使用（推奨）
   - `.env` ファイルは `.gitignore` に含める
   - `.env` ファイルを Git にコミットしない

3. **アクセス制限**
   - キーストアファイルへのアクセスを制限
   - 環境変数を必要なプロセスのみに公開

4. **定期的な確認**
   - 月 1 回、キーストアファイルの整合性を確認
   - パスワードの定期的な変更（年 1 回）

### ❌ 避けるべき行為

- ✗ パスワードをコード内に記述
- ✗ パスワードを Git にコミット
- ✗ パスワードをメールで共有
- ✗ パスワードを平文で保存
- ✗ 複数のアプリで同じパスワードを使用
- ✗ `.env` ファイルを Git にコミット

---

## トラブルシューティング

### 問題1: 環境変数が反映されない

**症状**: PowerShell で環境変数を設定しても、コマンドプロンプトで反映されない

**原因**: 環境変数の設定がプロセスレベルで行われている

**対応**:
```powershell
# ユーザー環境変数として設定（推奨）
[Environment]::SetEnvironmentVariable("KEYSTORE_PASSWORD", "your-secure-password", "User")

# PowerShell を再起動
```

### 問題2: Docker コンテナで環境変数が見えない

**症状**: Docker コンテナ内で環境変数が設定されていない

**原因**: `docker-compose.yml` で環境変数が正しく定義されていない

**対応**:
```yaml
# docker-compose.yml
services:
  pdf-flick-dev:
    environment:
      - KEYSTORE_PASSWORD=${KEYSTORE_PASSWORD}
      - KEY_PASSWORD=${KEY_PASSWORD}
```

```powershell
# PowerShell で環境変数を設定してから実行
$env:KEYSTORE_PASSWORD = "your-secure-password"
$env:KEY_PASSWORD = "your-secure-password"
docker-compose up
```

### 問題3: パスワードに特殊文字が含まれている

**症状**: パスワードに `$` や `&` などの特殊文字が含まれている場合、エラーが発生

**対応**:
```powershell
# シングルクォートで囲む
[Environment]::SetEnvironmentVariable("KEYSTORE_PASSWORD", 'P@ssw0rd!2024#Secure&More', "User")
```

---

## 参考資料

- [Windows 環境変数の設定](https://docs.microsoft.com/ja-jp/windows/win32/procthread/environment-variables)
- [PowerShell 環境変数](https://docs.microsoft.com/ja-jp/powershell/module/microsoft.powershell.core/about/about_environment_variables)
- [Docker Compose 環境変数](https://docs.docker.com/compose/environment-variables/)

