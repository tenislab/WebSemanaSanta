import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { prepararAvisos } from '../../lib/avisosCorreo'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import MenuAcciones from '../../components/MenuAcciones'
import Recibo from '../../components/Recibo'
import ReciboModeloRender from '../../components/ReciboModeloRender'
import ModeloPapeletaEditor from '../../components/ModeloPapeletaEditor'
import HermanoPicker from '../../components/HermanoPicker'
import { useCargoDeLaSesion } from '../../lib/permisos'
import { hermanosAsignables } from '../../lib/asignables'
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
  esAvisado,
  metodoDeCuota,
  metodoEnFrase,
  type ConceptoCuota,
  type Cuota,
  type EstadoCuota,
  type MetodoCobro,
} from '../../data/cuotas'
import { useConceptosCuota } from '../../lib/conceptosCuota'
import { useAuth } from '../../context/AuthContext'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { formatCurrency, formatDate } from '../../lib/format'
import { hayDatosDeEjemplo } from '../../lib/demo'
import { agregarAvisoHermano } from '../../lib/avisosHermano'
import { avisarPorCorreo } from '../../lib/avisosCorreo'
import { conApunteDeCobro, origenDeCuota, sinApunteDeCobro } from '../../lib/apuntes'
import { apuntar } from '../../lib/registroActividad'
import { MOVIMIENTOS_INICIALES, type Movimiento } from '../../data/movimientos'
import { movimientoToRow, rowToMovimiento } from '../../lib/db/movimientos'
import { CLAVES_DATOS, leerDatos } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { cuotaToRow, rowToCuota } from '../../lib/db/cuotas'
import { descargarArchivo, toCsv } from '../../lib/csv'
import { buildSepaXml, acreedorIncompleto } from '../../lib/sepa'
import { useAjustesCuotas } from '../../lib/ajustesCuotas'
import { getCampana } from '../../lib/campana'
import {
  emitirCuotasAnuales,
  hermanosSinCuota,
  ultimoEjercicio,
  simularCobroRemesa,
  parseFechaEs,
  ejercicioDe,
} from '../../lib/cuotasEmision'

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Fecha por defecto del primer cobro: hoy + 15 días (margen de aviso típico de una domiciliación SEPA). */
function fechaCobroPorDefecto() {
  const d = new Date()
  d.setDate(d.getDate() + 15)
  return isoLocal(d)
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
  return isoLocal(d)
}

