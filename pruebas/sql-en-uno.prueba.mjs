/**
 * Que `TODO-EN-UNO.sql` sea de verdad todo el SQL.
 *
 * EL PROBLEMA. Ese fichero es el que se pega de una vez en el editor de
 * Supabase, y estaba escrito a mano. Se quedó atrás sin que nadie lo notara:
 * los arreglos de seguridad de `multi-hermandad.sql` —cerrar
 * `adoptar_datos_sin_hermandad`, no meter a un titular en la hermandad de
 * otros— no estaban dentro. Quien montara su base con el pegote se llevaba la
 * versión con el agujero, y el fichero suelto, arreglado, no lo miraba nadie.
 *
 * Ahora se genera, y esto comprueba que está al día.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const { generar, PIEZAS } = await import('../scripts/generar-todo-en-uno.mjs')

  const enDisco = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  const recienHecho = await generar()
  caso('TODO-EN-UNO.sql está al día', true, enDisco === recienHecho)
  if (enDisco !== recienHecho) {
    console.log('    → ejecuta: node scripts/generar-todo-en-uno.mjs')
  }

  // El orden no es un detalle: `multi-hermandad.sql` crea la columna
  // `hermandad_id`, y todo lo que va detrás la usa. Al revés, no arranca.
  const nombres = PIEZAS.map(([f]) => f)
  const multi = nombres.indexOf('multi-hermandad.sql')
  caso('multi-hermandad va antes de lo que lo necesita', true,
    multi < nombres.indexOf('remesas.sql') &&
    multi < nombres.indexOf('registro-actividad.sql') &&
    multi < nombres.indexOf('apuntes-automaticos.sql') &&
    multi < nombres.indexOf('acceso-hermano.sql'))
  // Y después de las tablas, que es lo que separa.
  caso('y después de crear las tablas', true, nombres.indexOf('schema.sql') < multi)

  // Que no se quede ningún fichero fuera por olvido. Los de prueba, los de
  // datos de ejemplo y los de reparación puntual no entran a propósito.
  const { readdir } = await import('node:fs/promises')
  const FUERA = new Set([
    'TODO-EN-UNO.sql',
    /*
     * `ACTUALIZAR.sql` tampoco: es un subconjunto generado de este mismo, con
     * lo que le falta a una base que ya funciona. Lo comprueba
     * `sql-actualizar.prueba.mjs`, que además exige que solo lleve piezas que
     * nadie redefina después — ejecutar una pieza vieja suelta retira arreglos
     * posteriores sin dar ningún error.
     */
    'ACTUALIZAR.sql',
    'PRUEBA-AISLAMIENTO.sql', 'PRUEBA-MUDANZA.sql', 'BORRAR-PRUEBAS.sql',
    'DATOS-DE-PRUEBA.sql', 'seed-hermanos-prueba.sql', 'seed-usuarios-ejemplo.sql',
    'reset-antes-de-actualizar.sql', 'migracion-2026-08.sql',
    // Este solo MIRA: dice qué le falta a una base de datos de verdad y no
    // cambia nada. Meterlo en el de instalar no tendría sentido.
    'DIAGNOSTICO.sql',
    /*
     * Y este tampoco: responde «por qué MI cuenta no puede hacer esto» para un
     * correo concreto. Es una consulta con un parámetro que hay que rellenar a
     * mano, así que en el instalador no pintaría nada — y además no cambia
     * nada, solo mira.
     */
    'POR-QUE-NO-PUEDO.sql',
    // Un trozo de `seguridad-claves-y-registro.sql`, suelto, para quien
    // necesita salir del paso sin ejecutar el fichero entero. Meterlo en el de
    // instalar definiría la misma función dos veces.
    'ARREGLO-RAPIDO-DISPARADOR.sql',
    /*
     * Y las tareas programadas, tampoco. No porque no hagan falta, sino porque
     * ANTES hay que encender la extensión `pg_cron` desde el panel de Supabase
     * —Database → Extensions— y eso no se puede hacer desde un SQL pegado.
     *
     * Metido en el instalador, el fichero entero fallaría en la primera línea
     * de quien no la haya encendido, y con él todo lo que viene detrás. Va
     * aparte y con sus instrucciones dentro.
     */
    'tareas-programadas.sql',
  ])
  const todos = (await readdir('supabase')).filter((f) => f.endsWith('.sql') && !FUERA.has(f))
  const olvidados = todos.filter((f) => !nombres.includes(f))
  caso('no se queda ningún .sql fuera', '', olvidados.join(', '))

  /**
   * PODER EJECUTARLO DOS VECES, que es la promesa que hace la cabecera.
   *
   * `schema.sql` creaba `hermanos_numero_activo_uniq` sobre (numero) a secas,
   * de cuando había UNA hermandad. `multi-hermandad.sql` lo borra después y
   * pone el bueno, (hermandad_id, numero). Pero al volver a ejecutar el
   * fichero entero, `schema.sql` se encontraba con que ese nombre ya no existe
   * —lo borró multi-hermandad— e intentaba crearlo otra vez... con dos
   * hermandades dentro, cada una con su nº 1:
   *
   *     ERROR: could not create unique index "hermanos_numero_activo_uniq"
   *     DETAIL: Key (numero)=(1) is duplicated.
   *
   * Y el «is duplicated» era lo NORMAL, no un dato corrupto.
   */
  caso('el índice de un solo hermandad va protegido', true,
    /if not exists \(\s*select 1 from information_schema\.columns[\s\S]*?column_name = 'hermandad_id'\s*\) then\s*create unique index if not exists hermanos_numero_activo_uniq/.test(enDisco))
  // Y que exista el bueno, el de por hermandad.
  caso('y existe el índice por hermandad', true,
    /create unique index if not exists hermanos_numero_por_hermandad\s*\n\s*on hermanos \(hermandad_id, numero\)/.test(enDisco))

  // Y lo que de verdad importa: que los arreglos de seguridad estén DENTRO.
  caso('lleva el cierre de adoptar_datos_sin_hermandad', true,
    /revoke execute on function adoptar_datos_sin_hermandad\(uuid\) from anon, authenticated;/.test(enDisco))
  caso('lleva el tope del acceso por DNI', true, /if v_recientes >= 25 then/.test(enDisco))
  caso('lleva la columna del rastro de remesas', true, /add column if not exists remesada_el/.test(enDisco))

  await elDiagnosticoDiceLaVerdad({ caso })
}

