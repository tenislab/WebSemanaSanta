/**
 * REDES SOCIALES: el «0 de 0» y publicar de verdad.
 *
 * Lo reportado: la tarjeta «Redes sociales conectadas» decía **0 de 0** y no
 * salía ni una red. Eran tres fallos encadenados, y ninguno daba error:
 *
 *   1. La lista de redes se sacaba de la base de datos. Si la base venía
 *      vacía, no había redes — pero Facebook existe aunque la hermandad no lo
 *      haya conectado, y la tarjeta «no conectada» es justo la que hace falta
 *      para poder conectarlo.
 *   2. La semilla de `schema.sql` metía las cinco filas sin `hermandad_id`, así
 *      que la frontera de seguridad las escondía de todo el mundo.
 *   3. Guardar era un `update ... eq('red', ...)` sobre una fila que no
 *      existía. En Postgres eso no falla: actualiza cero filas. Se conectaba
 *      una red, se veía conectada, y al volver a entrar estaba igual.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/redesSociales.ts')

  // --- 1. Las cinco, siempre ---
  caso('el catálogo son cinco redes', 5, m.REDES.length)
  caso('sin nada guardado, salen las cinco igual', 5, m.cuentasCompletas([]).length)
  caso('y todas sin conectar', 0, m.cuentasCompletas([]).filter((c) => c.conectada).length)
  const soloUna = m.cuentasCompletas([{ red: 'Instagram', conectada: true, usuario: '@hdad' }])
  caso('con una guardada, siguen saliendo cinco', 5, soloUna.length)
  caso('y la guardada conserva su estado', '@hdad', soloUna.find((c) => c.red === 'Instagram').usuario)
  caso('las demás salen sin conectar', 4, soloUna.filter((c) => !c.conectada).length)
  caso('y en el mismo orden siempre', ['Facebook', 'Instagram', 'X', 'YouTube', 'TikTok'],
    soloUna.map((c) => c.red))
  // Una red que ya no existiera en el catálogo no puede colarse.
  caso('lo que no es del catálogo no entra', 5,
    m.cuentasCompletas([{ red: 'Tuenti', conectada: true, usuario: '@x' }]).length)

  // --- 2. El nombre de la cuenta ---
  caso('se acepta con arroba', '@hermandad', m.normalizarUsuario('@hermandad'))
  caso('y sin arroba', '@hermandad', m.normalizarUsuario('hermandad'))
  caso('con espacios de sobra', '@hermandad', m.normalizarUsuario('  hermandad  '))
  // Pegar la dirección del navegador es lo que hace todo el mundo.
  caso('pegando la dirección de Instagram', '@lahermandad',
    m.normalizarUsuario('https://www.instagram.com/lahermandad'))
  caso('con la barra final', '@lahermandad',
    m.normalizarUsuario('https://www.instagram.com/lahermandad/'))
  caso('con la arroba dentro, como YouTube', '@lahermandad',
    m.normalizarUsuario('https://www.youtube.com/@lahermandad'))
  caso('con parámetros detrás', '@lahermandad',
    m.normalizarUsuario('https://www.facebook.com/lahermandad?locale=es_ES'))
  caso('vacío no vale', '', m.normalizarUsuario('   '))

  // --- 3. Adónde lleva el botón de abrir ---
  caso('con enlace guardado, ese', 'https://facebook.com/mia',
    m.enlaceDeLaCuenta({ red: 'Facebook', conectada: true, usuario: '@mia', enlace: 'https://facebook.com/mia' }))
  caso('sin enlace, se monta con el usuario', 'https://www.instagram.com/mia',
    m.enlaceDeLaCuenta({ red: 'Instagram', conectada: true, usuario: '@mia' }))
  caso('YouTube lleva arroba en la dirección', 'https://www.youtube.com/@mia',
    m.enlaceDeLaCuenta({ red: 'YouTube', conectada: true, usuario: '@mia' }))
  caso('sin cuenta, no hay adónde ir', null,
    m.enlaceDeLaCuenta({ red: 'X', conectada: false, usuario: null }))

  // --- 4. El texto que se publica ---
  caso('titular y cuerpo, separados', 'Cabildo\n\nEl jueves a las 20:00.',
    m.textoParaRedes('Cabildo', 'El jueves a las 20:00.'))
  caso('sin cuerpo, solo el titular', 'Cabildo', m.textoParaRedes('Cabildo', '  '))
  caso('sin titular, solo el cuerpo', 'El jueves.', m.textoParaRedes('', 'El jueves.'))

  /*
   * X corta a los 280 y no avisa: corta y ya. Mejor decirlo antes de abrir la
   * ventana que descubrir el comunicado publicado a medias.
   */
  const largo = 'a'.repeat(300)
  caso('X avisa si no cabe', true, m.sePasaDeLargo('X', largo))
  caso('y no avisa si cabe', false, m.sePasaDeLargo('X', 'corto'))
  caso('las demás no tienen ese límite', false, m.sePasaDeLargo('Facebook', largo))

  // --- 5. Abrir la red con el texto puesto ---
  const conTexto = m.enlaceParaPublicar('X', 'Hola hermandad')
  caso('X abre con el mensaje escrito', true, /x\.com\/intent\/post\?text=Hola%20hermandad/.test(conTexto))
  caso('y con la dirección de la web si la hay', true,
    /url=https%3A%2F%2Fhdad\.es/.test(m.enlaceParaPublicar('X', 'Hola', 'https://hdad.es')))
  /*
   * Facebook necesita una dirección pública que compartir. Sin ella devolvía
   * `https://www.facebook.com/` a secas, y el botón llevaba a la PORTADA de
   * Facebook en vez de a la página de la hermandad. Con `null`, quien llama se
   * va a la página de la hermandad con el texto ya copiado.
   */
  caso('Facebook con web publicada, al cuadro de compartir', true,
    /sharer\.php\?u=https%3A%2F%2Fhdad\.es/.test(m.enlaceParaPublicar('Facebook', 'Hola', 'https://hdad.es')))
  caso('y sin web, no a la portada de Facebook', null, m.enlaceParaPublicar('Facebook', 'Hola'))
  /*
   * Instagram, YouTube y TikTok NO dejan abrir una publicación desde fuera. Es
   * decisión suya, no una limitación nuestra. Devolver una dirección inventada
   * abriría una página de error y parecería que está roto: mejor `null`, y
   * entonces se copia el texto y se abre la red a secas.
   */
  caso('Instagram no admite abrir con texto', null, m.enlaceParaPublicar('Instagram', 'Hola'))
  caso('TikTok tampoco', null, m.enlaceParaPublicar('TikTok', 'Hola'))
  caso('y se dice en la ficha de cada una', false, m.COMO_PUBLICAR.Instagram.admiteTextoEnElEnlace)
  caso('Facebook sí', true, m.COMO_PUBLICAR.Facebook.admiteTextoEnElEnlace)
  // Todas tienen explicación, que es lo que lee quien no es informático.
  caso('las cinco explican cómo va', 5,
    m.REDES.filter((r) => (m.COMO_PUBLICAR[r]?.comoVa ?? '').length > 20).length)
  /*
   * Y TODAS TIENEN COLOR Y LOGOTIPO.
   *
   * Antes eran iniciales dentro de un círculo —una «f», un «IG», una nota
   * musical para TikTok—, y se leían como un apaño en una pantalla que la
   * junta enseña a otras hermandades. Ahora es la marca dibujada.
   *
   * La prueba está para el día que se añada una sexta red: sin ella, la red
   * nueva saldría con un hueco donde va el logotipo y nadie se enteraría hasta
   * verlo en pantalla.
   */
  caso('y todas tienen color', 5, m.REDES.filter((r) => m.COLOR_RED[r]).length)
  caso('y todas tienen logotipo', 5,
    m.REDES.filter((r) => (m.MARCA_RED[r] ?? []).length > 0).length)
  // Un trazo sin dibujo es un icono en blanco: se comprueba que cada forma
  // trae lo suyo.
  caso('y ningún trazo está vacío', 0,
    m.REDES.flatMap((r) => m.MARCA_RED[r]).filter((t) => (
      t.forma === 'path' ? !(t.d ?? '').startsWith('M')
        : t.forma === 'rect' ? !(t.w > 0 && t.h > 0)
          : !(t.r > 0)
    )).length)

  await laPantallaYLaBase({ caso })
  await unBotonQueDiceLoQueHace({ cargar, caso })
}

