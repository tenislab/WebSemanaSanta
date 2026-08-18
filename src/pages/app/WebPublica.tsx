import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ESTILOS,
  PLANTILLAS,
  SECCIONES_INFO,
  PALETAS,
  PAREJAS_TIPOGRAFICAS,
  cambiosDeEstilo,
  estiloActual,
  aSlug,
  contenidoVacio,
  esDeGoogleMaps,
  nombreSeccion,
  urlMapaIncrustado,
  urlSegura,
  useWebPublica,
  MAX_PDF_SUBIDO,
  type AlturaHero,
  type AlbumGaleria,
  type Boletin,
  type ColumnaPie,
  type CultoWeb,
  type EnlacePie,
  type EstiloWeb,
  type FotoGaleria,
  type Noticia,
  type PaginaWeb,
  type PlantillaWeb,
  type RedWeb,
  type TemaWeb,
  type TipoRed,
  type Titular,
  type WebPublica,
} from '../../lib/webPublica'
import type { HermandadSettings } from '../../lib/hermandadSettings'
import { useHermandadSettings } from '../../lib/hermandadSettings'
import { useSuscripcion, tieneCapacidad } from '../../lib/suscripcion'
import { avisosDeContraste } from '../../lib/contraste'
import { nuevoId } from '../../lib/supabaseSync'
import SitioContenido, { type FocoPreview } from '../../components/SitioContenido'
import { cultosDelCalendario } from '../../lib/cultosDelCalendario'
import { EditorParrafos, EditorFotos } from '../../components/EditorContenido'

function comprimirImagen(dataUrl: string, maxLado = 1600): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
      if (escala >= 1) return resolve(dataUrl)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/**
 * Varias imágenes de una tacada. Se leen en serie a propósito: en paralelo, con
 * treinta fotos de una salida, el navegador se queda clavado comprimiendo.
 */
async function leerImagenes(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void) {
  const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith('image/'))
  e.target.value = ''
  for (const file of files) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const lector = new FileReader()
      lector.onload = () => resolve(String(lector.result))
      lector.onerror = () => reject(new Error('no se pudo leer'))
      lector.readAsDataURL(file)
    }).catch(() => null)
    if (dataUrl) cb(await comprimirImagen(dataUrl))
  }
}

/** Las mismas imágenes, pero a partir de archivos sueltos (arrastrar, pegar). */
async function leerArchivos(files: File[], cb: (dataUrl: string) => void) {
  for (const file of files.filter((f) => f.type.startsWith('image/'))) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const lector = new FileReader()
      lector.onload = () => resolve(String(lector.result))
      lector.onerror = () => reject(new Error('no se pudo leer'))
      lector.readAsDataURL(file)
    }).catch(() => null)
    if (dataUrl) cb(await comprimirImagen(dataUrl))
  }
}

function leerImagen(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void) {
  const file = e.target.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  const lector = new FileReader()
  lector.onload = async () => cb(await comprimirImagen(String(lector.result)))
  lector.readAsDataURL(file)
  e.target.value = ''
}

/** Fecha de hoy en ISO pero en hora LOCAL: con toISOString, de madrugada en
 *  España la noticia salía fechada el día anterior (UTC). */
function fechaHoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const REDES: TipoRed[] = ['Instagram', 'Facebook', 'X', 'YouTube', 'TikTok', 'Web']
const ALTURAS: { id: AlturaHero; label: string }[] = [
  { id: 'compacta', label: 'Compacta' },
  { id: 'media', label: 'Media' },
  { id: 'completa', label: 'Pantalla completa' },
]

type Pestana = 'diseno' | 'marco' | 'contacto' | 'compartir' | 'portada' | 'galeria' | 'actualidad' | 'cultos' | 'paginas' | 'boletines'

/**
 * A qué sección de la web corresponde cada pestaña del editor: la vista previa
 * salta a ella y la resalta, para no perder de vista qué se está tocando.
 */
const SECCION_DE_PESTANA: Partial<Record<Pestana, FocoPreview>> = {
  galeria: 'galeria',
  actualidad: 'actualidad',
  cultos: 'cultos',
  paginas: 'paginas',
  boletines: 'boletines',
  contacto: 'contacto',
}
/**
 * El orden importa: primero lo que da forma a TODA la web (diseño, cabecera y
 * pie, contacto) y después el contenido. «Contacto» estaba la última y casi
 * nadie llegaba a ella: la dirección y las redes se quedaban sin poner.
 */
const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'diseno', label: 'Diseño y secciones' },
  { id: 'marco', label: 'Cabecera y pie' },
  { id: 'contacto', label: 'Contacto y mapa' },
  { id: 'compartir', label: 'Al compartir' },
  { id: 'portada', label: 'Fotos de portada' },
  { id: 'galeria', label: 'Galería' },
  { id: 'actualidad', label: 'Actualidad' },
  { id: 'cultos', label: 'Cultos' },
  { id: 'paginas', label: 'Páginas y textos' },
  { id: 'boletines', label: 'Boletines' },
]

/** Tamaños de la vista previa. El sitio se pinta a este ancho y se escala. */
type Dispositivo = 'movil' | 'tableta' | 'escritorio'
const DISPOSITIVOS: { id: Dispositivo; nombre: string; ancho: number; icono: ReactNode }[] = [
  {
    id: 'movil', nombre: 'Móvil', ancho: 390,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18.5h2" /></svg>,
  },
  {
    id: 'tableta', nombre: 'Tableta', ancho: 768,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M11 18.5h2" /></svg>,
  },
  {
    id: 'escritorio', nombre: 'Escritorio', ancho: 1280,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2.5" y="4" width="19" height="12" rx="1.6" /><path d="M9 20h6M12 16v4" /></svg>,
  },
]

interface AvisoWeb {
  id: string
  texto: string
  /** A dónde lleva el botón «Arreglar». */
  pestana: Pestana
  /** Los graves salen marcados: la web se ve mal o coja sin esto. */
  grave?: boolean
}

/**
 * Lo que le falta a la web para estar presentable. Se enseña arriba del todo
 * porque el problema real no era no saber configurarlo, sino no enterarse de
 * que faltaba: se publicaban webs sin dirección, sin portada y sin un solo
 * culto.
 */
/**
 * Cuántas comprobaciones hace `avisosDeLaWeb`. Sirve para el porcentaje de
 * «web terminada». Si se añade o se quita una comprobación, hay que tocarlo.
 */
const COMPROBACIONES_WEB = 12

function avisosDeLaWeb(web: WebPublica, hermandad: HermandadSettings): AvisoWeb[] {
  const avisos: AvisoWeb[] = []
  const dir = web.direccion || hermandad.direccion
  const tel = web.telefono || hermandad.telefono
  const email = web.email || hermandad.email

  if (!dir) avisos.push({ id: 'dir', texto: 'Tu web no dice dónde estáis: falta la dirección de la sede.', pestana: 'contacto', grave: true })
  if (!tel && !email) avisos.push({ id: 'contacto', texto: 'No hay forma de contactar: pon al menos un teléfono o un correo.', pestana: 'contacto', grave: true })
  if (web.heroFotos.length === 0) avisos.push({ id: 'portada', texto: 'La portada no tiene ninguna foto (se ve un degradado de color).', pestana: 'portada' })
  if (contenidoVacio(web.historia)) avisos.push({ id: 'historia', texto: 'La sección «Historia» está vacía y no se publica.', pestana: 'diseno' })
  if (web.titulares.length === 0) avisos.push({ id: 'titulares', texto: 'No has puesto ningún titular.', pestana: 'diseno' })
  if (web.cultos.length === 0) avisos.push({ id: 'cultos', texto: 'No hay cultos publicados: es lo que más se busca en una web de hermandad.', pestana: 'cultos' })
  if (!web.albumes.some((a) => a.fotos.length > 0)) avisos.push({ id: 'galeria', texto: 'La galería está vacía: sin fotos, la web se queda muy sosa.', pestana: 'galeria' })
  if (web.redes.length === 0) avisos.push({ id: 'redes', texto: 'No has enlazado ninguna red social.', pestana: 'contacto' })
  const enlacesRotos = web.pie.columnas.flatMap((c) => c.enlaces).filter((e) => (e.texto.trim() || e.url.trim()) && !urlSegura(e.url)).length
  if (enlacesRotos > 0) {
    avisos.push({
      id: 'enlaces',
      texto: `${enlacesRotos === 1 ? 'Un enlace del pie no lleva' : `${enlacesRotos} enlaces del pie no llevan`} a ninguna parte: no se publican.`,
      pestana: 'marco',
      // Grave: no es que falte algo, es que hay algo MAL puesto. Si no, se
      // quedaba escondido bajo «ver más» y nadie lo arreglaba.
      grave: true,
    })
  }
  if (!web.seo.descripcion.trim()) avisos.push({ id: 'seo', texto: 'Al compartir el enlace no sale ninguna descripción: en WhatsApp y en Google aparece vacío.', pestana: 'compartir' })
  if (!web.pie.textoLegal.trim()) avisos.push({ id: 'legal', texto: 'El pie no tiene aviso legal ni política de privacidad (es obligatorio si recoges datos).', pestana: 'marco' })
  if (!web.publicada) avisos.push({ id: 'publicada', texto: 'La web está oculta: solo la ves tú.', pestana: 'diseno' })

  return avisos
}

