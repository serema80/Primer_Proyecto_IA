// api/auth/callback.js
const fetch = require('node-fetch');
const { createToken, setCors } = require('../_helpers');

const ERPNEXT_URL         = process.env.ERPNEXT_URL;
const OAUTH_CLIENT_ID     = process.env.OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const OAUTH_REDIRECT_URI  = process.env.OAUTH_REDIRECT_URI;

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code, error } = req.query;
  if (error) return res.redirect(302, `/?error=${encodeURIComponent(error)}`);
  if (!code)  return res.redirect(302, '/?error=no_code');

  try {
    // 1. Intercambiar código por access_token
    const tokenRes = await fetch(
      `${ERPNEXT_URL}/api/method/frappe.integrations.oauth2.get_token`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body   : new URLSearchParams({
        grant_type   : 'authorization_code',
        code,
        redirect_uri : OAUTH_REDIRECT_URI,
        client_id    : OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      console.error('Token exchange failed:', txt.slice(0, 300));
      return res.redirect(302, '/?error=token_exchange_failed');
    }

    const tokenData  = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return res.redirect(302, '/?error=no_access_token');

    // 2. Obtener perfil del usuario
    let user = 'usuario', fullName = 'Usuario';
    try {
      const profileRes = await fetch(
        `${ERPNEXT_URL}/api/method/frappe.integrations.oauth2.openid_profile`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (profileRes.ok) {
        const pData   = await profileRes.json();
        const profile = pData.message || pData;
        user     = profile.email || profile.sub || profile.name || user;
        fullName = profile.full_name || profile.name || user;
      }
    } catch(e) { console.warn('Profile fetch failed:', e.message); }

    // 3. Crear JWT (funciona sin estado compartido entre serverless functions)
    const sessionToken = createToken({ user, fullName, accessToken });

    // 4. Redirigir al dashboard con el token
    res.redirect(302,
      `/?session=${encodeURIComponent(sessionToken)}&user=${encodeURIComponent(user)}&name=${encodeURIComponent(fullName)}`
    );

  } catch(e) {
    console.error('OAuth callback error:', e.message);
    res.redirect(302, `/?error=${encodeURIComponent(e.message)}`);
  }
};
