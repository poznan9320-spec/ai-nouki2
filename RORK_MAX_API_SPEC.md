# AI納期 - RORK MAX モバイルアプリ API仕様書

**Base URL:** `https://ai-nouki2.vercel.app/api/mobile`
**認証方式:** Bearer Token (JWT)
**Content-Type:** `application/json`

---

## 認証フロー

### 1. 会社登録 (初回のみ)
```
POST /api/mobile/register
```
**Body:**
```json
{
  "companyName": "株式会社サンプル",
  "email": "admin@sample.co.jp",
  "password": "password123",
  "name": "管理者名"
}
```
**Response 201:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx...",
    "email": "admin@sample.co.jp",
    "name": "管理者名",
    "role": "ADMIN",
    "companyId": "clx..."
  }
}
```

---

### 2. ログイン
```
POST /api/mobile/login
```
**Body:**
```json
{
  "email": "user@sample.co.jp",
  "password": "password123"
}
```
**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx...",
    "email": "user@sample.co.jp",
    "name": "田中太郎",
    "role": "EMPLOYEE",
    "companyId": "clx..."
  }
}
```

---

### 3. 従業員登録 (ADMIN のみ)
```
POST /api/mobile/register-employee
Authorization: Bearer {token}
```
**Body:**
```json
{
  "email": "employee@sample.co.jp",
  "password": "password123",
  "name": "田中太郎"
}
```
**Response 201:**
```json
{
  "user": {
    "id": "clx...",
    "email": "employee@sample.co.jp",
    "name": "田中太郎",
    "role": "EMPLOYEE"
  }
}
```

---

### 4. 現在のユーザー情報取得
```
GET /api/auth/me
Authorization: Bearer {token}
```
**Response 200:**
```json
{
  "id": "clx...",
  "email": "user@sample.co.jp",
  "name": "田中太郎",
  "role": "EMPLOYEE",
  "companyId": "clx..."
}
```

---

## 納期管理

### 5. 納期一覧取得
```
GET /api/mobile/deliveries
Authorization: Bearer {token}
```
**Query Parameters (任意):**
- `status` : `PENDING` | `SHIPPED` | `DELIVERED` | `DELAYED` | `CANCELLED`
- `from` : ISO日付 (例: `2026-03-01`)
- `to` : ISO日付 (例: `2026-03-31`)

**Response 200:**
```json
[
  {
    "id": "clx...",
    "productName": "部品A",
    "quantity": 100,
    "deliveryDate": "2026-04-01T00:00:00.000Z",
    "status": "PENDING",
    "sourceType": "MANUAL",
    "sourceUrl": null,
    "notes": "急ぎ",
    "companyId": "clx...",
    "createdAt": "2026-03-25T00:00:00.000Z",
    "updatedAt": "2026-03-25T00:00:00.000Z"
  }
]
```

---

### 6. 納期登録
```
POST /api/mobile/deliveries
Authorization: Bearer {token}
```
**Body:**
```json
{
  "productName": "部品A",
  "quantity": 100,
  "deliveryDate": "2026-04-01",
  "status": "PENDING",
  "sourceType": "MANUAL",
  "notes": "急ぎ"
}
```
**sourceType の値:** `MANUAL` | `CSV` | `IMAGE` | `FAX` | `TEXT`

**Response 201:** 作成された納期オブジェクト

---

### 7. 納期更新 (ADMIN のみ)
```
PUT /api/mobile/deliveries/{id}
Authorization: Bearer {token}
```
**Body (変更したいフィールドのみ):**
```json
{
  "status": "SHIPPED",
  "notes": "出荷済み"
}
```
**Response 200:** 更新された納期オブジェクト

---

### 8. 納期削除 (ADMIN のみ)
```
DELETE /api/mobile/deliveries/{id}
Authorization: Bearer {token}
```
**Response 200:**
```json
{ "success": true }
```

---

### 9. カレンダー表示用データ取得
```
GET /api/mobile/calendar?year=2026&month=4
Authorization: Bearer {token}
```
**Response 200:**
```json
{
  "2026-04-01": [
    {
      "id": "clx...",
      "productName": "部品A",
      "quantity": 100,
      "status": "PENDING"
    }
  ],
  "2026-04-15": [...]
}
```

---

## 発注依頼

### 10. 発注依頼一覧取得
```
GET /api/mobile/request
Authorization: Bearer {token}
```
**Response 200:**
```json
[
  {
    "id": "clx...",
    "productName": "消耗品B",
    "quantity": 50,
    "neededBy": "2026-04-10T00:00:00.000Z",
    "details": "早急にお願いします",
    "requesterId": "clx...",
    "status": "PENDING",
    "adminComment": null,
    "createdAt": "2026-03-25T00:00:00.000Z",
    "requester": {
      "name": "田中太郎",
      "email": "tanaka@sample.co.jp"
    }
  }
]
```

---

### 11. 発注依頼登録
```
POST /api/mobile/request
Authorization: Bearer {token}
```
**Body:**
```json
{
  "productName": "消耗品B",
  "quantity": 50,
  "neededBy": "2026-04-10",
  "details": "早急にお願いします"
}
```
**Response 201:** 作成された発注依頼オブジェクト

---

## チャット

### 12. チャットメッセージ一覧取得
```
GET /api/mobile/chat?room=general
Authorization: Bearer {token}
```
**Query:** `room` (任意、デフォルト `general`)

