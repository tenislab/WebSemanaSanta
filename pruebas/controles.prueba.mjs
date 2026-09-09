/**
 * QUE UN CONTROL NUEVO NAZCA VESTIDO.
 *
 * ============================================================================
 * EL FALLO, Y POR QUÉ NO ERA UN DESPISTE SUELTO
 * ============================================================================
 *
 * En la tabla de Personal, la casilla del cargo era EL DESPLEGABLE DE FÁBRICA
 * DEL NAVEGADOR: borde negro fino, flecha del sistema, esquinas cuadradas — al
 * lado de una tabla que no tiene ni un borde negro.
 *
 * No era ese desplegable. Era que NO EXISTÍA UNA REGLA BASE para `select`: el
 * estilo se ponía por contextos (`.form-row select`, `.assign-box select`,
 * `.banner-inline select`, `.masiva select`…), y eso funciona mientras todos
 * los controles vivan en uno de esos contextos. El día que aparece uno en un
 * sitio nuevo —una celda de tabla, por ejemplo— nace sin vestir.
 *
 * Y no canta lo bastante como para que nadie lo reporte: canta lo justo para
 * que la pantalla parezca descuidada sin que se sepa por qué.
 *
 * Es el mismo patrón que ya costó caro dos veces aquí: algo que se resuelve
 * caso por caso acaba teniendo un caso que nadie resolvió.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile('src/styles/global.css', 'utf8')

  // --- HAY SUELO, Y NO SOLO CONTEXTOS ---
  caso('los controles tienen una regla base', true,
    /\nselect,\n\s*textarea \{/.test(css) || /input:not\(\[type='checkbox'\]\)[\s\S]{0,200}?select,\n\s*textarea \{/.test(css))
  caso('y heredan la letra', true, /input, select, textarea, button \{[\s\S]{0,200}?font: inherit;/.test(css))

  const base = (css.match(/select,\n\s*textarea \{([\s\S]*?)\n\}/) ?? ['', ''])[1]
  caso('con el borde de la casa', true, /border: 1px solid var\(--line-strong\)/.test(base))
  caso('el radio de la casa', true, /border-radius: var\(--radius-sm\)/.test(base))
  caso('y el color del texto de la casa', true, /color: var\(--text\)/.test(base))
  /*
   * `min-width: 0` NO es adorno: un `<select>` mide lo que mide su opción más
   * larga, y sin esto se sale de su celda en cuanto alguien escribe un cargo
   * con nombre largo. Ya pasó una vez, con «Sin descuento» en la tienda.
   */
  caso('y no se sale de su hueco', true, /min-width: 0/.test(base))

  /*
   * --- Y NO SE TOCA EL FONDO. ESTA ES LA LECCIÓN CARA DE TODO EL FICHERO ---
   *
   * La primera versión ponía `appearance: none` y dibujaba su propio chevron
   * como imagen de fondo. Se veía perfecto en la tabla de Personal —que es
   * donde se probó— y ROMPÍA los desplegables del resto de la aplicación:
   * salían con el chevron REPETIDO en zigzag por todo el ancho, encima del
   * texto. Llegó reportado con una captura, desde producción.
   *
   * El porqué: las reglas de contexto (`.form-row select`, `.assign-box
   * select`…) redefinen el fondo con la FORMA CORTA, y una forma corta
   * reescribe TODAS sus propiedades — devolvía `background-repeat` a `repeat` y
   * `background-size` a `auto`, y el navegador se quedaba con la imagen de la
   * regla base y la tileaba.
   *
   * Y LO PEOR NO FUE EL FALLO, FUE QUE LAS PRUEBAS DABAN VERDE. Comprobaban
   * que el `appearance: none` estuviera escrito y que hubiera una flecha por
   * tema: todo eso era cierto y la pantalla estaba rota igual. Una prueba que
   * comprueba que una línea existe no comprueba lo que esa línea le hace al
   * resto de la hoja.
   *
   * Así que ahora se comprueba lo contrario: que el suelo NO entre en el fondo.
   * Es la regla que impide que vuelva a pasar, y no depende de acordarse de
   * mirar cinco contextos — que además serían seis en cuanto alguien escriba
   * el siguiente.
   */
  const bloqueSelect = (css.match(/\nselect \{([\s\S]*?)\n\}/) ?? ['', ''])[1]
  caso('el suelo no toca el fondo de los desplegables', [],
    Object.keys({ 'background-image': 1, 'background-repeat': 1, 'background-size': 1, 'background-position': 1 })
      .filter((prop) => new RegExp(`^\\s*${prop}:`, 'm').test(bloqueSelect)))
  caso('ni le quita la apariencia del sistema', false, /appearance/.test(bloqueSelect))
  /*
   * EL COLOR DE FONDO SÍ, LA IMAGEN NO. La diferencia es toda la lección: un
   * `background: var(--bg)` en el suelo es inofensivo —cualquier contexto lo
   * pisa entero y no queda nada colgando—, pero una IMAGEN puesta en el suelo
   * sobrevive a que el contexto reescriba el `repeat` y el `size`, y eso es lo
   * que tileaba el chevron por todo el ancho.
   */
  caso('el suelo pone color de fondo, que hace falta', true, /background: var\(--bg\)/.test(base))
  caso('pero ninguna imagen', false, /background-image/.test(base))

  // --- EL FOCO SE VE ---
  /*
   * Se quita el anillo del sistema, así que hay que poner otro: sin él, quien
   * navega con el teclado no sabe dónde está. Y es el MISMO que usan los
   * formularios del panel, para que no haya dos focos distintos.
   */
  caso('el foco se ve', true, /select:focus-visible,[\s\S]{0,120}?box-shadow: 0 0 0 3px var\(--ring\)/.test(css))
  caso('con el color de la casa', true, /select:focus-visible,[\s\S]{0,120}?border-color: var\(--gold\)/.test(css))
  // Y un control apagado lo parece, o se pulsa y no pasa nada.
  caso('un control apagado lo parece', true,
    /input:disabled, select:disabled, textarea:disabled \{[\s\S]{0,120}?cursor: not-allowed/.test(css))

  /*
   * --- Y ESTO NO PISA LO QUE YA HABÍA ---
   *
   * La regla base va con selector de ELEMENTO (especificidad 0,0,1), así que
   * cualquier regla con clase manda encima. Si se escribiera como `.app select`
   * o con `!important`, reventaría los estilos afinados de media aplicación —y
   * lo haría en sitios que nadie va a volver a mirar.
   */
  const conImportante = [...css.matchAll(/^(select|input|textarea)[^{]*\{([^}]*)\}/gm)]
    .filter((m) => /!important/.test(m[2]))
    .map((m) => m[1])
  caso('la regla base no usa !important', [], conImportante)
  // Y las de contexto siguen ahí: esto añade suelo, no sustituye nada.
  caso('las reglas de contexto siguen existiendo', true,
    /\.form-row input, \.form-row select, \.form-row textarea \{/.test(css))

  /*
   * --- NO SE TOCAN LAS CASILLAS NI LOS RADIOS ---
   *
   * Un `padding` y un `border-radius` puestos a un `checkbox` lo convierten en
   * un cuadrado gris sin marca visible. Se excluyen por su tipo, uno a uno, y
   * por eso el selector es tan largo.
   */
  caso('las casillas quedan fuera', true, /input:not\(\[type='checkbox'\]\)/.test(css))
  caso('los radios también', true, /:not\(\[type='radio'\]\)/.test(css))
  // Y el selector de color y el deslizador, que con borde y padding se rompen.
  caso('y el selector de color', true, /:not\(\[type='color'\]\)/.test(css))
  caso('y el deslizador', true, /:not\(\[type='range'\]\)/.test(css))


  /*
   * ==========================================================================
   * Y DOS COSAS QUE SOLO SE VIERON LEVANTANDO LA APLICACIÓN
   * ==========================================================================
   *
   * Las dos llevaban puestas desde siempre y ninguna prueba las tocaba, porque
   * no son un error: son cosas que se ven mal. Aparecieron al arrancar la
   * aplicación de verdad y mirar las pantallas, que es lo que no se había hecho
   * hasta ahora.
   */
  const shell = await readFile('src/components/AppShell.tsx', 'utf8')

  /*
   * 1. LA MARCA DE LA BARRA DE ARRIBA SALÍA SIEMPRE.
   *
   * En escritorio quedaba huérfana: un nazareno de 26 píxeles solo en una barra
   * blanca ancha, con la marca de verdad ya puesta justo encima en la barra
   * lateral. Dos veces la misma cosa, y la de arriba a un tamaño en el que el
   * dibujo se lee como un garabato.
   *
   * Va con el botón del menú: los dos existen para cuando la barra lateral está
   * escondida, y hasta ahora solo uno de los dos lo sabía.
   */
  caso('la marca de la barra de arriba se puede ocultar', true,
    /app-topbar__marca/.test(shell))
  caso('y está oculta salvo cuando no hay barra lateral', true,
    /\.app-topbar__marca \{ display: none; \}/.test(css))
  caso('con la misma regla que el botón del menú', true,
    /\.app-menu-btn \{ display: inline-flex; \}\n\s*\.app-topbar__marca \{ display: inline-flex; \}/.test(css))

  /*
   * 2. LAS ETIQUETAS DE ESTADO SE PARTÍAN EN DOS LÍNEAS.
   *
   * «Sin cuota emitida» cabía justo, y en la columna del censo se partía: esa
   * fila quedaba más alta que las demás. Con cincuenta filas seguidas, unas
   * altas y otras no, la tabla se lee escalonada sin que se sepa por qué.
   */
  const pill = (css.match(/\n\.pill \{([\s\S]*?)\n\}/) ?? ['', ''])[1]
  caso('una etiqueta de estado no se parte en dos líneas', true, /white-space: nowrap/.test(pill))
  // Y su punto de color no se encoge hasta volverse una raya.
  caso('y su punto no se encoge', true, /\.pill::before \{ flex: none; \}/.test(css))
}
