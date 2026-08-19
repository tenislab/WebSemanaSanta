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

/**
 * Base64 seguro para UTF-8 (nombres con acentos, ñ…) Y para viajar dentro de
 * una URL: se usa el alfabeto «base64url» (- _ en lugar de + /), sin relleno.
 * Con el base64 normal, el «+» del código se interpreta como un espacio al
 * leer el parámetro de la URL y la papeleta salía como «Código no válido».
 */
function b64Encode(texto: string): string {
  return btoa(unescape(encodeURIComponent(texto)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
function b64Decode(b64: string): string {
  // Se aceptan también los códigos antiguos (con + / =) y el «+» ya convertido
  // en espacio al leerlo de la URL, para que ningún QR impreso deje de valer.
  let normal = b64.replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/')
  while (normal.length % 4 !== 0) normal += '='
  return decodeURIComponent(escape(atob(normal)))
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


/* ---------------------------------------------------------------------------
   H6 · El carné digital
   --------------------------------------------------------------------------- */

/**
 * Los datos del carné, con la misma mecánica que la papeleta: viajan dentro del
 * propio enlace, así que al escanearlo se abre una tarjeta con quién es, sin
 * base de datos ni censo en ese teléfono.
 *
 * `k: 'c'` distingue un carné de una papeleta: las papeletas de antes no
 * llevan esa marca, así que un QR impreso el año pasado sigue valiendo.
 */
export interface DatosCarne {
  k: 'c'
  /** Nombre del hermano. */
  h: string
  /** Número de hermano. */
  nh: number
  /** Nombre de la hermandad. */
  hd: string
  /** Año de antigüedad. */
  d: number
  /** Estado (Activo, Nuevo…). */
  e: string
}

export function datosCarneDe(
  hermano: Pick<Hermano, 'nombre' | 'numero' | 'antiguedad' | 'estado'>,
  hermandadNombre: string,
): DatosCarne {
  return {
    k: 'c',
    h: hermano.nombre,
    nh: hermano.numero,
    hd: hermandadNombre || 'Tu hermandad',
    d: hermano.antiguedad,
    e: hermano.estado,
  }
}

export function urlCarne(datos: DatosCarne): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/verificar?d=${b64Encode(JSON.stringify(datos))}`
}

/**
 * Lee el parámetro `d` y dice qué es: un carné, una papeleta, o nada legible.
 * Un solo punto de entrada para la página de verificación.
 */
export function decodificarQr(
  param: string | null,
): { tipo: 'carne'; datos: DatosCarne } | { tipo: 'papeleta'; datos: DatosVerificacion } | null {
  if (!param) return null
  try {
    const o = JSON.parse(b64Decode(param)) as Partial<DatosCarne & DatosVerificacion>
    if (o.k === 'c' && typeof o.h === 'string' && typeof o.nh === 'number') {
      return { tipo: 'carne', datos: o as DatosCarne }
    }
    if (typeof o.n === 'number' && typeof o.h === 'string') {
      return { tipo: 'papeleta', datos: o as DatosVerificacion }
    }
  } catch {
    // parámetro corrupto o de otro formato
  }
  return null
}
