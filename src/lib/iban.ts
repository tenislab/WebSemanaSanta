/**
 * EL IBAN, COMPROBADO ANTES DE MANDARSELO AL BANCO.
 *
 * No había ninguna comprobación. El IBAN del hermano viajaba tal cual desde su
 * ficha hasta el fichero de adeudos, y de ahí al banco.
 *
 * Y ESO NO FALLA EN UNA FILA: FALLA EN LA REMESA ENTERA. El banco valida la
 * estructura del pain.008 antes de procesar nada; un IBAN con la longitud mal o
 * con los dígitos de control cambiados hace que RECHACE EL FICHERO COMPLETO. Mil
 * recibos que no se cobran por una errata de una fila, y el aviso que llega es
 * un código del banco que no dice qué fila era.
 *
 * Y las erratas son lo normal, no la excepción: el censo se importa de un Excel
 * donde alguien tecleó los IBAN a mano, alguna vez, hace años. Faltan dígitos,
 * sobran, se cuela una letra ñ, o está el número de cuenta antiguo de veinte
 * cifras sin el «ES» delante.
 *
 * La comprobación es la del propio estándar (ISO 13616) y no admite discusión:
 * la longitud que le toca a su país, y los dos dígitos de control, que salen de
 * un resto entre 97. Con eso se pilla cualquier dígito cambiado y casi
 * cualquier par de dígitos intercambiados, que es como se teclea mal un IBAN.
 */

/** Sin espacios, guiones ni minúsculas. Es como se escribe de verdad. */
export function limpiarIban(iban: string): string {
  return (iban ?? '').replace(/[\s.\-–—]/g, '').toUpperCase()
}

/**
 * Cuántos caracteres tiene el IBAN de cada país de la zona SEPA.
 *
 * La longitud es LO PRIMERO que hay que mirar, porque los dígitos de control no
 * la protegen: un IBAN español al que le falte una cifra puede dar un resto
 * correcto por casualidad y aun así no ser una cuenta.
 *
 * Están los 36 de la zona SEPA, que son a los que se puede mandar un adeudo. Un
 * país que no esté en la lista se rechaza a propósito: aunque el IBAN fuera
 * bueno, el banco no puede cobrar ahí con este fichero.
 */
const LARGO_POR_PAIS: Record<string, number> = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28,
  IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31,
  NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27,
  VA: 22,
}

/**
 * El resto entre 97, con el IBAN tratado como un número gigante.
 *
 * Se hace a trozos y no con un número entero grande: un IBAN de 34 caracteres
 * pasado a cifras son más de sesenta dígitos, y ahí un número normal de
 * JavaScript ya ha perdido precisión — daría restos que no son, y de las dos
 * maneras: dando por bueno un IBAN malo y por malo uno bueno.
 */
/*
 * SE EXPORTA A PROPÓSITO, y es el único sitio donde se calcula.
 *
 * El identificador de acreedor SEPA —`lib/nif.ts`— lleva sus dos dígitos de
 * control con este mismísimo mecanismo. Escribirlo dos veces es cómo se acaba
 * teniendo dos reglas ligeramente distintas: una acepta un identificador que la
 * otra rechaza, y el que se manda al banco es el que pasó por la mala. Hay una
 * prueba que vigila que no vuelva a haber dos.
 */
export function restoEntre97(texto: string): number {
  let resto = 0
  for (const c of texto) {
    const n = c >= 'A' && c <= 'Z' ? String(c.charCodeAt(0) - 55) : c
    for (const d of n) resto = (resto * 10 + Number(d)) % 97
  }
  return resto
}

/** ¿Es un IBAN de verdad, y de un país al que se le puede pasar un adeudo? */
export function ibanValido(iban: string): boolean {
  const limpio = limpiarIban(iban)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(limpio)) return false
  const largo = LARGO_POR_PAIS[limpio.slice(0, 2)]
  if (largo === undefined || limpio.length !== largo) return false
  // Los cuatro primeros se van al final: es lo que dice la norma.
  return restoEntre97(limpio.slice(4) + limpio.slice(0, 4)) === 1
}

/**
 * Por qué no vale, dicho para quien lo tiene que corregir.
 *
 * «IBAN incorrecto» no sirve de nada delante de una lista de veinte: hay que
 * poder distinguir el que está a medias del que tiene una cifra cambiada,
 * porque se arreglan de maneras distintas.
 */
export function porQueNoValeElIban(iban: string): string | null {
  const limpio = limpiarIban(iban)
  if (!limpio) return 'no tiene IBAN'
  if (!/^[A-Z]{2}/.test(limpio)) {
    return 'le falta el país delante (los IBAN españoles empiezan por ES)'
  }
  const pais = limpio.slice(0, 2)
  const largo = LARGO_POR_PAIS[pais]
  if (largo === undefined) return `«${pais}» no es un país de la zona SEPA`
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(limpio)) return 'tiene caracteres que no son de un IBAN'
  if (limpio.length !== largo) {
    return limpio.length < largo
      ? `le faltan ${largo - limpio.length} caracteres (un IBAN de ${pais} tiene ${largo})`
      : `le sobran ${limpio.length - largo} caracteres (un IBAN de ${pais} tiene ${largo})`
  }
  if (restoEntre97(limpio.slice(4) + limpio.slice(0, 4)) !== 1) {
    return 'los dígitos de control no cuadran: hay alguna cifra cambiada'
  }
  return null
}

/** En grupos de cuatro, que es como se lee y como viene en el papel del banco. */
export function formatearIban(iban: string): string {
  return limpiarIban(iban).replace(/(.{4})/g, '$1 ').trim()
}
