/** Legibilidad de los colores que elige la hermandad para su web. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/contraste.ts')
  const casi = (a, b) => Math.abs(a - b) < 0.05

  caso('negro sobre blanco es 21:1', true, casi(m.contraste('#000000', '#ffffff'), 21))
  caso('un color consigo mismo es 1:1', true, casi(m.contraste('#6A1A23', '#6A1A23'), 1))
  caso('acepta el # y sin él', true, casi(m.contraste('6A1A23', '#6A1A23'), 1))
  caso('acepta la forma corta', true, casi(m.contraste('#fff', '#000000'), 21))
  caso('un color inválido no revienta', true, Number.isFinite(m.contraste('rojo', '#fff')))
  caso('el burdeos sobre marfil se lee', true, m.contraste('#6A1A23', '#FAF6F0') >= 4.5)
  caso('el oro sobre blanco NO se lee', true, m.contraste('#C5A059', '#ffffff') < 4.5)
  caso('avisa del oro sobre fondo claro', true, m.avisosDeContraste('#C5A059', '#C5A059', 'claro').length > 0)
  caso('no avisa de una combinación buena', 0, m.avisosDeContraste('#6A1A23', '#8a6d2f', 'claro').length)
}
