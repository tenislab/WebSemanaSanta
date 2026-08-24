/**
 * EL IBAN, COMPROBADO ANTES DE MANDÁRSELO AL BANCO.
 *
 * NO HABÍA NINGUNA COMPROBACIÓN. El IBAN del hermano viajaba tal cual desde su
 * ficha hasta el fichero de adeudos, y de ahí al banco.
 *
 * Y eso no falla en una línea: FALLA EN LA REMESA ENTERA. El banco valida la
 * estructura del pain.008 antes de procesar nada, así que un IBAN con la
 * longitud mal o con los dígitos de control cambiados hace que rechace el
 * fichero completo. Mil recibos sin cobrar por una errata de una fila, y el
 * aviso que llega es un código del banco que no dice qué fila era.
 *
 * Las erratas son lo normal: el IBAN sale del Excel de siempre, donde alguien
 * lo tecleó a mano hace años.
 *
 * Y LA OTRA MITAD DEL FALLO: el hermano domiciliado SIN IBAN se caía de la
 * remesa en silencio. La tesorería descargaba el fichero creyendo que cobraba a
 * todos los domiciliados, y a esos no. Su recibo se quedaba «Pendiente» para
 * siempre, entraba otra vez en la siguiente remesa, se volvía a caer, y nada en
 * la pantalla decía nunca por qué.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/iban.ts')

  // --- Uno de verdad. Este es el de ejemplo de la propia aplicación.
  caso('un IBAN español bueno vale', true, m.ibanValido('ES9121000418450200051332'))
  caso('con espacios, igual', true, m.ibanValido('ES91 2100 0418 4502 0005 1332'))
  caso('en minúsculas, igual', true, m.ibanValido('es9121000418450200051332'))
  caso('con guiones también', true, m.ibanValido('ES91-2100-0418-4502-0005-1332'))

  /*
   * --- LO QUE PILLA, QUE ES DE LO QUE VA ESTO ---
   *
   * Los dígitos de control existen justo para esto: una cifra cambiada al
   * teclear, o dos intercambiadas, que es como se equivoca cualquiera.
   */
  caso('una cifra cambiada no cuela', false, m.ibanValido('ES9121000418450200051333'))
  caso('dos cifras intercambiadas tampoco', false, m.ibanValido('ES9121000418450200051323'))
  caso('los dígitos de control cambiados, tampoco', false, m.ibanValido('ES9221000418450200051332'))

  // Longitud: un IBAN español tiene 24. Ni 23 ni 25.
  caso('le falta una cifra', false, m.ibanValido('ES912100041845020005133'))
  caso('le sobra una cifra', false, m.ibanValido('ES91210004184502000513320'))

  /*
   * EL NÚMERO DE CUENTA ANTIGUO, de veinte cifras y sin «ES» delante. Está en
   * medio censo importado de una hoja vieja, porque es lo que había antes del
   * IBAN. Va al banco y no significa nada.
   */
  caso('el número de cuenta antiguo no es un IBAN', false, m.ibanValido('21000418450200051332'))
  caso('vacío no vale', false, m.ibanValido(''))
  caso('un texto cualquiera tampoco', false, m.ibanValido('no lo sé'))
  caso('null no revienta', false, m.ibanValido(null))

  // Un país que no es de la zona SEPA: el IBAN puede ser correcto y aun así el
  // banco no puede cobrar ahí con este fichero.
  caso('un IBAN de fuera de SEPA se rechaza', false, m.ibanValido('BR1500000000000010932840814P2'))
  // Y otros de dentro, que sí valen (hay hermanos que viven fuera).
  caso('uno alemán vale', true, m.ibanValido('DE89370400440532013000'))
  caso('uno francés vale', true, m.ibanValido('FR1420041010050500013M02606'))
  caso('uno portugués vale', true, m.ibanValido('PT50000201231234567890154'))

  /*
   * --- POR QUÉ NO VALE, DICHO PARA QUIEN LO TIENE QUE ARREGLAR ---
   *
   * «IBAN incorrecto» no sirve de nada delante de una lista de cuarenta: el que
   * está a medias y el que tiene una cifra cambiada se arreglan de maneras
   * distintas —a uno le faltan cifras, al otro hay que releerlo entero—.
   */
  caso('sin nada, se dice que no lo tiene', 'no tiene IBAN', m.porQueNoValeElIban(''))
  caso('el de veinte cifras: le falta el país', true,
    /falta el país/.test(m.porQueNoValeElIban('21000418450200051332')))
  caso('si le faltan cifras, se dice cuántas', true,
    /faltan 1 caracteres|falta 1 carácter|faltan 1/.test(m.porQueNoValeElIban('ES912100041845020005133')))
  caso('si le sobran, también', true,
    /sobran 1/.test(m.porQueNoValeElIban('ES91210004184502000513320')))
  caso('y si es una cifra cambiada, se dice eso', true,
    /dígitos de control/.test(m.porQueNoValeElIban('ES9121000418450200051333')))
  caso('un país de fuera se nombra', true,
    /«BR»|zona SEPA/.test(m.porQueNoValeElIban('BR1500000000000010932840814P2')))
  caso('uno bueno no da motivo', null, m.porQueNoValeElIban('ES9121000418450200051332'))

  // Se enseña como viene en el papel del banco.
  caso('se formatea de cuatro en cuatro', 'ES91 2100 0418 4502 0005 1332',
    m.formatearIban('ES9121000418450200051332'))

  await dondeSeUsa({ cargar, caso })
  await losDeEjemplo({ cargar, caso })
  await unaSolaRegla({ caso })
}

