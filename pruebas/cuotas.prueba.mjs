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

  await remesaSinCobrarDosVeces({ cargar, caso })
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
