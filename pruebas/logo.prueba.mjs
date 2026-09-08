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
  const { generar, ETIQUETAS_ICONO, HUESO, ICONOS } =
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
  /*
   * LA MARCA DE ANTES ya no la usa nadie: ni la aplicación ni el generador de
   * iconos. Se queda archivada en `docs/marca/` —una marca anterior es parte de
   * la historia de la casa— pero fuera de `src/assets`, para que no parezca que
   * sigue en uso.
   */
  const dondeEstaba = await stat('src/assets/gobergo-marca-reducida.webp').catch(() => null)
  caso('la marca vieja ya no está entre las que se usan', null, dondeEstaba)

  // Y el archivo de las marcas, con los originales de los que sale todo.
  const original = await stat('docs/marca/gobergo-original.webp').catch(() => null)
  caso('el original de la marca anterior está guardado', true, !!original && original.size > 10000)

  await laMarcaEsUnaSola({ caso })
  await todoElMundoPideLaMarcaAqui({ caso })
}

/**
 * LA MARCA ES UNA SOLA, Y NO SE APLASTA.
 *
 * Aquí antes se comprobaba otra cosa: que hubiera DOS ilustraciones —la orla
 * con la G para los tamaños grandes, la misma sin orla para los pequeños— y que
 * la elección la hiciera el componente y no cada pantalla. Era la regla
 * correcta para aquel logotipo.
 *
 * Ahora la marca es un nazareno de línea y es UNA SOLA para toda la
 * aplicación: enseñar dos dibujos distintos según el tamaño de la caja es
 * tener dos marcas. Así que lo que hay que vigilar cambió, y son otras tres
 * cosas — las tres capaces de romperse sin que la pantalla parezca rota:
 *
 *   1. QUE NO SE APLASTE. Es el riesgo nuevo, y el que no se ve. La marca de
 *      antes era cuadrada, así que `size` era «el lado»; esta mide 1 de ancho
 *      por 2,08 de alto. Si alguien vuelve a poner `width: size, height: size`
 *      —que es lo que había escrito y es lo natural de escribir— el nazareno
 *      sale gordo y bajito. Y nadie mira dos veces una pantalla que «se ve
 *      bien».
 *
 *   2. QUE SE PUEDA REPINTAR. El dibujo es un trazo de un solo color y la
 *      cabecera del panel es granate oscuro. Como imagen, la marca desaparecía
 *      del menú lateral y no había forma de arreglarlo desde fuera. Va en línea
 *      y con `currentColor` justamente por eso: si vuelve a ser un `<img>`,
 *      vuelve el problema.
 *
 *   3. QUE EL ICONO DE LA PESTAÑA SIGA SIENDO EL CUADRADO. No es un olvido: a
 *      32 píxeles el nazareno ocupa el 42 por ciento del ancho de su caja y se
 *      queda en una manchita. Está medido, y está escrito en `Logo.tsx` para
 *      que el próximo que lo vea sepa que es una decisión.
 */
