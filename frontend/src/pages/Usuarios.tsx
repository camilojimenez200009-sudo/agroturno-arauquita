import { History, KeyRound, Plus, Search, UserPlus, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Aviso, Campo, Cargando, Dialogo, ErrorCarga, mensajeError, useCarga, Vacio } from '../components/ui';
import { useSesion } from '../context/Sesion';
import { api, ErrorApi, type Rol } from '../services/api';
import { ETIQUETA_ROL, fechaHora } from '../utils/formato';

type FilaUsuario = Awaited<ReturnType<typeof api.usuarios>>['datos'][number];

function AltaUsuario({ onCreado }: { onCreado: (mensaje: string) => void }) {
  const vacio = { nombre: '', correo: '', contrasena: '', rol: 'PRODUCTOR' as Rol, vereda: '', telefono: '' };
  const [v, setV] = useState(vacio);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof v, valor: string) => {
    setV((x) => ({ ...x, [k]: valor }));
    setErrores((e) => ({ ...e, [k]: '' }));
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api.crearUsuario({
        nombre: v.nombre,
        correo: v.correo,
        contrasena: v.contrasena,
        rol: v.rol,
        ...(v.rol === 'PRODUCTOR' ? { vereda: v.vereda, telefono: v.telefono || null } : {}),
      });
      onCreado(`Cuenta creada para ${v.correo}. Entrega la contraseña por un canal seguro.`);
      setV(vacio);
      setErrores({});
    } catch (e2) {
      if (e2 instanceof ErrorApi) setErrores(e2.campos);
      setError(mensajeError(e2));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate aria-busy={enviando}>
      {error && <Aviso tipo="error" titulo="No se creó la cuenta">{error}</Aviso>}
      <Campo etiqueta="Nombre" requerido error={errores.nombre}>
        {(p) => <input {...p} autoComplete="off" value={v.nombre} onChange={(e) => set('nombre', e.target.value)} />}
      </Campo>
      <Campo etiqueta="Correo" requerido error={errores.correo}>
        {(p) => <input {...p} type="email" autoComplete="off" value={v.correo} onChange={(e) => set('correo', e.target.value)} />}
      </Campo>
      <Campo etiqueta="Contraseña inicial" requerido error={errores.contrasena} ayuda="Mínimo 10 caracteres con letras y números.">
        {(p) => <input {...p} type="password" autoComplete="new-password" value={v.contrasena} onChange={(e) => set('contrasena', e.target.value)} />}
      </Campo>
      <Campo etiqueta="Rol" requerido error={errores.rol}>
        {(p) => (
          <select {...p} value={v.rol} onChange={(e) => set('rol', e.target.value)}>
            {Object.entries(ETIQUETA_ROL).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        )}
      </Campo>
      {v.rol === 'PRODUCTOR' && (
        <div className="fila-campos">
          <Campo etiqueta="Vereda" requerido error={errores.vereda}>
            {(p) => <input {...p} value={v.vereda} onChange={(e) => set('vereda', e.target.value)} />}
          </Campo>
          <Campo etiqueta="Teléfono" error={errores.telefono}>
            {(p) => <input {...p} type="tel" value={v.telefono} onChange={(e) => set('telefono', e.target.value)} />}
          </Campo>
        </div>
      )}
      <button className="boton boton-primario" type="submit" disabled={enviando}>
        <UserPlus size={18} aria-hidden="true" /> {enviando ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  );
}

function Auditoria({ usuario }: { usuario: FilaUsuario }) {
  const { datos, error, cargando } = useCarga(() => api.auditoriaUsuario(usuario.id), [usuario.id]);
  if (error) return <Aviso tipo="error">{mensajeError(error)}</Aviso>;
  if (cargando || !datos) return <Cargando />;
  if (!datos.datos.length) return <p className="secundario">Sin registros de auditoría.</p>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, maxHeight: 320, overflow: 'auto' }}>
      {datos.datos.map((a) => (
        <li key={a.id}>
          <strong>{a.accion.replace('_', ' ').toLowerCase()}</strong>
          {a.detalle && 'antes' in a.detalle && ` · ${String(a.detalle.antes)} → ${String(a.detalle.despues)}`}
          <div className="secundario">
            {fechaHora(a.creado_en)} · {a.actor_nombre ?? 'sistema'}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CambiarContrasena({ usuario, onListo }: { usuario: FilaUsuario; onListo: (m: string) => void }) {
  const [valor, setValor] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.editarUsuario(usuario.id, { contrasena: valor });
      onListo(`Contraseña actualizada para ${usuario.correo}. Sus sesiones abiertas se cerraron.`);
    } catch (e2) {
      setError(e2 instanceof ErrorApi && e2.campos.contrasena ? e2.campos.contrasena : mensajeError(e2));
    }
  }
  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <Campo etiqueta="Nueva contraseña" requerido error={error ?? undefined} ayuda="Mínimo 10 caracteres con letras y números.">
        {(p) => <input {...p} type="password" autoComplete="new-password" value={valor} onChange={(e) => setValor(e.target.value)} />}
      </Campo>
      <button type="submit" className="boton boton-primario">
        Guardar contraseña
      </button>
    </form>
  );
}

