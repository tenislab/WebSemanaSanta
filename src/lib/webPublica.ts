import { useCallback, useEffect, useState } from 'react'
import { guardarConAviso, leerPersistido } from './persistencia'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Web pública de la hermandad, creada y personalizada desde la propia app.
 * La hermandad elige una plantilla, ajusta colores, tipografía, portada y qué
 * secciones enseñar (historia, titulares, cultos, galería, actualidad,
 * contacto), y publica la web en /w/<slug>. Incluye un botón «Entrar» que
 * lleva al portal del hermano (/hermano). Todo se guarda en el navegador
 * (localStorage) y, más adelante, en una tabla propia de Supabase.
 */

export type PlantillaWeb = 'clasica' | 'sobria' | 'moderna' | 'revista' | 'cartel'
export type TemaWeb = 'claro' | 'oscuro'
/** Id de tipografía; se resuelve contra TIPOGRAFIAS (ver abajo). */
export type TipografiaWeb = string
export type AlturaHero = 'compacta' | 'media' | 'completa'
export type TipoSeccion =
  | 'historia'
  | 'hazte'
  | 'titulares'
  | 'estacion'
  | 'junta'
  | 'cultos'
  | 'galeria'
  | 'actualidad'
  | 'paginas'
  | 'boletines'
  | 'contacto'
export type TipoRed = 'Instagram' | 'Facebook' | 'X' | 'YouTube' | 'TikTok' | 'Web'

/** Una franja de atención al público («Martes y jueves, de 20:00 a 21:30»). */
export interface FranjaHorario {
  id: string
  dias: string
  horas: string
  /** Para qué es esa franja: «papeletas de sitio», «altas y cuotas»… */
  nota: string
}

/** Lo que hay que saber para hacerse hermano. */
export interface HazteHermano {
  entradilla: string
  /** Requisitos, uno por línea en el editor. */
  requisitos: string[]
  /** Cuota, escrita como se quiera («60 € al año», «5 € al mes»). */
  cuota: string
  /** Los pasos que hay que dar, en orden. */
  pasos: string[]
  /** Texto del botón; vacío = sin botón. */
  textoBoton: string
  /** El botón lleva al área del hermano (donde se pide el alta) o al contacto. */
  alAreaDelHermano: boolean
}

/** Una parada del itinerario, con su hora de paso. */
export interface ParadaItinerario {
  id: string
  /** Calle, plaza o sitio de paso. */
  lugar: string
  /** Hora aproximada («18:40»). Puede ir vacía. */
  hora: string
  /** Marca los momentos grandes: salida, carrera oficial, entrada. */
  destacada: boolean
}

/** La estación de penitencia: el dato más buscado de toda la web. */
export interface EstacionPenitencia {
  /** «Viernes Santo», «Domingo de Ramos»… */
  dia: string
  /** Año de la salida, para que se vea si el dato es de este año. */
  anio: string
  horaSalida: string
  horaEntrada: string
  /** Desde dónde sale (parroquia, capilla…). */
  salidaDesde: string
  /** Nota corta: recomendaciones, dónde verla mejor, qué llevar. */
  nota: string
  itinerario: ParadaItinerario[]
  /**
   * La fecha de verdad (AAAA-MM-DD), para la cuenta atrás de la portada. `dia`
   * es texto libre («Viernes Santo») y no se puede contar hacia atrás con él.
   */
  fechaSalida?: string
}

/** Un cargo de la junta de gobierno. */
export interface MiembroJunta {
  id: string
  cargo: string
  nombre: string
}

export const PLANTILLAS: { id: PlantillaWeb; nombre: string; descripcion: string }[] = [
  { id: 'clasica', nombre: 'Clásica', descripcion: 'Serif, tonos cálidos y aire tradicional cofrade.' },
  { id: 'sobria', nombre: 'Sobria', descripcion: 'Líneas limpias, mucho blanco y tipografía discreta.' },
  { id: 'moderna', nombre: 'Moderna', descripcion: 'Portada a pantalla completa y contraste marcado.' },
  { id: 'revista', nombre: 'Revista', descripcion: 'Como un boletín impreso: columnas, filetes y capitulares.' },
  { id: 'cartel', nombre: 'Cartel', descripcion: 'Titulares enormes centrados, mucho aire, poca caja.' },
]

/**
 * Parejas tipográficas ya combinadas: una fuente para los títulos y otra para
 * el texto. Elegir dos fuentes sueltas que peguen es lo que peor sale cuando
 * uno no es diseñador, y era justo lo que pedía el editor antes.
 */
export interface ParejaTipografica {
  id: string
  nombre: string
  /** Para qué sirve, en cristiano. */
  nota: string
  titulos: string
  texto: string
}

