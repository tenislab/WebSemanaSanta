/**
 * VOLCAR UNA COPIA DE SEGURIDAD SOBRE LA BASE DE DATOS.
 *
 * ============================================================================
 * SI ERES UN PROGRAMADOR Y ACABAS DE LLEGAR: ESTO BORRA DATOS DE VERDAD
 * ============================================================================
 *
 * Es la operación más destructiva de toda la aplicación. Vacía las tablas de la
 * hermandad y vuelve a meter las filas del archivo. Léelo entero antes de
 * cambiar una línea, y lee también `supabase/restaurar-copia.sql`, que es la
 * otra mitad.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ NO EXISTÍA
 * ----------------------------------------------------------------------------
 *
 * `backup.ts` tiene `restaurarCopia()`, que escribe en `localStorage`. Con
 * Supabase conectado eso NO restaura nada: el navegador es un espejo, y al
 * recargar cada pantalla vuelve a leer de la base y lo machaca. Por eso
 * `sePuedeRestaurar()` devolvía `false` en cuanto había base de datos, y el
 * botón salía desactivado. Era lo honesto: mejor un botón apagado que uno que
 * dice «Copia restaurada» sin haber restaurado nada.
 *
 * Pero eso dejaba a las hermandades con copias que no se podían usar. Y una
 * copia que no se puede restaurar no es una copia: es un archivo.
 *
 * (La copia que hace Supabase del proyecto no sirve para esto: se lleva las
 * cincuenta hermandades por delante. Restaurarla para deshacer el error de una
 * sola sería tirar hacia atrás el trabajo de las otras cuarenta y nueve.)
 *
 * ----------------------------------------------------------------------------
 * EL ORDEN. NO SE PUEDE CAMBIAR.
 * ----------------------------------------------------------------------------
 *
 *   1. SE DESCARGA UNA COPIA DE LO QUE HAY AHORA, al disco de quien lo lanza.
 *      Y SI ESO FALLA, NO SE SIGUE. Es el paso más importante del fichero:
 *      restaurar es exactamente el momento en el que alguien puede haberse
 *      equivocado de archivo, y sin este paso no habría marcha atrás de la
 *      marcha atrás.
 *   2. Se vacían las tablas, con la función del servidor y sus cuatro
 *      cerraduras.
 *   3. Se meten las filas del archivo, tabla por tabla, en el orden de
 *      `TABLAS_COPIA` (padres antes que hijos), de 200 en 200.
 *   4. Se restaura lo del navegador (ajustes locales y adjuntos).
 *
 * ENTRE EL 2 Y EL 3 LA HERMANDAD NO TIENE DATOS. Son unos segundos y no se
 * puede evitar desde el navegador: para que fuera atómico habría que mandarle
 * el archivo entero al servidor, y pesa megas. Por eso el paso 1 no es
 * opcional.
 *
 * ----------------------------------------------------------------------------
 * LA DECISIÓN QUE MÁS SE VA A PREGUNTAR: SE QUITA `hermandad_id` DE CADA FILA
 * ----------------------------------------------------------------------------
 *
 * Las filas de la copia traen dentro el `hermandad_id` que tenían cuando se
 * hizo. Se BORRA ese campo antes de insertar, y la base lo rellena sola con
 * `default hermandad_actual()`.
 *
 * Dos motivos, los dos importantes:
 *
 *   · UNA COPIA SE PUEDE VOLCAR EN OTRA HERMANDAD. Si una hermandad rehace su
 *     proyecto de Supabase, su identificador cambia. Mandando el viejo, RLS
 *     rechaza TODAS las filas y la restauración deja la hermandad vacía —que
 *     es el peor final posible de una restauración—.
 *   · NO SE PUEDE ESCRIBIR EN OTRA HERMANDAD NI QUERIENDO. Si el archivo
 *     trajera el identificador de otra —o alguien lo editara a mano—, sin este
 *     borrado se estaría intentando escribir en la casa de al lado. Con él, el
 *     destino lo decide la base a partir de quién está pidiendo, no el
 *     contenido de un archivo que se ha abierto de un disco duro.
 */
import { supabase, isSupabaseConfigured } from './supabase'
import { TABLAS_COPIA, type CopiaSeguridad } from './backup'

/** De cuántas en cuántas se insertan las filas. El mismo criterio que `supabaseSync`. */
const DE_UNA_VEZ = 200

export interface ResultadoRestauracion {
  /** Cuántas filas han entrado, por tabla. */
  metidas: Record<string, number>
  /** Qué ha fallado. Vacío es que ha ido todo. */
  fallos: string[]
}