/** P10 · Usuarios y roles (solo administración) */
export function UsuariosPagina() {
  const { usuario: yo } = useSesion();
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [rol, setRol] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<{ tipo: 'auditoria' | 'contrasena'; u: FilaUsuario } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBusqueda(q), 350);
    return () => clearTimeout(t);
  }, [q]);
  const { datos, error, cargando, recargar } = useCarga(() => api.usuarios({ q: busqueda, rol }), [busqueda, rol]);

  async function editar(u: FilaUsuario, cambios: Record<string, unknown>, mensaje: string) {
    setErrorAccion(null);
    try {
      await api.editarUsuario(u.id, cambios);
      setAviso(mensaje);
      await recargar();
    } catch (e) {
      setErrorAccion(e instanceof ErrorApi && e.campos.rol ? e.campos.rol : mensajeError(e));
    }
  }

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Usuarios y roles</h1>
          <p>Altas, cambios de rol y desactivaciones quedan auditados con fecha y responsable.</p>
        </div>
      </div>
      <div aria-live="polite" style={{ display: 'grid', gap: 8, marginBottom: aviso || errorAccion ? 16 : 0 }}>
        {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
        {errorAccion && <Aviso tipo="error">{errorAccion}</Aviso>}
      </div>
      <div className="rejilla-tablero">
        <section className="tarjeta" aria-labelledby="t-cuentas">
          <div className="panel" style={{ paddingBottom: 12 }}>
            <div className="panel-titulo">
              <h2 id="t-cuentas">Cuentas</h2>
            </div>
            <div className="fila-campos">
              <div className="campo">
                <label htmlFor="q-usuario">Buscar nombre o correo</label>
                <div style={{ position: 'relative' }}>
                  <Search size={18} aria-hidden="true" style={{ position: 'absolute', left: 10, top: 13, color: '#536578' }} />
                  <input id="q-usuario" type="search" style={{ paddingLeft: 36 }} value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </div>
              <div className="campo">
                <label htmlFor="f-rol">Rol</label>
                <select id="f-rol" value={rol} onChange={(e) => setRol(e.target.value)}>
                  <option value="">Todos</option>
                  {Object.entries(ETIQUETA_ROL).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {error ? (
            <ErrorCarga error={error} reintentar={recargar} />
          ) : cargando && !datos ? (
            <Cargando />
          ) : !datos?.datos.length ? (
            <Vacio icono={<Users size={32} aria-hidden="true" />} titulo="Sin cuentas con estos criterios" />
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th scope="col">Usuario</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estado</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datos.datos.map((u) => {
                    const propio = u.id === yo?.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.nombre}</strong>
                          {propio && <span className="secundario"> (tú)</span>}
                          <div className="secundario">{u.correo}</div>
                          {u.vereda && <div className="secundario">{u.vereda}</div>}
                        </td>
                        <td>
                          {u.rol === 'PRODUCTOR' || propio ? (
                            ETIQUETA_ROL[u.rol]
                          ) : (
                            <select
                              aria-label={`Rol de ${u.nombre}`}
                              value={u.rol}
                              style={{ minHeight: 36, borderRadius: 6, border: '1px solid #b9c8d3', padding: '4px 8px', font: 'inherit' }}
                              onChange={(e) => editar(u, { rol: e.target.value }, `Rol de ${u.nombre} actualizado. Sus sesiones se cerraron.`)}
                            >
                              <option value="COORDINADOR">Coordinador</option>
                              <option value="ADMINISTRADOR">Administrador</option>
                            </select>
                          )}
                        </td>
                        <td>
                          {u.activo ? (
                            <span className="estado estado-COMPLETADA">Activa</span>
                          ) : (
                            <span className="estado" style={{ background: '#eef1f4', color: '#536578' }}>
                              Inactiva
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="acciones acciones-fin" style={{ flexWrap: 'nowrap' }}>
                            <button type="button" className="boton boton-neutro boton-pequeno" title="Auditoría" aria-label={`Auditoría de ${u.nombre}`} onClick={() => setDialogo({ tipo: 'auditoria', u })}>
                              <History size={16} aria-hidden="true" />
                            </button>
                            <button type="button" className="boton boton-neutro boton-pequeno" title="Cambiar contraseña" aria-label={`Cambiar contraseña de ${u.nombre}`} onClick={() => setDialogo({ tipo: 'contrasena', u })}>
                              <KeyRound size={16} aria-hidden="true" />
                            </button>
                            {!propio && (
                              <button
                                type="button"
                                className={`boton boton-pequeno ${u.activo ? 'boton-peligro' : 'boton-secundario'}`}
                                onClick={() =>
                                  editar(u, { activo: !u.activo }, u.activo ? `${u.nombre} desactivado. No podrá ingresar.` : `${u.nombre} activado.`)
                                }
                              >
                                {u.activo ? 'Desactivar' : 'Activar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="tarjeta panel" aria-labelledby="t-alta">
          <h2 id="t-alta" style={{ fontSize: '1.125rem', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Plus size={20} aria-hidden="true" /> Nueva cuenta
          </h2>
          <AltaUsuario
            onCreado={(m) => {
              setAviso(m);
              void recargar();
            }}
          />
        </section>
      </div>
      <Dialogo
        abierto={!!dialogo}
        titulo={dialogo?.tipo === 'auditoria' ? `Auditoría · ${dialogo.u.nombre}` : `Contraseña · ${dialogo?.u.nombre ?? ''}`}
        onCerrar={() => setDialogo(null)}
      >
        {dialogo?.tipo === 'auditoria' && <Auditoria usuario={dialogo.u} />}
        {dialogo?.tipo === 'contrasena' && (
          <CambiarContrasena
            usuario={dialogo.u}
            onListo={(m) => {
              setDialogo(null);
              setAviso(m);
            }}
          />
        )}
        <button type="button" className="boton boton-neutro" onClick={() => setDialogo(null)}>
          Cerrar
        </button>
      </Dialogo>
    </>
  );
}
