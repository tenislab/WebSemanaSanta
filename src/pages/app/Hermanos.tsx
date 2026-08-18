import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import MenuAcciones from '../../components/MenuAcciones'
import CamposPropiosForm from '../../components/CamposPropios'
import { HERMANOS_INICIALES, initials, type EstadoHermano, type Hermano } from '../../data/hermanos'
import { PAPELETAS_INICIALES } from '../../data/papeletas'
import { isPlausibleIban, maskIban } from '../../lib/format'
import { getTramos, etiquetaTramo } from '../../lib/tramos'
import { repartoCompleto } from '../../lib/cortejo'
import { CLAVES_DATOS, leerPersistido } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { isSupabaseConfigured, supabaseAlta } from '../../lib/supabase'
import { hermanoToRow, rowToHermano } from '../../lib/db/hermanos'
import { getCampana } from '../../lib/campana'
import { borrarDatosHermano, exportarDatosHermano, recopilarDatosHermano } from '../../lib/rgpd'
import { toCsv, descargarArchivo } from '../../lib/csv'
import { useSolicitudes, saveSolicitudes, type SolicitudAlta } from '../../lib/solicitudes'
import { useEtiquetas } from '../../lib/etiquetas'
import { useCamposPropios, valorLegible } from '../../lib/camposPropios'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import EditorSegmento from '../../components/EditorSegmento'
import InformeImpreso from '../../components/InformeImpreso'
import { etiquetaSegmento, filtrarSegmento, limpiarCriterios, mismosCriterios, type CriteriosSegmento } from '../../lib/segmentacion'

/**
 * En el censo, «sin sesgo» significa enseñarlo ENTERO, bajas incluidas. No
 * vale CRITERIOS_POR_DEFECTO, que ya filtra a activos con correo.
 */
type OrdenCampo = 'numero' | 'nombre' | 'estado' | 'cuota' | 'antiguedad'
const COLUMNAS: { id: OrdenCampo | 'tramo'; label: string; orden: boolean }[] = [
  { id: 'numero', label: 'Nº', orden: true },
  { id: 'nombre', label: 'Hermano', orden: true },
  { id: 'tramo', label: 'Tramo', orden: false },
  { id: 'estado', label: 'Estado', orden: true },
  { id: 'cuota', label: 'Cuota', orden: true },
  { id: 'antiguedad', label: 'Antigüedad', orden: true },
]

const SIN_SESGO: CriteriosSegmento = {
  estado: 'Cualquiera', cuota: 'Todos', edad: 'Todos', etiqueta: '', soloConEmail: false, campos: [],
}
import { agregarAvisoHermano, avisarCambiosHermano } from '../../lib/avisosHermano'

/**
 * Con Supabase conectado, crea además una cuenta real de acceso (mismo
 * correo y contraseña) para que el hermano pueda entrar en su área; sin él,
 * solo entra por el modo demostración. Devuelve el id de esa cuenta, o
 * `null` si no hay Supabase o si algo falla (el hermano se guarda igual,
 * solo que sin poder entrar hasta que se resuelva).
 */
async function crearAccesoHermano(
  email: string,
  password: string,
  dni: string,
  nombre: string,
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabaseAlta) return null
  // supabaseAlta: crea la cuenta sin pisar la sesión del administrador.
  const { data, error } = await supabaseAlta.auth.signUp({
    email,
    password,
    options: {
      data: { tipo: 'hermano', dni, nombre },
      emailRedirectTo: `${window.location.origin}/hermano`,
    },
  })
  if (error) {
    console.error('No se pudo crear el acceso real del hermano en Supabase:', error.message)
    return null
  }
  return data.user?.id ?? null
}

function estadoClass(estado: EstadoHermano) {
  if (estado === 'Activo') return 'pill--ok'
  if (estado === 'Nuevo') return 'pill--info'
  return 'pill--off'
}

