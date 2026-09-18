/**
 * EL CUERPO DE LA TABLA DEL CENSO.
 *
 * Va aparte y dentro de `memo` para que teclear en el buscador no lo recorra
 * entero en cada letra: con ochocientos hermanos, eso es la diferencia entre
 * escribir y ver cómo se atasca. Las props son la lista ya filtrada y valores
 * estables; si ninguna cambia, el render urgente ni entra aquí.
 *
 * Ya estaba separado como componente al final del fichero: aquí solo cambia de
 * sitio, que es donde se busca.
 */
import { initials, type Hermano } from '../../../data/hermanos'
import { type SituacionCuota } from '../../../lib/estadoCuotaHermano'
import { filaQueAbre } from '../../../lib/foco'
import { aniosDeHermandad, tonoDe } from '../../../lib/hermanoFicha'
import { memo, type CSSProperties } from 'react'
import { cuotaClass, cuotaEnPalabras, estadoClass } from './columnas'

/**
 * El cuerpo de la tabla del censo. Va aparte y dentro de `memo` para que
 * teclear en el buscador no lo recorra entero en cada letra: ver el comentario
 * donde se usa. Las props son la lista ya filtrada y valores estables; si
 * ninguna cambia, el render urgente ni entra aquí.
 */
export const FilasDelCenso = memo(function FilasDelCenso({
  lista,
  justAddedId,
  marcados,
  situaciones,
  tramos,
  onAbrir,
  onMarcar,
}: {
  lista: Hermano[]
  justAddedId: string | null
  marcados: Set<string>
  situaciones: Map<string, SituacionCuota>
  tramos: Map<string, string>
  onAbrir: (id: string) => void
  onMarcar: (id: string) => void
}) {
  return (
    <>
      {lista.map((h) => (
                          <tr
                key={h.id}
                className={h.id === justAddedId ? 'row--flash' : undefined}
                {...filaQueAbre(() => onAbrir(h.id))}
              >
                <td className="col-marca" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={marcados.has(h.id)}
                    onChange={() => onMarcar(h.id)}
                    aria-label={`Marcar a ${h.nombre}`}
                  />
                </td>
                <td className="num col-opcional">{h.numero > 0 ? h.numero : '—'}</td>
                <td>
                  <div className="row-person">
                    {/* Un tono estable por persona: el censo deja de ser una
                        columna de círculos grises todos iguales. */}
                    <span className="row-avatar" style={{ '--tono': tonoDe(h.nombre).fondo } as CSSProperties}>
                      {initials(h.nombre)}
                    </span>
                    <span>
                      <span className="row-person__name">{h.nombre}</span>
                      <span className="row-person__sub">{h.email}</span>
                      {/* En el móvil se ocultan Nº, tramo y antigüedad. */}
                      <span className="row-person__sub solo-movil">
                        Nº {h.numero > 0 ? h.numero : '—'} · {cuotaEnPalabras((situaciones.get(h.id) ?? 'sinEmitir')).toLowerCase()} · {tramos.get(h.id) ?? 'sin papeleta'}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="col-opcional">
                  {tramos.get(h.id) ?? <span className="table-muted">Sin papeleta</span>}
                </td>
                <td>
                  <span className={`pill ${estadoClass(h.estado)}`}>{h.estado}</span>
                  {h.bajaSolicitada && h.estado !== 'Baja' && (
                    <span
                      className="pill-avisado"
                      title={`Pidió la baja${h.bajaSolicitadaEl ? ` el ${h.bajaSolicitadaEl}` : ''}`}
                    >
                      Pide la baja
                    </span>
                  )}
                </td>
                <td className="col-opcional">
                  <span className={`pill ${cuotaClass((situaciones.get(h.id) ?? 'sinEmitir'))}`}>{cuotaEnPalabras((situaciones.get(h.id) ?? 'sinEmitir'))}</span>
                </td>
                <td className="num col-opcional">
                  {/* Sin antigüedad, una raya: el censo llegó a poner «NaN
                      años» debajo de cada nombre cuando esa columna no venía
                      en el Excel que se importó. */}
                  {h.antiguedad || '—'}
                  {aniosDeHermandad(h.antiguedad) !== null && (
                    <span className="table-subtle"> · {aniosDeHermandad(h.antiguedad)} años</span>
                  )}
                </td>
                <td className="col-opcional">
                  <button
                    className="icon-btn"
                    title="Ver ficha"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAbrir(h.id)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </td>
              </tr>
      ))}
    </>
  )
})
