import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import PapeletaTicket from '../../components/PapeletaTicket'
import HermanoPicker from '../../components/HermanoPicker'
import { HERMANOS_INICIALES, initials } from '../../data/hermanos'
import { IMPORTE_PAPELETA, PAPELETAS_INICIALES, type EstadoPapeleta, type Papeleta } from '../../data/papeletas'
import { useAuth } from '../../context/AuthContext'
import { getHermandadSettings } from '../../lib/hermandadSettings'
import { formatCurrency } from '../../lib/format'
import { getTramos, tramosDeCuerpo, etiquetaTramo, type Cuerpo } from '../../lib/tramos'
import { repartoDeTramo, type Asignacion } from '../../lib/cortejo'

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function estadoClass(estado: EstadoPapeleta) {
  if (estado === 'Entregada' || estado === 'Pagada') return 'pill--ok'
  if (estado === 'Asignada' || estado === 'Solicitada') return 'pill--warn'
  return 'pill--err'
}

const FILTROS = ['Todas', 'Solicitada', 'Asignada', 'Pagada', 'Entregada', 'Anulada'] as const
const CUERPOS: Cuerpo[] = ['Cristo', 'Virgen', 'Único']

export default function Papeletas() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const hermandad = useMemo(() => getHermandadSettings(fallbackNombre), [fallbackNombre])
  const tramos = useMemo(() => getTramos(), [])

  const [papeletas, setPapeletas] = useState<Papeleta[]>(PAPELETAS_INICIALES)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTROS)[number]>('Todas')
  const [selected, setSelected] = useState<Papeleta | null>(null)
  const [pendingCuerpo, setPendingCuerpo] = useState<Cuerpo | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const hermanoDe = useMemo(() => {
    const map = new Map(HERMANOS_INICIALES.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [])

  const tramoDe = (tramoId: string | null) => (tramoId ? (tramos.find((t) => t.id === tramoId) ?? null) : null)

  const cuerposDisponibles = useMemo(() => CUERPOS.filter((c) => tramos.some((t) => t.cuerpo === c)), [tramos])
  const tramosDelCuerpoElegido = useMemo(
    () => (pendingCuerpo ? tramosDeCuerpo(pendingCuerpo, tramos) : []),
    [pendingCuerpo, tramos],
  )

  // El puesto de cada papeleta no se guarda: se calcula solo a partir del
  // tramo elegido y del número de hermano de quien la porta.
  const asignacionPorPapeleta = useMemo(() => {
    const map = new Map<string, Asignacion>()
    tramos.forEach((t) => {
      repartoDeTramo(t, papeletas, hermanoDe, new Set()).forEach((a) => map.set(a.papeleta.id, a))
    })
    return map
  }, [papeletas, hermanoDe, tramos])

  const ocupadosPorTramo = useMemo(() => {
    const map = new Map<string, number>()
    asignacionPorPapeleta.forEach((a) => {
      if (a.estado === 'Excede aforo' || !a.papeleta.tramoId) return
      map.set(a.papeleta.tramoId, (map.get(a.papeleta.tramoId) ?? 0) + 1)
    })
    return map
  }, [asignacionPorPapeleta])

  const filtered = useMemo(() => {
    return papeletas
      .filter((p) => (filter === 'Todas' ? true : p.estado === filter))
      .filter((p) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        const h = hermanoDe(p.hermanoId)
        return (
          h?.nombre.toLowerCase().includes(q) ||
          String(h?.numero ?? '').includes(q) ||
          String(p.numero).includes(q)
        )
      })
      .sort((a, b) => b.numero - a.numero)
  }, [papeletas, query, filter, hermanoDe])

  const stats = useMemo(() => {
    const total = papeletas.length
    const porAsignar = papeletas.filter((p) => p.estado === 'Solicitada').length
    const porCobrar = papeletas.filter((p) => p.estado === 'Asignada').length
    const entregadas = papeletas.filter((p) => p.estado === 'Entregada').length
    return { total, porAsignar, porCobrar, entregadas }
  }, [papeletas])

  function openDetail(p: Papeleta) {
    setSelected(p)
    setPendingCuerpo('')
  }

  function asignarTramo(id: string, tramoId: string) {
    setPapeletas((prev) => prev.map((p) => (p.id === id ? { ...p, tramoId, estado: 'Asignada' } : p)))
    setSelected((prev) => (prev && prev.id === id ? { ...prev, tramoId, estado: 'Asignada' } : prev))
    setPendingCuerpo('')
  }

  function marcarPagada(id: string) {
    setPapeletas((prev) => prev.map((p) => (p.id === id ? { ...p, estado: 'Pagada' } : p)))
    setSelected((prev) => (prev && prev.id === id ? { ...prev, estado: 'Pagada' } : prev))
  }

  function marcarEntregada(id: string) {
    setPapeletas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, estado: 'Entregada', fechaEntrega: hoy() } : p)),
    )
    setSelected((prev) =>
      prev && prev.id === id ? { ...prev, estado: 'Entregada', fechaEntrega: hoy() } : prev,
    )
  }

  function anular(id: string) {
    setPapeletas((prev) => prev.map((p) => (p.id === id ? { ...p, estado: 'Anulada' } : p)))
    setSelected((prev) => (prev && prev.id === id ? { ...prev, estado: 'Anulada' } : prev))
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const hermanoId = String(data.get('hermanoId') ?? '')
    if (!hermanoId) return

    const nextNumero = Math.max(0, ...papeletas.map((p) => p.numero)) + 1
    const nueva: Papeleta = {
      id: `p-${Date.now()}`,
      numero: nextNumero,
      hermanoId,
      tramoId: null,
      importe: IMPORTE_PAPELETA,
      estado: 'Solicitada',
      fechaSolicitud: hoy(),
    }
    setPapeletas((prev) => [nueva, ...prev])
    setJustAddedId(nueva.id)
    setFormOpen(false)
    setFilter('Todas')
    setQuery('')
    form.reset()
    setTimeout(() => setJustAddedId(null), 3000)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Papeletas de sitio</p>
          <h1>Campaña de papeletas</h1>
          <p className="dash-head__lead">
            {stats.total} papeletas · datos de ejemplo mientras conectamos la base de datos.{' '}
            <Link to="/app/configuracion" className="dash-head__link">
              Personalizar datos de la hermandad
            </Link>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
          + Nueva solicitud
        </button>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Papeletas</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Esta campaña</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Por asignar</span>
          <span className="stat-tile__value">{stats.porAsignar}</span>
          <span className="stat-tile__trend stat-tile__trend--warn">Sin tramo</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Por cobrar</span>
          <span className="stat-tile__value">{stats.porCobrar}</span>
          <span className="stat-tile__trend stat-tile__trend--warn">Asignadas, sin pagar</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Entregadas</span>
          <span className="stat-tile__value">{stats.entregadas}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Listas para salir</span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por hermano o nº de papeleta"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {FILTROS.map((f) => (
            <button
              key={f}
              className={`chip${filter === f ? ' chip--active' : ''}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === 'Todas' ? 'Todas' : f + 's'}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Hermano</th>
              <th>Tramo</th>
              <th>Estado</th>
              <th>Importe</th>
              <th>Solicitud</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const h = hermanoDe(p.hermanoId)
              const a = asignacionPorPapeleta.get(p.id)
              const tramo = tramoDe(p.tramoId)
              return (
                <tr
                  key={p.id}
                  className={p.id === justAddedId ? 'row--flash' : undefined}
                  onClick={() => openDetail(p)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="num">{String(p.numero).padStart(4, '0')}</td>
                  <td>
                    <div className="row-person">
                      <span className="row-avatar">{h ? initials(h.nombre) : '?'}</span>
                      <span>
                        <span className="row-person__name">{h?.nombre ?? 'Hermano desconocido'}</span>
                        <span className="row-person__sub">Nº {h?.numero ?? '—'}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    {tramo ? (
                      <>
                        {etiquetaTramo(tramo)}
                        <span className="table-subtle"> · puesto {a?.puesto}</span>
                        {a?.estado === 'Excede aforo' && <span className="table-subtle"> · excede aforo</span>}
                      </>
                    ) : (
                      <span className="table-muted">Sin asignar</span>
                    )}
                  </td>
                  <td>
                    <span className={`pill ${estadoClass(p.estado)}`}>{p.estado}</span>
                  </td>
                  <td className="num">{formatCurrency(p.importe)}</td>
                  <td className="num">{p.fechaSolicitud}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        title="Ver papeleta"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDetail(p)
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                      </button>
                      {p.estado === 'Asignada' && (
                        <button
                          className="icon-btn"
                          title="Marcar como pagada"
                          onClick={(e) => {
                            e.stopPropagation()
                            marcarPagada(p.id)
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                        </button>
                      )}
                      {p.estado === 'Pagada' && (
                        <button
                          className="icon-btn"
                          title="Marcar como entregada"
                          onClick={(e) => {
                            e.stopPropagation()
                            marcarEntregada(p.id)
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 12H4M14 6l6 6-6 6" /></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">
                  No hay papeletas que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Papeleta */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Papeleta de sitio"
        subtitle={selected ? `Nº ${String(selected.numero).padStart(4, '0')}` : undefined}
        footer={
          selected && (
            <>
              {selected.estado === 'Asignada' && (
                <button className="btn btn-primary" onClick={() => marcarPagada(selected.id)}>
                  Marcar como pagada
                </button>
              )}
              {selected.estado === 'Pagada' && (
                <button className="btn btn-primary" onClick={() => marcarEntregada(selected.id)}>
                  Marcar como entregada
                </button>
              )}
              <button className="btn btn-outline" onClick={() => window.print()}>
                Imprimir / Descargar
              </button>
            </>
          )
        }
      >
        {selected &&
          (() => {
            const h = hermanoDe(selected.hermanoId)
            if (!h) return <p className="dash-head__lead">No se encuentra el hermano de esta papeleta.</p>
            const a = asignacionPorPapeleta.get(selected.id)
            const tramo = tramoDe(selected.tramoId)
            return (
              <>
                {selected.estado === 'Solicitada' && (
                  <div className="assign-box">
                    <label htmlFor="cuerpoAsignar">Asignar al cortejo</label>
                    <div className="form-grid-2">
                      <select
                        id="cuerpoAsignar"
                        value={pendingCuerpo}
                        onChange={(e) => setPendingCuerpo(e.target.value as Cuerpo)}
                      >
                        <option value="">Cristo / Virgen</option>
                        {cuerposDisponibles.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <select
                        id="tramoAsignar"
                        defaultValue=""
                        disabled={!pendingCuerpo}
                        key={pendingCuerpo}
                        onChange={(e) => e.target.value && asignarTramo(selected.id, e.target.value)}
                      >
                        <option value="" disabled>
                          {pendingCuerpo ? 'Vara, cruz de guía…' : 'Elige antes un cuerpo'}
                        </option>
                        {tramosDelCuerpoElegido.map((t) => {
                          const ocupados = ocupadosPorTramo.get(t.id) ?? 0
                          return (
                            <option key={t.id} value={t.id}>
                              {t.nombre}
                              {t.tipo ? ` (${t.tipo})` : ''} — {ocupados}/{t.capacidad}
                              {ocupados >= t.capacidad ? ' · completo' : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                    <p className="form-hint">
                      El puesto se calcula solo, por número de hermano dentro del tramo elegido.{' '}
                      <Link to="/app/configuracion">Revisa los tramos en Configuración</Link>.
                    </p>
                  </div>
                )}

                <PapeletaTicket
                  papeleta={selected}
                  hermano={h}
                  hermandad={hermandad}
                  tramo={tramo}
                  puesto={a?.puesto ?? null}
                  excedeAforo={a?.estado === 'Excede aforo'}
                />

                {(selected.estado === 'Solicitada' || selected.estado === 'Asignada') && (
                  <button type="button" className="ticket-cancel" onClick={() => anular(selected.id)}>
                    Anular papeleta
                  </button>
                )}
              </>
            )
          })()}
      </Drawer>

      {/* Nueva solicitud */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nueva solicitud"
        subtitle="Papeleta de sitio"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="papeleta-form" type="submit">
              Registrar solicitud
            </button>
          </>
        }
      >
        <form id="papeleta-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="hermanoId">Hermano</label>
            <HermanoPicker hermanos={HERMANOS_INICIALES} name="hermanoId" id="hermanoId" />
          </div>
          <p className="form-hint">
            La solicitud queda «Sin asignar» hasta que se le reparta un tramo del cortejo. El
            importe estándar es de {formatCurrency(IMPORTE_PAPELETA)}.
          </p>
        </form>
      </Drawer>
    </div>
  )
}
