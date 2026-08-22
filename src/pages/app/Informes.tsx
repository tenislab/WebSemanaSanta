import { useEffect, useMemo, useState } from 'react'
import Drawer from '../../components/Drawer'
import InformeImpreso from '../../components/InformeImpreso'
import EstadoCuentas from '../../components/EstadoCuentas'
import { useAuth } from '../../context/AuthContext'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { formatCurrency, formatDate } from '../../lib/format'
import { toCsv, descargarArchivo } from '../../lib/csv'
import { HERMANOS_INICIALES, type Hermano } from '../../data/hermanos'
import { CUOTAS_INICIALES, type Cuota } from '../../data/cuotas'
import { PAPELETAS_INICIALES, type Papeleta } from '../../data/papeletas'
import { MOVIMIENTOS_INICIALES, type Movimiento } from '../../data/movimientos'
import { ENSERES_INICIALES, type Enser } from '../../data/enseres'
import { useSupabaseTable } from '../../lib/supabaseSync'
import { hermanoToRow, rowToHermano } from '../../lib/db/hermanos'
import { cuotaToRow, rowToCuota } from '../../lib/db/cuotas'
import { papeletaToRow, rowToPapeleta } from '../../lib/db/papeletas'
import { movimientoToRow, rowToMovimiento } from '../../lib/db/movimientos'
import { enserToRow, rowToEnser } from '../../lib/db/enseres'
import { useTramos, etiquetaTramo, type Tramo } from '../../lib/tramos'
import { repartoCompleto } from '../../lib/cortejo'
import { CLAVES_DATOS, leerDatos } from '../../lib/persistencia'
import { getCampana } from '../../lib/campana'
import { getCamposPropios, valorLegible } from '../../lib/camposPropios'
import { filaQueAbre } from '../../lib/foco'
import { esMiembro } from '../../lib/hermanoFicha'

interface Informe {
  id: string
  titulo: string
  modulo: string
  descripcion: string
  resumen: { etiqueta: string; valor: string }[]
  columnas: string[]
  filas: (string | number)[][]
}

/**
 * Los informes, calculados sobre los datos QUE SE LE PASAN.
 *
 * Antes los leía él mismo del navegador con `leerDatos`. Y esta es la única
 * página de datos que no montaba `useSupabaseTable`, así que trabajaba con lo
 * que otra pantalla hubiera dejado espejado — o con nada.
 *
 * El destrozo concreto: el ESTADO DE CUENTAS, que es el documento que se lleva
 * al cabildo general y se entrega en la diócesis, se imprimía con las cuatro
 * partidas de ingresos y las doce de gastos a 0,00 €. Total ingresos 0,00,
 * total gastos 0,00, saldo a 31 de diciembre 0,00. Sin un aviso. Y como el
 * total cuadra consigo mismo, nada delata el error hasta que alguien compara
 * con el extracto del banco.
 *
 * La variante silenciosa era aún más probable: imprimir con la foto de hace un
 * mes, sin los movimientos posteriores.
 */
