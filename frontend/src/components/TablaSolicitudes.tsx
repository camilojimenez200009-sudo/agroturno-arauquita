import { CalendarDays, Eye, Inbox, MapPin, Package, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type FiltrosSolicitudes, type Producto, type Solicitud } from '../services/api';
import { ETIQUETA_ESTADO, cantidad, fecha } from '../utils/formato';
import { Cargando, EstadoBadge, ErrorCarga, Paginacion, useCarga, Vacio } from './ui';

interface Props {
  /** Muestra la columna de productor (vistas de coordinación) */
  mostrarProductor?: boolean;
  /** Muestra la fecha programada en lugar de la disponible como dato principal */
  mostrarProgramacion?: boolean;
  /** Filtros fijos que el usuario no cambia (p. ej. estados de una vista) */
  filtrosFijos?: Partial<FiltrosSolicitudes>;
  ocultarFiltroEstado?: boolean;
  tamano?: number;
  /** Sincroniza filtros con la URL (?estado=...) */
  usarUrl?: boolean;
  vacio?: ReactNode;
  accion?: (s: Solicitud) => ReactNode;
  /** Cambia para forzar una recarga desde el padre */
  version?: number;
}

const FILTROS_VACIOS = { estado: '', producto_id: '', desde: '', hasta: '', q: '' };

