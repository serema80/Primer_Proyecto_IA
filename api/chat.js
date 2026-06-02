// api/chat.js — Proxy seguro para Anthropic API
const fetch = require('node-fetch');
const { verifyToken, setCors } = require('./_helpers');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token   = req.headers['x-session-token'];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Sesión requerida' });

  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en Vercel' });

  try {
    const { system, messages, max_tokens } = req.body;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method : 'POST',
      headers: {
        'Content-Type'     : 'application/json',
        'x-api-key'        : ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model     : 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 1200,
        system,
        messages,
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: `Anthropic error: ${txt.slice(0, 200)}` });
    }

    const data = await r.json();
    res.json({ ok: true, content: data.content });

  } catch(e) {
    console.error('Chat proxy error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
