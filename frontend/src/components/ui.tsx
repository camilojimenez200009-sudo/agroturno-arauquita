import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, TriangleAlert } from 'lucide-react';
import { Component, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** Evita que un fallo al cargar un módulo opcional (p. ej. el mapa sin red) rompa la pantalla */
export class LimiteError extends Component<{ alternativa: ReactNode; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  render() {
    return this.state.fallo ? this.props.alternativa : this.props.children;
  }
}
import { ErrorApi, MENSAJE_RED, type Estado } from '../services/api';
import { ETIQUETA_ESTADO } from '../utils/formato';

export function EstadoBadge({ estado }: { estado: Estado }) {
  return <span className={`estado estado-${estado}`}>{ETIQUETA_ESTADO[estado]}</span>;
}

type TipoAviso = 'error' | 'exito' | 'info' | 'alerta';
const ICONO_AVISO = { error: AlertCircle, exito: CheckCircle2, info: Info, alerta: TriangleAlert };

export function Aviso({ tipo, titulo, children }: { tipo: TipoAviso; titulo?: string; children?: ReactNode }) {
  const Icono = ICONO_AVISO[tipo];
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icono size={20} aria-hidden="true" />
      <div>
        {titulo && <strong className="aviso-titulo">{titulo}</strong>}
        {children}
      </div>
    </div>
  );
}

export function Cargando({ texto = 'Cargando información…' }: { texto?: string }) {
  return (
    <div className="cargando" role="status" aria-live="polite">
      <Loader2 className="girando" size={22} aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export function Vacio({ icono, titulo, children }: { icono: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="vacio">
      {icono}
      <strong>{titulo}</strong>
      {children}
    </div>
  );
}

export function mensajeError(error: unknown): string {
  if (error instanceof ErrorApi) return error.message;
  return MENSAJE_RED;
}

export function ErrorCarga({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  return (
    <div className="panel">
      <Aviso tipo="error" titulo="No se pudo cargar la información">
        <p>{mensajeError(error)}</p>
        {reintentar && (
          <button type="button" className="boton boton-neutro boton-pequeno" style={{ marginTop: 8 }} onClick={reintentar}>
            Reintentar
          </button>
        )}
      </Aviso>
    </div>
  );
}

/** Carga datos asíncronos con estados de carga, error y recarga */
export function useCarga<T>(cargar: () => Promise<T>, dependencias: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(true);
  const version = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ejecutar = useCallback(cargar, dependencias);

  const recargar = useCallback(async () => {
    const actual = ++version.current;
    setCargando(true);
    setError(null);
    try {
      const resultado = await ejecutar();
      if (actual === version.current) setDatos(resultado);
    } catch (e) {
      if (actual === version.current) setError(e);
    } finally {
      if (actual === version.current) setCargando(false);
    }
  }, [ejecutar]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { datos, error, cargando, recargar, setDatos };
}

interface PropsCampo {
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}

/** Campo con etiqueta, ayuda y error asociados para lectores de pantalla */
export function Campo({ etiqueta, requerido, error, ayuda, children }: PropsCampo) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descripciones = [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="campo">
      <label htmlFor={id}>
        {etiqueta} {requerido && <span className="requerido" aria-hidden="true">*</span>}
        {requerido && <span className="sr-only">(obligatorio)</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': descripciones })}
      {ayuda && (
        <span id={idAyuda} className="ayuda">
          {ayuda}
        </span>
      )}
      {error && (
        <span id={idError} className="error-campo">
          <AlertCircle size={15} aria-hidden="true" /> {error}
        </span>
      )}
    </div>
  );
}

export function Paginacion({
  pagina,
  tamano,
  total,
  onCambiar,
}: {
  pagina: number;
  tamano: number;
  total: number;
  onCambiar: (pagina: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / tamano));
  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1;
  const hasta = Math.min(total, pagina * tamano);
  return (
    <nav className="paginacion" aria-label="Paginación">
      <span>
        {desde}–{hasta} de {total} solicitudes
      </span>
      <div className="acciones">
        <button
          type="button"
          className="boton boton-neutro boton-pequeno"
          disabled={pagina <= 1}
          onClick={() => onCambiar(pagina - 1)}
        >
          <ChevronLeft size={16} aria-hidden="true" /> Anterior
        </button>
        <span aria-current="page">
          Página {pagina} de {paginas}
        </span>
        <button
          type="button"
          className="boton boton-neutro boton-pequeno"
          disabled={pagina >= paginas}
          onClick={() => onCambiar(pagina + 1)}
        >
          Siguiente <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

/** Diálogo modal nativo (foco atrapado y tecla Escape incluidos por el navegador) */
export function Dialogo({
  abierto,
  titulo,
  onCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog ref={ref} className="dialogo" aria-labelledby={idTitulo} onClose={onCerrar}>
      <div className="dialogo-cuerpo">
        <h2 id={idTitulo}>{titulo}</h2>
        {children}
      </div>
    </dialog>
  );
}
