/**
 * LA FUENTE DE UNA PANTALLA QUE VIVE EN VARIOS FICHEROS.
 *
 * ============================================================================
 * POR QUÉ HACE FALTA ESTO
 * ============================================================================
 *
 * Doce ficheros de prueba vigilan el editor de la web LEYENDO SU FUENTE:
 * «que el dominio se siga pidiendo aquí», «que no se haya duplicado el mensaje
 * de deshacer», «que el teléfono pase por su validador». Todos hacían
 * `readFile('src/pages/app/WebPublica.tsx')`.
 *
 * Y ese fichero tenía 4.770 líneas y había que partirlo. Al partirlo, los
 * guardias se dividen en dos clases y UNA DE LAS DOS ES SILENCIOSA:
 *
 *   · `caso('...', true, /lo bueno/.test(fuente))` → se pone ROJO. Molesta, se
 *     ve, se arregla. Sin peligro.
 *   · `caso('...', false, /lo malo/.test(fuente))` → se queda VERDE. El patrón
 *     malo ya no está en ESE fichero porque no está nada, y la comprobación
 *     pasa a no vigilar absolutamente nada sin decirlo. Es justo la clase de
 *     fallo que este proyecto ya ha pagado dos veces.
 *
 * Así que la fuente de una pantalla partida se pide ENTERA, por su nombre, y no
 * fichero a fichero. El día que se mueva otro trozo, los guardias siguen
 * mirando donde tienen que mirar.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const raiz = new URL('..', import.meta.url).pathname

/** Un fichero, tal cual. */
export async function fuente(ruta) {
  return readFile(join(raiz, ruta), 'utf8')
}

/**
 * Todos los ficheros de una carpeta, pegados, con una marca de dónde empieza
 * cada uno. La marca va en un comentario para que quien lea un fallo sepa en
 * qué fichero mirar sin tener que buscar a mano.
 */
async function pegarCarpeta(carpeta) {
  let nombres
  try {
    nombres = (await readdir(join(raiz, carpeta))).filter((n) => /\.tsx?$/.test(n)).sort()
  } catch {
    return '' // la carpeta puede no existir todavía
  }
  const trozos = []
  for (const n of nombres) {
    trozos.push(`\n/* ===== ${carpeta}/${n} ===== */\n`)
    trozos.push(await readFile(join(raiz, carpeta, n), 'utf8'))
  }
  return trozos.join('')
}

/**
 * EL EDITOR DE LA WEB PÚBLICA, ENTERO.
 *
 * La pantalla (`WebPublica.tsx`) más las veintitrés pestañas y los ayudantes
 * que viven en `src/pages/app/web/`. Es lo que tienen que leer los guardias que
 * antes leían el fichero gordo.
 */
export async function fuenteDelEditorWeb() {
  return (await fuente('src/pages/app/WebPublica.tsx')) + (await pegarCarpeta('src/pages/app/web'))
}

/**
 * La fuente de lo que vive en esa ruta, contando con que una pantalla puede
 * estar partida en varios ficheros.
 *
 * Sirve para los guardias que recorren una LISTA de rutas —«estos seis
 * ficheros usan `problemaDeTelefono`»—: se cambia `readFile` por esto y la
 * lista se queda como estaba, con el nombre de la pantalla, que es lo que se
 * entiende al leerla.
 */
export async function fuenteDe(ruta) {
  if (ruta === 'src/pages/app/WebPublica.tsx') return fuenteDelEditorWeb()
  return fuente(ruta)
}
