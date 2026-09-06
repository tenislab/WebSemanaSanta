/**
 * ESCRIBIR UN .XLSX DE VERDAD, SIN LIBRERÍA.
 *
 * Ya se leen los .xlsx a mano (`leerExcel.ts`); esto es la vuelta. Y hace falta
 * por una razón concreta: la memoria del ejercicio son SEIS listados —censo,
 * cuotas, papeletas, cortejo, tesorería, inventario— y hasta ahora se
 * descargaban de uno en uno, seis CSV sueltos. Quien se lleva las cuentas al
 * cabildo general quiere UN archivo, con sus pestañas, no seis adjuntos que hay
 * que volver a juntar.
 *
 * ----------------------------------------------------------------------------
 * CÓMO, Y POR QUÉ ASÍ
 * ----------------------------------------------------------------------------
 *
 * Un .xlsx es un ZIP con varios XML dentro. Nada más. Aquí se escribe con las
 * entradas SIN COMPRIMIR (método 0, «stored»), que el formato ZIP admite y
 * Excel abre igual de bien.
 *
 * No es pereza, es lo que lo hace comprobable: comprimir obligaría a
 * `CompressionStream`, que es del navegador, y entonces esto solo se podría
 * probar abriendo un navegador. Sin comprimir, los bytes salen iguales aquí y
 * en Node, y hay pruebas que los miran uno a uno. Un .xlsx mal escrito no da un
 * error a medias: Excel dice que el archivo está dañado y ahí se acabó.
 *
 * Un listado de censo de mil filas ocupa unos 200 KB sin comprimir. Es un
 * archivo que se descarga una vez al año.
 */

/**
 * Lo que puede llevar una celda.
 *
 * `{ euros }` no es un adorno. Un importe tiene que llegar a Excel COMO
 * NÚMERO para que la columna se pueda sumar —lo primero que hace quien abre
 * esto—, pero enseñándose «3.600,50 €» y no «3600,5», que en unas cuentas se
 * lee mal. Las dos cosas a la vez son un número con formato, y eso obliga a
 * llevar un `styles.xml` dentro del libro.
 */
export type ValorCelda = string | number | { euros: number }

/** Una pestaña del libro. */
export interface HojaExcel {
  /** El nombre de la pestaña. Excel lo recorta y prohíbe algunos caracteres. */
  nombre: string
  columnas: string[]
  filas: ValorCelda[][]
}

/*
 * LOS TRES ESTILOS DEL LIBRO, por su posición en `cellXfs` (ver `ESTILOS`):
 * el 0 es el corriente y no hace falta escribirlo en la celda.
 */
const ESTILO_EUROS = 1
const ESTILO_CABECERA = 2

/**
 * `styles.xml`, la pieza que permite que un número se vea como dinero.
 *
 * Va a mano y entero porque Excel es exigente con este archivo: las listas de
 * fuentes, rellenos y bordes tienen que estar TODAS aunque no se usen, y con
 * su `count` cuadrado. Si falta una, el libro no se abre a medias: se abre
 * «dañado», que es como no abrirse.
 *
 * `cellXfs` es la lista a la que apunta el atributo `s` de cada celda:
 *
 *   0 · corriente
 *   1 · importe: `#,##0.00 €`, que en un Excel en español sale «3.600,50 €».
 *       El código de formato se escribe con la coma y el punto INGLESES —así
 *       se guarda siempre— y Excel lo enseña con los del idioma de quien abre.
 *   2 · negrita, para la fila de títulos.
 */
const ESTILOS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;\u20ac&quot;"/></numFmts>'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
  + '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill>'
  + '<fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="3">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '</styleSheet>'

/*
 * EL NOMBRE DE LA PESTAÑA, como lo admite Excel.
 *
 * Máximo 31 caracteres y sin los dos puntos, la barra, la contrabarra, la
 * interrogación, el asterisco ni los corchetes. Con uno solo de esos, el
 * archivo entero se abre «dañado» — no se pierde esa pestaña: no se abre nada.
 * Y los nombres salen de títulos escritos por una persona, así que hay que
 * limpiarlos aquí y no confiar en que nadie ponga una barra.
 */
export function nombreDeHoja(bruto: string, usados: string[] = []): string {
  let n = (bruto || 'Hoja')
    .replace(/[:\\/?*[\]]/g, ' ')
    // Los prohibidos se cambian por un espacio, así que «Caja [x]: del mes»
    // quedaría con tres seguidos. Se juntan: es un rótulo que se ve.
    .replace(/\s+/g, ' ')
    // El apóstrofo al principio o al final tampoco lo admite Excel.
    .replace(/^'+|'+$/g, '')
    .trim()
    .slice(0, 31)
    // Y si el recorte parte justo en un espacio, fuera también.
    .trim() || 'Hoja'
  // Ni repetido: dos pestañas con el mismo nombre también rompen el archivo.
  if (usados.includes(n)) {
    let i = 2
    // Se recorta para que el sufijo quepa dentro de los 31.
    while (usados.includes(`${n.slice(0, 28)} ${i}`)) i += 1
    n = `${n.slice(0, 28)} ${i}`
  }
  return n
}

