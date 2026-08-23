/**
 * CONTAR UN FALLO SIN QUE SE PIERDA.
 *
 * Lo que hace útil un reporte no es lo que escribe quien lo manda —eso suele
 * ser «no funciona»—, es lo que se adjunta solo: la pantalla, el cargo y el
 * último error de la base. Ese último dato ha costado tres conversaciones más
 * de una vez.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/reporteFallo.ts')

  const ctx = {
    ruta: '/app/papeletas',
    hermandad: 'Real Hermandad del Nazareno',
    cargo: 'Secretario/a',
    ultimoErrorBd: 'papeletas · crear: record "old" has no field "nombre"',
    navegador: 'Mozilla/5.0 …',
    tamanoPantalla: '390×844',
  }
  const r = { queHacia: 'Emitía una papeleta', queFallo: 'El tramo sigue a 0' }

  // --- El correo va a donde tiene que ir ---
  caso('el destino es el de soporte', 'jaimerivasgranada@gmail.com', m.CORREO_SOPORTE)

  // --- El texto lleva lo que hace falta ---
  const t = m.textoDelReporte(r, ctx)
  caso('lleva qué hacía', true, t.includes('Emitía una papeleta'))
  caso('lleva qué falló', true, t.includes('El tramo sigue a 0'))
  caso('lleva la pantalla', true, t.includes('/app/papeletas'))
  caso('lleva la hermandad', true, t.includes('Real Hermandad del Nazareno'))
  caso('lleva el cargo', true, t.includes('Secretario/a'))
  // ESTE es el dato que de verdad ahorra tiempo.
  caso('y lleva el error de la base', true, t.includes('has no field "nombre"'))

  // Que no tenga cargo ES un dato, no un hueco: significa que es el titular.
  caso('sin cargo se dice que es el titular', true,
    m.textoDelReporte(r, { ...ctx, cargo: null }).includes('(titular, sin cargo)'))
  // Y quien no escribe nada no puede dejar el reporte en blanco sin más.
  caso('lo que no ha contado se dice', true,
    m.textoDelReporte({ queHacia: '', queFallo: '' }, ctx).includes('(no lo ha dicho)'))

  // --- El asunto se lee sin abrir el correo ---
  const a = m.asuntoDelReporte(ctx)
  caso('el asunto dice dónde', true, /papeletas/.test(a))
  caso('y de quién', true, /Nazareno/.test(a))
  caso('y se reconoce de un vistazo', true, a.startsWith('[Gobergo]'))
  // En Inicio la ruta es «/app» pelada: no puede quedarse en «Fallo en ».
  caso('en inicio no se queda cojo', true,
    m.asuntoDelReporte({ ...ctx, ruta: '/app' }).includes('inicio'))

  /*
   * EL ENLACE DE RESERVA. Es lo que hace que un reporte no se pierda cuando no
   * se puede mandar desde la aplicación — que es justo cuando más falta hace,
   * porque puede que lo roto SEA el correo.
   */
  const enlace = m.enlaceDeReserva(r, ctx)
  caso('la reserva va al soporte', true, enlace.startsWith('mailto:jaimerivasgranada@gmail.com'))
  caso('y lleva el asunto puesto', true, enlace.includes('subject='))
  caso('y el cuerpo entero escrito', true, enlace.includes(encodeURIComponent('Emitía una papeleta')))
  caso('con el error de la base incluido', true, enlace.includes(encodeURIComponent('has no field')))

  // --- Sin base de datos no revienta: devuelve la reserva ---
  const sin = await m.mandarReporte(r, ctx)
  caso('sin conexión no lanza', true, typeof sin.ok === 'boolean')
  caso('y da la reserva para no perderlo', true, Boolean(sin.reserva))

  /*
   * Y QUE NO DEPENDA DEL CORREO DE LA HERMANDAD.
   *
   * `enviarCorreo` exige que la hermandad tenga el correo configurado y
   * encendido. Un canal de fallos no puede depender de eso: el fallo puede SER
   * el correo, o la hermandad puede no haberlo configurado todavía.
   */
  const { readFile } = await import('node:fs/promises')
  const fuente = await readFile('src/lib/reporteFallo.ts', 'utf8')
  // Sin los comentarios: ahí se NOMBRA `enviarCorreo` para explicar por qué NO
  // se usa, y la prueba se cazaba a sí misma.
  const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  caso('no pasa por el correo de la hermandad', false, /enviarCorreo|avisarPorCorreo/.test(codigo))
  caso('llama al servidor directamente', true, /functions\.invoke\('enviar-correo'/.test(codigo))

  // --- Y la pantalla lo tiene enchufado en los dos sitios ---
  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('el panel tiene el botón', true, /Contar un fallo/.test(shell))
  // El último error se guarda aparte y NO se borra al dar a «Entendido»: cuando
  // alguien se decide a contarlo, ese aviso lo cerró hace rato.
  caso('el panel recuerda el último error de la base', true, /setUltimoErrorBd/.test(shell))
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  caso('el área del hermano también', true, /onContarFallo/.test(portal))

  await avisoDeDominio({ cargar, caso })
}

/**
 * PEDIR QUE ACTIVEN UN DOMINIO PROPIO.
 *
 * De los pasos del dominio, el de darlo de alta en el servidor solo lo puede
 * hacer quien lleva Gobergo. La pantalla decía «avísanos» y no daba forma de
 * avisar: o no se avisaba, o se avisaba por otro sitio y se perdía.
 */
async function avisoDeDominio({ cargar, caso }) {
  const m = await cargar('src/lib/reporteFallo.ts')
  const datos = {
    dominio: 'hermandaddetriana.es',
    hermandad: 'Hermandad de Triana',
    slug: 'triana',
    quienLoPide: 'secretaria@triana.es',
  }
  const t = m.textoDelAvisoDeDominio(datos)
  caso('el aviso lleva el dominio', true, t.includes('hermandaddetriana.es'))
  caso('y la hermandad', true, t.includes('Hermandad de Triana'))
  // El slug hace falta para encontrar su web sin buscarla a mano.
  caso('y por dónde va su web ahora', true, t.includes('/w/triana'))
  caso('y a quién contestar', true, t.includes('secretaria@triana.es'))
  // Y la lista de lo que hay que hacer, para no tener que recordarla.
  caso('dice que hay que dar de alta el www', true, t.includes('www.hermandaddetriana.es'))
  caso('y que uno redirija al otro', true, /redirija|no llega/.test(t))

  const { readFile } = await import('node:fs/promises')
  const pantalla = await readFile('src/pages/app/WebPublica.tsx', 'utf8')
  caso('la pantalla tiene el botón', true, /Avisar para que lo activen/.test(pantalla))
  caso('y lo llama de verdad', true, /await pedirActivarDominio\(/.test(pantalla))
  // Y ya no manda a la hermandad a hacer algo que no puede hacer.
  caso('ya no les dice que entren en Vercel', false, /añadid los dos en Vercel|En Vercel añadid/i.test(pantalla))
  // Los pasos, con dueño: sin eso nadie sabe a quién le toca mover ficha.
  caso('los pasos dicen de quién es cada uno', true, /<b>Nosotros:<\/b>/.test(pantalla))
}
