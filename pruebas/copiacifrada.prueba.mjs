/**
 * LA COPIA DE SEGURIDAD, CIFRADA.
 *
 * ============================================================================
 * QUÉ HABÍA ANTES: NADA
 * ============================================================================
 *
 * `backup.ts` descarga un archivo con TODO: cuatrocientas fichas con su DNI, su
 * dirección, su teléfono, su fecha de nacimiento, sus cuotas y sus IBAN. En
 * claro. Y ese archivo acaba en un pendrive, en un adjunto de correo o en el
 * WhatsApp de la junta, que es lo que la gente hace con un archivo llamado
 * «copia de seguridad».
 *
 * ----------------------------------------------------------------------------
 * PERO LO QUE ESTA PRUEBA VIGILA DE VERDAD ES LO OTRO
 * ----------------------------------------------------------------------------
 *
 * Que nadie se quede fuera de su propia copia.
 *
 * Cifrar es fácil. Lo difícil es que esto no se convierta en la razón por la
 * que una hermandad pierde su censo: una copia cifrada cuya contraseña se
 * pierde es una copia que ya no existe, y el censo es justo el dato que no se
 * puede volver a escribir.
 *
 * Por eso la mitad de los casos de aquí abajo no son sobre criptografía, sino
 * sobre las tres cosas que impiden ese desastre: pedir la contraseña dos veces,
 * comprobar que descifra antes de dar el archivo por bueno, y decir por su
 * nombre lo que pasa cuando alguien mete la contraseña equivocada.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const m = await cargar('src/lib/copiaCifrada.ts')

  const CENSO = JSON.stringify({
    hermanos: [{ nombre: 'Jaime Rivas', dni: '12345678Z', iban: 'ES9121000418450200051332' }],
  })
  const DATOS = { hermandad: 'Hermandad de la Vera-Cruz', fecha: '2026-09-08' }

  /*
   * --- LA VUELTA ENTERA: SE CIFRA Y SE VUELVE A ABRIR ---
   *
   * Es lo único que de verdad demuestra que esto sirve. Todo lo demás son
   * detalles alrededor.
   */
  const cifrada = await m.cifrarCopia(CENSO, 'LaVeraCruz2027', DATOS)
  caso('se puede volver a abrir con su contraseña', CENSO,
    await m.abrirCopiaCifrada(cifrada, 'LaVeraCruz2027'))

  /*
   * --- Y EL DNI NO ESTÁ EN EL ARCHIVO ---
   *
   * Que es todo el sentido de esto. Se mira el archivo ENTERO ya convertido a
   * texto, tal como se va a guardar, y no solo el trozo cifrado: es la única
   * forma de cazar el día que alguien añada un campo «de contexto» que lleve
   * datos dentro sin darse cuenta.
   */
  const enElArchivo = JSON.stringify(cifrada)
  caso('el DNI no aparece en el archivo', false, enElArchivo.includes('12345678Z'))
  caso('ni el IBAN', false, enElArchivo.includes('ES9121000418450200051332'))
  caso('ni el nombre del hermano', false, enElArchivo.includes('Jaime Rivas'))

  /*
   * PERO SÍ EL DE LA HERMANDAD Y LA FECHA, y es deliberado: quien tenga tres
   * archivos en un pendrive tiene que poder saber cuál es cuál sin abrirlos. Y
   * no revelan nada que no diga ya el nombre del fichero.
   */
  caso('el nombre de la hermandad sí, para saber cuál es', 'Hermandad de la Vera-Cruz', cifrada.hermandad)
  caso('y la fecha', '2026-09-08', cifrada.fecha)

  /*
   * --- LA CONTRASEÑA EQUIVOCADA DEVUELVE `null`, NO REVIENTA ---
   *
   * Y no es un capricho de estilo: teclear mal la contraseña es lo que pasa a
   * diario, no es un error del programa. Quien llama tiene que poder decir «esa
   * no es» sin envolverlo en un `try`, o acabará envolviéndolo mal.
   */
  caso('con la contraseña equivocada no se abre', null,
    await m.abrirCopiaCifrada(cifrada, 'otraCosa123'))
  caso('ni con una vacía', null, await m.abrirCopiaCifrada(cifrada, ''))
  // Una letra de diferencia basta: eso es que está cifrado de verdad.
  caso('ni con una letra de diferencia', null,
    await m.abrirCopiaCifrada(cifrada, 'LaVeraCruz2028'))

  /*
   * --- UN ARCHIVO TOCADO POR EL CAMINO TAMPOCO SE ABRE ---
   *
   * Esto es AES-GCM haciendo su otro trabajo: además de cifrar, AUTENTICA. Con
   * CBC, cambiar un byte devolvería basura silenciosamente — y en una copia de
   * seguridad la basura se restauraría encima del censo bueno.
   */
  const tocada = { ...cifrada, datos: `${cifrada.datos.slice(0, -6)}AAAAA=` }
  caso('un archivo manipulado no se abre', null, await m.abrirCopiaCifrada(tocada, 'LaVeraCruz2027'))

  /*
   * --- DOS COPIAS IGUALES NO SE PARECEN ---
   *
   * Sal e IV nuevos cada vez. Sin sal, dos hermandades con la misma contraseña
   * tendrían la misma clave; sin IV nuevo, dos copias de la misma hermandad
   * darían el mismo cifrado y se vería qué ha cambiado entre semana y semana.
   */
  const otra = await m.cifrarCopia(CENSO, 'LaVeraCruz2027', DATOS)
  caso('cada copia lleva su propia sal', false, otra.sal === cifrada.sal)
  caso('y su propio IV', false, otra.iv === cifrada.iv)
  caso('así que dos copias del mismo censo no se parecen', false, otra.datos === cifrada.datos)
  // Y aun así las dos se abren con la misma contraseña.
  caso('pero las dos se abren igual', CENSO, await m.abrirCopiaCifrada(otra, 'LaVeraCruz2027'))

  /*
   * --- SE COMPRUEBA QUE DESCIFRA ANTES DE DARLA POR BUENA ---
   *
   * Una copia que no se puede abrir es PEOR que no tener copia, porque la
   * hermandad cree que la tiene y se descubre el día que hace falta. Cuesta
   * medio segundo y descarta de golpe una familia entera de fallos que no hay
   * que haber previsto uno a uno.
   */
  const buena = await m.cifrarYComprobar(CENSO, 'LaVeraCruz2027', DATOS)
  caso('la copia comprobada sale bien', true, !!buena.copia)
  caso('y se abre', CENSO, await m.abrirCopiaCifrada(buena.copia, 'LaVeraCruz2027'))

  /*
   * Y SI NO DESCIFRA, NO SE DESCARGA. Se simula rompiendo el descifrado, que es
   * la única forma de llegar a esa rama sin esperar a que falle un navegador de
   * verdad. Sin esta comprobación, esa rama no se ejecutaría nunca en ninguna
   * prueba, que es como se escriben los avisos que no funcionan.
   */
  {
    const original = crypto.subtle.decrypt.bind(crypto.subtle)
    crypto.subtle.decrypt = async () => new TextEncoder().encode('otra cosa').buffer
    try {
      const mala = await m.cifrarYComprobar(CENSO, 'LaVeraCruz2027', DATOS)
      caso('si no se puede volver a abrir, no se descarga', true, !!mala.error)
      caso('y se dice por qué', true, /una copia que no se abre es peor/.test(mala.error))
      caso('y qué hacer entonces', true, /sin cifrar/.test(mala.error))
    } finally {
      crypto.subtle.decrypt = original
    }
  }

  /*
   * --- LA CONTRASEÑA SE PIDE DOS VECES ---
   *
   * Es la comprobación que más veces va a salvar a alguien de todo el fichero.
   * Una errata al escribirla NO se descubre al descargar —el archivo sale igual
   * de bien— sino el día que hace falta abrirlo. Que es el peor día posible y
   * ya sin remedio.
   */
  caso('con las dos iguales se deja', true, m.revisarContrasena('LaVeraCruz2027', 'LaVeraCruz2027').puede)
  const distintas = m.revisarContrasena('LaVeraCruz2027', 'LaVeraCruz2026')
  caso('con dos distintas no', false, distintas.puede)
  caso('y se dice que no coinciden', true, /no son iguales/.test(distintas.motivo))
  const corta = m.revisarContrasena('1234', '1234')
  caso('una contraseña corta tampoco', false, corta.puede)
  caso('y se dice cuánto tiene que medir', true, /al menos 8/.test(corta.motivo))

  /*
   * --- LAS VUELTAS NO PUEDEN BAJAR ---
   *
   * Bajarlas «porque tarda» es la forma silenciosa de dejar la copia sin
   * protección: sigue cifrada, sigue abriéndose, todo parece igual — y adivinar
   * la contraseña pasa a costar horas en vez de siglos. No hay ninguna señal
   * visible de que ha pasado. Por eso está escrito el número.
   */
  caso('las vueltas son las que recomienda OWASP', 310_000, m.VUELTAS)
  caso('y se usan de verdad', true,
    /iterations: VUELTAS/.test(await readFile('src/lib/copiaCifrada.ts', 'utf8')))
  const src = await readFile('src/lib/copiaCifrada.ts', 'utf8')
  caso('con SHA-256', true, /hash: 'SHA-256'/.test(src))
  caso('y AES de 256', true, /name: 'AES-GCM', length: 256/.test(src))
  /*
   * GCM Y NO CBC. Es lo que hace que un archivo tocado falle en vez de devolver
   * basura, y en una copia de seguridad esa diferencia es el censo entero.
   */
  caso('se cifra con GCM, que además autentica', false, /AES-CBC/.test(src))

  /*
   * --- SE RECONOCE QUE ESTÁ CIFRADA ---
   *
   * Sin esta marca, al abrir un archivo cifrado la aplicación intentaría
   * leerlo como una copia normal, no lo entendería, y diría «este archivo no es
   * una copia de Gobergo» — que es mentira, y manda a la hermandad a buscar el
   * problema donde no está.
   */
  caso('se reconoce una copia cifrada', true, m.esCopiaCifrada(cifrada))
  caso('y una normal no lo es', false, m.esCopiaCifrada({ hermanos: [] }))
  caso('ni un archivo cualquiera', false, m.esCopiaCifrada({ formato: 'otra cosa' }))
  caso('ni nada', false, m.esCopiaCifrada(null))

  /*
   * --- UN CENSO GRANDE NO REVIENTA ---
   *
   * `String.fromCharCode(...bytes)` es la forma corta de pasar a base64 y
   * revienta la pila de llamadas con un array grande. Con cuatrocientas fichas,
   * fotos y documentos, una copia son megas — o sea que el caso «grande» es el
   * caso NORMAL, no el raro. Aquí se prueba con dos megas.
   */
  const gordo = JSON.stringify({ relleno: 'x'.repeat(2_000_000) })
  const grande = await m.cifrarCopia(gordo, 'LaVeraCruz2027', DATOS)
  caso('una copia de dos megas se cifra', true, grande.datos.length > 1_000_000)
  caso('y se vuelve a abrir entera', true, (await m.abrirCopiaCifrada(grande, 'LaVeraCruz2027')) === gordo)


  /*
   * ==========================================================================
   * Y QUE LA PANTALLA LO USE BIEN, QUE ES DONDE SE PIERDE UN CENSO
   * ==========================================================================
   */
  const cfg = await readFile('src/pages/app/Configuracion.tsx', 'utf8')

  // --- SE PIDE DOS VECES ---
  caso('se pide la contraseña dos veces', true,
    /id="claveCopia"/.test(cfg) && /id="claveCopia2"/.test(cfg))
  caso('y no se deja descargar si no coinciden', true,
    /disabled=\{!revisionClave\.puede\}/.test(cfg))
  /*
   * Y EL AVISO VA ANTES, no en la letra pequeña de después. Esto cambia una
   * amenaza por otra —de «que se lea» a «quedarse fuera»— y quien decide tiene
   * que saberlo ANTES de decidir.
   */
  caso('se avisa de que no hay forma de recuperarla', true,
    /no la abre\s*\n?\s*nadie — tampoco nosotros/.test(cfg) || /tampoco nosotros/.test(cfg))
  caso('y de que hay que apuntarla', true, /Apunta la contraseña donde no se pierda/.test(cfg))

  /*
   * --- Y SE DEJA LA OTRA PUERTA ABIERTA ---
   *
   * Hay quien guarda su copia en un disco ya cifrado y no quiere otra
   * contraseña más, y hay quien prefiere el riesgo de que se lea al de
   * perderla. Obligar sería decidir por ellos algo que les puede costar el
   * censo.
   */
  caso('se puede descargar sin cifrar', true, /Descargar sin cifrar/.test(cfg))
  caso('y cancelar', true, /Cancelar\s*\n?\s*<\/button>/.test(cfg))

  // --- AL RESTAURAR SE RECONOCE Y SE PIDE ---
  caso('al restaurar se reconoce una copia cifrada', true, /if \(esCopiaCifrada\(obj\)\)/.test(cfg))
  /*
   * SE RECONOCE POR SU MARCA Y NO POR LA EXTENSIÓN. Quien renombre el archivo
   * —que pasa— se encontraría con «esto no es una copia de Gobergo», que es
   * mentira y le manda a buscar el problema donde no está.
   */
  caso('por su marca y no por el nombre del fichero', false, /\.gobergo['"]\)\s*\)/.test(cfg))
  caso('se pide la contraseña', true, /Escribe la contraseña con la que se descargó/.test(cfg))
  // Y se dice de qué hermandad y de qué día es, que es lo que hay en claro.
  caso('diciendo de qué copia se trata', true, /Esta copia\$\{deQuien\}\$\{deCuando\} está cifrada/.test(cfg))

  /*
   * --- Y SI LA CONTRASEÑA NO ES, SE DICE POR SU NOMBRE ---
   *
   * «Archivo no válido» aquí sería cruel y falso: el archivo está
   * perfectamente, lo que falla es la contraseña. Decirlo mal hace que se dé
   * la copia por perdida cuando basta con volver a teclear.
   */
  caso('una contraseña equivocada se dice como tal', true,
    /Esa contraseña no abre la copia/.test(cfg))
  caso('y se aclara que el archivo está bien', true, /El archivo está bien/.test(cfg))
  // Pero sin falsas esperanzas: si no se recuerda, no hay nada que hacer.
  caso('sin prometer una recuperación que no existe', true,
    /no se puede abrir: no hay forma de recuperarla/.test(cfg))

  // Cancelar el diálogo no cuenta como contraseña mala.
  caso('cancelar no se toma por contraseña equivocada', true, /if \(dicha === null\)/.test(cfg))

  /*
   * --- LA COPIA AUTOMÁTICA SEMANAL SIGUE SIN CIFRAR, A PROPÓSITO ---
   *
   * Vive en el cubo de la propia hermandad, protegida por sus permisos, y la
   * lanza sola la aplicación: no hay nadie a quien pedirle una contraseña a las
   * tres de la mañana. Cifrarla obligaría a guardar la clave al lado de los
   * datos, que es no cifrar nada con pasos de más.
   *
   * Se comprueba para que quede como decisión escrita y no como olvido: el día
   * que alguien la cifre «por coherencia», esta prueba le hace pensarlo.
   */
  const auto = await readFile('src/lib/copiaAutomatica.ts', 'utf8')
  caso('la copia automática no se cifra', false, /cifrarCopia|cifrarYComprobar/.test(auto))
}
