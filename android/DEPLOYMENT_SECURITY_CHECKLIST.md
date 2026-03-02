# PDF Flick - デプロイ前セキュリティチェックリスト

**重要**: Google Play Store への公開前に、以下のセキュリティチェックを必ず実施してください。

**作成日**: 2026年3月2日  
**対象**: v1.0.0 以降のすべてのリリース

---

## 目次

1. [コード署名セキュリティ](#コード署名セキュリティ)
2. [認証・認可セキュリティ](#認証認可セキュリティ)
3. [APIキー管理](#apiキー管理)
4. [アクセス制御](#アクセス制御)
5. [データ保護](#データ保護)
6. [ネットワークセキュリティ](#ネットワークセキュリティ)
7. [コードセキュリティ](#コードセキュリティ)
8. [デプロイメント](#デプロイメント)
9. [本番環境監視](#本番環境監視)

---

## コード署名セキュリティ

### キーストア管理

- [ ] キーストアファイルが `.gitignore` に含まれている
- [ ] キーストアパスワードが **16 文字以上**で、大文字・小文字・数字・記号を含む
- [ ] キーストアファイルが **BitLocker で暗号化**されている
- [ ] キーストアファイルのバックアップが **複数の場所**に保存されている
  - [ ] 外部ドライブ（USB等）
  - [ ] クラウドストレージ（暗号化済み）
  - [ ] オフサイトバックアップ
- [ ] キーストアファイルへのアクセス権限が **制限**されている
- [ ] キーストアパスワードが **環境変数**で管理されている
- [ ] キーストアパスワードが **コード内に記述されていない**

### APK署名検証

```bash
# APK が正しく署名されているか確認
jarsigner -verify -verbose pdf_flick.apk

# 署名証明書の詳細を表示
keytool -printcert -jarfile pdf_flick.apk

# 署名の有効期限を確認（30年以上）
keytool -list -v -keystore pdf_flick.keystore
```

- [ ] APK が正しく署名されている
- [ ] 署名証明書の有効期限が **30年以上**である
- [ ] 署名証明書の SHA256 フィンガープリントが記録されている

### チェックリスト

- [ ] キーストアファイルが安全に保管されている
- [ ] APK の署名が有効である
- [ ] 署名検証テストに合格している

---

## 認証・認可セキュリティ

### 現在の実装状況

**PDF Flick v1.0.0** は、ローカルアプリのため認証・認可は不要です。

### 将来のクラウド機能実装時の要件

以下の機能を追加する場合は、認証・認可の実装が必須です。

- クラウドバックアップ
- 複数デバイス同期
- ユーザーアカウント管理

### Manus OAuth 統合（推奨）

Manus では、ワンクリックで OAuth 認証を統合できます。

```typescript
// Manus OAuth の統合例
import { useAuth } from '@manus/auth';

export default function LoginScreen() {
  const { login, user } = useAuth();

  return (
    <Button onPress={() => login()}>
      Manus でログイン
    </Button>
  );
}
```

### JWT トークン管理

```typescript
// JWT トークンの安全な保存
import * as SecureStore from 'expo-secure-store';

const saveToken = async (token: string) => {
  await SecureStore.setItemAsync('auth_token', token);
};

const getToken = async () => {
  return await SecureStore.getItemAsync('auth_token');
};

const deleteToken = async () => {
  await SecureStore.deleteItemAsync('auth_token');
};
```

### チェックリスト

- [ ] 認証が必要な場合、Manus OAuth を使用している
- [ ] JWT トークンが `expo-secure-store` で安全に保存されている
- [ ] トークンの有効期限が設定されている（推奨: 1 時間）
- [ ] リフレッシュトークンが安全に管理されている
- [ ] 弱いパスワードポリシーが実装されていない
- [ ] パスワードがプレーンテキストで保存されていない

---

## APIキー管理

### 現在の実装状況

**PDF Flick v1.0.0** は、外部 API を使用していません。

### 将来の API 統合時の要件

以下の API を使用する場合は、キー管理が必須です。

- Google Drive API（クラウドバックアップ）
- Firebase API（ユーザー認証、データベース）
- Sentry API（エラートラッキング）

### APIキーの安全な管理

#### ❌ 避けるべき行為

```typescript
// ❌ ハードコード（絶対禁止）
const API_KEY = "AIzaSyD...";
const API_SECRET = "secret123";

// ❌ コメント内に記述（絶対禁止）
// API_KEY = "AIzaSyD..."

// ❌ Git にコミット（絶対禁止）
// .env ファイルを Git にコミット
```

#### ✅ 推奨される実装

```typescript
// ✅ 環境変数から読み込み
const API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
const API_SECRET = process.env.GOOGLE_DRIVE_API_SECRET;

// ✅ 実行時に検証
if (!API_KEY || !API_SECRET) {
  throw new Error('API keys are not configured');
}
```

### 環境変数管理

```powershell
# Windows PowerShell で設定
[Environment]::SetEnvironmentVariable("GOOGLE_DRIVE_API_KEY", "AIzaSyD...", "User")
[Environment]::SetEnvironmentVariable("GOOGLE_DRIVE_API_SECRET", "secret123", "User")
```

### API キーのローテーション

- [ ] API キーを **定期的に更新**する（年 1 回以上）
- [ ] 古い API キーを **削除**する
- [ ] API キーの使用状況を **監視**する

### チェックリスト

- [ ] API キーが **環境変数**で管理されている
- [ ] API キーが **コード内にハードコードされていない**
- [ ] API キーが **Git にコミットされていない**
- [ ] API キーに **IP 制限**が設定されている
- [ ] API キーに **レート制限**が設定されている
- [ ] API キーの使用状況が **監視**されている

---

## アクセス制御

### 現在の実装状況

**PDF Flick v1.0.0** は、ローカルアプリのため外部アクセスはありません。

### 将来のサーバー実装時の要件

以下の機能を追加する場合は、アクセス制御が必須です。

- バックエンドサーバー
- クラウドストレージ
- ユーザー認証

### IP 制限の実装

#### Firebase Security Rules（推奨）

```typescript
// Firebase Firestore のセキュリティルール
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // ユーザーは自分のデータのみアクセス可能
      allow read, write: if request.auth.uid == userId;
    }
    
    match /backups/{backupId} {
      // ユーザーは自分のバックアップのみアクセス可能
      allow read, write: if request.auth.uid == resource.data.userId;
    }
  }
}
```

#### Cloud Armor（Google Cloud）

```yaml
# Cloud Armor ポリシー
name: pdf-flick-policy
rules:
  - priority: 1000
    description: "Block traffic from specific countries"
    match:
      versionedExpr: "CLOUD_ARMOR"
      expr:
        expression: "origin.region_code == 'CN'"
    action: "deny(403)"
  
  - priority: 2000
    description: "Rate limiting"
    match:
      versionedExpr: "CLOUD_ARMOR"
      expr:
        expression: "true"
    action: "rate_based_ban"
    rateLimitOptions:
      conformAction: "allow"
      exceedAction: "deny(429)"
      rateLimitThreshold:
        count: 100
        intervalSec: 60
```

### ロールベース制御（RBAC）

```typescript
// ロールベース制御の実装例
interface User {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  permissions: string[];
}

const checkPermission = (user: User, action: string): boolean => {
  const rolePermissions: Record<string, string[]> = {
    user: ['read', 'write_own'],
    admin: ['read', 'write', 'delete', 'manage_users'],
    moderator: ['read', 'write', 'delete'],
  };

  return rolePermissions[user.role]?.includes(action) ?? false;
};
```

### チェックリスト

- [ ] IP 制限が設定されている
- [ ] ロールベース制御（RBAC）が実装されている
- [ ] API エンドポイントが HTTPS 限定である
- [ ] CORS（Cross-Origin Resource Sharing）が正しく設定されている
- [ ] レート制限が設定されている

---

## データ保護

### ローカルストレージ暗号化

```typescript
// expo-secure-store を使用した暗号化
import * as SecureStore from 'expo-secure-store';

const saveSensitiveData = async (key: string, value: string) => {
  await SecureStore.setItemAsync(key, value);
};

const getSensitiveData = async (key: string) => {
  return await SecureStore.getItemAsync(key);
};
```

### ファイル暗号化

```typescript
// ファイルの暗号化例（将来実装）
import * as Crypto from 'expo-crypto';

const encryptFile = async (filePath: string, password: string) => {
  const fileContent = await FileSystem.readAsStringAsync(filePath);
  
  // AES-256 で暗号化
  const encrypted = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    fileContent + password
  );
  
  return encrypted;
};
```

### チェックリスト

- [ ] 機密データが `expo-secure-store` で暗号化されている
- [ ] ファイルが暗号化されている（将来実装時）
- [ ] データベースが暗号化されている（将来実装時）
- [ ] バックアップが暗号化されている

---

## ネットワークセキュリティ

### HTTPS 通信の強制

```typescript
// HTTPS 限定の API 通信
const fetchData = async (url: string) => {
  if (!url.startsWith('https://')) {
    throw new Error('Only HTTPS connections are allowed');
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
};
```

### SSL/TLS 証明書の検証

```typescript
// SSL/TLS 証明書を検証（デフォルトで有効）
const response = await fetch('https://api.example.com/data', {
  method: 'GET',
  // React Native では、デフォルトで SSL/TLS 証明書が検証されます
  // 証明書検証を無効化することは絶対に避けてください
});
```

### チェックリスト

- [ ] すべての通信が HTTPS である
- [ ] SSL/TLS 証明書が検証されている
- [ ] 自己署名証明書を使用していない（本番環境）
- [ ] TLS バージョンが 1.2 以上である

---

## コードセキュリティ

### 静的解析とリント

```bash
# TypeScript の型チェック
npm run check

# ESLint でコード品質をチェック
npm run lint

# セキュリティ脆弱性をスキャン
npm audit
```

### 依存パッケージの監視

```bash
# 脆弱性のある依存パッケージを確認
npm audit

# 脆弱性を修正
npm audit fix

# 定期的に依存パッケージを更新
npm update
```

### チェックリスト

- [ ] TypeScript の型チェックに合格している
- [ ] ESLint でコード品質をチェック済み
- [ ] `npm audit` で脆弱性がない
- [ ] 依存パッケージが最新版である
- [ ] コードレビューが完了している

---

## デプロイメント

### ビルド前の確認

```bash
# 開発ビルドをテスト
npm run build

# APK をビルド
eas build --platform android --local

# APK の署名を検証
jarsigner -verify -verbose pdf_flick.apk
```

### チェックリスト

- [ ] ビルドが成功している
- [ ] APK が正しく署名されている
- [ ] APK のサイズが妥当である（50MB 以下）
- [ ] APK にデバッグ情報が含まれていない
- [ ] APK にテストコードが含まれていない

### Google Play Console への登録

- [ ] Google Play Console アカウントが作成されている
- [ ] アプリが登録されている
- [ ] プライバシーポリシーが登録されている
- [ ] コンテンツレーティングが設定されている
- [ ] 権限の説明が記載されている

### チェックリスト

- [ ] Google Play Console への登録が完了している
- [ ] アプリの説明が正確である
- [ ] スクリーンショットが適切である
- [ ] プライバシーポリシーが表示されている
- [ ] 権限の説明が明確である

---

## 本番環境監視

### エラートラッキング

```typescript
// Sentry でエラーを監視
import * as Sentry from "sentry-expo";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enableInExpoDevelopment: true,
  debug: true,
});

try {
  // アプリケーションコード
} catch (error) {
  Sentry.captureException(error);
}
```

### アナリティクス

```typescript
// Firebase Analytics でユーザー行動を追跡
import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

logEvent(analytics, 'file_processed', {
  action: 'keep',
  file_size: 1024,
});
```

### チェックリスト

- [ ] エラートラッキング（Sentry等）が設定されている
- [ ] アナリティクス（Firebase等）が設定されている
- [ ] ログが定期的に確認されている
- [ ] セキュリティアラートが監視されている

---

## 最終確認

### デプロイ前の最終チェック

- [ ] すべてのセキュリティチェックリストに合格している
- [ ] コードレビューが完了している
- [ ] セキュリティテストが完了している
- [ ] 本番環境での動作確認が完了している
- [ ] ロールバック計画が準備されている

### デプロイ後の確認

- [ ] アプリが Google Play Store で公開されている
- [ ] ユーザーレビューを監視している
- [ ] エラーログを監視している
- [ ] セキュリティアラートを監視している

---

## 参考資料

- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
- [Android セキュリティベストプラクティス](https://developer.android.com/training/articles/security-tips)
- [Google Play Console セキュリティガイド](https://support.google.com/googleplay/android-developer/answer/9859455)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

---

## サポート

セキュリティに関する質問や懸念事項がある場合は、以下にお問い合わせください。

- **メール**: security@manus.ai
- **GitHub Issues**: https://github.com/manus-ai/pdf-flick/security/advisories

