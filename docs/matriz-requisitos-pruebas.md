# Matriz requisito → pantalla → API → prueba

Traza de cada requisito funcional hasta el código y la prueba que lo comprueba. Archivos de prueba de API en `backend/tests/` y de extremo a extremo en `frontend/tests/e2e/`.

| ID | Requisito | Pantalla | Servicio / API | Prueba automatizada |
|---|---|---|---|---|
| RF-01 | Autenticación | P01 Iniciar sesión | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | T01 (`t01-t04…`), e2e «inicio de sesión operable solo con teclado» |
| RF-02 | Usuarios y roles | P10 Usuarios y roles | `/usuarios`, middleware `requiereRol` | T02 (`t01-t04…`), e2e «acceso denegado» |
| RF-03 | Productores | P09 Productos y productores, Mi perfil | `/productores`, `/productores/me` | T03 (`t01-t04…`) |
| RF-04 | Productos | P09 Productos y productores | `/productos` | T04 (`t01-t04…`) |
| RF-05 | Crear solicitudes | P04 Nueva solicitud, P02 formulario lateral | `POST /solicitudes` → `services/solicitudes.crear` | T05 (`t05-t08…`), e2e «recorrido completo» |
| RF-06 | Consulta y filtros | P02 Tablero, P03 Mis solicitudes | `GET /solicitudes`, `GET /solicitudes/resumen` | T06 (`t05-t08…`) |
| RF-07 | Modificar solicitud | P05 Detalle → Editar | `PATCH /solicitudes/:id` → `editar` | T07 (`t05-t08…`) |
| RF-08 | Ubicación | P04, P05 (sección Ubicación) | Campos `ubicacion_texto`, `latitud`, `longitud` | T08 (`t05-t08…`), e2e T14 «servicio de mapas falla» |
| RF-09 | Programar atención | P06 Programación, P05 → Programar | `PUT /solicitudes/:id/programacion` → `programar` | T09 (`t09-t12…`), e2e «recorrido completo» |
| RF-10 | Datos de transporte | P06, P05 | `transporte` dentro de la programación | T10 (`t09-t12…`) |
| RF-11 | Cambiar estados | P07 Seguimiento, P05 | `PATCH /solicitudes/:id/estado` → `cambiarEstado` | T11 (`t09-t12…`), e2e «recorrido completo» |
| RF-12 | Historial | P05 Historial | `GET /solicitudes/:id/historial` | T12 (`t09-t12…`), e2e «recorrido completo» |

## Reglas de negocio

| Regla | Prueba |
|---|---|
| RN-01 Campos obligatorios, cantidad > 0 | T05 «datos inválidos → 422 … sin registros parciales» |
| RN-02 Identificador único | T05 «código legible» |
| RN-03 Estado inicial Pendiente | T05 |
| RN-04 Solo roles autorizados | T02, T09 «el productor no programa», T11 «el productor no cambia estados» |
| RN-05 Todo cambio genera historial | T07, T09, T12 |
| RN-06 Sin eliminación física | T12 «la base impide… borrar solicitudes», «la API no expone ninguna ruta para borrar» |
| RN-07 Ubicación textual sin coordenadas | T08 |
| RN-08 Datos personales por rol | T06 «el productor no recibe teléfonos», T10 |

## Requisitos no funcionales y pruebas complementarias

| Prueba | Enfoque | Dónde |
|---|---|---|
| T13 | Compatibilidad: dos tamaños de pantalla | Proyectos Playwright `escritorio` (1366×860) y `movil` (Pixel 7). Segundo navegador: verificación manual pendiente, ver [validacion-trl5.md](validacion-trl5.md). |
| T14 | Conectividad | `frontend/tests/e2e/conectividad.spec.ts` |
| T15 | Rendimiento (meta 3 s) | `backend/tests/t15-t18…` con 500 solicitudes adicionales |
| T16 | Respaldo y restauración | `scripts/respaldo.sh`, `scripts/restaurar.sh` |
| T17 | Accesibilidad | `frontend/tests/e2e/accesibilidad.spec.ts` (axe, WCAG 2.2 A/AA) |
| T18 | Seguridad | `backend/tests/t15-t18…` |
