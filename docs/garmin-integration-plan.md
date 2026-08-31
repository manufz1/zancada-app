# Plan para integrar Garmin (Activity API)

Notas de diseño para cuando Garmin apruebe el acceso al Garmin Connect
Developer Program. Todavía no hay credenciales ni acceso al entorno de
evaluación, así que esto es un plan, no código funcionando — la idea es no
tener que diseñarlo desde cero ese día, y evitar copiar el patrón de Strava
tal cual donde no corresponde.

## Por qué no es "copiar y pegar" la integración de Strava

Strava funciona con OAuth + polling: cada usuario autoriza la app, guardamos
su `access_token`/`refresh_token`, y un cron (`api/sync-strava.js`, cada 15
minutos) le pregunta a Strava "¿hay actividades nuevas?".

Garmin funciona distinto: es un modelo de **push por webhook**. Vos
registrás una URL (por ejemplo `/api/garmin-webhook`) y Garmin te manda un
POST a esa URL cada vez que un usuario sincroniza su reloj con Garmin
Connect, con los datos (o un ping para ir a buscarlos, según la
arquitectura Ping vs Push que se elija en la app creada en
developerportal.garmin.com/developer-programs/myapp). No hay nada que
"polear" cada 15 minutos.

## Piezas que sí se reutilizan

- **`api/_lib/verify-user.js`**: para cualquier endpoint que el usuario
  llame desde la app logueado (por ejemplo, un botón "Conectar Garmin" que
  inicie el OAuth), igual que ya lo usan `strava-init.js` y
  `strava-disconnect.js`.
- **`api/_lib/require-cron-secret.js`**: si se termina necesitando algún
  endpoint de administración/debug propio (equivalente a
  `strava-debug.js`), debe llevar este mismo guard desde el día uno — no
  como con Strava, que salió sin protección y hubo que agregarla después.
- **El patrón de `merge_strava_runs`** (ver `sql/merge_strava_runs.sql`):
  la idea de mergear carreras nuevas de forma atómica con un RPC de
  Postgres, en vez de GET+mergear en memoria+PATCH, aplica igual acá. Va a
  hacer falta una función parecida (`merge_garmin_activities` o generalizar
  `merge_strava_runs` para que sirva para ambas fuentes) para no reintroducir
  la misma condición de carrera que tenía Strava.

## Piezas nuevas que hay que diseñar (no reutilizables tal cual)

1. **`api/garmin-webhook.js`**: el endpoint público que recibe el push de
   Garmin. A diferencia de `strava-webhook.js`, acá no hay un
   `hub.verify_token` en cada request — la verificación de que el payload
   viene realmente de Garmin es distinta y hay que confirmarla con la
   documentación técnica una vez aprobado el acceso (probablemente algo
   tipo IP allowlist o un secreto compartido en el path/URL, a definir en
   la llamada de onboarding). **No exponer este endpoint sin algún
   mecanismo de verificación** — aprender de lo que pasó con
   `strava-check-subscription.js` y `strava-setup-webhook.js`, que
   quedaron sin protección por descuido.
2. **Tabla `garmin_connections`**: igual que `strava_connections`
   (user_id, access_token, refresh_token, expires_at), pero con los campos
   que use el flujo OAuth 2.0 de Garmin (confirmar en la doc si usan PKCE).
3. **`api/garmin-init.js` / `api/garmin-auth.js` / `api/garmin-disconnect.js`**:
   equivalentes a los de Strava, mismo patrón de `verifyUser` +
   `STRAVA_STATE_SECRET`-style state firmado para el callback OAuth.
4. **Mapeo de datos**: los archivos FIT/GPX/TCX de Garmin no tienen el
   mismo formato que la respuesta de la API de Strava — hace falta un
   parser de FIT (hay librerías npm, ej. `fit-file-parser`) o pedir a
   Garmin las variantes en GPX/TCX si el parseo es más simple, y convertir
   al mismo formato de "run" que ya usa la app (`id`, `stravaId`→`garminId`,
   `distanceKm`, `durationSec`, `points`, `splits`, etc.) para que el resto
   de la app (calendario, plan, coach) no tenga que enterarse de que la
   carrera vino de Garmin y no de Strava.

## Próximo paso real

Cuando llegue el acceso al entorno de evaluación de Garmin: pedir la
documentación técnica de verificación de webhooks en la llamada de
integración (ver conversación sobre el programa), y recién ahí completar
los puntos 1 y 2 de arriba con información real en vez de suposiciones.
