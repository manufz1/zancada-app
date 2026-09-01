const webpush = require('web-push');
const requireCronSecret = require('./_lib/require-cron-secret');

// Mensajes cortos por idioma — no necesita el diccionario completo de la app.
const MSGS = {
  es: { types:{easy:'Rodaje suave',intervals:'Series',tempo:'Ritmo medio',long:'Tirada larga'}, body:(type,km)=>`Hoy toca: ${type} · ${km}km` },
  en: { types:{easy:'Easy run',intervals:'Intervals',tempo:'Tempo run',long:'Long run'}, body:(type,km)=>`Today: ${type} · ${km}km` },
  pt: { types:{easy:'Corrida leve',intervals:'Tiros',tempo:'Ritmo médio',long:'Longão'}, body:(type,km)=>`Hoje: ${type} · ${km}km` },
  fr: { types:{easy:'Footing',intervals:'Fractionné',tempo:'Allure soutenue',long:'Sortie longue'}, body:(type,km)=>`Aujourd'hui : ${type} · ${km}km` },
  it: { types:{easy:'Corsa lenta',intervals:'Ripetute',tempo:'Ritmo medio',long:'Lungo'}, body:(type,km)=>`Oggi: ${type} · ${km}km` },
  de: { types:{easy:'Lockerer Lauf',intervals:'Intervalle',tempo:'Tempolauf',long:'Langer Lauf'}, body:(type,km)=>`Heute: ${type} · ${km}km` }
};

module.exports = async (req, res) => {
  if (!requireCronSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  webpush.setVapidDetails(
    'mailto:info@zancada.org',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  try {
    const statesRes = await fetch(`${base}/rest/v1/app_state?select=user_id,data`, { headers });
    const states = await statesRes.json();
    const subsRes = await fetch(`${base}/rest/v1/push_subscriptions?select=user_id,subscription`, { headers });
    const subs = await subsRes.json();

    const subsByUser = {};
    (subs || []).forEach(s => { subsByUser[s.user_id] = s.subscription; });

    let sent = 0, skipped = 0, failed = 0;
    for (const row of (states || [])) {
      const sub = subsByUser[row.user_id];
      if (!sub) { skipped++; continue; }
      const data = row.data || {};
      const plan = data.plan;
      if (!plan || !plan.length) { skipped++; continue; }

      const idx = (new Date().getUTCDay() + 6) % 7;
      const today = plan[idx];
      if (!today || !today.dist) { skipped++; continue; } // día de descanso, no molestamos

      const lang = MSGS[data.lang] ? data.lang : 'es';
      const typeLabel = today.custom ? today.type : (MSGS[lang].types[today.typeKey] || today.typeKey);
      const body = MSGS[lang].body(typeLabel, today.dist);

      try {
        await webpush.sendNotification(sub, JSON.stringify({ title: 'Zancada', body }));
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 404 || err.statusCode === 410) {
          await fetch(`${base}/rest/v1/push_subscriptions?user_id=eq.${row.user_id}`, { method: 'DELETE', headers });
        }
      }
    }

    res.status(200).json({ sent, skipped, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
