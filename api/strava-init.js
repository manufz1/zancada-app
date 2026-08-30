// api/strava-init.js
//
// Genera el "state" firmado que se manda a Strava al empezar la conexión.
// Esto es lo que evita que alguien arme el link de autorización de Strava a
// mano con el user_id de otra persona: sin este endpoint, state=<user_id> se
// mandaba tal cual, sin firmar, y strava-auth.js confiaba en él ciegamente.
//
// Variables de entorno que ya tenés (las mismas de strava-auth.js):
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY
// Variable de entorno NUEVA que hay que agregar en Vercel:
//   STRAVA_STATE_SECRET   (cualquier string largo y al azar, por ejemplo generado
//                          con `openssl rand -hex 32` desde una terminal, o
//                          cualquier generador de contraseñas largas — no importa
//                          el valor exacto, solo que sea secreto y no se repita
//                          en ningún otro lado)

const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Missing token' }); return; }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const secret = process.env.STRAVA_STATE_SECRET;
  if (!secret) { res.status(500).json({ error: 'Missing STRAVA_STATE_SECRET' }); return; }

  try {
    // Verificamos el token contra Supabase Auth: el state solo puede
    // generarse para el usuario que realmente inició sesión, nunca para un
    // user_id que venga suelto del cliente.
    const userRes = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` }
    });
    const user = await userRes.json();
    if (!userRes.ok || !user || !user.id) { res.status(401).json({ error: 'Invalid session' }); return; }
    const userId = user.id;

    const timestamp = Date.now().toString();
    const payload = `${userId}.${timestamp}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const state = `${payload}.${signature}`;

    res.status(200).json({ state });
  } catch (err) {
    console.error('strava-init error', err);
    res.status(500).json({ error: 'Error: ' + err.message });
  }
};
