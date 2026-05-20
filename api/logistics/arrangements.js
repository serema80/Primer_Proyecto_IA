// api/logistics/arrangements.js
const { erpEndpoint, verifyToken, setCors, BASE_EP } = require('../_helpers');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Validar sesión
  const token   = req.headers['x-session-token'];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ ok: false, error: 'Sesión requerida' });
  }

  try {
    // Llamar endpoints en paralelo
    const [rawArr, freightRates, handlingRates] = await Promise.all([
      erpEndpoint(`${BASE_EP}.get_arrangements_plan`),
      erpEndpoint(`${BASE_EP}.get_freight_rates`),
      erpEndpoint(`${BASE_EP}.get_handling_rates`),
    ]);

    // get_routes tiene un bug conocido — no bloquear si falla
    let routes = [];
    try {
      routes = await erpEndpoint(`${BASE_EP}.get_routes`);
    } catch(e) {
      console.warn('get_routes falló (bug conocido):', e.message.slice(0, 80));
    }

    // Consolidar arrangements (múltiples filas por destino → un registro)
    const arrMap = {};
    for (const row of rawArr) {
      const name = row.name;
      if (!arrMap[name]) {
        arrMap[name] = {
          name            : row.name,
          purpose         : row.purpose,
          business_type   : row.business_type,
          status          : row.status,
          etd             : (row.etd            || '').slice(0, 16),
          delivery_date   : (row.delivery_date  || '').slice(0, 10),
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
      if (dp && !a.dest_pincodes.includes(dp)) {
        a.dest_pincodes.push(dp);
        a.dest_zones.push(row.dest_freight_zone || null);
        a.dest_cities.push(row.dest_city || '');
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
    console.error('arrangements error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
};
