# Cocotama-search

ここたま検索 + ここたま占い（Vercel Functions）対応版です。

## 追加機能: ここたま占い

- `Xでログイン` で OAuth 2.0 (PKCE) 認証
- `/api/auth/me` でログイン状態取得
- `/api/fortune/generate` で X プロフィール + CSV ルールを使って占い生成
- AI 生成が失敗した場合は CSV スコアを使った決定論テンプレートにフォールバック

## 必要な環境変数

`.env.example` をコピーして `.env` を作成してください。

- `APP_BASE_URL` 例: `http://localhost:3000`
- `SESSION_SECRET` セッション署名用の十分長いランダム文字列
- `X_CLIENT_ID`
- `X_CLIENT_SECRET` (必要なアプリ設定の場合)
- `X_REDIRECT_URI` 例: `http://localhost:3000/api/auth/x/callback`
- `X_SCOPES` 既定値: `users.read`
- `GEMINI_API_KEY` (AI 占い生成用)
- `GEMINI_MODEL` (任意、既定: `gemini-1.5-flash`)

## X Developer App 設定

X Developer Portal の OAuth 設定で以下を設定してください。

- Callback URL: `X_REDIRECT_URI` と同じ値
- App permissions: `users.read` を含む権限
- OAuth 2.0 有効化

## ローカル実行 (Vercel Functions)

1. 依存関係をインストール
   ```bash
   npm install -g vercel
   ```
2. 開発サーバー起動
   ```bash
   vercel dev
   ```
3. ブラウザで `http://localhost:3000` を開く

## API エンドポイント

- `GET /api/auth/x/start`:
  - state + PKCE 情報を生成し X 認証画面へリダイレクト
- `GET /api/auth/x/callback`:
  - state 検証 / トークン交換 / セッション cookie 保存
- `GET /api/auth/me`:
  - ログイン状態と基本ユーザー情報を返す
- `POST /api/fortune/generate`:
  - 認証必須
  - X プロフィール取得 + `data/fortune_rules.csv` とのマッチング
  - AI 生成 (失敗時はテンプレート占い)

## ルールCSV

- `data/fortune_rules.csv`
- カラム: `keyword,category,score,hint`
- 不正行は安全な既定値で吸収し、処理継続します。

## 制限事項

- AI 出力品質はプロフィール内容に依存します。
- `GEMINI_API_KEY` 未設定時は常にテンプレート占いになります。
