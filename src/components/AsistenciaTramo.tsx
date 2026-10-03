/**
 * PASAR LISTA A UN TRAMO: quién ha venido el día de la salida.
 *
 * Se usa en `pages/app/Cortejo.tsx`, y el contexto de uso es lo que explica su
 * forma: se toca EN LA CALLE, con el móvil, de pie, con guantes y con la
 * cobertura que haya. Así que lo que se mide es el NÚMERO DE TOQUES, y por eso
 * los estados se cambian con un solo golpe y no con un formulario.
 *
 * Tres estados: `pendiente` (de fábrica), `asiste` y `no_asiste`. «Pendiente»
 * NO es «no ha venido»: a media mañana casi todo está pendiente, y contar eso
 * como ausencia daría un recuento falso en el peor momento.
 *
 * `soloLectura` para cuando se consulta y no se pasa lista (la ficha del
 * hermano), y `sinResumen` cuando el recuento ya lo pinta quien lo envuelve.
 *
 * Y SI LA ESCRITURA NO LLEGA, SE ENCOLA Y SE MANDA SOLA
 * (`lib/colaEscritura.ts`). Es el momento del año para el que se escribió esa
 * cola: una hermandad en la calle, sin cobertura, y alguien pasando lista. La
 * banda de aviso dice «está apuntado y se manda solo», y eso es a propósito
 * distinto de «no se ha podido guardar» — ver `components/AppShell.tsx`.
 */
import { useAsistencias, registroDe, type EstadoAsistencia } from '../lib/asistencia'
import { ChipsAsistencia, PastillaAsistencia, ResumenAsistencia } from './ChipsAsistencia'
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
  /**
   * Sin las tres pastillas del recuento: para cuando quien nos monta ya las
   * está enseñando por su cuenta (el plegable de Cortejo las lleva en el
   * propio rótulo, y repetirlas dentro deja el mismo dato dos veces seguidas).
   */
  sinResumen?: boolean
}

/**
 * Lista de los hermanos de un tramo con control de asistencia al día de salida:
 * asiste / no asiste (con motivo) / sin confirmar. Se comparte entre el panel
 * (Cortejo) y el área del hermano (diputados de tramo).
 */
export default function AsistenciaTramo({ anio, miembros, porQuien, soloLectura, sinResumen }: Props) {
  const [mapa, marcar] = useAsistencias()

  const estados = miembros.map((m) => registroDe(mapa, anio, m.hermano.id).estado)

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
      {!sinResumen && <ResumenAsistencia estados={estados} />}

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
                <PastillaAsistencia reg={reg} />
              ) : (
                <ChipsAsistencia
                  reg={reg}
                  onEstado={(e) => cambiarEstado(hermano.id, e)}
                  onMotivo={(m) => cambiarMotivo(hermano.id, m)}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
