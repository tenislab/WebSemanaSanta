/**
 * EL .XLSX QUE ESCRIBIMOS, ¿LO ABRE ALGUIEN?
 *
 * Un Excel mal escrito no falla a medias. No se pierde una columna ni sale una
 * celda rara: Excel dice «el archivo está dañado» y no abre NADA. Por un byte.
 * Y quien se lo encuentra es el hermano mayor la mañana del cabildo, con la
 * memoria del ejercicio dentro y sin manera de sacarla.
 *
 * Por eso esto no se prueba «a ojo abriendo el archivo». Se prueba de dos
 * maneras, y las dos hacen falta:
 *
 *   · IDA Y VUELTA. Lo que escribe `escribirExcel.ts` se lee con
 *     `leerExcel.ts`, que ya estaba y se escribió por separado, para importar
 *     los censos que traen las hermandades de su programa viejo. Son dos
 *     códigos distintos, escritos en momentos distintos y para cosas opuestas:
 *     si el escritor se inventa el formato, el lector no lo entiende.
 *
 *   · EL CRC DE CADA ENTRADA, contra el de Node. El ZIP obliga a poner una
 *     suma de comprobación por cada archivo de dentro; si no cuadra, el libro
 *     se abre «dañado». Aquí se compara la que escribimos con la que calcula
 *     `zlib.crc32`, que no es nuestra. Un CRC mal calculado pasa la ida y
 *     vuelta —nuestro lector no lo mira— y luego Excel lo rechaza.
 */
import { crc32 as crc32DeNode } from 'node:zlib'

/**
 * Recorre el índice del ZIP y devuelve cada entrada con el CRC que lleva
 * escrito y sus bytes. Se lee desde el final, que es como lo lee un programa
 * de verdad, y no hacia delante como se escribió.
 */
function entradasDelZip(datos) {
  const v = new DataView(datos.buffer, datos.byteOffset, datos.byteLength)
  let fin = -1
  for (let i = datos.length - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x06054b50) { fin = i; break }
  if (fin < 0) throw new Error('no hay final de ZIP')
  const cuantas = v.getUint16(fin + 10, true)
  let p = v.getUint32(fin + 16, true)
  const salida = []
  for (let i = 0; i < cuantas; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('índice del ZIP roto')
    const crc = v.getUint32(p + 16, true)
    const comprimido = v.getUint32(p + 20, true)
    const largoNombre = v.getUint16(p + 28, true)
    const extra = v.getUint16(p + 30, true)
    const comentario = v.getUint16(p + 32, true)
    const desplazamiento = v.getUint32(p + 42, true)
    const nombre = new TextDecoder().decode(datos.subarray(p + 46, p + 46 + largoNombre))
    p += 46 + largoNombre + extra + comentario
    const desde = desplazamiento + 30
      + v.getUint16(desplazamiento + 26, true) + v.getUint16(desplazamiento + 28, true)
    salida.push({ nombre, crc, datos: datos.subarray(desde, desde + comprimido) })
  }
  return salida
}

