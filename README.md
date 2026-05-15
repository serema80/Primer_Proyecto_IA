# ZeCore · Dashboard Logístico

Dashboard informativo que conecta ERPNext con Claude AI para consulta de rutas logísticas.

## Requisitos

- Node.js 18+ instalado
- Acceso de administrador a tu ERPNext
- API Key de Anthropic (claude.ai/settings)

---

## Instalación (3 pasos)

### 1. Instalar dependencias
```bash
cd erpnext-logistics
npm install
```

### 2. Configurar credenciales

Copia el archivo de ejemplo y edítalo:
```bash
cp .env.example .env
```

Edita `.env` con tus datos reales:
```
ERPNEXT_URL=https://zecore.develop.zebrands.mx
ERPNEXT_API_KEY=abc123...
ERPNEXT_API_SECRET=xyz789...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Obtener tu API Key de ERPNext

1. Entra a https://zecore.develop.zebrands.mx
2. Click en tu nombre (esquina superior derecha) → **Mi Perfil**
3. Busca la sección **"API Access"**
4. Click en **"Generate Keys"**
5. Copia el **API Key** y **API Secret** a tu `.env`

**IMPORTANTE:** También abre `public/index.html` y reemplaza:
```javascript
const ANTHROPIC_KEY = 'TU_ANTHROPIC_API_KEY_AQUI';
```
con tu API key real de Anthropic.

---

## Ejecutar

```bash
npm start
```

Abre tu navegador en: **http://localhost:3001**

---

## Estructura del proyecto

```
erpnext-logistics/
├── server.js          # Proxy Node.js → ERPNext
├── package.json
├── .env               # Tus credenciales (NO subir a git)
├── .env.example       # Plantilla de credenciales
└── public/
    └── index.html     # Dashboard con Claude integrado
```

## Endpoints del proxy

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/erp/status | Verifica conexión |
| GET | /api/erp/dashboard-summary | Resumen completo |
| GET | /api/erp/delivery-notes | Notas de entrega |
| GET | /api/erp/sales-orders | Órdenes de venta |
| GET | /api/erp/purchase-orders | Órdenes de compra |
| GET | /api/erp/vehicles | Vehículos |
| GET | /api/erp/drivers | Conductores |
| POST | /api/erp/generic | Cualquier DocType personalizado |

## Agregar nuevos DocTypes

En `server.js`, copia cualquier ruta existente y modifica el DocType:

```javascript
app.get('/api/erp/mi-doctype', async (req, res) => {
  const data = await erpFetch('/api/resource/Mi DocType', {
    fields: JSON.stringify(['name', 'campo1', 'campo2']),
    limit_page_length: 50,
  });
  res.json(data);
});
```

## Seguridad

- El archivo `.env` NUNCA debe subirse a git (ya está en .gitignore)
- La API key de Anthropic en `index.html` es para uso **local únicamente**
- Para producción, mover la llamada a Claude al backend (server.js)
