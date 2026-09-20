/**
 * EL CUERPO DE LA TABLA DE RECIBOS.
 *
 * Va aparte y dentro de `memo` por lo mismo que `censo/FilasDelCenso.tsx`:
 * teclear en el buscador re-renderiza la pantalla entera, y sin este límite
 * React recorría las CUATRO MIL QUINIENTAS filas EN EL CAMINO URGENTE —el de
 * la letra— aunque la lista filtrada todavía no hubiera cambiado.
 *
 * CUÁNTO ERA, medido en el build de producción con una hermandad de 800
 * hermanos y tres ejercicios emitidos (`scripts/caza/cronometro.mjs`): **304 ms
 * por tecla**. Un cuarto de segundo de retraso por letra no se lee como «va
 * lento», se lee como «se ha colgado». El censo, que ya tenía este límite
 * puesto, costaba 55 ms con 1.600 filas.
 *
 * LAS PROPS TIENEN QUE SER ESTABLES o esto no sirve de nada: `memo` compara por
 * identidad, así que una función creada en el render del padre lo atravesaría
 * en cada letra igual que antes. `hermanoDe` ya venía de un `useMemo`;
 * `marcarPagada` se envolvió en `useCallback` para esto. Ver el comentario
 * donde se usa.
 *
 * La fila de «no hay nada» se queda en el padre: es una sola, y depende de
 * media pantalla (si hay catálogo, si hay búsqueda, qué filtro está puesto).
 */
import { estadoClass } from './estadoClass'
import { filaQueAbre } from '../../../lib/foco'
import { formatCurrency } from '../../../lib/format'
import { initials, type Hermano } from '../../../data/hermanos'
import { memo } from 'react'
import { esAvisado, metodoDeCuota, type Cuota } from '../../../data/cuotas'

export const FilasDeRecibos = memo(function FilasDeRecibos({
  filtered, justAddedId, hermanoDe, setSelected, marcarPagada,
}: {
  filtered: Cuota[]
  justAddedId: string | null
  hermanoDe: (id: string) => Hermano | undefined
  setSelected: (c: Cuota) => void
  marcarPagada: (id: string) => void
}) {
  return (
    <>
      {filtered.map((c) => {
        const h = hermanoDe(c.hermanoId)
        return (
          <tr
            key={c.id}
            className={c.id === justAddedId ? 'row--flash' : undefined}
            {...filaQueAbre(() => setSelected(c))}
          >
            <td className="num col-opcional">{String(c.numero).padStart(4, '0')}</td>
            <td>
              <div className="row-person">
                <span className="row-avatar">{h ? initials(h.nombre) : '?'}</span>
                <span>
                  <span className="row-person__name">{h?.nombre ?? 'Hermano desconocido'}</span>
                  <span className="row-person__sub">Nº {h?.numero ?? '—'}</span>
                  <span className="row-person__sub solo-movil">{c.concepto} · {c.fechaCobro}</span>
                </span>
              </div>
            </td>
            <td className="col-opcional">{c.concepto}</td>
            <td>
              <span className={`pill ${estadoClass(c.estado)}`}>{c.estado}</span>
              {esAvisado(c) && (
                <span className="pill-avisado" title={`El hermano avisó el ${c.pagoComunicado?.fecha} de que ha pagado por ${c.pagoComunicado?.metodo}`}>
                  Dice que ha pagado
                </span>
              )}
            </td>
            <td className="num">{formatCurrency(c.importe)}</td>
            <td className="col-opcional">
              <span className="cobro-cell">
                <span className="num">{c.fechaCobro}</span>
                <span className={`cobro-tag${c.domiciliada ? ' cobro-tag--bank' : ''}`}>
                  {metodoDeCuota(c)}
                </span>
              </span>
            </td>
            <td className="col-opcional">
              <div className="row-actions">
                <button
                  className="icon-btn"
                  title="Ver recibo"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(c)
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
                {c.estado === 'Pendiente' && (
                  <button
                    className="icon-btn"
                    title="Marcar como pagada"
                    onClick={(e) => {
                      e.stopPropagation()
                      marcarPagada(c.id)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  </button>
                )}
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
})
