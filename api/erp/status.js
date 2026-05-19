// api/erp/status.js
const { erpFetch, setCors } = require('../_helpers');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const data = await erpFetch('/api/method/frappe.auth.get_logged_user');
    res.json({ ok: true, user: data.message });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
