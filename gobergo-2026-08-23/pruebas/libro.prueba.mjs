/**
 * UN LIBRO DE EXCEL CON VARIAS PESTAÑAS.
 *
 * Una hermandad no exporta cuatro ficheros: saca UN libro de su programa
 * viejo, con el censo en una pestaña, los recibos en otra y la caja en la
 * tercera, y lo sube cuatro veces, una por pantalla.
 *
 * El lector se quedaba siempre con `xl/worksheets/sheet1.xml`, así que al
 * importar cuotas desde un libro así decía «faltan columnas obligatorias»
 * mientras miraba el censo. El archivo era el bueno y no había forma de
 * saberlo: el mensaje hablaba de columnas y el problema era la pestaña.
 *
 * Dos cosas se prueban aquí, y las dos fallaban:
 *
 *   1. Que se lean TODAS las hojas, con su nombre y en su orden. Y que el
 *      nombre salga de `workbook.xml` + el `.rels`, no del número del fichero:
 *      basta con borrar una pestaña y crear otra para que la tercera del libro
 *      sea `sheet7.xml`. Ir por el número es leer la hoja equivocada, y de las
 *      que se parecen —dos ejercicios de cuotas— sin que nada lo delate.
 *   2. Que se coja la pestaña correcta según lo que se está importando.
 */
export default async function ({ cargar, caso }) {
  const excel = await cargar('src/lib/leerExcel.ts')
  const motor = await cargar('src/lib/importarTabla.ts')
  const censo = await cargar('src/lib/importar.ts')
  const tablas = await cargar('src/lib/tablasImportables.ts')
  const { construirLibro } = await import('../scripts/censo-de-prueba.mjs')

  const HOJAS = [
    // Primero una hoja sin nada que importar, que es lo que suelen dejar
    // delante los programas viejos.
    { nombre: 'Portada', filas: [['Hermandad de prueba']] },
    {
      nombre: 'Bienes',
      filas: [
        ['Pieza', 'Tipo', 'Ubicación', 'Valor asegurado'],
        ['Candelabro de cola', 'Orfebrería', 'Capilla', '1.200,00 €'],
      ],
    },
    {
      nombre: 'Socios',
      filas: [
        ['Nº Hermano', 'Apellidos y nombre', 'D.N.I.', 'Correo'],
        ['1', 'Aguilar Ponce, María', '12345678Z', 'maria@ejemplo.es'],
        ['2', 'Bermúdez Cano, José', '23456789J', 'jose@ejemplo.es'],
      ],
    },
    {
      nombre: 'Recibos 2026',
      filas: [
        ['D.N.I.', 'Apellidos y nombre', 'Ejercicio', 'Concepto', 'Importe', 'Estado'],
        ['12345678Z', 'Aguilar Ponce, María', '2026', 'Cuota anual', '60,00 €', 'Pagada'],
      ],
    },
  ]

  const bytes = new Uint8Array(construirLibro(HOJAS))
  const libro = await excel.leerLibro(bytes)

  caso('se leen todas las pestañas', 4, libro.length)
  caso('con su nombre de verdad', ['Portada', 'Bienes', 'Socios', 'Recibos 2026'], libro.map((h) => h.nombre))
  caso('y en el orden del libro', 'Socios', libro[2].nombre)
  caso('con sus filas', 3, libro[2].filas.length)
  caso('la cabecera es la primera fila', 'Nº Hermano', libro[2].filas[0][0])
  caso('y los acentos llegan bien', 'Aguilar Ponce, María', libro[2].filas[1][1])

  /*
   * --- LA PESTAÑA SE ELIGE POR LAS COLUMNAS ---
   * Ninguna de las tres es la primera hoja del libro, que es justo el fallo.
   */
  caso('el censo va a «Socios»', 'Socios', libro[censo.hojaDelCenso(libro)].nombre)
  caso('las cuotas van a «Recibos 2026»', 'Recibos 2026',
    libro[motor.hojaQueCuadra(libro, tablas.TABLA_CUOTAS.campos)].nombre)
  caso('el inventario va a «Bienes»', 'Bienes',
    libro[motor.hojaQueCuadra(libro, tablas.TABLA_ENSERES.campos)].nombre)

  /*
   * --- UNA PESTAÑA SOLO CON LA CABECERA NO SE ELIGE ---
   * Sus columnas cuadran perfectamente, así que ganaría por puntos; y no hay
   * nada que importar en ella. Elegirla es enseñar «0 filas» sobre un archivo
   * que sí trae datos.
   */
  const conVacia = [
    { nombre: 'Recibos vacíos', filas: [['D.N.I.', 'Apellidos y nombre', 'Ejercicio', 'Concepto', 'Importe', 'Estado']] },
    HOJAS[3],
  ]
  const libro2 = await excel.leerLibro(new Uint8Array(construirLibro(conVacia)))
  caso('una hoja con solo la cabecera no se elige', 'Recibos 2026',
    libro2[motor.hojaQueCuadra(libro2, tablas.TABLA_CUOTAS.campos)].nombre)

  // Un libro de una sola hoja sigue funcionando igual que siempre.
  const unaSola = await excel.leerLibro(new Uint8Array(construirLibro([HOJAS[2]])))
  caso('un libro de una hoja se lee igual', 1, unaSola.length)
  // `leerXlsx` sigue siendo «la primera hoja» y nada más: aquí la primera es
  // «Portada», así que eso es lo que tiene que devolver.
  caso('y `leerXlsx` sigue dando la primera', 'Hermandad de prueba',
    (await excel.leerXlsx(new Uint8Array(construirLibro(HOJAS))))[0][0])
  caso('que es la de una sola hoja', 'Nº Hermano',
    (await excel.leerXlsx(new Uint8Array(construirLibro([HOJAS[2]]))))[0][0])

  await elLibroGrande({ cargar, caso, excel, motor, censo, tablas })
  await lasFechasDeUnExcelDeVerdad({ cargar, caso })
}

