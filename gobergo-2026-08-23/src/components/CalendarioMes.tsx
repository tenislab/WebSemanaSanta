import { useEffect, useMemo, useState } from 'react'
import { calendarioEntre, type Aparicion, type Evento } from '../data/eventos'
import { DIAS_SEMANA, MESES, claseTipo, iso, rejillaDelMes } from '../lib/calendario'

/**
 * Calendario mensual de eventos, con las repeticiones ya desplegadas. Lo
 * comparten el panel de gestión y el área del hermano, para que los dos vean
 * exactamente lo mismo y no haya dos calendarios que mantener.
 */
export default function CalendarioMes({
  eventos,
  onAbrirDia,
  filtrar,
  compacto = false,
  titulos = false,
  leyenda = false,
  saltarA,
}: {
  eventos: Evento[]
  /** Qué hacer al pulsar un día que tiene algo. */
  onAbrirDia?: (fecha: string, delDia: Aparicion[]) => void
  /** Qué eventos se enseñan (el área del hermano no ve los cabildos internos). */
  filtrar?: (e: Evento) => boolean
  compacto?: boolean
  /**
   * Escribe el nombre del acto dentro de la casilla. Con sitio de sobra un
   * punto de color no dice nada: había que pasar el ratón por encima para
   * enterarse de qué pasaba ese día.
   */
  titulos?: boolean
  leyenda?: boolean
  /** Fecha a la que saltar (al crear un evento, para verlo en su mes). */
  saltarA?: string
}) {
  const ahora = new Date()
  const [vista, setVista] = useState({ anio: ahora.getFullYear(), mes: ahora.getMonth() })
  const hoy = iso(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())

  useEffect(() => {
    if (!saltarA) return
    const d = new Date(`${saltarA}T00:00:00`)
    if (!Number.isNaN(d.getTime())) setVista({ anio: d.getFullYear(), mes: d.getMonth() })
  }, [saltarA])

  const porDia = useMemo(() => {
    const primero = iso(vista.anio, vista.mes, 1)
    const ultimo = iso(vista.anio, vista.mes, new Date(vista.anio, vista.mes + 1, 0).getDate())
    const visibles = filtrar ? eventos.filter(filtrar) : eventos
    const map = new Map<string, Aparicion[]>()
    calendarioEntre(visibles, primero, ultimo).forEach((a) => {
      const lista = map.get(a.fecha) ?? []
      lista.push(a)
      map.set(a.fecha, lista)
    })
    return map
  }, [eventos, vista, filtrar])

  /** Cuántos actos hay en el mes: sirve para avisar cuando no hay ninguno. */
  const totalMes = useMemo(() => {
    let n = 0
    porDia.forEach((l) => { n += l.length })
    return n
  }, [porDia])

  function moverMes(delta: number) {
    setVista((v) => {
      const d = new Date(v.anio, v.mes + delta, 1)
      return { anio: d.getFullYear(), mes: d.getMonth() }
    })
  }

  function irAHoy() {
    setVista({ anio: ahora.getFullYear(), mes: ahora.getMonth() })
  }

  const enHoy = vista.anio === ahora.getFullYear() && vista.mes === ahora.getMonth()
  const celdas = rejillaDelMes(vista.anio, vista.mes)

  return (
    <div className={`eventos-cal${compacto ? ' eventos-cal--compacto' : ''}${titulos ? ' eventos-cal--titulos' : ''}`}>
      <div className="eventos-cal__barra">
        <button type="button" className="icon-btn" onClick={() => moverMes(-1)} aria-label="Mes anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <b>{MESES[vista.mes]} {vista.anio}</b>
        <span className="eventos-cal__barra-fin">
          {/* Tras pasar meses adelante no había forma de volver salvo a base de flechas. */}
          {!enHoy && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={irAHoy}>Hoy</button>
          )}
          <button type="button" className="icon-btn" onClick={() => moverMes(1)} aria-label="Mes siguiente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </span>
      </div>
      <div className="eventos-cal__grid" role="grid">
        {DIAS_SEMANA.map((d) => <span key={d} className="eventos-cal__dow">{d}</span>)}
        {celdas.map((dia, i) => {
          if (dia === null) return <span key={`x${i}`} className="eventos-cal__celda eventos-cal__celda--vacia" />
          const fecha = iso(vista.anio, vista.mes, dia)
          const delDia = porDia.get(fecha) ?? []
          const visibles = titulos ? delDia.slice(0, 2) : []
          return (
            <button
              type="button"
              key={fecha}
              className={`eventos-cal__celda${fecha === hoy ? ' eventos-cal__celda--hoy' : ''}${delDia.length ? ' eventos-cal__celda--con' : ''}`}
              onClick={() => delDia.length > 0 && onAbrirDia?.(fecha, delDia)}
              disabled={delDia.length === 0}
              title={delDia.map((a) => a.evento.titulo).join(' · ') || undefined}
            >
              <span className="eventos-cal__dia">{dia}</span>
              {delDia.length > 0 && (
                <span className="eventos-cal__puntos">
                  {delDia.slice(0, 3).map((a) => (
                    <i
                      key={`${a.evento.id}-${a.vuelta}`}
                      className={`eventos-cal__punto ${claseTipo(a.evento.tipo)}${a.vuelta > 0 ? ' eventos-cal__punto--repetido' : ''}`}
                    />
                  ))}
                </span>
              )}
              {visibles.length > 0 && (
                <span className="eventos-cal__actos">
                  {visibles.map((a) => (
                    <em key={`${a.evento.id}-${a.vuelta}`} className={`eventos-cal__acto ${claseTipo(a.evento.tipo)}`}>
                      {a.evento.hora && <b>{a.evento.hora}</b>}
                      {a.evento.titulo}
                    </em>
                  ))}
                  {delDia.length > visibles.length && (
                    <em className="eventos-cal__acto eventos-cal__acto--mas">+{delDia.length - visibles.length} más</em>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {totalMes === 0 && (
        <p className="eventos-cal__nada">No hay nada en {MESES[vista.mes].toLowerCase()}.</p>
      )}
      {leyenda && (
        <div className="eventos-cal__leyenda">
          <span><i className="eventos-cal__punto evento-tipo--culto" /> Culto</span>
          <span><i className="eventos-cal__punto evento-tipo--salida" /> Salida</span>
          <span><i className="eventos-cal__punto evento-tipo--cabildo" /> Cabildo</span>
          <span><i className="eventos-cal__punto evento-tipo--caridad" /> Caridad</span>
          <span><i className="eventos-cal__punto evento-tipo--otro" /> Otros</span>
          <span className="eventos-cal__leyenda-nota"><i className="eventos-cal__punto eventos-cal__punto--repetido evento-tipo--otro" /> Repetición</span>
        </div>
      )}
    </div>
  )
}
