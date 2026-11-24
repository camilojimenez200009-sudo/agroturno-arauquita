# Resultados de pruebas

Resultados **reales** de la ejecución automatizada. Se regeneran ejecutando `npm test` y `npm run test:e2e`.

## Ficha de ejecución

| Dato | Valor |
|---|---|
| Fecha | 23 de noviembre de 2026 (hora de Bogotá) |
| Versión probada | rama `main`, commit `fdf740c` |
| Sistema | Linux x86_64 |
| Node.js / npm | 22.23.5 / 10.9.9 |
| PostgreSQL (pruebas locales) | 16.15 |
| Navegador e2e | Google Chrome 153 (escritorio 1366×860 y emulación móvil Pixel 7) |
| Datos | Cuentas, productos y solicitudes ficticias |
| Responsable | Equipo del proyecto AgroTurno Arauquita |

## Resumen

| Conjunto | Total | Aprobadas | Fallidas |
|---|---|---|---|
| API (Vitest + Supertest) | 53 | 53 | 0 |
| Extremo a extremo (Playwright) | 26 | 26 | 0 |
| Respaldo y restauración (T16) | 1 | 1 | 0 |

## Mediciones

**T15 · Rendimiento** (base local con 500 solicitudes adicionales; meta de referencia 3 000 ms):

| Consulta | Tiempo |
|---|---|
| Listado de 20 solicitudes | 13 ms |
| Filtro combinado (estado + rango de fechas + texto) | 10 ms |
| Resumen por estado | 5 ms |

Los tiempos son de la API local. En el entorno publicado se suman la latencia de red y el arranque en frío de la función; ver la sección «Verificación en el entorno publicado».

**T16 · Respaldo y restauración:** `scripts/respaldo.sh` generó un respaldo con 9 tablas con datos; `scripts/restaurar.sh` lo restauró en una base distinta y los conteos coincidieron (usuarios 4, productos 4, solicitudes 16, programaciones 6, historial 35).

## Verificación en el entorno publicado

Ejecutada el 23 de noviembre de 2026 contra https://agroturno-arauquita.vercel.app (Vercel + Supabase PostgreSQL 17, us-east-2), con cuentas ficticias.

| Verificación | Resultado |
|---|---|
| `/api/health` | `{"estado":"ok","base_de_datos":"ok"}` |
| Recorrido completo e2e (registro → programación → en proceso → completada → historial) | Aprobado (escritorio) |
| Acceso denegado a productor en Usuarios | Aprobado |
| Accesibilidad (axe) y teclado, escritorio y móvil | 16 de 16 aprobadas |
| Tiempos de respuesta de la API (3 muestras): listado de 20 / resumen / health | 0,19–0,49 s / 0,17–0,27 s / 0,19–0,24 s |
| Cookie de sesión | `HttpOnly; Secure; SameSite=Lax` |
| Cabeceras | HSTS, CSP, `nosniff`, `Cache-Control: no-store` |
| Petición de escritura sin cabecera anti-CSRF | Rechazada (403) |
| Acceso a las tablas por la API pública de Supabase | Sin acceso (esquema no expuesto) |

El recorrido dejó en producción la solicitud ficticia `AT-00001` (completada), visible en el tablero.

## Detalle · API

