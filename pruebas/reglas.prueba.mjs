/**
 * LAS REGLAS QUE SE DISPARAN SOLAS: FELICITAR SIN ACORDARSE.
 *
 * ============================================================================
 * QUÉ ES UNA REGLA, Y QUÉ NO HACE
 * ============================================================================
 *
 * Un sesgo + un texto + un cuándo. Cuando le toca, escribe un comunicado
 * programado para hoy — y AHÍ SE ACABA SU TRABAJO.
 *
 * Eso es lo más importante de todo el diseño y lo que esta prueba vigila
 * primero: NO MANDA NINGÚN CORREO. Lo manda el camino de siempre
 * (`envioProgramado.ts`), que ya tiene resuelto el candado, los tres intentos,
 * el «Hola {nombre}» y el freno de las marcas mal escritas.
 *
 * Si esto mandara por su cuenta habría dos caminos que hacen lo mismo, y el
 * segundo se iría quedando atrás. Es literalmente el fallo que este proyecto ha
 * repetido más veces: dos versiones de la misma regla.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const m = await cargar('src/lib/reglasAutomaticas.ts')

  const regla = (extra = {}) => ({
    id: 'r1', nombre: 'Felicitar el cumpleaños',
    criterios: { cumpleanos: 'Hoy' }, destinatarios: 'Los que cumplen hoy',
    asunto: '¡Felicidades, {nombre}!', cuerpo: 'Hola {nombre},', ...extra,
  })

  function banco({ cola = [], cuantos = 3, revienta = false } = {}) {
    const hechos = { creados: [], devueltos: [] }
    const pendientes = [...cola]
    return {
      hechos,
      como: {
        reclamar: async () => pendientes.shift() ?? null,
        cuantos: () => cuantos,
        crear: async (r) => {
          if (revienta) throw new Error('no se pudo crear')
          hechos.creados.push(r.id)
        },
        devolver: async (id) => { hechos.devueltos.push(id) },
      },
    }
  }

  // --- EL CASO NORMAL: HOY CUMPLE ALGUIEN ---
  {
    const b = banco({ cola: [regla()] })
    const r = await m.dispararReglasDeHoy(b.como)
    caso('se dispara la regla que tocaba', 1, r.creados)
    caso('creando su comunicado', ['r1'], b.hechos.creados)
    caso('y se dice cuál fue', ['Felicitar el cumpleaños'], r.nombres)
    caso('sin devolverla', 0, b.hechos.devueltos.length)
  }

  /*
   * --- HOY NO CUMPLE NADIE: NO SE CREA NADA ---
   *
   * Y este es EL CASO NORMAL, no el raro: de ochocientos hermanos, la mayoría
   * de los días no cumple ninguno. Crear un comunicado vacío cada día llenaría
   * la lista de comunicados a cero personas hasta enterrar los de verdad.
   */
  {
    const b = banco({ cola: [regla()], cuantos: 0 })
    const r = await m.dispararReglasDeHoy(b.como)
    caso('si hoy no cumple nadie, no se crea nada', 0, r.creados)
    caso('ni un comunicado vacío', 0, b.hechos.creados.length)
    /*
     * Y LA REGLA SE QUEDA MARCADA COMO MIRADA. Devolverla haría que se
     * volviera a mirar cada vez que alguien abre la pantalla, o sea diez veces
     * al día, para volver a no hacer nada.
     */
    caso('y la regla no se devuelve: ya se ha mirado hoy', 0, b.hechos.devueltos.length)
  }

  /*
   * --- SI FALLA AL CREARLO, SE DEVUELVE ---
   *
   * Dejarla marcada perdería la felicitación de hoy sin que nadie llegue a
   * saberlo, que es la clase de fallo mudo que esta aplicación lleva
   * persiguiendo desde el principio.
   */
  {
    const b = banco({ cola: [regla()], revienta: true })
    const r = await m.dispararReglasDeHoy(b.como)
    caso('si falla al crearlo, se devuelve', ['r1'], b.hechos.devueltos)
    caso('y no se cuenta como hecha', 0, r.creados)
  }

  // --- SIN RED NO REVIENTA LA PANTALLA ---
  {
    const r = await m.dispararReglasDeHoy({
      reclamar: async () => { throw new Error('sin red') },
      cuantos: () => 1, crear: async () => {}, devolver: async () => {},
    })
    caso('sin red no revienta', 0, r.creados)
  }

  /*
   * --- EL TOPE, QUE ES EL CINTURÓN ---
   *
   * Si la base siguiera dando la misma regla —porque marcarla fallara en
   * silencio— esto escribiría comunicados hasta cerrar la pestaña. Con el tope
   * el destrozo máximo son cinco, no infinitos.
   */
  {
    let dadas = 0
    const r = await m.dispararReglasDeHoy({
      reclamar: async () => { dadas++; return regla({ id: `r${dadas}` }) },
      cuantos: () => 1, crear: async () => {}, devolver: async () => {},
    })
    caso('hay un tope de reglas por vuelta', m.TOPE_REGLAS, dadas)
    caso('y son cinco: una hermandad no tiene más', 5, m.TOPE_REGLAS)
    caso('no se crean más que esas', 5, r.creados)
  }

  /*
   * --- LAS DOS DE FÁBRICA ---
   *
   * Se OFRECEN, no se crean solas: una hermandad que abre Comunicados y se
   * encuentra dos reglas que no ha puesto se pregunta qué más hay hecho a sus
   * espaldas.
   */
  /*
   * ==========================================================================
   * LO PRIMERO: QUE ALCANCEN A ALGUIEN. ESTO ESTUVO ROTO Y ERA MUDO.
   * ==========================================================================
   *
   * Las dos reglas de fábrica guardaban solo `{ cumpleanos: 'Hoy' }`, y con el
   * `estado` sin poner `filtrarSegmento` DESCARTABA A TODO EL MUNDO. O sea:
   * añadías «Felicitar el cumpleaños», te decía siempre «hoy no toca a nadie»,
   * la encendías, y no felicitaba jamás. Cero personas, sin un error, sin un
   * aviso y sin forma de arreglarlo desde la pantalla.
   *
   * Y todo lo demás de este fichero pasaba en verde: comprobaba que el texto
   * llevara `{nombre}`, que nacieran apagadas, que no mandaran correo… todo
   * cierto, y la función muerta. Lo que faltaba era EJECUTAR el sesgo en vez de
   * leerlo, que es lo que hace este caso.
   */
  const seg = await cargar('src/lib/segmentacion.ts')
  const hoy = new Date()
  const dosDigitos = (n) => String(n).padStart(2, '0')
  const censo = [
    {
      id: 'a', nombre: 'Cumple Hoy', numero: 1, estado: 'Activo', email: 'a@x.es',
      fechaNacimiento: `1980-${dosDigitos(hoy.getMonth() + 1)}-${dosDigitos(hoy.getDate())}`,
    },
    { id: 'b', nombre: 'Otro', numero: 2, estado: 'Activo', email: 'b@x.es', fechaNacimiento: '1990-01-01' },
  ]
  for (const r of m.REGLAS_DE_FABRICA) {
    caso(`la regla «${r.nombre}» alcanza a alguien de verdad`, true,
      seg.filtrarSegmento(censo, r.criterios).length > 0)
  }

  /*
   * Y UN SESGO AL QUE LE FALTAN CAMPOS NO PUEDE VOLVER A DEJAR A NADIE FUERA.
   *
   * Es la raíz, y se arregla en `filtrarSegmento`: los criterios viajan en una
   * columna `jsonb`, así que lo que llega es lo que hubiera guardado. Que le
   * falte un campo tiene un significado obvio —«ese criterio no se mira»— y era
   * el único que la función NO le daba: le daba «no sale nadie», que es la
   * respuesta más peligrosa, porque no se distingue de «hoy no cumple nadie».
   */
  caso('un sesgo con solo el cumpleaños ya funciona', 1,
    seg.filtrarSegmento(censo, { cumpleanos: 'Hoy' }).length)
  caso('y un sesgo vacío saca a todos, no a ninguno', 2, seg.filtrarSegmento(censo, {}).length)

  /*
   * Y NINGUNA REGLA DE FÁBRICA LLEVA EL SESGO A MEDIAS. El `as
   * CriteriosSegmento` que había escrito era lo que le tapaba la boca a
   * TypeScript; sin él, el compilador avisa. Esto lo vigila también en
   * ejecución, por si alguien vuelve a ponerlo.
   */
  const camposDeUnSesgo = Object.keys(seg.CRITERIOS_POR_DEFECTO)
  caso('las reglas de fábrica llevan el sesgo entero', [],
    m.REGLAS_DE_FABRICA
      .filter((r) => camposDeUnSesgo.some((k) => !(k in r.criterios)))
      .map((r) => r.nombre))

  caso('hay dos reglas de fábrica', 2, m.REGLAS_DE_FABRICA.length)
  caso('una diaria y otra mensual', ['diaria', 'mensual'], m.REGLAS_DE_FABRICA.map((r) => r.cada).sort())
  /*
   * Y LLEVAN `{nombre}` YA PUESTO. Es lo que hace que se entienda de un vistazo
   * para qué sirven las marcas, mucho mejor que cualquier ayuda escrita.
   */
  caso('el texto de fábrica ya usa el nombre', [],
    m.REGLAS_DE_FABRICA.filter((r) => !r.cuerpo.includes('{nombre}')).map((r) => r.nombre))
  caso('y el asunto también', [],
    m.REGLAS_DE_FABRICA.filter((r) => !r.asunto.includes('{nombre}')).map((r) => r.nombre))
  /*
   * Y SUS MARCAS EXISTEN. Una regla de fábrica con `{nombe}` dentro sería el
   * peor sitio posible para esa errata: se copia tal cual en todas las
   * hermandades y el freno la bloquearía justo el día del cumpleaños.
   */
  const pers = await cargar('src/lib/personalizar.ts')
  const marcasMalas = m.REGLAS_DE_FABRICA
    .filter((r) => !pers.sePuedePersonalizar(`${r.asunto}\n${r.cuerpo}`).puede)
    .map((r) => r.nombre)
  caso('ninguna regla de fábrica lleva una marca inventada', [], marcasMalas)
  // Y no se le supone el género a nadie en un texto que se manda a todo el censo.
  caso('el texto de fábrica no supone el género', [],
    m.REGLAS_DE_FABRICA.filter((r) => /\b(querido|estimado|amigo)\b/i.test(r.cuerpo)).map((r) => r.nombre))

  /*
   * ==========================================================================
   * QUE NO MANDE CORREO, LEÍDO EN EL CÓDIGO
   * ==========================================================================
   *
   * Es la línea que separa esto de una segunda máquina de mandar correos. Si
   * alguien la cruza «para que salga antes», se pierde el candado, los
   * intentos, la personalización y el freno de las marcas — y no se nota hasta
   * que una hermandad manda algo dos veces.
   */
  const src = await readFile('src/lib/reglasAutomaticas.ts', 'utf8')
  caso('las reglas no mandan correo', false, /enviarCorreo|enviarCorreoUnoAUno|cuerpoCorreo/.test(src))
  const pantalla = await readFile('src/pages/app/Comunicados.tsx', 'utf8')
  caso('crean un comunicado programado', true, /estado: 'Programado'/.test(pantalla))
  /*
   * Y SE ESCRIBE EN LA BASE ESPERANDO A QUE ENTRE, no con `setComunicados`.
   *
   * ESTE FUE UN FALLO MUDO Y ESTUVO PUESTO. `setComunicados` lanza la escritura
   * y sigue: no la espera y no dice si ha fallado. Y peor, `useSupabaseTable`
   * SE SALTA la escritura entera mientras su tabla no haya terminado de cargar
   * — y este efecto espera al censo, que es otro hook con su propia carga, así
   * que la carrera es real.
   *
   * Lo que pasaba: la regla se marcaba como disparada —eso sí llegaba—, el
   * comunicado se quedaba en la memoria de esa pestaña, y la felicitación se
   * perdía sin que nadie llegara a saberlo. Hasta mañana.
   */
  caso('el comunicado se escribe en la base esperando', true,
    /await supabase\.from\('comunicados'\)\.insert\(comunicadoToRow\(nuevo\)\)/.test(pantalla))
  caso('y un fallo al escribirlo lanza, para que la regla se devuelva', true,
    /if \(error\) throw new Error\(error\.message\)/.test(pantalla))
  caso('para hoy', true, /fechaProgramada: hoy/.test(pantalla))
  /*
   * Y SE DISPARAN ANTES DE ENVIAR. El orden no es casual: una regla crea un
   * comunicado para HOY, así que dispararla después de enviar dejaría la
   * felicitación esperando hasta que alguien vuelva a abrir la pantalla —o
   * sea, casi siempre mañana—. Y felicitar el cumpleaños al día siguiente es
   * peor que no felicitarlo.
   */
  caso('las reglas se disparan antes de enviar', true,
    /dispararReglasDeHoy\(\{[\s\S]*?\}\)\.then\(\(\) => mandarLosProgramados\(\{/.test(pantalla))

  // --- Y NACEN APAGADAS ---
  /*
   * La decisión que separa esto de una máquina de mandar correos sin
   * supervisión. Se comprueba en los dos sitios: al crearla desde la pantalla
   * y en la propia tabla, por si algún día se crean por otro camino.
   */
  caso('las reglas nuevas nacen apagadas', true, /activa: false, ultimaVez: null/.test(pantalla))
  const sql = await readFile('supabase/reglas-automaticas.sql', 'utf8')
  caso('y la base también las hace nacer apagadas', true,
    /activa boolean not null default false/.test(sql))

  /*
   * --- SE VE A CUÁNTA GENTE ALCANZA HOY ---
   *
   * Es el dato que hace falta para atreverse a encender una regla, y el que
   * evita la sorpresa: se elige «los que cumplen hoy», sale a tres de
   * ochocientos, y sin este número no hay forma de saber si es que solo cumplen
   * tres o si es que el resto no tiene la fecha en su ficha.
   */
  caso('se enseña a cuánta gente alcanzaría hoy', true, /hoy alcanzaría a \$\{alcanza\}/.test(pantalla))
  /*
   * Y SE CUENTA CON EL MISMO CAMINO QUE SE MANDA.
   *
   * Se contaba solo con `filtrarSegmento`, y al enviar se usa
   * `resolverDestinatario`, que además añade `personalDelSegmento`: la junta
   * que tiene cuenta de acceso pero no ficha en el censo. O sea que el número
   * que se enseñaba antes de encender la regla era MÁS BAJO que la gente a la
   * que le iba a llegar — y ese número es justo el que se mira para atreverse a
   * encenderla.
   */
  caso('el alcance se cuenta como se manda', true,
    /const alcanza = cuantosSon\(resolverDestinatario\(\{/.test(pantalla))
  caso('y al dispararla, igual', true,
    /cuantos: \(r\) => cuantosSon\(resolverDestinatario\(\{/.test(pantalla))
  caso('y se dice cuando no toca a nadie', true, /hoy no toca a nadie/.test(pantalla))
  /*
   * Y EL TEXTO SE VE **Y SE EDITA** SIN ABRIR NADA.
   *
   * Dos motivos, los dos importantes: es lo que se le va a mandar a ochocientas
   * personas, y esconderlo detrás de un botón «editar» es cómo se encienden
   * reglas sin haber leído lo que dicen; y una felicitación que no se puede
   * cambiar no sirve — cada hermandad escribe a los suyos a su manera, y el
   * texto de fábrica es un punto de partida, no una imposición.
   */
  caso('el asunto se puede editar', true, /x\.id === r\.id \? \{ \.\.\.x, asunto: e\.target\.value \}/.test(pantalla))
  caso('y el mensaje también', true, /x\.id === r\.id \? \{ \.\.\.x, cuerpo: e\.target\.value \}/.test(pantalla))
  caso('con los mismos botones de marca', true, /cuerpo: `\$\{x\.cuerpo\}\{\$\{mk\.marca\}\}`/.test(pantalla))
  // Y se ve cómo le llegará a alguien de los que la van a recibir.
  caso('con su vista previa', true, /vistaPrevia\(r\.cuerpo, aQuien, ctxPersonalizacion\)/.test(pantalla))

  /*
   * Y NO SE PUEDE ENCENDER CON UNA MARCA QUE NO EXISTE.
   *
   * Aquí hace MÁS falta que en un comunicado a mano: una regla encendida se
   * manda sola, sin que nadie vuelva a leer el texto. Un `{nombe}` puesto hoy
   * saldría en cada cumpleaños durante años, y nadie ata la queja del hermano
   * con lo que se escribió aquel día.
   */
  caso('no se puede encender con una marca inventada', true,
    /disabled=\{!r\.activa && !sePuedePersonalizar\(/.test(pantalla))
  // Pero sí se puede APAGAR una que ya lo esté: si no, quedaría encendida y sin
  // forma de pararla, que es lo peor de los dos mundos.
  caso('pero una encendida siempre se puede apagar', true, /!r\.activa &&/.test(pantalla))

  /*
   * --- EL CANDADO, LEÍDO EN EL SQL ---
   *
   * Mismo «compare and swap» que el envío programado, y aquí se ve muy claro lo
   * que costaría hacerlo mal: felicitar el cumpleaños UNA VEZ POR CADA MIEMBRO
   * de la junta que abra el panel esa mañana.
   */
  caso('la marca de disparada va dentro del update', true,
    /update reglas_automaticas r\s*\n\s*set ultima_vez = current_date/.test(sql))
  caso('con la condición de no haberse disparado hoy', true,
    /ultima_vez is null or x\.ultima_vez < current_date/.test(sql))
  caso('y dos a la vez no se pisan', true, /for update skip locked/.test(sql))
  // La mensual solo el día 1, o sería otra diaria con otro nombre.
  caso('la mensual solo el día 1', true, /extract\(day from current_date\) = 1/.test(sql))
  // Y no se cruzan las hermandades: es `security definer`, se salta RLS.
  caso('acotada a la hermandad', true, /x\.hermandad_id = hermandad_actual\(\)/.test(sql))
  /*
   * Y SOLO LAS ENCENDIDAS. Sin esto, apagar una regla no serviría de nada —que
   * es justamente la salvaguarda de todo el diseño.
   */
  caso('solo se disparan las encendidas', true, /and x\.activa\b/.test(sql))

  /*
   * --- `ultima_vez` NO VIAJA DESDE EL NAVEGADOR ---
   *
   * Lo escriben las dos funciones del servidor, que son las que llevan la
   * cuenta. Si el navegador lo mandara al guardar cualquier otro cambio
   * —encender la regla, corregirle una coma— podría pisar esa marca con un
   * valor viejo, y la felicitación saldría dos veces.
   */
  const db = await readFile('src/lib/db/reglasAutomaticas.ts', 'utf8')
  const toRow = (db.match(/export function reglaToRow[\s\S]*?\n\}/) ?? [''])[0]
  caso('la marca de disparada no se manda desde el navegador', false, /ultima_vez/.test(toRow))
  caso('pero sí se lee', true, /r\.ultima_vez/.test(db))
}
