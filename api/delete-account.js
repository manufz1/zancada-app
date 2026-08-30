// api/delete-account.js
//
// Endpoint que borra por completo la cuenta de un usuario: sus filas en las
// tablas de la app y, al final, su usuario de autenticación en Supabase.
// Requiere la Service Role Key de Supabase (nunca la expongas en el frontend).
//
// Variables de entorno necesarias en Vercel (Project Settings → Environment Variables):
//   SUPABASE_URL              (la misma que ya usás en el resto del backend)
//   SUPABASE_SERVICE_ROLE_KEY (Project Settings → API → service_role, en el dashboard de Supabase)
//
// Nota: si tus otros archivos dentro de /api usan "module.exports = ..." en vez
// de "export default", cambiá la última línea de este archivo para que coincida
// con ese mismo estilo (para que Vercel lo reconozca igual que a los demás).

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  // Verificamos el token contra Supabase Auth para saber con certeza qué
  // usuario está pidiendo el borrado (nunca confiamos en un user_id que
  // venga del cliente).
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  const userId = userData.user.id;

  // Borramos los datos de la app asociados al usuario. Cada tabla se borra
  // por separado y de forma tolerante a errores: si una tabla no existe o ya
  // no tiene filas, seguimos igual con las demás en vez de frenar todo el
  // proceso a mitad de camino.
  const tables = ['app_state', 'push_subscriptions', 'strava_connections'];
  for (const table of tables) {
    try {
      await supabaseAdmin.from(table).delete().eq('user_id', userId);
    } catch (e) {
      console.error(`delete-account: failed to clear ${table}`, e);
    }
  }

  // Por último, borramos el usuario de autenticación. Esto es lo que hace
  // que ya no pueda volver a iniciar sesión con ese email.
  const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    console.error('delete-account: failed to delete auth user', deleteErr);
    return res.status(500).json({ error: 'Could not delete account' });
  }

  return res.status(200).json({ ok: true });
}
