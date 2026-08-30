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
async function fetchSplits(activityId, accessToken) {
  try {
    const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}/streams?keys=time,distance,altitude,heartrate&key_by_type=true`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const streams = await res.json();
    if (!streams || !streams.distance || !streams.time) return [];
    const distArr = streams.distance.data, timeArr = streams.time.data;
    const altArr = streams.altitude ? streams.altitude.data : null;
    const hrArr = streams.heartrate ? streams.heartrate.data : null;
    const totalDistM = distArr[distArr.length - 1];
    const numFullKm = Math.floor(totalDistM / 1000);
    if (numFullKm < 1 && totalDistM < 50) return [];
    function buildSegment(fromIdx, toIdx, fromTime, label) {
      const segDistKm = (distArr[toIdx] - distArr[fromIdx]) / 1000;
      const segTime = timeArr[toIdx] - fromTime;
      const paceMin = segDistKm > 0 ? (segTime / 60) / segDistKm : 0;
      let elevGain = 0;
      if (altArr) {
        for (let j = fromIdx + 1; j <= toIdx; j++) { const d = altArr[j] - altArr[j - 1]; if (d > 0) elevGain += d; }
      }
      let avgHr = null;
      if (hrArr) {
        const slice = hrArr.slice(fromIdx, toIdx + 1);
        if (slice.length) avgHr = Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
      }
      return { km: label, paceMin: Math.round(paceMin * 100) / 100, elevGain: Math.round(elevGain), avgHr };
    }
    const splits = [];
    let startIdx = 0, startTime = 0;
    for (let km = 1; km <= numFullKm; km++) {
      const targetDist = km * 1000;
      let idx = startIdx;
      while (idx < distArr.length && distArr[idx] < targetDist) idx++;
      if (idx >= distArr.length) idx = distArr.length - 1;
      splits.push(buildSegment(startIdx, idx, startTime, km));
      startIdx = idx; startTime = timeArr[idx];
    }
    // último tramo suelto, si quedó algo más que unos metros sin contar
    const lastIdx = distArr.length - 1;
    const remainderM = distArr[lastIdx] - distArr[startIdx];
    if (remainderM > 50) {
      const remainderKmLabel = Math.round((remainderM / 1000) * 100) / 100;
      splits.push(buildSegment(startIdx, lastIdx, startTime, remainderKmLabel));
    }
    return splits;
  } catch (e) { return []; }
}
async function activityToRun(act, accessToken) {
  const splits = accessToken ? await fetchSplits(act.id, accessToken) : [];
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
    splits,
    splitsV: 2,
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

const crypto = require('crypto');

// Verifica el "state" firmado por api/strava-init.js antes de confiar en el
// user_id que trae. Sin esto, cualquiera podía armar a mano un link de
// autorización de Strava con state=<user_id de otra persona> y pegar SU
// PROPIA cuenta de Strava en la cuenta ajena. El state tiene el formato
// "<userId>.<timestamp>.<firma>"; se recalcula la firma con el mismo secreto
// y se compara, y además se rechaza si pasaron más de 10 minutos desde que
// se generó (para que un link viejo no se pueda reusar).
function verifyState(state) {
  const secret = process.env.STRAVA_STATE_SECRET;
  if (!secret || !state) return null;
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [userId, timestamp, signature] = parts;
  const payload = `${userId}.${timestamp}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > 10 * 60 * 1000) return null;
  return userId;
}

module.exports = async (req, res) => {
  const { code, state: rawState } = req.query;
  if (!code || !rawState) { res.status(400).send('Falta code o state'); return; }
  const userId = verifyState(rawState);
  if (!userId) { res.status(400).send('State inválido o vencido'); return; }
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
        user_id: userId,
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
      const stateRes = await fetch(`${base}/rest/v1/app_state?user_id=eq.${userId}&select=data`, { headers });
      const stateRows = await stateRes.json();
      if (stateRows && stateRows.length) {
        const data = stateRows[0].data || {};
        data.runs = data.runs || [];
        for (const act of runActs) {
          if (data.runs.find(r => r.stravaId === act.id)) continue;
          const newRun = await activityToRun(act, tokenData.access_token);
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
        }
        await fetch(`${base}/rest/v1/app_state?user_id=eq.${userId}`, {
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
