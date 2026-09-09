/**
 * «HOLA {nombre}»: LA PERSONALIZACIÓN DE LOS COMUNICADOS.
 *
 * ============================================================================
 * LO QUE VIGILA ESTA PRUEBA, Y POR QUÉ TIENE TANTOS CASOS
 * ============================================================================
 *
 * Porque un correo a ochocientas personas no se puede deshacer. No hay ninguna
 * otra parte de la aplicación donde un fallo se multiplique por ochocientos y
 * además salga de la hermandad hacia fuera.
 *
 * Los tres desastres que esto impide, en orden de lo caro que sale cada uno:
 *
 *   1. `{nombe}` mandado a ochocientas personas. Se ve, se comenta y no hay
 *      forma de recogerlo.
 *   2. «Hola ,» — la ficha sin el dato. Peor que no personalizar, porque
 *      parece descuido en vez de un correo normal.
 *   3. «Hola RIVAS» o «Hola JOSÉ» — el censo importado de un Excel. No es un
 *      caso raro: es CÓMO llegan la mitad de los censos.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const m = await cargar('src/lib/personalizar.ts')

  const jaime = { nombre: 'Jaime Rivas', numero: 1 }
  const ctx = { hermandad: 'Hermandad de la Vera-Cruz', ejercicio: 2027 }

  // --- LO NORMAL, QUE ES LO QUE PASA TODOS LOS DÍAS ---
  caso('pone el nombre de pila', 'Hola Jaime,',
    m.personalizar('Hola {nombre},', jaime, ctx))
  caso('y el nombre entero cuando se pide', 'Jaime Rivas',
    m.personalizar('{nombrecompleto}', jaime, ctx))
  caso('el número de hermano', 'Eres el 1', m.personalizar('Eres el {numero}', jaime, ctx))
  caso('la hermandad', 'Hermandad de la Vera-Cruz', m.personalizar('{hermandad}', jaime, ctx))
  caso('y el ejercicio', '2027', m.personalizar('{ejercicio}', jaime, ctx))
  caso('varias marcas en la misma frase', 'Jaime, hermano nº 1 de Hermandad de la Vera-Cruz',
    m.personalizar('{nombre}, hermano nº {numero} de {hermandad}', jaime, ctx))
  caso('la misma marca dos veces', 'Jaime, ¿me oyes, Jaime?',
    m.personalizar('{nombre}, ¿me oyes, {nombre}?', jaime, ctx))
  caso('un texto sin marcas sale igual', 'Se convoca cabildo el jueves.',
    m.personalizar('Se convoca cabildo el jueves.', jaime, ctx))

  /*
   * --- EL CENSO IMPORTADO DE UN EXCEL ---
   *
   * Esto NO es un caso raro que se ha buscado para tener otra prueba: es cómo
   * llega la mitad de los censos, y la aplicación tiene un importador entero
   * dedicado a ello (`src/lib/importar.ts`).
   */
  caso('«APELLIDOS, NOMBRE» coge el nombre y no el apellido', 'José',
    m.nombreDePila('RIVAS DELGADO, JOSÉ ANTONIO'))
  caso('y le baja el tono a las mayúsculas', 'José', m.nombreDePila('JOSÉ ANTONIO RIVAS DELGADO'))
  caso('con la tilde en su sitio', 'Ángel', m.nombreDePila('ÁNGEL LÓPEZ'))
  /*
   * PERO NO SE TOCA LO QUE ESTÁ BIEN ESCRITO. Es la otra mitad de la regla y
   * la que se olvida: normalizar a lo bruto convierte «McCarthy» en «Mccarthy»
   * y «de la Cruz» en «De la cruz». Solo se rebaja lo que viene ENTERO en
   * mayúsculas, que es la señal de que lo escribió una máquina.
   */
  caso('un nombre bien escrito no se toca', 'Jaime', m.nombreDePila('Jaime Rivas'))
  caso('ni uno con mayúscula dentro', 'McCarthy', m.nombreDePila('McCarthy Robles'))
  caso('los espacios de más no cuentan', 'Jaime', m.nombreDePila('  Jaime   Rivas  '))
  // Un nombre compuesto devuelve el primero, y está bien: así se llama a la gente.
  caso('un compuesto devuelve el primero', 'José', m.nombreDePila('José Antonio Rivas'))
  // Una inicial suelta no es un nombre entero en mayúsculas: se deja.
  caso('una sola letra se deja como está', 'J', m.nombreDePila('J Rivas'))

  /*
   * --- LA FICHA SIN EL DATO ---
   *
   * «Hola ,» es peor que no personalizar: se lee como descuido, y en un correo
   * de la hermandad el descuido se nota más que en cualquier otro sitio.
   */
  caso('sin nombre se usa una fórmula que vale para cualquiera', 'Hola hermano/a,',
    m.personalizar('Hola {nombre},', { nombre: '', numero: 4 }, ctx))
  caso('sin hermandad tampoco se deja el hueco', 'la hermandad',
    m.personalizar('{hermandad}', jaime, {}))
  caso('no se le supone el género a nadie', true,
    /hermano\/a/.test(m.personalizar('{nombre}', { nombre: '', numero: 1 }, ctx)))

  /*
   * --- LA MARCA QUE NO EXISTE: EL DESASTRE QUE ESTO EVITA ---
   */
  caso('se caza una marca mal escrita', ['nombe'], m.marcasDesconocidas('Hola {nombe},'))
  caso('y no se confunde con las buenas', [],
    m.marcasDesconocidas('Hola {nombre}, nº {numero} de {hermandad} en {ejercicio}'))
  caso('sin repetirla aunque salga tres veces', ['nombe'],
    m.marcasDesconocidas('{nombe} {nombe} {nombe}'))
  caso('se cazan varias distintas', ['nombe', 'apelidos'],
    m.marcasDesconocidas('{nombe} {apelidos} {nombre}'))
  /*
   * `{Nombre}` con mayúscula SÍ vale. Quien lo escribe así quiere `{nombre}`, y
   * plantarse por eso sería un freno que no protege de nada mientras molesta a
   * todo el mundo. Lo que hay que cazar es `{nombe}`, que es el error de verdad.
   */
  caso('una mayúscula de más no es un error', [], m.marcasDesconocidas('Hola {Nombre}'))
  caso('y se sustituye igual', 'Hola Jaime', m.personalizar('Hola {Nombre}', jaime, ctx))

  // Y una marca desconocida NO se borra: se deja para que alguien la vea.
  caso('una marca desconocida se deja visible', 'Hola {nombe}',
    m.personalizar('Hola {nombe}', jaime, ctx))

  /*
   * --- EL FRENO, QUE ES LO QUE LO CONVIERTE EN SEGURO ---
   */
  caso('con las marcas buenas se deja mandar', true,
    m.sePuedePersonalizar('Hola {nombre}').puede)
  const frenado = m.sePuedePersonalizar('Hola {nombe}, tu nº {numro}')
  caso('con una mala, no', false, frenado.puede)
  caso('se dicen cuáles son', true, /\{nombe\}/.test(frenado.motivo) && /\{numro\}/.test(frenado.motivo))
  caso('se dice qué pasaría si se mandara', true, /todos los destinatarios/.test(frenado.motivo))
  caso('y cuáles son las que valen', true, /\{nombre\}/.test(frenado.motivo))
  caso('cuando se puede, no se da motivo', '', m.sePuedePersonalizar('Hola').motivo)

  /*
   * --- LA VISTA PREVIA ---
   *
   * Con una persona de verdad del propio segmento. Una vista previa que enseña
   * `{nombre}` en crudo es el mismo texto que ya se está escribiendo: no
   * enseña nada.
   */
  caso('la vista previa usa a una persona de verdad', 'Hola Jaime',
    m.vistaPrevia('Hola {nombre}', jaime, ctx))
  // Y sin nadie —censo vacío, ayuda del editor— usa los ejemplos.
  caso('sin nadie a quien enseñárselo, usa el ejemplo', 'Hola José',
    m.vistaPrevia('Hola {nombre}', null, ctx))
  caso('y también enseña las reservas', true,
    /hermano\/a/.test(m.vistaPrevia('Hola {nombre}', { nombre: '', numero: 1 }, ctx)))

  // --- SABER SI HAY QUE PERSONALIZAR ---
  caso('reconoce un texto con marcas', true, m.llevaMarcas('Hola {nombre}'))
  caso('y uno sin ellas', false, m.llevaMarcas('Hola a todos'))
  /*
   * Y ESTO IMPORTA MÁS DE LO QUE PARECE: un texto sin marcas se manda como
   * siempre, en tandas de 50 y de una vez. Solo los que llevan marcas pagan el
   * precio de mandarse uno a uno. Si `llevaMarcas` diera «sí» de más, TODOS los
   * comunicados pasarían a mandarse de uno en uno sin necesidad.
   */
  caso('unas llaves con números no son una marca', false, m.llevaMarcas('El {2027} fue bueno'))
  caso('ni unas llaves vacías', false, m.llevaMarcas('Un {} suelto'))

  // --- LAS MARCAS ESTÁN DOCUMENTADAS PARA QUIEN ESCRIBE ---
  caso('cada marca dice qué hace', [], m.MARCAS.filter((x) => !x.que || !x.ejemplo).map((x) => x.marca))
  caso('y no hay ninguna repetida', m.MARCAS.length, new Set(m.MARCAS.map((x) => x.marca)).size)
  /*
   * Y TODA MARCA DE LA LISTA SE SUSTITUYE DE VERDAD. Es el fallo de media
   * instalación de siempre: una marca documentada en la ayuda, que el editor
   * ofrece con su botón, y que al mandar sale entre llaves porque a nadie se le
   * ocurrió enchufarla. Se comprueba una por una.
   */
  const sinEnchufar = m.MARCAS
    .map((x) => x.marca)
    .filter((marca) => m.personalizar(`{${marca}}`, jaime, ctx).includes('{'))
  caso('todas las marcas de la lista se sustituyen de verdad', [], sinEnchufar)

  // Y la lista de marcas es la MISMA que valida el freno: si se añade una a
  // `MARCAS` y no al validador, se cazaría como desconocida.
  const rechazadas = m.MARCAS.map((x) => x.marca).filter((x) => !m.sePuedePersonalizar(`{${x}}`).puede)
  caso('ninguna marca buena la rechaza el freno', [], rechazadas)

  // --- Y NADIE SE ESCRIBE SU PROPIA SUSTITUCIÓN POR AHÍ ---
  const src = await readFile('src/lib/personalizar.ts', 'utf8')
  caso('el motor vive en un solo sitio', true, /export function personalizar/.test(src))


  /*
   * ==========================================================================
   * Y QUE ESTÉ ENCHUFADO DE VERDAD, QUE ES DONDE VIVE EL RIESGO
   * ==========================================================================
   *
   * Lo de arriba comprueba el motor. Esto comprueba que la pantalla lo usa —el
   * fallo de media instalación que más veces se ha repetido en este proyecto es
   * exactamente este: la mitad visible funciona, la invisible falta, y no salta
   * nada—.
   */
  const pantalla = await readFile('src/pages/app/Comunicados.tsx', 'utf8')
  const correo = await readFile('src/lib/correo.ts', 'utf8')

  // --- EL ENVÍO SE PARTE EN DOS CAMINOS, Y ESO IMPORTA ---
  caso('se pregunta si el texto lleva marcas', true,
    /llevaMarcas\(c\.cuerpo\) \|\| llevaMarcas\(c\.titulo\)/.test(pantalla))
  /*
   * Y SOLO ENTONCES SE MANDA UNO A UNO. Un comunicado sin marcas —que son la
   * mayoría— sigue saliendo de una vez, en tandas de cincuenta. Si se mandaran
   * todos de uno en uno, un envío a ochocientos pasaría de segundos a minutos
   * sin ninguna necesidad, y encima con más papeletas de que el proveedor lo
   * tome por spam.
   */
  caso('con marcas se manda uno a uno', true, /enviarCorreoUnoAUno\(mensajes/.test(pantalla))
  caso('y sin ellas, de una vez como siempre', true,
    /enviarCorreo\(\{ para: direcciones/.test(pantalla))
  caso('cada mensaje lleva su propio asunto y cuerpo', true,
    /personalizar\(c\.titulo, d, ctx\)[\s\S]{0,200}?personalizar\(c\.cuerpo, d, ctx\)/.test(pantalla))

  /*
   * --- SE LLEVA LA PERSONA, NO SOLO LA DIRECCIÓN ---
   *
   * Era una lista de correos, porque el cuerpo era el mismo para todos. Sin la
   * persona al lado no se puede saber de quién es cada dirección, y «Hola
   * {nombre}» no tendría con qué rellenarse.
   */
  caso('los destinos llevan nombre', true, /nombre: h\.nombre/.test(pantalla))
  /*
   * Y A LOS DE `soloCorreo` NO SE LES INVENTA UN NÚMERO. La junta con cuenta
   * pero sin ficha, y los suscriptores de la web, NO son hermanos. Un cero
   * puesto ahí acaba impreso en un correo diciendo «hermano nº 0».
   */
  caso('a quien no es hermano no se le inventa un número', true,
    /alcance\.soloCorreo\.map\(\(p\) => \(\{ email: p\.email, nombre: p\.nombre, numero: null \}\)\)/.test(pantalla))

  /*
   * --- EL FRENO, EN LOS TRES SITIOS ---
   *
   * Y son tres a propósito, porque cada uno tapa un agujero distinto:
   */
  // 1. Al escribir: para que se vea y se arregle antes de nada.
  caso('el editor avisa mientras se escribe', true, /!revisionMarcas\.puede &&/.test(pantalla))
  // 2. Al guardar: ni siquiera como borrador. Un borrador se manda más tarde,
  //    quizá desde otra pantalla y por otra persona: dejarlo pasar es dejar la
  //    bomba puesta con la mecha más larga.
  caso('no se guarda con una marca mala', true,
    /const revision = sePuedePersonalizar\(`\$\{titulo\}[\s\S]{0,60}?if \(!revision\.puede\)/.test(pantalla))
  /*
   * 3. Al mandar: un comunicado guardado AYER, antes de que existiera el freno,
   *    llega hasta el envío sin haber pasado por los otros dos. Es el caso que
   *    de verdad importa, porque es el único que ya existe hoy en las bases.
   */
  caso('y no se manda tampoco', true,
    /const revision = sePuedePersonalizar\(`\$\{c\.titulo\}[\s\S]{0,200}?No se ha mandado nada/.test(pantalla))

  // --- LA VISTA PREVIA, CON ALGUIEN DEL PROPIO SEGMENTO ---
  caso('la vista previa usa al primero del segmento', true,
    /vistaPrevia\(cuerpoNuevo, segmentoHermanos\[0\] \?\? null/.test(pantalla))
  caso('y se dice a quién se le está enseñando', true,
    /Así le llegará a \$\{segmentoHermanos\[0\]\.nombre\}/.test(pantalla))
  // Las marcas se ponen pulsando: escritas a mano se equivoca cualquiera.
  caso('las marcas se ponen con un botón', true, /setCuerpoNuevo\(\(t\) => `\$\{t\}\{\$\{m\.marca\}\}`\)/.test(pantalla))
  caso('y cada botón explica qué hace su marca', true, /title=\{`\$\{m\.que\} — p\. ej\./.test(pantalla))

  /*
   * ==========================================================================
   * MANDAR OCHOCIENTOS CORREOS DE UNO EN UNO, SIN HACER UN DESTROZO
   * ==========================================================================
   */
  caso('van en fila y no todos a la vez', true, /for \(let i = 0; i < mensajes\.length; i\+\+\)/.test(correo))
  /*
   * UNO QUE FALLA NO PARA A LOS DEMÁS. Un correo mal escrito en el censo —que
   * en un censo importado de un Excel es lo normal— no puede dejar sin
   * comunicado a los setecientos noventa y nueve restantes.
   */
  caso('un fallo suelto no corta el envío', true, /fallidos\+\+/.test(correo))
  caso('pero se cuenta y se devuelve', true, /fallidos > 0 \? error : undefined/.test(correo))
  // Y se va contando, para que la pantalla pueda decir «312 de 800».
  caso('se va diciendo por dónde va', true, /alVer\?\.\(i \+ 1, mensajes\.length\)/.test(correo))
  caso('y la pantalla lo enseña', true, /Enviando, uno por uno: \$\{hechos\} de \$\{total\}/.test(pantalla))

  /*
   * EL FRENO DE EMERGENCIA. Si fallan los diez primeros seguidos y no ha salido
   * ninguno, no son direcciones malas: es el proveedor caído, la clave caducada
   * o la cuenta bloqueada. Seguir setecientas noventa veces más tarda un cuarto
   * de hora, machaca al proveedor y acaba igual.
   */
  const m2 = await cargar('src/lib/correo.ts')
  caso('hay un tope de fallos seguidos', 10, m2.FALLOS_SEGUIDOS_PARA_RENDIRSE)
  caso('solo se rinde si no ha salido NI UNO', true, /enviados === 0 && seguidos >=/.test(correo))
  caso('y dice cuántos se quedaron sin intentar', true, /sinIntentar: mensajes\.length - \(i \+ 1\)/.test(correo))
  caso('y a dónde ir a mirarlo', true, /Configuración → Correo/.test(correo))
  /*
   * Y LO QUE SE ENSEÑA AL ACABAR NO ES «ENVIADO» A SECAS. «Enviado» encima de
   * un envío que se paró en el número doce es la peor manera de terminar esto:
   * la hermandad se queda convencida de haber avisado a ochocientas personas.
   */
  caso('un envío cortado se dice', true, /u\.cortado[\s\S]{0,120}?estado: 'error'/.test(pantalla))
  caso('y un envío a medias, también', true, /Enviado a \$\{u\.enviados\} de \$\{mensajes\.length\}/.test(pantalla))


  /*
   * ==========================================================================
   * Y QUE LLEGUE BIEN A RESEND, QUE ES DONDE ACABA TODO ESTO
   * ==========================================================================
   *
   * La copia oculta es obligatoria en cuanto hay más de un destinatario:
   * mandar el comunicado con las mil direcciones a la vista es filtrar el censo
   * entero, y en una hermandad eso son datos de categoría especial.
   *
   * PERO CON UN SOLO DESTINATARIO NO HAY NADA QUE OCULTAR, y ponerlo en copia
   * oculta hace daño. Desde que los comunicados se personalizan, cada correo
   * sale por separado — y así llegaban todos con «para: no-responder@…» y el
   * destinatario en oculta: un correo dirigido a nadie, con el nombre propio
   * dentro. Es la forma exacta de un envío masivo camuflado, y los filtros de
   * spam lo tratan como tal.
   */
  const fn = await readFile('supabase/functions/enviar-correo/index.ts', 'utf8')
  caso('a una sola persona se le escribe a ella', true,
    /para\.length === 1\s*\n\s*\? \{ to: para \}/.test(fn))
  caso('y a varias, en copia oculta', true, /: \{ to: \[soloLaDireccion\(REMITENTE\)\], bcc: para \}/.test(fn))
  /*
   * Y SE DECIDE POR EL NÚMERO, NO POR UN PARÁMETRO. Un interruptor que dijera
   * «mándalo a la vista» acabaría puesto algún día en un envío de ochocientos,
   * y ahí se filtra el censo entero. Con un solo destinatario no se puede
   * filtrar a nadie porque no hay nadie más.
   */
  caso('sin ningún interruptor para saltarse la copia oculta', false,
    /cuerpo\.(directo|sinOculta|visible)/.test(fn))
}