/**
 * ¿Se puede volcar una copia contra la base de datos desde este navegador?
 *
 * Solo dice si hay base de datos. QUIÉN puede hacerlo —solo el titular— lo
 * decide el servidor, y tiene que decidirlo él: una comprobación en el
 * navegador es una sugerencia, no una cerradura.
 */
export function sePuedeVolcarEnLaBase(): boolean {
  return isSupabaseConfigured && !!supabase
}

/** Trocea, igual que en `supabaseSync`. */
function trozos<T>(xs: T[], cuantos = DE_UNA_VEZ): T[][] {
  const partes: T[][] = []
  for (let i = 0; i < xs.length; i += cuantos) partes.push(xs.slice(i, i + cuantos))
  return partes
}

/**
 * Quita de la fila lo que no le toca decidir al archivo. Ver arriba el porqué
 * de `hermandad_id`.
 */
function filaLimpia(fila: unknown): Record<string, unknown> | null {
  if (typeof fila !== 'object' || fila === null) return null
  const copia = { ...(fila as Record<string, unknown>) }
  delete copia.hermandad_id
  return copia
}

/**
 * El identificador de la hermandad de quien está dentro, que hace falta para
 * confirmar el vaciado. Se le pregunta al servidor: es la única fuente que no
 * se puede falsear desde aquí.
 */
export async function miHermandadId(): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('mi_hermandad_id')
  if (error || typeof data !== 'string') return null
  return data
}

/**
 * ¿ENCAJA ESTA COPIA EN ESTA BASE? SE PREGUNTA ANTES DE VACIAR NADA.
 *
 * ============================================================================
 * EL FALLO QUE ESTO CIERRA, Y ES EL PEOR QUE TIENE LA APLICACIÓN
 * ============================================================================
 *
 * El orden de la restauración es: se vacía, y luego se llena. Si las filas del
 * archivo NO ENCAJAN —una columna que la copia trae y esta base todavía no
 * tiene— eso no se descubría hasta el paso de llenar. O sea, DESPUÉS DE HABER
 * VACIADO.
 *
 * Y no es un caso rebuscado: es EL caso. La base la actualiza cada hermandad a
 * mano pegando `ACTUALIZAR.sql`, así que «aplicación nueva, base vieja» es el
 * estado normal durante días o semanas (ver `versionEsquema.ts`). Una copia
 * hecha el martes con la base al día, volcada el jueves en un proyecto que se
 * quedó atrás: las tablas se vacían, Postgres rechaza los `insert` uno a uno, y
 * la hermandad se queda con MENOS datos que antes de «restaurar».
 *
 * Eso convierte la red de seguridad en la causa de la pérdida.
 *
 * ----------------------------------------------------------------------------
 * SE MANDAN LOS NOMBRES, NO EL ARCHIVO
 * ----------------------------------------------------------------------------
 *
 * Unos cientos de bytes. Mandar la copia entera para que el servidor la probara
 * sería mandar megas por la red, y es justo por eso por lo que esto no es
 * atómico de entrada.
 *
 * Y se miran las columnas de UNA fila por tabla, no de todas: en una copia
 * hecha por la propia aplicación todas las filas de una tabla tienen las mismas
 * columnas. Recorrer cuatrocientas para encontrar lo mismo cuatrocientas veces
 * no añade nada.
 */
export async function loQueNoEncaja(copia: CopiaSeguridad): Promise<string[]> {
  if (!supabase) return []
  const muestra: Record<string, string[]> = {}
  for (const [tabla, filas] of Object.entries(copia.tablas ?? {})) {
    const primera = (filas as unknown[])[0]
    if (!primera || typeof primera !== 'object') continue
    const cols = Object.keys(primera as Record<string, unknown>)
      // `hermandad_id` se quita antes de insertar (ver `filaLimpia`), así que
      // no cuenta: avisar de él sería avisar de algo que nunca se manda.
      .filter((c) => c !== 'hermandad_id')
    if (cols.length > 0) muestra[tabla] = cols
  }
  if (Object.keys(muestra).length === 0) return []

  const { data, error } = await supabase.rpc('columnas_que_faltan_para_restaurar', { p_columnas: muestra })
  /*
   * SI NO SE PUEDE PREGUNTAR, SE DEJA PASAR.
   *
   * Es deliberado y cuesta pensarlo. La comprobación existe para evitar una
   * pérdida de datos, así que la tentación es bloquear ante la duda — pero una
   * base que aún no tiene ESTA función (que es exactamente una base atrasada)
   * daría error 404, y bloquear dejaría sin restaurar justo a quien más lo
   * necesita, sin ninguna otra manera de hacerlo.
   *
   * Lo que protege en ese caso es el paso 1, la copia de resguardo, que no es
   * opcional. Esto es un cinturón de más, no el único.
   */
  if (error || !Array.isArray(data)) return []
  return (data as { tabla: string; columna: string }[]).map((x) => `${x.tabla}.${x.columna}`)
}

