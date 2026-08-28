/**
 * EL NIF DE LA HERMANDAD Y SU IDENTIFICADOR DE ACREEDOR.
 *
 * Son dos datos que se teclean UNA VEZ, en Configuración, y de los que cuelga
 * todo lo demás. Por eso no había prisa por comprobarlos y por eso hacía falta:
 * una errata puesta el primer día no se descubre hasta que duele.
 *
 *   · EL NIF (el CIF de toda la vida) va en las FACTURAS de la tienda. Una
 *     factura con el NIF mal no es una factura: no la puede deducir quien la
 *     recibe, y a la hermandad se la pueden rechazar en una inspección. Y sale
 *     mal en TODAS, no en una, porque se copia del mismo sitio.
 *
 *   · EL IDENTIFICADOR DE ACREEDOR va en la cabecera del fichero de adeudos.
 *     Si está mal, el banco NO devuelve unos recibos: TUMBA LA REMESA ENTERA,
 *     igual que con un IBAN malo. Mil cuotas sin cobrar por una errata puesta
 *     hace ocho meses, y el aviso del banco es un código que no dice cuál es el
 *     campo.
 *
 * Las dos comprobaciones son las oficiales y no admiten discusión: el dígito de
 * control del NIF sale de una suma con los dígitos pares y los impares tratados
 * distinto, y los dos dígitos del identificador salen de un resto entre 97, el
 * mismo mecanismo del IBAN.
 *
 * COMO SIEMPRE: SE VALIDA AL TECLEAR, NUNCA AL IMPORTAR.
 */

/*
 * El resto entre 97 se coge de `lib/iban.ts` y NO se vuelve a escribir aquí. Es
 * el mismo mecanismo, y dos copias acaban siendo dos reglas distintas: una
 * acepta un identificador que la otra rechaza, y al banco va el que pasó por la
 * mala. Hay una prueba que vigila que solo haya una.
 */
import { restoEntre97 } from './iban'

/** Sin espacios, puntos ni guiones, y en mayúsculas. */
export function limpiarNif(v: string): string {
  return (v ?? '').replace(/[\s.\-–—_/]/g, '').toUpperCase()
}

/**
 * Las letras con las que puede empezar el NIF de una entidad.
 *
 * Una hermandad es casi siempre una **G** (asociación o entidad sin ánimo de
 * lucro) o una **R** (entidad religiosa inscrita en el Ministerio de Justicia,
 * que es lo que son muchas hermandades por el Acuerdo con la Santa Sede). Se
 * aceptan todas las demás porque hay hermandades con fundación, con sociedad
 * para la tienda, o con formas raras heredadas.
 */
const LETRAS_ENTIDAD = 'ABCDEFGHJNPQRSUVW'

/** Las que llevan LETRA de control en vez de cifra. */
const CONTROL_ES_LETRA = 'PQRSNW'
/** Las que llevan CIFRA de control obligatoriamente. */
const CONTROL_ES_CIFRA = 'ABEH'
/** El resto de la división entre 10 se traduce con esta tabla cuando es letra. */
const TABLA_CONTROL = 'JABCDEFGHI'

/**
 * El carácter de control que le toca a un NIF de entidad.
 *
 * Los siete dígitos NO se suman igual: los de posición impar (1º, 3º, 5º, 7º)
 * se multiplican por dos y se suman las CIFRAS del resultado —no el resultado—,
 * y los de posición par se suman tal cual. Es lo que hace que se pille cambiar
 * dos cifras de sitio, que es el error de tecleo más común.
 *
 * Devuelve las dos formas —cifra y letra—, porque según la letra inicial vale
 * una, la otra, o cualquiera de las dos.
 */
