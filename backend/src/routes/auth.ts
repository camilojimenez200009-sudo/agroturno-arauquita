import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config';
import { consulta } from '../db/pool';
import { requiereSesion, usuarioActual } from '../middleware/auth';
import { cerrarSesion, iniciarSesion } from '../services/sesiones';

export const rutasAuth = Router();

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => config.prueba,
  message: {
    error: {
      codigo: 'DEMASIADOS_INTENTOS',
      mensaje: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.',
    },
  },
});

const esquemaLogin = z.object({
  correo: z.string().trim().email('Escribe un correo válido.').max(160),
  contrasena: z.string().min(1, 'Escribe tu contraseña.').max(200),
});

function opcionesCookie(expiraEn?: Date) {
  return {
    httpOnly: true,
    secure: config.produccion,
    sameSite: 'lax' as const,
    path: '/',
    ...(expiraEn ? { expires: expiraEn } : {}),
  };
}

rutasAuth.post('/login', limiteLogin, async (req, res) => {
  const { correo, contrasena } = esquemaLogin.parse(req.body);
  const { token, expiraEn } = await iniciarSesion(correo, contrasena);
  res.cookie(config.nombreCookie, token, opcionesCookie(expiraEn));
  res.json({ ok: true, expira_en: expiraEn.toISOString() });
});

rutasAuth.post('/logout', requiereSesion, async (req, res) => {
  await cerrarSesion(usuarioActual(req).sesionId);
  res.clearCookie(config.nombreCookie, opcionesCookie());
  res.json({ ok: true });
});

rutasAuth.get('/me', requiereSesion, async (req, res) => {
  const usuario = usuarioActual(req);
  let productor = null;
  if (usuario.productorId) {
    const { rows } = await consulta(
      'SELECT id, nombre_publico, telefono, vereda FROM productores WHERE id = $1',
      [usuario.productorId],
    );
    productor = rows[0] ?? null;
  }
  res.json({
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
    productor,
  });
});
