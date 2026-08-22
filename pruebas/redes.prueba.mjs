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
  caso('X abre con el mensaje escrito', true, /twitter\.com\/intent\/tweet\?text=Hola%20hermandad/.test(conTexto))
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
  caso('y todas tienen color e inicial', 10,
    m.REDES.filter((r) => m.COLOR_RED[r]).length + m.REDES.filter((r) => m.INICIAL_RED[r]).length)

  await laPantallaYLaBase({ caso })
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
  caso('y de abrir la red', true, /enlaceParaPublicar\(r, texto\)/.test(com))
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
