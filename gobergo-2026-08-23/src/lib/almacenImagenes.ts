/**
 * EL ALMACÉN DE IMÁGENES.
 *
 * Una foto subida a la web puede acabar en dos sitios: metida dentro del
 * propio contenido, escrita como texto (`data:image/webp;base64,…`), o
 * guardada como archivo con una dirección propia. Hasta ahora era siempre lo
 * primero, y eso ponía tres techos:
 *
 *   · PESO. La web entera es UNA fila. Veinte fotos de una salida y esa fila
 *     pesa quince megas: se vuelve a subir entera en cada guardado y se
 *     descarga entera en cada visita, aunque no haya cambiado ni una coma.
 *   · CACHÉ. Una foto escrita dentro del HTML no la puede guardar el
 *     navegador: se descarga otra vez en cada página.
 *   · Y EL QUE BLOQUEABA DE VERDAD: WhatsApp, Facebook y X no leen una imagen
 *     en `data:`. Por eso al pegar el enlace de la hermandad salía la tarjeta
 *     sin foto, y por eso `seoWeb.ts` se negaba a prometer una `og:image` que
 *     el rastreador no iba a poder abrir.
 *
 * Lo que hace este archivo es una sola cosa: recibir una imagen en texto y
 * devolver una dirección. Todo lo demás de la aplicación sigue igual, porque
 * lo que se guarda en `fotoDataUrl` sigue siendo una cadena que se le puede
 * pasar tal cual a un `<img src>`; lo único que cambia es que ahora es una
 * dirección corta en vez de tres megas de base64.
 *
 * SI NO HAY SUPABASE, NO PASA NADA. En modo demostración —y también si la
 * subida falla, o si falta ejecutar `supabase/imagenes.sql`— se devuelve la
 * imagen tal como vino. La web sigue funcionando exactamente como antes: más
 * pesada, pero entera. Una foto NUNCA se pierde por culpa de este archivo; en
 * el peor caso se queda donde estaba.
 *
 * PARA ENCENDERLO: ejecuta `supabase/imagenes.sql` una vez en el SQL Editor.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { hermandadActualId } from './multiHermandad'

const CUBO = 'imagenes'

/**
 * Lo que este almacén acepta. Las imágenes por lo dicho arriba; los PDF
 * porque el boletín de una hermandad son ocho megas y guardado como texto
 * dentro de la fila de la web se lleva por delante el guardado entero.
 */
const EXTENSIONES: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
}

/** ¿Es esto una imagen (o un PDF) escrita dentro del texto? */
export function esDataUrl(valor: unknown): valor is string {
  return typeof valor === 'string' && /^data:(image\/|application\/pdf)/i.test(valor)
}

/** ¿Hay a dónde subir? En modo demostración, no: y no es un fallo. */
export function hayAlmacen(): boolean {
  return isSupabaseConfigured && supabase !== null
}

/**
 * Un nombre que nadie pueda adivinar. No es un adorno: el cubo es público —
 * tiene que serlo para que WhatsApp lea la foto— así que lo único que separa
 * la foto de un hermano de quien no tiene por qué verla es que su dirección no
 * se pueda deducir. `randomUUID` son 122 bits al azar.
 */
function nombreNuevo(extension: string): string {
  const azar =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  return `${azar}.${extension}`
}

/**
 * De texto a archivo. A mano y no con `fetch(dataUrl)` porque así se sabe qué
 * ha fallado: un base64 cortado a la mitad —que es lo que deja un móvil que se
 * queda sin memoria comprimiendo— da aquí un error claro en vez de un
 * «Failed to fetch» que no dice nada.
 */
function aBlob(dataUrl: string): { blob: Blob; extension: string } | null {
  const coma = dataUrl.indexOf(',')
  if (coma === -1) return null
  const cabecera = dataUrl.slice(5, coma)
  const tipo = cabecera.split(';')[0].toLowerCase()
  const extension = EXTENSIONES[tipo]
  if (!extension) return null
  if (!cabecera.includes('base64')) return null
  try {
    const crudo = atob(dataUrl.slice(coma + 1))
    const bytes = new Uint8Array(crudo.length)
    for (let i = 0; i < crudo.length; i += 1) bytes[i] = crudo.charCodeAt(i)
    return { blob: new Blob([bytes], { type: tipo }), extension }
  } catch {
    return null
  }
}

/**
 * Guarda una imagen y devuelve su dirección.
 *
 * `carpeta` es para tener el cubo ordenado el día que haya que mirarlo a mano:
 * `web` lo que sale en la página, `hermanos` las fotos del censo. No cambia
 * los permisos —eso lo decide la carpeta de la hermandad, que va delante— pero
 * evita un cubo con cuatro mil archivos sueltos.
 *
 * Si no se puede subir, devuelve la imagen tal cual vino. Quien llama no tiene
 * que distinguir los dos casos: en los dos recibe algo que vale para un
 * `<img src>`.
 */
