/**
 * LA MEMORIA DEL EJERCICIO.
 *
 * Es el papel que se lee en voz alta delante de los hermanos, así que lo que
 * se comprueba aquí no es solo que las sumas salgan: es QUÉ SE PUEDE AFIRMAR
 * DE CADA AÑO Y QUÉ NO.
 *
 * El error que se quiere evitar no es una resta mal hecha —esa se ve—, sino el
 * otro: un documento que da por buena una cifra que no puede saber. Contar los
 * hermanos de hoy y titularlo «a 31 de diciembre de 2024» es exactamente eso,
 * y en un cabildo de cuentas nadie lo va a poder desmentir sobre la marcha.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/memoria.ts')

  const hermano = (id, numero, nombre, antiguedad, extra = {}) => ({
    id, numero, nombre, antiguedad, estado: 'Activo', email: '', telefono: '',
    direccion: '', cuotaAlDia: false, iban: null, dni: '', claveAcceso: '',
    authUserId: null, ...extra,
  })

  const HERMANOS = [
    hermano('h1', 1, 'Ana Sánchez', 1991),
    hermano('h2', 2, 'María Reyes', 2024),
    hermano('h3', 3, 'Juan Cabrera', 2024),
    hermano('h4', 4, 'Lucía Soto', 2025, { estado: 'Nuevo' }),
    // Dos bajas de 2024, una de 2025 y una antigua sin fecha.
    hermano('h5', 0, 'Pedro Molina', 2001, { estado: 'Baja', fechaBaja: '2024-03-11', motivoBaja: 'Se muda' }),
    hermano('h6', 0, 'Rafael Ortiz', 1988, { estado: 'Baja', fechaBaja: '2024-11-02' }),
    hermano('h7', 0, 'Carmen Luna', 2010, { estado: 'Baja', fechaBaja: '2025-01-20' }),
    hermano('h8', 0, 'Antonio Vega', 1985, { estado: 'Baja' }),
  ]

  const cuota = (id, ejercicio, importe, estado) => ({
    id, numero: 0, hermanoId: 'h1', concepto: 'Cuota anual', importe, estado,
    ejercicio, fechaEmision: `03 feb ${ejercicio}`, fechaCobro: '', domiciliada: false,
  })
  const CUOTAS = [
    cuota('c1', 2024, 60, 'Pagada'),
    cuota('c2', 2024, 60, 'Pagada'),
    cuota('c3', 2024, 20, 'Pendiente'),
    cuota('c4', 2024, 20, 'En mora'),
    // Del año siguiente: no puede contaminar la memoria de 2024.
    cuota('c5', 2025, 500, 'Pagada'),
  ]

  const mov = (id, fecha, tipo, importe, estado = 'Conciliado') => ({
    id, numero: id, fecha, concepto: '', categoria: '', tipo, importe, cuenta: '', estado,
  })
  const MOVIMIENTOS = [
    mov('m1', '2023-06-01', 'Ingreso', 1000),      // arrastre
    mov('m2', '2023-07-01', 'Gasto', 400),         // arrastre
    mov('m3', '2024-02-01', 'Ingreso', 250),
    mov('m4', '2024-05-01', 'Gasto', 100, 'Pendiente'),
    mov('m5', '2025-01-01', 'Ingreso', 9999),      // del año siguiente
  ]

  const PAPELETAS = [
    { id: 'p1', numero: 1, hermanoId: 'h1', tramoId: 't1', anio: 2024, importe: 30, estado: 'Entregada', fechaSolicitud: '' },
    { id: 'p2', numero: 2, hermanoId: 'h2', tramoId: 't1', anio: 2024, importe: 30, estado: 'Anulada', fechaSolicitud: '' },
    { id: 'p3', numero: 3, hermanoId: 'h3', tramoId: 't1', anio: 2025, importe: 30, estado: 'Entregada', fechaSolicitud: '' },
  ]
  const TRAMOS = [{ id: 't1', nombre: 'Cruz de guía', cuerpo: 'Cristo', capacidad: 4, reparto: 'numero' }]
  const ENSERES = [
    { id: 'e1', numero: 1, nombre: 'Cruz', categoria: '', ubicacion: '', estadoConservacion: 'Bueno', valorAsegurado: 1200, prestadoA: null },
    { id: 'e2', numero: 2, nombre: 'Palio', categoria: '', ubicacion: '', estadoConservacion: 'Necesita restauración', valorAsegurado: null, prestadoA: 'Otra hermandad' },
  ]

  const DATOS = {
    hermanos: HERMANOS, cuotas: CUOTAS, papeletas: PAPELETAS,
    movimientos: MOVIMIENTOS, tramos: TRAMOS, enseres: ENSERES,
  }
  // 2024 visto desde 2025: un ejercicio ya cerrado, que es el caso normal.
  const mem = m.construirMemoria(2024, DATOS, 2025)
  const de = (titulo) => mem.bloques.find((b) => b.titulo === titulo)
  const valor = (titulo, etiqueta) => de(titulo).cifras.find((c) => c.etiqueta === etiqueta)?.valor

  /* ------------------------------------------------------------------
     ALTAS Y BAJAS DEL EJERCICIO — lo que se pregunta en el cabildo
     ------------------------------------------------------------------ */
  caso('las altas del año son las que entraron ese año', ['María Reyes', 'Juan Cabrera'],
    mem.altas.map((a) => a.nombre))
  caso('y no se cuela la del año siguiente', false, mem.altas.some((a) => a.nombre === 'Lucía Soto'))
  caso('las bajas del año son las tramitadas ese año', ['Pedro Molina', 'Rafael Ortiz'],
    mem.bajas.map((b) => b.nombre))
  caso('ordenadas por fecha', ['2024-03-11', '2024-11-02'], mem.bajas.map((b) => b.fecha))
  caso('con su motivo cuando lo dijeron', 'Se muda', mem.bajas[0].motivo)
  caso('y una raya cuando no', '—', mem.bajas[1].motivo)
  caso('la variación es altas menos bajas', '+0', valor('El censo', 'Variación'))

  /*
   * LA BAJA SIN FECHA NO SE COLOCA EN NINGÚN EJERCICIO.
   *
   * Es la de antes de que se guardara la fecha. Meterla en el año que se está
   * mirando —o en el actual— inventaría una salida que a lo mejor fue hace
   * quince años, y la cifra que más se mira de la memoria es justo esa.
   */
  caso('la baja sin fecha no entra en ningún ejercicio', false,
    mem.bajas.some((b) => b.nombre === 'Antonio Vega'))
  caso('pero se cuenta y se dice', 1, mem.bajasSinFecha)
  caso('y sale como cifra propia', '1', valor('El censo', 'Bajas sin fecha'))

  /* ------------------------------------------------------------------
     EL CENSO ES EL DE HOY, Y EL DOCUMENTO LO ADVIERTE
     ------------------------------------------------------------------ */
  caso('el censo cuenta activos y nuevos, no las bajas', '4', valor('El censo', 'Hermanos en el censo'))
  caso('mirando un ejercicio cerrado, avisa de que el censo es el de hoy',
    true, (de('El censo').nota ?? '').includes('HOY'))
  const memHoy = m.construirMemoria(2025, DATOS, 2025)
  caso('y en el año en curso no hay nada que advertir', undefined,
    memHoy.bloques.find((b) => b.titulo === 'El censo').nota)
  caso('el año en curso se marca como tal', [false, true], [mem.esElAnioEnCurso, memHoy.esElAnioEnCurso])

  /* ------------------------------------------------------------------
     CUOTAS — del ejercicio, no de todos los años juntos
     ------------------------------------------------------------------ */
  caso('solo los recibos del ejercicio', '4', valor('Cuotas', 'Recibos emitidos'))
  caso('cobrado del ejercicio', '120,00 €', valor('Cuotas', 'Cobrado').replace(/ /g, ' '))
  caso('en mora, que es deuda y no puede desaparecer', '20,00 €',
    valor('Cuotas', 'En mora').replace(/ /g, ' '))
  caso('el porcentaje se calcula sobre lo emitido', '75 %', valor('Cuotas', 'Cobrado sobre lo emitido'))
  /*
   * SIN RECIBOS NO ES «0 %». Un 0 % en una memoria se lee como que no se cobró
   * nada de lo que se emitió, que es una acusación; lo que pasa es que no se
   * emitió. Son cosas distintas y el papel tiene que distinguirlas.
   */
  caso('sin recibos emitidos no se inventa un 0 %', '—',
    m.construirMemoria(1999, DATOS, 2025).bloques
      .find((b) => b.titulo === 'Cuotas').cifras
      .find((c) => c.etiqueta === 'Cobrado sobre lo emitido').valor)

  /* ------------------------------------------------------------------
     TESORERÍA — con su arrastre, como el estado de cuentas
     ------------------------------------------------------------------ */
  const eur = (etiqueta) => de('Tesorería').cifras.find((c) => c.etiqueta === etiqueta).numero
  caso('el saldo de partida arrastra todo lo anterior', 600, eur('Saldo a 1 de enero'))
  caso('los ingresos son solo los del año', 250, eur('Ingresos del ejercicio'))
  caso('y los gastos también', 100, eur('Gastos del ejercicio'))
  caso('el resultado es la diferencia', 150, eur('Resultado'))
  caso('y el cierre, el arrastre más el resultado', 750, eur('Saldo al cierre'))
  caso('los apuntes sin conciliar son los del año', '1', valor('Tesorería', 'Apuntes sin conciliar'))

  /* ------------------------------------------------------------------
     CORTEJO Y PATRIMONIO
     ------------------------------------------------------------------ */
  caso('las papeletas anuladas no cuentan', '1', valor('Estación de penitencia', 'Papeletas de sitio'))
  caso('ni su dinero', 30, de('Estación de penitencia').cifras
    .find((c) => c.etiqueta === 'Recaudado en papeletas').numero)
  caso('la ocupación va sobre el aforo', '25 %', valor('Estación de penitencia', 'Ocupación'))
  caso('el valor asegurado no cuenta lo que no lo está', 1200,
    de('Patrimonio').cifras.find((c) => c.etiqueta === 'Valor asegurado').numero)

  /*
   * CADA CIFRA DICE QUÉ ES, y de eso depende que salga bien en Excel.
   *
   * El dinero se exporta con formato de moneda y la cuenta de hermanos como
   * número pelado; si la memoria no lo dijera, habría que adivinarlo mirando
   * si el texto lleva el símbolo del euro — y adivinar acierta hasta el día
   * que no.
   */
  const marcadas = mem.bloques.flatMap((b) => b.cifras)
    .filter((c) => c.esDinero)
    .map((c) => c.etiqueta)
  caso('el dinero va marcado como dinero', true,
    marcadas.includes('Cobrado') && marcadas.includes('Saldo al cierre'))
  caso('y una cuenta de hermanos no', false, marcadas.includes('Hermanos en el censo'))
  caso('pero sí lleva su número, para poder sumarla', 4,
    de('El censo').cifras.find((c) => c.etiqueta === 'Hermanos en el censo').numero)
  caso('un porcentaje no tiene número: no se suma con nada', undefined,
    de('Cuotas').cifras.find((c) => c.etiqueta === 'Cobrado sobre lo emitido').numero)
  caso('y se dice cuántos faltan por asegurar', '1', valor('Patrimonio', 'Sin asegurar'))

  /* ------------------------------------------------------------------
     LOS AÑOS QUE SE OFRECEN
     ------------------------------------------------------------------ */
  caso('los años son aquellos de los que hay algo que contar', [2025, 2024, 2023],
    m.aniosConMemoria(DATOS, 2025))
  /*
   * Y NO OCHENTA AÑOS DE ANTIGÜEDADES. El censo de una hermandad arranca en
   * los años cuarenta: si la lista saliera de ahí, para elegir el ejercicio
   * pasado habría que bajar por ochenta años de los que no hay ni un apunte.
   */
  caso('la antigüedad de los hermanos no llena la lista', false,
    m.aniosConMemoria(DATOS, 2025).includes(1991))
  caso('el año en curso está aunque no haya nada apuntado', [2030],
    m.aniosConMemoria({ ...DATOS, hermanos: [], cuotas: [], papeletas: [], movimientos: [] }, 2030))
}
