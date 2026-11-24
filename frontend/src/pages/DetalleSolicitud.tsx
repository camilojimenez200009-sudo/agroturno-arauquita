import { ArrowLeft, CalendarCheck, MapPin, PencilLine, Phone, Truck } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FormularioProgramacion } from '../components/FormularioProgramacion';
import { FormularioSolicitud } from '../components/FormularioSolicitud';
import { BotonCambioEstado, Historial, PasosEstado } from '../components/Seguimiento';
import { Aviso, Cargando, ErrorCarga, EstadoBadge, LimiteError, useCarga } from '../components/ui';
import { useSesion } from '../context/Sesion';
import { api, ErrorApi, type Solicitud } from '../services/api';
import { ETIQUETA_FRANJA, cantidad, fecha, fechaHora } from '../utils/formato';
import { NoEncontrado } from './Estados';

const Mapa = lazy(() => import('../components/Mapa'));

function UbicacionSolicitud({ s }: { s: Solicitud }) {
  const [mapaFallo, setMapaFallo] = useState(false);
  const hayPunto = s.latitud != null && s.longitud != null;
  return (
    <section className="tarjeta panel" aria-labelledby="t-ubicacion">
      <div className="panel-titulo">
        <h2 id="t-ubicacion">Ubicación</h2>
      </div>
      <p style={{ display: 'flex', gap: 8 }}>
        <MapPin size={20} aria-hidden="true" color="var(--color-accion)" />
        <span>
          <strong>Referencia textual:</strong> {s.ubicacion_texto}
        </span>
      </p>
      {hayPunto ? (
        <div style={{ marginTop: 12 }}>
          {mapaFallo && (
            <div style={{ marginBottom: 8 }}>
              <Aviso tipo="alerta" titulo="El mapa no está disponible">
                Usa la referencia textual. Coordenadas: {s.latitud?.toFixed(5)}, {s.longitud?.toFixed(5)}
              </Aviso>
            </div>
          )}
          <LimiteError
            alternativa={
              <Aviso tipo="alerta" titulo="No se pudo cargar el mapa">
                La referencia textual sigue disponible. Coordenadas: {s.latitud?.toFixed(5)}, {s.longitud?.toFixed(5)}
              </Aviso>
            }
          >
            <Suspense fallback={<Cargando texto="Cargando mapa…" />}>
              <Mapa latitud={s.latitud} longitud={s.longitud} onErrorTeselas={() => setMapaFallo(true)} />
            </Suspense>
          </LimiteError>
          <p className="ayuda" style={{ marginTop: 6 }}>
            Punto aproximado registrado por el usuario. No es un servicio de navegación ni de rastreo.
          </p>
        </div>
      ) : (
        <p className="ayuda" style={{ marginTop: 8 }}>
          Sin punto en el mapa: la ubicación textual es la referencia para la recogida.
        </p>
      )}
    </section>
  );
}

