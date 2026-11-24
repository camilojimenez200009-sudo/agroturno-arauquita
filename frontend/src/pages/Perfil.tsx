import { useState, type FormEvent } from 'react';
import { Aviso, Campo, mensajeError } from '../components/ui';
import { useSesion } from '../context/Sesion';
import { api, ErrorApi } from '../services/api';

/** Perfil del productor: datos mínimos, sin información personal innecesaria */
export function Perfil() {
  const { usuario, productor, recargar } = useSesion();
  const [vereda, setVereda] = useState(productor?.vereda ?? '');
  const [telefono, setTelefono] = useState(productor?.telefono ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setAviso(null);
    setEnviando(true);
    try {
      await api.editarMiPerfil({ vereda: vereda.trim(), telefono: telefono.trim() || null });
      await recargar();
      setErrores({});
      setAviso({ tipo: 'exito', texto: 'Perfil actualizado.' });
    } catch (e2) {
      if (e2 instanceof ErrorApi) setErrores(e2.campos);
      setAviso({ tipo: 'error', texto: mensajeError(e2) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Mi perfil</h1>
          <p>Coordinación usa estos datos para acordar la recolección.</p>
        </div>
      </div>
      <div className="tarjeta panel" style={{ maxWidth: 560 }}>
        <dl className="lista-datos" style={{ marginBottom: 24 }}>
          <dt>Nombre</dt>
          <dd>{productor?.nombre_publico ?? usuario?.nombre}</dd>
          <dt>Correo</dt>
          <dd>{usuario?.correo}</dd>
        </dl>
        <form className="formulario" onSubmit={enviar} noValidate aria-busy={enviando}>
          <div aria-live="polite">{aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}</div>
          <Campo etiqueta="Vereda" requerido error={errores.vereda}>
            {(p) => <input {...p} value={vereda} onChange={(e) => setVereda(e.target.value)} />}
          </Campo>
          <Campo etiqueta="Teléfono de contacto" error={errores.telefono} ayuda="Opcional. Solo lo ven coordinación y administración.">
            {(p) => <input {...p} type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />}
          </Campo>
          <div>
            <button type="submit" className="boton boton-primario" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
