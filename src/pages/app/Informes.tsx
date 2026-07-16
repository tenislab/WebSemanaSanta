import { useEffect, useMemo, useState } from 'react'
import Drawer from '../../components/Drawer'
import InformeImpreso from '../../components/InformeImpreso'
import EstadoCuentas from '../../components/EstadoCuentas'
import { useAuth } from '../../context/AuthContext'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { formatCurrency, formatDate } from '../../lib/format'
import { toCsv, descargarArchivo } from '../../lib/csv'
import { HERMANOS_INICIALES } from '../../data/hermanos'
import { CUOTAS_INICIALES } from '../../data/cuotas'
import { PAPELETAS_INICIALES } from '../../data/papeletas'
import { MOVIMIENTOS_INICIALES } from '../../data/movimientos'
import { ENSERES_INICIALES } from '../../data/enseres'
import { getTramos, etiquetaTramo } from '../../lib/tramos'
import { repartoCompleto } from '../../lib/cortejo'
import { CLAVES_DATOS, leerPersistido } from '../../lib/persistencia'
import { getCampana } from '../../lib/campana'

interface Informe {
  id: string
  titulo: string
  modulo: string
  descripcion: string
  resumen: { etiqueta: string; valor: string }[]
  columnas: string[]
  filas: (string | number)[][]
}