export function DetalleSolicitud() {
  const { id = '' } = useParams();
  const { usuario } = useSesion();
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const [modo, setModo] = useState<'ver' | 'editar' | 'programar'>(() =>
    params.get('accion') === 'programar' ? 'programar' : 'ver',
  );
  const [aviso, setAviso] = useState<string | null>(null);

  const { datos: s, error, cargando, setDatos, recargar } = useCarga(() => api.solicitud(id), [id]);
  const historial = useCarga(() => api.historial(id), [id, s?.actualizada_en, s?.programacion?.actualizada_en]);

  if (error instanceof ErrorApi && (error.estado === 404 || error.estado === 422)) return <NoEncontrado />;
  if (error) return <ErrorCarga error={error} reintentar={recargar} />;
  if (cargando || !s) return <Cargando texto="Cargando solicitud…" />;

  const esGestor = usuario?.rol !== 'PRODUCTOR';
  const actualizar = (nueva: Solicitud, mensaje: string) => {
    setDatos(nueva);
    setModo('ver');
    setAviso(mensaje);
    if (params.get('accion')) setParams({}, { replace: true });
    void historial.recargar();
  };

  return (
    <>
      <Link to={esGestor ? '/app/solicitudes' : '/app/mis-solicitudes'} className="miga">
        <ArrowLeft size={16} aria-hidden="true" /> {esGestor ? 'Solicitudes' : 'Mis solicitudes'}
      </Link>
      <div className="encabezado-pagina">
        <div>
          <h1 style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            Solicitud <span className="codigo" style={{ fontSize: 'inherit' }}>{s.codigo}</span> <EstadoBadge estado={s.estado} />
          </h1>
          <p>
            Registrada el {fechaHora(s.creada_en)} por {s.creado_por}
          </p>
        </div>
        {modo === 'ver' && (
          <div className="acciones">
            {s.permisos.editar && (
              <button type="button" className="boton boton-neutro" onClick={() => setModo('editar')}>
                <PencilLine size={18} aria-hidden="true" /> Editar
              </button>
            )}
            {s.permisos.programar && (
              <button type="button" className="boton boton-secundario" onClick={() => setModo('programar')}>
                <CalendarCheck size={18} aria-hidden="true" /> {s.programacion ? 'Reprogramar' : 'Programar'}
              </button>
            )}
            <BotonCambioEstado solicitud={s} onCambiado={(n) => actualizar(n, 'Estado actualizado y registrado en el historial.')} />
          </div>
        )}
      </div>

      <div aria-live="polite">
        {aviso && (
          <div style={{ marginBottom: 16 }}>
            <Aviso tipo="exito">{aviso}</Aviso>
          </div>
        )}
      </div>

      <div className="tarjeta panel" style={{ marginBottom: 24 }}>
        <PasosEstado estado={s.estado} />
      </div>

      {modo === 'editar' && (
        <section className="tarjeta panel" style={{ marginBottom: 24, maxWidth: 760 }} aria-labelledby="t-editar">
          <h2 id="t-editar" style={{ marginBottom: 16 }}>
            Editar solicitud
          </h2>
          <FormularioSolicitud
            inicial={{
              producto_id: s.producto.id,
              cantidad: s.cantidad,
              unidad: s.unidad,
              ubicacion_texto: s.ubicacion_texto,
              latitud: s.latitud,
              longitud: s.longitud,
              fecha_disponible: s.fecha_disponible,
              notas: s.notas,
            }}
            conMotivo={esGestor}
            textoBoton="Guardar cambios"
            onGuardar={async (datos) => actualizar(await api.editarSolicitud(s.id, datos), 'Cambios guardados. Quedaron registrados en el historial.')}
            onCancelar={() => setModo('ver')}
          />
        </section>
      )}

      {modo === 'programar' && s.permisos.programar && (
        <section className="tarjeta panel" style={{ marginBottom: 24, maxWidth: 760 }} aria-labelledby="t-programar">
          <h2 id="t-programar" style={{ marginBottom: 16 }}>
            {s.programacion ? 'Reprogramar recolección' : 'Programar recolección'}
          </h2>
          <FormularioProgramacion
            solicitud={s}
            onGuardado={(n) => actualizar(n, s.programacion ? 'Programación actualizada.' : `Solicitud ${n.codigo} programada.`)}
            onCancelar={() => {
              setModo('ver');
              if (params.get('accion')) setParams({}, { replace: true });
            }}
          />
        </section>
      )}

      <div className="rejilla-detalle">
        <div className="pila">
          <section className="tarjeta panel" aria-labelledby="t-datos">
            <div className="panel-titulo">
              <h2 id="t-datos">Datos de la solicitud</h2>
            </div>
            <dl className="lista-datos">
              <dt>Código</dt>
              <dd className="codigo">{s.codigo}</dd>
              <dt>Producto</dt>
              <dd>{s.producto.nombre}</dd>
              <dt>Cantidad</dt>
              <dd>{cantidad(s.cantidad, s.unidad)}</dd>
              <dt>Fecha disponible</dt>
              <dd>{fecha(s.fecha_disponible)}</dd>
              <dt>Productor</dt>
              <dd>
                {s.productor.nombre} · {s.productor.vereda}
                {esGestor && s.productor.telefono && (
                  <div className="secundario">
                    <Phone size={13} aria-hidden="true" /> <a href={`tel:${s.productor.telefono}`}>{s.productor.telefono}</a>
                  </div>
                )}
              </dd>
              <dt>Notas</dt>
              <dd>{s.notas || <span className="secundario">Sin notas</span>}</dd>
              <dt>Última actualización</dt>
              <dd>{fechaHora(s.actualizada_en)}</dd>
            </dl>
          </section>

          <section className="tarjeta panel" aria-labelledby="t-programacion">
            <div className="panel-titulo">
              <h2 id="t-programacion">Programación y transporte</h2>
            </div>
            {s.programacion ? (
              <dl className="lista-datos">
                <dt>Fecha acordada</dt>
                <dd>
                  <strong>{fecha(s.programacion.fecha_programada)}</strong>
                </dd>
                <dt>Franja</dt>
                <dd>{ETIQUETA_FRANJA[s.programacion.franja]}</dd>
                <dt>Programada por</dt>
                <dd>{s.programacion.coordinador}</dd>
                <dt>Transporte</dt>
                <dd>
                  {s.programacion.transporte ? (
                    <>
                      <Truck size={15} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {s.programacion.transporte.nombre_contacto}
                      {s.programacion.transporte.tipo_vehiculo && ` · ${s.programacion.transporte.tipo_vehiculo}`}
                      {s.programacion.transporte.telefono && (
                        <div className="secundario">
                          <Phone size={13} aria-hidden="true" />{' '}
                          <a href={`tel:${s.programacion.transporte.telefono}`}>{s.programacion.transporte.telefono}</a>
                        </div>
                      )}
                      {s.programacion.transporte.observaciones && <div className="secundario">{s.programacion.transporte.observaciones}</div>}
                    </>
                  ) : (
                    <span className="secundario">Sin datos de transporte asociados</span>
                  )}
                </dd>
              </dl>
            ) : (
              <p className="secundario">
                Sin programar. {esGestor ? 'Registra la fecha acordada con el botón «Programar».' : 'Coordinación registrará la fecha acordada.'}
              </p>
            )}
          </section>

          <UbicacionSolicitud s={s} />
        </div>

        <section className="tarjeta panel" aria-labelledby="t-historial">
          <div className="panel-titulo">
            <h2 id="t-historial">Historial</h2>
            <span className="secundario">Hora de Arauquita</span>
          </div>
          {historial.error ? (
            <ErrorCarga error={historial.error} reintentar={historial.recargar} />
          ) : !historial.datos ? (
            <Cargando texto="Cargando historial…" />
          ) : (
            <Historial eventos={historial.datos.datos} />
          )}
        </section>
      </div>

      <div style={{ marginTop: 24 }}>
        <button type="button" className="boton boton-texto" onClick={() => navegar(-1)}>
          <ArrowLeft size={16} aria-hidden="true" /> Volver
        </button>
      </div>
    </>
  );
}
