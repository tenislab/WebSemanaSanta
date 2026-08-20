/**
 * A qué hermandad pertenece quien está usando la aplicación.
 *
 * Todas las hermandades comparten un solo proyecto de Supabase. Quien decide
 * qué filas ve cada uno es la base de datos, no esto: cada tabla lleva un
 * `hermandad_id` y unas políticas que solo dejan pasar las filas de la
 * hermandad de quien pregunta (ver `supabase/multi-hermandad.sql`). Aquí NO
 * se filtra nada, y es a propósito: si el filtro viviera en el navegador,
 * bastaría con abrir las herramientas de desarrollo para saltárselo.
 *
 * Entonces, ¿para qué hace falta saber el id aquí? Para tres cosas que la
 * base de datos no puede adivinar sola:
 *
 *   1. Los archivos adjuntos, que van en una carpeta con el id por nombre.
 *   2. Los formularios de la web pública, que los rellena alguien SIN sesión:
 *      hay que decir a qué hermandad va el mensaje.
 *   3. La entrada del hermano, que pregunta por su hermandad antes del DNI.
 *
 * En modo local (sin Supabase) todo esto devuelve `null` y la aplicación
 * sigue funcionando con los datos del navegador, como hasta ahora.
 */
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * El id resuelto, guardado para no preguntarlo en cada subida de archivo.
 * `undefined` = todavía no se ha preguntado; `null` = se preguntó y esta
 * cuenta no pertenece a ninguna hermandad.
 */
let cache: string | null | undefined
let enCurso: Promise<string | null> | null = null

/**
 * La hermandad de la sesión actual, preguntándoselo a la base de datos.
 *
 * Se pregunta una sola vez y se recuerda. Si dos partes de la pantalla lo
 * piden a la vez —pasa al abrir el Archivo, que carga varios adjuntos de
 * golpe— comparten la misma consulta en lugar de lanzar una cada una.
 */
export async function hermandadActualId(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null
  if (cache !== undefined) return cache
  if (enCurso) return enCurso

  const cliente = supabase
  enCurso = (async () => {
    const { data, error } = await cliente.rpc('hermandad_actual')
    // Un error aquí (sin sesión, red caída) no se recuerda: se deja sin
    // resolver para que el siguiente intento vuelva a preguntar.
    if (error) return null
    cache = (data as string | null) ?? null
    return cache
  })()

  try {
    return await enCurso
  } finally {
    enCurso = null
  }
}

/**
 * Se asegura de que quien acaba de entrar tiene hermandad, y devuelve cuál.
 *
 * La aplicación llama a esto al iniciar sesión. Es seguro llamarlo siempre:
 * si la cuenta ya pertenece a una hermandad —da igual si como titular, como
 * personal o como hermana— devuelve esa y no crea nada. Solo crea una nueva
 * cuando la cuenta no tiene ninguna, que es el caso de quien se acaba de
 * registrar para dar de alta su hermandad.
 *
 * Se hace al entrar y no al registrarse porque, con la confirmación por
 * correo activada, al registrarse todavía no hay sesión: el nombre de la
 * hermandad viaja en los datos de la cuenta y se usa la primera vez que
 * entra de verdad.
 */
export async function asegurarHermandad(nombre: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.rpc('crear_hermandad', { p_nombre: nombre })
  if (error) {
    console.error('No se pudo asegurar la hermandad de esta cuenta:', error.message)
    return null
  }
  cache = (data as string | null) ?? null
  return cache
}

/** Al cerrar sesión. Sin esto, el siguiente en entrar heredaría el id anterior. */
export function olvidarHermandad(): void {
  cache = undefined
  enCurso = null
}

/**
 * Las hermandades dadas de alta, solo id y nombre, para que un hermano elija
 * la suya antes de escribir el DNI. No devuelve ningún dato de nadie: es una
 * lista de nombres, la misma que hay en cualquier guía de hermandades.
 */
export async function hermandadesPublicas(): Promise<{ id: string; nombre: string }[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase.rpc('hermandades_publicas')
  if (error || !Array.isArray(data)) return []
  return data as { id: string; nombre: string }[]
}

/* ---------------------------------------------------------------------------
   La hermandad de una página pública
   ------------------------------------------------------------------------ */

/**
 * Cuando alguien abre la web de una hermandad —o el área del hermano y elige
 * la suya— esa página entera es de UNA hermandad concreta, aunque quien la
 * mira no haya iniciado sesión.
 *
 * Los formularios de esa página (contacto, donativo, lotería, solicitud de
 * alta) tienen que decir a qué hermandad va lo que mandan: la base de datos
 * no puede adivinarlo, porque no hay sesión de la que deducirlo. Se guarda
 * aquí, y no se va pasando de componente en componente, porque no es un dato
 * de un formulario: es de qué hermandad va la página que se está viendo.
 *
 * Que esto lo ponga el navegador NO abre ningún agujero. Lo peor que puede
 * hacer alguien cambiándolo es mandar un mensaje al buzón de otra hermandad,
 * que es exactamente lo que ya podría hacer abriendo la web de esa hermandad
 * y rellenando su formulario. Lo que no puede es LEER nada: de eso se encargan
 * las políticas de Supabase, que no miran esto para nada.
 */
let hermandadDeLaPagina: string | null = null

export function fijarHermandadDeLaPagina(id: string | null): void {
  hermandadDeLaPagina = id
}

export function getHermandadDeLaPagina(): string | null {
  return hermandadDeLaPagina
}

