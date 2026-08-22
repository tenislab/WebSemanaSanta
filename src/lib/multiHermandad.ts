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
import type { Cargo } from '../data/documentos'

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
export interface HermandadPublica {
  id: string
  nombre: string
  /** Color de marca de la hermandad. Los suyos, no los de Gobergo. */
  colorPrimario: string
  colorSecundario: string
  logoDataUrl: string | null
}

export async function hermandadesPublicas(): Promise<HermandadPublica[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase.rpc('hermandades_publicas')
  if (error || !Array.isArray(data)) return []
  return (data as Record<string, string | null>[]).map((h) => ({
    id: String(h.id),
    nombre: String(h.nombre ?? ''),
    // Los de Gobergo si la hermandad todavía no ha puesto los suyos. La
    // función del servidor ya los rellena, pero una lista guardada por una
    // versión anterior puede no traerlos.
    colorPrimario: h.color_primario || '#6A1A23',
    colorSecundario: h.color_secundario || '#C5A059',
    logoDataUrl: h.logo_data_url ?? null,
  }))
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
    // POR RPC Y NO CONSULTANDO LA TABLA. `titulares` tiene una política que se
    // llama `titulares_nadie` y hace exactamente eso: nadie la lee desde el
    // navegador, ni siquiera para mirarse a sí mismo. Es correcto —esa tabla
    // dice quién manda en cada hermandad— pero significa que preguntar
    // «¿estoy yo ahí?» con un select devuelve vacío SIEMPRE.
    //
    // Y vacío se interpretaba como «no es titular», así que al Hermano Mayor
    // recién registrado le salía el panel con Inicio y Seguridad y nada más,
    // y su nombre con un «__desconocido__» debajo. La aplicación entera vacía
    // para quien acababa de crear la hermandad.
    //
    // `es_titular()` es SECURITY DEFINER: mira la tabla por dentro, saltándose
    // la política, y solo devuelve un sí o un no sobre QUIEN PREGUNTA.
    const { data, error } = await supabase.rpc('es_titular')
    if (error) return false
    return data === true
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
 * Mi propia ficha del censo: el cargo que llevo y si estoy de baja.
 *
 * SE PREGUNTA A LA BASE, no al espejo del navegador, y no es un capricho.
 * El espejo de `localStorage` está vacío la primera vez que alguien abre la
 * aplicación en un navegador nuevo, y el área del hermano además espeja solo
 * SU fila. Un secretario que entrara al panel desde el ordenador de la casa de
 * hermandad se habría quedado sin su cargo, y sin explicación.
 *
 * Las políticas ya dejan a cada uno leer su propia ficha, así que esta consulta
 * la puede hacer cualquiera y solo devuelve lo suyo.
 *
 * Si falla, devuelve `null`: sin cargo. NUNCA hay que interpretar un fallo de
 * esta consulta como «es el titular».
 */
export async function miFichaDeHermano(): Promise<{ cargo: Cargo | null; estado: string } | null> {
  if (!isSupabaseConfigured || !supabase) return null
  try {
    const { data } = await supabase.auth.getUser()
    const uid = data.user?.id
    if (!uid) return null
    const { data: fila, error } = await supabase
      .from('hermanos').select('cargo, estado').eq('auth_user_id', uid).limit(1).maybeSingle()
    if (error || !fila) return null
    return { cargo: (fila.cargo as Cargo | null) ?? null, estado: (fila.estado as string) ?? '' }
  } catch {
    return null
  }
}

/**
 * Qué es esta cuenta: hermano, gestión, o LAS DOS COSAS.
 *
 * Las dos cosas es lo normal, no la excepción. El Hermano Mayor es hermano y
 * lleva la hermandad. La secretaria igual. El tesorero paga su cuota y saca su
 * papeleta como cualquiera.
 *
 * Por eso esto devuelve los dos papeles por separado en vez de un «es hermano»
 * de sí o no: con un solo dato hay que elegir uno y cerrarle el otro, que es
 * justo lo que no queremos.
 */
export interface PapelesDeLaCuenta {
  /** Tiene ficha en el censo: puede entrar en su área del hermano. */
  esHermano: boolean
  /** Es titular o personal activo: puede entrar en el panel. */
  gestiona: boolean
  /**
   * ¿Se ha podido averiguar de verdad, o alguna consulta falló?
   *
   * ESTE CAMPO ES EL ARREGLO. Antes no existía, y por eso «no he podido
   * saberlo» y «he mirado y no es» acababan siendo la misma cosa: las dos
   * dejaban `gestiona` en falso, y con `gestiona` falso se echa a la cuenta
   * del panel al área del hermano.
   *
   * O sea que bastaba con que la llamada a `es_titular()` fallara una vez —la
   * función todavía sin desplegar, un permiso, un corte de red de medio
   * segundo— para que al Hermano Mayor le dijeran que él no lleva su
   * hermandad y lo mandaran al área del hermano. Y desde allí no hay vuelta:
   * vuelve a pulsar «gestiono la hermandad» y vuelve a salir rebotado.
   *
   * Con `seguro` en falso, quien decide algo con esto NO decide: espera o se
   * queda como está. Cerrar la puerta del panel es una decisión demasiado
   * gorda para tomarla sin saber.
   */
  seguro: boolean
}

const SIN_PAPELES: PapelesDeLaCuenta = { esHermano: false, gestiona: false, seguro: true }

export async function papelesDeLaCuenta(): Promise<PapelesDeLaCuenta> {
  // Sin base de datos no hay cuentas que valgan: modo local, todo abierto.
  if (!isSupabaseConfigured || !supabase) return SIN_PAPELES
  try {
    const { data } = await supabase.auth.getUser()
    const uid = data.user?.id
    if (!uid) return SIN_PAPELES
    const [hermano, titular, personal] = await Promise.all([
      // `cargo` y `estado`, no solo `id`: son los que dicen si esta persona
      // gestiona. Antes se pedía solo el id y la información con la que
      // decidir ni siquiera llegaba al navegador.
      supabase.from('hermanos').select('id, cargo, estado').eq('auth_user_id', uid).limit(1).maybeSingle(),
      // Por RPC: la tabla `titulares` no se puede leer desde el navegador
      // (política `titulares_nadie`). Ver el comentario de `soyTitular`.
      supabase.rpc('es_titular'),
      supabase.from('personal').select('id').eq('auth_user_id', uid).eq('activo', true).limit(1).maybeSingle(),
    ])

    /*
     * Los errores se MIRAN, uno por uno.
     *
     * `supabase.rpc()` y `.select()` no lanzan excepción cuando algo va mal:
     * devuelven `{ data: null, error: {...} }`. Así que el `catch` de abajo no
     * se enteraba de nada y el `data: null` se colaba como un «no» perfectamente
     * creíble. Ese es el fallo entero, en una línea.
     *
     * De los tres, los dos que dicen si gestiona son los que importan: si
     * cualquiera de ellos ha fallado, no se sabe y no se echa a nadie.
     */
    const sabemosSiGestiona = !titular.error && !personal.error && !hermano.error
    /*
     * Las TRES formas de gestionar, sumadas: el titular, quien está en la
     * tabla de personal, y —la nueva— quien lleva un cargo en su propia ficha
     * de hermano. Sin el tercer sumando, el secretario que es hermano nº 47
     * sale como «no gestiona» y la aplicación le trata como hermano de a pie.
     *
     * 'Hermano de a pie' no cuenta: es un cargo del catálogo sin ningún
     * módulo, así que llevarlo no es gestionar nada.
     */
    const conCargo = hermano.data?.cargo as string | null | undefined
    const gestionaPorCargo = Boolean(conCargo)
      && conCargo !== 'Hermano de a pie'
      && hermano.data?.estado !== 'Baja'
    const gestiona = titular.data === true || Boolean(personal.data) || gestionaPorCargo

    return {
      esHermano: !hermano.error && Boolean(hermano.data),
      // Si no se ha podido preguntar, se da por hecho que sí gestiona: el
      // daño de dejar entrar de más lo paran las políticas de la base de
      // datos, que no enseñan lo que no toca. El daño de echar de menos es
      // dejar al Hermano Mayor fuera de su propia hermandad.
      gestiona: sabemosSiGestiona ? gestiona : true,
      seguro: sabemosSiGestiona,
    }
  } catch {
    // Ante la duda NO se echa a nadie de ningún sitio: las políticas de la base
    // de datos siguen mandando y no dejarán ver lo que no toque.
    return { esHermano: false, gestiona: true, seguro: false }
  }
}

/**
 * ¿Esta cuenta es SOLO de hermano, sin nada que gestionar?
 *
 * Ya no se usa para echar a nadie del panel —eso se quitó, ver el comentario
 * de ProtectedRoute— pero sí para saber qué enseñarle: a quien solo es hermano
 * no se le ofrece el enlace de «ir al panel», y a quien gestiona sí.
 *
 * `seguro` manda: si no se ha podido averiguar, contesta que NO. Ante la duda
 * no se le quita nada a nadie; las políticas de la base de datos siguen ahí y
 * no enseñan lo que no toca.
 */
export async function soloEsHermano(): Promise<boolean> {
  const p = await papelesDeLaCuenta()
  return p.seguro && p.esHermano && !p.gestiona
}