export function TablaSolicitudes({
  mostrarProductor,
  mostrarProgramacion,
  filtrosFijos = {},
  ocultarFiltroEstado,
  tamano = 10,
  usarUrl,
  vacio,
  accion,
  version = 0,
}: Props) {
  const [params, setParams] = useSearchParams();
  const [filtros, setFiltros] = useState(() =>
    usarUrl
      ? {
          estado: params.get('estado') ?? '',
          producto_id: params.get('producto_id') ?? '',
          desde: params.get('desde') ?? '',
          hasta: params.get('hasta') ?? '',
          q: params.get('q') ?? '',
        }
      : FILTROS_VACIOS,
  );
  const [busqueda, setBusqueda] = useState(filtros.q);
  const [pagina, setPagina] = useState(1);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  useEffect(() => {
    api
      .productos()
      .then((r) => setProductos(r.datos))
      .catch(() => setProductos([]));
  }, []);

  // Búsqueda con pequeña espera para no consultar en cada tecla
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((f) => (f.q === busqueda ? f : { ...f, q: busqueda }));
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Si la URL cambia desde fuera (p. ej. clic en una tarjeta de estado), se sincroniza el filtro
  const estadoUrl = params.get('estado') ?? '';
  useEffect(() => {
    if (!usarUrl) return;
    setFiltros((f) => (f.estado === estadoUrl ? f : { ...f, estado: estadoUrl }));
    setPagina(1);
  }, [estadoUrl, usarUrl]);

  useEffect(() => {
    if (!usarUrl) return;
    const nuevos = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v) nuevos.set(k, v);
    setParams(nuevos, { replace: true });
  }, [filtros, usarUrl, setParams]);

  const fijosClave = JSON.stringify(filtrosFijos);
  const { datos, error, cargando, recargar } = useCarga(
    () => api.solicitudes({ ...filtros, ...filtrosFijos, pagina, tamano }),
    [filtros, fijosClave, pagina, tamano, version],
  );

  const cambiar = (campo: keyof typeof filtros, valor: string) => {
    setFiltros((f) => ({ ...f, [campo]: valor }));
    setPagina(1);
  };
  const hayFiltros = Object.values(filtros).some(Boolean);
  const limpiar = () => {
    setFiltros(FILTROS_VACIOS);
    setBusqueda('');
    setPagina(1);
  };

  const verDetalle = (s: Solicitud) => (
    <Link className="boton boton-neutro boton-pequeno" to={`/app/solicitudes/${s.id}`} aria-label={`Ver detalle de ${s.codigo}`}>
      <Eye size={16} aria-hidden="true" /> Ver detalle
    </Link>
  );

  return (
    <div>
      <div className={`filtros ${filtrosAbiertos ? 'abiertos' : ''}`} role="search" aria-label="Filtrar solicitudes">
        {!ocultarFiltroEstado && (
          <div className="campo">
            <label htmlFor="f-estado">Estado</label>
            <select id="f-estado" value={filtros.estado} onChange={(e) => cambiar('estado', e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ETIQUETA_ESTADO).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="campo">
          <label htmlFor="f-producto">Producto</label>
          <select id="f-producto" value={filtros.producto_id} onChange={(e) => cambiar('producto_id', e.target.value)}>
            <option value="">Todos</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="f-desde">Disponible desde</label>
          <input id="f-desde" type="date" value={filtros.desde} onChange={(e) => cambiar('desde', e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="f-hasta">Disponible hasta</label>
          <input id="f-hasta" type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => cambiar('hasta', e.target.value)} />
        </div>
        <div className="campo campo-busqueda">
          <label htmlFor="f-q">{mostrarProductor ? 'Buscar código, productor o vereda' : 'Buscar código'}</label>
          <div style={{ position: 'relative' }}>
            <Search size={18} aria-hidden="true" style={{ position: 'absolute', left: 10, top: 13, color: '#536578' }} />
            <input
              id="f-q"
              type="search"
              placeholder="Ej.: AT-00012"
              style={{ paddingLeft: 36 }}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="acciones" style={{ marginTop: -8, marginBottom: 12 }}>
        <button
          type="button"
          className="boton boton-neutro boton-pequeno solo-movil"
          aria-expanded={filtrosAbiertos}
          onClick={() => setFiltrosAbiertos((v) => !v)}
        >
          <SlidersHorizontal size={16} aria-hidden="true" /> {filtrosAbiertos ? 'Menos filtros' : 'Más filtros'}
        </button>
        {hayFiltros && (
          <button type="button" className="boton boton-texto boton-pequeno" onClick={limpiar}>
            <RotateCcw size={16} aria-hidden="true" /> Limpiar filtros
          </button>
        )}
      </div>

      <div className="tarjeta" aria-busy={cargando}>
        {error ? (
          <ErrorCarga error={error} reintentar={recargar} />
        ) : cargando && !datos ? (
          <Cargando texto="Consultando solicitudes…" />
        ) : !datos || datos.datos.length === 0 ? (
          hayFiltros ? (
            <Vacio icono={<Search size={36} aria-hidden="true" />} titulo="Sin resultados con estos filtros">
              <p>Ajusta los criterios o limpia los filtros para ver todas las solicitudes.</p>
            </Vacio>
          ) : (
            (vacio ?? (
              <Vacio icono={<Inbox size={36} aria-hidden="true" />} titulo="Sin registros todavía">
                <p>Cuando se registren solicitudes, aparecerán aquí con información actualizada.</p>
              </Vacio>
            ))
          )
        ) : (
          <>
            <div className="tabla-contenedor responsiva">
              <table className="tabla">
                <caption className="sr-only">Solicitudes de recolección</caption>
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Producto</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">{mostrarProgramacion ? 'Programada para' : 'Fecha disponible'}</th>
                    {mostrarProductor && <th scope="col">Productor</th>}
                    <th scope="col">Estado</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datos.datos.map((s) => (
                    <tr key={s.id}>
                      <td className="codigo">{s.codigo}</td>
                      <td>{s.producto.nombre}</td>
                      <td>{cantidad(s.cantidad, s.unidad)}</td>
                      <td>
                        {mostrarProgramacion && s.programacion ? (
                          <>
                            {fecha(s.programacion.fecha_programada)}
                            <div className="secundario">Disponible {fecha(s.fecha_disponible)}</div>
                          </>
                        ) : (
                          fecha(s.fecha_disponible)
                        )}
                      </td>
                      {mostrarProductor && (
                        <td>
                          {s.productor.nombre}
                          <div className="secundario">{s.productor.vereda}</div>
                        </td>
                      )}
                      <td>
                        <EstadoBadge estado={s.estado} />
                      </td>
                      <td>
                        <div className="acciones acciones-fin" style={{ flexWrap: 'nowrap' }}>
                          {accion?.(s)}
                          {verDetalle(s)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="lista-tarjetas" aria-label="Solicitudes">
              {datos.datos.map((s) => (
                <li key={s.id} className="tarjeta-solicitud">
                  <div className="cabecera">
                    <span className="codigo">{s.codigo}</span>
                    <EstadoBadge estado={s.estado} />
                  </div>
                  <strong>
                    {s.producto.nombre} · {cantidad(s.cantidad, s.unidad)}
                  </strong>
                  <div className="datos-linea">
                    <span>
                      <CalendarDays size={15} aria-hidden="true" />
                      {mostrarProgramacion && s.programacion
                        ? `Programada ${fecha(s.programacion.fecha_programada)}`
                        : `Disponible ${fecha(s.fecha_disponible)}`}
                    </span>
                    {mostrarProductor && (
                      <span>
                        <Package size={15} aria-hidden="true" />
                        {s.productor.nombre}
                      </span>
                    )}
                    <span>
                      <MapPin size={15} aria-hidden="true" />
                      {s.productor.vereda}
                    </span>
                  </div>
                  <div className="acciones">
                    {accion?.(s)}
                    {verDetalle(s)}
                  </div>
                </li>
              ))}
            </ul>
            <Paginacion pagina={datos.pagina} tamano={datos.tamano} total={datos.total} onCambiar={setPagina} />
          </>
        )}
      </div>
    </div>
  );
}
