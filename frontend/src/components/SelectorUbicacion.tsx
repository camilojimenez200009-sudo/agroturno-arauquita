import { Crosshair, MapPinned, Trash2 } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Aviso, Cargando, LimiteError } from './ui';

const Mapa = lazy(() => import('./Mapa'));

interface Props {
  latitud: number | null;
  longitud: number | null;
  onCambiar: (lat: number | null, lon: number | null) => void;
}

/** Coordenadas opcionales: el formulario funciona sin abrir nunca el mapa (RN-07) */
export function SelectorUbicacion({ latitud, longitud, onCambiar }: Props) {
  const [abierto, setAbierto] = useState(latitud != null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [sinMapa, setSinMapa] = useState(false);

  function usarMiUbicacion() {
    setMensaje(null);
    if (!('geolocation' in navigator)) {
      setMensaje('Este dispositivo no permite obtener la ubicación. Marca el punto en el mapa o usa solo la descripción.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onCambiar(Number(p.coords.latitude.toFixed(6)), Number(p.coords.longitude.toFixed(6)));
        setAbierto(true);
        setMensaje(`Ubicación obtenida con precisión aproximada de ${Math.round(p.coords.accuracy)} m.`);
      },
      () => setMensaje('No se pudo obtener la ubicación. Revisa el permiso del navegador o usa solo la descripción.'),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="etiqueta" style={{ marginBottom: 6 }}>
        Punto en el mapa (opcional)
      </legend>
      <span className="ayuda" style={{ marginBottom: 6 }}>
        El mapa es opcional; la descripción textual es obligatoria y siempre se conserva.
      </span>
      <div className="acciones">
        {!abierto && (
          <button type="button" className="boton boton-neutro boton-pequeno" onClick={() => setAbierto(true)}>
            <MapPinned size={16} aria-hidden="true" /> Marcar en el mapa
          </button>
        )}
        <button type="button" className="boton boton-neutro boton-pequeno" onClick={usarMiUbicacion}>
          <Crosshair size={16} aria-hidden="true" /> Usar mi ubicación
        </button>
        {latitud != null && (
          <button type="button" className="boton boton-texto boton-pequeno" onClick={() => onCambiar(null, null)}>
            <Trash2 size={16} aria-hidden="true" /> Quitar punto
          </button>
        )}
      </div>
      {mensaje && (
        <span className="ayuda" role="status">
          {mensaje}
        </span>
      )}
      {latitud != null && longitud != null && (
        <span className="ayuda">
          Coordenadas: {latitud.toFixed(5)}, {longitud.toFixed(5)}
        </span>
      )}
      {abierto && (
        <div style={{ marginTop: 8 }}>
          {sinMapa && (
            <div style={{ marginBottom: 8 }}>
              <Aviso tipo="alerta" titulo="El mapa no está disponible">
                Puedes guardar la solicitud solo con la descripción textual.
              </Aviso>
            </div>
          )}
          <LimiteError
            alternativa={
              <Aviso tipo="alerta" titulo="No se pudo cargar el mapa">
                Revisa tu conexión. Puedes guardar la solicitud solo con la descripción textual.
              </Aviso>
            }
          >
            <Suspense fallback={<Cargando texto="Cargando mapa…" />}>
              <Mapa
                editable
                latitud={latitud}
                longitud={longitud}
                onCambiar={(la, lo) => onCambiar(la, lo)}
                onErrorTeselas={() => setSinMapa(true)}
              />
            </Suspense>
          </LimiteError>
          <span className="ayuda">Toca el mapa para ubicar el punto de recogida. La precisión depende del zoom.</span>
        </div>
      )}
    </fieldset>
  );
}