/**
 * Y EL LIBRO GRANDE, el de llevar la aplicación al límite.
 *
 * Está en el repositorio porque es lo que se le manda a una hermandad para que
 * ensaye el traspaso antes de subir lo suyo, y porque una prueba sobre cuatro
 * filas escritas a mano no dice nada del día que entran cinco mil.
 *
 * Se genera con `node scripts/libro-al-limite.mjs docs/libro-al-limite` y sale
 * idéntico cada vez —no hay azar dentro—, así que los números se pueden
 * escribir aquí y fallan si algo cambia sin querer.
 */
async function elLibroGrande({ caso, excel, motor, censo, tablas }) {
  const { readFile } = await import('node:fs/promises')
  let bytes
  try {
    bytes = new Uint8Array(await readFile('docs/libro-al-limite/hermandad-al-limite.xlsx'))
  } catch {
    caso('el libro grande está en el repositorio', true, false)
    return
  }

  const libro = await excel.leerLibro(bytes)
  caso('el libro grande trae seis pestañas', 6, libro.length)
  caso('y en el orden en que las escribe un programa viejo',
    ['Portada', 'Bienes', 'Socios', 'Recibos 2026', 'Recibos 2025', 'Libro de caja'],
    libro.map((h) => h.nombre))

  // El censo NO es la primera hoja: es la tercera. Ahí está la gracia.
  caso('el censo no es la primera hoja', true, censo.hojaDelCenso(libro) !== 0)
  caso('el censo va a «Socios»', 'Socios', libro[censo.hojaDelCenso(libro)].nombre)
  caso('el inventario va a «Bienes»', 'Bienes',
    libro[motor.hojaQueCuadra(libro, tablas.TABLA_ENSERES.campos)].nombre)
  caso('la caja va a «Libro de caja»', 'Libro de caja',
    libro[motor.hojaQueCuadra(libro, tablas.TABLA_MOVIMIENTOS.campos)].nombre)

  /*
   * Las dos pestañas de recibos tienen LAS MISMAS columnas, así que elegir por
   * columnas ya no puede acertar: empata. Se queda con la primera de las dos,
   * y por eso el asistente tiene que dejar cambiar de pestaña a mano — es el
   * único caso en el que solo lo sabe quien hizo el archivo.
   */
  const cualCuotas = libro[motor.hojaQueCuadra(libro, tablas.TABLA_CUOTAS.campos)].nombre
  caso('con dos ejercicios iguales se queda con el primero', 'Recibos 2026', cualCuotas)

  /*
   * --- Y LOS CUATRO SUELTOS, QUE TIENEN QUE LEERSE CON EL LECTOR DE ANTES ---
   *
   * Esto llegó como una captura: el libro de pestañas subido a una versión que
   * todavía no sabía elegir hoja, y el cajón entero diciendo «no está en el
   * archivo» en cada columna. La primera hoja era la portada, sin cabeceras, y
   * el asistente no tenía nada que emparejar.
   *
   * Mientras haya una versión desplegada por ahí que lea solo la primera hoja,
   * tiene que existir un archivo que esa versión entienda. Se comprueba con
   * `leerXlsx` a propósito —que es «la primera hoja» y nada más—, no con
   * `leerLibro`: probarlo con el lector nuevo no demostraría nada.
   */
  for (const [fichero, primera] of [
    ['censo-al-limite.xlsx', 'Nº Hermano'],
    ['cuotas-al-limite.xlsx', 'D.N.I.'],
    ['caja-al-limite.xlsx', 'Fecha'],
    ['inventario-al-limite.xlsx', 'Pieza'],
  ]) {
    let sueltas = null
    try {
      sueltas = await excel.leerXlsx(new Uint8Array(await readFile(`docs/libro-al-limite/${fichero}`)))
    } catch { /* no está: lo dice el caso de abajo */ }
    caso(`${fichero} lo lee el lector de antes`, primera, sueltas?.[0]?.[0] ?? '(no está)')
    caso(`${fichero} trae sus filas`, true, (sueltas?.length ?? 0) > 400)
  }

  // El tamaño, que es de lo que va este libro.
  const filas = Object.fromEntries(libro.map((h) => [h.nombre, h.filas.length - 1]))
  caso('mil doscientos y pico hermanos', 1217, filas['Socios'])
  caso('mil quinientos apuntes de caja', 1500, filas['Libro de caja'])
  caso('cuatrocientas piezas', 400, filas['Bienes'])
  caso('y más de cinco mil filas en total', true,
    Object.values(filas).reduce((a, b) => a + b, 0) > 5000)

}

