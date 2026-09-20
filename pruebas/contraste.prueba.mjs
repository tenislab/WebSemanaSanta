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
  await ningunTokenInventado({ caso })
  await laTintaSobreElOro({ cargar, caso })
  await lasInicialesDelAvatar({ cargar, caso })
}

/*
 * LAS INICIALES DEL AVATAR, CON LOS SEIS TONOS Y EN LOS DOS TEMAS.
 *
 * El avatar de cada fila del censo se tiñe con un color sacado del NOMBRE, así
 * que el contraste de sus iniciales cambia con cada hermano: medidos en el
 * navegador en tema oscuro salían desde 3,47:1 hasta 2,67:1, o sea que a unos
 * cuantos hermanos les quedaban por debajo del mínimo de 3:1 y a otros no. Un
 * fallo que solo le pasa a algunos nombres es el que nadie reproduce.
 *
 * SE RECORREN LOS SEIS TONOS, no se muestrea: `tonoDe` elige de una lista
 * cerrada de seis, así que el peor caso se puede calcular entero.
 *
 * Y se rehace la cuenta del CSS aquí: el fondo es el tono al 15 % sobre
 * `--bg-sunken` y la tinta el tono al 60 % sobre `--text`, que es lo que hacen
 * los dos `color-mix(in srgb, …)` de `.row-avatar`. Los porcentajes se LEEN
 * del CSS, no se copian: si alguien los cambia, esta prueba mide los nuevos.
 */
