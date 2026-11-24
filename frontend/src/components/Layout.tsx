import {
  CalendarClock,
  ClipboardList,
  House,
  ListChecks,
  LogOut,
  Menu,
  Package,
  Route as RutaIcono,
  UserCog,
  UserRound,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../context/Sesion';
import type { Rol } from '../services/api';
import { ETIQUETA_ROL, iniciales } from '../utils/formato';

interface Enlace {
  a: string;
  texto: string;
  icono: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  roles: Rol[];
}

// Menú diferenciado por rol (Guía técnica, capítulo 05)
const ENLACES: Enlace[] = [
  { a: '/app/inicio', texto: 'Inicio', icono: House, roles: ['PRODUCTOR', 'COORDINADOR', 'ADMINISTRADOR'] },
  { a: '/app/mis-solicitudes', texto: 'Mis solicitudes', icono: ClipboardList, roles: ['PRODUCTOR'] },
  { a: '/app/solicitudes', texto: 'Solicitudes', icono: ClipboardList, roles: ['COORDINADOR', 'ADMINISTRADOR'] },
  { a: '/app/programacion', texto: 'Programación', icono: CalendarClock, roles: ['COORDINADOR', 'ADMINISTRADOR'] },
  { a: '/app/seguimiento', texto: 'Seguimiento', icono: RutaIcono, roles: ['PRODUCTOR', 'COORDINADOR', 'ADMINISTRADOR'] },
  { a: '/app/productos', texto: 'Productos y productores', icono: Package, roles: ['COORDINADOR', 'ADMINISTRADOR'] },
  { a: '/app/usuarios', texto: 'Usuarios', icono: Users, roles: ['ADMINISTRADOR'] },
  { a: '/app/perfil', texto: 'Mi perfil', icono: UserRound, roles: ['PRODUCTOR'] },
];

function useEnLinea() {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return enLinea;
}

export function Layout() {
  const { usuario, salir } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const enLinea = useEnLinea();

  useEffect(() => setMenuAbierto(false), [ubicacion.pathname]);

  if (!usuario) return null;
  const enlaces = ENLACES.filter((e) => e.roles.includes(usuario.rol));

  async function cerrarSesion() {
    await salir().catch(() => undefined);
    navegar('/login', { replace: true });
  }

  return (
    <div className="app">
      <a href="#contenido" className="saltar-contenido">
        Saltar al contenido
      </a>
      <header className="barra-superior">
        <button
          type="button"
          className="boton-menu"
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
          aria-controls="menu-principal"
          onClick={() => setMenuAbierto((v) => !v)}
        >
          {menuAbierto ? <X size={24} aria-hidden /> : <Menu size={24} aria-hidden />}
        </button>
        <NavLink to="/app/inicio" className="marca" aria-label="AgroTurno Arauquita, ir al inicio">
          <img src="/brand/agroturno-isotipo.svg" alt="" width={36} height={36} />
          <span className="marca-texto">
            <span className="marca-nombre">
              AgroTurno <span>Arauquita</span>
            </span>
            <span className="marca-lugar">Arauquita, Arauca</span>
          </span>
        </NavLink>
        <div className="barra-usuario">
          <span className="datos-usuario" style={{ textAlign: 'right' }}>
            <strong>{usuario.nombre}</strong>
            <span className="rol">{ETIQUETA_ROL[usuario.rol]}</span>
          </span>
          <span className="avatar" aria-hidden="true">
            {iniciales(usuario.nombre) || <UserCog size={18} />}
          </span>
        </div>
      </header>

      {!enLinea && (
        <div className="banda-conexion" role="status">
          <WifiOff size={16} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />
          Sin conexión. Puedes revisar lo que ya está en pantalla, pero no se guardarán cambios hasta recuperar la red.
        </div>
      )}

      {menuAbierto && <div className="velo" onClick={() => setMenuAbierto(false)} aria-hidden="true" />}
      <aside id="menu-principal" className={`menu-lateral ${menuAbierto ? 'abierto' : ''}`}>
        <nav aria-label="Navegación principal">
          <ul>
            {enlaces.map(({ a, texto, icono: Icono }) => (
              <li key={a}>
                <NavLink to={a} className={({ isActive }) => (isActive ? 'activo' : undefined)}>
                  <Icono size={20} aria-hidden />
                  {texto}
                </NavLink>
              </li>
            ))}
          </ul>
          <hr className="menu-separador" />
          <ul>
            <li>
              <button type="button" onClick={cerrarSesion}>
                <LogOut size={20} aria-hidden="true" />
                Cerrar sesión
              </button>
            </li>
          </ul>
        </nav>
        <div className="menu-pie">
          <ListChecks size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Sesión como{' '}
          {ETIQUETA_ROL[usuario.rol].toLowerCase()}
          <br />
          Prototipo académico · datos ficticios
        </div>
      </aside>

      <main id="contenido" className="contenido" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
