# Validación TRL 5: protocolo y estado

TRL 5 significa **validar los componentes en un entorno relevante** para el uso previsto, con más exigencia que una prueba aislada. No basta con que el prototipo se vea bien ni con tener un repositorio: la afirmación «AgroTurno alcanzó TRL 5» solo debe hacerse cuando la evidencia muestre que las funciones críticas se validaron en el entorno definido. Si la validación es solo local, se debe declarar una madurez menor o una validación pendiente.

## Entorno relevante definido

| Elemento | Definición para AgroTurno |
|---|---|
| Despliegue | Aplicación publicada en https://agroturno-arauquita.vercel.app (Vercel interfaz + API serverless) con PostgreSQL administrado en Supabase, accesible por HTTPS desde cualquier red. |
| Dispositivos | Teléfono Android de gama media y computador de escritorio o portátil. |
| Navegadores | Chrome (Chromium) en escritorio y Android; Firefox (Gecko) en escritorio; Safari (WebKit) en iPhone. |
| Conectividad | Red real del evaluador y red simulada lenta o desconectada (DevTools: *Slow 4G* y *Offline*), coherente con el diagnóstico P20: 22 de 30 participantes sin conectividad consistentemente estable. |
| Roles | Productor A, Productor B, Coordinador y Administrador, con cuentas ficticias. |
| Datos | Productos del diagnóstico (plátano, cacao, yuca, maíz), veredas de la Tabla 36 y ubicaciones ficticias. Nunca datos reales de fincas ni teléfonos personales. |

## Etapas y estado

| Etapa | Actividad verificable | Artefacto | Estado |
|---|---|---|---|
| A. Definir entorno | Tabla anterior | Este documento | Hecho |
| B. Preparar compilación | Versión en `main`, migraciones, semilla, servicios en ejecución | Repositorio, README, URL publicada | Hecho |
| C. Ejecutar flujos | Registro → consulta → programación → cambio → historial → cierre | Pruebas T01–T12 automatizadas ([resultados](resultados-pruebas.md)); recorrido e2e en escritorio y móvil | Hecho (automatizado). Pendiente: grabación del recorrido en el entorno publicado para el video |
| D. Probar restricciones | Rol equivocado, validación, red lenta, mapa no disponible, restauración, varios navegadores | T13–T18 automatizadas | Hecho (T13 en Chromium, Firefox y WebKit; ver abajo) |
| E. Analizar | Comparar criterios con resultados, defectos, mitigaciones y límites | [resultados-pruebas.md](resultados-pruebas.md) | Parcial: falta la sesión con participantes ([material listo](sesion-participantes.md)) |

## T13 · Compatibilidad en varios navegadores (ejecutada el 23-11-2026)

| Motor / dispositivo | Entorno local (13 pruebas: recorrido completo, conectividad, accesibilidad, 403) | Sitio publicado |
|---|---|---|
| Chromium · escritorio 1366×860 | 13/13 | Recorrido completo, 403 y accesibilidad: aprobadas |
| Chromium · Android (Pixel 7) | 13/13 | Accesibilidad: aprobadas |
| Firefox · escritorio 1366×860 | 13/13 | No ejecutable desde el entorno de pruebas (*) |
| Safari WebKit · iPhone 13 | 13/13 | Accesibilidad, teclado, validación y 403: 9/9 aprobadas |

(*) El entorno de pruebas sale a internet por un proxy con certificado propio que Firefox no reconoce (`SEC_ERROR_UNKNOWN_ISSUER`). Es una limitación del entorno de pruebas, no de la aplicación; la verificación TLS no se desactivó. Se recomienda abrir el sitio en Firefox durante la sesión con participantes y anotarlo en la ficha.

En el sitio publicado no se repitió el recorrido que crea solicitudes en Firefox y Safari, para no llenar la base de demostración con datos de prueba; ese recorrido sí se ejecutó completo en local con ambos motores y en producción con Chromium.

## Sesión de validación con participantes (por fuera de la aplicación)

Guion, consentimiento, tareas con criterios de éxito, cuestionario SUS y plantillas: **[sesion-participantes.md](sesion-participantes.md)**. Resumen:

La evaluación con participantes se registra fuera del prototipo (formulario o acta), no dentro de la aplicación.

1. Entregar a cada participante una cuenta ficticia según su rol.
2. Tareas para el **Productor**: iniciar sesión; registrar una solicitud de 45 racimos de plátano con la vereda y un punto de referencia; consultar su estado; revisar el historial.
3. Tareas para el **Coordinador**: encontrar la solicitud por su código; programarla con contacto de transporte; reprogramarla por lluvia con motivo (caso O03); pasarla a *En proceso* y a *Completada*.
4. Repetir el registro con la red en *Slow 4G* y luego en *Offline*: confirmar que la aplicación avisa y **no** confirma un guardado falso.
5. Registrar por tarea: completó sí/no, tiempo, errores, ayudas requeridas y observaciones.

### Ficha por ejecución (copiar por caso)

| Campo | Valor |
|---|---|
| Identificador / requisito | |
| Fecha y hora | |
| Versión (commit) | |
| Dispositivo, navegador y tamaño de pantalla | |
| Conectividad (real o simulada) | |
| Participante (rol, sin datos personales) | |
| Pasos | |
| Resultado esperado | |
| Resultado obtenido | |
| Aprobado / fallido | |
| Evidencia (captura o registro) | |
| Responsable | |

> No marque «Aprobado» antes de ejecutar el caso. Los resultados deben ser los observados.

## Conclusión actual

Las funciones críticas (RF-01 a RF-12 y las reglas RN-01 a RN-08) superaron pruebas automatizadas de API y de interfaz, incluidas las de conectividad degradada, permisos, concurrencia, accesibilidad automatizada y respaldo, en tres motores de navegador (Chromium, Firefox y WebKit). El prototipo está publicado en un entorno accesible desde la red. **La validación TRL 5 se completará** cuando se ejecute y documente la sesión con participantes en el entorno publicado. Hasta entonces, lo correcto es describir el estado como «prototipo funcional validado técnicamente; validación con usuarios en curso».