/** Que la pantalla y el SQL hagan lo que se acaba de probar. */
async function laPantallaYLaBase({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  const com = sinComentarios(await readFile('src/pages/app/Comunicados.tsx', 'utf8'))
  const db = sinComentarios(await readFile('src/lib/db/comunicados.ts', 'utf8'))

  // El hook completa siempre las cinco.
  caso('el hook rellena las cinco redes', true, /cuentasCompletas\(/.test(db))
  /*
   * `upsert`, no `update`. Era un `update ... eq('red', ...)` sobre una fila
   * que no existía: cero filas actualizadas, sin error. Conectar una red decía
   * que sí y no guardaba nada.
   */
  caso('guardar una red es upsert', true, /\.upsert\(cuentaToRow\(c\)/.test(db))
  caso('con la clave por hermandad', true, /onConflict: 'hermandad_id,red'/.test(db))
  caso('ya no queda el update que no guardaba', false, /\.update\(cuentaToRow/.test(db))
  // Y no se manda `hermandad_id`: lo pone la base sola. Mandarlo desde el
  // navegador sería poder escribir en la hermandad de otro.
  caso('no se manda la hermandad desde el navegador', false, /hermandad_id:/.test(db))

  // Conectar pide la cuenta de verdad.
  caso('ya no se conecta con la cuenta de mentira', false, /@hermandaddemo'\s*$/m.test(com))
  caso('sin nombre no se conecta', true, /Escribe el nombre de la cuenta/.test(com))
  caso('se acepta la dirección pegada', true, /normalizarUsuario\(usuarioInput\)/.test(com))

  // Publicar: el texto y el botón de abrir.
  caso('la ficha deja el texto listo', true, /textoParaRedes\(selected\.titulo, selected\.cuerpo\)/.test(com))
  caso('con botón de copiar', true, /copiarAlPortapapeles\(texto\)/.test(com))
  // La pantalla ya no arma el enlace a mano: pide la acción, que además dice
  // cómo llamar al botón. Se comprueba a fondo en `unBotonQueDiceLoQueHace`.
  caso('y de abrir la red', true, /accionDePublicar\(r, texto, cuenta, enlaceDeLaWeb\)/.test(com))
  // Y se dice lo que NO hace, que es lo que evita la llamada de teléfono.
  caso('se dice que no publica solo', true, /no se publica solo/.test(com))
  caso('ya no dice «conexión simulada»', false, /Conexión simulada/.test(com))

  // El SQL.
  const sql = await readFile('supabase/redes-sociales.sql', 'utf8')
  caso('la clave pasa a ser por hermandad', true,
    /create unique index if not exists cuentas_sociales_por_hermandad[\s\S]*\(hermandad_id, red\)/.test(sql))
  caso('se tira la clave global', true, /drop constraint if exists cuentas_sociales_pkey/.test(sql))
  caso('y se limpian las filas sin dueño', true,
    /delete from cuentas_sociales where hermandad_id is null/.test(sql))
  caso('se guarda el enlace de la página', true, /add column if not exists enlace text/.test(sql))
  // La semilla que creaba las filas huérfanas ya no está.
  const schema = await readFile('supabase/schema.sql', 'utf8')
  caso('la semilla huérfana ya no se siembra', false,
    /insert into cuentas_sociales \(red\) values/.test(schema))
  // Y va dentro del instalador de una vez.
  const todo = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  caso('el SQL de redes va en el instalador', true, /cuentas_sociales_por_hermandad/.test(todo))
}

/**
 * UN SOLO BOTÓN, Y QUE DIGA LO QUE VA A PASAR.
 *
 * Llegó dicho así: «hay que ponerlo fácil; si es copiar el texto, tenemos que
 * hacerlo para que le salte ya en Twitter». Había dos botones por red
 * —«Copiar texto» y «Abrir X»— y desde fuera no se sabía cuál era el que
 * publicaba. Por dentro son dos cosas; por fuera es una: publicar esto aquí.
 */
async function unBotonQueDiceLoQueHace({ cargar, caso }) {
  const m = await cargar('src/lib/redesSociales.ts')
  const conectada = (red) => ({ red, conectada: true, usuario: '@hdad', enlace: null })
  const WEB = 'https://hermandaddetriana.es'

  // X: se abre con el mensaje escrito. Es la que sí se puede de verdad.
  const x = m.accionDePublicar('X', 'Cabildo el viernes', conectada('X'), WEB)
  caso('en X se publica de una vez', 'componer', x.modo)
  caso('y el botón lo dice', 'Publicar en X', x.boton)
  caso('el texto va dentro del enlace', true, x.url.includes(encodeURIComponent('Cabildo el viernes')))
  /*
   * Y el enlace de la web va en el tuit. No es un adorno: un aviso de cabildo
   * sin enlace obliga a buscar la web a mano.
   */
  caso('y el enlace de la web también', true, x.url.includes(encodeURIComponent(WEB)))
  // La dirección de ahora, no la vieja: una redirección menos en el móvil.
  caso('usa x.com y no la dirección vieja', true, /^https:\/\/x\.com\/intent\/post/.test(x.url))

  /*
   * FACEBOOK solo puede abrir su cuadro de compartir si hay una dirección que
   * compartir. Sin web publicada NO se puede, y entonces lo honrado es abrir
   * la página de la hermandad con el texto copiado — no un botón que promete
   * publicar y lleva a la portada de Facebook.
   */
  const fbConWeb = m.accionDePublicar('Facebook', 'Hola', conectada('Facebook'), WEB)
  caso('Facebook con web publicada compone', 'componer', fbConWeb.modo)
  const fbSinWeb = m.accionDePublicar('Facebook', 'Hola', conectada('Facebook'), null)
  caso('y sin web, copia y abre', 'copiarYAbrir', fbSinWeb.modo)
  caso('sin llevar a la portada de Facebook', false, fbSinWeb.url === 'https://www.facebook.com/')

  /*
   * INSTAGRAM y TIKTOK no dejan publicar desde un enlace, y eso es decisión
   * suya. Lo máximo por ordenador es copiar y abrir; el botón lo dice.
   */
  for (const red of ['Instagram', 'TikTok', 'YouTube']) {
    const a = m.accionDePublicar(red, 'Hola', conectada(red), WEB)
    caso(`${red} copia y abre`, 'copiarYAbrir', a.modo)
    caso(`y el botón de ${red} no promete publicar`, false, /^Publicar/.test(a.boton))
  }

  /*
   * SIN CUENTA CONECTADA no hay a dónde ir. Antes el botón se pintaba igual y
   * al pulsarlo salía «conecta la red primero»: enterarse al pulsar es tarde.
   */
  const sinCuenta = m.accionDePublicar('Instagram', 'Hola', undefined, WEB)
  caso('sin cuenta conectada solo se copia', 'soloCopiar', sinCuenta.modo)
  caso('y no hay a dónde abrir', null, sinCuenta.url)
  caso('y el botón lo dice desde el principio', 'Copiar el texto', sinCuenta.boton)

  /*
   * EL COMPARTIR DEL MÓVIL. Es lo único que mete el texto DENTRO de Instagram
   * sin pegar nada. Se mira en el momento porque el mismo usuario abre la
   * aplicación en el ordenador y en el teléfono.
   */
  // En Node 22 `navigator` es de solo lectura: asignarlo revienta el proceso
  // entero, así que se sustituye con `defineProperty` y se deja como estaba.
  const antes = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const fingir = (valor) =>
    Object.defineProperty(globalThis, 'navigator', { value: valor, configurable: true, writable: true })
  try {
    fingir({})
    caso('en el ordenador no hay compartir del sistema', false, m.sePuedeCompartirConElMovil())
    fingir({ share: () => {} })
    caso('en el móvil sí', true, m.sePuedeCompartirConElMovil())
  } finally {
    if (antes) Object.defineProperty(globalThis, 'navigator', antes)
  }

  await laPantallaLoUsa({ caso })
}

/** Y que la pantalla use esto, no su propia versión. */
async function laPantallaLoUsa({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const c = (await readFile('src/pages/app/Comunicados.tsx', 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  caso('la pantalla pide la acción al catálogo', true, /accionDePublicar\(r, texto, cuenta, enlaceDeLaWeb\)/.test(c))
  caso('y el botón se llama como diga la acción', true, /\{accion\.boton\}/.test(c))
  caso('ofrece el compartir del móvil', true, /navigator\.share\(/.test(c))

  /*
   * El enlace solo si la web está PUBLICADA. Mandar a la gente a una web sin
   * publicar es mandarla a una página que no existe — y encima desde un aviso
   * oficial de la hermandad.
   */
  caso('el enlace solo va si la web está publicada', true, /if \(!web\.publicada\) return null/.test(c))
}

