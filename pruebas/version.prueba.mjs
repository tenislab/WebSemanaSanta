/**
 * QUE LA VERSIÓN DEL ESQUEMA SUBA CUANDO TOCA, Y QUE NO SE QUEDE ATRÁS.
 *
 * Toda la utilidad del aviso «tu base de datos va por detrás» depende de UN
 * número. Antes era el número de piezas del instalador: subía solo al añadir
 * un fichero, pero NO al editar uno que ya existía — y las piezas se editan.
 * El día que se cerró ese agujero se vio morder: dos columnas nuevas en
 * `reglas_automaticas`, versión sin subir, y al guardar una regla la base
 * contestaba que la columna no existe. Nadie había sido avisado.
 *
 * Ahora la versión sale de `supabase/VERSION.json`, y sube uno cada vez que
 * cambia la HUELLA de las piezas (un hash de su contenido, en orden). Aquí se
 * comprueban las tres cosas que lo sostienen:
 *
 *   1. La regla del salto, EJECUTADA con datos (`versionQueToca`).
 *   2. Que la huella guardada es la de las piezas de hoy: si no, alguien ha
 *      tocado el SQL y no ha pasado el generador, y hay que decírselo.
 *   3. Que los tres sitios que usan el número —la aplicación, los dos
 *      instaladores y el diagnóstico— usan EL MISMO.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const { PIEZAS } = await import('../scripts/generar-todo-en-uno.mjs')
  const v = await import('../scripts/version-del-esquema.mjs')
  const m = await cargar('src/lib/versionEsquema.ts')

  /* --- 1. LA REGLA DEL SALTO, con datos --- */
  caso('con la misma huella, la versión no cambia', 69, v.versionQueToca({ version: 69, huella: 'a' }, 'a').version)
  caso('y se dice que no ha cambiado', false, v.versionQueToca({ version: 69, huella: 'a' }, 'a').cambia)
  caso('con otra huella, sube uno', 70, v.versionQueToca({ version: 69, huella: 'a' }, 'b').version)
  caso('y se dice que ha cambiado', true, v.versionQueToca({ version: 69, huella: 'a' }, 'b').cambia)
  caso('y se guarda la huella nueva', 'b', v.versionQueToca({ version: 69, huella: 'a' }, 'b').huella)
  // Nunca baja ni se rompe por un fichero raro: sin fichero se arranca de cero.
  caso('sin nada guardado, arranca en 1', 1, v.versionQueToca(null, 'x').version)
  caso('y un número imposible no lo tira abajo', 1, v.versionQueToca({ version: -7, huella: '' }, 'x').version)
  caso('ni un decimal lo convierte en decimal', 4, v.versionQueToca({ version: 3.9, huella: '' }, 'x').version)

  /*
   * --- 2. LA HUELLA GUARDADA ES LA DE HOY ---
   *
   * Es LA comprobación: si alguien edita una pieza y no pasa el generador, la
   * huella de las piezas ya no es la guardada, y esto lo dice por su nombre.
   * Sin esto, el punto ciego volvería por la puerta de atrás.
   */
  const guardada = await v.leerVersionGuardada()
  const deHoy = await v.huellaDeLasPiezas(PIEZAS)
  caso('la huella guardada es la de las piezas de hoy', deHoy, guardada.huella)
  if (deHoy !== guardada.huella) {
    console.log('    → has tocado el SQL: ejecuta node scripts/generar-todo-en-uno.mjs (y los otros dos generadores)')
  }
  caso('la versión guardada es un entero positivo', true,
    Number.isInteger(guardada.version) && guardada.version > 0)
  // Y la huella depende del contenido: dos listas distintas, dos huellas.
  caso('cambiar el orden de las piezas cambia la huella', false,
    (await v.huellaDeLasPiezas([...PIEZAS].reverse())) === deHoy)

  /* --- 3. EL MISMO NÚMERO EN LOS CUATRO SITIOS --- */
  caso('la aplicación lleva la versión guardada', guardada.version, m.VERSION_ESQUEMA)

  const enUno = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  const actualizar = await readFile('supabase/ACTUALIZAR.sql', 'utf8')
  const diagnostico = await readFile('supabase/DIAGNOSTICO.sql', 'utf8')
  caso('el instalador sella esa versión', true, enUno.includes(`select sellar_esquema(${guardada.version});`))
  /*
   * Y LA ACTUALIZACIÓN SELLA LA MISMA. Una base que acaba de pasar por
   * `ACTUALIZAR.sql` queda igual de completa que una recién instalada, así que
   * tiene que decir el mismo número; si dijera otro, la aplicación avisaría
   * PARA SIEMPRE de que la base va atrasada justo después de actualizarla.
   */
  caso('y la actualización sella la misma', true, actualizar.includes(`select sellar_esquema(${guardada.version});`))
  caso('y el diagnóstico exige la misma', true, diagnostico.includes(`debería ir por la ${guardada.version}`))

  /*
   * EL SELLO VA AL FINAL, cuando ya han pasado todas las piezas. Sellar antes
   * sería prometer que está puesto algo que igual no llegó a ejecutarse: la
   * base diría que va al día y le faltarían columnas.
   */
  const posicionSello = enUno.indexOf('select sellar_esquema(')
  const posicionUltimaPieza = enUno.lastIndexOf('VERSION-DEL-ESQUEMA.SQL')
  caso('el sello va después de la última pieza', true, posicionSello > posicionUltimaPieza)

  /* --- EL AVISO, QUE ES LO ÚNICO QUE VA A LEER QUIEN TENGA EL PROBLEMA --- */
  caso('con la base al día no se dice nada', null,
    m.avisoDelEsquema({ estado: 'al_dia', enLaBase: guardada.version }))
  caso('y si no se sabe, tampoco', null, m.avisoDelEsquema({ estado: 'sin_saber' }))

  const atrasada = m.avisoDelEsquema({ estado: 'atrasada', enLaBase: 62, necesita: 71 })
  /*
   * SE DICEN LOS DOS NÚMEROS Y NO SU DIFERENCIA. Antes decía «le faltan 9
   * actualizaciones» porque la versión contaba piezas; ahora cuenta cambios, y
   * «9 actualizaciones» sería una cifra que no significa nada.
   */
  caso('con la base atrasada se dicen las dos versiones', true,
    atrasada.texto.includes('va por la versión 62') && atrasada.texto.includes('necesita la 71'))
  caso('y no se inventa una cuenta de actualizaciones', false, /\d+ actualizaci/.test(atrasada.texto))
  // Lo que hace útil el aviso NO es decir que hay un problema: es decir qué hacer.
  caso('y se dice qué hay que pegar', true, atrasada.texto.includes('ACTUALIZAR.sql'))
  caso('y dónde', true, atrasada.texto.includes('SQL Editor'))
  /*
   * Y SE DICE QUÉ PASA MIENTRAS TANTO. Sin esta frase, el aviso parece una
   * recomendación de mantenimiento y se pospone. Con ella se entiende que hay
   * datos perdiéndose ahora mismo.
   */
  caso('y qué pasa mientras tanto', true, atrasada.texto.includes('sin haber guardado'))

  /*
   * LA BASE SIN SELLAR es la de toda hermandad que se montó antes de que esto
   * existiera. No se le puede decir por cuál va —no hay con qué compararlo—
   * pero sí lo otro, que es la respuesta correcta igualmente.
   */
  const sinSellar = m.avisoDelEsquema({ estado: 'sin_sellar' })
  caso('una base sin sellar también avisa', true, !!sinSellar)
  caso('sin inventarse un número', false, /versión \d+/.test(sinSellar.texto))
  caso('y diciendo qué hacer igualmente', true, sinSellar.texto.includes('ACTUALIZAR.sql'))
}
