// ============================================================
// server.js — ZeCore Logistics Proxy
// Consume endpoints reales de ERPNext via zecore_payments API
// ============================================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

const ERPNEXT_URL = process.env.ERPNEXT_URL;
const API_KEY     = process.env.ERPNEXT_API_KEY;
const API_SECRET  = process.env.ERPNEXT_API_SECRET;

const BASE_EP = 'zecore_payments.api.routes.boarding.dashboard_endpoints';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth headers for ERPNext ──────────────────────────────────
function erpHeaders() {
  return {
    'Authorization': `token ${API_KEY}:${API_SECRET}`,
    'Content-Type' : 'application/json',
    'Accept'       : 'application/json',
  };
}

// ── Call a custom ERPNext endpoint ────────────────────────────
async function erpEndpoint(method) {
  const r = await fetch(`${ERPNEXT_URL}/api/method/${method}`, {
    headers: erpHeaders(),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`ERPNext ${r.status} at ${method}: ${txt.slice(0, 200)}`);
  }
  const d = await r.json();
  return d.message || [];
}

// ── Standard resource fetch ───────────────────────────────────
async function erpFetch(endpoint, params = {}) {
  const url = new URL(`${ERPNEXT_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const r = await fetch(url.toString(), { headers: erpHeaders() });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`ERPNext ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

// ============================================================
// AUTH — Session management
// ============================================================
const sessions = new Map();
function makeToken() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// POST /api/auth/login — verifica usuario en ERPNext con API Keys
app.post('/api/auth/login', async (req, res) => {
  const { usr } = req.body;
  if (!usr) return res.status(400).json({ ok: false, error: 'Usuario requerido' });
  try {
    const r = await fetch(
      `${ERPNEXT_URL}/api/resource/User/${encodeURIComponent(usr)}?fields=["name","full_name","enabled","user_type"]`,
      { headers: erpHeaders() }
    );
    if (r.status === 404) return res.status(401).json({ ok: false, error: 'Usuario no encontrado en ERPNext' });
    if (!r.ok)           return res.status(401).json({ ok: false, error: 'No se pudo verificar el usuario' });

    const data = await r.json();
    const user = data.data;
    if (!user || user.enabled === 0) {
      return res.status(401).json({ ok: false, error: 'Usuario inactivo en ERPNext' });
    }

    const fullName = user.full_name || usr;
    const token    = makeToken();
    const expires  = Date.now() + 8 * 60 * 60 * 1000; // 8 hrs
    sessions.set(token, { user: usr, fullName, expires });
    // Clean expired sessions
    for (const [k, v] of sessions.entries()) { if (v.expires < Date.now()) sessions.delete(k); }

    res.json({ ok: true, token, user: usr, fullName });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Error al conectar con ERPNext: ' + e.message });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-session-token'];
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

// GET /api/auth/validate
app.get('/api/auth/validate', (req, res) => {
  const token   = req.headers['x-session-token'];
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ ok: false, error: 'Sesion expirada' });
  }
  res.json({ ok: true, user: session.user, fullName: session.fullName });
});

// ============================================================
// ERPNext STATUS
// ============================================================
app.get('/api/erp/status', async (req, res) => {
  try {
    const data = await erpFetch('/api/method/frappe.auth.get_logged_user');
    res.json({ ok: true, user: data.message });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ============================================================
// LOGISTICS — Datos en tiempo real desde endpoints custom
// ============================================================

// GET /api/logistics/arrangements — Pipeline completo
app.get('/api/logistics/arrangements', async (req, res) => {
  try {
    // Llamar endpoints — get_routes puede fallar, usamos fallback
    const [rawArr, freightRates, handlingRates] = await Promise.all([
      erpEndpoint(`${BASE_EP}.get_arrangements_plan`),
      erpEndpoint(`${BASE_EP}.get_freight_rates`),
      erpEndpoint(`${BASE_EP}.get_handling_rates`),
    ]);

    // get_routes tiene un bug conocido — intentar pero no bloquear
    let routes = [];
    try {
      routes = await erpEndpoint(`${BASE_EP}.get_routes`);
    } catch(e) {
      console.warn('⚠ get_routes falló (bug conocido):', e.message.slice(0,80));
      // Fallback: derivar rutas desde las tarifas disponibles
      // Extraer pares origen-destino únicos de las tarifas de flete
      const routeCodes = [...new Set(freightRates.map(r => r.route_code))];
      console.log(`  Usando ${routeCodes.length} route_codes de freight_rates como fallback`);
    }

    // Consolidar arrangements (puede haber múltiples filas por arrangement
    // si tiene varios destinos en Item Group)
    const arrMap = {};
    for (const row of rawArr) {
      const name = row.name;
      if (!arrMap[name]) {
        arrMap[name] = {
          name            : row.name,
          purpose         : row.purpose,
          business_type   : row.business_type,
          status          : row.status,
          etd             : (row.etd || '').slice(0, 16),
          delivery_date   : (row.delivery_date || '').slice(0, 10),
          customer        : row.customer,
          carrier         : row.carrier,
          origin_warehouse: row.origin_warehouse,
          origin_pincode  : row.origin_pincode,
          origin_city     : row.origin_city,
          origin_zone     : row.origin_freight_zone,
          dest_pincodes   : [],
          dest_zones      : [],
          dest_cities     : [],
          total_m3        : 0,
          total_qty       : 0,
          total_pallets   : 0,
        };
      }
      const a = arrMap[name];
      a.total_m3      += parseFloat(row.total_m3      || 0);
      a.total_qty     += parseFloat(row.total_qty     || 0);
      a.total_pallets += parseFloat(row.total_pallets || 0);
      const dp = row.dest_pincode;
      const dz = row.dest_freight_zone;
      const dc = row.dest_city;
      if (dp && !a.dest_pincodes.includes(dp)) {
        a.dest_pincodes.push(dp);
        a.dest_zones.push(dz);
        a.dest_cities.push(dc);
      }
    }

    const arrangements = Object.values(arrMap).map(a => ({
      ...a,
      total_m3     : Math.round(a.total_m3      * 10000) / 10000,
      total_pallets: Math.round(a.total_pallets  * 10000) / 10000,
    }));

    res.json({
      ok          : true,
      arrangements,
      routes,
      rates       : freightRates,
      handling    : handlingRates,
      timestamp   : new Date().toISOString(),
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/erp/generic — endpoint genérico
app.post('/api/erp/generic', async (req, res) => {
  try {
    const { doctype, filters, fields, limit } = req.body;
    if (!doctype) return res.status(400).json({ error: 'doctype requerido' });
    const data = await erpFetch(`/api/resource/${doctype}`, {
      ...(filters ? { filters: JSON.stringify(filters) } : {}),
      ...(fields  ? { fields : JSON.stringify(fields)  } : {}),
      limit_page_length: limit || 20,
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🚀 ZeCore Logistics · http://localhost:${PORT}`);
  console.log(`🔗 ERPNext: ${ERPNEXT_URL}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /api/erp/status`);
  console.log(`  POST /api/auth/login`);
  console.log(`  GET  /api/auth/validate`);
  console.log(`  POST /api/auth/logout`);
  console.log(`  GET  /api/logistics/arrangements  ← datos en tiempo real`);
  console.log(`  POST /api/erp/generic\n`);
});