export default function Hermanos() {
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
  const [filter, setFilter] = useState<'Todos' | EstadoHermano>('Todos')
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
  const hermandad = useHermandadSettings()
  // Sesgo aplicado al censo. Arranca en «no sesga nada»: el censo se ve entero,
  // bajas incluidas, hasta que alguien pide lo contrario.
  const [sesgando, setSesgando] = useState(false)
  // Ordenación de la tabla. Por número y ascendente, que es lo de siempre.
  const [orden, setOrden] = useState<{ campo: OrdenCampo; asc: boolean }>({ campo: 'numero', asc: true })
  function ordenarPor(campo: OrdenCampo) {
    setOrden((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true }))
  }
  const [criterios, setCriterios] = useState<CriteriosSegmento>(SIN_SESGO)
  const sesgoActivo = !mismosCriterios(criterios, SIN_SESGO)
  const sesgados = useMemo(
    () => (sesgoActivo ? filtrarSegmento(hermanos, limpiarCriterios(criterios)) : hermanos),
    [hermanos, criterios, sesgoActivo],
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

  const [ibanDraft, setIbanDraft] = useState('')
  const [ibanError, setIbanError] = useState<string | null>(null)
  const [ibanSaved, setIbanSaved] = useState(false)
  const [contacto, setContacto] = useState({ email: '', telefono: '', direccion: '' })
  const [contactoSaved, setContactoSaved] = useState(false)

  const solicitudesRemotas = useSolicitudes()
  const [solicitudes, setSolicitudesState] = useState<SolicitudAlta[]>(solicitudesRemotas)
  useEffect(() => setSolicitudesState(solicitudesRemotas), [solicitudesRemotas])
  const [solicitudesOpen, setSolicitudesOpen] = useState(false)
  const pendientes = useMemo(() => solicitudes.filter((s) => s.estado === 'Pendiente'), [solicitudes])

  function actualizarSolicitudes(next: SolicitudAlta[]) {
    setSolicitudesState(next)
    saveSolicitudes(next)
  }

  async function aprobarSolicitud(sol: SolicitudAlta) {
    if (hermanos.some((h) => h.dni.toUpperCase() === sol.dni.toUpperCase())) {
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
      dni: sol.dni,
      claveAcceso: sol.clavePropuesta,
      authUserId: null,
    }
    nuevo.authUserId = await crearAccesoHermano(sol.email, sol.clavePropuesta, sol.dni, sol.nombre)
    // La comprobación de DNI se repite AQUÍ, ya con la lista más reciente: entre
    // el clic y el final del alta (una llamada de red) pudo entrar otro hermano.
    let duplicado = false
    setHermanos((prev) => {
      if (prev.some((h) => h.dni.toUpperCase() === sol.dni.toUpperCase())) {
        duplicado = true
        return prev
      }
      return [...prev, { ...nuevo, numero: Math.max(0, ...prev.map((h) => h.numero)) + 1 }]
    })
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

  const filtered = useMemo(() => {
    // El sesgo va ANTES que los filtros de la barra: los de la barra afinan lo
    // que el sesgo ya ha dejado.
    return sesgados
      .filter((h) => (filter === 'Todos' ? true : h.estado === filter))
      .filter((h) => (filtroEtiqueta ? (h.etiquetas ?? []).includes(filtroEtiqueta) : true))
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
  }, [sesgados, query, filter, filtroEtiqueta, orden])

  /** Añade o quita una etiqueta a un hermano (y refleja el cambio en la ficha abierta). */
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
    const activos = hermanos.filter((h) => h.estado === 'Activo').length
    const nuevos = hermanos.filter((h) => h.estado === 'Nuevo').length
    const pendientes = hermanos.filter((h) => !h.cuotaAlDia).length
    return { total, activos, nuevos, pendientes }
  }, [hermanos])

  // El tramo de cada hermano no se guarda: se calcula solo a partir de su
  // número de hermano y del aforo de los tramos configurados (ver Cortejo).
  const tramos = useMemo(() => getTramos(), [])
  const hermanoDe = useMemo(() => {
    const map = new Map(hermanos.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [hermanos])
  const tramoPorHermano = useMemo(() => {
    const anio = getCampana().anio
    const papeletas = leerPersistido(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES).filter((p) => p.anio === anio)
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
    const dni = String(data.get('dni') ?? '').trim().toUpperCase()
    if (!nombre || !email || !dni) return
    if (guardandoAlta) return
    setGuardandoAlta(true)

    if (hermanos.some((h) => h.dni.toUpperCase() === dni)) {
      setDniError(`Ya hay un hermano registrado con el DNI ${dni}.`)
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
      // Al dar de alta, su contraseña provisional es su propio DNI: fácil de
      // comunicar y que el hermano cambia luego desde su área.
      claveAcceso: dni,
      authUserId: null,
      fechaNacimiento,
      campos: Object.keys(camposNuevo).length ? camposNuevo : undefined,
    }
    nuevo.authUserId = await crearAccesoHermano(email, dni, dni, nombre)
    // El duplicado se vuelve a mirar DENTRO del updater: entre el clic y la
    // respuesta de Supabase pasan segundos, y pulsando dos veces se daban de
    // alta dos hermanos con el mismo DNI.
    let duplicado = false
    setHermanos((prev) => {
      if (prev.some((h) => h.dni.trim().toUpperCase() === dni)) {
        duplicado = true
        return prev
      }
      return [...prev, { ...nuevo, numero: Math.max(0, ...prev.map((h) => h.numero)) + 1 }]
    })
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
      // Cambio en los datos del hermano: se le avisa (correo simulado).
      agregarAvisoHermano(selected.id, 'La secretaría ha actualizado tu cuenta bancaria.')
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
    avisarCambiosHermano(selected, nuevo)
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
    setHermanos((prev) => {
      // Se relee dentro del updater: la lista pudo cambiar (otra pestaña, una
      // recarga desde la base) entre el clic y este momento.
      const actual = prev.find((h) => h.id === hermanoId)
      if (!actual || actual.estado === 'Baja') return prev
      const numBaja = actual.numero
      return prev.map((h) => {
        if (h.id === hermanoId) return { ...h, estado: 'Baja', numero: 0, bajaSolicitada: false }
        // Solo descienden los que están dentro de la numeración activa
        // (numero > 0); los de baja ya están fuera y no se tocan.
        if (h.estado !== 'Baja' && h.numero > 0 && h.numero > numBaja) return { ...h, numero: h.numero - 1 }
        return h
      })
    })
    agregarAvisoHermano(hermanoId, 'La secretaría ha tramitado tu baja en la hermandad.')
  }

  /** Reactiva a un hermano de baja: vuelve al censo con el último número disponible. */
  function reactivar(hermanoId: string) {
    const objetivo = hermanos.find((h) => h.id === hermanoId)
    if (!objetivo || objetivo.estado !== 'Baja') return
    // El número se toma dentro del updater, con la lista más reciente.
    let siguiente = 0
    setHermanos((prev) => {
      siguiente = Math.max(0, ...prev.map((h) => h.numero)) + 1
      return prev.map((h) => (h.id === hermanoId ? { ...h, estado: 'Activo', numero: siguiente } : h))
    })
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
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Hermanos</p>
          <h1>Censo de la hermandad</h1>
          <p className="dash-head__lead">
            {stats.total} hermanos registrados · datos de ejemplo mientras conectamos la base de
            datos.
          </p>
        </div>
        <div className="dash-head__actions">
          {pendientes.length > 0 && (
            <button className="btn btn-outline" onClick={() => setSolicitudesOpen(true)}>
              Solicitudes de alta ({pendientes.length})
            </button>
          )}
          {/* Se exporta y se imprime EXACTAMENTE lo que hay en pantalla: si has
              sesgado por «costaleros al día», eso es lo que sale. */}
          <MenuAcciones etiqueta="Exportar">
            <button type="button" onClick={() => exportarCsv()} disabled={filtered.length === 0}>
              Descargar en Excel (CSV) <small>{filtered.length}</small>
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
          {(['Todos', 'Activo', 'Nuevo', 'Baja'] as const).map((f) => (
            <button
              key={f}
              className={`chip${filter === f ? ' chip--active' : ''}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === 'Todos' ? 'Todos' : f === 'Activo' ? 'Activos' : f === 'Nuevo' ? 'Nuevos' : 'Baja'}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`chip${sesgando ? ' chip--active' : ''}`}
          onClick={() => setSesgando((v) => !v)}
          aria-expanded={sesgando}
        >
          {sesgoActivo ? '✓ Sesgado' : 'Sesgar'}
        </button>
        {etiquetas.length > 0 && (
          <select
            className="search-box"
            style={{ maxWidth: '15rem' }}
            value={filtroEtiqueta}
            onChange={(e) => setFiltroEtiqueta(e.target.value)}
            aria-label="Filtrar por etiqueta"
          >
            <option value="">Todas las etiquetas</option>
            {etiquetas.map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        )}
      </div>

      {sesgando && (
        <EditorSegmento
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
                <th key={c.id} className={c.orden ? 'th-ordenable' : undefined}>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => (
              <tr
                key={h.id}
                className={h.id === justAddedId ? 'row--flash' : undefined}
                onClick={() => setSelectedId(h.id)}
                style={{ cursor: 'pointer' }}
              >
                <td className="col-marca" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={marcados.has(h.id)}
                    onChange={() => alternarMarca(h.id)}
                    aria-label={`Marcar a ${h.nombre}`}
                  />
                </td>
                <td className="num">{h.numero > 0 ? h.numero : '—'}</td>
                <td>
                  <div className="row-person">
                    <span className="row-avatar">{initials(h.nombre)}</span>
                    <span>
                      <span className="row-person__name">{h.nombre}</span>
                      <span className="row-person__sub">{h.email}</span>
                    </span>
                  </div>
                </td>
                <td>
                  {tramoPorHermano.get(h.id) ?? <span className="table-muted">Sin papeleta</span>}
                </td>
                <td>
                  <span className={`pill ${estadoClass(h.estado)}`}>{h.estado}</span>
                </td>
                <td>
                  <span className={`pill ${h.cuotaAlDia ? 'pill--ok' : 'pill--warn'}`}>
                    {h.cuotaAlDia ? 'Al día' : 'Pendiente'}
                  </span>
                </td>
                <td className="num">{h.antiguedad}</td>
                <td>
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
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.nombre ?? ''}
        subtitle={selected ? (selected.numero > 0 ? `Hermano nº ${selected.numero}` : 'De baja · sin número activo') : undefined}
      >
        {selected && (
          <div className="ficha">
            <div className="ficha__row">
              <span className={`pill ${estadoClass(selected.estado)}`}>{selected.estado}</span>
              <span className={`pill ${selected.cuotaAlDia ? 'pill--ok' : 'pill--warn'}`}>
                {selected.cuotaAlDia ? 'Cuota al día' : 'Cuota pendiente'}
              </span>
            </div>

            <dl className="ficha__list">
              <div><dt>DNI / NIE</dt><dd>{selected.dni}</dd></div>
              <div><dt>Hermano desde</dt><dd>{selected.antiguedad}</dd></div>
              <div><dt>Tramo en el cortejo</dt><dd>{tramoPorHermano.get(selected.id) ?? 'Sin papeleta este año'}</dd></div>
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
            <p className="form-hint">
              Accede a su área del hermano con este DNI y la contraseña <code>{selected.claveAcceso}</code>, que
              podrá cambiar desde su área.
            </p>

            <div className="assign-box">
              <label>Etiquetas</label>
              <p className="form-hint">
                Marca los grupos a los que pertenece. Sirven para mandarle avisos segmentados (p. ej.
                solo a los costaleros) y para filtrar el censo.
              </p>
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
                    Está de baja: fuera de la numeración activa. Al reactivarlo entra de nuevo en el
                    censo con el último número disponible.
                  </p>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => reactivar(selected.id)}>
                    Reactivar hermano
                  </button>
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
          h.numero > 0 ? h.numero : '—', h.nombre, h.estado, h.antiguedad, h.cuotaAlDia ? 'Al día' : 'Pendiente',
        ])}
      />

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
