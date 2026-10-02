import { llano } from '../../lib/buscar'
import { useCallback, useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
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
import { HERMANOS_INICIALES, type Hermano } from '../../data/hermanos'
import {
  CUOTAS_INICIALES,
  METODOS_COBRO,
  deudaDe,
  esAvisado,
  estaSinCobrar,
  metodoEnFrase,
  type ConceptoCuota,
  type Cuota,
  type EstadoCuota,
  type MetodoCobro,
} from '../../data/cuotas'
import { FilasDeRecibos } from './cuotas/FilasDeRecibos'
import { Paginador } from '../../components/Paginador'
import { usePaginado } from '../../lib/paginar'
import { FilasPorHermano } from './cuotas/FilasPorHermano'
import { useConceptosCuota } from '../../lib/conceptosCuota'
import { useAuth } from '../../context/AuthContext'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { aCentimos, formatCurrency, formatDate, sumaEuros } from '../../lib/format'
import { hayDatosDeEjemplo } from '../../lib/demo'
import { agregarAvisoHermano } from '../../lib/avisosHermano'
import { avisarPorCorreo } from '../../lib/avisosCorreo'
import { conApunteDeCobro, origenDeCuota, sinApunteDeCobro } from '../../lib/apuntes'
import { apuntar } from '../../lib/registroActividad'
import { MOVIMIENTOS_INICIALES, type Movimiento } from '../../data/movimientos'
import { movimientoToRow, rowToMovimiento } from '../../lib/db/movimientos'
import { CLAVES_DATOS, leerDatos } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { esNovedad, NOVEDADES } from '../../lib/novedades'
import { desdeQueEjercicio, ventanaDeCuotas } from '../../lib/ventanaHistorico'
import { cuotaToRow, rowToCuota } from '../../lib/db/cuotas'
import ImportarTabla from '../../components/ImportarTabla'
import { useContextoDeImportacion } from '../../lib/contextoImportacion'
import { TABLA_CUOTAS } from '../../lib/tablasImportables'
import { useMandatosSepa, mandatoVigente } from '../../lib/mandatosSepa'
import { useAjustesCuotas } from '../../lib/ajustesCuotas'
import {
  ejercicioDeCuotas,
  emitirCuotasAnuales,
  hermanosSinCuota,
  ultimoEjercicio,
  ejercicioDe,
  ejercicioVigente,
  inicioDeEjercicio,
} from '../../lib/cuotasEmision'
import { useLasDevoluciones } from './cuotas/devoluciones'
import CajonDeAjustes from './cuotas/CajonDeAjustes'
import { MESES_LARGOS } from './cuotas/meses'
import { useLaRemesa } from './cuotas/remesa'
import CajonDeRemesa from './cuotas/CajonDeRemesa'
import CajonDeDevoluciones from './cuotas/CajonDeDevoluciones'
import { hoy, isoLocal } from './cuotas/fechas'
import {
  etiquetaDeSituacion,
  recuentoDeSituaciones,
  situacionDeTodos,
  type SituacionCuota,
} from '../../lib/estadoCuotaHermano'


/** Meses en castellano para el ajuste de renovación (enero = índice 0). */

/**
 * Fecha por defecto del primer cobro: hoy + 15 días.
 *
 * Es el margen de aviso de una domiciliación, no el plazo del banco: al hermano
 * hay que decirle que se le va a cobrar antes de cobrarle. El plazo de
 * PRESENTACIÓN de la remesa es otra cosa y es más corto — lo propone
 * `abrirRemesa()` a cinco días— y cada banco pone el suyo.
 *
 * (El comentario de esta función estaba quince líneas más arriba, encima de
 * `MESES_LARGOS`, y parecía describir la lista de meses.)
 */
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

  /*
   * LA VENTANA DE HISTÓRICO.
   *
   * Se traían TODOS los ejercicios para enseñar uno. El porqué de cortarlo y
   * por qué no cambia ninguna cifra está entero en `lib/ventanaHistorico.ts`;
   * el resumen es que una hermandad de 800 hermanos acumula 32.000 recibos en
   * diez años y eso deja de caber en el navegador, sola, sin que nadie toque
   * nada.
   *
   * VA DETRÁS DE BANDERA y nace apagada: con `cuotas-ventana` sin encender,
   * `ventana` es `undefined` y se trae todo, exactamente igual que siempre.
   * Ver `lib/novedades.ts`.
   *
   * EL AÑO SALE DEL CALENDARIO Y NO DE `ejercicioVigente(ajustes.renovacion)`,
   * y es a propósito: los ajustes se resuelven MÁS ABAJO en este mismo
   * componente, así que aquí todavía no existen. La diferencia entre los dos
   * es como mucho un año, la ventana ya se lleva dos, y todo lo que siga sin
   * cobrar entra igual de cualquier ejercicio. O sea que el desfase no puede
   * dejar fuera nada que se mire.
   */
  const desdeEjercicio = desdeQueEjercicio(new Date().getFullYear())
  const ventanaCuotas = useMemo(
    () => (esNovedad(NOVEDADES.cuotasVentana) ? ventanaDeCuotas<Cuota>(desdeEjercicio) : undefined),
    [desdeEjercicio],
  )
  const [cuotas, setCuotas] = useSupabaseTable<Cuota>(
    'cuotas',
    CLAVES_DATOS.cuotas,
    CUOTAS_INICIALES,
    cuotaToRow,
    rowToCuota,
    undefined,
    { ventana: ventanaCuotas },
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

  /* C3 · lo que el banco devuelve de una remesa ya mandada. */
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

  /*
   * ==========================================================================
   * COBRAR EN MANO, HERMANO A HERMANO
   * ==========================================================================
   *
   * El caso: alguien se pasa por la casa de hermandad un martes y paga su
   * cuota en efectivo. Hasta ahora había que buscarlo en la lista de recibos
   * —que en una hermandad son cientos, de varios ejercicios— y dar por pagado
   * el suyo a mano, uno por uno si debía varios.
   *
   * Y lo que salía mal no era solo el tiempo: `marcarPagada` apuntaba el cobro
   * CON EL MÉTODO CON EL QUE SE EMITIÓ el recibo. Un recibo domiciliado pagado
   * en efectivo entraba en el cajón y el apunte decía «banco»: al conciliar el
   * extracto no aparecía, y la caja descuadraba todos los meses por esa
   * cantidad.
   *
   * Aquí se elige a la persona, se ven TODOS sus recibos pendientes de golpe
   * —de cualquier ejercicio, que es como llega la gente— y se cobra diciendo
   * cómo ha pagado de verdad.
   */
  const [cobroEnManoId, setCobroEnManoId] = useState<string | null>(null)
  /* El cobro en mano se abre a mano: plegado no quita el sitio de arriba, solo
     el espacio de la cabecera los días en que no hay nadie pagando. */
  const [cobroAbierto, setCobroAbierto] = useState(false)
  const [metodoEnMano, setMetodoEnMano] = useState<MetodoCobro>('Efectivo')
  const [cobradosEnMano, setCobradosEnMano] = useState<number>(0)

  /*
   * SUS RECIBOS SIN PAGAR, DE CUALQUIER EJERCICIO.
   *
   * Sin filtrar por el ejercicio que se esté mirando: quien viene a pagar en
   * ventanilla suele traer atrasados, y enseñarle solo los de este año sería
   * cobrarle la mitad y dejarle debiendo sin que nadie se entere.
   *
   * Se ordenan del más viejo al más nuevo porque es el orden en que se cobra:
   * primero lo que lleva más tiempo debiéndose.
   */
  const recibosDelQueVieneAPagar = useMemo(() => {
    if (!cobroEnManoId) return []
    return cuotas
      .filter((c) => c.hermanoId === cobroEnManoId && c.estado !== 'Pagada')
      .sort((a, b) => (a.fechaEmision < b.fechaEmision ? -1 : 1))
  }, [cuotas, cobroEnManoId])
  // Un año a medio teclear («2», «202») emitiría cuotas de un ejercicio absurdo.
  const ejercicioEnRango = ejercicioEmision >= 2000 && ejercicioEmision <= 2100
  /*
   * NO SE PUEDE EMITIR UN EJERCICIO QUE NO SE HA TRAÍDO. ESTO ES IMPORTANTE.
   *
   * `pendientesDeEmitir` sale de `hermanosSinCuota(cuotas, …)`, o sea, de la
   * lista que hay EN MEMORIA. Con la ventana puesta, los recibos ya cobrados de
   * 2019 no están en esa lista — y no porque no existan, sino porque no se han
   * traído.
   *
   * Sin este freno, escribir «2019» en el cajón de emisión diría «se emitirá a
   * 800 hermanos» y emitiría 800 recibos duplicados encima de los que ya hay en
   * la base. Sin un solo error: los números salen, son plausibles, y están mal.
   *
   * Con la bandera apagada esto no aplica nunca (`ventanaCuotas` es
   * `undefined`) y se puede emitir cualquier año, como siempre.
   */
  const ejercicioFueraDeVentana = !!ventanaCuotas && ejercicioEmision < desdeEjercicio
  const ejercicioValido = ejercicioEnRango && !ejercicioFueraDeVentana

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

  // El mandato SEPA vigente de cada hermano: sin él no hay recibo que
  // domiciliar, por muy bueno que sea su IBAN. Ver `lib/mandatosSepa.ts`.
  const [mandatos] = useMandatosSepa()
  const mandatoDe = useMemo(
    () => (hermanoId: string, iban: string | null | undefined) => mandatoVigente(mandatos, hermanoId, iban),
    [mandatos],
  )

  /*
   * LA REMESA BANCARIA, en su sitio (`cuotas/remesa.ts`). Se desarma para que
   * el cajón, los dos avisos de arriba y el menú de acciones sigan nombrando
   * `recibosRemesables` y `fueraDeLaRemesa` como siempre.
   */
  const remesa = useLaRemesa({
    cuotas, setCuotas, setMovimientos, setSelected, hermandad, hermanos, hermanoDe, mandatoDe,
  })
  /*
   * Y de la remesa la pantalla solo desarma lo que pinta ELLA: los dos avisos
   * de arriba —lo ya remesado y los que se caen— y el menú de acciones. Lo
   * demás lo lee su cajón de `remesa`, que se le pasa entero.
   */
  const {
    recibosRemesables, fueraDeLaRemesa, dineroFuera, yaRemesados,
    abrirRemesa, soltarRemesados, ultimaRemesa,
  } = remesa

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

  /*
   * PARTIDA EN PÁGINAS PARA LA TABLA, Y SOLO PARA LA TABLA.
   *
   * `filtered` se queda ENTERA, y eso es lo importante: es la que cuentan los
   * recuadros, la que se descarga en CSV, la que sale por la impresora y la
   * que marca «todos». A la tabla va solo `paginado.pagina`. Paginar esas
   * cuatro sería un fallo peor que el lento que se viene a arreglar: un padrón
   * de ochocientos que imprime cien y no lo dice.
   *
   * Con menos de cien filas no aparece el paginador y no cambia nada: ver
   * `POR_PAGINA` en `lib/paginar.ts`.
   */
  const paginadoDeRecibos = usePaginado(filtered)

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

  /*
   * PARTIDA EN PÁGINAS PARA LA TABLA, Y SOLO PARA LA TABLA.
   *
   * `situacionesFiltradas` se queda ENTERA, y eso es lo importante: es la que cuentan los
   * recuadros, la que se descarga en CSV, la que sale por la impresora y la
   * que marca «todos». A la tabla va solo `paginado.pagina`. Paginar esas
   * cuatro sería un fallo peor que el lento que se viene a arreglar: un padrón
   * de ochocientos que imprime cien y no lo dice.
   *
   * Con menos de cien filas no aparece el paginador y no cambia nada: ver
   * `POR_PAGINA` en `lib/paginar.ts`.
   */
  const paginadoPorHermano = usePaginado(situacionesFiltradas)

  const stats = useMemo(() => {
    // Los indicadores hablan del EJERCICIO EN CURSO (antes mezclaban todos los
    // años, así que el «% al día» no significaba nada al pasar de ejercicio).
    const base = cuotas.filter((c) => ejercicioDe(c) === ejercicioMirado)
    const total = base.length
    // `sumaEuros` y no un `reduce` a pelo: un importe vacío deja la cifra en
    // NaN, y uno que llegue como texto la concatena. Ver `lib/format.ts`.
    const cobrado = sumaEuros(base.filter((c) => c.estado === 'Pagada').map((c) => c.importe))
    // Deuda viva: pendientes, devueltas y en mora de CUALQUIER ejercicio (la de
    // años anteriores sigue debiéndose, no puede desaparecer del indicador).
    const pendiente = deudaDe(cuotas)
    const pagadas = base.filter((c) => c.estado === 'Pagada').length
    const alDia = total ? Math.round((pagadas / total) * 100) : 0
    return { total, cobrado, pendiente, alDia }
  }, [cuotas, ejercicioMirado])

  /**
   * DA UN RECIBO POR PAGADO.
   *
   * ==========================================================================
   * EL MÉTODO NO ES UN ADORNO: DECIDE EN QUÉ CUENTA ENTRA EL DINERO
   * ==========================================================================
   *
   * `conApunteDeCobro` llama a `cuentaSegunMetodo()`, así que del método sale
   * si el apunte va a CAJA o al BANCO.
   *
   * Y aquí había un fallo: se pasaba `c.metodoCobro`, o sea el método CON EL
   * QUE SE EMITIÓ. Cuando un hermano venía a pagar en efectivo a la casa de
   * hermandad su recibo domiciliado, el dinero entraba en el cajón y el apunte
   * decía «banco». Al conciliar el extracto no aparece, y la caja descuadra por
   * esa misma cantidad todos los meses.
   *
   * Por eso `metodo` se puede pasar: es lo que dice cómo se ha cobrado DE
   * VERDAD, que no siempre es como se pensaba cobrar.
   */
  /*
   * `useCallback` y no una función suelta: es una prop de `FilasDeRecibos`, y
   * si cambiara de identidad en cada render el `memo` de las filas no pasaría
   * de largo nunca. Es la misma razón que en `Hermanos.tsx` con
   * `alternarMarca`.
   */
  const marcarPagada = useCallback((id: string, metodo?: MetodoCobro) => {
    const cambios = {
      estado: 'Pagada' as const,
      fechaPago: hoy(),
      pagoComunicado: null,
      ...(metodo ? { metodoCobro: metodo, domiciliada: metodo === 'Domiciliación' } : {}),
    }
    setCuotas((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...cambios } : prev))
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
          // El de VERDAD si se ha dicho; si no, el que traía el recibo.
          metodo: metodo ?? c.metodoCobro,
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
  }, [cuotas, hermanos, setCuotas, setSelected, setMovimientos])

  const miCorreo = (user?.email ?? '').toLowerCase()
  const miNombre = (user?.user_metadata?.nombre as string | undefined) ?? user?.email ?? 'Un cargo'
  /*
   * LAS DEVOLUCIONES DEL BANCO, en su sitio (`cuotas/devoluciones.ts`). Se
   * desarma para que el cajón de abajo siga nombrando `devolucionesOpen` y
   * `cruceDevoluciones` como siempre.
   */
  const devoluciones = useLasDevoluciones({
    cuotas, setCuotas, setMovimientos, hermanos, miNombre,
  })
  const { abrirDevoluciones } = devoluciones

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
            {/* Justo detrás de la remesa porque es su otra mitad: se manda el
                fichero, y unos días después el banco contesta cuáles no ha
                podido cobrar. */}
            <button type="button" onClick={abrirDevoluciones}>
              Cargar devoluciones del banco
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
              Traer el historial de cuotas (Excel o CSV)
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

      {/*
        ====================================================================
        COBRAR EN MANO — el hermano que se pasa por la casa de hermandad
        ====================================================================

        SIGUE ARRIBA DEL TODO, pero PLEGADO.

        Está arriba porque es lo que se hace con alguien delante esperando: si
        hay que buscarlo, se acaba dando por pagado el recibo desde la lista y
        perdiendo el método, que es justamente lo que descuadraba la caja. Ese
        motivo no ha cambiado.

        Lo que ha cambiado es que estaba SIEMPRE abierto, con su buscador y su
        desplegable de método ocupando la cabecera de Cuotas los trescientos
        sesenta y cuatro días del año en que no hay nadie delante pagando. Ser
        lo primero y estar abierto no son lo mismo: el sitio se conserva y el
        espacio se devuelve, y se abre con un clic.

        OJO CON EL `details` CONTROLADO. La primera versión puso
        `open={cobroAbierto || !!cobroEnManoId}` para que no se cerrase en
        mitad de un cobro, y en el navegador se cerraba igual: el clic en el
        `summary` abre o cierra el `details` por su cuenta, y si la prop `open`
        que React tiene apuntada no cambia de valor, React no vuelve a
        escribirla. El DOM se va por un lado y el árbol por otro. En el código
        parecía correcto; solo pulsándolo se vio.
        
        Así que `open` sale SOLO del estado, que es lo único que no se
        desincroniza. Y cerrar no pierde nada: el hermano elegido y el método
        siguen en su sitio, así que al volver a abrirlo el cobro está donde se
        dejó. Eso es lo que hay que garantizar, no impedir que lo cierre quien
        quiere cerrarlo.
      */}
      <details
        className="settings-card cobro-en-mano"
        style={{ marginBottom: '1.1rem' }}
        open={cobroAbierto}
        onToggle={(e) => setCobroAbierto((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cobro-en-mano__abrir">
          <span className="settings-card__title">Cobrar a un hermano</span>
          <span className="form-hint">Viene a pagar a la casa de hermandad</span>
        </summary>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Búscalo, elige cómo paga y dale a cobrar: se apunta en el libro con la cuenta que toca y le
          llega el aviso a su área.
        </p>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="cobro-en-mano">Hermano</label>
            <HermanoPicker
              id="cobro-en-mano"
              hermanos={hermanos.filter((h) => h.estado !== 'Baja').map((h) => ({
                id: h.id, nombre: h.nombre, marca: `Nº ${h.numero}`,
              }))}
              placeholder="Escribe el nombre o el número"
              valorId={cobroEnManoId}
              onSelect={(p) => { setCobroEnManoId(p?.id ?? null); setCobradosEnMano(0) }}
              textoVacio="Nadie elegido"
            />
          </div>
          <div className="form-row">
            <label htmlFor="metodo-en-mano">Cómo paga</label>
            {/*
              SIN «DOMICILIACIÓN» EN LA LISTA, y es a propósito: quien está
              delante pagando no está domiciliando nada. Ofrecerlo aquí es
              ofrecer justo el error que descuadra la caja.
            */}
            <select
              id="metodo-en-mano"
              value={metodoEnMano}
              onChange={(e) => setMetodoEnMano(e.target.value as MetodoCobro)}
            >
              {METODOS_COBRO.filter((m) => m !== 'Domiciliación').map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {cobroEnManoId && (
          recibosDelQueVieneAPagar.length === 0 ? (
            <p className="form-hint form-hint--ok">
              {cobradosEnMano > 0
                ? `✓ Cobrado. Ya no le queda ningún recibo pendiente.`
                : 'No tiene ningún recibo pendiente.'}
            </p>
          ) : (
            <>
              {cobradosEnMano > 0 && (
                <p className="form-hint form-hint--ok">
                  ✓ {cobradosEnMano} recibo{cobradosEnMano === 1 ? '' : 's'} cobrado{cobradosEnMano === 1 ? '' : 's'}.
                </p>
              )}
              <ul className="lista-limpia">
                {recibosDelQueVieneAPagar.map((c) => (
                  <li key={c.id} className="assign-box" style={{ marginBottom: '0.5rem' }}>
                    <div className="assign-box__row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        <b>{c.concepto}</b>
                        {' · '}{formatCurrency(c.importe)}
                        <span className="table-subtle">
                          {' · '}ejercicio {c.ejercicio ?? new Date(`${c.fechaEmision}T00:00:00`).getFullYear()}
                          {c.estado === 'Devuelta' && ' · devuelta por el banco'}
                        </span>
                      </span>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => { marcarPagada(c.id, metodoEnMano); setCobradosEnMano((n) => n + 1) }}
                      >
                        Cobrar {formatCurrency(c.importe)}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {/*
                Y EL TOTAL, porque quien viene a pagar pregunta «¿cuánto es?»
                antes que nada, y sumarlo de cabeza con cuatro recibos delante
                es como se cobra de menos.
              */}
              {recibosDelQueVieneAPagar.length > 1 && (
                <p className="form-hint">
                  {/*
                    CON `sumaEuros`, no con un `reduce` a pelo. Sumar 12,10 +
                    12,20 en coma flotante da 24,299999999999997, y eso acaba
                    impreso delante de quien está pagando. Hay una prueba que lo
                    vigila en toda la aplicación, y me pilló aquí.
                  */}
                  Debe <b>{formatCurrency(sumaEuros(recibosDelQueVieneAPagar.map((c) => c.importe)))}</b> en{' '}
                  {recibosDelQueVieneAPagar.length} recibos.
                </p>
              )}
            </>
          )
        )}
      </details>

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
          aria-pressed={vista === 'recibos'}
        >
          Recibos <small>{cuotas.length}</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'hermanos'}
          className={`chip${vista === 'hermanos' ? ' chip--active' : ''}`}
          onClick={() => setVista('hermanos')}
          aria-pressed={vista === 'hermanos'}
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
                aria-pressed={filtroSituacion === f}
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
              aria-pressed={filter === f}
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
            {/*
              EL CUERPO, MEMORIZADO. Cada letra del buscador re-renderiza esta
              pantalla; sin el límite de `memo`, React recorría las cuatro mil
              quinientas filas en el render urgente —el de la letra— aunque la
              lista filtrada no hubiera cambiado todavía. Medido: 304 ms por
              tecla. Ver `cuotas/FilasDeRecibos.tsx`.

              Las props tienen que ser ESTABLES o el límite no sirve:
              `hermanoDe` ya venía de un `useMemo` y `marcarPagada` está en un
              `useCallback` por esto mismo.
            */}
            <FilasDeRecibos
              filtered={paginadoDeRecibos.pagina}
              justAddedId={justAddedId}
              hermanoDe={hermanoDe}
              setSelected={setSelected}
              marcarPagada={marcarPagada}
            />
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
                    /*
                      SIN CONCEPTO, EL BOTÓN NO LLEVA A EMITIR SINO A DEFINIR LA
                      CUOTA. Antes, «Emitir el ejercicio entero» abría un cajón
                      donde no se podía emitir —falta el nombre y el importe de la
                      cuota—: prometía algo que no cumplía, y quedaba en «no me
                      deja». Con la cuota ya definida, el botón sí emite.
                    */
                    !catalogoListo ? (
                      <>
                        Para emitir las cuotas, antes hay que decir cuánto se paga: define la cuota
                        —su nombre e importe— en{' '}
                        <Link to="/app/configuracion" className="dash-head__link">Configuración → Catálogos y cuotas</Link>.
                      </>
                    ) : (
                      <>
                        Todavía no se ha emitido ningún recibo.{' '}
                        <button type="button" className="btn btn-outline btn-sm" onClick={abrirEmision}>
                          Emitir el ejercicio entero
                        </button>
                      </>
                    )
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
        <Paginador p={paginadoDeRecibos} que="recibos" />
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
            {/* El cuerpo, memorizado: ver `cuotas/FilasPorHermano.tsx`. */}
            <FilasPorHermano
              situacionesFiltradas={paginadoPorHermano.pagina}
              ejercicioMirado={ejercicioMirado}
            />
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
        <Paginador p={paginadoPorHermano} que="hermanos" />
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

      <CajonDeDevoluciones devoluciones={devoluciones} hermanos={hermanos} />

      <CajonDeRemesa remesa={remesa} hermanoDe={hermanoDe} />

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
            {/*
              UN BOTÓN APAGADO TIENE QUE DECIR POR QUÉ. Sin esto, quien pulsaba
              «Emitir el ejercicio entero» y llegaba aquí se encontraba un botón
              muerto sin saber qué le faltaba —normalmente, definir la cuota—. El
              motivo va en el `title` (al pasar por encima) y lo cuenta también,
              y con más detalle, el recuadro del cuerpo del cajón.
            */}
            <button
              className="btn btn-primary"
              onClick={confirmarEmision}
              disabled={!catalogoListo || pendientesDeEmitir.length === 0 || !ejercicioValido}
              title={
                !catalogoListo
                  ? 'Antes hay que definir la cuota (su nombre e importe) en Configuración → Catálogos y cuotas.'
                  : !ejercicioValido
                    ? 'El año del ejercicio no es válido.'
                    : pendientesDeEmitir.length === 0
                      ? 'No hay a quién emitírsela: todos los hermanos activos ya la tienen.'
                      : undefined
              }
            >
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
              {/*
                Ver `ejercicioFueraDeVentana`: de ese ejercicio no están
                cargados los recibos ya cobrados, así que emitir crearía
                duplicados. Se dice por qué, no se deja el botón apagado sin
                explicación.
              */}
              {ejercicioFueraDeVentana && (
                <p className="form-hint form-hint--alerta">
                  De {ejercicioEmision} no están cargados los recibos ya cobrados (se traen los
                  ejercicios desde {desdeEjercicio}), así que emitir aquí crearía recibos repetidos.
                  Para reabrir un ejercicio antiguo, avísanos.
                </p>
              )}
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

      <CajonDeAjustes
        ajustes={ajustes}
        setAjustes={setAjustes}
        ajustesOpen={ajustesOpen}
        setAjustesOpen={setAjustesOpen}
        ejercicioEnCurso={ejercicioEnCurso}
      />

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
