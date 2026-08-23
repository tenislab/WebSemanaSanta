/** Emisión anual de cuotas: fechas, ejercicios y no cobrar dos veces. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/cuotasEmision.ts')
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  caso('año de una fecha en español', 2026, m.anioDeTexto('05 feb 2026'))
  caso('año de una fecha ISO', 2027, m.anioDeTexto('2027-03-01'))
  caso('ISO no se va un día (zona horaria)', '2026-02-05', iso(m.parseFechaEs('2026-02-05')))
  caso('fecha en español', '2026-02-05', iso(m.parseFechaEs('05 feb 2026')))
  caso('mes escrito largo', '2026-09-01', iso(m.parseFechaEs('1 septiembre 2026')))
  caso('lo que no se entiende es null', null, m.parseFechaEs('qué día es hoy'))
  caso('el ejercicio explícito manda', 2030, m.ejercicioDe({ ejercicio: 2030, fechaEmision: '01 ene 2026' }))
  caso('sin ejercicio, el año de emisión', 2026, m.ejercicioDe({ fechaEmision: '01 ene 2026' }))
  caso('el fraccionamiento es la misma cuota', true, m.mismoConcepto('Cuota anual · mes 3/12', 'Cuota anual'))
  caso('las mayúsculas no crean una cuota nueva', true, m.mismoConcepto('Cuota Anual', 'cuota anual'))
  caso('las tildes tampoco', true, m.mismoConcepto('Cuota ordinária', 'Cuota ordinaria'))
  caso('conceptos distintos siguen siendo distintos', false, m.mismoConcepto('Cuota anual', 'Cuota extraordinaria'))

  const hs = [
    { id: 'a', nombre: 'A', estado: 'Activo', iban: 'ES01' },
    { id: 'b', nombre: 'B', estado: 'Baja', iban: null },
    { id: 'c', nombre: 'C', estado: 'Nuevo', iban: null },
  ]
  const cs = [{ id: '1', numero: 1, hermanoId: 'a', concepto: 'Cuota Anual', ejercicio: 2027, fechaEmision: '01 ene 2027', importe: 60, estado: 'Pendiente' }]
  caso('fuera las bajas y quien ya la tiene', ['C'], m.hermanosSinCuota(cs, hs, 2027, 'cuota anual').map((h) => h.nombre))
  caso('otro ejercicio: todos los que no están de baja', ['A', 'C'], m.hermanosSinCuota(cs, hs, 2028, 'Cuota anual').map((h) => h.nombre))

  let n = 0
  const opts = {
    cuotas: cs, hermanos: hs, ejercicio: 2028, concepto: 'Cuota anual', importe: 60,
    fechaCobro: '01 feb 2028', fechaEmision: '01 ene 2028', metodoPorDefecto: 'Domiciliación',
    nuevoId: () => `id${(n += 1)}`,
  }
  const nuevas = m.emitirCuotasAnuales(opts)
  caso('emite a los dos que faltan', 2, nuevas.length)
  caso('numera sin repetir el recibo existente', [2, 3], nuevas.map((c) => c.numero))
  caso('con el importe del concepto', [60, 60], nuevas.map((c) => c.importe))
  caso('sin IBAN no se domicilia', ['Domiciliación', 'Transferencia'], nuevas.map((c) => c.metodoCobro))
  caso('emitir dos veces no duplica', 0, m.emitirCuotasAnuales({ ...opts, cuotas: [...cs, ...nuevas] }).length)

  await elCicloAnual({ cargar, caso })
  await remesaSinCobrarDosVeces({ cargar, caso })
}

/**
 * EL CICLO ANUAL: cuándo se renuevan las cuotas y qué ejercicio toca cobrar.
 *
 * Llegó una captura del cajón de emisión, en agosto de 2026, diciendo «se
 * emitirá 0,00 € de "Cuota anual" a 32 hermanos del ejercicio 2027» con el
 * desplegable de concepto EN BLANCO. Tres cosas mal a la vez:
 *
 *   · el ejercicio salía de `getCampana()`, que es la Semana Santa que viene,
 *     no el ejercicio contable: proponía cobrar un año que no ha empezado;
 *   · el concepto se inventaba («Cuota anual») cuando la hermandad no tenía
 *     catálogo, y por eso el desplegable no encontraba esa opción;
 *   · y el importe caía a 0 € porque ese nombre no está en ningún catálogo.
 *
 * Los tres apuntan al mismo sitio: la pantalla contestaba igual supiera o no
 * supiera. Un ejercicio emitido de más no se arregla borrando recibos, porque
 * a los domiciliados el cargo ya les ha salido en la remesa.
 */
