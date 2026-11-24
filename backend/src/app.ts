import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { consulta } from './db/pool';
import { proteccionCsrf, sinCache } from './middleware/seguridad';
import { rutasAuth } from './routes/auth';
import { rutasProductores } from './routes/productores';
import { rutasProductos } from './routes/productos';
import { rutasSolicitudes } from './routes/solicitudes';
import { rutasUsuarios } from './routes/usuarios';
import { manejadorErrores, rutaNoEncontrada } from './utils/errores';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  // Detrás del proxy de Vercel o de un balanceador: necesario para IP real y cookies Secure
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(sinCache);
  api.use(proteccionCsrf);

  // Comprobación de estado sin datos sensibles
  api.get('/health', async (_req, res) => {
    const inicio = Date.now();
    try {
      await consulta('SELECT 1');
      res.json({ estado: 'ok', base_de_datos: 'ok', latencia_ms: Date.now() - inicio });
    } catch {
      res.status(503).json({ estado: 'degradado', base_de_datos: 'sin conexión' });
    }
  });

  api.use('/auth', rutasAuth);
  api.use('/productos', rutasProductos);
  api.use('/productores', rutasProductores);
  api.use('/usuarios', rutasUsuarios);
  api.use('/solicitudes', rutasSolicitudes);
  api.use(rutaNoEncontrada);

  app.use('/api', api);
  app.use(manejadorErrores);
  return app;
}
