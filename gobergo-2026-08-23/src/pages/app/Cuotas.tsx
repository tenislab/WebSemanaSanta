import { llano } from '../../lib/buscar'
import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
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
  cargarModeloReciboDeLaBase,
} from '../../lib/modeloRecibo'
import type { ModeloPapeleta } from '../../lib/modeloPapeleta'
import { HERMANOS_INICIALES, initials, type Hermano } from '../../data/hermanos'
import {
  CUOTAS_INICIALES,
  METODOS_COBRO,
  deudaDe,
  esAvisado,
  estaSinCobrar,
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
import { aCentimos, formatCurrency, formatDate } from '../../lib/format'
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
import ImportarTabla from '../../components/ImportarTabla'
import { useContextoDeImportacion } from '../../lib/contextoImportacion'
import { TABLA_CUOTAS } from '../../lib/tablasImportables'
import { buildSepaXml, acreedorIncompleto } from '../../lib/sepa'
import { ibanValido, porQueNoValeElIban } from '../../lib/iban'
import { useAjustesCuotas } from '../../lib/ajustesCuotas'
import {
  ejercicioDeCuotas,
  emitirCuotasAnuales,
  hermanosSinCuota,
  ultimoEjercicio,
  simularCobroRemesa,
  parseFechaEs,
  ejercicioDe,
  ejercicioVigente,
  inicioDeEjercicio,
  renovacionValida,
} from '../../lib/cuotasEmision'
import { filaQueAbre } from '../../lib/foco'
import { hoyIso } from '../../lib/hoy'
import {
  etiquetaDeSituacion,
  recuentoDeSituaciones,
  situacionDeTodos,
  type SituacionCuota,
} from '../../lib/estadoCuotaHermano'

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Fecha por defecto del primer cobro: hoy + 15 días (margen de aviso típico de una domiciliación SEPA). */
/** Meses en castellano para el ajuste de renovación (enero = índice 0). */
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

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
  /* La letra se pinta antes que la tabla: ver el comentario en Hermanos.tsx. */
  const busqueda = useDeferredValue(query)

  // «Avisados» no es un estado del recibo: es el hermano que ha dicho desde su
  // área que ya ha pagado por Bizum o transferencia y espera confirmación.
  const [filter, setFilter] = useState<'Todas' | 'Avisados' | EstadoCuota>('Todas')
  /*
   * QUÉ SE ESTÁ MIRANDO: los recibos o los hermanos.
   *
   * La pantalla solo enseñaba RECIBOS, y esa es la vista que sirve para
   * cuadrar el banco y no sirve para nada más. La pregunta que se hace en una
   * hermandad —al repartir papeletas, al montar el cortejo, en el mostrador—
   * no es «¿cómo está el recibo 1048?» sino «¿está Fulano al corriente?», y
   * esa no se podía contestar: un hermano con tres recibos salía tres veces
   * sin sumar, y uno SIN NINGÚN recibo no salía en absoluto —justo el que peor
   * está—. Con cero recibos emitidos la pantalla se quedaba entera en blanco,
   * que es la captura que llegó: «0 recibos» y cinco hermanos en el censo.
   */
  const [vista, setVista] = useState<'recibos' | 'hermanos'>('recibos')
  const [filtroSituacion, setFiltroSituacion] = useState<'Todos' | SituacionCuota>('Todos')
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
  // Traído de la hermandad: sin esto, quien entra desde otro ordenador ve el
  // recibo de fábrica aunque la hermandad tenga el suyo diseñado.
  useEffect(() => {
    void cargarModeloReciboDeLaBase().then((m) => {
      if (m) setModeloRecibo(m)
    })
  }, [])
  const [ajustesOpen, setAjustesOpen] = useState(false)
  const [ajustes, setAjustes] = useAjustesCuotas()

  const hermanos = useMemo(() => leerDatos(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  const [importarOpen, setImportarOpen] = useState(false)
  const ctxImportacion = useContextoDeImportacion(hermanos)
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
  /**
   * EL EJERCICIO QUE TOCA COBRAR, según el día en que la hermandad renueva.
   *
   * Salía de `getCampana().anio`, que es la Semana Santa que viene y NO el
   * ejercicio contable. En agosto de 2026 eso proponía emitir el **2027**: es
   * la captura que llegó, «se emitirá … a 32 hermanos del ejercicio 2027». Un
   * año entero cobrado por adelantado, y a los domiciliados no se les deshace
   * borrando el recibo, porque el cargo ya ha salido en la remesa.
   *
   * Ahora es el de la última renovación cumplida: con renovación el 1 de enero
   * es el año natural, y con renovación en septiembre, en agosto todavía se
   * está en el ejercicio del año anterior. Así el ciclo se repite solo cada
   * año, el día que diga la hermandad.
   */
  const ejercicioEnCurso = useMemo(
    () => ejercicioVigente(ajustes.renovacion),
    [ajustes.renovacion],
  )
  const ultimoEmitido = useMemo(() => ultimoEjercicio(cuotas), [cuotas])
  /**
   * EL EJERCICIO QUE SE ESTÁ MIRANDO, que NO es el de la campaña.
   *
   * Aquí estaba media captura que llegó. `ejercicioEnCurso` es el año de la
   * campaña de papeletas —la Semana Santa que viene—, y los indicadores lo
   * usaban para contar recibos. En agosto de 2026 eso significa 2027: la
   * cabecera decía «0 recibos del ejercicio 2027 · 10 en total» y los cuatro
   * indicadores salían a cero con la tesorería llena. Parecía roto y no lo
   * estaba: estaba contando un año en el que todavía no se ha emitido nada.
   *
   * El ejercicio de cuotas es CONTABLE, no procesional: se mira el último con
   * recibos, y si no hay ninguno, el año natural. La campaña se sigue usando
   * para proponer la emisión del año que viene, que es otra cosa distinta.
   */
  const ejercicioMirado = ejercicioDeCuotas(cuotas)
  const [emisionOpen, setEmisionOpen] = useState(false)
  const [ejercicioEmision, setEjercicioEmision] = useState(ejercicioEnCurso)
  const [conceptoEmision, setConceptoEmision] = useState('')
  /*
   * EL CONCEPTO ELEGIDO SIEMPRE HA DE ESTAR EN EL CATÁLOGO.
   *
   * El catálogo llega de la base después del primer pintado, y la hermandad
   * puede renombrar su cuota desde Configuración. Antes esto solo se rellenaba
   * «si está vacío», así que un nombre que dejaba de existir se quedaba puesto:
   * el `<select>` no encontraba ninguna opción con ese valor y se pintaba EN
   * BLANCO, que es la captura que llegó, mientras el aviso de debajo seguía
   * nombrando el concepto viejo.
   */
  useEffect(() => {
    if (conceptosCuota.length === 0) return
    if (conceptosCuota.some((c) => c.nombre === conceptoEmision)) return
    setConceptoEmision(conceptosCuota[0].nombre)
  }, [conceptosCuota, conceptoEmision])
  const [metodoEmision, setMetodoEmision] = useState<MetodoCobro>('Domiciliación')
  // Un año a medio teclear («2», «202») emitiría cuotas de un ejercicio absurdo.
  const ejercicioValido = ejercicioEmision >= 2000 && ejercicioEmision <= 2100

  /**
   * EL CONCEPTO QUE SE VA A EMITIR, como objeto del catálogo y no como texto.
   *
   * Con el nombre suelto había tres respuestas distintas a la vez en el mismo
   * cajón: el desplegable en blanco (ninguna opción con ese valor), el aviso
   * nombrando el concepto viejo, y el importe cogido del PRIMER concepto del
   * catálogo —`?? conceptoAnual?.importe`—, que no tiene por qué ser el
   * elegido. Con el objeto entero solo caben dos: o es uno del catálogo, o no
   * hay concepto y no se emite nada.
   */
  const conceptoElegido = useMemo(
    () => conceptosCuota.find((c) => c.nombre === conceptoEmision) ?? null,
    [conceptosCuota, conceptoEmision],
  )
  const pendientesDeEmitir = useMemo(
    () =>
      conceptoElegido
        ? hermanosSinCuota(cuotas, hermanos, ejercicioEmision, conceptoElegido.nombre)
        : [],
    [cuotas, hermanos, ejercicioEmision, conceptoElegido],
  )
  const importeConceptoEmision = conceptoElegido?.importe ?? 0
  /** El día en que arranca el ejercicio que se está emitiendo: la fecha de cobro. */
  const fechaCobroDelEjercicio = useMemo(
    () => inicioDeEjercicio(ejercicioEmision, ajustes.renovacion),
    [ejercicioEmision, ajustes.renovacion],
  )
  /** Cuántos hermanos no tienen todavía la cuota del ejercicio en curso. */
  const sinCuotaDelEjercicio = useMemo(
    () =>
      conceptoAnual
        ? hermanosSinCuota(cuotas, hermanos, ejercicioEnCurso, conceptoAnual.nombre).length
        : 0,
    [cuotas, hermanos, ejercicioEnCurso, conceptoAnual],
  )
  // ¿Toca un ejercicio nuevo? Hay hermanos activos sin la cuota del ejercicio
  // en curso, que avanza solo el día de la renovación: así el aviso vuelve
  // cada año sin que nadie tenga que acordarse.
  const hayNuevoEjercicio =
    catalogoListo && (ultimoEmitido == null || ultimoEmitido < ejercicioEnCurso) && sinCuotaDelEjercicio > 0
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
        const q = llano(busqueda)
        if (!q) return true
        const h = hermanoDe(c.hermanoId)
        return (
          llano(h?.nombre ?? '').includes(q) ||
          String(h?.numero ?? '').includes(q) ||
          String(c.numero).includes(q)
        )
      })
      .sort((a, b) => b.numero - a.numero)
  }, [cuotas, busqueda, filter, hermanoDe])

  /**
   * EL CENSO CON SU SITUACIÓN, una fila por hermano.
   *
   * Sale de los recibos: no hay ningún dato guardado que diga si alguien está
   * al corriente. (La ficha lleva un `cuotaAlDia`, pero nadie lo actualiza al
   * cobrar — ver lib/estadoCuotaHermano.ts.)
   */
  const situaciones = useMemo(
    () => situacionDeTodos(cuotas, hermanos, ejercicioMirado),
    [cuotas, hermanos, ejercicioMirado],
  )
  const recuento = useMemo(() => recuentoDeSituaciones(situaciones), [situaciones])
  const situacionesFiltradas = useMemo(() => {
    const q = llano(busqueda)
    return situaciones
      .filter((x) => filtroSituacion === 'Todos' || x.situacion === filtroSituacion)
      .filter((x) => !q || llano(x.hermano.nombre).includes(q) || String(x.hermano.numero).includes(q))
  }, [situaciones, filtroSituacion, busqueda])

  const stats = useMemo(() => {
    // Los indicadores hablan del EJERCICIO EN CURSO (antes mezclaban todos los
    // años, así que el «% al día» no significaba nada al pasar de ejercicio).
    const base = cuotas.filter((c) => ejercicioDe(c) === ejercicioMirado)
    const total = base.length
    const cobrado = base.filter((c) => c.estado === 'Pagada').reduce((s, c) => s + c.importe, 0)
    // Deuda viva: pendientes, devueltas y en mora de CUALQUIER ejercicio (la de
    // años anteriores sigue debiéndose, no puede desaparecer del indicador).
    const pendiente = deudaDe(cuotas)
    const pagadas = base.filter((c) => c.estado === 'Pagada').length
    const alDia = total ? Math.round((pagadas / total) * 100) : 0
    return { total, cobrado, pendiente, alDia }
  }, [cuotas, ejercicioMirado])

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
    /*
     * NO se inventa un concepto. Aquí ponía `?? 'Cuota anual'`, que es
     * exactamente contra lo que avisa `conceptosCuota.ts`: sin catálogo de la
     * hermandad, el cajón se abría con un nombre que no es suyo y con importe
     * 0 €, porque ese nombre no está en ningún sitio. Es la captura que llegó:
     * «se emitirá 0,00 € de "Cuota anual" a 32 hermanos». Sin catálogo no hay
     * nada que proponer, y lo que se enseña es por qué.
     */
    if (conceptoAnual) setConceptoEmision(conceptoAnual.nombre)
    setMetodoEmision('Domiciliación')
    setEmisionOpen(true)
  }

  /** Emite la cuota anual del ejercicio a todos los hermanos que aún no la tienen. */
  function confirmarEmision() {
    if (!ejercicioValido || !conceptoElegido) return
    // Se calcula DENTRO del updater, sobre la lista más reciente: si se emitiera
    // sobre la copia del render (p. ej. antes de que termine de cargar la tabla)
    // se numeraría desde 1 y se duplicarían recibos ya existentes.
    setCuotas((prev) => {
      const nuevas = emitirCuotasAnuales({
        cuotas: prev,
        hermanos,
        ejercicio: ejercicioEmision,
        concepto: conceptoElegido.nombre,
        importe: conceptoElegido.importe,
        /*
         * SE COBRA EL DÍA DE LA RENOVACIÓN, no dentro de quince días.
         *
         * Era `hoy + 15`, así que la fecha de cobro dependía del día que el
         * tesorero se acordara de pulsar el botón: emitir el 3 de enero o el
         * 3 de marzo daba dos ejercicios con vencimientos distintos, y la
         * remesa —que solo incluye recibos cuya fecha de cobro ha llegado— se
         * quedaba esperando dos semanas sin motivo. El ejercicio arranca el
         * día que dice la hermandad y ese es el día del cargo; si se emite
         * tarde, la fecha queda atrás y los domiciliados entran ya en la
         * primera remesa, que es lo que toca cuando se va con retraso.
         */
        fechaCobro: formatearFechaInput(isoLocal(fechaCobroDelEjercicio)),
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
        // El IBAN tiene que estar Y valer. Uno mal escrito no se queda en una
        // línea rechazada: el banco tira el fichero ENTERO. Ver `lib/iban.ts`.
        if (c.estado !== 'Pendiente' || !c.domiciliada || !ibanValido(hermanoDe(c.hermanoId)?.iban ?? '')) return false
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

  /**
   * LOS DOMICILIADOS QUE SE CAEN DE LA REMESA, Y POR QUÉ.
   *
   * Se caían EN SILENCIO. La tesorería generaba la remesa creyendo que cobraba
   * a todos los domiciliados, y a estos no. Su recibo se quedaba «Pendiente»
   * para siempre, entraba otra vez en la siguiente remesa, se volvía a caer, y
   * nada en la pantalla decía nunca por qué.
   *
   * En una hermandad son bastantes: el IBAN se importa del Excel de siempre,
   * donde alguien lo tecleó a mano hace años. Faltan cifras, sobran, está el
   * número de cuenta antiguo sin el «ES» delante, o sencillamente no está.
   */
  const fueraDeLaRemesa = useMemo(() => {
    const fuera = cuotas
      .filter((c) => c.estado === 'Pendiente' && c.domiciliada && !c.remesadaEl)
      .map((c) => ({ cuota: c, hermano: hermanoDe(c.hermanoId) }))
      .filter((x) => x.hermano && !ibanValido(x.hermano.iban ?? ''))
      .map((x) => ({
        id: x.cuota.id,
        nombre: x.hermano!.nombre,
        numero: x.hermano!.numero,
        importe: x.cuota.importe,
        motivo: porQueNoValeElIban(x.hermano!.iban ?? '') ?? '',
      }))
    // Una fila por hermano, no una por recibo: al tesorero le sirve la lista de
    // a quién hay que pedirle el IBAN, y repetir al mismo cuatro veces —una por
    // recibo del año— la hace ilegible.
    const porHermano = new Map<number, typeof fuera[number] & { recibos: number }>()
    for (const f of fuera) {
      const ya = porHermano.get(f.numero)
      if (ya) { ya.recibos += 1; ya.importe += f.importe }
      else porHermano.set(f.numero, { ...f, recibos: 1 })
    }
    return [...porHermano.values()].sort((a, b) => a.numero - b.numero)
  }, [cuotas, hermanoDe])

  const dineroFuera = useMemo(
    () => fueraDeLaRemesa.reduce((n, f) => n + f.importe, 0),
    [fueraDeLaRemesa],
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
    descargarArchivo(`remesa-cuotas-${hoyIso()}.csv`, csv)
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
    // Redondeado a céntimos al entrar: ver `aCentimos` en lib/format.ts.
    const importe = aCentimos(Number(importeRaw.replace(',', '.')))
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
          {/*
            EL AVISO DE «DATOS DE EJEMPLO» IBA SIEMPRE, y aquí estaba el
            despiste: cuando se arreglaron las cinco pantallas que lo decían
            pasara lo que pasara, esta se quedó sin arreglar. Una hermandad con
            34 hermanos de verdad en la base leía «datos de ejemplo mientras
            conectamos la base de datos» encima de sus propios recibos, y a
            partir de ahí ya no se fía de ninguna cifra de la pantalla.
          */}
          <p className="dash-head__lead">
            {stats.total} recibo{stats.total === 1 ? '' : 's'} del ejercicio {ejercicioMirado} ·{' '}
            {cuotas.length} en total
            {hayDatosDeEjemplo() && ' · datos de ejemplo mientras conectamos la base de datos'}
            .{' '}
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
                  : `${recibosRemesables.length} recibo${recibosRemesables.length === 1 ? '' : 's'} pendiente${recibosRemesables.length === 1 ? '' : 's'} domiciliado${recibosRemesables.length === 1 ? '' : 's'}`
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
            {/* El histórico va aquí, con lo demás de cuotas: es lo primero que
                necesita una hermandad que llega de otro programa, porque sin él
                Gobergo empieza sin memoria de tesorería —no se puede reclamar un
                impago de hace dos años ni decir desde cuándo alguien está al
                corriente. */}
            <button type="button" onClick={() => setImportarOpen(true)}>
              Traer el historial de cuotas
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

      {/*
        LOS QUE SE CAEN DE LA REMESA, DICHO EN VOZ ALTA.
        Se caían en silencio: la tesorería descargaba el fichero creyendo que
        cobraba a todos los domiciliados, y a estos no. El recibo se quedaba
        «Pendiente» para siempre y nada explicaba por qué. En una hermandad son
        bastantes, porque el IBAN viene del Excel de siempre.
      */}
      {fueraDeLaRemesa.length > 0 && (
        <details className="banner-inline banner-inline--alerta cuotas-sin-iban">
          <summary>
            <b>
              {fueraDeLaRemesa.length} hermano{fueraDeLaRemesa.length === 1 ? '' : 's'} domiciliado
              {fueraDeLaRemesa.length === 1 ? '' : 's'} no entra{fueraDeLaRemesa.length === 1 ? '' : 'n'} en la remesa
            </b>{' '}
            porque su IBAN falta o no vale — son {formatCurrency(dineroFuera)} que no se van a cobrar.
            Ábrelo para ver quiénes.
          </summary>
          <ul className="cuotas-sin-iban__lista">
            {fueraDeLaRemesa.map((f) => (
              <li key={f.numero}>
                <b>nº {f.numero}</b> {f.nombre} — {f.motivo}
                {f.recibos > 1 && ` · ${f.recibos} recibos`}
                {' · '}{formatCurrency(f.importe)}
              </li>
            ))}
          </ul>
          <p className="form-hint">
            {/*
              Se dice DÓNDE se arregla. Un aviso que señala un problema y no
              dice dónde tocar obliga a buscarlo por toda la aplicación.
            */}
            Se corrige en la ficha de cada hermano, en Hermanos. En cuanto tenga un IBAN bueno,
            su recibo entra solo en la siguiente remesa.
          </p>
        </details>
      )}

      {hayNuevoEjercicio && (
        <div className="banner-inline banner-inline--accent cuotas-nuevo-ejercicio">
          <span>
            <b>
              Nuevo ejercicio {ejercicioEnCurso}, desde el {ajustes.renovacion.dia} de{' '}
              {MESES_LARGOS[ajustes.renovacion.mes - 1]}.
            </b>{' '}
            Hay {sinCuotaDelEjercicio} hermanos sin la {conceptoAnual!.nombre} de este ejercicio.
            Emítela a todo el censo de una vez: a quien tenga IBAN se le domicilia y entra en la
            remesa; al resto le queda el recibo sin cobrar.
          </span>
          <button className="btn btn-primary btn-sm" onClick={abrirEmision}>
            Emitir cuotas de {ejercicioEnCurso}
          </button>
        </div>
      )}

      {/*
        CENSO METIDO Y SIN COBRARLE A NADIE. Es la pantalla de la captura: «0
        recibos», tabla en blanco y cinco hermanos dentro. Sin decirlo, parece
        que la aplicación está rota; y lo que pasa es que no se ha emitido
        todavía, que tiene arreglo de un clic.
      */}
      {/*
        Solo si NO está ya el aviso de nuevo ejercicio. Los dos decían casi lo
        mismo, uno encima del otro, y el de arriba además trae el botón que lo
        arregla: dos avisos seguidos para el mismo problema se leen como ruido
        y se dejan de leer los dos. Este queda para el caso que el otro no
        cubre: el ejercicio ya emitido y alguien que se quedó fuera —el que se
        dio de alta en marzo—.
      */}
      {!hayNuevoEjercicio && recuento.sinEmitir > 0 && (
        <div className="banner-inline banner-inline--accent">
          <span>
            <b>
              {recuento.sinEmitir === 1
                ? 'Hay un hermano sin ningún recibo'
                : `Hay ${recuento.sinEmitir} hermanos sin ningún recibo`}{' '}
              del ejercicio {ejercicioMirado}.
            </b>{' '}
            No es que estén al día: es que todavía no se les ha cobrado.
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => { setVista('hermanos'); setFiltroSituacion('sinEmitir') }}>
            Ver quiénes son
          </button>
        </div>
      )}

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Recibos emitidos</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Ejercicio {ejercicioMirado}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Cobrado</span>
          <span className="stat-tile__value">{formatCurrency(stats.cobrado)}</span>
          {/*
            Sin un solo recibo emitido, «0% al día» no es una cifra mala: es
            una cifra que no significa nada, y en verde encima. Se dice lo que
            pasa de verdad.
          */}
          <span className={`stat-tile__trend stat-tile__trend--${stats.total ? 'ok' : 'neutral'}`}>
            {stats.total ? `${stats.alDia}% al día · ${ejercicioMirado}` : `Sin emitir · ${ejercicioMirado}`}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Pendiente de cobro</span>
          <span className="stat-tile__value">{formatCurrency(stats.pendiente)}</span>
          <span className="stat-tile__trend stat-tile__trend--warn">Deuda viva (todos los años)</span>
        </div>
        {/*
          ESTE INDICADOR HABLA DE PERSONAS, no de recibos, y antes no.
          Decía «% al corriente» y calculaba recibos pagados sobre recibos
          emitidos: con cero recibos emitidos daba 0% —la captura que llegó— y
          con un solo recibo pagado a un solo hermano daba 100% con el censo
          entero sin cobrar. Ahora es lo que dice que es: cuántos hermanos de
          los que pagan cuota están al día.
        */}
        {/*
          Y CON CERO RECIBOS EMITIDOS NO SE ENSEÑA UN «0%».
          Un 0% grande dice «vais fatal», y lo que pasa es lo contrario: no se
          ha cobrado todavía, así que nadie debe nada. El aviso de arriba ya lo
          explica; el indicador tenía que dejar de contradecirlo.
        */}
        <div className="stat-tile">
          <span className="stat-tile__label">% al corriente</span>
          <span className="stat-tile__value">
            {stats.total === 0
              ? '—'
              : `${recuento.conCuota ? Math.round((recuento.alDia / recuento.conCuota) * 100) : 0}%`}
          </span>
          <span className="stat-tile__trend stat-tile__trend--neutral">
            {stats.total === 0
              ? `Todavía no se ha emitido el ${ejercicioMirado}`
              : `${recuento.alDia} de ${recuento.conCuota} hermanos`}
          </span>
        </div>
      </section>

      {/*
        LAS DOS MANERAS DE MIRAR LO MISMO. «Recibos» es la de cuadrar el banco;
        «Por hermano» es la de contestar «¿está Fulano al corriente?», que es
        la pregunta que se hace de verdad y la que no se podía contestar.
      */}
      <div className="filters filters--vista" role="tablist" aria-label="Cómo ver las cuotas">
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'recibos'}
          className={`chip${vista === 'recibos' ? ' chip--active' : ''}`}
          onClick={() => setVista('recibos')}
        >
          Recibos <small>{cuotas.length}</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'hermanos'}
          className={`chip${vista === 'hermanos' ? ' chip--active' : ''}`}
          onClick={() => setVista('hermanos')}
        >
          Por hermano <small>{situaciones.length}</small>
        </button>
      </div>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder={vista === 'recibos' ? 'Buscar por hermano o nº de recibo' : 'Buscar por hermano o número'}
          aria-label="Buscar por hermano o número"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {vista === 'hermanos' ? (
          <div className="filters">
            {(['Todos', 'debe', 'sinEmitir', 'alDia', 'noAplica'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`chip${filtroSituacion === f ? ' chip--active' : ''}`}
                onClick={() => setFiltroSituacion(f)}
              >
                {f === 'Todos'
                  ? 'Todos'
                  : `${etiquetaDeSituacion(f).texto} (${
                    f === 'debe' ? recuento.deben
                      : f === 'sinEmitir' ? recuento.sinEmitir
                        : f === 'alDia' ? recuento.alDia : recuento.noAplica
                  })`}
              </button>
            ))}
          </div>
        ) : (
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
        )}
      </div>

      {vista === 'recibos' ? (
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
                  {...filaQueAbre(() => setSelected(c))}
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
                  {/*
                    TRES VACÍOS DISTINTOS, y antes los tres decían lo mismo.
                    «No hay recibos que coincidan con la búsqueda» delante de
                    una hermandad que todavía no ha emitido NINGUNO manda a
                    revisar un buscador que está vacío, y deja la pantalla sin
                    decir lo único que hay que hacer: emitir el ejercicio.
                  */}
                  {cuotas.length === 0 ? (
                    <>
                      Todavía no se ha emitido ningún recibo.{' '}
                      <button type="button" className="btn btn-outline btn-sm" onClick={abrirEmision}>
                        Emitir el ejercicio entero
                      </button>
                    </>
                  ) : query.trim() ? (
                    <>No hay recibos que coincidan con «{query.trim()}».</>
                  ) : (
                    <>Ningún recibo en «{filter}». Prueba con «Todas».</>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      ) : (
      /*
        POR HERMANO. Una fila por persona, con lo que debe y desde cuándo.

        Es la vista que faltaba. La de recibos no contesta «¿está Fulano al
        corriente?»: quien tiene tres recibos sale tres veces sin sumar, y
        quien no tiene ninguno —el que peor está— no sale. Aquí sale TODO el
        censo, tenga recibos o no, con el que peor está arriba.
      */
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th className="col-opcional">Nº</th>
              <th>Hermano</th>
              <th>Situación</th>
              <th>Debe</th>
              <th className="col-opcional">Recibos {ejercicioMirado}</th>
              <th className="col-opcional">Desde</th>
            </tr>
          </thead>
          <tbody>
            {situacionesFiltradas.map((x) => {
              const etiqueta = etiquetaDeSituacion(x.situacion)
              return (
                <tr key={x.hermano.id}>
                  <td className="num col-opcional">{x.hermano.numero > 0 ? x.hermano.numero : '—'}</td>
                  <td>
                    <div className="row-person">
                      <span className="row-avatar">{initials(x.hermano.nombre)}</span>
                      <span>
                        <span className="row-person__name">{x.hermano.nombre}</span>
                        <span className="row-person__sub">Nº {x.hermano.numero > 0 ? x.hermano.numero : '—'}</span>
                        {/*
                          En el móvil, la línea de debajo del nombre lleva lo
                          de las columnas QUE SE HAN ESCONDIDO —los recibos del
                          ejercicio y desde cuándo arrastra—, no la situación:
                          esa se ve en su propia columna, ahí al lado, y
                          repetirla dejaba «Sin cuota emitida» dos veces en
                          cada fila.
                        */}
                        <span className="row-person__sub solo-movil">
                          {x.recibosDelEjercicio === 0
                            ? `sin recibos de ${ejercicioMirado}`
                            : `${x.recibosDelEjercicio} recibo${x.recibosDelEjercicio === 1 ? '' : 's'} de ${ejercicioMirado}`}
                          {x.desde != null && x.desde < ejercicioMirado ? ` · debe desde ${x.desde}` : ''}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${etiqueta.clase}`}>{etiqueta.texto}</span>
                    {x.avisa && (
                      <span className="pill-avisado" title="Ha avisado desde su área de que ya ha pagado">
                        Dice que ha pagado
                      </span>
                    )}
                  </td>
                  <td className="num">
                    {x.deudaTotal > 0 ? formatCurrency(x.deudaTotal) : '—'}
                    {/* Lo atrasado se separa: no es lo mismo deber el recibo de
                        este mes que arrastrar dos ejercicios. */}
                    {x.deudaAtrasada > 0 && (
                      <span className="row-person__sub">{formatCurrency(x.deudaAtrasada)} de años anteriores</span>
                    )}
                  </td>
                  <td className="num col-opcional">{x.recibosDelEjercicio}</td>
                  <td className="num col-opcional">{x.desde ?? '—'}</td>
                </tr>
              )
            })}
            {situacionesFiltradas.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  {hermanos.length === 0
                    ? 'Todavía no hay hermanos en el censo. Impórtalo desde Hermanos y aquí aparecerá quién debe y quién no.'
                    : 'Ningún hermano coincide con la búsqueda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Recibo personalizado */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Recibo de cuota"
        subtitle={selected ? `Nº ${String(selected.numero).padStart(4, '0')}` : undefined}
        footer={
          selected && (() => {
            const sinCobrar = estaSinCobrar(selected)
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
              /* Los civiles fuera, y el filtro va AQUÍ y no dentro de
                 `hermanosAsignables`: esa función la comparten Papeletas,
                 Eventos y Cortejo, y ahí el administrativo contratado SÍ tiene
                 que poder elegirse — puede llevar una tarea de un culto. Lo
                 único que no puede es tener un recibo, porque con IBAN puesto
                 se colaría solo en la siguiente remesa del banco. */
              hermanos={hermanosAsignables(hermanos.filter((h) => !h.civil))}
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
        subtitle={`${recibosRemesables.length} recibo${recibosRemesables.length === 1 ? '' : 's'} pendiente${recibosRemesables.length === 1 ? '' : 's'} domiciliado${recibosRemesables.length === 1 ? '' : 's'}`}
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
                value={conceptoElegido?.nombre ?? ''}
                onChange={(e) => setConceptoEmision(e.target.value)}
                disabled={!catalogoListo}
              >
                {/*
                  Sin catálogo el desplegable se quedaba vacío del todo, sin
                  explicación: un recuadro en blanco que parece que no ha
                  cargado. Una opción que dice lo que pasa se lee.
                */}
                {!catalogoListo && <option value="">Sin conceptos configurados</option>}
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
          {/*
            SIN CATÁLOGO NO SE DICEN CIFRAS. Antes este mismo recuadro decía
            «se emitirá 0,00 € de "Cuota anual" a 32 hermanos» con el
            desplegable en blanco: tres datos y los tres inventados. Cuando no
            se sabe, se dice qué falta y dónde se arregla.
          */}
          {!catalogoListo ? (
            <div className="banner-inline banner-inline--accent">
              Todavía no hay conceptos de cuota. Los define tu hermandad —el nombre y el importe de
              cada cuota— en{' '}
              <Link to="/app/configuracion" className="dash-head__link">
                Configuración
              </Link>
              . Hasta entonces no se puede emitir nada, porque no hay ni importe ni concepto que
              poner en el recibo.
            </div>
          ) : (
            <>
              <div className="banner-inline banner-inline--accent">
                Se emitirá <b>{formatCurrency(importeConceptoEmision)}</b> de «
                {conceptoElegido?.nombre}» a <b>{pendientesDeEmitir.length}</b> hermano
                {pendientesDeEmitir.length === 1 ? '' : 's'} del ejercicio {ejercicioEmision} que aún
                no la tienen, con fecha de cobro el{' '}
                <b>{formatearFechaInput(isoLocal(fechaCobroDelEjercicio))}</b>. Los de baja y los
                hermanos civiles quedan fuera, y a quien ya la tenga no se le duplica.
              </div>
              <p className="form-hint">
                A quien tenga IBAN se le domicilia y entra en la remesa; al resto le queda el recibo
                sin cobrar hasta que pague.
              </p>
              {pendientesDeEmitir.length === 0 && (
                <p className="form-hint">
                  Todos los hermanos activos ya tienen «{conceptoElegido?.nombre}» del ejercicio{' '}
                  {ejercicioEmision}.
                </p>
              )}
            </>
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

      {/* Ajustes de cuotas: renovación del ejercicio y mora */}
      <Drawer
        open={ajustesOpen}
        onClose={() => setAjustesOpen(false)}
        title="Ajustes de cuotas"
        subtitle="Renovación y mora"
      >
        <div className="app-form">
          <div className="assign-box">
            <h4 className="assign-box__title">Cuándo se renuevan las cuotas</h4>
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="renovacionDia">Día</label>
                <input
                  id="renovacionDia"
                  type="number"
                  min={1}
                  max={31}
                  value={ajustes.renovacion.dia}
                  onChange={(e) =>
                    setAjustes({
                      ...ajustes,
                      renovacion: renovacionValida({ ...ajustes.renovacion, dia: Number(e.target.value) }),
                    })
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="renovacionMes">Mes</label>
                <select
                  id="renovacionMes"
                  value={ajustes.renovacion.mes}
                  onChange={(e) =>
                    setAjustes({
                      ...ajustes,
                      renovacion: renovacionValida({ ...ajustes.renovacion, mes: Number(e.target.value) }),
                    })
                  }
                >
                  {MESES_LARGOS.map((nombre, i) => (
                    <option key={nombre} value={i + 1}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="form-hint">
              Cada {ajustes.renovacion.dia} de {MESES_LARGOS[ajustes.renovacion.mes - 1]} empieza un
              ejercicio nuevo. Ahora mismo es el <b>{ejercicioEnCurso}</b>: es el que Cuotas propone
              emitir y con esa fecha de cobro. La emisión no es automática —la lanza la tesorería
              desde «Emitir el ejercicio entero»— pero el aviso vuelve solo cada año ese día.
            </p>
            <p className="form-hint">
              Al emitir, a quien tenga IBAN se le domicilia y entra en la remesa que se manda al
              banco; a quien no, el recibo le queda sin cobrar hasta que pague.
            </p>
          </div>
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

      <ImportarTabla
        abierto={importarOpen}
        onCerrar={() => setImportarOpen(false)}
        tabla={TABLA_CUOTAS}
        existentes={cuotas}
        ctx={ctxImportacion}
        onImportar={(lista) => setCuotas(lista)}
      />
    </div>
  )
}
