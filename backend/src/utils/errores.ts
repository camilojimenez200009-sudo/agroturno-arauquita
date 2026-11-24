import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class ErrorHttp extends Error {
  constructor(
    public estado: number,
    public codigo: string,
    mensaje: string,
    public campos?: Record<string, string>,
  ) {
    super(mensaje);
  }
}

export const noAutenticado = () =>
  new ErrorHttp(401, 'NO_AUTENTICADO', 'Tu sesión no está activa. Inicia sesión de nuevo.');
export const prohibido = (mensaje = 'No tienes permiso para realizar esta operación.') =>
  new ErrorHttp(403, 'ACCESO_DENEGADO', mensaje);
export const noEncontrado = (mensaje = 'No se encontró el registro solicitado.') =>
  new ErrorHttp(404, 'NO_ENCONTRADO', mensaje);
export const conflicto = (mensaje: string) => new ErrorHttp(409, 'CONFLICTO', mensaje);
export const invalido = (mensaje: string, campos?: Record<string, string>) =>
  new ErrorHttp(422, 'VALIDACION', mensaje, campos);

export function camposDesdeZod(error: ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of error.issues) {
    const ruta = problema.path.join('.') || 'general';
    if (!campos[ruta]) campos[ruta] = problema.message;
  }
  return campos;
}

export const rutaNoEncontrada: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'La ruta solicitada no existe.' } });
};

export const manejadorErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ErrorHttp) {
    res.status(error.estado).json({
      error: { codigo: error.codigo, mensaje: error.message, ...(error.campos ? { campos: error.campos } : {}) },
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(422).json({
      error: { codigo: 'VALIDACION', mensaje: 'Revisa los campos marcados.', campos: camposDesdeZod(error) },
    });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es JSON válido.' } });
    return;
  }
  // Violaciones de restricciones de PostgreSQL
  if (error?.code === '23505') {
    res.status(409).json({ error: { codigo: 'DUPLICADO', mensaje: 'Ya existe un registro con esos datos.' } });
    return;
  }
  if (error?.code === '23514' || error?.code === '22P02' || error?.code === '22007' || error?.code === '22008') {
    res.status(422).json({ error: { codigo: 'VALIDACION', mensaje: 'Los datos no cumplen las reglas del sistema.' } });
    return;
  }
  console.error('[api] error no controlado', error);
  res.status(500).json({
    error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Inténtalo de nuevo en unos minutos.' },
  });
};
