# API REST

Base: `/api`. Formato JSON. La sesión viaja en la cookie `agroturno_sesion` (HttpOnly).
Toda petición que modifica datos (`POST`, `PUT`, `PATCH`) debe incluir la cabecera `X-Requested-With: AgroTurno`.

## Errores

```json
{ "error": { "codigo": "VALIDACION", "mensaje": "Revisa los campos marcados.", "campos": { "cantidad": "La cantidad debe ser mayor que cero." } } }
```

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `SIN_CAMBIOS`, `JSON_INVALIDO` | Edición sin diferencias o cuerpo mal formado |
| 401 | `NO_AUTENTICADO`, `CREDENCIALES_INVALIDAS` | Sin sesión válida o datos de acceso incorrectos |
| 403 | `ACCESO_DENEGADO`, `CSRF`, `CUENTA_INACTIVA` | Rol sin permiso, petición sin cabecera o cuenta desactivada |
| 404 | `NO_ENCONTRADO` | No existe o no pertenece al usuario (no se revela cuál de los dos) |
| 409 | `CONFLICTO`, `TRANSICION_INVALIDA`, `DUPLICADO` | Regla de negocio o estado incompatible |
| 422 | `VALIDACION` | Datos que no cumplen las reglas |
| 429 | `DEMASIADOS_INTENTOS` | Más de 10 intentos fallidos de inicio de sesión en 15 min |

## Endpoints

| Método | Ruta | Roles | Propósito |
|---|---|---|---|
| GET | `/health` | público | Estado de la API y de la base (sin datos sensibles) |
| POST | `/auth/login` | público | `{correo, contrasena}` → cookie de sesión |
| POST | `/auth/logout` | sesión | Revoca la sesión |
| GET | `/auth/me` | sesión | Identidad, rol y perfil de productor |
| GET | `/productos` | sesión | Catálogo activo (`?incluirInactivos=true` solo administrador) |
| POST | `/productos` | Administrador | `{nombre, unidades[], unidad_defecto}` |
| PATCH | `/productos/:id` | Administrador | Edita nombre, unidades o `activo` |
| GET | `/productores` | Coordinador, Administrador | Lista con `?q=` y `?vereda=` |
| GET / PATCH | `/productores/me` | Productor | Perfil propio (vereda, teléfono) |
| PATCH | `/productores/:id` | Administrador | Edita un productor |
| GET | `/usuarios` | Administrador | Lista con `?rol=` y `?q=` |
| POST | `/usuarios` | Administrador | Alta; si el rol es Productor exige `vereda` |
| PATCH | `/usuarios/:id` | Administrador | Nombre, rol, `activo` o contraseña (auditado) |
| GET | `/usuarios/:id/auditoria` | Administrador | Registro de cambios de la cuenta |
| GET | `/solicitudes` | sesión | Filtros: `estado` (lista separada por comas), `producto_id`, `desde`, `hasta`, `q`, `pagina`, `tamano` (10/20/50), `orden` |
| GET | `/solicitudes/resumen` | sesión | Conteo por estado según autorización |
| POST | `/solicitudes` | Productor | Crea solicitud + evento de creación |
| GET | `/solicitudes/:id` | sesión | Detalle autorizado con `permisos` |
| PATCH | `/solicitudes/:id` | dueño (pendiente) o coordinación | Edita campos con historial; `motivo` opcional |
| PUT | `/solicitudes/:id/programacion` | Coordinador, Administrador | Programa o reprograma; `transporte` opcional |
| PATCH | `/solicitudes/:id/estado` | Coordinador, Administrador | `{estado, motivo?}` siguiente estado permitido |
| GET | `/solicitudes/:id/historial` | sesión con acceso | Eventos en orden cronológico |

## Ejemplos

Crear solicitud (el productor se toma de la sesión; un `productor_id` en el cuerpo se rechaza):

```http
POST /api/solicitudes
Content-Type: application/json
X-Requested-With: AgroTurno

{
  "producto_id": "UUID_DEL_PRODUCTO",
  "cantidad": 45,
  "unidad": "racimos",
  "ubicacion_texto": "Vereda de prueba, punto de referencia",
  "fecha_disponible": "2026-12-01",
  "latitud": null,
  "longitud": null,
  "notas": null
}
```

Respuesta `201 Created` con `Location: /api/solicitudes/{id}`:

```json
{ "id": "…", "codigo": "AT-00001", "estado": "PENDIENTE", "producto": { "nombre": "Plátano" }, "permisos": { "editar": true, "programar": false, "siguiente_estado": null }, "…": "…" }
```

Programar con transporte:

```http
PUT /api/solicitudes/{id}/programacion
{ "fecha_programada": "2026-12-02", "franja": "MANANA",
  "transporte": { "nombre_contacto": "Transportador de prueba", "telefono": "3000000000", "tipo_vehiculo": "Camión 350" } }
```

Reprogramar (motivo obligatorio si cambia fecha o franja):

```http
PUT /api/solicitudes/{id}/programacion
{ "fecha_programada": "2026-12-03", "franja": "MANANA", "motivo": "Aplazamiento de 24 h por lluvia" }
```

Cambiar estado:

```http
PATCH /api/solicitudes/{id}/estado
{ "estado": "EN_PROCESO" }
```
