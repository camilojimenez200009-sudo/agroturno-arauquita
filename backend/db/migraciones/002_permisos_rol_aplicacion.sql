-- Permisos mínimos para el rol con el que se conecta la API.
-- El rol "agroturno_app" se crea por fuera del repositorio con una contraseña
-- robusta (ver docs/despliegue.md). Este script solo asigna permisos.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agroturno_app') THEN
    RAISE EXCEPTION 'Primero cree el rol agroturno_app (ver docs/despliegue.md)';
  END IF;
END $$;

GRANT USAGE ON SCHEMA agroturno TO agroturno_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA agroturno TO agroturno_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA agroturno TO agroturno_app;
-- Solo las sesiones pueden borrarse (limpieza de sesiones vencidas)
GRANT DELETE ON agroturno.sesiones TO agroturno_app;
-- Retirar el contacto de transporte de una programación (queda registrado en el historial)
GRANT DELETE ON agroturno.transportes TO agroturno_app;
-- El historial solo admite lectura e inserción
REVOKE UPDATE ON agroturno.historial_solicitudes FROM agroturno_app;

ALTER ROLE agroturno_app SET search_path = agroturno, public;

-- En Supabase, los roles de la API pública no deben ver este esquema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA agroturno FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA agroturno FROM anon, authenticated';
  END IF;
END $$;

COMMIT;
