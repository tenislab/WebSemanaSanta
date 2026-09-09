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
  const { readFile } = await import('node:fs/promises')
  const pantalla = await readFile('src/pages/app/Cuotas.tsx', 'utf8')

  /*
   * --- EL MÉTODO DE VERDAD LLEGA AL LIBRO DE CUENTAS ---
   *
   * Es lo único de todo esto que descuadra dinero, así que va primero.
   * `conApunteDeCobro` decide con `cuentaSegunMetodo()` si el ingreso va a caja
   * o al banco: pasarle el método equivocado no da error, da un descuadre.
   */
  caso('se puede decir cómo se ha cobrado de verdad', true,
    /function marcarPagada\(id: string, metodo\?: MetodoCobro\)/.test(pantalla))
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
}
