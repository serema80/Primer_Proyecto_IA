// api/auth/login.js — Inicia flujo OAuth con Zecore
const { setCors } = require('../_helpers');

const ERPNEXT_URL       = process.env.ERPNEXT_URL;
const OAUTH_CLIENT_ID   = process.env.OAUTH_CLIENT_ID;
const OAUTH_REDIRECT_URI= process.env.OAUTH_REDIRECT_URI;

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Construir URL de autorización de Zecore
  const params = new URLSearchParams({
    response_type: 'code',
    client_id    : OAUTH_CLIENT_ID,
    redirect_uri : OAUTH_REDIRECT_URI,
    scope        : 'all openid',
    state        : Math.random().toString(36).slice(2), // CSRF protection
  });

  const authUrl = `${ERPNEXT_URL}/api/method/frappe.integrations.oauth2.authorize?${params.toString()}`;
  res.redirect(302, authUrl);
};
