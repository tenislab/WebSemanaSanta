/** P6: los roles que salen solos de la papeleta. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/rolesPapeleta.ts')

  const tramos = [
    { id: 't1', etiqueta: 'Costalero' },
    { id: 't2', etiqueta: 'Acólito' },
    { id: 't3' },                        // un tramo de cirio: no da rol
    { id: 't4', etiqueta: '   ' },       // espacios: tampoco
  ]
  const opciones = [
    { nombre: 'Mantilla', etiqueta: 'Mantilla' },
    { nombre: 'Papeleta simbólica', etiqueta: '' },
  ]
  const p = (o) => ({ hermanoId: 'h1', anio: 2027, estado: 'Asignada', tramoId: null, opcion: null, ...o })
  const auto = (papeletas, id = 'h1', anio = 2027) => m.etiquetasAutomaticas(id, papeletas, tramos, opciones, anio)

  // --- Lo básico ---
  caso('sin papeletas, ningún rol', 0, auto([]).length)
  caso('el tramo da su rol', 'Costalero', auto([p({ tramoId: 't1' })])[0])
  caso('la opción da el suyo', 'Mantilla', auto([p({ opcion: 'Mantilla' })])[0])
  caso('un tramo sin rol no da nada', 0, auto([p({ tramoId: 't3' })]).length)
  caso('un rol en blanco tampoco', 0, auto([p({ tramoId: 't4' })]).length)
  caso('una opción sin rol tampoco', 0, auto([p({ opcion: 'Papeleta simbólica' })]).length)

  // --- Qué estados cuentan ---
  // Una solicitud todavía no es un sitio: no da rol hasta que se asigna.
  caso('«Solicitada» no da rol todavía', 0, auto([p({ tramoId: 't1', estado: 'Solicitada' })]).length)
  caso('«Asignada» sí', 1, auto([p({ tramoId: 't1', estado: 'Asignada' })]).length)
  caso('«Pagada» sí', 1, auto([p({ tramoId: 't1', estado: 'Pagada' })]).length)
  caso('«Entregada» sí', 1, auto([p({ tramoId: 't1', estado: 'Entregada' })]).length)
  // Y al anular o renunciar, el rol desaparece solo. Esto es lo que no se podía
  // garantizar guardando la etiqueta en el hermano.
  caso('«Anulada» quita el rol', 0, auto([p({ tramoId: 't1', estado: 'Anulada' })]).length)
  caso('«Renuncia» también', 0, auto([p({ tramoId: 't1', estado: 'Renuncia' })]).length)

  // --- El año importa ---
  // Ser costalero en 2024 no te hace costalero en 2027.
  caso('una papeleta de otro año no cuenta', 0, auto([p({ tramoId: 't1', anio: 2024 })]).length)
  caso('solo cuenta el año pedido', 1, auto([p({ tramoId: 't1', anio: 2024 })], 'h1', 2024).length)

  // --- De otro hermano, no ---
  caso('la papeleta de otro no da rol', 0, auto([p({ tramoId: 't1', hermanoId: 'h9' })]).length)

  // --- Varios roles y sin repetir ---
  const dos = auto([p({ tramoId: 't1' }), p({ tramoId: 't2' })])
  caso('dos papeletas, dos roles', 2, dos.length)
  caso('y en orden', 'Acólito,Costalero', dos.join(','))
  caso('el mismo rol dos veces no se repite', 1, auto([p({ tramoId: 't1' }), p({ tramoId: 't1' })]).length)
  // Una papeleta con tramo Y opción da los dos.
  caso('tramo y opción a la vez dan los dos', 2, auto([p({ tramoId: 't1', opcion: 'Mantilla' })]).length)

  // --- Mezclar con las puestas a mano ---
  caso('se juntan sin repetir', 'Banda,Costalero',
    m.etiquetasDe({ etiquetas: ['Banda'] }, ['Costalero']).join(','))
  caso('sin duplicar la que está en las dos', 1,
    m.etiquetasDe({ etiquetas: ['Costalero'] }, ['Costalero']).length)
  caso('sin ninguna, lista vacía', 0, m.etiquetasDe({}, []).length)
  caso('solo las manuales', 'Banda', m.etiquetasDe({ etiquetas: ['Banda'] }, []).join(','))

  // --- El índice, que es lo que usan las tablas ---
  const idx = m.indiceRoles(
    [p({ tramoId: 't1' }), p({ tramoId: 't2', hermanoId: 'h2' }), p({ tramoId: 't3', hermanoId: 'h3' })],
    tramos, opciones, 2027,
  )
  caso('el índice trae a los que tienen rol', 2, idx.size)
  caso('con el suyo', 'Costalero', idx.get('h1').join(','))
  caso('y el del otro', 'Acólito', idx.get('h2').join(','))
  caso('quien no tiene rol no está', undefined, idx.get('h3'))
  // El índice y el cálculo uno a uno tienen que decir lo mismo.
  caso('el índice coincide con el cálculo suelto', auto([p({ tramoId: 't1' })]).join(','), idx.get('h1').join(','))

  // --- Qué roles existen, para la lista de filtrar ---
  const cuales = m.etiquetasQueSonAutomaticas(tramos, opciones)
  caso('los roles configurados', 'Acólito,Costalero,Mantilla', cuales.join(','))
  caso('sin tramos ni opciones, ninguno', 0, m.etiquetasQueSonAutomaticas([], []).length)
}
