import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { consulta, type Consultor } from '../db/pool';
import { ErrorHttp } from '../utils/errores';

export type Rol = 'PRODUCTOR' | 'COORDINADOR' | 'ADMINISTRADOR';

export interface UsuarioSesion {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  productorId: string | null;
  sesionId: string;
}

const COSTO_HASH = 11;
// Hash válido que se compara cuando el correo no existe, para igualar el tiempo de respuesta
const HASH_FICTICIO = bcrypt.hashSync('contrasena-inexistente', COSTO_HASH);

export const hashContrasena = (contrasena: string) => bcrypt.hash(contrasena, COSTO_HASH);

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function iniciarSesion(correo: string, contrasena: string) {
  const { rows } = await consulta<{ id: string; hash_contrasena: string; activo: boolean }>(
    'SELECT id, hash_contrasena, activo FROM usuarios WHERE lower(correo) = lower($1)',
    [correo.trim()],
  );
  const usuario = rows[0];
  const coincide = await bcrypt.compare(contrasena, usuario?.hash_contrasena ?? HASH_FICTICIO);
  if (!usuario || !coincide) {
    throw new ErrorHttp(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
  }
  if (!usuario.activo) {
    throw new ErrorHttp(403, 'CUENTA_INACTIVA', 'Tu cuenta está desactivada. Comunícate con el administrador.');
  }

  const token = randomBytes(32).toString('base64url');
  const expiraEn = new Date(Date.now() + config.horasSesion * 3600 * 1000);
  await consulta('INSERT INTO sesiones (usuario_id, token_hash, expira_en) VALUES ($1, $2, $3)', [
    usuario.id,
    hashToken(token),
    expiraEn,
  ]);
  // Limpieza oportunista de sesiones vencidas del mismo usuario
  await consulta('DELETE FROM sesiones WHERE usuario_id = $1 AND expira_en < now() - interval \'1 day\'', [usuario.id]);
  return { token, expiraEn };
}

export async function usuarioPorToken(token: string): Promise<UsuarioSesion | null> {
  const { rows } = await consulta<{
    sesion_id: string;
    id: string;
    nombre: string;
    correo: string;
    rol: Rol;
    productor_id: string | null;
  }>(
    `SELECT s.id AS sesion_id, u.id, u.nombre, u.correo, u.rol, p.id AS productor_id
       FROM sesiones s
       JOIN usuarios u ON u.id = s.usuario_id
       LEFT JOIN productores p ON p.usuario_id = u.id
      WHERE s.token_hash = $1
        AND s.revocada_en IS NULL
        AND s.expira_en > now()
        AND u.activo`,
    [hashToken(token)],
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol,
    productorId: fila.productor_id,
    sesionId: fila.sesion_id,
  };
}

export async function cerrarSesion(sesionId: string) {
  await consulta('UPDATE sesiones SET revocada_en = now() WHERE id = $1 AND revocada_en IS NULL', [sesionId]);
}

export async function revocarSesionesDeUsuario(usuarioId: string, cliente: Consultor) {
  await cliente.query('UPDATE sesiones SET revocada_en = now() WHERE usuario_id = $1 AND revocada_en IS NULL', [
    usuarioId,
  ]);
}
