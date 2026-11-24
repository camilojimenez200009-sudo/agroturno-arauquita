import { Save } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ErrorApi, type DatosSolicitud, type Producto } from '../services/api';
import { hoy } from '../utils/formato';
import { SelectorUbicacion } from './SelectorUbicacion';
import { Aviso, Campo, mensajeError } from './ui';

interface Valores {
  producto_id: string;
  cantidad: string;
  unidad: string;
  ubicacion_texto: string;
  latitud: number | null;
  longitud: number | null;
  fecha_disponible: string;
  notas: string;
  motivo: string;
}

interface Props {
  inicial?: Partial<DatosSolicitud>;
  textoBoton?: string;
  /** Pide motivo del cambio (edición por coordinación) */
  conMotivo?: boolean;
  /** Oculta el selector de mapa (formulario lateral compacto) */
  compacto?: boolean;
  onGuardar: (datos: DatosSolicitud & { motivo?: string | null }) => Promise<void>;
  onCancelar?: () => void;
}

function validar(v: Valores): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.producto_id) e.producto_id = 'Selecciona un producto.';
  const n = Number(v.cantidad.replace(',', '.'));
  if (!v.cantidad.trim()) e.cantidad = 'Escribe la cantidad.';
  else if (!Number.isFinite(n)) e.cantidad = 'Escribe una cantidad numérica.';
  else if (n <= 0) e.cantidad = 'La cantidad debe ser mayor que cero.';
  if (!v.unidad) e.unidad = 'Selecciona la unidad.';
  if (v.ubicacion_texto.trim().length < 5) e.ubicacion_texto = 'Describe la vereda y un punto de referencia (mínimo 5 caracteres).';
  if (!v.fecha_disponible) e.fecha_disponible = 'Selecciona la fecha disponible.';
  else if (v.fecha_disponible < hoy()) e.fecha_disponible = 'Revisa la fecha disponible: no puede estar en el pasado.';
  return e;
}

