// api/_helpers.js — Utilidades compartidas entre serverless functions
const fetch = require('node-fetch');

const ERPNEXT_URL     = process.env.ERPNEXT_URL;
const API_KEY         = process.env.ERPNEXT_API_KEY;
const API_SECRET      = process.env.ERPNEXT_API_SECRET;
const BASE_EP         = 'zecore_payments.api.routes.boarding.dashboard_endpoints';

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

// ── Session store (in-memory, resets on cold start) ──────────
// Para producción real usar Redis o similar
const sessions = new Map();

function makeToken() {
  return Math.random().toString(36).slice(2) +
         Math.random().toString(36).slice(2) +
         Date.now().toString(36);
}

function createSession(user, fullName, accessToken) {
  const token   = makeToken();
  const expires = Date.now() + 8 * 60 * 60 * 1000; // 8 hrs
  sessions.set(token, { user, fullName, accessToken, expires });
  // Limpiar sesiones vencidas
  for (const [k, v] of sessions.entries()) {
    if (v.expires < Date.now()) sessions.delete(k);
  }
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s || s.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function deleteSession(token) {
  sessions.delete(token);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-session-token');
}

module.exports = {
  ERPNEXT_URL, API_KEY, API_SECRET, BASE_EP,
  erpHeaders, erpEndpoint, erpFetch,
  sessions, makeToken, createSession, getSession, deleteSession,
  setCors,
};
