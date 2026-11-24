# Arquitectura y decisiones técnicas

## Capas

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Presentación | React 19, TypeScript, Vite, React Router, Lucide, Leaflet | Formularios, tablas, filtros, historial, mapa opcional, mensajes de carga/error/éxito. |
| Aplicación | Node.js 22, Express 5, TypeScript, Zod, Helmet, express-rate-limit, bcryptjs | Autenticación, autorización por rol y propiedad, validación, reglas de negocio, transacciones, historial. |
| Persistencia | PostgreSQL (esquema `agroturno`) | Entidades, relaciones, restricciones `CHECK`/`NOT NULL`/`UNIQUE`, disparadores de integridad. |

La interfaz nunca accede a la base de datos: toda la información pasa por `/api`.

## Modelo de datos

```
usuarios 1──0..1 productores 1──* solicitudes *──1 productos
    │                               │
    │                               ├──0..1 programaciones 1──0..1 transportes
    │                               └──* historial_solicitudes
    ├──* sesiones
    └──* auditoria_usuarios
```

| Tabla | Propósito |
|---|---|
| `usuarios` | Cuenta, correo único (sin distinguir mayúsculas), hash bcrypt, rol, activo. |
| `sesiones` | Hash SHA-256 del token de sesión, vencimiento y revocación. |
| `auditoria_usuarios` | Altas, cambios de rol, activaciones y cambios de contraseña. |
| `productores` | Perfil asociado a la cuenta: nombre público, vereda, teléfono opcional. |
| `productos` | Catálogo con unidades permitidas y unidad por defecto. |
| `solicitudes` | UUID interno + consecutivo; código `AT-00001` generado por la base. |
| `programaciones` | Una por solicitud: fecha acordada, franja y coordinador. |
| `transportes` | Contacto asociado a una programación (no es un módulo de flotas). |
| `historial_solicitudes` | Eventos de solo inserción: acción, estados, detalle JSON, motivo, usuario, fecha. |

Archivos: [`backend/db/migraciones`](../backend/db/migraciones).

## Reglas de negocio e integridad

| Regla | Implementación |
|---|---|
| RN-01 Campos obligatorios y cantidad > 0 | Zod en la API + `NOT NULL`/`CHECK` en la base. |
| RN-02 Identificador único | `uuid` + consecutivo `UNIQUE` + código generado. |
| RN-03 Estado inicial Pendiente | `DEFAULT 'PENDIENTE'` y creación en el servicio. |
| RN-04 Solo roles autorizados programan o cambian estados | Middleware `requiereRol` y verificación en el servicio. |
| RN-05 Todo cambio de estado genera historial | Cambio e historial en la misma transacción (`BEGIN … COMMIT`). |
| RN-06 Sin eliminación física de solicitudes | La API no expone `DELETE`; disparador que lo impide en la base. |
| RN-07 La ubicación textual funciona sin coordenadas | Campo obligatorio; coordenadas opcionales y en pareja. |
| RN-08 Datos personales solo para roles necesarios | Filtro por propiedad en cada consulta; teléfonos omitidos para productores. |

Contrato de estados: `PENDIENTE → PROGRAMADA → EN_PROCESO → COMPLETADA`. El paso a *Programada* ocurre al registrar la programación. La reprogramación conserva el estado *Programada* y exige motivo. No hay retrocesos ni estado *Cancelada*. Las transacciones bloquean la fila (`SELECT … FOR UPDATE`), de modo que dos cambios simultáneos no producen estados duplicados.

## Seguridad

- Contraseñas con bcrypt (costo 11); tokens de sesión aleatorios de 256 bits guardados solo como hash.
- Cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción; sesión de 8 horas; cierre de sesión revoca el token.
- Cambio de rol, desactivación o nueva contraseña cierran las sesiones abiertas de la cuenta.
- Protección CSRF: toda operación que modifica datos exige la cabecera `X-Requested-With: AgroTurno` y un `Origin` coincidente.
- Límite de 10 intentos fallidos de inicio de sesión por IP cada 15 minutos.
- Consultas parametrizadas (`$1, $2…`), sin concatenar entradas.
- Helmet (CSP, `nosniff`, etc.), `Cache-Control: no-store` en la API, cuerpo JSON limitado a 50 kB.
- La API usa el rol `agroturno_app` con permisos mínimos: sin `DELETE` sobre solicitudes ni `UPDATE` sobre el historial. En Supabase, el esquema no es visible para los roles públicos `anon` y `authenticated`.

Referencia: OWASP ASVS 5.0.0 (selección priorizada; no se declara cumplimiento integral).

## Conectividad rural

- Interfaz ligera: el mapa (≈45 kB comprimidos) solo se descarga si el usuario lo abre.
- Tiempo límite de 20 s por petición; ante fallo se muestra «No se pudo conectar. Revisa tu conexión e inténtalo otra vez» y **nunca** se confirma un guardado.
- Lo digitado en un formulario se conserva si el guardado falla.
- Aviso persistente cuando el navegador pierde la conexión.
- Si las teselas del mapa no cargan, se avisa y la referencia textual sigue siendo válida.

No se implementa operación sin conexión con sincronización posterior: el documento maestro (sección 11.1) la deja fuera de esta fase.

## Accesibilidad

- Etiquetas asociadas a cada campo, errores junto al campo con `aria-invalid` y `aria-describedby`, foco en el primer error.
- Estados comunicados con texto, no solo con color; contraste verificado con la paleta de la guía.
- Navegación con teclado, enlace «Saltar al contenido», foco visible, objetivos táctiles de 44 px.
- Revisión automatizada con axe (WCAG 2.2 A/AA) en las pantallas principales.

## Despliegue

Ver [despliegue.md](despliegue.md).
