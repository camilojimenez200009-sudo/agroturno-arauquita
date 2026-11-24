import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Aviso, Campo, mensajeError } from '../components/ui';
import { useSesion } from '../context/Sesion';

export function Login() {
  const { usuario, ingresar, sesionVencida } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/app/inicio';
  if (usuario) return <Navigate to={destino} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const err: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) err.correo = 'Escribe un correo válido.';
    if (!contrasena) err.contrasena = 'Escribe tu contraseña.';
    setErrores(err);
    if (Object.keys(err).length) return;
    setEnviando(true);
    try {
      await ingresar(correo.trim(), contrasena);
      navegar(destino, { replace: true });
    } catch (e2) {
      setError(mensajeError(e2));
      setContrasena('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <section className="login-lateral" aria-label="Presentación">
        <div className="marca">
          <img src="/brand/agroturno-isotipo.svg" alt="" width={44} height={44} />
          <span className="marca-texto">
            <span className="marca-nombre" style={{ fontSize: '1.375rem' }}>
              AgroTurno <span>Arauquita</span>
            </span>
            <span className="marca-lugar">Arauquita, Arauca</span>
          </span>
        </div>
        <div>
          <h1>Coordinación de recolección y transporte agrícola</h1>
          <p style={{ marginTop: 16 }}>
            Registra solicitudes de recolección, programa su atención y consulta el historial de cada cambio en un solo lugar.
          </p>
          <ol className="login-flujo" aria-label="Recorrido de una solicitud">
            <li>1. Solicitud</li>
            <li>2. Programación</li>
            <li>3. En proceso</li>
            <li>4. Completada</li>
          </ol>
        </div>
        <p className="login-pie" style={{ fontSize: '0.8125rem' }}>
          Prototipo académico · Proyecto de grado, Ingeniería de Sistemas, UNAD. Usa únicamente datos ficticios.
        </p>
      </section>

      <main className="login-principal">
        <div className="tarjeta login-tarjeta">
          <h2 style={{ fontSize: '1.5rem' }}>Iniciar sesión</h2>
          <p className="secundario" style={{ margin: '6px 0 24px' }}>
            Ingresa con la cuenta asignada por el administrador.
          </p>
          <form className="formulario" onSubmit={enviar} noValidate aria-busy={enviando}>
            {sesionVencida && !error && (
              <Aviso tipo="info" titulo="Tu sesión terminó">
                Vuelve a ingresar para continuar.
              </Aviso>
            )}
            {error && (
              <Aviso tipo="error" titulo="No pudiste ingresar">
                {error}
              </Aviso>
            )}
            <Campo etiqueta="Correo" requerido error={errores.correo}>
              {(p) => (
                <input
                  {...p}
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
              )}
            </Campo>
            <Campo etiqueta="Contraseña" requerido error={errores.contrasena}>
              {(p) => (
                <input
                  {...p}
                  type="password"
                  autoComplete="current-password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                />
              )}
            </Campo>
            <button type="submit" className="boton boton-primario boton-ancho" disabled={enviando}>
              <LogIn size={18} aria-hidden="true" />
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
