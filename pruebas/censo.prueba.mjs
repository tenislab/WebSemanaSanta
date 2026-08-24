/** P2: el escalafón — quién va delante de quién al dar de baja y al reactivar. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/censo.ts')

  // Censo de prueba: cinco hermanos, del 1 al 5, cada uno de un año.
  const base = () => [
    { id: 'a', numero: 1, estado: 'Activo', antiguedad: 1980 },
    { id: 'b', numero: 2, estado: 'Activo', antiguedad: 1990 },
    { id: 'c', numero: 3, estado: 'Activo', antiguedad: 2000 },
    { id: 'd', numero: 4, estado: 'Activo', antiguedad: 2010 },
    { id: 'e', numero: 5, estado: 'Activo', antiguedad: 2020 },
  ]
  const nums = (censo) => censo.map((h) => `${h.id}${h.numero}`).join(' ')

  // --- Dar de baja ---
  const trasBaja = m.darDeBajaEnCenso(base(), 'c')
  caso('el que se va queda fuera de la numeración', 0, trasBaja.find((h) => h.id === 'c').numero)
  caso('y marcado de baja', 'Baja', trasBaja.find((h) => h.id === 'c').estado)
  // Los de encima no se mueven; los de debajo suben uno.
  caso('el escalafón se recoloca', 'a1 b2 c0 d3 e4', nums(trasBaja))
  caso('la numeración queda sana', true, m.numeracionSana(trasBaja))
  // La antigüedad es el AÑO de entrada: no se mueve porque se vaya otro.
  caso('la antigüedad no se toca', 2010, trasBaja.find((h) => h.id === 'd').antiguedad)
  // Dar de baja al primero.
  caso('dando de baja al nº 1', 'a0 b1 c2 d3 e4', nums(m.darDeBajaEnCenso(base(), 'a')))
  // Y al último: nadie se mueve.
  caso('dando de baja al último no se mueve nadie', 'a1 b2 c3 d4 e0', nums(m.darDeBajaEnCenso(base(), 'e')))
  // Dos bajas seguidas.
  caso('dos bajas seguidas', 'a1 b0 c2 d0 e3',
    nums(m.darDeBajaEnCenso(m.darDeBajaEnCenso(base(), 'b'), 'd')))
  caso('y siguen sanos', true, m.numeracionSana(m.darDeBajaEnCenso(m.darDeBajaEnCenso(base(), 'b'), 'd')))
  // Dar de baja a quien ya está de baja no hace nada.
  const yaBaja = m.darDeBajaEnCenso(base(), 'c')
  caso('dar de baja dos veces no mueve nada', nums(yaBaja), nums(m.darDeBajaEnCenso(yaBaja, 'c')))
  caso('un id que no existe tampoco', nums(base()), nums(m.darDeBajaEnCenso(base(), 'zzz')))

  // --- Reactivar al final ---
  const alFinal = m.reactivarEnCenso(yaBaja, 'c', false)
  caso('al final, coge el último número', 5, alFinal.find((h) => h.id === 'c').numero)
  caso('y vuelve a estar activo', 'Activo', alFinal.find((h) => h.id === 'c').estado)
  caso('nadie más se mueve', 'a1 b2 c5 d3 e4', nums(alFinal))
  caso('la numeración sigue sana', true, m.numeracionSana(alFinal))

  // --- Reactivar recuperando la antigüedad ---
  // «c» entró en 2000: le toca delante del primero que entró después (d, 2010).
  const conAntiguedad = m.reactivarEnCenso(yaBaja, 'c', true)
  caso('recupera su sitio por el año de entrada', 3, conAntiguedad.find((h) => h.id === 'c').numero)
  caso('y los de debajo descienden uno', 'a1 b2 c3 d4 e5', nums(conAntiguedad))
  caso('vuelve el censo exacto de antes de la baja', nums(base()), nums(conAntiguedad))
  caso('la numeración queda sana', true, m.numeracionSana(conAntiguedad))

  // El más antiguo de todos vuelve al nº 1.
  const sinA = m.darDeBajaEnCenso(base(), 'a')
  caso('el más antiguo recupera el nº 1', 1, m.reactivarEnCenso(sinA, 'a', true).find((h) => h.id === 'a').numero)
  caso('y el resto baja', 'a1 b2 c3 d4 e5', nums(m.reactivarEnCenso(sinA, 'a', true)))

  // El más moderno vuelve al final aunque pida antigüedad: no hay nadie detrás.
  const sinE = m.darDeBajaEnCenso(base(), 'e')
  caso('el más moderno vuelve al final', 5, m.reactivarEnCenso(sinE, 'e', true).find((h) => h.id === 'e').numero)

  // A igualdad de año, DETRÁS de los que ya están: quien no ha faltado en todos
  // estos años no debe caer por debajo de quien vuelve.
  const empate = [
    { id: 'x', numero: 1, estado: 'Activo', antiguedad: 2000 },
    { id: 'y', numero: 2, estado: 'Activo', antiguedad: 2000 },
    { id: 'z', numero: 0, estado: 'Baja', antiguedad: 2000 },
  ]
  const conEmpate = m.reactivarEnCenso(empate, 'z', true)
  caso('a igualdad de año, el que vuelve va detrás', 3, conEmpate.find((h) => h.id === 'z').numero)
  caso('y los que no faltaron no se mueven', 'x1 y2 z3', nums(conEmpate))

  // Reactivar a quien no está de baja no hace nada.
  caso('reactivar a un activo no cambia nada', nums(base()), nums(m.reactivarEnCenso(base(), 'a', true)))

  // --- La comprobación de salud ---
  caso('un censo correcto está sano', true, m.numeracionSana(base()))
  caso('con un número repetido, no', false,
    m.numeracionSana([{ numero: 1, estado: 'Activo' }, { numero: 1, estado: 'Activo' }]))
  caso('con un hueco, tampoco', false,
    m.numeracionSana([{ numero: 1, estado: 'Activo' }, { numero: 3, estado: 'Activo' }]))
  caso('con un activo sin número, tampoco', false,
    m.numeracionSana([{ numero: 1, estado: 'Activo' }, { numero: 0, estado: 'Activo' }]))
  // Los de baja no cuentan: están fuera de la numeración a propósito.
  caso('los de baja no rompen la numeración', true,
    m.numeracionSana([{ numero: 1, estado: 'Activo' }, { numero: 0, estado: 'Baja' }, { numero: 0, estado: 'Baja' }]))

  // ---------------------------------------------------------------------
  // «Hermanos activos: 0» con el censo lleno
  // ---------------------------------------------------------------------
  /*
   * EL FALLO: se contaban los activos como `estado === 'Activo'`, en tres
   * sitios distintos, dejando fuera a los «Nuevo».
   *
   * Y «Nuevo» no es «pendiente de algo»: es el estado que se pone al ACEPTAR a
   * alguien, tanto desde una solicitud como al darlo de alta a mano. O sea que
   * todo hermano dado de alta hoy no contaba como activo.
   *
   * Se veía así: una hermandad que acaba de importar su censo entero —con
   * todos marcados como nuevos, porque acaban de entrar en la aplicación— leía
   * «Hermanos activos: 0» encima de sus ochocientas fichas. Y uno de los tres
   * sitios era el informe que se imprime y se lleva al cabildo de cuentas.
   */
  const ficha = await cargar('src/lib/hermanoFicha.ts')
  caso('un activo es miembro', true, ficha.esMiembro({ estado: 'Activo' }))
  caso('un nuevo TAMBIÉN es miembro', true, ficha.esMiembro({ estado: 'Nuevo' }))
  caso('quien se ha ido, no', false, ficha.esMiembro({ estado: 'Baja' }))

  // Y que las tres pantallas usen la misma función, para que no puedan volver
  // a contar cada una a su manera.
  const { readFile } = await import('node:fs/promises')
  for (const pantalla of [
    'src/pages/app/DashboardHome.tsx',
    'src/pages/app/Hermanos.tsx',
    'src/pages/app/Informes.tsx',
  ]) {
    const t = await readFile(pantalla, 'utf8')
    caso(`${pantalla.split('/').pop()} cuenta con esMiembro`, true, /filter\(esMiembro\)/.test(t))
    caso(`${pantalla.split('/').pop()} ya no deja fuera a los nuevos`, false,
      /const activos = [a-zA-Z]*\.filter\(\(h\) => h\.estado === 'Activo'\)/.test(t))
  }

  /*
   * EL CIVIL QUE SE VA NO PUEDE ARRASTRAR AL CENSO ENTERO.
   *
   * Un hermano civil —un administrativo contratado, un asesor— lleva número 0
   * a propósito: no ocupa puesto en el escalafón. Al tramitarle la baja,
   * `darDeBajaEnCenso` recolocaba «a todos los de número mayor que el suyo», y
   * su número es CERO: o sea, a todo el mundo. El nº 1 se iba al 0 —fuera de la
   * numeración, como si estuviera de baja— y los demás bajaban un puesto.
   *
   * En una hermandad eso no se ve el día que pasa: se ve el día de la salida,
   * cuando el escalafón entero está corrido un puesto y el hermano más antiguo
   * ha desaparecido de la lista.
   */
  const conCivil = () => [
    { id: 'a', numero: 1, estado: 'Activo', antiguedad: 1980 },
    { id: 'b', numero: 2, estado: 'Activo', antiguedad: 1990 },
    { id: 'c', numero: 3, estado: 'Activo', antiguedad: 2000 },
    { id: 'z', numero: 0, estado: 'Activo', antiguedad: 2024, civil: true },
  ]
  const trasCivil = m.darDeBajaEnCenso(conCivil(), 'z')
  caso('el civil que se va queda de baja', 'Baja', trasCivil.find((h) => h.id === 'z').estado)
  caso('y NO se lleva por delante el escalafón', 'a1 b2 c3 z0', nums(trasCivil))
  caso('la numeración sigue sana tras la baja del civil', true, m.numeracionSana(trasCivil))

  // Lo mismo con una ficha que llega con número 0 sin ser civil ni baja: puede
  // salir de una importación a medias, y tampoco puede correr a los demás.
  const conCero = [
    { id: 'a', numero: 1, estado: 'Activo', antiguedad: 1980 },
    { id: 'b', numero: 2, estado: 'Activo', antiguedad: 1990 },
    { id: 'x', numero: 0, estado: 'Activo', antiguedad: 2024 },
  ]
  caso('una ficha con número 0 tampoco corre a nadie', 'a1 b2 x0',
    nums(m.darDeBajaEnCenso(conCero, 'x')))

  /*
   * Y AL VOLVER, TAMPOCO. El administrativo que se fue y vuelve sigue sin
   * ocupar puesto: reactivarlo «recuperando antigüedad» le daba un número del
   * escalafón y empujaba un puesto a todos los hermanos de detrás.
   */
  const civilDeBaja = [
    { id: 'a', numero: 1, estado: 'Activo', antiguedad: 1980 },
    { id: 'b', numero: 2, estado: 'Activo', antiguedad: 1990 },
    { id: 'c', numero: 3, estado: 'Activo', antiguedad: 2000 },
    { id: 'z', numero: 0, estado: 'Baja', antiguedad: 1995, civil: true },
  ]
  const civilVuelve = m.reactivarEnCenso(civilDeBaja, 'z', true)
  caso('el civil vuelve activo', 'Activo', civilVuelve.find((h) => h.id === 'z').estado)
  caso('sigue sin número', 0, civilVuelve.find((h) => h.id === 'z').numero)
  caso('y no empuja a nadie', 'a1 b2 c3 z0', nums(civilVuelve))
  const civilAlFinal = m.reactivarEnCenso(civilDeBaja, 'z', false)
  caso('mandarlo «al final» tampoco le da número', 'a1 b2 c3 z0', nums(civilAlFinal))
}
