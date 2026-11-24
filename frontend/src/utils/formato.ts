import type { Estado, Franja, Rol } from '../services/api';

const ZONA = 'America/Bogota';

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  PENDIENTE: 'Pendiente',
  PROGRAMADA: 'Programada',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
};

export const ETIQUETA_FRANJA: Record<Franja, string> = {
  MANANA: 'Mañana (6:00 a. m. – 12:00 m.)',
  TARDE: 'Tarde (12:00 m. – 6:00 p. m.)',
  JORNADA_COMPLETA: 'Jornada completa',
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  PRODUCTOR: 'Productor',
  COORDINADOR: 'Coordinador',
  ADMINISTRADOR: 'Administrador',
};

/** Acción que lleva la solicitud al estado indicado */
export const ACCION_ESTADO: Partial<Record<Estado, string>> = {
  EN_PROCESO: 'Iniciar recolección',
  COMPLETADA: 'Marcar como completada',
};

/** Fecha sin hora (AAAA-MM-DD) → «jue. 27 nov. 2026» */
export function fecha(valor: string | null | undefined): string {
  if (!valor) return '—';
  const d = new Date(`${valor}T12:00:00Z`);
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** Marca de tiempo UTC → hora de Arauquita */
export function fechaHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ZONA,
  }).format(new Date(valor));
}

export function cantidad(valor: number, unidad: string): string {
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(valor)} ${unidad}`;
}

export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );
}

export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter((p) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p))
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}
