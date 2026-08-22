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

  // --- La marca, en sus dos versiones ---
  // Sin comentarios: el propio archivo EXPLICA que no usa `currentColor`, y
  // buscándolo a pelo la prueba se caza a sí misma en su explicación.
  const logoCrudo = await readFile('src/components/Logo.tsx', 'utf8')
  const logo = logoCrudo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  caso('hay versión para fondo oscuro', true, /VERDE_CLARO/.test(logo))
  caso('y para el rojo de los clavos', true, /ROJO_CLARO/.test(logo))
  /*
   * Los colores NO son `currentColor`: son la marca, y tienen que salir
   * iguales sobre fondo claro, sobre fondo oscuro y en un papel impreso.
   * Heredando el color del texto se perderían justo donde más se ven.
   */
  caso('la marca no hereda el color del texto', false, /currentColor/.test(logo))

  // Los tres clavos son la misma figura girada. Dibujados por separado
  // acabarían con grosores distintos y se notaría.
  caso('los clavos son un solo dibujo', 1, (logo.match(/const CLAVO =/g) ?? []).length)
  caso('y se usa tres veces', 3, (logo.match(/d=\{CLAVO\}/g) ?? []).length)

  // Las letras no son texto: una tipografía que no esté instalada cambiaría la
  // marca de sitio en sitio, y en un recibo impreso desde otro ordenador
  // saldría otra letra.
  caso('las iniciales van dibujadas, no escritas', false, /<text/.test(logo))

  // --- Que no quede nada del logo viejo ---
  const viejos = ['#7B1520', '#C9A55C']
  for (const c of viejos) {
    caso(`ya no queda el color viejo ${c}`, false, logo.includes(c))
  }

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
