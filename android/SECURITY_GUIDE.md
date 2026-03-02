# PDF Flick - セキュリティガイド

**バージョン**: 1.0.0  
**対象**: Google Play Store 公開向けアプリケーション  
**作成日**: 2026年3月2日

---

## 目次

1. [セキュリティ概要](#セキュリティ概要)
2. [コード署名とキーストア管理](#コード署名とキーストア管理)
3. [ファイルアクセス権限](#ファイルアクセス権限)
4. [データ保護](#データ保護)
5. [ネットワークセキュリティ](#ネットワークセキュリティ)
6. [開発環境のセキュリティ](#開発環境のセキュリティ)
7. [セキュリティチェックリスト](#セキュリティチェックリスト)

---

## セキュリティ概要

### セキュリティ原則

PDF Flick は、以下のセキュリティ原則に基づいて開発されています。

1. **最小権限の原則**: 必要最小限の権限のみを要求
2. **データ保護**: ユーザーデータの暗号化と安全な保存
3. **透明性**: ユーザーに対して、データの使用方法を明確に説明
4. **定期的な監査**: セキュリティ脆弱性の定期的な確認

### セキュリティリスク評価

| リスク | 重要度 | 対応 |
|--------|--------|------|
| キーストア漏洩 | 🔴 高 | 強力なパスワード、暗号化、アクセス制限 |
| ファイルアクセス権限の悪用 | 🟡 中 | 明確な権限要求、ユーザー同意 |
| APK 改ざん | 🔴 高 | コード署名、署名検証 |
| データ盗聴 | 🟡 中 | HTTPS 通信（将来実装時） |

---

## コード署名とキーストア管理

### キーストアの生成

#### セキュアなキーストア生成手順

```bash
# 強力なパスワードでキーストアを生成
keytool -genkey -v -keystore pdf_flick.keystore \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10950 \
  -alias pdf_flick_key \
  -dname "CN=Your Name, OU=Your Organization, O=Your Company, L=Your City, ST=Your State, C=JP"
```

**パラメータ説明:**
- `-keyalg RSA`: RSA アルゴリズムを使用（推奨）
- `-keysize 2048`: 2048 ビットのキーサイズ（推奨）
- `-validity 10950`: 有効期限 30 年（Google Play Store の要件）
- `-alias pdf_flick_key`: キーの別名

#### キーストアパスワードの要件

- **最小長**: 16 文字以上
- **文字種**: 大文字、小文字、数字、記号を含む
- **複雑性**: 辞書に載っていない単語の組み合わせ

**推奨パスワード例:**
```
P@ssw0rd!2024#SecureKey
MyApp!2024@Secure#Key123
```

### キーストアファイルの保護

#### ✅ 推奨事項

1. **ファイルの暗号化**
   ```powershell
   # Windows BitLocker で暗号化
   cipher /c /e C:\keystore\pdf_flick.keystore
   ```

2. **バックアップの作成**
   ```powershell
   # 複数の場所にバックアップを保存
   Copy-Item C:\keystore\pdf_flick.keystore D:\backup\pdf_flick.keystore
   Copy-Item C:\keystore\pdf_flick.keystore E:\external_drive\pdf_flick.keystore
   ```

3. **アクセス制限**
   ```powershell
   # ファイルのアクセス権限を制限
   icacls C:\keystore\pdf_flick.keystore /inheritance:r /grant:r "%USERNAME%:F"
   ```

4. **定期的な確認**
   - 月 1 回、キーストアファイルの整合性を確認
   - パスワードの定期的な変更（年 1 回）

#### ❌ 避けるべき行為

- ✗ キーストアファイルを Git リポジトリにコミット
- ✗ キーストアファイルを GitHub に公開
- ✗ キーストアパスワードをコード内に記述
- ✗ キーストアファイルをメールで共有
- ✗ キーストアファイルを暗号化なしでクラウドストレージに保存
- ✗ 複数のアプリで同じキーストアを使用

### キーストア情報の確認

```bash
# キーストアの詳細情報を表示
keytool -list -v -keystore pdf_flick.keystore

# 出力例:
# Keystore type: PKCS12
# Keystore provider: SUN
# Your keystore contains 1 entry
# Alias name: pdf_flick_key
# Creation date: Mar 2, 2026
# Entry type: PrivateKeyEntry
# Certificate chain length: 1
# Certificate[1]:
#   Owner: CN=Your Name, OU=Your Organization, O=Your Company, L=Your City, ST=Your State, C=JP
#   Issuer: CN=Your Name, OU=Your Organization, O=Your Company, L=Your City, ST=Your State, C=JP
#   Serial number: 1234567890abcdef
#   Valid from: Mar 2, 2026 until: Mar 1, 2056
#   Certificate fingerprints:
#     SHA1: 12:34:56:78:90:AB:CD:EF:...
#     SHA256: 12:34:56:78:90:AB:CD:EF:...
```

### APK の署名検証

```bash
# APK が正しく署名されているか確認
jarsigner -verify -verbose pdf_flick.apk

# 署名証明書の詳細を表示
keytool -printcert -jarfile pdf_flick.apk

# APK の署名情報を詳細表示
jarsigner -verify -verbose -certs pdf_flick.apk
```

---

## ファイルアクセス権限

### 要求する権限

PDF Flick が要求する権限は、以下の通りです。

| 権限 | 用途 | 必要性 |
|------|------|--------|
| `READ_EXTERNAL_STORAGE` | ダウンロードフォルダの読み取り | ✅ 必須 |
| `WRITE_EXTERNAL_STORAGE` | ファイルの移動・削除 | ✅ 必須 |

### 権限の要求方法

`app.json` で権限を定義：

```json
{
  "expo": {
    "android": {
      "permissions": [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

### 権限の実行時要求

Android 6.0 以上では、実行時に権限を要求する必要があります。

```typescript
// React Native での権限要求例
import { PermissionsAndroid } from 'react-native';

const requestFilePermissions = async () => {
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    ]);

    if (
      granted['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
    ) {
      console.log('Permissions granted');
    } else {
      console.log('Permissions denied');
    }
  } catch (err) {
    console.warn(err);
  }
};
```

### プライバシーポリシー

Google Play Store では、プライバシーポリシーが必須です。

**プライバシーポリシーに含める内容:**

1. **データ収集**: どのデータを収集するか
2. **データ使用**: データをどのように使用するか
3. **データ保護**: データをどのように保護するか
4. **ユーザー権利**: ユーザーがデータを削除・修正できるか
5. **第三者共有**: データを第三者と共有するか

**PDF Flick のプライバシーポリシー例:**

```
PDF Flick プライバシーポリシー

1. データ収集
PDF Flick は、以下のデータを収集します：
- ダウンロードフォルダ内の PDF ファイル情報（ファイル名、サイズ、更新日時）
- ユーザーの設定（保存先フォルダパス）

2. データ使用
収集したデータは、以下の目的で使用されます：
- PDF ファイルの整理機能の提供
- ユーザー設定の保存

3. データ保護
- データはデバイスのローカルストレージに保存されます
- ネットワーク通信は行われません
- データは暗号化されません

4. ユーザー権利
- ユーザーは、いつでもアプリをアンインストールしてデータを削除できます
- 保存先フォルダパスは、設定画面で変更・削除できます

5. 第三者共有
- PDF Flick は、ユーザーデータを第三者と共有しません
```

---

## データ保護

### ローカルストレージ

PDF Flick は、ユーザーデータをデバイスのローカルストレージに保存します。

```typescript
// 設定ファイルの保存例
const saveFolderPathToStorage = async (folderPath: string) => {
  try {
    const storagePath = new FileSystem.File(Paths.document, 'pdf_flick_config.json').uri;
    const config = { saveFolderPath: folderPath };
    
    // JSON を文字列に変換して保存
    await FileSystem.writeAsStringAsync(
      storagePath,
      JSON.stringify(config)
    );
  } catch (error) {
    console.error('Error saving folder path:', error);
  }
};
```

### 暗号化（将来実装）

将来のバージョンでは、設定ファイルを暗号化することを検討しています。

```typescript
// 暗号化の例（将来実装）
import * as Crypto from 'expo-crypto';

const encryptConfig = async (config: any, password: string) => {
  const jsonString = JSON.stringify(config);
  // 暗号化処理
  // ...
};
```

---

## ネットワークセキュリティ

### 現在の実装

PDF Flick は、ネットワーク通信を行いません。すべてのデータはデバイスのローカルストレージに保存されます。

### 将来の実装時の注意事項

将来、クラウドストレージやバックアップ機能を追加する場合は、以下のセキュリティ対策が必須です。

1. **HTTPS 通信**
   ```typescript
   // HTTPS を使用した通信
   const response = await fetch('https://api.example.com/backup', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${accessToken}`,
     },
     body: JSON.stringify(data),
   });
   ```

2. **API キーの管理**
   - API キーを環境変数で管理
   - API キーをコード内に記述しない
   - API キーに IP 制限を設定

3. **SSL/TLS 証明書の検証**
   ```typescript
   // SSL/TLS 証明書を検証
   const response = await fetch('https://api.example.com/backup', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
     },
     body: JSON.stringify(data),
     // React Native では、デフォルトで SSL/TLS 証明書が検証されます
   });
   ```

---

## 開発環境のセキュリティ

### Git リポジトリの保護

#### `.gitignore` に追加

```
# キーストアファイル
*.keystore
*.jks

# 環境変数ファイル
.env
.env.local
.env.*.local

# Android 設定
.gradle/
build/

# IDE 設定
.idea/
.vscode/

# Node.js
node_modules/
npm-debug.log
yarn-error.log

# 設定ファイル
pdf_flick_config.json
```

#### リポジトリの公開設定

- **プライベートリポジトリ**: キーストアやシークレットを含む場合は、必ずプライベートリポジトリにする
- **アクセス制限**: チームメンバーのみがアクセスできるように設定
- **シークレットスキャン**: GitHub の Secret scanning を有効化

### 環境変数の管理

#### Windows での環境変数設定

```powershell
# ユーザー環境変数として設定（推奨）
[Environment]::SetEnvironmentVariable("KEYSTORE_PASSWORD", "your-secure-password", "User")

# システム環境変数として設定（管理者権限が必要）
[Environment]::SetEnvironmentVariable("KEYSTORE_PASSWORD", "your-secure-password", "Machine")

# 環境変数を確認
Get-ChildItem env:KEYSTORE_PASSWORD
```

#### Docker コンテナでの環境変数使用

```bash
# コンテナ起動時に環境変数を渡す
docker run -it \
  -e KEYSTORE_PASSWORD=$env:KEYSTORE_PASSWORD \
  -e KEY_PASSWORD=$env:KEY_PASSWORD \
  pdf-flick-android:latest
```

### コード審査プロセス

1. **Pull Request（PR）の作成**
   - 機能ごとに PR を作成
   - PR テンプレートを使用

2. **コード審査**
   - 最低 2 人以上による審査
   - セキュリティ脆弱性の確認

3. **自動テスト**
   - Lint チェック
   - ユニットテスト
   - セキュリティスキャン

4. **マージ**
   - すべての審査と テストに合格後、マージ

---

## セキュリティチェックリスト

### ビルド前のチェック

- [ ] キーストアファイルが `.gitignore` に含まれている
- [ ] キーストアパスワードが強力である（16 文字以上）
- [ ] キーストアファイルが暗号化されている
- [ ] キーストアファイルのバックアップが複数の場所に保存されている
- [ ] `app.json` に正しい権限が定義されている
- [ ] プライバシーポリシーが作成されている
- [ ] コード内に機密情報（パスワード、API キー等）が含まれていない

### ビルド時のチェック

- [ ] APK が正しく署名されている
- [ ] APK の署名が有効である
- [ ] APK のサイズが妥当である（50MB 以下）
- [ ] APK にデバッグ情報が含まれていない

### Google Play Store 公開前のチェック

- [ ] アプリの説明が正確である
- [ ] スクリーンショットが適切である
- [ ] プライバシーポリシーが Google Play Console に登録されている
- [ ] コンテンツレーティングが正確である
- [ ] 権限の説明が明確である

### 公開後のチェック

- [ ] ユーザーレビューを定期的に確認
- [ ] セキュリティ脆弱性の報告を監視
- [ ] Google Play Console のセキュリティアラートを確認
- [ ] 定期的なセキュリティ監査を実施

---

## セキュリティインシデント対応

### インシデント報告

セキュリティ脆弱性を発見した場合は、以下の方法で報告してください。

1. **責任ある開示**: 公開前に開発者に報告
2. **メール**: security@manus.ai
3. **詳細情報**: 脆弱性の説明、再現手順、影響範囲

### インシデント対応手順

1. **確認**: 報告内容を確認・検証
2. **修正**: セキュリティパッチを開発
3. **テスト**: パッチが脆弱性を解決することを確認
4. **公開**: パッチを含むアップデートを公開
5. **通知**: ユーザーにアップデートを通知

---

## 参考資料

- [Google Play Console セキュリティガイド](https://support.google.com/googleplay/android-developer/answer/9859455)
- [Android セキュリティベストプラクティス](https://developer.android.com/training/articles/security-tips)
- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
- [Java Keytool ドキュメント](https://docs.oracle.com/javase/8/docs/technotes/tools/unix/keytool.html)

---

## ライセンス

MIT License

