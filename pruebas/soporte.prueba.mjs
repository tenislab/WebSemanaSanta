/**
 * QUE EL ACCESO DE SOPORTE NO ABRA UNA PUERTA QUE NO SE VEA.
 *
 * `soporte.sql` REDEFINE `hermandad_actual()`, que es la frontera entre
 * hermandades: la usan las políticas de RLS de todas las tablas. Un fallo ahí
 * no da error — enseña el censo de otra hermandad.
 *
 * Así que se comprueba lo único que se puede comprobar sin una base delante: la
 * FORMA. Que los tres caminos de siempre sigan enteros y en su orden, que el
 * cuarto vaya el último, y que la tabla que decide quién es soporte no se pueda
 * ni leer ni escribir desde la aplicación.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile('supabase/soporte.sql', 'utf8')
  const multi = await readFile('supabase/multi-hermandad.sql', 'utf8')

  const definicion = (texto) =>
    (texto.match(/create or replace function hermandad_actual\(\)[\s\S]*?\$\$;/) ?? [''])[0]

  const original = definicion(multi)
  const nueva = definicion(sql)
  caso('las dos definiciones existen', true, !!original && !!nueva)

  /*
   * --- LOS TRES CAMINOS DE SIEMPRE, ENTEROS Y EN EL MISMO ORDEN ---
   *
   * Se sacan de la definición ORIGINAL y se buscan en la nueva, en vez de
   * escribirlos aquí a mano: escritos a mano, esta prueba compararía la nueva
   * con lo que yo creía que decía la vieja, que es exactamente el error que
   * intenta cazar.
   */
  const caminos = [...original.matchAll(/\(select \w+\.hermandad_id from (\w+)/g)].map((m) => m[1])
  caso('el original tiene tres caminos', ['titulares', 'personal', 'hermanos'], caminos)

  const caminosNuevos = [...nueva.matchAll(/\(select \w+\.hermandad_id from (\w+)/g)].map((m) => m[1])
  caso('la nueva conserva los tres, en orden, y añade uno al final',
    ['titulares', 'personal', 'hermanos', 'soporte_sesion'], caminosNuevos)

  /*
   * QUE EL CUARTO VAYA EL ÚLTIMO NO ES ESTÉTICA. Son dos cosas:
   *
   *   · `coalesce` evalúa perezoso, así que para el 100 % de las personas
   *     reales esta función sigue costando lo que costaba: la consulta a
   *     `soporte_sesion` ni se mira.
   *   · Y si una cuenta de soporte fuera además hermana de alguna hermandad,
   *     mandaría SU hermandad. Nadie debe poder salirse de su propia casa por
   *     tener una llave maestra.
   */
  caso('el camino de soporte va el último', 3, caminosNuevos.indexOf('soporte_sesion'))

  /*
   * Y CADUCA. Una entrada de soporte que se queda abierta un viernes no puede
   * ser acceso permanente al censo de una hermandad.
   */
  caso('la suplantación caduca sola', true, /s\.hasta > now\(\)/.test(nueva))
  caso('y dura dos horas', true, /now\(\) \+ interval '2 hours'/.test(sql))

  // --- LAS DOS TABLAS NO SE PUEDEN NI LEER DESDE LA APLICACIÓN ---
  /*
   * Que no se pueda LEER importa tanto como que no se pueda escribir: una lista
   * legible de «qué cuentas pueden entrar en cualquier hermandad» es justo el
   * objetivo que se le pone a quien quiera entrar.
   */
  for (const tabla of ['soporte_cuentas', 'soporte_sesion']) {
    caso(`${tabla} tiene RLS encendida`, true,
      new RegExp(`alter table ${tabla} enable row level security`).test(sql))
    caso(`y ninguna política: con RLS y sin política, Postgres deniega`, false,
      new RegExp(`create policy[^;]*on ${tabla}`).test(sql))
  }

  /*
   * --- NACE APAGADO ---
   *
   * `soporte_cuentas` empieza vacía y no hay ninguna pantalla para darse de
   * alta. Mientras nadie escriba una fila a mano en el SQL Editor,
   * `hermandad_actual()` se comporta exactamente como antes para todo el mundo.
   */
  /*
   * Sin las líneas de comentario: la cabecera del fichero ENSEÑA cómo darse de
   * alta —«insert into soporte_cuentas …»— y esa instrucción tiene que estar
   * ahí. Lo que no puede haber es una que se EJECUTE.
   */
  const sinComentarios = sql.split('\n').filter((l) => !/^\s*(--|\*|\/\*)/.test(l)).join('\n')
  caso('no se siembra ninguna cuenta de soporte', false, /insert into soporte_cuentas/i.test(sinComentarios))
  const src = await readFile('src/lib/soporte.ts', 'utf8')
  caso('y la aplicación no puede dar de alta a nadie', false, /soporte_cuentas/.test(src))

  // --- QUEDA ESCRITO EN EL REGISTRO DE ESA HERMANDAD ---
  /*
   * Ellos lo ven en su pantalla de actividad. Un acceso que el dueño de los
   * datos no puede ver no es soporte, es otra cosa.
   */
  caso('entrar deja constancia', true, /'soporte_entra'/.test(sql))
  caso('y salir también', true, /'soporte_sale'/.test(sql))
  caso('y se escribe antes de dejar entrar', true,
    sql.indexOf('insert into registro_actividad') < sql.indexOf('insert into soporte_sesion'))

  // --- Y SE VE EN PANTALLA, SIN PODER CERRARLO ---
  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('la aplicación avisa mientras se suplanta', true, /Estás dentro de «\{suplantando\}» como soporte/.test(shell))
  /*
   * La banda va la PRIMERA de todas: mientras se suplanta, la aplicación es
   * indistinguible de la propia, y lo que pasa —y pasa— es que se deja una
   * pestaña abierta y al día siguiente se toca algo creyendo que es la casa de
   * uno.
   */
  caso('y su aviso va antes que los demás', true,
    shell.indexOf('como soporte') < shell.indexOf('No se ha podido guardar en la base de datos'))
  // Sin botón de «entendido»: la única forma de que desaparezca es salir.
  caso('solo se quita saliendo de verdad', true, /Salir de esta hermandad/.test(shell))

  /*
   * --- Y LO ÚLTIMO: QUE NADIE REDEFINA `hermandad_actual()` DESPUÉS ---
   *
   * De todas las definiciones de una función manda la última que se ejecuta. Si
   * mañana una pieza posterior la redefine sin el cuarto camino, el soporte
   * deja de funcionar; y si la redefine SIN los tres primeros, se rompe la
   * frontera entre hermandades entera.
   *
   * (`sql-actualizar.prueba.mjs` ya vigila esto de forma general para la lista
   * de actualización; aquí se dice por su nombre, porque esta función concreta
   * es la que no puede fallar.)
   */
  const { PIEZAS } = await import('../scripts/generar-todo-en-uno.mjs')
  const orden = PIEZAS.map(([f]) => f)
  const despuesDeSoporte = orden.slice(orden.indexOf('soporte.sql') + 1)
  const culpables = []
  for (const f of despuesDeSoporte) {
    const t = await readFile(`supabase/${f}`, 'utf8')
    if (/create (or replace )?function\s+hermandad_actual\s*\(/i.test(t)) culpables.push(f)
  }
  caso('nadie vuelve a definir hermandad_actual después de soporte.sql', [], culpables)
}
