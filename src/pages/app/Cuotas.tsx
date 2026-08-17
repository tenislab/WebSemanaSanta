import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import Recibo from '../../components/Recibo'
import ReciboModeloRender from '../../components/ReciboModeloRender'
import ModeloPapeletaEditor from '../../components/ModeloPapeletaEditor'
import HermanoPicker from '../../components/HermanoPicker'
import {
  CLAVES_DATO_RECIBO,
  getModeloRecibo,
  saveModeloRecibo,
  borrarModeloRecibo,
} from '../../lib/modeloRecibo'
import type { ModeloPapeleta } from '../../lib/modeloPapeleta'
import { HERMANOS_INICIALES, initials, type Hermano } from '../../data/hermanos'
import {
  CUOTAS_INICIALES,
  METODOS_COBRO,
  metodoDeCuota,
  type ConceptoCuota,
  type Cuota,
  type EstadoCuota,
  type MetodoCobro,
} from '../../data/cuotas'
import { getConceptosCuota } from '../../lib/conceptosCuota'
import { useAuth } from '../../context/AuthContext'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { formatCurrency } from '../../lib/format'
import { CLAVES_DATOS, leerPersistido } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { cuotaToRow, rowToCuota } from '../../lib/db/cuotas'
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

/**
 * Suma meses a una fecha ISO (YYYY-MM-DD) sin el desbordamiento de `setMonth`
 * (que convertiría el 31 de enero + 1 mes en el 3 de marzo). Si el día no
 * existe en el mes destino, se ajusta al último día de ese mes.
 */
function sumarMeses(iso: string, meses: number): string {
  const d = new Date(`${iso}T00:00:00`)
  const dia = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + meses)
  const ultimoDiaDelMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(dia, ultimoDiaDelMes))
  return d.toISOString().slice(0, 10)
}