export const PAREJAS_TIPOGRAFICAS: ParejaTipografica[] = [
  {
    id: 'canonica', nombre: 'Canónica', nota: 'La de siempre: seria y sin estridencias.',
    titulos: "'Cinzel', Georgia, serif", texto: "'EB Garamond', Georgia, serif",
  },
  {
    id: 'sevillana', nombre: 'Sevillana', nota: 'Elegante y con carácter, muy de cartel de Semana Santa.',
    titulos: "'Playfair Display', Georgia, serif", texto: "'Lora', Georgia, serif",
  },
  {
    id: 'clasica-legible', nombre: 'Clásica legible', nota: 'Serifas de toda la vida, cómodas de leer en textos largos.',
    titulos: "'Cormorant Garamond', Georgia, serif", texto: "'Merriweather', Georgia, serif",
  },
  {
    id: 'sobria-actual', nombre: 'Sobria actual', nota: 'Título con serifa y texto de palo seco: contraste limpio.',
    titulos: "'Playfair Display', Georgia, serif", texto: "'Lato', system-ui, sans-serif",
  },
  {
    id: 'moderna', nombre: 'Moderna', nota: 'Todo de palo seco. Se ve muy bien en el móvil.',
    titulos: "'Montserrat', system-ui, sans-serif", texto: "'Lato', system-ui, sans-serif",
  },
  {
    id: 'impacto', nombre: 'De impacto', nota: 'Titulares grandes y rotundos. Para webs con mucha foto.',
    titulos: "'Oswald', system-ui, sans-serif", texto: "'Raleway', system-ui, sans-serif",
  },
  {
    id: 'institucional', nombre: 'Institucional', nota: 'Neutra y seria, como una web de la diócesis.',
    titulos: "Georgia, 'Times New Roman', serif", texto: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
]

/**
 * Paletas ya combinadas, con los colores que de verdad se usan en las
 * hermandades. Antes había dos ruedas de color y salían webs fucsia.
 */
export interface PaletaWeb {
  id: string
  nombre: string
  primario: string
  secundario: string
}

export const PALETAS: PaletaWeb[] = [
  { id: 'burdeos', nombre: 'Burdeos y oro', primario: '#6A1A23', secundario: '#C5A059' },
  { id: 'morado', nombre: 'Morado de Cuaresma', primario: '#4A2258', secundario: '#C9A227' },
  { id: 'negro', nombre: 'Negro y plata', primario: '#1F1D1D', secundario: '#A9A9A9' },
  { id: 'verde', nombre: 'Verde esperanza', primario: '#1F5136', secundario: '#D4B24C' },
  { id: 'azul', nombre: 'Azul de la Virgen', primario: '#1E3A5F', secundario: '#C0C7D1' },
  { id: 'granate', nombre: 'Granate y crema', primario: '#7B1E28', secundario: '#E3D3B6' },
  { id: 'carmesi', nombre: 'Carmesí y oro viejo', primario: '#8C2A36', secundario: '#B08D4F' },
  { id: 'sepia', nombre: 'Sepia', primario: '#5C4630', secundario: '#B79A6B' },
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
  hazte: { nombre: 'Hazte hermano', publico: 'Hazte hermano' },
  estacion: { nombre: 'Estación de penitencia', publico: 'Estación de penitencia' },
  junta: { nombre: 'Junta de gobierno', publico: 'Junta de gobierno' },
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
  /**
   * En borrador: se ve en la vista previa del panel, con su marca, pero NO en
   * la web. Sirve para ir escribiendo una sección sin tener que ocultarla
   * entera y sin publicar a medias.
   */
  borrador?: boolean
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
  /**
   * Parte final del enlace de su ficha (…/w/slug/t/<slug>). Se calcula del
   * nombre; se guarda para que el enlace no cambie si luego se retoca.
   */
  slug?: string
  /** Quién hizo la FOTOGRAFÍA. Distinto de `autoria`, que es quien talló la imagen. */
  credito?: string
  /** Qué se ve en la foto, para quien no puede verla. Vacío = el nombre. */
  alt?: string
  /** Más fotos para su ficha: detalles, la restauración, la salida… */
  fotos?: FotoWeb[]
}

/** El enlace propio de la ficha de un titular, ya resuelto. */
export function slugTitular(t: Titular): string {
  return t.slug?.trim() || aSlug(t.nombre) || t.id
}

/** ¿Hay ficha que abrir, o el titular es solo nombre y foto? */
export function titularConFicha(t: Titular): boolean {
  return (
    (t.parrafos ?? []).some((p) => p.texto.trim() || p.subtitulo.trim())
    || (t.fotos ?? []).length > 0
  )
}

export interface FotoGaleria {
  id: string
  fotoDataUrl: string
  pie: string
  /** Quién la hizo. Se publica como «Foto: …» bajo el pie. */
  autor?: string
  /**
   * Copia pequeña para la rejilla. La grande solo se descarga al abrir la foto
   * a pantalla completa. Con treinta fotos de una salida son varios megas que
   * ya no viajan en cada visita. Las de antes no la traen: se usa la grande.
   */
  miniDataUrl?: string
}

/**
 * Lo que ocupa la web guardada, en bytes. Las fotos van dentro del propio
 * contenido (data URL), así que esto ES lo que se descarga cada visita.
 */
export function pesoWeb(web: WebPublica): number {
  return new TextEncoder().encode(JSON.stringify(web)).length
}

/**
 * El peso, contado en cristiano, y si hay que preocuparse.
 *
 * La referencia son 400 kB/s, que es lo que da un móvil con mala cobertura en
 * la puerta de la iglesia el Viernes Santo. Y el navegador solo guarda unos
 * 5 MB: pasado de ahí, la web ni siquiera se puede guardar.
 */
export function avisoDePeso(bytes: number): { peso: string; segundos: number; nivel: 'ok' | 'aviso' | 'malo' } {
  const mb = bytes / (1024 * 1024)
  const peso = mb >= 1 ? `${mb.toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1024)} kB`
  const segundos = Math.round(bytes / 400_000)
  const nivel = bytes > 4 * 1024 * 1024 ? 'malo' : bytes > 1.5 * 1024 * 1024 ? 'aviso' : 'ok'
  return { peso, segundos, nivel }
}

/**
 * Un álbum de la galería («Salida 2026», «Restauración del paso»). Antes la
 * galería era un montón único de fotos sin orden ni contexto: con doce salidas
 * seguidas no había forma de saber qué era cada cosa.
 */
export interface AlbumGaleria {
  id: string
  titulo: string
  /** Una línea de contexto bajo el título. */
  descripcion: string
  /** Texto libre a propósito: «Viernes Santo de 2026», «Cuaresma de 1998». */
  fecha: string
  fotos: FotoGaleria[]
}

export interface CultoWeb {
  id: string
  titulo: string
  detalle: string
  /** Cuándo es, en texto libre («del 3 al 7 de marzo, 20:30»). */
  fecha: string
  lugar: string
  fotoDataUrl: string | null
  /**
   * La fecha de verdad (AAAA-MM-DD), cuando el culto viene del calendario.
   * Con `fecha` a mano no se puede saber cuál es el próximo.
   */
  fechaIso?: string
}

/**
 * Días que faltan para una fecha (AAAA-MM-DD), contando en hora local. Devuelve
 * null si no hay fecha o no se entiende, y negativo si ya pasó.
 *
 * Se comparan los DÍAS, no los milisegundos: a las once de la noche de la
 * víspera tienen que salir «1 día», no «0».
 */
export function diasHasta(iso: string | undefined, hoy = new Date()): number | null {
  if (!iso?.trim()) return null
  const destino = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(destino.getTime())) return null
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((destino.getTime() - desde.getTime()) / 86400000)
}

