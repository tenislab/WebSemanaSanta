#!/usr/bin/env node
/**
 * El censo de prueba, en .xlsx y en .csv.
 *
 *   node scripts/censo-de-prueba.mjs [carpeta]
 *
 * Para qué sirve: para que una hermandad que se acaba de dar de alta pruebe el
 * traspaso de datos ANTES de subir el suyo de verdad. Trae a propósito los
 * líos que trae siempre un censo real, para que se vea que el importador los
 * caza y los dice:
 *
 *   · un DNI repetido (la misma persona metida dos veces)
 *   · una fila sin DNI
 *   · una fila sin nombre
 *   · acentos y eñes por todas partes (es donde se rompe el CSV mal guardado)
 *   · un IBAN con espacios, como se copia de la libreta
 *   · fechas y años escritos de tres maneras distintas
 *   · la columna de situación con «Sí/No», que significa lo contrario
 *
 * Se escribe el .xlsx a mano —un .xlsx es un ZIP con XML dentro— para no meter
 * una dependencia por un archivo que se genera una vez.
 */
import { deflateRawSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** Las columnas, escritas como las escribe una hermandad, no como las quiere el programa. */
export const CABECERAS = [
  'Nº Hermano', 'Apellidos y nombre', 'D.N.I.', 'Fecha de alta', 'Fecha nacimiento',
  'Correo', 'Teléfono móvil', 'Domicilio', 'Nº de cuenta', '¿Está de baja?',
]

/**
 * Treinta hermanos. Nombres inventados, DNI con letra correcta e IBAN con
 * dígito de control válido: si fueran inventados a lo loco, el importador los
 * marcaría todos como erróneos y la prueba no enseñaría nada.
 */
export const FILAS = [
  ['1', 'Aguilar Ponce, María del Carmen', '12345678Z', '1978', '12/03/1955', 'mcarmen.aguilar@ejemplo.es', '655 100 201', 'C/ Pureza, 14', 'ES9121000418450200051332', 'No'],
  ['2', 'Bermúdez Cano, José Antonio', '23456789J', '1981', '04/07/1958', 'ja.bermudez@ejemplo.es', '600 214 887', 'C/ Betis, 3', 'ES9121000418450200051332', 'No'],
  ['3', 'Cordero Rueda, Ana Isabel', '34567890W', '1985', '22/11/1962', 'ana.cordero@ejemplo.es', '677 903 112', 'Avda. de la Palmera, 22', '', 'No'],
  ['4', 'Delgado Nieto, Francisco Javier', '45678901A', '1990', '30/01/1970', 'fj.delgado@ejemplo.es', '622 445 019', 'C/ Feria, 90', 'ES6621000418401234567891', 'No'],
  ['5', 'Espinosa Gil, Rocío', '56789012G', '1992', '17/05/1974', 'rocio.espinosa@ejemplo.es', '699 320 774', 'C/ Sierpes, 8', '', 'No'],
  ['6', 'Fernández Ojeda, Manuel', '67890123M', '1994', '09/09/1968', 'manuel.fernandez@ejemplo.es', '611 887 002', 'C/ Castilla, 61', 'ES9121000418450200051332', 'Sí'],
  ['7', 'Gálvez Cruz, Inmaculada', '78901234Y', '1996', '25/12/1980', 'inma.galvez@ejemplo.es', '688 112 330', 'C/ San Jacinto, 15', '', 'No'],
  ['8', 'Herrera Pavón, Álvaro', '89012345F', '1998', '03/02/1983', 'alvaro.herrera@ejemplo.es', '644 550 918', 'C/ Pagés del Corro, 40', 'ES6621000418401234567891', 'No'],
  ['9', 'Ibáñez Muñoz, Nuria', '90123456P', '1999', '14/06/1985', 'nuria.ibanez@ejemplo.es', '633 201 456', 'C/ Alfarería, 12', '', 'No'],
  ['10', 'Jiménez Roldán, Sergio', '01234567L', '2001', '28/08/1979', 'sergio.jimenez@ejemplo.es', '655 774 003', 'C/ Evangelista, 18', 'ES9121000418450200051332', 'No'],
  ['11', 'Lozano Vega, Beatriz', '11223344D', '2003', '11/11/1988', 'bea.lozano@ejemplo.es', '600 998 221', 'C/ Rodrigo de Triana, 9', '', 'No'],
  ['12', 'Marín Ceballos, Juan Luis', '22334455K', '2004', '19/04/1990', 'jl.marin@ejemplo.es', '677 004 552', 'C/ Dos de Mayo, 7', 'ES6621000418401234567891', 'No'],
  ['13', 'Núñez Peña, Concepción', '33445566B', '2006', '07/07/1965', 'concha.nunez@ejemplo.es', '622 330 118', 'C/ Águilas, 6', '', 'Sí'],
  ['14', 'Ortega Salas, Rafael', '44556677N', '2008', '23/03/1992', 'rafa.ortega@ejemplo.es', '699 112 447', 'C/ Bailén, 14', 'ES9121000418450200051332', 'No'],
  ['15', 'Pardo Quintero, Lucía', '55667788J', '2010', '05/10/1994', 'lucia.pardo@ejemplo.es', '611 220 903', 'C/ Pureza, 55', '', 'No'],
  ['16', 'Quesada Rivas, Andrés', '66778899Z', '2011', '16/01/1986', 'andres.quesada@ejemplo.es', '688 445 220', 'C/ Feria, 12', 'ES6621000418401234567891', 'No'],
  ['17', 'Ramos Tirado, Encarnación', '77889900S', '2013', '02/06/1971', 'encarni.ramos@ejemplo.es', '644 009 331', 'C/ Betis, 40', '', 'No'],
  ['18', 'Serrano Ubeda, Ignacio', '88990011Q', '2014', '21/09/1996', 'nacho.serrano@ejemplo.es', '633 887 114', 'Avda. de la Palmera, 5', 'ES9121000418450200051332', 'No'],
  ['19', 'Toledano Vargas, Mercedes', '99001122V', '2016', '13/02/1999', 'merche.toledano@ejemplo.es', '655 330 220', 'C/ Sierpes, 31', '', 'No'],
  ['20', 'Utrera Zamora, Pablo', '10111213H', '2017', '26/07/2001', 'pablo.utrera@ejemplo.es', '600 447 998', 'C/ Castilla, 8', 'ES6621000418401234567891', 'No'],
  ['21', 'Vázquez Alcaide, Rosario', '21222324E', '2018', '08/12/2003', 'charo.vazquez@ejemplo.es', '677 220 115', 'C/ San Jacinto, 61', '', 'No'],
  ['22', 'Zurita Bravo, Emilio', '32333435T', '2019', '30/05/2005', 'emilio.zurita@ejemplo.es', '622 118 004', 'C/ Alfarería, 3', 'ES9121000418450200051332', 'No'],
  ['23', 'Ávila Cintado, Josefa', '43444546R', '2020', '17/03/2007', 'pepa.avila@ejemplo.es', '699 003 227', 'C/ Pagés del Corro, 18', '', 'No'],
  ['24', 'Barrera Durán, Alejandro', '54555657W', '2021', '24/10/2009', 'alex.barrera@ejemplo.es', '611 556 330', 'C/ Evangelista, 44', '', 'No'],
  ['25', 'Cabello Espejo, Marta', '65666768A', '2022', '19/06/2011', 'marta.cabello@ejemplo.es', '688 220 447', 'C/ Bailén, 2', '', 'No'],

  // --- A partir de aquí, los líos de un censo de verdad ---

  // Repetido: la misma persona, metida dos veces con el número cambiado. Es el
  // error más común al juntar dos listados, y el que hay que cazar antes de
  // importar: si no, la hermandad acaba con dos fichas de la misma persona y
  // cobrándole dos veces la cuota.
  ['26', 'Aguilar Ponce, Mª del Carmen', '12345678Z', '1978', '12/03/1955', 'mcarmen.aguilar@ejemplo.es', '655 100 201', 'C/ Pureza, 14', '', 'No'],
  // Sin DNI: no se puede dar de alta, porque el DNI es lo que evita duplicados.
  ['27', 'Gómez Sin Documento, Antonio', '', '2015', '01/01/1990', 'antonio.gomez@ejemplo.es', '600 000 111', 'C/ Sin Número, 1', '', 'No'],
  // Sin nombre: fila a medio rellenar, de las que quedan al final de una hoja.
  ['28', '', '76543210X', '2015', '', '', '', '', '', 'No'],
  // El IBAN copiado de la libreta, con espacios de cuatro en cuatro.
  ['29', 'Ledesma Ortiz, Fernando', '87654321B', '2023', '03/04/1976', 'fernando.ledesma@ejemplo.es', '655 001 998', 'C/ Feria, 77', 'ES91 2100 0418 4502 0005 1332', 'No'],
  // La fecha de alta escrita entera en vez de solo el año.
  ['30', 'Montero Ríos, Soledad', '98765432M', '15/09/2024', '11/11/1998', 'sole.montero@ejemplo.es', '677 445 003', 'C/ Betis, 15', '', 'No'],
]

/* ------------------------------- El .xlsx ------------------------------- */

const escapar = (t) => String(t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** «A», «B»… «AA». */
function letraColumna(i) {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  }
  return s
}

/**
 * La hoja, con TODO como texto (`t="inlineStr"`).
 *
 * A propósito: un número de hermano o un DNI que empiece por cero se convierte
 * en número y pierde el cero. Y un censo se lee, no se calcula.
 */
function hojaXml(filas) {
  const filasXml = filas.map((fila, f) => {
    const celdas = fila.map((v, c) =>
      v === '' ? '' : `<c r="${letraColumna(c)}${f + 1}" t="inlineStr"><is><t xml:space="preserve">${escapar(v)}</t></is></c>`,
    ).join('')
    return `<row r="${f + 1}">${celdas}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filasXml}</sheetData></worksheet>`
}

/**
 * LOS ARCHIVOS DE DENTRO DEL .XLSX, para un libro de una o de varias pestañas.
 *
 * `numeroDeFichero` NO sigue el orden de las pestañas a propósito. En un libro
 * de verdad tampoco: basta con borrar una hoja y crear otra para que la
 * tercera del libro sea `sheet7.xml`. Quien lea el libro tiene que pasar por
 * `workbook.xml` y por el `.rels`, y esto lo obliga a hacerlo — leer «la
 * primera es sheet1» acierta con los libros recién hechos y falla con los de
 * verdad, que es cuando no se puede probar.
 */
const ARCHIVOS = (hojas) => {
  const numeroDeFichero = (i) => (i * 2) + 1
  const parte = (i) => `worksheets/sheet${numeroDeFichero(i)}.xml`
  const salida = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hojas
      .map((_, i) => `<Override PartName="/xl/${parte(i)}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas
      .map((h, i) => `<sheet name="${escapar(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${parte(i)}"/>`)
      .join('')}</Relationships>`,
  }
  hojas.forEach((h, i) => { salida[`xl/${parte(i)}`] = hojaXml(h.filas) })
  return salida
}

/** 1 de enero de 2026, en el formato de fecha del ZIP (heredado del MS-DOS). */
const FECHA_DOS = ((46 << 9) | (1 << 5) | 1) << 16

/** CRC-32, que el ZIP exige por archivo. */
function crc32(buf) {
  let c, tabla = crc32.tabla
  if (!tabla) {
    tabla = crc32.tabla = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      tabla[n] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ tabla[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

/**
 * Monta el ZIP de un libro con varias pestañas.
 *
 *   construirLibro([{ nombre: 'Censo', filas }, { nombre: 'Cuotas', filas }])
 */
export function construirLibro(hojas) {
  return empaquetar(ARCHIVOS(hojas))
}

/**
 * El ZIP, que es lo único que un .xlsx tiene de formato binario.
 *
 * Está aparte porque lo usan los dos constructores: el de siempre —que mete
 * todo como texto en línea— y `construirComoExcel`, que escribe los archivos
 * como los escribe Excel. Lo que cambia entre los dos es el XML de dentro; el
 * envoltorio es el mismo.
 */
function empaquetar(archivos) {
  const trozos = []
  const central = []
  let desplazamiento = 0

  for (const [nombre, texto] of Object.entries(archivos)) {
    const datos = Buffer.from(texto, 'utf8')
    const comprimido = deflateRawSync(datos)
    const crc = crc32(datos)
    const nom = Buffer.from(nombre, 'utf8')

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)          // versión necesaria
    local.writeUInt16LE(0, 6)           // banderas
    local.writeUInt16LE(8, 8)           // método: deflate
    // Fecha fija (1 de enero de 2026) para que el archivo salga byte a byte
    // igual cada vez. Cero no vale: es «día 0 del mes 0» y algunos programas
    // lo enseñan como fecha inválida.
    local.writeUInt32LE(FECHA_DOS, 10)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(comprimido.length, 18)
    local.writeUInt32LE(datos.length, 22)
    local.writeUInt16LE(nom.length, 26)
    local.writeUInt16LE(0, 28)
    trozos.push(local, nom, comprimido)

    const cen = Buffer.alloc(46)
    cen.writeUInt32LE(0x02014b50, 0)
    cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6)
    cen.writeUInt16LE(0, 8); cen.writeUInt16LE(8, 10)
    cen.writeUInt32LE(FECHA_DOS, 12)
    cen.writeUInt32LE(crc, 16)
    cen.writeUInt32LE(comprimido.length, 20)
    cen.writeUInt32LE(datos.length, 24)
    cen.writeUInt16LE(nom.length, 28)
    cen.writeUInt32LE(desplazamiento, 42)
    central.push(cen, nom)

    desplazamiento += local.length + nom.length + comprimido.length
  }

  const indice = Buffer.concat(central)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(Object.keys(archivos).length, 8)
  fin.writeUInt16LE(Object.keys(archivos).length, 10)
  fin.writeUInt32LE(indice.length, 12)
  fin.writeUInt32LE(desplazamiento, 16)
  return Buffer.concat([...trozos, indice, fin])
}

/**
 * UN LIBRO ESCRITO COMO LO ESCRIBE EXCEL DE VERDAD.
 *
 * Los de arriba meten TODO como texto en línea (`inlineStr`), que va muy bien
 * para no perder un DNI que empieza por cero — pero es justo lo que Excel NO
 * hace nunca. Excel guarda:
 *
 *   · los textos en una lista aparte, y en la celda solo su número (`t="s"`);
 *   · los números tal cual, sin ninguna marca de tipo;
 *   · y las FECHAS como números, con un estilo de fecha puesto encima.
 *
 * Esa diferencia escondió un fallo durante mucho tiempo: el lector no abría
 * `styles.xml`, así que la fecha de alta de cada hermano llegaba al importador
 * como «36512». Con los libros de casa funcionaba; con los de la hermandad, no.
 *
 * Cada celda se declara con su tipo:
 *
 *     { texto: 'María José' }   un texto
 *     { numero: 30 }            un número
 *     { fecha: '1999-12-18' }   una fecha, como la guarda Excel
 */
export function construirComoExcel(hojas) {
  const compartidos = []
  const numeroDeTexto = (t) => {
    const i = compartidos.indexOf(t)
    return i >= 0 ? i : compartidos.push(t) - 1
  }

  /** Una fecha ISO, en el número de días de Excel (desde el 30-12-1899). */
  const serieDeExcel = (iso) => {
    const [a, m, d] = iso.split('-').map(Number)
    return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000)
  }

  const hojasXml = hojas.map((h) => {
    const filas = h.filas.map((fila, f) => {
      const celdas = fila.map((celda, c) => {
        const ref = `${letraColumna(c)}${f + 1}`
        if (celda === '' || celda === null || celda === undefined) return ''
        if (typeof celda === 'object' && celda.fecha !== undefined) {
          // `s="1"` es el estilo de fecha que se declara abajo en styles.xml.
          return `<c r="${ref}" s="1"><v>${serieDeExcel(celda.fecha)}</v></c>`
        }
        if (typeof celda === 'object' && celda.numero !== undefined) {
          return `<c r="${ref}"><v>${celda.numero}</v></c>`
        }
        const t = typeof celda === 'object' ? celda.texto : String(celda)
        return `<c r="${ref}" t="s"><v>${numeroDeTexto(t)}</v></c>`
      }).join('')
      return `<row r="${f + 1}">${celdas}</row>`
    }).join('')
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filas}</sheetData></worksheet>`
  })

  const archivos = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas.map((h, i) => `<sheet name="${escapar(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
    /*
     * `numFmtId="14"` es la fecha corta que pone Excel al teclear 18/12/1999.
     * Y va DETRÁS de un `cellStyleXfs` con la misma etiqueta `<xf>` a propósito:
     * el `s=` de las celdas apunta a `cellXfs` y no a esa otra lista, y contarlas
     * juntas desplaza los estilos — que es un fallo fácil de cometer al leer.
     */
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    'xl/sharedStrings.xml': '',
  }
  hojas.forEach((_, i) => { archivos[`xl/worksheets/sheet${i + 1}.xml`] = hojasXml[i] })
  // Al final, que hasta aquí no se sabe qué textos han salido.
  archivos['xl/sharedStrings.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${compartidos.length}" uniqueCount="${compartidos.length}">${compartidos.map((t) => `<si><t xml:space="preserve">${escapar(t)}</t></si>`).join('')}</sst>`
  return empaquetar(archivos)
}

/** Un libro de una sola pestaña, que es el caso de siempre. */
export function construirXlsx(filas, nombre = 'Censo') {
  return construirLibro([{ nombre, filas }])
}

/** El mismo censo en CSV, por si prefieren ese camino. Punto y coma, que es lo que suelta Excel en España. */
export function construirCsv(filas) {
  const linea = (f) => f.map((v) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(';')
  // Con BOM: sin él, Excel abre el archivo y enseña «MarÃ­a» en vez de «María».
  return '﻿' + [linea(CABECERAS), ...filas.map(linea)].join('\r\n') + '\r\n'
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const carpeta = process.argv[2] ?? '.'
  mkdirSync(carpeta, { recursive: true })
  const filas = [CABECERAS, ...FILAS]
  writeFileSync(join(carpeta, 'censo-de-prueba.xlsx'), construirXlsx(filas))
  writeFileSync(join(carpeta, 'censo-de-prueba.csv'), construirCsv(FILAS), 'utf8')
  console.log(`Escritos en ${carpeta}: censo-de-prueba.xlsx y censo-de-prueba.csv (${FILAS.length} hermanos)`)
}
