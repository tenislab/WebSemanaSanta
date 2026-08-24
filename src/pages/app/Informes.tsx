import { useEffect, useMemo, useState } from 'react'
import Drawer from '../../components/Drawer'
import InformeImpreso from '../../components/InformeImpreso'
import EstadoCuentas from '../../components/EstadoCuentas'
import { useAuth } from '../../context/AuthContext'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { sumaEuros, formatCurrency, formatDate } from '../../lib/format'
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
import { etiquetaDeSituacion, situacionDeTodos } from '../../lib/estadoCuotaHermano'
import { ejercicioDeCuotas } from '../../lib/cuotasEmision'
import { repartoCompleto } from '../../lib/cortejo'
import { CLAVES_DATOS } from '../../lib/persistencia'
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
  /*
   * QUIÉN ESTÁ AL DÍA, SACADO DE SUS RECIBOS.
   *
   * Antes salía de `h.cuotaAlDia`, un booleano guardado en la ficha que nadie
   * actualizaba nunca al cobrar: se ponía en falso al dar de alta y ahí se
   * quedaba. Así que el padrón que se lleva al cabildo decía que no estaba al
   * día NADIE, con la caja llena.
   *
   * Los civiles siguen sin contar ni arriba ni abajo —su situación es
   * `noAplica`—: no se les emite cuota, así que contarlos como morosos bajaría
   * el número del documento por una deuda que no existe.
   */
  // Sin `useMemo`: esto NO es un componente, es la función que arma los
  // informes con los datos que se le pasan. Un hook aquí dentro se saltaría el
  // orden de llamada de React.
  const situacionesDeCuota = new Map(
    situacionDeTodos(cuotasActuales, hermanosActuales, ejercicioDeCuotas(cuotasActuales))
      .map((x) => [x.hermano.id, x.situacion]),
  )
  const alDia = hermanosActuales.filter((h) => situacionesDeCuota.get(h.id) === 'alDia').length
  const sinIban = hermanosActuales.filter((h) => !h.iban).length

  /*
   * CON `sumaEuros`, Y NO CON UN `reduce` A PELO.
   *
   * Estas cuatro cifras son las que se imprimen y se llevan al cabildo, y eran
   * las únicas del fichero que sumaban a pelo: las de papeletas y las del
   * libro de cuentas ya iban por aquí.
   *
   * Lo que se lleva por delante un `reduce` a pelo es UN SOLO importe malo.
   * Basta con que uno venga vacío para que la suma entera sea NaN y el informe
   * diga «NaN €» en Cobrado; y si viene como TEXTO —que pasa: Postgres
   * devuelve las columnas `numeric` como cadena, y una copia guardada en el
   * navegador por una versión anterior puede traerla así— el `+` concatena y
   * salen «12060,1060 €». Un dato malo entre seiscientos buenos no puede
   * borrar los seiscientos.
   */
  const cobrado = sumaEuros(cuotasActuales.filter((c) => c.estado === 'Pagada').map((c) => c.importe))
  const pendiente = sumaEuros(cuotasActuales.filter((c) => c.estado === 'Pendiente').map((c) => c.importe))
  const devuelto = sumaEuros(cuotasActuales.filter((c) => c.estado === 'Devuelta').map((c) => c.importe))
  /**
   * «En mora» es dinero que se debe, y no salía en ninguna cifra.
   *
   * El informe de recaudación enseñaba Cobrado, Pendiente y Devuelto. Un
   * recibo que la tesorería pasa a «En mora» dejaba de estar en «Pendiente» y
   * no entraba en ningún otro sitio: desaparecía de las cuentas. La deuda que
   * se lleva al cabildo salía más baja de lo que era, justo en los recibos que
   * más preocupan.
   */
  const enMora = sumaEuros(cuotasActuales.filter((c) => c.estado === 'En mora').map((c) => c.importe))
  const porCobrar = sumaEuros([pendiente, enMora])
  const domiciliadas = cuotasActuales.filter((c) => c.domiciliada).length

  const recaudadoPapeletas = sumaEuros(papeletasActuales.filter((p) => p.estado !== 'Anulada').map((p) => p.importe))
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

  const ingresos = sumaEuros(movimientosActuales.filter((m) => m.tipo === 'Ingreso').map((m) => m.importe))
  const gastos = sumaEuros(movimientosActuales.filter((m) => m.tipo === 'Gasto').map((m) => m.importe))
  const balanceConciliado = sumaEuros(
    movimientosActuales
      .filter((m) => m.estado === 'Conciliado')
      .map((m) => (m.tipo === 'Ingreso' ? Number(m.importe) : -Number(m.importe))),
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
      // «Cuota» y no «Cuota al día»: ya no es un sí/no. Un «No» no distinguía
      // al que debe del que no tiene ningún recibo emitido, y en el padrón del
      // cabildo esas dos cosas se arreglan de manera muy distinta.
      columnas: ['Nº', 'Nombre', 'Estado', 'Antigüedad', 'Email', 'Teléfono', 'Cuota', ...camposPropios.map((c) => c.nombre)],
      filas: hermanosActuales.map((h) => [
        // Los de baja tienen numero 0, no un número real: en papel eso se lee
        // como «el hermano cero». Se pinta igual que en el resto de la app.
        h.numero > 0 ? h.numero : '—', h.nombre, h.estado, h.antiguedad, h.email, h.telefono,
        etiquetaDeSituacion(situacionesDeCuota.get(h.id) ?? 'sinEmitir').texto,
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
      sumaEuros(movimientosEstado
        .filter((m) => Number(m.fecha.trim().slice(-4)) < anioEstado)
        // Igual que el resto: por `sumaEuros`, para que un apunte con el
        // importe vacío no deje el saldo de arrastre en «NaN €».
        .map((m) => (m.tipo === 'Ingreso' ? Number(m.importe) : -Number(m.importe)))),
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

  /**
   * LOS CUATRO NÚMEROS DE ARRIBA SALEN DE LO MISMO QUE LOS INFORMES DE ABAJO.
   *
   * No era así, y en la misma pantalla se contradecían. Los informes ya venían
   * de la base —`useSupabaseTable`, ahí arriba—, pero estos cuatro recuadros
   * seguían leyéndose del navegador con `leerDatos`, que es lo que esta página
   * dejó de hacer hace tiempo (está contado en la cabecera del archivo). Dos
   * fuentes distintas para la misma pregunta.
   *
   * Lo que se veía, con la tesorería en la base diciendo 12.000 €:
   *
   *   · En un navegador recién estrenado —otro ordenador, o después de borrar
   *     los datos— `leerDatos` devuelve VACÍO cuando hay base de datos
   *     conectada (a propósito: ver `lib/persistencia.ts`). Así que el
   *     Balance salía 0 € y el censo 0 hermanos, con los informes de debajo
   *     enseñando las cifras de verdad.
   *   · Y en el ordenador de siempre salía la copia que ese navegador dejó la
   *     última vez, que es de la última visita, no de ahora.
   *
   * Y ENCIMA NO SE ACTUALIZABA NUNCA: la lista de dependencias estaba vacía,
   * así que esto se calculaba una vez al abrir la pantalla y se quedaba
   * congelado aunque los datos de la base llegaran un segundo después —que es
   * lo normal, porque llegan por la red—. Los informes de abajo sí se
   * recalculaban. De ahí que una misma pantalla dijera dos cosas.
   */
  const kpis = useMemo(() => {
    const anio = getCampana().anio
    const totalHermanos = hermanos.length
    const cobrado = sumaEuros(cuotas.filter((c) => c.estado === 'Pagada').map((c) => c.importe))
    const papeletasEmitidas = papeletas
      .filter((p) => p.anio === anio && p.estado !== 'Anulada' && p.estado !== 'Renuncia').length
    const balance = movimientos.filter((m) => m.estado === 'Conciliado').reduce(
      (s, m) => s + (m.tipo === 'Ingreso' ? m.importe : -m.importe),
      0,
    )
    return { totalHermanos, cobrado, papeletasEmitidas, balance }
  }, [hermanos, cuotas, papeletas, movimientos])

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
            {/* Decía «los datos guardados en este navegador», que era de cuando
                esta pantalla leía del navegador. Trabaja contra la base de la
                hermandad desde hace tiempo, y dejarlo escrito así hacía dudar
                de si lo que se está mirando es lo de todos o lo de este
                ordenador — que es justo la duda que no puede tener quien
                presenta unas cuentas. */}
            {informes.length} informes · calculados en vivo con los datos de la hermandad.
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
