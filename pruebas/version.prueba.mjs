/**
 * QUE EL NÚMERO DE VERSIÓN DEL ESQUEMA NO SE QUEDE ATRÁS.
 *
 * Toda la utilidad del aviso «tu base de datos va por detrás» depende de UN
 * número, y ese número hay que subirlo al añadir una pieza .sql. Un número que
 * hay que acordarse de subir es un número que se olvida, y el día que se olvida
 * el aviso deja de salir JUSTO CUANDO HACÍA FALTA: la pieza nueva es la que la
 * hermandad no tiene.
 *
 * Así que no se confía en acordarse. Esto lo compara y, si no cuadra, dice el
 * número exacto que hay que poner.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const { PIEZAS } = await import('../scripts/generar-todo-en-uno.mjs')
  const { PIEZAS_ACTUALIZACION } = await import('../scripts/generar-actualizar.mjs')
  const m = await cargar('src/lib/versionEsquema.ts')

  // --- EL NÚMERO ---
  caso('la versión de la aplicación es el número de piezas del instalador',
    PIEZAS.length, m.VERSION_ESQUEMA)
  if (PIEZAS.length !== m.VERSION_ESQUEMA) {
    console.log(`    → pon VERSION_ESQUEMA = ${PIEZAS.length} en src/lib/versionEsquema.ts`)
  }

  const enUno = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  const actualizar = await readFile('supabase/ACTUALIZAR.sql', 'utf8')

  caso('el instalador sella esa misma versión', true,
    enUno.includes(`select sellar_esquema(${PIEZAS.length});`))

  /*
   * Y LA ACTUALIZACIÓN SELLA EL NÚMERO DEL INSTALADOR, no el de su propia
   * lista.
   *
   * Es el error fácil y sale caro: una base que acaba de pasar por
   * `ACTUALIZAR.sql` queda igual de completa que una recién instalada, así que
   * tiene que decir el mismo número. Sellando con las piezas de la
   * actualización, la aplicación avisaría PARA SIEMPRE de que la base va
   * atrasada — justo después de actualizarla. Una alarma que salta cuando todo
   * está bien se ignora también los días que tiene razón.
   */
  caso('y la actualización sella el mismo, no el de su lista', true,
    actualizar.includes(`select sellar_esquema(${PIEZAS.length});`))
  caso('que no es el número de piezas de la actualización', true,
    PIEZAS_ACTUALIZACION.length !== PIEZAS.length)

  /*
   * EL SELLO VA AL FINAL, cuando ya han pasado todas las piezas. Sellar antes
   * sería prometer que está puesto algo que igual no llegó a ejecutarse: la
   * base diría que va al día y le faltarían columnas.
   */
  const posicionSello = enUno.indexOf('select sellar_esquema(')
  const posicionUltimaPieza = enUno.lastIndexOf('VERSION-DEL-ESQUEMA.SQL')
  caso('el sello va después de la última pieza', true, posicionSello > posicionUltimaPieza)

  // --- EL AVISO, QUE ES LO ÚNICO QUE VA A LEER QUIEN TENGA EL PROBLEMA ---
  caso('con la base al día no se dice nada', null,
    m.avisoDelEsquema({ estado: 'al_dia', enLaBase: PIEZAS.length }))
  caso('y si no se sabe, tampoco', null, m.avisoDelEsquema({ estado: 'sin_saber' }))

  const atrasada = m.avisoDelEsquema({ estado: 'atrasada', enLaBase: 40, cuantas: 3 })
  caso('con la base atrasada se dice cuántas le faltan', true, atrasada.texto.includes('3 actualizaciones'))
  // Lo que hace útil el aviso NO es decir que hay un problema: es decir qué hacer.
  caso('y se dice qué hay que pegar', true, atrasada.texto.includes('ACTUALIZAR.sql'))
  caso('y dónde', true, atrasada.texto.includes('SQL Editor'))
  /*
   * Y SE DICE QUÉ PASA MIENTRAS TANTO. Sin esta frase, el aviso parece una
   * recomendación de mantenimiento y se pospone. Con ella se entiende que hay
   * datos perdiéndose ahora mismo.
   */
  caso('y qué pasa mientras tanto', true, atrasada.texto.includes('sin haber guardado'))
  caso('una sola actualización se dice en singular', true,
    m.avisoDelEsquema({ estado: 'atrasada', enLaBase: 61, cuantas: 1 }).texto.includes('1 actualización.'))

  /*
   * LA BASE SIN SELLAR es la de toda hermandad que se montó antes de que esto
   * existiera. No se le puede decir cuánto le falta —no hay con qué
   * compararlo— pero sí lo otro, que es la respuesta correcta igualmente.
   */
  const sinSellar = m.avisoDelEsquema({ estado: 'sin_sellar' })
  caso('una base sin sellar también avisa', true, !!sinSellar)
  caso('sin inventarse un número', false, /\d+ actualizacion/.test(sinSellar.texto))
  caso('y diciendo qué hacer igualmente', true, sinSellar.texto.includes('ACTUALIZAR.sql'))
}
