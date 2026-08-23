import { etiquetaTramo, type Tramo } from '../lib/tramos'
import type { Asignacion } from '../lib/cortejo'

/**
 * Dónde va exactamente este hermano el día de la salida: su tramo, qué porta,
 * qué puesto ocupa, a qué hora se cita y quién va justo delante y justo detrás.
 *
 * Hasta ahora el área solo decía el tramo. Y lo que se pregunta la semana antes
 * —y lo que se acaba preguntando a secretaría por teléfono— es la hora de
 * citación y con quién va uno.
 */
export default function MiSitioCortejo({
  asignacion,
  compañeros,
  donde,
  salida,
}: {
  /** Su asignación en el reparto: tramo colocado y puesto. */
  asignacion: Asignacion
  /** Todo el tramo ordenado por puesto, para sacar quién va delante y detrás. */
  compañeros: Asignacion[]
  /** Desde dónde sale la hermandad (la parroquia, la casa de hermandad). */
  donde?: string
  /** El día de la salida, ya escrito («Viernes Santo, 26 de marzo»). */
  salida?: string | null
}) {
  const tramo: Tramo | null = asignacion.tramo
  if (!tramo) return null

  // El orden del cortejo es el del puesto: el 1 va en cabeza.
  const enOrden = [...compañeros].filter((a) => a.puesto > 0).sort((a, b) => a.puesto - b.puesto)
  const i = enOrden.findIndex((a) => a.papeleta.id === asignacion.papeleta.id)
  const delante = i > 0 ? enOrden[i - 1] : null
  const detras = i >= 0 && i < enOrden.length - 1 ? enOrden[i + 1] : null
  const total = enOrden.length

  return (
    <div className="misitio">
      <div className="misitio__cabeza">
        <span className="misitio__tramo">{etiquetaTramo(tramo)}</span>
        {tramo.tipo?.trim() && <span className="pill pill--info">{tramo.tipo}</span>}
      </div>

      {salida && <p className="misitio__salida">Salida: <b>{salida}</b></p>}

      <div className="misitio__datos">
        <div>
          <span className="misitio__eti">Tu puesto</span>
          <strong>{asignacion.puesto}</strong>
          <small>de {total} en el tramo</small>
        </div>
        {tramo.horaCitacion?.trim() && (
          <div>
            <span className="misitio__eti">Citación</span>
            <strong>{tramo.horaCitacion}</strong>
            {donde?.trim() && <small>{donde}</small>}
          </div>
        )}
        <div>
          <span className="misitio__eti">Cuerpo</span>
          <strong className="misitio__cuerpo">{tramo.cuerpo}</strong>
        </div>
      </div>

      {/* Con quién va. Nombre y número, lo mismo que se lee en el listado del
          tramo el día de la salida; ni un dato de contacto más. */}
      {(delante || detras) && (
        <ul className="misitio__vecinos">
          <li className={delante ? '' : 'misitio__vecinos--vacio'}>
            <span>Delante de ti</span>
            {delante ? (
              <b>{delante.hermano.nombre} <small>nº {delante.hermano.numero}</small></b>
            ) : (
              <b>Vas en cabeza del tramo</b>
            )}
          </li>
          <li className={detras ? '' : 'misitio__vecinos--vacio'}>
            <span>Detrás de ti</span>
            {detras ? (
              <b>{detras.hermano.nombre} <small>nº {detras.hermano.numero}</small></b>
            ) : (
              <b>Cierras el tramo</b>
            )}
          </li>
        </ul>
      )}

      {!tramo.horaCitacion?.trim() && (
        <p className="form-hint">
          La hora de citación de tu tramo todavía no está puesta. En cuanto la secretaría la fije,
          la verás aquí.
        </p>
      )}
    </div>
  )
}
