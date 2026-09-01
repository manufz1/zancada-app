-- ============================================================================
-- chat_usage: límite diario de mensajes al coach (IA) por usuario.
--
-- Por qué hace falta: api/chat.js ya verifica que quien llama esté logueado
-- (ver api/_lib/verify-user.js), así que un desconocido sin cuenta no puede
-- pegarle a la API de Gemini gratis. Pero una vez logueado, no había ningún
-- tope -- una cuenta (comprometida, o simplemente un script en loop) podía
-- mandar miles de mensajes por minuto y la cuota/costo de Gemini lo
-- pagábamos nosotros sin límite. Esta tabla + función llevan la cuenta de
-- cuántos mensajes mandó cada usuario HOY, para poder cortar en seco antes
-- de llamar a Gemini si se pasó del límite diario.
--
-- Cómo correrlo: pegar este archivo entero en el SQL Editor de Supabase y
-- ejecutarlo. Es seguro volver a correrlo (CREATE TABLE IF NOT EXISTS /
-- CREATE OR REPLACE) si hace falta ajustar algo después.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_usage (
  user_id uuid NOT NULL,
  usage_date date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- increment_chat_usage: suma 1 al contador de HOY para p_user_id (creando la
-- fila si no existía) en una sola operación atómica -- así dos requests que
-- lleguen al mismo tiempo no pueden leer el mismo valor viejo y "perder" un
-- incremento (la clave primaria + ON CONFLICT hace que Postgres serialice
-- las dos escrituras). Devuelve true si el usuario todavía está DENTRO del
-- límite (incluyendo este mensaje), false si ya lo superó -- el mensaje se
-- cuenta igual aunque devuelva false, para no darle vueltas de gratis a
-- alguien reintentando cuando ya se pasó.
CREATE OR REPLACE FUNCTION public.increment_chat_usage(p_user_id uuid, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.chat_usage (user_id, usage_date, count)
  VALUES (p_user_id, current_date, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET count = public.chat_usage.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;
