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

  await elBlancoDelCristal({ caso })
}

/**
 * EL BLANCO DEL CRISTAL OSCURO, ATADO AL CRISTAL OSCURO.
 *
 * La pantalla de entrar va sobre un fondo granate oscuro y sus textos son un
 * blanco casi puro. El problema no era ese blanco: era que estaba puesto como
 * color POR DEFECTO de clases con nombre genérico —`.checkbox`, `.field
 * label`— y solo se le devolvía el color del tema dentro de `.settings-card`
 * y `.dash`.
 *
 * El área del hermano no es ninguna de las dos. Así que allí los títulos de
 * «Qué quiero recibir» salían en blanco sobre blanco: invisibles, mientras
 * que sus explicaciones —que traen color propio— se leían perfectamente. Sin
 * un error, sin un aviso, y sin que ninguna prueba pudiera verlo, porque las
 * de contraste solo miraban los colores que elige la hermandad para su web.
 *
 * La regla, ahora: quien use ese blanco tiene que decir sobre qué fondo va.
 * Lo legible es lo de fábrica y lo oscuro es la excepción, no al revés, para
 * que la pantalla que se añada mañana herede lo que se lee.
 */
async function elBlancoDelCristal({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile('src/styles/global.css', 'utf8')
  const lineas = css.split('\n')

  // El fondo oscuro se nombra así en los selectores que lo llevan.
  const esDelCristal = (sel) => /\.auth|\.glass-panel|\.entrada-|\.demo-/.test(sel)

  const sueltos = []
  lineas.forEach((l, i) => {
    if (!l.includes('244, 236, 255')) return
    // El selector es esta misma línea si abre bloque, o el último que lo abrió.
    let sel = l
    if (!l.includes('{')) {
      for (let j = i; j >= 0; j--) if (lineas[j].includes('{')) { sel = lineas[j]; break }
    }
    sel = sel.split('{')[0].trim()
    if (!esDelCristal(sel)) sueltos.push(sel)
  })
  caso('ningún blanco del cristal se queda suelto', '', sueltos.join(' · '))

  // Y las dos que fallaron, por su nombre: que lo de fábrica sea lo legible.
  const regla = (sel) => (lineas.find((l) => l.trim().startsWith(sel + ' ')) ?? '')
  caso('el checkbox nace con el color del tema', true, /color: var\(--text\)/.test(regla('.checkbox')))
  caso('y la etiqueta de formulario también', true, /color: var\(--text\)/.test(regla('.field label')))
}