| Grupo | Caso | Resultado | ms |
|---|---|---|---|
| T01 · Autenticación (RF-01) | inicia sesión con credenciales válidas y entrega cookie HttpOnly | Aprobada | 46 |
| T01 · Autenticación (RF-01) | rechaza contraseña errónea con mensaje genérico | Aprobada | 7 |
| T01 · Autenticación (RF-01) | responde igual para un correo inexistente (no revela cuentas) | Aprobada | 168 |
| T01 · Autenticación (RF-01) | bloquea una cuenta desactivada | Aprobada | 5 |
| T01 · Autenticación (RF-01) | /auth/me devuelve identidad y rol; tras cerrar sesión la cookie deja de servir | Aprobada | 19 |
| T01 · Autenticación (RF-01) | sin sesión, las rutas protegidas responden 401 | Aprobada | 3 |
| T02 · Permisos por rol (RF-02, RN-04) | un productor no administra usuarios ni productos | Aprobada | 13 |
| T02 · Permisos por rol (RF-02, RN-04) | un coordinador no administra usuarios | Aprobada | 11 |
| T02 · Permisos por rol (RF-02, RN-04) | el administrador crea una cuenta y el cambio queda auditado | Aprobada | 179 |
| T02 · Permisos por rol (RF-02, RN-04) | desactivar una cuenta cierra sus sesiones abiertas | Aprobada | 349 |
| T02 · Permisos por rol (RF-02, RN-04) | rechaza contraseñas débiles y correos duplicados | Aprobada | 178 |
| T02 · Permisos por rol (RF-02, RN-04) | el administrador no puede desactivarse a sí mismo | Aprobada | 13 |
| T03 · Productores (RF-03) | el administrador registra un productor con su vereda y coordinación lo consulta | Aprobada | 200 |
| T03 · Productores (RF-03) | exige vereda para cuentas de productor | Aprobada | 10 |
| T03 · Productores (RF-03) | el productor consulta y actualiza solo su propio perfil | Aprobada | 13 |
| T04 · Catálogo de productos (RF-04) | lista solo productos activos para los usuarios | Aprobada | 12 |
| T04 · Catálogo de productos (RF-04) | el administrador agrega un producto con unidades coherentes | Aprobada | 23 |
| T04 · Catálogo de productos (RF-04) | un producto inactivo no se puede seleccionar en una solicitud | Aprobada | 47 |
| T05 · Registro de solicitudes (RF-05, RN-01 a RN-03) | campos válidos → 201, código legible, estado PENDIENTE y evento de creación | Aprobada | 85 |
| T05 · Registro de solicitudes (RF-05, RN-01 a RN-03) | datos inválidos → 422 con mensajes por campo y sin registros parciales | Aprobada | 27 |
| T05 · Registro de solicitudes (RF-05, RN-01 a RN-03) | rechaza fecha disponible en el pasado y unidad incoherente con el producto | Aprobada | 20 |
| T05 · Registro de solicitudes (RF-05, RN-01 a RN-03) | ignora cualquier productor_id enviado: el productor es el de la sesión | Aprobada | 11 |
| T05 · Registro de solicitudes (RF-05, RN-01 a RN-03) | coordinación no registra solicitudes a nombre de terceros | Aprobada | 8 |
| T06 · Consultas, filtros y permisos (RF-06, RN-08) | cada productor ve solo sus solicitudes; coordinación ve todas | Aprobada | 43 |
| T06 · Consultas, filtros y permisos (RF-06, RN-08) | los filtros por estado, producto, fecha y código se combinan | Aprobada | 31 |
| T06 · Consultas, filtros y permisos (RF-06, RN-08) | pagina resultados y limita el tamaño de página | Aprobada | 14 |
| T06 · Consultas, filtros y permisos (RF-06, RN-08) | los contadores del tablero respetan la autorización | Aprobada | 13 |
| T06 · Consultas, filtros y permisos (RF-06, RN-08) | el productor no recibe teléfonos de otros actores | Aprobada | 21 |
| T07 · Edición autorizada con historial (RF-07) | el productor edita su solicitud pendiente y el cambio queda en el historial | Aprobada | 30 |
| T07 · Edición autorizada con historial (RF-07) | otro productor no puede editarla y sin cambios no se registra nada | Aprobada | 27 |
| T07 · Edición autorizada con historial (RF-07) | el productor no edita una solicitud ya programada | Aprobada | 33 |
| T08 · Ubicación textual y coordenadas opcionales (RF-08, RN-07) | guarda una solicitud solo con texto y otra con coordenadas | Aprobada | 20 |
| T08 · Ubicación textual y coordenadas opcionales (RF-08, RN-07) | rechaza coordenadas incompletas, fuera de rango o sin texto | Aprobada | 15 |
| T08 · Ubicación textual y coordenadas opcionales (RF-08, RN-07) | coordinación corrige la ubicación y la corrección queda registrada | Aprobada | 31 |
| T09 · Programación de la atención (RF-09) | coordinación asigna fecha y franja; la solicitud pasa a PROGRAMADA | Aprobada | 101 |
| T09 · Programación de la atención (RF-09) | el productor no programa | Aprobada | 20 |
| T09 · Programación de la atención (RF-09) | no programa antes de la fecha disponible ni en el pasado | Aprobada | 26 |
| T09 · Programación de la atención (RF-09) | una reprogramación exige motivo y conserva fecha anterior y nueva (caso O03: lluvia) | Aprobada | 55 |
| T10 · Datos de transporte (RF-10) | asocia un contacto visible con teléfono solo para coordinación | Aprobada | 57 |
| T11 · Transiciones de estado (RF-11) | sigue la secuencia permitida y responde 409 ante saltos o retrocesos | Aprobada | 74 |
| T11 · Transiciones de estado (RF-11) | el productor no cambia estados | Aprobada | 20 |
| T11 · Transiciones de estado (RF-11) | dos cambios simultáneos no producen estados duplicados | Aprobada | 43 |
| T12 · Historial cronológico e inmutable (RF-12, RN-05, RN-06) | registra cada operación con fecha, usuario, acción y orden temporal | Aprobada | 56 |
| T12 · Historial cronológico e inmutable (RF-12, RN-05, RN-06) | la base impide modificar o borrar el historial y borrar solicitudes | Aprobada | 18 |
| T12 · Historial cronológico e inmutable (RF-12, RN-05, RN-06) | la API no expone ninguna ruta para borrar solicitudes | Aprobada | 27 |
| T15 · Rendimiento de consultas simples (meta de referencia: 3 s) | listado, filtro combinado y resumen responden por debajo de la meta | Aprobada | 74 |
| T18 · Seguridad | trata entradas con caracteres especiales como datos, no como SQL | Aprobada | 41 |
| T18 · Seguridad | rechaza peticiones que modifican datos sin la cabecera anti-CSRF o desde otro origen | Aprobada | 9 |
| T18 · Seguridad | una sesión vencida deja de ser válida | Aprobada | 16 |
| T18 · Seguridad | una cookie inventada no da acceso | Aprobada | 3 |
| T18 · Seguridad | las contraseñas y los tokens se guardan solo como hash | Aprobada | 9 |
| T18 · Seguridad | responde con cabeceras de seguridad y sin caché en la API | Aprobada | 3 |
| T18 · Seguridad | un identificador mal formado no revela detalles internos | Aprobada | 9 |

