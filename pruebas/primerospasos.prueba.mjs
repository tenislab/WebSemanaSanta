/**
 * EL GUIADO DE LA PRIMERA VEZ.
 *
 * Para quien acaba de crear su hermandad y se encuentra un panel con trece
 * secciones vacías. El problema no era que faltara información: era que había
 * demasiada y ninguna decía por dónde se empieza — se abría Cuotas antes de
 * tener censo, no salía nada, y se cerraba la pestaña.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/primerosPasos.ts')

  /** Una hermandad recién creada: nada hecho. */
  const recienCreada = {
    tieneNombre: false, tieneEscudo: false, hermanos: 0, conCargo: 0,
    correoListo: false, hayCuotas: false, tramos: 0, tieneIban: false,
    webPublicada: false, redesConectadas: 0, conAcceso: 0,
  }
  const todoHecho = {
    tieneNombre: true, tieneEscudo: true, hermanos: 840, conCargo: 7,
    correoListo: true, hayCuotas: true, tramos: 9, tieneIban: true,
    webPublicada: true, redesConectadas: 2, conAcceso: 500,
  }

  const pasos = m.pasosPuestaEnMarcha(recienCreada)
  caso('el guion tiene diez pasos', 10, pasos.length)
  caso('recién creada, ninguno hecho', 0, pasos.filter((p) => p.hecho).length)
  caso('con todo puesto, todos hechos', 10, m.pasosPuestaEnMarcha(todoHecho).filter((p) => p.hecho).length)

  /*
   * TODO PASO LLEVA ADÓNDE IR. Un paso que dice qué falta pero no dónde se
   * hace obliga a buscarlo por el menú, que es justo lo que se quería evitar.
   */
  caso('todos dicen a qué pantalla ir', 10, pasos.filter((p) => p.donde.startsWith('/app')).length)
  caso('y cómo llegar por el menú', 10, pasos.filter((p) => p.comoLlegar.length > 3).length)
  caso('y para qué sirve', 10, pasos.filter((p) => p.porQue.length > 20).length)
  caso('ninguno repite identificador', 10, new Set(pasos.map((p) => p.id)).size)

  /*
   * EL ORDEN NO ES DECORATIVO: es el orden en que hay que hacerlo. El censo va
   * antes que las cuotas porque no se le puede cobrar a quien no existe, y los
   * cargos antes que el correo porque quien configura el correo suele ser la
   * secretaría, no quien creó la hermandad.
   */
  const orden = pasos.map((p) => p.id)
  caso('la identidad, primero', 'identidad', orden[0])
  caso('el censo antes que las cuotas', true, orden.indexOf('censo') < orden.indexOf('cuotas'))
  caso('el censo antes que los accesos', true, orden.indexOf('censo') < orden.indexOf('accesos'))
  caso('los cargos antes que el correo', true, orden.indexOf('cargos') < orden.indexOf('correo'))
  caso('la cuenta bancaria antes que las cuotas', true, orden.indexOf('cobros') < orden.indexOf('cuotas'))
  /*
   * Aquí hubo un paso «poner el precio de la papeleta» que estaba ROTO: el
   * precio viene de fábrica a 18 €, así que la comprobación era `18 > 0` y
   * jamás salía pendiente. Un paso que siempre está tachado no es un paso, y
   * encima daba sensación de haber avanzado sin haber hecho nada.
   */
  caso('ningún paso está tachado de fábrica', 0,
    m.pasosPuestaEnMarcha(recienCreada).filter((p) => p.hecho).length)

  // --- Los imprescindibles ---
  const rec = m.resumirPasos(pasos)
  caso('recién creada, cuatro imprescindibles', 4, rec.faltanImprescindibles)
  caso('y el siguiente es el primero', 'identidad', rec.siguiente.id)
  caso('cero por ciento', 0, rec.porcentaje)

  // --- Cómo avanza ---
  const aMedias = m.pasosPuestaEnMarcha({ ...recienCreada, tieneNombre: true, tieneEscudo: true, hermanos: 840 })
  const rm = m.resumirPasos(aMedias)
  caso('dos hechos', 2, rm.hechos)
  caso('el siguiente es el que toca EN ORDEN, no el más fácil', 'cargos', rm.siguiente.id)
  caso('y el porcentaje sube', 20, rm.porcentaje)
  caso('quedan dos imprescindibles', 2, rm.faltanImprescindibles)

  /*
   * MEDIA IDENTIDAD NO ES IDENTIDAD. Con nombre pero sin escudo el paso sigue
   * pendiente: el escudo sale en los recibos y en las papeletas, y una
   * hermandad con el escudo genérico en su papeleta de sitio no lo va a
   * repartir.
   */
  caso('con nombre pero sin escudo, sin hacer', false,
    m.pasosPuestaEnMarcha({ ...recienCreada, tieneNombre: true })[0].hecho)

  // Un concepto de cuota a 0 € no cuenta: no se puede emitir un recibo de nada.
  const conCuotas = m.pasosPuestaEnMarcha({ ...recienCreada, hayCuotas: true })
  caso('con cuota puesta, ese paso hecho', true, conCuotas.find((p) => p.id === 'cuotas').hecho)

  // --- Cuándo desaparece ---
  caso('sin terminar, el guion sigue', false, m.estaTodoHecho(pasos))
  caso('terminado, se va', true, m.estaTodoHecho(m.pasosPuestaEnMarcha(todoHecho)))
  /*
   * Se va cuando ya no hace falta, a propósito. Un guion de primeros pasos que
   * se queda ahí para siempre se convierte en parte del decorado, y entonces
   * ya no lo lee nadie el día que vuelve a hacer falta.
   */
  caso('con uno solo pendiente, todavía no', false,
    m.estaTodoHecho(m.pasosPuestaEnMarcha({ ...todoHecho, redesConectadas: 0 })))
  caso('y al terminarlo, cien por cien', 100, m.resumirPasos(m.pasosPuestaEnMarcha(todoHecho)).porcentaje)
  caso('sin siguiente paso', null, m.resumirPasos(m.pasosPuestaEnMarcha(todoHecho)).siguiente)

  await laPantallaLoEnsena({ caso })
}

