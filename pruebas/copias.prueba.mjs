/**
 * LA COPIA DE SEGURIDAD AUTOMÁTICA.
 *
 * El censo de una hermandad es EL dato que no se puede volver a escribir:
 * cuatrocientas fichas con su antigüedad, su cuota y su sitio en el cortejo no
 * se reconstruyen. O están, o se han perdido.
 *
 * Lo que se prueba aquí es la aritmética que decide cuándo hay copia y cuándo
 * hay que avisar. Si esa cuenta falla, falla en silencio: la hermandad cree que
 * está cubierta y se entera el día que necesita restaurar.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/copiaAutomatica.ts')

  /*
   * --- LA FECHA VA EN EL NOMBRE ---
   *
   * De ahí se saca cuándo fue la última, y no de una marca guardada aparte: una
   * marca en el navegador diría «ya está hecha» en el ordenador de la
   * secretaria y «nunca» en el del tesorero; y una en una tabla puede quedarse
   * diciendo que hay copia cuando el archivo no llegó a subir. Lo que hay en el
   * cubo es la única verdad.
   */
  const f = m.fechaDelNombre('2026-08-23T10-15-00-000Z.json')
  caso('la fecha se lee del nombre', 2026, f.getUTCFullYear())
  caso('con su mes', 8, f.getUTCMonth() + 1)
  caso('y su día', 23, f.getUTCDate())
  caso('y su hora', 10, f.getUTCHours())
  // Un archivo que alguien haya subido a mano con otro nombre no se cuenta como
  // copia: mejor no tenerla en cuenta que darla por buena y no saber de cuándo es.
  caso('un nombre cualquiera no cuenta', null, m.fechaDelNombre('copia-vieja.json'))
  caso('ni uno vacío', null, m.fechaDelNombre(''))

  // --- Los días que han pasado ---
  const ahora = new Date('2026-08-23T12:00:00Z')
  caso('hoy son cero días', 0, m.diasDesde(new Date('2026-08-23T09:00:00Z'), ahora))
  caso('ayer, uno', 1, m.diasDesde(new Date('2026-08-22T09:00:00Z'), ahora))
  caso('hace una semana, siete', 7, m.diasDesde(new Date('2026-08-16T12:00:00Z'), ahora))
  caso('hace un mes, treinta y uno', 31, m.diasDesde(new Date('2026-07-23T12:00:00Z'), ahora))

  /*
   * --- LOS DOS NÚMEROS QUE MANDAN ---
   *
   * Una semana entre copias, y aviso al mes. El aviso NO es a la semana a
   * propósito: que una semana no haya entrado nadie en el panel es normal en
   * agosto, y un aviso que salta cuando no pasa nada malo se aprende a ignorar
   * — y entonces ya no avisa el día que sí.
   */
  caso('se hace una copia por semana', 7, m.DIAS_ENTRE_COPIAS)
  caso('y se avisa al mes', 31, m.DIAS_PARA_AVISAR)
  /*
   * Y se guardan ocho, no una. Es lo que hace falta para el caso de verdad:
   * alguien borra algo por error y se descubre tres o cuatro semanas después,
   * al ir a buscarlo. Con solo la última, la copia buena ya se habría
   * machacado con el error dentro.
   */
  caso('se guardan ocho semanas', 8, m.COPIAS_QUE_SE_GUARDAN)
  caso('que es más de un mes de margen', true, m.COPIAS_QUE_SE_GUARDAN * m.DIAS_ENTRE_COPIAS > m.DIAS_PARA_AVISAR)

  /*
   * --- SIN SUPABASE NO SE INVENTA NADA ---
   *
   * `seSabe` en falso NO es «no hay copias»: es «no se ha podido preguntar».
   * Confundir las dos cosas haría saltar el aviso rojo en modo demostración, y
   * un aviso que sale cuando no toca deja de leerse.
   */
  const estado = await m.estadoDeLasCopias()
  caso('sin base de datos, no se sabe', false, estado.seSabe)
  caso('y por eso NO se avisa', false, estado.hayQueAvisar)
  caso('ni se inventa una última', null, estado.ultima)
  caso('la copia semanal no se lanza', false, await m.copiaSemanalSiTocaba())
  caso('y la lista sale vacía', 0, (await m.copiasGuardadas()).length)
}
