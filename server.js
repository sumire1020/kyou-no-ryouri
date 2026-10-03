const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = process.env.PORT || 3000;

// .env はローカル専用の秘密情報です。読み込みのみ行い、値を出力・返却・記録しません。
function readDotEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap(line => {
    const text = line.trim();
    if (!text || text.startsWith('#')) return [];
    const index = text.indexOf('=');
    if (index < 1) return [];
    return [[text.slice(0, index).trim(), text.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]];
  }));
}
const localEnv = readDotEnv(path.join(root, '.env'));

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    return send(res, 200, fs.readFileSync(path.join(root, 'index.html')), 'text/html; charset=utf-8');
  }
  if (req.method !== 'POST' || req.url !== '/api/menu') return send(res, 404, { error: 'Not found' });

  const key = process.env.OPENAI_API_KEY || localEnv.OPENAI_API_KEY;
  if (!key) return send(res, 400, { error: 'OPENAI_API_KEY が設定されていません。' });
  let raw = '';
  req.on('data', chunk => { raw += chunk; if (raw.length > 30000) req.destroy(); });
  req.on('end', async () => {
    try {
      const { ingredients = [], servings = 2, note = '' } = JSON.parse(raw);
      if (!Array.isArray(ingredients) || !ingredients.length) return send(res, 400, { error: '材料を1つ以上入力してください。' });
      const prompt = `あなたは家庭料理の献立アシスタントです。手元の材料: ${ingredients.join('、')}。人数: ${servings}人。希望: ${note || 'おまかせ'}。日本語で、家庭で無理なく作れる料理を1品だけ提案してください。材料は足りなければ「あると良いもの」として最少限の基本調味料を補って構いません。必ず次のJSONだけを返してください: {"title":"料理名","summary":"短い説明","time":"例: 15分","tags":["タグ"],"ingredients":["分量つき材料"],"steps":["手順"],"tips":["調理のポイント"],"cautions":["注意点"]}。各配列は短く、手順は4〜6個にしてください。`;
      const api = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'gpt-5-mini', input: prompt, text: { format: { type: 'json_object' } } })
      });
      const data = await api.json();
      if (!api.ok) {
        const apiError = new Error('OpenAI API request failed');
        apiError.status = api.status;
        throw apiError;
      }
      const text = data.output_text || data.output?.flatMap(x => x.content || []).find(x => x.type === 'output_text')?.text;
      if (!text) throw new Error('レシピの応答を読み取れませんでした。');
      send(res, 200, JSON.parse(text));
    } catch (error) {
      const messages = {
        401: 'OpenAI APIで認証できませんでした。APIキーが正しいか、利用中のプロジェクトで有効かを確認してください。',
        403: 'OpenAI APIへのアクセスが許可されていません。アカウントの利用地域・権限・ネットワーク設定を確認してください。',
        404: '現在設定しているAIモデルを利用できません。アプリの設定を見直してください。',
        429: 'OpenAI APIの利用上限またはクレジット残高に達しています。利用状況を確認してください。'
      };
      send(res, 500, { error: messages[error.status] || 'OpenAI APIへ接続できませんでした。インターネット接続・プロキシ・ファイアウォール設定を確認してください。' });
    }
  });
});
// LAN からのアクセスを拒否し、同じPCだけで利用できるようにします。
server.listen(port, '127.0.0.1', () => console.log(`今日の料理: http://localhost:${port}`));
