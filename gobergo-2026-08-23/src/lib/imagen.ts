/**
 * Tratamiento de imágenes en el navegador: comprimir, recortar y leer archivos.
 *
 * Vivía dentro del editor de la web, que era el único que subía fotos. Con la
 * foto del hermano hacen falta en dos sitios, y una segunda copia del mismo
 * código es como se acaba con dos comportamientos distintos para lo mismo.
 */

/**
 * El mejor formato que aguante este navegador. WebP pesa la mitad que JPEG a
 * la misma calidad; si no lo admite (Safari antiguos), se cae a JPEG.
 */
let formatoCache: string | null = null
export function mejorFormato(): string {
  if (formatoCache) return formatoCache
  try {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    formatoCache = c.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg'
  } catch {
    formatoCache = 'image/jpeg'
  }
  return formatoCache
}

/** Carga un data URL como imagen. Devuelve null si no se puede leer. */
function cargar(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/** Reduce una imagen a `maxLado` px por su lado mayor, conservando la proporción. */
export async function comprimirImagen(dataUrl: string, maxLado = 1600, calidad = 0.82): Promise<string> {
  const img = await cargar(dataUrl)
  if (!img) return dataUrl
  const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * escala)
  canvas.height = Math.round(img.height * escala)
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const salida = canvas.toDataURL(mejorFormato(), calidad)
  // Si por lo que sea sale más gorda que la original (un PNG plano, una foto ya
  // diminuta), se queda la original.
  return salida.length < dataUrl.length ? salida : dataUrl
}

/**
 * Recorta al centro y deja un cuadrado de `lado` px. Para la foto del hermano:
 * se enseña en círculo o en cuadrado en la ficha, el carné y el listado del
 * cortejo, y guardarla ya recortada evita que cada sitio la deforme a su
 * manera.
 *
 * Se recorta por el centro y no por arriba porque en una foto de carné la cara
 * está en el medio; recortando por arriba salían fotos sin frente.
 */
export async function recortarCuadrado(dataUrl: string, lado = 400, calidad = 0.8): Promise<string> {
  const img = await cargar(dataUrl)
  if (!img) return dataUrl
  const corte = Math.min(img.width, img.height)
  const x = (img.width - corte) / 2
  const y = (img.height - corte) / 2
  const canvas = document.createElement('canvas')
  canvas.width = lado
  canvas.height = lado
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, x, y, corte, corte, 0, 0, lado, lado)
  return canvas.toDataURL(mejorFormato(), calidad)
}

/** Lee un archivo del disco como data URL. Devuelve null si no se puede. */
export function leerArchivo(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result))
    lector.onerror = () => resolve(null)
    lector.readAsDataURL(file)
  })
}

/**
 * Lo que pesa un data URL, en bytes. Base64 mete un tercio de más sobre el
 * tamaño real, así que se descuenta: si no, los avisos de peso mienten.
 */
export function pesoDeDataUrl(dataUrl: string): number {
  const coma = dataUrl.indexOf(',')
  if (coma === -1) return dataUrl.length
  const base64 = dataUrl.length - coma - 1
  const relleno = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0
  return Math.max(0, Math.round((base64 * 3) / 4) - relleno)
}
