#!/usr/bin/env node
/**
 * Escribe el icono de la pestaña a partir del logo de verdad.
 *
 *     node scripts/generar-favicon.mjs
 *
 * POR QUÉ SE GENERA Y NO SE ESCRIBE A MANO. El icono vive en `index.html` como
 * una imagen metida en la propia dirección (un `data:`), y el logo vive en
 * `src/components/Logo.tsx`. Son dos sitios, y en cuanto se retoca el logo el
 * icono se queda con el dibujo viejo — que además es el que más se ve, porque
 * está en la pestaña todo el rato.
 *
 * Así el icono SALE del logo: se toca el logo, se lanza esto, y no hay forma de
 * que se despeguen. Hay una prueba que comprueba que están al día.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const RAIZ = new URL('..', import.meta.url).pathname

/** Saca el SVG del componente y lo deja como SVG de verdad, sin JSX. */
export function svgDelLogo() {
  const src = readFileSync(`${RAIZ}src/components/Logo.tsx`, 'utf8')

  let svg = src.slice(src.indexOf('<svg viewBox="0 0 120 120"'), src.indexOf('</svg>') + 6)

  // Fuera los comentarios de JSX: en un `data:` cada byte cuenta, y el icono se
  // descarga en cada visita.
  svg = svg.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  /*
   * LAS VARIABLES DEL DIBUJO, RESUELTAS SOLAS.
   *
   * El SVG del componente lleva cosas como `fill={ORO}` o `d={CLAVO}`, y aquí
   * hay que dejarlas en valores. Estaban escritas a mano —una lista con los
   * nombres del logo de aquel momento—, y al cambiar de logo el generador
   * reventó porque buscaba una constante que ya no existía. Eso es justo lo
   * contrario de para lo que se hizo: sobrevivir a los cambios de logo.
   *
   * Así que se buscan las que HAYA. Dos formas:
   *
   *   const ORO = '#C9A55C'                  → el valor, tal cual
   *   const tinta = claro ? '#FFF' : GRANATE → la rama de fondo CLARO
   *
   * La rama clara porque la pestaña puede ser clara u oscura según el navegador
   * y el sistema, y la versión pensada para fondo claro aguanta las dos; la de
   * fondo oscuro está pensada para verse sobre el granate de la cabecera y
   * sobre una pestaña blanca desaparecería.
   */
  const valorDe = (nombre, vistos = new Set()) => {
    if (vistos.has(nombre)) throw new Error(`La constante ${nombre} se refiere a sí misma`)
    vistos.add(nombre)
    const ternario = src.match(new RegExp(`const ${nombre} = claro \\? [^:]+: ([A-Za-z_$][\\w$]*|'[^']*')`))
    if (ternario) {
      const rama = ternario[1]
      return rama.startsWith("'") ? rama.slice(1, -1) : valorDe(rama, vistos)
    }
    const directo = src.match(new RegExp(`const ${nombre} = '([^']+)'`))
    if (directo) return directo[1]
    throw new Error(`No se encuentra la constante ${nombre} en Logo.tsx`)
  }

  for (const nombre of new Set([...svg.matchAll(/=\{([A-Za-z_$][\w$]*)\}/g)].map((m) => m[1]))) {
    svg = svg.split(`={${nombre}}`).join(`="${valorDe(nombre)}"`)
  }

  // JSX escribe los atributos en minúsculas-camello; el SVG los quiere con guion.
  svg = svg
    .replace(/strokeWidth=/g, 'stroke-width=')
    .replace(/strokeLinecap=/g, 'stroke-linecap=')
    .replace(/strokeLinejoin=/g, 'stroke-linejoin=')
    .replace(/strokeDasharray=/g, 'stroke-dasharray=')
    .replace(/textAnchor=/g, 'text-anchor=')
    .replace(/fontFamily=/g, 'font-family=')
    .replace(/fontSize=/g, 'font-size=')
    .replace(/fontWeight=/g, 'font-weight=')
    .replace(/aria-hidden="true"/, 'xmlns="http://www.w3.org/2000/svg"')
    /*
     * EL TAMAÑO PROPIO, y es lo que hacía falta para que el icono se viera.
     *
     * En el componente el `<svg>` no lleva `width` ni `height` a propósito: se
     * lo da por CSS el `<span>` que lo envuelve, y así la marca vale para
     * cualquier tamaño. Suelto, en cambio, se queda sin medidas.
     *
     * Con un `<img width="16">` no se nota —el tamaño lo pone el `<img>`—, y
     * ese fue el error al comprobarlo: la prueba le daba justo lo que faltaba.
     * Pero un FAVICON no lleva tamaño: el navegador le pregunta al dibujo
     * cuánto mide, `naturalWidth` sale 0, y no hay nada que rasterizar. No da
     * error: pinta el globo gris de «esta página no tiene icono».
     */
    .replace(/^<svg /, '<svg width="120" height="120" ')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim()

  return svg
}

