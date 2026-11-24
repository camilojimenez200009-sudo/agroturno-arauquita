import { CalendarCheck } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { api, ErrorApi, type Franja, type Solicitud } from '../services/api';
import { ETIQUETA_FRANJA, fecha, hoy } from '../utils/formato';
import { Aviso, Campo, mensajeError } from './ui';

interface Props {
  solicitud: Solicitud;
  onGuardado: (s: Solicitud) => void;
  onCancelar?: () => void;
}

export function FormularioProgramacion({ solicitud, onGuardado, onCancelar }: Props) {
  const previa = solicitud.programacion;
  const esReprogramacion = !!previa;
  const transportePrevio = previa?.transporte;
  const minimo = [hoy(), solicitud.fecha_disponible].sort().at(-1)!;

  const [v, setV] = useState({
    fecha_programada: previa?.fecha_programada ?? '',
    franja: (previa?.franja ?? '') as Franja | '',
    motivo: '',
    conTransporte: !!transportePrevio,
    nombre_contacto: transportePrevio?.nombre_contacto ?? '',
    telefono: transportePrevio?.telefono ?? '',
    tipo_vehiculo: transportePrevio?.tipo_vehiculo ?? '',
    observaciones: transportePrevio?.observaciones ?? '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  const cambioFecha = esReprogramacion && (v.fecha_programada !== previa.fecha_programada || v.franja !== previa.franja);
  const set = (campo: keyof typeof v, valor: string | boolean) => {
    setV((x) => ({ ...x, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: '' }));
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral(null);
    const err: Record<string, string> = {};
    if (!v.fecha_programada) err.fecha_programada = 'Selecciona la fecha acordada.';
    else if (v.fecha_programada < minimo) err.fecha_programada = `La fecha debe ser igual o posterior a ${fecha(minimo)}.`;
    if (!v.franja) err.franja = 'Selecciona la franja de atención.';
    if (cambioFecha && v.motivo.trim().length < 5) err.motivo = 'Escribe el motivo de la reprogramación (mínimo 5 caracteres).';
    if (v.conTransporte && v.nombre_contacto.trim().length < 3) err['transporte.nombre_contacto'] = 'Escribe el nombre del contacto.';
    setErrores(err);
    if (Object.keys(err).length) {
      requestAnimationFrame(() => formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setEnviando(true);
    try {
      const actualizada = await api.programar(solicitud.id, {
        fecha_programada: v.fecha_programada,
        franja: v.franja as Franja,
        motivo: v.motivo.trim() || null,
        transporte: v.conTransporte
          ? {
              nombre_contacto: v.nombre_contacto.trim(),
              telefono: v.telefono.trim() || null,
              tipo_vehiculo: v.tipo_vehiculo.trim() || null,
              observaciones: v.observaciones.trim() || null,
            }
          : null,
      });
      onGuardado(actualizada);
    } catch (error) {
      if (error instanceof ErrorApi) setErrores(error.campos);
      setErrorGeneral(mensajeError(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form ref={formulario} className="formulario" onSubmit={enviar} noValidate aria-busy={enviando}>
      {errorGeneral && (
        <Aviso tipo="error" titulo="No se guardó la programación">
          {errorGeneral}
        </Aviso>
      )}
      <p className="secundario">
        Producto disponible desde {fecha(solicitud.fecha_disponible)}. La fecha se acuerda con el productor y el transporte;
        el sistema no calcula rutas ni tiempos de llegada.
      </p>
      <div className="fila-campos">
        <Campo etiqueta="Fecha acordada" requerido error={errores.fecha_programada}>
          {(p) => <input {...p} type="date" min={minimo} value={v.fecha_programada} onChange={(e) => set('fecha_programada', e.target.value)} />}
        </Campo>
        <Campo etiqueta="Franja" requerido error={errores.franja}>
          {(p) => (
            <select {...p} value={v.franja} onChange={(e) => set('franja', e.target.value)}>
              <option value="">Selecciona</option>
              {Object.entries(ETIQUETA_FRANJA).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </div>

      {(cambioFecha || !esReprogramacion) && (
        <Campo
          etiqueta={esReprogramacion ? 'Motivo de la reprogramación' : 'Observación (opcional)'}
          requerido={esReprogramacion}
          error={errores.motivo}
          ayuda={esReprogramacion ? 'Ej.: aplazamiento por lluvia y estado de la vía.' : undefined}
        >
          {(p) => <input {...p} maxLength={300} value={v.motivo} onChange={(e) => set('motivo', e.target.value)} />}
        </Campo>
      )}

      <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontWeight: 600 }}>
        <input
          type="checkbox"
          style={{ width: 20, height: 20 }}
          checked={v.conTransporte}
          onChange={(e) => set('conTransporte', e.target.checked)}
        />
        Asociar datos de transporte
      </label>

      {v.conTransporte && (
        <fieldset className="formulario" style={{ border: '1px solid var(--color-borde)', borderRadius: 10, padding: 16, margin: 0 }}>
          <legend className="etiqueta" style={{ padding: '0 6px', fontWeight: 700 }}>
            Transporte (dato de contacto, sin gestión de flota)
          </legend>
          <Campo etiqueta="Nombre del contacto" requerido error={errores['transporte.nombre_contacto']}>
            {(p) => <input {...p} maxLength={120} value={v.nombre_contacto} onChange={(e) => set('nombre_contacto', e.target.value)} />}
          </Campo>
          <div className="fila-campos">
            <Campo etiqueta="Teléfono" error={errores['transporte.telefono']} ayuda="Visible solo para coordinación.">
              {(p) => <input {...p} type="tel" inputMode="tel" maxLength={20} value={v.telefono} onChange={(e) => set('telefono', e.target.value)} />}
            </Campo>
            <Campo etiqueta="Tipo de vehículo" error={errores['transporte.tipo_vehiculo']}>
              {(p) => (
                <input {...p} maxLength={60} placeholder="Ej.: camión 350" value={v.tipo_vehiculo} onChange={(e) => set('tipo_vehiculo', e.target.value)} />
              )}
            </Campo>
          </div>
          <Campo etiqueta="Observaciones" error={errores['transporte.observaciones']}>
            {(p) => <input {...p} maxLength={300} value={v.observaciones} onChange={(e) => set('observaciones', e.target.value)} />}
          </Campo>
        </fieldset>
      )}

      <div className="acciones">
        <button type="submit" className="boton boton-primario" disabled={enviando}>
          <CalendarCheck size={18} aria-hidden="true" />
          {enviando ? 'Guardando…' : esReprogramacion ? 'Guardar cambios' : 'Programar recolección'}
        </button>
        {onCancelar && (
          <button type="button" className="boton boton-neutro" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
