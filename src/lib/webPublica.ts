import { useCallback, useEffect, useState } from 'react'
import { guardarConAviso, leerPersistido } from './persistencia'
import { isSupabaseConfigured, supabase } from './supabase'
import { hermandadActualId } from './multiHermandad'
import type { HermandadSettings } from './hermandadSettings'

/*
 * Estas viven en `webPublicaPuro.ts` porque las necesita también la
 * función de servidor, y desde el servidor no se puede importar este fichero
 * (arrastra React y el cliente de Supabase). Se reexportan para que el resto
 * de la aplicación las siga pidiendo aquí, como siempre.
 */
export { aSlug, slugNoticia, slugTitular, slugCulto, cartelesOrdenados, noticiasPorAnio, noticiasPublicadas } from './webPublicaPuro'

/*
 * Y los datos y los valores por defecto viven en `webPublicaDatos.ts`, por lo
 * mismo: `api/w.ts` necesita `conDefectos` y no puede cargar este fichero sin
 * llevarse React y el cliente de Supabase dentro del paquete de la función.
 * Se reexporta ENTERO —tipos y valores— para que el resto de la aplicación lo
 * siga pidiendo aquí, como siempre.
 */
export * from './webPublicaDatos'
import { CLAVE_WEB_PUBLICA, conDefectos, WEB_PUBLICA_INICIAL } from './webPublicaDatos'
import type { WebPublica } from './webPublicaDatos'

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
  void subirWebAlServidor(web)
}

/**
 * Como `saveWebPublica`, pero ESPERANDO y contando qué ha pasado.
 *
 * La versión de arriba se traga el fallo a propósito: se llama en cada tecla
 * que se escribe en el editor y no puede estar interrumpiendo. Pero al pulsar
 * «Publicar» hay que saberlo, y sobre todo hay que saberlo cuando el enlace ya
 * es de otra hermandad: ahí la subida falla SIEMPRE y en silencio, así que la
 * hermandad daba a publicar, veía su vista previa perfecta, mandaba el enlace
 * por el grupo de WhatsApp… y ese enlace enseñaba la web de otra gente.
 */
export async function publicarWeb(web: WebPublica): Promise<{ ok: boolean; error?: string }> {
  guardarConAviso(CLAVE_WEB_PUBLICA, web)
  return subirWebAlServidorContando(web)
}

/** ¿Está libre este enlace, o ya es de otra hermandad? */
export async function enlaceLibre(slug: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !slug.trim()) return true
  try {
    const hermandadId = await hermandadActualId()
    const { data, error } = await supabase
      .from('web_publica')
      .select('hermandad_id')
      .eq('slug', slug.trim())
      .limit(1)
      .maybeSingle()
    if (error) return true
    // Libre si no lo tiene nadie, o si ya es nuestro.
    return !data || (data as { hermandad_id: string }).hermandad_id === hermandadId
  } catch {
    return true
  }
}

/**
 * Sube la web a Supabase para que la pueda leer un servidor. Se traga los
 * errores a propósito: esto es un extra, no el guardado de verdad.
 */
let avisadoDeSubida = false

/**
 * Sube la web y DEVUELVE el motivo si no ha podido.
 *
 * El caso que importa: el enlace (`slug`) tiene un índice único en toda la
 * base. Si otra hermandad ya usa «hermandad-del-rocio», el upsert choca y
 * devuelve un error de clave duplicada — que en crudo dice
 * «duplicate key value violates unique constraint», o sea nada.
 */
export async function subirWebAlServidorContando(web: WebPublica): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: true }
  try {
    const hermandadId = await hermandadActualId()
    if (!hermandadId) return { ok: false, error: 'No se ha podido saber a qué hermandad pertenece esta sesión.' }
    const { error } = await supabase
      .from('web_publica')
      .upsert(
        { hermandad_id: hermandadId, slug: web.slug, publicada: web.publicada, datos: web },
        { onConflict: 'hermandad_id' },
      )
    if (error) {
      const duplicado = /duplicate key|unique constraint|23505/i.test(error.message)
      return {
        ok: false,
        error: duplicado
          ? `El enlace «${web.slug}» ya lo usa otra hermandad. Elige otro en Ajustes → Enlace de la web.`
          : `No se ha podido publicar: ${error.message}`,
      }
    }
    avisadoDeSubida = false
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido publicar.' }
  }
}