export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/escribirExcel.ts')
  const leer = await cargar('src/lib/leerExcel.ts')

  /* ------------------------------------------------------------------
     El nombre de la pestaña

     Sale de un título escrito por una persona («Cuotas 2025/26»), y esa
     barra basta para que el libro entero se abra dañado.
     ------------------------------------------------------------------ */
  caso('nombre normal, tal cual', 'Censo', m.nombreDeHoja('Censo'))
  caso('la barra fuera', 'Cuotas 2025 26', m.nombreDeHoja('Cuotas 2025/26'))
  caso('corchetes y dos puntos fuera', 'Caja x del 1 al 31', m.nombreDeHoja('Caja [x]: del 1 al 31'))
  caso('sin espacios de sobra al juntar', 'Cuotas 25 26', m.nombreDeHoja('Cuotas 25 / 26'))
  caso('ni apóstrofo al principio o al final', 'Ntra Sra', m.nombreDeHoja("'Ntra Sra'"))
  caso('el recorte no deja un espacio colgando', 'z'.repeat(31), m.nombreDeHoja('z'.repeat(31) + '   y'))
  caso('máximo 31 caracteres', 31, m.nombreDeHoja('x'.repeat(60)).length)
  caso('vacío no deja la pestaña sin nombre', 'Hoja', m.nombreDeHoja('   '))
  caso('repetido se numera', 'Censo 2', m.nombreDeHoja('Censo', ['Censo']))
  caso('repetido dos veces', 'Censo 3', m.nombreDeHoja('Censo', ['Censo', 'Censo 2']))
  caso(
    'el sufijo cabe dentro de los 31',
    true,
    m.nombreDeHoja('y'.repeat(31), ['y'.repeat(31)]).length <= 31,
  )

  /* --- La referencia de la celda, que es lo que numera las columnas --- */
  caso('primera celda', 'A1', m.celda(0, 1))
  caso('la 26 es la Z', 'Z1', m.celda(25, 1))
  caso('la 27 es AA, no BA', 'AA1', m.celda(26, 1))
  caso('la 28', 'AB7', m.celda(27, 7))

  /* ------------------------------------------------------------------
     IDA Y VUELTA con el lector que ya existía
     ------------------------------------------------------------------ */
  const CENSO = {
    nombre: 'Censo',
    columnas: ['Nº', 'Nombre', 'Cuota'],
    filas: [
      [1, 'Ruiz & Cía <hermanos>', 3600],
      [2, 'María "la del Rocío"', 0],
    ],
  }
  const CAJA = { nombre: 'Caja', columnas: ['Concepto', 'Importe'], filas: [['Cera', -12050]] }
  const bytes = m.libroExcel([CENSO, CAJA])

  caso('empieza por PK, como todo ZIP', true, bytes[0] === 0x50 && bytes[1] === 0x4b)
  caso('nuestro propio lector lo reconoce', true, leer.pareceXlsx(bytes))

  const libro = await leer.leerLibro(bytes)
  caso('vuelven las dos pestañas', ['Censo', 'Caja'], libro.map((h) => h.nombre))
  caso('la cabecera está', ['Nº', 'Nombre', 'Cuota'], libro[0].filas[0])
  caso(
    'el ampersand y los signos vuelven enteros',
    ['1', 'Ruiz & Cía <hermanos>', '3600'],
    libro[0].filas[1],
  )
  caso('y las comillas dobles también', 'María "la del Rocío"', libro[0].filas[2][1])
  caso('los negativos no se pierden', ['Cera', '-12050'], libro[1].filas[1])

  /* ------------------------------------------------------------------
     LOS NÚMEROS, COMO NÚMEROS

     Es toda la diferencia entre un Excel que suma la columna de importes y
     uno que no. La ida y vuelta no lo distingue —el lector devuelve texto en
     los dos casos—, así que hay que mirar el XML por dentro.
     ------------------------------------------------------------------ */
  const dentro = Object.fromEntries(
    entradasDelZip(bytes).map((e) => [e.nombre, new TextDecoder().decode(e.datos)]),
  )
  const hoja1 = dentro['xl/worksheets/sheet1.xml']
  caso('el importe va como número', true, hoja1.includes('<c r="C2"><v>3600</v></c>'))
  caso('el cero también, y no como celda vacía', true, hoja1.includes('<c r="C3"><v>0</v></c>'))
  caso('el nombre va como texto', true, hoja1.includes('<c r="B2" t="inlineStr">'))
  caso('la cabecera nunca va como número', true, hoja1.includes('<c r="A1" s="2" t="inlineStr">'))

  /* --- Las piezas que Excel exige. Sin una sola, «archivo dañado». --- */
  caso('están las piezas del libro y sus dos hojas', [
    '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
    'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
  ], entradasDelZip(bytes).map((e) => e.nombre))
  // `styles.xml` no basta con que exista: si no está declarado en los dos
  // sitios, Excel lo ignora o se queja del libro entero.
  caso(
    'y styles.xml está declarado en el índice de tipos',
    true,
    dentro['[Content_Types].xml'].includes('/xl/styles.xml'),
  )
  caso(
    'y colgado del libro como relación',
    true,
    dentro['xl/_rels/workbook.xml.rels'].includes('Target="styles.xml"'),
  )

  /* ------------------------------------------------------------------
     UN IMPORTE ES UN NÚMERO CON FORMATO, no un texto.

     Que se pueda sumar la columna y que se lea «3.600,50 €» son las dos
     mitades de lo mismo. Con el importe en texto no hay total; con el
     número pelado, unas cuentas que ponen «3600,5».
     ------------------------------------------------------------------ */
  const conDinero = m.libroExcel([{
    nombre: 'Cuotas',
    columnas: ['Hermano', 'Importe'],
    filas: [['Ana Sánchez', { euros: 3600.5 }], ['Juan Cabrera', { euros: -12.05 }]],
  }])
  const hojaDinero = new TextDecoder().decode(
    entradasDelZip(conDinero).find((e) => e.nombre === 'xl/worksheets/sheet1.xml').datos,
  )
  caso('el importe va como número con formato', true, hojaDinero.includes('<c r="B2" s="1"><v>3600.5</v></c>'))
  caso('y el negativo con su signo', true, hojaDinero.includes('<c r="B3" s="1"><v>-12.05</v></c>'))
  caso(
    'el formato de euros está definido',
    true,
    new TextDecoder().decode(entradasDelZip(conDinero).find((e) => e.nombre === 'xl/styles.xml').datos)
      .includes('numFmtId="164"'),
  )
  const leidoDinero = await leer.leerLibro(conDinero)
  caso('y el libro con importes se sigue abriendo', ['3600.5', '-12.05'],
    leidoDinero[0].filas.slice(1).map((f) => f[1]))

  /* ------------------------------------------------------------------
     EL CRC, contra el de Node
     ------------------------------------------------------------------ */
  caso(
    'cada entrada lleva su CRC bien calculado',
    [],
    entradasDelZip(bytes)
      .filter((e) => e.crc !== crc32DeNode(Buffer.from(e.datos)))
      .map((e) => e.nombre),
  )

  /* ------------------------------------------------------------------
     EL BYTE DE CONTROL de un censo importado de un Access viejo (aquí se
     mete a propósito, con su código, para que se vea cuál es). XML 1.0 no
     lo admite: con uno solo, el libro entero se abre dañado.
     ------------------------------------------------------------------ */
  const VT = String.fromCharCode(11)
  const sucio = m.libroExcel([{
    nombre: 'Censo',
    columnas: ['Domicilio'],
    filas: [[`Calle Feria 3${VT}, 2º`]],
  }])
  const leido = await leer.leerLibro(sucio)
  caso('el archivo con bytes de control sigue abriéndose', 1, leido.length)
  caso('y el dato llega entero, solo sin el byte', 'Calle Feria 3, 2º', leido[0].filas[1][0])

  /* --- Un libro sin hojas no lo abre Excel: se pone una vacía. --- */
  caso('un libro sin datos también se abre', 1, (await leer.leerLibro(m.libroExcel([]))).length)

  /* --- Dos pestañas con el mismo nombre rompen el archivo. --- */
  const repes = m.libroExcel([
    { nombre: 'Cuotas', columnas: ['a'], filas: [['x']] },
    { nombre: 'Cuotas', columnas: ['b'], filas: [['y']] },
  ])
  caso(
    'dos pestañas iguales se distinguen',
    ['Cuotas', 'Cuotas 2'],
    (await leer.leerLibro(repes)).map((h) => h.nombre),
  )

  /* --- Mismo dato, mismos bytes: si no, esto no se puede comprobar. --- */
  caso(
    'generado dos veces sale igual',
    true,
    Buffer.from(bytes).equals(Buffer.from(m.libroExcel([CENSO, CAJA]))),
  )
}