## Detalle · extremo a extremo

| Archivo | Caso | Dispositivo | Resultado | s |
|---|---|---|---|---|
| accesibilidad.spec.ts | inicio de sesión operable solo con teclado | escritorio | Aprobada | 1.9 |
| accesibilidad.spec.ts | inicio de sesión operable solo con teclado | movil | Aprobada | 1.7 |
| accesibilidad.spec.ts | los errores de validación se anuncian junto a cada campo | escritorio | Aprobada | 1.9 |
| accesibilidad.spec.ts | los errores de validación se anuncian junto a cada campo | movil | Aprobada | 1.9 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: inicio de sesión | escritorio | Aprobada | 1.9 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: inicio de sesión | movil | Aprobada | 2.1 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: tablero del productor | escritorio | Aprobada | 3.4 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: tablero del productor | movil | Aprobada | 3.2 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: nueva solicitud | escritorio | Aprobada | 2.9 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: nueva solicitud | movil | Aprobada | 2.7 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: tablero de coordinación | escritorio | Aprobada | 3.4 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: tablero de coordinación | movil | Aprobada | 3.2 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: programación | escritorio | Aprobada | 3.2 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: programación | movil | Aprobada | 3.2 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: usuarios | escritorio | Aprobada | 3.1 |
| accesibilidad.spec.ts | sin violaciones graves de accesibilidad: usuarios | movil | Aprobada | 2.9 |
| conectividad.spec.ts | si la API no responde al guardar, se informa el error y se conserva lo digitado | escritorio | Aprobada | 2.1 |
| conectividad.spec.ts | si la API no responde al guardar, se informa el error y se conserva lo digitado | movil | Aprobada | 2.0 |
| conectividad.spec.ts | sin conexión del navegador se muestra un aviso persistente | escritorio | Aprobada | 1.4 |
| conectividad.spec.ts | sin conexión del navegador se muestra un aviso persistente | movil | Aprobada | 1.3 |
| conectividad.spec.ts | si el servicio de mapas falla, la ubicación textual sigue disponible | escritorio | Aprobada | 3.3 |
| conectividad.spec.ts | si el servicio de mapas falla, la ubicación textual sigue disponible | movil | Aprobada | 2.6 |
| flujo-completo.spec.ts | recorrido completo de una solicitud entre productor y coordinador | escritorio | Aprobada | 5.1 |
| flujo-completo.spec.ts | recorrido completo de una solicitud entre productor y coordinador | movil | Aprobada | 4.8 |
| flujo-completo.spec.ts | un productor que abre una sección de administración ve acceso denegado | escritorio | Aprobada | 1.7 |
| flujo-completo.spec.ts | un productor que abre una sección de administración ve acceso denegado | movil | Aprobada | 1.7 |

## Defectos encontrados y corregidos durante las pruebas

| Prueba | Defecto | Corrección |
|---|---|---|
| T14 (mapa) | Si varias teselas fallaban a la vez, React agrupaba las actualizaciones, el contador saltaba el valor exacto esperado y el aviso «El mapa no está disponible» no aparecía. | Se usa un umbral (≥ 3 fallos) con aviso único. |
| T14 (sin conexión) | Si la red se perdía justo al montar la pantalla, el aviso de conexión no se mostraba. | El estado de red se sincroniza al registrar los eventos. |
| Recorrido e2e en móvil | La prueba abría el menú antes de que la barra estuviera lista (error de la prueba, no de la aplicación). | La prueba espera la barra y el enlace visibles. |

## Limitaciones de esta ejecución

- T13 se ejecutó con un solo motor de navegador (Chromium) en dos tamaños de pantalla. La verificación en un segundo navegador (Firefox o Safari) queda como prueba manual en el protocolo de validación.
- El límite de intentos de inicio de sesión se desactiva en las pruebas automatizadas para no interferir con ellas; se verifica manualmente.
- La revisión de accesibilidad con axe detecta problemas automáticos; no sustituye una prueba con lector de pantalla.
