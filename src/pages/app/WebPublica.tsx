import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ESTILOS,
  GUION_ESTACION,
  GUION_HISTORIA,
  GUION_PAGINA_CARIDAD,
  IDIOMAS,
  PLANTILLAS,
  SECCIONES_INFO,
  type DonativosWeb,
  type LoteriaWeb,
  PALETAS,
  PAREJAS_TIPOGRAFICAS,
  cambiosDeEstilo,
  estiloActual,
  aSlug,
  avisoDePeso,
  contenidoVacio,
  fotosSinDescribir,
  diasHasta,
  pesoWeb,
  slugNoticia,
  marcaDeAgua,
  slugTitular,
  titularConFicha,
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
  type EstacionPenitencia,
  type EstiloWeb,
  type HazteHermano,
  type MiembroJunta,
  type ParadaItinerario,
  type FotoGaleria,
  type Noticia,
  type PaginaWeb,
  type PlantillaWeb,
  type RedWeb,
  type TipoSeccion,
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
import Drawer from '../../components/Drawer'
import {
  explicarEstado, explicarProblema, limpiarDominio, problemaDelDominio, urlDeComprobacion,
  type EstadoDominio,
} from '../../lib/dominio'
import AvisoFalta from '../../components/AvisoFalta'
import { requisito } from '../../lib/requisitos'
import { cultosDelCalendario } from '../../lib/cultosDelCalendario'
import { getCampana } from '../../lib/campana'
import { baseDeLaWeb, robotsTxt, rutasDeLaWeb, sitemapXml } from '../../lib/seoWeb'
import { EditorParrafos, EditorFotos } from '../../components/EditorContenido'
import { comprimirImagen, leerArchivo } from '../../lib/imagen'
import {
  TIPOS_MENSAJE, actualizarMensajeWeb, borrarMensajeWeb, resumenMensaje, sinLeer, useMensajesWeb,
  type MensajeWeb,
} from '../../lib/mensajesWeb'

/**
 * La copia pequeña para la rejilla de la galería. 520 px de lado basta y sobra
 * para una miniatura, y baja de ~300 kB a ~30 kB por foto: con treinta fotos
 * de una salida son nueve megas que dejan de viajar en cada visita.
 */
function miniatura(dataUrl: string): Promise<string> {
  return comprimirImagen(dataUrl, 520, 0.72)
}

/**
 * Varias imágenes de una tacada. Se leen en serie a propósito: en paralelo, con
 * treinta fotos de una salida, el navegador se queda clavado comprimiendo.
 */
async function leerImagenes(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void, maxLado = 1600) {
  const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith('image/'))
  e.target.value = ''
  for (const file of files) {
    const dataUrl = await leerArchivo(file)
    if (dataUrl) cb(await comprimirImagen(dataUrl, maxLado))
  }
}

/** Las mismas imágenes, pero a partir de archivos sueltos (arrastrar, pegar). */
async function leerArchivos(files: File[], cb: (dataUrl: string) => void) {
  for (const file of files.filter((f) => f.type.startsWith('image/'))) {
    const dataUrl = await leerArchivo(file)
    if (dataUrl) cb(await comprimirImagen(dataUrl))
  }
}

function leerImagen(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void, maxLado = 1600) {
  const file = e.target.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  const lector = new FileReader()
  lector.onload = async () => cb(await comprimirImagen(String(lector.result), maxLado))
  lector.readAsDataURL(file)
  e.target.value = ''
}

/**
 * Fotos que en la web nunca se ven a más de media página (las de una sección,
 * las de un titular, la de una noticia): guardarlas a 1600 px es pagar el
 * doble de peso por píxeles que nadie ve.
 */
function leerImagenMediana(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void) {
  leerImagen(e, cb, 1100)
}

/** La portada se ve a pantalla completa: esa sí necesita píxeles. */
function leerImagenGrande(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void) {
  leerImagen(e, cb, 1920)
}

/**
 * Corta como cortan Google y WhatsApp: por la última palabra entera antes del
 * límite y con puntos suspensivos. Enseñar el texto completo en la vista previa
 * era engañar: la hermandad escribía tres líneas y en Google salía una.
 */
/**
 * Mete una copia justo detrás del original. Duplicar es lo que se hace en una
 * hermandad: la convocatoria de cabildo es la del año pasado con otra fecha, y
 * el quinario, el del año pasado con otros predicadores.
 */
function duplicarEn<T extends { id: string }>(lista: T[], id: string, comoCopia: (x: T) => T): T[] {
  const i = lista.findIndex((x) => x.id === id)
  if (i < 0) return lista
  return [...lista.slice(0, i + 1), comoCopia(lista[i]), ...lista.slice(i + 1)]
}

