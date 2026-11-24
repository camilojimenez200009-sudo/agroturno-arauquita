// Mapa opcional (Leaflet + teselas de OpenStreetMap). Se carga bajo demanda.
// Si las teselas no cargan, la ubicación textual sigue siendo la referencia válida.
import 'leaflet/dist/leaflet.css';
import type { LeafletMouseEvent } from 'leaflet';
import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

// Casco urbano de Arauquita (referencia general, no la ubicación de una finca)
export const CENTRO_ARAUQUITA: [number, number] = [7.0286, -71.428];

interface Props {
  latitud: number | null;
  longitud: number | null;
  editable?: boolean;
  onCambiar?: (lat: number, lon: number) => void;
  alto?: boolean;
  onErrorTeselas?: () => void;
}

function CapturarClic({ onCambiar }: { onCambiar: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onCambiar(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

function Recentrar({ posicion }: { posicion: [number, number] | null }) {
  const mapa = useMap();
  useEffect(() => {
    if (posicion) mapa.setView(posicion, Math.max(mapa.getZoom(), 14));
  }, [posicion, mapa]);
  return null;
}

export default function Mapa({ latitud, longitud, editable, onCambiar, alto, onErrorTeselas }: Props) {
  const posicion: [number, number] | null = latitud != null && longitud != null ? [latitud, longitud] : null;
  const [errores, setErrores] = useState(0);

  useEffect(() => {
    if (errores === 4) onErrorTeselas?.();
  }, [errores, onErrorTeselas]);

  return (
    <div
      className={`mapa ${alto ? 'mapa-alto' : ''}`}
      role="application"
      aria-label={editable ? 'Mapa opcional: toca para marcar el punto de recogida' : 'Mapa de la ubicación registrada'}
    >
      <MapContainer
        center={posicion ?? CENTRO_ARAUQUITA}
        zoom={posicion ? 14 : 12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
          eventHandlers={{ tileerror: () => setErrores((n) => n + 1) }}
        />
        {posicion && (
          <CircleMarker center={posicion} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2D7621', fillOpacity: 1 }} />
        )}
        {editable && onCambiar && <CapturarClic onCambiar={onCambiar} />}
        <Recentrar posicion={posicion} />
      </MapContainer>
    </div>
  );
}
