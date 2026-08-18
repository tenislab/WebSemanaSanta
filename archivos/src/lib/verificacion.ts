import type { Papeleta } from '../data/papeletas'
import type { Hermano } from '../data/hermanos'

/**
 * Verificación de papeletas por QR. El QR de cada papeleta codifica una URL a
 * la página pública /verificar con los datos de la papeleta empaquetados en el
 * propio enlace. Así, al escanearlo con CUALQUIER móvil, se abre una tarjeta
 * con los datos del sitio (sin necesidad de base de datos ni de tener el censo
 * en ese teléfono). La verificación reforzada (comprobar contra el sistema de
 * la hermandad, marcar «entregada» en el día de salida) llegará con Supabase.
 */

export interface DatosVerificacion {
  /** Número de papeleta. */
  n: number
  /** Nombre del hermano. */
  h: string
  /** Número de hermano. */
  nh: number
  /** Tramo / puesto / modalidad (texto legible). */
  t: string
  /** Nombre de la hermandad. */
  hd: string
  /** Año de la campaña. */
  a: number
}

/** Base64 seguro para UTF-8 (nombres con acentos, ñ…). */
function b64Encode(texto: string): string {
  return btoa(unescape(encodeURIComponent(texto)))
}
function b64Decode(b64: string): string {
  return decodeURIComponent(escape(atob(b64)))
}

/** Construye los datos de verificación de una papeleta ya asignada. */
export function datosVerificacionDe(
  papeleta: Papeleta,
  hermano: Pick<Hermano, 'nombre' | 'numero'>,
  tramoEtiqueta: string,
  hermandadNombre: string,
): DatosVerificacion {
  return {
    n: papeleta.numero,
    h: hermano.nombre,
    nh: hermano.numero,
    t: tramoEtiqueta || papeleta.opcion || 'Sin tramo',
    hd: hermandadNombre || 'Tu hermandad',
    a: papeleta.anio,
  }
}

/** URL absoluta que codifica los datos, para meter en el QR. */
export function urlVerificacion(datos: DatosVerificacion): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/verificar?d=${b64Encode(JSON.stringify(datos))}`
}

/** Decodifica el parámetro `d` de /verificar. Devuelve null si no es válido. */
export function decodificarVerificacion(param: string | null): DatosVerificacion | null {
  if (!param) return null
  try {
    const o = JSON.parse(b64Decode(param)) as DatosVerificacion
    if (typeof o.n === 'number' && typeof o.h === 'string') return o
  } catch {
    // parámetro corrupto o de otro formato
  }
  return null
}
