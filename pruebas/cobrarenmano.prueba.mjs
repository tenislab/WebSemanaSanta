/**
 * COBRAR EN MANO: EL HERMANO QUE SE PASA POR LA CASA DE HERMANDAD.
 *
 * ============================================================================
 * QUÉ SE ARREGLA, Y NO ES SOLO COMODIDAD
 * ============================================================================
 *
 * El caso es de todos los martes: alguien se pasa por la casa de hermandad y
 * paga su cuota en efectivo. Antes había que buscarlo en la lista de recibos
 * —que en una hermandad son cientos, de varios ejercicios— y dar por pagado el
 * suyo a mano, uno por uno si debía varios.
 *
 * Y lo que salía mal no era el tiempo: `marcarPagada` apuntaba el cobro CON EL
 * MÉTODO CON EL QUE SE EMITIÓ EL RECIBO. Un recibo domiciliado pagado en
 * efectivo entraba en el cajón y el apunte del libro decía «banco». Al
 * conciliar el extracto no aparecía nunca, y la caja descuadraba todos los
 * meses por esa misma cantidad — sin que nada diera error.
 */
export default async function ({ cargar, caso }) {
  const pantalla = await (await import('./fuentes.mjs')).fuenteDeLasCuotas()

  /*
   * --- EL MÉTODO DE VERDAD LLEGA AL LIBRO DE CUENTAS ---
   *
   * Es lo único de todo esto que descuadra dinero, así que va primero.
   * `conApunteDeCobro` decide con `cuentaSegunMetodo()` si el ingreso va a caja
   * o al banco: pasarle el método equivocado no da error, da un descuadre.
   */
  /*
   * LA FIRMA, NO CÓMO SE DECLARE.
   *
   * Decía `/function marcarPagada\(…\)/`, y se puso roja el día que
   * `marcarPagada` pasó a un `useCallback` —por rendimiento, sin tocar lo que
   * hace—. Lo que este guardia protege es que se PUEDA decir el método de
   * cobro, o sea el parámetro; que sea una `function`, una flecha o un
   * `useCallback` no cambia nada de eso, y atarlo a la sintaxis solo garantiza
   * un rojo falso en el próximo cambio de forma.
   */
  caso('se puede decir cómo se ha cobrado de verdad', true,
    /marcarPagada\s*=?\s*(useCallback\()?\(?\(?id: string, metodo\?: MetodoCobro\)/.test(pantalla))
  caso('y ese método es el que va al libro', true, /metodo: metodo \?\? c\.metodoCobro/.test(pantalla))
  caso('y se guarda en el recibo', true, /metodoCobro: metodo, domiciliada: metodo === 'Domiciliación'/.test(pantalla))
  /*
   * Y SIN DECIR NADA SE COMPORTA COMO ANTES. Hay otros dos sitios que llaman a
   * `marcarPagada` —la fila y la ficha— y no tienen por qué cambiar: allí no se
   * está cobrando en ventanilla, solo se está dando por bueno lo que ya pasó.
   */
  caso('sin decir método, no se toca nada del recibo', true,
    /\.\.\.\(metodo \? \{ metodoCobro: metodo/.test(pantalla))

  /*
   * --- «DOMICILIACIÓN» NO SE OFRECE AQUÍ ---
   *
   * Quien está delante pagando no está domiciliando nada. Ofrecerlo en este
   * desplegable es ofrecer justo el error que descuadra la caja, y a un clic
   * del que hay que elegir.
   */
  caso('no se ofrece domiciliar a quien paga en mano', true,
    /METODOS_COBRO\.filter\(\(m\) => m !== 'Domiciliación'\)/.test(pantalla))
  // Y lo que viene puesto de partida es efectivo, que es el caso de siempre.
  caso('viene puesto «Efectivo»', true, /useState<MetodoCobro>\('Efectivo'\)/.test(pantalla))

  /*
   * --- SE VEN TODOS SUS RECIBOS, NO LOS DEL AÑO QUE SE ESTÉ MIRANDO ---
   *
   * Quien viene a pagar en ventanilla suele traer atrasados. Filtrar por el
   * ejercicio que hay abierto en la pantalla sería cobrarle la mitad y dejarle
   * debiendo sin que nadie se entere — y encima con él delante, convencido de
   * que se ha puesto al día.
   */
  caso('se ven sus recibos de cualquier ejercicio', false,
    /recibosDelQueVieneAPagar[\s\S]{0,400}?ejercicioMirado/.test(pantalla))
  caso('y solo los que debe', true,
    /c\.hermanoId === cobroEnManoId && c\.estado !== 'Pagada'/.test(pantalla))
  // Del más viejo al más nuevo, que es el orden en que se cobra.
  caso('del más antiguo primero', true, /a\.fechaEmision < b\.fechaEmision \? -1 : 1/.test(pantalla))

  /*
   * --- Y EL TOTAL, PORQUE ES LO PRIMERO QUE SE PREGUNTA ---
   *
   * «¿Cuánto es?» se pregunta antes que nada. Sumar cuatro recibos de cabeza
   * con alguien delante es como se cobra de menos.
   */
  caso('se dice cuánto debe en total', true,
    /sumaEuros\(recibosDelQueVieneAPagar\.map\(\(c\) => c\.importe\)\)/.test(pantalla))

  // --- LAS BAJAS NO SALEN EN EL BUSCADOR ---
  caso('a una baja no se le cobra', true, /hermanos\.filter\(\(h\) => h\.estado !== 'Baja'\)/.test(pantalla))
  // Y se busca por nombre o por número, que es como llega la gente.
  caso('se busca por número también', true, /marca: `Nº \$\{h\.numero\}`/.test(pantalla))

  /*
   * --- Y ESTÁ ARRIBA, NO ESCONDIDO ---
   *
   * Es lo que se hace con alguien delante esperando: si hay que buscarlo, se
   * acaba dando por pagado el recibo desde la lista y perdiendo el método, que
   * es justo lo que descuadraba la caja.
   */
  const posCobro = pantalla.indexOf('Cobrar a un hermano')
  const posTabla = pantalla.indexOf('Recibos emitidos')
  caso('el apartado existe', true, posCobro > 0)
  caso('y va antes que las cifras', true, posCobro < posTabla)

  await elCobroVaPlegado({ caso })
}

/**
 * Y AHORA VA PLEGADO, SIN DEJAR DE IR PRIMERO.
 *
 * «Lo de cobrar a un hermano que sea un desplegable». Estaba SIEMPRE abierto,
 * con su buscador y su desplegable de método ocupando la cabecera de Cuotas los
 * trescientos sesenta y cuatro días del año en que no hay nadie delante
 * pagando. Medido: 191 px abierto, 90 px plegado, y las cifras del ejercicio
 * suben de 612 px a 511 px.
 *
 * Ser lo PRIMERO y estar ABIERTO no son lo mismo, y el motivo de que vaya
 * primero —que se hace con alguien delante esperando— no pide lo segundo.
 */
async function elCobroVaPlegado({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const crudo = await readFile('src/pages/app/Cuotas.tsx', 'utf8')
  /*
   * FUERA LOS COMENTARIOS, Y VA LA TERCERA VEZ.
   *
   * La primera versión de la guarda de más abajo buscaba
   * `open={cobroAbierto ||` para comprobar que esa recaída NO está… y salió
   * roja contra el código correcto, porque el comentario que explica la
   * recaída la escribe con todas las letras. Es el tercer guardia de este
   * repositorio que se vigila a sí mismo. Se quitan antes de buscar nada.
   */
  const { sinComentarios } = await import('./fuentes.mjs')
  const pantalla = sinComentarios(crudo)

  caso('el cobro en mano es un plegable', true,
    /<details\s+className="settings-card cobro-en-mano"/.test(pantalla))

  /*
   * EL `details` CONTROLADO, Y SOLO POR EL ESTADO.
   *
   * La primera versión puso `open={cobroAbierto || !!cobroEnManoId}` para que
   * no se cerrara en mitad de un cobro. En el navegador se cerraba igual: el
   * clic en el `summary` abre y cierra el `details` por su cuenta, y si la prop
   * `open` que React tiene apuntada no cambia de valor, React no vuelve a
   * escribir el atributo. El DOM se iba por un lado y el árbol por otro. En el
   * código parecía correcto; se vio pulsándolo en una sonda.
   *
   * Así que `open` sale SOLO del estado, que es lo único que no se
   * desincroniza. Esta guarda es justo contra esa recaída.
   */
  caso('el abierto sale solo del estado', true, /open=\{cobroAbierto\}/.test(pantalla))
  caso('y no de una condición que React no vea cambiar', false,
    /open=\{cobroAbierto \|\|/.test(pantalla))
  caso('y el estado se entera de que lo han cerrado', true,
    /onToggle=\{\(e\) => setCobroAbierto\(/.test(pantalla))

  /*
   * CERRARLO NO PIERDE EL COBRO. Es lo que hay que garantizar en vez de
   * impedirle cerrar a quien quiere cerrar: el hermano elegido vive en
   * `cobroEnManoId`, que es estado de la pantalla y no del `details`, así que
   * al volver a abrirlo sigue ahí. Comprobado en el navegador: se elige a
   * Rafael Ortiz, se cierra, se abre y el campo sigue poniendo su nombre.
   *
   * La primera versión de esta guarda exigía encontrar un `setCobroEnManoId(null)`
   * en la pantalla, y no lo hay: la elección se vacía desde el propio buscador,
   * con `setCobroEnManoId(p?.id ?? null)`. O sea que la guarda afirmaba algo
   * falso sobre el código y se ponía roja contra el código correcto. Lo que
   * hay que vigilar es solo esto: que al plegar no se toque la elección.
   */
  const quienesVacian = [...pantalla.matchAll(/setCobroEnManoId\(([^)]*)\)/g)].map((m) => m[1])
  caso('alguien puede vaciar la elección', true, quienesVacian.length > 0)
  caso('pero no el plegable', false,
    /onToggle=[\s\S]{0,160}setCobroEnManoId/.test(pantalla))

  /*
   * Y LO DE DENTRO SIGUE ENTERO. Plegar una tarjeta es la forma más fácil de
   * perder lo que llevaba dentro sin que nada lo note: el que cobra en mano
   * necesita el buscador, el método SIN domiciliación y el botón por recibo.
   */
  const abre = pantalla.indexOf('cobro-en-mano')
  const cierra = pantalla.indexOf('<section className="stat-grid">')
  caso('se acota el plegable', true, abre > 0 && cierra > abre)
  const dentro = pantalla.slice(abre, cierra)
  caso('sigue el buscador de hermano', true, /id="cobro-en-mano"/.test(dentro))
  caso('sigue el método de pago', true, /id="metodo-en-mano"/.test(dentro))
  caso('sin domiciliación en la lista', true, /m !== 'Domiciliación'/.test(dentro))
  caso('y sigue cobrando recibo por recibo', true, /marcarPagada\(c\.id, metodoEnMano\)/.test(dentro))
  // El rótulo tiene que decir para qué es, porque plegado es lo único que se ve.
  caso('el rótulo dice para qué es', true, /Viene a pagar a la casa de hermandad/.test(dentro))
}
