/**
 * LEER UN .XLSX DE VERDAD.
 *
 * Lo que había: la hermandad subía su censo en Excel y la aplicación
 * contestaba «ábrelo en Excel y guárdalo como CSV (delimitado por punto y
 * coma)». O sea, el primer paso de la puesta en marcha era mandarles a hacer a
 * mano una conversión que el programa puede hacer solo — y con tres opciones
 * de CSV en el desplegable de Excel, dos de las cuales rompen los acentos.
 *
 * Estas pruebas van contra un .xlsx GENERADO AQUÍ (`scripts/censo-de-prueba.mjs`,
 * que es el mismo que se le entrega a la hermandad para probar), no contra un
 * archivo fijo que podría haberse quedado viejo.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/leerExcel.ts')
  const { construirXlsx, construirCsv, CABECERAS, FILAS } = await import('../scripts/censo-de-prueba.mjs')

  // --- Las referencias de celda ---
  caso('la columna A es la 0', 0, m.columnaDeReferencia('A1'))
  caso('la B es la 1', 1, m.columnaDeReferencia('B7'))
  caso('la Z es la 25', 25, m.columnaDeReferencia('Z100'))
  // Una hoja con más de 26 columnas pasa a dos letras. Un censo con campos
  // propios las tiene.
  caso('la AA es la 26', 26, m.columnaDeReferencia('AA1'))
  caso('la BC es la 54', 54, m.columnaDeReferencia('BC12'))

  // --- Reconocer el archivo ---
  const xlsx = new Uint8Array(construirXlsx([CABECERAS, ...FILAS]))
  caso('un .xlsx se reconoce', true, m.pareceXlsx(xlsx))
  caso('un CSV no', false, m.pareceXlsx(new TextEncoder().encode('nombre;dni\nAna;123')))

  // --- Leerlo ---
  const filas = await m.leerXlsx(xlsx)
  caso('salen todas las filas', FILAS.length + 1, filas.length)
  caso('la primera es la cabecera', CABECERAS, filas[0])
  caso('y la segunda, el primer hermano', FILAS[0], filas[1])
  /*
   * Los acentos y las eñes son la mitad del motivo de existir de esto: es lo
   * que se rompe al guardar como CSV con la opción equivocada, y sale
   * «MarÃ­a» en la ficha de una hermana.
   */
  caso('los acentos llegan enteros', 'Aguilar Ponce, María del Carmen', filas[1][1])
  caso('las eñes también', true, filas.some((f) => f[1] === 'Ibáñez Muñoz, Nuria'))
  caso('y la ñ de la cabecera', 'Nº Hermano', filas[0][0])

  /*
   * LO QUE MÁS DUELE SI SE HACE MAL: Excel se salta las celdas vacías. Una
   * fila con la primera y la cuarta columna trae DOS celdas, no cuatro. Leerlas
   * en orden correría los datos a la izquierda y los teléfonos acabarían en la
   * casilla del DNI — y nadie lo notaría hasta llamar a alguien.
   */
  const conHuecos = new Uint8Array(construirXlsx([
    ['A', 'B', 'C', 'D'],
    ['uno', '', '', 'cuatro'],
  ]))
  const leidas = await m.leerXlsx(conHuecos)
  caso('las celdas vacías no corren las columnas', 'cuatro', leidas[1][3])
  caso('y el hueco queda vacío, no borrado', '', leidas[1][1])
  caso('la fila mantiene su ancho', 4, leidas[1].length)

  // Filas del todo vacías al final: Excel las guarda si alguien pinchó ahí, y
  // llegarían al importador como «falta el nombre» una por una.
  const conColas = new Uint8Array(construirXlsx([['A'], ['dato'], [''], ['']]))
  caso('las filas vacías del final se caen', 2, (await m.leerXlsx(conColas)).length)

  // --- Cuando no se puede ---
  let motivo = ''
  try {
    await m.leerXlsx(new TextEncoder().encode('esto no es un zip ni de lejos'))
  } catch (e) {
    motivo = e.message
  }
  // El .xls de Excel 97 NO es un ZIP. Hay que decirlo con esas palabras, que
  // es un paso mucho más fácil de dar que el del CSV.
  caso('un archivo que no es Excel se dice claro', true, /\.xls de los antiguos/.test(motivo))
  caso('y se dice qué hacer', true, /Guardar como/.test(motivo))

  // --- El censo de prueba que se le entrega a la hermandad ---
  caso('trae treinta hermanos', 30, FILAS.length)
  caso('con un DNI repetido a propósito', 2, FILAS.filter((f) => f[2] === '12345678Z').length)
  caso('una fila sin DNI', 1, FILAS.filter((f) => !f[2]).length)
  caso('una fila sin nombre', 1, FILAS.filter((f) => !f[1]).length)
  caso('dos de baja', 2, FILAS.filter((f) => f[9] === 'Sí').length)
  caso('y un IBAN con espacios, como se copia de la libreta', true,
    FILAS.some((f) => /^ES\d\d /.test(f[8])))

  // El CSV gemelo, para quien prefiera ese camino.
  const csv = construirCsv(FILAS)
  caso('el CSV lleva BOM', true, csv.charCodeAt(0) === 0xfeff)
  caso('y punto y coma, que es lo que suelta Excel en España', true, csv.includes(';'))

  await elImportadorLoUsa({ cargar, caso, xlsx })
}

