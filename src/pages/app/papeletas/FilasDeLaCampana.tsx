/**
 * EL CUERPO DE LA TABLA DE PAPELETAS.
 *
 * Un hermano por fila con su estado de renovación. Aparte y dentro de `memo`
 * por lo mismo que el censo: cada letra del buscador lo recorría entero en el
 * render urgente. Medido con `scripts/caza/cronometro.mjs`: **104 ms por
 * tecla** con solo 800 filas —la mitad que el censo, y el doble de coste,
 * porque el censo sí tenía el límite puesto—.
 *
 * `tramoDe` y `abrirDetalle` están memorizados en el padre para que esto
 * sirva. Y `tramoDe` era además un `find` lineal por fila: ahora es un mapa.
 */
import { aniosDeHermandad } from '../../../lib/hermanoFicha'
import { claseEstado } from './claseEstado'
import { etiquetaTramo, type Tramo } from '../../../lib/tramos'
import { filaQueAbre } from '../../../lib/foco'
import { initials, type Hermano } from '../../../data/hermanos'
import { memo } from 'react'
import { type Asignacion } from '../../../lib/cortejo'
import { type Campana, type RenovacionHermano } from '../../../lib/campana'

export const FilasDeLaCampana = memo(function FilasDeLaCampana({
  filas, campana, tramoDe, asignacionPorPapeleta, abrirDetalle,
}: {
  filas: { hermano: Hermano; renovacion: RenovacionHermano }[]
  campana: Campana
  tramoDe: (tramoId: string | null) => Tramo | null
  asignacionPorPapeleta: Map<string, Asignacion>
  abrirDetalle: (id: string) => void
}) {
  return (
    <>
      {filas.map(({ hermano: h, renovacion: r }) => {
        const tramoAnterior = tramoDe(r.sitioAnterior?.tramoId ?? null)
        const aniosEnLaHermandad = aniosDeHermandad(h.antiguedad, campana.anio)
        const asigActual = r.papeletaActual ? asignacionPorPapeleta.get(r.papeletaActual.id) : undefined
        const tramoActual = asigActual?.tramo ?? null
        return (
          <tr key={h.id} {...filaQueAbre(() => abrirDetalle(h.id))}>
            <td className="num col-opcional">{h.numero}</td>
            <td>
              <div className="row-person">
                <span className="row-avatar">{initials(h.nombre)}</span>
                <span>
                  <span className="row-person__name">{h.nombre}</span>
                  <span className="row-person__sub">Nº {h.numero} · {h.estado}</span>
                  {/* En el móvil se ocultan sus columnas: el dato baja aquí. */}
                  <span className="row-person__sub solo-movil">
                    {aniosEnLaHermandad === null ? 'Antigüedad sin registrar' : `${aniosEnLaHermandad} años`}
                    {' · '}
                    {tramoAnterior ? etiquetaTramo(tramoAnterior) : 'sin sitio anterior'}
                  </span>
                </span>
              </div>
            </td>
            <td className="table-subtle td-nowrap col-opcional">
              {/* La antigüedad manda en el reparto del cortejo, así que
                  cuando no consta hay que decirlo, no poner un número
                  inventado. Aquí llegó a salir «NaN años». */}
              {aniosEnLaHermandad === null ? (
                <span className="table-muted">Sin registrar</span>
              ) : (
                <>
                  {aniosEnLaHermandad} años
                  <span className="table-muted"> · {h.antiguedad}</span>
                </>
              )}
            </td>
            <td className="col-opcional">{tramoAnterior ? etiquetaTramo(tramoAnterior) : <span className="table-muted">—</span>}</td>
            <td>
              <span className={`pill ${claseEstado(r.estado)}`}>{r.estado}</span>
            </td>
            <td>
              {tramoActual ? (
                <>
                  {etiquetaTramo(tramoActual)}
                  {asigActual?.estado === 'Excede aforo' && (
                    <span className="table-subtle"> · excede aforo</span>
                  )}
                </>
              ) : r.papeletaActual?.opcion && r.papeletaActual.estado !== 'Renuncia' ? (
                <>
                  {/* La pregunta de quien mira esta columna es si esa
                      persona camina o no. Se responde. */}
                  {r.papeletaActual.opcion}
                  <span className="table-subtle"> · no sale en el cortejo</span>
                </>
              ) : (
                <span className="table-muted">—</span>
              )}
            </td>
            <td className="col-opcional">
              <button
                className="icon-btn"
                title="Ver ficha"
                onClick={(e) => {
                  e.stopPropagation()
                  abrirDetalle(h.id)
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              </button>
            </td>
          </tr>
        )
      })}
    </>
  )
})
