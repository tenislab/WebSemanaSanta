/**
 * EL CONTADOR DE VISITAS.
 *
 * Lo que se prueba aquí es lo que decide si un número significa algo o no.
 * Un contador que cuenta mal no da error: da una cifra, y la hermandad toma
 * decisiones con ella —«la web no la ve nadie, la quitamos»— sin saber que el
 * número estaba inflado o corto.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/visitas.ts')

  /*
   * --- LA RUTA QUE SE GUARDA ---
   *
   * Se guarda la RUTA y nunca la dirección entera. Detrás de «?» va lo que
   * cualquiera puede pegar: el `?utm_...` de una campaña, el texto que alguien
   * buscó. Eso ya no es «qué página se vio», y además convierte la tabla del
   * panel en una lista de cientos de líneas distintas para la misma página.
   */
  caso('la portada es la barra', '/', m.rutaLimpia('/'))
  caso('lo de detrás de ? se cae', '/noticias', m.rutaLimpia('/noticias?utm_source=whatsapp'))
  caso('el ancla también', '/n/cabildo', m.rutaLimpia('/n/cabildo#comentarios'))
  caso('y los dos a la vez', '/n/cabildo', m.rutaLimpia('/n/cabildo?x=1#abajo'))
  // `/noticias` y `/noticias/` son la misma página: sin quitar la barra final
  // salían como dos líneas distintas, que es lo que hace ilegible la tabla.
  caso('la barra final no cuenta', '/noticias', m.rutaLimpia('/noticias/'))
  caso('pero la portada se queda en /', '/', m.rutaLimpia('/'))
  // Lo que no parece una ruta va a la portada, no se guarda tal cual.
  caso('lo que no empieza por barra va a la portada', '/', m.rutaLimpia('https://otro.sitio/x'))
  caso('lo vacío también', '/', m.rutaLimpia(''))

  /*
   * --- CUÁNTO HAN SUBIDO ---
   *
   * Un número suelto no dice nada: lo que se quiere saber es si suben o bajan,
   * sobre todo en Cuaresma.
   */
  caso('el doble es un +100%', 100, m.variacion(200, 100))
  caso('la mitad es un -50%', -50, m.variacion(50, 100))
  caso('igual es un 0%', 0, m.variacion(100, 100))
  /*
   * Y SIN NADA CON QUÉ COMPARAR, NULL. Es el caso de la web recién publicada, y
   * es el que más importa: dividir entre cero da infinito, y enseñarlo como
   * «+100%» sería inventarse una subida donde solo hay un principio.
   */
  caso('sin periodo anterior no se inventa nada', null, m.variacion(300, 0))
  caso('ni con los dos a cero', null, m.variacion(0, 0))

  /*
   * --- CÓMO SE LLAMA CADA PÁGINA ---
   *
   * `/n/cabildo-general` es una dirección; «Noticia: cabildo general» es lo
   * que la hermandad reconoce en una tabla.
   */
  caso('la portada tiene nombre', 'Portada', m.nombreDeRuta('/'))
  caso('la actualidad también', 'Actualidad', m.nombreDeRuta('/noticias'))
  caso('una noticia se dice que lo es', 'Noticia: cabildo general', m.nombreDeRuta('/n/cabildo-general'))
  caso('un titular también', 'Titular: ntro padre jesus', m.nombreDeRuta('/t/ntro-padre-jesus'))
  caso('y un culto', 'Culto: solemne quinario 2027', m.nombreDeRuta('/c/solemne-quinario-2027'))
  // Lo que no se reconoce se enseña tal cual: inventarse un nombre es peor que
  // no ponerlo.
  caso('lo que no se reconoce va tal cual', '/legal/aviso', m.nombreDeRuta('/legal/aviso'))

  /*
   * --- EL DÍA EN EL RÓTULO ---
   *
   * Se construye por partes y NO con `new Date('2026-03-14')`: esa forma la
   * interpreta el navegador como medianoche UTC, y al oeste de Greenwich el
   * rótulo sale con el día de antes.
   */
  caso('el día se lee corto', '14 mar', m.diaCorto('2026-03-14'))
  caso('y el uno de enero no se va al 31', '01 ene', m.diaCorto('2026-01-01'))
  caso('lo que no es una fecha no revienta', '', m.diaCorto('ayer'))
  caso('ni lo vacío', '', m.diaCorto(''))

  /*
   * --- SIN SUPABASE NO PASA NADA ---
   *
   * Es el modo demostración. Lo importante no es que no cuente: es que no
   * reviente la web de nadie por intentarlo. Un contador que rompe la página
   * es mucho peor que un contador que no cuenta.
   */
  caso('sin base de datos no hay resumen', false, (await m.resumenDeVisitas()).hayDatos)
  caso('y devuelve cero, no basura', 0, (await m.resumenDeVisitas()).total)
  caso('contar no lanza nada', undefined, await m.contarVisita('/'))
}
