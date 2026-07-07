import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import Recibo from '../../components/Recibo'
import HermanoPicker from '../../components/HermanoPicker'
import { HERMANOS_INICIALES, initials } from '../../data/hermanos'
import {
  CONCEPTOS,
  CUOTAS_INICIALES,
  IMPORTE_POR_CONCEPTO,
  type ConceptoCuota,
  type Cuota,
  type EstadoCuota,
} from '../../data/cuotas'
import { useAuth } from '../../context/AuthContext'
import { getHermandadSettings } from '../../lib/hermandadSettings'

const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function estadoClass(estado: EstadoCuota) {
  if (estado === 'Pagada') return 'pill--ok'
  if (estado === 'Pendiente') return 'pill--warn'
  return 'pill--err'
}

export default function Cuotas() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const hermandad = useMemo(() => getHermandadSettings(fallbackNombre), [fallbackNombre])

  const [cuotas, setCuotas] = useState<Cuota[]>(CUOTAS_INICIALES)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'Todas' | EstadoCuota>('Todas')
  const [selected, setSelected] = useState<Cuota | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const hermanoDe = useMemo(() => {
    const map = new Map(HERMANOS_INICIALES.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [])

  const filtered = useMemo(() => {
    return cuotas
      .filter((c) => (filter === 'Todas' ? true : c.estado === filter))
      .filter((c) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        const h = hermanoDe(c.hermanoId)
        return (
          h?.nombre.toLowerCase().includes(q) ||
          String(h?.numero ?? '').includes(q) ||
          String(c.numero).includes(q)
        )
      })
      .sort((a, b) => b.numero - a.numero)
  }, [cuotas, query, filter, hermanoDe])

  const stats = useMemo(() => {
    const total = cuotas.length
    const cobrado = cuotas.filter((c) => c.estado === 'Pagada').reduce((s, c) => s + c.importe, 0)
    const pendiente = cuotas.filter((c) => c.estado === 'Pendiente').reduce((s, c) => s + c.importe, 0)
    const pagadas = cuotas.filter((c) => c.estado === 'Pagada').length
    const alDia = total ? Math.round((pagadas / total) * 100) : 0
    return { total, cobrado, pendiente, alDia }
  }, [cuotas])

  function marcarPagada(id: string) {
    setCuotas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, estado: 'Pagada', fechaPago: hoy() } : c)),
    )
    setSelected((prev) => (prev && prev.id === id ? { ...prev, estado: 'Pagada', fechaPago: hoy() } : prev))
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const hermanoId = String(data.get('hermanoId') ?? '')
    const concepto = String(data.get('concepto') ?? '') as ConceptoCuota
    const importeRaw = String(data.get('importe') ?? '')
    const importe = Number(importeRaw.replace(',', '.'))
    if (!hermanoId || !concepto || !Number.isFinite(importe) || importe <= 0) return

    const nextNumero = Math.max(0, ...cuotas.map((c) => c.numero)) + 1
    const nueva: Cuota = {
      id: `c-${Date.now()}`,
      numero: nextNumero,
      hermanoId,
      concepto,
      importe,
      estado: 'Pendiente',
      fechaEmision: hoy(),
    }
    setCuotas((prev) => [nueva, ...prev])
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
          <p className="eyebrow">Cuotas</p>
          <h1>Cuotas y recibos</h1>
          <p className="dash-head__lead">
            {stats.total} recibos emitidos · datos de ejemplo mientras conectamos la base de
            datos.{' '}
            <Link to="/app/configuracion" className="dash-head__link">
              Personalizar datos de la hermandad
            </Link>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
          + Nueva cuota
        </button>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Recibos emitidos</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Este ejercicio</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Cobrado</span>
          <span className="stat-tile__value">{currency.format(stats.cobrado)}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">{stats.alDia}% al día</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Pendiente de cobro</span>
          <span className="stat-tile__value">{currency.format(stats.pendiente)}</span>
          <span className="stat-tile__trend stat-tile__trend--warn">Por regularizar</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">% al corriente</span>
          <span className="stat-tile__value">{stats.alDia}%</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">De los recibos emitidos</span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por hermano o nº de recibo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {(['Todas', 'Pagada', 'Pendiente', 'Devuelta'] as const).map((f) => (
            <button
              key={f}
              className={`chip${filter === f ? ' chip--active' : ''}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === 'Todas' ? 'Todas' : f === 'Pagada' ? 'Pagadas' : f === 'Pendiente' ? 'Pendientes' : 'Devueltas'}
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
              <th>Concepto</th>
              <th>Estado</th>
              <th>Importe</th>
              <th>Emisión</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const h = hermanoDe(c.hermanoId)
              return (
                <tr
                  key={c.id}
                  className={c.id === justAddedId ? 'row--flash' : undefined}
                  onClick={() => setSelected(c)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="num">{String(c.numero).padStart(4, '0')}</td>
                  <td>
                    <div className="row-person">
                      <span className="row-avatar">{h ? initials(h.nombre) : '?'}</span>
                      <span>
                        <span className="row-person__name">{h?.nombre ?? 'Hermano desconocido'}</span>
                        <span className="row-person__sub">Nº {h?.numero ?? '—'}</span>
                      </span>
                    </div>
                  </td>
                  <td>{c.concepto}</td>
                  <td>
                    <span className={`pill ${estadoClass(c.estado)}`}>{c.estado}</span>
                  </td>
                  <td className="num">{currency.format(c.importe)}</td>
                  <td className="num">{c.fechaEmision}</td>
                  <td>
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">
                  No hay recibos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recibo personalizado */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Recibo de cuota"
        subtitle={selected ? `Nº ${String(selected.numero).padStart(4, '0')}` : undefined}
        footer={
          selected && (
            <>
              {selected.estado === 'Pendiente' && (
                <button className="btn btn-outline" onClick={() => marcarPagada(selected.id)}>
                  Marcar como pagada
                </button>
              )}
              <button className="btn btn-primary" onClick={() => window.print()}>
                Imprimir / Descargar
              </button>
            </>
          )
        }
      >
        {selected &&
          (() => {
            const h = hermanoDe(selected.hermanoId)
            if (!h) return <p className="dash-head__lead">No se encuentra el hermano de este recibo.</p>
            return <Recibo cuota={selected} hermano={h} hermandad={hermandad} />
          })()}
      </Drawer>

      {/* Nueva cuota */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nueva cuota"
        subtitle="Emitir recibo"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="cuota-form" type="submit">
              Emitir recibo
            </button>
          </>
        }
      >
        <form id="cuota-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="hermanoId">Hermano</label>
            <HermanoPicker hermanos={HERMANOS_INICIALES} name="hermanoId" id="hermanoId" />
          </div>
          <div className="form-row">
            <label htmlFor="concepto">Concepto</label>
            <select
              id="concepto"
              name="concepto"
              defaultValue={CONCEPTOS[0]}
              onChange={(e) => {
                const input = document.getElementById('importe') as HTMLInputElement | null
                const concepto = e.target.value as ConceptoCuota
                if (input) input.value = String(IMPORTE_POR_CONCEPTO[concepto] ?? '')
              }}
            >
              {CONCEPTOS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="importe">Importe (€)</label>
            <input
              id="importe"
              name="importe"
              type="number"
              min="0"
              step="0.01"
              defaultValue={IMPORTE_POR_CONCEPTO[CONCEPTOS[0]]}
              required
            />
          </div>
          <p className="form-hint">
            El recibo se emitirá con la fecha de hoy y quedará como «Pendiente» hasta que se
            registre el pago.
          </p>
        </form>
      </Drawer>
    </div>
  )
}
