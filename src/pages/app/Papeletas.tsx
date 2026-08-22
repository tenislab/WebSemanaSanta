import { useEffect, useMemo, useState } from 'react'
import { prepararAvisos } from '../../lib/avisosCorreo'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import MenuAcciones from '../../components/MenuAcciones'
import PapeletaTicket from '../../components/PapeletaTicket'
import PapeletaModeloRender from '../../components/PapeletaModeloRender'
import ModeloPapeletaEditor from '../../components/ModeloPapeletaEditor'
import { cargarModeloPapeletaDeLaBase, getModeloPapeleta, type ModeloPapeleta } from '../../lib/modeloPapeleta'
import { HERMANOS_INICIALES, initials, type Hermano } from '../../data/hermanos'
import { PAPELETAS_INICIALES, METODOS_PAGO_PAPELETA, type MetodoPagoPapeleta, type Papeleta } from '../../data/papeletas'
import { CUOTAS_INICIALES, type Cuota } from '../../data/cuotas'
import { useAjustesCuotas } from '../../lib/ajustesCuotas'
import { useConvocatoria, enviarConvocatoria, destinatariosConvocatoria } from '../../lib/convocatoria'
import { useSolicitudesPapeleta, type SolicitudPapeleta } from '../../lib/solicitudesPapeleta'
import { useAuth } from '../../context/AuthContext'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { formatDate, formatCurrency } from '../../lib/format'
import {
  useTramos,
  tramosDeCuerpo,
  etiquetaTramo,
  esAutomatico,
  gruposAutomaticos,
  cuerposPresentes,
  precioDeTramo,
  type Tramo,
} from '../../lib/tramos'
import { repartoCompleto, asignacionPorPapeleta as mapAsignaciones } from '../../lib/cortejo'
import {
  getCampana,
  saveCampana,
  ventanaAbierta,
  diasHasta,
  renovacionDeHermano,
  type Campana,
  type EstadoRenovacion,
} from '../../lib/campana'
import { CLAVES_DATOS, leerPersistido, leerDatos } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { papeletaToRow, rowToPapeleta } from '../../lib/db/papeletas'
import { agregarAvisoHermano } from '../../lib/avisosHermano'
import { avisarPorCorreo } from '../../lib/avisosCorreo'
import { conApunteDeCobro, origenDePapeleta, sinApunteDeCobro } from '../../lib/apuntes'
import { apuntar } from '../../lib/registroActividad'
import { MOVIMIENTOS_INICIALES, type Movimiento } from '../../data/movimientos'
import { movimientoToRow, rowToMovimiento } from '../../lib/db/movimientos'
import { conRenovacion } from '../../lib/renovarPapeleta'
import { filaQueAbre } from '../../lib/foco'
import { aniosDeHermandad } from '../../lib/hermanoFicha'

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtIso(iso: string | null) {
  if (!iso) return '—'
  return formatDate(new Date(`${iso}T00:00:00`))
}

function claseEstado(estado: EstadoRenovacion) {
  if (estado === 'Renovada' || estado === 'Nueva') return 'pill--ok'
  if (estado === 'Por renovar') return 'pill--warn'
  if (estado === 'No renovada') return 'pill--err'
  return 'pill--off'
}

const FILTROS = ['Todos', 'Por renovar', 'Renovadas', 'Nuevas', 'No renovadas', 'Sin papeleta'] as const

/** Valor centinela del selector para «papeleta personalizada» (no puede chocar con un nombre de cuerpo). */
/*
 * Valor centinela del selector para la PAPELETA SIMBÓLICA.
 *
 * Es la de quien tiene su sitio y ese año no sale. Es una sola: aquí hubo una
 * lista de «papeletas personalizadas» con nombre y precio libres, y era un
 * tramo pobre —dos hermanos del mismo sitio podían pagar distinto según por
 * dónde se les emitiera—. Todo lo que camina es un tramo.
 */
const SIMBOLICA = '__simbolica'

interface ItemImpresion {
  papeleta: Papeleta
  hermano: Hermano
  tramo: Tramo | null
  puesto: number | null
  excedeAforo: boolean
}

