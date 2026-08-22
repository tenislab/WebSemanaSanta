/**
 * ¿ESTÁ ESTE HERMANO AL CORRIENTE?
 *
 * Llegó dicho así: «y por dios las cuotas no se ponen en condiciones, no
 * puedes ver si alguien tiene la cuota en orden», con la captura de Cuotas
 * enseñando «0 recibos» y la tabla en blanco con cinco hermanos en el censo.
 *
 * Y debajo había un fallo peor que la pantalla vacía: la ficha del hermano
 * lleva un `cuotaAlDia` GUARDADO que nadie actualizaba nunca. Se ponía en
 * falso al darlo de alta y ahí se quedaba, cobrara lo que cobrara la
 * tesorería. De ese booleano bebían el censo, Informes, la segmentación de
 * comunicados y el área del propio hermano: los cuatro decían «Pendiente» de
 * gente que había pagado hacía meses.
 *
 * Aquí se prueba la función que lo sustituye, que no guarda nada: mira los
 * recibos y contesta.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/estadoCuotaHermano.ts')

  const h = (id, extra = {}) => ({
    id, numero: 1, nombre: `Hermano ${id}`, estado: 'Activo', antiguedad: 2000,
    email: '', telefono: '', direccion: '', cuotaAlDia: false, iban: null,
    dni: '', claveAcceso: '', authUserId: null, ...extra,
  })
  const c = (id, hermanoId, estado, importe, ejercicio) => ({
    id, numero: 1, hermanoId, concepto: 'Cuota anual', importe, estado,
    ejercicio, fechaEmision: `03 feb ${ejercicio}`, fechaCobro: `18 feb ${ejercicio}`, domiciliada: true,
  })

  const ana = h('h1'), juan = h('h2'), civil = h('h3', { civil: true }), baja = h('h4', { estado: 'Baja' })

  const cuotas = [
    c('c1', 'h1', 'Pagada', 60, 2027),
    c('c2', 'h2', 'Pendiente', 60, 2027),
    c('c3', 'h2', 'Devuelta', 60, 2026),
  ]

  // --- Uno a uno ---
  caso('quien lo tiene todo cobrado, al día', 'alDia', m.situacionDeHermano(cuotas, ana, 2027).situacion)
  caso('quien tiene un recibo sin cobrar, debe', 'debe', m.situacionDeHermano(cuotas, juan, 2027).situacion)

  /*
   * EL CASO DE LA CAPTURA: un hermano SIN NINGÚN RECIBO. No está al día —no ha
   * pagado nada—, y tampoco debe —no se le ha pedido nada—. Es una tercera
   * cosa, y hay que decirla: dar por bueno a un censo entero al que no se le
   * ha emitido es exactamente el fallo que se venía a arreglar.
   */
  caso('sin ningún recibo, ni al día ni debiendo', 'sinEmitir',
    m.situacionDeHermano([], ana, 2027).situacion)
  caso('y con recibos de otros años pero ninguno de este, tampoco al día', 'sinEmitir',
    m.situacionDeHermano([c('c9', 'h1', 'Pagada', 60, 2025)], ana, 2027).situacion)

  // Al civil no se le emite ninguna: no es que esté al día, es que no paga.
  caso('el hermano civil no paga cuota', 'noAplica', m.situacionDeHermano([], civil, 2027).situacion)
  caso('ni el que está de baja', 'noAplica', m.situacionDeHermano([], baja, 2027).situacion)
  /*
   * Y ESTO ES LO QUE MÁS DUELE SI FALLA: al civil le llegaban todos los avisos
   * de morosidad de la hermandad, uno detrás de otro, por una deuda que no
   * existe. Nace con `cuotaAlDia` en falso y nunca se le emite un recibo.
   */
  caso('un civil con un recibo suelto tampoco entra en morosos', 'noAplica',
    m.situacionDeHermano([c('cx', 'h3', 'Pendiente', 60, 2027)], civil, 2027).situacion)

  // --- Lo que debe, y desde cuándo ---
  const deJuan = m.situacionDeHermano(cuotas, juan, 2027)
  caso('se suma lo de todos los años', 120, deJuan.deudaTotal)
  caso('y se separa lo de este', 60, deJuan.deudaDelEjercicio)
  caso('de lo que viene arrastrado', 60, deJuan.deudaAtrasada)
  /*
   * Desde cuándo arrastra. «Debe» a secas no sirve para decidir: no es lo
   * mismo un recibo de este mes que tres años sin pagar, y con lo segundo no
   * se le da papeleta de sitio.
   */
  caso('y desde qué año', 2026, deJuan.desde)

  /*
   * PAGADO EL DE ESTE AÑO Y DEBIENDO EL DEL PASADO: NO está al corriente.
   * Mirando solo el ejercicio en curso saldría en verde, y es el caso típico
   * del que se puso al día este año y dejó atrás una devolución.
   */
  const conAtraso = m.situacionDeHermano(
    [c('cA', 'h1', 'Pagada', 60, 2027), c('cB', 'h1', 'Devuelta', 60, 2025)], ana, 2027)
  caso('con el año pagado y uno atrasado, debe igual', 'debe', conAtraso.situacion)
  caso('y se dice desde cuándo', 2025, conAtraso.desde)

  // Sumar decimales en coma flotante deja 59,999999999 en pantalla.
  caso('los céntimos no se deshilachan', 60.3, m.situacionDeHermano(
    [c('c1', 'h1', 'Pendiente', 20.1, 2027), c('c2', 'h1', 'Pendiente', 20.1, 2027), c('c3', 'h1', 'Pendiente', 20.1, 2027)],
    ana, 2027).deudaTotal)

  // --- El censo entero ---
  const todos = m.situacionDeTodos(cuotas, [ana, juan, civil, baja], 2027)
  caso('salen los cuatro', 4, todos.length)
  // El que peor está, primero: es a quien hay que reclamar.
  caso('primero el que debe', 'h2', todos[0].hermano.id)
  caso('y el que no paga, al final', 'noAplica', todos[3].situacion)

  const r = m.recuentoDeSituaciones(todos)
  caso('cuenta los que deben', 1, r.deben)
  caso('los que están al día', 1, r.alDia)
  caso('y los que no pagan cuota', 2, r.noAplica)
  caso('la deuda total', 120, r.deuda)
  /*
   * El porcentaje se calcula sobre los que SÍ pagan cuota. Meter a los
   * civiles y a las bajas en el denominador hunde el «% al corriente» de una
   * hermandad que lo tiene todo cobrado.
   */
  caso('el denominador deja fuera a quien no paga', 2, r.conCuota)

  // --- Dicho en palabras ---
  caso('el que debe lo dice con el importe', true,
    /Debe 120,00 €/.test(m.situacionEnUnaFrase(deJuan, 2027)))
  caso('y desde cuándo', true, /Arrastra desde 2026/.test(m.situacionEnUnaFrase(deJuan, 2027)))
  caso('el que no tiene recibo lo dice claro', true,
    /no se le ha emitido/i.test(m.situacionEnUnaFrase(m.situacionDeHermano([], ana, 2027), 2027)))
  caso('y el civil, que no le toca', true,
    /civil/i.test(m.situacionEnUnaFrase(m.situacionDeHermano([], civil, 2027), 2027)))

  caso('cada situación tiene su etiqueta', 4,
    ['alDia', 'debe', 'sinEmitir', 'noAplica'].filter((s) => m.etiquetaDeSituacion(s).texto.length > 3).length)

  await nadieSeFiaDelBooleano({ caso })
}

