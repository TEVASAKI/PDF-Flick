# PDF Flick - API セキュリティガイド

**対象**: バックエンド API の実装とセキュアな通信  
**作成日**: 2026年3月2日

---

## 目次

1. [API セキュリティの概要](#api-セキュリティの概要)
2. [APIキー管理](#apiキー管理)
3. [HTTPS 通信](#https-通信)
4. [レート制限](#レート制限)
5. [入力検証](#入力検証)
6. [エラーハンドリング](#エラーハンドリング)
7. [ログとモニタリング](#ログとモニタリング)

---

## API セキュリティの概要

### 現在の実装状況

**PDF Flick v1.0.0** は、外部 API を使用していません。

### 将来の API 実装時の要件

以下の機能を追加する場合は、API セキュリティが必須です。

- クラウドバックアップ
- 複数デバイス同期
- ユーザー認証
- ファイル共有

### セキュリティ原則

1. **最小権限の原則**: 必要最小限の権限のみを付与
2. **防御的プログラミング**: すべての入力を検証
3. **ロギング**: すべての API アクセスをログ
4. **監視**: セキュリティアラートを監視

---

## APIキー管理

### ❌ 避けるべき実装

```typescript
// ❌ ハードコード（絶対禁止）
const API_KEY = "sk-1234567890abcdef";

// ❌ コメント内に記述（絶対禁止）
// API_KEY = "sk-1234567890abcdef"

// ❌ Git にコミット（絶対禁止）
// .env ファイルを Git にコミット
```

### ✅ 推奨される実装

```typescript
// ✅ 環境変数から読み込み
const API_KEY = process.env.API_KEY;

// ✅ 実行時に検証
if (!API_KEY) {
  throw new Error('API_KEY is not configured');
}

// ✅ API リクエストで使用
const fetchData = async (endpoint: string) => {
  const response = await fetch(`https://api.example.com${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  return response.json();
};
```

### APIキーの生成と管理

#### APIキーの生成

```bash
# OpenSSL でランダムなキーを生成
openssl rand -hex 32

# 出力例:
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

#### APIキーのローテーション

```typescript
// 古いキーを無効化して、新しいキーを有効化
const rotateAPIKey = async () => {
  // 1. 新しいキーを生成
  const newKey = generateNewKey();

  // 2. 新しいキーを有効化
  await enableAPIKey(newKey);

  // 3. 古いキーを無効化（24 時間後）
  setTimeout(() => {
    disableAPIKey(oldKey);
  }, 24 * 60 * 60 * 1000);
};
```

### APIキーのスコープ制限

```typescript
// API キーに権限を制限
interface APIKeyScope {
  read: boolean;
  write: boolean;
  delete: boolean;
  admin: boolean;
}

const createAPIKey = async (scopes: APIKeyScope) => {
  const response = await fetch('https://api.example.com/keys', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scopes,
      expiresIn: 365 * 24 * 60 * 60, // 1 年
    }),
  });

  return await response.json();
};
```

### チェックリスト

- [ ] API キーが **環境変数**で管理されている
- [ ] API キーが **コード内にハードコードされていない**
- [ ] API キーが **Git にコミットされていない**
- [ ] API キーに **スコープ制限**が設定されている
- [ ] API キーに **有効期限**が設定されている
- [ ] API キーが **定期的にローテーション**されている

---

## HTTPS 通信

### HTTPS の強制

```typescript
// ❌ HTTP を使用しない
const response = await fetch('http://api.example.com/data');

// ✅ HTTPS を使用
const response = await fetch('https://api.example.com/data');
```

### SSL/TLS 証明書の検証

```typescript
// React Native では、デフォルトで SSL/TLS 証明書が検証されます
const response = await fetch('https://api.example.com/data', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  // SSL/TLS 証明書の検証は自動的に行われます
});

// ⚠️ 証明書検証を無効化することは絶対に避けてください
// 以下のコードは使用しないでください：
// fetch(url, { rejectUnauthorized: false })
```

### TLS バージョンの確認

```bash
# サーバーの TLS バージョンを確認
openssl s_client -connect api.example.com:443 -tls1_2

# TLS 1.3 を使用
openssl s_client -connect api.example.com:443 -tls1_3
```

### チェックリスト

- [ ] すべての API 通信が **HTTPS** である
- [ ] SSL/TLS 証明書が **検証**されている
- [ ] TLS バージョンが **1.2 以上**である
- [ ] 自己署名証明書を使用していない（本番環境）

---

## レート制限

### サーバー側でのレート制限

```typescript
// Express.js でのレート制限の実装例
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分
  max: 100, // 15 分間に最大 100 リクエスト
  message: 'Too many requests, please try again later.',
  standardHeaders: true, // RateLimit-* ヘッダーを返す
  legacyHeaders: false, // X-RateLimit-* ヘッダーを無効化
});

app.use('/api/', limiter);
```

### クライアント側での対応

```typescript
// レート制限エラーを処理
const fetchWithRateLimit = async (url: string) => {
  try {
    const response = await fetch(url);

    if (response.status === 429) {
      // レート制限エラー
      const retryAfter = response.headers.get('Retry-After');
      console.warn(`Rate limited. Retry after ${retryAfter} seconds`);

      // 指定時間後に再試行
      await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
      return fetchWithRateLimit(url);
    }

    return response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
};
```

### チェックリスト

- [ ] レート制限が **サーバー側**で実装されている
- [ ] レート制限の値が **適切**である
- [ ] クライアント側で **レート制限エラー**を処理している
- [ ] `Retry-After` ヘッダーが **返される**

---

## 入力検証

### クライアント側での検証

```typescript
// 入力値の検証
const validateInput = (input: string): boolean => {
  // 空文字列をチェック
  if (!input || input.trim().length === 0) {
    return false;
  }

  // 長さをチェック
  if (input.length > 1000) {
    return false;
  }

  // 危険な文字をチェック
  const dangerousChars = /[<>\"']/g;
  if (dangerousChars.test(input)) {
    return false;
  }

  return true;
};

// 使用例
const handleInput = (input: string) => {
  if (!validateInput(input)) {
    alert('Invalid input');
    return;
  }

  // 入力を処理
  sendData(input);
};
```

### サーバー側での検証

```typescript
// Express.js でのバリデーション
import { body, validationResult } from 'express-validator';

app.post('/api/backup', [
  body('fileName')
    .trim()
    .isLength({ min: 1, max: 255 })
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Invalid file name'),
  body('fileSize')
    .isInt({ min: 0, max: 1000000000 })
    .withMessage('Invalid file size'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // 検証済みの入力を処理
  const { fileName, fileSize } = req.body;
  // ...
});
```

### SQL インジェクション対策

```typescript
// ❌ SQL インジェクションに脆弱
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ プリペアドステートメントを使用
const query = 'SELECT * FROM users WHERE email = ?';
const result = await db.query(query, [email]);
```

### チェックリスト

- [ ] クライアント側で **入力検証**が実装されている
- [ ] サーバー側で **入力検証**が実装されている
- [ ] **SQL インジェクション**対策が実装されている
- [ ] **XSS（クロスサイトスクリプティング）**対策が実装されている

---

## エラーハンドリング

### セキュアなエラーメッセージ

```typescript
// ❌ 詳細なエラー情報を返さない
const response = {
  error: 'Database connection failed at 192.168.1.1:5432',
};

// ✅ 一般的なエラーメッセージを返す
const response = {
  error: 'An error occurred. Please try again later.',
};
```

### エラーログの記録

```typescript
// エラーログを記録（詳細情報を含む）
const logError = (error: Error, context: any) => {
  console.error({
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    context,
  });

  // Sentry にエラーを送信
  Sentry.captureException(error, { extra: context });
};

// 使用例
try {
  const data = await fetchData();
} catch (error) {
  logError(error, { endpoint: '/api/data', userId: user.id });
  res.status(500).json({ error: 'An error occurred' });
}
```

### チェックリスト

- [ ] エラーメッセージが **一般的**である
- [ ] 詳細なエラー情報が **ログに記録**されている
- [ ] エラーが **監視**されている（Sentry等）

---

## ログとモニタリング

### API アクセスログ

```typescript
// Express.js でのログ記録
import morgan from 'morgan';

// カスタムログフォーマット
morgan.token('user-id', (req) => req.user?.id || 'anonymous');

app.use(morgan(':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
```

### セキュリティイベントの監視

```typescript
// セキュリティイベントを監視
const monitorSecurityEvent = (event: string, details: any) => {
  console.warn({
    timestamp: new Date().toISOString(),
    event,
    details,
  });

  // アラートを送信
  if (event === 'unauthorized_access' || event === 'rate_limit_exceeded') {
    sendSecurityAlert(event, details);
  }
};

// 使用例
if (apiKey !== expectedKey) {
  monitorSecurityEvent('unauthorized_access', {
    ip: req.ip,
    endpoint: req.url,
    apiKey: apiKey.substring(0, 10) + '***',
  });
}
```

### チェックリスト

- [ ] API アクセスが **ログに記録**されている
- [ ] セキュリティイベントが **監視**されている
- [ ] ログが **定期的に確認**されている
- [ ] アラートが **設定**されている

---

## セキュリティテスト

### OWASP ZAP でのテスト

```bash
# OWASP ZAP をダウンロード
# https://www.zaproxy.org/download/

# API をスキャン
zaproxy -cmd -quickurl https://api.example.com -quickout report.html
```

### Postman でのセキュリティテスト

```javascript
// Postman テスト例
pm.test("Response should not contain sensitive data", function () {
  pm.expect(pm.response.text()).not.to.include("password");
  pm.expect(pm.response.text()).not.to.include("api_key");
  pm.expect(pm.response.text()).not.to.include("secret");
});

pm.test("Response should have security headers", function () {
  pm.expect(pm.response.headers.get("X-Content-Type-Options")).to.equal("nosniff");
  pm.expect(pm.response.headers.get("X-Frame-Options")).to.equal("DENY");
});
```

### チェックリスト

- [ ] OWASP ZAP でテスト済み
- [ ] Postman でセキュリティテスト済み
- [ ] 脆弱性が修正されている

---

## セキュリティヘッダー

### 推奨されるセキュリティヘッダー

```typescript
// Express.js でのセキュリティヘッダー設定
import helmet from 'helmet';

app.use(helmet());

// カスタムヘッダー
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

### チェックリスト

- [ ] `X-Content-Type-Options: nosniff` が設定されている
- [ ] `X-Frame-Options: DENY` が設定されている
- [ ] `X-XSS-Protection: 1; mode=block` が設定されている
- [ ] `Strict-Transport-Security` が設定されている
- [ ] `Content-Security-Policy` が設定されている

---

## 参考資料

- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [API Security Checklist](https://github.com/shieldfy/API-Security-Checklist)
- [Helmet.js ドキュメント](https://helmetjs.github.io/)
- [Express.js セキュリティベストプラクティス](https://expressjs.com/en/advanced/best-practice-security.html)

