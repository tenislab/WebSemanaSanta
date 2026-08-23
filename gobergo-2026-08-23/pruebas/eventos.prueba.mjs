/** Repeticiones de eventos: lo que se calcula al vuelo para el calendario. */
export default async function ({ cargar, caso }) {
  const { aparicionesEntre } = await cargar('src/data/eventos.ts')
  const ev = (fecha, tipo, cada = 1, hasta = '') => ({
    id: 'x', titulo: 't', fecha, tipo: 'Culto', tareas: [], repeticion: { tipo, hasta, cada },
  })
  const fechas = (e, d, h) => aparicionesEntre(e, d, h).map((a) => a.fecha)

  caso('diario: sigue saliendo trece meses después', 28,
    aparicionesEntre(ev('2026-01-01', 'diaria'), '2027-02-01', '2027-02-28').length)
  caso('semanal: empezado hace ocho años, sigue saliendo', true,
    aparicionesEntre(ev('2020-01-01', 'semanal'), '2028-01-01', '2028-01-31').length >= 4)
  caso('mensual el 31: se recorta al último día del mes',
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
    fechas(ev('2026-01-31', 'mensual'), '2026-01-01', '2026-04-30'))
  caso('anual el 29 de febrero: vuelve al 29 en el bisiesto',
    ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'],
    fechas(ev('2024-02-29', 'anual'), '2024-01-01', '2028-12-31'))
  caso('la vuelta 0 es la original', 0,
    aparicionesEntre(ev('2026-03-10', 'semanal'), '2026-03-01', '2026-03-31')[0].vuelta)
  caso('las vueltas se siguen numerando bien tras el salto', 52,
    aparicionesEntre(ev('2026-01-07', 'semanal'), '2027-01-06', '2027-01-06')[0].vuelta)
  caso('respeta la fecha de fin', ['2026-03-02', '2026-03-09'],
    fechas(ev('2026-03-02', 'semanal', 1, '2026-03-10'), '2026-03-01', '2026-03-31'))
  caso('antes de empezar no sale', [], fechas(ev('2026-06-01', 'semanal'), '2026-01-01', '2026-01-31'))
  caso('cada dos semanas', ['2026-03-02', '2026-03-16', '2026-03-30'],
    fechas(ev('2026-03-02', 'semanal', 2), '2026-03-01', '2026-03-31'))
  caso('cada tres meses', ['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15'],
    fechas(ev('2026-01-15', 'mensual', 3), '2026-01-01', '2026-12-31'))
  caso('sin repetición, solo si cae dentro', ['2026-05-05'],
    fechas({ id: 'x', titulo: 't', fecha: '2026-05-05', tipo: 'Culto', tareas: [] }, '2026-05-01', '2026-05-31'))
  caso('sin repetición, fuera de la ventana no sale', [],
    fechas({ id: 'x', titulo: 't', fecha: '2026-05-05', tipo: 'Culto', tareas: [] }, '2026-06-01', '2026-06-30'))
}
