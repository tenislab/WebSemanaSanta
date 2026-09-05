import { llano } from '../../lib/buscar'
import { sumaEuros, aCentimos } from '../../lib/format'
import { useDeferredValue, useMemo, useState, type FormEvent } from 'react'
import Drawer from '../../components/Drawer'
import MovimientoJustificante from '../../components/MovimientoJustificante'
import {
  CATEGORIAS_GASTO,
  CATEGORIAS_INGRESO,
  CUENTAS_POR_DEFECTO,
  MOVIMIENTOS_INICIALES,
  type CuentaMovimiento,
  type Movimiento,
  posicionDeIva,
  type TipoMovimiento,
} from '../../data/movimientos'
import { CLAVES_CATALOGOS, useLista } from '../../lib/catalogos'
import { useAuth } from '../../context/AuthContext'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { formatCurrency } from '../../lib/format'
import { CLAVES_DATOS } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { movimientoToRow, rowToMovimiento } from '../../lib/db/movimientos'
import { hayDatosDeEjemplo } from '../../lib/demo'
import { filaQueAbre } from '../../lib/foco'
import { hoyIso } from '../../lib/hoy'
import ImportarTabla from '../../components/ImportarTabla'
import { useContextoDeImportacion } from '../../lib/contextoImportacion'
import { TABLA_MOVIMIENTOS } from '../../lib/tablasImportables'

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatearFechaInput(value: string) {
  if (!value) return hoy()
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return hoy()
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

const FILTROS = ['Todos', 'Ingreso', 'Gasto', 'Pendiente', 'Conciliado'] as const

export default function Tesoreria() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const hermandad = useHermandadSettings(fallbackNombre)

  const categoriasIngreso = useLista(CLAVES_CATALOGOS.categoriasIngreso, CATEGORIAS_INGRESO)
  const categoriasGasto = useLista(CLAVES_CATALOGOS.categoriasGasto, CATEGORIAS_GASTO)
  const cuentas = useLista(CLAVES_CATALOGOS.cuentasTesoreria, CUENTAS_POR_DEFECTO)

  const [movimientos, setMovimientos] = useSupabaseTable<Movimiento>(
    'movimientos',
    CLAVES_DATOS.movimientos,
    MOVIMIENTOS_INICIALES,
    movimientoToRow,
    rowToMovimiento,
  )
  const [query, setQuery] = useState('')
  /* La letra se pinta antes que la tabla: ver el comentario en Hermanos.tsx. */
  const busqueda = useDeferredValue(query)

  const [filter, setFilter] = useState<(typeof FILTROS)[number]>('Todos')
  const [selected, setSelected] = useState<Movimiento | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [tipoNuevo, setTipoNuevo] = useState<TipoMovimiento>('Ingreso')
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  /** Por qué no se ha podido guardar el movimiento (antes se salía en silencio). */
  const [errorAlta, setErrorAlta] = useState<string | null>(null)
  const [importarOpen, setImportarOpen] = useState(false)
  const ctxImportacion = useContextoDeImportacion()

  const filtered = useMemo(() => {
    return movimientos
      .filter((m) => {
        if (filter === 'Todos') return true
        if (filter === 'Ingreso' || filter === 'Gasto') return m.tipo === filter
        return m.estado === filter
      })
      .filter((m) => {
        const q = llano(busqueda)
        if (!q) return true
        return (
          llano(m.concepto).includes(q) ||
          llano(m.categoria).includes(q) ||
          String(m.numero).includes(q)
        )
      })
      .sort((a, b) => b.numero - a.numero)
  }, [movimientos, busqueda, filter])

  /*
   * La posición de IVA se calcula sobre TODO el libro que está viendo el
   * tesorero, con sus filtros aplicados o sin ellos según lo que sea
   * `movimientos` aquí: si un día se filtra por trimestre, esta cifra pasa a
   * ser la del trimestre, que es justo lo que se quiere para el 303.
   */
  const iva = useMemo(() => posicionDeIva(movimientos), [movimientos])

  const stats = useMemo(() => {
    const conciliados = movimientos.filter((m) => m.estado === 'Conciliado')
    const saldo = sumaEuros(conciliados.map((m) => (m.tipo === 'Ingreso' ? m.importe : -m.importe)))
    const ingresos = sumaEuros(movimientos.filter((m) => m.tipo === 'Ingreso').map((m) => m.importe))
    const gastos = sumaEuros(movimientos.filter((m) => m.tipo === 'Gasto').map((m) => m.importe))
    const pendientes = movimientos.filter((m) => m.estado === 'Pendiente').length
    return { saldo, ingresos, gastos, pendientes }
  }, [movimientos])

  function abrirNuevo() {
    setTipoNuevo('Ingreso')
    setFormOpen(true)
  }

  function marcarConciliado(id: string) {
    setMovimientos((prev) => prev.map((m) => (m.id === id ? { ...m, estado: 'Conciliado' } : m)))
    setSelected((prev) => (prev && prev.id === id ? { ...prev, estado: 'Conciliado' } : prev))
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const tipo = String(data.get('tipo') ?? 'Ingreso') as TipoMovimiento
    const concepto = String(data.get('concepto') ?? '').trim()
    const categoria = String(data.get('categoria') ?? '')
    const importeRaw = String(data.get('importe') ?? '')
    // Redondeado a céntimos al entrar: ver `aCentimos` en lib/format.ts.
    const importe = aCentimos(Number(importeRaw.replace(',', '.')))
    const cuenta = String(data.get('cuenta') ?? 'Cuenta bancaria') as CuentaMovimiento
    const fechaRaw = String(data.get('fecha') ?? '')
    // Antes se salía en silencio: pulsabas «Guardar», no pasaba nada y no
    // había forma de saber por qué (pasa al poner 0, o una cantidad que el
    // navegador no acepta en un campo numérico).
    if (!concepto || !categoria) { setErrorAlta('Pon un concepto y elige una categoría.'); return }
    if (!Number.isFinite(importe) || importe <= 0) {
      setErrorAlta('El importe tiene que ser mayor que cero. Usa la coma o el punto para los céntimos.')
      return
    }
    setErrorAlta(null)

    const nextNumero = Math.max(0, ...movimientos.map((m) => m.numero)) + 1
    const nuevo: Movimiento = {
      id: nuevoId(),
      numero: nextNumero,
      fecha: formatearFechaInput(fechaRaw),
      concepto,
      categoria,
      tipo,
      importe,
      cuenta,
      estado: 'Pendiente',
    }
    setMovimientos((prev) => [nuevo, ...prev])
    setJustAddedId(nuevo.id)
    setFormOpen(false)
    setFilter('Todos')
    setQuery('')
    form.reset()
    setTimeout(() => setJustAddedId(null), 3000)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Tesorería</p>
          <h1>Caja, ingresos y gastos</h1>
          <p className="dash-head__lead">
            {movimientos.length} movimientos{hayDatosDeEjemplo() ? ' · datos de ejemplo mientras conectamos la base de datos' : ''}
          </p>
        </div>
        <div className="dash-head__actions">
          {/* Traer el libro de caja al lado de «nuevo movimiento»: es lo mismo
              —meter apuntes— pero de golpe. Lo que trae una hermandad el primer
              día es el ejercicio entero en un Excel o el extracto del banco. */}
          <button className="btn btn-outline" onClick={() => setImportarOpen(true)}>
            Traer vuestro libro de caja (Excel o CSV)
          </button>
          <button className="btn btn-primary" onClick={abrirNuevo}>
            + Nuevo movimiento
          </button>
        </div>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Saldo conciliado</span>
          <span className="stat-tile__value">{formatCurrency(stats.saldo)}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.saldo >= 0 ? 'ok' : 'warn'}`}>
            {stats.saldo >= 0 ? 'En positivo' : 'En números rojos'}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Ingresos</span>
          <span className="stat-tile__value">{formatCurrency(stats.ingresos)}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Este ejercicio</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Gastos</span>
          <span className="stat-tile__value">{formatCurrency(stats.gastos)}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Este ejercicio</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Por conciliar</span>
          <span className="stat-tile__value">{stats.pendientes}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.pendientes > 0 ? 'warn' : 'ok'}`}>
            {stats.pendientes > 0 ? 'Revisa el extracto' : 'Todo conciliado'}
          </span>
        </div>
      </section>

      {/*
        EL IVA, SOLO SI LA HERMANDAD LO MUEVE.
        La mayoría no repercute IVA —las cuotas y los donativos están fuera— y
        a esas no hay que enseñarles una caja vacía que solo genera dudas. En
        cuanto hay una sola venta con IVA, aparece: es lo que hace falta para
        el 303 y es una resta que nadie tiene por qué hacer a mano.
      */}
      {(iva.repercutido !== 0 || iva.soportado !== 0 || iva.liquidado !== 0) && (
        <section className="stat-grid">
          <div className="stat-tile">
            <span className="stat-tile__label">IVA repercutido</span>
            <span className="stat-tile__value">{formatCurrency(iva.repercutido)}</span>
            {/* Que quede claro de quién es ese dinero: entra en la misma caja
                pero no es de la hermandad. */}
            <span className="stat-tile__trend stat-tile__trend--neutral">Cobrado para Hacienda</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile__label">IVA soportado</span>
            <span className="stat-tile__value">{formatCurrency(iva.soportado)}</span>
            <span className="stat-tile__trend stat-tile__trend--neutral">El de las compras</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile__label">Ya liquidado</span>
            <span className="stat-tile__value">{formatCurrency(iva.liquidado)}</span>
            <span className="stat-tile__trend stat-tile__trend--neutral">Ingresado a Hacienda</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile__label">
              {iva.aIngresar >= 0 ? 'Queda por ingresar' : 'A favor de la hermandad'}
            </span>
            <span className="stat-tile__value">{formatCurrency(Math.abs(iva.aIngresar))}</span>
            {/* Negativo NO se redondea a cero: significa que se ha soportado
                más IVA del que se ha repercutido y es Hacienda quien debe.
                Esconderlo sería esconder un dinero a favor. */}
            <span className={`stat-tile__trend stat-tile__trend--${iva.aIngresar > 0 ? 'warn' : 'ok'}`}>
              {iva.aIngresar > 0 ? 'En el próximo 303' : 'Nada pendiente'}
            </span>
          </div>
        </section>
      )}

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por concepto, categoría o nº"
          aria-label="Buscar movimientos por concepto, categoría o número"
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
              {f === 'Todos' ? 'Todos' : f === 'Ingreso' ? 'Ingresos' : f === 'Gasto' ? 'Gastos' : f === 'Pendiente' ? 'Por conciliar' : 'Conciliados'}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th className="col-opcional">Nº</th>
              <th className="col-opcional">Fecha</th>
              <th>Concepto</th>
              <th className="col-opcional">Categoría</th>
              <th className="col-opcional">Cuenta</th>
              <th>Importe</th>
              <th className="col-opcional">Estado</th>
              <th className="col-opcional"></th>
            </tr>
          </thead>
          <tbody>
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="table-empty">
                  No hay movimientos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Justificante */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Justificante"
        subtitle={selected ? `Nº ${String(selected.numero).padStart(4, '0')}` : undefined}
        footer={
          selected && (
            <>
              {selected.estado === 'Pendiente' && (
                <button className="btn btn-outline" onClick={() => marcarConciliado(selected.id)}>
                  Marcar como conciliado
                </button>
              )}
              <button className="btn btn-primary" onClick={() => window.print()}>
                Imprimir / Descargar
              </button>
            </>
          )
        }
      >
        {selected && <MovimientoJustificante movimiento={selected} hermandad={hermandad} />}
      </Drawer>

      {/* Nuevo movimiento */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo movimiento"
        subtitle="Tesorería"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="movimiento-form" type="submit">
              Registrar
            </button>
          </>
        }
      >
        <form id="movimiento-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" value={tipoNuevo} onChange={(e) => setTipoNuevo(e.target.value as TipoMovimiento)}>
              <option value="Ingreso">Ingreso</option>
              <option value="Gasto">Gasto</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="concepto">Concepto</label>
            <input id="concepto" name="concepto" type="text" placeholder="Ej. Cuotas de marzo" required />
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="categoria">Categoría</label>
              <select id="categoria" name="categoria" key={tipoNuevo} defaultValue="">
                <option value="" disabled>
                  Elige una categoría
                </option>
                {(tipoNuevo === 'Ingreso' ? categoriasIngreso : categoriasGasto).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="importe">Importe (€)</label>
              <input id="importe" name="importe" type="number" min="0.01" step="0.01" required />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="cuenta">Cuenta</label>
              <select id="cuenta" name="cuenta" defaultValue="Cuenta bancaria">
                {cuentas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="fecha">Fecha</label>
              <input id="fecha" name="fecha" type="date" defaultValue={hoyIso()} />
            </div>
          </div>
          <p className="form-hint">
            El movimiento se registra como «Pendiente» hasta que lo concilies con el extracto
            bancario o la caja.
          </p>
          {errorAlta && <p className="form-hint form-hint--error">{errorAlta}</p>}
        </form>
      </Drawer>

      <ImportarTabla
        abierto={importarOpen}
        onCerrar={() => setImportarOpen(false)}
        tabla={TABLA_MOVIMIENTOS}
        existentes={movimientos}
        ctx={ctxImportacion}
        onImportar={(lista) => setMovimientos(lista)}
      />
    </div>
  )
}
