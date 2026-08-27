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
    distanceKm: act.distance / 1000,
    durationSec: act.moving_time,
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

async function syncActivity(athleteId, activityId) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  const connRes = await fetch(`${base}/rest/v1/strava_connections?athlete_id=eq.${athleteId}&select=*`, { headers });
  const conns = await connRes.json();
  if (!conns || !conns.length) return;
  let conn = conns[0];

  if (conn.expires_at < Math.floor(Date.now() / 1000)) {
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: conn.refresh_token })
    });
    const refreshed = await refreshRes.json();
    if (refreshed.access_token) {
      conn.access_token = refreshed.access_token;
      await fetch(`${base}/rest/v1/strava_connections?user_id=eq.${conn.user_id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expires_at: refreshed.expires_at })
      });
    }
  }

  const actRes = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${conn.access_token}` }
  });
  const act = await actRes.json();
  if (!act || !((act.sport_type || act.type || '').includes('Run'))) return;

  const stateRes = await fetch(`${base}/rest/v1/app_state?user_id=eq.${conn.user_id}&select=data`, { headers });
  const stateRows = await stateRes.json();
  if (!stateRows || !stateRows.length) return;
  const data = stateRows[0].data || {};
  data.runs = data.runs || [];
  const newRun = activityToRun(act);
  const idx2 = data.runs.findIndex(r => r.stravaId === act.id);
  if (idx2 >= 0) data.runs[idx2] = newRun; else data.runs.push(newRun);

  // Marcar la sesión del plan como hecha, si la carrera cae en la semana actual
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

  await fetch(`${base}/rest/v1/app_state?user_id=eq.${conn.user_id}`, {
    method: 'PATCH', headers, body: JSON.stringify({ data })
  });
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.STRAVA_VERIFY_TOKEN) {
      res.status(200).json({ 'hub.challenge': challenge });
      return;
    }
    res.status(403).send('Forbidden');
    return;
  }

  if (req.method === 'POST') {
    res.status(200).send('EVENT_RECEIVED');
    try {
      const event = req.body;
      if (event && event.object_type === 'activity' && (event.aspect_type === 'create' || event.aspect_type === 'update')) {
        await syncActivity(event.owner_id, event.object_id);
      }
    } catch (e) { console.error(e); }
    return;
  }

  res.status(405).send('Method not allowed');
};
