function decodePolyline(encoded) {
  if (!encoded) return [];
  let points = [], index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    points.push({ lat: lat / 1e5, lon: lng / 1e5 });
  }
  return points;
}

function activityToRun(act) {
  return {
    id: 'strava_' + act.id,
    stravaId: act.id,
    date: act.start_date,
    name: act.name || null,
    distanceKm: act.distance / 1000,
    durationSec: act.moving_time,
    elevationGain: act.total_elevation_gain || 0,
    avgHr: act.average_heartrate ? Math.round(act.average_heartrate) : null,
    maxHr: act.max_heartrate ? Math.round(act.max_heartrate) : null,
    avgCadence: act.average_cadence || null,
    calories: act.calories ? Math.round(act.calories) : null,
    hrLog: act.average_heartrate ? [{ t: 0, bpm: Math.round(act.average_heartrate) }] : [],
    points: act.map ? decodePolyline(act.map.summary_polyline) : [],
    shoeId: null,
    source: 'strava'
  };
}

function getMondayISO(d) {
  const dt = new Date(d);
  const day = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() + (day === 0 ? -6 : 1 - day));
  dt.setUTCHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

module.exports = async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) { res.status(400).send('Falta code o state'); return; }

  try {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code'
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) { res.status(400).json(tokenData); return; }

    const base = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' };

    await fetch(`${base}/rest/v1/strava_connections`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: state,
        athlete_id: tokenData.athlete.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at
      })
    });

    // Traer carreras de los últimos 30 días como punto de partida
    const after = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
    const actsRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=30`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const acts = await actsRes.json();
    const runActs = Array.isArray(acts) ? acts.filter(a => ((a.sport_type || a.type || '').includes('Run'))) : [];

    if (runActs.length) {
      const stateRes = await fetch(`${base}/rest/v1/app_state?user_id=eq.${state}&select=data`, { headers });
      const stateRows = await stateRes.json();
      if (stateRows && stateRows.length) {
        const data = stateRows[0].data || {};
        data.runs = data.runs || [];
        runActs.forEach(act => {
          if (data.runs.find(r => r.stravaId === act.id)) return;
          const newRun = activityToRun(act);
          data.runs.push(newRun);
          if (data.plan && data.plan.length && data.weekStart) {
            const monday = getMondayISO(act.start_date);
            if (monday === data.weekStart) {
              const dayIdx = (new Date(act.start_date).getUTCDay() + 6) % 7;
              if (data.plan[dayIdx] && !data.plan[dayIdx].status) {
                data.plan[dayIdx].status = 'done';
                data.plan[dayIdx].linkedRunId = newRun.id;
              }
            }
          }
        });
        await fetch(`${base}/rest/v1/app_state?user_id=eq.${state}`, {
          method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        });
      }
    }

    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
};