/** Noticia de la sección Actualidad. */
export interface Noticia {
  id: string
  titulo: string
  fecha: string
  /** Entradilla: lo que se lee en la tarjeta del listado. */
  resumen: string
  fotoDataUrl: string | null
  /** Qué se ve en la foto, para quien no puede verla. Vacío = decorativa. */
  altFoto?: string
  publicada: boolean
  /**
   * El cuerpo de la noticia, con el mismo editor de párrafos que la Historia.
   * Vacío = la noticia es solo un titular con su entradilla, como hasta ahora.
   */
  parrafos?: ParrafoPagina[]
  /** Sale la primera y a lo grande. Solo la primera marcada. */
  destacada?: boolean
  /**
   * Parte final del enlace propio (…/w/slug/n/<slug>). Se calcula del título
   * al crearla; se guarda para que el enlace no cambie si luego se reescribe
   * el titular.
   */
  slug?: string
}

/** El enlace propio de una noticia, ya resuelto (el guardado o el del título). */
export function slugNoticia(n: Noticia): string {
  return n.slug?.trim() || aSlug(n.titulo) || n.id
}

/** Las noticias que se ven en la web, la destacada primero y por fecha. */
export function noticiasPublicadas(noticias: Noticia[]): Noticia[] {
  return noticias
    .filter((n) => n.publicada)
    .sort((a, b) => {
      // La destacada manda sobre la fecha: es la que la hermandad quiere arriba.
      if (Boolean(a.destacada) !== Boolean(b.destacada)) return a.destacada ? -1 : 1
      return (b.fecha || '').localeCompare(a.fecha || '')
    })
}

/**
 * Fotos publicadas sin decir qué se ve en ellas. Quien navega con un lector de
 * pantalla se encuentra un hueco mudo; y una foto sin describir tampoco dice
 * nada cuando falla la conexión y no llega a cargar.
 *
 * No entran las decorativas a propósito: una foto de adorno con el texto al
 * lado se marca vacía y es lo correcto. Lo que se cuenta aquí es lo que SÍ
 * lleva información: titulares, fotos de galería y fotos de noticia.
 */
export function fotosSinDescribir(web: WebPublica): { donde: string; que: string }[] {
  const faltan: { donde: string; que: string }[] = []
  web.titulares.forEach((t) => {
    if (t.fotoDataUrl && !t.alt?.trim()) faltan.push({ donde: 'Titulares', que: t.nombre || 'un titular' })
  })
  web.albumes.forEach((a) => {
    const sinPie = a.fotos.filter((f) => !f.pie.trim()).length
    if (sinPie > 0) faltan.push({ donde: 'Galería', que: `${sinPie} en «${a.titulo || 'un álbum'}»` })
  })
  web.noticias.forEach((n) => {
    if (n.fotoDataUrl && !n.altFoto?.trim()) faltan.push({ donde: 'Actualidad', que: n.titulo || 'una noticia' })
  })
  return faltan
}

