/**
 * LEER UN .XLSX DE VERDAD, sin librerías.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ HACE FALTA
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La hermandad tiene su censo en Excel. Siempre. Y lo primero que hacía la
 * aplicación al recibirlo era esto:
 *
 *     «Esto es un archivo de Excel (.xlsx). Ábrelo en Excel y usa
 *      Archivo → Guardar como → CSV (delimitado por punto y coma).»
 *
 * O sea, el primer paso de la puesta en marcha —el que decide si siguen o lo
 * dejan— era mandarles a hacer a mano una conversión que el programa puede
 * hacer solo. Y no es un paso inocente: «CSV (delimitado por comas)» y «CSV
 * UTF-8» dan resultados distintos, los acentos se rompen en uno de ellos, y
 * quien no distingue las tres opciones del desplegable se queda ahí.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SIN DEPENDENCIAS, Y POR QUÉ SE PUEDE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un .xlsx es un ZIP con XML dentro. Nada más. Hacen falta tres cosas y las
 * tres las trae el navegador desde hace años:
 *
 *   · leer el índice del ZIP        → se hace a mano, son unos pocos campos
 *   · descomprimir                  → `DecompressionStream('deflate-raw')`
 *   · leer el XML                   → un recorrido a mano de cuatro etiquetas
 *
 * Meter una librería de hojas de cálculo para esto son cientos de kilobytes
 * que se descarga TODA la gente que entra, para una pantalla que se usa una
 * vez en la vida de la hermandad. No compensa.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LO QUE LEE Y LO QUE NO
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Lee la PRIMERA hoja, como texto, que es exactamente lo que necesita el
 * importador del censo: nombres, DNI, correos, teléfonos y años. No entiende
 * de fórmulas (lee el resultado guardado, que es lo que Excel deja escrito),
 * ni de formatos, ni de colores, ni de hojas enlazadas. No hace falta nada de
 * eso para un listado de hermanos.
 *
 * Si el archivo es un .xls antiguo (el de Excel 97, que NO es un ZIP) se dice
 * con esas palabras y se explica cómo guardarlo como .xlsx, que es un paso
 * mucho más fácil de dar que el del CSV.
 */

/** Lo que se saca de un archivo: filas de celdas en texto. */
export type Filas = string[][]

/** Un archivo que no podemos leer, con el motivo dicho para quien no es informático. */
export class ExcelIlegible extends Error {}

/** Firma de un ZIP. Todo .xlsx empieza por «PK». */
const PK = 0x04034b50
const PK_CENTRAL = 0x02014b50
const PK_FIN = 0x06054b50

/**
 * Los archivos de dentro del ZIP que nos interesan.
 *
 * `sharedStrings.xml` es donde Excel guarda los textos: en la hoja, una celda
 * de texto no lleva el texto, lleva el NÚMERO de la fila en esa lista. Sin
 * leerla, un censo entero sale como una columna de números.
 */
interface Zip {
  [nombre: string]: Uint8Array
}

