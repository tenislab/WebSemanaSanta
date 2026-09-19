import type { useLasSolicitudes } from './solicitudes'
import Drawer from '../../../components/Drawer'

/**
 * EL CAJÓN DE LAS SOLICITUDES DE PAPELETA.
 *
 * Lo que los hermanos han pedido desde su área, con su preferencia y su
 * comentario, para aceptarlo o rechazarlo. Es corto, pero se va con su hook a
 * `papeletas/solicitudes.ts` para que la petición entera —lo que hace y lo que
 * se ve— esté en el mismo sitio.
 *
 * UNA PROP: el hook entero. Cada solicitud trae ya el nombre y el número del
 * hermano que la pidió, así que la lista de hermanos no hace falta.
 */
export default function CajonDeSolicitudes({ solicitud }: {
  solicitud: ReturnType<typeof useLasSolicitudes>
}) {
  const {
    solicitudesPendientes, solicitudesOpen, setSolicitudesOpen,
    aceptarSolicitud, rechazarSolicitud,
  } = solicitud
  return (
    <Drawer
      open={solicitudesOpen}
      onClose={() => setSolicitudesOpen(false)}
      title="Solicitudes de papeleta"
      subtitle={`${solicitudesPendientes.length} pendiente${solicitudesPendientes.length === 1 ? '' : 's'}`}
    >
      {solicitudesPendientes.length === 0 ? (
        <p className="form-hint">No hay solicitudes pendientes. Las que envíen los hermanos desde su área aparecerán aquí.</p>
      ) : (
        solicitudesPendientes.map((s) => (
          <div className="assign-box" key={s.id}>
            <div className="ficha__row">
              <b>{s.hermanoNombre}</b>
              <span className="pill pill--info">Nº {s.hermanoNumero}</span>
            </div>
            <dl className="ficha__list">
              <div><dt>Modalidad</dt><dd>{s.modalidad}</dd></div>
              {s.preferencia && <div><dt>Preferencia</dt><dd>{s.preferencia}</dd></div>}
              <div><dt>Tramo solicitado</dt><dd>{s.tramoSolicitado}</dd></div>
              {s.comentario && <div><dt>Comentario</dt><dd>{s.comentario}</dd></div>}
              <div><dt>Enviada</dt><dd>{s.fecha}</dd></div>
            </dl>
            <div className="assign-box__row">
              <button className="btn btn-primary btn-sm" onClick={() => aceptarSolicitud(s)}>Aceptar y emitir</button>
              <button className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => rechazarSolicitud(s)}>Rechazar</button>
            </div>
          </div>
        ))
      )}
    </Drawer>
  )
}
