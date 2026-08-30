// api/strava-disconnect.js
//
// Desconecta Strava "de verdad": además de borrar la fila en
// strava_connections, le avisa a Strava que revoque el permiso, para que la
// autorización no quede activa de su lado después de desconectar desde la
// app. Sigue el mismo estilo que tus otros endpoints (fetch directo a la
// REST API de Supabase, sin librerías extra).
//
// Usa las mismas variables de entorno que ya tenés configuradas para
// strava-auth.js:
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Missing token' }); return; }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  try {
    const userRes = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` }
    });
    const user = await userRes.json();
    if (!userRes.ok || !user || !user.id) { res.status(401).json({ error: 'Invalid session' }); return; }
    const userId = user.id;

    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

    try {
      const connRes = await fetch(`${base}/rest/v1/strava_connections?user_id=eq.${userId}&select=access_token`, { headers });
      const connRows = await connRes.json();
      const accessToken = connRows && connRows[0] && connRows[0].access_token;
      if (accessToken) {
        await fetch(`https://www.strava.com/oauth/deauthorize?access_token=${encodeURIComponent(accessToken)}`, { method: 'POST' });
      }
    } catch (e) {
      // Si Strava no responde o el token ya venció, igual seguimos: es mejor
      // dejar la conexión borrada de nuestro lado que dejar al usuario
      // trabado sin poder desconectar.
      console.error('strava-disconnect: revoke failed', e);
    }

    const delRes = await fetch(`${base}/rest/v1/strava_connections?user_id=eq.${userId}`, { method: 'DELETE', headers });
    if (!delRes.ok) {
      console.error('strava-disconnect: failed to delete connection row', await delRes.text());
      res.status(500).json({ error: 'Could not disconnect Strava' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('strava-disconnect error', err);
    res.status(500).json({ error: 'Error: ' + err.message });
  }
};
