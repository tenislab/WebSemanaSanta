/**
 * QUE LAS DOS MITADES DE LA VENTANA DIGAN LO MISMO.
 *
 * La ventana de histórico son dos cosas escritas por separado:
 *
 *   · `filtroOr` — lo que se le pide a la base de datos.
 *   · `dentro()` — la misma pregunta, resuelta en el navegador sobre un objeto.
 *
 * Si discrepan NO HAY NINGÚN ERROR. Lo que hay es un espejo que se queda con
 * filas duplicadas —las que la base manda y `dentro()` cree que son viejas— o
 * que tira filas que sí hacían falta. Y eso sale a la luz como unos totales que
 * no cuadran, meses después, sin nada que apunte a la causa.
 *
 * Así que se prueban LAS DOS CONTRA LA MISMA LISTA. `dentro()` se ejecuta de
 * verdad; el filtro de la base no se puede ejecutar aquí, así que se comprueba
 * que dice exactamente lo que `dentro()` hace, cláusula por cláusula.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/ventanaHistorico.ts')

  // --- DE QUÉ AÑO ES CADA RECIBO ---
  caso('el ejercicio manda cuando lo trae', 2024,
    m.ejercicioDelRecibo({ ejercicio: 2024, fechaEmision: '2019-03-01' }))
  /*
   * Y SI NO, LA FECHA DE EMISIÓN. `ejercicio` es una columna que se añadió
   * después: los recibos de antes la tienen a nulo, y son justo los más viejos,
   * o sea los que la ventana decide dejar fuera. Leerlos mal sería dejar fuera
   * lo que no toca.
   */
  caso('sin ejercicio se coge el año de la emisión', 2019,
    m.ejercicioDelRecibo({ fechaEmision: '2019-03-01' }))
  caso('y sin ninguna de las dos, no se sabe', null, m.ejercicioDelRecibo({}))
  caso('una fecha rota no inventa un año', null, m.ejercicioDelRecibo({ fechaEmision: 'ayer' }))

  // --- CUÁNTOS EJERCICIOS SE TRAEN ---
  caso('se traen dos ejercicios', 2, m.EJERCICIOS_QUE_SE_TRAEN)
  /*
   * DOS Y NO UNO, y no es por prudencia: en enero media hermandad sigue
   * cobrando lo del año pasado, y los informes comparan siempre contra el
   * ejercicio anterior.
   */
  caso('o sea, el de ahora y el de antes', 2025, m.desdeQueEjercicio(2026))

  // --- LA VENTANA DE LAS CUOTAS ---
  const v = m.ventanaDeCuotas(2025)

  /*
   * LA LISTA DE PRUEBA. Cada recibo está aquí por un motivo distinto; si añades
   * uno, escribe cuál.
   */
  const recibos = [
    { id: 'a', ejercicio: 2026, estado: 'Pagada' },      // de este año, cobrado
    { id: 'b', ejercicio: 2025, estado: 'Pagada' },      // del anterior, cobrado
    { id: 'c', ejercicio: 2024, estado: 'Pagada' },      // viejo y cobrado: FUERA
    { id: 'd', ejercicio: 2019, estado: 'Pendiente' },   // viejo y SIN COBRAR: dentro
    { id: 'e', ejercicio: 2018, estado: 'Devuelta' },    // devuelto de hace años: dentro
    { id: 'f', ejercicio: 2017, estado: 'En mora' },     // en mora de hace años: dentro
    { id: 'g', fechaEmision: '2016-01-02', estado: 'Pagada' },     // sin ejercicio, cobrado: FUERA
    { id: 'h', fechaEmision: '2016-01-02', estado: 'Pendiente' },  // sin ejercicio, sin cobrar: dentro
  ]

  caso('entran los dos ejercicios de la ventana y todo lo no cobrado',
    ['a', 'b', 'd', 'e', 'f', 'h'],
    recibos.filter(v.dentro).map((r) => r.id))

  /*
   * --- LO QUE SE QUEDA FUERA ES SOLO LO CERRADO Y COBRADO ---
   *
   * Esta es LA comprobación del fichero. La «deuda viva» que enseña Cuotas suma
   * los recibos pendientes, devueltos y en mora DE CUALQUIER EJERCICIO. Si la
   * ventana se llevara uno solo de esos por delante, la cifra saldría, sería
   * plausible, y estaría mal — que es la peor forma de estar mal.
   */
  const noCobrados = recibos.filter((r) => r.estado !== 'Pagada')
  caso('ningún recibo sin cobrar se queda fuera, de ningún año',
    [], noCobrados.filter((r) => !v.dentro(r)).map((r) => r.id))

  // --- Y LAS DOS MITADES DICEN LO MISMO ---
  caso('el filtro pide los ejercicios desde el mismo año', true,
    v.filtroOr.includes('ejercicio.gte.2025'))
  caso('y además todo lo que no está pagado', true,
    v.filtroOr.includes('estado.neq.Pagada'))
  /*
   * `or` y no `and`: con `and` pediría «de 2025 en adelante Y sin pagar», que
   * es la cuarta parte de lo que hace falta. Se comprueba que las dos
   * condiciones van separadas por coma, que es como PostgREST escribe el `or`.
   */
  caso('las dos condiciones van en un «o», no en un «y»', 2, v.filtroOr.split(',').length)

  // --- LA VENTANA DE LAS PAPELETAS ---
  const p = m.ventanaDePapeletas(2025)
  const papeletas = [
    { id: 'x', anio: 2027 },  // la campaña que viene
    { id: 'y', anio: 2025 },
    { id: 'z', anio: 2024 },  // FUERA
  ]
  caso('las papeletas van solo por año', ['x', 'y'], papeletas.filter(p.dentro).map((r) => r.id))
  caso('y su filtro dice lo mismo', 'anio.gte.2025', p.filtroOr)
  /*
   * AQUÍ NO HAY «MÁS LO NO COBRADO», y es a propósito: una papeleta de hace
   * cuatro años sin pagar no es deuda de nadie, es una papeleta que no se
   * recogió. Ninguna cifra de la aplicación la suma.
   */
  caso('una papeleta vieja sin pagar no se rescata', false, p.dentro({ anio: 2020, estado: 'Asignada' }))

  // --- Y NADIE ENCIENDE ESTO SIN QUERER ---
  const { readFile } = await import('node:fs/promises')
  for (const [pantalla, fichero] of [
    ['Cuotas', 'src/pages/app/Cuotas.tsx'],
    ['Papeletas', 'src/pages/app/Papeletas.tsx'],
  ]) {
    const src = await readFile(fichero, 'utf8')
    /*
     * LA VENTANA VA SIEMPRE DETRÁS DE LA BANDERA. Cambiar qué datos hay en
     * pantalla es la clase de cambio que no se despliega a cincuenta
     * hermandades de golpe: se enciende para una piloto, se mira una semana, y
     * si sale mal se apaga con una línea de SQL sin desplegar nada.
     */
    caso(`${pantalla} solo usa la ventana si está encendida la novedad`, true,
      /esNovedad\(NOVEDADES\.cuotasVentana\)\s*\?/.test(src))
  }

  /*
   * Y EL FRENO DE LA EMISIÓN.
   *
   * `hermanosSinCuota` mira la lista que hay EN MEMORIA. Con la ventana puesta,
   * los recibos cobrados de 2019 no están — no porque no existan, sino porque
   * no se han traído. Sin freno, escribir «2019» en el cajón de emisión diría
   * «se emitirá a 800 hermanos» y crearía 800 recibos duplicados encima de los
   * que ya hay en la base, sin un solo error.
   */
  const cuotas = await readFile('src/pages/app/Cuotas.tsx', 'utf8')
  caso('no se puede emitir un ejercicio que no se ha traído', true,
    /ejercicioFueraDeVentana\s*=\s*!!ventanaCuotas\s*&&\s*ejercicioEmision\s*<\s*desdeEjercicio/.test(cuotas))
  caso('y el botón de emitir lo respeta', true,
    /ejercicioValido\s*=\s*ejercicioEnRango\s*&&\s*!ejercicioFueraDeVentana/.test(cuotas))
  // Y se dice por qué, en vez de dejar un botón apagado sin explicación.
  caso('y se explica en pantalla', true, /ejercicioFueraDeVentana &&/.test(cuotas))
}