/** Lo que no se puede meter en un XML tal cual. */
function xml(v: string): string {
  return v
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    /*
     * Y LOS CARACTERES DE CONTROL FUERA. Un censo importado de un Access viejo
     * trae de vez en cuando un byte de control dentro de una dirección. XML 1.0
     * no los admite, y con uno solo Excel abre el archivo «dañado»: se pierde
     * el libro entero por un byte que nadie ve.
     */
    // eslint-disable-next-line no-control-regex -- justo eso es lo que se quita
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

/** «A1», «B7», «AA3»… La columna en letras, que es como las nombra Excel. */
export function celda(col: number, fila: number): string {
  let n = col + 1
  let letras = ''
  while (n > 0) {
    const r = (n - 1) % 26
    letras = String.fromCharCode(65 + r) + letras
    n = Math.floor((n - 1) / 26)
  }
  return `${letras}${fila}`
}

function hojaXml(h: HojaExcel): string {
  const filas: string[] = []
  const pintar = (valores: ValorCelda[], nFila: number, cabecera: boolean) => {
    const celdas = valores.map((v, i) => {
      const ref = celda(i, nFila)
      /*
       * LOS NÚMEROS VAN COMO NÚMEROS y el resto como texto.
       *
       * Es toda la diferencia entre un Excel que suma y uno que no: con todo en
       * texto, la columna de importes no se puede totalizar, que es lo primero
       * que hace quien abre esto. `t="inlineStr"` evita la tabla de cadenas
       * compartidas —un XML más— sin perder nada.
       */
      if (!cabecera && v !== null && typeof v === 'object' && Number.isFinite(v.euros)) {
        return `<c r="${ref}" s="${ESTILO_EUROS}"><v>${v.euros}</v></c>`
      }
      if (!cabecera && typeof v === 'number' && Number.isFinite(v)) {
        return `<c r="${ref}"><v>${v}</v></c>`
      }
      const estilo = cabecera ? ` s="${ESTILO_CABECERA}"` : ''
      const texto = v !== null && typeof v === 'object' ? String(v.euros) : String(v ?? '')
      return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${xml(texto)}</t></is></c>`
    })
    filas.push(`<row r="${nFila}">${celdas.join('')}</row>`)
  }
  pintar(h.columnas, 1, true)
  h.filas.forEach((f, i) => pintar(f, i + 2, false))

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filas.join('')}</sheetData></worksheet>`
}

/*
 * CRC-32, que el ZIP exige por entrada. Sin él —o con uno mal— el archivo se
 * abre «dañado». La tabla se calcula una vez.
 */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i += 1) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Un ZIP con las entradas sin comprimir. Ver el porqué arriba. */
function zip(entradas: { nombre: string; datos: Uint8Array }[]): Uint8Array {
  const trozos: Uint8Array[] = []
  const central: Uint8Array[] = []
  let desplazamiento = 0
  const codificador = new TextEncoder()

  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff]
  const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]

  for (const e of entradas) {
    const nombre = codificador.encode(e.nombre)
    const crc = crc32(e.datos)
    const cab = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      // Fecha y hora fijas: un archivo generado dos veces con los mismos datos
      // tiene que salir byte a byte igual, o no se puede comprobar.
      ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(e.datos.length), ...u32(e.datos.length),
      ...u16(nombre.length), ...u16(0),
      ...nombre,
    ])
    trozos.push(cab, e.datos)
    central.push(Uint8Array.from([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(e.datos.length), ...u32(e.datos.length),
      ...u16(nombre.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(desplazamiento),
      ...nombre,
    ]))
    desplazamiento += cab.length + e.datos.length
  }

  const dirLargo = central.reduce((n, c) => n + c.length, 0)
  const fin = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(entradas.length), ...u16(entradas.length),
    ...u32(dirLargo), ...u32(desplazamiento), ...u16(0),
  ])

  const total = desplazamiento + dirLargo + fin.length
  const salida = new Uint8Array(total)
  let i = 0
  for (const t of [...trozos, ...central, fin]) { salida.set(t, i); i += t.length }
  return salida
}

/**
 * El libro entero, listo para descargar.
 *
 * Devuelve los bytes y no un `Blob` a propósito: así se puede comprobar en las
 * pruebas sin navegador, que es de lo que depende que esto no se rompa sin que
 * nadie se entere.
 */
export function libroExcel(hojas: HojaExcel[]): Uint8Array {
  // Un libro sin hojas no lo abre Excel: se pone una vacía antes que producir
  // un archivo que dice estar dañado.
  const lista = hojas.length > 0 ? hojas : [{ nombre: 'Hoja 1', columnas: [], filas: [] }]
  const usados: string[] = []
  const conNombre = lista.map((h) => {
    const nombre = nombreDeHoja(h.nombre, usados)
    usados.push(nombre)
    return { ...h, nombre }
  })

  const cod = new TextEncoder()
  const e = (nombre: string, texto: string) => ({ nombre, datos: cod.encode(texto) })

  const refs = conNombre.map((h, i) =>
    `<sheet name="${xml(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
  // `styles.xml` va detrás de las hojas, con el siguiente rId libre.
  const rels = conNombre.map((_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${conNombre.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
  const tipos = conNombre.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'

  return zip([
    e('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tipos}</Types>`),
    e('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    e('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${refs}</sheets></workbook>`),
    e('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`),
    e('xl/styles.xml', ESTILOS),
    ...conNombre.map((h, i) => e(`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h))),
  ])
}

/** Descargarlo con el nombre que se le quiera dar. */
export function descargarExcel(nombre: string, hojas: HojaExcel[]): void {
  const blob = new Blob([libroExcel(hojas) as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