export async function subirWebAlServidor(web: WebPublica): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false
  try {
    // El conflicto se resuelve por `hermandad_id`, no por el número de fila:
    // todas las hermandades comparten tabla y cada una tiene su web, con un
    // índice único que lo asegura. Pedir la fila 1, como antes, machacaría la
    // web de otra hermandad.
    const hermandadId = await hermandadActualId()
    if (!hermandadId) throw new Error('no se ha podido saber a qué hermandad pertenece esta sesión')
    const { error } = await supabase
      .from('web_publica')
      .upsert(
        { hermandad_id: hermandadId, slug: web.slug, publicada: web.publicada, datos: web },
        { onConflict: 'hermandad_id' },
      )
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

/**
 * Trae de la base de datos la web de la hermandad que tiene ESTE slug.
 *
 * Hasta ahora la web pública se pintaba con lo que hubiera en el navegador
 * (`getWebPublica`), que es lo que ve quien la ha montado. Para cualquier otra
 * persona —que es todo el mundo— no había nada que enseñar. Con todas las
 * hermandades en la misma base de datos, esto es lo que hace que la web de una
 * hermandad se vea desde fuera: se busca por su slug y se pinta lo que venga.
 *
 * Las políticas de Supabase solo dejan leer las webs PUBLICADAS, así que una
 * hermandad que está preparando la suya no se puede espiar poniendo su slug a
 * mano. La suya propia sí la ve, porque tiene la sesión abierta: es lo que
 * hace funcionar la vista previa.
 *
 * Devuelve también de qué hermandad es, que es lo que necesitan los
 * formularios de esa página para saber a quién mandan lo que se escriba.
 */
/**
 * Los datos de la hermandad que SÍ se pueden enseñar en su web pública.
 *
 * EL FALLO QUE ARREGLA. La web pública usaba `useHermandadSettings()`, que
 * arranca leyendo `cabildo-hermandad-settings` del navegador. En un ordenador
 * donde alguien de la hermandad A hubiera entrado antes al panel, esa clave
 * tenía SUS datos: nombre, dirección, logo, IBAN, Bizum y CIF. Al abrir
 * después la web de la hermandad B, la consulta se hacía sin sesión, las
 * políticas devolvían cero filas, se salía por el `if (!data) return`… y se
 * quedaba con lo de A. La sección de donativos de B pedía dinero AL IBAN DE A.
 *
 * Esta función pregunta al servidor por el slug de la web que se está viendo.
 * Y devuelve solo lo publicable: ni IBAN, ni Bizum, ni CIF. Que esos campos no
 * lleguen es parte del arreglo, no un descuido: si no llegan, no se pueden
 * enseñar por equivocación.
 */
export async function ajustesDeLaWeb(slug: string): Promise<Partial<HermandadSettings> | null> {
  if (!isSupabaseConfigured || !supabase || !slug.trim()) return null
  try {
    const { data, error } = await supabase.rpc('hermandad_de_la_web', { p_slug: slug })
    const fila = (data as Record<string, string | null>[] | null)?.[0]
    if (error || !fila) return null
    return {
      nombreLegal: fila.nombre_legal ?? '',
      direccion: fila.direccion ?? '',
      codigoPostal: fila.codigo_postal ?? '',
      ciudad: fila.ciudad ?? '',
      provincia: fila.provincia ?? '',
      telefono: fila.telefono ?? '',
      email: fila.email ?? '',
      logoDataUrl: fila.logo_data_url ?? null,
      // A propósito vacíos: los datos de cobro de la web salen de lo que la
      // hermandad escriba en SU editor, no de la ficha de nadie.
      iban: '',
      bizumTelefono: '',
      cif: '',
    }
  } catch {
    return null
  }
}

export async function cargarWebPorSlug(
  slug: string,
): Promise<{ web: WebPublica; hermandadId: string | null } | null> {
  if (!isSupabaseConfigured || !supabase || !slug.trim()) return null
  try {
    const { data, error } = await supabase
      .from('web_publica')
      .select('datos, publicada, hermandad_id')
      .eq('slug', slug)
      .maybeSingle()
    if (error || !data) return null
    const fila = data as { datos: Partial<WebPublica>; publicada: boolean; hermandad_id: string | null }
    return {
      // `conDefectos` rellena lo que falte: una web guardada con una versión
      // anterior de la aplicación no puede dejar la página en blanco.
      web: { ...conDefectos(fila.datos), publicada: fila.publicada, slug },
      hermandadId: fila.hermandad_id,
    }
  } catch {
    return null
  }
}

/**
 * La web publicada que tiene puesto ESTE dominio propio.
 *
 * Cuando una hermandad compra su dominio y lo apunta a Vercel, quien lo abre
 * llega a la raíz de la aplicación. Sin esto, ahí se encontraba la página de
 * venta de Gobergo en lugar de la web de la hermandad, que es exactamente lo
 * contrario de lo que se le había prometido al configurarlo.
 *
 * Se busca con y sin `www.` porque media España lo escribe, y quien configura
 * el dominio puede haberlo guardado de cualquiera de las dos formas.
 */
export async function cargarWebPorDominio(
  host: string,
): Promise<{ web: WebPublica; hermandadId: string | null } | null> {
  if (!isSupabaseConfigured || !supabase) return null
  const limpio = host.trim().toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '')
  if (!limpio) return null
  try {
    const { data, error } = await supabase
      .from('web_publica')
      .select('datos, publicada, slug, hermandad_id')
      .eq('publicada', true)
      .or(`datos->>dominio.eq.${limpio},datos->>dominio.eq.www.${limpio}`)
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    const fila = data as { datos: Partial<WebPublica>; publicada: boolean; slug: string; hermandad_id: string | null }
    return {
      web: { ...conDefectos(fila.datos), publicada: true, slug: fila.slug },
      hermandadId: fila.hermandad_id,
    }
  } catch {
    return null
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
