/**
 * EL CUERPO DEL LIBRO DE TESORERÍA.
 *
 * Tres mil apuntes con diez años de hermandad dentro, y aparte dentro de
 * `memo` por lo mismo que el censo y los recibos: cada letra del buscador
 * volvía a recorrerlos todos en el render urgente. Medido con
 * `scripts/caza/cronometro.mjs`: **170 ms por tecla**.
 *
 * `marcarConciliado` está en un `useCallback` en el padre para que esto
 * funcione: `memo` compara por identidad y una función nueva en cada render
 * lo atraviesa igual que si no estuviera.
 */
import { filaQueAbre } from '../../../lib/foco'
import { formatCurrency } from '../../../lib/format'
import { memo } from 'react'
import { type Movimiento } from '../../../data/movimientos'

export const FilasDeApuntes = memo(function FilasDeApuntes({
  filtered, justAddedId, setSelected, marcarConciliado,
}: {
  filtered: Movimiento[]
  justAddedId: string | null
  setSelected: (m: Movimiento) => void
  marcarConciliado: (id: string) => void
}) {
  return (
    <>
      {filtered.map((m) => (
        <tr
          key={m.id}
          className={m.id === justAddedId ? 'row--flash' : undefined}
          {...filaQueAbre(() => setSelected(m))}
        >
          <td className="num col-opcional">{String(m.numero).padStart(4, '0')}</td>
          <td className="num col-opcional">{m.fecha}</td>
          <td>
            {m.concepto}
            <span className={`pill pill--${m.tipo === 'Ingreso' ? 'ok' : 'err'} tesoreria-tipo`}>{m.tipo}</span>
            {/* En el móvil se ocultan fecha, categoría, cuenta y estado. */}
            <span className="row-person__sub solo-movil">
              {m.fecha} · {m.categoria} · {m.estado}
            </span>
          </td>
          <td className="col-opcional">{m.categoria}</td>
          <td className="col-opcional">{m.cuenta}</td>
          <td className={`num tesoreria-importe tesoreria-importe--${m.tipo === 'Ingreso' ? 'ok' : 'err'}`}>
            {m.tipo === 'Gasto' ? '−' : '+'}
            {formatCurrency(m.importe)}
          </td>
          <td className="col-opcional">
            <span className={`pill ${m.estado === 'Conciliado' ? 'pill--ok' : 'pill--warn'}`}>{m.estado}</span>
          </td>
          <td className="col-opcional">
            <div className="row-actions">
              <button
                className="icon-btn"
                title="Ver justificante"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelected(m)
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              </button>
              {m.estado === 'Pendiente' && (
                <button
                  className="icon-btn"
                  title="Marcar como conciliado"
                  onClick={(e) => {
                    e.stopPropagation()
                    marcarConciliado(m.id)
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </button>
              )}
            </div>
          </td>
        </tr>
      ))}
    </>
  )
})
