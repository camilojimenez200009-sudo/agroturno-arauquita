# Validación TRL 5: protocolo y estado

TRL 5 significa **validar los componentes en un entorno relevante** para el uso previsto, con más exigencia que una prueba aislada. No basta con que el prototipo se vea bien ni con tener un repositorio: la afirmación «AgroTurno alcanzó TRL 5» solo debe hacerse cuando la evidencia muestre que las funciones críticas se validaron en el entorno definido. Si la validación es solo local, se debe declarar una madurez menor o una validación pendiente.

## Entorno relevante definido

| Elemento | Definición para AgroTurno |
|---|---|
| Despliegue | Aplicación publicada en https://agroturno-arauquita.vercel.app (Vercel interfaz + API serverless) con PostgreSQL administrado en Supabase, accesible por HTTPS desde cualquier red. |
| Dispositivos | Teléfono Android de gama media y computador de escritorio o portátil. |
| Navegadores | Chrome en Android y en escritorio; un segundo navegador (Firefox o Edge). |
| Conectividad | Red real del evaluador y red simulada lenta o desconectada (DevTools: *Slow 4G* y *Offline*), coherente con el diagnóstico P20: 22 de 30 participantes sin conectividad consistentemente estable. |
| Roles | Productor A, Productor B, Coordinador y Administrador, con cuentas ficticias. |
| Datos | Productos del diagnóstico (plátano, cacao, yuca, maíz), veredas de la Tabla 36 y ubicaciones ficticias. Nunca datos reales de fincas ni teléfonos personales. |

## Etapas y estado

| Etapa | Actividad verificable | Artefacto | Estado |
|---|---|---|---|
| A. Definir entorno | Tabla anterior | Este documento | Hecho |
| B. Preparar compilación | Versión en `main`, migraciones, semilla, servicios en ejecución | Repositorio, README, URL publicada | Hecho |
| C. Ejecutar flujos | Registro → consulta → programación → cambio → historial → cierre | Pruebas T01–T12 automatizadas ([resultados](resultados-pruebas.md)); recorrido e2e en escritorio y móvil | Hecho (automatizado). Pendiente: grabación del recorrido en el entorno publicado para el video |
| D. Probar restricciones | Rol equivocado, validación, red lenta, mapa no disponible, restauración | T13–T18 automatizadas | Hecho, salvo segundo navegador (manual) |
| E. Analizar | Comparar criterios con resultados, defectos, mitigaciones y límites | [resultados-pruebas.md](resultados-pruebas.md) | Parcial: falta la sesión con participantes |

## Sesión de validación con participantes (por fuera de la aplicación)

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

Las funciones críticas (RF-01 a RF-12 y las reglas RN-01 a RN-08) superaron pruebas automatizadas de API y de interfaz, incluidas las de conectividad degradada, permisos, concurrencia, accesibilidad automatizada y respaldo. El prototipo está publicado en un entorno accesible desde la red. **La validación TRL 5 se completará** cuando se ejecute y documente la sesión con participantes en el entorno publicado y la verificación en un segundo navegador. Hasta entonces, lo correcto es describir el estado como «prototipo funcional validado técnicamente; validación con usuarios en curso».
