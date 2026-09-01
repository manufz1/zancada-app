// api/_lib/cors.js
//
// Encabezados CORS para los endpoints que el cliente llama directo con fetch().
// Hasta ahora no hacían falta porque la PWA web siempre pega a estas funciones desde
// el mismo dominio que las sirve (zancada.org). Pero la app empaquetada con Capacitor
// (para iOS) corre el mismo app.js/index.html adentro de un WebView cuyo origen es
// distinto (capacitor://localhost, a veces https://localhost) -- sin estos headers,
// el navegador/WebView bloquea la respuesta del lado del cliente aunque el servidor
// haya procesado todo bien.
//
// Uso típico al principio de un endpoint:
//
//   const { applyCors, isPreflight } = require('./_lib/cors');
//   module.exports = async (req, res) => {
//     applyCors(req, res);
//     if (isPreflight(req, res)) return;
//     if (req.method !== 'POST') { ... }
//     ...
//   };

const ALLOWED_ORIGINS = [
  'https://zancada.org',
  'https://www.zancada.org',
  'https://zancada-app.vercel.app',
  // Orígenes típicos del WebView de Capacitor en iOS/Android -- varían un poco según
  // versión y configuración, por eso están los tres.
  'capacitor://localhost',
  'https://localhost',
  'ionic://localhost'
];

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // Le decimos a cualquier caché intermedia que la respuesta varía según el origen
  // (para que no sirva la respuesta cacheada de un origen a otro por error).
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Los pedidos con header Authorization/Content-Type disparan un preflight OPTIONS
// del navegador antes del POST real. Hay que responderlo con los headers de arriba
// y sin pasar por la lógica del endpoint (que espera POST, no OPTIONS).
function isPreflight(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(req, res);
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { applyCors, isPreflight, ALLOWED_ORIGINS };