async function lasInicialesDelAvatar({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile('src/styles/global.css', 'utf8')
  const m = await cargar('src/lib/contraste.ts')
  const ficha = await cargar('src/lib/hermanoFicha.ts')

  function bloqueDe(selector) {
    const i = css.indexOf(selector)
    if (i < 0) return null
    const abre = css.indexOf('{', i)
    let nivel = 0
    for (let j = abre; j < css.length; j += 1) {
      if (css[j] === '{') nivel += 1
      else if (css[j] === '}') { nivel -= 1; if (nivel === 0) return css.slice(abre + 1, j) }
    }
    return null
  }
  const claro = bloqueDe(':root {')
  const oscuro = bloqueDe(":root[data-theme='dark']")
  function valor(token, bloque) {
    for (let i = 0; i < 10; i += 1) {
      const enBloque = [...bloque.matchAll(new RegExp(`${token}:\\s*([^;]+);`, 'g'))].pop()
      const enRaiz = [...claro.matchAll(new RegExp(`${token}:\\s*([^;]+);`, 'g'))].pop()
      const hallado = enBloque ?? enRaiz
      if (!hallado) return null
      const bruto = hallado[1].trim()
      const dentro = bruto.match(/^var\((--[\w-]+)\)$/)
      if (!dentro) return bruto
      token = dentro[1]
    }
    return null
  }

  /*
   * Los dos porcentajes, leídos del CSS de `.row-avatar`.
   *
   * Y con `[\s\S]*?` y no `[^)]*?`: dentro del `color-mix` hay un
   * `var(--tono, var(--text-muted))`, así que un «cualquier cosa menos un
   * paréntesis» se para en el cierre de ese `var` y no llega nunca al `15%`.
   * La primera versión de esta línea salió roja justo por eso.
   */
  const regla = bloqueDe('.row-avatar {') ?? ''
  const pctFondo = Number(regla.match(/background:\s*color-mix\(in srgb,[\s\S]*?(\d+)%/)?.[1])
  const pctTinta = Number(regla.match(/(?:^|;|\s)color:\s*color-mix\(in srgb,[\s\S]*?(\d+)%/)?.[1])
  // Y se afirman los DOS números, no solo que se hayan leído: así, si el
  // recorte volviera a pillar el número de un comentario, se vería.
  caso('se leen los dos porcentajes de .row-avatar', [15, 60], [pctFondo, pctTinta])

  const aRgb = (hex) => {
    const h = hex.replace('#', '')
    const c = h.length === 3 ? [...h].map((x) => x + x).join('') : h
    return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16))
  }
  const aHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  // `color-mix(in srgb, A p%, B)` es una mezcla lineal en sRGB.
  const mezclar = (a, p, b) => {
    const [ra, ga, ba] = aRgb(a), [rb, gb, bb] = aRgb(b)
    const f = p / 100
    return aHex([ra * f + rb * (1 - f), ga * f + gb * (1 - f), ba * f + bb * (1 - f)])
  }

  /*
   * Y QUE LA LISTA LLEGUE. `TONOS` no estaba exportado, y sin esta línea el
   * bucle de abajo recorría cero tonos y el guardia salía VERDE sin haber
   * medido nada: un guardia vacío es peor que ninguno, porque se cuenta.
   */
  caso('llegan los seis tonos del avatar', 6, (ficha.TONOS ?? []).length)

  const flojos = []
  for (const [tema, bloque] of [['claro', claro], ['oscuro', oscuro]]) {
    const hundido = valor('--bg-sunken', bloque)
    const tinta = valor('--text', bloque)
    for (const tono of ficha.TONOS ?? []) {
      const fondo = mezclar(tono.fondo, pctFondo, hundido)
      const letra = mezclar(tono.fondo, pctTinta, tinta)
      const c = m.contraste(letra, fondo)
      if (c < 3) flojos.push(`${tono.fondo} en ${tema}: ${c.toFixed(2)}:1`)
    }
  }
  caso('los seis tonos se leen en los dos temas', [], flojos)
}

/*
 * LO QUE SE ESCRIBE ENCIMA DEL ORO TIENE QUE LEERSE EN LOS DOS TEMAS.
 *
 * `--gold` NO es el mismo color en los dos: en claro es `--oro-700`, oscuro; en
 * oscuro es `--oro-300`, claro. Así que un `color: #fff` sobre `background:
 * var(--gold)` se lee en uno y no en el otro, y quien lo escribe está mirando
 * uno de los dos.
 *
 * Pasó en la chapa del paso en curso de la guía de primeros pasos: blanco sobre
 * oro, 4,12:1 en claro y **1,84:1 en oscuro**. El número del paso en el que
 * estás es el único dato que lleva esa chapa, y en tema oscuro no se leía.
 *
 * ESTA PRUEBA NO LEE LA LÍNEA DEL ARREGLO: resuelve los dos oros y calcula. Se
 * exige 4,5:1 porque es texto pequeño —0,78rem en negrita, dentro de un círculo
 * de 26 px—, no un titular. El día que los oros cambien, la prueba lo sabrá.
 *
 * Y se comprueba a la vez que el arreglo bueno —una tinta oscura, la misma que
 * ya usaba `.tramo-ficha__num`— sirve para los dos, que es la razón de elegirla
 * en vez de dos colores, uno por tema.
 */
async function laTintaSobreElOro({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile('src/styles/global.css', 'utf8')
  const m = await cargar('src/lib/contraste.ts')

  function bloqueDe(selector) {
    const i = css.indexOf(selector)
    if (i < 0) return null
    const abre = css.indexOf('{', i)
    let nivel = 0
    for (let j = abre; j < css.length; j += 1) {
      if (css[j] === '{') nivel += 1
      else if (css[j] === '}') { nivel -= 1; if (nivel === 0) return css.slice(abre + 1, j) }
    }
    return null
  }
  const claro = bloqueDe(':root {')
  const oscuro = bloqueDe(":root[data-theme='dark']")
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

  const oroClaro = valor('--gold', claro)
  const oroOscuro = valor('--gold', oscuro)
  // Si esto no resolviera, todo lo de abajo compararía vacío contra vacío.
  caso('los dos oros se resuelven, y son distintos', true,
    Boolean(oroClaro && oroOscuro) && oroClaro !== oroOscuro)

  /*
   * Todas las reglas que ponen algo encima de un fondo de oro, sacadas del
   * CSS y no escritas a mano: así entra sola la próxima que alguien escriba.
   */
  const sobreOro = [...css.matchAll(/\{([^}]*background:\s*var\(--gold\)[^}]*)\}/g)]
    .map((bl) => {
      const trozo = bl[1]
      const col = trozo.match(/(?:^|;|\s)color:\s*([^;]+)/)
      const desde = css.lastIndexOf('\n', bl.index) + 1
      const selector = css.slice(desde, css.indexOf('{', bl.index)).trim().slice(-58)
      return col ? { selector, tinta: col[1].trim() } : null
    })
    .filter(Boolean)

  caso('hay al menos una regla que escribe sobre el oro', true, sobreOro.length > 0)

  const flojas = []
  for (const { selector, tinta } of sobreOro) {
    // `var(--x, #reserva)` → se mide la reserva, que es lo que aplica cuando
    // el token no está definido en la raíz.
    const hex = tinta.match(/#[0-9a-fA-F]{3,8}/)?.[0]
      ?? (tinta.startsWith('var(') ? valor(tinta.match(/--[\w-]+/)[0], claro) : tinta)
    if (!hex) continue
    for (const [tema, oro] of [['claro', oroClaro], ['oscuro', oroOscuro]]) {
      const c = m.contraste(hex, oro)
      if (c < 4.5) flojas.push(`${selector} en ${tema}: ${c.toFixed(2)}:1 (${hex} sobre ${oro})`)
    }
  }
  caso('nada escrito sobre el oro baja de 4,5:1 en ninguno de los dos temas', [], flojas)

  /*
   * Y EL PORQUÉ DE LA TINTA ELEGIDA, con los tres candidatos medidos, porque
   * la diferencia entre ellos no se ve mirándolos:
   *
   *   #ffffff  (lo que estaba)      claro 4,12:1   oscuro  1,84:1   no vale
   *   #2a1b14  (el de al lado)      claro 4,03:1   oscuro  9,02:1   no vale
   *   #1a1207  (la elegida)         claro 4,50:1   oscuro 10,07:1   vale
   *
   * `#2a1b14` es el caso que enseña para qué sirve medir: es oscuro, parece
   * seguro, y en tema CLARO se queda por debajo del blanco al que sustituía.
   * Lo escribí como arreglo y este guardia lo tumbó.
   */
  caso('la tinta elegida vale para el oro claro', true, m.contraste('#1a1207', oroClaro) >= 4.5)
  caso('y para el oro oscuro', true, m.contraste('#1a1207', oroOscuro) >= 4.5)
  // El blanco, que es lo que estaba, NO vale para los dos: por eso se cambió.
  caso('el blanco no valía para los dos', false,
    m.contraste('#ffffff', oroClaro) >= 4.5 && m.contraste('#ffffff', oroOscuro) >= 4.5)
  // Ni el que parecía valer.
  caso('ni el #2a1b14 que parecía valer', false, m.contraste('#2a1b14', oroClaro) >= 4.5)
}

/*
 * NINGÚN `var()` SOBRE UN TOKEN QUE NO EXISTE, SALVO CON VALOR DE RESERVA.
 *
 * `border: 1px solid var(--noExiste)` no deja un borde por defecto: INVALIDA
 * LA DECLARACIÓN ENTERA. Es una trampa que este repositorio ya tiene escrita en
 * `docs/COMO-TRABAJAR.md`, y aun así había cuatro tokens inventados sueltos
 * —`--linea` por `--line`, `--surface` por `--bg-sunken`, `--text-soft` por
 * `--text-muted` y `--shadow-sm` por `--glass-shadow`—, los mismos nombres en
 * inglés y en español y uno en singular. Dieciséis declaraciones en seis
 * pantallas: sin borde, sin fondo y sin sombra, no «con otro».
 *
 * Y no era cosmético: la descripción de cada estilo de la web pedía
 * `color: var(--text-soft)`, se caía la declaración, heredaba el negro que
 * trae un `<button>` por defecto, y en tema oscuro quedaba en NEGRO SOBRE CASI
 * NEGRO —1,32:1 medido en el navegador—. Texto invisible.
 *
 * EL VALOR DE RESERVA SÍ VALE, y hay tres así a propósito: `var(--err,
 * #b3261e)`, `var(--radio-sm, 8px)` y `var(--sans-fallback, inherit)`. Ahí el
 * token no existe y no importa, porque la reserva aplica. Así que lo que se
 * exige no es «que todos existan» sino «que el que no exista traiga reserva»,
 * que es la regla de verdad.
 *
 * Se cuentan también los tokens que se definen desde JavaScript —el sitio pone
 * `--sitio-*` y `--e1`/`--e2` con `style=`—, porque esos existen en el
 * navegador aunque no estén en la hoja.
 */
async function ningunTokenInventado({ caso }) {
  const { readFile, readdir } = await import('node:fs/promises')
  const css = await readFile('src/styles/global.css', 'utf8')

  // Definidos en la hoja: cualquier `--x:` (en `:root`, en un tema, o al vuelo).
  const definidos = new Set([...css.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]))

  // Y los que se ponen desde el código, que en el navegador existen igual.
  const pilas = ['src']
  while (pilas.length) {
    const d = pilas.pop()
    for (const e of await readdir(d, { withFileTypes: true })) {
      const ruta = `${d}/${e.name}`
      if (e.isDirectory()) { pilas.push(ruta); continue }
      if (!/\.(ts|tsx)$/.test(e.name)) continue
      const t = await readFile(ruta, 'utf8')
      for (const m of t.matchAll(/'(--[a-zA-Z0-9-]+)'/g)) definidos.add(m[1].slice(2))
      for (const m of t.matchAll(/"(--[a-zA-Z0-9-]+)"/g)) definidos.add(m[1].slice(2))
      for (const m of t.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) definidos.add(m[1].slice(2))
    }
  }

  /*
   * Cada `var(...)`, con su coma si la trae. `[^)]*` basta porque un valor de
   * reserva con paréntesis dentro —`var(--a, var(--b))`— también lleva la coma
   * antes, que es lo único que se mira.
   */
  const inventados = []
  for (const m of css.matchAll(/var\(\s*--([a-zA-Z0-9-]+)([^)]*)\)/g)) {
    const nombre = m[1]
    const tieneReserva = m[2].includes(',')
    if (definidos.has(nombre) || tieneReserva) continue
    const linea = css.slice(0, m.index).split('\n').length
    inventados.push(`--${nombre} (línea ${linea})`)
  }
  caso('ningún var() sobre un token inventado y sin reserva', [], inventados)

  // Y los cuatro que había, uno a uno, por su nombre: leer «[]» en verde no
  // dice cuál era el fallo, y estos cuatro volverán a escribirse solos.
  for (const [malo, bueno] of [['linea', 'line'], ['surface', 'bg-sunken'],
    ['text-soft', 'text-muted'], ['shadow-sm', 'glass-shadow']]) {
    caso(`--${malo} ya no se usa (es --${bueno})`, false,
      new RegExp(`var\\(--${malo}[,)]`).test(css))
    caso(`y --${bueno} existe de verdad`, true, definidos.has(bueno))
  }
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
