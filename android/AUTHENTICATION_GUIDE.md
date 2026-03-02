# PDF Flick - 認証・認可実装ガイド

**対象**: クラウド機能を追加する際の認証・認可実装  
**推奨方法**: Manus OAuth 統合  
**作成日**: 2026年3月2日

---

## 目次

1. [認証・認可の概要](#認証認可の概要)
2. [Manus OAuth 統合](#manus-oauth-統合)
3. [JWT トークン管理](#jwt-トークン管理)
4. [セキュアなパスワード管理](#セキュアなパスワード管理)
5. [セッション管理](#セッション管理)
6. [多要素認証（MFA）](#多要素認証mfa)
7. [セキュリティベストプラクティス](#セキュリティベストプラクティス)

---

## 認証・認可の概要

### 認証（Authentication）vs 認可（Authorization）

| 項目 | 説明 | 例 |
|------|------|-----|
| **認証** | ユーザーが本人であることを確認 | ログイン、パスワード検証 |
| **認可** | 認証されたユーザーが何ができるかを制御 | ファイル削除権限、管理者権限 |

### PDF Flick での実装

**v1.0.0**: ローカルアプリのため不要

**v1.1 以降**: クラウド機能追加時に実装

---

## Manus OAuth 統合

### 概要

Manus は、ワンクリックで OAuth 認証を統合できるプラットフォームです。

**メリット:**
- ✅ セキュアな認証
- ✅ 複数のデバイスでログイン可能
- ✅ パスワード管理が不要
- ✅ ユーザーデータが保護される

### セットアップ手順

#### ステップ1: Manus ダッシュボードで OAuth アプリを登録

1. [Manus ダッシュボード](https://manus.ai/dashboard) にログイン
2. **アプリケーション** → **新規アプリケーション**
3. アプリ名: "PDF Flick"
4. リダイレクト URI: `com.manus.pdfflick://oauth-callback`
5. **登録** をクリック

#### ステップ2: クライアント ID とクライアントシークレットを取得

```
Client ID: your-client-id
Client Secret: your-client-secret
```

**⚠️ 重要**: クライアントシークレットは絶対に公開しないでください。

#### ステップ3: 環境変数に設定

```powershell
# Windows PowerShell
[Environment]::SetEnvironmentVariable("MANUS_CLIENT_ID", "your-client-id", "User")
[Environment]::SetEnvironmentVariable("MANUS_CLIENT_SECRET", "your-client-secret", "User")
```

### 実装例

#### ログイン画面

```typescript
import React, { useState } from 'react';
import { View, Button, Text, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

const MANUS_CLIENT_ID = process.env.MANUS_CLIENT_ID;
const MANUS_OAUTH_URL = 'https://oauth.manus.ai/authorize';
const MANUS_TOKEN_URL = 'https://oauth.manus.ai/token';

export default function LoginScreen({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);

      // OAuth フローを開始
      const result = await WebBrowser.openAuthSessionAsync(
        `${MANUS_OAUTH_URL}?client_id=${MANUS_CLIENT_ID}&response_type=code&redirect_uri=com.manus.pdfflick://oauth-callback`,
        'com.manus.pdfflick://oauth-callback'
      );

      if (result.type === 'success') {
        const { url } = result;
        const authCode = new URL(url).searchParams.get('code');

        // トークンを交換
        const tokenResponse = await fetch(MANUS_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code: authCode,
            client_id: MANUS_CLIENT_ID,
            client_secret: process.env.MANUS_CLIENT_SECRET,
            redirect_uri: 'com.manus.pdfflick://oauth-callback',
          }),
        });

        const tokenData = await tokenResponse.json();

        // トークンを安全に保存
        await SecureStore.setItemAsync('access_token', tokenData.access_token);
        await SecureStore.setItemAsync('refresh_token', tokenData.refresh_token);

        onLoginSuccess();
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          <Text style={{ fontSize: 24, marginBottom: 20 }}>PDF Flick</Text>
          <Button title="Manus でログイン" onPress={handleLogin} />
        </>
      )}
    </View>
  );
}
```

#### ユーザー情報の取得

```typescript
import * as SecureStore from 'expo-secure-store';

const getUserInfo = async () => {
  try {
    const accessToken = await SecureStore.getItemAsync('access_token');

    const response = await fetch('https://api.manus.ai/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      // トークンが期限切れ、リフレッシュ
      await refreshToken();
      return getUserInfo();
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get user info:', error);
    throw error;
  }
};
```

#### ログアウト

```typescript
const handleLogout = async () => {
  try {
    const accessToken = await SecureStore.getItemAsync('access_token');

    // ログアウト API を呼び出し
    await fetch('https://api.manus.ai/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // トークンを削除
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');

    // ログイン画面に戻る
    onLogout();
  } catch (error) {
    console.error('Logout failed:', error);
  }
};
```

---

## JWT トークン管理

### JWT の構造

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**構成:**
1. **ヘッダー**: アルゴリズム、トークンタイプ
2. **ペイロード**: ユーザー情報、権限
3. **署名**: トークンの整合性を確認

### トークンの検証

```typescript
import * as SecureStore from 'expo-secure-store';
import jwtDecode from 'jwt-decode';

const validateToken = async () => {
  try {
    const accessToken = await SecureStore.getItemAsync('access_token');

    if (!accessToken) {
      return false;
    }

    // トークンをデコード
    const decoded = jwtDecode(accessToken);

    // 有効期限を確認
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      // トークンが期限切れ
      return false;
    }

    return true;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
};
```

### トークンのリフレッシュ

```typescript
const refreshToken = async () => {
  try {
    const refreshToken = await SecureStore.getItemAsync('refresh_token');

    const response = await fetch('https://oauth.manus.ai/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.MANUS_CLIENT_ID,
        client_secret: process.env.MANUS_CLIENT_SECRET,
      }),
    });

    const tokenData = await response.json();

    // 新しいトークンを保存
    await SecureStore.setItemAsync('access_token', tokenData.access_token);

    return tokenData.access_token;
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw error;
  }
};
```

### チェックリスト

- [ ] JWT トークンが `expo-secure-store` で安全に保存されている
- [ ] トークンの有効期限が設定されている（推奨: 1 時間）
- [ ] リフレッシュトークンが安全に管理されている
- [ ] トークンの署名が検証されている

---

## セキュアなパスワード管理

### ❌ 避けるべき実装

```typescript
// ❌ パスワードをプレーンテキストで保存
const savePassword = (password: string) => {
  localStorage.setItem('password', password);
};

