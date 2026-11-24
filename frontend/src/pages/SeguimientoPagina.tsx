import { CalendarDays, Eye, Inbox, MapPin, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BotonCambioEstado, PasosEstado } from '../components/Seguimiento';
import { Aviso, Cargando, ErrorCarga, EstadoBadge, Paginacion, useCarga, Vacio } from '../components/ui';
import { useSesion } from '../context/Sesion';
import { api } from '../services/api';
import { ETIQUETA_FRANJA, cantidad, fecha } from '../utils/formato';

/** P07 · Seguimiento: línea de estados y avance de las recolecciones activas */
export function SeguimientoPagina() {
  const { usuario } = useSesion();
  const esGestor = usuario?.rol !== 'PRODUCTOR';
  const [verCompletadas, setVerCompletadas] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const estados = verCompletadas ? 'COMPLETADA' : esGestor ? 'PROGRAMADA,EN_PROCESO' : 'PENDIENTE,PROGRAMADA,EN_PROCESO';

  const { datos, error, cargando, recargar } = useCarga(
    () => api.solicitudes({ estado: estados, orden: verCompletadas ? 'recientes' : 'fecha_programada', pagina, tamano: 10 }),
    [estados, pagina, version],
  );

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Seguimiento</h1>
          <p>
            {esGestor
              ? 'Actualiza el avance de las recolecciones programadas. Cada cambio queda en el historial.'
              : 'Consulta en qué etapa está cada una de tus solicitudes.'}
          </p>
        </div>
        <div className="acciones" role="group" aria-label="Vista">
          <button
            type="button"
            className={`boton boton-pequeno ${!verCompletadas ? 'boton-secundario' : 'boton-neutro'}`}
            aria-pressed={!verCompletadas}
            onClick={() => {
              setVerCompletadas(false);
              setPagina(1);
            }}
          >
            Activas
          </button>
          <button
            type="button"
            className={`boton boton-pequeno ${verCompletadas ? 'boton-secundario' : 'boton-neutro'}`}
            aria-pressed={verCompletadas}
            onClick={() => {
              setVerCompletadas(true);
              setPagina(1);
            }}
          >
            Completadas
          </button>
        </div>
      </div>

      <div aria-live="polite">
        {aviso && (
          <div style={{ marginBottom: 16 }}>
            <Aviso tipo="exito">{aviso}</Aviso>
          </div>
        )}
      </div>

      {error ? (
        <div className="tarjeta">
          <ErrorCarga error={error} reintentar={recargar} />
        </div>
      ) : cargando && !datos ? (
        <Cargando />
      ) : !datos?.datos.length ? (
        <div className="tarjeta">
          <Vacio icono={<Inbox size={36} aria-hidden="true" />} titulo={verCompletadas ? 'Sin solicitudes completadas' : 'Sin recolecciones activas'}>
            <p>{esGestor ? 'Programa solicitudes pendientes para hacerles seguimiento.' : 'Tus solicitudes activas aparecerán aquí.'}</p>
          </Vacio>
        </div>
      ) : (
        <div className="pila" aria-busy={cargando}>
          {datos.datos.map((s) => (
            <article key={s.id} className="tarjeta panel" aria-labelledby={`s-${s.id}`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div>
                  <h2 id={`s-${s.id}`} style={{ fontSize: '1.0625rem', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="codigo">{s.codigo}</span> {s.producto.nombre} · {cantidad(s.cantidad, s.unidad)} <EstadoBadge estado={s.estado} />
                  </h2>
                  <div className="datos-linea" style={{ marginTop: 6 }}>
                    <span>
                      <CalendarDays size={15} aria-hidden="true" />
                      {s.programacion
                        ? `${fecha(s.programacion.fecha_programada)} · ${ETIQUETA_FRANJA[s.programacion.franja]}`
                        : `Disponible desde ${fecha(s.fecha_disponible)} · sin programar`}
                    </span>
                    <span>
                      <MapPin size={15} aria-hidden="true" />
                      {esGestor ? `${s.productor.nombre} · ` : ''}
                      {s.productor.vereda}
                    </span>
                    {s.programacion?.transporte && (
                      <span>
                        <Truck size={15} aria-hidden="true" />
                        {s.programacion.transporte.nombre_contacto}
                      </span>
                    )}
                  </div>
                </div>
                <div className="acciones">
                  <BotonCambioEstado
                    pequeno
                    solicitud={s}
                    onCambiado={(n) => {
                      setAviso(`${n.codigo} actualizada. Cambio registrado en el historial.`);
                      setVersion((v) => v + 1);
                    }}
                  />
                  <Link to={`/app/solicitudes/${s.id}`} className="boton boton-neutro boton-pequeno">
                    <Eye size={16} aria-hidden="true" /> Ver historial
                  </Link>
                </div>
              </div>
              <PasosEstado estado={s.estado} />
            </article>
          ))}
          <div className="tarjeta">
            <Paginacion pagina={datos.pagina} tamano={datos.tamano} total={datos.total} onCambiar={setPagina} />
          </div>
        </div>
      )}
    </>
  );
}
