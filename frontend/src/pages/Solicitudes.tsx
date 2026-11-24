import { ArrowLeft, CheckCircle2, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FormularioSolicitud } from '../components/FormularioSolicitud';
import { TablaSolicitudes } from '../components/TablaSolicitudes';
import { Aviso } from '../components/ui';
import { useSesion } from '../context/Sesion';
import { api, type Solicitud } from '../services/api';
import { Metricas } from './Inicio';

/** P03 (productor) y listado general de coordinación */
export function ListaSolicitudes() {
  const { usuario } = useSesion();
  const esProductor = usuario?.rol === 'PRODUCTOR';
  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>{esProductor ? 'Mis solicitudes' : 'Solicitudes'}</h1>
          <p>
            {esProductor
              ? 'Solo ves las solicitudes registradas con tu cuenta.'
              : 'Todas las solicitudes registradas. Combina filtros por estado, producto y fecha.'}
          </p>
        </div>
        {esProductor && (
          <Link to="/app/solicitudes/nueva" className="boton boton-primario">
            <Plus size={18} aria-hidden="true" /> Nueva solicitud
          </Link>
        )}
      </div>
      <Metricas version={0} rutaLista={esProductor ? '/app/mis-solicitudes' : '/app/solicitudes'} />
      <TablaSolicitudes usarUrl mostrarProductor={!esProductor} tamano={20} />
    </>
  );
}

/** P04 · Nueva solicitud con mapa opcional */
export function NuevaSolicitud() {
  const navegar = useNavigate();
  const { productor } = useSesion();
  const [guardada, setGuardada] = useState<Solicitud | null>(null);

  return (
    <>
      <Link to="/app/mis-solicitudes" className="miga">
        <ArrowLeft size={16} aria-hidden="true" /> Mis solicitudes
      </Link>
      <div className="encabezado-pagina">
        <div>
          <h1>Nueva solicitud</h1>
          <p>Datos de recolección. Los campos con * son obligatorios.</p>
        </div>
      </div>
      <div style={{ maxWidth: 720 }}>
        {guardada ? (
          <div className="tarjeta panel" aria-live="polite">
            <div style={{ display: 'grid', gap: 16, justifyItems: 'start' }}>
              <CheckCircle2 size={40} color="var(--color-accion)" aria-hidden="true" />
              <h2>Solicitud guardada con éxito</h2>
              <p>
                Número de solicitud <strong className="codigo">{guardada.codigo}</strong>. Estado actual: <strong>Pendiente</strong>. Coordinación
                la revisará para programar la recolección.
              </p>
              <div className="acciones">
                <button type="button" className="boton boton-primario" onClick={() => navegar(`/app/solicitudes/${guardada.id}`)}>
                  Ver detalle
                </button>
                <button type="button" className="boton boton-neutro" onClick={() => setGuardada(null)}>
                  Registrar otra
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="tarjeta panel">
            {productor && (
              <div style={{ marginBottom: 16 }}>
                <Aviso tipo="info">
                  Solicitud a nombre de <strong>{productor.nombre_publico}</strong> ({productor.vereda}). El productor se identifica con tu sesión.
                </Aviso>
              </div>
            )}
            <FormularioSolicitud
              inicial={{ ubicacion_texto: productor ? `${productor.vereda}, ` : '' }}
              onGuardar={async (datos) => setGuardada(await api.crearSolicitud(datos))}
              onCancelar={() => navegar(-1)}
            />
          </div>
        )}
      </div>
    </>
  );
}