export default function Cuotas() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const hermandad = useHermandadSettings(fallbackNombre)

  const [cuotas, setCuotas] = useSupabaseTable<Cuota>(
    'cuotas',
    CLAVES_DATOS.cuotas,
    CUOTAS_INICIALES,
    cuotaToRow,
    rowToCuota,
  )
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'Todas' | EstadoCuota>('Todas')
  const [selected, setSelected] = useState<Cuota | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [hermanoNuevaCuota, setHermanoNuevaCuota] = useState<Hermano | null>(null)
  const [metodoNuevaCuota, setMetodoNuevaCuota] = useState<MetodoCobro>('Domiciliación')
  const [periodicidadNueva, setPeriodicidadNueva] = useState<'puntual' | 'mensual'>('puntual')

  // La mora solo la ponen/quitan el tesorero, el secretario o el titular
  // (quien no tiene cargo asignado es el titular, con acceso completo).
  const cargo = user?.user_metadata?.cargo as string | undefined
  const puedeMora = !cargo || cargo === 'Tesorero/a' || cargo === 'Secretario/a'
  const [remesaOpen, setRemesaOpen] = useState(false)
  const [fechaRemesa, setFechaRemesa] = useState('')
  const [modeloOpen, setModeloOpen] = useState(false)
  const [modeloRecibo, setModeloRecibo] = useState<ModeloPapeleta | null>(() => getModeloRecibo())

  const hermanos = useMemo(() => leerPersistido(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  const conceptosCuota = useMemo(() => getConceptosCuota(), [])
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

  /** Pone o quita la mora a mano (nunca automático al vencer). */
  function cambiarEstado(id: string, estado: EstadoCuota) {
    setCuotas((prev) => prev.map((c) => (c.id === id ? { ...c, estado } : c)))
    setSelected((prev) => (prev && prev.id === id ? { ...prev, estado } : prev))
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
    setMetodoNuevaCuota('Domiciliación')
    setPeriodicidadNueva('puntual')
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
    const metodoCobro = String(data.get('metodoCobro') ?? 'Domiciliación') as MetodoCobro
    const periodicidad = String(data.get('periodicidad') ?? 'puntual')
    const hermano = hermanos.find((h) => h.id === hermanoId)
    // Solo se domicilia de verdad si el método es domiciliación Y el hermano tiene IBAN.
    const domiciliada = metodoCobro === 'Domiciliación' && Boolean(hermano?.iban)
    const metodoFinal: MetodoCobro = metodoCobro === 'Domiciliación' && !hermano?.iban ? 'Transferencia' : metodoCobro
    if (!hermanoId || !concepto || !Number.isFinite(importe) || importe <= 0) return

    // Mensual: se emiten 12 recibos, uno por mes, con el cobro corriendo mes a mes.
    const meses = periodicidad === 'mensual' ? 12 : 1
    const baseIso = fechaCobroRaw || fechaCobroPorDefecto()
    const primerId = nuevoId()

    setCuotas((prev) => {
      let siguienteNumero = Math.max(0, ...prev.map((c) => c.numero)) + 1
      const nuevas: Cuota[] = []
      for (let i = 0; i < meses; i++) {
        nuevas.push({
          id: i === 0 ? primerId : nuevoId(),
          numero: siguienteNumero++,
          hermanoId,
          concepto: meses > 1 ? `${concepto} · mes ${i + 1}/12` : concepto,
          importe,
          estado: 'Pendiente',
          fechaEmision: hoy(),
          fechaCobro: formatearFechaInput(sumarMeses(baseIso, i)),
          domiciliada,
          metodoCobro: metodoFinal,
        })
      }
      return [...nuevas.reverse(), ...prev]
    })
    setJustAddedId(primerId)
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
          <button className="btn btn-outline" onClick={() => setModeloOpen(true)}>
            Modelo de recibo
          </button>
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
          {(['Todas', 'Pagada', 'Pendiente', 'En mora', 'Devuelta'] as const).map((f) => (
            <button
              key={f}
              className={`chip${filter === f ? ' chip--active' : ''}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === 'Todas'
                ? 'Todas'
                : f === 'Pagada'
                  ? 'Pagadas'
                  : f === 'Pendiente'
                    ? 'Pendientes'
                    : f === 'En mora'
                      ? 'En mora'
                      : 'Devueltas'}
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
                        {metodoDeCuota(c)}
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
              {(selected.estado === 'Pendiente' || selected.estado === 'En mora') && (
                <button className="btn btn-outline" onClick={() => marcarPagada(selected.id)}>
                  Marcar como pagada
                </button>
              )}
              {puedeMora && selected.estado === 'Pendiente' && (
                <button className="btn btn-ghost rgpd-borrar" onClick={() => cambiarEstado(selected.id, 'En mora')}>
                  Poner en mora
                </button>
              )}
              {puedeMora && selected.estado === 'En mora' && (
                <button className="btn btn-ghost" onClick={() => cambiarEstado(selected.id, 'Pendiente')}>
                  Quitar mora
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
            return modeloRecibo ? (
              <ReciboModeloRender
                modelo={modeloRecibo}
                datos={{ cuota: selected, hermano: h, hermandadNombre: hermandad.nombreLegal }}
              />
            ) : (
              <Recibo cuota={selected} hermano={h} hermandad={hermandad} />
            )
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
              defaultValue={conceptosCuota[0]?.nombre ?? ''}
              onChange={(e) => {
                const input = document.getElementById('importe') as HTMLInputElement | null
                const concepto = conceptosCuota.find((c) => c.nombre === e.target.value)
                if (input && concepto) input.value = String(concepto.importe)
              }}
            >
              {conceptosCuota.map((c) => (
                <option key={c.id} value={c.nombre}>
                  {c.nombre} — {c.importe} €
                </option>
              ))}
            </select>
            <p className="form-hint">
              Los conceptos y sus importes los define tu hermandad en{' '}
              <Link to="/app/configuracion">Configuración</Link>.
            </p>
          </div>
          <div className="form-row">
            <label htmlFor="importe">Importe (€)</label>
            <input
              id="importe"
              name="importe"
              type="number"
              min="0"
              step="0.01"
              defaultValue={conceptosCuota[0]?.importe ?? 0}
              required
            />
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="fechaCobro">Fecha de cobro</label>
              <input id="fechaCobro" name="fechaCobro" type="date" defaultValue={fechaCobroPorDefecto()} />
            </div>
            <div className="form-row">
              <label htmlFor="periodicidad">Periodicidad</label>
              <select
                id="periodicidad"
                name="periodicidad"
                value={periodicidadNueva}
                onChange={(e) => setPeriodicidadNueva(e.target.value as 'puntual' | 'mensual')}
              >
                <option value="puntual">Recibo único</option>
                <option value="mensual">Mensual (12 recibos)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="metodoCobro">Método de cobro</label>
            <select
              id="metodoCobro"
              name="metodoCobro"
              value={metodoNuevaCuota}
              onChange={(e) => setMetodoNuevaCuota(e.target.value as MetodoCobro)}
            >
              {METODOS_COBRO.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {metodoNuevaCuota === 'Domiciliación' && hermanoNuevaCuota && !hermanoNuevaCuota.iban && (
              <p className="form-hint form-hint--error">
                {hermanoNuevaCuota.nombre.split(' ')[0]} no tiene cuenta bancaria — se emitirá como
                Transferencia. Puedes añadirle una cuenta desde su ficha en Hermanos.
              </p>
            )}
            {periodicidadNueva === 'mensual' && (
              <p className="form-hint">
                Se emitirán <b>12 recibos</b> (uno por mes) con el mismo importe, corriendo la fecha
                de cobro mes a mes.
              </p>
            )}
          </div>

          <p className="form-hint">
            {periodicidadNueva === 'mensual' ? 'Los recibos quedarán' : 'El recibo quedará'} como
            «Pendiente» hasta que se registre el pago. Nadie entra en mora automáticamente: el
            tesorero o el secretario la ponen a mano cuando procede.
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

      {/* Modelo de recibo personalizado */}
      <Drawer
        open={modeloOpen}
        onClose={() => setModeloOpen(false)}
        title="Modelo de recibo"
        subtitle="Sube tu diseño y coloca los datos"
      >
        <p className="form-hint">
          Sube la imagen de tu modelo de recibo y coloca encima los datos de la cuota. A partir de
          entonces, cada recibo se imprime sobre ese modelo con los datos reales del hermano. Si
          borras el modelo, se vuelve al recibo estándar.
        </p>
        <ModeloPapeletaEditor
          modelo={modeloRecibo}
          onCambio={setModeloRecibo}
          claves={CLAVES_DATO_RECIBO}
          guardar={saveModeloRecibo}
          borrar={borrarModeloRecibo}
        />
      </Drawer>
    </div>
  )
}