/**
 * El texto de la marca de agua sobre las fotos, si la hermandad la ha pedido.
 * Vacío = no se pinta nada.
 */
export function marcaDeAgua(web: WebPublica, nombreHermandad: string): string {
  if (!web.marcaAgua) return ''
  return web.titulo.trim() || nombreHermandad.trim()
}

/** Párrafo de una página de texto (con subtítulo opcional). */
export interface ParrafoPagina {
  id: string
  subtitulo: string
  texto: string
  /**
   * Se publica como cita destacada, grande y sangrada, en vez de como un
   * párrafo más. Es lo que rompe un texto largo y le da respiro.
   */
  destacado?: boolean
}

/**
 * Un bloque de contenido con formato: entradilla, párrafos con subtítulo y
 * fotos. Es lo que usan la Historia y las páginas, para que en la web no haya
 * secciones que sean solo un pegote de texto plano.
 */
/**
 * Una foto de una sección, con lo que se ve en ella para quien no puede verla.
 * Antes era solo la imagen: el texto alternativo iba vacío en toda la web.
 */
export interface FotoWeb {
  url: string
  /** Qué se ve. Vacío = decorativa (el lector de pantalla la salta). */
  alt: string
}

/** Lo guardado por versiones anteriores era una lista de imágenes a secas. */
export function aFotosWeb(guardado: unknown): FotoWeb[] {
  if (!Array.isArray(guardado)) return []
  return guardado
    .map((f) => (typeof f === 'string' ? { url: f, alt: '' } : (f as FotoWeb)))
    .filter((f) => f && typeof f.url === 'string' && f.url.length > 0)
    .map((f) => ({ url: f.url, alt: f.alt ?? '' }))
}

export interface ContenidoRico {
  entradilla: string
  parrafos: ParrafoPagina[]
  fotos: FotoWeb[]
}

export const CONTENIDO_RICO_VACIO: ContenidoRico = { entradilla: '', parrafos: [], fotos: [] }

/** ¿Tiene algo que enseñar este bloque? */
export function contenidoVacio(c: ContenidoRico | undefined): boolean {
  if (!c) return true
  return !c.entradilla.trim() && c.fotos.length === 0 && !c.parrafos.some((p) => p.texto.trim() || p.subtitulo.trim())
}

/**
 * Una cifra de la hermandad para la portada: «1.240 hermanos», «desde 1595»,
 * «3 pasos». Son las tres o cuatro cosas que cuenta cualquier hermandad de sí
 * misma, y en la web no había forma de decirlas.
 */
export interface CifraWeb {
  id: string
  numero: string
  texto: string
}

/** Foto a sangre: parte la página en dos, de borde a borde, con una frase encima. */
export interface FotoSangre {
  fotoDataUrl: string | null
  texto: string
  /** Detrás de qué sección se coloca. Vacío = detrás de la primera. */
  despuesDe: TipoSeccion | ''
}

/** Página de la sección «Páginas y textos» (Titulares, Historia, Junta…). */
export interface PaginaWeb {
  id: string
  icono: string
  antetitulo: string
  titulo: string
  entradilla: string
  parrafos: ParrafoPagina[]
  fotos: FotoWeb[]
  /** Si aparece en el menú de la web (y se publica). Por defecto sí. */
  enMenu?: boolean
}

/** Boletín en PDF: subido (si es pequeño) o enlazado donde ya esté colgado. */
export interface Boletin {
  id: string
  titulo: string
  subtitulo: string
  pdfNombre: string | null
  /**
   * El PDF, de una de estas dos formas:
   *  - `pdfDataUrl`: el archivo subido. Solo para los pequeños: el navegador
   *    guarda unos 5 MB en total y un boletín en color se los come entero.
   *  - `pdfUrl`: la dirección donde ya está colgado (la nube de la hermandad,
   *    Drive, el servidor de la parroquia…). Es lo que aguanta de verdad.
   */
  pdfDataUrl: string | null
  pdfUrl: string
  /** Portada del boletín: la sección se ve como un expositor, no como fichas grises. */
  portadaDataUrl: string | null
  /** Texto libre: «Cuaresma 2026», «nº 34». */
  fecha: string
}

/** Tope del PDF subido, en bytes. Por encima hay que dar la dirección. */
export const MAX_PDF_SUBIDO = 2 * 1024 * 1024

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

/** Lo que se ve al compartir el enlace y en los resultados de búsqueda. */
export interface SeoWeb {
  /** Título de la pestaña y del resultado de Google. Vacío = el de la web. */
  titulo: string
  /** Las dos líneas de descripción. Google corta sobre los 155 caracteres. */
  descripcion: string
  /** La imagen que sale al pegar el enlace en WhatsApp. Vacía = la de portada. */
  imagenDataUrl: string | null
}

export const SEO_INICIAL: SeoWeb = { titulo: '', descripcion: '', imagenDataUrl: null }