export default function WebPublica() {
  const [web, setWeb] = useWebPublica()
  const hermandad = useHermandadSettings()
  const [pestana, setPestanaState] = useState<Pestana>(
    () => (sessionStorage.getItem('cabildo-web-pestana') as Pestana | null) ?? 'diseno',
  )
  /** Se recuerda durante la sesión: se entra y se sale del módulo muchas veces. */
  function setPestana(p: Pestana) {
    setPestanaState(p)
    try { sessionStorage.setItem('cabildo-web-pestana', p) } catch { /* sin sessionStorage */ }
  }
  const [copiado, setCopiado] = useState(false)
  const [paginaSel, setPaginaSel] = useState<string | null>(null)
  // Dentro de «Cabecera y pie» hay dos sitios muy separados de la web: la vista
  // previa sigue al que se esté tocando.
  const [focoMarco, setFocoMarco] = useState<'cabecera' | 'pie'>('cabecera')
  const [dispositivo, setDispositivo] = useState<Dispositivo>('movil')
  const [guardadoEn, setGuardadoEn] = useState<number | null>(null)
  const [mostrarGuardado, setMostrarGuardado] = useState(false)
  useEffect(() => {
    if (guardadoEn === null) return
    setMostrarGuardado(true)
    const t = setTimeout(() => setMostrarGuardado(false), 1800)
    return () => clearTimeout(t)
  }, [guardadoEn])

  // Los datos de la hermandad llegan de Supabase DESPUÉS de montar: con las
  // dependencias vacías, la web se quedaba sin nombre y con los colores de
  // fábrica la primera vez que se abría en un navegador limpio.
  useEffect(() => {
    setWeb((actual) => {
      const parche: Partial<WebPublica> = {}
      if (!actual.titulo && hermandad.nombreLegal) parche.titulo = hermandad.nombreLegal
      if (actual.colorPrimario === '#6A1A23' && hermandad.colorPrimario) parche.colorPrimario = hermandad.colorPrimario
      if (actual.colorSecundario === '#C5A059' && hermandad.colorSecundario) parche.colorSecundario = hermandad.colorSecundario
      if (!actual.slug && hermandad.nombreLegal) parche.slug = aSlug(hermandad.nombreLegal)
      // Devolver el mismo objeto si no hay nada que cambiar evita un guardado
      // (y un re-render) en cada carga.
      return Object.keys(parche).length ? { ...actual, ...parche } : actual
    })
    // Las dependencias son los CAMPOS, no el objeto: `useHermandadSettings`
    // devuelve un objeto nuevo en cada render y con él el efecto se disparaba
    // sin parar («Maximum update depth exceeded»).
  }, [hermandad.nombreLegal, hermandad.colorPrimario, hermandad.colorSecundario, setWeb])

  // Ctrl/⌘+Z y Ctrl/⌘+Mayús+Z, como en cualquier editor.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      // Dentro de un campo de texto, el navegador ya deshace lo escrito: no se
      // le quita el atajo, o se perdería el deshacer normal de la caja.
      const dentro = document.activeElement
      const enCampo = dentro instanceof HTMLInputElement || dentro instanceof HTMLTextAreaElement
      if (enCampo) return
      e.preventDefault()
      if (e.shiftKey) rehacer()
      else deshacer()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  const enlace = `${window.location.origin}/w/${web.slug}`
  const avisos = avisosDeLaWeb(web, hermandad)
  // Los próximos cultos del módulo de Eventos, para verlos ya en la vista previa.
  const cultosCalendario = useMemo(() => cultosDelCalendario(), [])

  /**
   * Cambio calculado sobre el estado MÁS RECIENTE. Hace falta para lo que llega
   * tarde: al subir treinta fotos, cada una se guarda cuando termina de
   * comprimirse, y con la lista del render se perdían casi todas.
   */
  function actualizar(cambio: (actual: WebPublica) => WebPublica) {
    setWeb(cambio)
  }

  /**
   * Historial para deshacer. Se guarda el estado ANTERIOR a cada cambio; los
   * cambios seguidos en el mismo campo (escribir en un input) se agrupan, o
   * cada tecla sería un paso atrás.
   */
  const historial = useRef<{ pila: WebPublica[]; rehacer: WebPublica[]; ultimoCampo: string; ultimoMs: number }>({
    pila: [], rehacer: [], ultimoCampo: '', ultimoMs: 0,
  })
  const [pasos, setPasos] = useState({ atras: 0, adelante: 0 })

  function apuntar(campo: string, anterior: WebPublica) {
    const h = historial.current
    const ahora = performance.now()
    const seguido = campo === h.ultimoCampo && ahora - h.ultimoMs < 900
    if (!seguido) {
      h.pila = [...h.pila.slice(-49), anterior]
      h.rehacer = []
    }
    h.ultimoCampo = campo
    h.ultimoMs = ahora
    setPasos({ atras: h.pila.length, adelante: h.rehacer.length })
  }

  function deshacer() {
    const h = historial.current
    const previo = h.pila.pop()
    if (!previo) return
    h.rehacer = [...h.rehacer, web]
    h.ultimoCampo = ''
    setWeb(previo)
    setPasos({ atras: h.pila.length, adelante: h.rehacer.length })
  }

  function rehacer() {
    const h = historial.current
    const siguiente = h.rehacer.pop()
    if (!siguiente) return
    h.pila = [...h.pila, web]
    h.ultimoCampo = ''
    setWeb(siguiente)
    setPasos({ atras: h.pila.length, adelante: h.rehacer.length })
  }

  function editar<K extends keyof WebPublica>(
    campo: K,
    valor: WebPublica[K] | ((actual: WebPublica[K]) => WebPublica[K]),
  ) {
    // El historial se apunta FUERA del updater: dentro, React puede ejecutar
    // el updater dos veces (o descartarlo) y el historial salía duplicado o
    // directamente vacío.
    apuntar(String(campo), web)
    // Señal de «se ha guardado»: el editor guarda solo y sin esto la gente
    // buscaba un botón de guardar que no existe.
    setGuardadoEn(Date.now())
    setWeb((actual) => ({
      ...actual,
      [campo]: typeof valor === 'function' ? (valor as (v: WebPublica[K]) => WebPublica[K])(actual[campo]) : valor,
    }))
  }

  /**
   * Varios campos de una vez con UNA sola entrada en el historial: aplicar un
   * estilo toca siete campos y con `editar` siete veces hacían falta siete
   * «deshacer» para volver atrás.
   */
  function editarLote(etiqueta: string, cambios: Partial<WebPublica>) {
    apuntar(etiqueta, web)
    setGuardadoEn(Date.now())
    setWeb((actual) => ({ ...actual, ...cambios }))
  }

  function copiarEnlace() {
    navigator.clipboard?.writeText(enlace).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Web pública</p>
          <h1>Contenido web</h1>
          <p className="dash-head__lead">Personaliza tu web por secciones. A la derecha ves cómo va quedando.</p>
        </div>
        <div className="dash-head__actions">
          <span className={`cms-guardado${mostrarGuardado ? ' cms-guardado--visible' : ''}`} role="status">
            ✓ Guardado
          </span>
          {/* Los dos iguales: antes uno llevaba texto y el otro solo la flecha,
              y parecían dos controles distintos. */}
          <div className="cms-deshacer" role="group" aria-label="Deshacer y rehacer">
            <button
              type="button"
              className="icon-btn"
              onClick={deshacer}
              disabled={pasos.atras === 0}
              title={`Deshacer${pasos.atras ? ` (${pasos.atras})` : ''} · Ctrl+Z`}
              aria-label="Deshacer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10H9" /></svg>
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={rehacer}
              disabled={pasos.adelante === 0}
              title={`Rehacer${pasos.adelante ? ` (${pasos.adelante})` : ''} · Ctrl+Mayús+Z`}
              aria-label="Rehacer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h6" /></svg>
            </button>
          </div>
          <button type="button" className="btn btn-outline" onClick={copiarEnlace}>
            {copiado ? '✓ Enlace copiado' : 'Copiar enlace'}
          </button>
          <a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Ver mi web</a>
        </div>
      </div>

      <AvisosWeb avisos={avisos} irA={setPestana} />

      {/* Pestañas */}
      <div className="cms-tabs">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" className={`cms-tab${pestana === p.id ? ' cms-tab--active' : ''}`} onClick={() => setPestana(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="cms-layout">
        <div className="cms-editor">
          {pestana === 'diseno' && (
            <DisenoTab web={web} editar={editar} editarLote={editarLote} copiado={copiado} copiarEnlace={copiarEnlace} />
          )}
          {pestana === 'marco' && <MarcoTab web={web} editar={editar} onFoco={setFocoMarco} />}
          {pestana === 'portada' && <PortadaTab web={web} editar={editar} actualizar={actualizar} />}
          {pestana === 'galeria' && <GaleriaTab web={web} editar={editar} actualizar={actualizar} />}
          {pestana === 'actualidad' && <ActualidadTab web={web} editar={editar} />}
          {pestana === 'cultos' && <CultosTab web={web} editar={editar} delCalendario={cultosCalendario} />}
          {pestana === 'paginas' && <PaginasTab web={web} editar={editar} paginaSel={paginaSel} setPaginaSel={setPaginaSel} />}
          {pestana === 'boletines' && <BoletinesTab web={web} editar={editar} actualizar={actualizar} />}
          {pestana === 'contacto' && <ContactoTab web={web} hermandad={hermandad} editar={editar} />}
          {pestana === 'compartir' && <CompartirTab web={web} hermandad={hermandad} editar={editar} enlace={enlace} />}
        </div>

        <VistaPrevia
          web={web}
          hermandad={hermandad}
          cultosDelCalendario={cultosCalendario}
          seccionActiva={pestana === 'marco' ? focoMarco : SECCION_DE_PESTANA[pestana]}
          dispositivo={dispositivo}
          setDispositivo={setDispositivo}
          enlace={enlace}
        />
      </div>
    </div>
  )
}

/* ----------------------------- Vista previa ----------------------------- */
/**
 * La web tal cual se ve, en el tamaño que se elija. Para tableta y escritorio
 * el sitio se pinta a su ancho de verdad y se ESCALA para que quepa en la
 * columna: si no, se vería el diseño de móvil siempre y no habría forma de
 * comprobar cómo queda en un ordenador.
 */
function VistaPrevia({
  web,
  hermandad,
  cultosDelCalendario: cultosCal,
  seccionActiva,
  dispositivo,
  setDispositivo,
  enlace,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  cultosDelCalendario: CultoWeb[]
  seccionActiva?: FocoPreview
  dispositivo: Dispositivo
  setDispositivo: (d: Dispositivo) => void
  enlace: string
}) {
  const marco = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  const ancho = DISPOSITIVOS.find((d) => d.id === dispositivo)?.ancho ?? 390

  useEffect(() => {
    const el = marco.current
    if (!el) return
    // Se mide el marco de verdad: la columna cambia de ancho con la ventana.
    const observador = new ResizeObserver(() => {
      const disponible = el.clientWidth
      setEscala(disponible > 0 ? Math.min(1, disponible / ancho) : 1)
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [ancho])

  return (
    <aside className="cms-preview">
      <div className="cms-preview__head">
        {/* Ver la web como se ve de verdad en un móvil es lo que más se echaba
            en falta: casi todo el mundo la va a mirar ahí. */}
        <div className="cms-preview__dispositivos" role="group" aria-label="Tamaño de la vista previa">
          {DISPOSITIVOS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`cms-preview__dispositivo${dispositivo === d.id ? ' cms-preview__dispositivo--on' : ''}`}
              onClick={() => setDispositivo(d.id)}
              title={`${d.nombre} · ${d.ancho} px`}
              aria-pressed={dispositivo === d.id}
            >
              <span aria-hidden="true" className="cms-preview__icono">{d.icono}</span>
              <span className="sr-only">{d.nombre}</span>
            </button>
          ))}
        </div>
        <a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Abrir</a>
      </div>
      <div ref={marco} className={`cms-preview__frame cms-preview__frame--${dispositivo}`}>
        <div
          className="cms-preview__stage"
          style={{
            width: ancho,
            transform: escala < 1 ? `scale(${escala})` : undefined,
            transformOrigin: 'top left',
            // El alto del contenedor tiene que contar con la escala, o el
            // marco se queda con un hueco muerto debajo.
            marginBottom: escala < 1 ? `calc((${escala} - 1) * 100%)` : undefined,
          }}
        >
          <SitioContenido
            web={web}
            hermandad={hermandad}
            cultosDelCalendario={cultosCal}
            interactivo={false}
            seccionActiva={seccionActiva}
          />
        </div>
      </div>
      <p className="cms-preview__pie">
        {DISPOSITIVOS.find((d) => d.id === dispositivo)?.nombre} · {ancho} px
        {escala < 1 && ` · al ${Math.round(escala * 100)} %`}
      </p>
    </aside>
  )
}