async function elCicloAnual({ cargar, caso }) {
  const m = await cargar('src/lib/cuotasEmision.ts')
  const dia = (a, mes, d) => new Date(a, mes - 1, d)

  // --- Renovación el 1 de enero: el ejercicio es el año natural.
  const enero = { dia: 1, mes: 1 }
  caso('el 1 de enero ya es el ejercicio nuevo', 2026, m.ejercicioVigente(enero, dia(2026, 1, 1)))
  caso('el 31 de diciembre todavía es el viejo', 2025, m.ejercicioVigente(enero, dia(2025, 12, 31)))
  caso('en agosto sigue siendo el de este año', 2026, m.ejercicioVigente(enero, dia(2026, 8, 23)))

  /*
   * --- Renovación en septiembre, que también las hay.
   * El 23 de agosto de 2026 el ejercicio en curso es el 2025: arrancó en
   * septiembre de 2025 y no se cierra hasta septiembre de 2026.
   */
  const septiembre = { dia: 1, mes: 9 }
  caso('con renovación en septiembre, en agosto es el año anterior', 2025, m.ejercicioVigente(septiembre, dia(2026, 8, 23)))
  caso('y el 1 de septiembre pasa al siguiente', 2026, m.ejercicioVigente(septiembre, dia(2026, 9, 1)))

  // --- El bug de la captura, escrito como prueba: agosto de 2026 NO es 2027.
  caso('en agosto de 2026 no se propone el ejercicio 2027', 2026, m.ejercicioVigente(enero, dia(2026, 8, 23)))

  // --- Un día que no existe en ese mes se recorta, no se desborda al siguiente.
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  caso('el 31 de un mes de 30 es el 30', '2026-04-30', iso(m.inicioDeEjercicio(2026, { dia: 31, mes: 4 })))
  caso('el 29 de febrero de un año normal es el 28', '2026-02-28', iso(m.inicioDeEjercicio(2026, { dia: 29, mes: 2 })))
  caso('y en bisiesto sí es el 29', '2028-02-29', iso(m.inicioDeEjercicio(2028, { dia: 29, mes: 2 })))

  /*
   * --- Lo guardado puede venir de antes de que existiera este ajuste.
   * `undefined` llegaría hasta `new Date` sin protestar, y el ejercicio entero
   * saldría de una fecha que nadie ha pedido.
   */
  caso('sin ajuste guardado, el 1 de enero', { dia: 1, mes: 1 }, m.renovacionValida(undefined))
  caso('un mes 0 no existe', { dia: 1, mes: 1 }, m.renovacionValida({ dia: 1, mes: 0 }))
  caso('un mes 13 tampoco', { dia: 1, mes: 12 }, m.renovacionValida({ dia: 1, mes: 13 }))
  caso('un día 45 se recorta a 31', { dia: 31, mes: 3 }, m.renovacionValida({ dia: 45, mes: 3 }))
  caso('a medio teclear no rompe', { dia: 1, mes: 1 }, m.renovacionValida({ dia: NaN, mes: NaN }))

  // --- Y los ajustes de la hermandad lo traen siempre puesto.
  const aj = await cargar('src/lib/ajustesCuotas.ts')
  caso('los ajustes traen la renovación', { dia: 1, mes: 1 }, aj.getAjustesCuotas().renovacion)

  // --- La pantalla: que no vuelva a inventarse un concepto ni un ejercicio.
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/pages/app/Cuotas.tsx', 'utf8')
  caso('el ejercicio sale de la renovación, no de la campaña', true, /ejercicioVigente\(ajustes\.renovacion\)/.test(src))
  // Por el nombre no vale: el comentario del arreglo lo menciona a propósito.
  // Lo que no puede quedar es la importación, que es la que permite usarlo.
  caso('Cuotas ya no importa la campaña', false, /import .*from '\.\.\/\.\.\/lib\/campana'/.test(src))
  caso('no se inventa «Cuota anual»', false, /setConceptoEmision\(conceptoAnual\?\.nombre \?\? /.test(src))
  // El importe sale del concepto elegido, no del primero del catálogo.
  caso('el importe es el del concepto elegido', true, /const importeConceptoEmision = conceptoElegido\?\.importe \?\? 0/.test(src))
  caso('y sin concepto no se emite', true, /if \(!ejercicioValido \|\| !conceptoElegido\) return/.test(src))
  // La fecha de cobro es el día de la renovación, no «hoy + 15».
  caso('se cobra el día de la renovación', true, /fechaCobro: formatearFechaInput\(isoLocal\(fechaCobroDelEjercicio\)\)/.test(src))
  // Y el desplegable enseña siempre una opción que existe.
  caso('el desplegable dice cuando no hay conceptos', true, /Sin conceptos configurados/.test(src))
}

/**
 * Auditoría 2026-08 · Que una remesa no se cobre dos veces.
 *
 * Descargar el XML no dejaba ningún rastro: el recibo seguía «Pendiente» y
 * domiciliado, así que a la semana siguiente volvía a entrar en la remesa.
 * Dos ficheros al banco con los mismos recibos son dos cargos al mismo
 * hermano, y el segundo vuelve devuelto con comisión.
 */
async function remesaSinCobrarDosVeces({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/pages/app/Cuotas.tsx', 'utf8')

  // Lo que ya salió en un fichero no entra otra vez por su cuenta.
  caso('la remesa excluye lo ya remesado', true, /if \(c\.remesadaEl\) return false/.test(src))
  // Y al descargar queda marcado.
  caso('al descargar el XML queda el rastro', true, /remesadaEl: hoy/.test(src))
  // Con salida, porque descargar no es mandar: se descarga, se ve la fecha
  // mal, se borra y se rehace. Sin salida se quedarían fuera para siempre.
  caso('se pueden devolver a la remesa', true, /function soltarRemesados/.test(src))
  caso('y se avisa de que solo si no se mandó', true, /NO llegó a mandarse al banco/.test(src))

  // «Simular cobro» daba por cobrada una remesa entera sin que entrara un euro.
  caso('«Simular cobro» solo en modo demostración', true,
    /\{hayDatosDeEjemplo\(\) && \(\s*<button className="btn btn-outline" onClick=\{simularCobro\}/.test(src))

  // El catálogo de cuotas de ejemplo no puede emitir un ejercicio.
  caso('no se emite sin catálogo de la hermandad', true, /const catalogoListo = conceptosCuota\.length > 0/.test(src))
  caso('y el aviso de nuevo ejercicio lo respeta', true, /hayNuevoEjercicio =\s*\n\s*catalogoListo &&/.test(src))

  // Y la columna tiene que existir en la base de datos.
  const sql = await readFile('supabase/remesas.sql', 'utf8')
  caso('hay SQL para la columna', true, /add column if not exists remesada_el/.test(sql))

  // El mapeo de ida y vuelta, para que no se pierda al guardar.
  const db = await readFile('src/lib/db/cuotas.ts', 'utf8')
  caso('se guarda en la base de datos', true, /remesada_el: c\.remesadaEl/.test(db))
  caso('y se vuelve a leer', true, /remesadaEl: \(r\.remesada_el/.test(db))

  await cargar('src/data/cuotas.ts')
}