export default function Papeletas() {
  // Antes de mandar nada, traer de la base la configuración de correo de
  // la hermandad y lo que cada hermano tenga apagado. Sin esto, quien
  // entra desde otro ordenador trabaja con la de fábrica: no sale ningún
  // aviso, o se le escribe a quien pidió que no. Los dos en silencio.
  useEffect(() => {
    void prepararAvisos()
  }, [])

  const { user } = useAuth()
  // Quién está haciendo los cambios, para el registro de actividad.
  const quienSoy =
    (user?.user_metadata?.nombre as string | undefined) ?? user?.email ?? 'Alguien de la junta'
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const hermandad = useHermandadSettings(fallbackNombre)
  const tramos = useTramos()
  const hermanos = useMemo(() => leerDatos(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  // El libro de cuentas: cobrar una papeleta deja su apunte aquí.
  const [, setMovimientos] = useSupabaseTable<Movimiento>(
    'movimientos', CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES, movimientoToRow, rowToMovimiento,
  )
  // El precio de la hermandad, no el de este navegador (ver hermandadSettings).
  const precioBase = hermandad.precioPapeleta
  const [ajustes, setAjustes] = useAjustesCuotas()

  // Deuda (cuotas sin pagar) de cada hermano, para avisar al emitir su papeleta.
  const cuotasTodas = useMemo(() => leerPersistido<Cuota[]>(CLAVES_DATOS.cuotas, CUOTAS_INICIALES), [])
  const deudaDe = useMemo(() => {
    const map = new Map<string, number>()
    cuotasTodas.forEach((c) => {
      if (c.estado === 'Pendiente' || c.estado === 'En mora' || c.estado === 'Devuelta') {
        map.set(c.hermanoId, (map.get(c.hermanoId) ?? 0) + c.importe)
      }
    })
    return (id: string) => map.get(id) ?? 0
  }, [cuotasTodas])

  // Registro de pago de la papeleta abierta (método elegido en la ficha).
  const [metodoPagoSel, setMetodoPagoSel] = useState<MetodoPagoPapeleta>('Efectivo')

  const [papeletas, setPapeletas] = useSupabaseTable<Papeleta>(
    'papeletas',
    CLAVES_DATOS.papeletas,
    PAPELETAS_INICIALES,
    papeletaToRow,
    rowToPapeleta,
  )
  const [campana, setCampanaState] = useState<Campana>(() => getCampana())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTROS)[number]>('Todos')
  const [orden, setOrden] = useState<'numero' | 'antiguedad'>('numero')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingCuerpo, setPendingCuerpo] = useState<string>('')
  const [ajustesOpen, setAjustesOpen] = useState(false)
  const [modeloOpen, setModeloOpen] = useState(false)
  const [modelo, setModelo] = useState<ModeloPapeleta | null>(() => getModeloPapeleta())
  // El modelo de la hermandad, no el que hubiera en este navegador.
  useEffect(() => {
    void cargarModeloPapeletaDeLaBase().then((m) => {
      if (m) setModelo(m)
    })
  }, [])
  // Salidas de la papeleta: móvil (con QR, para el correo), física (sin QR, para
  // imprimir) o las dos a la vez (se muestran e imprimen ambas).
  const [variantePapeleta, setVariantePapeleta] = useState<'movil' | 'fisica' | 'ambas'>('movil')
  const [imprimirOpen, setImprimirOpen] = useState(false)
  const [imprimirEstados, setImprimirEstados] = useState<Record<string, boolean>>({ Asignada: true, Pagada: true, Entregada: true })
  const [listaImpresion, setListaImpresion] = useState<ItemImpresion[] | null>(null)
  const [convocatoria, refrescarConvocatoria] = useConvocatoria()
  const [solicitudes, setSolicitudes] = useSolicitudesPapeleta()
  const [solicitudesOpen, setSolicitudesOpen] = useState(false)
  const solicitudesPendientes = useMemo(
    () => solicitudes.filter((s) => s.anio === campana.anio && s.estado === 'Pendiente'),
    [solicitudes, campana.anio],
  )

  function guardarCampana(next: Campana) {
    setCampanaState(next)
    saveCampana(next)
  }

  const hermanoDe = useMemo(() => {
    const map = new Map(hermanos.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [hermanos])

  const tramoDe = (tramoId: string | null) => (tramoId ? (tramos.find((t) => t.id === tramoId) ?? null) : null)

  const cuerposDisponibles = useMemo(() => cuerposPresentes(tramos), [tramos])
  const tramosDelCuerpoElegido = useMemo(
    () => (pendingCuerpo && pendingCuerpo !== SIMBOLICA ? tramosDeCuerpo(pendingCuerpo, tramos) : []),
    [pendingCuerpo, tramos],
  )

  const papeletasActivas = useMemo(() => papeletas.filter((p) => p.anio === campana.anio), [papeletas, campana.anio])

  // El tramo y el puesto de cada papeleta se calculan a partir del reparto del
  // cortejo (cirios en cascada por número; designados por menor número), no
  // del tramo que se pidió: por eso puede colocarse en otro tramo del cuerpo.
  const asignacionPorPapeleta = useMemo(
    () => mapAsignaciones(repartoCompleto(tramos, papeletasActivas, hermanoDe, new Set())),
    [papeletasActivas, hermanoDe, tramos],
  )

  // Ocupación de cada tramo (colocación real) y de cada cuerpo, para el selector.
  const ocupadosPorTramo = useMemo(() => {
    const map = new Map<string, number>()
    asignacionPorPapeleta.forEach((a) => {
      if (a.estado === 'Excede aforo' || !a.tramo) return
      map.set(a.tramo.id, (map.get(a.tramo.id) ?? 0) + 1)
    })
    return map
  }, [asignacionPorPapeleta])

  // Ficha del censo: cada hermano con su estado de renovación en la campaña.
  const filas = useMemo(() => {
    return hermanos
      .map((h) => ({ hermano: h, renovacion: renovacionDeHermano(h.id, papeletas, campana) }))
      .filter((f) => {
        if (filter === 'Todos') return true
        if (filter === 'Renovadas') return f.renovacion.estado === 'Renovada'
        if (filter === 'Nuevas') return f.renovacion.estado === 'Nueva'
        if (filter === 'Por renovar') return f.renovacion.estado === 'Por renovar'
        if (filter === 'No renovadas') return f.renovacion.estado === 'No renovada'
        if (filter === 'Sin papeleta') return f.renovacion.estado === 'Sin papeleta'
        return true
      })
      .filter((f) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return (
          f.hermano.nombre.toLowerCase().includes(q) ||
          String(f.hermano.numero).includes(q) ||
          f.hermano.dni.toLowerCase().includes(q)
        )
      })
      .sort((a, b) =>
        orden === 'antiguedad'
          ? a.hermano.antiguedad - b.hermano.antiguedad || (a.hermano.numero || Infinity) - (b.hermano.numero || Infinity)
          : (a.hermano.numero || Infinity) - (b.hermano.numero || Infinity),
      )
  }, [hermanos, papeletas, campana, filter, query, orden])

  const stats = useMemo(() => {
    const cuenta = { conSitio: 0, porRenovar: 0, noRenovadas: 0, nuevas: 0 }
    hermanos.forEach((h) => {
      const e = renovacionDeHermano(h.id, papeletas, campana).estado
      if (e === 'Renovada' || e === 'Nueva') cuenta.conSitio += 1
      if (e === 'Por renovar') cuenta.porRenovar += 1
      if (e === 'No renovada') cuenta.noRenovadas += 1
      if (e === 'Nueva') cuenta.nuevas += 1
    })

    // Estadísticas centradas en las papeletas de la campaña activa.
    const activas = papeletas.filter((p) => p.anio === campana.anio && p.estado !== 'Anulada' && p.estado !== 'Renuncia')
    const emitidas = activas.length
    const recaudado = activas.filter((p) => p.estado === 'Pagada' || p.estado === 'Entregada').reduce((s, p) => s + p.importe, 0)
    const entregadas = activas.filter((p) => p.estado === 'Entregada').length
    const pendientePago = activas.filter((p) => p.estado === 'Asignada').length
    const solicitudes = activas.filter((p) => p.estado === 'Solicitada').length
    const anuladas = papeletas.filter((p) => p.anio === campana.anio && p.estado === 'Anulada').length

    return { ...cuenta, emitidas, recaudado, entregadas, pendientePago, solicitudes, anuladas }
  }, [hermanos, papeletas, campana])

  // Tramos casi completos, para el aviso de portada.
  const tramosCasiLlenos = useMemo(() => {
    const avisos: string[] = []
    ocupadosPorTramo.forEach((ocupados, tramoId) => {
      const t = tramos.find((x) => x.id === tramoId)
      if (t && t.capacidad > 0 && ocupados / t.capacidad >= 0.85) avisos.push(t.nombre)
    })
    return avisos
  }, [ocupadosPorTramo, tramos])

  const abierta = ventanaAbierta(campana)
  const diasRestantes = diasHasta(campana.fechaLimiteRenovacion)

  /**
   * Siguiente número de papeleta, DENTRO DE SU AÑO.
   *
   * Se calcula a partir de la lista más reciente —dentro del updater, nunca
   * del closure— porque entre el clic y el guardado puede entrar otra.
   *
   * Y cuenta solo las de ESTE ejercicio, que es como está hecha la regla en la
   * base: el índice único es (hermandad, año, número). Contando todos los años
   * juntos, una hermandad que llevara tres campañas empezaba la cuarta por el
   * número 553, y eso es lo que sale impreso en la papeleta que se le da al
   * hermano: «Papeleta nº 0553» en una campaña con veinte papeletas. Ahora
   * cada campaña empieza por el 1, como toda la vida.
   */
  function siguienteNumero(lista: Papeleta[], anio = campana.anio) {
    return Math.max(0, ...lista.filter((p) => p.anio === anio).map((p) => p.numero)) + 1
  }

  function abrirDetalle(id: string) {
    setSelectedId(id)
    setPendingCuerpo('')
  }

  /**
   * Renueva el sitio del año anterior con el mismo tramo. Si ya hay papeleta
   * de esta campaña (doble clic, o una renuncia previa que se rectifica), la
   * actualiza en vez de crear una segunda fila duplicada.
   */
  /**
   * Renovar el sitio de un hermano. La cuenta la lleva `conRenovacion`, la
   * misma que usa el área del hermano: escrito dos veces, se separaba.
   *
   * Ya no recibe el importe: lo calcula ella con el precio de HOY. Que quien
   * llama pudiera pasar el que quisiera es justo lo que dejaba que las dos
   * vías cobraran distinto.
   */
  function renovar(hermanoId: string, tramoId: string) {
    setPapeletas((prev) =>
      conRenovacion(prev, {
        hermanoId,
        tramoId,
        anio: campana.anio,
        tramos,
        precioBase,
        nuevoId,
        hoy,
      }),
    )
    avisarDeSitio(hermanoId, tramos.find((t) => t.id === tramoId)?.nombre ?? null, null, tramoId)
  }

  /** El hermano renuncia a salir este año: pierde su sitio, que queda libre. */
  function noRenovar(hermanoId: string) {
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id ? { ...p, tramoId: null, opcion: null, estado: 'Renuncia', importe: 0 } : p,
        )
      }
      const renuncia: Papeleta = {
        id: nuevoId(),
        numero: siguienteNumero(prev),
        hermanoId,
        anio: campana.anio,
        tramoId: null,
        importe: 0,
        estado: 'Renuncia',
        fechaSolicitud: hoy(),
      }
      return [renuncia, ...prev]
    })
  }

  /**
   * Saca (o rectifica) la papeleta de un hermano en un tramo concreto. Si ya
   * tenía una papeleta este año (una renuncia o una solicitud sin tramo), la
   * reutiliza; si no, crea una nueva.
   */
  function sacarEnTramo(hermanoId: string, tramoId: string) {
    const importe = precioDeTramo(tramos.find((t) => t.id === tramoId), precioBase)
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id
            ? { ...p, tramoId, opcion: null, estado: 'Asignada', importe, pagoComunicado: null }
            : p,
        )
      }
      const nueva: Papeleta = {
        id: nuevoId(),
        numero: siguienteNumero(prev),
        hermanoId,
        anio: campana.anio,
        tramoId,
        importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    avisarDeSitio(hermanoId, tramos.find((t) => t.id === tramoId)?.nombre ?? null, null, tramoId)
    setPendingCuerpo('')
  }

  /**
   * Emite la PAPELETA SIMBÓLICA: la de quien tiene su sitio y este año no sale.
   *
   * No ocupa puesto en el cortejo, y ese es todo su sentido. Si el hermano
   * quisiera salir, sitio hay: se le emite en un tramo como a cualquiera.
   *
   * El nombre se guarda en la papeleta —no una referencia a una lista— para que
   * las papeletas de años pasados sigan diciendo lo que eran aunque la
   * hermandad cambie el precio o el texto.
   */
  const NOMBRE_SIMBOLICA = 'Papeleta simbólica'

  function sacarSimbolica(hermanoId: string) {
    const importe = hermandad.precioSimbolica
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id
            ? { ...p, tramoId: null, opcion: NOMBRE_SIMBOLICA, estado: 'Asignada', importe, pagoComunicado: null }
            : p,
        )
      }
      const nueva: Papeleta = {
        id: nuevoId(),
        numero: siguienteNumero(prev),
        hermanoId,
        anio: campana.anio,
        tramoId: null,
        opcion: NOMBRE_SIMBOLICA,
        importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    avisarDeSitio(hermanoId, null, NOMBRE_SIMBOLICA)
    setPendingCuerpo('')
  }

  /**
   * Le dice al hermano que ya tiene sitio. Es lo que espera desde que manda la
   * solicitud, y hasta ahora se enteraba al entrar en su área por su cuenta.
   */
  function avisarDeSitio(hermanoId: string, tramo: string | null, opcion: string | null, tramoId?: string | null) {
    const que = tramo ?? opcion
    const texto = que
      ? `Ya tienes sitio para la estación de penitencia de ${campana.anio}: ${que}.`
      : `Ya tienes papeleta para la estación de penitencia de ${campana.anio}.`
    agregarAvisoHermano(hermanoId, texto, 'papeleta', 'Tu papeleta de sitio')
    // Y por correo. Esta es de las que más se agradecen: hasta ahora el
    // hermano se enteraba de su sitio solo si entraba a mirarlo por su cuenta.
    const h = hermanos.find((x) => x.id === hermanoId)
    if (!h) return

    /*
     * QUÉ LLEVA ESTE CORREO, y por qué cada cosa.
     *
     * Antes decía «Ya tienes sitio: Cirio 1º tramo» y poco más. Eso está bien
     * como aviso, pero deja fuera lo único que el hermano va a necesitar
     * buscar después: A QUÉ HORA TIENE QUE ESTAR. Es literalmente la pregunta
     * de la semana antes de la salida, la que satura el teléfono de secretaría
     * y el grupo de WhatsApp.
     *
     * La hora de citación es de cada tramo —no salen todos a la vez— y hasta
     * ahora no se podía ni guardar, porque a la tabla le faltaba la columna.
     * Ya se guarda, así que ya se puede decir aquí.
     */
    const t = tramoId ? tramos.find((x) => x.id === tramoId) : null
    const parrafos = [texto]
    if (t?.horaCitacion?.trim()) {
      parrafos.push(`Tu hora de citación es a las ${t.horaCitacion.trim()}.`)
    }
    if (campana.fechaSalida) {
      const f = new Date(`${campana.fechaSalida}T12:00:00`)
      if (!Number.isNaN(f.getTime())) {
        parrafos.push(`La salida es el ${f.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.`)
      }
    }
    parrafos.push('Puedes ver tu papeleta y descargarla desde tu área de hermano.')

    void avisarPorCorreo(
      [{ id: h.id, nombre: h.nombre, email: h.email }],
      'papeleta',
      'Tu papeleta de sitio',
      parrafos,
      'Este aviso lo puedes apagar desde tu área de hermano.',
    ).then((r) => {
      // No corta el guardado —la papeleta ya está emitida y eso es lo que
      // importa— pero deja rastro de que el aviso no salió.
      if (r.error) console.warn(`El aviso de papeleta a ${h.nombre} no salió: ${r.error}`)
    })
  }

  function actualizarPapeleta(id: string, cambios: Partial<Papeleta>) {
    setPapeletas((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)))
  }

  /**
   * Registra el cobro de la papeleta con el método elegido (emitida → pagada).
   *
   * «EXENTO» NO ES UN COBRO. Es lo contrario: se le da su sitio a alguien sin
   * cobrarle —un hermano mayor, una situación difícil, un cargo—. Antes se
   * trataba como los demás métodos, así que apuntaba en Tesorería un ingreso
   * de 18 € en la cuenta bancaria que nadie había pagado, y el contador de
   * «Recaudado» de la campaña también lo sumaba. La hermandad cuadraba caja
   * contra un dinero que no existe.
   *
   * La papeleta queda «Pagada» —porque para el cortejo lo está: puede salir— a
   * importe cero, y no se apunta nada en el libro.
   */
  function registrarPago(id: string, metodo: MetodoPagoPapeleta) {
    const exento = metodo === 'Exento'
    actualizarPapeleta(id, {
      estado: 'Pagada',
      metodoPago: metodo,
      fechaPago: hoy(),
      ...(exento ? { importe: 0 } : {}),
    })
    if (exento) return
    // Y al libro de cuentas. Esto es lo que faltaba: se cobraba la papeleta y
    // Tesorería no lo veía, así que la recaudación de la campaña no aparecía
    // por ninguna parte en el balance.
    const p = papeletas.find((x) => x.id === id)
    if (p) {
      const h = hermanos.find((x) => x.id === p.hermanoId)
      setMovimientos((prev) =>
        conApunteDeCobro(prev, {
          origen: origenDePapeleta(p.id),
          concepto: `Papeleta de sitio ${p.anio} — ${h?.nombre ?? 'hermano/a'}`,
          // No hay partida propia para papeletas en el Estado de Cuentas que
          // piden las diócesis, y no se inventa una: iría en «Otros ingresos»
          // igualmente al presentarlo. El concepto dice de qué es.
          categoria: 'Otros ingresos',
          importe: p.importe,
          fecha: hoy(),
          metodo,
        }),
      )
    }
  }

  /** Anular ≠ borrar: la papeleta se conserva como «Anulada», con su motivo. */
  function anularPapeleta(id: string) {
    const motivo = window.prompt('Motivo de la anulación (queda registrado):', '')
    if (motivo === null) return
    actualizarPapeleta(id, { estado: 'Anulada', motivoAnulacion: motivo.trim() || 'Sin especificar' })
    // Anulada deja de ser un ingreso: fuera su apunte, o el saldo contaría un
    // dinero que se devolvió.
    setMovimientos((prev) => sinApunteDeCobro(prev, origenDePapeleta(id)))
    // Anular una papeleta es de lo primero que se pregunta en un cabildo
    // cuando alguien se queda sin sitio: quién la anuló, cuándo y por qué.
    const anulada = papeletas.find((x) => x.id === id)
    apuntar({
      autorNombre: quienSoy, accion: 'papeleta_anulada', sobreTipo: 'papeleta',
      sobreId: id,
      sobreNombre: hermanos.find((h) => h.id === anulada?.hermanoId)?.nombre ?? '',
      detalle: `Anuló la papeleta de ${hermanos.find((h) => h.id === anulada?.hermanoId)?.nombre ?? 'un hermano'}: ${motivo.trim() || 'sin motivo'}`,
    })
  }

  // ---- Impresión masiva: un único PDF con una papeleta por página ----
  const contadorImpresion = useMemo(() => {
    const c: Record<string, number> = { Asignada: 0, Pagada: 0, Entregada: 0 }
    papeletasActivas.forEach((p) => {
      if (p.estado in c) c[p.estado] += 1
    })
    return c
  }, [papeletasActivas])

  const totalAImprimir = (['Asignada', 'Pagada', 'Entregada'] as const)
    .filter((e) => imprimirEstados[e])
    .reduce((s, e) => s + (contadorImpresion[e] ?? 0), 0)

  /**
   * Abre el plazo avisando por correo a todos los hermanos que pueden sacar
   * papeleta, y lo deja registrado en Comunicados.
   *
   * Es el correo más importante del año: de él depende que la gente saque su
   * papeleta a tiempo, y quien no la saca en plazo pierde el sitio que llevaba
   * años ocupando. Por eso el resultado se cuenta de verdad —cuántos han
   * salido de cuántos— en vez del «(simulada)» de antes, que decía que se
   * había avisado a ochocientos hermanos sin haber avisado a ninguno.
   */
  const [convocando, setConvocando] = useState(false)
  async function convocar() {
    if (convocando) return
    setConvocando(true)
    try {
      const r = await enviarConvocatoria(
        campana.anio,
        hermanos,
        fmtIso(campana.fechaLimiteRenovacion),
        { hermandad: hermandad.nombreLegal, fechaSalidaIso: campana.fechaSalida },
      )
      refrescarConvocatoria()
      if (r.enviados > 0) {
        window.alert(
          `Convocatoria enviada a ${r.enviados} hermano${r.enviados === 1 ? '' : 's'}`
          + `${r.total !== r.enviados ? ` (de ${r.total} con correo)` : ''}. Queda registrada en Comunicados.`,
        )
      } else if (r.total === 0) {
        window.alert(
          'No hay a quién avisar: ningún hermano activo tiene correo en su ficha. '
          + 'Añádeselo desde Hermanos y vuelve a intentarlo.',
        )
      } else {
        window.alert(
          `No ha salido ningún correo${r.error ? `: ${r.error}` : '.'}\n\n`
          + 'Comprueba en Configuración → Correo que el envío está encendido. '
          + 'La convocatoria NO se ha dado por hecha: puedes volver a intentarlo.',
        )
      }
    } finally {
      setConvocando(false)
    }
  }

  /** Acepta una solicitud online: le emite la papeleta con lo pedido y marca la solicitud como aceptada. */
  /**
   * Tramo del cortejo con el que se emite una solicitud aceptada, para que la
   * papeleta entre directa en el cortejo (sin colocarla a mano). Se elige del
   * cuerpo pedido: cirio (reparto por número) para nazareno/penitente, o el
   * primer tramo del cuerpo en otro caso. La secretaría puede recolocarlo luego.
   */
  /**
   * Elige el tramo con el que se emite una solicitud aceptada, para que la
   * papeleta entre directa en el cortejo. Del cuerpo pedido, prioriza el CIRIO
   * con más hueco (reparto por número); si no queda cirio con sitio, cualquier
   * tramo del cuerpo con hueco. `actuales` = papeletas del momento (para no
   * amontonar ni desbordar). La secretaría puede recolocarlo luego en Cortejo.
   */
  function tramoParaSolicitud(s: SolicitudPapeleta, actuales: Papeleta[]): Tramo | null {
    const cuerpo = s.tramoSolicitado && s.tramoSolicitado !== 'Sin preferencia' ? s.tramoSolicitado : null
    const enCuerpo = cuerpo ? tramosDeCuerpo(cuerpo, tramos) : tramos
    if (enCuerpo.length === 0) return null
    const ocupados = (tId: string) =>
      actuales.filter(
        (p) => p.tramoId === tId && p.anio === campana.anio && p.estado !== 'Anulada' && p.estado !== 'Renuncia',
      ).length
    const libres = (t: Tramo) => (t.capacidad ?? 999) - ocupados(t.id)
    // En los tramos por número el reparto es en CASCADA sobre el grupo entero,
    // y todas las papeletas se guardan con el id del primer tramo del grupo.
    // Mirando tramo a tramo, el 2º tramo de un grupo lleno parecía vacío y se
    // aceptaba (y se cobraba) una papeleta que luego salía «Excede aforo».
    const gruposConHueco = gruposAutomaticos(enCuerpo)
      .map((g) => ({
        grupo: g,
        libres: g.tramos.reduce((n, t) => n + (t.capacidad ?? 999), 0) - g.tramos.reduce((n, t) => n + ocupados(t.id), 0),
      }))
      .filter((g) => g.libres > 0)
      .sort((a, b) => b.libres - a.libres)
    if (gruposConHueco.length > 0) return gruposConHueco[0].grupo.tramos[0]
    const conHueco = enCuerpo.filter((t) => libres(t) > 0)
    return (conHueco[0] ?? enCuerpo[0]) ?? null
  }

  function aceptarSolicitud(s: SolicitudPapeleta) {
    setPapeletas((prev) => {
      const tramo = tramoParaSolicitud(s, prev)
      const tramoId = tramo ? tramo.id : null
      const importe = tramo ? precioDeTramo(tramo, precioBase) : precioBase
      // Con tramo → va al cortejo; sin tramo (sin cuerpo posible) → papeleta suelta.
      const opcion = tramoId ? null : `${s.modalidad}${s.preferencia ? ` · ${s.preferencia}` : ''}`
      const actual = prev.find((p) => p.hermanoId === s.hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        /**
         * SI YA ESTÁ COBRADA O ENTREGADA, NO SE TOCA.
         *
         * Este es el caso, y pasa: el hermano pide su sitio desde su área y
         * queda una solicitud pendiente. Antes de que nadie la mire, ese mismo
         * hermano pasa por el mostrador y la secretaría le emite la papeleta y
         * le cobra en efectivo, con su apunte en el libro. Días después alguien
         * abre el buzón —la solicitud sigue ahí, nadie la cerró— y pulsa
         * «Aceptar y emitir».
         *
         * Antes, eso devolvía la papeleta a «Asignada» con el importe
         * recalculado: el hermano volvía a figurar como que no ha pagado, con
         * el apunte del cobro ya hecho en Tesorería y sin nada que lo ate. Se
         * le reclamaba otra vez un dinero que ya había dado.
         *
         * Ahora se deja como está y solo se cierra la solicitud.
         */
        if (actual.estado === 'Pagada' || actual.estado === 'Entregada') return prev
        return prev.map((p) => (p.id === actual.id ? { ...p, opcion, tramoId, estado: 'Asignada', importe } : p))
      }
      const nueva: Papeleta = {
        id: nuevoId(),
        numero: siguienteNumero(prev),
        hermanoId: s.hermanoId,
        anio: campana.anio,
        tramoId,
        opcion,
        importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    setSolicitudes(solicitudes.map((x) => (x.id === s.id ? { ...x, estado: 'Aceptada' } : x)))
  }

  function rechazarSolicitud(s: SolicitudPapeleta) {
    setSolicitudes(solicitudes.map((x) => (x.id === s.id ? { ...x, estado: 'Rechazada' } : x)))
  }

  function generarImpresion() {
    const lista: ItemImpresion[] = papeletasActivas
      .filter((p) => imprimirEstados[p.estado])
      .map((p) => {
        const asig = asignacionPorPapeleta.get(p.id)
        return {
          papeleta: p,
          hermano: hermanoDe(p.hermanoId)!,
          tramo: asig?.tramo ?? null,
          puesto: asig?.puesto ?? null,
          excedeAforo: asig?.estado === 'Excede aforo',
        }
      })
      .filter((it) => it.hermano)
      .sort((a, b) => (a.hermano.numero || Infinity) - (b.hermano.numero || Infinity))
    if (lista.length === 0) return
    setListaImpresion(lista)
    setImprimirOpen(false)
    // Espera a que se pinten las páginas antes de abrir el diálogo de impresión.
    document.body.classList.add('print-masivo')
    setTimeout(() => {
      // Y se recoge con `afterprint`, no en la línea de después de print():
      // `window.print()` no promete devolver el control cuando el papel ya ha
      // salido. En un navegador que vuelve enseguida, aquí se estaban tirando
      // las cuatrocientas papeletas MIENTRAS se imprimían. Red de seguridad a
      // los diez segundos por si `afterprint` no llega.
      let recogido = false
      const recoger = () => {
        if (recogido) return
        recogido = true
        document.body.classList.remove('print-masivo')
        setListaImpresion(null)
      }
      window.addEventListener('afterprint', recoger, { once: true })
      window.setTimeout(recoger, 10000)
      window.print()
    }, 300)
  }

  /** Cierra la campaña actual y abre la del año siguiente (los sitios de este año pasan a renovables). */
  function abrirNuevoAno() {
    const anio = campana.anio + 1
    guardarCampana({
      anio,
      fechaInicioParticiparon: `${anio}-01-15`,
      fechaInicioNoParticiparon: `${anio}-02-01`,
      fechaLimiteRenovacion: `${anio}-02-28`,
      fechaSalida: null,
    })
    setFilter('Todos')
    setSelectedId(null)
  }

  const seleccion = selectedId ? { hermano: hermanoDe(selectedId), renovacion: renovacionDeHermano(selectedId, papeletas, campana) } : null

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Papeletas de sitio</p>
          <h1>Renovación de papeletas</h1>
          <p className="dash-head__lead">
            Campaña {campana.anio} · el censo entero, con quién ha renovado su sitio y quién no.{' '}
            <Link to="/app/configuracion" className="dash-head__link">
              Personalizar datos de la hermandad
            </Link>
          </p>
        </div>
        <div className="dash-head__actions">
          {solicitudesPendientes.length > 0 && (
            <button className="btn btn-outline" onClick={() => setSolicitudesOpen(true)}>
              Solicitudes ({solicitudesPendientes.length})
            </button>
          )}
          <MenuAcciones>
            <button type="button" onClick={() => setModeloOpen(true)}>
              Modelo de papeleta
            </button>
            <button type="button" onClick={() => setAjustesOpen(true)}>
              Ajustes de campaña
            </button>
          </MenuAcciones>
          <button className="btn btn-primary" onClick={() => setImprimirOpen(true)}>
            Imprimir papeletas
          </button>
        </div>
      </div>

      <div className={`banner-inline ${abierta ? 'banner-inline--accent' : 'banner-inline--warn'}`}>
        {abierta ? (
          <>
            Renovación <b>abierta</b> hasta el {fmtIso(campana.fechaLimiteRenovacion)}
            {diasRestantes >= 0 && ` · quedan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`}. Quien no renueve
            antes pierde su sitio del año anterior.
          </>
        ) : (
          <>
            Renovación <b>cerrada</b> el {fmtIso(campana.fechaLimiteRenovacion)}. Los hermanos que no renovaron han
            perdido su sitio y quedan como «No renovada».
          </>
        )}
      </div>

      {/* Convocatoria: avisar a todos los hermanos de la apertura del plazo */}
      <div className="banner-inline banner-inline--accent" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {convocatoria && convocatoria.anio === campana.anio ? (
          <span>
            📣 Convocatoria enviada el {fmtIso(convocatoria.fecha)} a <b>{convocatoria.total}</b> hermanos. Ya pueden
            solicitar su papeleta desde su área.
          </span>
        ) : (
          <span>
            Avisa a los <b>{destinatariosConvocatoria(hermanos).length}</b> hermanos de que pueden solicitar su papeleta
            de sitio {campana.anio}.
          </span>
        )}
        <button className="btn btn-primary btn-sm" onClick={convocar} disabled={convocando}>
          {convocando
            ? 'Enviando…'
            : convocatoria && convocatoria.anio === campana.anio
              ? 'Reenviar convocatoria'
              : 'Convocar papeletas'}
        </button>
      </div>

      {/* Avisos de portada: lo que la secretaría debe mirar de un vistazo */}
      {(stats.pendientePago > 0 || tramosCasiLlenos.length > 0 || solicitudesPendientes.length > 0 || (abierta && stats.porRenovar > 0)) && (
        <div className="avisos-band">
          {solicitudesPendientes.length > 0 && (
            <button type="button" className="aviso aviso--info" onClick={() => setSolicitudesOpen(true)} style={{ cursor: 'pointer' }}>
              🔔 {solicitudesPendientes.length} solicitud{solicitudesPendientes.length === 1 ? '' : 'es'} de papeleta por revisar
            </button>
          )}
          {stats.pendientePago > 0 && (
            <span className="aviso aviso--warn">{stats.pendientePago} papeleta{stats.pendientePago === 1 ? '' : 's'} pendiente{stats.pendientePago === 1 ? '' : 's'} de pago</span>
          )}
          {tramosCasiLlenos.map((nombre) => (
            <span key={nombre} className="aviso aviso--warn">{nombre} casi completo</span>
          ))}
          {abierta && stats.porRenovar > 0 && (
            <span className="aviso aviso--neutral">{stats.porRenovar} por renovar</span>
          )}
        </div>
      )}

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Papeletas emitidas</span>
          <span className="stat-tile__value">{stats.emitidas}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Campaña {campana.anio}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Recaudado</span>
          <span className="stat-tile__value">{formatCurrency(stats.recaudado)}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Pagadas y entregadas</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Entregadas</span>
          <span className="stat-tile__value">{stats.entregadas}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">de {stats.emitidas} emitidas</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Pendiente de pago</span>
          <span className="stat-tile__value">{stats.pendientePago}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.pendientePago > 0 ? 'warn' : 'ok'}`}>
            Emitidas sin cobrar
          </span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por hermano, nº o DNI"
          aria-label="Buscar papeletas por hermano, número o DNI"
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
              {f}
            </button>
          ))}
        </div>
        <select
          className="search-box"
          style={{ maxWidth: '13rem' }}
          value={orden}
          onChange={(e) => setOrden(e.target.value as 'numero' | 'antiguedad')}
          aria-label="Ordenar"
        >
          <option value="numero">Por nº de hermano</option>
          <option value="antiguedad">Por antigüedad</option>
        </select>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th className="col-opcional">Nº</th>
              <th>Hermano</th>
              <th className="col-opcional">Antigüedad</th>
              <th className="col-opcional">Sitio {campana.anio - 1}</th>
              <th>Estado {campana.anio}</th>
              <th>Sitio {campana.anio}</th>
              <th className="col-opcional"></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ hermano: h, renovacion: r }) => {
              const tramoAnterior = tramoDe(r.sitioAnterior?.tramoId ?? null)
              const aniosEnLaHermandad = aniosDeHermandad(h.antiguedad, campana.anio)
              const asigActual = r.papeletaActual ? asignacionPorPapeleta.get(r.papeletaActual.id) : undefined
              const tramoActual = asigActual?.tramo ?? null
              return (
                <tr key={h.id} {...filaQueAbre(() => abrirDetalle(h.id))}>
                  <td className="num col-opcional">{h.numero}</td>
                  <td>
                    <div className="row-person">
                      <span className="row-avatar">{initials(h.nombre)}</span>
                      <span>
                        <span className="row-person__name">{h.nombre}</span>
                        <span className="row-person__sub">Nº {h.numero} · {h.estado}</span>
                        {/* En el móvil se ocultan sus columnas: el dato baja aquí. */}
                        <span className="row-person__sub solo-movil">
                          {aniosEnLaHermandad === null ? 'Antigüedad sin registrar' : `${aniosEnLaHermandad} años`}
                          {' · '}
                          {tramoAnterior ? etiquetaTramo(tramoAnterior) : 'sin sitio anterior'}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="table-subtle td-nowrap col-opcional">
                    {/* La antigüedad manda en el reparto del cortejo, así que
                        cuando no consta hay que decirlo, no poner un número
                        inventado. Aquí llegó a salir «NaN años». */}
                    {aniosEnLaHermandad === null ? (
                      <span className="table-muted">Sin registrar</span>
                    ) : (
                      <>
                        {aniosEnLaHermandad} años
                        <span className="table-muted"> · {h.antiguedad}</span>
                      </>
                    )}
                  </td>
                  <td className="col-opcional">{tramoAnterior ? etiquetaTramo(tramoAnterior) : <span className="table-muted">—</span>}</td>
                  <td>
                    <span className={`pill ${claseEstado(r.estado)}`}>{r.estado}</span>
                  </td>
                  <td>
                    {tramoActual ? (
                      <>
                        {etiquetaTramo(tramoActual)}
                        {asigActual?.estado === 'Excede aforo' && (
                          <span className="table-subtle"> · excede aforo</span>
                        )}
                      </>
                    ) : r.papeletaActual?.opcion && r.papeletaActual.estado !== 'Renuncia' ? (
                      <>
                        {/* La pregunta de quien mira esta columna es si esa
                            persona camina o no. Se responde. */}
                        {r.papeletaActual.opcion}
                        <span className="table-subtle"> · no sale en el cortejo</span>
                      </>
                    ) : (
                      <span className="table-muted">—</span>
                    )}
                  </td>
                  <td className="col-opcional">
                    <button
                      className="icon-btn"
                      title="Ver ficha"
                      onClick={(e) => {
                        e.stopPropagation()
                        abrirDetalle(h.id)
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                  </td>
                </tr>
              )
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">
                  No hay hermanos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ficha del hermano en la campaña */}
      <Drawer
        open={!!seleccion?.hermano}
        onClose={() => setSelectedId(null)}
        title={seleccion?.hermano?.nombre ?? ''}
        subtitle={seleccion?.hermano ? `Hermano nº ${seleccion.hermano.numero}` : undefined}
      >
        {seleccion?.hermano &&
          (() => {
            const h = seleccion.hermano
            const r = seleccion.renovacion
            const tramoAnterior = tramoDe(r.sitioAnterior?.tramoId ?? null)
            const actual = r.papeletaActual
            const asig = actual ? asignacionPorPapeleta.get(actual.id) : undefined
            const tramoActual = asig?.tramo ?? null
            // Última papeleta anulada de la campaña (anular ≠ borrar): se conserva.
            const anuladaActual = papeletas.find(
              (p) => p.hermanoId === h.id && p.anio === campana.anio && p.estado === 'Anulada',
            )
            const deuda = deudaDe(h.id)
            const bloqueadoPorDeuda = ajustes.bloquearPapeletaConDeuda && deuda > 0
            const puedeSacar = (r.estado === 'Sin papeleta' || r.estado === 'No renovada') && !bloqueadoPorDeuda
            return (
              <div className="ficha">
                <div className="ficha__row">
                  <span className={`pill ${claseEstado(r.estado)}`}>{r.estado}</span>
                  {tramoAnterior && (
                    <span className="pill pill--info">Sitio {campana.anio - 1}: {etiquetaTramo(tramoAnterior)}</span>
                  )}
                </div>

                {/* Aviso de cuotas pendientes */}
                {deuda > 0 && (
                  <div className={`banner-inline ${bloqueadoPorDeuda ? 'banner-inline--warn' : 'banner-inline--accent'}`}>
                    ⚠️ {h.nombre.split(' ')[0]} tiene <b>{formatCurrency(deuda)}</b> en cuotas pendientes.{' '}
                    {bloqueadoPorDeuda
                      ? 'No se le puede sacar papeleta hasta regularizar (ver Ajustes de campaña).'
                      : 'Puedes emitir igualmente o pedirle que regularice.'}
                  </div>
                )}

                {/* Por renovar: renovar o renunciar */}
                {r.estado === 'Por renovar' && !bloqueadoPorDeuda && r.sitioAnterior && tramoAnterior && (
                  <div className="assign-box">
                    <label>Renovación del sitio del año anterior</label>
                    <p className="form-hint">
                      {h.nombre} salió en <b>{etiquetaTramo(tramoAnterior)}</b> el año pasado. Puede mantener ese sitio o
                      renunciar a él.
                    </p>
                    <div className="assign-box__row">
                      <button
                        className="btn btn-primary"
                        // El precio es el de ESTE año, no el de la papeleta
                        // anterior: si la hermandad sube el precio del tramo,
                        // quien renovaba seguía pagando el viejo y dos hermanos
                        // del mismo tramo pagaban cantidades distintas.
                        onClick={() => renovar(h.id, r.sitioAnterior!.tramoId!)}
                      >
                        Renovar {etiquetaTramo(tramoAnterior)}
                      </button>
                      <button className="btn btn-ghost" onClick={() => noRenovar(h.id)}>
                        No renovar
                      </button>
                    </div>
                  </div>
                )}

                {/* Sin papeleta o No renovada: sacar papeleta eligiendo tramo */}
                {puedeSacar && (
                  <div className="assign-box">
                    <label htmlFor="cuerpoSacar">
                      {r.estado === 'No renovada' ? 'Volver a sacar papeleta' : 'Sacar papeleta'}
                    </label>
                    <div className="form-grid-2">
                      <select
                        id="cuerpoSacar"
                        value={pendingCuerpo}
                        onChange={(e) => setPendingCuerpo(e.target.value)}
                      >
                        <option value="">Elige un cuerpo</option>
                        {cuerposDisponibles.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        {/* Va la última y separada: no es «otro cuerpo más»,
                            es la excepción — el que no sale. */}
                        <option value={SIMBOLICA}>No sale · papeleta simbólica</option>
                      </select>
                      <select
                        id="tramoSacar"
                        defaultValue=""
                        disabled={!pendingCuerpo}
                        key={pendingCuerpo}
                        onChange={(e) => {
                          if (!e.target.value) return
                          if (pendingCuerpo === SIMBOLICA) {
                            sacarSimbolica(h.id)
                          } else {
                            sacarEnTramo(h.id, e.target.value)
                          }
                        }}
                      >
                        <option value="" disabled>
                          {pendingCuerpo === SIMBOLICA
                            ? 'Confirma…'
                            : pendingCuerpo
                              ? 'Elige el puesto…'
                              : 'Elige antes un cuerpo'}
                        </option>
                        {/* La simbólica no tiene puesto que elegir, así que el
                            segundo desplegable solo sirve para confirmar. */}
                        {pendingCuerpo === SIMBOLICA
                          ? (
                              <option value="si">
                                Papeleta simbólica — {hermandad.precioSimbolica} €
                              </option>
                            )
                          : (() => {
                              const grupos = gruposAutomaticos(tramosDelCuerpoElegido)
                              const designados = tramosDelCuerpoElegido.filter((t) => !esAutomatico(t))
                              return (
                                <>
                                  {grupos.map((g) => {
                                    const ocupados = g.tramos.reduce((s, t) => s + (ocupadosPorTramo.get(t.id) ?? 0), 0)
                                    const aforo = g.tramos.reduce((s, t) => s + t.capacidad, 0)
                                    return (
                                      <option key={g.tramos[0].id} value={g.tramos[0].id}>
                                        {g.etiqueta} (por número) — {ocupados}/{aforo}
                                        {ocupados >= aforo ? ' · completo' : ''}
                                      </option>
                                    )
                                  })}
                                  {designados.map((t) => {
                                    const ocupados = ocupadosPorTramo.get(t.id) ?? 0
                                    return (
                                      <option key={t.id} value={t.id}>
                                        {t.nombre}
                                        {t.tipo ? ` (${t.tipo})` : ''} — {ocupados}/{t.capacidad} · {precioDeTramo(t, precioBase)} €
                                        {ocupados >= t.capacidad ? ' · completo' : ''}
                                      </option>
                                    )
                                  })}
                                </>
                              )
                            })()}
                      </select>
                    </div>
                    <p className="form-hint">
                      Los tramos «por número» se colocan solos por número de hermano; los «por solicitud» (vara, cruz
                      de guía…) se dan al solicitante de menor número. Las papeletas personalizadas (mantilla,
                      simbólica…) no ocupan sitio en el cortejo.{' '}
                      <Link to="/app/configuracion">Configura cuerpos, tramos, precios y papeletas</Link>.
                    </p>
                  </div>
                )}

                {/* Tiene papeleta este año: mostrar el ticket y sus acciones */}
                {actual && actual.estado !== 'Renuncia' && (
                  <>
                    <div className="assign-box__row no-print" style={{ marginBottom: '0.6rem' }}>
                      <button
                        type="button"
                        className={`chip chip--toggle${variantePapeleta === 'movil' ? ' chip--active' : ''}`}
                        onClick={() => setVariantePapeleta('movil')}
                      >
                        📱 Móvil (con QR)
                      </button>
                      <button
                        type="button"
                        className={`chip chip--toggle${variantePapeleta === 'fisica' ? ' chip--active' : ''}`}
                        onClick={() => setVariantePapeleta('fisica')}
                      >
                        🖨️ Física (sin QR)
                      </button>
                      <button
                        type="button"
                        className={`chip chip--toggle${variantePapeleta === 'ambas' ? ' chip--active' : ''}`}
                        onClick={() => setVariantePapeleta('ambas')}
                      >
                        📱+🖨️ Las dos
                      </button>
                    </div>
                    {/* Contenedor de las versiones: al imprimir «las dos», es el que sale
                        del flujo para que cada versión caiga en su propia página. */}
                    <div className="papeleta-versiones">
                    {variantePapeleta !== 'fisica' && (
                      <div className="papeleta-variante">
                        {variantePapeleta === 'ambas' && (
                          <p className="papeleta-variante__lbl no-print">📱 Versión de móvil · con QR</p>
                        )}
                        {modelo ? (
                          <PapeletaModeloRender
                            modelo={modelo}
                            sinQr={false}
                            datos={{
                              hermano: h,
                              papeleta: actual,
                              tramoEtiqueta: tramoActual ? etiquetaTramo(tramoActual) : null,
                              puesto: asig?.puesto ?? null,
                              hermandadNombre: hermandad.nombreLegal || (user?.user_metadata?.hermandad as string | undefined) || '',
                              fechaSalida: campana.fechaSalida,
                            }}
                          />
                        ) : (
                          <PapeletaTicket
                            papeleta={actual}
                            hermano={h}
                            hermandad={hermandad}
                            tramo={tramoActual}
                            puesto={asig?.puesto ?? null}
                            excedeAforo={asig?.estado === 'Excede aforo'}
                            opcion={actual.opcion}
                            sinQr={false}
                          />
                        )}
                      </div>
                    )}
                    {variantePapeleta !== 'movil' && (
                      <div className="papeleta-variante papeleta-variante--fisica">
                        {variantePapeleta === 'ambas' && (
                          <p className="papeleta-variante__lbl no-print">🖨️ Versión física · sin QR</p>
                        )}
                        {modelo ? (
                          <PapeletaModeloRender
                            modelo={modelo}
                            sinQr={true}
                            datos={{
                              hermano: h,
                              papeleta: actual,
                              tramoEtiqueta: tramoActual ? etiquetaTramo(tramoActual) : null,
                              puesto: asig?.puesto ?? null,
                              hermandadNombre: hermandad.nombreLegal || (user?.user_metadata?.hermandad as string | undefined) || '',
                              fechaSalida: campana.fechaSalida,
                            }}
                          />
                        ) : (
                          <PapeletaTicket
                            papeleta={actual}
                            hermano={h}
                            hermandad={hermandad}
                            tramo={tramoActual}
                            puesto={asig?.puesto ?? null}
                            excedeAforo={asig?.estado === 'Excede aforo'}
                            opcion={actual.opcion}
                            sinQr={true}
                          />
                        )}
                      </div>
                    )}
                    </div>
                    <p className="form-hint no-print">
                      {variantePapeleta === 'movil'
                        ? 'Versión de móvil: lleva el QR de verificación. Es la que se envía al hermano por correo (envío real al conectar la base de datos).'
                        : variantePapeleta === 'fisica'
                        ? 'Versión física: sin QR, pensada para imprimir en papel.'
                        : 'Se sacan las dos: la de móvil con QR (para enviar por correo) y la física sin QR (para imprimir). Al imprimir salen ambas.'}
                    </p>
                    <div className="assign-box__row no-print" style={{ marginTop: '0.4rem' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
                        {variantePapeleta === 'movil'
                          ? 'Descargar / enviar (con QR)'
                          : variantePapeleta === 'fisica'
                          ? 'Imprimir física (sin QR)'
                          : 'Imprimir / enviar las dos'}
                      </button>
                    </div>
                    {actual.estado === 'Asignada' && actual.pagoComunicado && (
                      <div className="banner-inline banner-inline--accent" style={{ marginTop: '1rem' }}>
                        {h.nombre.split(' ')[0]} avisó desde su área de que pagó por{' '}
                        <b>{actual.pagoComunicado.metodo}</b> el {actual.pagoComunicado.fecha}. Comprueba el ingreso en
                        la cuenta de la hermandad y confírmalo abajo.
                      </div>
                    )}
                    {/* Estado del pago: emitida (Asignada) ≠ pagada */}
                    {actual.estado === 'Asignada' && (
                      <div className="assign-box" style={{ marginTop: '1rem' }}>
                        <label>Registrar cobro</label>
                        <p className="form-hint">
                          Emitida el {actual.fechaSolicitud} · <b>{formatCurrency(actual.importe)}</b>. Aún sin cobrar.
                          {actual.pagoComunicado && ` ${h.nombre.split(' ')[0]} avisó de pago por ${actual.pagoComunicado.metodo} el ${actual.pagoComunicado.fecha}.`}
                        </p>
                        <div className="assign-box__row">
                          <select value={metodoPagoSel} onChange={(e) => setMetodoPagoSel(e.target.value as MetodoPagoPapeleta)}>
                            {METODOS_PAGO_PAPELETA.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <button className="btn btn-primary" onClick={() => registrarPago(actual.id, metodoPagoSel)}>
                            Registrar pago
                          </button>
                        </div>
                      </div>
                    )}
                    {(actual.estado === 'Pagada' || actual.estado === 'Entregada') && actual.metodoPago && (
                      <div className="banner-inline banner-inline--accent" style={{ marginTop: '1rem' }}>
                        Pagada por <b>{actual.metodoPago}</b>{actual.fechaPago ? ` el ${actual.fechaPago}` : ''}.
                      </div>
                    )}
                    <div className="assign-box__row" style={{ marginTop: '1rem' }}>
                      {actual.estado === 'Pagada' && (
                        <button
                          className="btn btn-primary"
                          onClick={() => actualizarPapeleta(actual.id, { estado: 'Entregada', fechaEntrega: hoy() })}
                        >
                          Marcar como entregada
                        </button>
                      )}
                    </div>
                    {(actual.estado === 'Solicitada' || actual.estado === 'Asignada' || actual.estado === 'Pagada') && (
                      <button type="button" className="ticket-cancel" onClick={() => anularPapeleta(actual.id)}>
                        Anular papeleta
                      </button>
                    )}
                  </>
                )}

                {!actual && anuladaActual && (
                  <div className="banner-inline banner-inline--warn">
                    Papeleta nº {String(anuladaActual.numero).padStart(4, '0')} <b>anulada</b>
                    {anuladaActual.motivoAnulacion ? ` · ${anuladaActual.motivoAnulacion}` : ''}. Se conserva el registro
                    (anular no es borrar). Puede volver a sacar papeleta arriba.
                  </div>
                )}

                {r.estado === 'No renovada' && actual?.estado === 'Renuncia' && (
                  <p className="form-hint">
                    {h.nombre} renunció a su sitio este año. Si cambia de idea, puede volver a sacar papeleta arriba.
                  </p>
                )}
              </div>
            )
          })()}
      </Drawer>

      {/* Ajustes de la campaña */}
      <Drawer
        open={ajustesOpen}
        onClose={() => setAjustesOpen(false)}
        title="Ajustes de campaña"
        subtitle={`Edición ${campana.anio}`}
      >
        <div className="app-form">
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="fechaIniPart">Inicio · participaron el año pasado</label>
              <input
                id="fechaIniPart"
                type="date"
                value={campana.fechaInicioParticiparon}
                onChange={(e) => guardarCampana({ ...campana, fechaInicioParticiparon: e.target.value })}
              />
              <p className="form-hint">Desde este día pueden solicitar los que salieron el año anterior (renovar).</p>
            </div>
            <div className="form-row">
              <label htmlFor="fechaIniNuevos">Inicio · no participaron</label>
              <input
                id="fechaIniNuevos"
                type="date"
                value={campana.fechaInicioNoParticiparon}
                onChange={(e) => guardarCampana({ ...campana, fechaInicioNoParticiparon: e.target.value })}
              />
              <p className="form-hint">Desde este día pueden solicitar el resto de hermanos (los que no salieron).</p>
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="fechaLimite">Fin del plazo (fecha límite)</label>
            <input
              id="fechaLimite"
              type="date"
              value={campana.fechaLimiteRenovacion}
              onChange={(e) => guardarCampana({ ...campana, fechaLimiteRenovacion: e.target.value })}
            />
            <p className="form-hint">Último día del plazo. Pasada esta fecha, quien no haya renovado pierde su sitio.</p>
          </div>
          <div className="form-row">
            <label htmlFor="fechaSalida">Día de la estación de penitencia</label>
            <input
              id="fechaSalida"
              type="date"
              value={campana.fechaSalida ?? ''}
              onChange={(e) => guardarCampana({ ...campana, fechaSalida: e.target.value || null })}
            />
          </div>

          <div className="assign-box">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={ajustes.bloquearPapeletaConDeuda}
                onChange={(e) => setAjustes({ ...ajustes, bloquearPapeletaConDeuda: e.target.checked })}
              />
              Bloquear la papeleta si el hermano tiene cuotas pendientes
            </label>
            <p className="form-hint">
              {ajustes.bloquearPapeletaConDeuda
                ? 'No se podrá sacar papeleta a quien deba cuotas hasta que regularice.'
                : 'Solo se avisa de la deuda, pero se puede emitir la papeleta igualmente.'}
            </p>
          </div>

          <div className="assign-box">
            <label>Cerrar campaña {campana.anio}</label>
            <p className="form-hint">
              Abre la campaña de {campana.anio + 1}: los sitios entregados este año pasan a ser renovables, y todos los
              hermanos vuelven a empezar en «Por renovar» o «Sin papeleta». No se borra nada: el historial queda
              guardado.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (window.confirm(`¿Abrir la campaña ${campana.anio + 1}? Los sitios de ${campana.anio} pasan a renovables.`)) {
                  abrirNuevoAno()
                  setAjustesOpen(false)
                }
              }}
            >
              Abrir campaña {campana.anio + 1}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Modelo de papeleta personalizado */}
      <Drawer
        open={modeloOpen}
        onClose={() => setModeloOpen(false)}
        title="Modelo de papeleta"
        subtitle="Sube tu diseño y coloca los datos"
      >
        <p className="form-hint">
          Sube la imagen de tu modelo de papeleta y coloca encima los datos del hermano. A partir
          de entonces, la papeleta de cada hermano se imprime sobre ese modelo con sus datos
          reales. Si borras el modelo, se vuelve a usar la papeleta estándar.
        </p>
        <ModeloPapeletaEditor modelo={modelo} onCambio={setModelo} />
      </Drawer>

      {/* Impresión masiva: elegir qué papeletas y generar un PDF con una por página */}
      <Drawer
        open={imprimirOpen}
        onClose={() => setImprimirOpen(false)}
        title="Imprimir papeletas"
        subtitle="Un PDF con una papeleta por página"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setImprimirOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={generarImpresion} disabled={totalAImprimir === 0}>
              Generar PDF ({totalAImprimir})
            </button>
          </>
        }
      >
        <div className="app-form">
          <p className="form-hint">
            Elige qué papeletas de la campaña {campana.anio} incluir. Se abrirá el diálogo de
            impresión; elige «Guardar como PDF» para obtener un único archivo con todas.
          </p>
          {(['Asignada', 'Pagada', 'Entregada'] as const).map((e) => (
            <label className="checkbox-row" key={e}>
              <input
                type="checkbox"
                checked={!!imprimirEstados[e]}
                onChange={(ev) => setImprimirEstados((prev) => ({ ...prev, [e]: ev.target.checked }))}
              />
              {e === 'Asignada' ? 'Emitidas (sin pagar)' : e === 'Pagada' ? 'Pagadas' : 'Entregadas'} — {contadorImpresion[e] ?? 0}
            </label>
          ))}
          <p className="form-hint" style={{ marginTop: '0.6rem' }}>
            Total a imprimir: <b>{totalAImprimir}</b> papeleta{totalAImprimir === 1 ? '' : 's'}. Cada una lleva su
            QR con los datos.
          </p>
        </div>
      </Drawer>

      {/* Solicitudes de papeleta enviadas por los hermanos desde su área */}
      <Drawer
        open={solicitudesOpen}
        onClose={() => setSolicitudesOpen(false)}
        title="Solicitudes de papeleta"
        subtitle={`${solicitudesPendientes.length} pendiente${solicitudesPendientes.length === 1 ? '' : 's'}`}
      >
        {solicitudesPendientes.length === 0 ? (
          <p className="form-hint">No hay solicitudes pendientes. Las que envíen los hermanos desde su área aparecerán aquí.</p>
        ) : (
          solicitudesPendientes.map((s) => (
            <div className="assign-box" key={s.id}>
              <div className="ficha__row">
                <b>{s.hermanoNombre}</b>
                <span className="pill pill--info">Nº {s.hermanoNumero}</span>
              </div>
              <dl className="ficha__list">
                <div><dt>Modalidad</dt><dd>{s.modalidad}</dd></div>
                {s.preferencia && <div><dt>Preferencia</dt><dd>{s.preferencia}</dd></div>}
                <div><dt>Tramo solicitado</dt><dd>{s.tramoSolicitado}</dd></div>
                {s.comentario && <div><dt>Comentario</dt><dd>{s.comentario}</dd></div>}
                <div><dt>Enviada</dt><dd>{s.fecha}</dd></div>
              </dl>
              <div className="assign-box__row">
                <button className="btn btn-primary btn-sm" onClick={() => aceptarSolicitud(s)}>Aceptar y emitir</button>
                <button className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => rechazarSolicitud(s)}>Rechazar</button>
              </div>
            </div>
          ))
        )}
      </Drawer>

      {/* Zona de impresión masiva: oculta en pantalla, visible al imprimir con la clase print-masivo */}
      {listaImpresion && (
        <div className="impresion-masiva" aria-hidden="true">
          {listaImpresion.map((it) => (
            <div className="impresion-masiva__pagina" key={it.papeleta.id}>
              <PapeletaTicket
                papeleta={it.papeleta}
                hermano={it.hermano}
                hermandad={hermandad}
                tramo={it.tramo}
                puesto={it.puesto}
                excedeAforo={it.excedeAforo}
                opcion={it.papeleta.opcion}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
