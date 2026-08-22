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
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim()

  return svg
}

/** El SVG metido en una dirección `data:`, listo para el `<link rel="icon">`. */
export function faviconDataUri() {
  // Solo se escapan los caracteres que romperían el atributo HTML. Codificarlo
  // entero triplica el tamaño por nada.
  const limpio = svgDelLogo()
    .replace(/"/g, "'")
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/ /g, '%20')
  return `data:image/svg+xml,${limpio}`
}

/** Deja `index.html` con el icono al día. Devuelve el HTML resultante. */
export function generar() {
  const html = readFileSync(`${RAIZ}index.html`, 'utf8')
  const uri = faviconDataUri()
  return html
    .replace(/(<link\s+rel="icon"[^>]*?href=")[^"]*(")/s, `$1${uri}$2`)
    .replace(/(<link\s+rel="apple-touch-icon"\s+href=")[^"]*(")/s, `$1${uri}$2`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const html = generar()
  writeFileSync(`${RAIZ}index.html`, html)
  console.log(`Icono regenerado desde el logo (${faviconDataUri().length} caracteres).`)
}
