/**
 * EL CAJÓN DE LAS SOLICITUDES DE ALTA.
 *
 * Solo la pantalla: la lista de pendientes, con lo que cada persona escribió y
 * los dos botones. Toda la lógica —aprobar, rechazar, el estado— vive en
 * `solicitudesDeAlta.ts` y llega aquí en `alta`.
 *
 * Están en dos ficheros y no en uno porque un módulo que exporta un hook Y un
 * componente rompe el recargado en caliente de Vite, y ESLint lo avisa. Aquí no
 * se entrega con avisos.
 */
import Drawer from '../../../components/Drawer'
import { MOTIVOS_DE_RECHAZO } from '../../../lib/familia'
import { type Hermano } from '../../../data/hermanos'
import { useSolicitudesDeAlta } from './solicitudesDeAlta'

export function CajonSolicitudes({
  alta,
  hermanos,
  abierto,
  onCerrar,
}: {
  alta: ReturnType<typeof useSolicitudesDeAlta>
  /** El censo: para decir de quién es un menor a cargo, y nada más. */
  hermanos: Hermano[]
  abierto: boolean
  onCerrar: () => void
}) {
  const { pendientes, aprobarSolicitud, rechazarSolicitud, rechazando, setRechazando, motivoRechazo, setMotivoRechazo } = alta
  return (
    <Drawer
      open={abierto}
      onClose={onCerrar}
        title="Solicitudes de alta"
        subtitle={`${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}`}
      >
        <div className="ficha">
          {pendientes.length === 0 ? (
            <p className="form-hint">No hay solicitudes pendientes.</p>
          ) : (
            pendientes.map((sol) => (
              <div className="assign-box" key={sol.id}>
                <div className="ficha__row">
                  <span className="pill pill--warn">Pendiente</span>
                  <span className="pill pill--off">{sol.fecha}</span>
                </div>
                <dl className="ficha__list">
                  <div><dt>Nombre</dt><dd>{sol.nombre}</dd></div>
                  <div><dt>DNI / NIE</dt><dd>{sol.dni}</dd></div>
                  <div><dt>Correo</dt><dd>{sol.email}</dd></div>
                  <div><dt>Teléfono</dt><dd>{sol.telefono || 'Sin datos'}</dd></div>
                  {sol.fechaNacimiento && (
                    <div><dt>Fecha de nacimiento</dt><dd>{sol.fechaNacimiento}</dd></div>
                  )}
                  {/* La pidió un hermano para un hijo suyo: al aprobarla, el
                      menor queda a su cargo. */}
                  {sol.tutorId && (
                    <div>
                      <dt>A cargo de</dt>
                      <dd>{hermanos.find((h) => h.id === sol.tutorId)?.nombre ?? 'un hermano dado de baja'}</dd>
                    </div>
                  )}
                </dl>
                {/*
                  RECHAZAR PIDE EL PORQUÉ. Antes era un botón y ya: quedaba
                  «Rechazada» y la persona que la mandó no volvía a saber nada
                  —la solicitud desaparecía de su área sin decir si le habían
                  dado de alta, si se había perdido o si le habían dicho que
                  no—. Los motivos de siempre están hechos para no tener que
                  escribirlos, pero se puede escribir otro.
                */}
                {rechazando === sol.id ? (
                  <div className="assign-box assign-box--anidada">
                    <label htmlFor={`motivo-${sol.id}`}>¿Por qué se rechaza?</label>
                    <p className="form-hint">
                      Lo va a leer {sol.nombre} en su área. Sé breve y concreto: si es algo que
                      puede arreglar (un DNI mal escrito, un dato que falta), dilo.
                    </p>
                    <div className="filters">
                      {MOTIVOS_DE_RECHAZO.map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`chip${motivoRechazo === m ? ' chip--active' : ''}`}
                          onClick={() => setMotivoRechazo(m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <div className="form-row">
                      <input
                        id={`motivo-${sol.id}`}
                        type="text"
                        value={motivoRechazo}
                        onChange={(e) => setMotivoRechazo(e.target.value)}
                        placeholder="O escríbelo tú"
                      />
                    </div>
                    <div className="assign-box__row">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm rgpd-borrar"
                        disabled={!motivoRechazo.trim()}
                        onClick={() => rechazarSolicitud(sol, motivoRechazo)}
                      >
                        Rechazar y avisar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setRechazando(null); setMotivoRechazo('') }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="assign-box__row">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => aprobarSolicitud(sol)}>
                      Aprobar y dar de alta
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm rgpd-borrar"
                      onClick={() => { setRechazando(sol.id); setMotivoRechazo('') }}
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Drawer>
  )
}
