/**
 * CUÁNDO CAE LA SEMANA SANTA.
 *
 * La portada de Gobergo enseña la cuenta atrás hasta el Domingo de Ramos que
 * viene. Es el detalle que más dice «esto lo ha hecho alguien del mundo
 * cofrade»… y también el que peor queda si falla: una página que vende
 * software cofrade y anuncia el Domingo de Ramos en la fecha equivocada se
 * descalifica sola.
 *
 * Por eso no hay tabla de fechas apuntadas a mano —caducaría— sino el cómputo
 * gregoriano de siempre. Y por eso esta prueba lo contrasta con años reales,
 * incluidos los dos extremos posibles: la Pascua puede caer entre el 22 de
 * marzo y el 25 de abril, y son justo esos bordes donde un cálculo mal escrito
 * se rompe.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/semanaSanta.ts')

  // --- El Domingo de Resurrección, contra años que se pueden comprobar ---
  caso('Pascua de 2024', '2024-03-31', m.domingoDePascua(2024))
  caso('Pascua de 2025', '2025-04-20', m.domingoDePascua(2025))
  caso('Pascua de 2026', '2026-04-05', m.domingoDePascua(2026))
  caso('Pascua de 2027', '2027-03-28', m.domingoDePascua(2027))
  caso('Pascua de 2028', '2028-04-16', m.domingoDePascua(2028))
  caso('Pascua de 2030', '2030-04-21', m.domingoDePascua(2030))
  // Los dos extremos del rango, que es donde se rompen los cálculos mal hechos.
  caso('la más temprana posible (1818)', '1818-03-22', m.domingoDePascua(1818))
  caso('la más tardía posible (1943)', '1943-04-25', m.domingoDePascua(1943))

  // Y que SIEMPRE cae en domingo, mirando un siglo entero. Si el cómputo se
  // desviara un día, esto lo caza aunque los años de arriba pasaran.
  let noDomingos = 0
  for (let anio = 2000; anio <= 2100; anio += 1) {
    if (new Date(`${m.domingoDePascua(anio)}T00:00:00Z`).getUTCDay() !== 0) noDomingos += 1
  }
  caso('cien años de Pascuas, todas en domingo', 0, noDomingos)

  // --- Lo que cuelga de ella ---
  const f = m.fechasDeSemanaSanta(2027)
  caso('el Domingo de Ramos es una semana antes', '2027-03-21', f.ramos)
  caso('el Jueves Santo, tres días antes', '2027-03-25', f.juevesSanto)
  caso('el Viernes Santo, dos', '2027-03-26', f.viernesSanto)
  caso('el Sábado Santo, uno', '2027-03-27', f.sabadoSanto)
  // La Cuaresma son cuarenta días sin contar los domingos: 46 hacia atrás.
  caso('y el Miércoles de Ceniza, cuarenta y seis', '2027-02-10', f.ceniza)
  caso('el Ramos siempre es domingo', 0,
    new Date(`${f.ramos}T00:00:00Z`).getUTCDay())
  caso('y la Ceniza siempre es miércoles', 3,
    new Date(`${f.ceniza}T00:00:00Z`).getUTCDay())

  // --- La cuenta atrás ---
  caso('desde el día antes falta uno', 1, m.diasHasta('2027-03-21', new Date('2027-03-20T10:00:00')))
  caso('el mismo día no falta nada', 0, m.diasHasta('2027-03-21', new Date('2027-03-21T23:00:00')))
  caso('pasado, sale en negativo', -3, m.diasHasta('2027-03-21', new Date('2027-03-24T01:00:00')))

  /*
   * EL CORTE ENTRE UNA SEMANA SANTA Y LA SIGUIENTE, que es donde estaba la
   * trampa. Mientras la de este año no haya TERMINADO sigue siendo la que
   * viene: cortando por el Domingo de Ramos, el Jueves Santo por la mañana la
   * portada diría «faltan 361 días» con las cofradías en la calle. Justo el día
   * del año en que más gente entra a mirar.
   */
  caso('en enero, la de este año', 2027, m.proximaSemanaSanta(new Date('2027-01-15T12:00:00')).anio)
  caso('el Jueves Santo, sigue siendo la de este año', 2027,
    m.proximaSemanaSanta(new Date('2027-03-25T09:00:00')).anio)
  caso('y ese día la cuenta atrás ya ha pasado', -4,
    m.proximaSemanaSanta(new Date('2027-03-25T09:00:00')).faltan)
  caso('pasada la Pascua, salta a la siguiente', 2028,
    m.proximaSemanaSanta(new Date('2027-03-29T09:00:00')).anio)
  caso('y en mayo también', 2028, m.proximaSemanaSanta(new Date('2027-05-02T12:00:00')).anio)

  // --- Cómo se escriben ---
  caso('en palabras', '21 de marzo', m.enPalabras('2027-03-21'))
  caso('en corto', '21 mar', m.enCorto('2027-03-21'))
  caso('lo que no es fecha se deja igual', '', m.enPalabras(''))
}
