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

module.exports = async (req, res) => {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  try {
    const connsRes = await fetch(`${base}/rest/v1/strava_connections?select=*`, { headers });
    const conns = await connsRes.json();

    let synced = 0, errors = 0;
    for (const conn of (Array.isArray(conns) ? conns : [])) {
      try {
        let accessToken = conn.access_token;
        if (conn.expires_at < Math.floor(Date.now() / 1000)) {
          const refreshRes = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: conn.refresh_token })
          });
          const refreshed = await refreshRes.json();
          if (refreshed.access_token) {
            accessToken = refreshed.access_token;
            await fetch(`${base}/rest/v1/strava_connections?user_id=eq.${conn.user_id}`, {
              method: 'PATCH', headers,
              body: JSON.stringify({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expires_at: refreshed.expires_at })
            });
          }
        }

        const after = Math.floor(Date.now() / 1000) - 3 * 24 * 3600;
        const actsRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=30`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const acts = await actsRes.json();
        const runActs = Array.isArray(acts) ? acts.filter(a => ((a.sport_type || a.type || '').includes('Run'))) : [];

        if (runActs.length) {
          const stateRes = await fetch(`${base}/rest/v1/app_state?user_id=eq.${conn.user_id}&select=data`, { headers });
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
            await fetch(`${base}/rest/v1/app_state?user_id=eq.${conn.user_id}`, {
              method: 'PATCH', headers, body: JSON.stringify({ data })
            });
          }
        }

        synced++;
      } catch (e) {
        errors++;
      }
    }

    res.status(200).json({ synced, errors, total: Array.isArray(conns) ? conns.length : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
