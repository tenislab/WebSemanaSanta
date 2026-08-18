import { useEffect, useState } from 'react'
import { guardarConAviso, leerPersistido } from './persistencia'

/**
 * Web pública de la hermandad, creada y personalizada desde la propia app.
 * La hermandad elige una plantilla, ajusta colores, tipografía, portada y qué
 * secciones enseñar (historia, titulares, cultos, galería, actualidad,
 * contacto), y publica la web en /w/<slug>. Incluye un botón «Entrar» que
 * lleva al portal del hermano (/hermano). Todo se guarda en el navegador
 * (localStorage) y, más adelante, en una tabla propia de Supabase.
 */

export type PlantillaWeb = 'clasica' | 'sobria' | 'moderna'
export type TemaWeb = 'claro' | 'oscuro'
/** Id de tipografía; se resuelve contra TIPOGRAFIAS (ver abajo). */
export type TipografiaWeb = string
export type AlturaHero = 'compacta' | 'media' | 'completa'
export type TipoSeccion =
  | 'historia'
  | 'titulares'
  | 'cultos'
  | 'galeria'
  | 'actualidad'
  | 'paginas'
  | 'boletines'
  | 'contacto'
export type TipoRed = 'Instagram' | 'Facebook' | 'X' | 'YouTube' | 'TikTok' | 'Web'

export const PLANTILLAS: { id: PlantillaWeb; nombre: string; descripcion: string }[] = [
  { id: 'clasica', nombre: 'Clásica', descripcion: 'Serif, tonos cálidos y aire tradicional cofrade.' },
  { id: 'sobria', nombre: 'Sobria', descripcion: 'Líneas limpias, mucho blanco y tipografía discreta.' },
  { id: 'moderna', nombre: 'Moderna', descripcion: 'Portada a pantalla completa y contraste marcado.' },
]