/** Y que el importador lo use de verdad, no solo que exista el lector. */
async function elImportadorLoUsa({ cargar, caso, xlsx }) {
  const { readFile } = await import('node:fs/promises')
  const comp = (await readFile('src/components/ImportarCenso.tsx', 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  caso('el importador lee el Excel', true, /leerXlsx\(/.test(comp))
  caso('lo reconoce por el contenido', true, /pareceXlsx\(/.test(comp))
  /*
   * SIN filtro de tipos en el selector.
   *
   * Con `accept` puesto, el cuadro de «abrir archivo» del sistema GRISEA todo
   * lo demás: se ve el archivo, se pincha y no pasa nada, sin ningún mensaje.
   * Llegó reportado como «no me deja seleccionar el archivo», y en el peor
   * momento: el primer paso de la puesta en marcha. Basta con que el ordenador
   * tenga el .xlsx registrado con otro tipo para que el filtro lo tape.
   */
  caso('el selector no filtra por tipo', false, /accept=/.test(comp))
  caso('y lo decide la aplicación mirando el contenido', true, /pareceXlsx\(bytes\)/.test(comp))
  // El mensaje de «conviértelo a CSV a mano» ya no tiene sentido.
  caso('ya no manda convertir a CSV a mano', false, /usa Archivo → Guardar como → CSV/.test(comp))

  /*
   * Y lo importante: que lo leído por el lector encaje con lo que espera el
   * emparejador de columnas. Un lector que funciona pero entrega cabeceras que
   * nadie reconoce no sirve de nada — habría que emparejar las diez a mano.
   */
  const leer = await cargar('src/lib/leerExcel.ts')
  const imp = await cargar('src/lib/importar.ts')
  const filas = await leer.leerXlsx(xlsx)
  const propuesta = imp.proponerEmparejado(filas[0])
  caso('reconoce «Apellidos y nombre»', 1, propuesta.nombre)
  caso('reconoce «D.N.I.»', 2, propuesta.dni)
  caso('reconoce «Nº Hermano»', 0, propuesta.numero)
  caso('reconoce «Correo»', 5, propuesta.email)
  caso('reconoce «Teléfono móvil»', 6, propuesta.telefono)
  caso('reconoce «Nº de cuenta»', 8, propuesta.iban)
  caso('reconoce «Fecha nacimiento»', 4, propuesta.fechaNacimiento)

  /*
   * «¿Está de baja?» con Sí/No significa lo CONTRARIO que una columna
   * «Situación» con Sí/No. Si se lee al derecho, los 28 hermanos activos entran
   * de baja y los dos de baja entran activos.
   */
  caso('y sabe que «¿Está de baja?» pregunta al revés', true, imp.cabeceraEsNegativa('¿Está de baja?'))
  caso('«No» en esa columna es activo', 'Activo', imp.estadoDe('No', true))
  caso('y «Sí» es baja', 'Baja', imp.estadoDe('Sí', true))
}
