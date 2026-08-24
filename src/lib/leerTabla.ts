import { aCentimos } from './format'

/**
 * LEER LA HOJA QUE TRAE LA HERMANDAD. Sin saber de qué es.
 *
 * Todo lo de aquí es el trabajo bruto que hay que hacer con CUALQUIER archivo
 * que llegue —el censo, el historial de cuotas, el libro de caja, el
 * inventario—: partirlo en filas, entender cómo se llaman sus columnas y
 * traducir lo que hay escrito en las casillas a fechas y a euros de verdad.
 *
 * Vivía dentro de `importar.ts`, que era el importador del censo. Cuando hizo
 * falta traer también las cuotas y la tesorería, la alternativa era copiarlo, y
 * un lector de CSV copiado es un lector de CSV que se arregla en un sitio y se
 * queda roto en el otro.
 *
 * Nada de aquí escribe: se le da texto y devuelve lo que ha entendido, o
 * `null` cuando no lo entiende. Devolver `null` importa — adivinar un importe
 * y guardarlo mal es peor que no importarlo.
 */

/* ---------------------------------------------------------------------------
   1. Partir el archivo
   --------------------------------------------------------------------------- */

/**
 * Con qué se separan las columnas. En España Excel suele soltar **punto y
 * coma**, porque la coma es el separador decimal; pero medio mundo exporta con
 * coma, y algunos programas antiguos con tabulador. Se detecta en vez de
 * obligar a la hermandad a saberlo.
 */
export function detectarSeparador(texto: string): ';' | ',' | '\t' {
  /*
   * NO SE MIRA LA PRIMERA LÍNEA, SE MIRAN LAS PRIMERAS.
   *
   * La hoja de una hermandad empieza muchas veces con un título —«HERMANDAD DE
   * NUESTRO PADRE JESÚS», y debajo «Listado a 14/02/2026»— y solo después va la
   * fila de las columnas. Esa primera línea no tiene NINGÚN separador, así que
   * se elegía el punto y coma por descarte; y si el archivo venía con comas, el
   * censo entero se leía como una sola columna. El fallo que se veía era «faltan
   * columnas obligatorias», que no lleva a ninguna parte.
   *
   * Se suman las de las primeras líneas: la del título aporta cero y no estorba.
   */
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 12)
  const cuenta = { ';': 0, ',': 0, '\t': 0 }
  for (const linea of lineas) {
    // Se cuenta FUERA de las comillas: un nombre como «Pérez, Ana» tiene comas
    // que no separan nada, y contándolas a pelo ganaba siempre la coma.
    let dentro = false
    for (const c of linea) {
      if (c === '"') dentro = !dentro
      else if (!dentro && (c === ';' || c === ',' || c === '\t')) cuenta[c] += 1
    }
  }
  if (cuenta['\t'] > cuenta[';'] && cuenta['\t'] > cuenta[',']) return '\t'
  return cuenta[','] > cuenta[';'] ? ',' : ';'
}

/**
 * Parte un CSV en filas y celdas, respetando las comillas y los saltos de línea
 * que van dentro de una celda entrecomillada (una dirección de dos líneas, por
 * ejemplo). Partir por `\n` a secas rompe justo esos casos.
 */
export function leerCsv(texto: string, separador?: string): string[][] {
  // El BOM que mete Excel se cuela en el nombre de la primera columna y luego
  // no empareja con nada.
  const limpio = texto.replace(/^\uFEFF/, '')
  const sep = separador ?? detectarSeparador(limpio)
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let dentro = false
  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio[i]
    if (dentro) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { celda += '"'; i += 1 } // comilla escapada
        else dentro = false
      } else celda += c
    } else if (c === '"') {
      dentro = true
    } else if (c === sep) {
      fila.push(celda); celda = ''
    } else if (c === '\n') {
      fila.push(celda); filas.push(fila); fila = []; celda = ''
    } else if (c !== '\r') {
      celda += c
    }
  }
  // Lo que quede sin cerrar al final del archivo también cuenta.
  if (celda !== '' || fila.length > 0) { fila.push(celda); filas.push(fila) }
  // Las filas vacías del final (un salto de línea suelto) no son datos.
  return filas.filter((f) => f.some((x) => x.trim() !== ''))
}

/** Un .xls antiguo, que tampoco es texto. */
export function pareceBinario(texto: string): boolean {
  // Un CSV no lleva bytes nulos; un binario, casi siempre.
  return texto.slice(0, 2000).includes('\u0000')
}

/* ---------------------------------------------------------------------------
   2. Entender cómo se llaman las columnas
   --------------------------------------------------------------------------- */

