// api/_helpers.js — Utilidades compartidas
const fetch = require('node-fetch');

const ERPNEXT_URL = process.env.ERPNEXT_URL;
const API_KEY     = process.env.ERPNEXT_API_KEY;
const API_SECRET  = process.env.ERPNEXT_API_SECRET;
const BASE_EP     = 'zecore_payments.api.routes.boarding.dashboard_endpoints';
const SESSION_SECRET = process.env.SESSION_SECRET || 'zecore-secret-2026';

function erpHeaders() {
  return {
    'Authorization': `token ${API_KEY}:${API_SECRET}`,
    'Content-Type' : 'application/json',
    'Accept'       : 'application/json',
  };
}

async function erpEndpoint(method) {
  const r = await fetch(`${ERPNEXT_URL}/api/method/${method}`, {
    headers: erpHeaders(),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Zecore ${r.status} at ${method}: ${txt.slice(0, 300)}`);
  }
  const d = await r.json();
  return d.message || [];
}

async function erpFetch(endpoint, params = {}) {
  const url = new URL(`${ERPNEXT_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const r = await fetch(url.toString(), { headers: erpHeaders() });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Zecore ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

// ── JWT simple (sin librería externa) ───────────────────────
function b64encode(str) {
  return Buffer.from(str).toString('base64url');
}
function b64decode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function createToken(payload) {
  const header  = b64encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = b64encode(JSON.stringify({ ...payload, exp: Date.now() + 8*60*60*1000 }));
  const crypto  = require('crypto');
  const sig     = crypto.createHmac('sha256', SESSION_SECRET)
                        .update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', SESSION_SECRET)
                           .update(`${parts[0]}.${parts[1]}`).digest('base64url');
    if (expected !== parts[2]) return null;
    const payload = JSON.parse(b64decode(parts[1]));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch(e) {
    return null;
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-session-token');
}

module.exports = {
  ERPNEXT_URL, API_KEY, API_SECRET, BASE_EP,
  erpHeaders, erpEndpoint, erpFetch,
  createToken, verifyToken, setCors,
};