// ❌ パスワードをログに出力
console.log('Password:', password);

// ❌ パスワードをメモリに長時間保持
let globalPassword = password;
```

### ✅ 推奨される実装

```typescript
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// ✅ パスワードをハッシュ化して保存
const hashPassword = async (password: string) => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
};

// ✅ パスワードを検証
const verifyPassword = async (password: string, hash: string) => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

// ✅ パスワードを安全に保存
const savePassword = async (password: string) => {
  const hash = await hashPassword(password);
  await SecureStore.setItemAsync('password_hash', hash);
};
```

### パスワードポリシー

```typescript
// パスワード要件
interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

const PASSWORD_POLICY: PasswordRequirements = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

// パスワードの検証
const validatePassword = (password: string): boolean => {
  if (password.length < PASSWORD_POLICY.minLength) return false;
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) return false;
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) return false;
  if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) return false;
  if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*]/.test(password)) return false;
  return true;
};
```

### チェックリスト

- [ ] パスワードがハッシュ化されている
- [ ] パスワードが `expo-secure-store` で保存されている
- [ ] パスワードがログに出力されていない
- [ ] パスワードポリシーが実装されている

---

## セッション管理

### セッションの作成

```typescript
import * as SecureStore from 'expo-secure-store';

interface Session {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: number;
}