function construirInformes(
  tramos: Tramo[],
  hermanosActuales: Hermano[],
  cuotasActuales: Cuota[],
  papeletasTodas: Papeleta[],
  movimientosActuales: Movimiento[],
  enseresActuales: Enser[],
): Informe[] {
  const anioCampana = getCampana().anio
  const papeletasActuales = papeletasTodas.filter((p) => p.anio === anioCampana)

  const camposPropios = getCamposPropios().filter((c) => c.nombre.trim())
  const hermanoDe = (id: string) => hermanosActuales.find((h) => h.id === id)

  // «Nuevo» también es miembro: ver esMiembro(). Este número se imprime.
  const activos = hermanosActuales.filter(esMiembro).length
  const nuevos = hermanosActuales.filter((h) => h.estado === 'Nuevo').length
  const bajas = hermanosActuales.filter((h) => h.estado === 'Baja').length
  /* Los civiles no cuentan ni arriba ni abajo: no se les emite cuota, así que
     contarlos como «no al día» bajaría el número del documento que se lleva al
     cabildo por una deuda que no existe. */
  const alDia = hermanosActuales.filter((h) => !h.civil && h.cuotaAlDia).length
  const sinIban = hermanosActuales.filter((h) => !h.iban).length

  const cobrado = cuotasActuales.filter((c) => c.estado === 'Pagada').reduce((s, c) => s + c.importe, 0)
  const pendiente = cuotasActuales.filter((c) => c.estado === 'Pendiente').reduce((s, c) => s + c.importe, 0)
  const devuelto = cuotasActuales.filter((c) => c.estado === 'Devuelta').reduce((s, c) => s + c.importe, 0)
  /**
   * «En mora» es dinero que se debe, y no salía en ninguna cifra.
   *
   * El informe de recaudación enseñaba Cobrado, Pendiente y Devuelto. Un
   * recibo que la tesorería pasa a «En mora» dejaba de estar en «Pendiente» y
   * no entraba en ningún otro sitio: desaparecía de las cuentas. La deuda que
   * se lleva al cabildo salía más baja de lo que era, justo en los recibos que
   * más preocupan.
   */
  const enMora = cuotasActuales.filter((c) => c.estado === 'En mora').reduce((s, c) => s + c.importe, 0)
  const porCobrar = pendiente + enMora
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
      // Los campos propios de la hermandad se listan también: si se molestan en
      // apuntar la talla de túnica, el padrón tiene que poder sacarla.
      columnas: ['Nº', 'Nombre', 'Estado', 'Antigüedad', 'Email', 'Teléfono', 'Cuota al día', ...camposPropios.map((c) => c.nombre)],
      filas: hermanosActuales.map((h) => [
        // Los de baja tienen numero 0, no un número real: en papel eso se lee
        // como «el hermano cero». Se pinta igual que en el resto de la app.
        h.numero > 0 ? h.numero : '—', h.nombre, h.estado, h.antiguedad, h.email, h.telefono,
        h.civil ? '—' : h.cuotaAlDia ? 'Sí' : 'No',
        ...camposPropios.map((c) => valorLegible(c, h.campos?.[c.id])),
      ]),
    },
    {
      id: 'cuotas',
      titulo: 'Recaudación de cuotas',
      modulo: 'Cuotas',
      descripcion: 'Recibos emitidos, cobrados, pendientes, en mora y devueltos.',
      resumen: [
        { etiqueta: 'Cobrado', valor: formatCurrency(cobrado) },
        { etiqueta: 'Pendiente', valor: formatCurrency(pendiente) },
        { etiqueta: 'En mora', valor: formatCurrency(enMora) },
        { etiqueta: 'Total por cobrar', valor: formatCurrency(porCobrar) },
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

  const tramos = useTramos()
  // Las mismas tablas que usan Hermanos, Cuotas, Papeletas y Tesorería. Sin
  // esto, esta pantalla imprimía documentos contables sobre una foto vieja del
  // navegador, o sobre nada.
  const [hermanos] = useSupabaseTable<Hermano>('hermanos', CLAVES_DATOS.hermanos, HERMANOS_INICIALES, hermanoToRow, rowToHermano, 'numero')
  const [cuotas] = useSupabaseTable<Cuota>('cuotas', CLAVES_DATOS.cuotas, CUOTAS_INICIALES, cuotaToRow, rowToCuota)
  const [papeletas] = useSupabaseTable<Papeleta>('papeletas', CLAVES_DATOS.papeletas, PAPELETAS_INICIALES, papeletaToRow, rowToPapeleta)
  const [movimientos] = useSupabaseTable<Movimiento>('movimientos', CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES, movimientoToRow, rowToMovimiento)
  const [enseres] = useSupabaseTable<Enser>('enseres', CLAVES_DATOS.enseres, ENSERES_INICIALES, enserToRow, rowToEnser)
  const informes = useMemo(
    () => construirInformes(tramos, hermanos, cuotas, papeletas, movimientos, enseres),
    [tramos, hermanos, cuotas, papeletas, movimientos, enseres],
  )
  const [selected, setSelected] = useState<Informe | null>(null)

  const generadoEl = useMemo(() => formatDate(new Date()), [])

  const movimientosEstado = movimientos
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
    /*
     * Se recoge con `afterprint`, no en la línea de abajo.
     *
     * `window.print()` NO promete devolver el control cuando el papel ya ha
     * salido: en Chrome espera a que se cierre el diálogo, pero en otros
     * navegadores vuelve enseguida y deja la impresión en marcha por detrás.
     * Quitando el documento en la línea siguiente, ahí se estaba tirando el
     * Estado de Cuentas MIENTRAS se imprimía, y lo que salía era un folio en
     * blanco. El estado de cuentas del ejercicio es el papel que se lleva al
     * cabildo de cuentas.
     *
     * `afterprint` dispara cuando la impresión ha terminado de verdad, se
     * haya aceptado o cancelado. Y por si un navegador viejo no lo lanza, hay
     * una red de seguridad a los diez segundos.
     */
    let recogido = false
    const recoger = () => {
      if (recogido) return
      recogido = true
      setImprimiendoEstado(false)
    }
    window.addEventListener('afterprint', recoger, { once: true })
    const red = window.setTimeout(recoger, 10000)
    window.print()
    return () => {
      window.removeEventListener('afterprint', recoger)
      window.clearTimeout(red)
    }
  }, [imprimiendoEstado])

  const kpis = useMemo(() => {
    const hermanos = leerDatos(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
    const cuotas = leerDatos(CLAVES_DATOS.cuotas, CUOTAS_INICIALES)
    const anio = getCampana().anio
    const papeletas = leerDatos(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES).filter((p) => p.anio === anio)
    const movimientos = leerDatos(CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES)
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
          <select
            value={anioEstado}
            onChange={(e) => setAnioEstado(Number(e.target.value))}
            aria-label="Ejercicio"
            style={{ maxWidth: '9rem' }}
          >
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
              <tr key={inf.id} {...filaQueAbre(() => setSelected(inf))}>
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
