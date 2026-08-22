/**
 * EL HISTORIAL DE ASISTENCIA DE CADA HERMANO.
 *
 * Llegó dicho así: «si se da que no asiste que se guarde para el año siguiente
 * en el historial de asistencia de cada hermano, eso hay que crearlo».
 *
 * Y guardado ya estaba: el mapa se indexa por `año:hermano`, así que lo de
 * cada edición se queda donde estaba. Lo que no había era manera de verlo: la
 * asistencia se marca la madrugada del Viernes Santo y ahí moría. Al año
 * siguiente, repartiendo el cortejo, nadie sabía quién faltó ni por qué — que
 * es justo el dato que hace falta en ese momento.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/asistencia.ts')

  const mapa = {
    '2027:h1': { estado: 'asiste' },
    '2026:h1': { estado: 'no_asiste', motivo: 'Enfermedad' },
    '2025:h1': { estado: 'asiste' },
    '2024:h1': { estado: 'pendiente' },
    // De otro hermano, para comprobar que no se mezclan.
    '2027:h2': { estado: 'no_asiste', motivo: 'Trabajo' },
  }

  const h1 = m.historialDeAsistencia(mapa, 'h1')
  caso('salen sus cuatro años', 4, h1.length)
  caso('y ninguno de otro hermano', 0, h1.filter((a) => a.motivo === 'Trabajo').length)
  // De más reciente a más antiguo: al abrir la ficha lo que se mira es el año
  // pasado, no el de hace cinco.
  caso('el más reciente primero', 2027, h1[0].anio)
  caso('y el más antiguo al final', 2024, h1[3].anio)
  caso('el motivo de la falta se conserva', 'Enfermedad', h1[1].motivo)

  /*
   * Los años que no constan NO se rellenan. Un año sin dato no es un año en el
   * que estuviera pendiente: es un año del que no se sabe nada —quizá ni era
   * hermano todavía—. Rellenarlo llenaría la ficha de filas falsas.
   */
  caso('no se inventan los años que faltan', true, h1.every((a) => a.anio >= 2024))
  caso('de un hermano sin nada, historial vacío', 0, m.historialDeAsistencia(mapa, 'h9').length)

  // --- El resumen ---
  const r = m.resumenDeAsistencia(h1)
  caso('cuenta las salidas', 2, r.salidas)
  caso('y las faltas', 1, r.faltas)
  /*
   * Lo PENDIENTE no cuenta ni a un lado ni a otro. Un año marcado «pendiente»
   * es un año que nadie llegó a cerrar; sumarlo a las faltas sería acusar al
   * hermano de un descuido de la secretaría.
   */
  caso('lo pendiente no cuenta como falta', 1, r.faltas)
  caso('ni como salida', 2, r.salidas)
  caso('se sabe cuándo fue la última falta', 2026, r.ultimaFalta.anio)
  caso('y de quien no ha faltado nunca, no hay última', null,
    m.resumenDeAsistencia(m.historialDeAsistencia(mapa, 'h9')).ultimaFalta)

  // --- Dicho en una frase, para ponerlo al lado del nombre ---
  const frase = m.asistenciaEnUnaFrase(h1)
  caso('se dice en una frase', true, /ha salido 2 veces/.test(frase))
  caso('con las faltas', true, /ha faltado 1 vez/.test(frase))
  caso('y cuándo fue la última', true, /la última, en 2026/.test(frase))

  /*
   * Y de quien no consta nada, NO se dice nada. Poner «0 salidas» junto al
   * nombre de alguien que lleva veinte años saliendo —y que entró antes de que
   * esto existiera— es peor que no poner nada: parece un dato y es una laguna.
   */
  caso('sin datos no se dice nada', '', m.asistenciaEnUnaFrase([]))
  caso('ni con solo un año pendiente', '',
    m.asistenciaEnUnaFrase([{ anio: 2027, estado: 'pendiente' }]))

  // Singular y plural bien dichos: «ha salido 1 vez», no «1 veces».
  caso('una sola salida va en singular', true,
    /ha salido 1 vez(?!es)/.test(m.asistenciaEnUnaFrase([{ anio: 2027, estado: 'asiste' }])))

  await laFichaLoEnsena({ caso })
}

/** Y que se vea donde se decide el cortejo: en la ficha del hermano. */
async function laFichaLoEnsena({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const f = (await readFile('src/pages/app/Hermanos.tsx', 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  caso('la ficha calcula el historial', true, /historialDeAsistencia\(getAsistencias\(\), selected\.id\)/.test(f))

  /*
   * Y LA SECCIÓN ESTÁ SIEMPRE. Estaba solo como una línea en la cabecera, que
   * desaparecía cuando no constaba nada —o sea, en casi todo el censo el
   * primer año—. Llegó dicho como «no hay el historial de participación del
   * hermano al meterse en el perfil», y era eso: una sección que a veces no
   * está no se puede consultar.
   */
  caso('hay una sección de participación', true, /className="ficha-asistencia"/.test(f))
  caso('con su título', true, /Participación en la estación de penitencia/.test(f))
  caso('y la lista año a año', true, /historialAsistencia\.map/.test(f))

  /*
   * Cuando no consta nada lo DICE, en vez de esconderse. «No consta ninguna
   * edición» es información distinta de «no ha salido nunca», y hay que
   * distinguirlas: casi todos los hermanos entraron antes de que esto
   * existiera.
   */
  caso('vacía, explica que todavía no consta nada', true, /Todavía no consta ninguna edición/.test(f))
  caso('y dice cómo se llena', true, /el día\s+de la salida, en Cortejo/.test(f))

  // Cada año con su estado en palabras, no con el valor interno.
  caso('los estados se dicen en cristiano', true, /'Salió'/.test(f) && /'No salió'/.test(f))
  caso('y lo no cerrado se distingue de una falta', true, /'Sin cerrar'/.test(f))
}
