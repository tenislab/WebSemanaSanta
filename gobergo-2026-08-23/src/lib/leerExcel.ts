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

    // Solo lo que vamos a usar. Entran TODAS las hojas —una hermandad exporta
    // su programa viejo en un libro con el censo, las cuotas y la caja, cada
    // cosa en su pestaña— pero no las imágenes ni los gráficos, que son la
    // mayor parte del peso de un .xlsx y no pintan nada aquí.
    //
    // `styles.xml` SÍ entra, y hace falta: es donde pone qué celdas son fechas.
    // Sin él, la fecha de alta de cada hermano llega como «36512».
    if (!/^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml|styles\.xml|workbook\.xml|_rels\/workbook\.xml\.rels)$/.test(nombre)) continue

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

/* ---------------------------------------------------------------------------
   LAS FECHAS

   EXCEL NO GUARDA FECHAS. Guarda NÚMEROS con un formato de fecha puesto
   encima. Al teclear «04/12/1999» en una casilla, dentro del archivo queda:

       <c r="B2" s="1"><v>36512</v></c>

   36512 es la cuenta de días desde el 30 de diciembre de 1899, y el `s="1"`
   apunta a una lista de estilos —`xl/styles.xml`— donde pone que eso se
   enseña como fecha. La celda no lleva ninguna marca de tipo: para quien no
   mire los estilos es un número y punto.

   Y ESE ERA EL FALLO. Este lector no abría `styles.xml`, así que la fecha de
   alta de cada hermano llegaba al importador como «36512». Ninguna de las
   formas que entiende `fechaIso` («04/12/1999», «1999-12-04», «4 dic 1999»)
   se parece a eso, así que la fecha se perdía: el censo entraba sin fechas de
   alta, sin fechas de nacimiento y sin fechas de bautismo, y con ellas se van
   la antigüedad y la segmentación por edad. Lo mismo en Tesorería, donde CADA
   movimiento lleva fecha.

   No saltaba en las pruebas porque los libros que genera este repositorio
   escriben todo como texto en línea, que es justo lo que Excel no hace nunca.
   Ahí está la trampa: el importador funcionaba con los archivos de casa y
   fallaba con los de la hermandad.

   Se devuelve en ISO (aaaa-mm-dd) a propósito: es una de las formas que
   entiende `fechaIso` y es la única que no se puede leer al revés. Con
   «04/12/1999» siempre queda la duda del día y el mes; con «1999-12-04» no.
   --------------------------------------------------------------------------- */

/**
 * Los formatos de fecha que Excel trae de fábrica, por su número.
 *
 * Del 14 al 22 son las fechas y las horas; del 45 al 47, duraciones. Los que
 * pasan de 163 se los inventa cada libro y hay que mirar su `formatCode`.
 */
const FORMATOS_DE_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57])

/** Los que son SOLO hora: ahí un día no significa nada y no se toca. */
const FORMATOS_DE_HORA = new Set([18, 19, 20, 21, 45, 46, 47])

/**
 * ¿Este `formatCode` de los inventados es una fecha?
 *
 * Se quitan antes las partes que no cuentan, y las dos importan:
 *
 *   · lo que va entre comillas —«"de" mmmm "de" aaaa»—, porque una `d` suelta
 *     dentro de un texto no es un día;
 *   · lo que va entre corchetes, que son el color y el idioma: `[Red]`,
 *     `[$-es-ES]`. Sin quitarlos, `[Red]#,##0` —un formato de dinero en rojo—
 *     tiene una `d` dentro y se leería como fecha, convirtiendo los importes
 *     de la hermandad en fechas de 1901.
 */
export function pareceFormatoDeFecha(codigo: string): boolean {
  const limpio = codigo.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')
  return /[ymd]/i.test(limpio)
}

/** Un `formatCode` que solo tiene horas, minutos y segundos. */
function esSoloHora(codigo: string): boolean {
  const limpio = codigo.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')
  return /[hs]/i.test(limpio) && !/[ymd]/i.test(limpio)
}

/**
 * Qué estilos son de fecha, sacado de `xl/styles.xml`.
 *
 * `cellXfs` es la lista a la que apunta el `s=` de cada celda, POR POSICIÓN.
 * Cada entrada dice su `numFmtId`, y si ese número pasa de 163 hay que buscar
 * su `formatCode` en la lista `numFmts` de más arriba.
 */
