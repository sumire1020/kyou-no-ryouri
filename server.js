const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const port = process.env.PORT || 3000;
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    return send(res, 200, fs.readFileSync(path.join(root, 'index.html')), 'text/html; charset=utf-8');
  }
  if (req.method !== 'POST' || req.url !== '/api/menu') return send(res, 404, { error: 'Not found' });
  let raw = '';
  req.on('data', chunk => { raw += chunk; if (raw.length > 30000) req.destroy(); });
  req.on('end', async () => {
    try {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return send(res, 400, { error: 'OPENAI_API_KEY is not set.' });
      const { ingredients = [], servings = 2, note = '' } = JSON.parse(raw);
      if (!Array.isArray(ingredients) || !ingredients.length) return send(res, 400, { error: 'Add at least one ingredient.' });
      const prompt = `Suggest one practical Japanese home meal. Ingredients: ${ingredients.join(', ')}. Servings: ${servings}. Preference: ${note || 'none'}. Return only JSON with title, summary, time, tags, ingredients, steps, tips, cautions.`;
      const api = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'gpt-5-mini', input: prompt, text: { format: { type: 'json_object' } } })
      });
      const body = await api.text();
      let data;
      try { data = JSON.parse(body); } catch { throw Object.assign(new Error('OpenAI returned invalid JSON.'), { status: api.status }); }
      if (!api.ok) {
        const error = Object.assign(new Error(data?.error?.message || 'OpenAI request failed.'), { status: api.status, code: data?.error?.code });
        console.error('[openai]', { status: api.status, type: data?.error?.type, code: data?.error?.code });
        throw error;
      }
      const text = data.output_text || data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
      if (!text) throw new Error('No response text.');
      send(res, 200, JSON.parse(text));
    } catch (error) {
      console.error('[menu]', { status: error.status || null, code: error.code || null, message: error.message });
      const messages = { 400: 'OpenAI request settings need attention.', 401: 'OpenAI authentication failed. Check the API key.', 403: 'OpenAI access was denied.', 404: 'The selected AI model is unavailable.', 429: 'OpenAI usage limit or credit has been reached.' };
      send(res, 500, { error: messages[error.status] || 'OpenAI connection failed. Check the server log.' });
    }
  });
});
server.listen(port, '127.0.0.1');
