/**
 * LA MARCA.
 *
 * Tres cosas que se rompen solas si nadie las mira:
 *
 *   1. El icono de la pestaña vive en `index.html` y los archivos en
 *      `public/`. La marca vive en `src/assets/`. Son sitios distintos; en
 *      cuanto se cambia el logotipo, el icono se queda con el dibujo viejo — y
 *      es el que más se ve, porque está en la pestaña todo el rato. Por eso se
 *      GENERA, y esto comprueba que está al día.
 *
 *   2. La marca tiene DOS versiones y hay que elegir bien. La orla completa a
 *      32 píxeles es una mancha dorada; la reducida —la G con el farol— se lee.
 *      Que la elección siga siendo automática es lo que evita que un día
 *      alguien meta la orla en la cabecera del panel y nadie lo note.
 *
 *   3. Que nadie se dibuje la marca por su cuenta.
 *
 * LO QUE YA NO SE COMPRUEBA, y por qué: aquí hubo comprobaciones atadas a UN
 * logotipo concreto —que existiera la constante de los clavos, que las letras
 * no fueran `<text>`, que el SVG no tuviera comillas mal cerradas—. Cada
 * cambio de logo ponía roja media prueba sin que nada estuviera mal. Ahora la
 * marca es una ilustración, no un dibujo hecho en código, y lo que se prueba
 * es lo que vale para cualquier marca que se ponga.
 */
export default async function ({ caso }) {
  const { readFile, stat } = await import('node:fs/promises')
  const { generar, ETIQUETAS_ICONO, HUESO, ICONOS, RUTA_MARCA_COMPLETA, RUTA_MARCA_REDUCIDA } =
    await import('../scripts/generar-favicon.mjs')

  // --- Las etiquetas del icono, al día ---
  const enDisco = await readFile('index.html', 'utf8')
  caso('las etiquetas del icono están al día', true, enDisco === generar())
  if (enDisco !== generar()) console.log('    → ejecuta: node scripts/generar-favicon.mjs')

  /*
   * El icono va en ARCHIVOS, no metido en la etiqueta como
   * `data:image/svg+xml,…`. Estuvo así para ahorrar una petición y costó dos
   * fallos que no dan error: comillas que cerraban el atributo antes de
   * tiempo, y después un icono que seguía sin verse sin forma de saber si era
   * el dibujo, el despliegue o la caché. Un archivo se abre y se ve.
   */
  caso('el HTML enlaza archivos, no una dirección data:', false,
    /rel="(icon|apple-touch-icon)"[^>]*data:/.test(enDisco))
  /*
   * Con `?v=`: la caché de iconos de Chrome no se va ni recargando con
   * Ctrl+F5. Sin cambiar la dirección, un logo nuevo tarda días en verse y
   * parece que no se ha cambiado.
   */
  caso('y llevan versión para saltarse la caché', ICONOS.length,
    (enDisco.match(/\?v=\d+/g) ?? []).length)

  /*
   * Los archivos, con dibujo dentro. Un PNG de doscientos bytes es un cuadro
   * vacío, y en una prueba se ve exactamente igual de bien que uno bueno.
   */
  for (const { ruta, lado } of ICONOS) {
    const info = await stat(ruta).catch(() => null)
    caso(`${ruta} existe y pesa lo suyo`, true, !!info && info.size > lado * 12)
  }
  for (const ruta of [RUTA_MARCA_COMPLETA, RUTA_MARCA_REDUCIDA]) {
    const info = await stat(ruta).catch(() => null)
    caso(`${ruta} está en su sitio`, true, !!info && info.size > 4000)
  }

  // Y el archivo de la marca, con el original del que sale todo.
  const original = await stat('docs/marca/gobergo-original.webp').catch(() => null)
  caso('el original de la marca está guardado', true, !!original && original.size > 10000)

  await lasDosVersiones({ caso, HUESO })
  await todoElMundoPideLaMarcaAqui({ caso })
}

/**
 * LAS DOS VERSIONES, y que la elección no se pueda olvidar.
 *
 * El logotipo es una orla de filigrana con la G, el farol y la cruz de remate.
 * A 96 píxeles es una preciosidad; a 32 —la pestaña, la cabecera del panel, el
 * membrete de un recibo— se convierte en una mancha dorada. La reducida es la
 * misma marca sin la orla, y se lee a 24.
 *
 * Lo importante es que elegir NO sea decisión de cada pantalla: hay veinte
 * sitios que piden la marca y en dieciocho es pequeña. Si hubiera que acordarse
 * en cada uno, el día menos pensado alguien mete la orla en la cabecera.
 */
async function lasDosVersiones({ caso, HUESO }) {
  const { readFile } = await import('node:fs/promises')
  const crudo = await readFile('src/components/Logo.tsx', 'utf8')
  const logo = crudo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  caso('la marca trae sus dos versiones', true,
    /gobergo-marca\.webp/.test(logo) && /gobergo-marca-reducida\.webp/.test(logo))
  caso('y la elige sola por el tamaño', true, /size >= CORTE/.test(logo))
  caso('con el corte en una constante, no a ojo', true, /const CORTE = \d+/.test(logo))
  // Se puede forzar cuando haga falta, pero por defecto decide el tamaño.
  caso('se puede forzar una u otra', true, /variante\?: 'completa' \| 'reducida'/.test(logo))

  // La marca se pide en claro y en oscuro: la cabecera es granate y el papel
  // es blanco, y tiene que verse en los dos.
  caso('la marca tiene versión clara', true, /claro\s*=\s*false/.test(logo))
  caso('y quien la pide puede elegirla', true, /LogoMark size=\{size\} claro=\{light\}/.test(logo))

  /*
   * Los colores de la marca, en un sitio y con nombre. El dibujo ya no los
   * usa —es una ilustración— pero los necesitan la baldosa del icono, la barra
   * del navegador en el móvil y los documentos que se imprimen. Sueltos por
   * ahí, la aplicación acaba con dos dorados distintos.
   */
  const { readFile: leer } = await import('node:fs/promises')
  const marca = await leer('src/lib/marca.ts', 'utf8')
  const constantes = [...marca.matchAll(/export const ([A-Z][A-Z_]*) = '(#[0-9A-Fa-f]{3,8})'/g)]
  caso('los colores de la marca están en lib/marca.ts', true, constantes.length >= 3)
  caso('y el icono usa ese mismo hueso', true, marca.includes(HUESO))
}

/**
 * Y que nadie se dibuje la marca por su cuenta.
 *
 * Es lo que hace que cambiar el logo sea cambiar un archivo. En cuanto una
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
    // Y la ilustración pedida a mano, saltándose el componente que elige la
    // versión: así es como la orla acaba en un sitio de 30 píxeles.
    if (/assets\/gobergo-marca/.test(src)) culpables.push(`${ruta} (la pide sin pasar por Logo)`)
  }
  caso('nadie se dibuja ni se trae la marca por su cuenta', '', culpables.join(', '))

  // Y el componente sigue exportando las dos formas de pedirla: la marca sola
  // (para recibos y papeletas) y la marca con el nombre (para cabeceras).
  const logo = await readFile('src/components/Logo.tsx', 'utf8')
  caso('se puede pedir solo la marca', true, /export function LogoMark/.test(logo))
  caso('y la marca con el nombre', true, /export default function Logo/.test(logo))
}