/** Descarga un texto como archivo, sin pasar por ningún servidor. */
function descargarTexto(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

/** Para buscar: sin acentos ni mayúsculas, que nadie escribe «Galería» con tilde. */
function sinAcentos(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function recortar(texto: string, max: number): string {
  const limpio = texto.trim()
  if (limpio.length <= max) return limpio
  const corte = limpio.slice(0, max)
  const espacio = corte.lastIndexOf(' ')
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[.,;:\s]+$/, '')}…`
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

type Pestana = 'diseno' | 'marco' | 'contacto' | 'compartir' | 'portada' | 'galeria' | 'actualidad' | 'cultos' | 'paginas' | 'boletines' | 'historia' | 'titulares' | 'hazte' | 'estacion' | 'junta' | 'donativos' | 'loteria' | 'buzon'

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
  historia: 'historia',
  titulares: 'titulares',
  hazte: 'hazte',
  estacion: 'estacion',
  junta: 'junta',
  donativos: 'donativos',
  loteria: 'loteria',
}
/**
 * El orden importa: primero lo que da forma a TODA la web (diseño, cabecera y
 * pie, contacto) y después el contenido. «Contacto» estaba la última y casi
 * nadie llegaba a ella: la dirección y las redes se quedaban sin poner.
 */
/**
 * Las secciones del editor, agrupadas. Diez pestañas en una fila se partían en
 * dos y no se sabía dónde estaba nada; en un raíl lateral con grupos se lee de
 * un vistazo y deja el ancho para lo que importa: la vista previa.
 */
/**
 * Por qué palabras se encuentra cada pestaña. Con quince secciones, buscar
 «itinerario» y que salga «Estación de penitencia» ahorra recorrer el raíl
 entero acordándose de dónde estaba cada cosa.
 */
/** Cómo se llama cada campo cuando se lo enseñamos a la hermandad. */
const NOMBRE_CAMPO: Record<string, string> = {
  titulo: 'el nombre', lema: 'el lema', logoDataUrl: 'el escudo',
  colorPrimario: 'el color', colorSecundario: 'el color secundario',
  plantilla: 'la plantilla', pareja: 'la tipografía', tema: 'el fondo',
  redondeo: 'las esquinas', densidad: 'el aire', secciones: 'las secciones',
  historia: 'la historia', titulares: 'los titulares', cultos: 'los cultos',
  albumes: 'la galería', noticias: 'las noticias', paginas: 'las páginas',
  boletines: 'los boletines', hazte: 'hazte hermano', estacion: 'la estación de penitencia',
  junta: 'la junta', horarios: 'el horario', cifras: 'las cifras', sangre: 'la foto a sangre',
  heroFotos: 'la portada', cabecera: 'la cabecera', pie: 'el pie', seo: 'lo que se comparte',
  redes: 'las redes', estilo: 'el estilo',
}

const PALABRAS_PESTANA: Partial<Record<Pestana, string>> = {
  diseno: 'estilo plantilla color colores paleta tipografia fuente secciones orden franjas capitular animacion idioma',
  marco: 'cabecera pie menu logo escudo legal columnas redes',
  portada: 'hero foto principal cuenta atras cifras sangre proximo culto boton',
  titulares: 'imagenes cristo virgen autoria marca agua derechos fotografo',
  estacion: 'itinerario salida horario paso calle viernes santo recorrido',
  hazte: 'alta solicitud requisitos cuota pasos hermano nuevo',
  junta: 'cargos gobierno hermano mayor secretario tesorero',
  historia: 'fundacion sede texto parrafos citas',
  galeria: 'fotos albumes peso imagenes salida',
  actualidad: 'noticias avisos cabildo enlace destacada',
  cultos: 'misa quinario funcion triduo calendario eventos',
  paginas: 'textos informacion caridad bolsa formacion',
  boletines: 'revista pdf descargas',
  contacto: 'direccion telefono correo mapa secretaria horario',
  compartir: 'seo google whatsapp titulo descripcion imagen enlace',
  donativos: 'donativo colabora bizum iban cuenta caridad limosna pasarela tarjeta',
  loteria: 'loteria navidad numero participaciones sorteo reserva',
  buzon: 'mensajes formulario contacto recibidos buzon correo',
}

const GRUPOS_PESTANAS: { titulo: string; items: { id: Pestana; label: string; icono: ReactNode }[] }[] = [
  {
    titulo: 'Aspecto',
    items: [
      { id: 'diseno', label: 'Estilo y secciones', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H13a1.5 1.5 0 0 1 0-3h3.5A4.5 4.5 0 0 0 21 9.5C21 5.9 16.97 3 12 3Z" /><circle cx="7.5" cy="10.5" r="1" fill="currentColor" /><circle cx="12" cy="7.5" r="1" fill="currentColor" /><circle cx="16.5" cy="10.5" r="1" fill="currentColor" /></svg> },
      { id: 'marco', label: 'Cabecera y pie', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 8.5h18M3 16h18" /></svg> },
    ],
  },
  {
    titulo: 'Contenido',
    items: [
      { id: 'portada', label: 'Portada', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 16 5-4 4 3 3-2 6 4" /><circle cx="8.5" cy="9" r="1.3" /></svg> },
      { id: 'titulares', label: 'Titulares', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v18M8 7h8" /><circle cx="12" cy="15" r="3.2" /></svg> },
      { id: 'estacion', label: 'Estación de penitencia', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 20h16" /><path d="M7 20V9l5-5 5 5v11" /><path d="M10.5 20v-4.5h3V20" /></svg> },
      { id: 'hazte', label: 'Hazte hermano', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M18 8v6M15 11h6" /></svg> },
      { id: 'junta', label: 'Junta de gobierno', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="9" r="2.6" /><circle cx="16" cy="9" r="2.6" /><path d="M3 19c0-2.6 2.2-4.4 5-4.4s5 1.8 5 4.4M13 19c0-2.6 1.6-4.4 4-4.4s4 1.8 4 4.4" /></svg> },
      { id: 'historia', label: 'Historia', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5Z" /></svg> },
      { id: 'galeria', label: 'Galería', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M19 8v10a2 2 0 0 1-2 2H7" /></svg> },
      { id: 'actualidad', label: 'Actualidad', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h12v14H5a1 1 0 0 1-1-1V5Z" /><path d="M16 9h3a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2" /><path d="M7 8h6M7 11.5h6M7 15h4" /></svg> },
      { id: 'cultos', label: 'Cultos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v18M8 7h8" /></svg> },
      { id: 'paginas', label: 'Páginas y textos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h4" /></svg> },
      { id: 'boletines', label: 'Boletines', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg> },
      { id: 'donativos', label: 'Donativos', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z" /></svg> },
      { id: 'loteria', label: 'Lotería', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" /><path d="M12 7v10" strokeDasharray="2 2" /></svg> },
    ],
  },
  {
    titulo: 'Datos',
    items: [
      { id: 'contacto', label: 'Contacto y mapa', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg> },
      { id: 'buzon', label: 'Buzón de la web', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></svg> },
      { id: 'compartir', label: 'Al compartir', icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.3M8.2 13.2l7.6 4.3" /></svg> },
    ],
  },
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
  // La cuenta atrás desaparece sola cuando la fecha pasa, y la hermandad no se
  // entera de que hay un dato viejo en su web.
  if (web.estacion.fechaSalida && diasHasta(web.estacion.fechaSalida) !== null && diasHasta(web.estacion.fechaSalida)! < 0) {
    avisos.push({ id: 'salida-pasada', texto: 'La fecha de la salida ya pasó: pon la del año que viene.', pestana: 'estacion' })
  }
  // El peso: las fotos van dentro del propio contenido, así que esto ES lo que
  // se descarga en cada visita.
  const peso = avisoDePeso(pesoWeb(web))
  if (peso.nivel !== 'ok') {
    avisos.push({
      id: 'peso',
      texto: `Tu web pesa ${peso.peso}: unos ${peso.segundos} segundos en un móvil con mala cobertura.`,
      pestana: 'galeria',
    })
  }
  const sinDescribir = fotosSinDescribir(web)
  if (sinDescribir.length > 0) {
    avisos.push({
      id: 'alt',
      texto: `Hay fotos sin describir (${sinDescribir.map((f) => f.donde).filter((v, i, xs) => xs.indexOf(v) === i).join(', ')}): quien no las ve no sabe qué hay.`,
      pestana: sinDescribir[0].donde === 'Galería' ? 'galeria' : sinDescribir[0].donde === 'Actualidad' ? 'actualidad' : 'titulares',
    })
  }
  const enBorrador = web.secciones.filter((s) => s.visible && s.borrador)
  if (enBorrador.length > 0) {
    avisos.push({
      id: 'borrador',
      texto: `${enBorrador.length} ${enBorrador.length === 1 ? 'sección está' : 'secciones están'} en borrador: se ven aquí, pero no en tu web.`,
      pestana: 'diseno',
    })
  }
  if (web.titulares.length === 0) avisos.push({ id: 'titulares', texto: 'No has puesto ningún titular.', pestana: 'diseno' })
  // La sección con más devoción detrás es la que peor sale sin fotos: ahora se
  // publican a lo ancho, y sin imagen se quedan en un párrafo suelto.
  else if (web.titulares.every((t) => !t.fotoDataUrl)) avisos.push({ id: 'titulares-foto', texto: 'Tus titulares no tienen foto.', pestana: 'titulares' })
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
  /**
   * Secciones que todavía no tienen nada. Se marcan con un punto en el raíl:
   * enseña lo que queda por hacer sin echar la bronca por escrito.
   */
  const vacias = useMemo(() => {
    const s = new Set<Pestana>()
    if (web.heroFotos.length === 0) s.add('portada')
    if (!web.albumes.some((a) => a.fotos.length > 0)) s.add('galeria')
    if (web.noticias.length === 0) s.add('actualidad')
    if (web.cultos.length === 0) s.add('cultos')
    if (web.paginas.length === 0) s.add('paginas')
    if (web.titulares.length === 0) s.add('titulares')
    if (!web.estacion.dia.trim() && web.estacion.itinerario.length === 0) s.add('estacion')
    if (web.junta.length === 0) s.add('junta')
    if (contenidoVacio(web.historia)) s.add('historia')
    if (web.boletines.length === 0) s.add('boletines')
    if (!web.donativos.bizum.trim() && !web.donativos.iban.trim() && !web.donativos.enlacePasarela.trim()) s.add('donativos')
    if (!web.loteria.numero.trim()) s.add('loteria')
    if (!(web.direccion || hermandad.direccion) && !(web.telefono || hermandad.telefono)) s.add('contacto')
    if (!web.seo.descripcion.trim()) s.add('compartir')
    if (!web.pie.textoLegal.trim()) s.add('marco')
    return s
  }, [web, hermandad])
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
  /** Qué se deshace: «Deshacer» a secas no dice si vas a perder el color o el texto. */
  const [ultimoCambio, setUltimoCambio] = useState('')

  function apuntar(campo: string, anterior: WebPublica) {
    const h = historial.current
    const ahora = performance.now()
    const seguido = campo === h.ultimoCampo && ahora - h.ultimoMs < 900
    setUltimoCambio(NOMBRE_CAMPO[campo] ?? campo)
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

  const [busca, setBusca] = useState('')
  /** El raíl filtrado por lo que se busque: por el nombre o por sus palabras. */
  const gruposFiltrados = useMemo(() => {
    const q = sinAcentos(busca)
    if (!q) return GRUPOS_PESTANAS
    return GRUPOS_PESTANAS
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) => sinAcentos(it.label).includes(q) || sinAcentos(PALABRAS_PESTANA[it.id] ?? '').includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [busca])

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
          <h1>Tu web</h1>
          <p className="dash-head__lead">Elige un estilo, escribe el contenido y publica. A la derecha la ves cambiar en directo.</p>
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
              title={`Deshacer${ultimoCambio ? ` «${ultimoCambio}»` : ''}${pasos.atras ? ` (${pasos.atras})` : ''} · Ctrl+Z`}
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

      <div className="cms-layout">
        {/* Raíl de secciones. En pantalla estrecha se vuelve una fila que se
            desplaza a lo ancho, sin partirse en dos líneas. */}
        <nav className="cms-rail" aria-label="Secciones de la web">
          <div className="cms-rail__buscar">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar sección…"
              aria-label="Buscar una sección del editor"
              onKeyDown={(e) => {
                // Enter abre la primera que salga: buscar y tener que apuntar
                // con el ratón es media búsqueda.
                if (e.key !== 'Enter') return
                const primera = gruposFiltrados[0]?.items[0]
                if (primera) { setPestana(primera.id); setBusca('') }
              }}
            />
          </div>
          {gruposFiltrados.length === 0 && <p className="cms-rail__vacio">Nada con «{busca}».</p>}
          {gruposFiltrados.map((g) => (
            <div className="cms-rail__grupo" key={g.titulo}>
              <p className="cms-rail__titulo">{g.titulo}</p>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`cms-rail__item${pestana === it.id ? ' cms-rail__item--on' : ''}`}
                  onClick={() => setPestana(it.id)}
                  aria-current={pestana === it.id ? 'true' : undefined}
                >
                  <span className="cms-rail__ic" aria-hidden="true">{it.icono}</span>
                  <span className="cms-rail__label">{it.label}</span>
                  {vacias.has(it.id) && <span className="cms-rail__punto" title="Todavía sin contenido" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="cms-editor">
          {pestana === 'diseno' && (
            <DisenoTab web={web} editar={editar} editarLote={editarLote} copiado={copiado} copiarEnlace={copiarEnlace} />
          )}
          {pestana === 'marco' && <MarcoTab web={web} editar={editar} onFoco={setFocoMarco} />}
          {pestana === 'historia' && <HistoriaTab web={web} editar={editar} />}
          {pestana === 'hazte' && <HazteTab web={web} editar={editar} />}
          {pestana === 'estacion' && <EstacionTab web={web} editar={editar} />}
          {pestana === 'junta' && <JuntaTab web={web} editar={editar} />}
          {pestana === 'titulares' && <TitularesTab web={web} editar={editar} hermandad={hermandad} />}
          {pestana === 'portada' && <PortadaTab web={web} editar={editar} actualizar={actualizar} />}
          {pestana === 'galeria' && <GaleriaTab web={web} editar={editar} actualizar={actualizar} />}
          {pestana === 'actualidad' && <ActualidadTab web={web} editar={editar} />}
          {pestana === 'cultos' && <CultosTab web={web} editar={editar} delCalendario={cultosCalendario} />}
          {pestana === 'paginas' && <PaginasTab web={web} editar={editar} paginaSel={paginaSel} setPaginaSel={setPaginaSel} />}
          {pestana === 'boletines' && <BoletinesTab web={web} editar={editar} actualizar={actualizar} />}
          {pestana === 'donativos' && <DonativosTab web={web} hermandad={hermandad} editar={editar} />}
          {pestana === 'loteria' && <LoteriaTab web={web} editar={editar} />}
          {pestana === 'buzon' && <BuzonWebTab />}
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
  const graves = avisos.filter((a) => a.grave)
  // Se despliega solo si hay algo grave; con detalles sueltos no merece la pena
  // robarle media pantalla al editor. No se congela en el primer render: un
  // aviso grave que aparece después (al borrar la dirección) tiene que salir.
  const [abiertoManual, setAbiertoManual] = useState<boolean | null>(null)
  const abierto = abiertoManual ?? graves.length > 0
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

  return (
    <section className={`cms-avisos${graves.length ? ' cms-avisos--grave' : ''}`}>
      <button
        type="button"
        className="cms-progreso"
        onClick={() => setAbiertoManual(!abierto)}
        aria-expanded={abierto}
      >
        <span className="cms-progreso__pct">{pct} %</span>
        <span
          className="cms-progreso__barra"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Lo que llevas hecho de la web"
        >
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="cms-progreso__texto">
          {graves.length > 0
            ? `${graves.length} ${graves.length === 1 ? 'cosa importante' : 'cosas importantes'} y ${avisos.length - graves.length} ${avisos.length - graves.length === 1 ? 'detalle' : 'detalles'}`
            : `${avisos.length} ${avisos.length === 1 ? 'detalle' : 'detalles'} por rematar`}
        </span>
        <span className="cms-progreso__flecha" aria-hidden="true">{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <ul className="cms-avisos__lista">
          {ordenados.map((a) => (
            <li key={a.id}>
              {a.grave && <span className="cms-avisos__marca" aria-hidden="true">!</span>}
              <span>{a.texto}</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => irA(a.pestana)}>Arreglar</button>
            </li>
          ))}
        </ul>
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
  const problemaDominio = (web.dominio ?? '').trim() ? problemaDelDominio(web.dominio ?? '') : null
  const [estadoDominio, setEstadoDominio] = useState<EstadoDominio>('sinProbar')

  /**
   * Comprueba de verdad si el dominio ya sirve esta web, en vez de fiarse de
   * que lo escribieron bien. Se pide una ruta que la propia aplicación sirve:
   * si contesta, está apuntado; si no contesta, o todavía no ha propagado el
   * DNS o el dominio no existe.
   */
  async function comprobarDominio() {
    const dominio = (web.dominio ?? '').trim()
    if (!dominio) return
    setEstadoDominio('comprobando')
    try {
      const r = await fetch(urlDeComprobacion(dominio), { cache: 'no-store' })
      if (!r.ok) { setEstadoDominio('otroSitio'); return }
      const texto = await r.text()
      // El robots.txt que servimos nombra nuestro sitemap: si está, es el nuestro.
      setEstadoDominio(/sitemap/i.test(texto) ? 'apunta' : 'otroSitio')
    } catch {
      // Un dominio que no existe, o que existe pero no deja consultarlo desde
      // otro origen. Las dos cosas se leen igual desde aquí, así que se cuenta
      // lo único seguro: que no ha contestado.
      setEstadoDominio('noResponde')
    }
  }
  const avisosColor = avisosDeContraste(web.colorPrimario, web.colorSecundario, web.tema)
  // Qué estilo está puesto ahora (null = combinación a medida).
  const puesto = estiloActual(web)

  /** Vuelca un estilo entero de golpe: plantilla, colores, letra, esquinas y aire. */
  function aplicarEstilo(e: EstiloWeb) {
    editarLote(`estilo:${e.id}`, cambiosDeEstilo(e))
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
            // Se limpia lo que peguen: la gente copia la barra de direcciones
            // entera, con https:// y barra final, y eso es lo normal.
            onChange={(e) => editar('dominio', limpiarDominio(e.target.value))}
            placeholder="hermandaddetriana.es"
            aria-invalid={!!problemaDominio}
            aria-describedby={problemaDominio ? 'dominioError' : undefined}
          />
          {problemaDominio && (
            <p id="dominioError" className="aviso-falta__error-suelto">{explicarProblema(problemaDominio)}</p>
          )}
          {/* Comprobar de verdad que apunta aquí, en vez de fiarse de que lo
              escribieron bien: es lo único que despeja la duda de «¿ya está?». */}
          {conDominioPropio && (web.dominio ?? '').trim() !== '' && !problemaDominio && (
            <div className="dominio-check">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={estadoDominio === 'comprobando'}
                onClick={comprobarDominio}
              >
                {estadoDominio === 'comprobando' ? 'Comprobando…' : 'Comprobar si ya apunta aquí'}
              </button>
              {estadoDominio !== 'sinProbar' && estadoDominio !== 'comprobando' && (
                <p className={estadoDominio === 'apunta' ? 'form-hint form-hint--ok' : 'form-hint'}>
                  {estadoDominio === 'apunta' ? '✓ ' : ''}
                  {explicarEstado(estadoDominio, web.dominio ?? '')}
                </p>
              )}
              {/* Esto estaba dentro de dos desplegables cerrados, o sea que no
                  lo leía nadie, y es LA pega que se lleva todo el mundo. */}
              <p className="form-hint">
                <b>Acordaos del www.</b> Media España lo escribe. Añadid los dos en Vercel
                (<code>{web.dominio}</code> y <code>www.{web.dominio}</code>) y que uno redirija al
                otro; si no, quien escriba el www no llegará.
              </p>
            </div>
          )}
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
              Ojo con el <code>www</code>: media España lo escribe. En Vercel añadid los dos
              (<b>hermandaddetriana.es</b> y <b>www.hermandaddetriana.es</b>) y decidle que uno
              redirija al otro; si no, quien escriba el <code>www</code> no llegará.
            </p>
            <p style={{ marginTop: '0.4rem' }}>
              El certificado HTTPS lo emite Vercel solo, sin que tengáis que hacer nada.
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

          <div className="afinar__bloque">
            <h3 className="afinar__h">Ritmo de la página</h3>
            <p className="form-hint">
              Lo que evita que la web sea una columna de texto centrado, una sección detrás de otra.
            </p>
            <label className="checkbox">
              <input type="checkbox" checked={web.fondosAlternos} onChange={(e) => editar('fondosAlternos', e.target.checked)} />
              <span>Franjas de fondo alternas, para que las secciones se separen solas</span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={web.letraCapital} onChange={(e) => editar('letraCapital', e.target.checked)} />
              <span>Letra capital al empezar cada sección, como en el boletín impreso</span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={web.animaciones} onChange={(e) => editar('animaciones', e.target.checked)} />
              <span>Los bloques entran suavemente al bajar</span>
            </label>
            <p className="form-hint">
              A quien tenga puesto «reducir movimiento» en su móvil u ordenador no se le anima nada,
              lo marques o no.
            </p>
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
        <div className="settings-card__head">
          <h2 className="settings-card__title">Secciones (orden y visibilidad)</h2>
          {web.secciones.some((s) => s.visible && s.borrador) && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => editarLote('secciones', { secciones: web.secciones.map((s) => ({ ...s, borrador: false })) })}
            >
              Publicar los borradores
            </button>
          )}
        </div>
        <ul className="secciones-lista">
          {web.secciones.map((s, i) => (
            <li key={s.tipo} className="seccion-item">
              <span className="seccion-item__nom">
                {SECCIONES_INFO[s.tipo].nombre}
                {s.visible && s.borrador && <span className="cms-borrador">Borrador</span>}
              </span>
              {/* Tres estados en vez de un interruptor: publicada, en borrador
                  (se ve aquí pero no en la web) y oculta del todo. */}
              <select
                className="seccion-item__estado"
                value={!s.visible ? 'oculta' : s.borrador ? 'borrador' : 'publicada'}
                onChange={(e) => {
                  const v = e.target.value
                  editar('secciones', (xs) => xs.map((x, j) => (
                    j !== i ? x : { ...x, visible: v !== 'oculta', borrador: v === 'borrador' }
                  )))
                }}
                aria-label={`Estado de ${SECCIONES_INFO[s.tipo].nombre}`}
              >
                <option value="publicada">Publicada</option>
                <option value="borrador">En borrador</option>
                <option value="oculta">Oculta</option>
              </select>
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

    </>
  )
}

/* ----------------------------- Hazte hermano ----------------------------- */
/** Una lista de líneas sueltas (requisitos, pasos) se edita como un textarea. */
function lineas(texto: string): string[] {
  return texto.split('\n').map((l) => l.trim()).filter(Boolean)
}

function HazteTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  const h = web.hazte
  function set(c: Partial<HazteHermano>) { editar('hazte', { ...h, ...c }) }
  return (
    <section className="settings-card">
      <div className="settings-card__head"><h2 className="settings-card__title">Hazte hermano</h2></div>
      <p className="form-hint">
        Lo que más se busca en la web de una hermandad después de los cultos. Si está claro qué hace
        falta y cuánto cuesta, la gente se anima; si hay que llamar para enterarse, no llama.
      </p>
      <div className="form-row">
        <label htmlFor="hazteEntradilla">Frase de entrada</label>
        <input
          id="hazteEntradilla" type="text" value={h.entradilla}
          onChange={(e) => set({ entradilla: e.target.value })}
          placeholder="Cualquiera puede ser hermano de esta casa."
        />
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="hazteReq">Qué hace falta</label>
          <textarea
            id="hazteReq" rows={5} value={h.requisitos.join('\n')}
            onChange={(e) => set({ requisitos: lineas(e.target.value) })}
            placeholder={'Estar bautizado\nAceptar las reglas\nLos menores, con firma del tutor'}
          />
          <p className="form-hint">Uno por línea.</p>
        </div>
        <div className="form-row">
          <label htmlFor="haztedPasos">Cómo se hace</label>
          <textarea
            id="haztedPasos" rows={5} value={h.pasos.join('\n')}
            onChange={(e) => set({ pasos: lineas(e.target.value) })}
            placeholder={'Rellena la solicitud\nSecretaría la revisa\nSe te da de alta en el censo'}
          />
          <p className="form-hint">Uno por línea. Salen numerados en orden.</p>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="hazteCuota">La cuota</label>
        <input
          id="hazteCuota" type="text" value={h.cuota}
          onChange={(e) => set({ cuota: e.target.value })}
          placeholder="60 € al año"
        />
      </div>
      <div className="form-row">
        <label htmlFor="hazteBoton">Texto del botón</label>
        <input
          id="hazteBoton" type="text" value={h.textoBoton}
          onChange={(e) => set({ textoBoton: e.target.value })}
          placeholder="Quiero hacerme hermano (vacío = sin botón)"
        />
      </div>
      <label className="checkbox">
        <input
          type="checkbox" checked={web.altaDesdeWeb}
          onChange={(e) => editar('altaDesdeWeb', e.target.checked)}
        />
        <span>
          El botón abre el formulario de alta <b>en la propia web</b>. La solicitud llega a
          Hermanos → Solicitudes de alta, igual que las del área del hermano.
        </span>
      </label>
      {!web.altaDesdeWeb && (
        <label className="checkbox">
          <input type="checkbox" checked={h.alAreaDelHermano} onChange={(e) => set({ alAreaDelHermano: e.target.checked })} />
          <span>
            El botón lleva al área del hermano, donde se pide el alta.
            {!h.alAreaDelHermano && ' Ahora lleva a la sección de contacto.'}
          </span>
        </label>
      )}
    </section>
  )
}

/* -------------------------------- Donativos -------------------------------- */
function DonativosTab({ web, hermandad, editar }: { web: WebPublica; hermandad: HermandadSettings; editar: EditarFn }) {
  const d = web.donativos
  function set(c: Partial<DonativosWeb>) { editar('donativos', { ...d, ...c }) }
  const bizumEfectivo = d.bizum.trim() || hermandad.bizumTelefono
  const ibanEfectivo = d.iban.trim() || hermandad.iban
  return (
    <section className="settings-card">
      <div className="settings-card__head"><h2 className="settings-card__title">Donativos y colaboración</h2></div>
      <p className="form-hint">
        Quien entra en la web y quiere ayudar tiene que poder hacerlo en ese momento. Con el Bizum y
        la cuenta a la vista, y el concepto ya escrito, la tesorería sabe de quién es cada ingreso.
      </p>
      {!bizumEfectivo && !ibanEfectivo && !d.enlacePasarela.trim() && (
        <div className="banner-inline banner-inline--warn">
          Sin Bizum, cuenta ni pasarela, esta sección no se publica: no habría por dónde donar.
        </div>
      )}
      <div className="form-row">
        <label htmlFor="donEntradilla">Frase de entrada</label>
        <input
          id="donEntradilla" type="text" value={d.entradilla}
          onChange={(e) => set({ entradilla: e.target.value })}
          placeholder="Tu ayuda sostiene la caridad de esta casa."
        />
      </div>
      <div className="form-row">
        <label htmlFor="donTexto">Explicación</label>
        <textarea
          id="donTexto" rows={4} value={d.texto}
          onChange={(e) => set({ texto: e.target.value })}
          placeholder="Cuenta a qué se dedica lo que se recauda. Lo concreto convence: «con 20 € se cubre una semana de la bolsa de caridad»."
        />
      </div>
      <div className="form-row">
        <label htmlFor="donCausas">A qué se puede destinar</label>
        <textarea
          id="donCausas" rows={4} value={d.causas.join('\n')}
          onChange={(e) => set({ causas: lineas(e.target.value) })}
          placeholder={'Bolsa de caridad\nRestauración del palio\nObras de la casa de hermandad'}
        />
        <p className="form-hint">Una por línea. Quien done podrá elegir a cuál va lo suyo.</p>
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="donBizum">Bizum para donativos</label>
          <input
            id="donBizum" type="text" value={d.bizum}
            onChange={(e) => set({ bizum: e.target.value })}
            placeholder={hermandad.bizumTelefono || 'Teléfono del Bizum'}
          />
          <p className="form-hint">
            {hermandad.bizumTelefono && !d.bizum.trim()
              ? `Vacío = se usa el de la hermandad (${hermandad.bizumTelefono}).`
              : 'Vacío = se usa el de la hermandad, si lo hay en Configuración.'}
          </p>
        </div>
        <div className="form-row">
          <label htmlFor="donIban">Cuenta para donativos</label>
          <input
            id="donIban" type="text" value={d.iban}
            onChange={(e) => set({ iban: e.target.value })}
            placeholder={hermandad.iban || 'ES00 0000 0000 0000 0000 0000'}
          />
          <p className="form-hint">Vacío = la cuenta de la hermandad.</p>
        </div>
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="donConcepto">Qué poner en el concepto</label>
          <input
            id="donConcepto" type="text" value={d.concepto}
            onChange={(e) => set({ concepto: e.target.value })}
            placeholder="Donativo + tu nombre"
          />
        </div>
        <div className="form-row">
          <label htmlFor="donImportes">Importes sugeridos</label>
          <input
            id="donImportes" type="text" value={d.importes.join(', ')}
            onChange={(e) => set({
              importes: e.target.value
                .split(/[,\s]+/)
                .map((x) => Number(x.replace(',', '.')))
                .filter((n) => Number.isFinite(n) && n > 0),
            })}
            placeholder="10, 20, 50"
          />
          <p className="form-hint">Separados por comas. Salen como botones para no dejar la casilla en blanco.</p>
        </div>
      </div>
      <details className="afinar">
        <summary>
          <span className="afinar__titulo">Cobrar con tarjeta desde la web</span>
          <span className="afinar__nota">{d.enlacePasarela.trim() ? 'Pasarela conectada' : 'Sin pasarela'}</span>
        </summary>
        <AvisoFalta requisito={requisito('pasarela', { web })} />
        <p className="form-hint">
          Si contratáis una pasarela (con vuestro banco, Stripe, PayPal…), pegad aquí el enlace de
          pago que os den y el botón de la web lleva a ella. Sin pasarela, la web enseña el Bizum y
          la cuenta, que es como se hace hoy por teléfono pero sin llamar. El aviso de arriba solo lo
          veis vosotros: en la web pública no sale.
        </p>
        <div className="form-row">
          <label htmlFor="donPasarela">Enlace de pago</label>
          <input
            id="donPasarela" type="url" value={d.enlacePasarela}
            onChange={(e) => set({ enlacePasarela: e.target.value.trim() })}
            placeholder="https://…"
          />
        </div>
        <div className="form-row">
          <label htmlFor="donPasarelaTxt">Texto del botón</label>
          <input
            id="donPasarelaTxt" type="text" value={d.textoPasarela}
            onChange={(e) => set({ textoPasarela: e.target.value })}
            placeholder="Donar ahora"
          />
        </div>
      </details>
      <label className="checkbox">
        <input type="checkbox" checked={d.avisoDonativo} onChange={(e) => set({ avisoDonativo: e.target.checked })} />
        <span>
          Dejar avisar del donativo desde la web. Llega al <b>buzón de la web</b> con el importe y a
          qué lo destina, y la tesorería lo cuadra con el ingreso.
        </span>
      </label>
    </section>
  )
}

/* --------------------------------- Lotería --------------------------------- */
function LoteriaTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  const l = web.loteria
  function set(c: Partial<LoteriaWeb>) { editar('loteria', { ...l, ...c }) }
  return (
    <section className="settings-card">
      <div className="settings-card__head"><h2 className="settings-card__title">Lotería</h2></div>
      <p className="form-hint">
        La lotería se vende en la casa de hermandad y en horario de secretaría, que es cuando media
        hermandad trabaja. Desde la web al menos se reserva: vosotros apartáis las participaciones y
        avisáis para recogerlas.
      </p>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="lotSorteo">Sorteo</label>
          <input
            id="lotSorteo" type="text" value={l.sorteo}
            onChange={(e) => set({ sorteo: e.target.value })}
            placeholder="Navidad 2026"
          />
        </div>
        <div className="form-row">
          <label htmlFor="lotNumero">Número</label>
          <input
            id="lotNumero" type="text" value={l.numero}
            onChange={(e) => set({ numero: e.target.value })}
            placeholder="24.681"
          />
          <p className="form-hint">Sin número ni sorteo, la sección no se publica.</p>
        </div>
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="lotJuega">Juega (€ por participación)</label>
          <input
            id="lotJuega" type="number" min="0" step="0.5" value={l.juega || ''}
            onChange={(e) => set({ juega: Number(e.target.value) || 0 })}
            placeholder="4"
          />
        </div>
        <div className="form-row">
          <label htmlFor="lotPrecio">Precio de la participación (€)</label>
          <input
            id="lotPrecio" type="number" min="0" step="0.5" value={l.precio || ''}
            onChange={(e) => set({ precio: Number(e.target.value) || 0 })}
            placeholder="5"
          />
          <p className="form-hint">
            {l.precio > l.juega && l.juega > 0
              ? `Donativo de ${(l.precio - l.juega).toFixed(2)} € por participación.`
              : 'Lo jugado más el donativo de la hermandad.'}
          </p>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="lotTexto">Explicación</label>
        <textarea
          id="lotTexto" rows={3} value={l.texto}
          onChange={(e) => set({ texto: e.target.value })}
          placeholder="Como cada año, la hermandad juega su número. Lo que se recauda va a…"
        />
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="lotDestino">El donativo va a</label>
          <input
            id="lotDestino" type="text" value={l.destinoDonativo}
            onChange={(e) => set({ destinoDonativo: e.target.value })}
            placeholder="La bolsa de caridad"
          />
        </div>
        <div className="form-row">
          <label htmlFor="lotDonde">Dónde se recoge</label>
          <input
            id="lotDonde" type="text" value={l.dondeRecoger}
            onChange={(e) => set({ dondeRecoger: e.target.value })}
            placeholder="La casa de hermandad, martes y jueves de 20:00 a 21:30"
          />
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="lotMax">Máximo por persona</label>
        <input
          id="lotMax" type="number" min="0" step="1" value={l.maxPorPersona || ''}
          onChange={(e) => set({ maxPorPersona: Number(e.target.value) || 0 })}
          placeholder="20"
        />
        <p className="form-hint">0 = sin tope.</p>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={l.reservaAbierta} onChange={(e) => set({ reservaAbierta: e.target.checked })} />
        <span>
          Se puede reservar desde la web. Al cerrarla, la sección sigue contando el número y dónde
          comprarla, pero sin formulario.
        </span>
      </label>
    </section>
  )
}

/* ----------------------------- Buzón de la web ----------------------------- */
/**
 * Lo que llega desde la web pública: mensajes, avisos de donativo y reservas de
 * lotería. Vive en el editor de la web porque es lo que la web recibe, y
 * porque quien la monta es quien tiene que ver si funciona.
 */
function BuzonWebTab() {
  const [mensajes, guardar] = useMensajesWeb()
  const [filtro, setFiltro] = useState<'todos' | 'sinleer' | 'pendientes'>('todos')
  const [abierto, setAbierto] = useState<MensajeWeb | null>(null)

  const lista = mensajes.filter((m) =>
    filtro === 'sinleer' ? !m.leido : filtro === 'pendientes' ? !m.atendido : true,
  )

  async function cambiar(id: string, c: Partial<MensajeWeb>) {
    guardar(mensajes.map((m) => (m.id === id ? { ...m, ...c } : m)))
    setAbierto((prev) => (prev && prev.id === id ? { ...prev, ...c } : prev))
    await actualizarMensajeWeb(id, c)
  }

  async function borrar(id: string) {
    guardar(mensajes.filter((m) => m.id !== id))
    setAbierto((prev) => (prev && prev.id === id ? null : prev))
    await borrarMensajeWeb(id)
  }

  function abrir(m: MensajeWeb) {
    setAbierto(m)
    // Se marca leído al abrirlo, no al recibirlo: la marca del raíl tiene que
    // significar «no lo ha visto nadie».
    if (!m.leido) cambiar(m.id, { leido: true })
  }

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Buzón de la web</h2>
        {sinLeer(mensajes) > 0 && <span className="pill pill--warn">{sinLeer(mensajes)} sin leer</span>}
      </div>
      <p className="form-hint">
        Lo que llega desde la web: mensajes del formulario de contacto, avisos de donativo y reservas
        de lotería. Las solicitudes de alta no salen aquí: van a <b>Hermanos → Solicitudes de alta</b>,
        con el resto.
      </p>
      {mensajes.length === 0 ? (
        <p className="form-hint">
          Todavía no ha llegado nada. Se llena solo en cuanto alguien use un formulario de la web.
        </p>
      ) : (
        <>
          <div className="filters">
            {([
              ['todos', `Todo (${mensajes.length})`],
              ['sinleer', `Sin leer (${sinLeer(mensajes)})`],
              ['pendientes', `Por atender (${mensajes.filter((m) => !m.atendido).length})`],
            ] as const).map(([id, txt]) => (
              <button
                key={id} type="button"
                className={`chip${filtro === id ? ' chip--active' : ''}`}
                onClick={() => setFiltro(id)}
              >
                {txt}
              </button>
            ))}
          </div>
          <ul className="buzonweb">
            {lista.map((m) => (
              <li key={m.id} className={m.leido ? undefined : 'buzonweb__nuevo'}>
                <button type="button" className="buzonweb__fila" onClick={() => abrir(m)}>
                  <span className="buzonweb__ic" aria-hidden="true">{TIPOS_MENSAJE[m.tipo].icono}</span>
                  <span className="buzonweb__texto">
                    <span className="buzonweb__quien">{m.nombre}</span>
                    <span className="buzonweb__resumen">{resumenMensaje(m)}</span>
                  </span>
                  <span className="buzonweb__meta">
                    <span className="buzonweb__fecha">{m.fecha}</span>
                    {!m.atendido && <span className="buzonweb__pendiente">Por atender</span>}
                  </span>
                </button>
              </li>
            ))}
            {lista.length === 0 && <li className="form-hint">Nada con ese filtro.</li>}
          </ul>
        </>
      )}

      <Drawer
        open={!!abierto}
        onClose={() => setAbierto(null)}
        title={abierto ? TIPOS_MENSAJE[abierto.tipo].nombre : ''}
        subtitle={abierto ? `${abierto.nombre} · ${abierto.fecha}` : undefined}
        footer={
          abierto && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => cambiar(abierto.id, { atendido: !abierto.atendido })}
              >
                {abierto.atendido ? 'Marcar como pendiente' : 'Dar por atendido'}
              </button>
              <a className="btn btn-outline" href={`mailto:${abierto.email}?subject=${encodeURIComponent(abierto.asunto || 'Tu mensaje')}`}>
                Contestar por correo
              </a>
              <button className="btn btn-ghost rgpd-borrar" onClick={() => borrar(abierto.id)}>
                Borrar
              </button>
            </>
          )
        }
      >
        {abierto && (
          <>
            <dl className="familia-ficha__datos">
              <div><dt>Correo</dt><dd><a href={`mailto:${abierto.email}`}>{abierto.email}</a></dd></div>
              {abierto.telefono && <div><dt>Teléfono</dt><dd><a href={`tel:${abierto.telefono.replace(/\s+/g, '')}`}>{abierto.telefono}</a></dd></div>}
              {abierto.importe != null && <div><dt>Importe</dt><dd>{abierto.importe} €</dd></div>}
              {abierto.causa && <div><dt>Lo destina a</dt><dd>{abierto.causa}</dd></div>}
              {abierto.metodo && <div><dt>Por</dt><dd>{abierto.metodo}</dd></div>}
              {abierto.participaciones != null && (
                <div><dt>Participaciones</dt><dd>{abierto.participaciones}</dd></div>
              )}
            </dl>
            {abierto.mensaje.trim() && (
              <>
                <h3 className="buzonweb__asunto">{abierto.asunto || 'Mensaje'}</h3>
                <p className="buzonweb__cuerpo">{abierto.mensaje}</p>
              </>
            )}
          </>
        )}
      </Drawer>
    </section>
  )
}

/* -------------------------- Estación de penitencia -------------------------- */
function EstacionTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  const e = web.estacion
  function set(c: Partial<EstacionPenitencia>) { editar('estacion', { ...e, ...c }) }
  function setParada(id: string, c: Partial<ParadaItinerario>) {
    set({ itinerario: e.itinerario.map((x) => (x.id === id ? { ...x, ...c } : x)) })
  }
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= e.itinerario.length) return
    const lista = [...e.itinerario]
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    set({ itinerario: lista })
  }
  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">El día grande</h2></div>
        <p className="form-hint">
          La hora de salida y el itinerario son EL dato que se busca en Semana Santa. Mientras esté
          vacío, la sección no sale ni en la web ni en el menú.
        </p>
        {!e.dia.trim() && !e.horaSalida.trim() && e.itinerario.length === 0 && (
          <div className="banner-inline banner-inline--accent">
            <span>Te dejamos un itinerario de ejemplo con sus horas para que solo tengas que cambiar las calles.</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => editar('estacion', { ...GUION_ESTACION, itinerario: GUION_ESTACION.itinerario.map((x) => ({ ...x, id: nuevoId() })) })}
            >
              Rellenar con un guion
            </button>
          </div>
        )}
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="estDia">Día</label>
            <input id="estDia" type="text" value={e.dia} onChange={(x) => set({ dia: x.target.value })} placeholder="Viernes Santo" />
          </div>
          <div className="form-row">
            <label htmlFor="estAnio">Año</label>
            <input id="estAnio" type="text" value={e.anio} onChange={(x) => set({ anio: x.target.value })} placeholder="2027" />
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="estSalida">Hora de salida</label>
            <input id="estSalida" type="text" value={e.horaSalida} onChange={(x) => set({ horaSalida: x.target.value })} placeholder="17:30" />
          </div>
          <div className="form-row">
            <label htmlFor="estEntrada">Hora de entrada</label>
            <input id="estEntrada" type="text" value={e.horaEntrada} onChange={(x) => set({ horaEntrada: x.target.value })} placeholder="01:15" />
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="estDesde">Desde dónde sale</label>
          <input id="estDesde" type="text" value={e.salidaDesde} onChange={(x) => set({ salidaDesde: x.target.value })} placeholder="Parroquia de San Juan" />
        </div>
        <div className="form-row">
          <label htmlFor="estFecha">Fecha exacta de la salida</label>
          <input id="estFecha" type="date" value={e.fechaSalida ?? ''} onChange={(x) => set({ fechaSalida: x.target.value })} />
          <p className="form-hint">
            Solo para la cuenta atrás de la portada: con «Viernes Santo» no se pueden contar los
            días. En la web se sigue leyendo lo que hayas escrito arriba.
          </p>
        </div>
        <div className="form-row">
          <label htmlFor="estNota">Recomendaciones</label>
          <textarea id="estNota" rows={3} value={e.nota} onChange={(x) => set({ nota: x.target.value })} placeholder="Dónde se ve mejor, qué llevar, a qué hora conviene estar…" />
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Itinerario</h2>
          <button
            type="button" className="btn btn-outline btn-sm"
            onClick={() => set({ itinerario: [...e.itinerario, { id: nuevoId(), lugar: '', hora: '', destacada: false }] })}
          >
            + Añadir parada
          </button>
        </div>
        <p className="form-hint">
          Calle a calle, con su hora de paso. Marca como hito la salida, la carrera oficial y la
          entrada: salen resaltadas.
        </p>
        {e.itinerario.length === 0 && <p className="form-hint">Todavía no hay ninguna parada.</p>}
        <div className="opciones-editor">
          {e.itinerario.map((par, i) => (
            <div className="opcion-row opcion-row--parada" key={par.id}>
              <input
                type="text" value={par.hora} placeholder="18:40" aria-label="Hora de paso"
                onChange={(x) => setParada(par.id, { hora: x.target.value })}
              />
              <input
                type="text" value={par.lugar} placeholder="Calle o plaza" aria-label="Lugar"
                onChange={(x) => setParada(par.id, { lugar: x.target.value })}
              />
              <label className="checkbox" title="Resaltar esta parada">
                <input type="checkbox" checked={par.destacada} onChange={(x) => setParada(par.id, { destacada: x.target.checked })} />
                <span>Hito</span>
              </label>
              <span className="seccion-item__orden">
                <button type="button" className="icon-btn" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">▲</button>
                <button type="button" className="icon-btn" onClick={() => mover(i, 1)} disabled={i === e.itinerario.length - 1} aria-label="Bajar">▼</button>
              </span>
              <button
                type="button" className="icon-btn" title="Quitar parada"
                onClick={() => set({ itinerario: e.itinerario.filter((x) => x.id !== par.id) })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

/* --------------------------- Junta de gobierno --------------------------- */
const CARGOS_JUNTA = [
  'Hermano Mayor', 'Teniente de Hermano Mayor', 'Secretario/a', 'Tesorero/a',
  'Fiscal', 'Mayordomo/a', 'Prioste', 'Diputado/a Mayor de Gobierno',
  'Diputado/a de Caridad', 'Diputado/a de Cultos',
]

function JuntaTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  function set(id: string, c: Partial<MiembroJunta>) {
    editar('junta', (xs) => xs.map((m) => (m.id === id ? { ...m, ...c } : m)))
  }
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.junta.length) return
    const lista = [...web.junta]
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    editar('junta', lista)
  }
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Junta de gobierno</h2>
        <button
          type="button" className="btn btn-outline btn-sm"
          onClick={() => editar('junta', (xs) => [...xs, { id: nuevoId(), cargo: CARGOS_JUNTA[xs.length] ?? '', nombre: '' }])}
        >
          + Añadir cargo
        </button>
      </div>
      <p className="form-hint">
        Los cargos y quién los ocupa. Es lo que pide cualquier visita institucional, y hoy había que
        meterlo a mano en una página de texto.
      </p>
      {web.junta.length === 0 && <p className="form-hint">Sin cargos, la sección no sale en la web.</p>}
      <div className="opciones-editor">
        {web.junta.map((m, i) => (
          <div className="opcion-row opcion-row--junta" key={m.id}>
            <input
              type="text" value={m.cargo} placeholder="Cargo" aria-label="Cargo" list="cargos-junta"
              onChange={(e) => set(m.id, { cargo: e.target.value })}
            />
            <input
              type="text" value={m.nombre} placeholder="Nombre y apellidos" aria-label="Nombre"
              onChange={(e) => set(m.id, { nombre: e.target.value })}
            />
            <span className="seccion-item__orden">
              <button type="button" className="icon-btn" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">▲</button>
              <button type="button" className="icon-btn" onClick={() => mover(i, 1)} disabled={i === web.junta.length - 1} aria-label="Bajar">▼</button>
            </span>
            <button
              type="button" className="icon-btn" title="Quitar cargo"
              onClick={() => editar('junta', (xs) => xs.filter((x) => x.id !== m.id))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        ))}
      </div>
      <datalist id="cargos-junta">
        {CARGOS_JUNTA.map((c) => <option key={c} value={c} />)}
      </datalist>
    </section>
  )
}

/* ------------------------------- Historia ------------------------------- */
function HistoriaTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  return (
    <section className="settings-card">
      <div className="settings-card__head"><h2 className="settings-card__title">Historia</h2></div>
      <p className="form-hint">
        Se publica como una sección con formato: una entradilla, los párrafos que quieras (con su
        subtítulo) y fotos.
      </p>
      {contenidoVacio(web.historia) && (
        <div className="banner-inline banner-inline--accent">
          <span>¿No sabes por dónde empezar? Te dejamos un guion con los cuatro apartados de siempre.</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => editar('historia', { ...GUION_HISTORIA, parrafos: GUION_HISTORIA.parrafos.map((x) => ({ ...x, id: nuevoId() })) })}
          >
            Rellenar con un guion
          </button>
        </div>
      )}
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
        onSubir={leerImagenMediana}
        titulo="Fotos de la sección"
      />
    </section>
  )
}

/* --------------------------- Titulares (en Diseño) --------------------------- */
function TitularesTab({ web, editar, hermandad }: { web: WebPublica; editar: EditarFn; hermandad: HermandadSettings }) {
  const marca = marcaDeAgua(web, hermandad.nombreLegal ?? '')
  function editarTitular(id: string, c: Partial<Titular>) { editar('titulares', (xs) => xs.map((t) => (t.id === id ? { ...t, ...c } : t))) }
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= web.titulares.length) return
    const arr = [...web.titulares]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    editar('titulares', arr)
  }
  // Dos titulares con el mismo nombre acaban con el mismo enlace, y entonces
  // uno de los dos no se puede abrir. Se avisa en vez de dejarlo pasar.
  const repetidos = new Set(
    web.titulares
      .map((t) => slugTitular(t))
      .filter((v, i, xs) => xs.indexOf(v) !== i),
  )

  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Titulares</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => editar('titulares', (xs) => [...xs, { id: nuevoId(), nombre: 'Nuevo titular', fotoDataUrl: null, descripcion: '', autoria: '', parrafos: [], slug: '', credito: '', alt: '', fotos: [] }])}>+ Añadir</button>
        </div>
        <p className="form-hint">
          Cada titular se publica a lo ancho, con su foto grande a un lado y su texto al otro. Si
          escribes su historia, se le abre una ficha propia con enlace para compartir.
        </p>
        {web.titulares.map((t, i) => {
          const enlace = `/w/${web.slug}/t/${slugTitular(t)}`
          const conFicha = titularConFicha(t)
          return (
            <div className="assign-box" key={t.id}>
              <div className="assign-box__row">
                {t.fotoDataUrl && <img src={t.fotoDataUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
                <label className="btn btn-outline btn-sm">{t.fotoDataUrl ? 'Cambiar foto' : 'Foto'}<input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editarTitular(t.id, { fotoDataUrl: d }))} /></label>
                <button type="button" className="icon-btn" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
                <button type="button" className="icon-btn" title="Bajar" disabled={i === web.titulares.length - 1} onClick={() => mover(i, 1)}>▼</button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => editar('titulares', (xs) => duplicarEn(xs, t.id, (x) => ({ ...x, id: nuevoId(), nombre: `${x.nombre} (copia)`, slug: '' })))}
                >
                  Duplicar
                </button>
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('titulares', (xs) => xs.filter((x) => x.id !== t.id))}>Quitar titular</button>
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label>Nombre</label>
                  <input type="text" value={t.nombre} onChange={(e) => editarTitular(t.id, { nombre: e.target.value })} placeholder="Ntro. Padre Jesús…" />
                </div>
                <div className="form-row">
                  <label>Autoría de la imagen</label>
                  <input type="text" value={t.autoria} onChange={(e) => editarTitular(t.id, { autoria: e.target.value })} placeholder="Juan de Mesa, 1620" />
                </div>
              </div>
              <div className="form-row">
                <label>Una línea de presentación</label>
                <input type="text" value={t.descripcion} onChange={(e) => editarTitular(t.id, { descripcion: e.target.value })} placeholder="Sagrada imagen del Señor." />
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label>Autor de la fotografía</label>
                  <input type="text" value={t.credito ?? ''} onChange={(e) => editarTitular(t.id, { credito: e.target.value })} placeholder="Foto: nombre del fotógrafo" />
                  <p className="form-hint">Se publica bajo la foto. Vacío = no se enseña.</p>
                </div>
                <div className="form-row">
                  <label>Qué se ve en la foto</label>
                  <input type="text" value={t.alt ?? ''} onChange={(e) => editarTitular(t.id, { alt: e.target.value })} placeholder={t.nombre || 'Descripción de la imagen'} />
                  <p className="form-hint">Para quien no puede verla. Vacío = se usa el nombre.</p>
                </div>
              </div>
              <div className="form-row">
                <label>Enlace de su ficha</label>
                <input
                  type="text"
                  value={t.slug ?? ''}
                  onChange={(e) => editarTitular(t.id, { slug: aSlug(e.target.value) })}
                  placeholder={aSlug(t.nombre)}
                />
                <p className={`form-hint${repetidos.has(slugTitular(t)) ? ' form-hint--error' : ''}`}>
                  {repetidos.has(slugTitular(t)) ? (
                    `Este enlace está repetido (${enlace}). Cámbialo, o uno de los dos titulares no se podrá abrir.`
                  ) : conFicha ? (
                    // `preview=1` porque la web puede estar todavía sin publicar.
                    <a href={`${enlace}?preview=1`} target="_blank" rel="noreferrer">{enlace} ↗</a>
                  ) : (
                    `${enlace} · la ficha solo se abre cuando escribas su historia o le subas más fotos.`
                  )}
                </p>
              </div>
              <EditorParrafos
                parrafos={t.parrafos}
                onChange={(parrafos) => editarTitular(t.id, { parrafos })}
                titulo="Su historia"
                ayuda="Hechura, restauraciones, la devoción que despierta… El arranque se asoma en la web y lo demás vive en su ficha."
              />
              <EditorFotos
                fotos={t.fotos ?? []}
                onChange={(fotos) => editar('titulares', (xs) => xs.map((x) => (x.id === t.id ? { ...x, fotos: typeof fotos === 'function' ? fotos(x.fotos ?? []) : fotos } : x)))}
                onSubir={leerImagenMediana}
                titulo="Más fotos para su ficha"
              />
            </div>
          )
        })}
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Derechos de las fotos</h2></div>
        <p className="form-hint">
          Vale para los titulares y para la galería. Las fotos de una hermandad acaban circulando,
          y esto deja dicho de quién son.
        </p>
        <div className="form-row">
          <label htmlFor="avisoFotos">Aviso bajo las fotos</label>
          <input
            id="avisoFotos"
            type="text"
            value={web.avisoFotos}
            onChange={(e) => editar('avisoFotos', e.target.value)}
            placeholder="Fotografías propiedad de la hermandad. Prohibida su reproducción sin permiso."
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={web.marcaAgua} onChange={(e) => editar('marcaAgua', e.target.checked)} />
          <span>Marca de agua con el nombre de la hermandad sobre cada foto</span>
        </label>
        {/* Sin nombre no hay marca que pintar, y desde el editor no se ve por
            qué: mejor decirlo que dejar el interruptor puesto sin efecto. */}
        {web.marcaAgua && (
          <p className={`form-hint${marca ? '' : ' form-hint--error'}`}>
            {marca
              ? `Se verá «${marca}» en la esquina de cada foto.`
              : 'Ponle un nombre a la web (en «Marca») o a la hermandad, o no habrá nada que escribir en la marca.'}
          </p>
        )}
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
          <input type="file" accept="image/*" multiple hidden onChange={(e) => leerImagenes(e, anadir, 1920)} />
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
                  <input type="file" accept="image/*" hidden onChange={(e) => leerImagenGrande(e, (d) => editar('heroFotos', (xs) => xs.map((x, j) => (j === i ? d : x))))} />
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

      <div className="settings-card__head" style={{ marginTop: '1.4rem' }}>
        <h2 className="settings-card__title">Lo primero que se ve</h2>
      </div>
      <p className="form-hint">
        Tres bloques bajo la portada con lo que pregunta todo el que entra: cuándo salís, cuál es el
        próximo culto y quiénes sois.
      </p>
      <label className="checkbox">
        <input type="checkbox" checked={web.cuentaAtras} onChange={(e) => editar('cuentaAtras', e.target.checked)} />
        <span>Cuenta atrás para la estación de penitencia</span>
      </label>
      <p className="form-hint">
        {web.estacion.fechaSalida
          ? `Cuenta hasta el ${web.estacion.fechaSalida}. La fecha se pone en «Estación de penitencia».`
          : getCampana().fechaSalida
            ? `Sin fecha propia usa la de la campaña (${getCampana().fechaSalida}), que ya tienes puesta en Papeletas.`
            : 'Necesita la fecha exacta de la salida: ponla en «Estación de penitencia» o en la campaña de Papeletas.'}
      </p>
      <label className="checkbox">
        <input type="checkbox" checked={web.proximoCulto} onChange={(e) => editar('proximoCulto', e.target.checked)} />
        <span>El próximo culto, destacado</span>
      </label>
      <p className="form-hint">Sale el primero del calendario que aún no haya pasado. Si no hay ninguno, no se enseña.</p>

      <div className="settings-card__head" style={{ marginTop: '1rem' }}>
        <h3 className="settings-card__title" style={{ fontSize: '0.95rem' }}>Cifras de la hermandad</h3>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => editar('cifras', (xs) => [...xs, { id: nuevoId(), numero: '', texto: '' }])}
        >
          + Añadir cifra
        </button>
      </div>
      {web.cifras.length === 0 ? (
        <p className="form-hint">Por ejemplo: «1.240 · hermanos», «1595 · desde», «3 · pasos».</p>
      ) : (
        web.cifras.map((c) => (
          <div className="assign-box__row" key={c.id}>
            <input
              type="text"
              value={c.numero}
              onChange={(e) => editar('cifras', (xs) => xs.map((x) => (x.id === c.id ? { ...x, numero: e.target.value } : x)))}
              placeholder="1.240"
              aria-label="La cifra"
              style={{ maxWidth: '9rem' }}
            />
            <input
              type="text"
              value={c.texto}
              onChange={(e) => editar('cifras', (xs) => xs.map((x) => (x.id === c.id ? { ...x, texto: e.target.value } : x)))}
              placeholder="hermanos"
              aria-label="Qué es esa cifra"
            />
            <button
              type="button"
              className="icon-btn rgpd-borrar"
              title="Quitar"
              onClick={() => editar('cifras', (xs) => xs.filter((x) => x.id !== c.id))}
            >
              ✕
            </button>
          </div>
        ))
      )}

      <div className="settings-card__head" style={{ marginTop: '1.4rem' }}>
        <h2 className="settings-card__title">Idioma</h2>
      </div>
      <div className="form-row">
        <label htmlFor="idiomaWeb">La web está escrita en</label>
        <select id="idiomaWeb" value={web.idioma} onChange={(e) => editar('idioma', e.target.value)}>
          {IDIOMAS.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <p className="form-hint">
          Sin esto, un lector de pantalla lee el castellano con voz inglesa y no hay quien lo
          entienda. Google también lo usa para saber a quién enseñar tu web.
        </p>
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="otroIdioma">Unas líneas en otra lengua</label>
          <select
            id="otroIdioma"
            value={web.resumenOtroIdioma.idioma}
            onChange={(e) => editar('resumenOtroIdioma', (v) => ({ ...v, idioma: e.target.value }))}
          >
            {IDIOMAS.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="otroIdiomaTitulo">Título</label>
          <input
            id="otroIdiomaTitulo"
            type="text"
            value={web.resumenOtroIdioma.titulo}
            onChange={(e) => editar('resumenOtroIdioma', (v) => ({ ...v, titulo: e.target.value }))}
            placeholder="About our brotherhood"
          />
        </div>
      </div>
      <div className="form-row">
        <textarea
          rows={3}
          value={web.resumenOtroIdioma.texto}
          onChange={(e) => editar('resumenOtroIdioma', (v) => ({ ...v, texto: e.target.value }))}
          placeholder="Founded in 1595, our brotherhood walks the streets of the old quarter every Good Friday…"
          aria-label="Resumen en otra lengua"
        />
        <p className="form-hint">
          Cuatro líneas bajo la portada para el visitante de fuera. Traducir la web entera no es
          realista; esto sí, y es lo que busca quien viene de turismo en Semana Santa.
        </p>
      </div>

      <div className="settings-card__head" style={{ marginTop: '1.4rem' }}>
        <h2 className="settings-card__title">Foto a sangre</h2>
        <label className="btn btn-outline btn-sm">
          {web.sangre.fotoDataUrl ? 'Cambiar foto' : 'Subir foto'}
          <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('sangre', (v) => ({ ...v, fotoDataUrl: d })))} />
        </label>
      </div>
      <p className="form-hint">
        Una foto de borde a borde que corta la página en dos. Es lo que da respiro entre tanta
        sección seguida. Elige una apaisada y con aire abajo, que ahí va la frase.
      </p>
      {web.sangre.fotoDataUrl && (
        <>
          <div className="assign-box__row">
            <img src={web.sangre.fotoDataUrl} alt="" style={{ width: 120, height: 60, objectFit: 'cover', borderRadius: 8 }} />
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('sangre', (v) => ({ ...v, fotoDataUrl: null }))}>Quitar</button>
          </div>
          <div className="form-row">
            <label htmlFor="sangreTexto">Frase encima (opcional)</label>
            <input
              id="sangreTexto"
              type="text"
              value={web.sangre.texto}
              onChange={(e) => editar('sangre', (v) => ({ ...v, texto: e.target.value }))}
              placeholder="Desde 1595 por las calles de nuestro barrio"
            />
          </div>
          <div className="form-row">
            <label htmlFor="sangreDonde">Dónde va</label>
            <select
              id="sangreDonde"
              value={web.sangre.despuesDe}
              onChange={(e) => editar('sangre', (v) => ({ ...v, despuesDe: e.target.value as TipoSeccion | '' }))}
            >
              <option value="">Detrás de la primera sección</option>
              {web.secciones.filter((x) => x.visible).map((x) => (
                <option key={x.tipo} value={x.tipo}>Detrás de «{nombreSeccion(x)}»</option>
              ))}
            </select>
          </div>
        </>
      )}
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
  async function anadirFoto(albumId: string, dataUrl: string) {
    // Se guarda también una copia pequeña: la rejilla usa esa y la grande solo
    // se descarga al abrir la foto a pantalla completa.
    const mini = await miniatura(dataUrl)
    actualizar((actual) => ({
      ...actual,
      albumes: actual.albumes.map((a) =>
        a.id === albumId
          ? { ...a, fotos: [...a.fotos, { id: nuevoId(), fotoDataUrl: dataUrl, miniDataUrl: mini, pie: '' } as FotoGaleria] }
          : a,
      ),
    }))
  }

  const totalFotos = web.albumes.reduce((n, a) => n + a.fotos.length, 0)
  const [soltandoEn, setSoltandoEn] = useState<string | null>(null)

  const peso = avisoDePeso(pesoWeb(web))
  // Las fotos subidas antes de que hubiera copia pequeña: siguen mandando la
  // grande a la rejilla, que es de donde viene casi todo el peso.
  const sinMini = web.albumes.reduce((n, a) => n + a.fotos.filter((f) => !f.miniDataUrl).length, 0)
  const [aligerando, setAligerando] = useState(false)

  /**
   * Le hace una copia pequeña a las fotos que no la tengan. No se vuelve a
   * comprimir la grande: ya está comprimida, y volver a hacerlo solo le quita
   * calidad. Va de una en una para no clavar el navegador con treinta fotos.
   */
  async function aligerar() {
    setAligerando(true)
    try {
      for (const a of web.albumes) {
        for (const f of a.fotos) {
          if (f.miniDataUrl) continue
          const mini = await miniatura(f.fotoDataUrl)
          actualizar((actual) => ({
            ...actual,
            albumes: actual.albumes.map((x) =>
              x.id !== a.id ? x : { ...x, fotos: x.fotos.map((y) => (y.id === f.id ? { ...y, miniDataUrl: mini } : y)) },
            ),
          }))
        }
      }
    } finally {
      setAligerando(false)
    }
  }

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
        sale con su título y su fecha, y al pulsar una foto se abre a pantalla completa. El aviso
        de derechos y la marca de agua se ponen en «Titulares».
        {totalFotos > 0 && ` Ahora mismo: ${totalFotos} ${totalFotos === 1 ? 'foto' : 'fotos'}.`}
      </p>

      {/* Lo que pesa la web. Las fotos viajan dentro del contenido, así que
          esto es lo que se descarga cada visita. */}
      <div className={`banner-inline ${peso.nivel === 'malo' ? 'banner-inline--warn' : 'banner-inline--accent'}`}>
        <span>
          Tu web pesa <b>{peso.peso}</b>
          {peso.segundos >= 2 && `: unos ${peso.segundos} segundos en un móvil con mala cobertura`}
          {peso.nivel === 'malo' && '. Pasado de aquí, el navegador puede no dejar guardarla'}.
          {sinMini > 0 && ` Hay ${sinMini} ${sinMini === 1 ? 'foto' : 'fotos'} sin copia pequeña.`}
        </span>
        {sinMini > 0 && (
          <button type="button" className="btn btn-outline btn-sm" disabled={aligerando} onClick={aligerar}>
            {aligerando ? 'Aligerando…' : 'Aligerar las fotos'}
          </button>
        )}
      </div>
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
            {/* Las fotos de la copia llevan id nuevo: el visor las localiza por
                id en la lista de TODAS, y dos iguales lo descolocaban. */}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => editar('albumes', (xs) => duplicarEn(xs, a.id, (x) => ({
                ...x,
                id: nuevoId(),
                titulo: `${x.titulo} (copia)`,
                fotos: x.fotos.map((f) => ({ ...f, id: nuevoId() })),
              })))}
            >
              Duplicar
            </button>
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
                  {/* Quién la hizo: se publica como «Foto: …» bajo el pie y en el visor. */}
                  <input
                    type="text"
                    value={f.autor ?? ''}
                    onChange={(e) => editarAlbum(a.id, { fotos: a.fotos.map((x) => (x.id === f.id ? { ...x, autor: e.target.value } : x)) })}
                    placeholder="Autor de la foto"
                    aria-label="Autor de la foto"
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
        <button type="button" className="btn btn-primary btn-sm" onClick={() => editar('noticias', (xs) => [{ id: nuevoId(), titulo: 'Nueva noticia', fecha: fechaHoyLocal(), resumen: '', fotoDataUrl: null, publicada: true, parrafos: [], destacada: false }, ...xs])}>+ Nueva noticia</button>
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
          {n.fotoDataUrl && (
            <div className="form-row">
              <label>Qué se ve en la foto</label>
              <input
                type="text"
                value={n.altFoto ?? ''}
                onChange={(e) => editarNoticia(n.id, { altFoto: e.target.value })}
                placeholder="El paso de palio saliendo de la parroquia"
              />
              <p className="form-hint">Para quien no puede verla. Déjalo vacío solo si la foto es de adorno.</p>
            </div>
          )}
          <div className="form-row">
            <label>Entradilla</label>
            <textarea rows={2} value={n.resumen} onChange={(e) => editarNoticia(n.id, { resumen: e.target.value })} />
            {/* En la web sale entera, pero por encima de tres líneas la tarjeta
                se descuadra respecto a las demás. */}
            <p className={`form-hint${n.resumen.length > 220 ? ' form-hint--alerta' : ''}`}>
              {n.resumen.length} caracteres{n.resumen.length > 220 && ' — queda muy largo para la tarjeta de la web'}
            </p>
          </div>

          {/* El cuerpo es opcional: sin él, la noticia sigue siendo un titular
              con su entradilla, como hasta ahora. Con él, gana página propia. */}
          <details className="afinar afinar--suelto">
            <summary className="afinar__cabeza">
              <span className="afinar__titulo">Cuerpo de la noticia</span>
              <span className="afinar__nota">
                {(n.parrafos ?? []).some((p) => p.texto.trim())
                  ? `${(n.parrafos ?? []).length} ${(n.parrafos ?? []).length === 1 ? 'párrafo' : 'párrafos'} · tiene página propia`
                  : 'Opcional — al escribirlo, la noticia gana su propio enlace'}
              </span>
            </summary>
            <div className="afinar__cuerpo">
              <EditorParrafos
                parrafos={n.parrafos ?? []}
                onChange={(parrafos) => editarNoticia(n.id, { parrafos })}
                ayuda="Con cuerpo, la noticia tiene su propia página y se puede compartir sola."
              />
              <p className="form-hint">
                Enlace propio: <code>/w/{web.slug}/n/{slugNoticia(n)}</code>
              </p>
            </div>
          </details>

          <div className="assign-box__row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={Boolean(n.destacada)}
                onChange={(e) => {
                  // Solo una destacada: marcar una desmarca la que hubiera.
                  const marcar = e.target.checked
                  editar('noticias', (xs) => xs.map((x) => ({ ...x, destacada: marcar && x.id === n.id })))
                }}
              />
              <span>Destacada (sale la primera y a lo grande)</span>
            </label>
            {/* La copia sale sin publicar y con enlace nuevo: dos noticias con
                el mismo enlace y una de las dos no se puede abrir. */}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => editar('noticias', (xs) => duplicarEn(xs, n.id, (x) => ({ ...x, id: nuevoId(), titulo: `${x.titulo} (copia)`, slug: '', publicada: false })))}
            >
              Duplicar
            </button>
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('noticias', (xs) => xs.filter((x) => x.id !== n.id))}>Eliminar noticia</button>
          </div>
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
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => editar('cultos', (xs) => duplicarEn(xs, c.id, (x) => ({ ...x, id: nuevoId(), titulo: `${x.titulo} (copia)` })))}
            >
              Duplicar
            </button>
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('cultos', (xs) => xs.filter((x) => x.id !== c.id))}>Quitar culto</button>
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
        {/* La página que más se pide y la que peor se arranca. */}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const id = nuevoId()
            editar('paginas', (xs) => [...xs, {
              ...GUION_PAGINA_CARIDAD,
              id,
              enMenu: true,
              parrafos: GUION_PAGINA_CARIDAD.parrafos.map((x) => ({ ...x, id: nuevoId() })),
            }])
            setPaginaSel(id)
          }}
        >
          + Bolsa de caridad (guion)
        </button>
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
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const copiaId = nuevoId()
                  editar('paginas', (xs) => duplicarEn(xs, sel.id, (x) => ({
                    ...x,
                    id: copiaId,
                    titulo: `${x.titulo} (copia)`,
                    parrafos: x.parrafos.map((pa) => ({ ...pa, id: nuevoId() })),
                  })))
                  setPaginaSel(copiaId)
                }}
              >
                Duplicar
              </button>
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
            onSubir={leerImagenMediana}
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

        {/* Las dos previas, con el recorte de verdad de cada sitio: es lo que
            convence de rellenarlo, y lo que evita el «pero si yo lo escribí». */}
        <div className="compartir-previas">
          <div>
            <p className="compartir-previa__eti">En Google</p>
            <div className="google-previa">
              <div className="google-previa__marca">
                <span className="google-previa__favicon" aria-hidden="true">
                  {(titulo[0] ?? 'H').toUpperCase()}
                </span>
                <span>
                  <b>{web.titulo || hermandad.nombreLegal || 'Tu hermandad'}</b>
                  <small>{dominio}</small>
                </span>
              </div>
              <p className="google-previa__titulo">{recortar(titulo, 60)}</p>
              <p className="google-previa__desc">
                {descripcion
                  ? recortar(descripcion, 155)
                  : 'Sin descripción, Google se inventa un trozo del texto de tu web.'}
              </p>
            </div>
          </div>
          <div>
            <p className="compartir-previa__eti">En WhatsApp</p>
            <div className="compartir-previa">
              <div className="compartir-previa__img">
                {imagen ? <img src={imagen} alt="" /> : <span>Sin imagen</span>}
              </div>
              <div className="compartir-previa__texto">
                <b>{recortar(titulo, 65)}</b>
                <p>{recortar(descripcion, 120) || 'Sin descripción. Aquí saldría el texto que escribas abajo.'}</p>
                <span className="compartir-previa__dominio">{dominio}</span>
              </div>
            </div>
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

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Para Google</h2></div>
        <p className="form-hint">
          El <b>sitemap</b> es la lista de páginas que se le da a Google para que las visite: sin
          él, las noticias y las fichas de los titulares tardan semanas en salir, o no salen. El
          <b> robots</b> dice quién puede mirar.
        </p>
        <div className="assign-box__row">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => descargarTexto('sitemap.xml', sitemapXml(web, baseDeLaWeb(web, window.location.origin)), 'application/xml')}
          >
            Descargar sitemap.xml
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => descargarTexto('robots.txt', robotsTxt(web, baseDeLaWeb(web, window.location.origin)), 'text/plain')}
          >
            Descargar robots.txt
          </button>
        </div>
        <p className="form-hint">
          {rutasDeLaWeb(web).length} {rutasDeLaWeb(web).length === 1 ? 'página' : 'páginas'} en el
          sitemap. {!web.publicada && 'Mientras la web no esté publicada, el robots pide a los buscadores que no la indexen: si Google indexa una hermandad a medio hacer, luego cuesta meses quitarlo.'}
        </p>

        <div className="banner-inline banner-inline--accent" style={{ marginTop: '0.8rem' }}>
          <span>
            <b>Lo que Google sí ve.</b> El título, la descripción, la dirección buena de cada
            página, el escudo en la pestaña y los datos de cada culto (con su fecha y su hora) ya
            van puestos: Google ejecuta JavaScript al indexar y los lee.
          </span>
        </div>
        <div className="banner-inline banner-inline--warn">
          <span>
            <b>Lo que WhatsApp todavía no ve.</b> WhatsApp y Facebook no ejecutan JavaScript: piden
            el HTML y leen lo que hay. Para que la vista previa del enlace diga el nombre de tu
            hermandad y no el de Cabildo, hace falta encender la parte de servidor. Está escrita y
            lista: son dos pasos, y están explicados en <code>docs/SEO.md</code>.
          </span>
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
        <div className="settings-card__head">
          <h2 className="settings-card__title">Horario de secretaría</h2>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => editar('horarios', (xs) => [...xs, { id: nuevoId(), dias: '', horas: '', nota: '' }])}
          >
            + Añadir franja
          </button>
        </div>
        <p className="form-hint">
          Cuándo se atiende y para qué. Es de lo que más se pregunta por teléfono, y si está en la
          web se pregunta bastante menos.
        </p>
        {web.horarios.length === 0 && <p className="form-hint">Sin franjas, la web no enseña ningún horario.</p>}
        <div className="opciones-editor">
          {web.horarios.map((f) => (
            <div className="opcion-row opcion-row--horario" key={f.id}>
              <input
                type="text" value={f.dias} placeholder="Martes y jueves" aria-label="Días"
                onChange={(e) => editar('horarios', (xs) => xs.map((x) => (x.id === f.id ? { ...x, dias: e.target.value } : x)))}
              />
              <input
                type="text" value={f.horas} placeholder="de 20:00 a 21:30" aria-label="Horas"
                onChange={(e) => editar('horarios', (xs) => xs.map((x) => (x.id === f.id ? { ...x, horas: e.target.value } : x)))}
              />
              <input
                type="text" value={f.nota} placeholder="Para qué (opcional)" aria-label="Para qué"
                onChange={(e) => editar('horarios', (xs) => xs.map((x) => (x.id === f.id ? { ...x, nota: e.target.value } : x)))}
              />
              <button
                type="button" className="icon-btn" title="Quitar franja"
                onClick={() => editar('horarios', (xs) => xs.filter((x) => x.id !== f.id))}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
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
