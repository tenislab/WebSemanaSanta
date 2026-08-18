import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import PapeletaTicket from '../../components/PapeletaTicket'
import PapeletaModeloRender from '../../components/PapeletaModeloRender'
import ModeloPapeletaEditor from '../../components/ModeloPapeletaEditor'
import { getModeloPapeleta, type ModeloPapeleta } from '../../lib/modeloPapeleta'
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
  getTramos,
  tramosDeCuerpo,
  etiquetaTramo,
  esAutomatico,
  gruposAutomaticos,
  cuerposPresentes,
  getPrecioBase,
  precioDeTramo,
  type Tramo,
} from '../../lib/tramos'
import { getOpcionesPapeleta, type OpcionPapeleta } from '../../lib/opcionesPapeleta'
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
import { CLAVES_DATOS, leerPersistido } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { papeletaToRow, rowToPapeleta } from '../../lib/db/papeletas'

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
const PERSONALIZADA = '__personalizada'

interface ItemImpresion {
  papeleta: Papeleta
  hermano: Hermano
  tramo: Tramo | null
  puesto: number | null
  excedeAforo: boolean
}

export default function Papeletas() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const hermandad = useHermandadSettings(fallbackNombre)
  const tramos = useMemo(() => getTramos(), [])
  const hermanos = useMemo(() => leerPersistido(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  const opcionesPersonalizadas = useMemo(() => getOpcionesPapeleta(), [])
  const precioBase = useMemo(() => getPrecioBase(), [])
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
    () => (pendingCuerpo && pendingCuerpo !== PERSONALIZADA ? tramosDeCuerpo(pendingCuerpo, tramos) : []),
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
          ? a.hermano.antiguedad - b.hermano.antiguedad || a.hermano.numero - b.hermano.numero
          : a.hermano.numero - b.hermano.numero,
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

  /** Siguiente número de papeleta a partir de la lista más reciente (dentro del updater, nunca del closure). */
  function siguienteNumero(lista: Papeleta[]) {
    return Math.max(0, ...lista.map((p) => p.numero)) + 1
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
  function renovar(hermanoId: string, tramoId: string, importe: number) {
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id ? { ...p, tramoId, opcion: null, estado: 'Asignada', importe } : p,
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
    setPendingCuerpo('')
  }

  /** Emite una papeleta personalizada de la hermandad (mantilla, simbólica…), sin tramo en el cortejo. */
  function sacarConOpcion(hermanoId: string, opcion: OpcionPapeleta) {
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id
            ? { ...p, tramoId: null, opcion: opcion.nombre, estado: 'Asignada', importe: opcion.importe, pagoComunicado: null }
            : p,
        )
      }
      const nueva: Papeleta = {
        id: nuevoId(),
        numero: siguienteNumero(prev),
        hermanoId,
        anio: campana.anio,
        tramoId: null,
        opcion: opcion.nombre,
        importe: opcion.importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    setPendingCuerpo('')
  }

  function actualizarPapeleta(id: string, cambios: Partial<Papeleta>) {
    setPapeletas((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)))
  }

  /** Registra el cobro de la papeleta con el método elegido (emitida → pagada). */
  function registrarPago(id: string, metodo: MetodoPagoPapeleta) {
    actualizarPapeleta(id, { estado: 'Pagada', metodoPago: metodo, fechaPago: hoy() })
  }

  /** Anular ≠ borrar: la papeleta se conserva como «Anulada», con su motivo. */
  function anularPapeleta(id: string) {
    const motivo = window.prompt('Motivo de la anulación (queda registrado):', '')
    if (motivo === null) return
    actualizarPapeleta(id, { estado: 'Anulada', motivoAnulacion: motivo.trim() || 'Sin especificar' })
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

  /** Abre el plazo avisando a todos los hermanos (email simulado + registro en Comunicados). */
  function convocar() {
    const total = enviarConvocatoria(campana.anio, hermanos, fmtIso(campana.fechaLimiteRenovacion))
    refrescarConvocatoria()
    window.alert(
      `Convocatoria enviada (simulada) a ${total} hermanos con correo. Queda registrada en Comunicados. ` +
        'El envío real de email se activará al conectar el proveedor.',
    )
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
    const ciriosConHueco = enCuerpo.filter((t) => esAutomatico(t) && libres(t) > 0).sort((a, b) => libres(b) - libres(a))
    if (ciriosConHueco.length > 0) return ciriosConHueco[0]
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
      .sort((a, b) => a.hermano.numero - b.hermano.numero)
    if (lista.length === 0) return
    setListaImpresion(lista)
    setImprimirOpen(false)
    // Espera a que se pinten las páginas antes de abrir el diálogo de impresión.
    document.body.classList.add('print-masivo')
    setTimeout(() => {
      window.print()
      document.body.classList.remove('print-masivo')
      setListaImpresion(null)
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
          <button className="btn btn-primary" onClick={() => setImprimirOpen(true)}>
            Imprimir papeletas
          </button>
          <button className="btn btn-outline" onClick={() => setModeloOpen(true)}>
            Modelo de papeleta
          </button>
          <button className="btn btn-outline" onClick={() => setAjustesOpen(true)}>
            Ajustes de campaña
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
        <button className="btn btn-primary btn-sm" onClick={convocar}>
          {convocatoria && convocatoria.anio === campana.anio ? 'Reenviar convocatoria' : 'Convocar papeletas'}
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
            <span className="aviso aviso--warn">⚠️ {stats.pendientePago} papeleta{stats.pendientePago === 1 ? '' : 's'} pendiente{stats.pendientePago === 1 ? '' : 's'} de pago</span>
          )}
          {tramosCasiLlenos.map((nombre) => (
            <span key={nombre} className="aviso aviso--warn">🟡 {nombre} casi completo</span>
          ))}
          {abierta && stats.porRenovar > 0 && (
            <span className="aviso aviso--neutral">↻ {stats.porRenovar} por renovar</span>
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
          <option value="numero">Ordenar por nº de hermano</option>
          <option value="antiguedad">Ordenar por antigüedad</option>
        </select>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Hermano</th>
              <th>Antigüedad</th>
              <th>Sitio {campana.anio - 1}</th>
              <th>Estado {campana.anio}</th>
              <th>Sitio {campana.anio}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ hermano: h, renovacion: r }) => {
              const tramoAnterior = tramoDe(r.sitioAnterior?.tramoId ?? null)
              const asigActual = r.papeletaActual ? asignacionPorPapeleta.get(r.papeletaActual.id) : undefined
              const tramoActual = asigActual?.tramo ?? null
              return (
                <tr key={h.id} onClick={() => abrirDetalle(h.id)} style={{ cursor: 'pointer' }}>
                  <td className="num">{h.numero}</td>
                  <td>
                    <div className="row-person">
                      <span className="row-avatar">{initials(h.nombre)}</span>
                      <span>
                        <span className="row-person__name">{h.nombre}</span>
                        <span className="row-person__sub">{h.estado}</span>
                      </span>
                    </div>
                  </td>
                  <td className="table-subtle">
                    {Math.max(0, campana.anio - h.antiguedad)} años
                    <span className="table-muted"> · {h.antiguedad}</span>
                  </td>
                  <td>{tramoAnterior ? etiquetaTramo(tramoAnterior) : <span className="table-muted">—</span>}</td>
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
                        {r.papeletaActual.opcion}
                        <span className="table-subtle"> · personalizada</span>
                      </>
                    ) : (
                      <span className="table-muted">—</span>
                    )}
                  </td>
                  <td>
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
                        onClick={() => renovar(h.id, r.sitioAnterior!.tramoId!, r.sitioAnterior!.importe || precioDeTramo(tramoAnterior, precioBase))}
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
                        {opcionesPersonalizadas.length > 0 && (
                          <option value={PERSONALIZADA}>Papeleta personalizada</option>
                        )}
                      </select>
                      <select
                        id="tramoSacar"
                        defaultValue=""
                        disabled={!pendingCuerpo}
                        key={pendingCuerpo}
                        onChange={(e) => {
                          if (!e.target.value) return
                          if (pendingCuerpo === PERSONALIZADA) {
                            const op = opcionesPersonalizadas.find((o) => o.id === e.target.value)
                            if (op) sacarConOpcion(h.id, op)
                          } else {
                            sacarEnTramo(h.id, e.target.value)
                          }
                        }}
                      >
                        <option value="" disabled>
                          {pendingCuerpo === PERSONALIZADA
                            ? 'Mantilla, simbólica…'
                            : pendingCuerpo
                              ? 'Elige el puesto…'
                              : 'Elige antes un cuerpo'}
                        </option>
                        {pendingCuerpo === PERSONALIZADA
                          ? opcionesPersonalizadas.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.nombre} — {o.importe} €
                              </option>
                            ))
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
                    {modelo ? (
                      <PapeletaModeloRender
                        modelo={modelo}
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
                      />
                    )}
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
                      <button className="btn btn-outline" onClick={() => window.print()}>
                        Imprimir / Descargar
                      </button>
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
