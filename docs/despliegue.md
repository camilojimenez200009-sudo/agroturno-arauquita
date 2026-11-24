# Despliegue

Producción: **Vercel** (interfaz estática + API como función serverless) y **Supabase** (PostgreSQL administrado).

## 1. Base de datos en Supabase

1. Aplique `backend/db/migraciones/001_esquema_inicial.sql` desde el editor SQL (o con `npm --workspace backend run db:migrar` usando la cadena del propietario en `DATABASE_URL_ADMIN`).
2. Cree el rol de la aplicación con una contraseña robusta (no la guarde en el repositorio):

   ```sql
   CREATE ROLE agroturno_app LOGIN PASSWORD '...' NOINHERIT;
   ```

3. Aplique `002_permisos_rol_aplicacion.sql`: concede permisos mínimos, fija el `search_path` del rol y retira el acceso de los roles públicos `anon` y `authenticated` al esquema `agroturno`.
4. Cargue el catálogo y las cuentas ficticias con `npm --workspace backend run db:semilla` (la contraseña de las cuentas se toma de `SEMILLA_CONTRASENA`).

La API se conecta por el **pooler de transacciones** (puerto 6543), que es el adecuado para funciones serverless. El usuario lleva el sufijo del proyecto:

```
postgres://agroturno_app.<ref-del-proyecto>:<contraseña>@<host-del-pooler>:6543/postgres
```

## 2. Proyecto en Vercel

1. Importe el repositorio en Vercel (*Framework preset*: Other). `vercel.json` ya define la instalación, la compilación, la carpeta `frontend/dist`, la función `api/index.ts` y las reescrituras.
2. Variables de entorno (Production y Preview):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Cadena del pooler con el rol `agroturno_app` |
| `DB_SSL` | `true` |
| `DB_MAX_CONEXIONES` | `3` |
| `SESION_HORAS` | `8` |

3. Despliegue y verifique `https://<dominio>/api/health` → `{"estado":"ok","base_de_datos":"ok"}`.

Cada `push` a `main` genera un nuevo despliegue de producción.

## 3. Verificación posterior

- Iniciar sesión con cada rol de prueba.
- Recorrido completo: registrar, programar, reprogramar, iniciar, completar y revisar el historial.
- Revisar en Supabase los avisos de seguridad (*Advisors*).

## Respaldo

Además de los respaldos automáticos del proveedor, `scripts/respaldo.sh` genera un archivo `pg_dump` del esquema y `scripts/restaurar.sh` lo restaura en otra base y compara los conteos.
