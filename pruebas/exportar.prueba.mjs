/**
 * Lo que sale al pulsar «Exportar».
 *
 * EL FALLO: los programas de hoja de cálculo ejecutan lo que empieza por `=`,
 * `+`, `@` o `-`. Y el censo no lo escribe solo la secretaría: en la web de la
 * hermandad hay un formulario de «hazte hermano» donde escribe cualquiera
 * desde fuera.
 *
 * Alguien puede darse de alta llamándose
 *
 *     =HYPERLINK("http://sitio-malo.example","Pincha aquí")
 *
 * y esperar. El día que la secretaria exporte el censo y lo abra en Excel
 * —que es exactamente para lo que está el botón— ese nombre deja de ser un
 * nombre y pasa a ser algo que el programa ejecuta en su ordenador, con el
 * censo entero delante.
 */
export default async function ({ caso, cargar }) {
  const { toCsv } = await cargar('src/lib/csv.ts')

  /** Devuelve la celda tal cual sale en el archivo. */
  const celdaDe = (valor) => toCsv(['x'], [[valor]]).split('\n')[1]

  // --- Lo que hay que neutralizar ---
  for (const peligroso of [
    '=HYPERLINK("http://malo.example","Pincha")',
    '=1+1',
    '+34600000000',
    '@SUM(A1:A9)',
    '=cmd|\'/c calc\'!A1',
  ]) {
    const salida = celdaDe(peligroso)
    caso(`«${peligroso.slice(0, 22)}» sale como texto`, true, salida.includes("'" + peligroso.slice(0, 4)))
  }

  // --- Y lo que NO se puede tocar ---
  // Un importe negativo tiene que seguir siendo un número, o la hoja no suma.
  caso('-25 sigue siendo un número', '-25', celdaDe(-25))
  caso('«-25» escrito a mano, también', '-25', celdaDe('-25'))
  // Entrecomillado porque lleva coma dentro, pero SIN comilla delante: sigue
  // siendo una cifra para la hoja de cálculo.
  caso('«-1.234,50» también', '"-1.234,50"', celdaDe('-1.234,50'))
  caso('un nombre normal no se toca', 'Rafael Ortiz Bermejo', celdaDe('Rafael Ortiz Bermejo'))
  caso('un número suelto tampoco', '30', celdaDe(30))
  caso('un IBAN tampoco', 'ES4721000813610200123456', celdaDe('ES4721000813610200123456'))

  // --- Lo que ya funcionaba, que no se caiga ---
  // El separador de la aplicación es el punto y coma (lo que espera un Excel
  // en español), así que una celda con punto y coma dentro va entrecomillada.
  caso('el punto y coma va entre comillas', '"uno;dos"', celdaDe('uno;dos'))
  caso('las comillas se duplican', '"dice ""hola"""', celdaDe('dice "hola"'))
  // Aquí no vale partir por saltos de línea: el salto va DENTRO de la celda.
  caso('un salto de línea también', 'x\n"dos\nlíneas"', toCsv(['x'], [['dos\nlíneas']]))
  caso('la cabecera sale primero', 'nombre;importe', toCsv(['nombre', 'importe'], []).split('\n')[0])

  // Un nombre peligroso Y con punto y coma: las dos protecciones a la vez.
  caso('fórmula con punto y coma', `"'=SUM(1;2)"`, celdaDe('=SUM(1;2)'))
}
