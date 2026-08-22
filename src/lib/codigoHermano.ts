/**
 * EL CÓDIGO DE PAGO DE UN HERMANO.
 *
 * El problema que resuelve. El concepto de un Bizum se escribe con el pulgar,
 * en un móvil, de pie. Poner ahí «Papeleta 1 - Jaime Rivas» es pedir que se
 * escriba mal: el que paga acorta, se come el apellido o pone otra cosa, y a la
 * tesorería le llega un ingreso que no sabe de quién es. En una hermandad con
 * tres Jaime Rivas —que las hay— el nombre además no distingue.
 *
 * Un código corto sí: se copia de un vistazo, cabe en cualquier concepto, y es
 * el mismo todo el año. El hermano se lo aprende.
 *
 * CÓMO ES. Tres letras del nombre y el número de hermano, con un guion:
 *
 *     JRV-0001
 *
 * Las letras no son adorno: si alguien teclea un dígito de más o de menos,
 * dejan de cuadrar con el número y la tesorería lo ve en vez de apuntárselo al
 * hermano equivocado. Y salen del nombre, así que quien lee el extracto
 * reconoce de quién es sin abrir nada.
 */

/** Quita tildes y deja solo letras: «Muñoz Peña» → «MUNOZPENA». */
function soloLetras(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

/**
 * Las tres letras: las iniciales de las tres primeras palabras.
 *
 *     «Jaime Rivas Reinoso»  → JRR
 *
 * Con menos de tres palabras faltan iniciales, y se completan con las letras
 * que siguen en la ÚLTIMA, para que el código mida siempre lo mismo:
 *
 *     «Carmen Ortiz»  → C, O, y la «r» de Ortiz  → COR
 *     «Ana Gil»       → A, G, y la «i» de Gil    → AGI
 *
 * Se rellena con el apellido y no con el nombre a propósito: es lo que la
 * tesorería reconoce leyendo un extracto, y lo que distingue a dos hermanos
 * que se llamen igual de primer nombre.
 */
function letrasDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).map(soloLetras).filter(Boolean)
  if (palabras.length === 0) return 'XXX'
  const iniciales = palabras.map((p) => p[0]).join('')
  if (iniciales.length >= 3) return iniciales.slice(0, 3)
  // Faltan letras: se rellenan con las de la última palabra —el apellido—, sin
  // repetir su inicial, y en último caso con X para no devolver un código
  // corto, que descuadraría la columna en cualquier listado.
  const relleno = palabras[palabras.length - 1].slice(1)
  return (iniciales + relleno + 'XXX').slice(0, 3)
}

/**
 * El código de pago de un hermano. Estable: mientras no le cambien el nombre
 * ni el número, es siempre el mismo.
 */
export function codigoDeHermano(hermano: { nombre: string; numero: number }): string {
  const numero = String(Math.max(0, Math.trunc(hermano.numero))).padStart(4, '0')
  return `${letrasDe(hermano.nombre)}-${numero}`
}

/**
 * Busca a quién pertenece un código, para cuando la tesorería teclea lo que ha
 * llegado en el extracto. Tolerante con cómo venga escrito —minúsculas, sin el
 * guion, con espacios de más—, porque así es como llegan de verdad.
 */
export function hermanoDelCodigo<T extends { nombre: string; numero: number }>(
  codigo: string,
  hermanos: T[],
): T | undefined {
  const limpio = soloLetrasYNumeros(codigo)
  if (!limpio) return undefined
  return hermanos.find((h) => soloLetrasYNumeros(codigoDeHermano(h)) === limpio)
}

function soloLetrasYNumeros(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}
