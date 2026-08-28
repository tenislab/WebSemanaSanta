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

/**
 * ¿ESTÁ BIEN ESTE DOCUMENTO?
 *
 * SE VALIDA AL TECLEAR, NO AL IMPORTAR, y esa distinción es todo el diseño.
 *
 * Al importar NO se rechaza nada —ver el comentario de `limpiarDni`—: los
 * censos vienen de un Excel de hace quince años con erratas, y una hermandad
 * que no puede importar su censo no puede empezar a usar la aplicación. Ahí lo
 * que hace falta es meter los datos y arreglarlos luego.
 *
 * Pero un DNI que alguien escribe HOY, con el hermano delante, sí se puede
 * comprobar. Y conviene, porque de ese número cuelgan cosas que se rompen
 * calladamente: es la llave con la que el hermano entra en su área, es lo que
 * evita darlo de alta dos veces, y es lo que va en el mandato SEPA que se le
 * enseña al banco si alguien reclama un cargo.
 *
 * LA LETRA NO ES UN ADORNO: sale de dividir el número entre 23. Por eso una
 * errata de un solo dígito se caza casi siempre, y por eso merece la pena
 * comprobarla en vez de contar caracteres.
 */

/** Las 23 letras, en el orden oficial. El resto de dividir entre 23 da el índice. */
const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE'

/** Qué clase de documento parece. */
export type FormaDocumento = 'dni' | 'nie' | 'nada'

export function formaDeDocumento(v: string): FormaDocumento {
  const d = limpiarDni(v)
  if (/^\d{8}[A-Z]$/.test(d)) return 'dni'
  // El NIE lleva X, Y o Z delante, siete cifras y su letra: X1234567L.
  if (/^[XYZ]\d{7}[A-Z]$/.test(d)) return 'nie'
  return 'nada'
}

/**
 * La letra que le toca a un DNI o NIE.
 *
 * En el NIE, la X, la Y y la Z valen 0, 1 y 2 y se ponen DELANTE del número:
 * la Z1234567 se calcula como si fuera 21234567. Es el detalle que se olvida
 * siempre, y hace que todos los NIE que empiezan por Y o Z se den por malos.
 */
export function letraQueLeToca(v: string): string {
  const d = limpiarDni(v)
  const cuerpo = d.replace(/[A-Z]$/, '')
  const numero = cuerpo.replace(/^[XYZ]/, (l) => String('XYZ'.indexOf(l)))
  if (!/^\d+$/.test(numero)) return ''
  return LETRAS[Number(numero) % 23] ?? ''
}

/** ¿Es un DNI o NIE bien formado y con su letra correcta? */
export function documentoValido(v: string): boolean {
  if (formaDeDocumento(v) === 'nada') return false
  const d = limpiarDni(v)
  return d.slice(-1) === letraQueLeToca(d)
}

/**
 * Qué le pasa a este documento, dicho para quien lo está tecleando.
 *
 * Devuelve `null` si está bien —o si está vacío, que no es un error sino un
 * campo sin rellenar; de exigirlo se encarga el formulario—.
 *
 * LOS MENSAJES DICEN QUÉ HACER, no «formato inválido». Quien está en
 * secretaría con el hermano delante necesita saber si le falta la letra, si
 * sobra un número, o si es que se ha equivocado al copiar — y son tres cosas
 * distintas con tres arreglos distintos.
 */
export function problemaDeDocumento(v: string): string | null {
  const d = limpiarDni(v)
  if (d === '') return null

  if (formaDeDocumento(d) !== 'nada') {
    if (documentoValido(d)) return null
    const toca = letraQueLeToca(d)
    return `La letra no cuadra con el número: a ${d.slice(0, -1)} le toca la «${toca}». `
      + 'Míralo en el documento, porque casi siempre es un número mal copiado y no la letra.'
  }

  // No tiene la forma. Se distingue qué le falta, que es lo accionable.
  const soloCifras = /^\d+$/.test(d)
  if (soloCifras && d.length === 8) return 'Falta la letra al final: un DNI son ocho números y una letra.'
  if (soloCifras) {
    return d.length < 8
      ? `Faltan cifras: un DNI son ocho números y una letra, y aquí hay ${d.length}.`
      : `Sobran cifras: un DNI son ocho números y una letra, y aquí hay ${d.length}.`
  }
  if (/^[XYZ]\d+$/.test(d)) return 'Falta la letra al final: un NIE es una letra, siete números y otra letra.'
  if (/^\d+[A-Z]$/.test(d)) {
    const cifras = d.length - 1
    return `Un DNI son ocho números y una letra, y aquí hay ${cifras} número${cifras === 1 ? '' : 's'}.`
  }
  return 'No parece un DNI ni un NIE. Un DNI son ocho números y una letra (12345678Z); '
    + 'un NIE, una letra, siete números y otra letra (X1234567L).'
}
