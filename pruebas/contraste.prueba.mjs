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
  await elEscudoSeVeSobreSuCaja({ cargar, caso })
}

/*
 * EL ESCUDO DE LA HERMANDAD, INVISIBLE EN LOS OCHO DOCUMENTOS QUE SE IMPRIMEN.
 *
 * La cabecera del recibo, del certificado, de la factura, del justificante, del
 * estado de cuentas, de la cuenta de resultados, de la memoria y del informe
 * lleva un recuadro con el escudo. Si la hermandad no ha subido el suyo, ahí va
 * el nazareno de la marca, y el recuadro es MORADO con el trazo en ORO: por eso
 * `.recibo-doc__logo` pone `background: var(--morado-700)` y
 * `color: var(--oro-300)`.
 *
 * Pero `.logo-mark` trae su propio `color: var(--accent)`, que gana por ser una
 * regla sobre el propio elemento. Y `--accent`, en tema claro, ES
 * `var(--morado-700)`: el mismo hexadecimal que el fondo de esa caja. El trazo
 * no es que se viera poco — no se veía en absoluto, y donde va el escudo salía
 * un cuadrado morado macizo. En los ocho papeles que la hermandad sella y
 * entrega.
 *
 * En tema oscuro `--accent` es oro, así que allí se veía bien. Lo mismo que el
 * zigzag de los desplegables: mal en un contexto de dos, y quien mira mira uno.
 *
 * ESTA PRUEBA NO LEE LA LÍNEA DEL ARREGLO: calcula. Resuelve los colores de los
 * dos temas y mira si el que tendría el trazo SIN el arreglo choca con su
 * fondo; solo entonces exige el arreglo. Así, el día que `--accent` deje de ser
 * morado, la prueba lo sabe y deja de pedir nada.
 */
async function elEscudoSeVeSobreSuCaja({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile('src/styles/global.css', 'utf8')
  const m = await cargar('src/lib/contraste.ts')

  /*
   * El bloque de un selector, cerrando POR LLAVES y no por un número de
   * caracteres a bulto. La primera versión cogía tres mil caracteres desde
   * `:root {` y se metía dentro del bloque del tema oscuro que viene detrás:
   * `--accent` resolvía a oro en tema claro, o sea al revés, y la prueba decía
   * que todo estaba bien.
   */
  function bloqueDe(selector) {
    const i = css.indexOf(selector)
    if (i < 0) return null
    const abre = css.indexOf('{', i)
    let nivel = 0
    for (let j = abre; j < css.length; j += 1) {
      if (css[j] === '{') nivel += 1
      else if (css[j] === '}') {
        nivel -= 1
        if (nivel === 0) return css.slice(abre + 1, j)
      }
    }
    return null
  }

  const claro = bloqueDe(':root {')
  const oscuro = bloqueDe(":root[data-theme='dark']")

  /*
   * El valor de un token, siguiendo los `var(...)` hasta llegar a un color. Se
   * busca primero en el bloque del tema y luego en `:root`: el tema oscuro dice
   * `--accent: var(--oro-300)` y `--oro-300` solo está definido en la raíz, que
   * es como funciona la cascada de verdad.
   */
  function valor(token, bloque) {
    for (let i = 0; i < 10; i += 1) {
      const enBloque = [...bloque.matchAll(new RegExp(`${token}:\\s*([^;]+);`, 'g'))].pop()
      const enRaiz = [...claro.matchAll(new RegExp(`${token}:\\s*([^;]+);`, 'g'))].pop()
      const encontrado = enBloque ?? enRaiz
      if (!encontrado) return null
      const bruto = encontrado[1].trim()
      const dentro = bruto.match(/^var\((--[\w-]+)\)$/)
      if (!dentro) return bruto
      token = dentro[1]
    }
    return null
  }

  caso('se encuentran los dos temas en el CSS', true, Boolean(claro && oscuro))
  // Y se resuelven de verdad: si `valor` devolviera nulo, todo lo de abajo
  // compararía vacío contra vacío y pasaría sin comprobar nada.
  caso('los colores se resuelven', ['#6a1a23', '#d6bc8a'],
    [valor('--accent', claro), valor('--accent', oscuro)])

  const arregloPuesto = /\.recibo-doc__logo\s+\.logo-mark\s*\{[^}]*color:\s*inherit/.test(css)

  for (const [nombre, bloque] of [['claro', claro], ['oscuro', oscuro]]) {
    // El fondo de la caja sale del bloque claro: no lo redefine ningún tema.
    const fondo = valor('--morado-700', claro)
    const sinArreglo = valor('--accent', bloque)
    const contraste = m.contraste(sinArreglo, fondo)
    /*
     * Si sin el arreglo el trazo se distinguiría del fondo, no hay nada que
     * pedir. Si no, el arreglo TIENE que estar: es la única cosa que separa un
     * escudo de un borrón en un papel que ya está repartido.
     */
    if (contraste < 3) {
      caso(`en tema ${nombre} el escudo no se puede quedar del color de su caja`, true, arregloPuesto)
    } else {
      caso(`en tema ${nombre} el trazo ya se distingue de su caja`, true, contraste >= 3)
    }
  }

  // Y con el arreglo puesto, el trazo hereda el color de la caja: oro sobre
  // morado, que es la pareja que se pensó y se lee en los dos temas.
  const oro = valor('--oro-300', claro)
  const morado = valor('--morado-700', claro)
  caso('el oro sobre el morado de la caja se distingue', true, m.contraste(oro, morado) >= 3)
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
