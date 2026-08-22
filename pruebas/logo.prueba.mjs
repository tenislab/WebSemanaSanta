/**
 * LA MARCA.
 *
 * Dos cosas que se rompen solas si nadie las mira:
 *
 *   1. El icono de la pestaña vive en `index.html` y el logo en
 *      `src/components/Logo.tsx`. Son dos sitios; en cuanto se retoca el logo,
 *      el icono se queda con el dibujo viejo — y es el que más se ve, porque
 *      está en la pestaña todo el rato. Por eso se GENERA, y esto comprueba
 *      que está al día.
 *
 *   2. La marca tiene que verse sobre fondo claro y sobre el granate de la
 *      cabecera. El verde de la gota sobre el granate se apaga, y las letras
 *      caladas en blanco sobre fondo oscuro pegan un fogonazo: hay una
 *      variante para eso, y tiene que seguir existiendo.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const { generar, svgDelLogo, faviconDataUri } = await import('../scripts/generar-favicon.mjs')

  // --- El icono, al día ---
  const enDisco = await readFile('index.html', 'utf8')
  const recienHecho = generar()
  caso('el icono de la pestaña está al día', true, enDisco === recienHecho)
  if (enDisco !== recienHecho) console.log('    → ejecuta: node scripts/generar-favicon.mjs')

  // Y que sea el logo de verdad, no un dibujo aparte.
  const svg = svgDelLogo()
  caso('el icono sale del logo', true, svg.startsWith('<svg viewBox="0 0 120 120"'))
  caso('sin comentarios de JSX dentro', false, /\{\/\*/.test(svg))
  caso('ni atributos de JSX sin traducir', false, /strokeWidth|strokeLinecap/.test(svg))
  caso('ni llaves de JavaScript sueltas', false, /=\{/.test(svg))
  /*
   * Un `d=` sin comillas se corta en el primer espacio y el dibujo desaparece
   * sin dar error. Pasó al montar esto: los clavos no salían y el SVG seguía
   * siendo «válido».
   */
  caso('todos los atributos van entrecomillados', false, / \w[\w-]*=[^"]/.test(svg))
  caso('lleva el espacio de nombres, o no se pinta suelto', true, /xmlns=/.test(svg))

  // El icono va metido en la dirección, y tiene que caber sin volverse enorme.
  const uri = faviconDataUri()
  caso('el icono va en la propia dirección', true, uri.startsWith('data:image/svg+xml,'))
  caso('y no se dispara de tamaño', true, uri.length < 4000)
  caso('sin comillas dobles que rompan el atributo', false, uri.includes('"'))
  caso('y el icono de iOS es el mismo', 2, (enDisco.match(/data:image\/svg\+xml,%3Csvg/g) ?? []).length)

  /*
   * --- La marca, en sus dos versiones ---
   *
   * Aquí había comprobaciones atadas a UN logo concreto: que existiera la
   * constante de los clavos, que las letras no fueran `<text>`, que no
   * quedaran los colores del logo anterior. Al volver atrás de logo, media
   * prueba se puso roja sin que nada estuviera mal.
   *
   * Lo que se comprueba ahora es lo que vale para cualquier marca que se
   * ponga: que se vea sobre fondo claro y sobre oscuro, que los colores no se
   * hereden del texto, y que el icono salga de ella.
   */
  const logoCrudo = await readFile('src/components/Logo.tsx', 'utf8')
  const logo = logoCrudo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  // La marca se pide en claro y en oscuro: la cabecera es granate y el papel
  // es blanco, y tiene que verse en los dos.
  caso('la marca tiene versión clara', true, /claro\s*=\s*false/.test(logo))
  caso('y quien la pide puede elegirla', true, /LogoMark size=\{size\} claro=\{light\}/.test(logo))
  caso('la versión oscura cambia algo', true, /claro \?/.test(logo))

  /*
   * Los colores NO son `currentColor`: son la marca, y tienen que salir
   * iguales sobre fondo claro, sobre fondo oscuro y en un papel impreso.
   * Heredando el color del texto se perderían justo donde más se ven.
   */
  caso('la marca no hereda el color del texto', false, /currentColor/.test(logo))

  // Y los colores están escritos UNA vez, no repartidos por el dibujo: es lo
  // que permite cambiarlos sin ir path por path.
  const constantes = [...logo.matchAll(/const ([A-Z][A-Z_]*) = '(#[0-9A-Fa-f]{3,8})'/g)]
  caso('los colores están en constantes', true, constantes.length >= 2)
  const sueltos = (logo.match(/["'{]#[0-9A-Fa-f]{6}/g) ?? []).length - constantes.length
  caso('y no hay colores sueltos por el dibujo', true, sueltos <= 1)

  await todoElMundoPideLaMarcaAqui({ caso })
}

/**
 * Y que nadie se dibuje la marca por su cuenta.
 *
 * Es lo que hace que cambiar el logo sea cambiar UN archivo. En cuanto una
 * pantalla se pinta su propia versión, el día del cambio se queda con la
 * antigua y nadie se da cuenta hasta que alguien lo ve impreso.
 */
async function todoElMundoPideLaMarcaAqui({ caso }) {
  const { readdir, readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')

  async function* archivos(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const ruta = join(dir, e.name)
      if (e.isDirectory()) yield* archivos(ruta)
      else if (/\.tsx?$/.test(e.name)) yield ruta
    }
  }

  const culpables = []
  for await (const ruta of archivos('src')) {
    if (ruta.endsWith('components/Logo.tsx')) continue
    const src = (await readFile(ruta, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')
    // El nombre «Gobergo» dibujado dentro de un SVG es la señal: es alguien
    // montándose su propia marca en vez de pedir el componente.
    if (/<svg[\s\S]{0,400}Gobergo/.test(src)) culpables.push(ruta)
  }
  caso('nadie se dibuja su propia marca', '', culpables.join(', '))

  // Y el componente sigue exportando las dos formas de pedirla: la marca sola
  // (para recibos y papeletas) y la marca con el nombre (para cabeceras).
  const logo = await readFile('src/components/Logo.tsx', 'utf8')
  caso('se puede pedir solo la marca', true, /export function LogoMark/.test(logo))
  caso('y la marca con el nombre', true, /export default function Logo/.test(logo))
}
