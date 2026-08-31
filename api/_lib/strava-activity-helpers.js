// api/_lib/strava-activity-helpers.js
//
// Antes esta misma lógica (decodePolyline, fetchSplits, activityToRun,
// getMondayISO) estaba copiada tal cual en 5 archivos distintos:
// strava-auth.js, strava-webhook.js, strava-resync.js, strava-sync-now.js y
// sync-strava.js. Estar duplicada en 5 lugares significa que un fix o un
// cambio de comportamiento (por ejemplo, agregar un campo nuevo a los runs
// que vienen de Strava) hay que acordarse de replicarlo 5 veces — y es
// cuestión de tiempo hasta que alguna copia quede desactualizada. Ahora
// viven acá una sola vez y los 5 archivos importan de este módulo.
//
// También agrega mergeStravaRuns(), que reemplaza el viejo patrón de
// "GET app_state -> mergear en memoria -> PATCH app_state" que tenían los
// 5 archivos. Ese patrón tiene una condición de carrera real: si dos
// sincronizaciones corren casi al mismo tiempo (el cron de cada 15 minutos
// y una sincronización manual, por ejemplo, o el cron y el guardado normal
// del cliente), la segunda puede pisar lo que acaba de guardar la primera
// sin darse cuenta, porque cada una lee el estado ANTES de que la otra
// termine de escribir. mergeStravaRuns() en cambio llama a una función SQL
// (merge_strava_runs, ver /sql/merge_strava_runs.sql) que hace todo el
// mergeo dentro de una sola transacción con el registro bloqueado
// (FOR UPDATE), así que no hay ventana para que se pisen, y además siempre
// actualiza `updated_at` — antes el PATCH mandaba solo `{ data }` y dejaba
// `updated_at` desactualizado, por lo que el aviso de "conflicto entre
// dispositivos" del cliente (ver checkForRemoteConflict en index.html)
// nunca se enteraba de que una sincronización de Strava había tocado los
// datos.

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

function getMondayISO(d) {
  const dt = new Date(d);
  const day = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() + (day === 0 ? -6 : 1 - day));
  dt.setUTCHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

// accessToken en null/undefined = no busca parciales (más rápido, se
// completan solos en la sincronización periódica). Además de los campos
// del run, agrega dos campos "de paso" (planMonday, planDayIndex) que
// merge_strava_runs.sql usa para saber si esta carrera corresponde a un día
// del plan de esa semana, y que la función SQL descarta antes de guardar el
// run definitivo — no quedan guardados en el run final.
async function activityToRun(act, accessToken) {
  const splits = accessToken ? await fetchSplits(act.id, accessToken) : [];
  const startDate = new Date(act.start_date);
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
    source: 'strava',
    // campos de paso, ver comentario de arriba:
    planMonday: getMondayISO(act.start_date),
    planDayIndex: (startDate.getUTCDay() + 6) % 7
  };
}

// Llama a la función SQL merge_strava_runs (ver /sql/merge_strava_runs.sql)
// para agregar `newRuns` a app_state.data.runs de forma atómica. base y
// headers son los mismos que ya se usan para hablarle a la REST API de
// Supabase en el resto del archivo (headers debe incluir apikey y
// Authorization con la service key). No hace nada si newRuns está vacío.
// mode: 'skip' (default, no pisa carreras ya guardadas) o 'upsert' (las
// reemplaza con los datos nuevos de Strava — lo usa strava-webhook.js
// porque Strava manda el mismo evento para actividades nuevas y editadas).
async function mergeStravaRuns(base, headers, userId, newRuns, mode) {
  if (!newRuns || !newRuns.length) return { merged: false };
  const res = await fetch(`${base}/rest/v1/rpc/merge_strava_runs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_user_id: userId, p_new_runs: newRuns, p_mode: mode || 'skip' })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`merge_strava_runs rpc failed: ${res.status} ${text}`);
  }
  return { merged: true };
}

module.exports = { decodePolyline, fetchSplits, getMondayISO, activityToRun, mergeStravaRuns };
