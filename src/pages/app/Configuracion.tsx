import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { LogoMark } from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
import {
  useHermandadSettings,
  saveHermandadSettings,
  type HermandadSettings,
} from '../../lib/hermandadSettings'
import {
  getTramos,
  useTramos,
  saveTramos,
  aforoDeCuerpo,
  getCuerpos,
  saveCuerpos,
  repartoDe,
  gruposAutomaticos,
  precioDeTramo,
  cuerposPresentes as cuerposPresentesDe,
  type Cuerpo,
  type ModoReparto,
  type Tramo,
} from '../../lib/tramos'
import { TIPOS_CAMPO, useCamposPropios, type CampoPropio } from '../../lib/camposPropios'
import { useConceptosCuota, saveConceptosCuota, type ConceptoCuotaConfig } from '../../lib/conceptosCuota'
import { CLAVES_CATALOGOS, useCatalogos, saveLista } from '../../lib/catalogos'
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO, CUENTAS_POR_DEFECTO } from '../../data/movimientos'
import { TIPOS_INCIDENCIA_POR_DEFECTO } from '../../data/incidencias'
import { CATEGORIAS_ENSER } from '../../data/enseres'
import { CANALES, SEGMENTOS } from '../../data/comunicados'
import { restablecerDatosDeEjemplo } from '../../lib/persistencia'
import { nuevoId } from '../../lib/supabaseSync'
import { crearCopia, esCopiaValida, restaurarCopia, resumirCopia, sePuedeRestaurar } from '../../lib/backup'
import { descargarArchivo } from '../../lib/csv'
import AvisoFalta from '../../components/AvisoFalta'
import { contextoActual, requisito, requisitos } from '../../lib/requisitos'
import { ofrecerDeshacer, reinsertar } from '../../lib/deshacer'
import { CLAVES_DATOS, leerDatos } from '../../lib/persistencia'
import { getCampana } from '../../lib/campana'
import type { Papeleta } from '../../data/papeletas'
import {
  correoDePrueba, correoDisponible, enviarCorreo, useAjustesCorreo, type AjustesCorreo,
} from '../../lib/correo'
import { hoyIso } from '../../lib/hoy'
import { conexiones, resumenConexiones } from '../../lib/conexiones'
import { useCuentasSociales } from '../../lib/db/comunicados'
import { getWebPublica } from '../../lib/webPublica'
import { getAjustesCorreo } from '../../lib/correo'
import { tieneCapacidad, useSuscripcion } from '../../lib/suscripcion'
import { Link } from 'react-router-dom'

const MAX_LOGO_BYTES = 800_000

/** Fila del editor de cuerpos: guarda el nombre original para poder renombrar los tramos al guardar. */
interface CuerpoEdit {
  original: string | null
  actual: string
}

/** Catálogos de listas simples que cada hermandad personaliza (clave de almacenamiento + valores por defecto). */
const CATALOGOS_DEF = [
  { k: 'ingresos', clave: CLAVES_CATALOGOS.categoriasIngreso, titulo: 'Categorías de ingresos', porDefecto: CATEGORIAS_INGRESO },
  { k: 'gastos', clave: CLAVES_CATALOGOS.categoriasGasto, titulo: 'Categorías de gastos', porDefecto: CATEGORIAS_GASTO },
  { k: 'cuentas', clave: CLAVES_CATALOGOS.cuentasTesoreria, titulo: 'Cuentas de tesorería', porDefecto: CUENTAS_POR_DEFECTO },
  { k: 'incidencias', clave: CLAVES_CATALOGOS.tiposIncidencia, titulo: 'Tipos de incidencia (día de salida)', porDefecto: TIPOS_INCIDENCIA_POR_DEFECTO },
  { k: 'enseres', clave: CLAVES_CATALOGOS.categoriasEnser, titulo: 'Categorías del inventario', porDefecto: CATEGORIAS_ENSER },
  { k: 'canales', clave: CLAVES_CATALOGOS.canalesComunicado, titulo: 'Canales de comunicación', porDefecto: CANALES },
  { k: 'segmentos', clave: CLAVES_CATALOGOS.segmentosComunicado, titulo: 'Destinatarios de comunicados', porDefecto: SEGMENTOS },
] as const

type SeccionCfg = 'hermandad' | 'cortejo' | 'papeletas' | 'catalogos' | 'ficha' | 'datos' | 'puesta' | 'correo' | 'conexiones'