/**
 * Un estilo completo: plantilla, colores, tipografía, esquinas, aire y fondo,
 * ya combinados. Es la forma sencilla de montar la web: se pulsa uno y queda
 * hecha. Quien quiera afinar cada pieza, puede, pero no hace falta.
 */
export interface EstiloWeb {
  id: string
  nombre: string
  descripcion: string
  plantilla: PlantillaWeb
  paleta: string
  pareja: string
  tema: TemaWeb
  redondeo: 'recto' | 'suave' | 'redondo'
  densidad: 'compacta' | 'normal' | 'amplia'
  /** Letra capital al empezar cada sección. Solo el estilo «Boletín» la trae. */
  letraCapital?: boolean
}

export const ESTILOS: EstiloWeb[] = [
  {
    id: 'tradicional', nombre: 'Tradicional',
    descripcion: 'Lo que espera ver un hermano de toda la vida: serifas, burdeos y oro.',
    plantilla: 'clasica', paleta: 'burdeos', pareja: 'canonica', tema: 'claro', redondeo: 'suave', densidad: 'normal',
  },
  {
    id: 'cuaresma', nombre: 'Cuaresma',
    descripcion: 'Morado y oro sobre fondo oscuro. Recogido y sobrio.',
    plantilla: 'clasica', paleta: 'morado', pareja: 'sevillana', tema: 'oscuro', redondeo: 'suave', densidad: 'amplia',
  },
  {
    id: 'boletin', nombre: 'Boletín',
    descripcion: 'Como la revista impresa de la hermandad, con columnas y capitulares.',
    plantilla: 'revista', paleta: 'sepia', pareja: 'clasica-legible', tema: 'claro', redondeo: 'recto', densidad: 'normal',
    letraCapital: true,
  },
  {
    id: 'cartel', nombre: 'Cartel',
    descripcion: 'Titulares enormes y mucho aire, como un cartel de Semana Santa.',
    plantilla: 'cartel', paleta: 'negro', pareja: 'impacto', tema: 'oscuro', redondeo: 'redondo', densidad: 'amplia',
  },
  {
    id: 'luminosa', nombre: 'Luminosa',
    descripcion: 'Blanco, aire y letra fina. Se lee de maravilla en el móvil.',
    plantilla: 'sobria', paleta: 'granate', pareja: 'sobria-actual', tema: 'claro', redondeo: 'suave', densidad: 'amplia',
  },
  {
    id: 'moderna', nombre: 'Moderna',
    descripcion: 'Portada a pantalla completa y contraste marcado. Para webs con buenas fotos.',
    plantilla: 'moderna', paleta: 'carmesi', pareja: 'moderna', tema: 'claro', redondeo: 'redondo', densidad: 'normal',
  },
  {
    id: 'esperanza', nombre: 'Esperanza',
    descripcion: 'Verde y oro, la combinación de las hermandades de gloria.',
    plantilla: 'clasica', paleta: 'verde', pareja: 'sevillana', tema: 'claro', redondeo: 'suave', densidad: 'normal',
  },
  {
    id: 'institucional', nombre: 'Institucional',
    descripcion: 'Azul sereno y tipografía neutra. Seria y sin adornos.',
    plantilla: 'sobria', paleta: 'azul', pareja: 'institucional', tema: 'claro', redondeo: 'recto', densidad: 'normal',
  },
]

/** Los cambios que aplica un estilo, listos para volcar sobre la web. */
export function cambiosDeEstilo(estilo: EstiloWeb): Partial<WebPublica> {
  const paleta = PALETAS.find((p) => p.id === estilo.paleta) ?? PALETAS[0]
  return {
    plantilla: estilo.plantilla,
    colorPrimario: paleta.primario,
    colorSecundario: paleta.secundario,
    pareja: estilo.pareja,
    tema: estilo.tema,
    redondeo: estilo.redondeo,
    densidad: estilo.densidad,
    letraCapital: estilo.letraCapital ?? false,
  }
}