/** Lee el índice del ZIP y devuelve el contenido de cada archivo, ya descomprimido. */
async function abrirZip(datos: Uint8Array): Promise<Zip> {
  const vista = new DataView(datos.buffer, datos.byteOffset, datos.byteLength)
  if (datos.length < 22 || vista.getUint32(0, true) !== PK) {
    throw new ExcelIlegible(
      'Este archivo no es una hoja de cálculo moderna. Si es un .xls de los antiguos, '
      + 'ábrelo en Excel y usa Archivo → Guardar como → Libro de Excel (.xlsx).',
    )
  }

  // El final del ZIP trae dónde empieza el índice. Se busca desde atrás porque
  // puede llevar un comentario detrás de longitud variable.
  let fin = -1
  for (let i = datos.length - 22; i >= 0 && i > datos.length - 22 - 0xffff; i--) {
    if (vista.getUint32(i, true) === PK_FIN) { fin = i; break }
  }
  if (fin < 0) throw new ExcelIlegible('El archivo de Excel está incompleto o dañado.')

  const cuantos = vista.getUint16(fin + 10, true)
  let p = vista.getUint32(fin + 16, true)

  const salida: Zip = {}
  for (let i = 0; i < cuantos; i++) {
    if (vista.getUint32(p, true) !== PK_CENTRAL) break
    const metodo = vista.getUint16(p + 10, true)
    const comprimido = vista.getUint32(p + 20, true)
    const largoNombre = vista.getUint16(p + 28, true)
    const largoExtra = vista.getUint16(p + 30, true)
    const largoComentario = vista.getUint16(p + 32, true)
    const desplazamiento = vista.getUint32(p + 42, true)
    const nombre = new TextDecoder().decode(datos.subarray(p + 46, p + 46 + largoNombre))
    p += 46 + largoNombre + largoExtra + largoComentario

    // Solo lo que vamos a usar: un libro con muchas hojas no tiene por qué
    // descomprimirse entero para leer la primera.
    if (!/^xl\/(worksheets\/sheet1\.xml|sharedStrings\.xml|workbook\.xml)$/.test(nombre)) continue

    // La cabecera local repite el nombre y trae su propio campo «extra», que
    // NO tiene por qué medir lo mismo que el del índice. Hay que leerlo de
    // aquí: usar el del índice descoloca el principio de los datos.
    const nombreLocal = vista.getUint16(desplazamiento + 26, true)
    const extraLocal = vista.getUint16(desplazamiento + 28, true)
    const desde = desplazamiento + 30 + nombreLocal + extraLocal
    const crudo = datos.subarray(desde, desde + comprimido)
    salida[nombre] = metodo === 0 ? crudo : await inflar(crudo)
  }
  return salida
}

/** Descomprime con lo que trae el navegador. */
async function inflar(datos: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new ExcelIlegible(
      'Este navegador no sabe abrir archivos de Excel. Actualízalo, o guarda el censo '
      + 'como CSV desde Excel y súbelo así.',
    )
  }
  const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(flujo).arrayBuffer())
}

/* ---------------------------------------------------------------------------
   El XML

   A mano y no con `DOMParser`, por dos motivos que pesan más que la comodidad:

     · `DOMParser` solo existe en el navegador, así que el lector no se podría
       probar en el banco de pruebas. Y esto lee el censo entero de una
       hermandad: es de lo último que conviene dejar sin comprobar.
     · El XML de una hoja de cálculo es de lo más simple que hay —lo escribe
       Excel, no una persona—: filas, celdas y textos. Cuatro etiquetas.
   --------------------------------------------------------------------------- */

/** Las cinco entidades de XML y las numéricas. Sin esto, «Ruiz &amp; Cía» sale con el «&amp;» a la vista. */
export function desescapar(t: string): string {
  return t.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (todo, e: string) => {
    if (e === 'amp') return '&'
    if (e === 'lt') return '<'
    if (e === 'gt') return '>'
    if (e === 'quot') return '"'
    if (e === 'apos') return "'"
    const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    return Number.isFinite(n) ? String.fromCodePoint(n) : todo
  })
}

/** El valor de un atributo de la etiqueta de apertura. */
function atributo(etiqueta: string, nombre: string): string | null {
  const m = etiqueta.match(new RegExp(`\\s${nombre}\\s*=\\s*"([^"]*)"`))
  return m ? desescapar(m[1]) : null
}

/**
 * Recorre los elementos `<nombre>` que hay en un trozo y entrega, de cada uno,
 * su etiqueta de apertura y lo que lleva dentro.
 *
 * Vale para `row`, `c`, `si`, `t` y `v` porque ninguno de ellos se mete dentro
 * de otro igual. No es un analizador de XML general y no pretende serlo.
 */
function* elementos(xml: string, nombre: string): Generator<{ apertura: string; dentro: string }> {
  const abre = new RegExp(`<${nombre}(\\s[^>]*?)?(/?)>`, 'g')
  let m: RegExpExecArray | null
  while ((m = abre.exec(xml))) {
    if (m[2] === '/') {                       // <c r="A1"/> — una celda vacía
      yield { apertura: m[0], dentro: '' }
      continue
    }
    const cierra = xml.indexOf(`</${nombre}>`, abre.lastIndex)
    if (cierra < 0) return
    yield { apertura: m[0], dentro: xml.slice(abre.lastIndex, cierra) }
    abre.lastIndex = cierra + nombre.length + 3
  }
}

