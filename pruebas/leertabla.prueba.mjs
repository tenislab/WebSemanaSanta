/**
 * LEER UNA CASILLA DE UNA HOJA AJENA.
 *
 * Es la parte más callada del importador y la que más daño hace si falla: un
 * importe leído al revés no da error, da un número. «1.234,56» son mil
 * doscientos treinta y cuatro euros con cincuenta y seis, y «1,234.56» —la
 * misma cantidad escrita a la inglesa— también. Confundirlos multiplica la
 * tesorería de una hermandad por cien, y lo peor es que la pantalla queda
 * perfecta: cuadra consigo misma, solo que con cifras que no son.
 *
 * Estas pruebas fijan la regla, que no es adivinar sino contar cifras: con los
 * dos separadores manda el de la derecha; con uno solo, tres cifras detrás son
 * millares y cualquier otra cosa son decimales (tres decimales no existen en
 * euros). Y fijan lo que NUNCA debe pasar: que algo que no se entiende se
 * convierta en un 0 silencioso.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/leerTabla.ts')

  await lasEnesSobreviven({ m, caso })

  // --- Importes: las dos convenciones a la vez ---
  caso('a la española, con millares y decimales', 1234.56, m.importeDe('1.234,56'))
  caso('a la inglesa, con millares y decimales', 1234.56, m.importeDe('1,234.56'))
  caso('solo decimales con coma', 12.5, m.importeDe('12,5'))
  caso('solo decimales con punto', 12.5, m.importeDe('12.50'))
  caso('un punto y tres cifras detrás son millares', 1234, m.importeDe('1.234'))
  caso('una coma y tres cifras detrás también', 1234, m.importeDe('1,234'))
  caso('varios millares seguidos', 1234567, m.importeDe('1.234.567'))
  caso('sin separadores', 60, m.importeDe('60'))

  // --- Lo que le pega Excel alrededor ---
  caso('con el euro detrás', 60, m.importeDe('60,00 €'))
  caso('con el euro delante', 60, m.importeDe('€ 60,00'))
  caso('con la palabra EUR', 1234.56, m.importeDe('1.234,56 EUR'))
  caso('con espacio de millares', 1234.56, m.importeDe('1 234,56'))

  // --- Las tres formas de escribir un negativo que sueltan los bancos ---
  caso('con el signo delante', -120, m.importeDe('-120,00'))
  caso('entre paréntesis', -120, m.importeDe('(120,00)'))
  caso('con el signo detrás', -120, m.importeDe('120,00-'))

  /*
   * LO QUE NO SE ENTIENDE VUELVE NULL, NUNCA CERO.
   *
   * Un cero silencioso en una columna de importes descuadra la caja y no hay
   * quien lo encuentre: la fila está, el concepto está, y falta el dinero.
   */
  caso('vacío no es cero', null, m.importeDe(''))
  caso('un guion suelto tampoco', null, m.importeDe('-'))
  caso('ni una palabra', null, m.importeDe('sin cargo'))
  caso('ni un texto con números dentro', null, m.importeDe('12 recibos'))
  caso('el cero escrito sí es cero', 0, m.importeDe('0,00'))

  // --- Fechas ---
  caso('en ISO', '2026-02-03', m.fechaIso('2026-02-03'))
  caso('a la española', '2026-02-03', m.fechaIso('03/02/2026'))
  caso('con guiones', '2026-02-03', m.fechaIso('03-02-2026'))
  /*
   * CON EL MES EN LETRA. No es un capricho: es exactamente como guarda las
   * fechas la propia aplicación («05 ene 2026» en Tesorería y en Cuotas). Sin
   * esto, exportar el libro de caja de Gobergo y volver a subirlo —el primer
   * movimiento que hace cualquiera al probar el importador— no se entendía.
   */
  caso('como las escribe la aplicación', '2026-01-05', m.fechaIso('05 ene 2026'))
  caso('con el mes entero', '2026-02-03', m.fechaIso('3 de febrero de 2026'))
  caso('con septiembre abreviado por el navegador', '2026-09-03', m.fechaIso('03 sept 2026'))
  caso('el 31 de febrero no existe', null, m.fechaIso('31/02/2026'))
  caso('un texto cualquiera no es fecha', null, m.fechaIso('el año pasado'))

  // Y la vuelta: lo importado tiene que quedar escrito IGUAL que lo tecleado a
  // mano, o las dos formas conviven en la misma columna y se ordenan mal.
  const comoLaApp = new Date('2026-01-05T00:00:00')
    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  caso('se vuelve a escribir como lo hace la aplicación', comoLaApp, m.fechaEs('2026-01-05'))

  // --- Años ---
  caso('un año suelto', 1998, m.anioDe('1998'))
  caso('el año de una fecha', 1998, m.anioDe('12/03/1998'))
  caso('sin año no hay año', null, m.anioDe('marzo'))

  // --- Elegir del catálogo de la hermandad ---
  const CATEGORIAS = ['Mantenimiento', 'Cultos Internos', 'Gastos varios menores']
  caso('lo escrito igual', 'Mantenimiento', m.elegirDeLista('mantenimiento', CATEGORIAS))
  caso('con tilde y mayúsculas de por medio', 'Cultos Internos', m.elegirDeLista('CULTOS INTERNOS', CATEGORIAS))
  caso('lo que empieza igual', 'Mantenimiento', m.elegirDeLista('Mantenimiento casa hermandad', CATEGORIAS))
  caso('lo que no está no se inventa', null, m.elegirDeLista('Flores', CATEGORIAS))

  /*
   * Y LO QUE ENCAJA EN DOS SITIOS NO SE ADIVINA.
   *
   * El parecido por principio es útil —«Cultos» encuentra «Cultos Internos»—
   * pero solo mientras haya UNA candidata. Una hermandad que separe «Cultos
   * Internos» de «Cultos Externos» —que es lo normal— y traiga una hoja donde
   * ponga «Cultos» a secas tenía las dos encajando, y se cogía LA PRIMERA DE
   * LA LISTA. No la más parecida: la primera.
   *
   * Y de las partidas cuelga el Estado de Cuentas que se lee en el cabildo. Un
   * gasto de tres mil euros en la columna de al lado no da error, cuadra igual
   * de bien, y no lo ve nadie.
   *
   * Devolviendo null se cae en el camino que ya existía para lo desconocido:
   * va a «otros» y SE AVISA en la vista previa, que es donde la tesorería
   * puede decidir. Adivinar mal en silencio es lo único que no vale.
   */
  const DOS_CULTOS = ['Cultos Externos', 'Cultos Internos', 'Mantenimiento']
  caso('con dos que encajan, no se elige a dedo', null, m.elegirDeLista('Cultos', DOS_CULTOS))
  // Y si solo hay una, se sigue encontrando: esto no rompe lo que ya iba.
  caso('con una sola que encaja, se encuentra igual', 'Cultos Internos',
    m.elegirDeLista('Cultos', ['Cultos Internos', 'Mantenimiento']))
  caso('y lo exacto manda sobre el parecido', 'Cultos Externos',
    m.elegirDeLista('Cultos Externos', DOS_CULTOS))
  // El otro sentido del parecido —lo escrito es más largo que la partida—
  // también tiene que seguir funcionando.
  caso('lo más largo sigue encontrando su partida', 'Mantenimiento',
    m.elegirDeLista('Mantenimiento casa hermandad', DOS_CULTOS))

  // --- Sí y no, distinguiendo «ha dicho que no» de «no ha dicho nada» ---
  caso('una x es que sí', true, m.siNo('x'))
  caso('un no es que no', false, m.siNo('No'))
  caso('en blanco no dice nada', null, m.siNo(''))

  /*
   * LA FECHA CON HORA, QUE ES COMO VIENE DEL BANCO.
   *
   * Un movimiento exportado de la banca electrónica no viene «14/03/1985»:
   * viene «14/03/1985 12:30». Y Excel escribe «01/01/2026 0:00» en cuanto la
   * celda es de tipo fecha-hora, aunque la hora sean las doce de la noche.
   *
   * Ninguno de los tres patrones lo reconocía, así que el libro de caja se
   * importaba con «No se entiende la fecha» EN TODAS LAS FILAS. Y la fecha es
   * campo obligatorio: no entraba ni un apunte. Es justo el archivo que una
   * hermandad trae el primer día.
   */
  caso('con hora detrás, se queda el día', '2026-01-01', m.fechaIso('1/1/2026 0:00'))
  caso('y con hora y minutos', '1985-03-14', m.fechaIso('14/03/1985 12:30'))
  caso('con segundos también', '2026-02-03', m.fechaIso('2026-02-03 09:15:30'))
  caso('en formato ISO con T', '2026-02-03', m.fechaIso('2026-02-03T00:00:00'))
  caso('con zona horaria', '2026-02-03', m.fechaIso('2026-02-03T10:00:00Z'))
  caso('con AM/PM', '1985-03-14', m.fechaIso('14/03/1985 8:05 PM'))
  // Y lo de siempre sigue igual.
  caso('sin hora, como siempre', '1985-03-14', m.fechaIso('14/03/1985'))
  caso('y con el mes en letra, como lo escribe la app', '2026-02-03', m.fechaIso('03 feb 2026'))
  // Una hora suelta NO es una fecha: quitarle la hora dejaría la cadena vacía
  // y no puede colarse como fecha de nada.
  caso('una hora suelta no es una fecha', null, m.fechaIso('12:30'))
}