/** ¿Qué estilo tiene puesto ahora mismo esta web? Null si está a medio camino. */
export function estiloActual(web: WebPublica): EstiloWeb | null {
  return ESTILOS.find((e) => {
    const c = cambiosDeEstilo(e)
    return c.plantilla === web.plantilla
      && c.colorPrimario?.toLowerCase() === web.colorPrimario.toLowerCase()
      && c.colorSecundario?.toLowerCase() === web.colorSecundario.toLowerCase()
      && c.pareja === web.pareja
      && c.tema === web.tema
      && c.redondeo === web.redondeo
      && c.densidad === web.densidad
      && c.letraCapital === web.letraCapital
  }) ?? null
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
  /** La galería, en álbumes. Antes era una lista suelta de fotos. */
  albumes: AlbumGaleria[]
  noticias: Noticia[]
  paginas: PaginaWeb[]
  boletines: Boletin[]

  /** Qué hay que hacer para ser hermano de esta casa. */
  hazte: HazteHermano
  /** El día grande: salida, itinerario y horas de paso. */
  estacion: EstacionPenitencia
  /** Los cargos de la junta de gobierno. */
  junta: MiembroJunta[]

  // Contacto
  email: string
  telefono: string
  direccion: string
  /** Cuándo se atiende en secretaría. Vacío = no se enseña. */
  horarios: FranjaHorario[]
  /** URL de Google Maps (enlace o embed). */
  mapaUrl: string
  redes: RedWeb[]

  // Cabecera y pie
  cabecera: CabeceraWeb
  pie: PieWeb
  /** Pareja tipográfica (títulos + texto). Ver PAREJAS_TIPOGRAFICAS. */
  pareja: string
  /** Cuánto se redondean tarjetas, botones y fotos. */
  redondeo: 'recto' | 'suave' | 'redondo'
  /** Cuánto aire hay entre secciones. */
  densidad: 'compacta' | 'normal' | 'amplia'
  /** Cómo se ve la web al compartirla y en Google. */
  seo: SeoWeb
  /** Enseña el mapa incrustado en la sección de contacto (además del enlace). */
  mapaIncrustado: boolean
  /**
   * Aviso de derechos bajo las fotos de titulares y galería. Vacío = no se
   * enseña. Muchas hermandades lo piden porque sus fotos acaban circulando.
   */
  avisoFotos: string
  /** Marca de agua discreta con el nombre de la hermandad sobre las fotos. */
  marcaAgua: boolean

  /**
   * En qué lengua está escrita la web. Va en el `lang` de la página: sin él,
   * un lector de pantalla lee el castellano con voz inglesa y no hay quien lo
   * entienda.
   */
  idioma: string
  /**
   * Un resumen en otra lengua bajo la portada, marcado con SU idioma. Muchas
   * hermandades quieren al menos unas líneas en inglés por el turismo, y
   * traducir la web entera no es realista.
   */
  resumenOtroIdioma: { idioma: string; titulo: string; texto: string }

  // ---- Diseño editorial: lo que rompe el «todo centrado, uno detrás de otro» ----
  /** Franjas de fondo alternas por sección: se separan sin necesidad de líneas. */
  fondosAlternos: boolean
  /** Letra capital al arrancar cada sección larga, como en el boletín impreso. */
  letraCapital: boolean
  /** Las secciones entran suavemente al bajar. Respeta «reducir movimiento». */
  animaciones: boolean
  /** Foto a sangre que parte la página en dos. */
  sangre: FotoSangre
  /** Las cifras de la hermandad, para la portada. */
  cifras: CifraWeb[]
  /** Cuenta atrás a la estación de penitencia, en la portada. */
  cuentaAtras: boolean
  /** El próximo culto, destacado en la portada. */
  proximoCulto: boolean
  /**
   * La sección de Cultos saca también los próximos eventos del calendario
   * (módulo de Eventos), sin tener que copiarlos a mano cada vez.
   */
  cultosDelCalendario: boolean

  // Pie
  textoPie: string
}

/** Lenguas que se ofrecen. Las cuatro de España más el inglés del turista. */
export const IDIOMAS: { id: string; nombre: string }[] = [
  { id: 'es', nombre: 'Castellano' },
  { id: 'ca', nombre: 'Català' },
  { id: 'gl', nombre: 'Galego' },
  { id: 'eu', nombre: 'Euskara' },
  { id: 'va', nombre: 'Valencià' },
  { id: 'en', nombre: 'English' },
  { id: 'fr', nombre: 'Français' },
  { id: 'de', nombre: 'Deutsch' },
  { id: 'it', nombre: 'Italiano' },
]

/**
 * Guiones de ejemplo para empezar a escribir. La hermandad que se queda
 * mirando la caja vacía no escribe nada; con un guion delante, corrige. Todo
 * lo que hay aquí está pensado para ser reescrito, no para publicarse tal cual.
 */
export const GUION_HISTORIA: ContenidoRico = {
  entradilla: 'Siglos de devoción en el mismo barrio.',
  parrafos: [
    { id: 'g-h1', subtitulo: 'Fundación', texto: 'Escribe aquí cuándo y por quién se fundó la hermandad, en qué parroquia o convento, y qué se sabe de aquellos primeros años. Si hay una fecha documentada, dila: es lo primero que busca quien entra.' },
    { id: 'g-h2', subtitulo: 'Los siglos difíciles', texto: 'La desamortización, las guerras, los años en que no se salió. Contar lo que costó llegar hasta hoy es lo que hace que una historia se lea.' },
    { id: 'g-h3', subtitulo: 'La reorganización', texto: 'Cuándo se recuperó la hermandad, quién tiró de ella y qué se hizo primero: las imágenes, la casa de hermandad, el paso, los enseres.' },
    { id: 'g-h4', subtitulo: 'Hoy', texto: 'Cuántos hermanos sois, qué cultos organizáis durante el año, qué labor de caridad hacéis y qué día salís en estación de penitencia.' },
  ],
  fotos: [],
}