/** Quita tildes, signos y mayúsculas para poder comparar nombres de columna. */
export function normalizarCabecera(t: string): string {
  return (t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    /*
     * Fuera la ordinal y los signos de pregunta.
     *
     * En una hoja española esto NO es un adorno: las cabeceras se escriben
     * «Nº de cuenta» y «¿Está de baja?», y sin quitar el «º» y los «¿?» ni una
     * ni otra coincidían con nada. La del IBAN se quedaba sin emparejar —había
     * que buscarla a mano en un desplegable de diez— y la de la baja no se
     * reconocía como la que pregunta al revés, que es peor: importaba a los
     * activos como bajas y a las bajas como activos.
     *
     * Se quitan en los DOS lados, cabecera y sinónimo, porque la lista de
     * sinónimos se normaliza con esta misma función.
     */
    .replace(/[ºª°¿?¡!#]/g, '')
    .replace(/[._·/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ---------------------------------------------------------------------------
   3. Traducir lo que hay escrito en la casilla
   --------------------------------------------------------------------------- */

function armarFecha(anio: number, mes: number, dia: number): string | null {
  if (anio < 1900 || anio > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  // Que la fecha exista de verdad: un 31 de febrero se cuela en cualquier
  // comprobación de rangos y luego revienta al ordenar por edad.
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/**
 * Una fecha, siempre en ISO (aaaa-mm-dd), venga como venga.
 *
 * Antes se guardaba TAL CUAL venía. Y las hojas españolas la traen en
 * dd/mm/aaaa, así que el censo se llenaba de «14/03/1971»: una cadena que no
 * es una fecha para nadie. Consecuencia callada: la segmentación por edad
 * («mandar a los mayores de 65», «los menores de edad necesitan tutor») no
 * encontraba a nadie, porque ninguna de esas cadenas se puede comparar.
 *
 * Devuelve null si no se entiende, y entonces se avisa en la fila en vez de
 * guardar basura.
 */
export function fechaIso(v: string): string | null {
  /*
   * LA HORA, FUERA. Y esto es lo que traía el extracto del banco.
   *
   * Un movimiento exportado de la banca electrónica no viene «14/03/1985»:
   * viene «14/03/1985 12:30», o «01/01/2026 0:00», que es lo que pone Excel
   * cuando la celda es de tipo fecha-hora aunque la hora sea las doce de la
   * noche. Ninguno de los tres patrones de abajo lo reconocía, así que el
   * libro de caja se importaba con «No se entiende la fecha» EN TODAS LAS
   * FILAS — y la fecha es campo obligatorio, así que no entraba ni un apunte.
   *
   * El día es lo único que se guarda de una fecha en esta aplicación, así que
   * la hora no se pierde: es que no se usaba para nada.
   */
  const s = (v ?? '').trim().replace(/[\sT]+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*(?:[AaPp]\.?[Mm]\.?)?\s*(?:Z|[+-]\d{2}:?\d{2})?$/, '')
  if (!s) return null
  // Ya viene en ISO.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (iso) return armarFecha(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  // dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa — y con el año de dos cifras.
  const es = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s)
  if (es) {
    let anio = Number(es[3])
    if (anio < 100) {
      // Dos cifras: 30 → 2030 no tiene sentido para un nacimiento. El corte en
      // el año en curso es lo que usan las hojas de cálculo.
      const dosUltimas = new Date().getFullYear() % 100
      anio += anio <= dosUltimas ? 2000 : 1900
    }
    return armarFecha(anio, Number(es[2]), Number(es[1]))
  }
  /*
   * Con el mes en letra: «3 de febrero de 2026», «03 feb 2026».
   *
   * No es un capricho: es EXACTAMENTE como guarda las fechas la propia
   * aplicación (`fecha: '05 ene 2026'` en Tesorería y en Cuotas). Sin esto,
   * exportar el libro de caja de Gobergo y volver a subirlo no se entendía —y
   * ese es el primer movimiento que hace cualquiera al probar el importador.
   */
  const conLetra = /^(\d{1,2})\s*(?:de\s+)?([a-zA-ZÀ-ɏ]{3,})\.?\s*(?:de\s+)?(\d{4})$/.exec(s)
  if (conLetra) {
    const mesTexto = normalizarCabecera(conLetra[2])
    const mes = MESES_LARGOS.findIndex((m) => m.startsWith(mesTexto) || mesTexto.startsWith(m.slice(0, 3)))
    if (mes >= 0) return armarFecha(Number(conLetra[3]), mes + 1, Number(conLetra[1]))
  }
  return null
}

/**
 * Una fecha ISO, escrita como la escribe la aplicación («03 feb 2026»).
 *
 * Se usa `toLocaleDateString` a propósito, y no una tabla de meses propia: es
 * lo que usan Cuotas y Tesorería al crear un apunte a mano, y lo importado
 * tiene que quedar escrito IGUAL que lo tecleado. Dos formatos conviviendo en
 * la misma columna se ordenan mal y se leen peor.
 */
export function fechaEs(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * El año (4 cifras) de lo que sea que venga: «1998», «12/03/1998»,
 * «1998-03-12». Devuelve null si no hay forma de sacar un año creíble.
 */
export function anioDe(v: string): number | null {
  const t = (v ?? '').trim()
  if (!t) return null
  const soloAnio = /^\d{4}$/.exec(t)
  if (soloAnio) {
    const n = Number(t)
    return n >= 1400 && n <= 2200 ? n : null
  }
  const conFecha = /(\d{4})/.exec(t)
  if (conFecha) {
    const n = Number(conFecha[1])
    return n >= 1400 && n <= 2200 ? n : null
  }
  return null
}

/**
 * UN IMPORTE, EN EUROS. Es lo más delicado de todo el importador: aquí se
 * decide si un recibo son 1.234,56 € o 123.456 €.
 *
 * La regla, que es la de las hojas de cálculo de toda la vida:
 *
 *   · Si están los DOS separadores («1.234,56» / «1,234.56»), el de más a la
 *     derecha es el decimal y el otro son los millares. Esto solo no basta,
 *     porque la mitad de las hojas traen uno nada más.
 *   · Si solo hay uno y aparece varias veces («1.234.567»), son millares.
 *   · Si solo hay uno y aparece una vez, decide CUÁNTAS CIFRAS LLEVA DETRÁS:
 *     tres exactas son millares («1.234» y «1,234» son mil doscientos treinta
 *     y cuatro), y cualquier otra cosa es el decimal («12,5» / «12.50»).
 *     Tres decimales no existen en euros, así que la regla no se equivoca en
 *     dinero — y es la única forma de leer bien las dos convenciones a la vez.
 *
 * Además se aceptan las tres formas de escribir un número en negativo que
 * sueltan los bancos: «-120,00», «(120,00)» y «120,00-».
 *
 * Devuelve null si no es un número. NUNCA devuelve 0 para lo que no entiende:
 * un cero silencioso en una columna de importes descuadra la caja y no hay
 * quien lo encuentre después.
 */
export function importeDe(v: string): number | null {
  let s = (v ?? '').trim()
  if (!s) return null

  let negativo = false
  // Contabilidad de toda la vida: lo que está entre paréntesis va en contra.
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1).trim() }
  // Fuera la moneda y los espacios, incluidos los finos que mete Excel.
  s = s.replace(/€|\$|£|eur\b|euros?\b/gi, '').replace(/[\s\u00a0\u202f\u2019']/g, '')
  if (s.startsWith('-')) { negativo = true; s = s.slice(1) }
  else if (s.startsWith('+')) s = s.slice(1)
  // Algunos extractos ponen el signo detrás: «120,00-».
  if (s.endsWith('-')) { negativo = true; s = s.slice(0, -1) }

  if (!/^[\d.,]*\d[\d.,]*$/.test(s)) return null

  const puntos = (s.match(/\./g) ?? []).length
  const comas = (s.match(/,/g) ?? []).length
  let entero = s
  let decimal = ''
  if (puntos > 0 && comas > 0) {
    const iDec = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','))
    entero = s.slice(0, iDec)
    decimal = s.slice(iDec + 1)
  } else if (puntos + comas === 1) {
    const i = puntos === 1 ? s.indexOf('.') : s.indexOf(',')
    const detras = s.length - i - 1
    if (detras !== 3) { entero = s.slice(0, i); decimal = s.slice(i + 1) }
  }
  entero = entero.replace(/[.,]/g, '')
  if (entero !== '' && !/^\d+$/.test(entero)) return null
  if (decimal !== '' && !/^\d+$/.test(decimal)) return null

  const n = Number(`${entero || '0'}.${decimal || '0'}`)
  if (!Number.isFinite(n)) return null
  // Redondeado a céntimos al entrar, como todo el dinero de la aplicación.
  return aCentimos(negativo ? -n : n)
}

/**
 * Un sí o un no de una casilla. Devuelve null si no es ninguna de las dos
 * cosas, para poder distinguir «ha dicho que no» de «no ha dicho nada».
 */
export function siNo(v: string): boolean | null {
  const t = normalizarCabecera(v)
  if (!t) return null
  if (['si', 'x', 'true', 'verdadero', '1', 'v', 'y', 'yes'].includes(t)) return true
  if (['no', 'false', 'falso', '0', 'n'].includes(t)) return false
  return null
}

/**
 * Elige de una lista el valor que mejor casa con lo escrito en la casilla.
 * Sirve para las categorías y las cuentas, que cada hermandad configura a su
 * gusto: lo que trae la hoja casi nunca está escrito exactamente igual.
 *
 * Devuelve null si no se parece a ninguna, y entonces quien llama decide (unas
 * veces es un error, otras se deja el texto tal cual y se avisa).
 */
export function elegirDeLista(valor: string, lista: readonly string[]): string | null {
  const t = normalizarCabecera(valor)
  if (!t) return null
  const exacto = lista.find((x) => normalizarCabecera(x) === t)
  if (exacto) return exacto
  // Que una contenga a la otra: «Cultos» encuentra «Cultos Internos», y
  // «Mantenimiento casa hermandad» encuentra «Mantenimiento».
  const parecido = lista.find((x) => {
    const n = normalizarCabecera(x)
    return n.length >= 4 && (n.startsWith(t) || t.startsWith(n))
  })
  return parecido ?? null
}
