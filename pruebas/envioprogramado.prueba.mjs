/**
 * QUE UN COMUNICADO PROGRAMADO SE MANDE, Y UNA SOLA VEZ.
 *
 * ============================================================================
 * EL FALLO QUE ESTO CIERRA
 * ============================================================================
 *
 * Un comunicado se podía marcar como «Programado», se le ponía fecha, se
 * guardaba y la pantalla lo contaba en su recuadro. Y no lo mandaba nadie,
 * nunca: no había una sola línea que leyera esas filas para enviarlas.
 *
 * De los fallos de media instalación que ha tenido esta aplicación, este es de
 * los que peor sientan: la hermandad programa la convocatoria del cabildo, la
 * ve en la lista como «Programado», y se queda tranquila.
 *
 * ----------------------------------------------------------------------------
 * LO QUE SE PRUEBA AQUÍ
 * ----------------------------------------------------------------------------
 *
 * El ORQUESTADOR entero —qué se manda, qué se cierra, qué se suelta y qué
 * NO se da por hecho— sin base de datos, sin navegador y sin mandar un solo
 * correo. En una función cuyo trabajo es escribir a ochocientas personas, esa
 * es la única forma de probarla de verdad.
 *
 * El candado contra dos personas que entran a la vez se prueba con Postgres de
 * verdad, en `basedatos.prueba.mjs`: dos navegadores no se pueden simular con
 * objetos, hace falta la base decidiendo.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const m = await cargar('src/lib/envioProgramado.ts')

  /** Un banco de pruebas: se le dice qué comunicados hay y qué pasa al mandarlos. */
  function banco({ cola = [], gente = ['a@x.es'], enviados = null, revienta = null } = {}) {
    const hechos = { reclamados: 0, enviados: [], cerrados: [], soltados: [] }
    const pendientes = [...cola]
    return {
      hechos,
      como: {
        reclamar: async () => {
          hechos.reclamados++
          return pendientes.shift() ?? null
        },
        destinatarios: async () => {
          if (revienta === 'destinatarios') throw new Error('No se sabe a quién iba dirigido.')
          return gente.map((e, i) => ({ email: e, nombre: `Persona ${i}`, numero: i + 1 }))
        },
        enviar: async (c, a) => {
          if (revienta === 'enviar') throw new Error('Reventó al mandar.')
          hechos.enviados.push({ id: c.id, cuantos: a.length })
          return enviados ?? { enviados: a.length }
        },
        cerrar: async (id, alcance) => { hechos.cerrados.push({ id, alcance }) },
        soltar: async (id, motivo) => { hechos.soltados.push({ id, motivo }) },
      },
    }
  }
  const uno = (id, extra = {}) => ({
    id, titulo: `Comunicado ${id}`, cuerpo: 'Texto', destinatarios: 'Todos los hermanos',
    intentos: 1, yaEnviados: 0, ...extra,
  })

  // --- EL CASO NORMAL ---
  {
    const b = banco({ cola: [uno('c1')], gente: ['a@x.es', 'b@x.es'] })
    const r = await m.mandarLosProgramados(b.como)
    caso('manda el que tocaba', 1, r.mandados)
    caso('a las personas que salen del segmento', 2, r.personas)
    caso('y lo cierra con su alcance real', [{ id: 'c1', alcance: 2 }], b.hechos.cerrados)
    caso('sin soltarlo como fallido', 0, b.hechos.soltados.length)
    // Y pregunta una vez más para ver si hay otro: así se mandan varios seguidos.
    caso('sigue preguntando hasta que no queda ninguno', 2, b.hechos.reclamados)
  }

  /*
   * ==========================================================================
   * UN ENVÍO CORTADO A MITAD NO EMPIEZA OTRA VEZ POR EL PRIMERO
   * ==========================================================================
   *
   * Con «Hola {nombre}» hay que mandar de uno en uno, y ochocientos correos
   * tardan unos minutos con la pestaña abierta. Si se cierra a mitad —o se
   * duerme el portátil— el candado caduca a la media hora y otro navegador lo
   * coge. Sin apuntar por dónde iba, empezaría por el primero: trescientas
   * personas con la convocatoria repetida.
   */
  {
    const b = banco({ cola: [uno('c1', { yaEnviados: 2 })], gente: ['a@x.es', 'b@x.es', 'c@x.es', 'd@x.es'] })
    const res = await m.mandarLosProgramados(b.como)
    caso('se salta a los que ya recibieron el suyo', 2, b.hechos.enviados[0].cuantos)
    /*
     * Y EL ALCANCE FINAL LOS CUENTA A TODOS. Si solo contara los de este
     * intento, un comunicado que salió en dos tandas quedaría registrado con la
     * mitad de la gente — y ese número es el que se lee luego en la lista.
     */
    caso('pero el alcance final los cuenta a todos', [{ id: 'c1', alcance: 4 }], b.hechos.cerrados)
    caso('y se cuenta como mandado una sola vez', 1, res.mandados)
  }
  {
    /*
     * Y SI EL INTENTO ANTERIOR YA HABÍA LLEGADO AL FINAL, se cierra sin mandar
     * nada. Es distinto del segmento vacío —aquí sí había gente— pero acaba
     * igual, y sobre todo NO vuelve a escribir a nadie.
     */
    const b = banco({ cola: [uno('c1', { yaEnviados: 3 })], gente: ['a@x.es', 'b@x.es', 'c@x.es'] })
    await m.mandarLosProgramados(b.como)
    caso('si ya se había mandado a todos, no se repite', 0, b.hechos.enviados.length)
    caso('y se cierra con el alcance de antes', [{ id: 'c1', alcance: 3 }], b.hechos.cerrados)
  }

  // --- VARIOS DE GOLPE ---
  {
    const b = banco({ cola: [uno('c1'), uno('c2'), uno('c3')] })
    const r = await m.mandarLosProgramados(b.como)
    caso('manda todos los vencidos', 3, r.mandados)
    caso('en el orden que los da la base', ['c1', 'c2', 'c3'], b.hechos.cerrados.map((x) => x.id))
  }

  // --- SIN NADA QUE MANDAR, QUE ES LO NORMAL TODOS LOS DÍAS ---
  {
    const b = banco({ cola: [] })
    const r = await m.mandarLosProgramados(b.como)
    caso('sin nada pendiente no hace nada', 0, r.mandados)
    caso('y no manda ni un correo', 0, b.hechos.enviados.length)
    caso('con una sola pregunta a la base', 1, b.hechos.reclamados)
  }

  /*
   * --- UN SEGMENTO VACÍO SE CIERRA, NO SE REINTENTA ---
   *
   * «Los que cumplen años hoy» algunos días no es nadie, y eso es legítimo.
   * Reintentarlo tres veces no va a hacer aparecer gente, y dejarlo colgado es
   * peor: se queda vencido para siempre encendiendo el numerito del menú, que
   * es exactamente cómo un contador deja de mirarse.
   */
  {
    const b = banco({ cola: [uno('c1')], gente: [] })
    const r = await m.mandarLosProgramados(b.como)
    caso('un segmento vacío se cierra igual', 1, r.mandados)
    caso('con alcance cero', [{ id: 'c1', alcance: 0 }], b.hechos.cerrados)
    caso('y no se manda ningún correo', 0, b.hechos.enviados.length)
    caso('ni se cuenta como fallido', 0, r.fallidos.length)
  }

  /*
   * --- SI NO SALE NI UN CORREO, NO SE DA POR ENVIADO ---
   *
   * Es la diferencia entre «lo intentamos y no salió» y «ya está hecho».
   * Marcarlo como enviado con cero alcance es cómo se pierde una convocatoria:
   * el comunicado pasa a «Enviado», el botón desaparece y nadie vuelve a
   * mirarlo. Y esto NO es lo mismo que el segmento vacío de arriba: allí no
   * había a quién, aquí hay a quién y no ha salido.
   */
  {
    const b = banco({ cola: [uno('c1')], enviados: { enviados: 0, error: 'El proveedor no contesta.' } })
    const r = await m.mandarLosProgramados(b.como)
    caso('un envío que no sale no se da por hecho', 0, r.mandados)
    caso('no se cierra', 0, b.hechos.cerrados.length)
    caso('se suelta para volver a intentarlo', 1, b.hechos.soltados.length)
    caso('con el motivo de verdad', true, /El proveedor no contesta/.test(b.hechos.soltados[0].motivo))
    caso('y se cuenta como fallido', 1, r.fallidos.length)
  }

  /*
   * --- Y SE DICE SI QUEDAN INTENTOS O NO ---
   *
   * Son dos situaciones distintas para quien lo lee: «se volverá a intentar» es
   * esperar, y «ya no se va a intentar más» es ponerse a arreglarlo. Sin
   * distinguirlas, un comunicado que ya no va a salir nunca parece que sigue en
   * camino.
   */
  {
    const b = banco({ cola: [uno('c1', { intentos: 1 })], enviados: { enviados: 0, error: 'Falló.' } })
    const r = await m.mandarLosProgramados(b.como)
    caso('con intentos por delante se dice', true, /Se volverá a intentar \(intento 1 de 3\)/.test(r.fallidos[0].motivo))
  }
  {
    const b = banco({ cola: [uno('c1', { intentos: 3 })], enviados: { enviados: 0, error: 'Falló.' } })
    const r = await m.mandarLosProgramados(b.como)
    caso('y en el último se dice que ya no', true, /ya no se va a intentar más/.test(r.fallidos[0].motivo))
    caso('y qué hacer entonces', true, /vuelve a programarlo/.test(r.fallidos[0].motivo))
  }

  /*
   * --- SI REVIENTA ALGO, SE SUELTA ---
   *
   * Si no, el comunicado se queda cogido media hora —lo que tarda el candado en
   * caducar— y quien mire la pantalla no ve ni que ha salido ni que ha fallado.
   */
  {
    const b = banco({ cola: [uno('c1')], revienta: 'enviar' })
    const r = await m.mandarLosProgramados(b.como)
    caso('lo que revienta se suelta', 1, b.hechos.soltados.length)
    caso('y no se cierra como enviado', 0, b.hechos.cerrados.length)
    caso('el motivo dice qué pasó', true, /Reventó al mandar/.test(b.hechos.soltados[0].motivo))
    caso('y se cuenta', 1, r.fallidos.length)
  }
  {
    const b = banco({ cola: [uno('c1')], revienta: 'destinatarios' })
    const r = await m.mandarLosProgramados(b.como)
    caso('un destinatario que no se sabe resolver también se suelta', 1, b.hechos.soltados.length)
    caso('y se dice', true, /No se sabe a quién iba/.test(r.fallidos[0].motivo))
  }

  /*
   * --- SI LA BASE NO CONTESTA, NO SE CAE LA PANTALLA ---
   *
   * Esto corre al abrir Comunicados. Que no haya red no puede impedir mirar la
   * lista de comunicados de la hermandad.
   */
  {
    const r = await m.mandarLosProgramados({
      reclamar: async () => { throw new Error('sin red') },
      destinatarios: async () => [], enviar: async () => ({ enviados: 0 }),
      cerrar: async () => {}, soltar: async () => {},
    })
    caso('sin red no revienta', 0, r.mandados)
    caso('y no dice que haya fallado nada', 0, r.fallidos.length)
  }

  /*
   * --- EL TOPE: EL CINTURÓN CONTRA EL BUCLE QUE MANDA CORREO ---
   *
   * Si `cerrar` fallara en silencio, la base devolvería el mismo comunicado una
   * y otra vez y esto mandaría correos hasta que se cerrara la pestaña. Un
   * bucle que manda correo es lo peor que puede tener esta aplicación: con el
   * tope, el destrozo máximo son diez envíos y no infinitos.
   */
  {
    let dados = 0
    const r = await m.mandarLosProgramados({
      reclamar: async () => { dados++; return uno('siempre-el-mismo') },
      destinatarios: async () => [{ email: 'a@x.es', nombre: 'A', numero: 1 }],
      enviar: async () => ({ enviados: 1 }),
      cerrar: async () => {},   // se «pierde»: la base seguiría dándolo
      soltar: async () => {},
    })
    caso('hay un tope de vueltas', m.TOPE_POR_VUELTA, dados)
    caso('y son diez, no infinitas', 10, m.TOPE_POR_VUELTA)
    caso('no manda más que eso', m.TOPE_POR_VUELTA, r.mandados)
  }

  // --- EL TOPE DE INTENTOS ES EL MISMO QUE EL DEL SQL ---
  /*
   * Están escritos en dos sitios —aquí y en la condición `envio_intentos < 3`
   * del SQL— y tienen que decir lo mismo. Si el SQL dejara de darlo a los 3 y
   * el texto dijera «de 5», el aviso mentiría; y al revés es peor: el texto
   * diría que ya no se intenta y la base seguiría intentándolo.
   */
  const sql = await readFile('supabase/envio-programado.sql', 'utf8')
  caso('el tope de intentos es 3', 3, m.MAXIMO_INTENTOS)
  caso('y el SQL usa el mismo', true,
    sql.includes(`envio_intentos < ${m.MAXIMO_INTENTOS}`))

  /*
   * ==========================================================================
   * EL CANDADO, LEÍDO EN EL SQL
   * ==========================================================================
   *
   * Que funcione se prueba con Postgres de verdad en `basedatos.prueba.mjs`.
   * Aquí se comprueba que sigue estando escrito como un «compare and swap» y no
   * como un «pregunta y luego actualiza», que es la forma de escribirlo que
   * PARECE igual y no lo es: entre la pregunta y la respuesta cabe el otro
   * navegador, y los dos mandan.
   */
  caso('el candado va dentro del propio update', true,
    /update comunicados[\s\S]*?set enviando_desde = now\(\)/.test(sql))
  caso('y la condición de estar libre va en el where', true,
    /enviando_desde is null or x\.enviando_desde < now\(\) - interval '30 minutes'/.test(sql))
  /*
   * `for update skip locked`: dos peticiones a la vez no se quedan esperando la
   * una a la otra, la segunda se salta la fila cogida y sigue. Sin esto, el
   * segundo navegador se bloquea hasta que el primero termine — y luego se
   * lleva el mismo comunicado.
   */
  caso('dos a la vez no se pisan', true, /for update skip locked/.test(sql))
  // Es `<=` y no `=`: si el día señalado no entró nadie, sale al día siguiente
  // en vez de perderse para siempre.
  caso('un día sin que entre nadie no pierde el comunicado', true,
    /fecha_programada <= to_char\(current_date/.test(sql))

  // --- Y LA PANTALLA LO USA ---
  const pantalla = await readFile('src/pages/app/Comunicados.tsx', 'utf8')
  caso('Comunicados lo lanza al abrirse', true, /mandarLosProgramados\(\{/.test(pantalla))
  /*
   * Y ESPERA A TENER EL CENSO. Con `hermanos` vacío, el segmento se resolvería
   * a cero personas y el comunicado se cerraría como «enviado a 0»: se
   * perdería, y ya no se volvería a intentar. Es el fallo más fácil de cometer
   * aquí y el más difícil de ver.
   */
  caso('espera a que llegue el censo', true, /if \(hermanos\.length === 0\) return/.test(pantalla))
  caso('y no lo intenta dos veces', true, /yaLoIntente\.current/.test(pantalla))
  // Y lo dice: un envío en silencio es indistinguible de uno que no ha pasado.
  caso('se dice lo que ha salido', true, /programadosSalidos &&/.test(pantalla))
  caso('y también si ha fallado', true, /No se ha podido mandar/.test(pantalla))
}