/**
 * Vacía y vuelve a llenar. NO llama al paso 1 (la copia de resguardo): eso lo
 * hace la pantalla, porque necesita el navegador para descargar el archivo y
 * porque tiene que poder pararlo todo si la descarga falla.
 *
 * Lanza si no se puede ni empezar. Si algo falla a mitad, NO lanza: devuelve
 * los fallos. La diferencia importa — a mitad de camino, callarse y lanzar
 * dejaría a quien lo lanzó sin saber qué tablas entraron y cuáles no, que es
 * justo lo que hay que saber para arreglarlo a mano.
 */
export async function volcarCopiaEnLaBase(copia: CopiaSeguridad): Promise<ResultadoRestauracion> {
  if (!supabase) throw new Error('No hay base de datos conectada.')

  const tablas = copia.tablas
  if (!tablas || Object.keys(tablas).length === 0) {
    throw new Error(
      'Esta copia se hizo sin base de datos conectada: no trae las tablas, solo los ajustes de aquel '
      + 'navegador. No se puede volcar en la base de datos.',
    )
  }

  /*
   * UNA COPIA CON FALLOS NO SE VUELCA. NUNCA.
   *
   * `crearCopia` apunta en `fallos` las tablas que no pudo traer. Volcar una
   * copia así borraría el censo entero para meter una parte: el resultado sería
   * una hermandad con menos datos que antes de «restaurar». Es el escenario que
   * convierte una red de seguridad en la causa de la pérdida.
   */
  if ((copia.fallos ?? []).length > 0) {
    throw new Error(
      `Esta copia está incompleta: no se pudo traer ${(copia.fallos ?? []).join(', ')}. `
      + 'Volcarla borraría datos para meter menos de los que hay. Usa otra copia.',
    )
  }

  const mia = await miHermandadId()
  if (!mia) {
    throw new Error('No se ha podido saber de qué hermandad eres. Vuelve a entrar e inténtalo otra vez.')
  }

  /*
   * Y AQUÍ, JUSTO ANTES DE VACIAR, LA ÚLTIMA COMPROBACIÓN.
   *
   * Va después de todo lo demás y pegada al `vaciar` a propósito: es lo último
   * que se mira antes de que ya no haya vuelta atrás. Si la copia no encaja, se
   * lanza — y aquí lanzar es seguro porque todavía no se ha borrado nada.
   */
  const noEncaja = await loQueNoEncaja(copia)
  if (noEncaja.length > 0) {
    throw new Error(
      'Esta copia no encaja en la base de datos: le faltan columnas que la copia sí trae '
      + `(${noEncaja.slice(0, 6).join(', ')}${noEncaja.length > 6 ? `, y ${noEncaja.length - 6} más` : ''}). `
      + 'NO se ha tocado nada. Pega «supabase/ACTUALIZAR.sql» en el SQL Editor de Supabase para poner '
      + 'la base al día, y vuelve a intentarlo: si se hubiera vaciado primero, esos datos se habrían '
      + 'perdido.',
    )
  }

  // --- Paso 2: vaciar. Las cerraduras están en el servidor. ---
  const { error: eVaciar } = await supabase.rpc('vaciar_hermandad_para_restaurar', { confirmacion: mia })
  if (eVaciar) {
    /*
     * Aquí NO se ha borrado nada: la función es una sola transacción, así que
     * si da error no ha llegado a hacer ningún `delete`. Se puede lanzar
     * tranquilo, sin dejar nada a medias.
     */
    throw new Error(`No se ha podido vaciar para restaurar: ${eVaciar.message}`)
  }

  // --- Paso 3: llenar, en el orden de TABLAS_COPIA (padres antes que hijos) ---
  const metidas: Record<string, number> = {}
  const fallos: string[] = []
  for (const tabla of TABLAS_COPIA) {
    const filas = (tablas[tabla] ?? []).map(filaLimpia).filter(Boolean) as Record<string, unknown>[]
    metidas[tabla] = 0
    for (const parte of trozos(filas)) {
      const { error } = await supabase.from(tabla).insert(parte)
      if (error) {
        /*
         * SE SIGUE CON LAS DEMÁS, no se corta. Es lo contrario de lo que pide
         * el instinto y es lo correcto aquí: en este punto las tablas YA están
         * vacías, así que pararse deja a la hermandad con menos datos que si se
         * intenta meter todo lo que se pueda. Lo que no entre se dice por su
         * nombre, tabla a tabla, para poder repasarlo.
         */
        fallos.push(`${tabla} (${parte.length} filas): ${error.message}`)
      } else {
        metidas[tabla] += parte.length
      }
    }
  }

  return { metidas, fallos }
}
