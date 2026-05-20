// api/auth/logout.js — Con JWT no hay estado que borrar
const { setCors } = require('../_helpers');
module.exports = (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.json({ ok: true });
};
