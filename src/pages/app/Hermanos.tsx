import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { limpiarDni } from '../../lib/importar'
import { prepararAvisos } from '../../lib/avisosCorreo'
import { Link, useSearchParams } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import MenuAcciones from '../../components/MenuAcciones'
import CamposPropiosForm from '../../components/CamposPropios'
import { HERMANOS_INICIALES, initials, type EstadoHermano, type Hermano } from '../../data/hermanos'
import { PAPELETAS_INICIALES } from '../../data/papeletas'
import { isPlausibleIban, maskIban } from '../../lib/format'
import { useTramos, etiquetaTramo } from '../../lib/tramos'
import { repartoCompleto } from '../../lib/cortejo'
import { CLAVES_DATOS, leerDatos } from '../../lib/persistencia'
import { esMiembro, aniosDeHermandad, cumpleEsteMes, diaYMes, edadDe, esSuCumpleHoy, fraseAntiguedad, mesEnCurso, tonoDe } from '../../lib/hermanoFicha'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { isSupabaseConfigured } from '../../lib/supabase'
import { crearAccesoHermano } from '../../lib/accesos'
import { darLaBienvenida } from '../../lib/bienvenida'
import { claveDeUnSoloUso } from '../../lib/claves'
import { hermanoToRow, rowToHermano } from '../../lib/db/hermanos'
import { getCampana } from '../../lib/campana'
import { borrarDatosHermano, exportarDatosHermano, recopilarDatosHermano } from '../../lib/rgpd'
import { toCsv, descargarArchivo } from '../../lib/csv'
import ImportarCenso from '../../components/ImportarCenso'
import FotoHermano from '../../components/FotoHermano'
import { darDeBajaEnCenso, reactivarEnCenso } from '../../lib/censo'
import { etiquetasDe, etiquetasQueSonAutomaticas, indiceRoles } from '../../lib/rolesPapeleta'
import { useSolicitudes, saveSolicitudes, type SolicitudAlta } from '../../lib/solicitudes'
import { useEtiquetas } from '../../lib/etiquetas'
import { useCamposPropios, valorLegible } from '../../lib/camposPropios'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import EditorSegmento from '../../components/EditorSegmento'
import InformeImpreso from '../../components/InformeImpreso'
import { etiquetaSegmento, filtrarSegmento, limpiarCriterios, mismosCriterios, type CriteriosSegmento } from '../../lib/segmentacion'
import { hayDatosDeEjemplo } from '../../lib/demo'

/**
 * En el censo, «sin sesgo» significa enseñarlo ENTERO, bajas incluidas. No
 * vale CRITERIOS_POR_DEFECTO, que ya filtra a activos con correo.
 */
type OrdenCampo = 'numero' | 'nombre' | 'estado' | 'cuota' | 'antiguedad'
/** `opcional`: columna de apoyo que se oculta en el móvil (ver `col-opcional`). */
const COLUMNAS: { id: OrdenCampo | 'tramo'; label: string; orden: boolean; opcional?: boolean }[] = [
  { id: 'numero', label: 'Nº', orden: true, opcional: true },
  { id: 'nombre', label: 'Hermano', orden: true },
  { id: 'tramo', label: 'Tramo', orden: false, opcional: true },
  { id: 'estado', label: 'Estado', orden: true },
  { id: 'cuota', label: 'Cuota', orden: true, opcional: true },
  { id: 'antiguedad', label: 'Antigüedad', orden: true, opcional: true },
]

const SIN_SESGO: CriteriosSegmento = {
  estado: 'Cualquiera', cuota: 'Todos', edad: 'Todos', etiqueta: '', soloConEmail: false, campos: [],
}
import { agregarAvisoHermano, avisarCambiosHermano } from '../../lib/avisosHermano'
import { avisarPorCorreo } from '../../lib/avisosCorreo'
import { apuntar } from '../../lib/registroActividad'
import { useAuth } from '../../context/AuthContext'
import { filaQueAbre } from '../../lib/foco'

/**
 * La cuota de un hermano en una palabra. Son TRES estados, no dos.
 *
 * El hermano civil no paga cuota: es lo que significa ser civil. Y como nace
 * con `cuotaAlDia` en falso y no se le emite ningún recibo nunca, sin este
 * tercer estado el administrativo contratado sale como moroso permanente en
 * el listado, en la ficha, en la exportación y en el padrón del cabildo.
 */
function cuotaEnPalabras(h: { cuotaAlDia: boolean; civil?: boolean }): string {
  if (h.civil) return 'No paga cuota'
  return h.cuotaAlDia ? 'Al día' : 'Pendiente'
}

function cuotaClass(h: { cuotaAlDia: boolean; civil?: boolean }): string {
  if (h.civil) return 'pill--info'
  return h.cuotaAlDia ? 'pill--ok' : 'pill--warn'
}

function estadoClass(estado: EstadoHermano) {
  if (estado === 'Activo') return 'pill--ok'
  if (estado === 'Nuevo') return 'pill--info'
  return 'pill--off'
}

