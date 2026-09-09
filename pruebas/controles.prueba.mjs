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
   * --- LA FLECHA, EN LOS DOS TEMAS ---
   *
   * `appearance: none` quita la del sistema, que es la que peor canta, y
   * obliga a poner una: sin ella el desplegable no parece un desplegable.
   *
   * Va como imagen de fondo y no como pseudo-elemento porque un `<select>` no
   * admite `::after` — el navegador dibuja su interior y no deja meter nada—.
   * Y por eso el color va DENTRO del SVG y hace falta una por tema: no se
   * puede sacar de una variable.
   */
  /*
   * SE MIRAN LAS DOS, la con prefijo y la sin él, y por separado.
   *
   * La primera versión de esto buscaba «appearance: none» dentro del bloque, y
   * pasaba en verde con `appearance: auto` puesto: lo que encontraba era el
   * `-webkit-appearance: none` de la línea siguiente. Una comprobación que se
   * conforma con que la palabra APAREZCA no comprueba nada.
   */
  const bloqueSelect = (css.match(/\nselect \{([\s\S]*?)\n\}/) ?? ['', ''])[1]
  caso('se quita la flecha del sistema', true, /(^|\n)\s*appearance: none;/.test(bloqueSelect))
  caso('y también en los navegadores con prefijo', true,
    /-webkit-appearance: none;/.test(bloqueSelect))
  caso('y se pone una propia', true, /background-image: url\("data:image\/svg\+xml/.test(bloqueSelect))
  caso('con sitio para ella', true, /padding-right: 2rem/.test(bloqueSelect))
  /*
   * LA DE TEMA OSCURO. Sin ella, la flecha gris oscura sobre fondo casi negro
   * no se ve — y el desplegable pasa a parecer un campo de texto.
   */
  caso('hay una flecha para el tema oscuro', true,
    /:root\[data-theme='dark'\] select,\n:root:not\(\[data-theme='light'\]\) select \{/.test(css))
  /*
   * Y LA DE VUELTA PARA EL CLARO, que es la que se olvida siempre.
   *
   * La regla de oscuro lleva `:not([data-theme='light'])`, que TAMBIÉN acierta
   * cuando no hay tema puesto —o sea el ajuste «como el sistema»—, y ahí puede
   * tocar claro. Sin esta, quien tenga el sistema en claro y no haya tocado
   * nada vería la flecha gris clara sobre fondo blanco.
   */
  caso('y se devuelve la oscura en tema claro', true,
    /@media \(prefers-color-scheme: light\) \{\s*:root:not\(\[data-theme='dark'\]\) select \{/.test(css))

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
}
