/**
 * LA OPERACIÓN MÁS DESTRUCTIVA DE LA APLICACIÓN.
 *
 * Restaurar una copia borra el censo entero de una hermandad para volver a
 * meterlo. Lo que se comprueba aquí no es que funcione —eso hace falta una base
 * de datos— sino que las CERRADURAS estén puestas y que las dos listas de
 * tablas no se separen.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ LAS DOS LISTAS SON EL PELIGRO
 * ----------------------------------------------------------------------------
 *
 * Hay dos listas de tablas escritas por separado: la que se COPIA
 * (`TABLAS_COPIA`, en `src/lib/backup.ts`) y la que se VACÍA (dentro de
 * `vaciar_hermandad_para_restaurar`, en SQL). Si se separan:
 *
 *   · Una tabla que se copia y NO se vacía se queda con las filas viejas
 *     MEZCLADAS con las de la copia. Sin ningún error: un censo con hermanos
 *     duplicados que nadie sabe de dónde salen.
 *   · Una que se vacía y NO se copia se pierde entera, en silencio.
 *
 * Las dos se rompen añadiendo una tabla nueva y tocando solo un fichero, que es
 * lo que va a pasar. Por eso esto está aquí.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile('supabase/restaurar-copia.sql', 'utf8')
  const backup = await readFile('src/lib/backup.ts', 'utf8')

  // --- LAS DOS LISTAS ---
  const listaDeLaCopia = (backup.match(/export const TABLAS_COPIA = \[([\s\S]*?)\] as const/) ?? [])[1] ?? ''
  const listaDelVaciado = (sql.match(/tablas text\[\] := array\[([\s\S]*?)\];/) ?? [])[1] ?? ''
  const nombres = (texto) => [...texto.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()

  const copiadas = nombres(listaDeLaCopia)
  const vaciadas = nombres(listaDelVaciado)

  caso('hay tablas que copiar (si no, esta prueba no vigila nada)', true, copiadas.length >= 15)
  caso('todo lo que se copia se vacía', [], copiadas.filter((t) => !vaciadas.includes(t)))
  caso('y todo lo que se vacía se copia', [], vaciadas.filter((t) => !copiadas.includes(t)))

  // --- LAS CUATRO CERRADURAS ---
  /* 1. Solo el titular. Ni el tesorero, ni el secretario, ni un hermano. */
  caso('solo el titular puede', true, /from titulares x\s*\n\s*where x\.auth_user_id = auth\.uid\(\)/.test(sql))
  /* 2. Hay que decir a quién: una llamada suelta no puede alcanzar nada. */
  caso('hay que confirmar a qué hermandad', true, /confirmacion is distinct from mia/.test(sql))
  /* 3. Y aunque el argumento viniera mal, el borrado va acotado igualmente. */
  caso('cada borrado va acotado a la hermandad', true,
    /delete from %I where hermandad_id = \$1/.test(sql))
  /* 4. La caja negra: se escribe ANTES de borrar, y en una tabla que no se vacía. */
  caso('queda escrito en el registro', true, /insert into registro_actividad/.test(sql))
  caso('y antes de borrar nada', true,
    sql.indexOf('insert into registro_actividad') < sql.indexOf('delete from %I'))
  caso('en una tabla que la restauración no se lleva por delante', false,
    vaciadas.includes('registro_actividad'))

  /*
   * `security invoker` Y NO `definer`. Es una decisión, no un descuido: así RLS
   * sigue aplicándose sobre quien llama, y quedan DOS cerraduras independientes
   * entre este `delete` y el censo de las demás hermandades. Con `definer` se
   * saltaría RLS y quedaría una sola.
   */
  caso('no se salta las políticas de la base', true,
    /vaciar_hermandad_para_restaurar[\s\S]{0,400}security invoker/.test(sql))

  // --- EL LADO DEL NAVEGADOR ---
  const r = await readFile('src/lib/restaurar.ts', 'utf8')
  /*
   * UNA COPIA CON FALLOS NO SE VUELCA NUNCA. `crearCopia` apunta en `fallos` lo
   * que no pudo traer; volcarla borraría el censo entero para meter una parte.
   * Es el escenario que convierte la red de seguridad en la causa de la pérdida.
   */
  caso('una copia incompleta no se vuelca', true, /copia\.fallos \?\? \[\]\)\.length > 0/.test(r))
  // Una copia hecha sin base de datos no trae tablas: no hay nada que volcar.
  caso('ni una copia sin tablas', true, /!tablas \|\| Object\.keys\(tablas\)\.length === 0/.test(r))
  /*
   * SE QUITA `hermandad_id` DE CADA FILA. El destino lo decide la base a partir
   * de quién está pidiendo, no el contenido de un archivo abierto de un disco
   * duro. Además, así una copia se puede volcar aunque la hermandad haya
   * rehecho su proyecto y su identificador sea otro.
   */
  caso('el archivo no decide en qué hermandad se escribe', true, /delete copia\.hermandad_id/.test(r))

  // --- Y LA PANTALLA GUARDA ANTES LO QUE HAY ---
  /*
   * ESTE ES EL PASO QUE NO SE PUEDE SALTAR. Restaurar es justo el momento en
   * que alguien puede haberse equivocado de archivo; sin esto no habría marcha
   * atrás de la marcha atrás.
   */
  const conf = await readFile('src/pages/app/Configuracion.tsx', 'utf8')
  caso('antes de volcar se descarga lo que hay ahora', true,
    /antes-de-restaurar-\$\{marca\}\.json/.test(conf))
  caso('y se descarga ANTES de volcar', true,
    conf.indexOf('antes-de-restaurar') < conf.indexOf('volcarCopiaEnLaBase(obj)'))

  // Y el botón ya no está apagado con base de datos conectada, que era lo honesto antes y ya no.
  const b = await cargar('src/lib/restaurar.ts')
  caso('sin base de datos no se vuelca nada', false, b.sePuedeVolcarEnLaBase())


  /*
   * ==========================================================================
   * QUE SE COMPRUEBE ANTES DE VACIAR, NO DESPUÉS
   * ==========================================================================
   *
   * El orden es: vaciar y luego llenar. Si las filas no encajan —una columna
   * que la copia trae y esta base todavía no tiene— eso se descubría DESPUÉS de
   * haber vaciado: las tablas vacías, los `insert` rechazados uno a uno, y la
   * hermandad con menos datos que antes de «restaurar».
   *
   * Y es EL caso, no uno raro: la base la actualiza cada hermandad a mano, así
   * que «aplicación nueva, base vieja» es el estado normal durante semanas.
   */
  const restaurar = await readFile('src/lib/restaurar.ts', 'utf8')

  caso('se comprueba si la copia encaja', true, /export async function loQueNoEncaja/.test(restaurar))
  /*
   * Y VA ANTES DEL VACIADO. Es lo único que importa de toda esta comprobación:
   * hecha después no serviría absolutamente de nada.
   */
  const posComprobar = restaurar.indexOf('const noEncaja = await loQueNoEncaja(copia)')
  const posVaciar = restaurar.indexOf("rpc('vaciar_hermandad_para_restaurar'")
  caso('la comprobación existe en el volcado', true, posComprobar > 0)
  caso('y va ANTES de vaciar', true, posComprobar < posVaciar)

  // Y se dice qué falta y qué hacer, no «error al restaurar».
  caso('se dice que no se ha tocado nada', true, /NO se ha tocado nada/.test(restaurar))
  caso('y qué hacer para arreglarlo', true, /ACTUALIZAR\.sql/.test(restaurar))
  caso('nombrando las columnas que faltan', true, /noEncaja\.slice\(0, 6\)/.test(restaurar))

  /*
   * SE MANDAN LOS NOMBRES, NO EL ARCHIVO. Mandar la copia entera para que el
   * servidor la probara sería mandar megas por la red — y es justamente por eso
   * por lo que esto no puede ser atómico de entrada.
   */
  caso('se mandan solo los nombres de las columnas', true, /Object\.keys\(primera/.test(restaurar))
  caso('y de una fila por tabla, no de todas', true, /const primera = \(filas as unknown\[\]\)\[0\]/.test(restaurar))
  /*
   * Y `hermandad_id` NO CUENTA: se quita antes de insertar (`filaLimpia`), así
   * que avisar de él sería avisar de algo que no se manda nunca. Un aviso falso
   * en la pantalla más delicada de la aplicación enseña a saltárselos todos.
   */
  caso('hermandad_id no cuenta, porque no se manda', true, /c !== 'hermandad_id'/.test(restaurar))

  /*
   * SI NO SE PUEDE PREGUNTAR, SE DEJA PASAR — y esto cuesta pensarlo.
   *
   * La comprobación existe para evitar una pérdida de datos, así que lo
   * instintivo es bloquear ante la duda. Pero una base que aún no tiene ESTA
   * función es exactamente una base atrasada: bloquear dejaría sin restaurar
   * justo a quien más lo necesita, y sin ninguna otra manera de hacerlo.
   *
   * Lo que protege en ese caso es el paso 1, la copia de resguardo, que no es
   * opcional. Esto es un cinturón de más, no el único.
   */
  caso('si no se puede preguntar, no se bloquea', true,
    /if \(error \|\| !Array\.isArray\(data\)\) return \[\]/.test(restaurar))
}