/**
 * Cambia un campo de la web. El valor puede ser una FUNCIÓN del valor actual:
 * hace falta para todo lo que llega tarde (leer y comprimir una foto tarda
 * cientos de ms), porque con el valor del render se pisaba lo escrito
 * entretanto en cualquier otro campo de la misma lista.
 */
type EditarFn = <K extends keyof WebPublica>(
  campo: K,
  valor: WebPublica[K] | ((actual: WebPublica[K]) => WebPublica[K]),
) => void
/** Cambio calculado sobre el estado más reciente (para lo asíncrono). */
type ActualizarFn = (cambio: (actual: WebPublica) => WebPublica) => void
type EditarLoteFn = (etiqueta: string, cambios: Partial<WebPublica>) => void

/* ------------------------- Avisos de lo que falta ------------------------- */
/**
 * Cuánto le falta a la web para estar presentable, en forma de progreso y no
 * de lista de reproches: doce avisos abiertos ocupaban la pantalla entera y
 * el editor quedaba debajo del pliegue. Se enseñan los tres más urgentes y el
 * resto se despliega a petición.
 */
function AvisosWeb({ avisos, irA }: { avisos: AvisoWeb[]; irA: (p: Pestana) => void }) {
  const [verTodo, setVerTodo] = useState(false)
  const hechos = COMPROBACIONES_WEB - avisos.length
  const pct = Math.round((hechos / COMPROBACIONES_WEB) * 100)

  if (avisos.length === 0) {
    return (
      <p className="cms-avisos cms-avisos--ok">
        <span className="cms-avisos__icono" aria-hidden="true">✓</span>
        Tu web está completa: portada, historia, titulares, cultos, contacto y aviso legal.
      </p>
    )
  }

  // Primero lo grave: sin dirección ni forma de contactar, la web no sirve.
  const ordenados = [...avisos].sort((a, b) => Number(!!b.grave) - Number(!!a.grave))
  const visibles = verTodo ? ordenados : ordenados.slice(0, 3)
  const ocultos = ordenados.length - visibles.length
  const graves = avisos.filter((a) => a.grave).length

  return (
    <section className={`cms-avisos${graves ? ' cms-avisos--grave' : ''}`}>
      <div className="cms-progreso">
        <div className="cms-progreso__texto">
          <b>Tu web va por el {pct} %</b>
          <small>
            {hechos} de {COMPROBACIONES_WEB} cosas hechas ·{' '}
            {graves > 0 ? 'lo de abajo es lo importante' : 'lo que queda son detalles'}
          </small>
        </div>
        <div className="cms-progreso__barra" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="cms-avisos__lista">
        {visibles.map((a) => (
          <li key={a.id}>
            {a.grave && <span className="cms-avisos__marca" aria-hidden="true">!</span>}
            <span>{a.texto}</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => irA(a.pestana)}>Arreglar</button>
          </li>
        ))}
      </ul>
      {(ocultos > 0 || verTodo) && (
        <button type="button" className="cms-avisos__mas" onClick={() => setVerTodo(!verTodo)}>
          {verTodo ? 'Ver solo lo urgente' : `Ver ${ocultos} ${ocultos === 1 ? 'cosa' : 'cosas'} más`}
        </button>
      )}
    </section>
  )
}

/* --------------------------- Cabecera y pie --------------------------- */
function MarcoTab({ web, editar, onFoco }: { web: WebPublica; editar: EditarFn; onFoco: (f: 'cabecera' | 'pie') => void }) {
  const { cabecera, pie } = web

  function editarCabecera(c: Partial<typeof cabecera>) { editar('cabecera', { ...cabecera, ...c }) }
  function editarPie(c: Partial<typeof pie>) { editar('pie', { ...pie, ...c }) }
  function editarColumna(id: string, c: Partial<ColumnaPie>) {
    editarPie({ columnas: pie.columnas.map((col) => (col.id === id ? { ...col, ...c } : col)) })
  }
  function editarEnlace(colId: string, id: string, c: Partial<EnlacePie>) {
    editarColumna(colId, {
      enlaces: (pie.columnas.find((x) => x.id === colId)?.enlaces ?? []).map((e) => (e.id === id ? { ...e, ...c } : e)),
    })
  }
  function moverColumna(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= pie.columnas.length) return
    const cols = [...pie.columnas]
    ;[cols[i], cols[j]] = [cols[j], cols[i]]
    editarPie({ columnas: cols })
  }
  /**
   * Los sitios de la propia web a los que se puede enlazar. Se ofrecen como
   * sugerencia al escribir la dirección: nadie se sabe de memoria que una
   * página suya es `#pagina-a1b2c3`.
   */
  const destinosPropios: { texto: string; url: string }[] = [
    ...web.secciones
      .filter((s) => s.visible && s.tipo !== 'paginas')
      .map((s) => ({ texto: nombreSeccion(s), url: `#${s.tipo}` })),
    ...web.paginas
      .filter((p) => p.enMenu !== false)
      .map((p) => ({ texto: p.titulo || 'Página', url: `#pagina-${p.id}` })),
  ]

  /** Atajo: una columna con enlaces a las secciones y páginas que ya existen. */
  function columnaDeSecciones() {
    const enlaces: EnlacePie[] = destinosPropios
      .filter((d) => d.url !== '#contacto')
      .map((d) => ({ id: nuevoId(), texto: d.texto, url: d.url }))
    editarPie({ columnas: [...pie.columnas, { id: nuevoId(), titulo: 'La Hermandad', enlaces }] })
  }

  return (
    <>
      {/* onFocus burbujea: basta con marcarlo en la tarjeta para que la vista
          previa salte a la barra de arriba al tocar cualquier control suyo. */}
      <section className="settings-card" onFocus={() => onFoco('cabecera')}>
        <div className="settings-card__head"><h2 className="settings-card__title">Cabecera</h2></div>
        <p className="form-hint">La barra de arriba, la que se ve en todas las páginas de tu web.</p>
        <label className="checkbox">
          <input type="checkbox" checked={cabecera.mostrarLogo} onChange={(e) => editarCabecera({ mostrarLogo: e.target.checked })} />
          <span>Enseñar el escudo o logo</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={cabecera.mostrarNombre} onChange={(e) => editarCabecera({ mostrarNombre: e.target.checked })} />
          <span>Enseñar el nombre de la hermandad</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={cabecera.mostrarLema} onChange={(e) => editarCabecera({ mostrarLema: e.target.checked })} />
          <span>Enseñar el lema debajo del nombre</span>
        </label>
        {cabecera.mostrarLema && !web.lema && (
          <p className="form-hint">Todavía no hay lema escrito: se pone en <b>Diseño y secciones → Colores y tipografía</b>.</p>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={cabecera.fija} onChange={(e) => editarCabecera({ fija: e.target.checked })} />
          <span>La barra se queda arriba al bajar por la página</span>
        </label>
        {!cabecera.mostrarLogo && !cabecera.mostrarNombre && (
          <p className="form-hint form-hint--alerta">
            Sin logo ni nombre, la parte izquierda de la barra queda en blanco. Deja al menos uno.
          </p>
        )}
        <div className="form-row" style={{ marginTop: '0.8rem' }}>
          <label htmlFor="botonCabecera">Botón de la derecha</label>
          <input
            id="botonCabecera"
            type="text"
            value={cabecera.textoBoton}
            onChange={(e) => editarCabecera({ textoBoton: e.target.value })}
            placeholder="Entrar"
          />
          <p className="form-hint">Lleva al área del hermano. Déjalo vacío si no quieres ningún botón.</p>
        </div>
      </section>

      <section className="settings-card" onFocus={() => onFoco('pie')}>
        <div className="settings-card__head">
          <h2 className="settings-card__title">Pie de página</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => editarPie({ columnas: [...pie.columnas, { id: nuevoId(), titulo: 'Enlaces', enlaces: [] }] })}>
            + Añadir columna
          </button>
        </div>
        <p className="form-hint">
          Columnas de enlaces al final de la web. Puedes enlazar a una sección de tu propia web
          (<code>#cultos</code>), a una página tuya o a una dirección de fuera.
        </p>
        {/* Al escribir la dirección se despliegan los sitios de la propia web. */}
        <datalist id="destinos-web">
          {destinosPropios.map((d) => <option key={d.url} value={d.url}>{d.texto}</option>)}
        </datalist>
        {pie.columnas.length === 0 && (
          <div className="assign-box__row" style={{ marginBottom: '0.6rem' }}>
            <span className="table-subtle">Sin columnas: el pie es solo una línea con el copyright.</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={columnaDeSecciones}>
              Crear una con mis secciones
            </button>
          </div>
        )}
        {pie.columnas.map((col, i) => (
          <div className="assign-box" key={col.id}>
            <div className="assign-box__row">
              <input
                type="text"
                value={col.titulo}
                onChange={(e) => editarColumna(col.id, { titulo: e.target.value })}
                placeholder="Título de la columna"
                aria-label="Título de la columna"
              />
              <button type="button" className="icon-btn" title="Subir" disabled={i === 0} onClick={() => moverColumna(i, -1)}>▲</button>
              <button type="button" className="icon-btn" title="Bajar" disabled={i === pie.columnas.length - 1} onClick={() => moverColumna(i, 1)}>▼</button>
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editarPie({ columnas: pie.columnas.filter((x) => x.id !== col.id) })}>Quitar</button>
            </div>
            {col.enlaces.map((e) => {
              // Un enlace mal escrito no se publica y desaparece sin decir nada:
              // aquí se avisa en el momento, no cuando ya está la web fuera.
              const roto = Boolean(e.url.trim()) && !urlSegura(e.url)
              const sinTexto = Boolean(e.url.trim()) && !e.texto.trim()
              return (
                <div key={e.id} style={{ marginTop: '0.4rem' }}>
                  <div className="assign-box__row">
                    <input type="text" value={e.texto} onChange={(ev) => editarEnlace(col.id, e.id, { texto: ev.target.value })} placeholder="Texto" aria-label="Texto del enlace" />
                    <input
                      type="text"
                      list="destinos-web"
                      value={e.url}
                      onChange={(ev) => editarEnlace(col.id, e.id, { url: ev.target.value })}
                      placeholder="#cultos o https://…"
                      aria-label="Dirección del enlace"
                      aria-invalid={roto}
                    />
                    <button type="button" className="icon-btn rgpd-borrar" title="Quitar enlace" onClick={() => editarColumna(col.id, { enlaces: col.enlaces.filter((x) => x.id !== e.id) })}>✕</button>
                  </div>
                  {roto && <p className="form-hint form-hint--alerta">Esa dirección no vale: pon «#cultos» para una sección tuya o una dirección que empiece por https://</p>}
                  {!roto && sinTexto && <p className="form-hint form-hint--alerta">Ponle un texto o no se publicará.</p>}
                </div>
              )
            })}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: '0.4rem' }}
              onClick={() => editarColumna(col.id, { enlaces: [...col.enlaces, { id: nuevoId(), texto: '', url: '' }] })}
            >
              + Añadir enlace
            </button>
            {col.enlaces.length === 0 && (
              <p className="form-hint">Una columna sin enlaces no se publica.</p>
            )}
          </div>
        ))}

        <label className="checkbox" style={{ marginTop: '0.8rem' }}>
          <input type="checkbox" checked={pie.mostrarContacto} onChange={(e) => editarPie({ mostrarContacto: e.target.checked })} />
          <span>Repetir los datos de contacto en el pie</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={pie.mostrarRedes} onChange={(e) => editarPie({ mostrarRedes: e.target.checked })} />
          <span>Enseñar las redes sociales en el pie</span>
        </label>

        <div className="form-row" style={{ marginTop: '0.8rem' }}>
          <label htmlFor="textoPie">Línea de copyright</label>
          <input id="textoPie" type="text" value={web.textoPie} onChange={(e) => editar('textoPie', e.target.value)} placeholder={`© ${web.titulo || 'Tu hermandad'}`} />
        </div>
        <div className="form-row">
          <label htmlFor="textoLegal">Aviso legal y protección de datos</label>
          <textarea
            id="textoLegal"
            rows={3}
            value={pie.textoLegal}
            onChange={(e) => editarPie({ textoLegal: e.target.value })}
            placeholder="Hermandad inscrita en el Registro de Entidades Religiosas nº … · Responsable del tratamiento de datos: … · Puedes ejercer tus derechos escribiendo a …"
          />
          <p className="form-hint">
            Sale en letra pequeña al final de todo. Si en la web recoges datos personales, este texto
            es obligatorio.
          </p>
        </div>
      </section>
    </>
  )
}

