// Cliente HTTP único: todos los datos llegan por la API (nunca directo a la base).

export type Rol = 'PRODUCTOR' | 'COORDINADOR' | 'ADMINISTRADOR';
export type Estado = 'PENDIENTE' | 'PROGRAMADA' | 'EN_PROCESO' | 'COMPLETADA';
export type Franja = 'MANANA' | 'TARDE' | 'JORNADA_COMPLETA';

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
}
export interface PerfilProductor {
  id: string;
  nombre_publico: string;
  telefono: string | null;
  vereda: string;
}
export interface Producto {
  id: string;
  nombre: string;
  unidad_defecto: string;
  unidades: string[];
  activo: boolean;
}
export interface Solicitud {
  id: string;
  codigo: string;
  estado: Estado;
  producto: { id: string; nombre: string };
  cantidad: number;
  unidad: string;
  ubicacion_texto: string;
  latitud: number | null;
  longitud: number | null;
  fecha_disponible: string;
  notas: string | null;
  productor: { id: string; nombre: string; vereda: string; telefono?: string | null };
  creado_por: string;
  creada_en: string;
  actualizada_en: string;
  programacion: null | {
    fecha_programada: string;
    franja: Franja;
    coordinador: string;
    actualizada_en: string;
    transporte: null | {
      nombre_contacto: string;
      tipo_vehiculo: string | null;
      observaciones: string | null;
      telefono?: string | null;
    };
  };
  permisos: { editar: boolean; programar: boolean; siguiente_estado: Estado | null };
}
export interface EventoHistorial {
  id: number;
  accion: 'CREACION' | 'EDICION' | 'PROGRAMACION' | 'REPROGRAMACION' | 'TRANSPORTE' | 'CAMBIO_ESTADO';
  estado_anterior: Estado | null;
  estado_nuevo: Estado | null;
  detalle: Record<string, unknown>;
  motivo: string | null;
  creado_en: string;
  usuario_nombre: string;
  usuario_rol: Rol;
}
export interface Pagina<T> {
  datos: T[];
  total: number;
  pagina: number;
  tamano: number;
}

export class ErrorApi extends Error {
  constructor(
    public estado: number,
    public codigo: string,
    mensaje: string,
    public campos: Record<string, string> = {},
  ) {
    super(mensaje);
  }
  get esRed() {
    return this.estado === 0;
  }
}

export const MENSAJE_RED = 'No se pudo conectar. Revisa tu conexión e inténtalo otra vez.';
const TIEMPO_LIMITE_MS = 20_000;

let alPerderSesion: (() => void) | null = null;
export function registrarPerdidaSesion(fn: () => void) {
  alPerderSesion = fn;
}

async function peticion<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_MS);
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: 'same-origin',
      signal: controlador.signal,
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'AgroTurno',
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    // Sin red, servidor caído o tiempo agotado: nunca se confirma un guardado
    throw new ErrorApi(0, 'RED', MENSAJE_RED);
  } finally {
    clearTimeout(temporizador);
  }

  let datos: unknown = null;
  const tipo = respuesta.headers.get('content-type') ?? '';
  if (tipo.includes('application/json')) {
    datos = await respuesta.json().catch(() => null);
  }
  if (!respuesta.ok) {
    const error = (datos as { error?: { codigo?: string; mensaje?: string; campos?: Record<string, string> } })?.error;
    if (respuesta.status === 401 && ruta !== '/auth/login' && ruta !== '/auth/me') alPerderSesion?.();
    if (!error && respuesta.status >= 500) throw new ErrorApi(respuesta.status, 'SERVIDOR', MENSAJE_RED);
    throw new ErrorApi(
      respuesta.status,
      error?.codigo ?? 'ERROR',
      error?.mensaje ?? 'Ocurrió un error inesperado.',
      error?.campos ?? {},
    );
  }
  return datos as T;
}

function query(params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const texto = q.toString();
  return texto ? `?${texto}` : '';
}