async function laMarcaEsUnaSola({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const crudo = await readFile('src/components/Logo.tsx', 'utf8')
  const logo = crudo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  // --- 1. NO SE APLASTA ---
  caso('la proporción está escrita, no a ojo', true, /const PROPORCION = \d+ \/ \d+/.test(logo))
  caso('el alto manda y el ancho sale de la proporción', true,
    /const ancho = Math\.round\(size \* PROPORCION\)/.test(logo))
  /*
   * Y NO SE FUERZAN LOS DOS. `width: size, height: size` es exactamente lo que
   * había antes —era correcto entonces— y es lo que volvería a escribir
   * cualquiera que no supiera que la marca cambió de forma.
   */
  caso('no se le da el mismo valor a lo alto y a lo ancho', false,
    /width: size, height: size/.test(logo))

  // --- 2. SE PUEDE REPINTAR ---
  caso('el trazo lo pinta el CSS', true, /fill="currentColor"/.test(logo))
  caso('y va en línea, no como imagen', true, /<path d=\{NAZARENO\}/.test(logo))
  caso('sin volver a ser un <img>', false, /<img/.test(logo))
  caso('con su versión clara para la cabecera oscura', true, /logo-mark--claro/.test(logo))
  caso('y quien la pide puede elegirla', true, /LogoMark size=\{size\} claro=\{light\}/.test(logo))

  const css = await readFile('src/styles/global.css', 'utf8')
  caso('el color de la marca sale de un token, no de un hexadecimal suelto', true,
    /\.logo-mark \{[\s\S]{0,1400}color: var\(--/.test(css))
  caso('y en claro pasa a marfil', true,
    /\.logo-mark--claro \{ color: var\(--marfil-100\); \}/.test(css))

  /*
   * --- Y EL TOKEN TIENE QUE CAMBIAR CON EL TEMA ---
   *
   * Este es un fallo que metí yo y que se vio en cuanto se desplegó. La marca
   * de antes era una ilustración en oro Y granate, así que se leía sobre
   * cualquier fondo. Esta es de UN SOLO COLOR: con un granate fijo desaparece
   * en cuanto el fondo también es oscuro — y en tema oscuro lo son la pantalla
   * de suscripción y la cabecera de cada recibo.
   *
   * `--accent` es granate en claro y oro en oscuro. Un `--morado-*` o un
   * hexadecimal a pelo NO cambian, y por eso están prohibidos aquí.
   */
  caso('la marca usa el token que cambia con el tema', true,
    /\.logo-mark \{[\s\S]{0,1400}color: var\(--accent\);/.test(css))
  caso('y ese token de verdad cambia en tema oscuro', true,
    /prefers-color-scheme: dark[\s\S]{0,900}--accent: var\(--oro-300\)/.test(css))

  /*
   * --- EL LACRE DEL PORTAL, QUE ES DONDE SE VIO ---
   *
   * El lacre es un disco de CERA GRANATE. Ahí no vale ni el granate —se funde
   * con la cera, que es como estaba— ni el marfil, que canta demasiado para un
   * sello. En oro parece lo que es: una figura grabada, del mismo tono que el
   * anillo que el lacre ya lleva alrededor.
   */
  caso('dentro del lacre la marca va en oro', true,
    /\.portal__sello-disco \.logo-mark \{ color: rgba\(226, 196, 132/.test(css))
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  // Y el cinturón: si mañana se borra esa regla, que no vuelva a desaparecer.
  caso('y se pide en claro por si esa regla desaparece', true,
    /<LogoMark size=\{64\} claro \/>/.test(portal))

  // --- 3. EL ICONO DE LA PESTAÑA SIGUE SIENDO EL CUADRADO ---
  /*
   * Se comprueba en el generador, que es quien lo decide. Si algún día alguien
   * lo apunta al nazareno sin dibujar antes una versión para tamaño pequeño,
   * esto salta y le manda a leer el porqué.
   */
  const gen = await readFile('scripts/generar-favicon.mjs', 'utf8')
  caso('los iconos salen del mismo dibujo que la marca', true,
    /RUTA_MARCA = 'src\/assets\/nazareno\.svg'/.test(gen))
  /*
   * Y ENGORDADO SEGÚN EL TAMAÑO, que es lo que hace que el mismo dibujo sirva
   * para 16 y para 180. Sin esto el icono de la pestaña vuelve a ser una
   * manchita — y eso no se ve desde el código, solo mirando la pestaña.
   */
  caso('con el grosor puesto por el tamaño', true, /function engorde\(lado\)/.test(gen))
  caso('gordo en la pestaña', true, /if \(lado <= 32\) return \d+/.test(gen))
  caso('y sin engordar en el del móvil', true, /return 0\n\}/.test(gen))
  caso('y en Logo.tsx está escrito por qué', true,
    /icono de la pestaña también es el nazareno/i.test(crudo))

  /*
   * Y EL GENERADOR TIENE QUE PODER EJECUTARSE.
   *
   * Importaba `playwright`, que NO está en las dependencias del proyecto: se
   * caía en el import antes de hacer nada, y llevaba así vete a saber cuánto.
   * Se descubrió al ir a cambiar el icono. Un generador que no arranca es un
   * dibujo congelado que nadie sabe que está congelado.
   */
  caso('el generador no pide nada que el proyecto no tenga', false, /from 'playwright'/.test(gen))

  // Y el dibujo original guardado, que es de donde sale todo.
  const { stat } = await import('node:fs/promises')
  const original = await stat('docs/marca/nazareno-original.svg').catch(() => null)
  caso('el nazareno original está guardado', true, !!original && original.size > 1500)
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
