/** Reparto del cortejo: quién va en qué tramo y en qué puesto. */
export default async function ({ cargar, caso }) {
  const { repartoDeCuerpo } = await cargar('src/lib/cortejo.ts')
  const H = (id, numero, estado = 'Activo') => ({ id, numero, nombre: `H${numero}`, estado })
  const P = (id, hermanoId, tramoId, estado = 'Pagada') => ({ id, hermanoId, tramoId, estado, anio: 2027 })
  const T = (id, cuerpo, tipo, capacidad, reparto = 'numero') => ({ id, cuerpo, tipo, capacidad, reparto, nombre: tipo })

  const hermanos = new Map([['a', H('a', 10)], ['b', H('b', 20)], ['c', H('c', 30)], ['d', H('d', 40)], ['e', H('e', 50)]])
  const hDe = (id) => hermanos.get(id)
  const tramos = [T('t1', 'Cristo', 'Cirio', 2), T('t2', 'Cristo', 'Cirio', 2)]
  const paps = [P('p1', 'a', 't1'), P('p2', 'b', 't1'), P('p3', 'c', 't1'), P('p4', 'd', 't1'), P('p5', 'e', 't1')]

  const r = repartoDeCuerpo('Cristo', tramos, paps, hDe, new Set())
  const dentro = r.filter((x) => x.estado !== 'Excede aforo')
  caso('por número: los modernos delante', ['e', 'd', 'c', 'b'], dentro.map((x) => x.hermano.id))
  caso('cascada al segundo tramo', ['t1', 't1', 't2', 't2'], dentro.map((x) => x.tramo.id))
  caso('puestos 1 y 2 en cada tramo', [1, 2, 1, 2], dentro.map((x) => x.puesto))
  caso('el que sobra es el más antiguo', ['a'], r.filter((x) => x.estado === 'Excede aforo').map((x) => x.hermano.id))
  caso('el que sobra no repite el puesto 1', 3, r.find((x) => x.estado === 'Excede aforo').puesto)

  /*
   * EL QUE TODAVÍA NO TIENE NÚMERO NO SE PONE EL PRIMERO.
   *
   * `censo.ts` lo dice con todas las letras: «una ficha recién importada puede
   * llegar con 0 mientras se termina de numerar», y su `enElEscalafon()` deja
   * fuera de la numeración a quien lleva 0. Pero `puedeSalirEnElCortejo()` no
   * mira el número, así que ese hermano SÍ entraba en el reparto — y al
   * ordenar por número a secas, el 0 es el más bajo de todos.
   *
   * En un tramo por solicitud eso lo pone EN CABEZA, por delante del hermano
   * nº 1, que lleva cuarenta años esperando ese sitio. Y no da error: da un
   * orden impreso que nadie cuadra hasta el día de la salida.
   *
   * Lo que toca es lo contrario: sin número no hay antigüedad que alegar, así
   * que va al final. Y en el reparto automático —donde los modernos van
   * delante— va el primero, que es el mismo criterio visto del revés: el que
   * no tiene número es el más nuevo de todos.
   *
   * `Papeletas.tsx` ya lo hacía así al imprimir (`numero || Infinity`). Sin
   * esto, la lista impresa y el reparto decían cosas distintas del mismo
   * hermano.
   */
  {
    const conSinNumero = new Map(hermanos)
    conSinNumero.set('z', H('z', 0))
    const hDe2 = (id) => conSinNumero.get(id)

    // Por solicitud: manda el más antiguo, y el que no tiene número no lo es.
    const tS = [T('s1', 'Cristo', 'Insignia', 3, 'solicitud')]
    const pS = [P('q1', 'z', 's1'), P('q2', 'a', 's1'), P('q3', 'b', 's1')]
    const rS = repartoDeCuerpo('Cristo', tS, pS, hDe2, new Set())
    caso('sin número no se pone delante del más antiguo', ['a', 'b', 'z'],
      rS.map((x) => x.hermano.id))

    // Por número: los modernos delante, y sin número es el más moderno.
    const tN = [T('n1', 'Cristo', 'Cirio', 6)]
    const pN = [P('w1', 'a', 'n1'), P('w2', 'e', 'n1'), P('w3', 'z', 'n1')]
    const rN = repartoDeCuerpo('Cristo', tN, pN, hDe2, new Set())
    caso('y en el reparto por número va el primero', ['z', 'e', 'a'],
      rN.map((x) => x.hermano.id))

    /*
     * Y DOS SIN NÚMERO NO DEJAN LA LISTA EN CUALQUIER ORDEN.
     *
     * Aquí está la razón de que el tope sea un número grande y FINITO y no
     * `Infinity`: dos veces `Infinity` restadas dan `NaN`, y una comparación
     * que devuelve `NaN` deja la ordenación indefinida — la misma lista podría
     * salir de una forma al imprimirla y de otra al volver a entrar.
     *
     * Los dos van detrás del que sí tiene número, y entre ellos manda el
     * desempate de siempre: la papeleta. `x1` es la de `z`, así que va antes
     * que `y`. Lo que importa no es cuál de los dos gana, sino que gane
     * siempre el mismo.
     */
    conSinNumero.set('y', H('y', 0))
    const pDos = [P('x1', 'z', 's1'), P('x2', 'y', 's1'), P('x3', 'a', 's1')]
    const rDos = repartoDeCuerpo('Cristo', tS, pDos, hDe2, new Set())
    caso('dos sin número van detrás y en orden fijo', ['a', 'z', 'y'],
      rDos.map((x) => x.hermano.id))
    // Y otra vez, con las papeletas en otro orden de entrada: mismo resultado.
    const rOtra = repartoDeCuerpo('Cristo', tS, [pDos[2], pDos[1], pDos[0]], hDe2, new Set())
    caso('y no depende del orden en que lleguen', ['a', 'z', 'y'],
      rOtra.map((x) => x.hermano.id))
  }

  const conBaja = new Map(hermanos)
  conBaja.set('e', H('e', 50, 'Baja'))
  const r2 = repartoDeCuerpo('Cristo', tramos, paps, (id) => conBaja.get(id), new Set())
  caso('los de baja no salen', false, r2.some((x) => x.hermano.id === 'e'))
  caso('y su sitio lo ocupa el siguiente', ['d', 'c', 'b', 'a'], r2.map((x) => x.hermano.id))

  caso('una papeleta duplicada no ocupa dos puestos', 5,
    repartoDeCuerpo('Cristo', tramos, [...paps, P('p6', 'a', 't1')], hDe, new Set()).length)
  caso('anuladas y renuncias fuera', ['a'],
    repartoDeCuerpo('Cristo', tramos, [P('p1', 'a', 't1'), P('p2', 'b', 't1', 'Anulada'), P('p3', 'c', 't1', 'Renuncia')], hDe, new Set())
      .map((x) => x.hermano.id))

  const tramoSol = [T('s1', 'Cristo', 'Insignia', 2, 'solicitud')]
  const r3 = repartoDeCuerpo('Cristo', tramoSol, [P('q1', 'c', 's1'), P('q2', 'a', 's1'), P('q3', 'b', 's1')], hDe, new Set())
  caso('por solicitud gana la antigüedad', ['a', 'b', 'c'], r3.map((x) => x.hermano.id))
  caso('el tercero excede aforo', 1, r3.filter((x) => x.estado === 'Excede aforo').length)

  caso('una incidencia abierta marca la asignación', 'Con incidencia',
    repartoDeCuerpo('Cristo', tramos, [P('p1', 'a', 't1')], hDe, new Set(['p1']))[0].estado)
  caso('una papeleta solo solicitada queda reservada', 'Reservada',
    repartoDeCuerpo('Cristo', tramos, [P('p1', 'a', 't1', 'Solicitada')], hDe, new Set())[0].estado)
  caso('un tramo de aforo 0 no coloca a nadie', 'Excede aforo',
    repartoDeCuerpo('Cristo', [T('z', 'Cristo', 'Cirio', 0)], [P('p1', 'a', 'z')], hDe, new Set())[0].estado)

  /*
   * ENTREGADA NO ES PAGADA, Y LA FILA LO TIENE QUE DECIR.
   *
   * Llegó como «no funciona el tic de confirma asistencia». Sí funcionaba: es
   * el pase de lista del día de salida —entrega la papeleta y, si el hermano
   * llega sin haber pagado, le cobra en mano y lo apunta en Tesorería—. Lo que
   * pasaba es que *Pagada* y *Entregada* se metían en el mismo saco y las dos
   * se pintaban «Confirmada»: al pulsar el tic, el distintivo de la fila
   * seguía diciendo lo mismo y el clic quedaba mudo.
   *
   * Se comprueba con el reparto de verdad, porque es el que da el estado que
   * pinta la fila. La incidencia sigue mandando por encima de las dos: si hay
   * algo abierto, eso es lo que hay que ver.
   */
  caso('pagada queda confirmada', 'Confirmada',
    repartoDeCuerpo('Cristo', tramos, [P('p1', 'a', 't1', 'Pagada')], hDe, new Set())[0].estado)
  caso('y entregada se distingue de pagada', 'Entregada',
    repartoDeCuerpo('Cristo', tramos, [P('p1', 'a', 't1', 'Entregada')], hDe, new Set())[0].estado)
  caso('la incidencia manda por encima de la entrega', 'Con incidencia',
    repartoDeCuerpo('Cristo', tramos, [P('p1', 'a', 't1', 'Entregada')], hDe, new Set(['p1']))[0].estado)
  // Y sigue contando para el aforo: entregada es una plaza ocupada, no un hueco.
  caso('entregada ocupa plaza', 1,
    repartoDeCuerpo('Cristo', tramos, [P('p1', 'a', 't1', 'Entregada')], hDe, new Set())
      .filter((x) => x.estado !== 'Excede aforo').length)

  await losDosControlesDelDiaDeSalida({ caso })

  /*
   * LAS PAPELETAS PROPIAS DE LA HERMANDAD.
   *
   * Nacieron para lo que NO sale en el cortejo (la simbólica de quien no
   * procesiona). Pero una hermandad llama «nazareno cirio» a una de las suyas,
   * la emite, la cobra… y el tramo seguía marcando 0/40. Ahora, si la opción
   * tiene puesto, quien la saca entra como cualquier otro.
   */
  const conOpcion = (id, hermanoId, tramoId, opcion) => ({
    id, hermanoId, tramoId, opcion, estado: 'Asignada', anio: 2027,
  })
  const conPuesto = repartoDeCuerpo(
    'Cristo', [T('t1', 'Cristo', 'Cirio', 2)],
    [conOpcion('x1', 'a', 't1', 'Nazareno de cirio')], hDe, new Set(),
  )
  caso('una papeleta propia con puesto entra en el cortejo', 1, conPuesto.length)
  caso('y en su tramo', 't1', conPuesto[0]?.tramo.id)

  // Y la simbólica NO entra: quien no procesiona no puede ocupar un sitio.
  const sinPuesto = repartoDeCuerpo(
    'Cristo', [T('t1', 'Cristo', 'Cirio', 2)],
    [conOpcion('x2', 'b', null, 'Papeleta simbólica')], hDe, new Set(),
  )
  caso('la simbólica se queda fuera', 0, sinPuesto.length)

  /*
   * EL CIVIL TAMPOCO SALE, Y LA PANTALLA TIENE QUE SABERLO.
   *
   * El hermano civil —un administrativo contratado, un asesor— está en el
   * censo para trabajar en la hermandad, no para hacer estación de
   * penitencia. El reparto ya lo descartaba; lo que no lo sabía era la
   * pantalla de Cortejo, que lo ofrecía en «asignar a un tramo». Se le emitía
   * la papeleta, se le cobraba, y el día del reparto no aparecía en ningún
   * tramo ni en el orden impreso. Ningún error, ninguna pista.
   *
   * Es el mismo fallo que ya se arregló con los de baja, en el que no se cayó
   * con los civiles. Ahora la regla es UNA y la usan los dos.
   */
  const { puedeSalirEnElCortejo } = await cargar('src/lib/cortejo.ts')
  caso('un activo sale', true, puedeSalirEnElCortejo({ estado: 'Activo' }))
  caso('uno nuevo también', true, puedeSalirEnElCortejo({ estado: 'Nuevo' }))
  caso('el de baja no', false, puedeSalirEnElCortejo({ estado: 'Baja' }))
  caso('el civil tampoco', false, puedeSalirEnElCortejo({ estado: 'Activo', civil: true }))
  caso('y una ficha que no está, menos', false, puedeSalirEnElCortejo(undefined))

  const conCivil = new Map(hermanos)
  conCivil.set('e', { ...H('e', 50), civil: true })
  const rCivil = repartoDeCuerpo('Cristo', tramos, paps, (id) => conCivil.get(id), new Set())
  caso('el civil no entra en el reparto', false, rCivil.some((x) => x.hermano.id === 'e'))

  // Y las DOS pantallas que emiten papeleta usan la MISMA regla, no una lista
  // suya. Son dos y las dos emiten: Cortejo asigna tramo, y Papeletas saca en
  // tramo, renueva y emite la simbólica.
  const { readFile } = await import('node:fs/promises')
  const pantalla = await readFile('src/pages/app/Cortejo.tsx', 'utf8')
  caso('Cortejo solo ofrece a quien puede salir', true,
    /hermanosAsignables\(hermanos\.filter\(puedeSalirEnElCortejo\)\)/.test(pantalla))
  caso('y lo vuelve a comprobar al asignar', true,
    /puedeSalirEnElCortejo\(hermano\)/.test(pantalla))

  /*
   * Papeletas es la peor de las dos, porque su lista es el CENSO ENTERO: las
   * bajas y los civiles salen ahí con su botón de «Sacar papeleta» al lado.
   * Son TRES caminos que emiten —renovar, sacar en tramo y la simbólica— y los
   * tres tienen que preguntar, no solo el botón que se ve.
   */
  const pantallaPaps = await readFile('src/pages/app/Papeletas.tsx', 'utf8')
  caso('Papeletas no ofrece sacar a quien no sale', true,
    /const fueraDelCortejo = !puedeSalirEnElCortejo\(h\)/.test(pantallaPaps))
  caso('y el botón lo respeta', true, /&& !fueraDelCortejo/.test(pantallaPaps))
  for (const via of ['sacarEnTramo', 'sacarSimbolica', 'renovar']) {
    const cuerpo = pantallaPaps.slice(pantallaPaps.indexOf(`function ${via}(hermanoId`))
    caso(`${via} lo vuelve a comprobar`, true,
      /^[\s\S]{0,220}if \(!saleEnElCortejo\(hermanoId\)\) return/.test(cuerpo))
  }
}

