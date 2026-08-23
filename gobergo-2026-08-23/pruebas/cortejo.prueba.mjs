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
}