export const TIPOGRAFIAS: { id: TipografiaWeb; nombre: string; css: string }[] = [
  { id: 'clasica', nombre: 'Clásica (Georgia)', css: "Georgia, 'Times New Roman', serif" },
  { id: 'elegante', nombre: 'Elegante (Palatino)', css: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
  { id: 'cinzel', nombre: 'Cinzel (cofrade)', css: "'Cinzel', Georgia, serif" },
  { id: 'cormorant', nombre: 'Cormorant Garamond', css: "'Cormorant Garamond', Georgia, serif" },
  { id: 'playfair', nombre: 'Playfair Display', css: "'Playfair Display', Georgia, serif" },
  { id: 'ebgaramond', nombre: 'EB Garamond', css: "'EB Garamond', Georgia, serif" },
  { id: 'merriweather', nombre: 'Merriweather', css: "'Merriweather', Georgia, serif" },
  { id: 'lora', nombre: 'Lora', css: "'Lora', Georgia, serif" },
  { id: 'moderna', nombre: 'Moderna (sistema)', css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: 'montserrat', nombre: 'Montserrat', css: "'Montserrat', system-ui, sans-serif" },
  { id: 'raleway', nombre: 'Raleway', css: "'Raleway', system-ui, sans-serif" },
  { id: 'poppins', nombre: 'Poppins', css: "'Poppins', system-ui, sans-serif" },
  { id: 'lato', nombre: 'Lato', css: "'Lato', system-ui, sans-serif" },
  { id: 'oswald', nombre: 'Oswald (titulares)', css: "'Oswald', system-ui, sans-serif" },
  { id: 'bebas', nombre: 'Bebas Neue (impacto)', css: "'Bebas Neue', system-ui, sans-serif" },
  { id: 'dancing', nombre: 'Dancing Script (caligrafía)', css: "'Dancing Script', cursive" },
]

/**
 * `nombre` es como se llama la sección **en el editor**, con sus aclaraciones
 * («Actualidad (noticias)»); `publico` es como sale **en la web**, limpio. Antes
 * eran dos listas en dos archivos y la coletilla del editor se coló en el menú.
 */
export const SECCIONES_INFO: Record<TipoSeccion, { nombre: string; publico: string }> = {
  historia: { nombre: 'Historia', publico: 'Historia' },
  titulares: { nombre: 'Titulares', publico: 'Titulares' },
  cultos: { nombre: 'Cultos y actos', publico: 'Cultos' },
  galeria: { nombre: 'Galería de fotos', publico: 'Galería' },
  actualidad: { nombre: 'Actualidad (noticias)', publico: 'Actualidad' },
  paginas: { nombre: 'Páginas y textos', publico: 'La Hermandad' },
  boletines: { nombre: 'Boletines', publico: 'Boletines' },
  contacto: { nombre: 'Contacto', publico: 'Contacto' },
}

/** Cómo se titula una sección en la web: el nombre a medida, o el de fábrica. */
export function nombreSeccion(s: SeccionConfig): string {
  return s.nombre?.trim() || SECCIONES_INFO[s.tipo].publico
}

export interface SeccionConfig {
  tipo: TipoSeccion
  visible: boolean
  /** Título a medida para esta sección («Cultos y actos» → «Nuestros cultos»). Vacío = el de fábrica. */
  nombre?: string
}

export interface Titular {
  id: string
  nombre: string
  fotoDataUrl: string | null
  /** Una línea de presentación, bajo el nombre. */
  descripcion: string
  /** Autor y época de la imagen («Juan de Mesa, 1620»). */
  autoria: string
  /** Texto largo: historia de la imagen, restauraciones, devoción… */
  parrafos: ParrafoPagina[]
}

export interface FotoGaleria {
  id: string
  fotoDataUrl: string
  pie: string
}

export interface CultoWeb {
  id: string
  titulo: string
  detalle: string
  /** Cuándo es, en texto libre («del 3 al 7 de marzo, 20:30»). */
  fecha: string
  lugar: string
  fotoDataUrl: string | null
}

/** Noticia de la sección Actualidad. */
export interface Noticia {
  id: string
  titulo: string
  fecha: string
  resumen: string
  fotoDataUrl: string | null
  publicada: boolean
}

/** Párrafo de una página de texto (con subtítulo opcional). */
export interface ParrafoPagina {
  id: string
  subtitulo: string
  texto: string
}

/**
 * Un bloque de contenido con formato: entradilla, párrafos con subtítulo y
 * fotos. Es lo que usan la Historia y las páginas, para que en la web no haya
 * secciones que sean solo un pegote de texto plano.
 */
export interface ContenidoRico {
  entradilla: string
  parrafos: ParrafoPagina[]
  fotos: string[]
}

export const CONTENIDO_RICO_VACIO: ContenidoRico = { entradilla: '', parrafos: [], fotos: [] }

/** ¿Tiene algo que enseñar este bloque? */
export function contenidoVacio(c: ContenidoRico | undefined): boolean {
  if (!c) return true
  return !c.entradilla.trim() && c.fotos.length === 0 && !c.parrafos.some((p) => p.texto.trim() || p.subtitulo.trim())
}

/** Página de la sección «Páginas y textos» (Titulares, Historia, Junta…). */
export interface PaginaWeb {
  id: string
  icono: string
  antetitulo: string
  titulo: string
  entradilla: string
  parrafos: ParrafoPagina[]
  fotos: string[]
  /** Si aparece en el menú de la web (y se publica). Por defecto sí. */
  enMenu?: boolean
}

/** Boletín en PDF (por ahora se guarda el título; el PDF, al conectar almacenamiento). */
export interface Boletin {
  id: string
  titulo: string
  subtitulo: string
  pdfNombre: string | null
}

export interface RedWeb {
  id: string
  tipo: TipoRed
  url: string
}

/** Qué se ve en la barra de arriba de la web y cómo se comporta. */
export interface CabeceraWeb {
  mostrarLogo: boolean
  mostrarNombre: boolean
  /** El lema, junto al nombre (además del que sale en la portada). */
  mostrarLema: boolean
  /** La barra se queda arriba al bajar por la página. */
  fija: boolean
  /** Botón de la derecha; vacío = no se pone ninguno. */
  textoBoton: string
}

export const CABECERA_INICIAL: CabeceraWeb = {
  mostrarLogo: true,
  mostrarNombre: true,
  mostrarLema: false,
  fija: true,
  textoBoton: 'Entrar',
}

export interface EnlacePie {
  id: string
  texto: string
  url: string
}

/** Una columna de enlaces del pie («La hermandad», «Ayuda»…). */
export interface ColumnaPie {
  id: string
  titulo: string
  enlaces: EnlacePie[]
}

/** El pie de la web: columnas de enlaces, datos de contacto, redes y aviso legal. */
export interface PieWeb {
  columnas: ColumnaPie[]
  mostrarContacto: boolean
  mostrarRedes: boolean
  /** Línea pequeña del final (protección de datos, aviso legal…). */
  textoLegal: string
}

export const PIE_INICIAL: PieWeb = {
  columnas: [],
  mostrarContacto: true,
  mostrarRedes: true,
  textoLegal: '',
}

export interface WebPublica {
  publicada: boolean
  plantilla: PlantillaWeb
  /** Parte final del enlace: …/w/<slug> */
  slug: string
  /** Dominio personalizado propio (p. ej. hermandaddetriana.es), si lo han configurado. */
  dominio?: string

  // Marca
  titulo: string
  lema: string
  /** Logo propio de la web; si es null se usa el de la hermandad. */
  logoDataUrl: string | null

  // Diseño
  colorPrimario: string
  colorSecundario: string
  tema: TemaWeb
  tipografia: TipografiaWeb

  // Portada: varias fotos que se alternan de fondo en la cabecera.
  heroFotos: string[]
  /** Oscurecido de la foto de portada, 0–80 (%). */
  heroOverlay: number
  heroAltura: AlturaHero
  heroTextoBoton: string

  // Secciones: orden y visibilidad
  secciones: SeccionConfig[]

  // Contenido
  historia: ContenidoRico
  titulares: Titular[]
  cultos: CultoWeb[]
  galeria: FotoGaleria[]
  noticias: Noticia[]
  paginas: PaginaWeb[]
  boletines: Boletin[]

  // Contacto
  email: string
  telefono: string
  direccion: string
  /** URL de Google Maps (enlace o embed). */
  mapaUrl: string
  redes: RedWeb[]

  // Cabecera y pie
  cabecera: CabeceraWeb
  pie: PieWeb
  /** Enseña el mapa incrustado en la sección de contacto (además del enlace). */
  mapaIncrustado: boolean

  // Pie
  textoPie: string
}

export const CLAVE_WEB_PUBLICA = 'cabildo-web-publica'

export const SECCIONES_POR_DEFECTO: SeccionConfig[] = [
  { tipo: 'historia', visible: true },
  { tipo: 'titulares', visible: true },
  { tipo: 'cultos', visible: true },
  { tipo: 'galeria', visible: true },
  { tipo: 'actualidad', visible: true },
  { tipo: 'paginas', visible: true },
  { tipo: 'boletines', visible: false },
  { tipo: 'contacto', visible: true },
]

export const WEB_PUBLICA_INICIAL: WebPublica = {
  publicada: false,
  plantilla: 'clasica',
  slug: 'mi-hermandad',

  titulo: '',
  lema: 'Fe, tradición y caridad',
  logoDataUrl: null,

  colorPrimario: '#6A1A23',
  colorSecundario: '#C5A059',
  tema: 'claro',
  tipografia: 'clasica',

  heroFotos: [],
  heroOverlay: 55,
  heroAltura: 'media',
  heroTextoBoton: 'Portal del hermano',

  secciones: SECCIONES_POR_DEFECTO,

  historia: {
    entradilla: 'Siglos de devoción en el mismo barrio.',
    parrafos: [
      {
        id: 'his-1',
        subtitulo: 'Fundación',
        texto:
          'Fundada por un grupo de vecinos devotos, nuestra hermandad mantiene viva desde entonces la devoción a sus Sagrados Titulares.',
      },
      {
        id: 'his-2',
        subtitulo: 'Hoy',
        texto:
          'Desde su sede canónica organiza los cultos anuales, la estación de penitencia y una intensa labor de caridad con las familias del barrio.',
      },
    ],
    fotos: [],
  },
  titulares: [
    {
      id: 'tit-1', nombre: 'Ntro. Padre Jesús', fotoDataUrl: null,
      descripcion: 'Sagrada imagen del Señor.', autoria: 'Autor anónimo, siglo XVII', parrafos: [],
    },
    {
      id: 'tit-2', nombre: 'María Santísima', fotoDataUrl: null,
      descripcion: 'Bendita imagen de la Virgen.', autoria: 'Autor anónimo, siglo XVIII', parrafos: [],
    },
  ],
  cultos: [
    {
      id: 'culto-1', titulo: 'Cultos de Cuaresma', detalle: 'Quinario y función principal en la sede canónica.',
      fecha: 'Del 3 al 7 de marzo, 20:30', lugar: 'Sede canónica', fotoDataUrl: null,
    },
    {
      id: 'culto-2', titulo: 'Estación de penitencia', detalle: 'Salida procesional en la tarde del Viernes Santo.',
      fecha: 'Viernes Santo, 17:30', lugar: 'Desde la parroquia', fotoDataUrl: null,
    },
  ],
  galeria: [],
  noticias: [
    { id: 'not-1', titulo: 'Convocatoria de Cabildo General', fecha: '2026-02-02', resumen: 'Por orden del Hermano Mayor se convoca a todos los hermanos al Cabildo General.', fotoDataUrl: null, publicada: true },
  ],
  paginas: [
    {
      id: 'pag-1', icono: '⚜️', antetitulo: 'Quiénes somos', titulo: 'La Hermandad',
      entradilla: 'Una corporación viva, abierta a todo el que quiera formar parte de ella.',
      parrafos: [{ id: 'p-1', subtitulo: 'Junta de gobierno', texto: 'La junta de gobierno, elegida en cabildo por todos los hermanos, dirige la vida de la corporación: cultos, patrimonio, caridad y la estación de penitencia.' }],
      fotos: [],
    },
  ],
  boletines: [],

  email: '',
  telefono: '',
  direccion: '',
  mapaUrl: '',
  redes: [],

  textoPie: '',
  cabecera: CABECERA_INICIAL,
  pie: PIE_INICIAL,
  mapaIncrustado: true,
}

/**
 * URL para incrustar el mapa en la web. Se construye a partir de la dirección
 * (no hace falta ninguna clave de Google) o del enlace de Google Maps que haya
 * pegado la hermandad.
 *
 * Solo se aceptan enlaces de Google Maps: un iframe con una URL cualquiera
 * escrita en el editor sería una puerta abierta en la web pública.
 */
export function urlMapaIncrustado(mapaUrl: string, direccion: string): string | null {
  const enlace = mapaUrl.trim()
  const dir = direccion.trim()

  if (enlace && esDeGoogleMaps(enlace)) {
    // Solo se incrusta tal cual si YA es un enlace para incrustar (el que da
    // Google en «Compartir → Insertar un mapa»). Un enlace corto
    // (maps.app.goo.gl) redirige y Google lo rechaza dentro de un iframe: con
    // dirección se dibuja a partir de ella, que siempre funciona.
    if (/[?&]output=embed\b/.test(enlace) || /\/maps\/embed/.test(enlace)) return enlace
    if (!dir) {
      const sep = enlace.includes('?') ? '&' : '?'
      return `${enlace}${sep}output=embed`
    }
  }
  // Sin clave de Google y sin depender de lo que hayan pegado: la dirección
  // basta para dibujar el mapa.
  return dir ? `https://www.google.com/maps?q=${encodeURIComponent(dir)}&output=embed` : null
}

/**
 * Deja pasar solo enlaces que se pueden publicar sin peligro: http(s), rutas de
 * la propia aplicación y anclas a una sección de la web. Devuelve `undefined`
 * si no vale, y entonces el enlace no se pinta.
 *
 * Una URL escrita en el editor como `javascript:…` se pintaba tal cual en el
 * href y podía ejecutar código a quien visitara la web.
 */
export function urlSegura(url: string | undefined): string | undefined {
  if (!url) return undefined
  const limpia = url.trim()
  if (/^https?:\/\//i.test(limpia)) return limpia
  if (/^\/[^/]/.test(limpia)) return limpia
  // Ancla a una sección de la propia web (#cultos, #pagina-xxx): la usan los
  // enlaces del pie para saltar dentro de la página.
  if (/^#[\w-]+$/.test(limpia)) return limpia
  // Sin esquema («hermandad.es/blog»): se asume https, que es lo que quiso poner.
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(limpia)) return `https://${limpia}`
  return undefined
}

/**
 * ¿Es un enlace de Google Maps? Se comprueba el dominio entero, no que
 * «contenga» google: `google.com.loquesea.net` es de otro y en un iframe sería
 * una puerta abierta en la web pública.
 */
export function esDeGoogleMaps(url: string): boolean {
  let host = ''
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase()
  } catch {
    return false
  }
  if (host === 'maps.app.goo.gl' || host === 'goo.gl') return true
  // google.es, www.google.com, maps.google.co.uk, google.com.mx…
  return /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)
}