/** Fecha en ISO pero con la hora LOCAL: con toISOString, en España (UTC+1/+2)
 *  la medianoche local es el día anterior en UTC y toda fecha salía un día antes. */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Cuotas() {
  // Antes de mandar nada, traer de la base la configuración de correo de
  // la hermandad y lo que cada hermano tenga apagado. Sin esto, quien
  // entra desde otro ordenador trabaja con la de fábrica: no sale ningún
  // aviso, o se le escribe a quien pidió que no. Los dos en silencio.
  useEffect(() => {
    void prepararAvisos()
  }, [])

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
  // «Avisados» no es un estado del recibo: es el hermano que ha dicho desde su
  // área que ya ha pagado por Bizum o transferencia y espera confirmación.
  const [filter, setFilter] = useState<'Todas' | 'Avisados' | EstadoCuota>('Todas')
  const [selected, setSelected] = useState<Cuota | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [hermanoNuevaCuota, setHermanoNuevaCuota] = useState<Hermano | null>(null)
  const [metodoNuevaCuota, setMetodoNuevaCuota] = useState<MetodoCobro>('Domiciliación')
  const [periodicidadNueva, setPeriodicidadNueva] = useState<'puntual' | 'mensual'>('puntual')

  // La mora solo la ponen/quitan el tesorero, el secretario o el titular
  // (quien no tiene cargo asignado es el titular, con acceso completo).
  // Contra la lista real de personal, no contra el metadata (reescribible).
  const cargo = useCargoDeLaSesion() as string | null
  const puedeMora = !cargo || cargo === 'Tesorero/a' || cargo === 'Secretario/a'
  const [remesaOpen, setRemesaOpen] = useState(false)
  const [fechaRemesa, setFechaRemesa] = useState('')
  const [modeloOpen, setModeloOpen] = useState(false)
  const [modeloRecibo, setModeloRecibo] = useState<ModeloPapeleta | null>(() => getModeloRecibo())
  const [ajustesOpen, setAjustesOpen] = useState(false)
  const [ajustes, setAjustes] = useAjustesCuotas()

  const hermanos = useMemo(() => leerDatos(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  // El libro de cuentas. Cobrar un recibo tiene que dejar su apunte aquí: sin
  // esto, el dinero entraba en la hermandad y Tesorería no se enteraba.
  const [, setMovimientos] = useSupabaseTable<Movimiento>(
    'movimientos', CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES, movimientoToRow, rowToMovimiento,
  )
  const conceptosCuota = useConceptosCuota()

  // --- Salto de año (emisión anual del ejercicio) ---
  // El ejercicio en curso sigue al año de la campaña, para que toda la app hable
  // del mismo año. El concepto «anual» es el primero del catálogo (normalmente
  // «Cuota anual»); es el que se emite a todo el censo cada ejercicio.
  const conceptoAnual = conceptosCuota[0]
  /**
   * ¿Ha llegado el catálogo de cuotas de ESTA hermandad?
   *
   * Antes daba igual: si no había nada se caía en el de ejemplo («Cuota anual»,
   * 60 €) y la pantalla seguía como si tal cosa. Como ningún recibo de la
   * hermandad se llama «Cuota anual», salía el aviso «hay N hermanos sin la
   * cuota anual de este año, emítela a todo el censo de una vez» con N = censo
   * entero. Quien le hacía caso emitía recibos duplicados a todo el mundo, a 60
   * € en vez de a los 45 € suyos. Si además se domiciliaban, el banco cargaba
   * 60 € a cada hermano que ya había pagado.
   *
   * Mientras no haya catálogo no se puede decir nada de lo que falta: lo
   * honesto es no ofrecer la emisión y decir por qué.
   */
  const catalogoListo = conceptosCuota.length > 0
  const ejercicioEnCurso = useMemo(() => getCampana().anio, [])
  const ultimoEmitido = useMemo(() => ultimoEjercicio(cuotas), [cuotas])
  const [emisionOpen, setEmisionOpen] = useState(false)
  const [ejercicioEmision, setEjercicioEmision] = useState(ejercicioEnCurso)
  const [conceptoEmision, setConceptoEmision] = useState('')
  // El catálogo llega después del primer pintado. Si el concepto se fijara solo
  // al montar, se quedaría con el valor de entonces —vacío, o el de ejemplo— y
  // la emisión se haría con un nombre que no es de la hermandad.
  useEffect(() => {
    if (!conceptoEmision && conceptoAnual) setConceptoEmision(conceptoAnual.nombre)
  }, [conceptoAnual, conceptoEmision])
  const [metodoEmision, setMetodoEmision] = useState<MetodoCobro>('Domiciliación')
  // Un año a medio teclear («2», «202») emitiría cuotas de un ejercicio absurdo.
  const ejercicioValido = ejercicioEmision >= 2000 && ejercicioEmision <= 2100

  const pendientesDeEmitir = useMemo(
    () => hermanosSinCuota(cuotas, hermanos, ejercicioEmision, conceptoEmision),
    [cuotas, hermanos, ejercicioEmision, conceptoEmision],
  )
  const importeConceptoEmision = useMemo(
    () => conceptosCuota.find((c) => c.nombre === conceptoEmision)?.importe ?? conceptoAnual?.importe ?? 0,
    [conceptosCuota, conceptoEmision, conceptoAnual],
  )
  // ¿Toca un ejercicio nuevo? Hay hermanos activos sin la cuota anual del año en curso.
  const hayNuevoEjercicio =
    catalogoListo &&
    (ultimoEmitido == null || ultimoEmitido < ejercicioEnCurso) &&
    hermanosSinCuota(cuotas, hermanos, ejercicioEnCurso, conceptoAnual!.nombre).length > 0
  const hermanoDe = useMemo(() => {
    const map = new Map(hermanos.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [hermanos])

  // Recibos que el hermano dice tener pagados y a la tesorería aún le constan
  // sin cobrar: son los que hay que confirmar contra el extracto del banco.
  const avisados = useMemo(() => cuotas.filter(esAvisado), [cuotas])

  const filtered = useMemo(() => {
    return cuotas
      .filter((c) =>
        filter === 'Todas'
          ? true
          : filter === 'Avisados'
            ? esAvisado(c)
            : c.estado === filter,
      )
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
    // Los indicadores hablan del EJERCICIO EN CURSO (antes mezclaban todos los
    // años, así que el «% al día» no significaba nada al pasar de ejercicio).
    const base = cuotas.filter((c) => ejercicioDe(c) === ejercicioEnCurso)
    const total = base.length
    const cobrado = base.filter((c) => c.estado === 'Pagada').reduce((s, c) => s + c.importe, 0)
    // Deuda viva: pendientes, devueltas y en mora de CUALQUIER ejercicio (la de
    // años anteriores sigue debiéndose, no puede desaparecer del indicador).
    const pendiente = cuotas
      .filter((c) => c.estado === 'Pendiente' || c.estado === 'Devuelta' || c.estado === 'En mora')
      .reduce((s, c) => s + c.importe, 0)
    const pagadas = base.filter((c) => c.estado === 'Pagada').length
    const alDia = total ? Math.round((pagadas / total) * 100) : 0
    return { total, cobrado, pendiente, alDia }
  }, [cuotas, ejercicioEnCurso])

  function marcarPagada(id: string) {
    setCuotas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, estado: 'Pagada', fechaPago: hoy(), pagoComunicado: null } : c)),
    )
    setSelected((prev) =>
      prev && prev.id === id ? { ...prev, estado: 'Pagada', fechaPago: hoy(), pagoComunicado: null } : prev,
    )
    // Al hermano le llega a su buzón: se ahorra la llamada de «¿os ha
    // entrado ya mi cuota?», que es la más repetida de secretaría.
    const c = cuotas.find((x) => x.id === id)
    if (c) {
      // Al libro de cuentas. Nace Pendiente, no conciliado: que conste el
      // cobro no significa que se haya visto en el extracto del banco, y
      // conciliar es justamente comprobar eso.
      setMovimientos((prev) =>
        conApunteDeCobro(prev, {
          origen: origenDeCuota(c.id),
          concepto: `${c.concepto} — ${hermanos.find((h) => h.id === c.hermanoId)?.nombre ?? 'hermano/a'}`,
          categoria: 'Cuotas Hermanos/as',
          importe: c.importe,
          fecha: hoy(),
          metodo: c.metodoCobro,
        }),
      )
      const texto = `Tu recibo de ${c.concepto} (${formatCurrency(c.importe)}) queda pagado. Gracias.`
      agregarAvisoHermano(c.hermanoId, texto, 'cuota', 'Cuota pagada')
      // Y por correo, si la hermandad lo tiene conectado y este hermano no lo
      // ha apagado. Va después de guardar: si el correo falla, se entera igual
      // la próxima vez que entre en su área.
      const h = hermanos.find((x) => x.id === c.hermanoId)
      if (h) {
        avisarPorCorreo(
          [{ id: h.id, nombre: h.nombre, email: h.email }],
          'cuota',
          'Cuota pagada',
          [texto],
          'Este aviso lo puedes apagar desde tu área de hermano.',
        )
      }
    }
  }

  const miCorreo = (user?.email ?? '').toLowerCase()
  const miNombre = (user?.user_metadata?.nombre as string | undefined) ?? user?.email ?? 'Un cargo'

  function aplicarCuota(id: string, cambios: Partial<Cuota>) {
    setCuotas((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...cambios } : prev))
    // Si el recibo deja de estar pagado —se devuelve, o se corrige un error—
    // su apunte se retira del libro. Si no, el ingreso se quedaría contado
    // para siempre y el saldo diría que hay un dinero que no está.
    if (cambios.estado && cambios.estado !== 'Pagada') {
      setMovimientos((prev) => sinApunteDeCobro(prev, origenDeCuota(id)))
      // Un recibo que deja de estar pagado mueve dinero en el libro: queda
      // apuntado quién lo hizo.
      const c = cuotas.find((x) => x.id === id)
      if (c && c.estado === 'Pagada') {
        apuntar({
          autorNombre: miNombre, accion: 'cuota_devuelta', sobreTipo: 'cuota',
          sobreId: id, sobreNombre: hermanos.find((h) => h.id === c.hermanoId)?.nombre ?? '',
          detalle: `Marcó como «${cambios.estado}» el recibo de ${c.concepto} de ${hermanos.find((h) => h.id === c.hermanoId)?.nombre ?? 'un hermano'}`,
        })
      }
    }
  }

  /**
   * Poner en mora a mano. Si la hermandad exige dos cargos, el primero la
   * PROPONE y otro distinto la CONFIRMA; si no, se pone directa. Nunca es
   * automática al vencer la fecha.
   */
  function ponerEnMora(c: Cuota) {
    if (!ajustes.moraRequiereDosCargos) {
      aplicarCuota(c.id, { estado: 'En mora', moraPropuestaPor: undefined, moraPropuestaNombre: undefined })
      return
    }
    if (!c.moraPropuestaPor) {
      aplicarCuota(c.id, { moraPropuestaPor: miCorreo, moraPropuestaNombre: miNombre })
      return
    }
    if (c.moraPropuestaPor === miCorreo) {
      window.alert('Ya has propuesto tú la mora. La debe confirmar otro cargo (tesorero o secretario).')
      return
    }
    // Un segundo cargo distinto confirma:
    aplicarCuota(c.id, { estado: 'En mora', moraPropuestaPor: undefined, moraPropuestaNombre: undefined })
  }

  function quitarMora(id: string) {
    aplicarCuota(id, { estado: 'Pendiente', moraPropuestaPor: undefined, moraPropuestaNombre: undefined })
  }

  function cancelarPropuestaMora(id: string) {
    aplicarCuota(id, { moraPropuestaPor: undefined, moraPropuestaNombre: undefined })
  }

  function abrirEmision() {
    setEjercicioEmision(ejercicioEnCurso)
    setConceptoEmision(conceptoAnual?.nombre ?? 'Cuota anual')
    setMetodoEmision('Domiciliación')
    setEmisionOpen(true)
  }

  /** Emite la cuota anual del ejercicio a todos los hermanos que aún no la tienen. */
  function confirmarEmision() {
    if (!ejercicioValido) return
    // Se calcula DENTRO del updater, sobre la lista más reciente: si se emitiera
    // sobre la copia del render (p. ej. antes de que termine de cargar la tabla)
    // se numeraría desde 1 y se duplicarían recibos ya existentes.
    setCuotas((prev) => {
      const nuevas = emitirCuotasAnuales({
        cuotas: prev,
        hermanos,
        ejercicio: ejercicioEmision,
        concepto: conceptoEmision,
        importe: importeConceptoEmision,
        fechaCobro: formatearFechaInput(fechaCobroPorDefecto()),
        fechaEmision: hoy(),
        metodoPorDefecto: metodoEmision,
        nuevoId,
      })
      return nuevas.length ? [...nuevas, ...prev] : prev
    })
    setEmisionOpen(false)
    setFilter('Todas')
    setQuery('')
  }

  /**
   * Auto-pagado simulado: marca como cobrada la remesa (sin pasarela real). Una
   * fracción determinista se devuelve, para que se vean también las devoluciones.
   */
  function simularCobro() {
    const ids = recibosRemesables.map((c) => c.id)
    if (ids.length === 0) return
    const fecha = hoy()
    setCuotas((prev) => simularCobroRemesa(prev, ids, fecha))
    // El recibo abierto en la ficha también se actualiza (si no, seguía diciendo
    // «Pendiente» y al marcarlo pagado pisaba la devolución simulada).
    setSelected((prev) => (prev ? simularCobroRemesa([prev], ids, fecha)[0] : prev))
    setRemesaOpen(false)
  }

  // Remesa bancaria: recibos pendientes y domiciliados con IBAN, listos para
  // presentar al banco. El CSV es un listado de trabajo; el XML es el
  // fichero de adeudo directo SEPA (pain.008.001.02) que exige el banco.
  // Solo entran los recibos cuya fecha de cobro ya ha llegado (o llega en la
  // fecha elegida para la remesa). Sin este filtro, un fraccionamiento mensual
  // presentaba de golpe los doce meses del año al banco.
  const limiteRemesa = useMemo(() => {
    if (fechaRemesa) return new Date(`${fechaRemesa}T23:59:59`)
    const d = new Date()
    d.setDate(d.getDate() + 5)
    d.setHours(23, 59, 59, 999)
    return d
  }, [fechaRemesa])

  const recibosRemesables = useMemo(
    () =>
      cuotas.filter((c) => {
        if (c.estado !== 'Pendiente' || !c.domiciliada || !hermanoDe(c.hermanoId)?.iban) return false
        // Ya salió en un fichero descargado: no puede volver a entrar sola.
        // Mandar dos veces el mismo recibo al banco son dos cargos al hermano,
        // y el segundo vuelve devuelto y con comisión.
        if (c.remesadaEl) return false
        const cobro = parseFechaEs(c.fechaCobro)
        // Si la fecha no se puede interpretar, se incluye (no se pierde el recibo).
        return !cobro || cobro <= limiteRemesa
      }),
    [cuotas, hermanoDe, limiteRemesa],
  )

  /** Pendientes que ya viajaron en un fichero descargado y por eso no entran. */
  const yaRemesados = useMemo(
    () => cuotas.filter((c) => c.remesadaEl && c.estado === 'Pendiente'),
    [cuotas],
  )
  const ultimaRemesa = useMemo(
    () => { const fechas = yaRemesados.map((c) => c.remesadaEl!).sort(); return fechas.length ? fechas[fechas.length - 1] : null },
    [yaRemesados],
  )

  const acreedor = useMemo(
    () => ({ nombre: hermandad.nombreLegal, iban: hermandad.iban, identificadorAcreedor: hermandad.identificadorAcreedor }),
    [hermandad],
  )
  const avisoAcreedor = useMemo(() => acreedorIncompleto(acreedor), [acreedor])

  function abrirRemesa() {
    const dentroCincoDias = new Date()
    dentroCincoDias.setDate(dentroCincoDias.getDate() + 5)
    // isoLocal, no toISOString: si no, se propone un día antes y encima se
    // arrastra al fichero del banco.
    setFechaRemesa(isoLocal(dentroCincoDias))
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
        deudor: { nombre: h.nombre, iban: h.iban ?? '', hermanoId: h.id, numeroHermano: h.numero, antiguedad: h.antiguedad },
      }
    })
    const xml = buildSepaXml(acreedor, recibos, new Date(`${fechaRemesa}T00:00:00`), new Date())
    descargarArchivo(`remesa-sepa-${fechaRemesa}.xml`, xml, 'application/xml;charset=utf-8;')
    // Queda apuntado en cada recibo que ya viajó en un fichero. Antes no
    // quedaba rastro de ninguna clase: el recibo seguía «Pendiente» y
    // domiciliado, así que a la semana siguiente entraba otra vez en la remesa
    // y el hermano recibía el segundo cargo.
    const hoy = isoLocal(new Date())
    const enLaRemesa = new Set(recibosRemesables.map((c) => c.id))
    setCuotas((prev) => prev.map((c) => (enLaRemesa.has(c.id) ? { ...c, remesadaEl: hoy } : c)))
    setRemesaOpen(false)
  }

  /**
   * Soltar los recibos de la última remesa para poder volver a incluirlos.
   *
   * Hace falta porque descargar un fichero no significa haberlo mandado: se
   * descarga, se ve que la fecha estaba mal, se borra y se rehace. Sin esta
   * salida, esos recibos se quedarían fuera de toda remesa para siempre y
   * nadie entendería por qué no se les cobra.
   */
  function soltarRemesados() {
    const sueltos = cuotas.filter((c) => c.remesadaEl && c.estado === 'Pendiente')
    if (sueltos.length === 0) return
    if (!window.confirm(
      `Vas a devolver ${sueltos.length} recibo${sueltos.length === 1 ? '' : 's'} a la remesa. ` +
      'Hazlo solo si el fichero anterior NO llegó a mandarse al banco: si ya se mandó, ' +
      'volverías a cobrarles.',
    )) return
    const ids = new Set(sueltos.map((c) => c.id))
    setCuotas((prev) => prev.map((c) => (ids.has(c.id) ? { ...c, remesadaEl: undefined } : c)))
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
          // Ejercicio explícito: si se dedujera de la fecha de emisión, una cuota
          // creada a mano quedaría en otro ejercicio y la emisión anual la duplicaría.
          ejercicio: ejercicioEnCurso,
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
            {stats.total} recibos del ejercicio {ejercicioEnCurso} · {cuotas.length} en total ·
            datos de ejemplo mientras conectamos la base de datos.{' '}
            <Link to="/app/configuracion" className="dash-head__link">
              Personalizar datos de la hermandad
            </Link>
          </p>
        </div>
        <div className="dash-head__actions">
          <MenuAcciones>
            <button type="button" onClick={abrirEmision}>
              Emitir el ejercicio entero
            </button>
            <button
              type="button"
              onClick={abrirRemesa}
              disabled={recibosRemesables.length === 0}
              title={
                recibosRemesables.length === 0
                  ? 'No hay recibos pendientes domiciliados con IBAN'
                  : `${recibosRemesables.length} recibos pendientes domiciliados`
              }
            >
              Preparar remesa <small>{recibosRemesables.length}</small>
            </button>
            <button type="button" onClick={() => setModeloOpen(true)}>
              Modelo de recibo
            </button>
            <button type="button" onClick={() => setAjustesOpen(true)}>
              Ajustes de cuotas
            </button>
          </MenuAcciones>
          <button className="btn btn-primary" onClick={abrirNuevaCuota}>
            + Nueva cuota
          </button>
        </div>
      </div>

      {avisados.length > 0 && (
        <div className="banner-inline banner-inline--accent">
          <span>
            <b>
              {avisados.length === 1 ? 'Un hermano avisa' : `${avisados.length} hermanos avisan`} de que ya{' '}
              {avisados.length === 1 ? 'ha' : 'han'} pagado.
            </b>{' '}
            {avisados.length === 1 ? 'Ha pagado' : 'Han pagado'} por Bizum o transferencia desde su área.
            Compruébalo en el banco y {avisados.length === 1 ? 'dalo' : 'dalos'} por cobrado{avisados.length === 1 ? '' : 's'}.
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => setFilter('Avisados')}>
            {avisados.length === 1 ? 'Ver ese recibo' : `Ver esos ${avisados.length} recibos`}
          </button>
        </div>
      )}

      {/* Lo que ya salió en un fichero no vuelve a entrar solo. Se dice, con
          cuántos y de cuándo, y con la salida por si el fichero no se llegó a
          mandar: si no, esos recibos se quedarían fuera para siempre y nadie
          entendería por qué a esa gente no se le cobra. */}
      {yaRemesados.length > 0 && (
        <div className="banner-inline">
          <span>
            <b>{yaRemesados.length} recibo{yaRemesados.length === 1 ? '' : 's'} ya {yaRemesados.length === 1 ? 'está' : 'están'} en una remesa</b>
            {ultimaRemesa ? ` descargada el ${formatDate(new Date(`${ultimaRemesa}T00:00:00`))}` : ''}, así que no
            {yaRemesados.length === 1 ? ' vuelve' : ' vuelven'} a entrar en la siguiente. Si aquel fichero no llegó a mandarse al banco, devuélve{yaRemesados.length === 1 ? 'lo' : 'los'}.
          </span>
          <button className="btn btn-ghost btn-sm" onClick={soltarRemesados}>
            Volver a incluir{yaRemesados.length === 1 ? 'lo' : 'los'}
          </button>
        </div>
      )}

      {hayNuevoEjercicio && (
        <div className="banner-inline banner-inline--accent cuotas-nuevo-ejercicio">
          <span>
            <b>Nuevo ejercicio {ejercicioEnCurso}.</b> Hay{' '}
            {hermanosSinCuota(cuotas, hermanos, ejercicioEnCurso, conceptoAnual!.nombre).length} hermanos
            sin la {conceptoAnual!.nombre} de este año. Emítela a todo el censo de una vez.
          </span>
          <button className="btn btn-primary btn-sm" onClick={abrirEmision}>
            Emitir cuotas de {ejercicioEnCurso}
          </button>
        </div>
      )}

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Recibos emitidos</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Ejercicio {ejercicioEnCurso}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Cobrado</span>
          <span className="stat-tile__value">{formatCurrency(stats.cobrado)}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">{stats.alDia}% al día · {ejercicioEnCurso}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Pendiente de cobro</span>
          <span className="stat-tile__value">{formatCurrency(stats.pendiente)}</span>
          <span className="stat-tile__trend stat-tile__trend--warn">Deuda viva (todos los años)</span>
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
          {/* El filtro de avisados solo aparece cuando hay alguno: si no, sería
              una pestaña siempre vacía. */}
          {([
            'Todas',
            ...(avisados.length > 0 ? (['Avisados'] as const) : []),
            'Pagada',
            'Pendiente',
            'En mora',
            'Devuelta',
          ] as const).map((f) => (
            <button
              key={f}
              className={`chip${filter === f ? ' chip--active' : ''}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === 'Todas'
                ? 'Todas'
                : f === 'Avisados'
                  ? `Avisan que han pagado (${avisados.length})`
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
            {/* En el móvil solo caben tres columnas: el resto se oculta y sus
                datos se doblan bajo el nombre del hermano (`solo-movil`). */}
            <tr>
              <th className="col-opcional">Nº</th>
              <th>Hermano</th>
              <th className="col-opcional">Concepto</th>
              <th>Estado</th>
              <th>Importe</th>
              <th className="col-opcional">Cobro</th>
              <th className="col-opcional"></th>
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
                  <td className="num col-opcional">{String(c.numero).padStart(4, '0')}</td>
                  <td>
                    <div className="row-person">
                      <span className="row-avatar">{h ? initials(h.nombre) : '?'}</span>
                      <span>
                        <span className="row-person__name">{h?.nombre ?? 'Hermano desconocido'}</span>
                        <span className="row-person__sub">Nº {h?.numero ?? '—'}</span>
                        <span className="row-person__sub solo-movil">{c.concepto} · {c.fechaCobro}</span>
                      </span>
                    </div>
                  </td>
                  <td className="col-opcional">{c.concepto}</td>
                  <td>
                    <span className={`pill ${estadoClass(c.estado)}`}>{c.estado}</span>
                    {esAvisado(c) && (
                      <span className="pill-avisado" title={`El hermano avisó el ${c.pagoComunicado?.fecha} de que ha pagado por ${c.pagoComunicado?.metodo}`}>
                        Dice que ha pagado
                      </span>
                    )}
                  </td>
                  <td className="num">{formatCurrency(c.importe)}</td>
                  <td className="col-opcional">
                    <span className="cobro-cell">
                      <span className="num">{c.fechaCobro}</span>
                      <span className={`cobro-tag${c.domiciliada ? ' cobro-tag--bank' : ''}`}>
                        {metodoDeCuota(c)}
                      </span>
                    </span>
                  </td>
                  <td className="col-opcional">
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
          selected && (() => {
            const sinCobrar =
              selected.estado === 'Pendiente' || selected.estado === 'En mora' || selected.estado === 'Devuelta'
            return (
            <>
              {/* En un recibo sin cobrar, la acción importante es cobrarlo, no
                  imprimirlo: manda ella y el resto pasa a segundo plano. */}
              {sinCobrar && (
                <button className="btn btn-primary" onClick={() => marcarPagada(selected.id)}>
                  {selected.pagoComunicado
                    ? `Confirmar el pago por ${metodoEnFrase(selected.pagoComunicado.metodo)}`
                    : 'Marcar como pagada'}
                </button>
              )}
              {/* Un recibo devuelto no es un callejón sin salida: se puede volver
                  a poner al cobro (entra otra vez en la próxima remesa). */}
              {selected.estado === 'Devuelta' && (
                <button
                  className="btn btn-outline"
                  onClick={() => aplicarCuota(selected.id, { estado: 'Pendiente', fechaPago: undefined })}
                >
                  Volver a poner al cobro
                </button>
              )}
              {puedeMora && selected.estado === 'Pendiente' &&
                (ajustes.moraRequiereDosCargos && selected.moraPropuestaPor === miCorreo ? (
                  <button className="btn btn-ghost" disabled>
                    Mora propuesta · falta otro cargo
                  </button>
                ) : (
                  <button className="btn btn-ghost rgpd-borrar" onClick={() => ponerEnMora(selected)}>
                    {!ajustes.moraRequiereDosCargos
                      ? 'Poner en mora'
                      : selected.moraPropuestaPor
                        ? 'Confirmar mora'
                        : 'Proponer mora'}
                  </button>
                ))}
              {puedeMora && selected.estado === 'Pendiente' && selected.moraPropuestaPor && (
                <button className="btn btn-ghost" onClick={() => cancelarPropuestaMora(selected.id)}>
                  Cancelar propuesta
                </button>
              )}
              {puedeMora && selected.estado === 'En mora' && (
                <button className="btn btn-ghost" onClick={() => quitarMora(selected.id)}>
                  Quitar mora
                </button>
              )}
              <button className={`btn ${sinCobrar ? 'btn-outline' : 'btn-primary'}`} onClick={() => window.print()}>
                Imprimir / Descargar
              </button>
            </>
            )
          })()
        }
      >
        {selected && esAvisado(selected) && selected.pagoComunicado && (
          <div className="banner-inline banner-inline--accent" style={{ marginBottom: '1rem' }}>
            <span>
              El hermano avisó el <b>{selected.pagoComunicado.fecha}</b> de que ha pagado este recibo por{' '}
              <b>{metodoEnFrase(selected.pagoComunicado.metodo)}</b>. Compruébalo en el banco antes de confirmarlo.
            </span>
          </div>
        )}
        {selected && selected.moraPropuestaPor && selected.estado === 'Pendiente' && (
          <div className="banner-inline banner-inline--warn" style={{ marginBottom: '1rem' }}>
            Mora <b>propuesta</b> por {selected.moraPropuestaNombre ?? selected.moraPropuestaPor}. Falta que otro cargo
            (tesorero o secretario) la confirme.
          </div>
        )}
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
              hermanos={hermanosAsignables(hermanos)}
              name="hermanoId"
              id="hermanoId"
              onSelect={(p) => setHermanoNuevaCuota(p ? (hermanos.find((h) => h.id === p.id) ?? null) : null)}
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
            {/* SOLO en modo demostración. Con una hermandad de verdad detrás,
                este botón daba por cobrada una remesa entera sin que hubiera
                entrado un euro: los recibos quedaban «Pagada», sin apunte en
                Tesorería, y encima devolvía una parte al azar. La contabilidad
                quedaba diciendo que se había cobrado algo que no se cobró, y
                deshacerlo es recibo por recibo. En una pantalla de trabajo,
                al lado de «Descargar XML», es un accidente esperando. */}
            {hayDatosDeEjemplo() && (
              <button className="btn btn-outline" onClick={simularCobro} title="Solo para probar: marca la remesa como cobrada sin que haya pasarela">
                Simular cobro
              </button>
            )}
            <button className="btn btn-primary" onClick={descargarSepaXml} disabled={!!avisoAcreedor || !fechaRemesa}>
              Descargar XML SEPA
            </button>
          </>
        }
      >
        <div className="app-form">
          {avisoAcreedor && (
            <div className="banner-inline banner-inline--warn">
              <span>{avisoAcreedor}</span>
              {/* Antes decía «(Configuración)» y había que buscarlo a mano. */}
              <Link to="/app/configuracion" className="btn btn-outline btn-sm">Ir a Configuración</Link>
            </div>
          )}
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
            enviarlo.{' '}
            {hayDatosDeEjemplo() && (
              <>
                <b>Simular cobro</b> marca la remesa como pagada (sin pasarela real, para probar el
                ciclo completo); una pequeña parte se devuelve, como en la vida real. Solo aparece
                mientras estáis probando.
              </>
            )}
          </p>
          <p className="form-hint">
            Al descargar el XML, estos recibos quedan marcados como remesados y no vuelven a entrar
            en la siguiente remesa. Si al final no mandáis el fichero, podéis devolverlos desde el
            aviso que sale en la pantalla de cuotas.
          </p>
        </div>
      </Drawer>

      {/* Emisión anual del ejercicio (salto de año) */}
      <Drawer
        open={emisionOpen}
        onClose={() => setEmisionOpen(false)}
        title="Emitir cuotas del ejercicio"
        subtitle="Salto de año"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEmisionOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={confirmarEmision} disabled={!catalogoListo || pendientesDeEmitir.length === 0 || !ejercicioValido}>
              Emitir {pendientesDeEmitir.length} cuota{pendientesDeEmitir.length === 1 ? '' : 's'}
            </button>
          </>
        }
      >
        <div className="app-form">
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="ejercicioEmision">Ejercicio</label>
              <input
                id="ejercicioEmision"
                type="number"
                value={ejercicioEmision}
                min={2000}
                max={2100}
                onChange={(e) => setEjercicioEmision(Number(e.target.value))}
              />
            </div>
            <div className="form-row">
              <label htmlFor="conceptoEmision">Concepto</label>
              <select
                id="conceptoEmision"
                value={conceptoEmision}
                onChange={(e) => setConceptoEmision(e.target.value)}
              >
                {conceptosCuota.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre} · {formatCurrency(c.importe)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="metodoEmision">Método de cobro por defecto</label>
            <select
              id="metodoEmision"
              value={metodoEmision}
              onChange={(e) => setMetodoEmision(e.target.value as MetodoCobro)}
            >
              {METODOS_COBRO.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <p className="form-hint">
              Se domicilia solo a quien tenga IBAN; al resto se le emite por transferencia.
            </p>
          </div>
          <div className="banner-inline banner-inline--accent">
            Se emitirá <b>{formatCurrency(importeConceptoEmision)}</b> de «{conceptoEmision}» a{' '}
            <b>{pendientesDeEmitir.length}</b> hermano{pendientesDeEmitir.length === 1 ? '' : 's'} del
            ejercicio {ejercicioEmision} que aún no la tienen. Los de baja quedan fuera y a quien ya
            la tenga no se le duplica.
          </div>
          {pendientesDeEmitir.length === 0 && (
            <p className="form-hint">
              Todos los hermanos activos ya tienen «{conceptoEmision}» del ejercicio {ejercicioEmision}.
            </p>
          )}
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

      {/* Ajustes de cuotas (mora) */}
      <Drawer open={ajustesOpen} onClose={() => setAjustesOpen(false)} title="Ajustes de cuotas" subtitle="Mora">
        <div className="app-form">
          <div className="assign-box">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={ajustes.moraRequiereDosCargos}
                onChange={(e) => setAjustes({ ...ajustes, moraRequiereDosCargos: e.target.checked })}
              />
              La mora requiere que la confirmen dos cargos
            </label>
            <p className="form-hint">
              {ajustes.moraRequiereDosCargos
                ? 'Un cargo (tesorero o secretario) PROPONE la mora y otro distinto la CONFIRMA. Es una doble validación.'
                : 'Basta con que un cargo autorizado (tesorero, secretario o titular) ponga la mora.'}
            </p>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
