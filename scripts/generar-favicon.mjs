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

  const color = (nombre) => {
    const m = src.match(new RegExp(`const ${nombre} = '([^']+)'`))
    if (!m) throw new Error(`No se encuentra el color ${nombre} en Logo.tsx`)
    return m[1]
  }
  const clavo = src.match(/const CLAVO = '([^']+)'/)[1]

  let svg = src.slice(src.indexOf('<svg viewBox="0 0 120 120"'), src.indexOf('</svg>') + 6)

  // Fuera los comentarios de JSX: en un `data:` cada byte cuenta, y además el
  // icono se descarga en cada visita.
  svg = svg.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  /*
   * La versión del icono es la de fondo CLARO. La pestaña puede ser clara u
   * oscura según el navegador y el sistema, y el verde con las letras en blanco
   * aguanta las dos; la variante para fondo oscuro cala las letras en granate y
   * sobre una pestaña clara desaparecerían.
   */
  const reemplazos = {
    '={verde}': color('VERDE'),
    '={rojo}': color('ROJO'),
    '={calado}': '#FFFFFF',
    '={ORO}': color('ORO'),
    '={CLAVO}': clavo,
  }
  for (const [de, a] of Object.entries(reemplazos)) svg = svg.split(de).join(`="${a}"`)

  // JSX escribe los atributos en minúsculas-camello; el SVG los quiere con guion.
  svg = svg
    .replace(/strokeWidth=/g, 'stroke-width=')
    .replace(/strokeLinecap=/g, 'stroke-linecap=')
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
