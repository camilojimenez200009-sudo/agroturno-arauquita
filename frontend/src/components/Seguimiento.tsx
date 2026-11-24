import { ArrowRightLeft, CalendarCheck, CalendarClock, Check, FilePlus2, PencilLine, Truck } from 'lucide-react';
import { useState } from 'react';
import { api, type Estado, type EventoHistorial, type Solicitud } from '../services/api';
import { ACCION_ESTADO, ETIQUETA_ESTADO, ETIQUETA_FRANJA, ETIQUETA_ROL, fecha, fechaHora } from '../utils/formato';
import { Aviso, Campo, Dialogo, mensajeError } from './ui';

const ORDEN: Estado[] = ['PENDIENTE', 'PROGRAMADA', 'EN_PROCESO', 'COMPLETADA'];

/** Línea de estados: el significado se comunica con texto, no solo con color */
export function PasosEstado({ estado }: { estado: Estado }) {
  const indice = ORDEN.indexOf(estado);
  return (
    <ol className="pasos" aria-label={`Estado actual: ${ETIQUETA_ESTADO[estado]}`}>
      {ORDEN.map((e, i) => (
        <li key={e} className={`paso ${i <= indice ? 'hecho' : ''} ${i === indice ? 'actual' : ''}`} aria-current={i === indice ? 'step' : undefined}>
          <span className="marcador" aria-hidden="true">
            {i < indice ? <Check size={16} /> : i + 1}
          </span>
          <span className="texto-paso">
            {ETIQUETA_ESTADO[e]}
            {i < indice && <span className="sr-only"> (completado)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

const TITULO: Record<EventoHistorial['accion'], string> = {
  CREACION: 'Solicitud registrada',
  EDICION: 'Datos de la solicitud editados',
  PROGRAMACION: 'Recolección programada',
  REPROGRAMACION: 'Recolección reprogramada',
  TRANSPORTE: 'Datos de transporte',
  CAMBIO_ESTADO: 'Cambio de estado',
};
const ICONO: Record<EventoHistorial['accion'], typeof Check> = {
  CREACION: FilePlus2,
  EDICION: PencilLine,
  PROGRAMACION: CalendarCheck,
  REPROGRAMACION: CalendarClock,
  TRANSPORTE: Truck,
  CAMBIO_ESTADO: ArrowRightLeft,
};
const NOMBRE_CAMPO: Record<string, string> = {
  producto_id: 'Producto',
  cantidad: 'Cantidad',
  unidad: 'Unidad',
  ubicacion_texto: 'Ubicación',
  latitud: 'Latitud',
  longitud: 'Longitud',
  fecha_disponible: 'Fecha disponible',
  notas: 'Notas',
};

function valor(v: unknown, campo?: string) {
  if (v === null || v === undefined || v === '') return 'sin dato';
  if (campo === 'fecha_disponible' && typeof v === 'string') return fecha(v);
  if (campo === 'producto_id') return 'otro producto del catálogo';
  return String(v);
}

function DetalleEvento({ e }: { e: EventoHistorial }) {
  const d = e.detalle as Record<string, any>;
  switch (e.accion) {
    case 'CAMBIO_ESTADO':
      return (
        <p>
          {e.estado_anterior ? ETIQUETA_ESTADO[e.estado_anterior] : '—'} → <strong>{e.estado_nuevo ? ETIQUETA_ESTADO[e.estado_nuevo] : '—'}</strong>
        </p>
      );
    case 'PROGRAMACION':
      return (
        <p>
          Para el {fecha(d.fecha_programada)} · {ETIQUETA_FRANJA[d.franja as keyof typeof ETIQUETA_FRANJA] ?? d.franja}
        </p>
      );
    case 'REPROGRAMACION':
      return (
        <p>
          Antes: {fecha(d.antes?.fecha_programada)} · {ETIQUETA_FRANJA[d.antes?.franja as keyof typeof ETIQUETA_FRANJA] ?? ''}
          <br />
          Ahora:{' '}
          <strong>
            {fecha(d.despues?.fecha_programada)} · {ETIQUETA_FRANJA[d.despues?.franja as keyof typeof ETIQUETA_FRANJA] ?? ''}
          </strong>
        </p>
      );
    case 'TRANSPORTE':
      return (
        <p>
          Contacto {d.accion}: {d.contacto ?? 'sin contacto'}
          {d.tipo_vehiculo ? ` · ${d.tipo_vehiculo}` : ''}
        </p>
      );
    case 'EDICION': {
      const cambios = Object.entries((d.cambios ?? {}) as Record<string, { antes: unknown; despues: unknown }>);
      return (
        <ul>
          {cambios.map(([campo, c]) => (
            <li key={campo}>
              {NOMBRE_CAMPO[campo] ?? campo}: {valor(c.antes, campo)} → {valor(c.despues, campo)}
            </li>
          ))}
        </ul>
      );
    }
    case 'CREACION':
      return <p>Estado inicial: Pendiente</p>;
  }
}

export function Historial({ eventos }: { eventos: EventoHistorial[] }) {
  return (
    <ol className="linea-tiempo" aria-label="Historial de la solicitud">
      {eventos.map((e) => {
        const Icono = ICONO[e.accion];
        return (
          <li key={e.id} className="evento">
            <span className="evento-icono" aria-hidden="true">
              <Icono size={16} />
            </span>
            <div>
              <div className="evento-titulo">{TITULO[e.accion]}</div>
              <div className="evento-meta">
                <time dateTime={e.creado_en}>{fechaHora(e.creado_en)}</time> · {e.usuario_nombre} ({ETIQUETA_ROL[e.usuario_rol]})
              </div>
              <div className="evento-detalle">
                <DetalleEvento e={e} />
                {e.motivo && (
                  <p>
                    <strong>Motivo:</strong> {e.motivo}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Botón con confirmación para avanzar al siguiente estado permitido */
export function BotonCambioEstado({
  solicitud,
  onCambiado,
  pequeno,
}: {
  solicitud: Solicitud;
  onCambiado: (s: Solicitud) => void;
  pequeno?: boolean;
}) {
  const siguiente = solicitud.permisos.siguiente_estado;
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!siguiente) return null;

  async function confirmar() {
    setEnviando(true);
    setError(null);
    try {
      const s = await api.cambiarEstado(solicitud.id, siguiente!, motivo.trim() || null);
      setAbierto(false);
      setMotivo('');
      onCambiado(s);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`boton boton-primario ${pequeno ? 'boton-pequeno' : ''}`}
        onClick={() => setAbierto(true)}
        aria-label={`${ACCION_ESTADO[siguiente]} ${solicitud.codigo}`}
      >
        <ArrowRightLeft size={16} aria-hidden="true" /> {ACCION_ESTADO[siguiente]}
      </button>
      <Dialogo abierto={abierto} titulo={`${ACCION_ESTADO[siguiente]} · ${solicitud.codigo}`} onCerrar={() => setAbierto(false)}>
        <p>
          La solicitud pasará de <strong>{ETIQUETA_ESTADO[solicitud.estado]}</strong> a <strong>{ETIQUETA_ESTADO[siguiente]}</strong>. El
          cambio quedará en el historial con tu nombre, la fecha y la hora.
        </p>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo etiqueta="Observación (opcional)">
          {(p) => <input {...p} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
        </Campo>
        <div className="acciones acciones-fin">
          <button type="button" className="boton boton-neutro" onClick={() => setAbierto(false)} disabled={enviando}>
            Cancelar
          </button>
          <button type="button" className="boton boton-primario" onClick={confirmar} disabled={enviando}>
            {enviando ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </Dialogo>
    </>
  );
}