function construirInformes(): Informe[] {
  // Los informes se calculan sobre los datos guardados (localStorage), no
  // sobre los de ejemplo: reflejan las altas, pagos y cambios hechos en la app.
  const hermanosActuales = leerPersistido(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
  const cuotasActuales = leerPersistido(CLAVES_DATOS.cuotas, CUOTAS_INICIALES)
  const anioCampana = getCampana().anio
  const papeletasActuales = leerPersistido(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES).filter((p) => p.anio === anioCampana)
  const movimientosActuales = leerPersistido(CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES)
  const enseresActuales = leerPersistido(CLAVES_DATOS.enseres, ENSERES_INICIALES)

  const hermanoDe = (id: string) => hermanosActuales.find((h) => h.id === id)
  const tramos = getTramos()

  const activos = hermanosActuales.filter((h) => h.estado === 'Activo').length
  const nuevos = hermanosActuales.filter((h) => h.estado === 'Nuevo').length
  const bajas = hermanosActuales.filter((h) => h.estado === 'Baja').length
  const alDia = hermanosActuales.filter((h) => h.cuotaAlDia).length
  const sinIban = hermanosActuales.filter((h) => !h.iban).length

  const cobrado = cuotasActuales.filter((c) => c.estado === 'Pagada').reduce((s, c) => s + c.importe, 0)
  const pendiente = cuotasActuales.filter((c) => c.estado === 'Pendiente').reduce((s, c) => s + c.importe, 0)
  const devuelto = cuotasActuales.filter((c) => c.estado === 'Devuelta').reduce((s, c) => s + c.importe, 0)
  const domiciliadas = cuotasActuales.filter((c) => c.domiciliada).length

  const recaudadoPapeletas = papeletasActuales.filter((p) => p.estado !== 'Anulada').reduce((s, p) => s + p.importe, 0)
  const entregadas = papeletasActuales.filter((p) => p.estado === 'Entregada').length
  const pendientesPapeleta = papeletasActuales.filter((p) => p.estado === 'Solicitada' || p.estado === 'Asignada').length

  const asignaciones = repartoCompleto(tramos, papeletasActuales, hermanoDe, new Set())
  const ocupacionPorTramo = new Map<string, { ocupados: number; excedidos: number }>()
  asignaciones.forEach((a) => {
    if (!a.tramo) return
    const e = ocupacionPorTramo.get(a.tramo.id) ?? { ocupados: 0, excedidos: 0 }
    if (a.estado === 'Excede aforo') e.excedidos += 1
    else e.ocupados += 1
    ocupacionPorTramo.set(a.tramo.id, e)
  })
  const filasCortejo = tramos.map((t) => ({
    tramo: t,
    ocupados: ocupacionPorTramo.get(t.id)?.ocupados ?? 0,
    excedidos: ocupacionPorTramo.get(t.id)?.excedidos ?? 0,
  }))
  const excedenAforoTotal = filasCortejo.reduce((s, f) => s + f.excedidos, 0)
  const aforoTotal = tramos.reduce((s, t) => s + t.capacidad, 0)
  const ocupadosTotal = filasCortejo.reduce((s, f) => s + f.ocupados, 0)

  const ingresos = movimientosActuales.filter((m) => m.tipo === 'Ingreso').reduce((s, m) => s + m.importe, 0)
  const gastos = movimientosActuales.filter((m) => m.tipo === 'Gasto').reduce((s, m) => s + m.importe, 0)
  const balanceConciliado = movimientosActuales.filter((m) => m.estado === 'Conciliado').reduce(
    (s, m) => s + (m.tipo === 'Ingreso' ? m.importe : -m.importe),
    0,
  )
  const porConciliar = movimientosActuales.filter((m) => m.estado === 'Pendiente').length

  const valorAsegurado = enseresActuales.filter((e) => e.valorAsegurado !== null).reduce(
    (s, e) => s + (e.valorAsegurado ?? 0),
    0,
  )
  const enPrestamo = enseresActuales.filter((e) => e.prestadoA !== null).length
  const necesitaRestauracion = enseresActuales.filter((e) => e.estadoConservacion === 'Necesita restauración').length

  return [
    {
      id: 'padron',
      titulo: 'Padrón de hermanos',
      modulo: 'Hermanos',
      descripcion: 'Censo completo con estado, antigüedad y contacto.',
      resumen: [
        { etiqueta: 'Total', valor: String(hermanosActuales.length) },
        { etiqueta: 'Activos', valor: String(activos) },
        { etiqueta: 'Nuevos', valor: String(nuevos) },
        { etiqueta: 'Bajas', valor: String(bajas) },
        { etiqueta: 'Con cuota al día', valor: String(alDia) },
        { etiqueta: 'Sin IBAN', valor: String(sinIban) },
      ],
      columnas: ['Nº', 'Nombre', 'Estado', 'Antigüedad', 'Email', 'Teléfono', 'Cuota al día'],
      filas: hermanosActuales.map((h) => [
        h.numero, h.nombre, h.estado, h.antiguedad, h.email, h.telefono, h.cuotaAlDia ? 'Sí' : 'No',
      ]),
    },
    {
      id: 'cuotas',
      titulo: 'Recaudación de cuotas',
      modulo: 'Cuotas',
      descripcion: 'Recibos emitidos, cobrados, pendientes y devueltos.',
      resumen: [
        { etiqueta: 'Cobrado', valor: formatCurrency(cobrado) },
        { etiqueta: 'Pendiente', valor: formatCurrency(pendiente) },
        { etiqueta: 'Devuelto', valor: formatCurrency(devuelto) },
        { etiqueta: 'Domiciliadas', valor: `${domiciliadas} de ${cuotasActuales.length}` },
      ],
      columnas: ['Nº recibo', 'Hermano', 'Concepto', 'Importe', 'Estado', 'Emisión', 'Cobro'],
      filas: cuotasActuales.map((c) => [
        c.numero, hermanoDe(c.hermanoId)?.nombre ?? '—', c.concepto, formatCurrency(c.importe), c.estado, c.fechaEmision, c.fechaCobro,
      ]),
    },
    {
      id: 'papeletas',
      titulo: 'Papeletas de sitio',
      modulo: 'Papeletas',
      descripcion: 'Papeletas emitidas por tramo, con su importe y estado.',
      resumen: [
        { etiqueta: 'Emitidas', valor: String(papeletasActuales.length) },
        { etiqueta: 'Recaudado', valor: formatCurrency(recaudadoPapeletas) },
        { etiqueta: 'Entregadas', valor: String(entregadas) },
        { etiqueta: 'Pendientes', valor: String(pendientesPapeleta) },
      ],
      columnas: ['Nº', 'Hermano', 'Tramo', 'Importe', 'Estado', 'Solicitud'],
      filas: papeletasActuales.map((p) => {
        const tramo = tramos.find((t) => t.id === p.tramoId)
        return [
          p.numero, hermanoDe(p.hermanoId)?.nombre ?? '—', tramo ? etiquetaTramo(tramo) : 'Sin tramo',
          formatCurrency(p.importe), p.estado, p.fechaSolicitud,
        ]
      }),
    },
    {
      id: 'cortejo',
      titulo: 'Ocupación del cortejo',
      modulo: 'Cortejo',
      descripcion: 'Aforo y ocupación real de cada tramo, según las papeletas emitidas.',
      resumen: [
        { etiqueta: 'Aforo total', valor: String(aforoTotal) },
        { etiqueta: 'Ocupados', valor: String(ocupadosTotal) },
        { etiqueta: 'Libres', valor: String(Math.max(0, aforoTotal - ocupadosTotal)) },
        { etiqueta: 'Exceden aforo', valor: String(excedenAforoTotal) },
      ],
      columnas: ['Tramo', 'Cuerpo', 'Aforo', 'Ocupados', 'Libres', 'Exceden aforo'],
      filas: filasCortejo.map(({ tramo, ocupados, excedidos }) => [
        tramo.nombre, tramo.cuerpo, tramo.capacidad, ocupados, Math.max(0, tramo.capacidad - ocupados), excedidos,
      ]),
    },
    {
      id: 'tesoreria',
      titulo: 'Tesorería',
      modulo: 'Tesorería',
      descripcion: 'Ingresos y gastos registrados, conciliados o pendientes.',
      resumen: [
        { etiqueta: 'Ingresos', valor: formatCurrency(ingresos) },
        { etiqueta: 'Gastos', valor: formatCurrency(gastos) },
        { etiqueta: 'Saldo conciliado', valor: formatCurrency(balanceConciliado) },
        { etiqueta: 'Por conciliar', valor: String(porConciliar) },
      ],
      columnas: ['Nº', 'Fecha', 'Concepto', 'Categoría', 'Tipo', 'Importe', 'Cuenta', 'Estado'],
      filas: movimientosActuales.map((m) => [
        m.numero, m.fecha, m.concepto, m.categoria, m.tipo,
        `${m.tipo === 'Gasto' ? '−' : '+'}${formatCurrency(m.importe)}`, m.cuenta, m.estado,
      ]),
    },
    {
      id: 'inventario',
      titulo: 'Inventario',
      modulo: 'Inventario',
      descripcion: 'Enseres registrados, su valor asegurado y su estado de conservación.',
      resumen: [
        { etiqueta: 'Total enseres', valor: String(enseresActuales.length) },
        { etiqueta: 'Valor asegurado', valor: formatCurrency(valorAsegurado) },
        { etiqueta: 'En préstamo', valor: String(enPrestamo) },
        { etiqueta: 'Necesitan restauración', valor: String(necesitaRestauracion) },
      ],
      columnas: ['Nº', 'Nombre', 'Categoría', 'Ubicación', 'Conservación', 'Valor asegurado', 'Prestado a'],
      filas: enseresActuales.map((e) => [
        e.numero, e.nombre, e.categoria, e.ubicacion, e.estadoConservacion,
        e.valorAsegurado !== null ? formatCurrency(e.valorAsegurado) : 'Sin asegurar', e.prestadoA ?? '—',
      ]),
    },
  ]
}

export default function Informes() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const hermandad = useHermandadSettings(fallbackNombre)

  const informes = useMemo(() => construirInformes(), [])
  const [selected, setSelected] = useState<Informe | null>(null)

  const generadoEl = useMemo(() => formatDate(new Date()), [])

  const movimientosEstado = useMemo(
    () => leerPersistido(CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES),
    [],
  )
  const aniosDisponibles = useMemo(() => {
    const anios = new Set(movimientosEstado.map((m) => Number(m.fecha.trim().slice(-4))).filter((a) => !Number.isNaN(a)))
    anios.add(new Date().getFullYear())
    return Array.from(anios).sort((a, b) => b - a)
  }, [movimientosEstado])
  const [anioEstado, setAnioEstado] = useState(() => aniosDisponibles[0] ?? new Date().getFullYear())
  const saldoInicialEstado = useMemo(
    () =>
      movimientosEstado
        .filter((m) => Number(m.fecha.trim().slice(-4)) < anioEstado)
        .reduce((s, m) => s + (m.tipo === 'Ingreso' ? m.importe : -m.importe), 0),
    [movimientosEstado, anioEstado],
  )
  // Solo un documento de impresión a la vez: pedir el Estado de Cuentas cierra
  // cualquier informe abierto, para que no se solapen los dos .print-doc.
  const [imprimiendoEstado, setImprimiendoEstado] = useState(false)
  useEffect(() => {
    if (!imprimiendoEstado) return
    window.print()
    setImprimiendoEstado(false)
  }, [imprimiendoEstado])

  const kpis = useMemo(() => {
    const hermanos = leerPersistido(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
    const cuotas = leerPersistido(CLAVES_DATOS.cuotas, CUOTAS_INICIALES)
    const anio = getCampana().anio
    const papeletas = leerPersistido(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES).filter((p) => p.anio === anio)
    const movimientos = leerPersistido(CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES)
    const totalHermanos = hermanos.length
    const cobrado = cuotas.filter((c) => c.estado === 'Pagada').reduce((s, c) => s + c.importe, 0)
    const papeletasEmitidas = papeletas.filter((p) => p.estado !== 'Anulada' && p.estado !== 'Renuncia').length
    const balance = movimientos.filter((m) => m.estado === 'Conciliado').reduce(
      (s, m) => s + (m.tipo === 'Ingreso' ? m.importe : -m.importe),
      0,
    )
    return { totalHermanos, cobrado, papeletasEmitidas, balance }
  }, [])

  function exportarCsv(informe: Informe) {
    const csv = toCsv(informe.columnas, informe.filas)
    descargarArchivo(`${informe.id}.csv`, csv)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Informes</p>
          <h1>Informes y exportación</h1>
          <p className="dash-head__lead">
            {informes.length} informes · calculados en vivo a partir de los datos guardados en este navegador.
          </p>
        </div>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Hermanos</span>
          <span className="stat-tile__value">{kpis.totalHermanos}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Censo actual</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Cuotas cobradas</span>
          <span className="stat-tile__value">{formatCurrency(kpis.cobrado)}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Este ejercicio</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Papeletas emitidas</span>
          <span className="stat-tile__value">{kpis.papeletasEmitidas}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Estación de penitencia</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Saldo conciliado</span>
          <span className="stat-tile__value">{formatCurrency(kpis.balance)}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Tesorería</span>
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-card__title">Estado de cuentas anual</h2>
        <p className="form-hint">
          Ingresos y gastos por partida, con el formato clásico que suelen pedir las diócesis,
          calculado a partir de las categorías de tus movimientos de tesorería.
        </p>
        <div className="assign-box__row">
          <select value={anioEstado} onChange={(e) => setAnioEstado(Number(e.target.value))} aria-label="Ejercicio">
            {aniosDisponibles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelected(null)
              setImprimiendoEstado(true)
            }}
          >
            Descargar Estado de Cuentas
          </button>
        </div>
      </section>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Informe</th>
              <th>Módulo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {informes.map((inf, i) => (
              <tr key={inf.id} onClick={() => setSelected(inf)} style={{ cursor: 'pointer' }}>
                <td className="num">{i + 1}</td>
                <td>
                  <span className="row-person__name">{inf.titulo}</span>
                  <br />
                  <span className="table-subtle">{inf.descripcion}</span>
                </td>
                <td>
                  <span className="pill pill--info">{inf.modulo}</span>
                </td>
                <td>
                  <button className="icon-btn" title="Ver informe" onClick={(e) => { e.stopPropagation(); setSelected(inf) }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.titulo ?? ''}
        subtitle={selected ? selected.modulo : undefined}
        footer={
          selected && (
            <>
              <button className="btn btn-ghost" onClick={() => exportarCsv(selected)}>
                Exportar CSV
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                Imprimir / PDF
              </button>
            </>
          )
        }
      >
        {selected && (
          <div className="ficha">
            <p className="table-subtle">{selected.descripcion}</p>
            <div className="stat-grid stat-grid--compact">
              {selected.resumen.map((r) => (
                <div className="stat-tile" key={r.etiqueta}>
                  <span className="stat-tile__label">{r.etiqueta}</span>
                  <span className="stat-tile__value">{r.valor}</span>
                </div>
              ))}
            </div>
            <div className="table-card table-card--in-drawer">
              <table>
                <thead>
                  <tr>
                    {selected.columnas.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.filas.map((fila, i) => (
                    <tr key={i}>
                      {fila.map((v, j) => (
                        <td key={j}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Drawer>

      {selected && (
        <InformeImpreso
          className="screen-hidden"
          hermandad={hermandad}
          titulo={selected.titulo}
          generadoEl={generadoEl}
          resumen={selected.resumen}
          columnas={selected.columnas}
          filas={selected.filas}
        />
      )}

      {imprimiendoEstado && (
        <EstadoCuentas
          className="screen-hidden"
          hermandad={hermandad}
          anio={anioEstado}
          movimientos={movimientosEstado}
          saldoInicial={saldoInicialEstado}
          generadoEl={generadoEl}
        />
      )}
    </div>
  )
}