/**
 * Y QUE SE USE EN LOS DOS SITIOS QUE IMPORTAN.
 *
 * Tener el comprobador y no llamarlo desde la remesa deja el fallo exactamente
 * igual, con más código.
 */
async function dondeSeUsa({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const sepa = await cargar('src/lib/sepa.ts')
  const cuotas = await readFile('src/pages/app/Cuotas.tsx', 'utf8')

  /*
   * 1. EL DE LA HERMANDAD. Es el de cobro: si está mal, el banco rechaza el
   *    fichero entero. Se para antes de generarlo, donde todavía se puede leer
   *    «te falta un dígito» en vez de un código del banco.
   */
  const acreedor = (iban) => ({
    nombre: 'Hdad. de Prueba', iban, identificadorAcreedor: 'ES12ZZZ12345678',
  })
  caso('con el IBAN de la hermandad bueno, se puede remesar',
    null, sepa.acreedorIncompleto(acreedor('ES9121000418450200051332')))
  caso('sin IBAN, se dice', true, /Falta el IBAN/.test(sepa.acreedorIncompleto(acreedor('')) ?? ''))
  caso('y con uno mal escrito, también', true,
    /no vale/.test(sepa.acreedorIncompleto(acreedor('ES9121000418450200051333')) ?? ''))
  caso('diciendo qué le pasa', true,
    /dígitos de control/.test(sepa.acreedorIncompleto(acreedor('ES9121000418450200051333')) ?? ''))

  /*
   * 2. EL DEL HERMANO. No basta con que la ficha tenga algo escrito: un IBAN
   *    malo en una línea tira el fichero entero, así que ese recibo no puede
   *    entrar en la remesa.
   */
  caso('la remesa comprueba el IBAN, no solo que exista', true,
    /!ibanValido\(hermanoDe\(c\.hermanoId\)\?\.iban \?\? ''\)/.test(cuotas))
  caso('y ya no le vale con que haya algo escrito', false,
    /!hermanoDe\(c\.hermanoId\)\?\.iban\b/.test(cuotas))

  /*
   * 3. Y SOBRE TODO: QUE SE DIGA QUIÉN SE QUEDA FUERA.
   *
   * Es la mitad que hacía daño. Caerse de la remesa no es el problema —sin IBAN
   * no hay forma de cobrar—; el problema era caerse SIN QUE NADIE SE ENTERARA.
   */
  caso('se calcula quién se queda fuera', true, /const fueraDeLaRemesa = useMemo/.test(cuotas))
  caso('agrupado por hermano y no por recibo', true, /porHermano/.test(cuotas))
  caso('con el motivo de cada uno', true, /porQueNoValeElIban\(x\.hermano!\.iban \?\? ''\)/.test(cuotas))
  caso('y se enseña en pantalla', true, /fueraDeLaRemesa\.length > 0 && \(/.test(cuotas))
  // Con el dinero: «cuarenta hermanos» no mueve a nadie; «1.200 € que no se
  // cobran» sí, y es lo que hay que saber para decidir si se manda la remesa.
  caso('diciendo cuánto dinero es', true, /dineroFuera/.test(cuotas))
  caso('y dónde se arregla', true, /en Hermanos/.test(cuotas))
}

/**
 * Y LOS IBAN DE EJEMPLO DE LA APLICACIÓN TIENEN QUE VALER TAMBIÉN.
 *
 * Estaban inventados a mano —«ES47», «ES12», «ES60»…— y ninguno era un IBAN de
 * verdad. Daba igual mientras nadie los comprobara. Desde que la remesa sí los
 * comprueba, en el modo demostración salían LOS CUARENTA como «su IBAN no
 * vale», y la pantalla enseñaba un fallo que no existe.
 *
 * Y esa pantalla es la que se le enseña a una hermandad antes de decidir. No
 * puede empezar con un aviso de que el dinero no se va a cobrar.
 *
 * La cuenta sigue siendo inventada; lo único de verdad son las dos cifras que
 * la convierten en un IBAN bien formado.
 */
async function losDeEjemplo({ cargar, caso }) {
  const m = await cargar('src/lib/iban.ts')
  const censo = await cargar('src/data/hermanos.ts')
  const hdades = await cargar('src/lib/hermandades.ts')

  const delCenso = (censo.HERMANOS_INICIALES ?? []).map((h) => h.iban).filter(Boolean)
  caso('hay hermanos de ejemplo con IBAN', true, delCenso.length >= 8)
  caso('y todos valen', '', delCenso.filter((i) => !m.ibanValido(i)).join(', '))

  // Los de las hermandades de ejemplo, que son los de COBRO: si están mal, el
  // aviso que sale es «no se puede generar la remesa».
  const texto = JSON.stringify(hdades)
  const delAcreedor = [...texto.matchAll(/ES\d{2}(?: ?\d{4}){5}/g)].map((x) => x[0])
  caso('hay hermandades de ejemplo con IBAN', true, delAcreedor.length >= 5)
  caso('y también valen', '', delAcreedor.filter((i) => !m.ibanValido(i)).join(', '))
}

/**
 * UNA SOLA REGLA PARA EL IBAN, Y NO DOS.
 *
 * Había otra en `lib/format.ts`, con su propio `mod97`, que comprobaba MENOS
 * —no miraba la longitud que le toca a cada país— y a la que solo llamaba la
 * ficha del hermano. La remesa no la llamaba: un IBAN malo que hubiera entrado
 * por el importador del censo llegaba al banco sin que nadie lo mirara.
 *
 * Es el mismo estropicio que ya pasó con el DNI, y por eso está escrito en
 * `lib/dni.ts`: con dos reglas distintas, el mismo dato vale en una pantalla y
 * no en otra, y quien lo escribe no entiende por qué.
 */
async function unaSolaRegla({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const format = await readFile('src/lib/format.ts', 'utf8')

  caso('format.ts ya no tiene su propio mod97', false, /function mod97/.test(format))
  caso('sino que reexporta la de iban.ts', true, /export \{ ibanValido as isPlausibleIban/.test(format))

  // Y el único sitio donde se calcula el resto entre 97 es `lib/iban.ts`.
  const { readdir } = await import('node:fs/promises')
  const ficheros = (await readdir('src/lib')).filter((f) => f.endsWith('.ts'))
  const conElResto = []
  for (const f of ficheros) {
    const src = await readFile(`src/lib/${f}`, 'utf8')
    if (/% 97/.test(src)) conElResto.push(f)
  }
  caso('solo hay un sitio que calcule el resto entre 97', 'iban.ts', conElResto.join(', '))

  /*
   * Y EL ALTA NO PUEDE TIRAR EL IBAN EN SILENCIO. Antes:
   * «ibanRaw && isPlausibleIban(ibanRaw) ? ibanRaw : null». La secretaria daba
   * de alta al hermano con la cuenta delante, se comía una cifra, y la ficha se
   * guardaba SIN IBAN sin decir nada. Después nadie entendía por qué a ese
   * hermano no se le cobraba.
   */
  const hermanos = await readFile('src/pages/app/Hermanos.tsx', 'utf8')
  // Se busca el código, no el comentario que lo cuenta: arriba está citado.
  caso('el alta ya no tira el IBAN malo', false, /const iban = ibanRaw &&/.test(hermanos))
  caso('lo dice y no guarda', true, /setIbanAltaError\(`Ese IBAN no vale/.test(hermanos))
  caso('y el aviso se pinta en el formulario de alta', true,
    /\{ibanAltaError && <p className="form-hint form-hint--error">/.test(hermanos))
}
