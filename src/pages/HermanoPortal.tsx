import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LogoMark } from '../components/Logo'
import EscudoHermandad from '../components/EscudoHermandad'
import PapeletaTicket from '../components/PapeletaTicket'
import PapeletaModeloRender from '../components/PapeletaModeloRender'
import AsistenciaTramo from '../components/AsistenciaTramo'
import { getModeloPapeleta } from '../lib/modeloPapeleta'
import { HERMANOS_INICIALES, type Hermano } from '../data/hermanos'
import { CUOTAS_INICIALES, type Cuota } from '../data/cuotas'
import { PAPELETAS_INICIALES, type MetodoPago, type Papeleta } from '../data/papeletas'
import { useHermandadSettings } from '../lib/hermandadSettings'
import {
  getTramos,
  etiquetaTramo,
  cuerposPresentes,
  getPrecioBase,
  precioDeTramo,
} from '../lib/tramos'
import { repartoCompleto, repartoPorTramo, asignacionPorPapeleta as mapAsignaciones } from '../lib/cortejo'
import { getCampana, renovacionDeHermano, ventanaAbiertaPara, diasHasta, participoEnCampana } from '../lib/campana'
import {
  useSolicitudesPapeleta,
  MODALIDADES,
  type ModalidadPapeleta,
} from '../lib/solicitudesPapeleta'
import { CLAVES_DATOS, leerPersistido } from '../lib/persistencia'
import { restaurarCensoDemo, marcarModoDemo } from '../lib/demo'
import { useAvisosHermano } from '../lib/avisosHermano'
import { nuevoId, useSupabaseTable } from '../lib/supabaseSync'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { hermanoToRow, rowToHermano } from '../lib/db/hermanos'
import { papeletaToRow, rowToPapeleta } from '../lib/db/papeletas'
import { cuotaToRow, rowToCuota } from '../lib/db/cuotas'
import { formatCurrency, formatDate } from '../lib/format'
import { exportarDatosHermano, recopilarDatosHermano } from '../lib/rgpd'
import { descargarArchivo } from '../lib/csv'
import { estiloTema, inicialesHermandad } from '../lib/color'
import {
  ID_HERMANDAD_PRINCIPAL,
  HERMANDADES_MUESTRA,
  HERMANOS_MUESTRA,
  buscarHermandades,
  type HermandadDirectorio,
  type HermanoDirectorio,
  type IconoHermandad,
} from '../lib/hermandades'
import { crearSolicitudPrincipal, claveSolicitudesMuestra, type SolicitudAlta } from '../lib/solicitudes'

const SESION_KEY = 'cabildo-hermano-portal'
const CONSENT_KEY = 'cabildo-hermano-consent'
const DNI_DEMO = 'h4' // Francisco Gómez Nieto, nº 501 · usado por el botón "hermano de prueba"


interface Sesion {
  hermandadId: string
  hermanoId: string
}

