import { CalendarClock, CircleCheckBig, Clock3, Inbox, Plus, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FormularioSolicitud } from '../components/FormularioSolicitud';
import { TablaSolicitudes } from '../components/TablaSolicitudes';
import { Aviso, Cargando, useCarga, Vacio } from '../components/ui';
import { useSesion } from '../context/Sesion';
import { api, type Estado, type Solicitud } from '../services/api';
import { cantidad, fecha } from '../utils/formato';

const TARJETAS: Array<{ estado: Estado; texto: string; icono: typeof Clock3; fondo: string; color: string }> = [
  { estado: 'PENDIENTE', texto: 'Pendientes', icono: Clock3, fondo: 'var(--estado-pendiente-fondo)', color: 'var(--estado-pendiente-texto)' },
  { estado: 'PROGRAMADA', texto: 'Programadas', icono: CalendarClock, fondo: 'var(--estado-programada-fondo)', color: 'var(--estado-programada-texto)' },
  { estado: 'EN_PROCESO', texto: 'En proceso', icono: Truck, fondo: 'var(--estado-en-proceso-fondo)', color: 'var(--estado-en-proceso-texto)' },
  { estado: 'COMPLETADA', texto: 'Completadas', icono: CircleCheckBig, fondo: 'var(--estado-completada-fondo)', color: 'var(--estado-completada-texto)' },
];

/** Contadores calculados en el servidor con filtros de autorización */
export function Metricas({ version, rutaLista }: { version: number; rutaLista: string }) {
  const { datos, error } = useCarga(() => api.resumen(), [version]);
  return (
    <section className="metricas" aria-label="Resumen por estado">
      {TARJETAS.map(({ estado, texto, icono: Icono, fondo, color }) => (
        <Link key={estado} to={`${rutaLista}?estado=${estado}`} className="tarjeta metrica">
          <span className="metrica-icono" style={{ background: fondo, color }} aria-hidden="true">
            <Icono size={22} />
          </span>
          <span>
            <span className="metrica-valor" style={{ display: 'block' }}>
              {error ? '—' : datos ? datos[estado] : '…'}
            </span>
            <span className="metrica-etiqueta">{texto}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

function PanelPorProgramar({ version }: { version: number }) {
  const { datos, cargando, error } = useCarga(
    () => api.solicitudes({ estado: 'PENDIENTE', orden: 'fecha_disponible', tamano: 10 }),
    [version],
  );
  return (
    <section className="tarjeta panel" aria-labelledby="t-por-programar">
      <div className="panel-titulo">
        <h2 id="t-por-programar">Por programar</h2>
        <Link to="/app/programacion" className="boton boton-texto boton-pequeno">
          Ver todo
        </Link>
      </div>
      {error ? (
        <Aviso tipo="error">No se pudo consultar. Revisa tu conexión.</Aviso>
      ) : cargando && !datos ? (
        <Cargando />
      ) : !datos?.datos.length ? (
        <Vacio icono={<Inbox size={28} aria-hidden="true" />} titulo="Nada pendiente">
          <p>No hay solicitudes esperando programación.</p>
        </Vacio>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {datos.datos.slice(0, 5).map((s: Solicitud) => (
            <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div>
                <span className="codigo">{s.codigo}</span> · {s.producto.nombre}
                <div className="secundario">
                  {cantidad(s.cantidad, s.unidad)} · desde {fecha(s.fecha_disponible)} · {s.productor.vereda}
                </div>
              </div>
              <Link className="boton boton-secundario boton-pequeno" to={`/app/solicitudes/${s.id}?accion=programar`}>
                Programar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Inicio() {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const [version, setVersion] = useState(0);
  const [guardada, setGuardada] = useState<Solicitud | null>(null);
  const esProductor = usuario?.rol === 'PRODUCTOR';

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>{esProductor ? 'Mis solicitudes de recolección' : 'Gestión de solicitudes'}</h1>
          <p>{esProductor ? 'Registra y consulta tus solicitudes y su estado.' : 'Consulta y coordinación de las recolecciones.'}</p>
        </div>
        {esProductor && (
          <Link to="/app/solicitudes/nueva" className="boton boton-primario">
            <Plus size={18} aria-hidden="true" /> Nueva solicitud
          </Link>
        )}
      </div>

      <Metricas version={version} rutaLista={esProductor ? '/app/mis-solicitudes' : '/app/solicitudes'} />

      <div className="rejilla-tablero">
        <section aria-labelledby="t-recientes">
          <h2 id="t-recientes" style={{ fontSize: '1.125rem', marginBottom: 12 }}>
            {esProductor ? 'Mis solicitudes recientes' : 'Solicitudes recientes'}
          </h2>
          <TablaSolicitudes
            mostrarProductor={!esProductor}
            version={version}
            vacio={
              <Vacio icono={<Inbox size={36} aria-hidden="true" />} titulo={esProductor ? 'Sin solicitudes' : 'Sin registros todavía'}>
                <p>
                  {esProductor
                    ? 'Registra la primera para comenzar.'
                    : 'Cuando se registren solicitudes, aparecerán aquí con información actualizada.'}
                </p>
              </Vacio>
            }
          />
        </section>

        {esProductor ? (
          <section className="tarjeta panel solo-escritorio" aria-labelledby="t-nueva">
            <div className="panel-titulo">
              <h2 id="t-nueva">Registrar solicitud</h2>
            </div>
            <div aria-live="polite">
              {guardada && (
                <div style={{ marginBottom: 16 }}>
                  <Aviso tipo="exito" titulo="Solicitud guardada con éxito">
                    <p>
                      Número <strong className="codigo">{guardada.codigo}</strong> · estado Pendiente.
                    </p>
                    <button
                      type="button"
                      className="boton boton-texto boton-pequeno"
                      style={{ paddingLeft: 0 }}
                      onClick={() => navegar(`/app/solicitudes/${guardada.id}`)}
                    >
                      Ver detalle
                    </button>
                  </Aviso>
                </div>
              )}
            </div>
            <FormularioSolicitud
              key={guardada?.id ?? 'nueva'}
              compacto
              onGuardar={async (datos) => {
                const s = await api.crearSolicitud(datos);
                setGuardada(s);
                setVersion((v) => v + 1);
              }}
            />
            <p className="ayuda" style={{ marginTop: 12 }}>
              Para marcar el punto en el mapa usa <Link to="/app/solicitudes/nueva">el formulario completo</Link>.
            </p>
          </section>
        ) : (
          <PanelPorProgramar version={version} />
        )}
      </div>
    </>
  );
}