export async function guardarImagen(dataUrl: string, carpeta = 'web'): Promise<string> {
  if (!esDataUrl(dataUrl)) return dataUrl
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente) return dataUrl

  const trozos = aBlob(dataUrl)
  if (!trozos) return dataUrl

  try {
    const hermandadId = await hermandadActualId()
    // Sin saber de quién es, no se sube: la política de Storage lo rechazaría
    // igualmente, y así al menos la foto se queda en el contenido y se ve.
    if (!hermandadId) return dataUrl
    const ruta = `${hermandadId}/${carpeta}/${nombreNuevo(trozos.extension)}`
    const { error } = await cliente.storage.from(CUBO).upload(ruta, trozos.blob, {
      contentType: trozos.blob.type,
      // Un año de caché. El nombre es aleatorio y el archivo no se sobrescribe
      // nunca —cambiar la foto sube otra con otro nombre— así que no hay
      // manera de que el navegador enseñe una imagen vieja.
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw error
    return cliente.storage.from(CUBO).getPublicUrl(ruta).data.publicUrl
  } catch (e) {
    avisarUnaVez(e)
    return dataUrl
  }
}

/*
 * El aviso, UNA vez. Sin esto, una hermandad que no haya ejecutado
 * `imagenes.sql` y suba treinta fotos de una salida se lleva treinta errores
 * idénticos en la consola, y el de verdad —si lo hubiera— se pierde entre
 * ellos.
 */
let yaAvisado = false
function avisarUnaVez(e: unknown) {
  if (yaAvisado) return
  yaAvisado = true
  console.warn(
    'Las fotos se están guardando dentro del contenido porque no se han podido subir al almacén. ' +
      'Si es la primera vez, falta ejecutar supabase/imagenes.sql.',
    e,
  )
}

/**
 * LA MUDANZA. Recorre lo que se le dé —un objeto, una lista, lo que sea— y
 * sube al almacén todas las imágenes que encuentre escritas dentro.
 *
 * Va a ciegas a propósito: NO conoce los campos de la web. La alternativa era
 * escribir la lista de sitios donde puede haber una foto (el logotipo, la
 * portada, cada titular, cada álbum, cada noticia, la ficha de cada paso, la
 * portada del boletín, la imagen para WhatsApp…) y esa lista se queda vieja el
 * día que alguien añada una sección con foto. Un campo olvidado ahí no da
 * error: simplemente esa foto no sube nunca y nadie se entera.
 *
 * Es idempotente: la segunda vez no encuentra ninguna, porque ya son
 * direcciones. Por eso se puede llamar en cada publicación sin pensarlo.
 *
 * Y la misma imagen repetida —la de portada suele ser también la de WhatsApp—
 * sube una sola vez: se reaprovecha por el propio texto.
 */
export async function mudarImagenes<T>(
  valor: T,
  carpeta = 'web',
): Promise<{ valor: T; subidas: number; mapa: Map<string, string> }> {
  if (!hayAlmacen()) return { valor, subidas: 0, mapa: new Map() }
  return recorrerImagenes(valor, (d) => guardarImagen(d, carpeta))
}

/**
 * El mismo cambio, pero SIN subir nada: cambia las imágenes por sus
 * direcciones usando un mapa que ya se tiene.
 *
 * POR QUÉ HACE FALTA, y no basta con quedarse con lo que devolvió la mudanza:
 * subir veinte fotos tarda segundos, y en esos segundos la hermandad está
 * escribiendo en el editor. Guardar el resultado de la mudanza tal cual
 * significa guardar una FOTOCOPIA de la web de hace cinco segundos: lo que
 * hubiera escrito mientras tanto desaparece delante de sus ojos, sin aviso y
 * sin forma de recuperarlo.
 *
 * Con el mapa aparte, el cambio se aplica sobre lo que hay AHORA.
 */
export function sustituirImagenes<T>(valor: T, mapa: Map<string, string>): T {
  if (mapa.size === 0) return valor
  function recorrer(x: unknown): unknown {
    if (typeof x === 'string') return mapa.get(x) ?? x
    if (Array.isArray(x)) return x.map(recorrer)
    if (x && typeof x === 'object') {
      const salida: Record<string, unknown> = {}
      for (const [clave, v] of Object.entries(x)) salida[clave] = recorrer(v)
      return salida
    }
    return x
  }
  return recorrer(valor) as T
}

/**
 * El recorrido, con el subidor por fuera.
 *
 * Separado de `mudarImagenes` para poder probarlo sin Supabase delante: lo
 * que hay que asegurar aquí es que no se salta ninguna foto, que no sube dos
 * veces la misma y que devuelve el objeto con la misma forma que entró — y
 * eso no depende de a dónde vayan los archivos.
 */
export async function recorrerImagenes<T>(
  valor: T,
  subir: (dataUrl: string) => Promise<string>,
): Promise<{ valor: T; subidas: number; mapa: Map<string, string> }> {
  const yaSubidas = new Map<string, string>()
  let subidas = 0

  async function recorrer(x: unknown): Promise<unknown> {
    if (esDataUrl(x)) {
      const guardada = yaSubidas.get(x)
      if (guardada !== undefined) return guardada
      const nueva = await subir(x)
      yaSubidas.set(x, nueva)
      if (nueva !== x) subidas += 1
      return nueva
    }
    if (Array.isArray(x)) {
      // En serie, no con `Promise.all`: cuarenta subidas a la vez desde el
      // móvil de un hermano mayor con cobertura regular es como se consigue
      // que fallen todas.
      const salida: unknown[] = []
      for (const item of x) salida.push(await recorrer(item))
      return salida
    }
    if (x && typeof x === 'object') {
      const salida: Record<string, unknown> = {}
      for (const [clave, v] of Object.entries(x)) salida[clave] = await recorrer(v)
      return salida
    }
    return x
  }

  const salida = (await recorrer(valor)) as T
  /*
   * Se devuelve TAMBIÉN el mapa de «lo que era» → «dónde está ahora». Quien
   * llama lo necesita para aplicar el cambio sobre el estado de AHORA y no
   * sobre la copia con la que empezó: ver `sustituirImagenes`.
   *
   * Las que no llegaron a subir se quitan del mapa: dejarlas dentro
   * apuntándose a sí mismas no cambia nada, pero convierte el mapa en algo que
   * no significa lo que dice.
   */
  for (const [antes, ahora] of yaSubidas) if (antes === ahora) yaSubidas.delete(antes)
  return { valor: salida, subidas, mapa: yaSubidas }
}
