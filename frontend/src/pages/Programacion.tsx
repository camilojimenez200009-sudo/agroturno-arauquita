import { CalendarCheck, CalendarClock, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TablaSolicitudes } from '../components/TablaSolicitudes';
import { Vacio } from '../components/ui';

/** P06 · Programación: solicitudes por programar y programadas */
export function Programacion() {
  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Programación</h1>
          <p>Registra la fecha acordada, la franja y el contacto de transporte. Las reprogramaciones exigen un motivo.</p>
        </div>
      </div>

      <section aria-labelledby="t-pendientes" style={{ marginBottom: 32 }}>
        <h2 id="t-pendientes" style={{ fontSize: '1.125rem', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <CalendarClock size={20} aria-hidden="true" /> Por programar
        </h2>
        <TablaSolicitudes
          mostrarProductor
          ocultarFiltroEstado
          filtrosFijos={{ estado: 'PENDIENTE', orden: 'fecha_disponible' }}
          accion={(s) => (
            <Link className="boton boton-secundario boton-pequeno" to={`/app/solicitudes/${s.id}?accion=programar`}>
              Programar
            </Link>
          )}
          vacio={
            <Vacio icono={<Inbox size={32} aria-hidden="true" />} titulo="Nada por programar">
              <p>Todas las solicitudes pendientes ya tienen fecha.</p>
            </Vacio>
          }
        />
      </section>

      <section aria-labelledby="t-programadas">
        <h2 id="t-programadas" style={{ fontSize: '1.125rem', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <CalendarCheck size={20} aria-hidden="true" /> Programadas
        </h2>
        <TablaSolicitudes
          mostrarProductor
          mostrarProgramacion
          ocultarFiltroEstado
          filtrosFijos={{ estado: 'PROGRAMADA', orden: 'fecha_programada' }}
          accion={(s) => (
            <Link className="boton boton-neutro boton-pequeno" to={`/app/solicitudes/${s.id}?accion=programar`}>
              Reprogramar
            </Link>
          )}
          vacio={
            <Vacio icono={<Inbox size={32} aria-hidden="true" />} titulo="Sin recolecciones programadas">
              <p>Las solicitudes que programes aparecerán aquí ordenadas por fecha.</p>
            </Vacio>
          }
        />
      </section>
    </>
  );
}
