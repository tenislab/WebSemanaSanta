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
}
