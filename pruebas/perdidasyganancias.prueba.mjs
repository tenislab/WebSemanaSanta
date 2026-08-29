/**
 * LA CUENTA DE PÉRDIDAS Y GANANCIAS Y LOS GASTOS PORCENTUALES.
 *
 * Lo que se pidió: «al crear informe, crear cuenta de pérdidas y ganancias y
 * opción de añadir gastos porcentuales a los ingresos, gastos, etc. que se
 * pueda enlazar».
 *
 * LO QUE MÁS SE COMPRUEBA AQUÍ son las dos invariantes que sostienen todo:
 *
 *   1. UN REPARTO NO CAMBIA NINGÚN TOTAL. El gasto ya está en el libro por su
 *      importe, que es el de la factura. Si repartirlo moviera el total, el
 *      informe estaría inventando o perdiendo dinero.
 *   2. NADA DE ESTO ESCRIBE EN TESORERÍA. Un compromiso es dinero que sigue en
 *      la cuenta; apuntarlo descuadraría el saldo con el banco y lo contaría
 *      dos veces el día que se pague de verdad.
 */
export default async function ({ cargar, caso }) {
  const pyg = await cargar('src/lib/perdidasYGanancias.ts')
  const movs = await cargar('src/data/movimientos.ts')
  const rep = await cargar('src/lib/repartos.ts')

  const m = (fecha, tipo, categoria, importe) => ({ fecha, tipo, categoria, importe })
  const regla = (extra) => ({
    id: 'r1', nombre: 'R', tipo: 'reparto', categoriaBase: '', porcentajeCent: 0,
    categoriaDestino: '', activo: true, nota: '', creadoEn: '', ...extra,
  })

  /*
   * 1. El año sale de la fecha, y `movimientos.fecha` guarda DOS formatos a
   * la vez: el que escribe a mano la secretaría desde Tesorería
   * («05 ene 2026») y el que escriben las funciones del servidor al cobrar
   * una venta de la tienda o un pago con tarjeta (`to_char(now(),
   * 'YYYY-MM-DD')`, o sea «2026-01-05»). Con solo el primero, una venta de la
   * tienda desaparecía de este informe sin un solo error: se descubrió
   * vendiendo algo en el navegador y viendo cómo el total del año se iba a
   * cero de golpe.
   */
  {
    caso('«05 ene 2026» es 2026', 2026, pyg.anioDelMovimiento('05 ene 2026'))
    caso('con espacios de más, también', 2026, pyg.anioDelMovimiento('  05 ene 2026  '))
    caso('la fecha del servidor, «2026-01-05», también es 2026', 2026, pyg.anioDelMovimiento('2026-01-05'))
    caso('y con espacios de más', 2026, pyg.anioDelMovimiento('  2026-01-05  '))
    caso('una fecha rota no revienta', 0, pyg.anioDelMovimiento('sin fecha'))
    caso('ni vacía', 0, pyg.anioDelMovimiento(''))
  }

  /* 2. Los totales, y el año anterior al lado. */
  {
    const libro = [
      m('05 ene 2026', 'Ingreso', 'Cuotas Hermanos/as', 1000),
      m('05 feb 2026', 'Ingreso', 'Donativos, Ofrendas y Cepillos', 500),
      m('05 mar 2026', 'Gasto', 'Mantenimiento', 300),
      m('05 ene 2025', 'Ingreso', 'Cuotas Hermanos/as', 800),
      m('05 mar 2025', 'Gasto', 'Mantenimiento', 900),
      m('05 ene 2024', 'Ingreso', 'Cuotas Hermanos/as', 99999), // ni este año ni el anterior
    ]
    const c = pyg.cuentaDeResultados(libro, 2026)
    caso('ingresos del año', 1500, c.totalIngresos)
    caso('gastos del año', 300, c.totalGastos)
    caso('resultado', 1200, c.resultado)

    // La misma cuenta, pero con una venta de la tienda de por medio: su
    // fecha la escribe el servidor, en ISO. Tiene que sumar igual que las
    // demás, no desaparecer.
    const conVenta = pyg.cuentaDeResultados(
      [...libro, m('2026-06-15', 'Ingreso', 'Otros ingresos', 250)], 2026,
    )
    caso('la venta de la tienda entra en el total', 1750, conVenta.totalIngresos)
    caso('ingresos del anterior', 800, c.totalIngresosAnterior)
    caso('gastos del anterior', 900, c.totalGastosAnterior)
    caso('resultado del anterior, en negativo', -100, c.resultadoAnterior)
    caso('el año de antes NO se cuela', 1500, c.totalIngresos)
  }

  /*
   * 3. LAS PARTIDAS VAN DE MAYOR A MENOR, no alfabéticamente. Un informe de
   * cuentas se lee por arriba: lo que se quiere saber es de dónde sale la
   * mayor parte del dinero. Por orden alfabético hay que leer la hoja entera.
   */
  {
    const libro = [
      m('05 ene 2026', 'Ingreso', 'Subvenciones', 100),
      m('05 ene 2026', 'Ingreso', 'Cuotas Hermanos/as', 900),
      m('05 ene 2026', 'Ingreso', 'Donativos, Ofrendas y Cepillos', 500),
    ]
    const c = pyg.cuentaDeResultados(libro, 2026)
    caso('la más gorda primero', 'Cuotas Hermanos/as', c.ingresos[0].categoria)
    caso('y la más pequeña al final', 'Subvenciones', c.ingresos[2].categoria)
    caso('el peso de la mayor', 60, Math.round(c.ingresos[0].peso))
    caso('los pesos suman cien', 100, Math.round(c.ingresos.reduce((n, l) => n + l.peso, 0)))
  }

  /*
   * 4. LO QUE NO ENCAJA EN NINGUNA PARTIDA NO SE PIERDE: va a «Otros».
   *
   * Perder una línea en un informe de cuentas es la peor manera de fallar,
   * porque el papel sigue cuadrando consigo mismo y nadie lo nota.
   */
  {
    const libro = [
      m('05 ene 2026', 'Ingreso', 'Cuotas Hermanos/as', 100),
      m('05 ene 2026', 'Ingreso', 'Una categoría que se inventó alguien', 250),
    ]
    const c = pyg.cuentaDeResultados(libro, 2026)
    caso('el total lo incluye', 350, c.totalIngresos)
    caso('y sale como «Otros»', true, c.ingresos.some((l) => l.categoria === 'Otros' && l.importe === 250))
  }

  /*
   * 5. UN REPARTO NO CAMBIA NINGÚN TOTAL. Esta es la invariante que sostiene
   * todo: el gasto ya está en el libro por el importe de la factura.
   */
  {
    const libro = [
      m('05 ene 2026', 'Ingreso', 'Cuotas Hermanos/as', 1000),
      m('05 ene 2026', 'Gasto', 'Mantenimiento', 500),
    ]
    const r = [regla({ tipo: 'reparto', categoriaBase: 'Mantenimiento', porcentajeCent: 4000, categoriaDestino: 'Gastos varios menores' })]
    const sin = pyg.cuentaDeResultados(libro, 2026)
    const con = pyg.cuentaDeResultados(libro, 2026, r)
    caso('el total de gastos NO cambia', sin.totalGastos, con.totalGastos)
    caso('ni el resultado', sin.resultado, con.resultado)
    caso('no compromete nada', 0, con.comprometido)

    const base = con.gastos.find((l) => l.categoria === 'Mantenimiento')
    const destino = con.gastos.find((l) => l.categoria === 'Gastos varios menores')
    caso('a la partida de origen se le quitan 200', -200, base.ajuste)
    caso('y a la de destino se le ponen', 200, destino.ajuste)
    caso('los dos ajustes se anulan', 0, base.ajuste + destino.ajuste)
    caso('el importe del libro se deja intacto', 500, base.importe)
  }

  /*
   * 6. UN COMPROMISO SÍ SUMA, y se aparta del resultado sin tocar el libro.
   */
  {
    const libro = [
      m('05 ene 2026', 'Ingreso', 'Donativos, Ofrendas y Cepillos', 1000),
      m('05 ene 2026', 'Gasto', 'Mantenimiento', 200),
    ]
    const r = [regla({ tipo: 'compromiso', categoriaBase: 'Donativos, Ofrendas y Cepillos', porcentajeCent: 1000, categoriaDestino: 'Obras Benéficas y Sociales' })]
    const c = pyg.cuentaDeResultados(libro, 2026, r)
    caso('el resultado del libro no se toca', 800, c.resultado)
    caso('pero hay 100 comprometidos', 100, c.comprometido)
    caso('y el ajustado los resta', 700, c.resultadoAjustado)
    caso('la partida de destino sale aunque no tuviera gasto', true,
      c.gastos.some((l) => l.categoria === 'Obras Benéficas y Sociales' && l.ajuste === 100))
    caso('con importe cero en el libro, que es la verdad', 0,
      c.gastos.find((l) => l.categoria === 'Obras Benéficas y Sociales').importe)

    /*
     * Y SOLO SALE EN SU TABLA. Esto se vio abriendo el informe, no aquí: las
     * partidas ajustadas se colaban en LAS DOS tablas, así que la de INGRESOS
     * salía con líneas de gasto a cero euros y su ajuste al lado. No cambiaba
     * ningún total —el papel seguía cuadrando consigo mismo— pero decía que la
     * hermandad ingresa por «Mantenimiento».
     */
    const gastoEnIngresos = c.ingresos.filter((l) => !movs.CATEGORIAS_INGRESO.includes(l.categoria) && l.categoria !== 'Otros')
    caso('ninguna partida de gasto se cuela en los ingresos', '',
      gastoEnIngresos.map((l) => l.categoria).join(', '))
    const ingresoEnGastos = c.gastos.filter((l) => !movs.CATEGORIAS_GASTO.includes(l.categoria) && l.categoria !== 'Otros')
    caso('ni al revés', '', ingresoEnGastos.map((l) => l.categoria).join(', '))
  }

  /*
   * 7. LA REGLA SE ENGANCHA A INGRESOS O A GASTOS, que es el «a los ingresos,
   * gastos, etc.» de la petición: la base se busca en las dos listas.
   */
  {
    const libro = [m('05 ene 2026', 'Ingreso', 'Subvenciones', 1000)]
    const r = [regla({ tipo: 'compromiso', categoriaBase: 'Subvenciones', porcentajeCent: 2500, categoriaDestino: 'Cultos Internos' })]
    caso('se engancha a un ingreso', 250, pyg.cuentaDeResultados(libro, 2026, r).comprometido)

    const libro2 = [m('05 ene 2026', 'Gasto', 'Cultos Internos', 1000)]
    const r2 = [regla({ tipo: 'reparto', categoriaBase: 'Cultos Internos', porcentajeCent: 2500, categoriaDestino: 'Mantenimiento' })]
    const c2 = pyg.cuentaDeResultados(libro2, 2026, r2)
    caso('y a un gasto', 250, c2.gastos.find((l) => l.categoria === 'Mantenimiento').ajuste)
  }

  /* 8. Una regla apagada no cuenta, y una sobre una partida vacía tampoco. */
  {
    const libro = [m('05 ene 2026', 'Ingreso', 'Donativos, Ofrendas y Cepillos', 1000)]
    const apagada = [regla({ tipo: 'compromiso', activo: false, categoriaBase: 'Donativos, Ofrendas y Cepillos', porcentajeCent: 1000, categoriaDestino: 'Obras Benéficas y Sociales' })]
    caso('apagada no compromete nada', 0, pyg.cuentaDeResultados(libro, 2026, apagada).comprometido)
    caso('ni sale en las aplicadas', 0, pyg.cuentaDeResultados(libro, 2026, apagada).reglasAplicadas.length)

    const sobreNada = [regla({ tipo: 'compromiso', categoriaBase: 'Subvenciones', porcentajeCent: 1000, categoriaDestino: 'Obras Benéficas y Sociales' })]
    caso('sobre una partida sin nada, tampoco', 0, pyg.cuentaDeResultados(libro, 2026, sobreNada).comprometido)
    caso('y no se lista como aplicada', 0, pyg.cuentaDeResultados(libro, 2026, sobreNada).reglasAplicadas.length)
  }

  /*
   * 9. EL PORCENTAJE, EN ENTEROS. `importe * pct / 100` con decimales da
   * 33,333333333333336 y de ahí salen céntimos que bailan según el orden en
   * que se sumen. Los empates redondean hacia arriba, como `round(numeric, 2)`.
   */
  {
    caso('el 40 % de 500,00 €', 20000, rep.trozo(50000, 4000))
    caso('el 33,33 % de 100,00 €', 3333, rep.trozo(10000, 3333))
    caso('el 100 % es todo', 12345, rep.trozo(12345, 10000))
    caso('el medio céntimo sube', 3, rep.trozo(5, 5000))       // 2,5 → 3
    caso('y otro medio', 1, rep.trozo(1, 5000))                // 0,5 → 1
    caso('lo que no llega a medio, baja', 0, rep.trozo(1, 4000)) // 0,4 → 0
    caso('nunca sale un decimal', true, Number.isInteger(rep.trozo(9999, 3333)))
  }

  /* 10. La variación con el año anterior, y el cero que da «∞ %». */
  {
    caso('subida', 25, pyg.variacion(125, 100))
    caso('bajada', -50, pyg.variacion(50, 100))
    // Dividir entre cero da Infinity, que se imprime «∞ %» en un documento que
    // se firma. No hay ningún porcentaje que describa pasar de nada a algo.
    caso('desde cero NO da infinito', null, pyg.variacion(100, 0))
    caso('ni cero desde cero', null, pyg.variacion(0, 0))
  }

  /* 11. Las reglas mal escritas se cazan antes de guardarlas. */
  {
    const buena = { nombre: 'X', categoriaBase: 'A', categoriaDestino: 'B', porcentajeCent: 4000 }
    caso('una buena no se queja', null, rep.problemaDeReparto(buena))
    caso('sin nombre', true, /nombre/.test(rep.problemaDeReparto({ ...buena, nombre: ' ' })))
    caso('sin origen', true, /de qué partida/.test(rep.problemaDeReparto({ ...buena, categoriaBase: '' })))
    caso('sin destino', true, /a qué partida/.test(rep.problemaDeReparto({ ...buena, categoriaDestino: '' })))
    // Enganchada a sí misma no da error en ninguna parte y deja un informe
    // absurdo: «el 40 % de Mantenimiento va a Mantenimiento».
    caso('a sí misma se caza', true, /la misma/.test(rep.problemaDeReparto({ ...buena, categoriaDestino: 'A' })))
    caso('cero por ciento', true, /mayor que cero/.test(rep.problemaDeReparto({ ...buena, porcentajeCent: 0 })))
    caso('más del cien', true, /más del 100/.test(rep.problemaDeReparto({ ...buena, porcentajeCent: 10001 })))
    caso('el cien justo sí vale', null, rep.problemaDeReparto({ ...buena, porcentajeCent: 10000 }))
  }

  /*
   * 12. REPARTIR MÁS DEL 100 % DE UNA PARTIDA. Cada regla por su cuenta es
   * razonable y entre las dos sacan de un gasto más dinero del que hay. Eso no
   * lo puede ver quien escribe la segunda.
   */
  {
    const dos = [
      regla({ id: 'a', tipo: 'reparto', categoriaBase: 'Mantenimiento', porcentajeCent: 6000, categoriaDestino: 'X' }),
      regla({ id: 'b', tipo: 'reparto', categoriaBase: 'Mantenimiento', porcentajeCent: 6000, categoriaDestino: 'Y' }),
    ]
    caso('se avisa', 1, rep.seRepartenDeMas(dos).length)
    caso('y se dice cuánto', true, /120 %/.test(rep.seRepartenDeMas(dos)[0]))
    caso('con el 100 justo no se avisa', 0, rep.seRepartenDeMas([
      regla({ id: 'a', tipo: 'reparto', categoriaBase: 'M', porcentajeCent: 5000, categoriaDestino: 'X' }),
      regla({ id: 'b', tipo: 'reparto', categoriaBase: 'M', porcentajeCent: 5000, categoriaDestino: 'Y' }),
    ]).length)
    // Los compromisos NO entran: apartar el 150 % de una partida es raro pero
    // es una decisión legítima de la junta, no un imposible aritmético.
    caso('los compromisos no se cuentan aquí', 0, rep.seRepartenDeMas([
      regla({ id: 'a', tipo: 'compromiso', categoriaBase: 'M', porcentajeCent: 9000, categoriaDestino: 'X' }),
      regla({ id: 'b', tipo: 'compromiso', categoriaBase: 'M', porcentajeCent: 9000, categoriaDestino: 'Y' }),
    ]).length)
    // Y una apagada tampoco.
    caso('una apagada no cuenta', 0, rep.seRepartenDeMas([
      regla({ id: 'a', tipo: 'reparto', categoriaBase: 'M', porcentajeCent: 6000, categoriaDestino: 'X' }),
      regla({ id: 'b', tipo: 'reparto', activo: false, categoriaBase: 'M', porcentajeCent: 6000, categoriaDestino: 'Y' }),
    ]).length)
  }

  /* 13. Los céntimos, que es donde se descuadran los informes. */
  {
    const libro = Array.from({ length: 30 }, () => m('05 ene 2026', 'Ingreso', 'Cuotas Hermanos/as', 0.1))
    const c = pyg.cuentaDeResultados(libro, 2026)
    caso('treinta veces diez céntimos son tres euros', 3, c.totalIngresos)
    caso('y no 2,9999999999999996', true, String(c.totalIngresos).length <= 3)
    // El «-0», que se imprime «-0,00 €» y asusta a quien lo ve.
    caso('un ejercicio vacío no da «-0»', false,
      Object.is(pyg.cuentaDeResultados([], 2026).resultado, -0))
  }

  /* 14. La frase del resultado, que cambia según el signo y los compromisos. */
  {
    const libro = [m('05 ene 2026', 'Ingreso', 'Donativos, Ofrendas y Cepillos', 1000), m('05 ene 2026', 'Gasto', 'Mantenimiento', 900)]
    caso('en positivo', true, /positivo/.test(pyg.comoSeLeeElResultado(pyg.cuentaDeResultados(libro, 2026))))
    const enNegativo = [m('05 ene 2026', 'Gasto', 'Mantenimiento', 900)]
    caso('en negativo', true, /negativo/.test(pyg.comoSeLeeElResultado(pyg.cuentaDeResultados(enNegativo, 2026))))
    caso('en equilibrio', true, /equilibrio/.test(pyg.comoSeLeeElResultado(pyg.cuentaDeResultados([], 2026))))
    // El caso que importa: cierra en positivo pero los compromisos se lo comen.
    const r = [regla({ tipo: 'compromiso', categoriaBase: 'Donativos, Ofrendas y Cepillos', porcentajeCent: 5000, categoriaDestino: 'Obras Benéficas y Sociales' })]
    caso('positivo pero sin margen', true,
      /no queda margen/.test(pyg.comoSeLeeElResultado(pyg.cuentaDeResultados(libro, 2026, r))))
  }

  /*
   * 15. Y LO QUE NO PUEDE PASAR NUNCA: QUE ESTO ESCRIBA EN TESORERÍA.
   *
   * Un compromiso es dinero que sigue en la cuenta. Apuntarlo en el libro
   * rompería dos cosas: el saldo dejaría de cuadrar con el banco, y el día que
   * de verdad se pague se contaría dos veces.
   */
  {
    const { readFile } = await import('node:fs/promises')

    const libRep = await readFile('src/lib/repartos.ts', 'utf8')
    caso('las reglas no saben apuntar', false, /conApunteDeCobro|MOVIMIENTOS_INICIALES/.test(libRep))
    const libPyg = await readFile('src/lib/perdidasYGanancias.ts', 'utf8')
    caso('y el informe tampoco escribe', false, /conApunteDeCobro|setMovimientos/.test(libPyg))

    // Ni la base: no hay ningún disparador que genere movimientos desde aquí.
    const sql = await readFile('supabase/reglas-de-reparto.sql', 'utf8')
    caso('la base no inserta apuntes', false, /insert into movimientos/i.test(sql))
    /*
     * Y LA TABLA ES DE CONFIGURACIÓN, SIN NINGUNA COLUMNA DE DINERO.
     *
     * Se miran las COLUMNAS, con los comentarios fuera. Buscándolo en el texto
     * del fichero, esta prueba fallaba por la explicación de la cabecera —que
     * dice justamente que aquí no se guardan importes—: el comentario que
     * cuenta por qué algo no está no puede tumbar la prueba de que no está.
     */
    const columnas = sql
      .slice(sql.indexOf('create table if not exists reglas_reparto'))
      .split('alter table')[0]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*--.*$/gm, '')
    caso('la tabla no guarda ningún importe', false, /importe|euros|saldo/i.test(columnas))
    caso('pero sí el porcentaje, que es lo suyo', true, /porcentaje_cent/.test(columnas))

    // El papel LO DICE, que es lo que sobrevive a la conversación donde se explicó.
    const doc = await readFile('src/components/CuentaResultados.tsx', 'utf8')
    caso('el documento avisa de que no son gastos', true, /no son gastos todav/i.test(doc))
    caso('y de que el banco cuadra con el resultado del ejercicio', true, /cuadra con el/.test(doc))
    // Y enseña LAS DOS cifras, no solo la ajustada.
    caso('sale el resultado del ejercicio', true, /RESULTADO DEL EJERCICIO/.test(doc))
    caso('y el de después de compromisos', true, /RESULTADO DESPUÉS DE COMPROMISOS/.test(doc))
  }

  /*
   * 16. LA DEMO CUADRA. Las dos reglas de ejemplo tienen que enganchar a
   * partidas que de verdad tienen movimientos, o no se vería ninguna
   * funcionando — que es lo mismo que no haberlas hecho.
   */
  {
    const reglas = (await cargar('src/data/repartos.ts')).REPARTOS_INICIALES
    const libro = (await cargar('src/data/movimientos.ts')).MOVIMIENTOS_INICIALES
    caso('hay una de cada clase', 2, new Set(reglas.map((r) => r.tipo)).size)

    const c = pyg.cuentaDeResultados(libro, 2026, reglas)
    caso('las dos mueven algo', 2, c.reglasAplicadas.length)
    caso('y el reparto no cambia el total de gastos',
      pyg.cuentaDeResultados(libro, 2026).totalGastos, c.totalGastos)
    caso('el compromiso sí aparta', true, c.comprometido > 0)
    caso('y ninguna deja el informe sin cuadrar', true,
      Math.abs((c.resultado - c.comprometido) - c.resultadoAjustado) < 0.005)

    // Y ninguna está enganchada a una categoría que no existe en el catálogo.
    const todas = new Set([...movs.CATEGORIAS_INGRESO, ...movs.CATEGORIAS_GASTO])
    const raras = reglas.flatMap((r) => [r.categoriaBase, r.categoriaDestino]).filter((c2) => !todas.has(c2))
    caso('ninguna apunta a una partida inventada', '', [...new Set(raras)].join(', '))
  }
}