/** Las secciones de los ajustes, agrupadas como el editor de la web. */
const SECCIONES_CFG: { titulo: string; items: { id: SeccionCfg; label: string; icono: ReactNode }[] }[] = [
  {
    titulo: 'La hermandad',
    items: [
      { id: 'hermandad', label: 'Identidad y datos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3 4 7v6c0 4.4 3.4 7.4 8 8 4.6-.6 8-3.6 8-8V7l-8-4Z" /></svg> },
      { id: 'ficha', label: 'Ficha del hermano', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.2" /><path d="M5.5 16.5c.7-1.7 2-2.5 3.5-2.5s2.8.8 3.5 2.5M15 9.5h4M15 13h3" /></svg> },
    ],
  },
  {
    titulo: 'Cómo trabajáis',
    items: [
      { id: 'cortejo', label: 'Cuerpos y tramos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6h16M4 12h16M4 18h10" /></svg> },
      { id: 'papeletas', label: 'Papeletas', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M2.5 11a2 2 0 0 0 0 2M21.5 11a2 2 0 0 1 0 2M9 6v12" strokeDasharray="2 2" /></svg> },
      { id: 'catalogos', label: 'Catálogos y cuotas', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg> },
    ],
  },
  {
    titulo: 'Mantenimiento',
    items: [
      /* «Conexiones» va el primero del grupo a propósito: es lo que se viene a
         buscar a Ajustes, y hasta ahora no estaba en ninguna parte. */
      { id: 'conexiones', label: 'Conexiones', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 15 4.5 19.5a3.2 3.2 0 0 1-4.5-4.5" transform="translate(2 -1)" /><path d="M14.5 9.5 19 5a3.2 3.2 0 0 1 4.5 4.5L19 14" transform="translate(-1 1)" /><path d="M9.5 14.5 14.5 9.5" /></svg> },
      { id: 'correo', label: 'Correo', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg> },
      { id: 'puesta', label: 'Puesta en marcha', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2v6M12 16v6M2 12h6M16 12h6" /><circle cx="12" cy="12" r="3.2" /></svg> },
      { id: 'datos', label: 'Copias y datos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg> },
    ],
  },
]

export default function Configuracion() {
  /** Sección abierta. Se recuerda durante la sesión: se entra y se sale mucho. */
  const [seccion, setSeccion] = useState<SeccionCfg>(
    () => (sessionStorage.getItem('cabildo-cfg-seccion') as SeccionCfg | null) ?? 'hermandad',
  )
  function irASeccion(s: SeccionCfg) {
    setSeccion(s)
    try { sessionStorage.setItem('cabildo-cfg-seccion', s) } catch { /* sin sessionStorage */ }
  }
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''

  const settingsRemotas = useHermandadSettings(fallbackNombre)
  const [settings, setSettings] = useState<HermandadSettings>(settingsRemotas)
  const [tocado, setTocado] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Mientras no se haya tocado el formulario, refleja lo que traiga Supabase
  // en cuanto llegue (la primera lectura, al montar, es solo la caché local).
  useEffect(() => {
    if (!tocado) setSettings(settingsRemotas)
  }, [settingsRemotas, tocado])

  function update<K extends keyof HermandadSettings>(key: K, value: HermandadSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
    setSaved(false)
    setTocado(true)
  }

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Elige una imagen más ligera (máx. 800 KB).')
      return
    }
    setLogoError(null)
    const reader = new FileReader()
    reader.onload = () => update('logoDataUrl', String(reader.result))
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // «Guardado correctamente» solo si de verdad se ha guardado.
    const r = await saveHermandadSettings(settings)
    setErrorGuardar(r.ok ? null : (r.error ?? 'No se pudo guardar.'))
    setSaved(r.ok)
    if (r.ok) setTimeout(() => setSaved(false), 3000)
  }

  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const tramosRemotos = useTramos()
  const [tramos, setTramos] = useState<Tramo[]>(tramosRemotos)
  const [tramosTocado, setTramosTocado] = useState(false)
  useEffect(() => {
    if (!tramosTocado) setTramos(tramosRemotos)
  }, [tramosRemotos, tramosTocado])
  const [tramosSaved, setTramosSaved] = useState(false)
  /**
   * Las papeletas de la campaña activa, solo para poder avisar antes de quitar
   * un tramo que tiene gente dentro. Se lee del espejo del navegador y no de
   * la tabla remota a propósito: es un aviso, no un dato de trabajo, y montar
   * aquí otra suscripción a `papeletas` por esto sería caro. Si la lista viene
   * vacía se pierde el aviso, pero Cortejo las recoge igualmente después.
   */
  const papeletasDelAnio = useMemo(
    () => leerDatos<Papeleta>(CLAVES_DATOS.papeletas, []).filter((p) => p.anio === getCampana().anio),
    [],
  )
  /*
   * El precio de la papeleta es de la HERMANDAD, no de este navegador.
   *
   * Estaba en `localStorage`: el tesorero ponía 18 € en su ordenador y la
   * secretaria, desde el suyo, emitía todo el año al precio de fábrica. Ni
   * fallaba ni avisaba — cada uno cobraba una cosa. Ahora sale de los ajustes,
   * que viajan con la hermandad.
   */
  const precioBase = settings.precioPapeleta
  const [copiaEstado, setCopiaEstado] = useState<string | null>(null)
  const backupRef = useRef<HTMLInputElement>(null)

  // ---- Cuerpos del cortejo (los pasos y su acompañamiento; nombres libres) ----
  const [cuerposGuardados, setCuerposGuardados] = useState<Cuerpo[]>(() => getCuerpos())
  const [cuerposEdit, setCuerposEdit] = useState<CuerpoEdit[]>(() =>
    getCuerpos().map((c) => ({ original: c, actual: c })),
  )
  const [cuerposSaved, setCuerposSaved] = useState(false)
  const [cuerposError, setCuerposError] = useState<string | null>(null)

  function updateCuerpo(index: number, actual: string) {
    setCuerposEdit((prev) => prev.map((c, i) => (i === index ? { ...c, actual } : c)))
    setCuerposSaved(false)
    setCuerposError(null)
  }

  function addCuerpo() {
    setCuerposEdit((prev) => [...prev, { original: null, actual: '' }])
    setCuerposSaved(false)
  }

  function removeCuerpo(index: number) {
    const c = cuerposEdit[index]
    // Una fila recién añadida (sin original) aún no existe: siempre se puede quitar.
    if (c.original && tramos.some((t) => t.cuerpo === c.original)) {
      setCuerposError(`No puedes quitar «${c.original}»: tiene tramos. Cambia antes esos tramos de cuerpo.`)
      return
    }
    setCuerposEdit((prev) => prev.filter((_, i) => i !== index))
    setCuerposSaved(false)
    setCuerposError(null)
  }

  async function handleSaveCuerpos() {
    // Vaciar el nombre de un cuerpo equivale a quitarlo: misma guardia que el botón de quitar.
    const vaciadoEnUso = cuerposEdit.find(
      (c) => c.original && !c.actual.trim() && tramos.some((t) => t.cuerpo === c.original),
    )
    if (vaciadoEnUso) {
      setCuerposError(
        `El cuerpo «${vaciadoEnUso.original}» tiene tramos: ponle nombre o cambia antes esos tramos de cuerpo.`,
      )
      return
    }
    const nombres = cuerposEdit.map((c) => c.actual.trim()).filter(Boolean)
    if (nombres.length === 0) {
      setCuerposError('Debe haber al menos un cuerpo (p. ej. «Único» si vais en un solo bloque).')
      return
    }
    if (new Set(nombres).size !== nombres.length) {
      setCuerposError('Hay nombres de cuerpo repetidos.')
      return
    }
    // Renombrados: los tramos que apuntaban al nombre antiguo pasan al nuevo.
    // En una sola pasada (mapa antiguo→nuevo) para que hasta un intercambio de
    // nombres entre dos cuerpos (A→B y B→A) se aplique sin corromper nada.
    const renombres = new Map<string, string>()
    cuerposEdit.forEach((c) => {
      const nuevo = c.actual.trim()
      if (c.original && nuevo && c.original !== nuevo) renombres.set(c.original, nuevo)
    })
    const renombra = (t: Tramo): Tramo => {
      const nuevo = renombres.get(t.cuerpo)
      return nuevo ? { ...t, cuerpo: nuevo } : t
    }
    // El renombrado se persiste sobre los tramos GUARDADOS (no arrastra las
    // ediciones sin guardar del editor de abajo); el editor en pantalla se
    // renombra también, pero sus demás cambios siguen pendientes de «Guardar tramos».
    if (renombres.size > 0) {
      setTramosTocado(true)
      await saveTramos(getTramos().map(renombra))
      setTramos((prev) => prev.map(renombra))
    }
    saveCuerpos(nombres)
    setCuerposGuardados(nombres)
    setCuerposEdit(nombres.map((n) => ({ original: n, actual: n })))
    setCuerposError(null)
    setCuerposSaved(true)
    setTimeout(() => setCuerposSaved(false), 3000)
  }

  async function descargarCopia() {
    setCopiaEstado('Preparando la copia…')
    try {
      const copia = await crearCopia()
      const fecha = hoyIso()
      const slug = (settings.nombreLegal || 'hermandad').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      descargarArchivo(`copia-cabildo-${slug}-${fecha}.json`, JSON.stringify(copia), 'application/json;charset=utf-8;')
      // Si alguna tabla no se pudo traer, se dice. Una copia a la que le falta
      // algo y no lo cuenta se descubre el día que hace falta, que ya es tarde.
      const fallos = copia.fallos ?? []
      setCopiaEstado(
        fallos.length > 0
          ? `Copia descargada, pero NO se pudo traer: ${fallos.join(', ')}. Vuelve a intentarlo.`
          : 'Copia descargada.',
      )
    } catch {
      setCopiaEstado('No se pudo crear la copia.')
    }
    setTimeout(() => setCopiaEstado(null), 4000)
  }

  async function restaurarDesdeArchivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCopiaEstado('Leyendo la copia…')
    try {
      const texto = await file.text()
      const obj = JSON.parse(texto)
      if (!esCopiaValida(obj)) {
        setCopiaEstado('El archivo no es una copia de Gobergo válida.')
        setTimeout(() => setCopiaEstado(null), 4000)
        return
      }
      // Se pregunta DESPUÉS de leerla, con lo que trae delante: antes se
      // confirmaba a ciegas, sin saber siquiera de qué día era la copia.
      const r = resumirCopia(obj)
      if (r.masNueva) {
        setCopiaEstado(
          'Esta copia la hizo una versión de Gobergo más nueva que la que tenéis. Restaurarla podría perder datos: actualizad Gobergo antes.',
        )
        setTimeout(() => setCopiaEstado(null), 9000)
        return
      }
      const cuando = r.fecha ? `del ${r.fecha}` : 'sin fecha'
      const trae = `${r.bloques} bloques de datos${r.archivos > 0 ? ` y ${r.archivos} archivos adjuntos` : ''}`
      if (!window.confirm(
        `Vas a restaurar una copia ${cuando}, con ${trae}.\n\n` +
        'Esto sustituirá TODOS los datos actuales de la hermandad por los del archivo. ¿Continuar?',
      )) {
        setCopiaEstado(null)
        return
      }
      setCopiaEstado('Restaurando…')
      await restaurarCopia(obj)
      setCopiaEstado('Copia restaurada. Recargando…')
      setTimeout(() => window.location.reload(), 800)
    } catch (e) {
      // El mensaje de la restauración explica qué ha pasado y si se ha
      // cambiado algo; genérico solo si el archivo ni siquiera se pudo leer.
      setCopiaEstado(e instanceof Error && e.message ? e.message : 'No se pudo leer el archivo.')
      setTimeout(() => setCopiaEstado(null), 7000)
    }
  }
  const aforos = useMemo(
    () => cuerposGuardados.map((c) => ({ cuerpo: c, total: aforoDeCuerpo(c, tramos) })).filter((a) => a.total > 0),
    [tramos, cuerposGuardados],
  )

  // Un grupo «por número» (mismo cuerpo y tipo) cobra un único precio: el del
  // primer tramo del grupo. Si la hermandad pone precios distintos dentro del
  // mismo grupo, se le avisa (sin bloquear) para que no haya sorpresas.
  const gruposConPrecioMixto = useMemo(() => {
    const avisos: string[] = []
    cuerposPresentesDe(tramos).forEach((cuerpo) => {
      gruposAutomaticos(tramos.filter((t) => t.cuerpo === cuerpo)).forEach((g) => {
        const precios = new Set(g.tramos.map((t) => precioDeTramo(t, precioBase)))
        if (precios.size > 1) avisos.push(`${cuerpo} — ${g.etiqueta}`)
      })
    })
    return avisos
  }, [tramos, precioBase])

  function updateTramo<K extends keyof Tramo>(id: string, key: K, value: Tramo[K]) {
    setTramos((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: value } : t)))
    setTramosTocado(true)
    setTramosSaved(false)
  }

  function addTramo() {
    setTramos((prev) => [
      ...prev,
      {
        id: nuevoId(),
        nombre: 'Nuevo tramo',
        cuerpo: cuerposGuardados[0] ?? 'Único',
        capacidad: 20,
        tipo: '',
        reparto: 'solicitud',
        precio: null,
      },
    ])
    setTramosTocado(true)
    setTramosSaved(false)
  }

  function removeTramo(id: string) {
    const posicion = tramos.findIndex((t) => t.id === id)
    const tramo = tramos[posicion]
    /**
     * Si hay gente dentro, se pregunta. Y se dice cuánta.
     *
     * Quitar un tramo con papeletas dentro hacía desaparecer a esos hermanos
     * del cortejo sin ningún aviso: no entraban en ningún reparto, no salían
     * en «Pendientes» ni entre las anuladas, y su ficha seguía diciendo
     * «Renovada». Ocho personas con su papeleta ya cobrada, fuera de la
     * procesión, y nadie se enteraba hasta el día de la salida.
     *
     * Ahora Cortejo además las recoge y las enseña para recolocarlas, pero
     * mejor avisar antes que arreglarlo después.
     */
    const dentro = papeletasDelAnio.filter((p) => p.tramoId === id).length
    if (dentro > 0) {
      const quienes = dentro === 1 ? 'un hermano tiene' : `${dentro} hermanos tienen`
      if (!window.confirm(
        `En «${tramo?.nombre ?? 'este tramo'}» ${quienes} su papeleta de este año.\n\n` +
        'Si lo quitas, se quedan sin sitio en el cortejo y habrá que recolocarlos a mano ' +
        'desde Cortejo. ¿Continuar?',
      )) return
    }
    setTramos((prev) => prev.filter((t) => t.id !== id))
    if (tramo) {
      ofrecerDeshacer(`Tramo «${tramo.nombre}» quitado`, () => {
        setTramos((prev) => reinsertar(prev, tramo, posicion))
        setTramosTocado(true)
      })
    }
    setTramosTocado(true)
    setTramosSaved(false)
  }

  function moveTramo(id: string, dir: -1 | 1) {
    setTramos((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      const swapWith = idx + dir
      if (idx < 0 || swapWith < 0 || swapWith >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapWith]] = [next[swapWith], next[idx]]
      return next
    })
    setTramosTocado(true)
    setTramosSaved(false)
  }

  const [tramosError, setTramosError] = useState<string | null>(null)

  async function handleSaveTramos() {
    // Se guarda el reparto de forma explícita (los datos antiguos lo deducían del tipo).
    const explicitos = tramos.map((t) => ({ ...t, reparto: repartoDe(t) }))
    setTramos(explicitos)
    const r = await saveTramos(explicitos)
    // El precio se edita en ESTA tarjeta, así que lo guarda ESTE botón. Dejarlo
    // colgando del botón de «Identidad y datos» era pedir que se perdiera.
    const rAjustes = await saveHermandadSettings(settings)
    /*
     * EL VERDE SOLO SI DE VERDAD SE HA GUARDADO.
     *
     * Antes salía siempre. Y como el guardado de tramos llevaba fallando en
     * todos los casos —a la tabla le faltaba una columna—, lo que veía la
     * hermandad era el visto bueno verde de «Tramos guardados» encima de unos
     * tramos que no existían en ninguna parte. Al recargar, Cortejo decía
     * «0/0 puestos cubiertos».
     *
     * Es el mismo arreglo que ya se hizo con la tabla de permisos, y por la
     * misma razón: un visto bueno que sale pase lo que pase no informa de
     * nada, engaña.
     */
    if (!r.ok || !rAjustes.ok) {
      setTramosError(
        !r.ok
          ? `No se han podido guardar los tramos: ${r.error ?? 'la base de datos los ha rechazado.'}`
          : `Los tramos se han guardado, pero el precio no: ${rAjustes.error ?? 'la base de datos lo ha rechazado.'}`,
      )
      setTramosSaved(false)
      return
    }
    setTramosError(null)
    setTramosTocado(false)
    setTramosSaved(true)
    setTimeout(() => setTramosSaved(false), 3000)
  }

  // ---- Catálogos de la hermandad (conceptos de cuota + listas simples) ----
  const conceptosCuotaRemotos = useConceptosCuota()
  const [conceptosCuota, setConceptosCuota] = useState<ConceptoCuotaConfig[]>(conceptosCuotaRemotos)
  const catalogosRemotos = useCatalogos(CATALOGOS_DEF)
  const [catalogos, setCatalogos] = useState<Record<string, string[]>>(catalogosRemotos)
  const [catalogosTocado, setCatalogosTocado] = useState(false)
  useEffect(() => {
    if (!catalogosTocado) {
      setConceptosCuota(conceptosCuotaRemotos)
      setCatalogos(catalogosRemotos)
    }
  }, [conceptosCuotaRemotos, catalogosRemotos, catalogosTocado])
  const [catalogosSaved, setCatalogosSaved] = useState(false)

  function updateConceptoCuota<K extends keyof ConceptoCuotaConfig>(id: string, key: K, value: ConceptoCuotaConfig[K]) {
    setConceptosCuota((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function addConceptoCuota() {
    setConceptosCuota((prev) => [...prev, { id: nuevoId(), nombre: 'Nueva cuota', importe: 10 }])
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function removeConceptoCuota(id: string) {
    const posicion = conceptosCuota.findIndex((c) => c.id === id)
    const concepto = conceptosCuota[posicion]
    setConceptosCuota((prev) => prev.filter((c) => c.id !== id))
    if (concepto) {
      ofrecerDeshacer(`Cuota «${concepto.nombre}» quitada del catálogo`, () => {
        setConceptosCuota((prev) => reinsertar(prev, concepto, posicion))
        setCatalogosTocado(true)
      })
    }
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function updateCatalogo(k: string, index: number, valor: string) {
    setCatalogos((prev) => ({ ...prev, [k]: prev[k].map((v, i) => (i === index ? valor : v)) }))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function addCatalogoValor(k: string) {
    setCatalogos((prev) => ({ ...prev, [k]: [...prev[k], ''] }))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function removeCatalogoValor(k: string, index: number) {
    setCatalogos((prev) => ({ ...prev, [k]: prev[k].filter((_, i) => i !== index) }))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  const [catalogosError, setCatalogosError] = useState<string | null>(null)

  async function handleSaveCatalogos() {
    /*
     * Se recogen los fallos y el verde solo sale si no hay ninguno.
     *
     * Estos guardados BORRAN y vuelven a insertar, así que un alta que falle
     * no deja las cosas como estaban: deja la tabla vacía. Y aquí se guarda la
     * lista de precios de la hermandad —los conceptos de cuota con su importe—
     * así que perderla en silencio no es una molestia, es una tarde de trabajo
     * y unas cuentas que ya no cuadran.
     */
    const fallos: string[] = []
    const r0 = await saveConceptosCuota(conceptosCuota.filter((c) => c.nombre.trim()))
    if (!r0.ok) fallos.push(`conceptos de cuota (${r0.error})`)
    const limpios: Record<string, string[]> = {}
    for (const d of CATALOGOS_DEF) {
      const valores = (catalogos[d.k] ?? []).map((v) => v.trim()).filter(Boolean)
      limpios[d.k] = valores.length > 0 ? valores : [...d.porDefecto]
      const r = await saveLista(d.clave, limpios[d.k])
      if (!r.ok) fallos.push(`${d.k} (${r.error})`)
    }
    if (fallos.length > 0) {
      setCatalogosError(`No se han podido guardar: ${fallos.join(' · ')}`)
      setCatalogosSaved(false)
      return
    }
    setCatalogosError(null)
    setCatalogos(limpios)
    setConceptosCuota((prev) => prev.filter((c) => c.nombre.trim()))
    setCatalogosTocado(false)
    setCatalogosSaved(true)
    setTimeout(() => setCatalogosSaved(false), 3000)
  }

  return (
    <div className="dash">
      <div className="dash-head">
        <p className="eyebrow">Configuración</p>
        <h1>Ajustes de la hermandad</h1>
        <p className="dash-head__lead">
          Cómo se llama, cómo sale en los documentos y cómo trabajáis: el cortejo, las papeletas y
          las listas que usa toda la aplicación. Solo lo ves tú, desde aquí.
        </p>
      </div>

      <div className="cfg-layout">
        {/* Mismo raíl que el editor de la web: nueve bloques en una sola
            columna eran un scroll sin fin y cinco botones de «Guardar» que no
            se sabía a qué parte correspondían. */}
        <nav className="cms-rail" aria-label="Secciones de los ajustes">
          {SECCIONES_CFG.map((g) => (
            <div className="cms-rail__grupo" key={g.titulo}>
              <p className="cms-rail__titulo">{g.titulo}</p>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`cms-rail__item${seccion === it.id ? ' cms-rail__item--on' : ''}`}
                  onClick={() => irASeccion(it.id)}
                  aria-current={seccion === it.id ? 'true' : undefined}
                >
                  <span className="cms-rail__ic" aria-hidden="true">{it.icono}</span>
                  <span className="cms-rail__label">{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="cfg-panel">

      {seccion === 'hermandad' && (
      <form className="settings-layout" onSubmit={handleSubmit}>
        <section className="settings-card">
          <h2 className="settings-card__title">Escudo o logotipo</h2>
          <div className="logo-uploader">
            <span className="logo-preview">
              {settings.logoDataUrl ? (
                <img src={settings.logoDataUrl} alt="Logo de la hermandad" />
              ) : (
                <LogoMark size={38} />
              )}
            </span>
            <div className="logo-uploader__info">
              <div className="logo-uploader__actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => fileRef.current?.click()}
                >
                  Subir imagen
                </button>
                {settings.logoDataUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => update('logoDataUrl', null)}
                  >
                    Quitar
                  </button>
                )}
              </div>
              <p className="form-hint">
                PNG, JPG o SVG · máx. 800 KB. Se usará en la cabecera de los recibos.
              </p>
              {logoError && <p className="form-hint form-hint--error">{logoError}</p>}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={handleLogoChange}
              hidden
            />
          </div>

          <div className="color-picker-row">
            <span className="color-picker-swatch" style={{ background: settings.colorPrimario }} aria-hidden="true" />
            <div className="form-row">
              <label htmlFor="colorPrimario">Color de tu hermandad</label>
              <div className="color-picker-controls">
                <input
                  id="colorPrimario"
                  type="color"
                  value={settings.colorPrimario}
                  onChange={(e) => update('colorPrimario', e.target.value)}
                />
                <input
                  type="text"
                  className="color-picker-hex"
                  aria-label="Color de tu hermandad en hexadecimal"
                  value={settings.colorPrimario}
                  onChange={(e) => update('colorPrimario', e.target.value)}
                  placeholder="#caa24a"
                  maxLength={7}
                />
              </div>
              <p className="form-hint">Tiñe los botones y acentos del área del hermano de tus hermanos/as.</p>
            </div>
          </div>

          <div className="color-picker-row">
            <span className="color-picker-swatch" style={{ background: settings.colorSecundario }} aria-hidden="true" />
            <div className="form-row">
              <label htmlFor="colorSecundario">Segundo color (acento)</label>
              <div className="color-picker-controls">
                <input
                  id="colorSecundario"
                  type="color"
                  value={settings.colorSecundario}
                  onChange={(e) => update('colorSecundario', e.target.value)}
                />
                <input
                  type="text"
                  className="color-picker-hex"
                  aria-label="Segundo color en hexadecimal"
                  value={settings.colorSecundario}
                  onChange={(e) => update('colorSecundario', e.target.value)}
                  placeholder="#C5A059"
                  maxLength={7}
                />
              </div>
              <p className="form-hint">Color dorado o de detalle: filetes, degradados de la cabecera y la web.</p>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <h2 className="settings-card__title">Datos fiscales y de contacto</h2>

          <div className="form-row">
            <label htmlFor="nombreLegal">Nombre legal de la hermandad</label>
            <input
              id="nombreLegal"
              value={settings.nombreLegal}
              onChange={(e) => update('nombreLegal', e.target.value)}
              placeholder="Hermandad de la Vera-Cruz"
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="cif">CIF / NIF</label>
              <input
                id="cif"
                value={settings.cif}
                onChange={(e) => update('cif', e.target.value)}
                placeholder="G-00000000"
              />
            </div>
            <div className="form-row">
              <label htmlFor="telefono">Teléfono</label>
              <input
                id="telefono"
                value={settings.telefono}
                onChange={(e) => update('telefono', e.target.value)}
                placeholder="954 000 000"
              />
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="direccion">Dirección</label>
            <input
              id="direccion"
              value={settings.direccion}
              onChange={(e) => update('direccion', e.target.value)}
              placeholder="Plaza de la Hermandad, 3"
            />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="codigoPostal">Código postal</label>
              <input
                id="codigoPostal"
                value={settings.codigoPostal}
                onChange={(e) => update('codigoPostal', e.target.value)}
                placeholder="41010"
              />
            </div>
            <div className="form-row">
              <label htmlFor="ciudad">Ciudad</label>
              <input
                id="ciudad"
                value={settings.ciudad}
                onChange={(e) => update('ciudad', e.target.value)}
                placeholder="Sevilla"
              />
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="provincia">Provincia</label>
            <input
              id="provincia"
              value={settings.provincia}
              onChange={(e) => update('provincia', e.target.value)}
              placeholder="Sevilla"
            />
            <p className="form-hint">Aparece en el Estado de Cuentas anual (Informes).</p>
          </div>

          <div className="form-row">
            <label htmlFor="email">Correo de contacto</label>
            <input
              id="email"
              type="email"
              value={settings.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="secretaria@tuhermandad.org"
            />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="iban">IBAN de la hermandad</label>
              <input
                id="iban"
                value={settings.iban}
                onChange={(e) => update('iban', e.target.value)}
                placeholder="ES00 0000 0000 0000 0000 0000"
              />
              <p className="form-hint">Para domiciliar cuotas y para que los hermanos paguen por transferencia.</p>
            </div>
            <div className="form-row">
              <label htmlFor="bizumTelefono">Teléfono del Bizum</label>
              <input
                id="bizumTelefono"
                type="tel"
                value={settings.bizumTelefono}
                onChange={(e) => update('bizumTelefono', e.target.value)}
                placeholder="600 000 000"
              />
              <p className="form-hint">Los hermanos verán este número en su área para pagar la papeleta por Bizum.</p>
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="identificadorAcreedor">Identificador de acreedor SEPA</label>
            <input
              id="identificadorAcreedor"
              value={settings.identificadorAcreedor}
              onChange={(e) => update('identificadorAcreedor', e.target.value)}
              placeholder="ES23000B12345678"
            />
            <p className="form-hint">Lo asigna tu banco al dar de alta el adeudo directo SEPA. Hace falta para generar la remesa.</p>
          </div>

          <div className="form-row">
            <label htmlFor="textoPieDocumentos">Texto legal del pie de recibos y justificantes</label>
            <textarea
              id="textoPieDocumentos"
              rows={2}
              value={settings.textoPieDocumentos}
              onChange={(e) => update('textoPieDocumentos', e.target.value)}
              placeholder="Ej. Entidad acogida a la Ley 49/2002; las cuotas y donativos pueden desgravar en el IRPF."
            />
            <p className="form-hint">Aparece al pie de los recibos de cuotas y justificantes de tesorería. Si lo dejas vacío se usa un texto genérico.</p>
          </div>
        </section>

        <div className="settings-actions">
          {saved && <span className="alert-item alert-item--ok">Guardado correctamente</span>}
          {errorGuardar && <span className="alert-item alert-item--warn">{errorGuardar}</span>}
          <button type="submit" className="btn btn-primary">
            Guardar cambios
          </button>
        </div>
      </form>
      )}

      {seccion === 'cortejo' && (
        <>
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Cuerpos del cortejo</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={addCuerpo}>
            + Añadir cuerpo
          </button>
        </div>
        <p className="form-hint">
          Los cuerpos son los bloques del cortejo (normalmente, un paso y su acompañamiento).
          Ponles el nombre que uséis en vuestra hermandad: Cristo y Virgen, Misterio y Palio,
          Cautivo… o un único cuerpo si salís en un solo bloque. Al renombrar un cuerpo, sus
          tramos se actualizan solos.
        </p>
        <div className="opciones-editor">
          {cuerposEdit.map((c, i) => (
            <div className="opcion-row opcion-row--cuerpo" key={`${c.original ?? 'nuevo'}-${i}`}>
              <input
                type="text"
                value={c.actual}
                onChange={(e) => updateCuerpo(i, e.target.value)}
                placeholder="Ej. Misterio, Palio, Único…"
                aria-label="Nombre del cuerpo"
              />
              <button type="button" className="icon-btn" title="Quitar cuerpo" onClick={() => removeCuerpo(i)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
        </div>
        {cuerposError && <p className="form-hint form-hint--error">{cuerposError}</p>}
        <div className="settings-actions">
          {cuerposSaved && <span className="alert-item alert-item--ok">Cuerpos guardados</span>}
          <button type="button" className="btn btn-primary" onClick={handleSaveCuerpos}>
            Guardar cuerpos
          </button>
        </div>
      </section>

      <section className="settings-card tramos-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Tramos del cortejo</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={addTramo}>
            + Añadir tramo
          </button>
        </div>
        {/* Sugerencias para el campo de rol de tramos y opciones. Va una vez
            para las dos tablas: son los mismos roles. */}
        <datalist id="rolesSugeridos">
          {['Costalero', 'Acólito', 'Monaguillo', 'Banda', 'Mantilla', 'Diputado de tramo', 'Nazareno', 'Presidencia']
            .map((r) => <option key={r} value={r} />)}
        </datalist>
        <p className="form-hint">
          El <b>rol</b> es opcional: si lo pones, a quien saque aquí su papeleta se le asigna solo
          mientras la tenga, y se le quita si la anula. Sirve para mandar un comunicado solo a los
          costaleros de este año sin ir marcándolos uno a uno. No da ningún permiso en el panel.
        </p>
        <p className="form-hint">
          Define los tramos de cada cuerpo, cuántos hermanos caben y <b>cómo se llena cada uno</b>:
          «Por número» es el reparto automático clásico de los cirios (la app coloca a los hermanos
          por su número, en cascada de un tramo al siguiente del mismo tipo); «Por solicitud» es
          para los puestos que se piden (cruz de guía, insignias, varas, presidencia…) y se los
          queda el de menor número. El orden de la lista es el orden real de desfile. El «tipo» es
          lo que se porta (cirio, insignia, vara…), texto libre; cada tramo puede tener además su
          propio precio de papeleta.
        </p>

        {aforos.length > 0 && (
          <div className="banner-inline banner-inline--accent">
            Aforo total:{' '}
            {aforos.map((a, i) => (
              <span key={a.cuerpo}>
                {i > 0 && ' · '}
                {a.cuerpo} {a.total}
              </span>
            ))}
            .
          </div>
        )}

        <div className="form-row tramos-precio-base">
          <label htmlFor="precioBase">Precio general de la papeleta</label>
          <div className="opcion-row__importe">
            <input
              id="precioBase"
              type="number"
              min="0"
              step="0.5"
              value={precioBase}
              onChange={(e) => {
                update('precioPapeleta', Number(e.target.value) || 0)
                setTramosSaved(false)
              }}
            />
            <span>€</span>
          </div>
          <p className="form-hint">Se usa en los tramos que no fijan su propio precio.</p>
        </div>

        <div className="tramos-editor">
          {/*
            UNA FICHA POR TRAMO, NO UNA FILA DE DIEZ COLUMNAS.
            ------------------------------------------------------------------
            Esto era una tabla de diez columnas con `min-width: 1020px`: para
            rellenar un tramo había que arrastrar la barra horizontal, y al
            hacerlo se perdían de vista las cabeceras, así que ya no se sabía
            qué era cada casilla. Los títulos, además, iban abreviados
            («Citación», «Rol»), que en una columna estrecha no explican nada.

            Ahora cada tramo es una ficha con sus campos etiquetados uno a uno y
            agrupados por la pregunta que responden: QUÉ ES este tramo, CÓMO SE
            LLENA, y QUÉ PASA EL DÍA DE LA SALIDA. Se lee de arriba abajo y cabe
            en un móvil sin mover nada.
          */}
          {tramos.map((t, i) => (
            <div className="tramo-ficha" key={t.id}>
              <div className="tramo-ficha__head">
                <span className="tramo-ficha__orden">{i + 1}</span>
                <input
                  className="tramo-ficha__nombre"
                  type="text"
                  value={t.nombre}
                  onChange={(e) => updateTramo(t.id, 'nombre', e.target.value)}
                  placeholder="Ej. Cirio 1º tramo"
                  aria-label="Nombre del tramo"
                />
                <span className="tramo-ficha__acciones">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Subir: va antes en el cortejo"
                    disabled={i === 0}
                    onClick={() => moveTramo(t.id, -1)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 15 12 9l-6 6" /></svg>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Bajar: va después en el cortejo"
                    disabled={i === tramos.length - 1}
                    onClick={() => moveTramo(t.id, 1)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 9 12 15l6-6" /></svg>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Quitar tramo"
                    onClick={() => removeTramo(t.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </span>
              </div>

              <div className="tramo-ficha__grupo">
                <p className="tramo-ficha__titulo">Qué es</p>
                <div className="tramo-ficha__campos">
                  <label>
                    <span>Cuerpo</span>
                    <select value={t.cuerpo} onChange={(e) => updateTramo(t.id, 'cuerpo', e.target.value as Cuerpo)}>
                      {(cuerposGuardados.includes(t.cuerpo) ? cuerposGuardados : [t.cuerpo, ...cuerposGuardados]).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Qué se lleva</span>
                    <input
                      type="text"
                      value={t.tipo ?? ''}
                      onChange={(e) => updateTramo(t.id, 'tipo', e.target.value)}
                      placeholder="Cirio, insignia, vara…"
                    />
                  </label>
                </div>
              </div>

              <div className="tramo-ficha__grupo">
                <p className="tramo-ficha__titulo">Cómo se llena</p>
                <div className="tramo-ficha__campos">
                  <label>
                    <span>Reparto</span>
                    <select
                      value={repartoDe(t)}
                      onChange={(e) => updateTramo(t.id, 'reparto', e.target.value as ModoReparto)}
                    >
                      <option value="numero">Por número de hermano</option>
                      <option value="solicitud">Se pide (gana el más antiguo)</option>
                    </select>
                  </label>
                  <label>
                    <span>Cuántos caben</span>
                    <input
                      type="number"
                      min="1"
                      value={t.capacidad}
                      onChange={(e) => updateTramo(t.id, 'capacidad', Number(e.target.value) || 0)}
                    />
                  </label>
                  <label>
                    <span>Precio de la papeleta</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={t.precio ?? ''}
                      placeholder={`${precioBase} (el general)`}
                      onChange={(e) => updateTramo(t.id, 'precio', e.target.value === '' ? null : Number(e.target.value) || 0)}
                    />
                  </label>
                </div>
              </div>

              <div className="tramo-ficha__grupo">
                <p className="tramo-ficha__titulo">El día de la salida</p>
                <div className="tramo-ficha__campos">
                  {/* A qué hora se cita ESTE tramo: cada uno entra a una hora, y
                      es LA pregunta del hermano la semana antes. */}
                  <label>
                    <span>Hora de citación</span>
                    <input
                      type="time"
                      value={t.horaCitacion ?? ''}
                      onChange={(e) => updateTramo(t.id, 'horaCitacion', e.target.value)}
                    />
                  </label>
                  {/* El rol que da ir en este tramo. Se le pone SOLO al hermano
                      mientras tenga aquí su papeleta, y se le quita si la anula. */}
                  <label>
                    <span>Rol que da (opcional)</span>
                    <input
                      type="text"
                      value={t.etiqueta ?? ''}
                      onChange={(e) => updateTramo(t.id, 'etiqueta', e.target.value)}
                      placeholder="Costalero, acólito…"
                      list="rolesSugeridos"
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
          {tramos.length === 0 && (
            <p className="form-hint">No hay tramos configurados todavía. Añade el primero.</p>
          )}
        </div>

        {gruposConPrecioMixto.length > 0 && (
          <p className="form-hint form-hint--error">
            Ojo: hay grupos «por número» con precios distintos entre sus tramos ({gruposConPrecioMixto.join(', ')}).
            Al sacar la papeleta se cobra el precio del primer tramo del grupo; iguala los precios para evitar
            sorpresas.
          </p>
        )}

        <div className="settings-actions">
          {tramosSaved && <span className="alert-item alert-item--ok">Tramos guardados</span>}
          {tramosError && <span className="alert-item alert-item--alerta">{tramosError}</span>}
          <button type="button" className="btn btn-primary" onClick={handleSaveTramos}>
            Guardar tramos
          </button>
        </div>
      </section>
        </>
      )}

      {seccion === 'papeletas' && (
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">La papeleta simbólica</h2>
        </div>
        {/*
          * UNA SOLA, Y SE LLAMA ASÍ.
          *
          * Aquí hubo una lista de «papeletas personalizadas» con nombre y precio
          * libres, y fue un error mío. Era un tramo pobre: tenía su propio
          * nombre y su propio precio, así que dos hermanos del mismo sitio
          * podían acabar pagando distinto según por dónde se les hubiera
          * emitido. Y se usaba para cosas que sí caminan —una mantilla, un
          * nazareno de cirio—, que son TRAMOS y ya tienen dónde definirse, con
          * su aforo, su hora de citación y su precio.
          *
          * Lo único que de verdad no es un tramo es esto: quien tiene derecho a
          * su sitio y ese año no sale. Si quiere salir, sitio hay.
          */}
        <p className="form-hint">
          Es la papeleta de quien <b>tiene su sitio y este año no sale</b>: la saca por
          costumbre, por acompañar a la hermandad o por ayudar, pero no camina y no ocupa
          puesto en el cortejo.
        </p>
        <p className="form-hint">
          Todo lo que <b>sí camina</b> —una mantilla, un nazareno de cirio, un monaguillo—
          es un tramo, y se define en <b>Cuerpos y tramos</b> con su aforo, su precio y su
          hora de citación. Ahí es donde se monta el cortejo.
        </p>

        <div className="form-row">
          <label htmlFor="precioSimbolica">Precio de la papeleta simbólica</label>
          <div className="opcion-row__importe">
            <input
              id="precioSimbolica"
              type="number"
              min="0"
              step="0.5"
              value={settings.precioSimbolica}
              onChange={(e) => update('precioSimbolica', Number(e.target.value) || 0)}
            />
            <span>€</span>
          </div>
        </div>

        <div className="settings-actions">
          {saved && <span className="alert-item alert-item--ok">Guardado</span>}
          {errorGuardar && <span className="alert-item alert-item--alerta">{errorGuardar}</span>}
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>
            Guardar
          </button>
        </div>
      </section>
      )}

      {seccion === 'catalogos' && (
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Catálogos de la hermandad</h2>
        </div>
        <p className="form-hint">
          Las listas que usan los demás módulos, adaptadas a vuestra forma de trabajar: conceptos y
          precios de las cuotas, categorías de tesorería e inventario, tipos de incidencia del día
          de salida, canales y destinatarios de los comunicados. Añade, renombra o quita lo que
          necesites: los módulos las usan al momento.
        </p>

        <div className="catalogo-bloque">
          <div className="catalogo-bloque__head">
            <h3>Conceptos de cuota</h3>
            <button type="button" className="btn btn-outline btn-sm" onClick={addConceptoCuota}>
              + Añadir
            </button>
          </div>
          <div className="opciones-editor">
            {conceptosCuota.map((c) => (
              <div className="opcion-row" key={c.id}>
                <input
                  type="text"
                  value={c.nombre}
                  onChange={(e) => updateConceptoCuota(c.id, 'nombre', e.target.value)}
                  placeholder="Ej. Cuota juvenil"
                  aria-label="Nombre del concepto de cuota"
                />
                <div className="opcion-row__importe">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={c.importe}
                    onChange={(e) => updateConceptoCuota(c.id, 'importe', Number(e.target.value) || 0)}
                    aria-label="Importe de la cuota en euros"
                  />
                  <span>€</span>
                </div>
                <button type="button" className="icon-btn" title="Quitar concepto" onClick={() => removeConceptoCuota(c.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="catalogos-grid">
          {CATALOGOS_DEF.map((d) => (
            <div className="catalogo-bloque" key={d.k}>
              <div className="catalogo-bloque__head">
                <h3>{d.titulo}</h3>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => addCatalogoValor(d.k)}>
                  + Añadir
                </button>
              </div>
              <div className="opciones-editor">
                {(catalogos[d.k] ?? []).map((valor, i) => (
                  <div className="opcion-row opcion-row--cuerpo" key={`${d.k}-${i}`}>
                    <input
                      type="text"
                      value={valor}
                      onChange={(e) => updateCatalogo(d.k, i, e.target.value)}
                      aria-label={d.titulo}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      title="Quitar"
                      onClick={() => removeCatalogoValor(d.k, i)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="settings-actions">
          {catalogosSaved && <span className="alert-item alert-item--ok">Catálogos guardados</span>}
          {catalogosError && <span className="alert-item alert-item--alerta">{catalogosError}</span>}
          <button type="button" className="btn btn-primary" onClick={handleSaveCatalogos}>
            Guardar catálogos
          </button>
        </div>
      </section>
      )}

      {seccion === 'ficha' && <CamposPropiosCard />}

      {seccion === 'conexiones' && <ConexionesCard />}
      {seccion === 'correo' && <CorreoCard />}

      {seccion === 'puesta' && <PuestaEnMarchaCard />}

      {seccion === 'datos' && (
        <>
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Copia de seguridad</h2>
        </div>
        <p className="form-hint">
          {sePuedeRestaurar()
            ? 'Todos los datos viven en este navegador. Descarga una copia (un solo archivo, con hermanos, cuotas, papeletas, tesorería, documentos y sus adjuntos) para no perderla al cambiar de ordenador o limpiar el navegador, y restáurala en otro equipo cuando quieras.'
            : 'Descarga un archivo con todo lo que tenéis en la base de datos —hermanos, cuotas, papeletas, tesorería, documentos y sus adjuntos— para guardarlo fuera. Si al traer algo falla, se dice aquí mismo.'}
        </p>
        {/* Con base de datos conectada, restaurar desde aquí no restaura: se
            escribiría en el navegador y la base de datos lo sobreescribiría al
            recargar. Antes el botón estaba, decía «Copia restaurada» y no
            había hecho nada. */}
        {!sePuedeRestaurar() && (
          <p className="form-hint form-hint--alerta">
            <b>Restaurar está desactivado</b> porque los datos están en la base de datos, no en este
            navegador: lo que se escribiera aquí lo sobreescribiría la base de datos al recargar. La
            copia que descargues sigue valiendo; volcarla es una operación que hacemos nosotros.
          </p>
        )}
        <div className="settings-actions">
          {copiaEstado && <span className="alert-item alert-item--ok">{copiaEstado}</span>}
          <input
            ref={backupRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={restaurarDesdeArchivo}
          />
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!sePuedeRestaurar()}
            title={sePuedeRestaurar() ? undefined : 'No disponible con la base de datos conectada'}
            onClick={() => backupRef.current?.click()}
          >
            Restaurar copia
          </button>
          <button type="button" className="btn btn-primary" onClick={descargarCopia}>
            Descargar copia
          </button>
        </div>
      </section>

      <section className="settings-card settings-card--peligro">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Restablecer datos</h2>
        </div>
        <p className="form-hint">
          Si quieres empezar de cero con los datos de ejemplo, puedes restablecerlos aquí. Se borra
          todo lo guardado en este navegador. Esta acción no se puede deshacer.
        </p>
        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              if (window.confirm('¿Borrar todos los datos guardados y volver a los de ejemplo?')) {
                restablecerDatosDeEjemplo()
              }
            }}
          >
            Restablecer datos de ejemplo
          </button>
        </div>
      </section>
        </>
      )}
        </div>
      </div>
    </div>
  )
}

/* -------------------- Campos propios de la ficha del hermano -------------------- */
/**
 * Cada hermandad apunta cosas distintas —la talla de la túnica, el número de
 * llave de la casa hermandad— y no tiene sentido inventar un campo fijo para
 * cada una. Aquí define los suyos, y aparecen en la ficha del hermano y en los
 * sesgos.
 */
function CamposPropiosCard() {
  const [campos, setCampos] = useCamposPropios()

  function editar(id: string, cambios: Partial<CampoPropio>) {
    setCampos(campos.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
  }
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= campos.length) return
    const arr = [...campos]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setCampos(arr)
  }
  /**
   * Quitar un campo propio es lo más caro de esta pantalla, aunque no lo
   * parezca. Lo que cada hermano tenga apuntado ahí (su talla de túnica, su
   * número de llave) se guarda contra el IDENTIFICADOR del campo. Volver a
   * crearlo a mano da un identificador nuevo, así que aparece vacío y lo
   * anterior se queda dentro de la ficha sin que nadie pueda verlo.
   *
   * Deshaciendo vuelve el mismo campo, con su mismo identificador, y los
   * valores reaparecen.
   */
  function quitarCampo(id: string) {
    const posicion = campos.findIndex((x) => x.id === id)
    const campo = campos[posicion]
    setCampos(campos.filter((x) => x.id !== id))
    if (campo) {
      ofrecerDeshacer(`Campo «${campo.nombre.trim() || 'sin nombre'}» quitado de la ficha`, () => {
        setCampos(reinsertar(campos.filter((x) => x.id !== id), campo, posicion))
      })
    }
  }

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Campos propios de la ficha</h2>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setCampos([...campos, { id: nuevoId(), nombre: '', tipo: 'texto', opciones: [], ayuda: '', enAlta: false }])}
        >
          + Añadir campo
        </button>
      </div>
      <p className="form-hint">
        Lo que apuntáis a mano en una hoja aparte: talla de túnica, número de llave, si tiene el
        carné de costalero… Aparecen en la ficha de cada hermano y se puede sesgar por ellos
        («todos los de talla L»).
      </p>
      {campos.length === 0 && <p className="form-hint">Todavía no hay ningún campo propio.</p>}

      {campos.map((c, i) => (
        <div className="assign-box" key={c.id}>
          <div className="assign-box__row">
            <input
              type="text"
              value={c.nombre}
              onChange={(e) => editar(c.id, { nombre: e.target.value })}
              placeholder="Nombre del campo"
              aria-label="Nombre del campo"
            />
            <select value={c.tipo} onChange={(e) => editar(c.id, { tipo: e.target.value as CampoPropio['tipo'] })} aria-label="Tipo de campo">
              {TIPOS_CAMPO.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <button type="button" className="icon-btn" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
            <button type="button" className="icon-btn" title="Bajar" disabled={i === campos.length - 1} onClick={() => mover(i, 1)}>▼</button>
            <button
              type="button"
              className="btn btn-ghost btn-sm rgpd-borrar"
              onClick={() => quitarCampo(c.id)}
            >
              Quitar
            </button>
          </div>
          {!c.nombre.trim() && <p className="form-hint form-hint--alerta">Ponle nombre o no se verá en la ficha.</p>}
          {c.tipo === 'lista' && (
            <div className="form-row">
              <label>Opciones (una por línea)</label>
              <textarea
                rows={3}
                value={c.opciones.join('\n')}
                onChange={(e) => editar(c.id, { opciones: e.target.value.split('\n').map((o) => o.trim()).filter(Boolean) })}
                placeholder={'S\nM\nL\nXL'}
              />
              {c.opciones.length === 0 && <p className="form-hint form-hint--alerta">Una lista sin opciones no deja elegir nada.</p>}
            </div>
          )}
          <div className="form-row">
            <label>Ayuda (opcional)</label>
            <input
              type="text"
              value={c.ayuda}
              onChange={(e) => editar(c.id, { ayuda: e.target.value })}
              placeholder={TIPOS_CAMPO.find((t) => t.id === c.tipo)?.ejemplo ?? ''}
            />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={c.enAlta} onChange={(e) => editar(c.id, { enAlta: e.target.checked })} />
            <span>Pedirlo también al dar de alta a un hermano nuevo</span>
          </label>
        </div>
      ))}

      {/* Nada de un botón «Guardar» que no guarda: se guardan al escribir. */}
      <p className="form-hint">Los cambios se guardan solos.</p>
    </section>
  )
}

/**
 * Puesta en marcha: un solo sitio que dice qué falta por conectar para que
 * Gobergo funcione del todo, y quién lo arregla.
 *
 * Existe porque lo que falta estaba repartido: la base de datos se veía en un
 * sitio, el correo en otro, la pasarela en un tercero, y nadie tenía la foto
 * entera. Al ir a poner la aplicación en marcha, la primera pregunta de una
 * junta es «¿qué me queda?», y hasta ahora no había dónde mirarlo.
 */
function PuestaEnMarchaCard() {
  const todos = Object.values(requisitos(contextoActual()))
  const pendientes = todos.filter((r) => !r.listo)
  const listos = todos.filter((r) => r.listo)

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Puesta en marcha</h2>
        {pendientes.length > 0 && <span className="pill pill--warn">{pendientes.length} por conectar</span>}
      </div>
      <p className="form-hint">
        Gobergo funciona entero sin nada de esto: se puede llevar el censo, cobrar las cuotas, repartir
        las papeletas y publicar la web. Lo de aquí abajo es lo que le falta para funcionar <b>del
        todo</b>, y casi todo lo contrata la hermandad a su nombre, no nosotros.
      </p>

      {pendientes.length === 0 ? (
        <p className="form-hint"><b>Está todo conectado.</b> No queda nada pendiente por aquí.</p>
      ) : (
        <div className="puesta-lista">
          {pendientes.map((r) => (
            <AvisoFalta key={r.id} requisito={r} />
          ))}
        </div>
      )}

      {listos.length > 0 && (
        <>
          <h3 className="puesta-hecho__titulo">Ya conectado</h3>
          <ul className="puesta-hecho">
            {listos.map((r) => (
              <li key={r.id}>{r.nombre}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/**
 * El envío de correo: encenderlo, decir quién firma y —lo primero de todo—
 * mandarse una prueba a uno mismo. Sin el botón de prueba, que algo falla se
 * descubre el día que se manda la convocatoria de cabildo a mil personas.
 */
/**
 * QUÉ HAY CONECTADO Y QUÉ FALTA.
 *
 * Llegó dicho así: «no hay apartado que dé opción de conectar, no está en
 * ajustes». Y era verdad: cada cosa se conectaba en su módulo —el correo aquí,
 * las redes en Comunicados, el dominio dentro de un desplegable de la Web— así
 * que no había ningún sitio donde preguntar «¿qué me queda?». Y ese sitio, para
 * cualquiera, es Ajustes.
 *
 * No mueve nada: cada cosa se sigue configurando donde estaba, porque ahí es
 * donde tiene sentido mientras se trabaja. Esto da la lista, el estado y el
 * camino.
 */
function ConexionesCard() {
  const settings = useHermandadSettings()
  const { suscripcion } = useSuscripcion()
  const [cuentas] = useCuentasSociales()
  const web = getWebPublica()
  const ajustesCorreo = getAjustesCorreo()

  const lista = conexiones({
    correoListo: correoDisponible(ajustesCorreo),
    // No hay «remitente» configurable: lo que se guarda es a dónde
    // contestan los hermanos si le dan a «responder».
    remitente: ajustesCorreo.responderA || undefined,
    redesConectadas: cuentas.filter((c) => c.conectada).length,
    totalRedes: cuentas.length,
    dominio: (web.dominio ?? '').trim() || undefined,
    webPublicada: web.publicada,
    dominioEnElPack: tieneCapacidad(suscripcion, 'premium'),
    tieneIban: settings.iban.trim().length > 0,
    bizum: settings.bizumTelefono.trim() || undefined,
  })
  const resumen = resumenConexiones(lista)

  return (
    <section className="cfg-card">
      <div className="cfg-card__head">
        <div>
          <h2>Conexiones</h2>
          <p className="cfg-card__lead">
            Todo lo que se enchufa desde fuera, junto. Cada cosa se configura en su pantalla —el
            enlace de al lado lleva— y aquí se ve de un vistazo qué falta.
          </p>
        </div>
        <span className="pill pill--info">{resumen.conectadas} de {resumen.posibles}</span>
      </div>

      <ul className="conexiones">
        {lista.map((c) => (
          <li className={`conexion conexion--${c.estado}`} key={c.id}>
            <div className="conexion__texto">
              <h3>
                {c.nombre}
                <span className={`pill ${c.estado === 'conectado' ? 'pill--ok' : c.estado === 'noDisponible' ? 'pill--off' : 'pill--warn'}`}>
                  {c.estado === 'conectado' ? 'Conectado' : c.estado === 'noDisponible' ? 'Todavía no' : 'Sin conectar'}
                </span>
                {c.detalle && <span className="conexion__detalle">{c.detalle}</span>}
              </h3>
              <p>{c.estado === 'noDisponible' ? c.porQueNo : c.paraQue}</p>
              {/* Se dice el camino ADEMÁS de enlazarlo: quien lo lea en el móvil
                  o se lo apunte para hacerlo luego necesita el nombre. */}
              {c.estado !== 'noDisponible' && <small>{c.comoLlegar}</small>}
            </div>
            {c.estado !== 'noDisponible' && (
              <Link className="btn btn-ghost btn-sm" to={c.donde}>
                {c.estado === 'conectado' ? 'Cambiar' : 'Conectar'}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function CorreoCard() {
  const { user } = useAuth()
  const hermandad = useHermandadSettings()
  const [ajustes, setAjustes] = useAjustesCorreo()
  const [destinoPrueba, setDestinoPrueba] = useState(user?.email ?? '')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const set = (c: Partial<AjustesCorreo>) => setAjustes({ ...ajustes, ...c })

  async function probar() {
    setEnviando(true)
    setResultado(null)
    const { asunto, texto, html } = correoDePrueba(hermandad.nombreLegal)
    const r = await enviarCorreo({ para: [destinoPrueba], asunto, texto, html })
    setEnviando(false)
    setResultado(
      r.ok
        ? { ok: true, texto: `Enviado a ${destinoPrueba}. Míralo, y mira también la carpeta de spam: si ha caído ahí, falta verificar el dominio.` }
        : { ok: false, texto: r.error ?? 'No se pudo enviar.' },
    )
  }

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Correo</h2>
        {correoDisponible(ajustes) && <span className="pill pill--ok">Activo</span>}
      </div>
      <p className="form-hint">
        Sin esto, los avisos llegan al buzón que cada hermano tiene dentro de su área: si no entra,
        no se entera. Con el correo conectado, además le llega a su bandeja.
      </p>

      <AvisoFalta requisito={requisito('correo')} />

      <details className="afinar">
        <summary>
          <span className="afinar__titulo">Cómo se conecta</span>
          <span className="afinar__nota">Una vez, unos 20 minutos</span>
        </summary>
        <ol className="cfg-pasos">
          <li>Crear una cuenta en <b>Resend</b> (resend.com). El plan gratuito da 3.000 correos al mes, de sobra para una hermandad.</li>
          <li>Copiar la clave de API que dan al registrarse.</li>
          <li>
            Guardarla como secreto de la función, desde el ordenador de quien administre Gobergo:
            <code className="cfg-codigo">supabase secrets set RESEND_API_KEY=re_xxx</code>
            <code className="cfg-codigo">supabase functions deploy enviar-correo</code>
          </li>
          <li>
            <b>Para probar hoy mismo</b> no hace falta dominio: Resend deja usar{' '}
            <code>onboarding@resend.dev</code> como remitente, pero solo escribe a la dirección con
            la que te registraste. Vale para comprobar que el circuito funciona.
          </li>
          <li>
            <b>Para escribir a los hermanos</b> hay que verificar el dominio de la hermandad en
            Resend y añadir los registros <b>SPF</b>, <b>DKIM</b> y <b>DMARC</b> donde se compró el
            dominio. Sin eso, los correos van a spam o se rechazan.
          </li>
        </ol>
      </details>

      <label className="checkbox">
        <input type="checkbox" checked={ajustes.activo} onChange={(e) => set({ activo: e.target.checked })} />
        <span>
          Mandar los avisos también por correo
          <small className="portal__pref-explica">
            Se puede apagar en cualquier momento sin perder la configuración. El buzón del hermano
            sigue funcionando igual.
          </small>
        </span>
      </label>

      <div className="form-row">
        <label htmlFor="correoResponder">A dónde contestan los hermanos</label>
        <input
          id="correoResponder" type="email" value={ajustes.responderA}
          onChange={(e) => set({ responderA: e.target.value })}
          placeholder={hermandad.email || 'secretaria@hermandad.es'}
        />
        <p className="form-hint">
          Cuando le den a «responder», la respuesta irá aquí. Vacío = a la dirección desde la que se
          envía, que puede no leer nadie.
        </p>
      </div>

      <div className="form-row">
        <label>Qué sale por correo</label>
        <p className="form-hint">
          Además de al buzón. Lo que cada hermano haya apagado en su área se respeta siempre: esto
          es el máximo, no una imposición.
        </p>
        {([
          ['comunicados', 'Comunicados de la hermandad'],
          ['cuotas', 'Cuotas: emisión y confirmación de pago'],
          ['papeletas', 'Papeletas de sitio'],
          ['ficha', 'Cambios en sus datos'],
        ] as const).map(([id, texto]) => (
          <label className="checkbox" key={id}>
            <input
              type="checkbox"
              checked={ajustes.avisaDe[id]}
              onChange={(e) => set({ avisaDe: { ...ajustes.avisaDe, [id]: e.target.checked } })}
            />
            <span>{texto}</span>
          </label>
        ))}
      </div>

      <div className="form-row">
        <label htmlFor="correoPrueba">Mandarme un correo de prueba</label>
        <div className="assign-box__row">
          <input
            id="correoPrueba" type="email" value={destinoPrueba}
            onChange={(e) => setDestinoPrueba(e.target.value)}
            placeholder="tu@correo.es"
          />
          <button
            type="button" className="btn btn-primary btn-sm"
            disabled={enviando || !destinoPrueba.trim()}
            onClick={probar}
          >
            {enviando ? 'Enviando…' : 'Enviar prueba'}
          </button>
        </div>
        <p className="form-hint">
          Hazlo <b>antes</b> de mandar nada a los hermanos. Es la única forma de saber que funciona
          sin descubrirlo con mil personas delante.
        </p>
        {resultado && (
          <p className={resultado.ok ? 'form-hint form-hint--ok' : 'aviso-falta__error-suelto'}>
            {resultado.ok ? '✓ ' : ''}{resultado.texto}
          </p>
        )}
      </div>
    </section>
  )
}