export function estilosDeFecha(styles: string): Set<number> {
  const inventados = new Map<number, string>()
  for (const m of styles.matchAll(/<numFmt\b[^>]*\/?>/g)) {
    const id = m[0].match(/\bnumFmtId="(\d+)"/)
    const codigo = m[0].match(/\bformatCode="([^"]*)"/)
    if (id && codigo) inventados.set(Number(id[1]), desescapar(codigo[1]))
  }

  const salida = new Set<number>()
  // Solo el bloque `cellXfs`: `cellStyleXfs`, que va antes, tiene la misma
  // etiqueta `<xf>` dentro y NO es a la que apunta el `s=` de las celdas.
  const bloque = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)
  if (!bloque) return salida
  let i = 0
  for (const m of bloque[1].matchAll(/<xf\b[^>]*?(?:\/>|>)/g)) {
    const id = m[0].match(/\bnumFmtId="(\d+)"/)
    const n = id ? Number(id[1]) : 0
    const codigo = inventados.get(n)
    const esFecha = codigo !== undefined
      ? pareceFormatoDeFecha(codigo) && !esSoloHora(codigo)
      : FORMATOS_DE_FECHA.has(n) && !FORMATOS_DE_HORA.has(n)
    if (esFecha) salida.add(i)
    i += 1
  }
  return salida
}

/**
 * El número de Excel, en fecha ISO.
 *
 * EL ORIGEN ES EL 30 DE DICIEMBRE DE 1899 Y NO EL 31, y no es una errata:
 * Excel arrastra desde Lotus 1-2-3 la creencia de que 1900 fue bisiesto. Como
 * el 29 de febrero de 1900 no existió, todo lo posterior al 1 de marzo de 1900
 * viene corrido un día, y restar ese día en el origen lo endereza. Los que van
 * por debajo de 60 —enero y febrero de 1900— caen del otro lado del error y
 * necesitan el origen de verdad; no aparece ninguno en un censo, pero se hace
 * bien porque cuesta una línea.
 *
 * `mil904` es para los libros que vienen de los Excel antiguos de Mac, que
 * cuentan desde 1904. Lo dice el propio libro en `workbookPr`.
 */