export default function Hermanos() {
  // Antes de mandar nada, traer de la base la configuración de correo de
  // la hermandad y lo que cada hermano tenga apagado. Sin esto, quien
  // entra desde otro ordenador trabaja con la de fábrica: no sale ningún
  // aviso, o se le escribe a quien pidió que no. Los dos en silencio.
  useEffect(() => {
    void prepararAvisos()
  }, [])

  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  // Quién está haciendo los cambios, para el registro de actividad. Se copia
  // el nombre tal como es AHORA: si esta persona deja la junta y se borra su
  // ficha, el registro tiene que seguir diciendo quién fue.
  const quienSoy =
    (user?.user_metadata?.nombre as string | undefined) ?? user?.email ?? 'Alguien de la junta'
  const [hermanos, setHermanos] = useSupabaseTable<Hermano>(
    'hermanos',
    CLAVES_DATOS.hermanos,
    HERMANOS_INICIALES,
    hermanoToRow,
    rowToHermano,
    'numero',
  )
  // La paleta de comandos (Ctrl+K) manda aquí con ?q=…, para buscar un hermano
  // desde cualquier pantalla sin pasar por el menú.
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  useEffect(() => {
    const q = params.get('q')
    const nuevo = params.get('nuevo')
    const ficha = params.get('ficha')
    if (q === null && nuevo === null && ficha === null) return
    if (q !== null) setQuery(q)
    if (nuevo !== null) { setDniError(null); setFormOpen(true) }
    if (ficha !== null) setSelectedId(ficha)
    // Se limpia la URL: si no, al recargar vuelve a filtrar y desconcierta.
    setParams({}, { replace: true })
  }, [params, setParams])
  // «Piden la baja» no es un estado del hermano: es que lo ha pedido y sigue
  // esperando a que la secretaría lo tramite.
  const [filter, setFilter] = useState<'Todos' | 'Piden la baja' | EstadoHermano>('Todos')
  /** Cumpleaños del mes: las hermandades felicitan, y es un dato que estaba
   *  guardado y no se usaba para nada. */
  const [soloCumples, setSoloCumples] = useState(false)
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string>('')
  /**
   * La ficha abierta se DERIVA del censo, no se copia. Guardar una copia en
   * estado obligaba a acordarse de actualizarla en cada mutador; el que se
   * olvidaba (los campos propios) dejaba el formulario escribiendo sobre un
   * valor viejo: se veía revertir cada tecla y solo se guardaba la última.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => hermanos.find((h) => h.id === selectedId) ?? null, [hermanos, selectedId])
  const [etiquetas, setEtiquetas] = useEtiquetas()
  const [camposPropios] = useCamposPropios()
  // Con el nombre de la cuenta de reserva, igual que Cuotas, Tesorería,
  // Papeletas, Cortejo e Informes. Sin él, el censo impreso salía encabezado
  // «Tu hermandad» mientras el recibo de la misma hermandad, impreso cinco
  // minutos antes, llevaba su nombre de verdad: dos papeles del mismo día,
  // firmados por dos entidades distintas.
  const hermandad = useHermandadSettings(fallbackNombre)
  // Sesgo aplicado al censo. Arranca en «no sesga nada»: el censo se ve entero,
  // bajas incluidas, hasta que alguien pide lo contrario.
  const [sesgando, setSesgando] = useState(false)
  // Ordenación de la tabla. Por número y ascendente, que es lo de siempre.
  const [orden, setOrden] = useState<{ campo: OrdenCampo; asc: boolean }>({ campo: 'numero', asc: true })
  function ordenarPor(campo: OrdenCampo) {
    setOrden((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true }))
  }
  // Los tramos y las opciones, que son de donde salen los roles automáticos.
  const tramosRoles = useTramos()
  /**
   * Las etiquetas que salen SOLAS de la papeleta de cada uno (costalero,
   * acólito, mantilla). Se calculan una vez y se reparten por índice: en un
   * censo de mil, recalcularlas por fila sería una barbaridad.
   */
  const roles = useMemo(() => {
    const anio = getCampana().anio
    const papeletas = leerDatos(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES)
    return indiceRoles(papeletas, tramosRoles, anio)
  }, [tramosRoles])
  const rolesAutomaticos = useMemo(
    () => etiquetasQueSonAutomaticas(tramosRoles),
    [tramosRoles],
  )

  /** Todo lo que se puede elegir para filtrar: las de la hermandad y las de la papeleta. */
  const etiquetasParaFiltrar = useMemo(
    () => [...new Set([...etiquetas, ...rolesAutomaticos])].sort((a, b) => a.localeCompare(b, 'es')),
    [etiquetas, rolesAutomaticos],
  )

  const [criterios, setCriterios] = useState<CriteriosSegmento>(SIN_SESGO)
  const sesgoActivo = !mismosCriterios(criterios, SIN_SESGO)
  const sesgados = useMemo(
    () => (sesgoActivo ? filtrarSegmento(hermanos, limpiarCriterios(criterios), roles) : hermanos),
    [hermanos, criterios, sesgoActivo, roles],
  )
  const camposDeAlta = camposPropios.filter((c) => c.enAlta && c.nombre.trim())
  // Los campos propios del alta no van en el <form> (no son inputs con name):
  // se llevan aparte y se vuelcan al crear.
  const [camposNuevo, setCamposNuevo] = useState<Record<string, string>>({})
  // Mientras se crea la cuenta en Supabase el botón se bloquea: si no, dos
  // clics seguidos daban de alta dos veces al mismo hermano.
  const [guardandoAlta, setGuardandoAlta] = useState(false)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')
  /**
   * Selección múltiple. Con mil doscientos hermanos, poner «Costalero» de uno
   * en uno abriendo la ficha era media tarde de trabajo.
   */
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set())
  const [avisoMasivo, setAvisoMasivo] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [dniError, setDniError] = useState<string | null>(null)
  /**
   * «La ficha se ha guardado, pero NO se ha creado su acceso».
   *
   * Va aquí arriba y no dentro del panel del alta porque el panel se cierra al
   * guardar: si el aviso viviera dentro, se cerraría con él y nadie lo vería.
   */
  const [avisoAcceso, setAvisoAcceso] = useState<string | null>(null)

  const [ibanDraft, setIbanDraft] = useState('')
  const [ibanError, setIbanError] = useState<string | null>(null)
  const [ibanSaved, setIbanSaved] = useState(false)
  const [contacto, setContacto] = useState({ email: '', telefono: '', direccion: '' })
  const [contactoSaved, setContactoSaved] = useState(false)

  const solicitudesRemotas = useSolicitudes()
  const [solicitudes, setSolicitudesState] = useState<SolicitudAlta[]>(solicitudesRemotas)
  useEffect(() => setSolicitudesState(solicitudesRemotas), [solicitudesRemotas])
  const [solicitudesOpen, setSolicitudesOpen] = useState(false)
  const [importarOpen, setImportarOpen] = useState(false)
  const [bajasOpen, setBajasOpen] = useState(false)
  const pendientes = useMemo(() => solicitudes.filter((s) => s.estado === 'Pendiente'), [solicitudes])

  function actualizarSolicitudes(next: SolicitudAlta[]) {
    setSolicitudesState(next)
    saveSolicitudes(next)
  }

  async function aprobarSolicitud(sol: SolicitudAlta) {
    // Limpio, igual que en el alta a mano: si no, el mismo señor con puntos y
    // sin puntos pasaba el control y entraba dos veces en el censo.
    const dniSolicitud = limpiarDni(sol.dni)
    if (hermanos.some((h) => limpiarDni(h.dni) === dniSolicitud)) {
      actualizarSolicitudes(solicitudes.map((s) => (s.id === sol.id ? { ...s, estado: 'Rechazada' } : s)))
      return
    }
    const nuevo: Hermano = {
      id: nuevoId(),
      // El número definitivo se asigna dentro del setHermanos de abajo, ya con
      // la lista más reciente: calcularlo aquí (antes del await) podía repetir
      // número si entretanto se daba de alta a otro hermano.
      numero: 0,
      nombre: sol.nombre,
      estado: 'Nuevo',
      antiguedad: new Date().getFullYear(),
      email: sol.email,
      telefono: sol.telefono || 'Sin datos',
      direccion: 'Sin datos',
      cuotaAlDia: false,
      iban: null,
      dni: dniSolicitud,
      // Vacía a propósito: la de verdad vive en Supabase Auth. Ver claves.ts.
      claveAcceso: '',
      authUserId: null,
      // Si la pidió un hermano para un hijo suyo, el menor queda a su cargo y
      // podrá gestionarle la papeleta desde su propia cuenta.
      ...(sol.tutorId ? { tutorId: sol.tutorId } : {}),
      ...(sol.fechaNacimiento ? { fechaNacimiento: sol.fechaNacimiento } : {}),
    }
    /*
     * A UN MENOR NO SE LE CREA CUENTA, y no hacerlo es el arreglo.
     *
     * Cuando un hermano pide el alta de un hijo desde su área, del menor no se
     * piden ni correo ni contraseña: entra su tutor por él, desde su propia
     * cuenta. La solicitud viaja con `clavePropuesta: ''` y con el correo DEL
     * PADRE, que es a quien hay que escribir.
     *
     * Y aquí se le intentaba crear una cuenta igualmente. Fallaba siempre, y
     * por partida doble: la contraseña vacía no la acepta Supabase, y el
     * correo del padre ya tiene cuenta. Así que aprobar el alta de un hijo
     * terminaba SIEMPRE con la banda de aviso «la ficha se ha guardado, pero
     * NO se ha creado su acceso: el correo ya lo usa otra cuenta» — un aviso
     * que no significa nada aquí, porque ese menor no necesita ninguna cuenta,
     * y que hacía pensar que el alta no había funcionado.
     */
    const esMenorACargo = Boolean(sol.tutorId) || !sol.clavePropuesta.trim()
    /* La que eligió al pedir el alta, si eligió una; si no, una de un solo uso.
       En los dos casos deja de guardarse en la ficha. */
    const claveProvisional = sol.clavePropuesta.trim() || claveDeUnSoloUso()
    const acceso = esMenorACargo
      ? { id: null, error: null }
      : await crearAccesoHermano(sol.email, claveProvisional, sol.dni, sol.nombre)
    nuevo.authUserId = acceso.id
    // Si no se ha podido crear su acceso, se DICE. Ver crearAccesoHermano().
    if (acceso.error) setAvisoAcceso(acceso.error)
    // La comprobación de DNI se repite AQUÍ, ya con la lista más reciente: entre
    // el clic y el final del alta (una llamada de red) pudo entrar otro hermano.
    let duplicado = false
    let suNumero = 0
    setHermanos((prev) => {
      if (prev.some((h) => h.dni.toUpperCase() === sol.dni.toUpperCase())) {
        duplicado = true
        return prev
      }
      suNumero = Math.max(0, ...prev.map((h) => h.numero)) + 1
      return [...prev, { ...nuevo, numero: suNumero }]
    })
    /*
     * Y SE LE DA LA BIENVENIDA por correo, con su número y cómo entrar.
     *
     * Antes había que decírselo a mano, por teléfono o en el mostrador. En una
     * hermandad que da de alta a treinta personas después de un cabildo, eso
     * son treinta llamadas — y las que no se hacen son treinta personas que no
     * saben que tienen un área.
     *
     * La contraseña NO va escrita en el correo: ver src/lib/bienvenida.ts.
     */
    if (!duplicado) {
      if (esMenorACargo) {
        /* Al menor no se le manda «entra con tu DNI»: no tiene cuenta. Se
           avisa a QUIEN LO PIDIÓ, que es quien va a gestionarlo. */
        const tutor = hermanos.find((h) => h.id === sol.tutorId)
        if (tutor?.email) {
          void avisarPorCorreo(
            [{ id: tutor.id, nombre: tutor.nombre, email: tutor.email }],
            'ficha',
            'Ya está dado de alta',
            [
              `${nuevo.nombre} ya está en el censo de la hermandad, con el número ${suNumero}.`,
              'Lo gestionas desde tu propia área de hermano, en «Mi familia»: desde ahí puedes '
              + 'ver sus cuotas y sacarle la papeleta de sitio.',
            ],
            'Este aviso lo puedes apagar desde tu área de hermano.',
          )
        }
      } else {
        void darLaBienvenida({
          id: nuevo.id, nombre: nuevo.nombre, email: nuevo.email, dni: nuevo.dni,
          numero: suNumero,
          // Solo si la eligió ELLA al pedir el alta ya se la sabe: entonces no
          // se le repite por correo. Si se la hemos puesto nosotros, sí.
          claveProvisional: sol.clavePropuesta.trim() ? null : (acceso.id ? claveProvisional : null),
          hermandad: hermandad.nombreLegal,
        })
      }
    }
    // Sobre el estado más reciente de las solicitudes, no sobre el de antes del
    // await: si no, aprobar dos seguidas revertía la primera a «Pendiente».
    setSolicitudesState((prev) => {
      const next = prev.map((s) => (s.id === sol.id ? { ...s, estado: (duplicado ? 'Rechazada' : 'Aprobada') as SolicitudAlta['estado'] } : s))
      saveSolicitudes(next)
      return next
    })
    setJustAddedId(nuevo.id)
    setTimeout(() => setJustAddedId(null), 3000)
  }

  function rechazarSolicitud(sol: SolicitudAlta) {
    actualizarSolicitudes(solicitudes.map((s) => (s.id === sol.id ? { ...s, estado: 'Rechazada' } : s)))
  }

  useEffect(() => {
    setIbanDraft(selected?.iban ?? '')
    setIbanError(null)
    setIbanSaved(false)
    setContacto({
      email: selected?.email ?? '',
      telefono: selected?.telefono && selected.telefono !== 'Sin datos' ? selected.telefono : '',
      direccion: selected?.direccion && selected.direccion !== 'Sin datos' ? selected.direccion : '',
    })
    setContactoSaved(false)
    // Solo al CAMBIAR de hermano (por eso la dependencia es el id y no la ficha
    // entera): si dependiera de cada campo, el formulario se reiniciaría solo
    // mientras se está escribiendo en él.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  /**
   * Quien ha pedido la baja desde su área y sigue esperando. Antes esto solo se
   * veía abriendo la ficha de ESE hermano y desplegando «Administración», así
   * que la solicitud llegaba y no se enteraba nadie.
   */
  const bajasPedidas = useMemo(
    () => hermanos.filter((h) => h.bajaSolicitada && h.estado !== 'Baja'),
    [hermanos],
  )

  const filtered = useMemo(() => {
    // El sesgo va ANTES que los filtros de la barra: los de la barra afinan lo
    // que el sesgo ya ha dejado.
    return sesgados
      .filter((h) =>
        filter === 'Todos' ? true : filter === 'Piden la baja' ? Boolean(h.bajaSolicitada && h.estado !== 'Baja') : h.estado === filter,
      )
      .filter((h) => (soloCumples ? cumpleEsteMes(h.fechaNacimiento) : true))
      // Los roles que salen de la papeleta cuentan igual que los puestos a
      // mano: si no, filtrar por «Costalero» no encuentra a los costaleros.
      .filter((h) => (filtroEtiqueta ? etiquetasDe(h, roles.get(h.id) ?? []).includes(filtroEtiqueta) : true))
      .filter((h) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return h.nombre.toLowerCase().includes(q) || String(h.numero).includes(q)
      })
      // Los de baja (sin número activo) van al final, nunca delante del nº 1.
      .sort((a, b) => {
        const signo = orden.asc ? 1 : -1
        if (orden.campo === 'nombre') return signo * a.nombre.localeCompare(b.nombre, 'es')
        if (orden.campo === 'estado') return signo * a.estado.localeCompare(b.estado, 'es')
        if (orden.campo === 'cuota') return signo * (Number(a.cuotaAlDia) - Number(b.cuotaAlDia))
        if (orden.campo === 'antiguedad') return signo * (a.antiguedad - b.antiguedad)
        return signo * ((a.numero || Infinity) - (b.numero || Infinity))
      })
  }, [sesgados, query, filter, filtroEtiqueta, orden, soloCumples, roles])

  const cumplenEsteMes = useMemo(
    () => hermanos.filter((h) => h.estado !== 'Baja' && cumpleEsteMes(h.fechaNacimiento)).length,
    [hermanos],
  )

  /** Añade o quita una etiqueta a un hermano (y refleja el cambio en la ficha abierta). */
  /** Cambia unos cuantos campos de un hermano. Se guarda al escribir, como el resto. */
  function aplicarHermano(hermanoId: string, cambios: Partial<Hermano>) {
    setHermanos((prev) => prev.map((h) => (h.id === hermanoId ? { ...h, ...cambios } : h)))
  }

  function toggleEtiquetaHermano(hermanoId: string, etiqueta: string) {
    setHermanos((prev) =>
      prev.map((h) => {
        if (h.id !== hermanoId) return h
        const actuales = h.etiquetas ?? []
        const siguiente = actuales.includes(etiqueta)
          ? actuales.filter((e) => e !== etiqueta)
          : [...actuales, etiqueta]
        return { ...h, etiquetas: siguiente }
      }),
    )
  }

  /** Crea una etiqueta nueva en el catálogo y se la asigna al hermano abierto. */
  function crearEtiqueta() {
    const limpia = nuevaEtiqueta.trim()
    if (!limpia) return
    if (!etiquetas.includes(limpia)) setEtiquetas([...etiquetas, limpia])
    if (selected && !(selected.etiquetas ?? []).includes(limpia)) {
      toggleEtiquetaHermano(selected.id, limpia)
    }
    setNuevaEtiqueta('')
  }

  const stats = useMemo(() => {
    const total = hermanos.length
    // «Nuevo» también es miembro: ver esMiembro().
    const activos = hermanos.filter(esMiembro).length
    const nuevos = hermanos.filter((h) => h.estado === 'Nuevo').length
    // Los civiles fuera: no se les emite cuota, así que no pueden deberla.
    const pendientes = hermanos.filter((h) => !h.civil && !h.cuotaAlDia).length
    return { total, activos, nuevos, pendientes }
  }, [hermanos])

  // El tramo de cada hermano no se guarda: se calcula solo a partir de su
  // número de hermano y del aforo de los tramos configurados (ver Cortejo).
  const tramos = tramosRoles
  const hermanoDe = useMemo(() => {
    const map = new Map(hermanos.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [hermanos])
  const tramoPorHermano = useMemo(() => {
    const anio = getCampana().anio
    const papeletas = leerDatos(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES).filter((p) => p.anio === anio)
    const map = new Map<string, string>()
    repartoCompleto(tramos, papeletas, hermanoDe, new Set()).forEach((a) => {
      if (!a.tramo) return
      map.set(a.hermano.id, a.estado === 'Excede aforo' ? `${etiquetaTramo(a.tramo)} (excede aforo)` : etiquetaTramo(a.tramo))
    })
    return map
  }, [tramos, hermanoDe])

  /** Campos a medida: se escriben sobre el estado más reciente, no sobre el del render. */
  /** El listado que se ve, tal cual, en un CSV que abre Excel. */
  // Si hay un alta a medias, el navegador pregunta antes de cerrar o recargar.
  useEffect(() => {
    if (!formOpen) return
    function avisar(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [formOpen])

  // 17. La barra «/» enfoca el buscador, como en las aplicaciones de siempre.
  const buscador = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const dentro = document.activeElement
      if (dentro instanceof HTMLInputElement || dentro instanceof HTMLTextAreaElement || dentro instanceof HTMLSelectElement) return
      e.preventDefault()
      buscador.current?.focus()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  const fechaLarga = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  function exportarCsv(lista: Hermano[] = filtered) {
    const columnas = ['Nº', 'Nombre', 'Estado', 'Antigüedad', 'Email', 'Teléfono', 'Cuota al día',
      ...camposPropios.filter((c) => c.nombre.trim()).map((c) => c.nombre)]
    const filas = lista.map((h) => [
      h.numero > 0 ? h.numero : '—', h.nombre, h.estado, h.antiguedad, h.email, h.telefono,
      h.cuotaAlDia ? 'Sí' : 'No',
      ...camposPropios.filter((c) => c.nombre.trim()).map((c) => valorLegible(c, h.campos?.[c.id])),
    ])
    const hoy = new Date()
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    descargarArchivo(`censo-${fecha}.csv`, toCsv(columnas, filas))
  }

  /* ------------------------- Selección múltiple ------------------------- */
  const marcadosVisibles = useMemo(() => filtered.filter((h) => marcados.has(h.id)), [filtered, marcados])
  const todosMarcados = filtered.length > 0 && marcadosVisibles.length === filtered.length

  function alternarMarca(id: string) {
    setMarcados((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }
  /** Marca o desmarca TODO lo que se está viendo (con los filtros puestos). */
  function alternarTodos() {
    setMarcados((prev) => {
      const siguiente = new Set(prev)
      if (todosMarcados) filtered.forEach((h) => siguiente.delete(h.id))
      else filtered.forEach((h) => siguiente.add(h.id))
      return siguiente
    })
  }
  function ponerEtiquetaMasiva(etiqueta: string) {
    if (!etiqueta) return
    setHermanos((prev) =>
      prev.map((h) =>
        marcados.has(h.id) && !(h.etiquetas ?? []).includes(etiqueta)
          ? { ...h, etiquetas: [...(h.etiquetas ?? []), etiqueta] }
          : h,
      ),
    )
    setAvisoMasivo(`Etiqueta «${etiqueta}» puesta a ${marcados.size} hermano${marcados.size === 1 ? '' : 's'}.`)
  }
  function quitarEtiquetaMasiva(etiqueta: string) {
    if (!etiqueta) return
    setHermanos((prev) =>
      prev.map((h) =>
        marcados.has(h.id) ? { ...h, etiquetas: (h.etiquetas ?? []).filter((x) => x !== etiqueta) } : h,
      ),
    )
    setAvisoMasivo(`Etiqueta «${etiqueta}» quitada a ${marcados.size} hermano${marcados.size === 1 ? '' : 's'}.`)
  }

  function guardarCampos(id: string, campos: Record<string, string>) {
    setHermanos((prev) => prev.map((h) => (h.id === id ? { ...h, campos } : h)))
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const nombre = String(data.get('nombre') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    /**
     * El DNI se guarda SIEMPRE limpio: sin puntos, sin guiones, sin espacios.
     *
     * Antes se guardaba tal cual lo escribieran, y eso rompía dos cosas a la
     * vez, las dos en silencio:
     *
     *   - El control de duplicados. «12.345.678-A» y «12345678A» son el mismo
     *     señor, pero comparados en crudo no coinciden: se daba de alta dos
     *     veces al mismo hermano, con dos números distintos.
     *   - Y peor: el hermano no podía entrar en su área. Ahí escribe su DNI
     *     como lo lleva la tarjeta, y la búsqueda no encontraba la ficha. El
     *     mensaje que veía era «DNI o contraseña incorrectos», así que probaba
     *     contraseñas hasta rendirse y llamar a secretaría.
     */
    const dni = limpiarDni(String(data.get('dni') ?? ''))
    if (!nombre || !email || !dni) return
    if (guardandoAlta) return
    setGuardandoAlta(true)

    if (hermanos.some((h) => limpiarDni(h.dni) === dni)) {
      setDniError(`Ya hay un hermano registrado con el DNI ${dni}.`)
      // Sin esto el botón se quedaba en «Guardando…» y deshabilitado para
      // siempre: había que cerrar el panel y volver a escribirlo todo.
      setGuardandoAlta(false)
      return
    }
    setDniError(null)

    const ibanRaw = String(data.get('iban') ?? '').trim()
    const iban = ibanRaw && isPlausibleIban(ibanRaw) ? ibanRaw : null
    const fechaNacimiento = String(data.get('fechaNacimiento') ?? '').trim() || undefined

    const nuevo: Hermano = {
      id: nuevoId(),
      // Se numera dentro del setHermanos de abajo, con la lista más reciente.
      numero: 0,
      nombre,
      estado: 'Nuevo',
      antiguedad: new Date().getFullYear(),
      email,
      telefono: String(data.get('telefono') ?? '') || 'Sin datos',
      direccion: String(data.get('direccion') ?? '') || 'Sin datos',
      cuotaAlDia: false,
      iban,
      dni,
      /*
       * Su contraseña provisional es ALEATORIA, no su DNI.
       *
       * Antes era el DNI, «fácil de comunicar». Y también fácil de adivinar:
       * el DNI está en su ficha, así que cualquiera con acceso al censo podía
       * entrar como cualquier hermano que no la hubiera cambiado — incluido el
       * Hermano Mayor, cuyo cargo abre los trece módulos. Ver src/lib/claves.ts.
       *
       * No se guarda en ninguna parte: se usa para crear la cuenta, se le manda
       * por correo y aquí queda en blanco. La de verdad vive cifrada en
       * Supabase Auth.
       */
      claveAcceso: '',
      authUserId: null,
      fechaNacimiento,
      campos: Object.keys(camposNuevo).length ? camposNuevo : undefined,
    }
    const claveProvisional = claveDeUnSoloUso()
    const acceso = await crearAccesoHermano(email, claveProvisional, dni, nombre)
    nuevo.authUserId = acceso.id
    if (acceso.error) setAvisoAcceso(acceso.error)
    // El duplicado se vuelve a mirar DENTRO del updater: entre el clic y la
    // respuesta de Supabase pasan segundos, y pulsando dos veces se daban de
    // alta dos hermanos con el mismo DNI.
    let duplicado = false
    let suNumero = 0
    setHermanos((prev) => {
      if (prev.some((h) => h.dni.trim().toUpperCase() === dni)) {
        duplicado = true
        return prev
      }
      suNumero = Math.max(0, ...prev.map((h) => h.numero)) + 1
      return [...prev, { ...nuevo, numero: suNumero }]
    })
    // La bienvenida, igual que en el alta desde solicitud.
    // La bienvenida, igual que en el alta desde solicitud, y con la contraseña
    // de un solo uso: es la única vez que se escribe en algún sitio.
    if (!duplicado) {
      void darLaBienvenida({
        id: nuevo.id, nombre: nuevo.nombre, email: nuevo.email, dni: nuevo.dni,
        numero: suNumero, claveProvisional: acceso.id ? claveProvisional : null,
        hermandad: hermandad.nombreLegal,
      })
    }
    if (duplicado) {
      setDniError('Ya hay un hermano con ese DNI.')
      setGuardandoAlta(false)
      return
    }
    setJustAddedId(nuevo.id)
    setFormOpen(false)
    setFilter('Todos')
    setQuery('')
    form.reset()
    setCamposNuevo({})
    setGuardandoAlta(false)
    setTimeout(() => setJustAddedId(null), 3000)
  }

  function guardarIban() {
    if (!selected) return
    const trimmed = ibanDraft.trim()
    if (trimmed && !isPlausibleIban(trimmed)) {
      setIbanError('Ese IBAN no parece válido. Revísalo (ej. ES91 2100 0418 4502 0005 1332).')
      return
    }
    const nuevoIban = trimmed || null
    if ((selected.iban ?? null) !== nuevoIban) {
      const texto = 'La secretaría ha actualizado tu cuenta bancaria.'
      agregarAvisoHermano(selected.id, texto)
      apuntar({
        autorNombre: quienSoy, accion: 'iban', sobreTipo: 'hermano',
        sobreId: selected.id, sobreNombre: selected.nombre,
        // El IBAN NO se apunta: duplicaría datos bancarios en una segunda
        // tabla que nadie vigila. Con saber quién lo tocó y cuándo basta.
        detalle: `Cambió la cuenta bancaria de ${selected.nombre}`,
      })
      // Este en concreto conviene que salga por correo: un cambio de cuenta
      // que el hermano no ha pedido es lo primero que hay que poder detectar.
      avisarPorCorreo(
        [{ id: selected.id, nombre: selected.nombre, email: selected.email }],
        // «importante», no «ficha»: el interruptor de ficha viene apagado de
        // fábrica, así que este aviso —el que permite detectar un cambio de
        // cuenta que el hermano no ha pedido— no salía NUNCA.
        'importante',
        'Han cambiado tu cuenta bancaria',
        [texto, 'Si no lo has pedido tú, avisa a la secretaría cuanto antes.'],
      )
    }
    setHermanos((prev) => prev.map((h) => (h.id === selected.id ? { ...h, iban: nuevoIban } : h)))
    setIbanError(null)
    setIbanSaved(true)
    setTimeout(() => setIbanSaved(false), 2500)
  }

  /** Guarda los datos de contacto editados en la ficha y avisa al hermano. */
  function guardarContacto() {
    if (!selected) return
    const nuevo: Hermano = {
      ...selected,
      email: contacto.email.trim() || selected.email,
      telefono: contacto.telefono.trim() || 'Sin datos',
      direccion: contacto.direccion.trim() || 'Sin datos',
    }
    const cambio = avisarCambiosHermano(selected, nuevo)
    if (cambio) {
      apuntar({
        autorNombre: quienSoy, accion: 'ficha', sobreTipo: 'hermano',
        sobreId: nuevo.id, sobreNombre: nuevo.nombre, detalle: cambio.replace('La secretaría ha', 'Cambió'),
      })
    }
    // Y por correo, si la hermandad tiene encendido «avisar de cambios en la
    // ficha». Viene apagado de fábrica a propósito: son muchos y menores.
    if (cambio) {
      avisarPorCorreo(
        [{ id: nuevo.id, nombre: nuevo.nombre, email: nuevo.email }],
        'ficha',
        'Han cambiado datos de tu ficha',
        [cambio, 'Si no reconoces este cambio, avisa a la secretaría.'],
        'Este aviso lo puedes apagar desde tu área de hermano.',
      )
    }
    setHermanos((prev) => prev.map((h) => (h.id === selected.id ? nuevo : h)))
    setContactoSaved(true)
    setTimeout(() => setContactoSaved(false), 2500)
  }

  /**
   * Da de baja a un hermano y renumera el censo: su número queda libre y todos
   * los hermanos con número mayor descienden uno (los números «suben» en el
   * escalafón de antigüedad). El hermano de baja sale de la numeración activa
   * (número 0, se muestra como «—»); su historial se conserva.
   */
  function darDeBaja(hermanoId: string) {
    const objetivo = hermanos.find((h) => h.id === hermanoId)
    if (!objetivo || objetivo.estado === 'Baja') return
    // Se recoloca dentro del updater: la lista pudo cambiar (otra pestaña, una
    // recarga desde la base) entre el clic y este momento.
    setHermanos((prev) => darDeBajaEnCenso(prev, hermanoId))
    const texto = 'La secretaría ha tramitado tu baja en la hermandad.'
    agregarAvisoHermano(hermanoId, texto)
    apuntar({
      autorNombre: quienSoy, accion: 'baja', sobreTipo: 'hermano',
      sobreId: objetivo.id, sobreNombre: objetivo.nombre,
      detalle: `Tramitó la baja de ${objetivo.nombre} (nº ${objetivo.numero})`,
    })
    // Por correo también: a partir de aquí deja de tener acceso a su área, así
    // que el aviso de dentro no lo va a leer. Es el único caso en el que el
    // correo no es un extra, es la única forma de enterarse.
    avisarPorCorreo(
      [{ id: objetivo.id, nombre: objetivo.nombre, email: objetivo.email }],
      // «importante»: desde este momento no puede entrar en su área, así que
      // el aviso de dentro no lo va a leer. Iba por el interruptor de ficha,
      // apagado de fábrica, y no salía.
      'importante',
      'Tu baja en la hermandad',
      [texto, 'Si crees que es un error, ponte en contacto con la secretaría.'],
    )
  }

  /**
   * Retira la solicitud sin dar de baja a nadie. Hace falta: mucha se pide en
   * caliente por algo que se arregla hablando, y sin esto la marca se quedaba
   * puesta para siempre y el contador no bajaba nunca.
   */
  function descartarBaja(hermanoId: string) {
    setHermanos((prev) =>
      prev.map((h) =>
        h.id === hermanoId ? { ...h, bajaSolicitada: false, bajaSolicitadaEl: undefined, motivoBaja: undefined } : h,
      ),
    )
    agregarAvisoHermano(
      hermanoId,
      'Hemos retirado tu solicitud de baja tras hablarlo contigo. Sigues siendo hermano/a con tu número y tu antigüedad.',
    )
  }

  /**
   * Reactiva a un hermano de baja. Hay dos formas, y no da igual cuál:
   *
   * - **Al final**: entra con el último número, como uno nuevo. Vale para quien
   *   se fue hace veinte años y vuelve.
   * - **Recuperando su antigüedad**: vuelve al puesto que le corresponde por su
   *   año de entrada, y los que están por debajo bajan uno. Es lo normal en una
   *   hermandad cuando alguien se reincorpora, y hasta ahora no se podía: se le
   *   mandaba al final siempre, perdiendo todo su escalafón.
   */
  function reactivar(hermanoId: string, recuperarAntiguedad: boolean) {
    const objetivo = hermanos.find((h) => h.id === hermanoId)
    if (!objetivo || objetivo.estado !== 'Baja') return
    setHermanos((prev) => reactivarEnCenso(prev, hermanoId, recuperarAntiguedad))
  }

  async function descargarDatosRgpd(hermano: Hermano) {
    const datos = await recopilarDatosHermano(hermano.id)
    if (!datos) return
    const slug = hermano.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    descargarArchivo(`datos-${slug}.json`, exportarDatosHermano(datos), 'application/json;charset=utf-8;')
  }

  async function borrarHermanoRgpd(hermano: Hermano) {
    const ok = window.confirm(
      `Vas a borrar a ${hermano.nombre} y todos sus datos (cuotas, papeletas e incidencias). ` +
        'Esta acción ejerce el derecho de supresión (RGPD) y no se puede deshacer. ¿Continuar?',
    )
    if (!ok) return
    const censo = await borrarDatosHermano(hermano.id)
    if (censo === null) {
      // El borrado se hizo, pero no se pudo releer el censo: se quita solo a ese
      // hermano de la lista en vez de dejarla vacía por un fallo de red.
      setHermanos((prev) => prev.filter((h) => h.id !== hermano.id))
      window.alert('Los datos se han borrado, pero no se pudo actualizar el listado. Recarga la página para verlo al día.')
    } else {
      setHermanos(censo)
    }
    setSelectedId(null)
  }

  return (
    <div className="dash">
      {avisoAcceso && (
        <div className="banner-inline banner-inline--warn" role="alert">
          <span>{avisoAcceso}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAvisoAcceso(null)}>
            Entendido
          </button>
        </div>
      )}
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Hermanos</p>
          <h1>Censo de la hermandad</h1>
          <p className="dash-head__lead">
            {stats.total} hermanos registrados{hayDatosDeEjemplo() ? ' · datos de ejemplo mientras conectamos la base de datos' : ''}
          </p>
        </div>
        <div className="dash-head__actions">
          {pendientes.length > 0 && (
            <button className="btn btn-outline" onClick={() => setSolicitudesOpen(true)}>
              Solicitudes de alta ({pendientes.length})
            </button>
          )}
          {bajasPedidas.length > 0 && (
            <button className="btn btn-outline" onClick={() => setBajasOpen(true)}>
              Bajas pedidas ({bajasPedidas.length})
            </button>
          )}
          {/* Se exporta y se imprime EXACTAMENTE lo que hay en pantalla: si has
              sesgado por «costaleros al día», eso es lo que sale. */}
          <MenuAcciones etiqueta="Exportar">
            <button type="button" onClick={() => exportarCsv()} disabled={filtered.length === 0}>
              Descargar en Excel (CSV) <small>{filtered.length}</small>
            </button>
            {/* Importar vive aquí, junto a exportar: es la misma idea (entrar y
                salir datos) y así se encuentra sin buscarla en Configuración. */}
            <button type="button" onClick={() => setImportarOpen(true)}>
              Traer vuestro censo (CSV)
            </button>
            <button type="button" className="no-print" onClick={() => window.print()} disabled={filtered.length === 0}>
              Imprimir el listado <small>{filtered.length}</small>
            </button>
          </MenuAcciones>
          <button className="btn btn-primary" onClick={() => { setDniError(null); setFormOpen(true) }}>
            + Nuevo hermano
          </button>
        </div>
      </div>

      {pendientes.length > 0 && (
        <div className="banner-inline banner-inline--accent">
          {pendientes.length} persona{pendientes.length > 1 ? 's' : ''} {pendientes.length > 1 ? 'han' : 'ha'} pedido el
          alta como hermano/a desde el área del hermano.{' '}
          <button type="button" className="portal__link-btn" onClick={() => setSolicitudesOpen(true)}>
            Revisar solicitudes
          </button>
        </div>
      )}

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Total hermanos</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Censo completo</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Activos</span>
          <span className="stat-tile__value">{stats.activos}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">De pleno derecho</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Altas nuevas</span>
          <span className="stat-tile__value">{stats.nuevos}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Este ejercicio</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Cuota pendiente</span>
          <span className="stat-tile__value">{stats.pendientes}</span>
          <span className="stat-tile__trend stat-tile__trend--warn">Por regularizar</span>
        </div>
      </section>

      <div className="toolbar">
        <input
          ref={buscador}
          className="search-box"
          placeholder="Buscar por nombre o número  ( / )"
          aria-label="Buscar por nombre o número de hermano"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {/* El filtro de bajas pedidas solo aparece cuando hay alguna: si no,
              sería una pestaña siempre vacía. */}
          {([
            'Todos', 'Activo', 'Nuevo', 'Baja',
            ...(bajasPedidas.length > 0 ? (['Piden la baja'] as const) : []),
          ] as const).map((f) => (
            <button
              key={f}
              className={`chip${filter === f ? ' chip--active' : ''}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === 'Todos' ? 'Todos'
                : f === 'Activo' ? 'Activos'
                : f === 'Nuevo' ? 'Nuevos'
                : f === 'Baja' ? 'Baja'
                : `Piden la baja (${bajasPedidas.length})`}
            </button>
          ))}
          {cumplenEsteMes > 0 && (
            <button
              type="button"
              className={`chip chip--cumples${soloCumples ? ' chip--active' : ''}`}
              onClick={() => setSoloCumples((v) => !v)}
              title={`Hermanos que cumplen años en ${mesEnCurso()}`}
            >
              🎂 Cumplen en {mesEnCurso()} ({cumplenEsteMes})
            </button>
          )}
        </div>
        <button
          type="button"
          className={`chip${sesgando ? ' chip--active' : ''}`}
          onClick={() => setSesgando((v) => !v)}
          aria-expanded={sesgando}
        >
          {sesgoActivo ? '✓ Sesgado' : 'Sesgar'}
        </button>
        {/* En la lista van las de la hermandad Y las que salen de la papeleta:
            si no, «Costalero» no aparecería para elegirlo aunque haya
            trescientos costaleros este año. */}
        {etiquetasParaFiltrar.length > 0 && (
          <select
            className="search-box"
            style={{ maxWidth: '15rem' }}
            value={filtroEtiqueta}
            onChange={(e) => setFiltroEtiqueta(e.target.value)}
            aria-label="Filtrar por etiqueta"
          >
            <option value="">Todas las etiquetas</option>
            {etiquetasParaFiltrar.map((et) => (
              <option key={et} value={et}>
                {et}{rolesAutomaticos.includes(et) && !etiquetas.includes(et) ? ' (por papeleta)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {sesgando && (
        <EditorSegmento
          etiquetasExtra={rolesAutomaticos}
          criterios={criterios}
          onChange={setCriterios}
          cuantos={sesgados.length}
          conFiltroEmail={false}
          onLimpiar={sesgoActivo ? () => setCriterios(SIN_SESGO) : undefined}
        />
      )}

      {marcados.size > 0 && (
        <div className="masiva" role="region" aria-label="Acciones sobre los seleccionados">
          <b>{marcados.size} seleccionado{marcados.size === 1 ? '' : 's'}</b>
          {etiquetas.length > 0 && (
            <>
              <select
                value=""
                onChange={(e) => { ponerEtiquetaMasiva(e.target.value); e.currentTarget.value = '' }}
                aria-label="Poner una etiqueta a los seleccionados"
              >
                <option value="">Poner etiqueta…</option>
                {etiquetas.map((et) => <option key={et} value={et}>{et}</option>)}
              </select>
              <select
                value=""
                onChange={(e) => { quitarEtiquetaMasiva(e.target.value); e.currentTarget.value = '' }}
                aria-label="Quitar una etiqueta de los seleccionados"
              >
                <option value="">Quitar etiqueta…</option>
                {etiquetas.map((et) => <option key={et} value={et}>{et}</option>)}
              </select>
            </>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => exportarCsv(hermanos.filter((h) => marcados.has(h.id)))}
          >
            Exportar los {marcados.size}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMarcados(new Set()); setAvisoMasivo(null) }}>
            Quitar selección
          </button>
          {avisoMasivo && <span className="masiva__hecho">✓ {avisoMasivo}</span>}
        </div>
      )}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th className="col-marca">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={alternarTodos}
                  disabled={filtered.length === 0}
                  aria-label={todosMarcados ? 'Quitar la marca a todos' : 'Marcar todos los que se ven'}
                  title={todosMarcados ? 'Quitar la marca a todos' : `Marcar los ${filtered.length} que se ven`}
                />
              </th>
              {COLUMNAS.map((c) => (
                <th key={c.id} className={`${c.orden ? 'th-ordenable' : ''}${c.opcional ? ' col-opcional' : ''}`.trim() || undefined}>
                  {c.orden ? (
                    <button type="button" onClick={() => ordenarPor(c.id as OrdenCampo)} aria-label={`Ordenar por ${c.label}`}>
                      {c.label}
                      <span aria-hidden="true" className="th-flecha">
                        {orden.campo === c.id ? (orden.asc ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  ) : c.label}
                </th>
              ))}
              <th className="col-opcional"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => (
              <tr
                key={h.id}
                className={h.id === justAddedId ? 'row--flash' : undefined}
                {...filaQueAbre(() => setSelectedId(h.id))}
              >
                <td className="col-marca" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={marcados.has(h.id)}
                    onChange={() => alternarMarca(h.id)}
                    aria-label={`Marcar a ${h.nombre}`}
                  />
                </td>
                <td className="num col-opcional">{h.numero > 0 ? h.numero : '—'}</td>
                <td>
                  <div className="row-person">
                    {/* Un tono estable por persona: el censo deja de ser una
                        columna de círculos grises todos iguales. */}
                    <span className="row-avatar" style={{ '--tono': tonoDe(h.nombre).fondo } as CSSProperties}>
                      {initials(h.nombre)}
                    </span>
                    <span>
                      <span className="row-person__name">{h.nombre}</span>
                      <span className="row-person__sub">{h.email}</span>
                      {/* En el móvil se ocultan Nº, tramo y antigüedad. */}
                      <span className="row-person__sub solo-movil">
                        Nº {h.numero > 0 ? h.numero : '—'} · {cuotaEnPalabras(h).toLowerCase()} · {tramoPorHermano.get(h.id) ?? 'sin papeleta'}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="col-opcional">
                  {tramoPorHermano.get(h.id) ?? <span className="table-muted">Sin papeleta</span>}
                </td>
                <td>
                  <span className={`pill ${estadoClass(h.estado)}`}>{h.estado}</span>
                  {h.bajaSolicitada && h.estado !== 'Baja' && (
                    <span
                      className="pill-avisado"
                      title={`Pidió la baja${h.bajaSolicitadaEl ? ` el ${h.bajaSolicitadaEl}` : ''}`}
                    >
                      Pide la baja
                    </span>
                  )}
                </td>
                <td className="col-opcional">
                  <span className={`pill ${cuotaClass(h)}`}>{cuotaEnPalabras(h)}</span>
                </td>
                <td className="num col-opcional">
                  {/* Sin antigüedad, una raya: el censo llegó a poner «NaN
                      años» debajo de cada nombre cuando esa columna no venía
                      en el Excel que se importó. */}
                  {h.antiguedad || '—'}
                  {aniosDeHermandad(h.antiguedad) !== null && (
                    <span className="table-subtle"> · {aniosDeHermandad(h.antiguedad)} años</span>
                  )}
                </td>
                <td className="col-opcional">
                  <button
                    className="icon-btn"
                    title="Ver ficha"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedId(h.id)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="table-empty">
                  {/* Decir POR QUÉ está vacío y ofrecer la salida, en vez de
                      dejar al usuario mirando un «no hay resultados». */}
                  <p className="vacio__titulo">
                    {hermanos.length === 0 ? 'Todavía no hay nadie en el censo' : 'Ningún hermano coincide'}
                  </p>
                  <p className="vacio__texto">
                    {hermanos.length === 0
                      ? 'Da de alta al primero, o restaura una copia de seguridad desde Configuración.'
                      : [
                          query.trim() && `la búsqueda «${query.trim()}»`,
                          filter !== 'Todos' && `el filtro «${filter}»`,
                          filtroEtiqueta && `la etiqueta «${filtroEtiqueta}»`,
                          sesgoActivo && 'el sesgo aplicado',
                        ].filter(Boolean).join(', ').replace(/,([^,]*)$/, ' y$1') || 'los filtros'}
                    {hermanos.length > 0 && ' no deja pasar a nadie del censo.'}
                  </p>
                  <div className="vacio__acciones">
                    {hermanos.length === 0 ? (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => { setDniError(null); setFormOpen(true) }}>
                        + Dar de alta al primero
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => { setQuery(''); setFilter('Todos'); setFiltroEtiqueta(''); setCriterios(SIN_SESGO) }}
                      >
                        Quitar todos los filtros
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ficha individual */}
      <ImportarCenso
        abierto={importarOpen}
        onCerrar={() => setImportarOpen(false)}
        censo={hermanos}
        onImportar={(censo) => setHermanos(censo)}
      />

      <Drawer
        open={!!selected}
        ancho="ancho"
        onClose={() => setSelectedId(null)}
        title={selected?.nombre ?? ''}
        subtitle={
          selected
            ? selected.numero > 0
              ? `Hermano nº ${selected.numero}`
              : selected.civil
                ? 'Hermano civil · no ocupa número ni paga cuota'
                : 'De baja · sin número activo'
            : undefined
        }
      >
        {selected && (
          <div className="ficha">
            {/* Cabecera de la ficha: quién es, de un vistazo. Antes se entraba
                directamente a una lista de campos y no se sabía ni a quién se
                estaba mirando más allá del título del panel. */}
            <header className="ficha-hero" style={{ '--tono': tonoDe(selected.nombre).fondo, '--tono-tinta': tonoDe(selected.nombre).tinta } as CSSProperties}>
              {selected.fotoDataUrl ? (
                <img className="ficha-hero__avatar ficha-hero__avatar--foto" src={selected.fotoDataUrl} alt={`Foto de ${selected.nombre}`} />
              ) : (
                <span className="ficha-hero__avatar" aria-hidden="true">{initials(selected.nombre)}</span>
              )}
              {/* Sin repetir el nombre ni el número: los tiene justo encima, en
                  la cabecera del panel. Aquí va lo que los completa. */}
              <div className="ficha-hero__quien">
                <b>{fraseAntiguedad(selected)}</b>
                <small>
                  {tramoPorHermano.get(selected.id)
                    ? `En el cortejo: ${tramoPorHermano.get(selected.id)}`
                    : 'Sin papeleta este año'}
                </small>
                <div className="ficha-hero__pills">
                  <span className={`pill ${estadoClass(selected.estado)}`}>{selected.estado}</span>
                  <span className={`pill ${cuotaClass(selected)}`}>
                    {selected.civil ? 'No paga cuota' : cuotaEnPalabras(selected) === 'Al día' ? 'Cuota al día' : 'Cuota pendiente'}
                  </span>
                  {/* El cargo se VE aquí pero no se toca aquí: se pone y se
                      quita en Personal y permisos, que es la pantalla que
                      además lleva la tabla de qué ve cada cargo. Tenerlo en
                      dos sitios sería tener dos verdades. */}
                  {selected.cargo && (
                    <Link className="pill pill--info" to="/app/personal" title="Se cambia en Personal y permisos">
                      {selected.cargo}
                    </Link>
                  )}
                  {isSupabaseConfigured && !selected.authUserId && (
                    <span className="pill pill--alerta" title="No tiene cuenta: no puede entrar en su área">
                      Sin acceso
                    </span>
                  )}
                  {etiquetasDe(selected, roles.get(selected.id) ?? []).slice(0, 4).map((et) => (
                    <span key={et} className="pill pill--info">{et}</span>
                  ))}
                </div>
              </div>
            </header>

            {esSuCumpleHoy(selected.fechaNacimiento) && (
              <p className="ficha-cumple">🎂 Hoy es su cumpleaños.</p>
            )}

            <dl className="ficha__list ficha__list--dos">
              <div><dt>DNI / NIE</dt><dd>{selected.dni}</dd></div>
              {selected.fechaNacimiento && (
                <div>
                  <dt>Cumpleaños</dt>
                  <dd>
                    {diaYMes(selected.fechaNacimiento)}
                    {edadDe(selected.fechaNacimiento) !== null && ` · ${edadDe(selected.fechaNacimiento)} años`}
                  </dd>
                </div>
              )}
              <div>
                <dt>Entra a su área con</dt>
                <dd>
                  {/*
                    LA CONTRASEÑA YA NO SE ENSEÑA, y era lo peor de todo: se
                    imprimía en claro en la ficha, así que bastaba con abrirla
                    para poder entrar como esa persona.
                    Ahora ni se guarda ni se sabe: se le manda de un solo uso
                    al darle de alta y él la cambia. Si la pierde, se le manda
                    una nueva a su correo desde la propia pantalla de acceso.
                  */}
                  su DNI y su contraseña. Si no la recuerda, puede pedir una
                  nueva desde <code>/hermano</code>, con «He olvidado mi contraseña».
                </dd>
              </div>
            </dl>

            <div className="assign-box">
              <label>Datos de contacto</label>
              <p className="form-hint">
                Si cambias algún dato, el hermano recibe un aviso en su área (correo simulado hasta
                conectar el proveedor).
              </p>
              <div className="form-row">
                <label htmlFor="emailHermano">Correo electrónico</label>
                <input
                  id="emailHermano"
                  type="email"
                  value={contacto.email}
                  onChange={(e) => setContacto((c) => ({ ...c, email: e.target.value }))}
                />
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor="telHermano">Teléfono</label>
                  <input
                    id="telHermano"
                    type="tel"
                    value={contacto.telefono}
                    placeholder="600 000 000"
                    onChange={(e) => setContacto((c) => ({ ...c, telefono: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="dirHermano">Dirección</label>
                  <input
                    id="dirHermano"
                    type="text"
                    value={contacto.direccion}
                    placeholder="Calle y número"
                    onChange={(e) => setContacto((c) => ({ ...c, direccion: e.target.value }))}
                  />
                </div>
              </div>
              <div className="assign-box__row">
                <button type="button" className="btn btn-primary btn-sm" onClick={guardarContacto}>
                  Guardar datos de contacto
                </button>
                {contactoSaved && <span className="form-hint form-hint--ok">Guardado · avisado al hermano.</span>}
              </div>
            </div>
            <div className="assign-box">
              <label>Foto</label>
              <FotoHermano
                nombre={selected.nombre}
                foto={selected.fotoDataUrl}
                consiente={selected.consienteFoto}
                onCambiar={(foto, consiente) => aplicarHermano(selected.id, { fotoDataUrl: foto, consienteFoto: consiente })}
              />
            </div>

            <div className="assign-box">
              <label>Datos que suelen hacer falta</label>
              <p className="form-hint">
                El expediente pide el bautismo; la talla y las notas de salud se acaban apuntando en
                un papel aparte que se pierde todos los años.
              </p>
              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor="parroquiaBautismo">Parroquia de bautismo</label>
                  <input
                    id="parroquiaBautismo" type="text" value={selected.parroquiaBautismo ?? ''}
                    onChange={(e) => aplicarHermano(selected.id, { parroquiaBautismo: e.target.value })}
                    placeholder="Parroquia de Santa Ana"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="fechaBautismo">Fecha de bautismo</label>
                  <input
                    id="fechaBautismo" type="date" value={selected.fechaBautismo ?? ''}
                    onChange={(e) => aplicarHermano(selected.id, { fechaBautismo: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor="tallaTunica">Talla de túnica</label>
                  <input
                    id="tallaTunica" type="text" value={selected.tallaTunica ?? ''}
                    onChange={(e) => aplicarHermano(selected.id, { tallaTunica: e.target.value })}
                    placeholder="M · 1,75 m"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="notasSalud">Para el día de la salida</label>
                  <input
                    id="notasSalud" type="text" value={selected.notasSalud ?? ''}
                    onChange={(e) => aplicarHermano(selected.id, { notasSalud: e.target.value })}
                    placeholder="Alergia a…, no puede andar mucho"
                  />
                  <p className="form-hint">Son ocho horas de pie: esto no es curiosidad.</p>
                </div>
              </div>
            </div>

            <div className="assign-box">
              <label>Etiquetas</label>
              <p className="form-hint">
                Marca los grupos a los que pertenece. Sirven para mandarle avisos segmentados (p. ej.
                solo a los costaleros) y para filtrar el censo.
              </p>
              {/* Las que vienen de su papeleta no se marcan a mano: se ponen
                  solas mientras la tenga y se van si la anula. Enseñarlas aquí
                  evita que alguien las busque en la lista y no las encuentre. */}
              {(roles.get(selected.id) ?? []).length > 0 && (
                <div className="etiquetas-auto">
                  <span className="etiquetas-auto__ante">Por su papeleta de este año</span>
                  <div className="etiquetas-chips">
                    {(roles.get(selected.id) ?? []).map((et) => (
                      <span key={et} className="chip chip--auto" title="Se pone sola por el tramo u opción de su papeleta">
                        {et}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="etiquetas-chips">
                {etiquetas.map((et) => {
                  const activa = (selected.etiquetas ?? []).includes(et)
                  return (
                    <button
                      type="button"
                      key={et}
                      className={`chip chip--toggle${activa ? ' chip--active' : ''}`}
                      onClick={() => toggleEtiquetaHermano(selected.id, et)}
                    >
                      {activa ? '✓ ' : ''}{et}
                    </button>
                  )
                })}
              </div>
              <div className="assign-box__row" style={{ marginTop: '0.6rem' }}>
                <input
                  type="text"
                  placeholder="Crear etiqueta nueva…"
                  value={nuevaEtiqueta}
                  onChange={(e) => setNuevaEtiqueta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      crearEtiqueta()
                    }
                  }}
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={crearEtiqueta}>
                  Añadir
                </button>
              </div>
            </div>

            {camposPropios.length > 0 && (
              <div className="assign-box">
                <label>Datos propios de la hermandad</label>
                <p className="form-hint">
                  Los campos que habéis definido en <Link to="/app/configuracion">Configuración</Link>.
                  Se guardan al escribir.
                </p>
                <CamposPropiosForm
                  campos={camposPropios}
                  valores={selected.campos ?? {}}
                  onChange={(valores) => guardarCampos(selected.id, valores)}
                  idPrefijo="ficha"
                />
              </div>
            )}

            <div className="assign-box">
              <label htmlFor="ibanHermano">
                Cuenta bancaria (para domiciliar sus cuotas)
              </label>
              <div className="assign-box__row">
                <input
                  id="ibanHermano"
                  type="text"
                  placeholder="ES00 0000 0000 0000 0000 0000"
                  value={ibanDraft}
                  onChange={(e) => {
                    setIbanDraft(e.target.value)
                    setIbanError(null)
                  }}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={guardarIban}>
                  Guardar
                </button>
              </div>
              {ibanError && <p className="form-hint form-hint--error">{ibanError}</p>}
              {ibanSaved && !ibanError && <p className="form-hint form-hint--ok">Cuenta guardada.</p>}
              {!selected.iban && !ibanDraft && !ibanError && (
                <p className="form-hint">
                  Sin cuenta registrada, sus cuotas no se pueden domiciliar todavía.
                </p>
              )}
              {selected.iban && !ibanError && ibanDraft === selected.iban && (
                <p className="form-hint">Cuenta actual: {maskIban(selected.iban)}</p>
              )}
            </div>

            <details className="afinar afinar--suelto ficha-admin">
              <summary className="afinar__cabeza">
                <span className="afinar__titulo">Administración</span>
                <span className="afinar__nota">Baja, reactivación y protección de datos</span>
              </summary>
              <div className="afinar__cuerpo">
            <div className="assign-box">
              <label>Situación en la hermandad</label>
              {selected.bajaSolicitada && selected.estado !== 'Baja' && (
                <div className="banner-inline banner-inline--warn" style={{ marginBottom: '0.7rem' }}>
                  <b>{selected.nombre.split(' ')[0]} ha solicitado la baja</b> desde su área de
                  hermano. Tramítala aquí abajo si procede.
                </div>
              )}
              {selected.estado !== 'Baja' ? (
                <>
                  <p className="form-hint">
                    Al dar de baja, su número queda libre y los hermanos con número mayor
                    descienden uno (el escalafón de antigüedad se recoloca solo). Se conserva su
                    historial y puede reactivarse más adelante.
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm rgpd-borrar"
                    onClick={() => {
                      if (window.confirm(`¿Dar de baja a ${selected.nombre}? Los números de hermano se recolocarán.`)) {
                        darDeBaja(selected.id)
                      }
                    }}
                  >
                    Dar de baja
                  </button>
                </>
              ) : (
                <>
                  <p className="form-hint">
                    Está de baja: fuera de la numeración activa. Al reactivarlo hay que decidir qué
                    pasa con su antigüedad, y no da igual.
                  </p>
                  <div className="assign-box__row">
                    <button
                      type="button" className="btn btn-primary btn-sm"
                      onClick={() => reactivar(selected.id, true)}
                    >
                      Recupera su antigüedad ({selected.antiguedad})
                    </button>
                    <button
                      type="button" className="btn btn-outline btn-sm"
                      onClick={() => reactivar(selected.id, false)}
                    >
                      Entra al final del censo
                    </button>
                  </div>
                  <p className="form-hint">
                    Con <b>recuperar su antigüedad</b> vuelve al puesto que le toca por su año de
                    entrada y los de abajo descienden uno, que es lo normal cuando alguien se
                    reincorpora. Con <b>al final</b> entra como uno nuevo.
                  </p>
                </>
              )}
            </div>

            <div className="assign-box">
              <label>Protección de datos (RGPD)</label>
              <p className="form-hint">
                {selected.nombre.split(' ')[0]} puede ejercer sus derechos sobre sus datos: descargar
                todo lo que la hermandad guarda de él/ella, o pedir que se supriman.
              </p>
              <div className="assign-box__row">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => descargarDatosRgpd(selected)}>
                  Descargar sus datos
                </button>
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => borrarHermanoRgpd(selected)}>
                  Borrar sus datos
                </button>
              </div>
              <p className="form-hint">
                La supresión borra al hermano y sus cuotas, papeletas e incidencias. Ten en cuenta que
                la normativa contable puede obligar a conservar ciertos registros; esa decisión es de
                la hermandad.
              </p>
            </div>
              </div>
            </details>
          </div>
        )}
      </Drawer>

      {/* Alta de hermano */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo hermano"
        subtitle="Alta en el censo"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="hermano-form" type="submit" disabled={guardandoAlta}>
              {guardandoAlta ? 'Guardando…' : 'Guardar hermano'}
            </button>
          </>
        }
      >
        <form id="hermano-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="nombre">Nombre y apellidos</label>
            <input id="nombre" name="nombre" type="text" placeholder="Nombre completo" required />
          </div>
          <div className="form-row">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" placeholder="correo@ejemplo.com" required />
          </div>
          <div className="form-row">
            <label htmlFor="dni">DNI / NIE</label>
            <input id="dni" name="dni" type="text" placeholder="12345678A" required />
            {dniError && <p className="form-hint form-hint--error">{dniError}</p>}
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="telefono">Teléfono</label>
              <input id="telefono" name="telefono" type="tel" placeholder="600 000 000" />
            </div>
            <div className="form-row">
              <label htmlFor="fechaNacimiento">Fecha de nacimiento</label>
              <input id="fechaNacimiento" name="fechaNacimiento" type="date" />
              <p className="form-hint">Necesaria para los avisos por edad (p. ej. solo mayores de edad).</p>
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="direccion">Dirección</label>
            <input id="direccion" name="direccion" type="text" placeholder="Calle y número" />
          </div>
          <div className="form-row">
            <label htmlFor="iban">Cuenta bancaria (opcional)</label>
            <input id="iban" name="iban" type="text" placeholder="ES00 0000 0000 0000 0000 0000" />
          </div>
          <CamposPropiosForm
            campos={camposDeAlta}
            valores={camposNuevo}
            onChange={setCamposNuevo}
            idPrefijo="alta"
          />
          <p className="form-hint">
            Se le asignará automáticamente el siguiente número de hermano disponible y quedará en
            estado «Nuevo». Su usuario será su DNI y la contraseña provisional también su DNI, que
            podrá cambiar desde su área del hermano. Sin cuenta bancaria, sus cuotas no podrán
            domiciliarse hasta que la añada.
          </p>
        </form>
      </Drawer>

      {/* Solicitudes de alta pedidas desde el área del hermano */}
      {/* Documento imprimible: solo aparece en el papel (ver .screen-hidden). */}
      <InformeImpreso
        className="screen-hidden"
        hermandad={hermandad}
        titulo="Censo de hermanos"
        generadoEl={fechaLarga}
        resumen={[
          { etiqueta: 'En este listado', valor: String(filtered.length) },
          { etiqueta: 'Censo completo', valor: String(hermanos.length) },
          ...(sesgoActivo ? [{ etiqueta: 'Sesgo', valor: etiquetaSegmento(criterios, camposPropios) }] : []),
        ]}
        columnas={['Nº', 'Hermano', 'Estado', 'Antigüedad', 'Cuota']}
        filas={filtered.map((h) => [
          h.numero > 0 ? h.numero : '—', h.nombre, h.estado, h.antiguedad, cuotaEnPalabras(h),
        ])}
      />

      <Drawer
        open={bajasOpen}
        onClose={() => setBajasOpen(false)}
        title="Bajas pedidas"
        subtitle={`${bajasPedidas.length} esperando`}
      >
        <div className="ficha">
          <p className="form-hint">
            Lo han pedido desde su área. Hasta que se tramite <b>siguen siendo hermanos de pleno
            derecho</b>, con su número y su antigüedad.
          </p>
          {bajasPedidas.length === 0 ? (
            <p className="form-hint">No hay bajas pendientes.</p>
          ) : (
            bajasPedidas.map((h) => (
              <div className="assign-box" key={h.id}>
                <div className="ficha__row">
                  <span className="pill pill--warn">Pide la baja</span>
                  {h.bajaSolicitadaEl && <span className="pill pill--off">{h.bajaSolicitadaEl}</span>}
                </div>
                <dl className="ficha__list">
                  <div><dt>Hermano/a</dt><dd>{h.nombre}</dd></div>
                  <div><dt>Número</dt><dd>{h.numero > 0 ? h.numero : '—'}</dd></div>
                  <div><dt>Hermano desde</dt><dd>{h.antiguedad}</dd></div>
                  <div><dt>Cuota</dt><dd>{cuotaEnPalabras(h)}</dd></div>
                  {h.email && <div><dt>Correo</dt><dd><a href={`mailto:${h.email}`}>{h.email}</a></dd></div>}
                  {h.telefono && <div><dt>Teléfono</dt><dd><a href={`tel:${h.telefono.replace(/\s+/g, '')}`}>{h.telefono}</a></dd></div>}
                </dl>
                {/* El motivo es lo único que le permite a la hermandad
                    reaccionar. Si lo ha escrito, va destacado, no perdido. */}
                {h.motivoBaja ? (
                  <p className="baja-motivo">«{h.motivoBaja}»</p>
                ) : (
                  <p className="form-hint">No ha dicho por qué.</p>
                )}
                <div className="assign-box__row">
                  <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => darDeBaja(h.id)}>
                    Tramitar la baja
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => descartarBaja(h.id)}>
                    Retirar la solicitud
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setBajasOpen(false); setSelectedId(h.id) }}>
                    Ver su ficha
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>

      <Drawer
        open={solicitudesOpen}
        onClose={() => setSolicitudesOpen(false)}
        title="Solicitudes de alta"
        subtitle={`${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}`}
      >
        <div className="ficha">
          {pendientes.length === 0 ? (
            <p className="form-hint">No hay solicitudes pendientes.</p>
          ) : (
            pendientes.map((sol) => (
              <div className="assign-box" key={sol.id}>
                <div className="ficha__row">
                  <span className="pill pill--warn">Pendiente</span>
                  <span className="pill pill--off">{sol.fecha}</span>
                </div>
                <dl className="ficha__list">
                  <div><dt>Nombre</dt><dd>{sol.nombre}</dd></div>
                  <div><dt>DNI / NIE</dt><dd>{sol.dni}</dd></div>
                  <div><dt>Correo</dt><dd>{sol.email}</dd></div>
                  <div><dt>Teléfono</dt><dd>{sol.telefono || 'Sin datos'}</dd></div>
                  {sol.fechaNacimiento && (
                    <div><dt>Fecha de nacimiento</dt><dd>{sol.fechaNacimiento}</dd></div>
                  )}
                  {/* La pidió un hermano para un hijo suyo: al aprobarla, el
                      menor queda a su cargo. */}
                  {sol.tutorId && (
                    <div>
                      <dt>A cargo de</dt>
                      <dd>{hermanos.find((h) => h.id === sol.tutorId)?.nombre ?? 'un hermano dado de baja'}</dd>
                    </div>
                  )}
                </dl>
                <div className="assign-box__row">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => aprobarSolicitud(sol)}>
                    Aprobar y dar de alta
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => rechazarSolicitud(sol)}>
                    Rechazar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>
    </div>
  )
}
