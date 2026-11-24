// Punto de entrada de la API como función serverless en Vercel.
// Todas las rutas /api/* se redirigen aquí desde vercel.json.
import { crearApp } from '../backend/src/app';

export default crearApp();