export const GUION_ESTACION: EstacionPenitencia = {
  dia: 'Viernes Santo',
  anio: String(new Date().getFullYear() + 1),
  horaSalida: '17:30',
  horaEntrada: '01:15',
  salidaDesde: 'Parroquia de …',
  nota: 'Se recomienda llegar con media hora de antelación. El mejor sitio para verla es … Los hermanos de luz deben estar en la casa de hermandad a las …',
  itinerario: [
    { id: 'g-i1', lugar: 'Plaza de la Parroquia', hora: '17:30', destacada: true },
    { id: 'g-i2', lugar: 'Calle Mayor', hora: '17:50', destacada: false },
    { id: 'g-i3', lugar: 'Plaza del Ayuntamiento', hora: '18:40', destacada: true },
    { id: 'g-i4', lugar: 'Calle de la Cruz', hora: '19:30', destacada: false },
    { id: 'g-i5', lugar: 'Catedral (entrada)', hora: '20:15', destacada: true },
    { id: 'g-i6', lugar: 'Regreso por Calle Ancha', hora: '22:00', destacada: false },
    { id: 'g-i7', lugar: 'Parroquia (entrada)', hora: '01:15', destacada: true },
  ],
  fechaSalida: '',
}

export const GUION_PAGINA_CARIDAD = {
  icono: '🤲',
  antetitulo: 'Nuestra labor',
  titulo: 'Bolsa de caridad',
  entradilla: 'Lo que la hermandad hace durante todo el año, no solo el día de la salida.',
  parrafos: [
    { id: 'g-c1', subtitulo: 'A quién ayudamos', texto: 'Explica a qué familias, con qué entidades del barrio colaboráis y desde cuándo.' },
    { id: 'g-c2', subtitulo: 'Cómo colaborar', texto: 'Cómo puede ayudar un hermano o un vecino: aportación mensual, entrega de alimentos, voluntariado, y a quién dirigirse.' },
  ],
  fotos: [],
}

export const CLAVE_WEB_PUBLICA = 'cabildo-web-publica'

export const SECCIONES_POR_DEFECTO: SeccionConfig[] = [
  { tipo: 'historia', visible: true },
  { tipo: 'hazte', visible: true },
  { tipo: 'titulares', visible: true },
  { tipo: 'estacion', visible: true },
  { tipo: 'junta', visible: true },
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
  albumes: [],
  hazte: {
    entradilla: 'Cualquiera puede ser hermano de esta casa. Solo hace falta querer serlo.',
    requisitos: [
      'Estar bautizado',
      'Aceptar las reglas de la hermandad',
      'Los menores, con la firma de padre, madre o tutor',
    ],
    cuota: '60 € al año',
    pasos: [
      'Rellena la solicitud con tus datos',
      'Secretaría la revisa y te avisa',
      'Se te da de alta en el censo con tu número de hermano',
    ],
    textoBoton: 'Quiero hacerme hermano',
    alAreaDelHermano: true,
  },
  // Vacías de fábrica: mientras no se rellenen, la sección no se pinta ni sale
  // en el menú, así que no aparece un enlace que no lleva a ninguna parte.
  estacion: {
    dia: '', anio: '', horaSalida: '', horaEntrada: '', salidaDesde: '', nota: '', itinerario: [],
  },
  junta: [],
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
  horarios: [
    { id: 'hor-1', dias: 'Martes y jueves', horas: 'de 20:00 a 21:30', nota: 'Altas, cuotas y papeletas de sitio' },
  ],
  redes: [],

  textoPie: '',
  cabecera: CABECERA_INICIAL,
  pie: PIE_INICIAL,
  mapaIncrustado: true,
  avisoFotos: '',
  marcaAgua: false,
  idioma: 'es',
  resumenOtroIdioma: { idioma: 'en', titulo: '', texto: '' },
  fondosAlternos: true,
  letraCapital: false,
  animaciones: true,
  sangre: { fotoDataUrl: null, texto: '', despuesDe: '' },
  cifras: [],
  cuentaAtras: true,
  proximoCulto: true,
  cultosDelCalendario: true,
  pareja: 'canonica',
  redondeo: 'suave',
  densidad: 'normal',
  seo: SEO_INICIAL,
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
      fotos: aFotosWeb(c.fotos),
    }
  }
  return { ...WEB_PUBLICA_INICIAL.historia }
}

