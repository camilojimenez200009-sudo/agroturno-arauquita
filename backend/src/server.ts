import { crearApp } from './app';

const puerto = Number(process.env.PORT ?? 3000);

crearApp().listen(puerto, () => {
  console.log(`API de AgroTurno escuchando en http://localhost:${puerto}/api`);
});