/**
 * LAS FECHAS DE UN EXCEL DE VERDAD, que no son fechas: son números.
 *
 * ESTE ES EL FALLO QUE ESCONDÍAN LOS LIBROS DE PRUEBA. Los que genera este
 * repositorio meten TODO como texto en línea, que va muy bien para no perder un
 * DNI que empieza por cero, pero es justo lo que Excel NO hace nunca. Al
 * teclear «18/12/1999» en una casilla, Excel guarda esto:
 *
 *     <c r="B2" s="1"><v>36512</v></c>
 *
 * Un número —los días desde el 30 de diciembre de 1899— y un `s="1"` que apunta
 * a `xl/styles.xml`, que es donde pone que eso se enseña como fecha. La celda no
 * lleva NINGUNA marca de tipo.
 *
 * El lector no abría `styles.xml`. Así que la fecha de alta de cada hermano
 * llegaba al importador como «36512», y ninguna de las formas que entiende
 * `fechaIso` se le parece: el censo entraba sin fecha de alta, sin fecha de
 * nacimiento y sin fecha de bautismo — y con ellas se van la antigüedad y la
 * segmentación por edad, que es media aplicación. Y en Tesorería, donde CADA
 * movimiento lleva fecha, no entraba ninguno bien.
 *
 * Lo peor es cómo se veía: el importador funcionaba con los archivos de casa y
 * fallaba con los de la hermandad. Por eso esta prueba construye el libro como
 * lo construye Excel y no como lo construye el repositorio.
 */
async function lasFechasDeUnExcelDeVerdad({ cargar, caso }) {
  const excel = await cargar('src/lib/leerExcel.ts')
  const tabla = await cargar('src/lib/leerTabla.ts')
  const { construirComoExcel } = await import('../scripts/censo-de-prueba.mjs')

  const libro = await excel.leerLibro(new Uint8Array(construirComoExcel([{
    nombre: 'Censo',
    filas: [
      ['Nombre', 'Fecha de alta', 'Cuota'],
      [{ texto: 'María José Pérez' }, { fecha: '1999-12-18' }, { numero: 30 }],
      // Un 29 de febrero de verdad, que es donde se rompen las cuentas de días.
      [{ texto: 'Ana Ruiz & Cía' }, { fecha: '2024-02-29' }, { numero: 12.5 }],
    ],
  }])))
  const filas = libro[0].filas

  caso('la fecha sale como fecha, no como número', '1999-12-18', filas[1][1])
  caso('y el 29 de febrero también', '2024-02-29', filas[2][1])
  // Lo que importa de verdad: que el importador la entienda.
  caso('y el importador la entiende', '1999-12-18', tabla.fechaIso(filas[1][1]))

  /*
   * Y LO QUE NO SE PUEDE ESTROPEAR ARREGLANDO ESTO: los números normales tienen
   * que seguir siendo números. Si el lector tomara por fecha cualquier celda
   * numérica, la cuota de 30 € se convertiría en el 29 de enero de 1900 — y eso
   * es peor que el fallo de partida, porque no se nota hasta sumar.
   */
  caso('un número sigue siendo un número', '30', filas[1][2])
  caso('y con decimales también', '12.5', filas[2][2])
  caso('los textos, intactos', 'María José Pérez', filas[1][0])
  caso('con el «&» desescapado', 'Ana Ruiz & Cía', filas[2][0])

  await lasCuentasDeExcel({ excel, caso })
}

