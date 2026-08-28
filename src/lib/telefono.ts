/**
 * EL TELÉFONO, ESCRITO COMO SEA Y GUARDADO IGUAL.
 *
 * Un teléfono español se escribe de siete maneras y todas son el mismo número:
 *
 *     600123456 · 600 12 34 56 · 600-12-34-56 · +34 600123456 · 0034600123456
 *
 * No había ninguna regla. Se guardaba tal cual se tecleaba, y eso rompe dos
 * cosas distintas:
 *
 *   · EL BIZUM. El teléfono del Bizum se enseña en la web pública para que la
 *     gente pague ahí. Si tiene un espacio de más o le falta una cifra, el
 *     donativo no llega a ninguna parte y NADIE SE ENTERA: el que paga cree que
 *     ha pagado, y la hermandad no ve el ingreso. No hay error, no hay aviso, no
 *     hay rastro. Y encima Bizum es solo de MÓVILES: un fijo ahí no funciona
 *     jamás, por bien escrito que esté.
 *
 *   · BUSCAR AL HERMANO POR SU TELÉFONO. En la tienda se busca la reserva por
 *     teléfono. Si en la ficha está con espacios y quien lo busca lo escribe
 *     seguido, no aparece.
 *
 * NO SE RECHAZA UN NÚMERO EXTRANJERO. Hay hermanos viviendo fuera, y un +32 de
 * Bruselas es un teléfono perfectamente bueno. Lo único que se comprueba de
 * ellos es que tenga la pinta de un número internacional (E.164), porque más
 * allá de eso cada país tiene sus reglas y no se pueden saber todas.
 */

/**
 * El teléfono en su forma canónica: sin espacios, puntos, guiones ni paréntesis.
 *
 * El `00` de salida se pasa a `+`, que es como se escribe hoy, para que
 * `0034600123456` y `+34600123456` no sean dos teléfonos distintos.
 */
export function limpiarTelefono(v: string): string {
  const t = (v ?? '').replace(/[\s.\-–—()/]/g, '')
  if (t.startsWith('00')) return `+${t.slice(2)}`
  return t
}

/**
 * El teléfono tal como se guarda: si es español, los nueve dígitos a secas.
 *
 * El prefijo +34 se QUITA a propósito. Si unos se guardan con él y otros sin él,
 * el mismo número está dos veces y la búsqueda por teléfono no encuentra la
 * mitad de las fichas.
 */
export function normalizarTelefono(v: string): string {
  const t = limpiarTelefono(v)
  if (t.startsWith('+34')) return t.slice(3)
  return t
}

/** Los nueve dígitos de un teléfono español, o `''` si no lo es. */
function nacional(v: string): string {
  const t = normalizarTelefono(v)
  return /^\d{9}$/.test(t) ? t : ''
}

/** ¿Es un número español? Nueve cifras que empiezan por 6, 7, 8 o 9. */
export function esTelefonoEspanol(v: string): boolean {
  const n = nacional(v)
  return n !== '' && '6789'.includes(n[0]!)
}

/**
 * ¿Es un móvil español?
 *
 * Importa porque BIZUM SOLO FUNCIONA CON MÓVILES. Los móviles empiezan por 6 o
 * por 7 —el 7 se abrió a móviles cuando se agotaron los 6—, y los fijos por 8
 * o por 9.
 */
export function esMovilEspanol(v: string): boolean {
  const n = nacional(v)
  return n !== '' && '67'.includes(n[0]!)
}

/** ¿Tiene pinta de número internacional? `+` y de 8 a 15 cifras, que es E.164. */
export function esTelefonoInternacional(v: string): boolean {
  const t = limpiarTelefono(v)
  return /^\+\d{8,15}$/.test(t) && !t.startsWith('+34')
}

/** ¿Vale como teléfono, español o de fuera? */
export function telefonoValido(v: string): boolean {
  return esTelefonoEspanol(v) || esTelefonoInternacional(v)
}

/**
 * Qué le pasa a este teléfono, dicho para quien lo está tecleando.
 *
 * Devuelve `null` si está bien o si está vacío —un campo sin rellenar no es un
 * error; de exigirlo se encarga el formulario—.
 *
 * SE VALIDA AL TECLEAR, NO AL IMPORTAR, igual que el DNI y por lo mismo: el
 * censo viene de un Excel viejo donde hay teléfonos de ocho cifras de antes de
 * 1998, y rechazar la importación dejaría fuera a gente de verdad.
 */
export function problemaDeTelefono(v: string): string | null {
  const t = limpiarTelefono(v)
  if (t === '') return null
  if (telefonoValido(t)) return null

  if (t.startsWith('+')) {
    const cifras = t.slice(1).replace(/\D/g, '').length
    if (t.slice(1).replace(/\d/g, '') !== '') return 'Un teléfono con prefijo solo lleva el «+» y cifras.'
    return cifras < 8
      ? 'Faltan cifras en el número de fuera de España.'
      : 'Sobran cifras: un número internacional no pasa de quince.'
  }

  const soloCifras = t.replace(/\D/g, '')
  if (soloCifras !== t) return 'El teléfono solo lleva cifras (y el «+» delante si es de fuera de España).'
  if (soloCifras.length < 9) {
    return `Faltan cifras: un teléfono español son nueve, y aquí hay ${soloCifras.length}. `
      + 'Si es de fuera, ponle el prefijo delante: +32 470 12 34 56.'
  }
  if (soloCifras.length > 9) {
    return `Sobran cifras: un teléfono español son nueve, y aquí hay ${soloCifras.length}. `
      + 'Si querías poner el prefijo, va con «+» delante: +34 600 12 34 56.'
  }
  return 'Un teléfono español empieza por 6 o 7 si es móvil, y por 8 o 9 si es fijo.'
}

/**
 * Lo mismo, pero para el teléfono del BIZUM, que además tiene que ser un móvil.
 *
 * Se separa del anterior porque el fallo es distinto y el arreglo también: un
 * fijo bien escrito pasa `problemaDeTelefono` sin una queja, y luego los
 * donativos no llegan nunca.
 */
export function problemaDeBizum(v: string): string | null {
  const t = limpiarTelefono(v)
  if (t === '') return null
  if (esMovilEspanol(t)) return null
  if (esTelefonoEspanol(t)) {
    return 'Bizum solo funciona con móviles españoles, y este es un fijo '
      + '(empieza por 8 o 9). Pon el móvil al que quieras que llegue el dinero.'
  }
  if (esTelefonoInternacional(t)) return 'Bizum solo funciona con móviles españoles.'
  return problemaDeTelefono(t)
}

/** Para enseñarlo: 600 12 34 56 si es español, tal cual si es de fuera. */
export function telefonoBonito(v: string): string {
  const n = normalizarTelefono(v)
  if (!/^\d{9}$/.test(n)) return limpiarTelefono(v)
  return `${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`
}
