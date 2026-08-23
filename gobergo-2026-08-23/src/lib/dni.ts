/**
 * EL DNI, SIEMPRE ESCRITO IGUAL.
 *
 * Un DNI español se escribe de cuatro maneras y todas son la misma persona:
 *
 *     12345678A   ·   12.345.678-A   ·   12345678-a   ·   12 345 678 A
 *
 * Y la aplicación tenía TRES normalizadores distintos conviviendo, más varios
 * `.trim().toUpperCase()` sueltos. Con tres reglas distintas, la misma persona
 * es dos personas según por qué pantalla se entre. Lo que pasaba de verdad:
 *
 *   · Un hermano dado de alta desde «Personal y permisos» guardaba el DNI TAL
 *     CUAL lo tecleó la secretaria —con puntos y guion—. Luego él intentaba
 *     entrar en su área escribiendo «12345678A», que es como se escribe
 *     normalmente, y no lo encontraba: NO PODÍA ENTRAR, sin saber por qué, y
 *     la única forma habría sido acertar los puntos exactos.
 *
 *   · El alta a mano en el censo limpiaba lo tecleado pero comparaba contra el
 *     censo SIN limpiar. Un censo importado con puntos no encontraba al que ya
 *     estaba, así que la misma persona entraba DOS VECES, con dos números.
 *     Y un hermano duplicado son dos cuotas, dos papeletas y dos sitios en el
 *     cortejo.
 *
 * Una sola regla, aquí, y todo el mundo la usa. Y va en su propio archivo
 * —antes vivía dentro del importador— porque no es cosa del importador: es
 * cosa de todo el que escriba o busque un DNI.
 */

/**
 * El DNI/NIE en su forma canónica: sin espacios, puntos ni guiones, y en
 * mayúsculas.
 *
 * NO se comprueba la letra a propósito. Los censos antiguos vienen con
 * erratas, y rechazar una ficha entera por una letra mal puesta hace que la
 * hermandad no pueda importar su censo — que es lo primero que necesita.
 */
export function limpiarDni(v: string): string {
  return (v ?? '').replace(/[\s.\-–—_/]/g, '').toUpperCase()
}

/** ¿Son el mismo DNI, esté escrito como esté? */
export function mismoDni(a: string, b: string): boolean {
  const x = limpiarDni(a)
  return x.length > 0 && x === limpiarDni(b)
}