export function FormularioSolicitud({ inicial, textoBoton = 'Registrar solicitud', conMotivo, compacto, onGuardar, onCancelar }: Props) {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);
  const [valores, setValores] = useState<Valores>({
    producto_id: inicial?.producto_id ?? '',
    cantidad: inicial?.cantidad != null ? String(inicial.cantidad) : '',
    unidad: inicial?.unidad ?? '',
    ubicacion_texto: inicial?.ubicacion_texto ?? '',
    latitud: inicial?.latitud ?? null,
    longitud: inicial?.longitud ?? null,
    fecha_disponible: inicial?.fecha_disponible ?? '',
    notas: inicial?.notas ?? '',
    motivo: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    api
      .productos()
      .then((r) => setProductos(r.datos))
      .catch((e) => setErrorProductos(mensajeError(e)));
  }, []);

  const productoActual = productos?.find((p) => p.id === valores.producto_id);
  const actualizar = <K extends keyof Valores>(campo: K, valor: Valores[K]) => {
    setValores((v) => ({ ...v, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: '' }));
  };

  function elegirProducto(id: string) {
    const p = productos?.find((x) => x.id === id);
    setValores((v) => ({ ...v, producto_id: id, unidad: p && !p.unidades.includes(v.unidad) ? p.unidad_defecto : v.unidad }));
    setErrores((e) => ({ ...e, producto_id: '', unidad: '' }));
  }

  function enfocarPrimerError() {
    requestAnimationFrame(() => {
      formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErrorGeneral(null);
    const encontrados = validar(valores);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) {
      enfocarPrimerError();
      return;
    }
    setEnviando(true);
    try {
      await onGuardar({
        producto_id: valores.producto_id,
        cantidad: Number(valores.cantidad.replace(',', '.')),
        unidad: valores.unidad,
        ubicacion_texto: valores.ubicacion_texto.trim(),
        latitud: valores.latitud,
        longitud: valores.longitud,
        fecha_disponible: valores.fecha_disponible,
        notas: valores.notas.trim() || null,
        ...(conMotivo ? { motivo: valores.motivo.trim() || null } : {}),
      });
    } catch (error) {
      // Se conserva todo lo digitado; nunca se confirma un guardado fallido
      if (error instanceof ErrorApi && Object.keys(error.campos).length) {
        setErrores(error.campos);
        enfocarPrimerError();
      }
      setErrorGeneral(mensajeError(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form ref={formulario} className="formulario" onSubmit={enviar} noValidate aria-busy={enviando}>
      {errorGeneral && (
        <Aviso tipo="error" titulo="No se guardó la solicitud">
          {errorGeneral}
        </Aviso>
      )}
      {errorProductos && <Aviso tipo="error" titulo="No se pudo cargar el catálogo">{errorProductos}</Aviso>}

      <Campo etiqueta="Producto" requerido error={errores.producto_id} ayuda={compacto ? undefined : 'Usa los valores activos del catálogo.'}>
        {(p) => (
          <select {...p} value={valores.producto_id} onChange={(e) => elegirProducto(e.target.value)} disabled={!productos}>
            <option value="">{productos ? 'Selecciona un producto' : 'Cargando catálogo…'}</option>
            {productos?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </select>
        )}
      </Campo>

      <div className="fila-campos">
        <Campo etiqueta="Cantidad" requerido error={errores.cantidad}>
          {(p) => (
            <input
              {...p}
              inputMode="decimal"
              autoComplete="off"
              placeholder="Ej.: 45"
              value={valores.cantidad}
              onChange={(e) => actualizar('cantidad', e.target.value)}
            />
          )}
        </Campo>
        <Campo etiqueta="Unidad" requerido error={errores.unidad}>
          {(p) => (
            <select {...p} value={valores.unidad} onChange={(e) => actualizar('unidad', e.target.value)} disabled={!productoActual}>
              <option value="">{productoActual ? 'Selecciona' : 'Primero el producto'}</option>
              {productoActual?.unidades.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </div>

      <Campo
        etiqueta="Ubicación"
        requerido
        error={errores.ubicacion_texto}
        ayuda="Vereda y punto de referencia. Usa datos ficticios en las pruebas."
      >
        {(p) => (
          <textarea
            {...p}
            rows={2}
            maxLength={250}
            placeholder="Ej.: Vereda La Reinera, junto a la escuela"
            value={valores.ubicacion_texto}
            onChange={(e) => actualizar('ubicacion_texto', e.target.value)}
          />
        )}
      </Campo>

      <Campo etiqueta="Fecha disponible" requerido error={errores.fecha_disponible} ayuda="Desde cuándo el producto está listo para recoger.">
        {(p) => (
          <input
            {...p}
            type="date"
            min={hoy()}
            value={valores.fecha_disponible}
            onChange={(e) => actualizar('fecha_disponible', e.target.value)}
          />
        )}
      </Campo>

      {!compacto && (
        <SelectorUbicacion
          latitud={valores.latitud}
          longitud={valores.longitud}
          onCambiar={(la, lo) => setValores((v) => ({ ...v, latitud: la, longitud: lo }))}
        />
      )}

      <Campo etiqueta="Notas (opcional)" error={errores.notas}>
        {(p) => (
          <textarea
            {...p}
            rows={2}
            maxLength={500}
            placeholder="Información relevante para la recogida"
            value={valores.notas}
            onChange={(e) => actualizar('notas', e.target.value)}
          />
        )}
      </Campo>

      {conMotivo && (
        <Campo etiqueta="Motivo del cambio (opcional)" error={errores.motivo} ayuda="Queda registrado en el historial.">
          {(p) => (
            <input {...p} maxLength={300} value={valores.motivo} onChange={(e) => actualizar('motivo', e.target.value)} />
          )}
        </Campo>
      )}

      <div className="acciones">
        <button type="submit" className="boton boton-primario" disabled={enviando || !productos}>
          <Save size={18} aria-hidden="true" />
          {enviando ? 'Guardando…' : textoBoton}
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
