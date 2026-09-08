/**
 * LOS DOS ICONOS DE «QUIÉN ERES», EN UN SOLO SITIO.
 *
 * ============================================================================
 * QUÉ CAMBIÓ Y POR QUÉ
 * ============================================================================
 *
 * Eran una PERSONA genérica y un MALETÍN, los dos de librería. Se entendían, y
 * podrían estar en cualquier aplicación del mundo. El maletín además decía lo
 * que no era: una junta de gobierno no es una oficina, no cobra y no ficha.
 *
 * Ahora son una MEDALLA DE HERMANO y un LIBRO DE REGLAS. Dos objetos del mismo
 * mundo, que se leen como pareja —antes eran una persona y un objeto, que no
 * casa— y que no le pisan el sitio a la marca, que en esa misma pantalla ya es
 * un nazareno.
 *
 * ----------------------------------------------------------------------------
 * LO QUE VIGILA ESTA PRUEBA
 * ----------------------------------------------------------------------------
 *
 * Que no se dupliquen. La medalla sale en DOS sitios —la pantalla de entrada y
 * el botón «Mi área de hermano» de la barra de arriba— y significan lo mismo,
 * así que tienen que verse igual. Dibujados a mano en cada fichero, el día que
 * se cambie uno el otro se queda con el viejo y no lo nota nadie: son dos
 * pantallas que no se miran a la vez.
 *
 * Es la misma regla que ya protege a la marca en `logo.prueba.mjs`, aplicada a
 * lo siguiente que se repetía.
 */
export default async function ({ caso }) {
  const { readdir, readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const iconos = await readFile('src/components/Iconos.tsx', 'utf8')

  // --- ESTÁN LOS DOS, Y SE LLAMAN POR LO QUE SON ---
  caso('existe la medalla', true, /export function IconoMedalla/.test(iconos))
  caso('y el libro de reglas', true, /export function IconoLibroDeReglas/.test(iconos))

  /*
   * LA CRUZ ES LO QUE LOS SITÚA. Una medalla sin cruz es una moneda o una
   * medalla deportiva; un libro sin cruz es un cuaderno. Son dos trazos y son
   * los que hacen que el icono diga «hermandad» y no «aplicación».
   */
  const medalla = (iconos.match(/IconoMedalla\(\)[\s\S]*?<\/svg>/) ?? [''])[0]
  const libro = (iconos.match(/IconoLibroDeReglas\(\)[\s\S]*?<\/svg>/) ?? [''])[0]
  caso('la medalla lleva su cruz', true, /M12 11\.5v7M8\.9 14\.4h6\.2/.test(medalla))
  caso('y el libro también', true, /M11\.6 7v5\.4M9\.2 9\.1h4\.8/.test(libro))
  // Y el lazo, que es lo que la distingue de un sello redondo.
  caso('la medalla cuelga de su lazo', true, /M7\.5 3l3 6\.5M16\.5 3l-3 6\.5/.test(medalla))

  /*
   * MISMO GROSOR Y MISMA REJILLA QUE EL RESTO DE ICONOS DE LA APLICACIÓN. Si
   * uno se dibuja en otra rejilla o con otro trazo, canta al lado de los del
   * menú — y canta poco, lo justo para que la pantalla parezca descuidada sin
   * que se sepa por qué.
   */
  caso('van en la rejilla de siempre', true, /viewBox: '0 0 24 24'/.test(iconos))
  caso('y con el trazo de siempre', true, /strokeWidth: 1\.7/.test(iconos))
  // El color no se decide aquí: lo pone quien los usa, como con la marca.
  caso('el color lo pone quien los usa', true, /stroke: 'currentColor'/.test(iconos))

  // --- Y NADIE SE LOS DIBUJA POR SU CUENTA ---
  async function* archivos(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const ruta = join(dir, e.name)
      if (e.isDirectory()) yield* archivos(ruta)
      else if (/\.tsx?$/.test(e.name)) yield ruta
    }
  }
  const culpables = []
  for await (const ruta of archivos('src')) {
    if (ruta.endsWith('components/Iconos.tsx')) continue
    const src = await readFile(ruta, 'utf8')
    /*
     * La señal es el trazo, no el nombre: quien copie el dibujo se lleva el
     * `d=` entero, y eso es exactamente lo que hay que cazar.
     */
    if (/M7\.5 3l3 6\.5/.test(src)) culpables.push(`${ruta} (se dibuja la medalla)`)
    if (/M5\.2 4\.6A1\.6 1\.6/.test(src)) culpables.push(`${ruta} (se dibuja el libro)`)
  }
  caso('nadie se dibuja estos iconos por su cuenta', '', culpables.join(', '))

  // --- Y LOS DOS SITIOS QUE LOS PIDEN LOS PIDEN DE VERDAD ---
  const entrada = await readFile('src/pages/EntradaUnificada.tsx', 'utf8')
  caso('la pantalla de entrada usa la medalla', true, /<IconoMedalla \/>/.test(entrada))
  caso('y el libro', true, /<IconoLibroDeReglas \/>/.test(entrada))
  /*
   * Y LA BARRA DE ARRIBA, LA MEDALLA TAMBIÉN. «Mi área de hermano» significa lo
   * mismo que «Soy hermano/a»: si llevaran iconos distintos, la aplicación
   * estaría diciendo dos cosas para lo mismo.
   */
  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('y el botón del área del hermano lleva la misma medalla', true,
    /<IconoMedalla \/>/.test(shell))

  // Y que no quede ni rastro de los de antes.
  caso('ya no hay maletín', false, /rect x="3" y="7" width="18" height="14"/.test(entrada))
  caso('ni persona genérica', false, /circle cx="12" cy="8" r="4"/.test(entrada + shell))
}
