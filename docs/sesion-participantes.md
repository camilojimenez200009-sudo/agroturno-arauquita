# Sesión de validación con participantes

Material para ejecutar y documentar la etapa E del protocolo TRL 5 ([validacion-trl5.md](validacion-trl5.md)). La evaluación se hace **por fuera de la aplicación**: la app solo se usa para realizar las tareas; las respuestas se registran en papel, en un formulario externo o en [plantillas/registro-tareas.csv](plantillas/registro-tareas.csv).

> Los resultados deben ser los observados en la sesión. No complete fichas ni puntajes antes de ejecutarla.

## 1. Preparación (30 min antes)

| Ítem | Detalle |
|---|---|
| Participantes | Mínimo 5 (recomendado 3 productores y 2 personas en rol de coordinación). Pueden ser participantes del diagnóstico de la Fase 3 con autorización. |
| Equipos | Al menos un teléfono Android y un computador. Anotar modelo, navegador y versión. |
| Red | Primera ronda con la red real del lugar; anotar tipo (datos móviles, wifi) y calidad aparente. |
| Cuentas | `productor.a@agroturno.test`, `productor.b@agroturno.test`, `coordinador@agroturno.test`. Contraseña entregada en privado por el equipo. |
| Datos | Solo ficticios: no registrar fincas, teléfonos ni nombres reales en la aplicación. |
| Versión | Anotar el commit publicado (`/api/health` responde y el último commit de `main`). |
| Grabación | Solo pantalla y voz, con autorización. La guía exige cámara activa en el video de socialización, no en esta sesión. |

## 2. Consentimiento (leer en voz alta)

> «Estamos probando AgroTurno Arauquita, un prototipo para coordinar la recolección y el transporte de productos agrícolas. Evaluamos la aplicación, no a usted. La participación es voluntaria y puede retirarse en cualquier momento. No registraremos su nombre ni datos personales en la aplicación; usaremos cuentas y datos de prueba. Sus respuestas se usarán de forma anónima en el proyecto de grado, conforme a la Ley 1581 de 2012. ¿Está de acuerdo en participar?»

Registrar: código del participante (P01, P02…), rol simulado, fecha y la respuesta (sí/no). No anotar nombres en las planillas de resultados.

## 3. Guion del facilitador

- No explique cómo hacer la tarea; lea el enunciado y observe.
- Si la persona se bloquea más de 2 minutos, ofrezca una ayuda y anótela como «ayuda».
- Pida que piense en voz alta y anote frases textuales relevantes.
- Mida el tiempo desde que termina de leer el enunciado hasta que la persona dice «listo».

## 4. Tareas

### Rol Productor

| Tarea | Enunciado para el participante | Criterio de éxito | Requisito |
|---|---|---|---|
| TP1 | «Ingrese a la aplicación con la cuenta que le entregamos.» | Llega al Inicio | RF-01 |
| TP2 | «Tiene 45 racimos de plátano listos desde mañana en la vereda La Reinera, junto a la escuela. Pida que se los recojan.» | Solicitud guardada; anota el código `AT-…` | RF-05, RF-08 |
| TP3 | «Busque la solicitud que acaba de hacer y diga en qué estado está.» | Encuentra la solicitud y dice «Pendiente» | RF-06 |
| TP4 | «Se equivocó: eran 50 racimos. Corríjalo.» | Cantidad editada | RF-07 |
| TP5 | (después de TC3) «Revise si ya le programaron la recogida y cuándo.» | Lee fecha y franja | RF-09, RF-12 |

### Rol Coordinador

| Tarea | Enunciado | Criterio de éxito | Requisito |
|---|---|---|---|
| TC1 | «Ingrese y diga cuántas solicitudes están pendientes.» | Lee el contador correcto | RF-06 |
| TC2 | «Programe la solicitud del productor para pasado mañana en la mañana con el transportador "Transportes de prueba".» | Estado Programada con transporte | RF-09, RF-10 |
| TC3 | «Llovió y la vía está mala: aplace la recolección un día.» | Reprogramada con motivo | RF-09, RF-12 (caso O03) |
| TC4 | «El camión llegó: marque que la recolección empezó y luego que terminó.» | Estado Completada | RF-11 |
| TC5 | «Muestre quién y cuándo cambió la fecha.» | Señala el evento en el historial | RF-12 |

### Conectividad (una vez por equipo)

| Tarea | Procedimiento | Criterio |
|---|---|---|
| TR1 | En el teléfono, activar modo avión con el formulario lleno y pulsar «Registrar solicitud». | Aparece «No se pudo conectar…», no aparece «Solicitud guardada» y lo escrito se conserva. |
| TR2 | Desactivar modo avión y volver a pulsar. | Se guarda una sola solicitud. |
| TR3 | En computador: DevTools → Network → *Slow 4G* y repetir TP2. | Guarda; anotar tiempo. |

## 5. Cuestionario de usabilidad (SUS) — al final, en papel o formulario

Escala 1 (totalmente en desacuerdo) a 5 (totalmente de acuerdo):

1. Creo que me gustaría usar esta aplicación con frecuencia.
2. Encontré la aplicación innecesariamente compleja.
3. Pensé que la aplicación era fácil de usar.
4. Creo que necesitaría ayuda de una persona técnica para poder usarla.
5. Encontré que las funciones de la aplicación estaban bien integradas.
6. Pensé que había demasiada inconsistencia en la aplicación.
7. Imagino que la mayoría de las personas aprenderían a usarla muy rápido.
8. Encontré la aplicación muy complicada de usar.
9. Me sentí muy seguro(a) usando la aplicación.
10. Necesité aprender muchas cosas antes de poder usar la aplicación.

**Cálculo:** ítems impares → (respuesta − 1); ítems pares → (5 − respuesta). Sume y multiplique por 2,5. Resultado de 0 a 100; 68 es la referencia promedio habitual.

Preguntas abiertas: ¿Qué fue lo más difícil? ¿Qué le cambiaría? ¿Usaría esto en lugar de llamadas o notas de voz? ¿Por qué?

## 6. Análisis y reporte

1. Tasa de éxito por tarea = tareas completadas sin ayuda / participantes.
2. Tiempo mediano por tarea.
3. SUS promedio y rango.
4. Problemas observados, clasificados por gravedad (bloqueante, mayor, menor) y la corrección propuesta.
5. Criterio sugerido para declarar TRL 5: todas las tareas críticas (TP2, TC2, TC4, TC5, TR1) completadas por al menos el 80 % de los participantes y ningún problema bloqueante abierto.
6. Actualizar [validacion-trl5.md](validacion-trl5.md) (etapa E) con los resultados reales y, si hubo correcciones, registrarlas en la [bitácora](bitacora.md).