/**
 * EL ICONO VA EN ARCHIVOS, NO METIDO EN LA DIRECCIÓN.
 *
 * Estuvo como `data:image/svg+xml,…` dentro del propio `<link>`, para ahorrar
 * una petición. Salió caro: dos fallos distintos y ninguno da error.
 *
 *   1. Las comillas del `font-family` cerraban el atributo antes de tiempo y
 *      el SVG dejaba de ser XML válido.
 *   2. Y aun arreglado eso, seguía sin verse, sin forma de comprobar desde
 *      aquí si era el dibujo, el despliegue o la caché del navegador.
 *
 * Un archivo quita las tres dudas: se abre en el navegador y se ve, se puede
 * pedir con `curl`, y no hay codificación que se pueda romper. Pesa 1,6 kB y
 * se cachea para siempre. La petición de más no vale ni la mitad de lo que
 * cuesta un icono que no se ve.
 *
 * Y va acompañado de un PNG. El SVG en la pestaña lo entienden los navegadores
 * modernos; el PNG lo entiende TODO, y es el que garantiza que se vea aunque
 * uno tropiece con el otro.
 */
export const RUTA_SVG = 'public/favicon.svg'
export const RUTA_PNG = 'public/favicon-32.png'
export const RUTA_PNG_IOS = 'public/apple-touch-icon.png'

/** El SVG metido en una dirección `data:`. Ya no se usa en el HTML: se
 *  conserva porque los documentos imprimibles sí lo necesitan en línea. */
export function faviconDataUri() {
  // Solo se escapan los caracteres que romperían el atributo HTML. Codificarlo
  // entero triplica el tamaño por nada.
  const limpio = svgDelLogo()
    /*
     * Las comillas dobles pasan a simples porque el `href="…"` de la etiqueta
     * va entre dobles. Pero NO se puede hacer a lo bruto: hay valores que YA
     * llevan comillas simples dentro, y el ejemplo es justo el peor,
     *
     *     font-family="'Playfair Display', Georgia, 'Times New Roman', serif"
     *
     * que cambiado sin mirar queda `font-family=''Playfair Display', …'`: el
     * atributo se cierra en la primera comilla de dentro, el SVG deja de ser
     * XML válido y el navegador NO PINTA NADA —pone el globo gris de «esta
     * página no tiene icono»— sin dar ningún error en la consola.
     *
     * Así que se va atributo por atributo: las de dentro se escapan y solo se
     * cambian las que delimitan.
     */
    .replace(/([\w-]+)="([^"]*)"/g, (_, nombre, valor) => `${nombre}='${valor.replace(/'/g, '&apos;')}'`)
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/ /g, '%20')
  return `data:image/svg+xml,${limpio}`
}

/**
 * Las etiquetas del icono. Tres, y cada una cubre a la anterior:
 *
 *   · el SVG, que se ve nítido a cualquier tamaño
 *   · el PNG de 32, para el navegador que no se lleve bien con el SVG
 *   · el de iOS, para cuando alguien lo guarda en la pantalla de inicio
 *
 * Llevan `?v=2` para que el navegador no siga enseñando el que tenía
 * guardado: la caché de iconos de Chrome es de las que no se van solas ni
 * recargando con Ctrl+F5, y sin esto el arreglo no se vería hasta dentro de
 * días.
 */
export const ETIQUETAS_ICONO = [
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2" />',
  '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=2" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />',
].join('\n    ')

/** Deja `index.html` con el icono al día. Devuelve el HTML resultante. */
export function generar() {
  const html = readFileSync(`${RAIZ}index.html`, 'utf8')
  /*
   * Se sustituyen TODAS las etiquetas de icono de una vez —desde la primera
   * hasta la última— en vez de una por una. Cambiándolas por separado, al
   * pasar de dos etiquetas a tres se quedaba una vieja suelta y el navegador
   * se quedaba con la del data URI, que es la que no se veía.
   */
  return html.replace(
    /<link[^>]*rel="(?:icon|apple-touch-icon)"[\s\S]*?rel="apple-touch-icon"[^>]*\/>/,
    ETIQUETAS_ICONO,
  )
}

/**
 * El SVG del archivo: la marca SOBRE UNA BALDOSA color hueso.
 *
 * En la aplicación la marca va sobre el papel de la página y no necesita
 * fondo. Suelta en una pestaña, sí: el arco es dorado y la G granate, y sobre
 * la pestaña oscura de Chrome la G desaparece y el arco se queda en un
 * garabato. Con la baldosa detrás se lee igual en clara y en oscura, que es lo
 * único que importa en 16 píxeles.
 *
 * `rx` redondea la esquina: los sitios que recortan el icono en círculo
 * —Android, la pantalla de inicio— muerden menos.
 */
const HUESO = '#F7F1E4'
export function svgDeArchivo() {
  const baldosa = `<rect width="120" height="120" rx="22" fill="${HUESO}" />`
  return `${svgDelLogo().replace(/(<svg[^>]*>)/, `$1${baldosa}`)}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(`${RAIZ}${RUTA_SVG}`, svgDeArchivo())
  writeFileSync(`${RAIZ}index.html`, generar())
  console.log(`Icono regenerado desde el logo → ${RUTA_SVG} y las etiquetas de index.html.`)
  console.log(`Los PNG (${RUTA_PNG}, ${RUTA_PNG_IOS}) se rasterizan aparte: node scripts/rasterizar-icono.mjs`)
}