export function fechaDeExcel(serie: number, mil904 = false): string | null {
  if (!Number.isFinite(serie) || serie < 0 || serie > 2958465) return null
  const dias = Math.floor(serie) + (mil904 ? 1462 : 0)
  // Se calcula en UTC de propósito: con la hora local, un huso al oeste de
  // Greenwich devuelve el día de antes en la mitad de las fechas.
  const base = Date.UTC(1899, 11, !mil904 && dias < 60 ? 31 : 30)
  const d = new Date(base + dias * 86400000)
  if (Number.isNaN(d.getTime())) return null
  const dd = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${dd(d.getUTCMonth() + 1)}-${dd(d.getUTCDate())}`
}

/** Lo que hace falta saber del libro para entender sus fechas. */
interface Fechas {
  /** Qué números de estilo son de fecha. */
  estilos: Set<number>
  /** Si el libro cuenta los días desde 1904 (los Excel antiguos de Mac). */
  mil904: boolean
}

/** Un libro sin estilos: ninguna celda se toma por fecha. */
const SIN_FECHAS: Fechas = { estilos: new Set(), mil904: false }

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
function leerHoja(xml: string, textos: string[], fechas: Fechas = SIN_FECHAS): Filas {
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
        if (tipo === 's') {
          valor = textos[Number(v)] ?? ''
        } else {
          valor = v
          /*
           * Y AQUÍ LA FECHA. Una celda sin tipo cuyo estilo es de fecha lleva
           * dentro el número de días de Excel; se devuelve en ISO, que es una
           * de las formas que entiende `fechaIso` y la única que no admite dos
           * lecturas. Si el número no cuadra se deja tal cual: es preferible
           * que se vea el número en la vista previa a inventar una fecha.
           */
          if (v !== '' && fechas.estilos.size > 0) {
            const estilo = atributo(c.apertura, 's')
            if (estilo !== null && fechas.estilos.has(Number(estilo))) {
              valor = fechaDeExcel(Number(v), fechas.mil904) ?? v
            }
          }
        }
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

/** Una pestaña del libro: su nombre tal cual se ve en Excel, y sus filas. */
export interface Hoja {
  nombre: string
  filas: Filas
}

/**
 * DE QUÉ FICHERO SALE CADA PESTAÑA, que no es «la primera es sheet1.xml».
 *
 * `workbook.xml` da los nombres y el orden que se ven en Excel, pero para el
 * fichero solo da un `r:id`; quien lo traduce es `_rels/workbook.xml.rels`. Y
 * la numeración NO tiene por qué seguir el orden: basta con borrar una pestaña
 * y crear otra para que la tercera del libro sea `sheet5.xml`. Ir por el
 * número es leer la hoja equivocada, y de las que se parecen —dos ejercicios
 * de cuotas, uno al lado del otro— sin que nada lo delate.
 */
function hojasDelLibro(workbook: string, rels: string): { nombre: string; ruta: string }[] {
  const destino = new Map<string, string>()
  for (const m of rels.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = m[0].match(/\bId="([^"]+)"/)
    const target = m[0].match(/\bTarget="([^"]+)"/)
    if (!id || !target) continue
    // El destino puede venir relativo a `xl/` («worksheets/sheet1.xml») o
    // absoluto desde la raíz del zip («/xl/worksheets/sheet1.xml»).
    const t = desescapar(target[1])
    destino.set(id[1], t.startsWith('/') ? t.slice(1) : `xl/${t}`)
  }

  const salida: { nombre: string; ruta: string }[] = []
  for (const m of workbook.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const nombre = m[0].match(/\bname="([^"]*)"/)
    const rid = m[0].match(/\br:id="([^"]+)"/)
    if (!nombre || !rid) continue
    const ruta = destino.get(rid[1])
    if (ruta) salida.push({ nombre: desescapar(nombre[1]), ruta })
  }
  return salida
}

/**
 * Lee un .xlsx entero: todas sus pestañas, en el orden en que se ven en Excel.
 *
 * Lanza `ExcelIlegible` con un motivo en cristiano si no se puede.
 */
export async function leerLibro(datos: Uint8Array): Promise<Hoja[]> {
  const zip = await abrirZip(datos)
  const texto = (b: Uint8Array) => new TextDecoder('utf-8').decode(b)
  const textos = zip['xl/sharedStrings.xml'] ? leerTextos(texto(zip['xl/sharedStrings.xml'])) : []

  const workbook = zip['xl/workbook.xml']
  const rels = zip['xl/_rels/workbook.xml.rels']
  const declaradas = workbook && rels ? hojasDelLibro(texto(workbook), texto(rels)) : []

  /*
   * Los estilos, para saber qué celdas son fechas. `date1904` lo dice el propio
   * libro y solo lo traen los que vienen de un Excel antiguo de Mac; ahí los
   * días se cuentan desde 1904 y, sin mirarlo, todas las fechas salen cuatro
   * años y un día antes de lo que son.
   */
  const fechas: Fechas = {
    estilos: zip['xl/styles.xml'] ? estilosDeFecha(texto(zip['xl/styles.xml'])) : new Set(),
    mil904: workbook ? /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(texto(workbook)) : false,
  }

  const hojas: Hoja[] = []
  for (const { nombre, ruta } of declaradas) {
    const cruda = zip[ruta]
    if (cruda) hojas.push({ nombre, filas: leerHoja(texto(cruda), textos, fechas) })
  }

  /*
   * Si el libro no declara sus hojas —lo escriben también programas que no son
   * Excel, y alguno se deja el `.rels`— se cae a la primera por su nombre de
   * fichero, que es lo que se hacía antes. Peor que leer los nombres, mejor
   * que no leer nada.
   */
  if (hojas.length === 0 && zip['xl/worksheets/sheet1.xml']) {
    hojas.push({ nombre: 'Hoja 1', filas: leerHoja(texto(zip['xl/worksheets/sheet1.xml']), textos, fechas) })
  }

  if (hojas.length === 0) {
    throw new ExcelIlegible(
      'No se ha encontrado ninguna hoja dentro del archivo. Comprueba que el Excel tiene '
      + 'los datos en la primera hoja y vuelve a guardarlo.',
    )
  }
  return hojas
}

/**
 * Lee un .xlsx y devuelve las filas de la PRIMERA hoja.
 *
 * Lanza `ExcelIlegible` con un motivo en cristiano si no se puede.
 */
export async function leerXlsx(datos: Uint8Array): Promise<Filas> {
  return (await leerLibro(datos))[0].filas
}