export interface FiltrosSolicitudes {
  estado?: string;
  producto_id?: string;
  desde?: string;
  hasta?: string;
  q?: string;
  pagina?: number;
  tamano?: number;
  orden?: 'recientes' | 'fecha_disponible' | 'fecha_programada';
}

export type DatosSolicitud = {
  producto_id: string;
  cantidad: number;
  unidad: string;
  ubicacion_texto: string;
  latitud: number | null;
  longitud: number | null;
  fecha_disponible: string;
  notas: string | null;
};

export const api = {
  login: (correo: string, contrasena: string) => peticion('POST', '/auth/login', { correo, contrasena }),
  logout: () => peticion('POST', '/auth/logout', {}),
  yo: () => peticion<{ usuario: Usuario; productor: PerfilProductor | null }>('GET', '/auth/me'),

  productos: (incluirInactivos = false) =>
    peticion<{ datos: Producto[] }>('GET', `/productos${incluirInactivos ? '?incluirInactivos=true' : ''}`),
  crearProducto: (datos: Omit<Producto, 'id' | 'activo'>) => peticion<Producto>('POST', '/productos', datos),
  editarProducto: (id: string, datos: Partial<Producto>) => peticion<Producto>('PATCH', `/productos/${id}`, datos),

  productores: (filtros: { q?: string } = {}) =>
    peticion<{ datos: Array<PerfilProductor & { correo: string | null; activo: boolean | null; total_solicitudes: number }> }>(
      'GET',
      `/productores${query(filtros)}`,
    ),
  miPerfil: () => peticion<PerfilProductor>('GET', '/productores/me'),
  editarMiPerfil: (datos: { telefono?: string | null; vereda?: string }) =>
    peticion<PerfilProductor>('PATCH', '/productores/me', datos),
  editarProductor: (id: string, datos: { nombre_publico?: string; telefono?: string | null; vereda?: string }) =>
    peticion<PerfilProductor>('PATCH', `/productores/${id}`, datos),

  usuarios: (filtros: { rol?: string; q?: string } = {}) =>
    peticion<{ datos: Array<Usuario & { activo: boolean; creado_en: string; vereda: string | null }> }>(
      'GET',
      `/usuarios${query(filtros)}`,
    ),
  crearUsuario: (datos: Record<string, unknown>) => peticion<Usuario>('POST', '/usuarios', datos),
  editarUsuario: (id: string, datos: Record<string, unknown>) => peticion<Usuario>('PATCH', `/usuarios/${id}`, datos),
  auditoriaUsuario: (id: string) =>
    peticion<{ datos: Array<{ id: number; accion: string; detalle: Record<string, unknown>; creado_en: string; actor_nombre: string | null }> }>(
      'GET',
      `/usuarios/${id}/auditoria`,
    ),

  solicitudes: (filtros: FiltrosSolicitudes) =>
    peticion<Pagina<Solicitud>>('GET', `/solicitudes${query({ ...filtros })}`),
  resumen: () => peticion<Record<Estado, number>>('GET', '/solicitudes/resumen'),
  solicitud: (id: string) => peticion<Solicitud>('GET', `/solicitudes/${id}`),
  crearSolicitud: (datos: DatosSolicitud) => peticion<Solicitud>('POST', '/solicitudes', datos),
  editarSolicitud: (id: string, datos: Partial<DatosSolicitud> & { motivo?: string | null }) =>
    peticion<Solicitud>('PATCH', `/solicitudes/${id}`, datos),
  programar: (
    id: string,
    datos: {
      fecha_programada: string;
      franja: Franja;
      motivo?: string | null;
      transporte?: { nombre_contacto: string; telefono?: string | null; tipo_vehiculo?: string | null; observaciones?: string | null } | null;
    },
  ) => peticion<Solicitud>('PUT', `/solicitudes/${id}/programacion`, datos),
  cambiarEstado: (id: string, estado: Estado, motivo?: string | null) =>
    peticion<Solicitud>('PATCH', `/solicitudes/${id}/estado`, { estado, motivo }),
  historial: (id: string) => peticion<{ datos: EventoHistorial[] }>('GET', `/solicitudes/${id}/historial`),
};
