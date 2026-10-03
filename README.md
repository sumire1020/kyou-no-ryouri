# 今日の料理

在庫の材料から、OpenAI APIを使って今日の一皿を提案する小さなWebアプリです。

## 公開版の安全設計

- APIキーはブラウザへ送らず、Vercelのサーバー環境変数 `OPENAI_API_KEY` だけで読み込みます
- `.env`、`.env.*`、`.vercel` はGitHubに追加されない設定です
- 利用者の入力は、件数・文字数・リクエスト本文の大きさを制限します
- 同じIPアドレスからの連続したレシピ作成を1分間に6回までに抑えます（Vercelの実行単位での基本的な制限です）
- CSPなどのブラウザ保護ヘッダーを設定します
- APIからの技術的なエラーや秘密情報を画面へ返しません

## Vercelへの公開手順

1. GitHubへこのフォルダを公開します。`.env` は絶対に追加しません。
2. [Vercel](https://vercel.com/) にGitHubアカウントで登録します。
3. VercelでGitHubリポジトリをImportします。
4. **Deployする前に** Project Settings → Environment Variables を開きます。
5. 名前を `OPENAI_API_KEY` にして、ご自身でAPIキーを貼り付けます。Production と Preview を選び、Sensitive（秘密）として保存します。
6. Deploy を押します。環境変数を変更した場合は、必ず再デプロイします。

APIキーはチャット、GitHubの画面、ソースコード、スクリーンショットには貼り付けないでください。もし誤って公開した場合は、OpenAIのダッシュボードでそのキーを直ちに無効化し、新しいキーへ交換してください。

## ローカルでの起動

ローカル版は `.env` に `OPENAI_API_KEY=` を設定してから実行します。

```powershell
npm start
```

`http://localhost:3000` を開いてください。ローカル版は `127.0.0.1` に限定され、同じネットワークの他の端末からはアクセスできません。
