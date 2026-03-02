# PDF Flick - アクセス制御ガイド

**対象**: バックエンド実装時のアクセス制御とセキュリティ  
**作成日**: 2026年3月2日

---

## 目次

1. [アクセス制御の概要](#アクセス制御の概要)
2. [ロールベース制御（RBAC）](#ロールベース制御rbac)
3. [IP 制限](#ip-制限)
4. [Firebase Security Rules](#firebase-security-rules)
5. [Cloud Armor](#cloud-armor)
6. [DDoS 対策](#ddos-対策)
7. [監査ログ](#監査ログ)

---

## アクセス制御の概要

### 現在の実装状況

**PDF Flick v1.0.0** は、ローカルアプリのため外部アクセスはありません。

### 将来のサーバー実装時の要件

以下の機能を追加する場合は、アクセス制御が必須です。

- バックエンドサーバー
- クラウドストレージ
- ユーザー認証

### セキュリティ原則

1. **最小権限の原則**: 必要最小限の権限のみを付与
2. **ホワイトリスト方式**: デフォルトで拒否、許可するアクセスのみ許可
3. **監査**: すべてのアクセスをログ
4. **定期的な見直し**: アクセス権限を定期的に見直し

---

## ロールベース制御（RBAC）

### ロールの定義

```typescript
// ロール定義
enum Role {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
  GUEST = 'guest',
}

// ロール別の権限
const rolePermissions: Record<Role, string[]> = {
  [Role.ADMIN]: [
    'read',
    'write',
    'delete',
    'manage_users',
    'manage_backups',
    'view_logs',
  ],
  [Role.MODERATOR]: [
    'read',
    'write',
    'delete',
    'manage_backups',
  ],
  [Role.USER]: [
    'read',
    'write',
    'write_own',
  ],
  [Role.GUEST]: [
    'read',
  ],
};
```

### ユーザー定義

```typescript
interface User {
  id: string;
  email: string;
  role: Role;
  permissions?: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 権限チェック

```typescript
// 権限を確認
const checkPermission = (user: User, action: string): boolean => {
  const permissions = rolePermissions[user.role] || [];
  return permissions.includes(action);
};

// 使用例
if (!checkPermission(user, 'delete')) {
  throw new Error('Unauthorized: You do not have permission to delete');
}
```

### ミドルウェア実装

```typescript
// Express.js でのミドルウェア
const requirePermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User;

    if (!checkPermission(user, requiredPermission)) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to access this resource',
      });
    }

    next();
  };
};

// 使用例
app.delete('/api/files/:id', requirePermission('delete'), (req, res) => {
  // ファイル削除処理
});
```

### チェックリスト

- [ ] ロールが **明確に定義**されている
- [ ] 権限が **ロール別に定義**されている
- [ ] 権限チェックが **実装**されている
- [ ] ミドルウェアが **すべてのエンドポイント**に適用されている

---

## IP 制限

### ホワイトリスト方式

```typescript
// IP ホワイトリスト
const ipWhitelist = [
  '203.0.113.0/24',    // 本社ネットワーク
  '198.51.100.0/24',   // リモートオフィス
  '192.0.2.1',         // VPN ゲートウェイ
];

// IP アドレスをチェック
const isIPAllowed = (ip: string): boolean => {
  return ipWhitelist.some(range => isIPInRange(ip, range));
};

// CIDR 表記で IP 範囲をチェック
const isIPInRange = (ip: string, cidr: string): boolean => {
  const [network, prefix] = cidr.split('/');
  const networkBits = ipToNumber(network);
  const ipBits = ipToNumber(ip);
  const mask = -1 << (32 - parseInt(prefix));

  return (networkBits & mask) === (ipBits & mask);
};

// IP アドレスを数値に変換
const ipToNumber = (ip: string): number => {
  const parts = ip.split('.');
  return parts.reduce((acc, part, i) => {
    return acc + (parseInt(part) << (8 * (3 - i)));
  }, 0);
};
```

### ミドルウェア実装

```typescript
// Express.js でのミドルウェア
const requireWhitelistedIP = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress;

  if (!isIPAllowed(clientIP)) {
    return res.status(403).json({
      error: 'Forbidden: Your IP address is not allowed to access this resource',
    });
  }

  next();
};

// 使用例
app.use('/api/admin', requireWhitelistedIP);
```

### チェックリスト

- [ ] IP ホワイトリストが **定義**されている
- [ ] IP チェックが **実装**されている
- [ ] ミドルウェアが **適用**されている
- [ ] ホワイトリストが **定期的に見直し**されている

---

## Firebase Security Rules

### Firestore セキュリティルール

```typescript
// Firebase Firestore のセキュリティルール
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザードキュメント
    match /users/{userId} {
      // ユーザーは自分のドキュメントのみ読み書き可能
      allow read, write: if request.auth.uid == userId;
    }

    // バックアップドキュメント
    match /backups/{backupId} {
      // ユーザーは自分のバックアップのみ読み書き可能
      allow read, write: if request.auth.uid == resource.data.userId;
      
      // 削除は所有者のみ
      allow delete: if request.auth.uid == resource.data.userId;
    }

    // 共有ファイル
    match /shared/{fileId} {
      // 所有者は読み書き削除可能
      allow read, write, delete: if request.auth.uid == resource.data.ownerId;
      
      // 共有されたユーザーは読み取り可能
      allow read: if request.auth.uid in resource.data.sharedWith;
    }

    // ログドキュメント（管理者のみ）
    match /logs/{logId} {
      allow read: if request.auth.token.isAdmin == true;
      allow write: if false; // ログは自動生成のみ
    }
  }
}
```

### リアルタイムデータベース（Realtime Database）

```typescript
// Firebase Realtime Database のセキュリティルール
{
  "rules": {
    "users": {
      "$uid": {
        // ユーザーは自分のデータのみ読み書き可能
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        
        "profile": {
          ".validate": "newData.hasChildren(['name', 'email'])"
        }
      }
    },
    
    "backups": {
      "$backupId": {
        // ユーザーは自分のバックアップのみ読み書き可能
        ".read": "data.child('userId').val() === auth.uid",
        ".write": "newData.child('userId').val() === auth.uid",
        
        ".validate": "newData.hasChildren(['userId', 'fileName', 'createdAt'])"
      }
    }
  }
}
```

### チェックリスト

- [ ] Firestore セキュリティルールが **定義**されている
- [ ] ユーザーは **自分のデータのみ**アクセス可能
- [ ] 管理者は **すべてのデータ**にアクセス可能
- [ ] ルールが **テスト**されている

---

## Cloud Armor

### Google Cloud での実装

```yaml
# Cloud Armor ポリシー
name: pdf-flick-armor-policy
description: "Security policy for PDF Flick API"

