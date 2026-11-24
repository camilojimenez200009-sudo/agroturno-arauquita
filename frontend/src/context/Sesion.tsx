import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ErrorApi, registrarPerdidaSesion, type PerfilProductor, type Rol, type Usuario } from '../services/api';

interface EstadoSesion {
  usuario: Usuario | null;
  productor: PerfilProductor | null;
  cargando: boolean;
  errorInicial: string | null;
  ingresar: (correo: string, contrasena: string) => Promise<void>;
  salir: () => Promise<void>;
  recargar: () => Promise<void>;
  tieneRol: (...roles: Rol[]) => boolean;
  sesionVencida: boolean;
}

const ContextoSesion = createContext<EstadoSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [productor, setProductor] = useState<PerfilProductor | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorInicial, setErrorInicial] = useState<string | null>(null);
  const [sesionVencida, setSesionVencida] = useState(false);

  const recargar = useCallback(async () => {
    try {
      const datos = await api.yo();
      setUsuario(datos.usuario);
      setProductor(datos.productor);
      setErrorInicial(null);
    } catch (error) {
      setUsuario(null);
      setProductor(null);
      if (error instanceof ErrorApi && error.esRed) setErrorInicial(error.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    registrarPerdidaSesion(() => {
      setUsuario(null);
      setProductor(null);
      setSesionVencida(true);
    });
    void recargar();
  }, [recargar]);

  const ingresar = useCallback(
    async (correo: string, contrasena: string) => {
      await api.login(correo, contrasena);
      setSesionVencida(false);
      await recargar();
    },
    [recargar],
  );

  const salir = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUsuario(null);
      setProductor(null);
    }
  }, []);

  const valor = useMemo<EstadoSesion>(
    () => ({
      usuario,
      productor,
      cargando,
      errorInicial,
      ingresar,
      salir,
      recargar,
      sesionVencida,
      tieneRol: (...roles) => !!usuario && roles.includes(usuario.rol),
    }),
    [usuario, productor, cargando, errorInicial, ingresar, salir, recargar, sesionVencida],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion() {
  const ctx = useContext(ContextoSesion);
  if (!ctx) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return ctx;
}
