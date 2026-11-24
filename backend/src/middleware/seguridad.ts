import type { RequestHandler } from 'express';
import { ErrorHttp } from '../utils/errores';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protección CSRF para una API con cookie de sesión:
 * toda operación que modifica datos debe enviar la cabecera X-Requested-With: AgroTurno.
 * Un formulario de otro sitio no puede añadir cabeceras personalizadas sin una
 * petición previa CORS, que esta API no autoriza. Además, si llega Origin, debe
 * coincidir con el host que atiende la petición.
 */
export const proteccionCsrf: RequestHandler = (req, _res, next) => {
  if (METODOS_SEGUROS.has(req.method)) return next();
  if (req.get('x-requested-with') !== 'AgroTurno') {
    return next(new ErrorHttp(403, 'CSRF', 'Petición rechazada por seguridad. Recarga la página e inténtalo de nuevo.'));
  }
  const origen = req.get('origin');
  if (origen) {
    try {
      const hostOrigen = new URL(origen).host;
      const hostPeticion = req.get('x-forwarded-host') ?? req.get('host');
      if (hostOrigen !== hostPeticion) {
        return next(new ErrorHttp(403, 'CSRF', 'Origen de la petición no permitido.'));
      }
    } catch {
      return next(new ErrorHttp(403, 'CSRF', 'Origen de la petición no válido.'));
    }
  }
  next();
};

/** Las respuestas de la API contienen datos de usuarios: no deben guardarse en cachés compartidas */
export const sinCache: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