/** Mezcla lo guardado con los valores por defecto, para que los datos antiguos no pierdan campos nuevos. */
export function conDefectos(guardado: Partial<WebPublica> | null): WebPublica {
  if (!guardado) return WEB_PUBLICA_INICIAL
  // Compatibilidad: si venía con una sola foto de portada (modelo anterior),
  // se pasa al array de fotos.
  const heroFotos =
    guardado.heroFotos && guardado.heroFotos.length
      ? guardado.heroFotos
      : (guardado as { heroFotoDataUrl?: string | null }).heroFotoDataUrl
        ? [(guardado as { heroFotoDataUrl?: string }).heroFotoDataUrl as string]
        : []
  // La galería era una lista suelta de fotos; ahora va por álbumes. Lo que
  // hubiera se conserva, metido en un primer álbum, sin perder ni un pie.
  const sueltas = (guardado as { galeria?: FotoGaleria[] }).galeria
  const albumes: AlbumGaleria[] =
    guardado.albumes && guardado.albumes.length
      ? guardado.albumes
      : sueltas && sueltas.length
        ? [{ id: 'album-1', titulo: 'Galería', descripcion: '', fecha: '', fotos: sueltas }]
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
    seo: { ...SEO_INICIAL, ...(guardado.seo ?? {}) },
    // Objetos nuevos: lo guardado por una versión anterior no los trae.
    sangre: { ...WEB_PUBLICA_INICIAL.sangre, ...(guardado.sangre ?? {}) },
    resumenOtroIdioma: { ...WEB_PUBLICA_INICIAL.resumenOtroIdioma, ...(guardado.resumenOtroIdioma ?? {}) },
    cifras: guardado.cifras ?? [],
    // Se leen como parciales a propósito: lo guardado por una versión anterior
    // NO trae los campos nuevos, aunque el tipo diga que sí.
    titulares: (guardado.titulares ?? WEB_PUBLICA_INICIAL.titulares).map((t: Partial<Titular>) => ({
      id: t.id ?? 'tit',
      nombre: t.nombre ?? '',
      fotoDataUrl: t.fotoDataUrl ?? null,
      descripcion: t.descripcion ?? '',
      autoria: t.autoria ?? '',
      parrafos: t.parrafos ?? [],
      slug: t.slug ?? '',
      credito: t.credito ?? '',
      alt: t.alt ?? '',
      fotos: aFotosWeb(t.fotos),
    })),
    cultos: (guardado.cultos ?? WEB_PUBLICA_INICIAL.cultos).map((c: Partial<CultoWeb>) => ({
      id: c.id ?? 'culto',
      titulo: c.titulo ?? '',
      detalle: c.detalle ?? '',
      fecha: c.fecha ?? '',
      lugar: c.lugar ?? '',
      fotoDataUrl: c.fotoDataUrl ?? null,
    })),
    albumes,
    noticias: guardado.noticias ?? WEB_PUBLICA_INICIAL.noticias,
    paginas: guardado.paginas ?? WEB_PUBLICA_INICIAL.paginas,
    // Los boletines ganaron portada, fecha y el PDF de verdad (subido o enlazado).
    boletines: (guardado.boletines ?? []).map((b: Partial<Boletin>) => ({
      id: b.id ?? 'bol',
      titulo: b.titulo ?? '',
      subtitulo: b.subtitulo ?? '',
      pdfNombre: b.pdfNombre ?? null,
      pdfDataUrl: b.pdfDataUrl ?? null,
      pdfUrl: b.pdfUrl ?? '',
      portadaDataUrl: b.portadaDataUrl ?? null,
      fecha: b.fecha ?? '',
    })),
    redes: guardado.redes ?? [],
  }
}

export function getWebPublica(): WebPublica {
  return conDefectos(leerPersistido<Partial<WebPublica>>(CLAVE_WEB_PUBLICA, WEB_PUBLICA_INICIAL))
}

/**
 * Guarda la web. SIEMPRE en el navegador primero: es lo que se ve al recargar
 * y no puede depender de que la red vaya. Después, si hay base de datos, se
 * sube también, que es de donde la lee la función que sirve el HTML con los
 * datos de la hermandad (ver `api/w.ts`). Si la subida falla, no pasa nada:
 * lo guardado en el navegador sigue ahí y se reintenta al siguiente cambio.
 */
export function saveWebPublica(web: WebPublica) {
  guardarConAviso(CLAVE_WEB_PUBLICA, web)
  subirWebAlServidor(web)
}

/**
 * Sube la web a Supabase para que la pueda leer un servidor. Se traga los
 * errores a propósito: esto es un extra, no el guardado de verdad.
 */
let avisadoDeSubida = false
export async function subirWebAlServidor(web: WebPublica): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false
  try {
    const { error } = await supabase
      .from('web_publica')
      .upsert({ id: 1, slug: web.slug, publicada: web.publicada, datos: web }, { onConflict: 'id' })
    if (error) throw new Error(error.message)
    avisadoDeSubida = false
    return true
  } catch (e) {
    // Se avisa UNA vez. Con la base de datos en pausa (o sin la tabla, que hace
    // falta `supabase/web-publica.sql`) esto falla en cada tecla que se
    // escriba, y la consola se llenaba del mismo error mil veces.
    if (!avisadoDeSubida) {
      avisadoDeSubida = true
      console.warn('La web se ha guardado en este navegador, pero no se ha podido subir:', e)
    }
    return false
  }
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
  // Memorizado: sin esto era una función nueva en cada render, y cualquier
  // efecto que dependiera de ella se disparaba sin parar.
  const setWeb = useCallback((siguiente: WebPublica | ((actual: WebPublica) => WebPublica)) => {
    setWebState((actual) => {
      const valor = typeof siguiente === 'function' ? siguiente(actual) : siguiente
      // Si no cambia nada, no se guarda ni se vuelve a pintar.
      if (valor === actual) return actual
      saveWebPublica(valor)
      return valor
    })
  }, [])

  return [web, setWeb]
}
