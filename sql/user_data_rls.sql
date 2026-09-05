-- ============================================================================
-- RLS para las tablas que el CLIENTE (app.js, desde el teléfono/navegador del
-- usuario) toca directo con la clave pública de Supabase (SUPABASE_ANON_KEY),
-- sin pasar por ningún endpoint de api/*: app_state, strava_connections,
-- push_subscriptions.
--
-- Por qué hace falta: esa clave pública está adentro del código de la app,
-- así que cualquiera puede verla con las herramientas de desarrollador del
-- navegador -- no es un secreto, y no tiene por qué serlo. Lo que decide si
-- alguien con esa clave puede leer o tocar los datos de OTRO usuario (no los
-- propios) son las políticas de Row Level Security de cada tabla, no el
-- código de la app. Sin estas políticas (o con RLS desactivado), cualquiera
-- con esa clave -- logueado o no, según cómo estén los permisos de la tabla
-- -- podría potencialmente leer las carreras (con ruta GPS y frecuencia
-- cardíaca), el perfil, o los tokens de Strava de CUALQUIER usuario, no solo
-- los suyos.
--
-- Qué hace este archivo: activa RLS en las 3 tablas y agrega, para cada una,
-- las 4 políticas básicas (ver, crear, editar, borrar) que dejan a cada
-- usuario logueado tocar únicamente la fila donde user_id sea su propio
-- auth.uid(). El backend (api/*.js) sigue funcionando exactamente igual
-- porque usa SUPABASE_SERVICE_KEY, que siempre se salta el RLS.
--
-- Cómo correrlo: pegar este archivo entero en el SQL Editor de Supabase y
-- ejecutarlo. Es seguro volver a correrlo -- el DROP POLICY IF EXISTS antes
-- de cada CREATE POLICY hace que no falle si la política ya existía (por
-- ejemplo, si ya la habías creado vos a mano desde el Table Editor).
-- ============================================================================

-- ---------- app_state ----------
-- Perfil, plan, carreras (con ruta GPS y frecuencia cardíaca), zapatillas,
-- historial -- básicamente todos los datos de entrenamiento del usuario.
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_state_select_own" ON public.app_state;
CREATE POLICY "app_state_select_own" ON public.app_state
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "app_state_insert_own" ON public.app_state;
CREATE POLICY "app_state_insert_own" ON public.app_state
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "app_state_update_own" ON public.app_state;
CREATE POLICY "app_state_update_own" ON public.app_state
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "app_state_delete_own" ON public.app_state;
CREATE POLICY "app_state_delete_own" ON public.app_state
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- strava_connections ----------
-- access_token / refresh_token de Strava -- equivalen a una contraseña de la
-- cuenta de Strava del usuario. Esta es la tabla más sensible de las tres.
ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "strava_connections_select_own" ON public.strava_connections;
CREATE POLICY "strava_connections_select_own" ON public.strava_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "strava_connections_insert_own" ON public.strava_connections;
CREATE POLICY "strava_connections_insert_own" ON public.strava_connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "strava_connections_update_own" ON public.strava_connections;
CREATE POLICY "strava_connections_update_own" ON public.strava_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "strava_connections_delete_own" ON public.strava_connections;
CREATE POLICY "strava_connections_delete_own" ON public.strava_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- push_subscriptions ----------
-- El endpoint (URL + claves) que usa el navegador del usuario para recibir
-- notificaciones push -- si alguien más lo consigue, le podría mandar
-- notificaciones falsas a ese usuario (no es tan grave como las otras dos
-- tablas, pero tampoco hay razón para dejarla abierta).
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