rules:
  # ルール 1: 特定の国からのアクセスをブロック
  - priority: 1000
    description: "Block traffic from high-risk countries"
    match:
      versionedExpr: "CLOUD_ARMOR"
      expr:
        expression: "origin.region_code == 'CN' || origin.region_code == 'RU'"
    action: "deny(403)"

  # ルール 2: レート制限
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
      banDurationSec: 600

  # ルール 3: SQL インジェクション対策
  - priority: 3000
    description: "SQL injection protection"
    match:
      versionedExpr: "CLOUD_ARMOR"
      expr:
        expression: "evaluatePreconfiguredExpr('sqli-v33-stable')"
    action: "deny(403)"

  # ルール 4: XSS 対策
  - priority: 4000
    description: "XSS protection"
    match:
      versionedExpr: "CLOUD_ARMOR"
      expr:
        expression: "evaluatePreconfiguredExpr('xss-v33-stable')"
    action: "deny(403)"

  # ルール 5: すべてのトラフィックを許可
  - priority: 65535
    description: "Default rule"
    match:
      versionedExpr: "CLOUD_ARMOR"
      expr:
        expression: "true"
    action: "allow"
```

### デプロイ

```bash
# Cloud Armor ポリシーをデプロイ
gcloud compute security-policies create pdf-flick-policy \
  --description="Security policy for PDF Flick API"

# ルールを追加
gcloud compute security-policies rules create 1000 \
  --security-policy=pdf-flick-policy \
  --action=deny-403 \
  --expression="origin.region_code == 'CN'"

# バックエンドサービスに適用
gcloud compute backend-services update pdf-flick-backend \
  --security-policy=pdf-flick-policy
