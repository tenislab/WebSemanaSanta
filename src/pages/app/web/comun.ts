/**
 * LO QUE COMPARTEN LAS VEINTITRÉS PESTAÑAS DEL EDITOR DE LA WEB.
 *
 * Dos cosas y nada más: los ayudantes que tocan imágenes o listas, y los tres
 * tipos de función con que una pestaña cambia la web.
 *
 * NO ES UN CAJÓN DE SASTRE. Aquí entra lo que usan DOS pestañas o más; lo que
 * usa una sola vive en su pestaña. La diferencia importa: un común que lo
 * acumula todo vuelve a ser el fichero de 4.770 líneas, solo que con otro
 * nombre y sin el índice que dan las pestañas.
 */
import { guardarImagen } from '../../../lib/almacenImagenes'
import { comprimirImagen, leerArchivo } from '../../../lib/imagen'
import { type WebPublica } from '../../../lib/webPublica'
import { type ChangeEvent } from 'react'

export function miniatura(dataUrl: string): Promise<string> {
  return comprimirImagen(dataUrl, 520, 0.72).then((d) => guardarImagen(d))
}

/**
 * Comprimir y GUARDAR. Todo lo que entra por el editor pasa por aquí.
 *
 * Antes la foto se quedaba escrita dentro del contenido y viajaba con él en
 * cada guardado. Ahora se sube al almacén y lo que se guarda es su dirección
 * — ver `lib/almacenImagenes.ts`. Sin Supabase detrás devuelve la imagen tal
 * cual y todo sigue funcionando igual que antes.
 */
async function preparar(dataUrl: string, maxLado: number): Promise<string> {
  return guardarImagen(await comprimirImagen(dataUrl, maxLado))
}

/**
 * Varias imágenes de una tacada. Se leen en serie a propósito: en paralelo, con
 * treinta fotos de una salida, el navegador se queda clavado comprimiendo.
 */
export async function leerImagenes(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void, maxLado = 1600) {
  const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith('image/'))
  e.target.value = ''
  for (const file of files) {
    const dataUrl = await leerArchivo(file)
    if (dataUrl) cb(await preparar(dataUrl, maxLado))
  }
}

/** Las mismas imágenes, pero a partir de archivos sueltos (arrastrar, pegar). */
export async function leerArchivos(files: File[], cb: (dataUrl: string) => void) {
  for (const file of files.filter((f) => f.type.startsWith('image/'))) {
    const dataUrl = await leerArchivo(file)
    if (dataUrl) cb(await preparar(dataUrl, 1600))
  }
}

export function leerImagen(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void, maxLado = 1600) {
  const file = e.target.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  const lector = new FileReader()
  lector.onload = async () => cb(await preparar(String(lector.result), maxLado))
  lector.readAsDataURL(file)
  e.target.value = ''
}

/**
 * Fotos que en la web nunca se ven a más de media página (las de una sección,
 * las de un titular, la de una noticia): guardarlas a 1600 px es pagar el
 * doble de peso por píxeles que nadie ve.
 */
export function leerImagenMediana(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void) {
  leerImagen(e, cb, 1100)
}

/** La portada se ve a pantalla completa: esa sí necesita píxeles. */
export function leerImagenGrande(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void) {
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
export function duplicarEn<T extends { id: string }>(lista: T[], id: string, comoCopia: (x: T) => T): T[] {
  const i = lista.findIndex((x) => x.id === id)
  if (i < 0) return lista
  return [...lista.slice(0, i + 1), comoCopia(lista[i]), ...lista.slice(i + 1)]
}

/** Descarga un texto como archivo, sin pasar por ningún servidor. */
export function descargarTexto(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

/** Para buscar: sin acentos ni mayúsculas, que nadie escribe «Galería» con tilde. */
export function sinAcentos(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export function recortar(texto: string, max: number): string {
  const limpio = texto.trim()
  if (limpio.length <= max) return limpio
  const corte = limpio.slice(0, max)
  const espacio = corte.lastIndexOf(' ')
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[.,;:\s]+$/, '')}…`
}

/** Fecha de hoy en ISO pero en hora LOCAL: con toISOString, de madrugada en
 *  España la noticia salía fechada el día anterior (UTC). */
export function fechaHoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type EditarFn = <K extends keyof WebPublica>(
  campo: K,
  valor: WebPublica[K] | ((actual: WebPublica[K]) => WebPublica[K]),
) => void
/** Cambio calculado sobre el estado más reciente (para lo asíncrono). */
export type ActualizarFn = (cambio: (actual: WebPublica) => WebPublica) => void
export type EditarLoteFn = (etiqueta: string, cambios: Partial<WebPublica>) => void

/* ------------------------- Avisos de lo que falta ------------------------- */
/**
 * Cuánto le falta a la web para estar presentable, en forma de progreso y no
 * de lista de reproches: doce avisos abiertos ocupaban la pantalla entera y
 * el editor quedaba debajo del pliegue. Se enseñan los tres más urgentes y el
 * resto se despliega a petición.
 */

export function lineas(texto: string): string[] {
  return texto.split('\n').map((l) => l.trim()).filter(Boolean)
}
