# Bitácora de cambios

Registro de los incrementos según el plan de la guía técnica (capítulo 22). Fechas reales de trabajo.

| Fecha | Incremento | Resultado | Commit |
|---|---|---|---|
| 2026-11-23 | 0. Preparación | Estructura del repositorio, esquema relacional, rol de aplicación, migraciones y semilla ficticia. | `46cd5e4` |
| 2026-11-23 | 1–4. Identidades, núcleo, coordinación y seguimiento (API) | RF-01 a RF-12 en la API con validación, transacciones e historial. | `fc4fd7f` |
| 2026-11-23 | 1–4. Interfaz | Pantallas P01 a P10, identidad visual, diseño adaptable y mapa opcional. | `2359244` |
| 2026-11-23 | 5. Validación técnica | 53 pruebas de API, 26 de extremo a extremo, respaldo/restauración; dos defectos corregidos. | `bf4bc14` |
| 2026-11-23 | 5. Despliegue | Configuración de Vercel; base en Supabase con permisos mínimos. | `fdf740c` |
| 2026-11-23 | 5. Publicación | Sitio publicado en https://agroturno-arauquita.vercel.app y verificado (recorrido, accesibilidad, seguridad). | este commit |

## Pendientes

- Sesión de validación con participantes en el entorno publicado ([validacion-trl5.md](validacion-trl5.md)).
- Verificación manual en un segundo navegador (T13).
- Grabación del video de demostración (máximo 10 minutos, con cámara activa).
