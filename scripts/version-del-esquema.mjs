/**
 * LA VERSIÓN DEL ESQUEMA: QUÉ NÚMERO SE SELLA, Y CUÁNDO SUBE.
 *
 * ============================================================================
 * EL PUNTO CIEGO QUE ESTO CIERRA
 * ============================================================================
 *
 * Hasta aquí la versión era EL NÚMERO DE PIEZAS del instalador. Subía sola al
 * añadir un fichero .sql, que era lo que se quería: imposible de olvidar. Pero
 * tenía un agujero, apuntado en el plan de bugs (fase 5) y que mordió el día
 * en que se cerró: EDITAR una pieza que ya existe —añadirle una columna a
 * `reglas_automaticas`, una función a `soporte.sql`— NO sube el número. La
 * aplicación no avisaba a nadie de que había que volver a pegar
 * `ACTUALIZAR.sql`, y al guardar una regla la base contestaba que la columna
 * `redes` no existe.
 *
 * ============================================================================
 * CÓMO FUNCIONA AHORA
 * ============================================================================
 *
 * `supabase/VERSION.json` guarda dos cosas: la versión (un entero que solo
 * sube) y la HUELLA de las piezas (un hash del contenido de todas, en orden).
 *
 * Los generadores, antes de escribir nada, calculan la huella de las piezas
 * de hoy. Si es la misma que la guardada, la versión no cambia. Si es distinta
 * —se ha tocado cualquier pieza, se ha añadido una o se ha reordenado— la
 * versión sube uno y se guarda la huella nueva. Nadie tiene que acordarse de
 * nada: el generador ya había que ejecutarlo, y `npm test` comprueba que la
 * huella guardada es la de las piezas (o sea, que se ejecutó).
 *
 * SIGUE SIENDO UN ENTERO, y por eso todo lo de la base (`sellar_esquema`,
 * `version_del_esquema`, el diagnóstico) queda como estaba: lo único que
 * cambia es de dónde sale el número.
 *
 * Y YA NO ES «CUÁNTAS PIEZAS FALTAN». Antes la diferencia entre la versión de
 * la aplicación y la de la base contaba piezas; ahora cuenta cambios, y dos
 * ediciones de la misma pieza en la misma tarde son dos. El aviso lo dice
 * como es: «tu base va por la 69 y la aplicación necesita la 71».
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
export const FICHERO_VERSION = join(raiz, 'supabase', 'VERSION.json')

/**
 * La huella de las piezas: un hash de su contenido, en el orden del
 * instalador, con el nombre de cada una delante. El nombre entra para que
 * renombrar o reordenar cuente como cambio, que lo es: cambia lo que se
 * ejecuta y cuándo.
 */
export async function huellaDeLasPiezas(piezas) {
  const h = createHash('sha256')
  for (const [fichero] of piezas) {
    h.update(fichero + '\n')
    h.update(await readFile(join(raiz, 'supabase', fichero), 'utf8'))
    h.update('\n')
  }
  return h.digest('hex').slice(0, 16)
}

/**
 * QUÉ VERSIÓN TOCA, dada la guardada y la huella de hoy. Pura y aparte para
 * poder probarla con datos:
 *
 *   · misma huella  → la misma versión (no se ha tocado nada);
 *   · otra huella   → una más;
 *   · y nunca baja, pase lo que pase con el fichero.
 */
export function versionQueToca(guardada, huellaDeHoy) {
  // Sin fichero, o con un número roto, se parte de 0: la primera versión es la 1.
  const version = Math.max(0, Math.floor(Number(guardada?.version) || 0))
  if (guardada?.huella === huellaDeHoy) return { version, huella: huellaDeHoy, cambia: false }
  return { version: version + 1, huella: huellaDeHoy, cambia: true }
}

export async function leerVersionGuardada() {
  try {
    return JSON.parse(await readFile(FICHERO_VERSION, 'utf8'))
  } catch {
    // Sin fichero: la primera vez. Se arranca desde 0 y `versionQueToca` sube a 1.
    return { version: 0, huella: '' }
  }
}

/**
 * La versión que hay que sellar HOY, escribiendo `VERSION.json` si ha
 * cambiado. La llaman los generadores; importarlo desde una prueba no toca
 * nada si se le pasa `escribir: false`.
 */
export async function versionDeHoy(piezas, { escribir = true } = {}) {
  const guardada = await leerVersionGuardada()
  const hoy = versionQueToca(guardada, await huellaDeLasPiezas(piezas))
  if (hoy.cambia && escribir) {
    await writeFile(FICHERO_VERSION, JSON.stringify({ version: hoy.version, huella: hoy.huella }, null, 2) + '\n')
  }
  return hoy
}