/* ------------------------------ Diseño ------------------------------ */
function DisenoTab({
  web, editar, editarLote, copiado, copiarEnlace,
}: {
  web: WebPublica
  editar: EditarFn
  editarLote: EditarLoteFn
  copiado: boolean
  copiarEnlace: () => void
}) {
  // El dominio propio es un extra del pack «Todo» (capacidad premium).
  const { suscripcion } = useSuscripcion()
  const conDominioPropio = tieneCapacidad(suscripcion, 'premium')
  const avisosColor = avisosDeContraste(web.colorPrimario, web.colorSecundario, web.tema)
  // Qué estilo está puesto ahora (null = combinación a medida).
  const puesto = estiloActual(web)

  /** Vuelca un estilo entero de golpe: plantilla, colores, letra, esquinas y aire. */
  function aplicarEstilo(e: EstiloWeb) {
    editarLote(`estilo:${e.id}`, cambiosDeEstilo(e))
  }

  function toggleSeccion(i: number) {
    editar('secciones', (xs) => xs.map((s, idx) => (idx === i ? { ...s, visible: !s.visible } : s)))
  }
  /** Título a medida de una sección; vacío = el nombre de fábrica. */
  function renombrarSeccion(i: number, nombre: string) {
    editar('secciones', (xs) => xs.map((s, idx) => (idx === i ? { ...s, nombre } : s)))
  }
  function moverSeccion(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.secciones.length) return
    const secciones = [...web.secciones]
    ;[secciones[i], secciones[j]] = [secciones[j], secciones[i]]
    editar('secciones', secciones)
  }
  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Publicación</h2></div>
        <label className={`interruptor${web.publicada ? ' interruptor--on' : ''}`}>
          <input type="checkbox" checked={web.publicada} onChange={(e) => editar('publicada', e.target.checked)} />
          <span className="interruptor__palanca" aria-hidden="true" />
          <span className="interruptor__texto">
            <b>{web.publicada ? 'Publicada' : 'Oculta'}</b>
            <small>{web.publicada ? 'Cualquiera con el enlace puede verla.' : 'Solo la ves tú desde aquí. Nadie más puede entrar.'}</small>
          </span>
        </label>
        <div className="form-row" style={{ marginTop: '0.8rem' }}>
          <label htmlFor="slug">Enlace de tu web</label>
          <div className="assign-box__row">
            <span className="table-subtle">{window.location.origin}/w/</span>
            <input id="slug" type="text" value={web.slug} onChange={(e) => editar('slug', aSlug(e.target.value))} placeholder="mi-hermandad" />
            <button type="button" className="btn btn-outline btn-sm" onClick={copiarEnlace}>{copiado ? 'Copiado' : 'Copiar'}</button>
          </div>
        </div>

        <details className="afinar afinar--suelto">
          <summary className="afinar__cabeza">
            <span className="afinar__titulo">Usar un dominio propio</span>
            <span className="afinar__nota">{web.dominio || 'Opcional'}</span>
          </summary>
          <div className="afinar__cuerpo">
        <div className="form-row">
          <label htmlFor="dominio">
            Dominio personalizado {!conDominioPropio && <span className="pill pill--info">Pack Todo</span>}
          </label>
          {!conDominioPropio && (
            <p className="form-hint">
              Tu web vive en el enlace de arriba. Para usar un dominio propio
              (hermandaddetriana.es) hace falta el pack <b>Todo</b>.
            </p>
          )}
          <input
            id="dominio"
            type="text"
            value={web.dominio ?? ''}
            disabled={!conDominioPropio}
            onChange={(e) => editar('dominio', e.target.value.trim().toLowerCase())}
            placeholder="hermandaddetriana.es"
          />
          <details className="form-hint" style={{ marginTop: '0.5rem' }}>
            <summary>Cómo poner tu dominio propio (p. ej. hermandaddetriana.es)</summary>
            <ol style={{ margin: '0.5rem 0 0 1rem', lineHeight: 1.7 }}>
              <li>Compra el dominio en un registrador (IONOS, GoDaddy, Namecheap…).</li>
              <li>Escríbelo aquí arriba y guarda.</li>
              <li>En el panel de despliegue (Vercel) → <b>Domains</b> → añade tu dominio.</li>
              <li>En tu registrador, apunta los DNS a Vercel (un registro <code>A</code> a la IP que te indica, o un <code>CNAME</code>).</li>
              <li>En unos minutos tu web se verá en <b>tu dominio</b> en vez de en el enlace largo.</li>
            </ol>
            <p style={{ marginTop: '0.4rem' }}>
              El enlace real al dominio se activa al conectar la base de datos y el despliegue; por
              ahora este campo lo guarda para tenerlo listo.
            </p>
          </details>
        </div>
          </div>
        </details>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Estilo de tu web</h2></div>
        <p className="form-hint">
          Pulsa uno y la web queda hecha: plantilla, colores, letra, esquinas y aire, todo a la vez.
          Es lo único que hace falta tocar para que se vea bien.
        </p>
        <div className="estilos-grid">
          {ESTILOS.map((e) => {
            const c = cambiosDeEstilo(e)
            const par = PAREJAS_TIPOGRAFICAS.find((x) => x.id === e.pareja) ?? PAREJAS_TIPOGRAFICAS[0]
            const sel = puesto?.id === e.id
            return (
              <button
                type="button"
                key={e.id}
                className={`estilo-card${sel ? ' estilo-card--sel' : ''}`}
                onClick={() => aplicarEstilo(e)}
                aria-pressed={sel}
                title={e.descripcion}
              >
                <span
                  className={`estilo-card__previa estilo-card__previa--${e.tema} estilo-card__previa--${e.redondeo} estilo-card__previa--${e.plantilla} estilo-card__previa--aire-${e.densidad}`}
                  style={{ '--e1': c.colorPrimario, '--e2': c.colorSecundario } as CSSProperties}
                  aria-hidden="true"
                >
                  <span className="estilo-card__barra"><i /><i /><i /></span>
                  <span className="estilo-card__cuerpo">
                    <span className="estilo-card__titular" style={{ fontFamily: par.titulos }}>Hermandad</span>
                    <span className="estilo-card__linea" />
                    <span className="estilo-card__linea estilo-card__linea--corta" />
                    <span className="estilo-card__boton" />
                  </span>
                </span>
                <span className="estilo-card__pie">
                  <b>{e.nombre}{sel && <span className="estilo-card__marca" aria-hidden="true">✓</span>}</b>
                  <small>{e.descripcion}</small>
                </span>
              </button>
            )
          })}
        </div>
        {!puesto && (
          <p className="form-hint estilo-medida">
            Ahora mismo tienes una combinación <b>a medida</b>. Pulsa un estilo si prefieres volver a
            uno de los preparados.
          </p>
        )}
      </section>

      {/* Todo lo de abajo es opcional: con el estilo de arriba la web ya está.
          Va plegado para que la pantalla no asuste a quien entra por primera vez. */}
      <details className="afinar">
        <summary className="afinar__cabeza">
          <span className="afinar__titulo">Afinar a mano</span>
          <span className="afinar__nota">Plantilla, colores exactos, tipografía, esquinas y aire</span>
        </summary>
        <div className="afinar__cuerpo">
          <div className="afinar__bloque">
            <h3 className="afinar__h">Plantilla</h3>
            <div className="plantillas-grid">
              {PLANTILLAS.map((pl) => (
                <button type="button" key={pl.id} className={`plantilla-card${web.plantilla === pl.id ? ' plantilla-card--sel' : ''}`} onClick={() => editar('plantilla', pl.id as PlantillaWeb)}>
                  <span className={`plantilla-card__mini plantilla-card__mini--${pl.id}`} aria-hidden="true"><span /><span /><span /></span>
                  <b>{pl.nombre}</b><small>{pl.descripcion}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="afinar__bloque">
            <h3 className="afinar__h">Paleta de color</h3>
            <div className="paletas-grid">
              {PALETAS.map((pal) => {
                const puesta = web.colorPrimario.toLowerCase() === pal.primario.toLowerCase()
                  && web.colorSecundario.toLowerCase() === pal.secundario.toLowerCase()
                return (
                  <button
                    type="button"
                    key={pal.id}
                    className={`paleta-card${puesta ? ' paleta-card--sel' : ''}`}
                    onClick={() => editarLote(`paleta:${pal.id}`, { colorPrimario: pal.primario, colorSecundario: pal.secundario })}
                    aria-pressed={puesta}
                  >
                    <span className="paleta-card__muestra">
                      <span style={{ background: pal.primario }} />
                      <span style={{ background: pal.secundario }} />
                    </span>
                    <b>{pal.nombre}</b>
                  </button>
                )
              })}
            </div>

            <div className="form-grid-2" style={{ marginTop: '0.8rem' }}>
              <div className="form-row"><label htmlFor="c1">Color principal</label><input id="c1" type="color" value={web.colorPrimario} onChange={(e) => editar('colorPrimario', e.target.value)} /></div>
              <div className="form-row"><label htmlFor="c2">Color secundario</label><input id="c2" type="color" value={web.colorSecundario} onChange={(e) => editar('colorSecundario', e.target.value)} /></div>
            </div>
            {/* Aviso de legibilidad: eligiendo a mano es facilísimo dejar la web
                ilegible sin darse cuenta, y no se ve hasta que alguien se queja. */}
            {avisosColor.length > 0 ? (
              <ul className="contraste-avisos">
                {avisosColor.map((a) => <li key={a}>{a}</li>)}
              </ul>
            ) : (
              <p className="contraste-ok">✓ Con estos colores se lee bien sobre el fondo {web.tema}.</p>
            )}
          </div>

          <div className="afinar__bloque">
            <h3 className="afinar__h">Tipografía</h3>
            <div className="parejas-grid">
              {PAREJAS_TIPOGRAFICAS.map((par) => (
                <button
                  type="button"
                  key={par.id}
                  className={`pareja-card${web.pareja === par.id ? ' pareja-card--sel' : ''}`}
                  onClick={() => editar('pareja', par.id)}
                  aria-pressed={web.pareja === par.id}
                >
                  <span className="pareja-card__muestra">
                    <span style={{ fontFamily: par.titulos }}>Hermandad</span>
                    <small style={{ fontFamily: par.texto }}>Estación de penitencia</small>
                  </span>
                  <b>{par.nombre}</b>
                  <small>{par.nota}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="afinar__bloque">
            <h3 className="afinar__h">Fondo, esquinas y aire</h3>
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="tema">Fondo</label>
                <select id="tema" value={web.tema} onChange={(e) => editar('tema', e.target.value as TemaWeb)}>
                  <option value="claro">Claro</option>
                  <option value="oscuro">Oscuro</option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="redondeo">Esquinas</label>
                <select id="redondeo" value={web.redondeo} onChange={(e) => editar('redondeo', e.target.value as WebPublica['redondeo'])}>
                  <option value="recto">Rectas (sobrio)</option>
                  <option value="suave">Suaves</option>
                  <option value="redondo">Muy redondeadas</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="densidad">Aire entre secciones</label>
              <select id="densidad" value={web.densidad} onChange={(e) => editar('densidad', e.target.value as WebPublica['densidad'])}>
                <option value="compacta">Compacta (cabe más en pantalla)</option>
                <option value="normal">Normal</option>
                <option value="amplia">Amplia (más elegante)</option>
              </select>
            </div>
          </div>
        </div>
      </details>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Identidad</h2></div>
        <div className="form-row">
          <label>Escudo o logo</label>
          <div className="assign-box__row">
            {web.logoDataUrl && <img src={web.logoDataUrl} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />}
            <label className="btn btn-outline btn-sm">{web.logoDataUrl ? 'Cambiar' : 'Subir logo'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('logoDataUrl', d))} /></label>
            {web.logoDataUrl && <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('logoDataUrl', null)}>Quitar</button>}
          </div>
        </div>
        <div className="form-row"><label htmlFor="titulo">Nombre</label><input id="titulo" type="text" value={web.titulo} onChange={(e) => editar('titulo', e.target.value)} /></div>
        <div className="form-row"><label htmlFor="lema">Lema</label><input id="lema" type="text" value={web.lema} onChange={(e) => editar('lema', e.target.value)} placeholder="Fe, tradición y caridad" /></div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Historia</h2></div>
        <p className="form-hint">
          Se publica como una sección con formato: una entradilla, los párrafos que quieras (con su
          subtítulo) y fotos. Lo que tuvieras escrito antes está en el primer párrafo.
        </p>
        <div className="form-row">
          <label htmlFor="historiaEntradilla">Entradilla</label>
          <input
            id="historiaEntradilla"
            type="text"
            value={web.historia.entradilla}
            onChange={(e) => editar('historia', (h) => ({ ...h, entradilla: e.target.value }))}
            placeholder="Una frase que resuma la historia de la hermandad"
          />
        </div>
        <EditorParrafos
          parrafos={web.historia.parrafos}
          onChange={(parrafos) => editar('historia', (h) => ({ ...h, parrafos }))}
          ayuda="Por ejemplo: «Fundación», «Los titulares», «La sede», «Hoy»."
        />
        <EditorFotos
          fotos={web.historia.fotos}
          onChange={(fotos) => editar('historia', (h) => ({ ...h, fotos: typeof fotos === 'function' ? fotos(h.fotos) : fotos }))}
          onSubir={leerImagen}
          titulo="Fotos de la sección"
        />
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Secciones (orden y visibilidad)</h2></div>
        <ul className="secciones-lista">
          {web.secciones.map((s, i) => (
            <li key={s.tipo} className="seccion-item">
              <label className="checkbox">
                <input type="checkbox" checked={s.visible} onChange={() => toggleSeccion(i)} />
                <span>{SECCIONES_INFO[s.tipo].nombre}</span>
              </label>
              <input
                className="seccion-item__nombre"
                type="text"
                value={s.nombre ?? ''}
                onChange={(e) => renombrarSeccion(i, e.target.value)}
                placeholder={`Se verá como «${SECCIONES_INFO[s.tipo].publico}»`}
                aria-label={`Título a medida para ${SECCIONES_INFO[s.tipo].nombre}`}
              />
              <span className="seccion-item__orden">
                <button type="button" className="icon-btn" onClick={() => moverSeccion(i, -1)} disabled={i === 0}>▲</button>
                <button type="button" className="icon-btn" onClick={() => moverSeccion(i, 1)} disabled={i === web.secciones.length - 1}>▼</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <TitularesTab web={web} editar={editar} />
    </>
  )
}

/* --------------------------- Titulares (en Diseño) --------------------------- */
function TitularesTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  function editarTitular(id: string, c: Partial<Titular>) { editar('titulares', (xs) => xs.map((t) => (t.id === id ? { ...t, ...c } : t))) }
  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Titulares</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => editar('titulares', (xs) => [...xs, { id: nuevoId(), nombre: 'Nuevo titular', fotoDataUrl: null, descripcion: '', autoria: '', parrafos: [] }])}>+ Añadir</button>
        </div>
        {web.titulares.map((t) => (
          <div className="assign-box" key={t.id}>
            <div className="assign-box__row">
              {t.fotoDataUrl && <img src={t.fotoDataUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
              <label className="btn btn-outline btn-sm">{t.fotoDataUrl ? 'Cambiar foto' : 'Foto'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarTitular(t.id, { fotoDataUrl: d }))} /></label>
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" style={{ marginLeft: 'auto' }} onClick={() => editar('titulares', (xs) => xs.filter((x) => x.id !== t.id))}>Quitar titular</button>
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label>Nombre</label>
                <input type="text" value={t.nombre} onChange={(e) => editarTitular(t.id, { nombre: e.target.value })} placeholder="Ntro. Padre Jesús…" />
              </div>
              <div className="form-row">
                <label>Autoría</label>
                <input type="text" value={t.autoria} onChange={(e) => editarTitular(t.id, { autoria: e.target.value })} placeholder="Juan de Mesa, 1620" />
              </div>
            </div>
            <div className="form-row">
              <label>Una línea de presentación</label>
              <input type="text" value={t.descripcion} onChange={(e) => editarTitular(t.id, { descripcion: e.target.value })} placeholder="Sagrada imagen del Señor." />
            </div>
            <EditorParrafos
              parrafos={t.parrafos}
              onChange={(parrafos) => editarTitular(t.id, { parrafos })}
              titulo="Texto de la imagen"
              ayuda="Su historia, restauraciones, la devoción que despierta… Se publica bajo la foto."
            />
          </div>
        ))}
      </section>

    </>
  )
}

/* ------------------------------ Portada ------------------------------ */
function PortadaTab({ web, editar, actualizar }: { web: WebPublica; editar: EditarFn; actualizar: ActualizarFn }) {
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.heroFotos.length) return
    const arr = [...web.heroFotos]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    editar('heroFotos', arr)
  }
  /** Sobre el estado más reciente: al subir varias, cada una llega cuando acaba de comprimirse. */
  function anadir(dataUrl: string) {
    actualizar((actual) => ({ ...actual, heroFotos: [...actual.heroFotos, dataUrl] }))
  }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Fotos de portada</h2>
        <label className="btn btn-primary btn-sm">
          + Añadir fotos
          <input type="file" accept="image/*" multiple hidden onChange={(e) => leerImagenes(e, anadir)} />
        </label>
      </div>
      <p className="form-hint">
        Se van alternando de fondo en la cabecera, una cada cinco segundos, en el orden que pongas
        aquí. La primera es la que se ve al entrar.
      </p>
      {web.heroFotos.length === 0 ? <p className="form-hint">Sin fotos aún. Sube al menos una para la portada.</p> : (
        <div className="galeria-editor">
          {web.heroFotos.map((f, i) => (
            <div className="galeria-editor__item" key={i}>
              <img src={f} alt="" />
              {i === 0 && <span className="galeria-editor__marca">Primera</span>}
              <div className="galeria-editor__acciones">
                <button type="button" className="icon-btn" title="Antes" disabled={i === 0} onClick={() => mover(i, -1)}>◀</button>
                <button type="button" className="icon-btn" title="Después" disabled={i === web.heroFotos.length - 1} onClick={() => mover(i, 1)}>▶</button>
                <label className="icon-btn" title="Cambiar esta foto">
                  ⟳
                  <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('heroFotos', (xs) => xs.map((x, j) => (j === i ? d : x))))} />
                </label>
                <button type="button" className="icon-btn rgpd-borrar" title="Quitar" onClick={() => editar('heroFotos', (xs) => xs.filter((_, j) => j !== i))}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="form-grid-2" style={{ marginTop: '1rem' }}>
        <div className="form-row">
          <label>Altura de la portada</label>
          <select value={web.heroAltura} onChange={(e) => editar('heroAltura', e.target.value as AlturaHero)}>{ALTURAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
        </div>
        <div className="form-row">
          <label>Oscurecido ({web.heroOverlay}%)</label>
          <input type="range" min={0} max={80} value={web.heroOverlay} onChange={(e) => editar('heroOverlay', Number(e.target.value))} />
        </div>
      </div>
      <div className="form-row"><label>Texto del botón de portada</label><input type="text" value={web.heroTextoBoton} onChange={(e) => editar('heroTextoBoton', e.target.value)} placeholder="Portal del hermano" /></div>
    </section>
  )
}

/* ------------------------------- Galería ------------------------------- */
function GaleriaTab({ web, editar, actualizar }: { web: WebPublica; editar: EditarFn; actualizar: ActualizarFn }) {
  function editarAlbum(id: string, c: Partial<AlbumGaleria>) {
    editar('albumes', (xs) => xs.map((a) => (a.id === id ? { ...a, ...c } : a)))
  }
  function moverAlbum(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.albumes.length) return
    const arr = [...web.albumes]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    editar('albumes', arr)
  }
  function moverFoto(album: AlbumGaleria, i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= album.fotos.length) return
    const fotos = [...album.fotos]
    ;[fotos[i], fotos[j]] = [fotos[j], fotos[i]]
    editarAlbum(album.id, { fotos })
  }
  /**
   * Añade la foto al álbum leyendo el estado más reciente: la compresión tarda,
   * y con el objeto capturado en el render se perdían fotos al subir varias
   * seguidas.
   */
  function anadirFoto(albumId: string, dataUrl: string) {
    actualizar((actual) => ({
      ...actual,
      albumes: actual.albumes.map((a) =>
        a.id === albumId ? { ...a, fotos: [...a.fotos, { id: nuevoId(), fotoDataUrl: dataUrl, pie: '' } as FotoGaleria] } : a,
      ),
    }))
  }

  const totalFotos = web.albumes.reduce((n, a) => n + a.fotos.length, 0)
  const [soltandoEn, setSoltandoEn] = useState<string | null>(null)

  // Pegar una captura o una foto del portapapeles va al primer álbum, que es
  // el que se está mirando el 90 % de las veces.
  useEffect(() => {
    function pegar(e: ClipboardEvent) {
      const archivos = [...(e.clipboardData?.files ?? [])]
      const destino = soltandoEn ?? web.albumes[0]?.id
      if (archivos.length === 0 || !destino) return
      e.preventDefault()
      leerArchivos(archivos, (d) => anadirFoto(destino, d))
    }
    window.addEventListener('paste', pegar)
    return () => window.removeEventListener('paste', pegar)
  })

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Galería</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => editar('albumes', (xs) => [...xs, { id: nuevoId(), titulo: 'Nuevo álbum', descripcion: '', fecha: '', fotos: [] }])}
        >
          + Nuevo álbum
        </button>
      </div>
      <p className="form-hint">
        Las fotos van por álbumes («Salida 2026», «Restauración del paso»). En la web cada álbum
        sale con su título y su fecha, y al pulsar una foto se abre a pantalla completa.
        {totalFotos > 0 && ` Ahora mismo: ${totalFotos} ${totalFotos === 1 ? 'foto' : 'fotos'}.`}
      </p>
      {web.albumes.length === 0 && (
        <p className="form-hint">Todavía no hay ningún álbum. Crea el primero con el botón de arriba.</p>
      )}

      {web.albumes.map((a, i) => (
        <div className="assign-box" key={a.id}>
          <div className="assign-box__row">
            <input
              type="text"
              value={a.titulo}
              onChange={(e) => editarAlbum(a.id, { titulo: e.target.value })}
              placeholder="Título del álbum"
              aria-label="Título del álbum"
            />
            <input
              type="text"
              value={a.fecha}
              onChange={(e) => editarAlbum(a.id, { fecha: e.target.value })}
              placeholder="Viernes Santo de 2026"
              aria-label="Cuándo fue"
            />
            <button type="button" className="icon-btn" title="Subir" disabled={i === 0} onClick={() => moverAlbum(i, -1)}>▲</button>
            <button type="button" className="icon-btn" title="Bajar" disabled={i === web.albumes.length - 1} onClick={() => moverAlbum(i, 1)}>▼</button>
            <button
              type="button"
              className="btn btn-ghost btn-sm rgpd-borrar"
              onClick={() => {
                // Un álbum con fotos dentro no se borra de un clic sin más.
                if (a.fotos.length > 0 && !window.confirm(`«${a.titulo || 'Este álbum'}» tiene ${a.fotos.length} ${a.fotos.length === 1 ? 'foto' : 'fotos'}. ¿Seguro que quieres borrarlo?`)) return
                editar('albumes', (xs) => xs.filter((x) => x.id !== a.id))
              }}
            >
              Quitar álbum
            </button>
          </div>
          <div className="form-row">
            <input
              type="text"
              value={a.descripcion}
              onChange={(e) => editarAlbum(a.id, { descripcion: e.target.value })}
              placeholder="Una línea de contexto (opcional)"
              aria-label="Descripción del álbum"
            />
          </div>

          <div className="settings-card__head" style={{ marginTop: '0.4rem' }}>
            <h3 className="settings-card__title" style={{ fontSize: '0.95rem' }}>
              {a.fotos.length === 0 ? 'Sin fotos' : `${a.fotos.length} ${a.fotos.length === 1 ? 'foto' : 'fotos'}`}
            </h3>
            <label className="btn btn-outline btn-sm">
              + Añadir fotos
              {/* `multiple`: se suben las de una salida entera de una vez. */}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => leerImagenes(e, (d) => anadirFoto(a.id, d))}
              />
            </label>
          </div>
          <div
            className={`soltar-fotos${soltandoEn === a.id ? ' soltar-fotos--activa' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setSoltandoEn(a.id) }}
            onDragLeave={() => setSoltandoEn(null)}
            onDrop={(e) => {
              e.preventDefault()
              setSoltandoEn(null)
              leerArchivos([...e.dataTransfer.files], (d) => anadirFoto(a.id, d))
            }}
          >
            Arrastra aquí las fotos, o pégalas con {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+V
          </div>
          {a.fotos.length > 0 && (
            <div className="galeria-editor">
              {a.fotos.map((f, j) => (
                <div className="galeria-editor__item" key={f.id}>
                  <img src={f.fotoDataUrl} alt="" />
                  <input
                    type="text"
                    value={f.pie}
                    onChange={(e) => editarAlbum(a.id, { fotos: a.fotos.map((x) => (x.id === f.id ? { ...x, pie: e.target.value } : x)) })}
                    placeholder="Pie de foto"
                    aria-label="Pie de foto"
                  />
                  <div className="galeria-editor__acciones">
                    <button type="button" className="icon-btn" title="Antes" disabled={j === 0} onClick={() => moverFoto(a, j, -1)}>◀</button>
                    <button type="button" className="icon-btn" title="Después" disabled={j === a.fotos.length - 1} onClick={() => moverFoto(a, j, 1)}>▶</button>
                    <button
                      type="button"
                      className="icon-btn rgpd-borrar"
                      title="Quitar foto"
                      onClick={() => editarAlbum(a.id, { fotos: a.fotos.filter((x) => x.id !== f.id) })}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

/* ------------------------------ Actualidad ------------------------------ */
function ActualidadTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  function editarNoticia(id: string, c: Partial<Noticia>) { editar('noticias', (xs) => xs.map((n) => (n.id === id ? { ...n, ...c } : n))) }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Noticias publicadas en la web</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => editar('noticias', (xs) => [{ id: nuevoId(), titulo: 'Nueva noticia', fecha: fechaHoyLocal(), resumen: '', fotoDataUrl: null, publicada: true }, ...xs])}>+ Nueva noticia</button>
      </div>
      {web.noticias.length === 0 && <p className="form-hint">Aún no hay noticias.</p>}
      {web.noticias.map((n) => (
        <div className="assign-box" key={n.id}>
          <div className="assign-box__row">
            {n.fotoDataUrl && <img src={n.fotoDataUrl} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />}
            <label className="btn btn-outline btn-sm">{n.fotoDataUrl ? 'Cambiar foto' : 'Foto'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarNoticia(n.id, { fotoDataUrl: d }))} /></label>
            <label className="checkbox"><input type="checkbox" checked={n.publicada} onChange={(e) => editarNoticia(n.id, { publicada: e.target.checked })} /><span>{n.publicada ? 'Publicada' : 'Oculta'}</span></label>
          </div>
          <div className="form-grid-2">
            <div className="form-row"><label>Título</label><input type="text" value={n.titulo} onChange={(e) => editarNoticia(n.id, { titulo: e.target.value })} /></div>
            <div className="form-row"><label>Fecha</label><input type="date" value={n.fecha} onChange={(e) => editarNoticia(n.id, { fecha: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <label>Resumen</label>
            <textarea rows={2} value={n.resumen} onChange={(e) => editarNoticia(n.id, { resumen: e.target.value })} />
            {/* En la web sale entero, pero por encima de tres líneas la tarjeta
                se descuadra respecto a las demás. */}
            <p className={`form-hint${n.resumen.length > 220 ? ' form-hint--alerta' : ''}`}>
              {n.resumen.length} caracteres{n.resumen.length > 220 && ' — queda muy largo para la tarjeta de la web'}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('noticias', (xs) => xs.filter((x) => x.id !== n.id))}>Eliminar noticia</button>
        </div>
      ))}
    </section>
  )
}

/* ------------------------------ Cultos ------------------------------ */
function CultosTab({ web, editar, delCalendario }: { web: WebPublica; editar: EditarFn; delCalendario: CultoWeb[] }) {
  function editarCulto(id: string, c: Partial<CultoWeb>) { editar('cultos', (xs) => xs.map((x) => (x.id === id ? { ...x, ...c } : x))) }
  // Copiar a mano un culto que ya está en el calendario lo publica dos veces.
  const enCalendario = new Set(delCalendario.map((c) => c.titulo.trim().toLowerCase()))
  const repetidos = web.cultosDelCalendario
    ? web.cultos.map((c) => c.titulo.trim()).filter((t) => t && enCalendario.has(t.toLowerCase()))
    : []
  return (
    <>
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Del calendario</h2>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={web.cultosDelCalendario}
          onChange={(e) => editar('cultosDelCalendario', e.target.checked)}
        />
        <span>Publicar solos los próximos actos de <Link to="/app/eventos">Eventos y tareas</Link></span>
      </label>
      <p className="form-hint">
        Así se apunta un culto UNA vez y sale en los dos sitios. Salen los cultos, salidas,
        convivencias y actos de caridad que estén por venir; los cabildos y la formación interna
        no se publican.
      </p>
      {web.cultosDelCalendario && (
        delCalendario.length > 0 ? (
          <ul className="secciones-lista" style={{ marginTop: '0.6rem' }}>
            {delCalendario.map((c) => (
              <li className="seccion-item" key={c.id}>
                <span>{c.titulo}</span>
                <span className="table-subtle">{[c.fecha, c.lugar].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="form-hint form-hint--alerta">
            No hay ningún acto próximo en el calendario, así que ahora mismo no añade nada.
          </p>
        )
      )}
    </section>

    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Escritos a mano</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => editar('cultos', (xs) => [...xs, { id: nuevoId(), titulo: 'Nuevo culto', detalle: '', fecha: '', lugar: '', fotoDataUrl: null }])}>+ Añadir culto</button>
      </div>
      {web.cultos.map((c) => (
        <div className="assign-box" key={c.id}>
          <div className="assign-box__row">
            {c.fotoDataUrl && <img src={c.fotoDataUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
            <label className="btn btn-outline btn-sm">
              {c.fotoDataUrl ? 'Cambiar foto' : 'Foto (opcional)'}
              <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarCulto(c.id, { fotoDataUrl: d }))} />
            </label>
            {c.fotoDataUrl && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => editarCulto(c.id, { fotoDataUrl: null })}>Quitar foto</button>
            )}
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" style={{ marginLeft: 'auto' }} onClick={() => editar('cultos', (xs) => xs.filter((x) => x.id !== c.id))}>Quitar culto</button>
          </div>
          <div className="form-row">
            <label>Título</label>
            <input type="text" value={c.titulo} onChange={(e) => editarCulto(c.id, { titulo: e.target.value })} placeholder="Quinario, Función Principal, Besamanos…" />
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label>Cuándo</label>
              <input type="text" value={c.fecha} onChange={(e) => editarCulto(c.id, { fecha: e.target.value })} placeholder="Del 3 al 7 de marzo, 20:30" />
            </div>
            <div className="form-row">
              <label>Dónde</label>
              <input type="text" value={c.lugar} onChange={(e) => editarCulto(c.id, { lugar: e.target.value })} placeholder="Sede canónica" />
            </div>
          </div>
          <div className="form-row">
            <label>Detalle</label>
            <textarea rows={2} value={c.detalle} onChange={(e) => editarCulto(c.id, { detalle: e.target.value })} placeholder="Quién predica, intenciones, avisos…" />
          </div>
        </div>
      ))}
      {repetidos.length > 0 && (
        <p className="form-hint form-hint--alerta">
          {repetidos.length === 1 ? 'Este culto ya está' : 'Estos cultos ya están'} en el calendario y
          saldrá{repetidos.length === 1 ? '' : 'n'} dos veces en la web: {repetidos.join(', ')}.
        </p>
      )}
      {web.cultos.length === 0 && (
        <p className="form-hint">
          Ninguno escrito a mano. Sirven para lo que no está en el calendario: el quinario de todos
          los años, un besamanos con su texto largo…
        </p>
      )}
    </section>
    </>
  )
}

/* --------------------------- Páginas y textos --------------------------- */
function PaginasTab({ web, editar, paginaSel, setPaginaSel }: { web: WebPublica; editar: EditarFn; paginaSel: string | null; setPaginaSel: (id: string | null) => void }) {
  const sel = web.paginas.find((p) => p.id === (paginaSel ?? web.paginas[0]?.id)) ?? null
  function editarPagina(id: string, c: Partial<PaginaWeb>) { editar('paginas', (xs) => xs.map((p) => (p.id === id ? { ...p, ...c } : p))) }
  function moverPagina(id: string, dir: -1 | 1) {
    const i = web.paginas.findIndex((p) => p.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= web.paginas.length) return
    const arr = [...web.paginas]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    editar('paginas', arr)
  }
  function nuevaPagina() {
    const p: PaginaWeb = { id: nuevoId(), icono: '📄', antetitulo: '', titulo: 'Nueva página', entradilla: '', parrafos: [], fotos: [], enMenu: true }
    editar('paginas', (xs) => [...xs, p])
    setPaginaSel(p.id)
  }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Páginas y textos</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={nuevaPagina}>+ Nueva página</button>
      </div>
      <div className="cms-chips">
        {web.paginas.map((p) => (
          <button key={p.id} type="button" className={`chip${sel?.id === p.id ? ' chip--active' : ''}`} onClick={() => setPaginaSel(p.id)}>{p.icono} {p.titulo}</button>
        ))}
      </div>
      {sel && (
        <div className="assign-box" style={{ marginTop: '1rem' }}>
          <div className="form-grid-2">
            <div className="form-row"><label>Icono</label><input type="text" value={sel.icono} onChange={(e) => editarPagina(sel.id, { icono: e.target.value })} placeholder="✝️" /></div>
            <div className="form-row"><label>Antetítulo</label><input type="text" value={sel.antetitulo} onChange={(e) => editarPagina(sel.id, { antetitulo: e.target.value })} /></div>
          </div>
          <div className="form-row"><label>Título de la página</label><input type="text" value={sel.titulo} onChange={(e) => editarPagina(sel.id, { titulo: e.target.value })} /></div>
          <div className="form-row"><label>Entradilla</label><textarea rows={2} value={sel.entradilla} onChange={(e) => editarPagina(sel.id, { entradilla: e.target.value })} /></div>

          <div className="assign-box__row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="checkbox">
              <input type="checkbox" checked={sel.enMenu !== false} onChange={(e) => editarPagina(sel.id, { enMenu: e.target.checked })} />
              <span>Mostrar esta página en la web (y en su menú)</span>
            </label>
            <div className="assign-box__row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moverPagina(sel.id, -1)}>▲ Subir</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moverPagina(sel.id, 1)}>▼ Bajar</button>
            </div>
          </div>

          {/* Mismos editores que la Historia y los titulares: un solo sitio que
              mantener y las mismas posibilidades (reordenar) en todas partes. */}
          <EditorParrafos
            parrafos={sel.parrafos}
            onChange={(parrafos) => editarPagina(sel.id, { parrafos })}
          />
          <EditorFotos
            fotos={sel.fotos}
            onChange={(fotos) => editar('paginas', (ps) => ps.map((p) => (
              p.id === sel.id ? { ...p, fotos: typeof fotos === 'function' ? fotos(p.fotos) : fotos } : p
            )))}
            onSubir={leerImagen}
            titulo="Fotos de la página"
          />

          <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" style={{ marginTop: '0.6rem' }} onClick={() => {
            const conTexto = sel.parrafos.some((x) => x.texto.trim()) || sel.entradilla.trim() || sel.fotos.length > 0
            if (conTexto && !window.confirm(`«${sel.titulo || 'Esta página'}» tiene contenido escrito. ¿Seguro que quieres borrarla?`)) return
            editar('paginas', (xs) => xs.filter((p) => p.id !== sel.id))
            setPaginaSel(null)
          }}>Eliminar página</button>
        </div>
      )}
    </section>
  )
}

/* ------------------------------ Boletines ------------------------------ */
function BoletinesTab({ web, editar, actualizar }: { web: WebPublica; editar: EditarFn; actualizar: ActualizarFn }) {
  const [errorPdf, setErrorPdf] = useState<string | null>(null)

  function editarBoletin(id: string, c: Partial<Boletin>) {
    editar('boletines', (xs) => xs.map((b) => (b.id === id ? { ...b, ...c } : b)))
  }
  /** El PDF llega tarde (hay que leerlo entero): se guarda sobre el estado más reciente. */
  function guardarPdf(id: string, c: Partial<Boletin>) {
    actualizar((actual) => ({ ...actual, boletines: actual.boletines.map((b) => (b.id === id ? { ...b, ...c } : b)) }))
  }
  function subirPdf(e: ChangeEvent<HTMLInputElement>, id: string) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type !== 'application/pdf') {
      setErrorPdf('Eso no es un PDF.')
      return
    }
    if (file.size > MAX_PDF_SUBIDO) {
      // Guardar aquí un boletín de 12 MB revienta el almacenamiento del
      // navegador y se pierde TODA la web. Mejor decirlo antes.
      setErrorPdf(
        `«${file.name}» ocupa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo para subir es ` +
        `${(MAX_PDF_SUBIDO / 1024 / 1024).toFixed(0)} MB. Cuélgalo en la nube de la hermandad y pega aquí la dirección.`,
      )
      return
    }
    setErrorPdf(null)
    const lector = new FileReader()
    lector.onload = () => guardarPdf(id, { pdfDataUrl: String(lector.result), pdfNombre: file.name })
    lector.onerror = () => setErrorPdf('No se pudo leer el archivo.')
    lector.readAsDataURL(file)
  }

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Boletines</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => editar('boletines', (xs) => [{ id: nuevoId(), titulo: 'Nuevo boletín', subtitulo: '', pdfNombre: null, pdfDataUrl: null, pdfUrl: '', portadaDataUrl: null, fecha: '' }, ...xs])}
        >
          + Nuevo boletín
        </button>
      </div>
      <p className="form-hint">
        En la web salen como un expositor, con su portada y un botón de descarga. Puedes
        <b> subir el PDF</b> (hasta {(MAX_PDF_SUBIDO / 1024 / 1024).toFixed(0)} MB) o
        <b> pegar la dirección</b> donde ya esté colgado, que es lo que aguanta de verdad.
      </p>
      {errorPdf && <p className="form-hint form-hint--alerta">{errorPdf}</p>}
      {web.boletines.length === 0 && <p className="form-hint">Aún no hay boletines.</p>}

      {web.boletines.map((b) => {
        const enlaceMal = Boolean(b.pdfUrl.trim()) && !urlSegura(b.pdfUrl)
        const sinArchivo = !b.pdfDataUrl && !urlSegura(b.pdfUrl)
        return (
          <div className="assign-box" key={b.id}>
            <div className="assign-box__row">
              <div className="boletin-portada">
                {b.portadaDataUrl
                  ? <img src={b.portadaDataUrl} alt="" />
                  : <span aria-hidden="true">PDF</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="form-row">
                  <input type="text" value={b.titulo} onChange={(e) => editarBoletin(b.id, { titulo: e.target.value })} placeholder="Título" aria-label="Título del boletín" />
                </div>
                <div className="form-grid-2">
                  <div className="form-row">
                    <input type="text" value={b.fecha} onChange={(e) => editarBoletin(b.id, { fecha: e.target.value })} placeholder="Cuaresma 2026 · nº 34" aria-label="Cuándo" />
                  </div>
                  <div className="form-row">
                    <input type="text" value={b.subtitulo} onChange={(e) => editarBoletin(b.id, { subtitulo: e.target.value })} placeholder="Una línea (opcional)" aria-label="Subtítulo" />
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('boletines', (xs) => xs.filter((x) => x.id !== b.id))}>Quitar</button>
            </div>

            <div className="assign-box__row">
              <label className="btn btn-outline btn-sm">
                {b.portadaDataUrl ? 'Cambiar portada' : 'Portada'}
                <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => guardarPdf(b.id, { portadaDataUrl: d }))} />
              </label>
              {b.portadaDataUrl && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => editarBoletin(b.id, { portadaDataUrl: null })}>Quitar portada</button>
              )}
              <label className="btn btn-outline btn-sm">
                {b.pdfDataUrl ? 'Cambiar PDF' : 'Subir PDF'}
                <input type="file" accept="application/pdf" hidden onChange={(e) => subirPdf(e, b.id)} />
              </label>
              <span className="table-subtle">
                {b.pdfDataUrl ? `✓ ${b.pdfNombre ?? 'PDF subido'}` : 'Sin archivo subido'}
              </span>
              {b.pdfDataUrl && (
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editarBoletin(b.id, { pdfDataUrl: null, pdfNombre: null })}>Quitar PDF</button>
              )}
            </div>

            <div className="form-row">
              <label>O la dirección donde está colgado</label>
              <input
                type="text"
                value={b.pdfUrl}
                onChange={(e) => editarBoletin(b.id, { pdfUrl: e.target.value })}
                placeholder="https://hermandad.es/boletines/cuaresma-2026.pdf"
                aria-invalid={enlaceMal}
              />
              {enlaceMal && <p className="form-hint form-hint--alerta">Esa dirección no vale: tiene que empezar por https://</p>}
              {!enlaceMal && b.pdfDataUrl && b.pdfUrl.trim() && (
                <p className="form-hint">Hay archivo subido y dirección: en la web manda el archivo subido.</p>
              )}
              {sinArchivo && <p className="form-hint">Sin archivo ni dirección, en la web pone «Próximamente» en vez de un botón que no descarga nada.</p>}
            </div>
          </div>
        )
      })}
    </section>
  )
}

/* --------------------------- Al compartir (SEO) --------------------------- */
/**
 * Cómo se ve el enlace pegado en WhatsApp y en los resultados de Google. Es lo
 * primero que ve la gente de la hermandad, y hasta ahora salía vacío o con lo
 * que el navegador pillara.
 */
function CompartirTab({
  web, hermandad, editar, enlace,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  editar: EditarFn
  enlace: string
}) {
  const titulo = web.seo.titulo.trim() || web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
  const descripcion = web.seo.descripcion.trim()
  const imagen = web.seo.imagenDataUrl ?? web.heroFotos[0] ?? null
  const dominio = (() => {
    try { return new URL(enlace).host } catch { return 'tuhermandad.es' }
  })()
  const largoOk = descripcion.length > 0 && descripcion.length <= 160

  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Al compartir el enlace</h2></div>
        <p className="form-hint">
          Así se ve tu web cuando alguien pega el enlace en WhatsApp o la encuentra en Google.
        </p>

        {/* Vista previa de la tarjeta: es lo que convence de rellenarlo. */}
        <div className="compartir-previa">
          <div className="compartir-previa__img">
            {imagen ? <img src={imagen} alt="" /> : <span>Sin imagen</span>}
          </div>
          <div className="compartir-previa__texto">
            <span className="compartir-previa__dominio">{dominio}</span>
            <b>{titulo}</b>
            <p>{descripcion || 'Sin descripción. Aquí saldría el texto que escribas abajo.'}</p>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: '1rem' }}>
          <label htmlFor="seoTitulo">Título</label>
          <input
            id="seoTitulo"
            type="text"
            value={web.seo.titulo}
            onChange={(e) => editar('seo', (x) => ({ ...x, titulo: e.target.value }))}
            placeholder={web.titulo || 'Nombre de la hermandad'}
          />
          <p className="form-hint">Si lo dejas vacío se usa el nombre de la web.</p>
        </div>

        <div className="form-row">
          <label htmlFor="seoDesc">Descripción</label>
          <textarea
            id="seoDesc"
            rows={3}
            value={web.seo.descripcion}
            onChange={(e) => editar('seo', (x) => ({ ...x, descripcion: e.target.value }))}
            placeholder="Hermandad de … Cultos, historia, hermanamiento y estación de penitencia el Viernes Santo."
            aria-invalid={descripcion.length > 160}
          />
          <p className={`form-hint${descripcion.length > 160 ? ' form-hint--alerta' : ''}`}>
            {descripcion.length} de 160 caracteres
            {descripcion.length > 160 && ' — Google cortará el resto.'}
            {!largoOk && descripcion.length === 0 && ' · Dos líneas contando quiénes sois y cuándo salís.'}
          </p>
        </div>

        <div className="form-row">
          <label>Imagen al compartir</label>
          <div className="assign-box__row">
            {web.seo.imagenDataUrl && <img src={web.seo.imagenDataUrl} alt="" style={{ width: 72, height: 40, objectFit: 'cover', borderRadius: 6 }} />}
            <label className="btn btn-outline btn-sm">
              {web.seo.imagenDataUrl ? 'Cambiar' : 'Subir imagen'}
              <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('seo', (x) => ({ ...x, imagenDataUrl: d })))} />
            </label>
            {web.seo.imagenDataUrl && (
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('seo', (x) => ({ ...x, imagenDataUrl: null }))}>Quitar</button>
            )}
          </div>
          <p className="form-hint">
            Sin imagen propia se usa la primera foto de la portada. Se ve mejor apaisada (1200×630).
          </p>
        </div>
      </section>
    </>
  )
}

/* ------------------------------ Contacto ------------------------------ */
function ContactoTab({ web, hermandad, editar }: { web: WebPublica; hermandad: HermandadSettings; editar: EditarFn }) {
  function editarRed(id: string, c: Partial<RedWeb>) { editar('redes', (xs) => xs.map((r) => (r.id === id ? { ...r, ...c } : r))) }
  const direccion = web.direccion || hermandad.direccion
  const mapa = urlMapaIncrustado(web.mapaUrl, direccion)
  // Un enlace que no es de Google Maps no se incrusta a propósito: un iframe a
  // cualquier sitio es un agujero en la web pública.
  const enlaceNoIncrustable = Boolean(web.mapaUrl.trim()) && !esDeGoogleMaps(web.mapaUrl)

  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Dónde estáis y cómo contactar</h2></div>
        <p className="form-hint">Si dejas un campo vacío, se usan los datos de <Link to="/app/configuracion">Configuración</Link>.</p>
        <div className="form-row"><label htmlFor="direccion">Dirección</label><input id="direccion" type="text" value={web.direccion} onChange={(e) => editar('direccion', e.target.value)} placeholder={hermandad.direccion || 'Calle, número, ciudad'} /></div>
        <div className="form-grid-2">
          <div className="form-row"><label htmlFor="telefono">Teléfono</label><input id="telefono" type="text" value={web.telefono} onChange={(e) => editar('telefono', e.target.value)} placeholder={hermandad.telefono || '954 00 00 00'} /></div>
          <div className="form-row"><label htmlFor="email">Correo</label><input id="email" type="email" value={web.email} onChange={(e) => editar('email', e.target.value)} placeholder={hermandad.email || 'secretaria@…'} /></div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Mapa</h2></div>
        <label className="checkbox">
          <input type="checkbox" checked={web.mapaIncrustado} onChange={(e) => editar('mapaIncrustado', e.target.checked)} />
          <span>Enseñar el mapa dentro de la web</span>
        </label>
        <p className="form-hint">
          Con la dirección de arriba ya se dibuja el mapa: no hace falta poner nada más. El enlace
          solo hace falta si quieres apuntar a un sitio concreto de Google Maps.
        </p>
        <div className="form-row">
          <label htmlFor="mapaUrl">Enlace de Google Maps (opcional)</label>
          <input id="mapaUrl" type="text" value={web.mapaUrl} onChange={(e) => editar('mapaUrl', e.target.value)} placeholder="https://maps.app.goo.gl/…" />
        </div>
        {enlaceNoIncrustable && (
          <p className="form-hint form-hint--alerta">
            Ese enlace no es de Google Maps: se publicará como botón «Cómo llegar», pero el mapa
            dibujado se saca de la dirección. Por seguridad no incrustamos páginas de fuera.
          </p>
        )}
        {web.mapaIncrustado && !mapa && !web.mapaUrl.trim() && (
          <p className="form-hint form-hint--alerta">Sin dirección no hay mapa que enseñar.</p>
        )}
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Redes sociales</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => editar('redes', (xs) => [...xs, { id: nuevoId(), tipo: 'Instagram', url: '' }])}>+ Añadir red</button>
        </div>
        {web.redes.length === 0 && <p className="form-hint">Salen en el pie de la web y en la sección de contacto.</p>}
        {web.redes.map((r) => (
          <div className="assign-box__row" key={r.id} style={{ marginTop: '0.5rem' }}>
            <select value={r.tipo} onChange={(e) => editarRed(r.id, { tipo: e.target.value as TipoRed })} aria-label="Red social">{REDES.map((red) => <option key={red} value={red}>{red}</option>)}</select>
            <input type="text" value={r.url} onChange={(e) => editarRed(r.id, { url: e.target.value })} placeholder="https://instagram.com/…" aria-label="Dirección del perfil" />
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('redes', (xs) => xs.filter((x) => x.id !== r.id))}>Quitar</button>
          </div>
        ))}
        <p className="form-hint" style={{ marginTop: '0.8rem' }}>
          El texto del pie y el aviso legal están en <b>Cabecera y pie</b>.
        </p>
      </section>
    </>
  )
}
