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

  await avisos({ caso })
  await sinEspejoEnElPortal({ caso })
}

/**
 * Y LA OTRA MITAD DEL ENCARGO: QUE SE ENTEREN.
 *
 * Repartir la tarea y no avisar a nadie no es repartir: es dejarla escrita en
 * una pantalla donde el responsable no va a entrar. Lo que se pidió fue que
 * «les salte lo que tienen que hacer», y eso son dos cosas distintas que se
 * pueden romper por separado —el aviso del área y el correo—, ninguna de las
 * dos con pantalla que lo delate si desaparece.
 *
 * Se mira el código porque esto no es una función que se pueda llamar: vive
 * dentro del formulario. Una prueba de la fuente es fea, pero una prueba fea
 * de algo que falla en silencio vale más que ninguna.
 */
async function avisos({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/pages/app/Comunicados.tsx', 'utf8')
  const crear = src.slice(src.indexOf('function crearEncargo'), src.indexOf('const rolesDisponibles'))
  caso('el encargo existe todavía', true, crear.length > 200)

  caso('al repartir se deja el aviso en su área', true, /agregarAvisoHermano\(/.test(crear))
  caso('y se le escribe además', true, /avisarPorCorreo\(/.test(crear))
  caso('con su tipo propio, que él puede apagar', true, /'encargo'/.test(crear))
  // Un aviso POR PERSONA: a quien le tocan las tres redes le llegarían tres
  // correos idénticos seguidos, y eso se lee como un fallo, no como tres
  // encargos.
  caso('agrupado por persona, no por tarea', true, /porPersona/.test(crear))
  // El correo no se espera: el encargo ya está guardado y un correo que tarda
  // no puede dejar el formulario colgado.
  caso('el correo no bloquea el guardado', true, /void avisarPorCorreo/.test(crear))

  // Y que las dos funciones estén de verdad traídas: sin esto compila mal, pero
  // la lección de hoy es que «lo escribí» y «está enchufado» no son lo mismo.
  caso('el aviso está importado', true, /import \{[^}]*agregarAvisoHermano/s.test(src))
  caso('y el correo también', true, /import \{[^}]*avisarPorCorreo/s.test(src))

  /*
   * EL TIPO NUEVO TIENE QUE ESTAR EN LOS TRES SITIOS.
   *
   * Si falta en `TIPOS_AVISO`, el hermano no tiene forma de apagarlo y en el
   * buzón le sale un sobre genérico. Si falta en `INTERRUPTOR`, el correo se
   * cae al mandarlo. Ninguna de las dos da la cara al probar a mano.
   */
  const avisosH = await readFile('src/lib/avisosHermano.ts', 'utf8')
  const correo = await readFile('src/lib/avisosCorreo.ts', 'utf8')
  caso('«encargo» es un tipo de aviso', true, /TipoAviso =[^\n]*'encargo'/.test(avisosH))
  caso('con su interruptor en el área del hermano', true, /id: 'encargo'/.test(avisosH))
  caso('y su interruptor de la hermandad', true, /encargo: '(comunicados|cuotas|papeletas|ficha)'/.test(correo))
}

/**
 * EL ESPEJO DEL ÁREA DEL HERMANO.
 *
 * Todas las tablas del portal se montan con `sinEspejo`, y no es un detalle:
 * el hermano y el panel comparten la misma clave del navegador y ven filas
 * distintas (RLS). Sin `sinEspejo`, la vista recortada del hermano pisa la
 * lista completa de la secretaria por el aviso de `storage` — con el panel
 * abierto en otra pestaña, sus cuatrocientos hermanos se convierten en uno.
 *
 * Ya pasó una vez. Se comprueba de golpe para que la tabla que se añada
 * mañana no lo repita: se mira que NINGÚN hook de tabla se monte sin él.
 */
async function sinEspejoEnElPortal({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  /*
   * La lista de hooks a vigilar NO se escribe a mano: se saca de quién usa
   * `useSupabaseTable`, que es exactamente donde está el peligro. Un hook con
   * su propia clave y de solo lectura —`useTramos`, por ejemplo, que enseña
   * los mismos tramos al hermano y al panel— no pisa nada de nadie.
   *
   * Sacándolo así, la tabla que se añada mañana entra sola en la prueba.
   */
  const { readdir } = await import('node:fs/promises')
  const conEspejo = new Set()
  for (const f of await readdir('src/lib')) {
    if (!f.endsWith('.ts')) continue
    const t = await readFile(`src/lib/${f}`, 'utf8')
    for (const m of t.matchAll(/export function (use[A-Z]\w+)\([^)]*\)[^{]*\{([\s\S]{0,900}?)\n\}/g)) {
      if (m[2].includes('useSupabaseTable')) conEspejo.add(m[1])
    }
  }
  caso('se encuentran los hooks de tabla', true, conEspejo.size >= 3)

  const desnudos = [...conEspejo].filter((n) => new RegExp(`${n}\\(\\s*\\)`).test(src))
  caso('ninguna tabla del portal se monta sin espejo', '', desnudos.sort().join(', '))
  // Y las dos de hoy, por su nombre, que son las que se olvidaron.
  caso('los mandatos SEPA, con espejo', true, /useMandatosSepa\(sinEspejo\)/.test(src))
  caso('los encargos de redes, con espejo', true, /useTareasRedes\(sinEspejo\)/.test(src))
}