/** Convierte un texto en un slug válido para la URL (minúsculas, sin acentos, con guiones). */
export function aSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Acepta tanto el formato nuevo (contenido con formato) como el antiguo (un
 * texto plano) y devuelve siempre el nuevo. Así, al actualizar, nadie pierde
 * la historia que ya tenía escrita.
 */
function aContenidoRico(valor: unknown): ContenidoRico {
  if (typeof valor === 'string') {
    const texto = valor.trim()
    return texto
      ? { entradilla: '', parrafos: [{ id: 'his-migrada', subtitulo: '', texto }], fotos: [] }
      : { ...CONTENIDO_RICO_VACIO }
  }
  if (valor && typeof valor === 'object') {
    const c = valor as Partial<ContenidoRico>
    return {
      entradilla: c.entradilla ?? '',
      parrafos: Array.isArray(c.parrafos) ? c.parrafos : [],
      fotos: Array.isArray(c.fotos) ? c.fotos : [],
    }
  }
  return { ...WEB_PUBLICA_INICIAL.historia }
}

/** Mezcla lo guardado con los valores por defecto, para que los datos antiguos no pierdan campos nuevos. */
function conDefectos(guardado: Partial<WebPublica> | null): WebPublica {
  if (!guardado) return WEB_PUBLICA_INICIAL
  // Compatibilidad: si venía con una sola foto de portada (modelo anterior),
  // se pasa al array de fotos.
  const heroFotos =
    guardado.heroFotos && guardado.heroFotos.length
      ? guardado.heroFotos
      : (guardado as { heroFotoDataUrl?: string | null }).heroFotoDataUrl
        ? [(guardado as { heroFotoDataUrl?: string }).heroFotoDataUrl as string]
        : []
  // Si los datos son antiguos y no traían las secciones nuevas, se completan.
  const secciones = guardado.secciones && guardado.secciones.length ? guardado.secciones : SECCIONES_POR_DEFECTO
  const tiposPresentes = new Set(secciones.map((s) => s.tipo))
  const seccionesCompletas = [
    ...secciones,
    ...SECCIONES_POR_DEFECTO.filter((s) => !tiposPresentes.has(s.tipo)),
  ]
  return {
    ...WEB_PUBLICA_INICIAL,
    ...guardado,
    heroFotos,
    secciones: seccionesCompletas,
    // La Historia era un texto plano; ahora es contenido con formato. Lo que
    // hubiera escrito se conserva, convertido en un primer párrafo.
    historia: aContenidoRico(guardado.historia),
    // Titulares y cultos ganaron campos (autoría, párrafos, fecha, lugar, foto):
    // los que vengan de antes se completan sin perder lo escrito.
    // Cabecera y pie: los que vengan de antes no los traen.
    cabecera: { ...CABECERA_INICIAL, ...(guardado.cabecera ?? {}) },
    pie: { ...PIE_INICIAL, ...(guardado.pie ?? {}) },
    // Se leen como parciales a propósito: lo guardado por una versión anterior
    // NO trae los campos nuevos, aunque el tipo diga que sí.
    titulares: (guardado.titulares ?? WEB_PUBLICA_INICIAL.titulares).map((t: Partial<Titular>) => ({
      id: t.id ?? 'tit',
      nombre: t.nombre ?? '',
      fotoDataUrl: t.fotoDataUrl ?? null,
      descripcion: t.descripcion ?? '',
      autoria: t.autoria ?? '',
      parrafos: t.parrafos ?? [],
    })),
    cultos: (guardado.cultos ?? WEB_PUBLICA_INICIAL.cultos).map((c: Partial<CultoWeb>) => ({
      id: c.id ?? 'culto',
      titulo: c.titulo ?? '',
      detalle: c.detalle ?? '',
      fecha: c.fecha ?? '',
      lugar: c.lugar ?? '',
      fotoDataUrl: c.fotoDataUrl ?? null,
    })),
    galeria: guardado.galeria ?? [],
    noticias: guardado.noticias ?? WEB_PUBLICA_INICIAL.noticias,
    paginas: guardado.paginas ?? WEB_PUBLICA_INICIAL.paginas,
    boletines: guardado.boletines ?? [],
    redes: guardado.redes ?? [],
  }
}

export function getWebPublica(): WebPublica {
  return conDefectos(leerPersistido<Partial<WebPublica>>(CLAVE_WEB_PUBLICA, WEB_PUBLICA_INICIAL))
}

export function saveWebPublica(web: WebPublica) {
  guardarConAviso(CLAVE_WEB_PUBLICA, web)
}

/** Hook con la web pública y un setter que persiste. */
export function useWebPublica(): [WebPublica, (siguiente: WebPublica | ((actual: WebPublica) => WebPublica)) => void] {
  const [web, setWebState] = useState<WebPublica>(() => getWebPublica())

  useEffect(() => {
    function sincronizar() {
      setWebState(getWebPublica())
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  /**
   * Acepta el valor nuevo o una función (valor actual) => valor nuevo. Esta
   * segunda forma es la que hay que usar desde callbacks asíncronos (subir una
   * imagen, comprimirla…): con el objeto capturado se perdían los cambios
   * hechos mientras tanto.
   */
  function setWeb(siguiente: WebPublica | ((actual: WebPublica) => WebPublica)) {
    setWebState((actual) => {
      const valor = typeof siguiente === 'function' ? siguiente(actual) : siguiente
      saveWebPublica(valor)
      return valor
    })
  }

  return [web, setWeb]
}
