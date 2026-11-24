import { FileQuestion, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Vacio } from '../components/ui';

export function AccesoDenegado() {
  return (
    <div className="tarjeta">
      <Vacio icono={<ShieldAlert size={44} aria-hidden="true" />} titulo="Acceso denegado (403)">
        <p>Tu rol no tiene permiso para ver esta sección. El servidor también bloquea la operación.</p>
        <Link to="/app/inicio" className="boton boton-primario" style={{ marginTop: 12 }}>
          Ir al inicio
        </Link>
      </Vacio>
    </div>
  );
}

export function NoEncontrado() {
  return (
    <div className="tarjeta">
      <Vacio icono={<FileQuestion size={44} aria-hidden="true" />} titulo="No encontramos lo que buscas">
        <p>El registro no existe o no tienes acceso a él.</p>
        <Link to="/app/inicio" className="boton boton-primario" style={{ marginTop: 12 }}>
          Ir al inicio
        </Link>
      </Vacio>
    </div>
  );
}
