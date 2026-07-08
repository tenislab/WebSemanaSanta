import { useMemo, useState } from 'react'
import Drawer from '../../components/Drawer'
import InformeImpreso from '../../components/InformeImpreso'
import { useAuth } from '../../context/AuthContext'
import { getHermandadSettings } from '../../lib/hermandadSettings'
import { formatCurrency, formatDate } from '../../lib/format'
import { toCsv, descargarArchivo } from '../../lib/csv'
import { HERMANOS_INICIALES } from '../../data/hermanos'
import { CUOTAS_INICIALES } from '../../data/cuotas'
import { PAPELETAS_INICIALES } from '../../data/papeletas'
import { MOVIMIENTOS_INICIALES } from '../../data/movimientos'
import { ENSERES_INICIALES } from '../../data/enseres'
import { getTramos, etiquetaTramo } from '../../lib/tramos'
import { repartoDeTramo } from '../../lib/cortejo'

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
  const hermanoDe = (id: string) => HERMANOS_INICIALES.find((h) => h.id === id)
  const tramos = getTramos()

  const activos = HERMANOS_INICIALES.filter((h) => h.estado === 'Activo').length
  const nuevos = HERMANOS_INICIALES.filter((h) => h.estado === 'Nuevo').length
  const bajas = HERMANOS_INICIALES.filter((h) => h.estado === 'Baja').length
  const alDia = HERMANOS_INICIALES.filter((h) => h.cuotaAlDia).length
  const sinIban = HERMANOS_INICIALES.filter((h) => !h.iban).length

  const cobrado = CUOTAS_INICIALES.filter((c) => c.estado === 'Pagada').reduce((s, c) => s + c.importe, 0)
  const pendiente = CUOTAS_INICIALES.filter((c) => c.estado === 'Pendiente').reduce((s, c) => s + c.importe, 0)
  const devuelto = CUOTAS_INICIALES.filter((c) => c.estado === 'Devuelta').reduce((s, c) => s + c.importe, 0)
  const domiciliadas = CUOTAS_INICIALES.filter((c) => c.domiciliada).length

  const recaudadoPapeletas = PAPELETAS_INICIALES.filter((p) => p.estado !== 'Anulada').reduce((s, p) => s + p.importe, 0)
  const entregadas = PAPELETAS_INICIALES.filter((p) => p.estado === 'Entregada').length
  const pendientesPapeleta = PAPELETAS_INICIALES.filter((p) => p.estado === 'Solicitada' || p.estado === 'Asignada').length

  const filasCortejo = tramos.map((t) => {
    const reparto = repartoDeTramo(t, PAPELETAS_INICIALES, hermanoDe, new Set())
    const ocupados = reparto.filter((a) => a.estado !== 'Excede aforo').length
    const excedidos = reparto.filter((a) => a.estado === 'Excede aforo').length
    return { tramo: t, ocupados, excedidos }
  })
  const excedenAforoTotal = filasCortejo.reduce((s, f) => s + f.excedidos, 0)
  const aforoTotal = tramos.reduce((s, t) => s + t.capacidad, 0)
  const ocupadosTotal = filasCortejo.reduce((s, f) => s + f.ocupados, 0)

  const ingresos = MOVIMIENTOS_INICIALES.filter((m) => m.tipo === 'Ingreso').reduce((s, m) => s + m.importe, 0)
  const gastos = MOVIMIENTOS_INICIALES.filter((m) => m.tipo === 'Gasto').reduce((s, m) => s + m.importe, 0)
  const balanceConciliado = MOVIMIENTOS_INICIALES.filter((m) => m.estado === 'Conciliado').reduce(
    (s, m) => s + (m.tipo === 'Ingreso' ? m.importe : -m.importe),
    0,
  )
  const porConciliar = MOVIMIENTOS_INICIALES.filter((m) => m.estado === 'Pendiente').length

  const valorAsegurado = ENSERES_INICIALES.filter((e) => e.valorAsegurado !== null).reduce(
    (s, e) => s + (e.valorAsegurado ?? 0),
    0,
  )
  const enPrestamo = ENSERES_INICIALES.filter((e) => e.prestadoA !== null).length
  const necesitaRestauracion = ENSERES_INICIALES.filter((e) => e.estadoConservacion === 'Necesita restauración').length

  return [
    {
      id: 'padron',
      titulo: 'Padrón de hermanos',
      modulo: 'Hermanos',
      descripcion: 'Censo completo con estado, antigüedad y contacto.',
      resumen: [
        { etiqueta: 'Total', valor: String(HERMANOS_INICIALES.length) },
        { etiqueta: 'Activos', valor: String(activos) },
        { etiqueta: 'Nuevos', valor: String(nuevos) },
        { etiqueta: 'Bajas', valor: String(bajas) },
        { etiqueta: 'Con cuota al día', valor: String(alDia) },
        { etiqueta: 'Sin IBAN', valor: String(sinIban) },
      ],
      columnas: ['Nº', 'Nombre', 'Estado', 'Antigüedad', 'Email', 'Teléfono', 'Cuota al día'],
      filas: HERMANOS_INICIALES.map((h) => [
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
        { etiqueta: 'Domiciliadas', valor: `${domiciliadas} de ${CUOTAS_INICIALES.length}` },
      ],
      columnas: ['Nº recibo', 'Hermano', 'Concepto', 'Importe', 'Estado', 'Emisión', 'Cobro'],
      filas: CUOTAS_INICIALES.map((c) => [
        c.numero, hermanoDe(c.hermanoId)?.nombre ?? '—', c.concepto, formatCurrency(c.importe), c.estado, c.fechaEmision, c.fechaCobro,
      ]),
    },
    {
      id: 'papeletas',
      titulo: 'Papeletas de sitio',
      modulo: 'Papeletas',
      descripcion: 'Papeletas emitidas por tramo, con su importe y estado.',
      resumen: [
        { etiqueta: 'Emitidas', valor: String(PAPELETAS_INICIALES.length) },
        { etiqueta: 'Recaudado', valor: formatCurrency(recaudadoPapeletas) },
        { etiqueta: 'Entregadas', valor: String(entregadas) },
        { etiqueta: 'Pendientes', valor: String(pendientesPapeleta) },
      ],
      columnas: ['Nº', 'Hermano', 'Tramo', 'Importe', 'Estado', 'Solicitud'],
      filas: PAPELETAS_INICIALES.map((p) => {
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
      filas: MOVIMIENTOS_INICIALES.map((m) => [
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
        { etiqueta: 'Total enseres', valor: String(ENSERES_INICIALES.length) },
        { etiqueta: 'Valor asegurado', valor: formatCurrency(valorAsegurado) },
        { etiqueta: 'En préstamo', valor: String(enPrestamo) },
        { etiqueta: 'Necesitan restauración', valor: String(necesitaRestauracion) },
      ],
      columnas: ['Nº', 'Nombre', 'Categoría', 'Ubicación', 'Conservación', 'Valor asegurado', 'Prestado a'],
      filas: ENSERES_INICIALES.map((e) => [
        e.numero, e.nombre, e.categoria, e.ubicacion, e.estadoConservacion,
        e.valorAsegurado !== null ? formatCurrency(e.valorAsegurado) : 'Sin asegurar', e.prestadoA ?? '—',
      ]),
    },
  ]
}

export default function Informes() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const hermandad = useMemo(() => getHermandadSettings(fallbackNombre), [fallbackNombre])

  const informes = useMemo(() => construirInformes(), [])
  const [selected, setSelected] = useState<Informe | null>(null)

  const generadoEl = useMemo(() => formatDate(new Date()), [])

  const kpis = useMemo(() => {
    const totalHermanos = HERMANOS_INICIALES.length
    const cobrado = CUOTAS_INICIALES.filter((c) => c.estado === 'Pagada').reduce((s, c) => s + c.importe, 0)
    const papeletasEmitidas = PAPELETAS_INICIALES.filter((p) => p.estado !== 'Anulada').length
    const balance = MOVIMIENTOS_INICIALES.filter((m) => m.estado === 'Conciliado').reduce(
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
            {informes.length} informes · calculados a partir de los datos de ejemplo mientras conectamos la base de datos.
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
    </div>
  )
}