/**
 * Y QUE NADIE VUELVA A LEER `cuotaAlDia`.
 *
 * El campo sigue en la ficha y en la base porque hay censos importados que lo
 * traen, pero es un dato muerto: nadie lo escribe al cobrar. Dejarlo a la vista
 * es dejar una trampa puesta —el próximo que necesite «¿está al día?» lo va a
 * encontrar antes que a esta función—, así que se comprueba que las cuatro
 * pantallas que lo usaban ya no lo miran.
 */
async function nadieSeFiaDelBooleano({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const lee = async (f) => sinComentarios(await readFile(f, 'utf8'))

  const censo = await lee('src/pages/app/Hermanos.tsx')
  caso('el censo no lee el booleano guardado', false, /h\.cuotaAlDia/.test(censo))
  caso('lo saca de los recibos', true, /situacionDeTodos|situacionDeHermano/.test(censo))

  const informes = await lee('src/pages/app/Informes.tsx')
  caso('Informes tampoco', false, /h\.cuotaAlDia/.test(informes))

  const portal = await lee('src/pages/HermanoPortal.tsx')
  caso('ni el área del hermano', false, /cuotaAlDia/.test(portal))

  /*
   * La segmentación es la que peor mentía: «mándaselo a los que deben» sacaba
   * el censo entero, y «a los que están al día» no sacaba a nadie.
   */
  const seg = await lee('src/lib/segmentacion.ts')
  caso('el sesgo de morosos no se fía del booleano', false, /h\.cuotaAlDia/.test(seg))
}