/** Junta el contenido de todos los `<t>` de un trozo. */
function textosDe(trozo: string): string {
  let salida = ''
  for (const { dentro } of elementos(trozo, 't')) salida += desescapar(dentro)
  return salida
}

/**
 * Los textos compartidos.
 *
 * En la hoja, una celda de texto no lleva el texto: lleva el NÚMERO de la fila
 * de esta lista. Sin leerla, un censo entero sale como una columna de números.
 *
 * Ojo con `<si>`: un texto con trozos en distinta letra o color se guarda
 * partido en varios `<t>` dentro del mismo `<si>`, y hay que juntarlos. Cogiendo
 * solo el primero, «María José Pérez» puede quedarse en «María ».
 */
function leerTextos(xml: string): string[] {
  const salida: string[] = []
  for (const { dentro } of elementos(xml, 'si')) salida.push(textosDe(dentro))
  return salida
}

/** «BC12» → 54 (la columna, contando desde 0). */
export function columnaDeReferencia(ref: string): number {
  const letras = ref.replace(/[0-9]/g, '')
  let n = 0
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/**
 * Las filas de la primera hoja.
 *
 * Se respeta la POSICIÓN de cada celda, no el orden en que vienen. Excel se
 * salta las celdas vacías —una fila con la primera y la cuarta columna trae
 * dos celdas, no cuatro—, así que leerlas en orden correría los datos una
 * columna a la izquierda: los teléfonos acabarían en la casilla del DNI y
 * nadie lo notaría hasta llamar a alguien.
 */
function leerHoja(xml: string, textos: string[]): Filas {
  const filas: Filas = []
  for (const fila of elementos(xml, 'row')) {
    const celdas: string[] = []
    for (const c of elementos(fila.dentro, 'c')) {
      const donde = columnaDeReferencia(atributo(c.apertura, 'r') ?? '')
      if (donde < 0) continue
      const tipo = atributo(c.apertura, 't')
      let valor = ''
      if (tipo === 'inlineStr') {
        valor = textosDe(c.dentro)
      } else {
        let v = ''
        for (const e of elementos(c.dentro, 'v')) { v = desescapar(e.dentro); break }
        // `s` = el valor es el número de un texto de la lista compartida.
        valor = tipo === 's' ? (textos[Number(v)] ?? '') : v
      }
      celdas[donde] = valor
    }
    // Los huecos quedan `undefined` al asignar por posición; se rellenan.
    for (let i = 0; i < celdas.length; i++) if (celdas[i] === undefined) celdas[i] = ''
    filas.push(celdas)
  }
  // Filas del todo vacías al final de la hoja: Excel las guarda si alguien
  // pinchó ahí alguna vez, y llegarían al importador como «falta el nombre».
  while (filas.length && filas[filas.length - 1].every((c) => !c.trim())) filas.pop()
  return filas
}

/** ¿Los primeros bytes son los de un ZIP? Todo .xlsx lo es. */
export function pareceXlsx(datos: Uint8Array): boolean {
  return datos.length > 4 && datos[0] === 0x50 && datos[1] === 0x4b
}

/**
 * Lee un .xlsx y devuelve sus filas como texto.
 *
 * Lanza `ExcelIlegible` con un motivo en cristiano si no se puede.
 */
export async function leerXlsx(datos: Uint8Array): Promise<Filas> {
  const zip = await abrirZip(datos)
  const hoja = zip['xl/worksheets/sheet1.xml']
  if (!hoja) {
    throw new ExcelIlegible(
      'No se ha encontrado ninguna hoja dentro del archivo. Comprueba que el Excel tiene '
      + 'los datos en la primera hoja y vuelve a guardarlo.',
    )
  }
  const texto = (b: Uint8Array) => new TextDecoder('utf-8').decode(b)
  const textos = zip['xl/sharedStrings.xml'] ? leerTextos(texto(zip['xl/sharedStrings.xml'])) : []
  return leerHoja(texto(hoja), textos)
}