function controlDeNif(cuerpo: string): { cifra: string, letra: string } | null {
  if (!/^\d{7}$/.test(cuerpo)) return null
  let suma = 0
  for (let i = 0; i < 7; i++) {
    const n = Number(cuerpo[i])
    if (i % 2 === 0) {
      const doble = n * 2
      suma += Math.floor(doble / 10) + (doble % 10)
    } else {
      suma += n
    }
  }
  const cifra = (10 - (suma % 10)) % 10
  return { cifra: String(cifra), letra: TABLA_CONTROL[cifra]! }
}

/** ¿Es el NIF de una entidad, con su control bien? */
export function nifValido(v: string): boolean {
  const d = limpiarNif(v)
  const m = /^([A-Z])(\d{7})([0-9A-J])$/.exec(d)
  if (!m) return false
  const [, letra, cuerpo, control] = m
  if (!LETRAS_ENTIDAD.includes(letra!)) return false
  const toca = controlDeNif(cuerpo!)
  if (!toca) return false
  if (CONTROL_ES_LETRA.includes(letra!)) return control === toca.letra
  if (CONTROL_ES_CIFRA.includes(letra!)) return control === toca.cifra
  return control === toca.cifra || control === toca.letra
}

/** Qué le pasa a este NIF, dicho para quien lo está tecleando. `null` si está bien o vacío. */
export function problemaDeNif(v: string): string | null {
  const d = limpiarNif(v)
  if (d === '') return null
  if (nifValido(d)) return null

  if (/^\d{8}[A-Z]$/.test(d)) {
    return 'Eso es un DNI, no el NIF de la hermandad. El de una entidad empieza '
      + 'por letra: casi siempre G (asociación) o R (entidad religiosa).'
  }
  const m = /^([A-Z])(\d{7})([0-9A-J])$/.exec(d)
  if (m) {
    const [, letra, cuerpo, control] = m
    if (!LETRAS_ENTIDAD.includes(letra!)) {
      return `El NIF de una entidad no empieza por «${letra}». Las hermandades `
        + 'suelen ser G (asociación) o R (entidad religiosa).'
    }
    const toca = controlDeNif(cuerpo!)!
    const esperado = CONTROL_ES_LETRA.includes(letra!)
      ? `la «${toca.letra}»`
      : CONTROL_ES_CIFRA.includes(letra!)
        ? `el «${toca.cifra}»`
        : `el «${toca.cifra}» o la «${toca.letra}»`
    return `El último carácter no cuadra: a ${letra}${cuerpo} le toca ${esperado}, `
      + `y aquí pone «${control}». Casi siempre es una cifra mal copiada, no el final.`
  }
  const cuerpo = d.replace(/^[A-Z]/, '').replace(/[0-9A-J]$/, '')
  if (/^[A-Z]/.test(d) && /^\d*$/.test(cuerpo)) {
    return `Un NIF de entidad son una letra, siete cifras y un último carácter `
      + `(G41000001), y aquí hay ${cuerpo.length} cifras.`
  }
  return 'No parece un NIF de entidad. Son una letra, siete cifras y un último '
    + 'carácter que puede ser cifra o letra: G41000001, R2800395B.'
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * EL IDENTIFICADOR DE ACREEDOR SEPA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Se lo da el banco a la hermandad cuando la autoriza a cobrar por domiciliación,
 * y tiene esta forma, dieciséis caracteres:
 *
 *     ES 11 000 B12345674
 *     ├┘ ├┘ ├─┘ ├───────┘
 *     │  │  │   └─ el NIF de la hermandad
 *     │  │  └───── código de negocio: lo pone la hermandad, casi siempre «000»
 *     │  └──────── dos dígitos de control
 *     └─────────── el país
 *
 * EL CÓDIGO DE NEGOCIO NO ENTRA EN EL CONTROL. Es el detalle que se salta todo
 * el mundo: los dos dígitos se calculan sobre el NIF y el país nada más, así que
 * la hermandad puede cambiar el «000» por lo que quiera sin recalcular nada. Un
 * validador que lo incluya da por malos todos los identificadores buenos.
 */

/** ¿Es un identificador de acreedor español bien formado? */
export function identificadorAcreedorValido(v: string): boolean {
  const d = limpiarNif(v)
  const m = /^ES(\d{2})[A-Z0-9]{3}([A-Z0-9]{9})$/.exec(d)
  if (!m) return false
  if (!nifValido(m[2]!)) return false
  return restoEntre97(`${m[2]}ES${m[1]}`) === 1
}

/**
 * El identificador que le tocaría a una hermandad con este NIF.
 *
 * Vale para proponerlo cuando el banco todavía no lo ha dado y para explicar en
 * qué se ha equivocado quien lo copió mal.
 */
export function identificadorQueLeToca(nif: string, codigoNegocio = '000'): string {
  const n = limpiarNif(nif)
  if (!nifValido(n)) return ''
  const control = String(98 - restoEntre97(`${n}ES00`)).padStart(2, '0')
  return `ES${control}${codigoNegocio}${n}`
}

/** Qué le pasa al identificador de acreedor. `null` si está bien o vacío. */
export function problemaDeIdentificadorAcreedor(v: string): string | null {
  const d = limpiarNif(v)
  if (d === '') return null
  if (identificadorAcreedorValido(d)) return null

  if (!d.startsWith('ES')) {
    return 'El identificador de acreedor empieza por ES: ES + dos cifras de '
      + 'control + tres caracteres + el NIF de la hermandad (ES11000B12345674).'
  }
  if (d.length !== 16) {
    return `El identificador de acreedor son dieciséis caracteres, y aquí hay ${d.length}: `
      + 'ES + dos cifras de control + tres caracteres + el NIF (ES11000B12345674).'
  }
  const m = /^ES(\d{2})([A-Z0-9]{3})([A-Z0-9]{9})$/.exec(d)
  if (!m) return 'Después del ES van dos cifras de control, y aquí no lo son.'
  const [, control, , nif] = m
  if (!nifValido(nif!)) {
    return `Los nueve últimos caracteres son el NIF de la hermandad, y ${nif} no lo es. `
      + (problemaDeNif(nif!) ?? '')
  }
  const correcto = identificadorQueLeToca(nif!, m[2])
  return `Las dos cifras de control no cuadran con el NIF: con ${nif} tendría que `
    + `poner «${correcto.slice(2, 4)}» y pone «${control}». Quedaría ${correcto}. `
    + 'Compruébalo con el papel que te dio el banco antes de cambiarlo.'
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * EL CÓDIGO POSTAL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Cinco cifras, y las dos primeras son la provincia: de la 01 (Álava) a la 52
 * (Melilla). Un 00 o un 78 no existen.
 *
 * Sale impreso en los recibos, en las facturas de la tienda y en la carta que
 * acompaña al mandato SEPA. Y lo que se rompe de verdad es el CERO DE DELANTE:
 * los códigos que empiezan por cero se teclean bien y luego se importan de un
 * Excel donde la columna era numérica, y el 08013 de Barcelona llega como 8013.
 */

/** ¿Es un código postal español? */
export function codigoPostalValido(v: string): boolean {
  const d = (v ?? '').trim()
  if (!/^\d{5}$/.test(d)) return false
  const provincia = Number(d.slice(0, 2))
  return provincia >= 1 && provincia <= 52
}

/** Qué le pasa al código postal. `null` si está bien o vacío. */
export function problemaDeCodigoPostal(v: string): string | null {
  const d = (v ?? '').trim()
  if (d === '') return null
  if (codigoPostalValido(d)) return null
  if (/^\d{4}$/.test(d)) {
    return `Un código postal son cinco cifras. Si es de una provincia que empieza `
      + `por cero, se escribe con él: 0${d}.`
  }
  if (!/^\d+$/.test(d)) return 'Un código postal son cinco cifras y nada más.'
  return d.length === 5
    ? 'Las dos primeras cifras son la provincia, de la 01 a la 52, y esas no lo son.'
    : `Un código postal son cinco cifras, y aquí hay ${d.length}.`
}
