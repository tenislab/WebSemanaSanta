/**
 * QUE EL DIAGNÓSTICO NO SE QUEDE ATRÁS SIN QUE NADIE LO NOTE.
 *
 * ============================================================================
 * LO QUE PASÓ, Y ES DE LIBRO
 * ============================================================================
 *
 * `DIAGNOSTICO.sql` es la consulta que se pega en Supabase cuando algo no se
 * guarda, para saber qué le falta a esa base. Se genera del código —de las
 * funciones `toRow`, que son las que de verdad escriben— precisamente para que
 * no se quede vieja.
 *
 * Y se quedó vieja igual. El generador LANZA a propósito cuando no sabe a qué
 * tabla escribe una función nueva («mejor romper que preguntar por una tabla
 * inventada»), y eso está bien. Lo que faltaba es que alguien lo ejecutara:
 * desde que se añadieron los mandatos SEPA, la tienda, las campañas, los
 * repartos, las tareas de redes y las solicitudes de papeleta, el script se
 * caía en la primera línea y NADIE SE ENTERÓ.
 *
 * Así que el diagnóstico llevaba meses diciendo «no falta nada» sin haber
 * mirado siete tablas. Un diagnóstico que se calla lo que no sabe mirar es
 * peor que no tenerlo: manda a buscar el problema a otra parte.
 *
 * Los dos instaladores ya tenían esta prueba. Este no. Ahora sí.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const correr = promisify(execFile)

  const antes = await readFile('supabase/DIAGNOSTICO.sql', 'utf8')

  /*
   * SE EJECUTA EL GENERADOR DE VERDAD, no se reimplementa aquí.
   *
   * Reimplementarlo sería comparar el fichero con MI copia de la lógica, y las
   * dos copias se separarían — que es exactamente el fallo que esto vigila, una
   * vuelta más arriba. Además, ejecutarlo es lo único que comprueba que el
   * script ARRANCA, que es lo que llevaba meses sin pasar.
   */
  let arranca = true
  let motivo = ''
  try {
    await correr('node', ['scripts/generar-diagnostico.mjs'])
  } catch (e) {
    arranca = false
    motivo = String(e.stderr ?? e.message).split('\n').find((l) => l.includes('Error:')) ?? String(e)
  }
  caso('el generador del diagnóstico arranca', true, arranca)
  if (!arranca) console.log(`    → ${motivo}`)

  const despues = await readFile('supabase/DIAGNOSTICO.sql', 'utf8')
  caso('DIAGNOSTICO.sql está al día', true, antes === despues)
  if (antes !== despues) console.log('    → ejecuta: node scripts/generar-diagnostico.mjs')

  /*
   * --- Y QUE MIRE LAS CINCO COSAS ---
   *
   * Las cinco fallan sin dar la cara, y cada una por un motivo distinto. Si
   * mañana alguien simplifica esta consulta y se lleva una por delante, el
   * diagnóstico seguiría diciendo «no falta nada» — con menos motivos que
   * antes para decirlo.
   */
  const comprobaciones = [
    ['las tablas', 'FALTA LA TABLA ENTERA'],
    ['las columnas', 'falta una columna'],
    ['las funciones', 'FALTA UNA FUNCIÓN'],
    ['los cubos de archivos', 'FALTA UN CUBO DE ARCHIVOS'],
    ['la seguridad por filas', 'TABLA SIN SEGURIDAD POR FILAS'],
    ['y la versión del esquema', 'TU BASE VA POR DETRÁS'],
  ]
  for (const [que, senal] of comprobaciones) {
    caso(`comprueba ${que}`, true, despues.includes(senal))
  }

  /*
   * --- LOS DOS DETALLES QUE LO HACEN USABLE ---
   */

  // 1. VA TODO EN UNA SOLA CONSULTA. El editor de Supabase enseña solo el
  //    resultado de la ÚLTIMA, así que con dos, un «no falta nada» podría estar
  //    tapando la lista de lo que sí falta.
  const sentencias = despues.split('\n').filter((l) => /^\s*(select|with|alter|create|drop)\b/i.test(l))
  caso('empieza por un solo «with»', 1, sentencias.filter((l) => /^with\b/i.test(l.trim())).length)
  caso('y acaba en un solo punto y coma', 1, (despues.match(/;\s*$/gm) ?? []).length)

  /*
   * 2. NO REVIENTA EN UNA BASE QUE NO SE HA ACTUALIZADO NUNCA.
   *
   * Es el caso en el que MÁS falta hace, y el más fácil de romper: nombrar
   * `esquema_gobergo` dentro de un `select` normal tumba la consulta ENTERA al
   * planificarla si esa tabla no existe — y entonces no saldría tampoco lo de
   * las columnas, que es a lo que venías.
   *
   * Por eso la versión se lee con `query_to_xml`, que se resuelve al ejecutar y
   * deja que el `case` se la salte. Es un truco, y por eso se vigila: si
   * alguien lo «simplifica» a un subselect normal, el diagnóstico deja de
   * funcionar justo en las bases más atrasadas.
   */
  caso('lee la versión sin tumbarse si la tabla no existe', true,
    /query_to_xml/.test(despues))
  caso('y sin nombrar la tabla en un select suelto', false,
    /\n\s*(from|join)\s+esquema_gobergo\b/i.test(despues))

  /*
   * --- QUE NO SE LE ESCAPE NINGUNA TABLA ---
   *
   * La forma de que este diagnóstico mienta no es equivocarse: es no mirar. Se
   * comprueba contra el instalador que las tablas vigiladas son casi todas las
   * que hay, para que el día que una se quede fuera se vea el número bajar.
   */
  const enUno = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  const todas = new Set([...enUno.matchAll(/create table if not exists (\w+)/g)].map((m) => m[1]))
  /*
   * Las tablas se vigilan por dos vías, y hay que contar las dos:
   *
   *   · `('tabla', 'columna')` — las que la aplicación escribe con un `toRow`,
   *     de las que se puede comprobar hasta la última columna.
   *   · `('tabla')` — las que usa por otros caminos (la tienda va por funciones
   *     del servidor, los catálogos se escriben a mano). De esas no hay
   *     columnas que comprobar, pero sí que existan y que tengan RLS.
   */
  /*
   * SE LEE CADA LISTA POR SU BLOQUE, no con una expresión suelta.
   *
   * Las cuatro listas del diagnóstico —columnas, funciones, cubos y tablas—
   * tienen la misma forma por dentro, `('algo')`, así que una expresión sin
   * acotar las mezcla y acaba comprobando que la función `mi_tutor` existe como
   * TABLA en el instalador. Es lo que me pasó escribiendo esto.
   */
  const bloque = (nombre) => {
    const m = despues.match(new RegExp(`${nombre} \\([^)]*\\) as \\(\\n  values\\n([\\s\\S]*?)\\n\\)`))
    return m ? m[1] : ''
  }
  const nombresDe = (texto) => [...texto.matchAll(/\('([a-z_0-9]+)'/g)].map((m) => m[1])

  const conColumnas = new Set(nombresDe(bloque('esperado')))
  const soloExistencia = new Set(nombresDe(bloque('tablas_usadas')))
  const funcionesVigiladas = nombresDe(bloque('funciones_esperadas'))
  const cubosVigilados = nombresDe(bloque('cubos_esperados'))
  const vigiladas = new Set([...conColumnas, ...soloExistencia])

  caso('se leen las cuatro listas por separado', true,
    conColumnas.size > 0 && soloExistencia.size > 0
    && funcionesVigiladas.length > 0 && cubosVigilados.length > 0)
  caso('se comprueban las columnas de las tablas principales', true, conColumnas.size >= 20)
  caso('y existen y están protegidas las demás', true, soloExistencia.size >= 10)
  caso('vigila muchas tablas (si baja, algo se ha quedado fuera)', true, vigiladas.size >= 35)
  /*
   * Y NINGUNA INVENTADA. Una tabla que el diagnóstico busca y que no existe en
   * el instalador saldría SIEMPRE como «falta», en todas las bases del mundo:
   * un falso positivo permanente que manda a buscar un problema que no hay.
   * Es exactamente lo que pasó con `proyectos`, y por eso está esta línea.
   */
  caso('y todas las que vigila existen de verdad en el instalador', [],
    [...vigiladas].filter((t) => !todas.has(t)))

  /*
   * Y LOS CUBOS Y LAS FUNCIONES, LO MISMO: que existan en el instalador. Si el
   * diagnóstico pregunta por una función que ya no se crea, dirá «falta» para
   * siempre y nadie volverá a hacerle caso.
   */
  caso('no pregunta por ninguna función que el instalador no cree', [],
    funcionesVigiladas.filter(
      (n) => !new RegExp(`create (or replace )?function\\s+${n}\\s*\\(`, 'i').test(enUno)))
  caso('ni por ningún cubo que no se cree', [],
    cubosVigilados.filter((n) => !new RegExp(`values \\('${n}', '${n}'`).test(enUno)))
}
