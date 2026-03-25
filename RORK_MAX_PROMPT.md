# RORK MAX 用プロンプト — AI納期モバイルアプリ

以下をそのままRORK MAXに貼り付けてください。

---

## プロンプト本文

```
B2B物流・納期管理システム「AI納期」のモバイルアプリを作成してください。

## アプリ概要
企業の配送・納期をモバイルで管理するアプリです。管理者（ADMIN）と従業員（EMPLOYEE）の2つのロールがあります。

## バックエンドAPI
Base URL: https://ai-nouki2.vercel.app/api/mobile
認証: Bearer Token (JWT) — ログイン後にSecureStorageへ保存し、全APIリクエストのAuthorizationヘッダーに付与

## 画面構成

### 1. ログイン画面
- メールアドレスとパスワードでログイン
- POST /api/mobile/login
- ログイン成功後トークンを保存 → ホーム画面へ遷移

### 2. ホーム（ダッシュボード）
- 今日・今週の納期件数サマリー（PENDING / SHIPPED / DELAYED）
- 未読通知バッジ
- GET /api/mobile/deliveries と GET /api/mobile/notifications から集計

### 3. 納期一覧
- 納期の一覧表示（商品名、数量、納期日、ステータス）
- ステータスでフィルタリング
- スワイプで詳細表示
- GET /api/mobile/deliveries

### 4. 納期登録（ADMIN のみ）
- 商品名、数量、納期日、ステータス、メモを入力して登録
- POST /api/mobile/deliveries

### 5. カレンダー
- 月単位で納期をカレンダー表示
- 日付をタップするとその日の納期一覧
- GET /api/mobile/calendar?year=YYYY&month=M

### 6. 発注依頼
- 一覧表示（商品名、数量、期日、ステータス）
- 新規依頼フォーム（商品名、数量、期日、詳細）
- GET /api/mobile/request
- POST /api/mobile/request

### 7. チャット
- 全社チャット（chatRoom: "general"）
- リアルタイム感のあるUI（送信ボタン・吹き出し表示）
- GET /api/mobile/chat?room=general
- POST /api/mobile/chat

### 8. 通知
- 通知一覧（タイトル・内容・未読バッジ）
- タップで既読
- PATCH /api/mobile/notifications/{id}/read
- GET /api/mobile/notifications

### 9. 設定
- ユーザー情報表示
- ログアウト（SecureStorageのトークン削除）
- ADMIN のみ: 従業員招待（POST /api/mobile/register-employee）
- ADMIN のみ: ユーザー一覧・ロール変更

## AIデータ取込（ADMIN のみ）
- CSV取込: ファイルピッカーで選択 → POST /api/ingest/csv (multipart/form-data)
- 画像取込: カメラまたはライブラリから選択 → POST /api/ingest/ocr (type: IMAGE)
- テキスト取込: 自由テキスト入力 → POST /api/ingest/ocr (JSON body, type: TEXT)

## ステータスの色分け
- PENDING: グレー
- SHIPPED: 青
- DELIVERED: 緑
- DELAYED: 赤
- CANCELLED: 薄いグレー

## 技術要件
- React Native (Expo) または Rork標準
- SecureStore でJWTトークンを管理
- 日本語UI
- ダークモード対応推奨
- 日付表示は日本語形式（例: 2026年4月1日）

## APIエラー処理
- 401 → ログイン画面へリダイレクト
- 403 → 「権限がありません」トースト表示
- その他エラー → エラーメッセージをトーストで表示
```