const createSession = async (userId: string, accessToken: string, refreshToken: string) => {
  const session: Session = {
    userId,
    accessToken,
    refreshToken,
    expiresAt: Date.now() + 3600000, // 1 時間後
    createdAt: Date.now(),
  };

  await SecureStore.setItemAsync('session', JSON.stringify(session));
};
```

### セッションの検証

```typescript
const validateSession = async (): Promise<boolean> => {
  try {
    const sessionData = await SecureStore.getItemAsync('session');

    if (!sessionData) {
      return false;
    }

    const session: Session = JSON.parse(sessionData);

    // セッションの有効期限を確認
    if (session.expiresAt < Date.now()) {
      // セッションが期限切れ
      await SecureStore.deleteItemAsync('session');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Session validation failed:', error);
    return false;
  }
};
```

### セッションの終了

```typescript
const destroySession = async () => {
  try {
    // セッションを削除
    await SecureStore.deleteItemAsync('session');
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
  } catch (error) {
    console.error('Session destruction failed:', error);
  }
};
```

### チェックリスト

- [ ] セッションが安全に作成されている
- [ ] セッションの有効期限が設定されている
- [ ] セッションが定期的に検証されている
- [ ] セッションが安全に終了されている

---

## 多要素認証（MFA）

### SMS ベースの MFA

```typescript
// SMS コード送信
const sendSMSCode = async (phoneNumber: string) => {
  const response = await fetch('https://api.manus.ai/mfa/send-sms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ phoneNumber }),
  });

  return await response.json();
};

// SMS コード検証
const verifySMSCode = async (phoneNumber: string, code: string) => {
  const response = await fetch('https://api.manus.ai/mfa/verify-sms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ phoneNumber, code }),
  });

  return await response.json();
};
```

### TOTP（Time-based One-Time Password）ベースの MFA

```typescript
import * as SecureStore from 'expo-secure-store';

// TOTP シークレットを生成
const generateTOTPSecret = async () => {
  const response = await fetch('https://api.manus.ai/mfa/generate-totp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const { secret, qrCode } = await response.json();

  // シークレットを安全に保存
  await SecureStore.setItemAsync('totp_secret', secret);

  return { secret, qrCode };
};

// TOTP コード検証
const verifyTOTPCode = async (code: string) => {
  const response = await fetch('https://api.manus.ai/mfa/verify-totp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ code }),
  });

  return await response.json();
};
```

### チェックリスト

- [ ] MFA が実装されている（推奨）
- [ ] SMS または TOTP が使用されている
- [ ] バックアップコードが生成されている
- [ ] MFA の有効化がユーザーに通知されている

---

## セキュリティベストプラクティス

### ✅ 推奨事項

1. **Manus OAuth を使用**
   - パスワード管理が不要
   - セキュアな認証
   - ユーザーデータが保護される

2. **JWT トークンを安全に管理**
   - `expo-secure-store` で保存
   - 有効期限を設定
   - リフレッシュトークンを使用

3. **HTTPS 通信を強制**
   - すべての API 通信は HTTPS
   - SSL/TLS 証明書を検証

4. **セッション管理を実装**
   - セッションの有効期限を設定
   - セッションを定期的に検証
   - ログアウト時にセッションを削除

5. **多要素認証を有効化**
   - SMS または TOTP
   - バックアップコードを生成

### ❌ 避けるべき行為

- ✗ パスワードをプレーンテキストで保存
- ✗ API キーをコード内にハードコード
- ✗ HTTP 通信を使用
- ✗ SSL/TLS 証明書の検証を無効化
- ✗ トークンをローカルストレージに保存
- ✗ 弱いパスワードポリシー

---

## 参考資料

- [Manus OAuth ドキュメント](https://docs.manus.ai/oauth)
- [JWT.io](https://jwt.io/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [expo-secure-store ドキュメント](https://docs.expo.dev/versions/latest/sdk/securestore/)