/**
 * LAS EÑES SOBREVIVEN AL VIAJE, VENGA EL ARCHIVO COMO VENGA.
 *
 * El archivo se leía SIEMPRE como UTF-8, y el CSV que suelta el Excel de una
 * hermandad española no lo es: es Windows-1252. Ahí cada tilde y cada eñe es
 * un byte que en UTF-8 no significa nada.
 *
 * Y no fallaba con un error, que se habría visto: `TextDecoder` cambiaba cada
 * byte que no entendía por un rombo y seguía. «MARÍA IBÁÑEZ MUÑOZ» entraba
 * como «MAR?A IB??EZ MU?OZ», el importador no encontraba ningún problema —el
 * DNI estaba bien, el nombre no iba vacío— y la pantalla daba las mil ciento
 * ochenta y ocho altas en verde. El censo entero con los nombres rotos y ni un
 * aviso en ninguna parte.
 *
 * Se comprueban las cuatro maneras en que Excel puede soltar el mismo fichero,
 * porque la hermandad elige una del desplegable sin saber lo que significa.
 */
async function lasEnesSobreviven({ m, caso }) {
  const nombre = 'MARÍA IBÁÑEZ MUÑOZ'
  const linea = `DNI;Nombre\n12345678Z;${nombre}\n`
  const leer = (b) => m.leerCsv(m.textoDelArchivo(new Uint8Array(b)))[1][1]

  // «CSV (delimitado por comas)» en un Windows en español: el caso que rompía.
  caso('un CSV de Excel en Windows-1252 conserva las eñes', nombre,
    leer(Buffer.from(linea, 'latin1')))
  caso('y uno en UTF-8 sigue igual de bien', nombre,
    leer(Buffer.from(linea, 'utf8')))
  // «CSV UTF-8 (delimitado por comas)», que añade la marca de bytes delante.
  caso('«CSV UTF-8», con su marca al principio', nombre,
    leer(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(linea, 'utf8')])))
  // «Texto Unicode (*.txt)», que sale en UTF-16.
  caso('«Texto Unicode», que va en UTF-16', nombre,
    leer(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(linea, 'utf16le')])))

  /*
   * Y EL ORDEN NO SE PUEDE INVERTIR. Casi cualquier archivo es «válido» en
   * Windows-1252 —no hay byte que le siente mal—, así que probarlo antes que
   * UTF-8 rompería las eñes en el sentido contrario. Esta comprobación es la
   * que lo sujeta: un UTF-8 sin marca tiene que seguir leyéndose como UTF-8.
   */
  caso('un UTF-8 sin marca no se confunde con Windows-1252', 'Muñoz, José María',
    m.textoDelArchivo(new Uint8Array(Buffer.from('Muñoz, José María', 'utf8'))))
}
