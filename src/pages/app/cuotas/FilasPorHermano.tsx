/**
 * EL CUERPO DE LA TABLA «POR HERMANO» DE CUOTAS.
 *
 * Una fila por persona con lo que debe y desde cuándo. Ochocientas con un
 * censo de verdad, y aparte dentro de `memo` por lo mismo que las de recibos:
 * el buscador de esta pantalla es el mismo, así que cada letra las recorría
 * también.
 */
import { formatCurrency } from '../../../lib/format'
import { initials } from '../../../data/hermanos'
import { memo } from 'react'
import { etiquetaDeSituacion, type SituacionDeHermano } from '../../../lib/estadoCuotaHermano'

export const FilasPorHermano = memo(function FilasPorHermano({
  situacionesFiltradas, ejercicioMirado,
}: {
  situacionesFiltradas: SituacionDeHermano[]
  ejercicioMirado: number
}) {
  return (
    <>
      {situacionesFiltradas.map((x) => {
        const etiqueta = etiquetaDeSituacion(x.situacion)
        return (
          <tr key={x.hermano.id}>
            <td className="num col-opcional">{x.hermano.numero > 0 ? x.hermano.numero : '—'}</td>
            <td>
              <div className="row-person">
                <span className="row-avatar">{initials(x.hermano.nombre)}</span>
                <span>
                  <span className="row-person__name">{x.hermano.nombre}</span>
                  <span className="row-person__sub">Nº {x.hermano.numero > 0 ? x.hermano.numero : '—'}</span>
                  {/*
                    En el móvil, la línea de debajo del nombre lleva lo
                    de las columnas QUE SE HAN ESCONDIDO —los recibos del
                    ejercicio y desde cuándo arrastra—, no la situación:
                    esa se ve en su propia columna, ahí al lado, y
                    repetirla dejaba «Sin cuota emitida» dos veces en
                    cada fila.
                  */}
                  <span className="row-person__sub solo-movil">
                    {x.recibosDelEjercicio === 0
                      ? `sin recibos de ${ejercicioMirado}`
                      : `${x.recibosDelEjercicio} recibo${x.recibosDelEjercicio === 1 ? '' : 's'} de ${ejercicioMirado}`}
                    {x.desde != null && x.desde < ejercicioMirado ? ` · debe desde ${x.desde}` : ''}
                  </span>
                </span>
              </div>
            </td>
            <td>
              <span className={`pill ${etiqueta.clase}`}>{etiqueta.texto}</span>
              {x.avisa && (
                <span className="pill-avisado" title="Ha avisado desde su área de que ya ha pagado">
                  Dice que ha pagado
                </span>
              )}
            </td>
            <td className="num">
              {x.deudaTotal > 0 ? formatCurrency(x.deudaTotal) : '—'}
              {/* Lo atrasado se separa: no es lo mismo deber el recibo de
                  este mes que arrastrar dos ejercicios. */}
              {x.deudaAtrasada > 0 && (
                <span className="row-person__sub">{formatCurrency(x.deudaAtrasada)} de años anteriores</span>
              )}
            </td>
            <td className="num col-opcional">{x.recibosDelEjercicio}</td>
            <td className="num col-opcional">{x.desde ?? '—'}</td>
          </tr>
        )
      })}
    </>
  )
})