/**
 * A qué hermandad mandar lo que se envía desde un formulario: la de la página
 * pública si la hay y, si no, la de la sesión abierta (un hermano que pide la
 * baja desde su área ya ha entrado).
 */
export async function hermandadDestino(): Promise<string | null> {
  return getHermandadDeLaPagina() ?? (await hermandadActualId())
}

/* ---------------------------------------------------------------------------
   La copia local, atada a su hermandad
   ------------------------------------------------------------------------ */

/** De qué hermandad es lo que hay copiado ahora mismo en este navegador. */
const CLAVE_ESPEJO = 'cabildo-hermandad-espejada'

/**
 * Lo que se queda al cambiar de hermandad: preferencias de ESTE navegador y
 * cosas de la sesión. No son datos de nadie.
 *
 * La lista es de lo que se CONSERVA, no de lo que se borra, y es a propósito:
 * así, cualquier cosa que se guarde en el futuro se borra por defecto. Al
 * revés —una lista de lo que hay que borrar— bastaría con olvidarse de añadir
 * una para volver a filtrar datos sin enterarse.
 */
const NO_ES_DE_LA_HERMANDAD = new Set([
  'cabildo-tema',
  'cabildo-theme',
  'cabildo-cfg-seccion',
  'cabildo-web-pestana',
  'cabildo-alta',
  'cabildo-demo-modo',
  'cabildo-demo-user',
  'cabildo-sync-error',
  CLAVE_ESPEJO,
])

/**
 * Tira la copia local si es de OTRA hermandad.
 *
 * Por qué hace falta. La aplicación guarda una copia de los datos en el
 * navegador para que la pantalla no se quede en blanco mientras llegan de la
 * red. Esa copia no sabía de quién era, así que en un mismo ordenador —el de
 * la casa hermandad, sin ir más lejos— quien entraba después veía por un
 * momento el censo de quien había entrado antes. La base de datos lo impedía
 * perfectamente; el navegador no.
 *
 * Se llama con la hermandad de la sesión recién abierta. Si coincide con la
 * copiada, no se toca nada (que es el caso normal, y así no se pierde la
 * ventaja de tener la copia). Si no coincide, o si no hay sesión, se tira
 * entera y las pantallas la vuelven a pedir a Supabase.
 */
export function ajustarEspejoALaHermandad(hermandadId: string | null): void {
  if (!isSupabaseConfigured) return
  try {
    if (hermandadId && localStorage.getItem(CLAVE_ESPEJO) === hermandadId) return

    const aBorrar: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i)
      if (clave && clave.startsWith('cabildo-') && !NO_ES_DE_LA_HERMANDAD.has(clave)) {
        aBorrar.push(clave)
      }
    }
    aBorrar.forEach((c) => localStorage.removeItem(c))

    if (hermandadId) localStorage.setItem(CLAVE_ESPEJO, hermandadId)
    else localStorage.removeItem(CLAVE_ESPEJO)
  } catch {
    // Sin localStorage no hay copia que tirar.
  }
}


/**
 * ¿La cuenta de esta sesión lleva la hermandad (está en `titulares`)?
 *
 * Hace falta para no confundir «el titular, que no aparece en la tabla de
 * personal» con «una cuenta que no sabemos identificar». Antes esa duda se
 * resolvía abriendo el panel entero, que es exactamente al revés de lo que hay
 * que hacer.
 */
export async function soyTitular(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return true
  try {
    const { data } = await supabase.auth.getUser()
    const uid = data.user?.id
    if (!uid) return false
    const { data: filas, error } = await supabase
      .from('titulares')
      .select('auth_user_id')
      .eq('auth_user_id', uid)
      .maybeSingle()
    if (error) return false
    return Boolean(filas)
  } catch {
    return false
  }
}


/** El identificador de la cuenta de esta sesión, o null si no hay ninguna. */
export async function authUserIdActual(): Promise<string | undefined> {
  if (!isSupabaseConfigured || !supabase) return undefined
  try {
    const { data } = await supabase.auth.getUser()
    return data.user?.id
  } catch {
    return undefined
  }
}


/**
 * ¿Esta cuenta es SOLO de hermano?
 *
 * «Solo» es la palabra importante. En una hermandad casi todo el que gestiona
 * es además hermano: el Hermano Mayor lo es, la secretaria lo es, el tesorero
 * paga su cuota y saca su papeleta como cualquiera. A esos NO se les puede
 * echar del panel.
 *
 * Se pregunta a la base de datos y no al metadata de la sesión por dos motivos:
 * el metadata lo puede reescribir el propio usuario, y además solo sabe decir
 * «es hermano», no «es solo hermano», que es lo que hay que saber aquí.
 */
export async function soloEsHermano(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false
  try {
    const { data } = await supabase.auth.getUser()
    const uid = data.user?.id
    if (!uid) return false
    const [hermano, titular, personal] = await Promise.all([
      supabase.from('hermanos').select('id').eq('auth_user_id', uid).limit(1).maybeSingle(),
      supabase.from('titulares').select('auth_user_id').eq('auth_user_id', uid).limit(1).maybeSingle(),
      supabase.from('personal').select('id').eq('auth_user_id', uid).eq('activo', true).limit(1).maybeSingle(),
    ])
    return Boolean(hermano.data) && !titular.data && !personal.data
  } catch {
    // Ante la duda NO se echa a nadie del panel: las políticas de la base de
    // datos siguen mandando y no dejarán ver lo que no toque.
    return false
  }
}
