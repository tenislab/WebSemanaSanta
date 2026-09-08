/**
 * LOS DOS AVISOS QUE NO EXISTÍAN, Y LA FAMILIA POR LOS DOS LADOS.
 *
 * ============================================================================
 * LO QUE PASABA
 * ============================================================================
 *
 * · LA BAJA. Un hermano la pedía desde su área. Se guardaba bien —queda
 *   marcada en su ficha, con fecha y motivo— y llegaba a la base. Lo único que
 *   no pasaba es que alguien SE ENTERARA: no había ningún tipo de aviso que la
 *   mirara, así que para verlo había que buscar a esa persona por su nombre.
 *   Una baja pedida y no contestada acaba en la llamada más desagradable que
 *   puede recibir una hermandad: «¿por qué me seguís pasando el recibo?».
 *
 * · LOS MENSAJES DE LA WEB. Tenían su bandeja desde el principio, pero DENTRO
 *   de la pantalla de Web pública. A esa pantalla se entra cuando se quiere
 *   cambiar algo de la web, o sea casi nunca. Un «escríbenos» publicado y sin
 *   contestar es peor que no ponerlo.
 *
 * Los dos son el mismo fallo: el dato llega y nadie lo mira.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/notificaciones.ts')

  const HERMANOS = [
    { id: 'h1', numero: 12, nombre: 'María López', estado: 'Activo' },
    {
      id: 'h2', numero: 47, nombre: 'Juan Pérez', estado: 'Activo',
      bajaSolicitada: true, bajaSolicitadaEl: '2026-09-01', motivoBaja: 'Me mudo a Madrid',
    },
    // Ya tramitada: no tiene que salir. Ver abajo.
    {
      id: 'h3', numero: 0, nombre: 'Ana Ruiz', estado: 'Baja',
      bajaSolicitada: true, bajaSolicitadaEl: '2026-01-10',
    },
  ]
  const vacio = { solicitudes: [], cuotas: [], papeletas: [], peticionesPapeleta: [], hermanos: HERMANOS }

  // --- LA BAJA PEDIDA ---
  const avisos = m.avisosPendientes(vacio)
  const bajas = avisos.filter((a) => a.tipo === 'bajaPedida')
  caso('la baja pedida sale como aviso', 1, bajas.length)
  caso('con su nombre', true, bajas[0].titulo.includes('Juan Pérez'))
  caso('y dice que quiere darse de baja', true, bajas[0].titulo.includes('darse de baja'))

  /*
   * EL MOTIVO VA DENTRO. No se le obliga a darlo —exigir que alguien se
   * justifique para irse está feo— pero cuando lo da es lo único que permite
   * intentar retenerle antes de tramitarla. Sin él, el aviso es un trámite.
   */
  caso('y el motivo, que es lo que permite hacer algo', true, bajas[0].detalle.includes('Me mudo a Madrid'))
  caso('y cuándo la pidió', true, bajas[0].detalle.includes('2026-09-01'))
  caso('y su número de hermano', true, bajas[0].detalle.includes('47'))

  /*
   * --- LA QUE YA SE TRAMITÓ NO SALE ---
   *
   * `bajaSolicitada` («lo ha pedido») y `estado: 'Baja'` («se ha tramitado»)
   * son cosas distintas, y confundirlas haría que el aviso NO SE FUERA NUNCA:
   * la marca sigue puesta en fichas viejas. Un aviso que no se puede quitar
   * acaba con la pantalla entera ignorada.
   */
  caso('la que ya se tramitó no vuelve a avisar', false,
    bajas.some((a) => a.titulo.includes('Ana Ruiz')))

  // Sin motivo se dice, no se deja el hueco en blanco.
  const sinMotivo = m.avisosPendientes({
    ...vacio,
    hermanos: [{ id: 'x', numero: 3, nombre: 'Sin Motivo', estado: 'Activo', bajaSolicitada: true }],
  })
  caso('sin motivo se dice que no lo hay', true,
    sinMotivo[0].detalle.includes('sin motivo indicado'))

  /*
   * Y LLEVA A SU FICHA, no a la lista de cuatrocientos. Decirle a alguien «está
   * en Hermanos, búscalo» es la mitad del trabajo, y es la mitad que se olvida.
   */
  caso('lleva directo a su ficha', '/app/hermanos?ficha=h2', bajas[0].donde)
  /*
   * Y NO SE TRAMITA DESDE AQUÍ: dar de baja toca el escalafón, las cuotas
   * pendientes y la papeleta del año. Eso se hace en la ficha, con todo delante.
   */
  caso('pero no se tramita de un clic', 'Ver su ficha', bajas[0].aceptar)

  // --- LOS MENSAJES DE LA WEB ---
  const MENSAJES = [
    { id: 'm1', tipo: 'contacto', fecha: '2026-09-02', nombre: 'Rosa Gil', email: 'rosa@ejemplo.es', telefono: '600111222', asunto: 'Hola', mensaje: '¿Cómo me hago hermana?', leido: false, atendido: false },
    { id: 'm2', tipo: 'contacto', fecha: '2026-08-01', nombre: 'Ya Leído', email: '', telefono: '', asunto: '', mensaje: '', leido: true, atendido: false },
  ]
  const conWeb = m.avisosPendientes({ ...vacio, mensajesWeb: MENSAJES })
  const web = conWeb.filter((a) => a.tipo === 'mensajeWeb')
  caso('el mensaje de la web sale como aviso', 1, web.length)
  caso('con quién ha escrito', true, web[0].titulo.includes('Rosa Gil'))
  caso('y cómo contestarle', true, web[0].detalle.includes('rosa@ejemplo.es'))
  /*
   * SOLO LOS NO LEÍDOS. Uno leído y sin contestar ya no es «entérate»: es
   * trabajo pendiente de alguien, y esta pantalla sirve para enterarse, no para
   * llevar una lista de tareas.
   */
  caso('el ya leído no vuelve a avisar', false, web.some((a) => a.titulo.includes('Ya Leído')))

  // Y sin pasarle mensajes, no revienta: quien no los tenga sigue igual.
  caso('sin mensajes no pasa nada', 0,
    m.avisosPendientes(vacio).filter((a) => a.tipo === 'mensajeWeb').length)

  // --- EL ORDEN: PRIMERO QUIEN ESTÁ ESPERANDO UNA RESPUESTA ---
  /*
   * Lo demás de esta pantalla es trabajo, y el trabajo puede esperar al
   * martes. Un alta, una baja y un mensaje son PERSONAS esperando a que la
   * hermandad diga algo.
   */
  const mezcla = m.avisosPendientes({
    ...vacio,
    mensajesWeb: MENSAJES,
    cuotas: [{ id: 'c1', hermanoId: 'h1', importe: 30, estado: 'Pendiente', fechaEmision: '2026-01-01', fechaCobro: '2026-01-01', domiciliada: false, numero: 1, concepto: 'Cuota anual', pagoComunicado: { metodo: 'Bizum', fecha: '2026-09-03' } }],
  })
  const tipos = mezcla.map((a) => a.tipo)
  caso('la baja va antes que un cobro por confirmar', true,
    tipos.indexOf('bajaPedida') < tipos.indexOf('pagoCuota'))
  caso('y el mensaje de la web también', true,
    tipos.indexOf('mensajeWeb') < tipos.indexOf('pagoCuota'))

  // --- Y CADA TIPO TIENE SU TÍTULO DE BLOQUE ---
  /*
   * `avisosPorTipo` lleva un `Record<TipoAviso, string>`: un tipo nuevo sin
   * nombre da `undefined` como título de sección, o sea un bloque sin cabecera.
   * TypeScript ya obliga a rellenarlo; esto lo comprueba también en ejecución,
   * que es donde se ve.
   */
  const grupos = m.avisosPorTipo(mezcla)
  caso('ningún bloque se queda sin título', [],
    grupos.filter((g) => !g.titulo).map((g) => g.tipo))
  caso('el de las bajas se llama por lo que es', true,
    grupos.some((g) => g.tipo === 'bajaPedida' && g.titulo === 'Han pedido darse de baja'))

  // --- LA FAMILIA, POR LOS DOS LADOS ---
  const { readFile } = await import('node:fs/promises')
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  const panel = await readFile('src/pages/app/Hermanos.tsx', 'utf8')
  const familia = await readFile('src/components/MiFamilia.tsx', 'utf8')

  /*
   * El padre veía a los suyos y el hijo no veía nada. Y no era un olvido de la
   * pantalla: el hijo NO PUEDE leer la ficha de su padre —ahí está su IBAN— así
   * que hacía falta preguntárselo al servidor.
   */
  caso('el hijo pregunta de qué familia es', true, /traerMiTutor\(\)/.test(portal))
  caso('y se lo enseña', true, /Perteneces a la familia de/.test(familia))
  caso('el padre sigue viendo a los suyos', true, /h\.tutorId === hermanoPrincipal\.id/.test(portal))

  // Y en el panel, los dos lados en la misma ficha.
  caso('la ficha del panel dice de quién depende', true, /<dt>A cargo de<\/dt>/.test(panel))
  caso('y a quién lleva', true, /<dt>Lleva a<\/dt>/.test(panel))
}
