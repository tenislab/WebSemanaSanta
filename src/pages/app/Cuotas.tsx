import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import Recibo from '../../components/Recibo'
import HermanoPicker from '../../components/HermanoPicker'
import { HERMANOS_INICIALES, initials, type Hermano } from '../../data/hermanos'
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
import { formatCurrency } from '../../lib/format'
import { CLAVES_DATOS, leerPersistido, usePersistentState } from '../../lib/persistencia'
import { descargarArchivo, toCsv } from '../../lib/csv'
import { buildSepaXml, acreedorIncompleto } from '../../lib/sepa'

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Fecha por defecto del primer cobro: hoy + 15 días (margen de aviso típico de una domiciliación SEPA). */
function fechaCobroPorDefecto() {
  const d = new Date()
  d.setDate(d.getDate() + 15)
  return d.toISOString().slice(0, 10)
}

function formatearFechaInput(value: string) {
  if (!value) return hoy()
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return hoy()
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
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

  const [cuotas, setCuotas] = usePersistentState<Cuota[]>(CLAVES_DATOS.cuotas, CUOTAS_INICIALES)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'Todas' | EstadoCuota>('Todas')
  const [selected, setSelected] = useState<Cuota | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [hermanoNuevaCuota, setHermanoNuevaCuota] = useState<Hermano | null>(null)
  const [domiciliarNuevaCuota, setDomiciliarNuevaCuota] = useState(true)
  const [remesaOpen, setRemesaOpen] = useState(false)
  const [fechaRemesa, setFechaRemesa] = useState('')

  const hermanos = useMemo(() => leerPersistido(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  const hermanoDe = useMemo(() => {
    const map = new Map(hermanos.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [hermanos])

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

  // Remesa bancaria: recibos pendientes y domiciliados con IBAN, listos para
  // presentar al banco. El CSV es un listado de trabajo; el XML es el
  // fichero de adeudo directo SEPA (pain.008.001.02) que exige el banco.
  const recibosRemesables = useMemo(
    () => cuotas.filter((c) => c.estado === 'Pendiente' && c.domiciliada && hermanoDe(c.hermanoId)?.iban),
    [cuotas, hermanoDe],
  )

  const acreedor = useMemo(
    () => ({ nombre: hermandad.nombreLegal, iban: hermandad.iban, identificadorAcreedor: hermandad.identificadorAcreedor }),
    [hermandad],
  )
  const avisoAcreedor = useMemo(() => acreedorIncompleto(acreedor), [acreedor])

  function abrirRemesa() {
    const dentroCincoDias = new Date()
    dentroCincoDias.setDate(dentroCincoDias.getDate() + 5)
    setFechaRemesa(dentroCincoDias.toISOString().slice(0, 10))
    setRemesaOpen(true)
  }

  function exportarRemesaCsv() {
    const filas = recibosRemesables.map((c) => {
      const h = hermanoDe(c.hermanoId)!
      return [c.numero, h.nombre, h.iban ?? '', c.concepto, c.importe.toFixed(2).replace('.', ','), c.fechaCobro]
    })
    const csv = toCsv(['Nº recibo', 'Hermano', 'IBAN', 'Concepto', 'Importe (€)', 'Fecha de cobro'], filas)
    descargarArchivo(`remesa-cuotas-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  function descargarSepaXml() {
    if (avisoAcreedor || !fechaRemesa) return
    const recibos = recibosRemesables.map((c) => {
      const h = hermanoDe(c.hermanoId)!
      return {
        numero: c.numero,
        importe: c.importe,
        concepto: `${c.concepto} — ${hermandad.nombreLegal || 'Hermandad'}`,
        deudor: { nombre: h.nombre, iban: h.iban ?? '', numeroHermano: h.numero, antiguedad: h.antiguedad },
      }
    })
    const xml = buildSepaXml(acreedor, recibos, new Date(`${fechaRemesa}T00:00:00`), new Date())
    descargarArchivo(`remesa-sepa-${fechaRemesa}.xml`, xml, 'application/xml;charset=utf-8;')
    setRemesaOpen(false)
  }

  function abrirNuevaCuota() {
    setHermanoNuevaCuota(null)
    setDomiciliarNuevaCuota(true)
    setFormOpen(true)
  }

  function cerrarNuevaCuota() {
    setFormOpen(false)
    setHermanoNuevaCuota(null)
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const hermanoId = String(data.get('hermanoId') ?? '')
    const concepto = String(data.get('concepto') ?? '') as ConceptoCuota
    const importeRaw = String(data.get('importe') ?? '')
    const importe = Number(importeRaw.replace(',', '.'))
    const fechaCobroRaw = String(data.get('fechaCobro') ?? '')
    const hermano = hermanos.find((h) => h.id === hermanoId)
    const domiciliada = data.get('domiciliada') === 'on' && Boolean(hermano?.iban)
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
      fechaCobro: formatearFechaInput(fechaCobroRaw),
      domiciliada,
    }
    setCuotas((prev) => [nueva, ...prev])
    setJustAddedId(nueva.id)
    cerrarNuevaCuota()
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
        <div className="dash-head__actions">
          <button
            className="btn btn-outline"
            onClick={abrirRemesa}
            disabled={recibosRemesables.length === 0}
            title={
              recibosRemesables.length === 0
                ? 'No hay recibos pendientes domiciliados con IBAN'
                : `${recibosRemesables.length} recibos pendientes domiciliados`
            }
          >
            Remesa ({recibosRemesables.length})
          </button>
          <button className="btn btn-primary" onClick={abrirNuevaCuota}>
            + Nueva cuota
          </button>
        </div>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Recibos emitidos</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Este ejercicio</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Cobrado</span>
          <span className="stat-tile__value">{formatCurrency(stats.cobrado)}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">{stats.alDia}% al día</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Pendiente de cobro</span>
          <span className="stat-tile__value">{formatCurrency(stats.pendiente)}</span>
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
              <th>Cobro</th>
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
                  <td className="num">{formatCurrency(c.importe)}</td>
                  <td>
                    <span className="cobro-cell">
                      <span className="num">{c.fechaCobro}</span>
                      <span className={`cobro-tag${c.domiciliada ? ' cobro-tag--bank' : ''}`}>
                        {c.domiciliada ? 'Domiciliada' : 'Manual'}
                      </span>
                    </span>
                  </td>
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
        onClose={cerrarNuevaCuota}
        title="Nueva cuota"
        subtitle="Emitir recibo"
        footer={
          <>
            <button className="btn btn-ghost" onClick={cerrarNuevaCuota}>
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
            <HermanoPicker
              hermanos={hermanos}
              name="hermanoId"
              id="hermanoId"
              onSelect={setHermanoNuevaCuota}
            />
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
          <div className="form-row">
            <label htmlFor="fechaCobro">Fecha de cobro</label>
            <input id="fechaCobro" name="fechaCobro" type="date" defaultValue={fechaCobroPorDefecto()} />
          </div>

          <div className="assign-box">
            <label className="checkbox-row" htmlFor="domiciliada">
              <input
                id="domiciliada"
                name="domiciliada"
                type="checkbox"
                checked={domiciliarNuevaCuota && Boolean(hermanoNuevaCuota?.iban)}
                disabled={!hermanoNuevaCuota?.iban}
                onChange={(e) => setDomiciliarNuevaCuota(e.target.checked)}
              />
              Domiciliar por banco
            </label>
            {!hermanoNuevaCuota && (
              <p className="form-hint">Elige un hermano para saber si tiene cuenta registrada.</p>
            )}
            {hermanoNuevaCuota && !hermanoNuevaCuota.iban && (
              <p className="form-hint form-hint--error">
                {hermanoNuevaCuota.nombre.split(' ')[0]} no tiene cuenta bancaria registrada — esta
                cuota se cobrará de forma manual. Puedes añadirle una cuenta desde su ficha en
                Hermanos.
              </p>
            )}
            {hermanoNuevaCuota?.iban && (
              <p className="form-hint">
                Se cargará en su cuenta el día indicado arriba, si la domiciliación queda marcada.
              </p>
            )}
          </div>

          <p className="form-hint">
            El recibo se emitirá con la fecha de hoy y quedará como «Pendiente» hasta que se
            registre el pago.
          </p>
        </form>
      </Drawer>

      {/* Remesa bancaria */}
      <Drawer
        open={remesaOpen}
        onClose={() => setRemesaOpen(false)}
        title="Remesa bancaria"
        subtitle={`${recibosRemesables.length} recibos pendientes domiciliados`}
        footer={
          <>
            <button className="btn btn-ghost" onClick={exportarRemesaCsv}>
              Solo CSV
            </button>
            <button className="btn btn-primary" onClick={descargarSepaXml} disabled={!!avisoAcreedor || !fechaRemesa}>
              Descargar XML SEPA
            </button>
          </>
        }
      >
        <div className="app-form">
          {avisoAcreedor && <div className="banner-inline banner-inline--warn">{avisoAcreedor}</div>}
          <div className="form-row">
            <label htmlFor="fechaRemesa">Fecha de cobro</label>
            <input
              id="fechaRemesa"
              type="date"
              value={fechaRemesa}
              onChange={(e) => setFechaRemesa(e.target.value)}
            />
            <p className="form-hint">
              La misma fecha para todos los recibos del lote: es la fecha en la que el banco
              presentará el cobro a cada hermano.
            </p>
          </div>
          <div className="table-card table-card--in-drawer">
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Hermano</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {recibosRemesables.map((c) => (
                  <tr key={c.id}>
                    <td className="num">{c.numero}</td>
                    <td>{hermanoDe(c.hermanoId)?.nombre ?? '—'}</td>
                    <td className="num">{formatCurrency(c.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="form-hint">
            El XML es un fichero de adeudo directo SEPA CORE (pain.008.001.02) real, listo para
            subir a la banca online. El «Solo CSV» es un listado de trabajo para revisar antes de
            enviarlo.
          </p>
        </div>
      </Drawer>
    </div>
  )
}