/** Y que la pantalla lo use, y en el sitio bueno. */
async function laPantallaLoEnsena({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  const guia = sinComentarios(await readFile('src/components/GuiaPrimerosPasos.tsx', 'utf8'))
  const inicio = sinComentarios(await readFile('src/pages/app/DashboardHome.tsx', 'utf8'))

  caso('el guiado sale en Inicio', true, /<GuiaPrimerosPasos estado=\{estadoPuestaEnMarcha\} \/>/.test(inicio))
  /*
   * ANTES que las cifras. Una hermandad recién creada tiene todas las cifras a
   * cero: enseñar un panel de ceros y debajo el guion es enseñar primero el
   * problema y después la solución.
   */
  caso('y antes que el panel de cifras', true,
    inicio.indexOf('<GuiaPrimerosPasos') < inicio.indexOf('statsVisibles.length > 0'))

  // Se tacha solo: no hay nada que marcar a mano.
  caso('lo hecho se tacha', true, /guia__paso--hecho/.test(guia))
  caso('no hay casillas que marcar', false, /type="checkbox"/.test(guia))
  // El estado sale de los datos de verdad, no de una marca guardada.
  caso('el estado se calcula de los datos', true, /cargosEfectivos\(hermanos, personalGuia\)/.test(inicio))
  caso('el censo cuenta de verdad', true, /hermanos: hermanos\.length/.test(inicio))

  // Se puede apartar, pero vuelve al día siguiente: la puesta en marcha se
  // hace en varios días y entre medias se cierra la sesión.
  caso('se puede apartar', true, /Seguir luego/.test(guia))
  caso('pero no para siempre', true, /toDateString\(\)/.test(guia))
  // Y la clave sigue el prefijo de siempre.
  caso('la clave lleva el prefijo de la casa', true, /'cabildo-guia-apartada'/.test(guia))

  caso('se va solo al terminar', true, /estaTodoHecho\(pasos\)/.test(guia))
  caso('señala el paso que toca', true, /Empezar aquí/.test(guia))
}
