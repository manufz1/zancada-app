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

module.exports = async (req, res) => {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  try {
    const connsRes = await fetch(`${base}/rest/v1/strava_connections?select=*`, { headers });
    const conns = await connsRes.json();

    let usersUpdated = 0, runsUpdated = 0, errors = 0;
    for (const conn of (Array.isArray(conns) ? conns : [])) {
      try {
        let accessToken = conn.access_token;
        if (conn.expires_at < Math.floor(Date.now() / 1000)) {
          const refreshRes = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: conn.refresh_token })
          });
          const refreshed = await refreshRes.json();
          if (refreshed.access_token) accessToken = refreshed.access_token;
        }

        const stateRes = await fetch(`${base}/rest/v1/app_state?user_id=eq.${conn.user_id}&select=data`, { headers });
        const stateRows = await stateRes.json();
        if (!stateRows || !stateRows.length) continue;
        const data = stateRows[0].data || {};
        data.runs = data.runs || [];

        let changed = false;
        for (const run of data.runs) {
          if (run.source !== 'strava' || !run.stravaId) continue;
          const hasBasics = run.elevationGain !== undefined && run.calories !== undefined;
          const hasCurrentSplits = run.splitsV === 2;
          if (hasBasics && hasCurrentSplits) continue; // ya tiene todo, con la versión más nueva de parciales

          if (!hasBasics) {
            const actRes = await fetch(`https://www.strava.com/api/v3/activities/${run.stravaId}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            const act = await actRes.json();
            if (!act || act.errors) continue;

            run.name = act.name || null;
            run.elevationGain = act.total_elevation_gain || 0;
            run.avgHr = act.average_heartrate ? Math.round(act.average_heartrate) : (run.avgHr || null);
            run.maxHr = act.max_heartrate ? Math.round(act.max_heartrate) : null;
            run.avgCadence = act.average_cadence || null;
            run.calories = act.calories ? Math.round(act.calories) : null;
            if (act.map && act.map.summary_polyline && (!run.points || !run.points.length)) {
              run.points = decodePolyline(act.map.summary_polyline);
            }
          }
          if (!hasCurrentSplits) {
            run.splits = await fetchSplits(run.stravaId, accessToken);
            run.splitsV = 2;
          }
          changed = true;
          runsUpdated++;
        }

        if (changed) {
          await fetch(`${base}/rest/v1/app_state?user_id=eq.${conn.user_id}`, {
            method: 'PATCH', headers, body: JSON.stringify({ data })
          });
          usersUpdated++;
        }
      } catch (e) {
        errors++;
      }
    }

    res.status(200).json({ usersUpdated, runsUpdated, errors, totalConnections: Array.isArray(conns) ? conns.length : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
