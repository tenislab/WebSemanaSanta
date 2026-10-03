import { cuentaAsistencia, etiquetaAsistencia, type EstadoAsistencia, type RegistroAsistencia } from '../lib/asistencia'

/**
 * EL PAR DE CHIPS «ASISTE / NO ASISTE» DE UN HERMANO, Y SU MOTIVO.
 *
 * Está aquí fuera porque se usa en dos sitios que no se parecen en nada más:
 *  - la lista del tramo en Cortejo, pegado a la entrega de la papeleta, y
 *  - el área del diputado de tramo, donde no hay papeletas que entregar.
 *
 * Antes el control solo existía dentro de `AsistenciaTramo`, y por eso el día
 * de la salida la ficha de un tramo listaba a los MISMOS hermanos dos veces:
 * una para entregar la papeleta y otra, cuarenta filas más abajo, para decir
 * si salían. Sacarlo es lo que permite que haya una sola lista.
 */
export function ChipsAsistencia({ reg, onEstado, onMotivo }: {
  reg: RegistroAsistencia
  onEstado: (estado: EstadoAsistencia) => void
  onMotivo: (motivo: string) => void
}) {
  return (
    <div className="asistencia__acciones">
      <div className="asistencia__botones">
        <button
          type="button"
          className={`chip chip--toggle${reg.estado === 'asiste' ? ' chip--active chip--ok' : ''}`}
          onClick={() => onEstado('asiste')}
          aria-pressed={reg.estado === 'asiste'}
        >
          ✓ Asiste
        </button>
        <button
          type="button"
          className={`chip chip--toggle${reg.estado === 'no_asiste' ? ' chip--active chip--warn' : ''}`}
          onClick={() => onEstado('no_asiste')}
          aria-pressed={reg.estado === 'no_asiste'}
        >
          ✕ No asiste
        </button>
        {reg.estado !== 'pendiente' && (
          <button
            type="button"
            className="chip chip--toggle"
            onClick={() => onEstado('pendiente')}
            title="Volver a dejar sin confirmar"
          >
            ↺
          </button>
        )}
      </div>
      {reg.estado === 'no_asiste' && (
        <input
          type="text"
          className="asistencia__motivo"
          placeholder="Motivo (enfermedad, viaje…)"
          value={reg.motivo ?? ''}
          onChange={(e) => onMotivo(e.target.value)}
        />
      )}
    </div>
  )
}

/** Lo mismo cuando no se puede tocar: el estado en una pastilla y su motivo. */
export function PastillaAsistencia({ reg }: { reg: RegistroAsistencia }) {
  return (
    <span className={`pill ${reg.estado === 'asiste' ? 'pill--ok' : reg.estado === 'no_asiste' ? 'pill--warn' : 'pill--info'}`}>
      {etiquetaAsistencia(reg.estado)}
      {reg.estado === 'no_asiste' && reg.motivo ? ` · ${reg.motivo}` : ''}
    </span>
  )
}

/** Las tres pastillas del recuento, iguales en la lista y en el plegable. */
export function ResumenAsistencia({ estados }: { estados: EstadoAsistencia[] }) {
  const { asisten, noAsisten, pendientes } = cuentaAsistencia(estados)
  return (
    <div className="asistencia__resumen">
      <span className="pill pill--ok">{asisten} asisten</span>
      <span className="pill pill--warn">{noAsisten} no asisten</span>
      <span className="pill pill--info">{pendientes} sin confirmar</span>
    </div>
  )
}
