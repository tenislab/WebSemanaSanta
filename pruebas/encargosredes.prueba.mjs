/**
 * ENCARGAR UN POST Y QUE SE REPARTA SOLO.
 *
 * Lo que se pidió: el Hermano Mayor —o quien lleve redes— encarga un post, y
 * de ahí salen SOLAS las tareas que hacen falta (escribirlo, subirlo a
 * Facebook, subirlo a Instagram), cada una con su responsable, y cada
 * responsable la ve en su área sin entrar al panel.
 *
 * Aquí se fija la regla del reparto, que es lo único que se puede equivocar en
 * silencio: cuántas tareas salen, cuáles, y de quién es cada una.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/tareasRedes.ts')

  // Ids previsibles, para poder comprobar el agrupado sin depender del azar.
  let n = 0
  const id = () => `id-${(n += 1)}`

  {
    const t = m.tareasDeUnEncargo({
      titulo: 'Besamanos del sábado',
      texto: 'Este sábado a las 18:00.',
      redes: ['Facebook', 'Instagram'],
      quienCrea: 'h-vocal',
      quienPublica: { Facebook: 'h-community', Instagram: 'h-community' },
    }, id)

    caso('de un post para dos redes salen tres tareas', 3, t.length)
    // La de escribir es UNA sola y va primera: el post se escribe una vez y se
    // sube a las que sean. Una por red haría que la misma persona viera
    // «escribir el post» dos veces sin saber si son dos cosas o una.
    caso('la primera es escribirlo', 'crear', t[0].que)
    caso('y no es de ninguna red', undefined, t[0].red)
    caso('solo hay una de escribir', 1, t.filter((x) => x.que === 'crear').length)
    caso('y una por cada red', 2, t.filter((x) => x.que === 'publicar').length)

    // Cada una a su responsable.
    caso('escribe quien se dijo', 'h-vocal', t[0].hermanoId)
    caso('y sube quien se dijo', 'h-community', t[1].hermanoId)

    // Todas del mismo encargo, que es lo que las mantiene juntas en pantalla.
    caso('las tres comparten encargo', 1, new Set(t.map((x) => x.encargoId)).size)
    caso('y todas nacen pendientes', 3, t.filter((x) => x.estado === 'pendiente').length)

    // Lo que se lee en pantalla, sin que nadie lo escriba a mano.
    caso('la de escribir se lee sola', 'Escribir el post y preparar la foto', m.loQueHayQueHacer(t[0]))
    caso('y la de subir dice a dónde', 'Subirlo a Facebook', m.loQueHayQueHacer(t[1]))
  }

  /*
   * SIN REDES, LA DE ESCRIBIR SALE IGUAL. Hay encargos que son solo eso —el
   * texto para el boletín— y quedarse sin ninguna tarea sería tragarse el
   * encargo entero en silencio, que es la peor manera de fallar.
   */
  {
    const t = m.tareasDeUnEncargo({ titulo: 'Texto para el boletín', redes: [] }, id)
    caso('un encargo sin redes no se pierde', 1, t.length)
    caso('y es la de escribir', 'crear', t[0].que)
  }

  // Una red repetida no son dos tareas: dos idénticas para la misma persona se
  // leen como un fallo de la aplicación, no como dos cosas que hacer.
  {
    const t = m.tareasDeUnEncargo({ titulo: 'x', redes: ['Instagram', 'Instagram'] }, id)
    caso('una red repetida no duplica la tarea', 2, t.length)
  }

  // Se puede encargar sin repartir todavía: se prepara y se asigna después.
  {
    const t = m.tareasDeUnEncargo({ titulo: 'x', redes: ['X'] }, id)
    caso('sin responsable, la tarea queda sin repartir', undefined, t[0].hermanoId)
  }

  /*
   * LO QUE VE CADA UNO EN SU ÁREA: lo suyo y lo que le queda, nada más. Si se
   * colara lo de otro, un vocal vería el trabajo del community y no sabría si
   * le toca a él.
   */
  {
    const t = [
      ...m.tareasDeUnEncargo({ titulo: 'A', redes: ['Facebook'], quienCrea: 'h1', quienPublica: { Facebook: 'h2' } }, id),
      ...m.tareasDeUnEncargo({ titulo: 'B', redes: [], quienCrea: 'h1' }, id),
    ]
    caso('cada uno ve solo lo suyo', 2, m.misTareasPendientes(t, 'h1').length)
    caso('y el otro, lo suyo', 1, m.misTareasPendientes(t, 'h2').length)
    caso('quien no tiene nada, no ve nada', 0, m.misTareasPendientes(t, 'h9').length)
    // Sin sesión de hermano no se enseña nada, en vez de enseñarlo todo.
    caso('sin hermano no se enseña nada', 0, m.misTareasPendientes(t, undefined).length)

    // Lo hecho deja de estorbar.
    const laDeA = m.misTareasPendientes(t, 'h1')[0]
    const hecha = t.map((x) => (x.id === laDeA.id ? { ...x, estado: 'hecha' } : x))
    caso('lo hecho ya no sale en lo pendiente', 1, m.misTareasPendientes(hecha, 'h1').length)

    // Y el panel los ve agrupados por encargo, con su marcador.
    const grupos = m.porEncargo(t)
    caso('el panel los agrupa por encargo', 2, grupos.length)
    caso('con las tareas de cada uno', 2, grupos.find((g) => g.titulo === 'A').tareas.length)
    caso('y dice cómo va', '0 de 2', (() => {
      const v = m.comoVa(grupos.find((g) => g.titulo === 'A').tareas)
      return `${v.hechas} de ${v.total}`
    })())
  }
}
