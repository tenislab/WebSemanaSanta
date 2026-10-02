/**
 * LAS TABLAS GRANDES NO SE REPINTAN EN CADA TECLA.
 *
 * Cuatro pantallas enseñan tablas que, con una hermandad de verdad, tienen
 * miles de filas: el censo (800 hermanos), los recibos (4.500 con tres
 * ejercicios emitidos), el libro de Tesorería (3.000 apuntes) y las papeletas
 * de la campaña (800). Cada letra del buscador re-renderiza la pantalla, y sin
 * un límite React recorre las filas enteras EN EL CAMINO URGENTE —el de la
 * letra— aunque la lista filtrada todavía no haya cambiado.
 *
 * Medido con `scripts/caza/cronometro.mjs` en el build de producción: los
 * recibos costaban 304 ms por tecla. Un cuarto de segundo por letra no se lee
 * como «va lento», se lee como «se ha colgado».
 *
 * ============================================================================
 * Y LO QUE DE VERDAD VIGILA ESTA PRUEBA NO ES QUE ESTÉ EL `memo`
 * ============================================================================
 *
 * Es que SUS PROPS SEAN ESTABLES, que es la mitad que se olvida y la que no se
 * ve. `memo` compara por identidad: una función creada en el render del padre
 * es distinta en cada pintado, así que una sola prop así atraviesa el límite y
 * lo deja en un adorno. Queda escrito «memo» en el código, queda el comentario
 * explicándolo, y no sirve absolutamente de nada.
 *
 * Pasó aquí, midiendo: puestos los cuatro `memo`, Cuotas y Papeletas mejoraron
 * y TESORERÍA NO MEJORÓ NADA. El motivo no estaba en Tesorería: estaba en
 * `lib/supabaseSync.ts`, donde el `setItems` que devuelve `useSupabaseTable`
 * era una función suelta —nueva en cada pintado—. De ahí pasaba a
 * `marcarConciliado`, y de ahí a las props de las filas.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  await lasPaginas({ cargar, caso })
  await elPadronSoloAlImprimir({ caso })

  /*
   * EL `set…` DE `useSupabaseTable`, ESTABLE.
   *
   * Esta es la raíz: lo monta cada pantalla para cada colección, y su `set…`
   * acaba en los manejadores de media aplicación. Si vuelve a ser una función
   * suelta, los cuatro límites de abajo dejan de servir a la vez y sin que
   * nada lo diga.
   */
  const sync = await readFile('src/lib/supabaseSync.ts', 'utf8')
  caso('el set… de useSupabaseTable no cambia de identidad', true,
    /const setItems = useCallback\(/.test(sync))
  caso('y no depende de toRow, que es una prop', true,
    /toRowRef\.current/.test(sync) && !/\}, \[[^\]]*\btoRow\b[^\]]*\]\)/.test(sync))
  caso('el espejo tampoco', true, /const espejar = useCallback\(/.test(sync))

  /*
   * LOS CUATRO CUERPOS, MEMORIZADOS Y CON TODAS SUS PROPS ESTABLES.
   *
   * De cada pantalla se leen las props que le pasa al componente de filas y se
   * busca CÓMO ESTÁ DECLARADA cada una en el padre. Una prop vale si es estado,
   * una referencia, un `useMemo`, un `useCallback`, un `set…` de React o un
   * dato que viene de fuera. No vale si es una `function` suelta o una flecha
   * escrita en el cuerpo del componente.
   */
  const pantallas = [
    ['el censo', 'src/pages/app/Hermanos.tsx', 'src/pages/app/censo/FilasDelCenso.tsx', 'FilasDelCenso'],
    ['los recibos', 'src/pages/app/Cuotas.tsx', 'src/pages/app/cuotas/FilasDeRecibos.tsx', 'FilasDeRecibos'],
    ['cuotas por hermano', 'src/pages/app/Cuotas.tsx', 'src/pages/app/cuotas/FilasPorHermano.tsx', 'FilasPorHermano'],
    ['el libro de Tesorería', 'src/pages/app/Tesoreria.tsx', 'src/pages/app/tesoreria/FilasDeApuntes.tsx', 'FilasDeApuntes'],
    ['las papeletas', 'src/pages/app/Papeletas.tsx', 'src/pages/app/papeletas/FilasDeLaCampana.tsx', 'FilasDeLaCampana'],
  ]

  for (const [comoSeLlama, rutaPadre, rutaHijo, nombre] of pantallas) {
    const padre = await readFile(rutaPadre, 'utf8')
    const hijo = await readFile(rutaHijo, 'utf8')

    caso(`${comoSeLlama}: el cuerpo de la tabla está memorizado`, true,
      new RegExp(`export const ${nombre} = memo\\(`).test(hijo))

    // La llamada: `<Nombre ... />`. Se recorta hasta su cierre.
    const desde = padre.indexOf(`<${nombre}`)
    caso(`${comoSeLlama}: la pantalla lo usa`, true, desde >= 0)
    if (desde < 0) continue
    const llamada = padre.slice(desde, padre.indexOf('/>', desde) + 2)

    /*
     * Cada `prop={algo}`. Solo interesan las que pasan un IDENTIFICADOR pelado
     * (`tramoDe`, `marcarPagada`): un literal o una expresión ya se ve que se
     * crea ahí, y de hecho eso es lo que se prohíbe justo debajo.
     */
    const props = [...llamada.matchAll(/(\w+)=\{([^}]*)\}/g)].map((m) => [m[1], m[2].trim()])
    caso(`${comoSeLlama}: se le leen las props`, true, props.length > 0)

    const inestables = []
    for (const [prop, expr] of props) {
      // Una flecha o una llamada escrita en la propia llamada es siempre nueva.
      if (/=>|\.map\(|\.filter\(|\bnew \b/.test(expr)) {
        inestables.push(`${prop}: se crea en la propia llamada («${expr.slice(0, 40)}»)`)
        continue
      }
      if (!/^[\w.?]+$/.test(expr)) continue // literales, negaciones, etc.
      const raiz = expr.split(/[.?]/)[0]
      if (raiz === prop && expr !== prop) continue

      /*
       * ¿CÓMO ESTÁ DECLARADA EN EL PADRE?
       *
       * Para la flecha no se intenta describir su forma: se coge lo que hay
       * DESPUÉS del `=` hasta fin de línea y se pregunta si lleva una flecha y
       * si empieza por uno de los tres envoltorios que sí estabilizan.
       *
       * La primera versión sí describía la forma —`\(?[\w\s,:{}]*\)?\s*=>`— y
       * se le colaba `const tramoDe = (() => {…})`, una flecha entre
       * paréntesis: rompiendo eso a propósito el guardia se quedó en verde. Un
       * guardia que solo caza la forma que ya conocías no vigila, recuerda.
       */
      const suelta = new RegExp(`^\\s*function ${raiz}\\(`, 'm').test(padre)
      const decl = new RegExp(`^\\s+const ${raiz}\\s*=\\s*(.*)$`, 'm').exec(padre)
      const derecha = decl ? decl[1].trim() : ''
      const envuelta = /^(useMemo|useCallback|useRef)\s*\(/.test(derecha)
      const flecha = Boolean(derecha) && !envuelta && derecha.includes('=>')
      if (suelta) inestables.push(`${prop}: en el padre es una «function» suelta`)
      else if (flecha) inestables.push(`${prop}: en el padre es una flecha del cuerpo del render («${derecha.slice(0, 40)}»)`)
    }
    caso(`${comoSeLlama}: ninguna prop cambia de identidad en cada pintado`, [], inestables)
  }

  /*
   * Y NINGUNA DE LAS CUATRO TABLAS SE QUEDA SIN SU LÍMITE POR LA PUERTA DE
   * ATRÁS: que el `.map` de las filas siga viviendo en el hijo y no haya vuelto
   * al padre. Un `memo` con el cuerpo vacío también está «puesto».
   */
  for (const [comoSeLlama, , rutaHijo] of pantallas) {
    const hijo = await readFile(rutaHijo, 'utf8')
    caso(`${comoSeLlama}: las filas se pintan dentro del memo`, true,
      /\.map\(/.test(hijo) && /<tr\b/.test(hijo))
  }
}

/*
 * ============================================================================
 * Y LAS TABLAS NO PINTAN LAS CUATRO MIL FILAS DE GOLPE
 * ============================================================================
 *
 * Memorizar el cuerpo arregló la TECLA y no el ABRIR: la pantalla de Cuotas
 * seguía montando 107.834 nodos y tardando ~1,7 s con 4.512 recibos. Paginada,
 * 3.723 nodos. Medido con `scripts/caza/ver-paginador.mjs`.
 *
 * DOS COSAS SE VIGILAN AQUÍ, Y LA SEGUNDA ES LA QUE DA MIEDO.
 *
 * La primera es la cuenta: cuántas páginas, qué trozo, qué dice el pie. Se
 * EJECUTA con datos, no se lee.
 *
 * La segunda es que paginar la tabla NO paginó nada más. En el censo, la misma
 * lista filtrada alimenta cuatro cosas más: el CSV que se descarga, el padrón
 * que sale por la impresora, «marcar todos» y el contador de la cabecera. Si a
 * cualquiera de esas le llegara la PÁGINA en vez de la lista, el fallo sería
 * mucho peor que el lento que se venía a arreglar: un padrón de ochocientos
 * hermanos que imprime cien y no lo dice en ninguna parte. Nadie lo descubre
 * mirando la pantalla; se descubre en el cabildo.
 */
async function lasPaginas({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const m = await cargar('src/lib/paginar.ts')
  const cuenta = (total, numero, por = 100, todas = false) => m.cuentaDePaginas(total, numero, por, todas)

  // 1. LA CUENTA, EJECUTADA.
  caso('cien filas caben en una página', 1, cuenta(100, 1).paginas)
  caso('ciento una ya son dos', 2, cuenta(101, 1).paginas)
  caso('4.512 recibos son 46 páginas', 46, cuenta(4512, 1).paginas)
  caso('la primera página va de la 1 a la 100', [1, 100],
    [cuenta(4512, 1).desde, cuenta(4512, 1).hasta])
  caso('la tercera, de la 201 a la 300', [201, 300],
    [cuenta(4512, 3).desde, cuenta(4512, 3).hasta])
  // La última no miente: 4.512 no es múltiplo de 100, así que tiene 12 filas.
  caso('la última acaba en el total, no en un múltiplo', [4501, 4512],
    [cuenta(4512, 46).desde, cuenta(4512, 46).hasta])
  // Una lista vacía no dice «1–0 de 0».
  caso('sin filas, no se inventa un «desde»', [0, 0],
    [cuenta(0, 1).desde, cuenta(0, 1).hasta])
  caso('y sigue habiendo una página, no cero', 1, cuenta(0, 1).paginas)
  /*
   * Y EL RECORTE. Si la lista se acorta —se borran filas desde otra pestaña— el
   * número de página guardado puede apuntar a una página que ya no existe, y
   * entonces la tabla saldría VACÍA teniendo datos. Es el fallo que no da
   * error.
   */
  caso('una página que ya no existe se recorta a la última', 2, cuenta(150, 9).actual)
  caso('y enseña filas, no una tabla vacía', [101, 150],
    [cuenta(150, 9).desde, cuenta(150, 9).hasta])
  caso('un número por debajo de uno también se recorta', 1, cuenta(150, -3).actual)
  // «Ver todas»: una sola página con todo, y el pie lo dice.
  caso('ver todas es una página con todo', [1, 1, 4512],
    [cuenta(4512, 7, 100, true).paginas, cuenta(4512, 7, 100, true).desde, cuenta(4512, 7, 100, true).hasta])

  // 2. EL PAGINADOR NO SE PINTA SI TODO CABE, que es lo que deja intacta a una
  //    hermandad pequeña: con 80 hermanos no aparece nada nuevo en su censo.
  const pag = await readFile('src/components/Paginador.tsx', 'utf8')
  caso('el paginador se calla cuando cabe en una página', true,
    /if \(p\.paginas <= 1 && !p\.todas\) return null/.test(pag))
  // Y dice el TOTAL, no solo en qué página estás.
  caso('el pie dice cuántas hay en total', true, /de \$\{p\.total/.test(pag))
  // El estado de la página puesta no va solo en el color.
  caso('la página puesta lo dice también al lector de pantalla', true,
    /aria-current=\{n === p\.numero \? 'page' : undefined\}/.test(pag))

  // 3. LO QUE NO SE PUEDE PAGINAR. Cada uno con su lista entera.
  const censo = await readFile('src/pages/app/Hermanos.tsx', 'utf8')
  const enteras = [
    ['el CSV se descarga entero', /function exportarCsv\(lista: Hermano\[\] = filtered\)/],
    ['el padrón impreso lleva el censo entero', /filas=\{filtered\.map/],
    ['y su recuadro cuenta el filtrado entero', /valor: String\(filtered\.length\)/],
    ['«marcar todos» marca el filtrado entero', /filtered\.forEach\(\(h\) => siguiente\.add\(h\.id\)\)/],
    ['y el botón de descargar dice cuántas son', /<small>\{filtered\.length\}<\/small>/],
  ]
  for (const [loQueEs, patron] of enteras) caso(loQueEs, true, patron.test(censo))

  /*
   * Y DICHO AL REVÉS, que es como se caza de verdad: la página NO puede
   * aparecer en ninguno de esos cuatro sitios. Lo de arriba seguiría en verde
   * si alguien añadiera un segundo camino que sí pagina.
   */
  const laPaginaFuera = []
  for (const marca of ['function exportarCsv', 'const informeImpreso', 'function alternarTodos']) {
    const i = censo.indexOf(marca)
    if (i < 0) { laPaginaFuera.push(`${marca}: ya no está (¿se ha renombrado?)`); continue }
    const trozo = censo.slice(i, i + 1200)
    if (/paginado\.pagina/.test(trozo)) laPaginaFuera.push(`${marca}: le llega la PÁGINA, no la lista`)
  }
  caso('a nada de eso le llega una página', [], laPaginaFuera)

  // 4. Y a la tabla sí le llega la página, en las cuatro pantallas.
  const conPagina = [
    ['el censo', 'src/pages/app/Hermanos.tsx', /lista=\{paginado\.pagina\}/],
    ['los recibos', 'src/pages/app/Cuotas.tsx', /filtered=\{paginadoDeRecibos\.pagina\}/],
    ['cuotas por hermano', 'src/pages/app/Cuotas.tsx', /situacionesFiltradas=\{paginadoPorHermano\.pagina\}/],
    ['Tesorería', 'src/pages/app/Tesoreria.tsx', /filtered=\{paginado\.pagina\}/],
    ['las papeletas', 'src/pages/app/Papeletas.tsx', /filas=\{paginado\.pagina\}/],
  ]
  for (const [comoSeLlama, ruta, patron] of conPagina) {
    const t = await readFile(ruta, 'utf8')
    caso(`${comoSeLlama}: a la tabla le llega la página`, true, patron.test(t))
  }

  // 5. Y la fila de «no hay nada» mira la lista ENTERA: con la página, una
  //    búsqueda sin resultados en la página 3 no diría nada.
  const vacios = [
    ['src/pages/app/Tesoreria.tsx', /\{filtered\.length === 0 && \(/],
    ['src/pages/app/Papeletas.tsx', /\{filas\.length === 0 && \(/],
    ['src/pages/app/Cuotas.tsx', /\{filtered\.length === 0 && \(/],
  ]
  for (const [ruta, patron] of vacios) {
    const t = await readFile(ruta, 'utf8')
    caso(`${ruta.split('/').pop()}: el «no hay nada» mira la lista entera`, true, patron.test(t))
  }
}

/*
 * ============================================================================
 * EL PADRÓN DEL CENSO SOLO EXISTE MIENTRAS SE IMPRIME
 * ============================================================================
 *
 * La pantalla del censo llevaba SIEMPRE en el documento un padrón completo,
 * escondido con `screen-hidden` y visible solo en el papel. Con ochocientos
 * hermanos eran 4.836 nodos —el 20 % del DOM de esa pantalla— que nadie mira
 * hasta que se pulsa Imprimir. Y el comentario que tenía al lado decía «solo
 * existe al imprimir»: no era verdad, existía siempre.
 *
 * Medido con `scripts/caza/probar-padron.mjs`: 2.756 nodos en pantalla, 7.592
 * mientras se imprime, y vuelta a 2.756 al acabar.
 *
 * LAS TRES COSAS QUE SE VIGILAN, Y LAS TRES SE ROMPEN SOLAS SI SE TOCAN MAL:
 *
 *   1. Que el padrón NO esté en el árbol si no se está imprimiendo. Es el
 *      arreglo.
 *   2. Que se enganche a `beforeprint` y NO al botón. Hay dos caminos para
 *      imprimir —el botón, que llama a `window.print()`, y el Ctrl+P del
 *      navegador, que no pasa por ninguna pantalla nuestra—. Montándolo en el
 *      botón, el Ctrl+P imprimiría un censo EN BLANCO sin decir nada.
 *   3. Que use `flushSync`. El navegador prepara el papel en cuanto vuelve el
 *      manejador: un `setState` normal es asíncrono, React lo agruparía para
 *      después, y el diálogo ya tendría su foto hecha —sin el padrón—. Es el
 *      fallo que dejaría el arreglo puesto y el papel en blanco.
 *   4. Y que se DESMONTE al acabar (`afterprint`). Sin eso el arreglo dura una
 *      impresión: a la primera, el padrón se queda montado para siempre.
 */
async function elPadronSoloAlImprimir({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const censo = await readFile('src/pages/app/Hermanos.tsx', 'utf8')
  const imp = await readFile('src/lib/imprimir.ts', 'utf8')

  caso('el padrón no está en el árbol si no se imprime', true,
    /\{aImprimir && informeImpreso\}/.test(censo))
  // Y dicho al revés: que no se haya quedado un segundo sitio que lo monta.
  caso('y no se monta por ningún otro sitio', 1,
    (censo.match(/\{informeImpreso\}|\{aImprimir && informeImpreso\}/g) || []).length)

  caso('se engancha al evento de imprimir, no al botón', true,
    /addEventListener\('beforeprint'/.test(imp))
  caso('y se desmonta al acabar', true, /addEventListener\('afterprint'/.test(imp))
  caso('con flushSync, que si no el papel sale en blanco', true,
    /flushSync\(\(\) => setImprimiendo\(true\)\)/.test(imp))
  caso('y se quitan los dos oyentes al desmontar', true,
    /removeEventListener\('beforeprint'/.test(imp) && /removeEventListener\('afterprint'/.test(imp))

  /*
   * Y EL PADRÓN SIGUE LLEVANDO EL CENSO ENTERO, no la página. Es el mismo
   * peligro del punto de la paginación y merece su propio caso aquí: si un día
   * alguien junta las dos ideas mal, sale un padrón de cien de ochocientos.
   */
  caso('el padrón imprime el censo filtrado entero', true, /filas=\{filtered\.map/.test(censo))
}
