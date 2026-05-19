// api/auth/logout.js
const { deleteSession, setCors } = require('../_helpers');

module.exports = (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-session-token'];
  if (token) deleteSession(token);
  res.json({ ok: true });
};
