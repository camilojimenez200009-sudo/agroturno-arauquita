-- AgroTurno Arauquita · Esquema relacional inicial
-- Ejecutar como propietario de la base de datos.
-- Todas las tablas viven en el esquema "agroturno", separado de "public".

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS agroturno;
SET search_path = agroturno, public;

-- ---------------------------------------------------------------
-- Usuarios y sesiones (RF-01, RF-02)
-- ---------------------------------------------------------------
CREATE TABLE usuarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          varchar(120) NOT NULL CHECK (length(trim(nombre)) >= 3),
  correo          varchar(160) NOT NULL,
  hash_contrasena text NOT NULL,
  rol             varchar(20) NOT NULL CHECK (rol IN ('PRODUCTOR', 'COORDINADOR', 'ADMINISTRADOR')),
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_correo_unico ON usuarios (lower(correo));

CREATE TABLE sesiones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  char(64) NOT NULL UNIQUE,
  expira_en   timestamptz NOT NULL,
  creada_en   timestamptz NOT NULL DEFAULT now(),
  revocada_en timestamptz
);
CREATE INDEX sesiones_usuario_idx ON sesiones (usuario_id);

-- Registro de operaciones administrativas sobre cuentas (alta, rol, activación)
CREATE TABLE auditoria_usuarios (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES usuarios(id),
  usuario_id  uuid NOT NULL REFERENCES usuarios(id),
  accion      varchar(40) NOT NULL,
  detalle     jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_usuarios_usuario_idx ON auditoria_usuarios (usuario_id, creado_en);

-- ---------------------------------------------------------------
-- Productores y productos (RF-03, RF-04)
-- ---------------------------------------------------------------
CREATE TABLE productores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     uuid UNIQUE REFERENCES usuarios(id),
  nombre_publico varchar(120) NOT NULL,
  telefono       varchar(30),
  vereda         varchar(120) NOT NULL CHECK (length(trim(vereda)) >= 2),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE productos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          varchar(80) NOT NULL,
  unidad_defecto  varchar(30) NOT NULL,
  unidades        text[] NOT NULL,
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT productos_unidad_defecto_valida CHECK (unidad_defecto = ANY (unidades)),
  CONSTRAINT productos_unidades_no_vacias CHECK (cardinality(unidades) >= 1)
);
CREATE UNIQUE INDEX productos_nombre_unico ON productos (lower(nombre));

-- ---------------------------------------------------------------
-- Solicitudes (RF-05 a RF-08, RN-01 a RN-03, RN-07)
-- ---------------------------------------------------------------
CREATE SEQUENCE solicitudes_consecutivo_seq START 1;

CREATE TABLE solicitudes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consecutivo      integer NOT NULL UNIQUE DEFAULT nextval('solicitudes_consecutivo_seq'),
  codigo           varchar(12) GENERATED ALWAYS AS ('AT-' || lpad(consecutivo::text, 5, '0')) STORED,
  productor_id     uuid NOT NULL REFERENCES productores(id),
  producto_id      uuid NOT NULL REFERENCES productos(id),
  cantidad         numeric(12,2) NOT NULL CHECK (cantidad > 0),
  unidad           varchar(30) NOT NULL,
  ubicacion_texto  varchar(250) NOT NULL CHECK (length(trim(ubicacion_texto)) >= 5),
  latitud          numeric(9,6) CHECK (latitud BETWEEN -90 AND 90),
  longitud         numeric(9,6) CHECK (longitud BETWEEN -180 AND 180),
  fecha_disponible date NOT NULL,
  notas            varchar(500),
  estado           varchar(20) NOT NULL DEFAULT 'PENDIENTE'
                   CHECK (estado IN ('PENDIENTE', 'PROGRAMADA', 'EN_PROCESO', 'COMPLETADA')),
  creado_por       uuid NOT NULL REFERENCES usuarios(id),
  creada_en        timestamptz NOT NULL DEFAULT now(),
  actualizada_en   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT solicitudes_coordenadas_completas CHECK ((latitud IS NULL) = (longitud IS NULL))
);
ALTER SEQUENCE solicitudes_consecutivo_seq OWNED BY solicitudes.consecutivo;
CREATE UNIQUE INDEX solicitudes_codigo_unico ON solicitudes (codigo);
CREATE INDEX solicitudes_productor_idx ON solicitudes (productor_id, creada_en DESC);
CREATE INDEX solicitudes_estado_idx ON solicitudes (estado);
CREATE INDEX solicitudes_producto_idx ON solicitudes (producto_id);
CREATE INDEX solicitudes_fecha_idx ON solicitudes (fecha_disponible);

-- ---------------------------------------------------------------
-- Programación y transporte (RF-09, RF-10)
-- ---------------------------------------------------------------
CREATE TABLE programaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id     uuid NOT NULL UNIQUE REFERENCES solicitudes(id),
  fecha_programada date NOT NULL,
  franja           varchar(20) NOT NULL CHECK (franja IN ('MANANA', 'TARDE', 'JORNADA_COMPLETA')),
  coordinador_id   uuid NOT NULL REFERENCES usuarios(id),
  creada_en        timestamptz NOT NULL DEFAULT now(),
  actualizada_en   timestamptz NOT NULL DEFAULT now()
);

-- Datos de transporte asociados a una programación. No es un módulo de flotas.
CREATE TABLE transportes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programacion_id  uuid NOT NULL UNIQUE REFERENCES programaciones(id),
  nombre_contacto  varchar(120) NOT NULL,
  telefono         varchar(30),
  tipo_vehiculo    varchar(60),
  observaciones    varchar(300),
  actualizado_en   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- Historial (RF-12, RN-05): solo inserción, nunca se actualiza
-- ---------------------------------------------------------------
CREATE TABLE historial_solicitudes (
  id              bigserial PRIMARY KEY,
  solicitud_id    uuid NOT NULL REFERENCES solicitudes(id),
  usuario_id      uuid NOT NULL REFERENCES usuarios(id),
  accion          varchar(30) NOT NULL
                  CHECK (accion IN ('CREACION', 'EDICION', 'PROGRAMACION', 'REPROGRAMACION', 'TRANSPORTE', 'CAMBIO_ESTADO')),
  estado_anterior varchar(20),
  estado_nuevo    varchar(20),
  detalle         jsonb NOT NULL DEFAULT '{}'::jsonb,
  motivo          varchar(300),
  creado_en       timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX historial_solicitud_idx ON historial_solicitudes (solicitud_id, id);

CREATE FUNCTION historial_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'El historial de solicitudes no admite modificaciones ni borrados';
END;
$$;
CREATE TRIGGER historial_sin_cambios
  BEFORE UPDATE OR DELETE ON historial_solicitudes
  FOR EACH ROW EXECUTE FUNCTION historial_inmutable();

-- RN-06: las solicitudes no se eliminan físicamente
CREATE FUNCTION solicitudes_sin_borrado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Las solicitudes no se eliminan; su estado e historial se conservan';
END;
$$;
CREATE TRIGGER solicitudes_no_eliminar
  BEFORE DELETE ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION solicitudes_sin_borrado();

COMMIT;