```

### チェックリスト

- [ ] Cloud Armor ポリシーが **定義**されている
- [ ] レート制限が **設定**されている
- [ ] SQL インジェクション対策が **有効**
- [ ] XSS 対策が **有効**

---

## DDoS 対策

### Google Cloud DDoS Protection

```bash
# DDoS Protection を有効化
gcloud compute security-policies update pdf-flick-policy \
  --enable-layer7-ddos-defense
```

### レート制限の設定

```typescript
// Express.js でのレート制限
import rateLimit from 'express-rate-limit';

// グローバルレート制限
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分
  max: 1000, // 15 分間に最大 1000 リクエスト
  message: 'Too many requests from this IP, please try again later.',
});

// API エンドポイント別レート制限
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 15 分間に最大 100 リクエスト
  skip: (req) => req.user?.role === 'admin', // 管理者は制限なし
});

// 認証エンドポイント別レート制限（厳しい）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 15 分間に最大 5 リクエスト
  skipSuccessfulRequests: true, // 成功時はカウントしない
});

app.use(globalLimiter);
app.use('/api/', apiLimiter);
app.post('/auth/login', authLimiter, (req, res) => {
  // ログイン処理
});
```

### チェックリスト

- [ ] DDoS Protection が **有効**
- [ ] レート制限が **設定**されている
- [ ] 認証エンドポイントに **厳しいレート制限**が設定されている

---

## 監査ログ

### ログの記録

```typescript
// 監査ログの記録
interface AuditLog {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  status: 'success' | 'failure';
  details: any;
  ip: string;
  userAgent: string;
}

const recordAuditLog = async (log: AuditLog) => {
  // Firestore に記録
  await db.collection('audit_logs').add({
    ...log,
    timestamp: new Date(),
  });

  // ログファイルに記録
  console.log(JSON.stringify(log));
};

// 使用例
await recordAuditLog({
  timestamp: new Date(),
  userId: user.id,
  action: 'delete_file',
  resource: `files/${fileId}`,
  status: 'success',
  details: { fileName: 'document.pdf' },
  ip: req.ip,
  userAgent: req.get('user-agent'),
});
```

### ログの監視

```typescript
// セキュリティイベントを監視
const monitorSecurityEvent = async (log: AuditLog) => {
  // 失敗したアクション
  if (log.status === 'failure') {
    console.warn('Failed action:', log);
  }

  // 不正なアクセス
  if (log.action === 'unauthorized_access') {
    sendSecurityAlert(log);
  }

  // 大量のリクエスト
  const recentLogs = await db
    .collection('audit_logs')
    .where('ip', '==', log.ip)
    .where('timestamp', '>', new Date(Date.now() - 60000))
    .get();

  if (recentLogs.size > 100) {
    sendSecurityAlert({
      type: 'suspicious_activity',
      ip: log.ip,
      requestCount: recentLogs.size,
    });
  }
};
```

### チェックリスト

- [ ] すべてのアクションが **ログに記録**されている
- [ ] ログが **安全に保存**されている
- [ ] セキュリティイベントが **監視**されている
- [ ] ログが **定期的に確認**されている

---

## セキュリティテスト

### 侵入テスト

```bash
# OWASP ZAP でテスト
zaproxy -cmd -quickurl https://api.example.com -quickout report.html

# Burp Suite でテスト
# https://portswigger.net/burp
```

### アクセス制御テスト

```typescript
// Postman でのテスト例
// テスト 1: 認証なしでアクセス
pm.test("Unauthenticated request should be denied", function () {
  pm.expect(pm.response.code).to.equal(401);
});

// テスト 2: 権限なしでアクセス
pm.test("Unauthorized request should be denied", function () {
  pm.expect(pm.response.code).to.equal(403);
});

// テスト 3: 他のユーザーのデータにアクセス
pm.test("User should not access other user's data", function () {
  pm.expect(pm.response.code).to.equal(403);
});
```

### チェックリスト

- [ ] 侵入テストが **実施**されている
- [ ] アクセス制御テストが **実施**されている
- [ ] 脆弱性が **修正**されている

---

## 参考資料

- [OWASP Access Control](https://owasp.org/www-community/Access_Control)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Google Cloud Armor](https://cloud.google.com/armor)
- [Cloud IAM](https://cloud.google.com/iam)

