/**
 * EL CAMINO DE VUELTA DE UN IMPORTE: de «3.600,50 €» al número.
 *
 * Existe para exportar a Excel. Los informes se arman con los importes ya
 * escritos —así se ven, así se imprimen, así salen en el CSV—, y una hoja de
 * cálculo donde la columna de importes es TEXTO no se puede sumar. Que es lo
 * primero que hace quien la abre: seleccionar la columna y mirar el total.
 *
 * Lo que se comprueba aquí, y es lo único que importa de verdad, es que sea la
 * inversa EXACTA de `formatCurrency`. Las dos funciones tienen que moverse
 * juntas: el día que se cambie el formato de los importes —otra moneda, otro
 * separador— y esta se quede como estaba, la exportación no fallaría con un
 * error. Devolvería `null` en silencio y todas las columnas de dinero saldrían
 * como texto, sin que nadie lo note hasta que en el cabildo alguien intente
 * sumar y no salga. Por eso la prueba las cruza en los dos sentidos sobre una
 * tanda de importes, en vez de comparar contra cadenas escritas a mano.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/format.ts')

  /* ------------------------------------------------------------------
     IDA Y VUELTA contra el formateador de verdad
     ------------------------------------------------------------------ */
  const IMPORTES = [
    0, 1, 0.05, 0.5, 12.05, 60, 999.99, 1000, 1234.56, 12345.6, 999999.99,
    -0.01, -12.05, -1234.56, -999999.99,
  ]
  caso(
    'todo importe vuelve siendo el mismo número',
    [],
    IMPORTES.filter((n) => m.importeDeTexto(m.formatCurrency(n)) !== n),
  )

  /*
   * EL MENOS TIPOGRÁFICO. Tesorería no escribe el guion del teclado: pone «−»
   * (U+2212) delante de los gastos. Sin contemplarlo, TODOS los gastos se
   * exportarían en positivo y el Excel sumaría la caja al revés — un error que
   * no se ve mirando el archivo, solo cuadrando con el banco.
   */
  const MENOS = String.fromCharCode(0x2212)
  caso('el menos tipográfico de Tesorería cuenta como negativo', -12.05,
    m.importeDeTexto(`${MENOS}12,05 €`))
  caso('y el guion normal también', -12.05, m.importeDeTexto('-12,05 €'))

  /* --- Lo que se escribe a mano, con espacios de más o de menos --- */
  caso('con espacio normal antes del símbolo', 60, m.importeDeTexto('60,00 €'))
  caso('sin espacio ninguno', 60, m.importeDeTexto('60,00€'))
  caso('con espacios alrededor', 60, m.importeDeTexto('  60,00 €  '))
  caso('el punto de los miles no es el decimal', 1234.56, m.importeDeTexto('1.234,56 €'))
  caso('ni con dos grupos de miles', 1234567.89, m.importeDeTexto('1.234.567,89 €'))
  caso('sin decimales también vale', 1234, m.importeDeTexto('1.234 €'))
  // «-0,00 €» en una hoja de cálculo se lee raro y no significa nada.
  caso('el cero no sale con signo', 0, m.importeDeTexto('-0,00 €'))

  /* ------------------------------------------------------------------
     Y LO QUE NO ES UN IMPORTE, QUE SE QUEDE COMO ESTÁ

     Esto es lo que evita que la exportación invente números. Prefiero una
     columna que no se pueda sumar a un número que nadie escribió dentro de
     unas cuentas que se presentan.
     ------------------------------------------------------------------ */
  caso('un número suelto no es dinero', null, m.importeDeTexto('1234'))
  caso('el número de hermano tampoco', null, m.importeDeTexto('214'))
  caso('ni el aforo de un tramo', null, m.importeDeTexto('120'))
  caso('un porcentaje no es dinero', null, m.importeDeTexto('75 %'))
  caso('otra moneda tampoco', null, m.importeDeTexto('1.234,56 $'))
  caso('un nombre, menos', null, m.importeDeTexto('Ana Sánchez'))
  caso('una fecha, tampoco', null, m.importeDeTexto('03 feb 2026'))
  caso('el vacío no vale cero', null, m.importeDeTexto(''))
  caso('una raya es una raya', null, m.importeDeTexto('—'))
  // Con el símbolo pero mal escrito: es lo que llegaría de un dato corrupto.
  caso('con el símbolo pero sin cifras', null, m.importeDeTexto('€'))
  caso('con letras dentro', null, m.importeDeTexto('12a,05 €'))
  caso('con dos comas', null, m.importeDeTexto('1,2,3 €'))
  caso('los miles mal agrupados no cuelan', null, m.importeDeTexto('1.23.456,00 €'))
}
