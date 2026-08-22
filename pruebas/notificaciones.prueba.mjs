/**
 * EL PANEL DE AVISOS.
 *
 * Llegó dicho así: «he mandado una solicitud de crear nuevo hermano y no están
 * en ningún lado» y «hacemos panel de notificaciones donde van todo eso».
 *
 * Y el fallo de fondo no era que faltara una pantalla, sino que cada cosa que
 * espera respuesta vivía en el módulo donde se resuelve. Para enterarse de que
 * alguien había pedido el alta había que entrar en Hermanos a mirar. Un aviso
 * que hay que ir a buscar no es un aviso: la persona se queda esperando.
 *
 * Dos cosas se prueban aquí, y son las dos que hacen que un panel así sirva o
 * no sirva:
 *
 *   · que NO se cuele lo ya resuelto — si se cuela, la lista crece sola con
 *     cosas hechas y en dos semanas no la mira nadie;
 *   · que NO se quede fuera lo que espera — que es el fallo original.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/notificaciones.ts')

  const hermanos = [
    { id: 'h1', nombre: 'Ana Sánchez del Río' },
    { id: 'h2', nombre: 'María Reyes Ortega' },
  ]
  const vacio = { solicitudes: [], cuotas: [], papeletas: [], peticionesPapeleta: [], hermanos }

  caso('sin nada pendiente, no hay avisos', 0, m.avisosPendientes(vacio).length)

  // --- 1. Quien pide entrar ---
  const solicitudes = [
    { id: 's1', nombre: 'Lucía Prieto', dni: '11111111A', email: 'l@x.es', telefono: '', clavePropuesta: '', fecha: '2026-03-01', estado: 'Pendiente' },
    { id: 's2', nombre: 'Ya resuelta', dni: '22222222B', email: 'y@x.es', telefono: '', clavePropuesta: '', fecha: '2026-02-01', estado: 'Aprobada' },
    { id: 's3', nombre: 'Rechazada', dni: '33333333C', email: 'r@x.es', telefono: '', clavePropuesta: '', fecha: '2026-02-01', estado: 'Rechazada' },
  ]
  const conAltas = m.avisosPendientes({ ...vacio, solicitudes })
  caso('solo aparece la que está pendiente', 1, conAltas.length)
  caso('y se dice quién es', true, conAltas[0].titulo.includes('Lucía Prieto'))
  caso('con su DNI para poder mirarla', true, conAltas[0].detalle.includes('11111111A'))
  caso('el botón dice lo que va a pasar', 'Dar de alta', conAltas[0].aceptar)
  // Un alta se puede rechazar; un pago que ya ha entrado, no.
  caso('y se puede rechazar', 'Rechazar', conAltas[0].rechazar)

  // --- 2. «Ya he pagado» de una cuota ---
  const cuotas = [
    { id: 'c1', hermanoId: 'h1', importe: 30, estado: 'Pendiente', pagoComunicado: { metodo: 'Bizum', fecha: '3 mar 2026' } },
    // Avisada Y YA COBRADA: esto es historia, no un aviso.
    { id: 'c2', hermanoId: 'h2', importe: 30, estado: 'Pagada', pagoComunicado: { metodo: 'Bizum', fecha: '1 mar 2026' } },
    // Pendiente pero sin avisar: la tesorería no tiene nada que confirmar.
    { id: 'c3', hermanoId: 'h2', importe: 30, estado: 'Pendiente', pagoComunicado: null },
  ]
  const conCuotas = m.avisosPendientes({ ...vacio, cuotas })
  caso('solo la avisada y sin cobrar', 1, conCuotas.length)
  caso('se dice el hermano y el método', true,
    conCuotas[0].titulo.includes('Ana Sánchez del Río') && conCuotas[0].titulo.includes('Bizum'))
  caso('y el importe, que es lo que hay que cuadrar', true, conCuotas[0].detalle.includes('30,00 €'))
  caso('el botón dice «Dar por cobrada»', 'Dar por cobrada', conCuotas[0].aceptar)

  // --- 3. Y de una papeleta ---
  const papeletas = [
    { id: 'p1', numero: 312, hermanoId: 'h2', anio: 2027, importe: 18, estado: 'Asignada', pagoComunicado: { metodo: 'Bizum', fecha: '4 mar 2026' } },
    { id: 'p2', numero: 313, hermanoId: 'h1', anio: 2027, importe: 18, estado: 'Pagada', pagoComunicado: { metodo: 'Bizum', fecha: '2 mar 2026' } },
    // Una anulada con aviso tampoco: ya no hay nada que cobrar.
    { id: 'p3', numero: 314, hermanoId: 'h1', anio: 2027, importe: 18, estado: 'Anulada', pagoComunicado: { metodo: 'Bizum', fecha: '2 mar 2026' } },
  ]
  const conPapeletas = m.avisosPendientes({ ...vacio, papeletas })
  caso('solo la que espera cobro', 1, conPapeletas.length)
  caso('con su número, para encontrarla', true, conPapeletas[0].detalle.includes('312'))
  caso('y el hermano al que hay que apuntársela', 'h2', conPapeletas[0].hermanoId)

  /*
   * --- 4. QUIEN NO TIENE CUOTA ---
   *
   * Llegó dicho así: «las cuotas tienen que ir por hermanos, no puede haber
   * hermano y cuota vacía». La maquinaria de emitirlas ya existía; lo que no
   * había era manera de enterarse de a quién le falta, así que un hermano dado
   * de alta en marzo se quedaba el año entero sin recibo.
   */
  const conCuotaAnual = [
    { id: 'c9', hermanoId: 'h1', importe: 30, estado: 'Pendiente', concepto: 'Cuota anual', fechaEmision: '03 feb 2027' },
  ]
  const faltaUno = m.avisosPendientes({
    ...vacio, cuotas: conCuotaAnual, ejercicio: 2027, conceptoCuota: 'Cuota anual',
  })
  caso('avisa de quien se ha quedado sin cuota', 1, faltaUno.length)
  caso('y dice quién', true, faltaUno[0].titulo.includes('María Reyes Ortega'))
  caso('el botón lleva a emitirlas', 'Emitir sus cuotas', faltaUno[0].aceptar)

  // Con la de los dos emitida, no hay nada que avisar.
  caso('con todas emitidas, no avisa', 0, m.avisosPendientes({
    ...vacio,
    cuotas: [...conCuotaAnual, { id: 'c10', hermanoId: 'h2', importe: 30, estado: 'Pendiente', concepto: 'Cuota anual', fechaEmision: '03 feb 2027' }],
    ejercicio: 2027, conceptoCuota: 'Cuota anual',
  }).length)

  /*
   * Y SIN SABER el ejercicio o el concepto, no se dice nada. Una hermandad que
   * todavía no ha emitido nunca no tiene a nadie «sin cuota» —no le toca aún—,
   * y decirle el primer día que le faltan cuarenta sería asustarla con un
   * problema que no tiene.
   */
  caso('sin ejercicio no se inventa el aviso', 0,
    m.avisosPendientes({ ...vacio, conceptoCuota: 'Cuota anual' }).length)
  caso('ni sin concepto', 0,
    m.avisosPendientes({ ...vacio, ejercicio: 2027 }).length)

  /*
   * EL CASO QUE SE ME ESCAPÓ: censo metido y CERO recibos emitidos.
   *
   * Razoné que una hermandad sin cuotas «no tiene a nadie sin cuota porque no
   * le toca aún». Es falso: una hermandad con hermanos y cero recibos es
   * justo la que necesita que se lo digan. Llegó reportado como «cuotas sigue
   * sin actualizarse bien», con 0 recibos y 5 hermanos en pantalla.
   */
  const sinNingunRecibo = m.avisosPendientes({
    ...vacio, cuotas: [], ejercicio: 2027, conceptoCuota: 'Cuota anual',
  })
  caso('con censo y cero recibos, avisa de los dos', 1, sinNingunRecibo.length)
  caso('y los cuenta a todos', true, /2 hermanos/.test(sinNingunRecibo[0].titulo))

  // --- 5. Todo junto y ordenado ---
  const todo = m.avisosPendientes({
    ...vacio, solicitudes, cuotas, papeletas,
    peticionesPapeleta: [{ id: 'sp1', hermanoId: 'h1', anio: 2027, estado: 'Pendiente' }],
  })
  caso('salen los cuatro', 4, todo.length)
  /*
   * Y primero las personas que esperan. Un pago por confirmar puede aguantar
   * al martes; alguien que ha pedido entrar y no recibe respuesta, no.
   */
  caso('lo primero es quien pide entrar', 'altaHermano', todo[0].tipo)
  caso('y lo último, el pago de cuota', 'pagoCuota', todo[3].tipo)

  // Los identificadores no se pisan entre tablas: el mismo id puede existir en
  // cuotas y en papeletas, y con `id` a secas se solaparían en la lista.
  caso('ningún aviso repite identificador', 4, new Set(todo.map((a) => a.id)).size)
  caso('el número del menú es el mismo', 4, m.cuantosAvisos({
    ...vacio, solicitudes, cuotas, papeletas,
    peticionesPapeleta: [{ id: 'sp1', hermanoId: 'h1', anio: 2027, estado: 'Pendiente' }],
  }))

  // --- Por bloques, para poder enseñarlos separados ---
  const grupos = m.avisosPorTipo(todo)
  caso('se agrupan en cuatro bloques', 4, grupos.length)
  caso('y ningún bloque sale vacío', 0, grupos.filter((g) => g.avisos.length === 0).length)
  caso('cada bloque tiene título', 4, grupos.filter((g) => g.titulo.length > 8).length)
  caso('no se pierde ni se duplica ninguno', todo.length,
    grupos.reduce((n, g) => n + g.avisos.length, 0))

  // Todos saben a dónde llevan: un aviso sin destino obliga a buscarlo a mano,
  // que es justo lo que se quería quitar.
  caso('todos dicen a qué pantalla ir', 4, todo.filter((a) => a.donde.startsWith('/app/')).length)
}
