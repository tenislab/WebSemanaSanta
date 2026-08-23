import { useAsistencias, registroDe, etiquetaAsistencia, type EstadoAsistencia } from '../lib/asistencia'
import type { Hermano } from '../data/hermanos'

export interface MiembroAsistencia {
  hermano: Hermano
  puesto?: number | null
}

interface Props {
  anio: number
  miembros: MiembroAsistencia[]
  /** Nombre de quien marca (diputado o «Secretaría»), se guarda como traza. */
  porQuien: string
  soloLectura?: boolean
}

/**
 * Lista de los hermanos de un tramo con control de asistencia al día de salida:
 * asiste / no asiste (con motivo) / sin confirmar. Se comparte entre el panel
 * (Cortejo) y el área del hermano (diputados de tramo).
 */
export default function AsistenciaTramo({ anio, miembros, porQuien, soloLectura }: Props) {
  const [mapa, marcar] = useAsistencias()

  const asisten = miembros.filter((m) => registroDe(mapa, anio, m.hermano.id).estado === 'asiste').length
  const noAsisten = miembros.filter((m) => registroDe(mapa, anio, m.hermano.id).estado === 'no_asiste').length
  const pendientes = miembros.length - asisten - noAsisten

  function cambiarEstado(hermanoId: string, estado: EstadoAsistencia) {
    const actual = registroDe(mapa, anio, hermanoId)
    marcar(anio, hermanoId, {
      estado,
      motivo: estado === 'no_asiste' ? actual.motivo ?? '' : undefined,
      por: porQuien,
    })
  }

  function cambiarMotivo(hermanoId: string, motivo: string) {
    marcar(anio, hermanoId, { estado: 'no_asiste', motivo, por: porQuien })
  }

  if (miembros.length === 0) {
    return <p className="form-hint">Todavía no hay hermanos asignados a este tramo.</p>
  }

  return (
    <div className="asistencia">
      <div className="asistencia__resumen">
        <span className="pill pill--ok">{asisten} asisten</span>
        <span className="pill pill--warn">{noAsisten} no asisten</span>
        <span className="pill pill--info">{pendientes} sin confirmar</span>
      </div>

      <ul className="asistencia__lista">
        {miembros.map(({ hermano, puesto }) => {
          const reg = registroDe(mapa, anio, hermano.id)
          return (
            <li key={hermano.id} className="asistencia__item">
              <div className="asistencia__quien">
                <b>{hermano.nombre}</b>
                <span className="table-subtle">
                  {puesto != null ? `Puesto ${puesto} · ` : ''}nº {hermano.numero > 0 ? hermano.numero : '—'}
                </span>
              </div>

              {soloLectura ? (
                <span className={`pill ${reg.estado === 'asiste' ? 'pill--ok' : reg.estado === 'no_asiste' ? 'pill--warn' : 'pill--info'}`}>
                  {etiquetaAsistencia(reg.estado)}
                  {reg.estado === 'no_asiste' && reg.motivo ? ` · ${reg.motivo}` : ''}
                </span>
              ) : (
                <div className="asistencia__acciones">
                  <div className="asistencia__botones">
                    <button
                      type="button"
                      className={`chip chip--toggle${reg.estado === 'asiste' ? ' chip--active chip--ok' : ''}`}
                      onClick={() => cambiarEstado(hermano.id, 'asiste')}
                    >
                      ✓ Asiste
                    </button>
                    <button
                      type="button"
                      className={`chip chip--toggle${reg.estado === 'no_asiste' ? ' chip--active chip--warn' : ''}`}
                      onClick={() => cambiarEstado(hermano.id, 'no_asiste')}
                    >
                      ✕ No asiste
                    </button>
                    {reg.estado !== 'pendiente' && (
                      <button
                        type="button"
                        className="chip chip--toggle"
                        onClick={() => cambiarEstado(hermano.id, 'pendiente')}
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
                      onChange={(e) => cambiarMotivo(hermano.id, e.target.value)}
                    />
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