/**
 * LOS DOS CONTROLES DEL DÍA DE SALIDA NO HACEN LO MISMO.
 *
 * Llegó así, con dos capturas: «no funciona el tic de confirma asistencia, el
 * de abajo sí; es tontería tenerlo dos veces». Y no era ni una cosa ni la
 * otra: el ✓ de la fila ENTREGA la papeleta (y cobra en mano al que llega sin
 * pagar, que es el dinero del sobre de la puerta), y el de abajo es la
 * ASISTENCIA, para el histórico y el reparto del año que viene. Se leían como
 * uno repetido porque los dos eran un ✓ verde sin rótulo.
 *
 * Aquí se comprueba lo que hace que no se confundan: que la fila dice cuál es
 * cuál, que el tic no se vuelve a ofrecer si ya está entregada, y que el
 * bloque de asistencia dice que no es la entrega. Y sobre todo: que el cobro
 * en mano sigue ahí, que es lo que de verdad hace el de arriba.
 */
async function losDosControlesDelDiaDeSalida({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/pages/app/Cortejo.tsx', 'utf8')

  // El distintivo de la fila distingue entregada de confirmada.
  const pill = src.slice(src.indexOf('function estadoPillClass('), src.indexOf('const CheckIcon'))
  caso('el distintivo de entregada no es el de confirmada', true,
    /'Entregada'/.test(pill) && !/'Entregada' \|\| estado === 'Confirmada'/.test(pill))

  // La fila dice qué hace el tic, antes de tocarlo.
  const roster = src.slice(src.indexOf('Entrega de papeletas'), src.indexOf('excedidos.length > 0'))
  caso('la fila explica que el ✓ entrega la papeleta', true, /entrega la papeleta/.test(roster))
  caso('y que si no ha pagado se le cobra en mano', true, /cobra en mano/.test(roster))
  caso('y manda la asistencia abajo', true, /más abajo/.test(roster) && /Asistencia/.test(roster))
  // Entregada ya: el tic no se ofrece otra vez.
  caso('el tic no se repite si ya está entregada', true,
    /\{a\.estado !== 'Entregada' && \(/.test(roster))
  caso('pero la incidencia se puede seguir registrando', true, /Registrar incidencia/.test(roster))

  // Y el bloque de asistencia dice que NO es la entrega.
  const asistencia = src.slice(src.indexOf('<label>Asistencia'), src.indexOf('<AsistenciaTramo'))
  caso('asistencia dice que no es la entrega', true, /no es la entrega de la papeleta/.test(asistencia))
  caso('y para qué sirve', true, /histórico/.test(asistencia))

  /*
   * LO QUE NO SE PUEDE PERDER: el cobro en mano. Es lo único que hace el tic
   * de arriba y no hace ningún otro control de la pantalla; si se quitara
   * «porque está repetido», el dinero de la puerta volvería a no verlo nadie.
   */
  const presente = src.slice(src.indexOf('function marcarPresente('), src.indexOf('function registrarIncidencia('))
  caso('marcar presente deja la papeleta entregada', true, /estado: 'Entregada'/.test(presente))
  caso('y si no estaba pagada, la apunta en Tesorería', true, /apuntarPapeleta\(p, p\.metodoPago \?\? 'Efectivo', hoyTexto\)/.test(presente))
  caso('y no la vuelve a cobrar si ya estaba pagada', true,
    /p\.estado !== 'Pagada' && p\.estado !== 'Entregada'/.test(presente))
}