/** Las cuentas de días de Excel, que tienen dos trampas conocidas. */
async function lasCuentasDeExcel({ excel, caso }) {
  /*
   * LA TRAMPA DEL 1900. Excel se cree, desde Lotus 1-2-3, que 1900 fue
   * bisiesto. Como el 29 de febrero de 1900 no existió, todo lo posterior al 1
   * de marzo viene corrido un día — y se endereza contando desde el 30 de
   * diciembre de 1899 en vez del 31.
   */
  caso('el día 1 es el 1 de enero de 1900', '1900-01-01', excel.fechaDeExcel(1))
  caso('el 59 es el 28 de febrero', '1900-02-28', excel.fechaDeExcel(59))
  caso('y el 61 el 1 de marzo', '1900-03-01', excel.fechaDeExcel(61))
  caso('una fecha de hoy en día cuadra', '2026-08-23', excel.fechaDeExcel(46257))

  /*
   * LA OTRA TRAMPA: los libros que vienen de un Excel antiguo de Mac cuentan
   * desde 1904. Sin mirarlo, todas sus fechas salen cuatro años y un día antes.
   */
  caso('un libro de 1904 se corrige', '1999-12-18', excel.fechaDeExcel(36512 - 1462, true))

  // Y lo que no es una fecha no se inventa.
  caso('un número imposible no da fecha', null, excel.fechaDeExcel(99999999))
  caso('ni un negativo', null, excel.fechaDeExcel(-1))
  caso('ni algo que no es número', null, excel.fechaDeExcel(Number('hola')))

  /*
   * --- QUÉ ESTILOS SON DE FECHA ---
   *
   * El `s=` de una celda apunta a `cellXfs` POR POSICIÓN. Y justo encima hay
   * otra lista, `cellStyleXfs`, con la misma etiqueta `<xf>` dentro: contarlas
   * juntas desplaza todos los estilos y convierte en fecha la columna de al
   * lado. Es el fallo fácil de cometer aquí.
   */
  const styles = `<styleSheet><cellStyleXfs count="2"><xf numFmtId="14"/><xf numFmtId="0"/></cellStyleXfs>`
    + `<cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="4"/><xf numFmtId="165"/></cellXfs>`
    + `<numFmts><numFmt numFmtId="165" formatCode="dd&quot; de &quot;mmmm&quot; de &quot;yyyy"/></numFmts></styleSheet>`
  const deFecha = excel.estilosDeFecha(styles)
  caso('el estilo 0 (general) no es fecha', false, deFecha.has(0))
  caso('el 1 (fecha corta) sí', true, deFecha.has(1))
  caso('el 2 (dos decimales) no', false, deFecha.has(2))
  caso('y el 3, que es un formato propio de fecha, sí', true, deFecha.has(3))
  caso('no se cuentan los de cellStyleXfs', 2, deFecha.size)

  /*
   * Y UN FORMATO DE DINERO EN ROJO NO ES UNA FECHA. `[Red]#,##0.00` lleva una
   * «d» dentro de los corchetes del color; sin quitarlos, todos los importes de
   * la hermandad se convertirían en fechas de 1901.
   */
  caso('un formato de dinero en rojo no es fecha', false, excel.pareceFormatoDeFecha('[Red]#,##0.00'))
  caso('ni uno con el idioma delante', false, excel.pareceFormatoDeFecha('[$-es-ES]#,##0.00" €"'))
  caso('ni el texto de un formato de texto', false, excel.pareceFormatoDeFecha('"día "General'))
  caso('una fecha con mes en letra sí', true, excel.pareceFormatoDeFecha('dd" de "mmmm" de "yyyy'))
  caso('y la corta de siempre también', true, excel.pareceFormatoDeFecha('dd/mm/yyyy'))
}
