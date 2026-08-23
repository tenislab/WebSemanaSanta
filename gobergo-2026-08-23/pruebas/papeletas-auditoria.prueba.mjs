/**
 * Auditoría 2026-08 · Papeletas de sitio y cortejo.
 *
 * Siete hallazgos, y la mitad tocan dinero: dos hermanos del mismo tramo
 * pagando distinto, un ingreso apuntado que nadie pagó, y una papeleta ya
 * cobrada devuelta a «sin pagar».
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')

  // ---------------------------------------------------------------
  // 1. Renovar cobra SIEMPRE el precio de hoy, se renueve por donde se renueve
  // ---------------------------------------------------------------
  // La renovación estaba escrita dos veces —secretaría y área del hermano— y
  // se habían separado. Con el tramo subido de 18 € a 20 €, quien renovaba
  // desde su móvil pagaba 18 y quien llamaba a secretaría pagaba 20.
  const m = await cargar('src/lib/renovarPapeleta.ts')
  const tramos = [
    { id: 't1', nombre: 'Cirio 1º', cuerpo: 'Cristo', capacidad: 40, tipo: 'Cirio', reparto: 'numero', precio: 20 },
    { id: 't2', nombre: 'Cruz de guía', cuerpo: 'Cristo', capacidad: 3, tipo: 'Cruz', reparto: 'solicitud', precio: null },
  ]
  caso('el precio sale del tramo', 20, m.importeDeRenovacion('t1', tramos, 15))
  caso('y si el tramo no tiene precio, el base', 15, m.importeDeRenovacion('t2', tramos, 15))
  caso('un tramo que no existe cae en el base', 15, m.importeDeRenovacion('nada', tramos, 15))

  const base = { anio: 2027, tramos, precioBase: 15, nuevoId: () => 'nueva', hoy: () => '2026-09-01' }

  // Sin papeleta de este año: se crea una nueva, al precio de hoy.
  const creada = m.conRenovacion([], { ...base, hermanoId: 'h1', tramoId: 't1' })
  caso('se crea la papeleta', 1, creada.length)
  caso('al precio de HOY, no al del año pasado', 20, creada[0].importe)
  caso('en estado Asignada', 'Asignada', creada[0].estado)

  // Con papeleta de este año: se reutiliza, no se duplica.
  const previa = [{ id: 'p1', numero: 7, hermanoId: 'h1', anio: 2027, tramoId: 't2', importe: 15, estado: 'Solicitada', fechaSolicitud: '2026-08-01' }]
  const renovada = m.conRenovacion(previa, { ...base, hermanoId: 'h1', tramoId: 't1' })
  caso('no se duplica la papeleta', 1, renovada.length)
  caso('conserva su número', 7, renovada[0].numero)
  caso('y se le pone el precio del tramo nuevo', 20, renovada[0].importe)

  // La papeleta personalizada se limpia: si no, salía en el cortejo Y como
  // mantilla a la vez, y el documento impreso decía las dos cosas.
  const conOpcion = [{ id: 'p1', numero: 3, hermanoId: 'h1', anio: 2027, tramoId: null, opcion: 'Mantilla', importe: 15, estado: 'Asignada', fechaSolicitud: '2026-08-01' }]
  caso('al pasar a un tramo se quita la opción', null,
    m.conRenovacion(conOpcion, { ...base, hermanoId: 'h1', tramoId: 't1' })[0].opcion)

  // Una anulada no cuenta: se le crea otra en vez de resucitarla.
  const anulada = [{ id: 'p1', numero: 3, hermanoId: 'h1', anio: 2027, tramoId: 't1', importe: 20, estado: 'Anulada', fechaSolicitud: '2026-08-01' }]
  caso('una papeleta anulada no se reutiliza', 2,
    m.conRenovacion(anulada, { ...base, hermanoId: 'h1', tramoId: 't1' }).length)

  // Y que las DOS pantallas usen esta función, que es lo que impide que se
  // vuelvan a separar.
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  const secre = await readFile('src/pages/app/Papeletas.tsx', 'utf8')
  caso('el área del hermano usa la función común', true, /conRenovacion\(prev, \{/.test(portal))
  caso('y secretaría también', true, /conRenovacion\(prev, \{/.test(secre))
  caso('secretaría ya no recibe el importe por parámetro', true,
    /function renovar\(hermanoId: string, tramoId: string\)/.test(secre))

  // ---------------------------------------------------------------
  // 2. «Exento» no es un cobro
  // ---------------------------------------------------------------
  // Apuntaba en Tesorería un ingreso de 18 € que nadie había pagado, y el
  // contador de «Recaudado» también lo sumaba.
  caso('«Exento» no apunta en el libro', true, /if \(exento\) return/.test(secre))
  caso('y deja la papeleta a cero', true, /exento \? \{ importe: 0 \}/.test(secre))

  // ---------------------------------------------------------------
  // 3. Aceptar una solicitud no puede pisar una papeleta ya cobrada
  // ---------------------------------------------------------------
  caso('una papeleta pagada no se sobrescribe', true,
    /if \(actual\.estado === 'Pagada' \|\| actual\.estado === 'Entregada'\) return prev/.test(secre))

  // ---------------------------------------------------------------
  // 4. Una papeleta anulada no guarda el sitio del año siguiente
  // ---------------------------------------------------------------
  const campana = await cargar('src/lib/campana.ts')
  const c = { anio: 2027, fechaLimiteRenovacion: '2026-12-31', fechaAperturaNuevos: '2026-01-01', fechaAperturaRenovacion: '2026-01-01' }
  const suya = [{ id: 'p1', numero: 1, hermanoId: 'h1', anio: 2026, tramoId: 't1', importe: 18, estado: 'Anulada', fechaSolicitud: '2025-09-01' }]
  caso('la anulada NO cuenta como sitio guardado', null, campana.renovacionDeHermano('h1', suya, c).sitioAnterior)
  caso('y entonces no sale «Por renovar»', 'Sin papeleta', campana.renovacionDeHermano('h1', suya, c).estado)
  const salio = [{ ...suya[0], estado: 'Pagada' }]
  caso('pero la que sí salió, sí cuenta', 'p1', campana.renovacionDeHermano('h1', salio, c).sitioAnterior.id)

  // ---------------------------------------------------------------
  // 5. Cambiar de tramo desde Cortejo rehace el precio
  // ---------------------------------------------------------------
  const cortejo = await readFile('src/pages/app/Cortejo.tsx', 'utf8')
  caso('al mover de tramo se recalcula el importe', true, /const nuevoImporte = precioDeTramo\(tramo, precioBase\)/.test(cortejo))
  caso('y si ya estaba cobrada, se avisa', true, /ya está cobrada por/.test(cortejo))

  // ---------------------------------------------------------------
  // 6. Quitar un tramo no puede evaporar a quien va dentro
  // ---------------------------------------------------------------
  caso('las papeletas sin tramo existente se recogen', true, /const huerfanas = useMemo/.test(cortejo))
  caso('y salen en el listado para recolocarlas', true, /huerfanas\.forEach/.test(cortejo))
  // Mientras los tramos no han llegado, no se puede decir que sobren todas.
  caso('sin tramos cargados no se avisa en falso', true, /if \(tramos\.length === 0\) return \[\]/.test(cortejo))
  const cfg = await readFile('src/pages/app/Configuracion.tsx', 'utf8')
  caso('y Configuración pregunta antes de quitarlo', true, /se quedan sin sitio en el cortejo/.test(cfg))
}