/**
 * QUE EL DIAGNÓSTICO DIGA LA VERDAD.
 *
 * `POR-QUE-NO-PUEDO.sql` contesta «¿por qué la base me rechaza al crear un
 * hermano?». Para contestarlo tiene que reproducir la condición de la política
 * —`auth_es_hermano()`— sobre cada cuenta, porque esa función solo se puede
 * evaluar sobre la sesión que la llama.
 *
 * Y AHÍ ESTÁ EL PELIGRO: son dos copias de la misma regla en dos sitios. La
 * función se ha redefinido TRES veces (hermano-auth → hermano-y-gestion →
 * hermano-con-cargo) y el diagnóstico se quedó con la primera. Miraba la marca
 * `user_metadata.tipo`, que hoy la función no mira para nada.
 *
 * Resultado: a un Hermano Mayor —que tiene ficha como cualquiera— le decía
 * «⛔ NO, la sesión figura como de hermano» cuando la base le deja hacerlo
 * todo. Y lo mandaba a arreglar lo que no estaba roto, que es peor que no
 * tener diagnóstico.
 *
 * Esto no puede comprobar que las dos reglas sean equivalentes —haría falta
 * una base de datos— pero sí que el diagnóstico mire LAS MISMAS TRES COSAS que
 * la función, y que no haya vuelto a la marca vieja.
 */
async function elDiagnosticoDiceLaVerdad({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const diag = await readFile('supabase/POR-QUE-NO-PUEDO.sql', 'utf8')
  // Sin comentarios: el fichero EXPLICA el fallo por escrito, y explicarlo no
  // puede contar como cometerlo.
  const sql = diag.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')

  // La marca vieja ya no decide nada.
  caso('el veredicto ya no sale de user_metadata', false, /raw_user_meta_data[\s\S]{0,80}as solo_hermano/.test(sql))
  caso('ni compara el tipo para decidir', false, /when tipo = 'hermano'/.test(sql))

  // Y mira las tres formas de gestionar, las mismas que la función.
  caso('mira si es titular', true, /from titulares/.test(sql))
  caso('mira si es personal activo', true, /from personal[\s\S]{0,60}activo/.test(sql))
  caso('mira el cargo de su propia ficha', true, /cargo <> 'Hermano de a pie'/.test(sql))
  caso('y exige tener ficha en el censo', true, /tiene_ficha\s*\n?\s*and not/.test(sql))

  // El veredicto sale de ahí y no de otro sitio.
  caso('el veredicto usa esa condición', true, /when solo_hermano/.test(sql))

  /*
   * Y NO CAMBIA NADA. Es lo que se le promete a quien lo ejecuta en la base de
   * datos de su hermandad, con su censo dentro: «esto solo mira». Un `update`
   * que se colara aquí sería lo peor que puede pasar en este fichero.
   */
  caso('el diagnóstico no escribe nada', false,
    /\b(insert|update|delete|drop|alter|truncate|grant|revoke)\b/i.test(sql))
}
