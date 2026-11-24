import { Package, PencilLine, Plus, Search, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Aviso, Campo, Cargando, Dialogo, ErrorCarga, mensajeError, useCarga, Vacio } from '../components/ui';
import { useSesion } from '../context/Sesion';
import { api, ErrorApi, type Producto } from '../services/api';

function FormularioProducto({ producto, onListo }: { producto?: Producto; onListo: (mensaje: string) => void }) {
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [unidades, setUnidades] = useState(producto?.unidades.join(', ') ?? '');
  const [defecto, setDefecto] = useState(producto?.unidad_defecto ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const lista = unidades
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);

  useEffect(() => {
    if (lista.length && !lista.includes(defecto)) setDefecto(lista[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidades]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const err: Record<string, string> = {};
    if (nombre.trim().length < 3) err.nombre = 'Mínimo 3 caracteres.';
    if (!lista.length) err.unidades = 'Escribe al menos una unidad.';
    setErrores(err);
    if (Object.keys(err).length) return;
    setEnviando(true);
    try {
      const datos = { nombre: nombre.trim(), unidades: lista, unidad_defecto: defecto };
      if (producto) await api.editarProducto(producto.id, datos);
      else await api.crearProducto(datos);
      onListo(producto ? 'Producto actualizado.' : 'Producto agregado al catálogo.');
      if (!producto) {
        setNombre('');
        setUnidades('');
      }
    } catch (e2) {
      if (e2 instanceof ErrorApi) setErrores(e2.campos);
      setError(mensajeError(e2));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo etiqueta="Nombre" requerido error={errores.nombre}>
        {(p) => <input {...p} maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />}
      </Campo>
      <Campo etiqueta="Unidades permitidas" requerido error={errores.unidades} ayuda="Separadas por coma. Ej.: racimos, kilogramos">
        {(p) => <input {...p} value={unidades} onChange={(e) => setUnidades(e.target.value)} />}
      </Campo>
      <Campo etiqueta="Unidad por defecto" requerido error={errores.unidad_defecto}>
        {(p) => (
          <select {...p} value={defecto} onChange={(e) => setDefecto(e.target.value)} disabled={!lista.length}>
            {lista.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <div className="acciones">
        <button className="boton boton-primario" type="submit" disabled={enviando}>
          {producto ? 'Guardar cambios' : (
            <>
              <Plus size={18} aria-hidden="true" /> Agregar producto
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function Catalogo() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMINISTRADOR';
  const { datos, error, cargando, recargar } = useCarga(() => api.productos(esAdmin), [esAdmin]);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  async function alternar(p: Producto) {
    setErrorAccion(null);
    try {
      await api.editarProducto(p.id, { activo: !p.activo });
      setAviso(p.activo ? `${p.nombre} quedó inactivo: ya no se puede elegir en nuevas solicitudes.` : `${p.nombre} está activo de nuevo.`);
      await recargar();
    } catch (e) {
      setErrorAccion(mensajeError(e));
    }
  }

  return (
    <div className={esAdmin ? 'rejilla-tablero' : undefined}>
      <section className="tarjeta" aria-labelledby="t-catalogo">
        <div className="panel" style={{ paddingBottom: 0 }}>
          <div className="panel-titulo">
            <h2 id="t-catalogo">Catálogo de productos</h2>
          </div>
          <div aria-live="polite" style={{ display: 'grid', gap: 8, marginBottom: aviso || errorAccion ? 12 : 0 }}>
            {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
            {errorAccion && <Aviso tipo="error">{errorAccion}</Aviso>}
          </div>
        </div>
        {error ? (
          <ErrorCarga error={error} reintentar={recargar} />
        ) : cargando && !datos ? (
          <Cargando />
        ) : !datos?.datos.length ? (
          <Vacio icono={<Package size={32} aria-hidden="true" />} titulo="Catálogo vacío" />
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Unidades</th>
                  <th scope="col">Estado</th>
                  {esAdmin && (
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {datos.datos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nombre}</strong>
                    </td>
                    <td>
                      {p.unidades.join(', ')}
                      <div className="secundario">Por defecto: {p.unidad_defecto}</div>
                    </td>
                    <td>{p.activo ? <span className="estado estado-COMPLETADA">Activo</span> : <span className="estado" style={{ background: '#eef1f4', color: '#536578' }}>Inactivo</span>}</td>
                    {esAdmin && (
                      <td>
                        <div className="acciones acciones-fin" style={{ flexWrap: 'nowrap' }}>
                          <button type="button" className="boton boton-neutro boton-pequeno" onClick={() => setEditando(p)} aria-label={`Editar ${p.nombre}`}>
                            <PencilLine size={16} aria-hidden="true" /> Editar
                          </button>
                          <button type="button" className="boton boton-texto boton-pequeno" onClick={() => alternar(p)}>
                            {p.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {esAdmin && (
        <section className="tarjeta panel" aria-labelledby="t-nuevo-producto">
          <h2 id="t-nuevo-producto" style={{ fontSize: '1.125rem', marginBottom: 16 }}>
            Nuevo producto
          </h2>
          <FormularioProducto
            onListo={(m) => {
              setAviso(m);
              void recargar();
            }}
          />
        </section>
      )}
      <Dialogo abierto={!!editando} titulo={`Editar ${editando?.nombre ?? ''}`} onCerrar={() => setEditando(null)}>
        {editando && (
          <FormularioProducto
            key={editando.id}
            producto={editando}
            onListo={(m) => {
              setEditando(null);
              setAviso(m);
              void recargar();
            }}
          />
        )}
        <button type="button" className="boton boton-neutro" onClick={() => setEditando(null)}>
          Cerrar
        </button>
      </Dialogo>
    </div>
  );
}

type Productor = Awaited<ReturnType<typeof api.productores>>['datos'][number];

function EditarProductor({ p, onListo }: { p: Productor; onListo: () => void }) {
  const [v, setV] = useState({ nombre_publico: p.nombre_publico, vereda: p.vereda, telefono: p.telefono ?? '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.editarProductor(p.id, { ...v, telefono: v.telefono.trim() || null });
      onListo();
    } catch (e2) {
      if (e2 instanceof ErrorApi) setErrores(e2.campos);
      setError(mensajeError(e2));
    }
  }
  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo etiqueta="Nombre público" requerido error={errores.nombre_publico}>
        {(x) => <input {...x} value={v.nombre_publico} onChange={(e) => setV({ ...v, nombre_publico: e.target.value })} />}
      </Campo>
      <Campo etiqueta="Vereda" requerido error={errores.vereda}>
        {(x) => <input {...x} value={v.vereda} onChange={(e) => setV({ ...v, vereda: e.target.value })} />}
      </Campo>
      <Campo etiqueta="Teléfono" error={errores.telefono} ayuda="Dato personal: visible solo para coordinación y administración.">
        {(x) => <input {...x} type="tel" value={v.telefono} onChange={(e) => setV({ ...v, telefono: e.target.value })} />}
      </Campo>
      <button className="boton boton-primario" type="submit">
        Guardar
      </button>
    </form>
  );
}

function Productores() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMINISTRADOR';
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Productor | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(q), 350);
    return () => clearTimeout(t);
  }, [q]);
  const { datos, error, cargando, recargar } = useCarga(() => api.productores({ q: busqueda }), [busqueda]);

  return (
    <section className="tarjeta" aria-labelledby="t-productores" style={{ marginTop: 24 }}>
      <div className="panel" style={{ paddingBottom: 12 }}>
        <div className="panel-titulo">
          <h2 id="t-productores">Productores</h2>
        </div>
        <div className="campo" style={{ maxWidth: 360 }}>
          <label htmlFor="q-productor">Buscar por nombre</label>
          <div style={{ position: 'relative' }}>
            <Search size={18} aria-hidden="true" style={{ position: 'absolute', left: 10, top: 13, color: '#536578' }} />
            <input id="q-productor" type="search" style={{ paddingLeft: 36 }} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {esAdmin && <p className="ayuda" style={{ marginTop: 8 }}>Las cuentas de productor se crean desde «Usuarios».</p>}
      </div>
      {error ? (
        <ErrorCarga error={error} reintentar={recargar} />
      ) : cargando && !datos ? (
        <Cargando />
      ) : !datos?.datos.length ? (
        <Vacio icono={<Users size={32} aria-hidden="true" />} titulo="Sin productores registrados" />
      ) : (
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Productor</th>
                <th scope="col">Vereda</th>
                <th scope="col">Teléfono</th>
                <th scope="col">Solicitudes</th>
                {esAdmin && (
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {datos.datos.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.nombre_publico}
                    {p.correo && <div className="secundario">{p.correo}</div>}
                  </td>
                  <td>{p.vereda}</td>
                  <td>{p.telefono ?? <span className="secundario">—</span>}</td>
                  <td>{p.total_solicitudes}</td>
                  {esAdmin && (
                    <td>
                      <button type="button" className="boton boton-neutro boton-pequeno" onClick={() => setEditando(p)} aria-label={`Editar ${p.nombre_publico}`}>
                        <PencilLine size={16} aria-hidden="true" /> Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialogo abierto={!!editando} titulo="Editar productor" onCerrar={() => setEditando(null)}>
        {editando && (
          <EditarProductor
            key={editando.id}
            p={editando}
            onListo={() => {
              setEditando(null);
              void recargar();
            }}
          />
        )}
        <button type="button" className="boton boton-neutro" onClick={() => setEditando(null)}>
          Cerrar
        </button>
      </Dialogo>
    </section>
  );
}

/** P09 · Productos y productores */
export function ProductosPagina() {
  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Productos y productores</h1>
          <p>El catálogo estandariza nombres y unidades para que los filtros y consultas sean consistentes.</p>
        </div>
      </div>
      <Catalogo />
      <Productores />
    </>
  );
}
