// api/auth/validate.js
const { getSession, setCors } = require('../_helpers');

module.exports = (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token   = req.headers['x-session-token'];
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({ ok: false, error: 'Sesión expirada' });
  }
  res.json({ ok: true, user: session.user, fullName: session.fullName });
};