function leerSesion(): Sesion | null {
  try {
    const raw = sessionStorage.getItem(SESION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Sesion>
    if (parsed && typeof parsed.hermandadId === 'string' && typeof parsed.hermanoId === 'string') {
      return { hermandadId: parsed.hermandadId, hermanoId: parsed.hermanoId }
    }
  } catch {
    // sesión corrupta o de un formato anterior: se ignora
  }
  return null
}

function guardarSesion(sesion: Sesion) {
  sessionStorage.setItem(SESION_KEY, JSON.stringify(sesion))
}

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function claseCuota(estado: Cuota['estado']) {
  if (estado === 'Pagada') return 'pill--ok'
  if (estado === 'Pendiente') return 'pill--warn'
  return 'pill--err'
}

function normaliza(texto: string) {
  return texto.trim().toUpperCase()
}

type TablaMuestra<T> = Record<string, [T[], (updater: (prev: T[]) => T[]) => void]>

/** Censo o papeletas de cada hermandad de muestra, cada una con su clave propia — igual que en la base de datos real, cada hermandad vería solo sus filas. */
function useTablaPorHermandad<T>(prefijoClave: string, porDefecto: (hermandadId: string) => T[]): TablaMuestra<T> {
  const [mapa, setMapa] = useState<Record<string, T[]>>(() =>
    Object.fromEntries(
      HERMANDADES_MUESTRA.map((h) => [h.id, leerPersistido(`${prefijoClave}-${h.id}`, porDefecto(h.id))]),
    ),
  )
  return useMemo(() => {
    const tabla: TablaMuestra<T> = {}
    for (const h of HERMANDADES_MUESTRA) {
      tabla[h.id] = [
        mapa[h.id] ?? [],
        (updater) => {
          setMapa((prev) => {
            const next = updater(prev[h.id] ?? [])
            localStorage.setItem(`${prefijoClave}-${h.id}`, JSON.stringify(next))
            return { ...prev, [h.id]: next }
          })
        },
      ]
    }
    return tabla
  }, [mapa, prefijoClave])
}

function guardarSolicitudMuestra(hermandadId: string, nueva: SolicitudAlta) {
  const clave = claveSolicitudesMuestra(hermandadId)
  const prev = leerPersistido<SolicitudAlta[]>(clave, [])
  localStorage.setItem(clave, JSON.stringify([nueva, ...prev]))
}

export default function HermanoPortal() {
  const hermandadPrincipal = useHermandadSettings()
  const nombrePrincipal = hermandadPrincipal.nombreLegal || 'Tu hermandad (modo demo)'
  // Modo local efectivo: sin Supabase o con Supabase en pausa/caído. En ese
  // caso el acceso del hermano funciona igual, contra el censo del navegador
  // (si no, con Supabase dormido no se podría entrar como hermano).
  const { configured: usarSupabase } = useAuth()

  const [hermanos, setHermanos] = useSupabaseTable<Hermano>(
    'hermanos',
    CLAVES_DATOS.hermanos,
    HERMANOS_INICIALES,
    hermanoToRow,
    rowToHermano,
    'numero',
  )
  const [papeletas, setPapeletas] = useSupabaseTable<Papeleta>(
    'papeletas',
    CLAVES_DATOS.papeletas,
    PAPELETAS_INICIALES,
    papeletaToRow,
    rowToPapeleta,
  )
  const [cuotas] = useSupabaseTable<Cuota>(
    'cuotas',
    CLAVES_DATOS.cuotas,
    CUOTAS_INICIALES,
    cuotaToRow,
    rowToCuota,
  )

  // Censo y papeletas de cada hermandad de muestra: cada una guarda los suyos
  // aparte, igual que en la base de datos real cada hermandad vería solo sus filas.
  const censosMuestra = useTablaPorHermandad<HermanoDirectorio>(
    'cabildo-directorio',
    (id) => HERMANOS_MUESTRA[id] ?? [],
  )
  const papeletasMuestra = useTablaPorHermandad<Papeleta>('cabildo-papeletas', () => [])

  const tramos = useMemo(() => getTramos(), [])
  const campana = useMemo(() => getCampana(), [])
  const precioBase = useMemo(() => getPrecioBase(), [])
  const modeloPapeleta = useMemo(() => getModeloPapeleta(), [])

  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion())
  const [searchParams] = useSearchParams()

  // ---- Identificación: buscar hermandad → iniciar sesión o solicitar alta ----
  const [paso, setPaso] = useState<'buscar' | 'acceso'>('buscar')
  const [queryHermandad, setQueryHermandad] = useState('')
  const [hermandadElegida, setHermandadElegida] = useState<HermandadDirectorio | null>(null)
  const [modoAcceso, setModoAcceso] = useState<'login' | 'solicitud'>('login')
  const [dniInput, setDniInput] = useState(() => searchParams.get('dni') ?? '')
  const [claveInput, setClaveInput] = useState('')
  const [errorLogin, setErrorLogin] = useState<string | null>(null)
  const [solicitudEnviada, setSolicitudEnviada] = useState(false)
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null)

  const [datosGuardados, setDatosGuardados] = useState(false)
  const [bajaMuestraSolicitada, setBajaMuestraSolicitada] = useState(false)
  const [consent, setConsent] = useState<boolean>(() => localStorage.getItem(CONSENT_KEY) === 'si')
  const [claveError, setClaveError] = useState<string | null>(null)
  const [claveGuardada, setClaveGuardada] = useState(false)

  // Solicitud de papeleta de sitio (el hermano la pide; la secretaría la acepta o rechaza).
  const [solicitudesPapeleta, setSolicitudesPapeleta] = useSolicitudesPapeleta()
  const [solModalidad, setSolModalidad] = useState<ModalidadPapeleta>('Nazareno')
  const [solTramo, setSolTramo] = useState('')
  const [solPreferencia, setSolPreferencia] = useState('')
  const [solComentario, setSolComentario] = useState('')

  const esPrincipal = sesion?.hermandadId === ID_HERMANDAD_PRINCIPAL
  const hermanoPrincipal = useMemo(
    () => (esPrincipal && sesion ? hermanos.find((h) => h.id === sesion.hermanoId) ?? null : null),
    [esPrincipal, sesion, hermanos],
  )
  const hermanoMuestra = useMemo(() => {
    if (esPrincipal || !sesion) return null
    const censo = censosMuestra[sesion.hermandadId]?.[0] ?? []
    return censo.find((h) => h.id === sesion.hermanoId) ?? null
  }, [esPrincipal, sesion, censosMuestra])
  const hermandadMuestra = useMemo(
    () => (sesion ? HERMANDADES_MUESTRA.find((h) => h.id === sesion.hermandadId) ?? null : null),
    [sesion],
  )

  const hermanoActivo = hermanoPrincipal ?? hermanoMuestra
  const { avisos: avisosSecretaria, sinLeer: avisosSinLeer, marcarLeidos: marcarAvisosLeidos } =
    useAvisosHermano(hermanoActivo?.id ?? null)
  const nombreHermandadActiva = esPrincipal ? nombrePrincipal : hermandadMuestra?.nombre ?? 'tu hermandad'
  const colorActivo = esPrincipal ? hermandadPrincipal.colorPrimario : hermandadMuestra?.color ?? '#caa24a'
  const contactoActivo = esPrincipal
    ? { telefono: hermandadPrincipal.telefono, email: hermandadPrincipal.email }
    : { telefono: hermandadMuestra?.telefono ?? '', email: hermandadMuestra?.email ?? '' }

  // Papeleta activa del hermano en una hermandad de muestra (su propio subsistema).
  const listaPapeletasMuestra = !esPrincipal && sesion ? (papeletasMuestra[sesion.hermandadId]?.[0] ?? []) : []
  const papeletaMuestraActual = hermanoMuestra
    ? listaPapeletasMuestra.find(
        (p) => p.hermanoId === hermanoMuestra.id && p.anio === campana.anio && p.estado !== 'Anulada' && p.estado !== 'Renuncia',
      ) ?? null
    : null

  const datosPrincipalDirectorio = useMemo(
    () => ({
      nombre: nombrePrincipal,
      ciudad: hermandadPrincipal.ciudad,
      color: hermandadPrincipal.colorPrimario,
      telefono: hermandadPrincipal.telefono,
      email: hermandadPrincipal.email,
    }),
    [nombrePrincipal, hermandadPrincipal],
  )
  const opcionesHermandad = useMemo(
    () => buscarHermandades(queryHermandad, datosPrincipalDirectorio),
    [queryHermandad, datosPrincipalDirectorio],
  )

  function elegirHermandad(h: HermandadDirectorio) {
    setHermandadElegida(h)
    setPaso('acceso')
    setModoAcceso('login')
    setErrorLogin(null)
    setErrorSolicitud(null)
    setSolicitudEnviada(false)
    // Se conserva el DNI que venga en el enlace (…/hermano?dni=…), que es como
    // llegan los hermanos desde un correo: si no, al elegir hermandad se borraba.
    setDniInput(searchParams.get('dni') ?? '')
    setClaveInput('')
  }

  function volverABuscar() {
    setPaso('buscar')
    setHermandadElegida(null)
    setErrorLogin(null)
    setErrorSolicitud(null)
    setSolicitudEnviada(false)
  }

  /** DNI + contraseña, ya dentro de la hermandad elegida — no hace falta adivinar dónde busca. */
  async function identificar(e: FormEvent) {
    e.preventDefault()
    if (!hermandadElegida) return
    const dni = normaliza(dniInput)

    if (hermandadElegida.id === ID_HERMANDAD_PRINCIPAL) {
      if (usarSupabase && supabase) {
        const { data: email, error: rpcError } = await supabase.rpc('resolver_email_hermano', { p_dni: dni })
        if (rpcError || !email) {
          setErrorLogin('DNI o contraseña incorrectos.')
          return
        }
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: claveInput,
        })
        if (signInError || !signInData.session) {
          setErrorLogin('DNI o contraseña incorrectos.')
          return
        }
        const { data: fila } = await supabase.from('hermanos').select('*').eq('dni', dni).maybeSingle()
        if (!fila) {
          setErrorLogin('No se pudo cargar tu ficha. Inténtalo de nuevo en unos segundos.')
          return
        }
        const nueva = { hermandadId: ID_HERMANDAD_PRINCIPAL, hermanoId: fila.id as string }
        guardarSesion(nueva)
        setSesion(nueva)
        setErrorLogin(null)
        return
      }

      const encontrado = hermanos.find((h) => normaliza(h.dni) === dni && h.claveAcceso === claveInput)
      if (!encontrado) {
        setErrorLogin('DNI o contraseña incorrectos.')
        return
      }
      const nueva = { hermandadId: ID_HERMANDAD_PRINCIPAL, hermanoId: encontrado.id }
      guardarSesion(nueva)
      setSesion(nueva)
      setErrorLogin(null)
      return
    }

    const censo = censosMuestra[hermandadElegida.id]?.[0] ?? []
    const encontrado = censo.find((c) => normaliza(c.dni) === dni && c.claveAcceso === claveInput)
    if (!encontrado) {
      setErrorLogin('DNI o contraseña incorrectos.')
      return
    }
    const nueva = { hermandadId: hermandadElegida.id, hermanoId: encontrado.id }
    guardarSesion(nueva)
    setSesion(nueva)
    setErrorLogin(null)
  }

  /** Quien todavía no está en el censo pide el alta; la secretaría la aprueba o la rechaza desde Hermanos. */
  function solicitarAlta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!hermandadElegida) return
    const data = new FormData(e.currentTarget)
    const nombre = String(data.get('nombre') ?? '').trim()
    const dni = normaliza(String(data.get('dni') ?? ''))
    const email = String(data.get('email') ?? '').trim()
    const telefono = String(data.get('telefono') ?? '').trim()
    const clavePropuesta = String(data.get('clavePropuesta') ?? '')
    if (!nombre || !dni || !email || clavePropuesta.length < 6) {
      setErrorSolicitud('Rellena tu nombre, DNI, correo y una contraseña de al menos 6 caracteres.')
      return
    }

    const yaEsHermano =
      hermandadElegida.id === ID_HERMANDAD_PRINCIPAL
        ? hermanos.some((h) => normaliza(h.dni) === dni)
        : (censosMuestra[hermandadElegida.id]?.[0] ?? []).some((h) => normaliza(h.dni) === dni)
    if (yaEsHermano) {
      setErrorSolicitud('Ya hay un hermano/a con ese DNI en esta hermandad. Prueba a iniciar sesión.')
      return
    }

    const nueva: SolicitudAlta = {
      id: nuevoId(),
      nombre,
      dni,
      email,
      telefono,
      clavePropuesta,
      fecha: hoy(),
      estado: 'Pendiente',
    }

    if (hermandadElegida.id === ID_HERMANDAD_PRINCIPAL) {
      crearSolicitudPrincipal(nueva)
    } else {
      guardarSolicitudMuestra(hermandadElegida.id, nueva)
    }
    setErrorSolicitud(null)
    setSolicitudEnviada(true)
  }

  function entrarComoDemo(hermanoId: string = DNI_DEMO) {
    // El navegador puede tener un censo viejo (de pruebas anteriores) que ya no
    // incluye a este hermano de muestra. En vez de fallar, restauramos el censo
    // de ejemplo y recargamos: la sesión queda guardada y, al volver, el hermano
    // ya existe. Así el acceso demo funciona siempre, sin depender del estado
    // previo del navegador.
    if (!hermanos.some((h) => h.id === hermanoId)) {
      marcarModoDemo()
      restaurarCensoDemo()
      guardarSesion({ hermandadId: ID_HERMANDAD_PRINCIPAL, hermanoId })
      window.location.reload()
      return
    }
    marcarModoDemo()
    const nueva = { hermandadId: ID_HERMANDAD_PRINCIPAL, hermanoId }
    guardarSesion(nueva)
    setSesion(nueva)
  }

  // Unos cuantos hermanos del censo para entrar de un clic en modo local (igual
  // que los accesos rápidos del panel de la hermandad, pero del lado del hermano).
  const hermanosDemo = useMemo(
    () => hermanos.filter((h) => h.estado !== 'Baja').slice(0, 4),
    [hermanos],
  )

  function salir() {
    if (usarSupabase && supabase) {
      supabase.auth.signOut()
    }
    sessionStorage.removeItem(SESION_KEY)
    setSesion(null)
    setPaso('buscar')
    setHermandadElegida(null)
    setQueryHermandad('')
    setModoAcceso('login')
    setDniInput('')
    setClaveInput('')
    setSolicitudEnviada(false)
    setErrorSolicitud(null)
    setSolTramo('')
    setSolPreferencia('')
    setSolComentario('')
    setDatosGuardados(false)
    setBajaMuestraSolicitada(false)
    setErrorLogin(null)
    setClaveError(null)
    setClaveGuardada(false)
  }

  function aceptarConsentimiento() {
    localStorage.setItem(CONSENT_KEY, 'si')
    setConsent(true)
  }

  // ---- Datos personales editables ----
  function guardarDatos(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sesion) return
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const telefono = String(data.get('telefono') ?? '').trim()

    if (esPrincipal && hermanoPrincipal) {
      const direccion = String(data.get('direccion') ?? '').trim()
      setHermanos((prev) => prev.map((h) => (h.id === hermanoPrincipal.id ? { ...h, email, telefono, direccion } : h)))
    } else if (hermanoMuestra) {
      const [, setCenso] = censosMuestra[sesion.hermandadId]
      setCenso((prev) => prev.map((h) => (h.id === hermanoMuestra.id ? { ...h, email, telefono } : h)))
    }
    setDatosGuardados(true)
    setTimeout(() => setDatosGuardados(false), 2500)
  }

  async function cambiarClave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sesion || !hermanoActivo) return
    const data = new FormData(e.currentTarget)
    const actual = String(data.get('claveActual') ?? '')
    const nueva = String(data.get('claveNueva') ?? '')
    const confirmar = String(data.get('claveConfirmar') ?? '')

    if (nueva.length < 6) {
      setClaveError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (nueva !== confirmar) {
      setClaveError('Las dos contraseñas nuevas no coinciden.')
      return
    }

    if (esPrincipal && usarSupabase && supabase && hermanoPrincipal) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: hermanoPrincipal.email,
        password: actual,
      })
      if (verifyError) {
        setClaveError('La contraseña actual no es correcta.')
        return
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: nueva })
      if (updateError) {
        setClaveError('No se pudo cambiar la contraseña. Inténtalo de nuevo.')
        return
      }
      setClaveError(null)
      setClaveGuardada(true)
      e.currentTarget.reset()
      setTimeout(() => setClaveGuardada(false), 2500)
      return
    }

    if (actual !== hermanoActivo.claveAcceso) {
      setClaveError('La contraseña actual no es correcta.')
      return
    }

    if (esPrincipal && hermanoPrincipal) {
      setHermanos((prev) => prev.map((h) => (h.id === hermanoPrincipal.id ? { ...h, claveAcceso: nueva } : h)))
    } else if (hermanoMuestra) {
      const [, setCenso] = censosMuestra[sesion.hermandadId]
      setCenso((prev) => prev.map((h) => (h.id === hermanoMuestra.id ? { ...h, claveAcceso: nueva } : h)))
    }
    setClaveError(null)
    setClaveGuardada(true)
    e.currentTarget.reset()
    setTimeout(() => setClaveGuardada(false), 2500)
  }

  // ---- Papeleta de sitio (renovación / sacar) — solo hermandad principal ----
  const renovacion = useMemo(
    () => (hermanoPrincipal ? renovacionDeHermano(hermanoPrincipal.id, papeletas, campana) : null),
    [hermanoPrincipal, papeletas, campana],
  )
  const asignacion = useMemo(() => {
    const activas = papeletas.filter((p) => p.anio === campana.anio)
    return renovacion?.papeletaActual
      ? mapAsignaciones(repartoCompleto(tramos, activas, (id) => hermanos.find((h) => h.id === id), new Set())).get(
          renovacion.papeletaActual.id,
        )
      : undefined
  }, [papeletas, campana.anio, tramos, hermanos, renovacion])

  // Diputado de tramo: si el hermano tiene esa etiqueta y sitio asignado, puede
  // gestionar la asistencia de los hermanos de SU tramo desde su propia área.
  const esDiputadoTramo = useMemo(
    () => (hermanoPrincipal?.etiquetas ?? []).includes('Diputado de tramo'),
    [hermanoPrincipal],
  )
  const tramoDelDiputado = asignacion?.tramo ?? null
  const miembrosTramo = useMemo(() => {
    if (!esDiputadoTramo || !tramoDelDiputado) return []
    const activas = papeletas.filter((p) => p.anio === campana.anio)
    const porTramo = repartoPorTramo(
      repartoCompleto(tramos, activas, (id) => hermanos.find((h) => h.id === id), new Set()),
    )
    return (porTramo.get(tramoDelDiputado.id) ?? [])
      .filter((a) => a.estado !== 'Excede aforo')
      .map((a) => ({ hermano: a.hermano, puesto: a.puesto }))
  }, [esDiputadoTramo, tramoDelDiputado, papeletas, campana.anio, tramos, hermanos])

  const cuerposDisponibles = useMemo(() => cuerposPresentes(tramos), [tramos])
  /** ¿Participó el año anterior? (cualquier papeleta emitida, con o sin tramo): decide qué fecha de apertura le aplica. */
  const participoAnoAnterior = hermanoPrincipal
    ? participoEnCampana(hermanoPrincipal.id, papeletas, campana.anio - 1)
    : false
  /** Solicitud de papeleta que este hermano ya envió para la campaña activa (si la hay). */
  const miSolicitud = useMemo(
    () =>
      hermanoPrincipal
        ? solicitudesPapeleta.find((s) => s.hermanoId === hermanoPrincipal.id && s.anio === campana.anio) ?? null
        : null,
    [solicitudesPapeleta, hermanoPrincipal, campana.anio],
  )

  function nextNumeroPapeleta() {
    return Math.max(0, ...papeletas.map((p) => p.numero)) + 1
  }

  function renovarSitio() {
    if (!hermanoPrincipal || !renovacion?.sitioAnterior?.tramoId) return
    const tramoAnterior = tramos.find((t) => t.id === renovacion.sitioAnterior!.tramoId)
    const tramoId = renovacion.sitioAnterior.tramoId
    const importe = renovacion.sitioAnterior.importe || precioDeTramo(tramoAnterior, precioBase)
    setPapeletas((prev) => {
      // Reutilizamos la papeleta del año si ya existe, para no crear una fila duplicada.
      const actual = prev.find((p) => p.hermanoId === hermanoPrincipal.id && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id ? { ...p, tramoId, opcion: null, estado: 'Asignada', importe, pagoComunicado: null } : p,
        )
      }
      const nueva: Papeleta = {
        id: nuevoId(),
        numero: nextNumeroPapeleta(),
        hermanoId: hermanoPrincipal.id,
        anio: campana.anio,
        tramoId,
        importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
  }

  function noRenovar() {
    if (!hermanoPrincipal) return
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoPrincipal.id && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id ? { ...p, tramoId: null, opcion: null, estado: 'Renuncia', importe: 0, pagoComunicado: null } : p,
        )
      }
      const renuncia: Papeleta = {
        id: nuevoId(),
        numero: nextNumeroPapeleta(),
        hermanoId: hermanoPrincipal.id,
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
   * El hermano envía su solicitud de papeleta de sitio. No se emite la papeleta
   * todavía: queda «Pendiente» hasta que la secretaría la acepte o rechace desde
   * el módulo Papeletas. Así el reparto lo controla siempre la hermandad.
   */
  function enviarSolicitudPapeleta(e: FormEvent) {
    e.preventDefault()
    if (!hermanoPrincipal) return
    const nueva = {
      id: nuevoId(),
      hermanoId: hermanoPrincipal.id,
      hermanoNombre: hermanoPrincipal.nombre,
      hermanoNumero: hermanoPrincipal.numero,
      anio: campana.anio,
      modalidad: solModalidad,
      preferencia: solPreferencia.trim(),
      tramoSolicitado: solTramo || 'Sin preferencia',
      comentario: solComentario.trim(),
      fecha: hoy(),
      estado: 'Pendiente' as const,
    }
    setSolicitudesPapeleta([nueva, ...solicitudesPapeleta])
    setSolPreferencia('')
    setSolComentario('')
    setSolTramo('')
  }

  /** El hermano avisa de que ya ha pagado su papeleta por Bizum o transferencia; la secretaría lo confirma. */
  function comunicarPago(metodo: MetodoPago) {
    const p = renovacion?.papeletaActual
    if (!p) return
    setPapeletas((prev) => prev.map((x) => (x.id === p.id ? { ...x, pagoComunicado: { metodo, fecha: hoy() } } : x)))
  }

  // ---- Papeletas de las hermandades de muestra (cada una con su propio subsistema) ----
  function sacarMuestra(opcionId: string) {
    if (!sesion || !hermanoMuestra || !hermandadMuestra) return
    const op = hermandadMuestra.opcionesPapeleta.find((o) => o.id === opcionId)
    if (!op) return
    const [, setLista] = papeletasMuestra[sesion.hermandadId]
    setLista((prev) => {
      const numero = Math.max(0, ...prev.map((p) => p.numero)) + 1
      const nueva: Papeleta = {
        id: nuevoId(),
        numero,
        hermanoId: hermanoMuestra.id,
        anio: campana.anio,
        tramoId: null,
        opcion: op.nombre,
        importe: op.importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
  }

  function comunicarPagoMuestra(metodo: MetodoPago) {
    if (!sesion || !papeletaMuestraActual) return
    const [, setLista] = papeletasMuestra[sesion.hermandadId]
    setLista((prev) =>
      prev.map((p) => (p.id === papeletaMuestraActual.id ? { ...p, pagoComunicado: { metodo, fecha: hoy() } } : p)),
    )
  }

  // ---- RGPD ----
  async function descargarMisDatos() {
    if (esPrincipal && hermanoPrincipal) {
      const datos = await recopilarDatosHermano(hermanoPrincipal.id)
      if (!datos) return
      const slug = hermanoPrincipal.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      descargarArchivo(`mis-datos-${slug}.json`, exportarDatosHermano(datos), 'application/json;charset=utf-8;')
      return
    }
    if (hermanoMuestra) {
      const slug = hermanoMuestra.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      descargarArchivo(
        `mis-datos-${slug}.json`,
        JSON.stringify({ hermandad: nombreHermandadActiva, hermano: hermanoMuestra }, null, 2),
        'application/json;charset=utf-8;',
      )
    }
  }

  function solicitarBaja() {
    if (!window.confirm('¿Seguro que quieres solicitar la baja como hermano/a? La secretaría tramitará tu solicitud.')) return
    if (esPrincipal && hermanoPrincipal) {
      // Es una SOLICITUD: no se da de baja solo. Queda marcada para que la
      // secretaría la tramite desde el censo (Hermanos › ficha › Dar de baja).
      setHermanos((prev) => prev.map((h) => (h.id === hermanoPrincipal.id ? { ...h, bajaSolicitada: true } : h)))
    } else {
      setBajaMuestraSolicitada(true)
    }
  }

  /** ¿Ya está pedida la baja? (guardada en el censo, o marcada en una hermandad de muestra). */
  const bajaPedida = esPrincipal ? Boolean(hermanoPrincipal?.bajaSolicitada) : bajaMuestraSolicitada

  const misCuotas = useMemo(
    () => (hermanoPrincipal ? cuotas.filter((c) => c.hermanoId === hermanoPrincipal.id) : []),
    [cuotas, hermanoPrincipal],
  )

  // ===================== Pantalla de identificación =====================
  if (!hermanoActivo) {
    return (
      <div className="portal" style={estiloTema(hermandadElegida?.color ?? '#caa24a')}>
        <PortalHead
          hermandad={hermandadElegida?.nombre ?? 'Cabildo'}
          logo={null}
          color={hermandadElegida?.color}
          icono={hermandadElegida?.icono}
        />
        <main className="portal__stage">
          <aside className="portal__aside" style={{ ['--portal-accent' as string]: hermandadElegida?.color ?? colorActivo }}>
            <div className="portal__aside-badge">
              <LogoMark size={40} />
            </div>
            <h2 className="portal__aside-title">Tu hermandad, en tu bolsillo</h2>
            <p className="portal__aside-sub">Entra en tu área personal y gestiona todo sin pasar por secretaría.</p>
            <ul className="portal__aside-list">
              <li>Tus cuotas y recibos al día</li>
              <li>Tu papeleta de sitio y su pago</li>
              <li>Solicitudes y tus datos personales</li>
              <li>Avisos y comunicados de la hermandad</li>
            </ul>
          </aside>
          <div className="portal__card">
            {paso === 'buscar' && (
              <>
                <p className="eyebrow">Área del hermano</p>
                <h1>Busca tu hermandad</h1>
                <p className="portal__lead">Escribe el nombre o la ciudad para encontrarla y entrar en tu área.</p>

                <div className="form-row">
                  <label htmlFor="buscarHermandad">Tu hermandad</label>
                  <input
                    id="buscarHermandad"
                    type="text"
                    value={queryHermandad}
                    onChange={(e) => setQueryHermandad(e.target.value)}
                    placeholder="Nombre o ciudad…"
                    autoFocus
                  />
                </div>
                <ul className="portal__picker">
                  {opcionesHermandad.map((h) => (
                    <li key={h.id}>
                      <button type="button" className="portal__picker-item" onClick={() => elegirHermandad(h)}>
                        <EscudoHermandad color={h.color} icono={h.icono} size={30} />
                        <span>
                          <b>{h.nombre}</b>
                          {h.ciudad && <small>{h.ciudad}</small>}
                        </span>
                      </button>
                    </li>
                  ))}
                  {opcionesHermandad.length === 0 && (
                    <li className="portal__picker-empty">No encontramos ninguna hermandad con ese nombre.</li>
                  )}
                </ul>

                {!usarSupabase && (
                  <div className="banner banner--info banner--demo" role="status" style={{ marginTop: '0.4rem' }}>
                    <div>
                      <strong>Modo demostración.</strong> Entra con datos de ejemplo (censo, cuotas y
                      papeleta) y prueba el área del hermano sin escribir nada.
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-block"
                      onClick={() => entrarComoDemo()}
                    >
                      Entrar en modo demo (datos de ejemplo)
                    </button>
                    {hermanosDemo.length > 0 && (
                      <>
                        <div className="demo-accounts__label">O entra como un hermano concreto:</div>
                        <div className="demo-accounts">
                          {hermanosDemo.map((h) => (
                            <button
                              type="button"
                              key={h.id}
                              className="demo-account"
                              onClick={() => entrarComoDemo(h.id)}
                            >
                              <span className="demo-account__avatar">{inicialesHermandad(h.nombre)}</span>
                              <span>
                                <b>{h.nombre}</b>
                                <small>Hermano/a nº {h.numero}</small>
                                <small className="demo-account__cred">DNI {h.dni} · {h.claveAcceso}</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="portal__foot">
                  <Link to="/" className="portal__foot-back">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    Volver a la portada
                  </Link>
                </div>
              </>
            )}

            {paso === 'acceso' && hermandadElegida && (
              <>
                <button type="button" className="portal__back" onClick={volverABuscar}>
                  ← Cambiar de hermandad
                </button>
                <div className="portal__chosen" style={{ borderColor: hermandadElegida.color }}>
                  <EscudoHermandad color={hermandadElegida.color} icono={hermandadElegida.icono} size={34} />
                  <span>
                    <b>{hermandadElegida.nombre}</b>
                    {hermandadElegida.ciudad && <small>{hermandadElegida.ciudad}</small>}
                  </span>
                </div>

                <div className="portal__tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={modoAcceso === 'login'}
                    className={`portal__tab${modoAcceso === 'login' ? ' portal__tab--active' : ''}`}
                    onClick={() => setModoAcceso('login')}
                  >
                    Ya soy hermano/a
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={modoAcceso === 'solicitud'}
                    className={`portal__tab${modoAcceso === 'solicitud' ? ' portal__tab--active' : ''}`}
                    onClick={() => setModoAcceso('solicitud')}
                  >
                    Quiero ser hermano/a
                  </button>
                </div>

                {modoAcceso === 'login' && (
                  <>
                    <p className="portal__lead">Entra con tu DNI y tu contraseña.</p>
                    <form className="app-form" onSubmit={identificar}>
                      <div className="form-row">
                        <label htmlFor="dniHermano">DNI / NIE</label>
                        <input
                          id="dniHermano"
                          type="text"
                          value={dniInput}
                          onChange={(e) => setDniInput(e.target.value)}
                          placeholder="12345678A"
                          autoFocus
                          required
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor="claveHermano">Contraseña</label>
                        <input
                          id="claveHermano"
                          type="password"
                          value={claveInput}
                          onChange={(e) => setClaveInput(e.target.value)}
                          placeholder="Tu contraseña (al alta, tu DNI)"
                          required
                        />
                      </div>
                      {errorLogin && <p className="form-hint form-hint--error">{errorLogin}</p>}
                      <button type="submit" className="btn btn-primary btn-block">
                        Entrar
                      </button>
                    </form>
                    {!usarSupabase && hermandadElegida.id === ID_HERMANDAD_PRINCIPAL && (
                      <>
                        <div className="auth-sep"><span>o</span></div>
                        <button
                          type="button"
                          className="btn btn-outline btn-block"
                          onClick={() => entrarComoDemo()}
                        >
                          Entrar en modo demo (sin escribir)
                        </button>
                      </>
                    )}
                  </>
                )}

                {modoAcceso === 'solicitud' &&
                  (solicitudEnviada ? (
                    <div className="banner-inline banner-inline--accent">
                      Tu solicitud se ha enviado a la secretaría de {hermandadElegida.nombre}. Te avisarán en cuanto la
                      revisen.
                    </div>
                  ) : (
                    <>
                      <p className="portal__lead">
                        Pide el alta como hermano/a de {hermandadElegida.nombre}. La secretaría revisará tu solicitud.
                      </p>
                      <form className="app-form" onSubmit={solicitarAlta}>
                        <div className="form-row">
                          <label htmlFor="solNombre">Nombre y apellidos</label>
                          <input id="solNombre" name="nombre" type="text" placeholder="Nombre completo" required />
                        </div>
                        <div className="form-row">
                          <label htmlFor="solDni">DNI / NIE</label>
                          <input id="solDni" name="dni" type="text" placeholder="12345678A" required />
                        </div>
                        <div className="form-row">
                          <label htmlFor="solEmail">Correo electrónico</label>
                          <input id="solEmail" name="email" type="email" placeholder="tucorreo@ejemplo.com" required />
                        </div>
                        <div className="form-row">
                          <label htmlFor="solTelefono">Teléfono</label>
                          <input id="solTelefono" name="telefono" type="tel" placeholder="600 000 000" />
                        </div>
                        <div className="form-row">
                          <label htmlFor="solClave">Elige una contraseña</label>
                          <input id="solClave" name="clavePropuesta" type="password" placeholder="Mínimo 6 caracteres" required minLength={6} />
                        </div>
                        {errorSolicitud && <p className="form-hint form-hint--error">{errorSolicitud}</p>}
                        <button type="submit" className="btn btn-primary btn-block">
                          Enviar solicitud
                        </button>
                      </form>
                    </>
                  ))}
              </>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ===================== Portal del hermano =====================
  const numeroActivo = hermanoActivo.numero
  const primerNombre = hermanoActivo.nombre.split(' ')[0]

  return (
    <div className="portal" style={estiloTema(colorActivo)}>
      <PortalHead
        hermandad={nombreHermandadActiva}
        logo={esPrincipal ? hermandadPrincipal.logoDataUrl : null}
        color={colorActivo}
        icono={esPrincipal ? undefined : hermandadMuestra?.icono}
        onSalir={salir}
      />
      <main className="portal__main">
        <div className="portal__welcome" style={{ ['--portal-accent' as string]: colorActivo }}>
          <span className="portal__welcome-avatar">{inicialesHermandad(hermanoActivo?.nombre ?? primerNombre)}</span>
          <div className="portal__welcome-text">
            <p className="eyebrow">Área del hermano · {nombreHermandadActiva}</p>
            <h1>Hola, {primerNombre}</h1>
            <div className="portal__resumen">
              <span className="pill pill--info">{numeroActivo > 0 ? `Nº ${numeroActivo}` : 'Sin número (baja)'}</span>
              {hermanoPrincipal && (
                <>
                  <span className={`pill ${hermanoPrincipal.estado === 'Activo' ? 'pill--ok' : hermanoPrincipal.estado === 'Nuevo' ? 'pill--info' : 'pill--off'}`}>
                    {hermanoPrincipal.estado}
                  </span>
                  <span className={`pill ${hermanoPrincipal.cuotaAlDia ? 'pill--ok' : 'pill--warn'}`}>
                    {hermanoPrincipal.cuotaAlDia ? 'Cuota al día' : 'Cuota pendiente'}
                  </span>
                  <span className="pill pill--off">Hermano/a desde {hermanoPrincipal.antiguedad}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {hermanoPrincipal && (
          <div className="portal__cards">
            <div className={`portal__card-mini portal__card-mini--${hermanoPrincipal.cuotaAlDia ? 'ok' : 'warn'}`}>
              <span className="portal__card-mini__label">Mi cuota</span>
              <span className="portal__card-mini__value">{hermanoPrincipal.cuotaAlDia ? 'Al día' : 'Pendiente'}</span>
              <span className="portal__card-mini__sub">{campana.anio}</span>
            </div>
            <div className="portal__card-mini portal__card-mini--accent">
              <span className="portal__card-mini__label">Mi papeleta {campana.anio}</span>
              <span className="portal__card-mini__value">
                {asignacion?.tramo ? etiquetaTramo(asignacion.tramo) : renovacion?.papeletaActual?.opcion ?? 'Sin sitio'}
              </span>
              <span className="portal__card-mini__sub">{renovacion?.estado ?? '—'}</span>
            </div>
            <div className="portal__card-mini">
              <span className="portal__card-mini__label">Antigüedad</span>
              <span className="portal__card-mini__value">{Math.max(0, new Date().getFullYear() - hermanoPrincipal.antiguedad)} años</span>
              <span className="portal__card-mini__sub">desde {hermanoPrincipal.antiguedad}</span>
            </div>
            <div className="portal__card-mini">
              <span className="portal__card-mini__label">Nº de hermano</span>
              <span className="portal__card-mini__value">{hermanoPrincipal.numero > 0 ? hermanoPrincipal.numero : '—'}</span>
              <span className="portal__card-mini__sub">{hermanoPrincipal.estado}</span>
            </div>
          </div>
        )}

        {!consent && (
          <div className="banner-inline banner-inline--accent portal__consent">
            <span>
              {nombreHermandadActiva} trata tus datos personales para gestionar tu condición de hermano/a (cuotas, papeletas y
              comunicaciones), conforme al RGPD. Puedes descargar o solicitar la supresión de tus datos abajo.
            </span>
            <button className="btn btn-primary btn-sm" onClick={aceptarConsentimiento}>
              Entendido
            </button>
          </div>
        )}

        {/* Avisos de la secretaría: cambios que la hermandad ha hecho en tus datos */}
        {avisosSecretaria.length > 0 && (
          <section className="portal__section">
            <div className="portal__avisos-head">
              <h2>
                Avisos de la secretaría
                {avisosSinLeer > 0 && <span className="portal__avisos-badge">{avisosSinLeer}</span>}
              </h2>
              {avisosSinLeer > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={marcarAvisosLeidos}>
                  Marcar como leídos
                </button>
              )}
            </div>
            <ul className="portal__avisos">
              {avisosSecretaria.map((a) => (
                <li key={a.id} className={`portal__aviso${a.leido ? '' : ' portal__aviso--nuevo'}`}>
                  <span className="portal__aviso-icono" aria-hidden="true">✉️</span>
                  <div>
                    <p>{a.texto}</p>
                    <small>{a.fecha}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Diputado de tramo: asistencia de los hermanos de su tramo el día de salida */}
        {esDiputadoTramo && (
          <section className="portal__section">
            <h2>Mi tramo · día de salida {campana.anio}</h2>
            {tramoDelDiputado ? (
              <>
                <p className="portal__lead">
                  Eres diputado/a del tramo <b>{etiquetaTramo(tramoDelDiputado)}</b>. Confirma quién sale
                  y quién no (con el motivo). La secretaría lo ve al instante en el panel.
                </p>
                <AsistenciaTramo
                  anio={campana.anio}
                  miembros={miembrosTramo}
                  porQuien={hermanoPrincipal?.nombre ?? 'Diputado de tramo'}
                />
              </>
            ) : (
              <p className="portal__lead">
                Cuando tengas tu sitio asignado en el cortejo, aquí verás a los hermanos de tu tramo
                para tomar la asistencia del día de salida.
              </p>
            )}
          </section>
        )}

        {/* Papeletas de una hermandad de muestra: su propio subsistema, con sus papeletas y sus datos de pago */}
        {!esPrincipal && hermandadMuestra && hermanoMuestra && (
          <section className="portal__section">
            <h2>Mi papeleta de sitio · {campana.anio}</h2>
            {papeletaMuestraActual ? (
              <div className="portal__papeleta">
                <div className="ficha__row">
                  <span
                    className={`pill ${papeletaMuestraActual.estado === 'Asignada' ? 'pill--warn' : 'pill--ok'}`}
                  >
                    {papeletaMuestraActual.estado === 'Asignada' ? 'Pendiente de pago' : papeletaMuestraActual.estado}
                  </span>
                  <span className="pill pill--info">{papeletaMuestraActual.opcion}</span>
                  <span className="pill pill--off">Papeleta nº {papeletaMuestraActual.numero}</span>
                </div>
                {papeletaMuestraActual.estado === 'Asignada' ? (
                  <PagoPapeleta
                    papeleta={papeletaMuestraActual}
                    bizum={hermandadMuestra.bizum}
                    iban={hermandadMuestra.iban}
                    nombreHermandad={nombreHermandadActiva}
                    hermanoNombre={hermanoMuestra.nombre}
                    onComunicar={comunicarPagoMuestra}
                  />
                ) : (
                  <p className="portal__lead">
                    Papeleta pagada. La secretaría de {nombreHermandadActiva} te avisará para recogerla.
                  </p>
                )}
              </div>
            ) : (
              <div className="assign-box">
                <label htmlFor="opcionMuestra">Sacar mi papeleta</label>
                <select id="opcionMuestra" defaultValue="" onChange={(e) => e.target.value && sacarMuestra(e.target.value)}>
                  <option value="" disabled>
                    Elige tu papeleta…
                  </option>
                  {hermandadMuestra.opcionesPapeleta.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre} — {o.importe} €
                    </option>
                  ))}
                </select>
                <p className="form-hint">Papeletas que ofrece {nombreHermandadActiva} para esta salida.</p>
              </div>
            )}
          </section>
        )}

        {/* Mi papeleta de sitio — solo si la hermandad tiene el módulo activo */}
        {esPrincipal && (
          <section className="portal__section">
            <h2>Mi papeleta de sitio · Campaña {campana.anio}</h2>
            {renovacion && (
              <div className="portal__papeleta">
                <div className="ficha__row">
                  <span className={`pill ${renovacion.estado === 'Renovada' || renovacion.estado === 'Nueva' ? 'pill--ok' : renovacion.estado === 'Por renovar' ? 'pill--warn' : renovacion.estado === 'No renovada' ? 'pill--err' : 'pill--off'}`}>
                    {renovacion.estado}
                  </span>
                  {asignacion?.tramo && <span className="pill pill--info">{etiquetaTramo(asignacion.tramo)}</span>}
                </div>

                {renovacion.estado === 'Por renovar' && renovacion.sitioAnterior?.tramoId && (
                  <>
                    <p className="portal__lead">
                      El año pasado saliste en{' '}
                      <b>{etiquetaTramo(tramos.find((t) => t.id === renovacion.sitioAnterior!.tramoId)!)}</b>. La renovación
                      está {ventanaAbiertaPara(campana, true) ? 'abierta' : 'cerrada'}
                      {ventanaAbiertaPara(campana, true)
                        ? ` hasta el ${formatDate(new Date(`${campana.fechaLimiteRenovacion}T00:00:00`))}`
                        : ''}
                      .
                    </p>
                    {ventanaAbiertaPara(campana, true) ? (
                      <div className="assign-box__row">
                        <button className="btn btn-primary" onClick={renovarSitio}>
                          Renovar mi sitio
                        </button>
                        <button className="btn btn-ghost" onClick={noRenovar}>
                          Este año no salgo
                        </button>
                      </div>
                    ) : diasHasta(campana.fechaInicioParticiparon) > 0 ? (
                      <p className="form-hint">
                        La renovación abre el {formatDate(new Date(`${campana.fechaInicioParticiparon}T00:00:00`))}.
                      </p>
                    ) : (
                      <p className="form-hint">El plazo de renovación ha terminado. Contacta con la secretaría.</p>
                    )}
                  </>
                )}

                {/* Renunció este año: se le confirma, en vez de volver a ofrecerle
                    el formulario como si no hubiera hecho nada. */}
                {renovacion.papeletaActual?.estado === 'Renuncia' && (
                  <div className="assign-box assign-box--wait">
                    <label>Este año no sales</label>
                    <p className="portal__lead">
                      Queda registrado que renuncias a tu sitio en la estación de penitencia de{' '}
                      {campana.anio}. Si cambias de idea antes de que acabe el plazo, escribe a la
                      secretaría de {nombreHermandadActiva}.
                    </p>
                  </div>
                )}

                {renovacion.papeletaActual?.estado !== 'Renuncia' &&
                  (renovacion.estado === 'Sin papeleta' || renovacion.estado === 'No renovada') &&
                  (miSolicitud && miSolicitud.estado === 'Pendiente' ? (
                    <div className="assign-box assign-box--wait">
                      <label>Solicitud enviada</label>
                      <p className="portal__lead">
                        Pediste <b>{miSolicitud.modalidad}</b>
                        {miSolicitud.tramoSolicitado !== 'Sin preferencia' ? ` · ${miSolicitud.tramoSolicitado}` : ''}. La
                        secretaría la revisará y te avisará.
                      </p>
                      <p className="form-hint">Enviada el {miSolicitud.fecha} · pendiente de revisión.</p>
                    </div>
                  ) : ventanaAbiertaPara(campana, participoAnoAnterior) ? (
                    <form className="assign-box" onSubmit={enviarSolicitudPapeleta}>
                      <label>Solicitar mi papeleta de sitio</label>
                      {miSolicitud && miSolicitud.estado === 'Rechazada' && (
                        <p className="form-hint form-hint--error">
                          Tu solicitud anterior no fue aceptada. Puedes enviar una nueva.
                        </p>
                      )}
                      <div className="form-grid-2">
                        <div className="field">
                          <label htmlFor="solModalidad">Modalidad</label>
                          <select
                            id="solModalidad"
                            value={solModalidad}
                            onChange={(e) => setSolModalidad(e.target.value as ModalidadPapeleta)}
                          >
                            {MODALIDADES.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="solTramo">Cuerpo o tramo preferido</label>
                          <select id="solTramo" value={solTramo} onChange={(e) => setSolTramo(e.target.value)}>
                            <option value="">Sin preferencia</option>
                            {cuerposDisponibles.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="solPreferencia">Preferencia (opcional)</label>
                        <input
                          id="solPreferencia"
                          type="text"
                          value={solPreferencia}
                          placeholder="P. ej. cirio junto a mi hermano"
                          onChange={(e) => setSolPreferencia(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="solComentario">Comentario para la secretaría (opcional)</label>
                        <textarea
                          id="solComentario"
                          rows={2}
                          value={solComentario}
                          onChange={(e) => setSolComentario(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="btn btn-primary">
                        Enviar solicitud
                      </button>
                      <p className="form-hint">
                        No se te cobra ni se te asigna nada todavía: la secretaría revisa tu solicitud y te confirma el
                        puesto.
                      </p>
                    </form>
                  ) : diasHasta(
                      participoAnoAnterior ? campana.fechaInicioParticiparon : campana.fechaInicioNoParticiparon,
                    ) > 0 ? (
                    <p className="form-hint">
                      El plazo de solicitud de papeletas abre el{' '}
                      {formatDate(
                        new Date(
                          `${participoAnoAnterior ? campana.fechaInicioParticiparon : campana.fechaInicioNoParticiparon}T00:00:00`,
                        ),
                      )}
                      .
                    </p>
                  ) : (
                    <p className="form-hint">
                      El plazo de solicitud de papeletas ha terminado. Contacta con la secretaría.
                    </p>
                  ))}

                {(renovacion.estado === 'Renovada' || renovacion.estado === 'Nueva') && renovacion.papeletaActual && hermanoPrincipal && (
                  <>
                    <p className="portal__lead">
                      {renovacion.papeletaActual.estado === 'Solicitada' ? (
                        <>
                          Tu solicitud está <b>pendiente de asignación</b>: la secretaría te dará
                          sitio y te avisará. Todavía no hay nada que pagar.
                        </>
                      ) : (
                        <>
                          Tienes tu sitio para este año
                          {asignacion?.tramo ? ` en ${etiquetaTramo(asignacion.tramo)}` : ''}. La secretaría te
                          avisará para recoger la papeleta física.
                        </>
                      )}
                    </p>
                    {modeloPapeleta ? (
                      <PapeletaModeloRender
                        modelo={modeloPapeleta}
                        datos={{
                          hermano: hermanoPrincipal,
                          papeleta: renovacion.papeletaActual,
                          tramoEtiqueta: asignacion?.tramo ? etiquetaTramo(asignacion.tramo) : null,
                          puesto: asignacion?.puesto ?? null,
                          hermandadNombre: hermandadPrincipal.nombreLegal || nombrePrincipal,
                          fechaSalida: campana.fechaSalida,
                        }}
                      />
                    ) : (
                      <PapeletaTicket
                        papeleta={renovacion.papeletaActual}
                        hermano={hermanoPrincipal}
                        hermandad={hermandadPrincipal}
                        tramo={asignacion?.tramo}
                        puesto={asignacion?.puesto ?? null}
                        excedeAforo={asignacion?.estado === 'Excede aforo'}
                        opcion={renovacion.papeletaActual.opcion}
                      />
                    )}
                    {/* Solo se cobra cuando la papeleta está ASIGNADA: una simple
                        solicitud aún no tiene sitio ni importe firme. */}
                    {renovacion.papeletaActual.estado === 'Asignada' && (
                      <PagoPapeleta
                        papeleta={renovacion.papeletaActual}
                        bizum={hermandadPrincipal.bizumTelefono}
                        iban={hermandadPrincipal.iban}
                        nombreHermandad={nombreHermandadActiva}
                        hermanoNombre={hermanoPrincipal.nombre}
                        onComunicar={comunicarPago}
                      />
                    )}
                    <div className="assign-box__row" style={{ marginTop: '1rem' }}>
                      <button type="button" className="btn btn-outline" onClick={() => window.print()}>
                        Imprimir / descargar mi papeleta
                      </button>
                    </div>
                  </>
                )}

              </div>
            )}
          </section>
        )}

        {/* Mis cuotas — solo si la hermandad tiene el módulo activo */}
        {esPrincipal && (
          <section className="portal__section">
            <h2>Mis cuotas</h2>
            {misCuotas.length === 0 ? (
              <p className="form-hint">No tienes recibos registrados.</p>
            ) : (
              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Nº</th>
                      <th>Concepto</th>
                      <th>Importe</th>
                      <th>Estado</th>
                      <th>Cobro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {misCuotas.map((c) => (
                      <tr key={c.id}>
                        <td className="num">{c.numero}</td>
                        <td>{c.concepto}</td>
                        <td className="num">{formatCurrency(c.importe)}</td>
                        <td><span className={`pill ${claseCuota(c.estado)}`}>{c.estado}</span></td>
                        <td className="num">{c.fechaCobro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="form-hint">El pago online de cuotas y papeletas llegará con la pasarela de pago.</p>
          </section>
        )}

        {/* Mis datos */}
        <section className="portal__section">
          <h2>Mis datos de contacto</h2>
          <form className="app-form" onSubmit={guardarDatos}>
            <div className="form-row">
              <label htmlFor="miEmail">Correo electrónico</label>
              <input id="miEmail" name="email" type="email" defaultValue={hermanoActivo.email} />
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="miTelefono">Teléfono</label>
                <input id="miTelefono" name="telefono" type="tel" defaultValue={hermanoActivo.telefono} />
              </div>
              {hermanoPrincipal && (
                <div className="form-row">
                  <label htmlFor="miDireccion">Dirección</label>
                  <input id="miDireccion" name="direccion" type="text" defaultValue={hermanoPrincipal.direccion} />
                </div>
              )}
            </div>
            <div className="assign-box__row">
              <button type="submit" className="btn btn-primary">Guardar mis datos</button>
              {datosGuardados && <span className="alert-item alert-item--ok">Datos actualizados.</span>}
            </div>
          </form>
        </section>

        {/* Cambiar contraseña */}
        <section className="portal__section">
          <h2>Cambiar mi contraseña</h2>
          <form className="app-form" onSubmit={cambiarClave}>
            <div className="form-row">
              <label htmlFor="claveActual">Contraseña actual</label>
              <input id="claveActual" name="claveActual" type="password" autoComplete="current-password" required />
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="claveNueva">Nueva contraseña</label>
                <input id="claveNueva" name="claveNueva" type="password" autoComplete="new-password" required minLength={6} />
              </div>
              <div className="form-row">
                <label htmlFor="claveConfirmar">Repite la nueva contraseña</label>
                <input id="claveConfirmar" name="claveConfirmar" type="password" autoComplete="new-password" required minLength={6} />
              </div>
            </div>
            {claveError && <p className="form-hint form-hint--error">{claveError}</p>}
            <div className="assign-box__row">
              <button type="submit" className="btn btn-primary">Cambiar contraseña</button>
              {claveGuardada && <span className="alert-item alert-item--ok">Contraseña actualizada.</span>}
            </div>
          </form>
        </section>

        {/* RGPD */}
        <section className="portal__section">
          <h2>Mis datos y privacidad (RGPD)</h2>
          <p className="form-hint">
            Tienes derecho a acceder a tus datos y a solicitar su supresión. La baja la tramita la secretaría de {nombreHermandadActiva}.
          </p>
          {bajaPedida && (
            <div className="banner-inline banner-inline--warn" style={{ marginBottom: '0.8rem' }}>
              Has solicitado la baja. La secretaría de {nombreHermandadActiva} la tramitará; hasta
              entonces sigues siendo hermano/a de pleno derecho.
            </div>
          )}
          <div className="assign-box__row">
            <button className="btn btn-outline" onClick={descargarMisDatos}>Descargar mis datos</button>
            <button className="btn btn-ghost rgpd-borrar" onClick={solicitarBaja} disabled={bajaPedida}>
              {bajaPedida ? 'Baja solicitada' : 'Solicitar la baja'}
            </button>
          </div>
        </section>

        {(contactoActivo.telefono || contactoActivo.email) && (
          <p className="portal__contact">
            ¿Dudas? Contacta con la secretaría de {nombreHermandadActiva}
            {contactoActivo.telefono && <> · {contactoActivo.telefono}</>}
            {contactoActivo.email && (
              <>
                {' · '}
                <a href={`mailto:${contactoActivo.email}`}>{contactoActivo.email}</a>
              </>
            )}
          </p>
        )}
      </main>
    </div>
  )
}

/**
 * Pago de la papeleta desde el área del hermano. El dinero va directo a la
 * hermandad (su Bizum o su cuenta); aquí solo se le enseñan al hermano los
 * datos y él avisa de que ya ha pagado, para que la secretaría lo confirme
 * cuando vea el ingreso. El cobro con tarjeta desde la propia página llegará
 * con la pasarela de pago (necesita backend).
 */
function PagoPapeleta({
  papeleta,
  bizum,
  iban,
  nombreHermandad,
  hermanoNombre,
  onComunicar,
}: {
  papeleta: Papeleta
  bizum: string
  iban: string
  nombreHermandad: string
  hermanoNombre: string
  onComunicar: (metodo: MetodoPago) => void
}) {
  const concepto = `Papeleta ${papeleta.numero} - ${hermanoNombre}`

  if (papeleta.pagoComunicado) {
    return (
      <div className="pago-box pago-box--ok">
        <b>Pago comunicado por {papeleta.pagoComunicado.metodo}</b>
        <p className="form-hint">
          Avisaste el {papeleta.pagoComunicado.fecha} de que ya has pagado {formatCurrency(papeleta.importe)}. La
          secretaría de {nombreHermandad} confirmará el pago en cuanto vea el ingreso en su cuenta.
        </p>
      </div>
    )
  }

  if (!bizum && !iban) {
    return (
      <p className="form-hint">
        {nombreHermandad} aún no ha publicado sus datos de cobro. Pregunta en secretaría cómo pagar tu papeleta
        ({formatCurrency(papeleta.importe)}).
      </p>
    )
  }

  return (
    <div className="pago-box">
      <b>Pagar mi papeleta · {formatCurrency(papeleta.importe)}</b>
      <p className="form-hint">
        El pago llega directamente a {nombreHermandad}. Pon en el concepto <code>{concepto}</code> para que la
        secretaría lo identifique.
      </p>
      <div className="pago-metodos">
        {bizum && (
          <div className="pago-metodo">
            <span className="pago-metodo__titulo">Bizum</span>
            <span className="pago-metodo__dato">{bizum}</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onComunicar('Bizum')}>
              Ya he enviado el Bizum
            </button>
          </div>
        )}
        {iban && (
          <div className="pago-metodo">
            <span className="pago-metodo__titulo">Transferencia</span>
            <span className="pago-metodo__dato">{iban}</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onComunicar('Transferencia')}>
              Ya he hecho la transferencia
            </button>
          </div>
        )}
      </div>
      <p className="form-hint">El pago con tarjeta desde esta misma página llegará con la pasarela de pago online.</p>
    </div>
  )
}

function PortalHead({
  hermandad,
  logo,
  color,
  icono,
  onSalir,
}: {
  hermandad: string
  logo: string | null
  color?: string
  icono?: IconoHermandad
  onSalir?: () => void
}) {
  return (
    <header className="portal__head">
      <div className="portal__brand">
        <span className="portal__logo">
          {logo ? (
            <img src={logo} alt="" />
          ) : color && icono ? (
            <EscudoHermandad color={color} icono={icono} size={28} />
          ) : color ? (
            <span className="portal__logo-badge" style={{ background: color }} aria-hidden="true">
              {inicialesHermandad(hermandad)}
            </span>
          ) : (
            <LogoMark size={28} />
          )}
        </span>
        <span>
          <b>{hermandad}</b>
          <small>Área del hermano</small>
        </span>
      </div>
      {onSalir && (
        <button className="btn btn-ghost btn-sm" onClick={onSalir}>
          Salir
        </button>
      )}
    </header>
  )
}
