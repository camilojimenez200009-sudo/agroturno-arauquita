import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { config } from '../config';
import { usuarioPorToken, type Rol, type UsuarioSesion } from '../services/sesiones';
import { noAutenticado, prohibido } from '../utils/errores';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
    }
  }
}

/** Exige una sesión válida (cookie HttpOnly) y deja el usuario en req.usuario */
export const requiereSesion: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[config.nombreCookie];
  if (!token || typeof token !== 'string') return next(noAutenticado());
  const usuario = await usuarioPorToken(token);
  if (!usuario) return next(noAutenticado());
  req.usuario = usuario;
  next();
};

/** Restringe la ruta a uno o varios roles. Se valida siempre en el servidor. */
export function requiereRol(...roles: Rol[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuario) return next(noAutenticado());
    if (!roles.includes(req.usuario.rol)) return next(prohibido());
    next();
  };
}

export function usuarioActual(req: Request): UsuarioSesion {
  if (!req.usuario) throw noAutenticado();
  return req.usuario;
}
