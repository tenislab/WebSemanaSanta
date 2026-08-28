/**
 * UN DATO VIEJO EN EL NAVEGADOR NO PUEDE DEJAR LA PANTALLA EN BLANCO.
 *
 * Esta prueba nace de un aviso de una sola frase: «en mi navegador principal
 * se queda en blanco, pero en privada no». Esa frase es el síntoma exacto de
 * un dato guardado que la aplicación ya no sabe leer —en una ventana privada
 * no hay nada guardado, y por eso ahí sí arranca—.
 *
 * Lo que había en `leerPersistido` parecía correcto:
 *
 *     const raw = localStorage.getItem(clave)
 *     if (raw) return JSON.parse(raw) as T
 *
 * El `as T` es una promesa que TypeScript se cree y que nadie comprueba. Con
 * un `null` guardado —de una versión antigua, de un guardado a medias, de una
 * migración— esto devolvía `null` y la pantalla siguiente hacía
 * `hermanos.filter(...)` sobre él. React desmonta el árbol entero cuando algo
 * revienta al pintar: página en blanco, sin mensaje y solo en ese navegador.
 *
 * Barriendo las claves con dos formas equivocadas salieron VEINTICINCO
 * combinaciones que tumbaban la aplicación —el censo, las cuotas, las
 * papeletas, los movimientos, el personal, la suscripción—. Aquí se comprueba
 * que ninguna de esas formas vuelve a pasar de largo.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/persistencia.ts')

  /** Un `localStorage` de mentira, para poder guardar basura a propósito. */
  const almacen = new Map()
  globalThis.localStorage = {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => almacen.set(k, String(v)),
    removeItem: (k) => almacen.delete(k),
    clear: () => almacen.clear(),
  }
  const guardar = (v) => almacen.set('x', v)

  /*
   * 1. LAS DOS FORMAS QUE DE VERDAD APARECIERON: un `null` guardado y un
   * objeto donde se esperaba una lista.
   */
  {
    guardar('null')
    caso('un null guardado no se devuelve como lista', [], m.leerPersistido('x', []))
    guardar('{"a":1}')
    caso('un objeto donde va una lista tampoco', [], m.leerPersistido('x', []))
    // Y lo que se devuelve tiene que SER una lista de verdad, no algo que lo
    // parezca: es lo único que hace que `.filter` no reviente.
    guardar('null')
    caso('y lo devuelto es una lista de verdad', true, Array.isArray(m.leerPersistido('x', [])))
  }

  // 2. Lo bueno sigue pasando, que es la otra mitad del trato.
  {
    guardar('[{"id":"1"}]')
    caso('una lista buena se devuelve entera', 1, m.leerPersistido('x', []).length)
    caso('con su contenido', '1', m.leerPersistido('x', [])[0].id)
    guardar('{"activa":true}')
    caso('un objeto donde va un objeto, también', true, m.leerPersistido('x', { activa: false }).activa)
    guardar('"hola"')
    caso('y un texto donde va un texto', 'hola', m.leerPersistido('x', ''))
    guardar('true')
    caso('y un sí o no', true, m.leerPersistido('x', false))
  }

  /*
   * 3. LAS OTRAS FORMAS EQUIVOCADAS. Un número donde va una lista, una lista
   * donde va un objeto, un texto donde va un número.
   */
  {
    guardar('7')
    caso('un número donde va una lista se descarta', [], m.leerPersistido('x', []))
    guardar('[1,2]')
    caso('una lista donde va un objeto se descarta', { a: 1 }, m.leerPersistido('x', { a: 1 }))
    guardar('"vaya"')
    caso('un texto donde va un número se descarta', 0, m.leerPersistido('x', 0))
    guardar('{"n":1}')
    caso('un objeto donde va un texto se descarta', '', m.leerPersistido('x', ''))
  }

  /*
   * 4. Y LO QUE NO SE PUEDE LEER. Un JSON a medias —el navegador se quedó sin
   * espacio a mitad de escribir— no puede tumbar nada.
   */
  {
    guardar('[{"id":')
    caso('un JSON cortado no revienta', [], m.leerPersistido('x', []))
    almacen.delete('x')
    caso('y sin nada guardado, lo de siempre', [], m.leerPersistido('x', []))
  }

  /*
   * 5. EL CASO DEL `null` A PROPÓSITO. Hay un sitio que SÍ espera `null` —la
   * convocatoria de papeletas, que puede no existir—, así que ahí tiene que
   * seguir pasando. Si no, se estaría arreglando un fallo creando otro.
   */
  {
    guardar('null')
    caso('donde se espera null, null vale', null, m.leerPersistido('x', null))
    guardar('{"anio":2027}')
    caso('y un objeto también', 2027, m.leerPersistido('x', null).anio)
    guardar('"vaya"')
    caso('pero un texto no', null, m.leerPersistido('x', null))
  }

  /*
   * 6. LA RED DE SEGURIDAD, por si algún día se cuela otro fallo distinto.
   * Sin ella, cualquier error al pintar vuelve a ser una pantalla en blanco
   * que nadie puede diagnosticar por teléfono.
   */
  const { readFile } = await import('node:fs/promises')
  const main = await readFile('src/main.tsx', 'utf8')
  caso('la aplicación va envuelta en la red de seguridad', true, /<SiAlgoPetardea>/.test(main))
  // Y POR FUERA del proveedor de sesión: si lo que revienta es leer la sesión
  // guardada, un envoltorio por dentro no llegaría a montarse.
  caso('y por fuera del proveedor de sesión', true,
    main.indexOf('<SiAlgoPetardea>') < main.indexOf('<AuthProvider>'))

  /*
   * Se le quitan los comentarios antes de mirar. Sin eso, esta prueba fallaba
   * por la frase «no `localStorage.clear()`» del comentario que explica
   * justamente que no se usa: cazaba la explicación en vez del código.
   */
  const sinComentarios = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  const red = sinComentarios(await readFile('src/components/SiAlgoPetardea.tsx', 'utf8'))
  caso('atrapa los errores de pintado', true, /getDerivedStateFromError/.test(red))
  caso('enseña el fallo para poder copiarlo', true, /error\.name.*error\.message/.test(red))
  caso('y ofrece vaciar los datos de este navegador', true, /removeItem/.test(red))
  // Solo las claves de Gobergo: en el mismo dominio puede haber cosas de otras
  // herramientas, y llevárselas por delante sería pasarse de listo.
  caso('sin llevarse por delante lo que no es suyo', false, /localStorage\.clear\(\)/.test(red))
}
