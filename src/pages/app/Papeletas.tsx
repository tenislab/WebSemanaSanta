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
import { getTramos, tramoDePuesto } from '../../lib/tramos'

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function estadoClass(estado: EstadoPapeleta) {
  if (estado === 'Entregada' || estado === 'Pagada') return 'pill--ok'
  if (estado === 'Asignada' || estado === 'Solicitada') return 'pill--warn'
  return 'pill--err'
}

const FILTROS = ['Todas', 'Solicitada', 'Asignada', 'Pagada', 'Entregada', 'Anulada'] as const

export default function Papeletas() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const hermandad = useMemo(() => getHermandadSettings(fallbackNombre), [fallbackNombre])
  const tramos = useMemo(() => getTramos(), [])

  const [papeletas, setPapeletas] = useState<Papeleta[]>(PAPELETAS_INICIALES)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTROS)[number]>('Todas')
  const [selected, setSelected] = useState<Papeleta | null>(null)
  const [pendingPuesto, setPendingPuesto] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const puestoNum = Number(pendingPuesto)
  const tramoResuelto =
    pendingPuesto.trim() && Number.isFinite(puestoNum) && puestoNum > 0
      ? tramoDePuesto(puestoNum, tramos)
      : null

  const hermanoDe = useMemo(() => {
    const map = new Map(HERMANOS_INICIALES.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [])

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
    setPendingPuesto('')
  }

  function asignarPuesto(id: string, puesto: number, tramo: string) {
    setPapeletas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, puesto, tramo, estado: 'Asignada' } : p)),
    )
    setSelected((prev) =>
      prev && prev.id === id ? { ...prev, puesto, tramo, estado: 'Asignada' } : prev,
    )
    setPendingPuesto('')
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
      puesto: null,
      tramo: null,
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
                    {p.tramo ? (
                      <>
                        {p.tramo}
                        {p.puesto != null && <span className="table-subtle"> · puesto {p.puesto}</span>}
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
            return (
              <>
                {selected.estado === 'Solicitada' && (
                  <div className="assign-box">
                    <label htmlFor="puestoAsignar">Asignar puesto en el cortejo</label>
                    <div className="assign-box__row">
                      <input
                        id="puestoAsignar"
                        type="number"
                        min="1"
                        placeholder="Nº de puesto"
                        value={pendingPuesto}
                        onChange={(e) => setPendingPuesto(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!tramoResuelto}
                        onClick={() =>
                          tramoResuelto && asignarPuesto(selected.id, puestoNum, tramoResuelto.nombre)
                        }
                      >
                        Asignar
                      </button>
                    </div>
                    {pendingPuesto.trim() && tramoResuelto && (
                      <p className="form-hint form-hint--ok">
                        El puesto {puestoNum} corresponde a «{tramoResuelto.nombre}».
                      </p>
                    )}
                    {pendingPuesto.trim() && !tramoResuelto && (
                      <p className="form-hint form-hint--error">
                        Ese puesto no pertenece a ningún tramo configurado.{' '}
                        <Link to="/app/configuracion">Revisa los tramos en Configuración</Link>.
                      </p>
                    )}
                    {!pendingPuesto.trim() && (
                      <p className="form-hint">
                        El tramo se calcula solo a partir del número de puesto.
                      </p>
                    )}
                  </div>
                )}

                <PapeletaTicket papeleta={selected} hermano={h} hermandad={hermandad} />

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