**Response 200:**
```json
[
  {
    "id": "clx...",
    "content": "こんにちは",
    "senderId": "clx...",
    "chatRoom": "general",
    "fileName": null,
    "fileUrl": null,
    "createdAt": "2026-03-25T10:00:00.000Z",
    "sender": {
      "name": "田中太郎",
      "email": "tanaka@sample.co.jp"
    }
  }
]
```

---

### 13. メッセージ送信
```
POST /api/mobile/chat
Authorization: Bearer {token}
```
**Body:**
```json
{
  "content": "部品Aの納期確認お願いします",
  "chatRoom": "general",
  "fileName": null,
  "fileUrl": null
}
```
**Response 201:** 作成されたメッセージオブジェクト

---

## AI データ取込

### 14. CSV取込
```
POST /api/ingest/csv
Authorization: Bearer {token}
Content-Type: multipart/form-data
```
**Form Data:**
- `file` : CSVファイル

**CSVフォーマット例:**
```
productName,quantity,deliveryDate,status,notes
部品A,100,2026-04-01,PENDING,急ぎ
部品B,50,2026-04-15,PENDING,
```

**Response 200:**
```json
{
  "imported": 2,
  "deliveries": [...]
}
```

---

### 15. 画像・FAX OCR取込
```
POST /api/ingest/ocr
Authorization: Bearer {token}
Content-Type: multipart/form-data
```
**Form Data:**
- `file` : 画像ファイル (JPEG/PNG/PDF)
- `type` : `IMAGE` | `FAX`

**Response 200:**
```json
{
  "extracted": [
    {
      "productName": "部品C",
      "quantity": 200,
      "deliveryDate": "2026-05-01",
      "notes": "AIが抽出したメモ"
    }
  ],
  "saved": 1
}
```

---

### 16. テキスト取込 (AI解析)
```
POST /api/ingest/ocr
Authorization: Bearer {token}
Content-Type: application/json
```
**Body:**
```json
{
  "text": "来月1日までに部品Dを300個納品してください",
  "type": "TEXT"
}
```
**Response 200:**
```json
{
  "extracted": [...],
  "saved": 1
}
```

---

## 通知

### 17. 通知一覧取得
```
GET /api/mobile/notifications
Authorization: Bearer {token}
```
**Response 200:**
```json
[
  {
    "id": "clx...",
    "title": "発注依頼が承認されました",
    "body": "消耗品Bの発注依頼が承認されました",
    "type": "ORDER_STATUS",
    "isRead": false,
    "createdAt": "2026-03-25T10:00:00.000Z"
  }
]
```

---

### 18. 通知を既読にする
```
PATCH /api/mobile/notifications/{id}/read
Authorization: Bearer {token}
```
**Response 200:**
```json
{ "success": true }
```

---

### 19. 全通知を既読にする
```
PATCH /api/mobile/notifications/read-all
Authorization: Bearer {token}
```
**Response 200:**
```json
{ "success": true }
```

---

## ユーザー管理 (ADMIN のみ)

### 20. ユーザー一覧取得
```
GET /api/mobile/users
Authorization: Bearer {token}
```
**Response 200:**
```json
[
  {
    "id": "clx...",
    "email": "user@sample.co.jp",
    "name": "田中太郎",
    "role": "EMPLOYEE",
    "createdAt": "2026-03-25T00:00:00.000Z"
  }
]
```

---

### 21. ユーザーのロール変更
```
PATCH /api/mobile/users/{id}/role
Authorization: Bearer {token}
```
**Body:**
```json
{
  "role": "ADMIN"
}
```
**Response 200:** 更新されたユーザーオブジェクト

---

## 会社情報

### 22. 会社情報取得
```
GET /api/mobile/company
Authorization: Bearer {token}
```
**Response 200:**
```json
{
  "id": "clx...",
  "name": "株式会社サンプル",
  "createdAt": "2026-03-25T00:00:00.000Z",
  "_count": {
    "users": 5,
    "deliveries": 42
  }
}
```

---

## エラーレスポンス共通形式

| ステータス | 説明 |
|-----------|------|
| 400 | バリデーションエラー (必須フィールド不足など) |
| 401 | 認証エラー (トークンなし・無効) |
| 403 | 権限エラー (ADMIN操作をEMPLOYEEが実行) |
| 404 | リソースが見つからない |
| 500 | サーバーエラー |

**エラーBody例:**
```json
{
  "error": "Unauthorized"
}
```

---

## ステータス値一覧

### DeliveryStatus (納期ステータス)
| 値 | 説明 |
|----|------|
| `PENDING` | 未処理 |
| `SHIPPED` | 出荷済み |
| `DELIVERED` | 納品済み |
| `DELAYED` | 遅延 |
| `CANCELLED` | キャンセル |

### OrderStatus (発注依頼ステータス)
| 値 | 説明 |
|----|------|
| `PENDING` | 申請中 |
| `APPROVED` | 承認済み |
| `REJECTED` | 却下 |
| `CANCELLED` | キャンセル |

### NotificationType (通知タイプ)
| 値 | 説明 |
|----|------|
| `CHAT` | チャット通知 |
| `ORDER_STATUS` | 発注依頼ステータス変更 |
| `DELIVERY_UPDATE` | 納期更新 |

---

## 認証トークンの扱い方

1. ログイン成功後、`token` をSecureStorageに保存
2. 全APIリクエストのHeaderに付与: `Authorization: Bearer {token}`
3. 401エラー受信時はログイン画面にリダイレクト
4. トークン有効期限: **7日間**
