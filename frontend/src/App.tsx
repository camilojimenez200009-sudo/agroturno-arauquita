import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Aviso, Cargando } from './components/ui';
import { ProveedorSesion, useSesion } from './context/Sesion';
import type { Rol } from './services/api';
import { DetalleSolicitud } from './pages/DetalleSolicitud';
import { AccesoDenegado, NoEncontrado } from './pages/Estados';
import { Inicio } from './pages/Inicio';
import { Login } from './pages/Login';
import { Perfil } from './pages/Perfil';
import { ProductosPagina } from './pages/Productos';
import { Programacion } from './pages/Programacion';
import { SeguimientoPagina } from './pages/SeguimientoPagina';
import { ListaSolicitudes, NuevaSolicitud } from './pages/Solicitudes';
import { UsuariosPagina } from './pages/Usuarios';

function RequiereSesion() {
  const { usuario, cargando, errorInicial } = useSesion();
  const ubicacion = useLocation();
  if (cargando) return <Cargando texto="Verificando sesión…" />;
  if (!usuario && errorInicial) {
    return (
      <div style={{ maxWidth: 520, margin: '64px auto', padding: 16 }}>
        <Aviso tipo="error" titulo="Sin conexión con el servidor">
          {errorInicial}
          <div style={{ marginTop: 8 }}>
            <button type="button" className="boton boton-neutro boton-pequeno" onClick={() => location.reload()}>
              Reintentar
            </button>
          </div>
        </Aviso>
      </div>
    );
  }
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  return <Outlet />;
}

/** La interfaz oculta lo que el rol no puede usar; el servidor además bloquea la operación */
function SoloRoles({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { tieneRol } = useSesion();
  return tieneRol(...roles) ? <>{children}</> : <AccesoDenegado />;
}

export default function App() {
  return (
    <ProveedorSesion>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequiereSesion />}>
            <Route path="/app" element={<Layout />}>
              <Route index element={<Navigate to="inicio" replace />} />
              <Route path="inicio" element={<Inicio />} />
              <Route path="mis-solicitudes" element={<SoloRoles roles={['PRODUCTOR']}><ListaSolicitudes /></SoloRoles>} />
              <Route path="solicitudes" element={<SoloRoles roles={['COORDINADOR', 'ADMINISTRADOR']}><ListaSolicitudes /></SoloRoles>} />
              <Route path="solicitudes/nueva" element={<SoloRoles roles={['PRODUCTOR']}><NuevaSolicitud /></SoloRoles>} />
              <Route path="solicitudes/:id" element={<DetalleSolicitud />} />
              <Route path="programacion" element={<SoloRoles roles={['COORDINADOR', 'ADMINISTRADOR']}><Programacion /></SoloRoles>} />
              <Route path="seguimiento" element={<SeguimientoPagina />} />
              <Route path="productos" element={<SoloRoles roles={['COORDINADOR', 'ADMINISTRADOR']}><ProductosPagina /></SoloRoles>} />
              <Route path="usuarios" element={<SoloRoles roles={['ADMINISTRADOR']}><UsuariosPagina /></SoloRoles>} />
              <Route path="perfil" element={<SoloRoles roles={['PRODUCTOR']}><Perfil /></SoloRoles>} />
              <Route path="*" element={<NoEncontrado />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/app/inicio" replace />} />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  );
}
