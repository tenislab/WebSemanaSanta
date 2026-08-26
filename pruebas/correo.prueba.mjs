/** P7: el envío de correo (lo que se puede probar sin proveedor). */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/correo.ts')
  localStorage.removeItem(m.CLAVE_CORREO)

  // --- Los valores de partida ---
  const inicial = m.getAjustesCorreo()
  // Apagado de fábrica: encenderlo es una decisión de la hermandad, no algo
  // que pase solo el día que alguien conecta la base de datos.
  caso('el correo empieza apagado', false, inicial.activo)
  caso('los comunicados sí salen por correo cuando se encienda', true, inicial.avisaDe.comunicados)
  caso('las cuotas también', true, inicial.avisaDe.cuotas)
  // Los cambios de ficha son muchos y menores: llenarían la bandeja.
  caso('los cambios de ficha no', false, inicial.avisaDe.ficha)

  // --- Guardar y leer ---
  m.saveAjustesCorreo({ ...inicial, activo: true, responderA: 'secretaria@hermandad.es' })
  caso('se guarda que está activo', true, m.getAjustesCorreo().activo)
  caso('y a dónde se contesta', 'secretaria@hermandad.es', m.getAjustesCorreo().responderA)
  // Lo guardado por una versión anterior no trae los campos nuevos.
  localStorage.setItem(m.CLAVE_CORREO, JSON.stringify({ activo: true }))
  const parcial = m.getAjustesCorreo()
  caso('unos ajustes a medias se completan', true, parcial.avisaDe.comunicados)
  caso('sin perder lo que sí traían', true, parcial.activo)

  // --- ¿Se puede mandar? ---
  // Sin base de datos no hay función de servidor, así que no.
  caso('sin Supabase no se puede mandar', false, m.correoDisponible({ activo: true }))
  caso('y apagado tampoco', false, m.correoDisponible({ activo: false }))

  // --- Nunca lanza ---
  // Quien lo llama está haciendo algo más importante (mandar un comunicado):
  // un fallo de correo no puede tumbar eso.
  const r = await m.enviarCorreo({ para: ['a@b.es'], asunto: 'x', texto: 'y' })
  caso('sin conectar, devuelve un fallo en vez de reventar', false, r.ok)
  caso('y explica por qué', true, (r.error ?? '').length > 10)

  // --- El correo de prueba ---
  const p = m.correoDePrueba('Hdad. de la Vera-Cruz')
  caso('el asunto nombra a la hermandad', true, p.asunto.includes('Hdad. de la Vera-Cruz'))
  caso('trae versión en texto', true, p.texto.length > 40)
  caso('y en HTML', true, p.html.includes('<div'))
  // El nombre de la hermandad se escapa: un «&» o un «<» en el nombre no puede
  // romper el HTML del correo.
  const conSigno = m.correoDePrueba('Hdad. <script>alerta</script> & Cía')
  caso('el nombre se escapa en el HTML', false, conSigno.html.includes('<script>'))
  caso('y se ve escapado', true, conSigno.html.includes('&lt;script&gt;'))
  caso('el «&» también', true, conSigno.html.includes('&amp;'))

  localStorage.removeItem(m.CLAVE_CORREO)

  await correoAuditoria({ cargar, caso })
  await losDescartadosSeCuentan({ caso })
  await elResguardoDeLaReservaLoMandaElServidor({ caso })
}

/**
 * Auditoría 2026-08 · Que los correos lleguen de verdad.
 */
async function correoAuditoria({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')

  // --- Más de 50 destinatarios ---
  // Una hermandad de 612 mandaba a los 612 de una vez; el servidor corta en 50
  // y devolvía un 400, así que NO LE LLEGABA A NADIE. Y el comunicado ya se
  // había guardado como «Enviado», con el botón de mandarlo escondido.
  const m = await cargar('src/lib/correo.ts')
  caso('el tamaño de tanda está declarado', 50, m.POR_TANDA)
  const src = await readFile('src/lib/correo.ts', 'utf8')
  caso('se trocea si hay más', true, /if \(para\.length > POR_TANDA\)/.test(src))
  caso('las tandas van una detrás de otra', true, /await enviarCorreo\(\{ \.\.\.mensaje, para: tanda \}\)/.test(src))
  caso('si sale una parte, se dice cuál', true, /Salieron \$\{enviados\} de/.test(src))
  // Y el servidor tiene que cortar en el mismo número, o el troceo no sirve.
  const fn = await readFile('supabase/functions/enviar-correo/index.ts', 'utf8')
  const tope = fn.match(/const MAXIMO_DESTINATARIOS = (\d+)/)
  caso('el servidor corta en el mismo número', '50', tope && tope[1])

  // --- La configuración es de la HERMANDAD, no del portátil ---
  // El secretario la activaba en su portátil; la tesorera, desde el ordenador
  // de la casa de hermandad, marcaba cuotas como pagadas y no salía ni un
  // aviso: en ESE navegador la configuración no existe, así que se leía la de
  // fábrica —apagado— y la lista salía vacía. Sin error y sin mensaje.
  caso('se trae de la base de datos', true, /export async function cargarAjustesCorreoDeLaBase/.test(src))
  caso('y se guarda en ella', true, /export async function guardarAjustesCorreoEnLaBase/.test(src))
  caso('el hook hace las dos cosas', true,
    /void cargarAjustesCorreoDeLaBase\(\)/.test(src) && /void guardarAjustesCorreoEnLaBase\(a\)/.test(src))
  const sqlCorreo = await readFile('supabase/correo-hermandad.sql', 'utf8')
  caso('hay columna para ella', true, /add column if not exists correo jsonb/.test(sqlCorreo))

  // Y que las pantallas que mandan avisos la traigan antes de escribir.
  const av = await readFile('src/lib/avisosCorreo.ts', 'utf8')
  caso('hay una función que lo prepara todo', true, /export async function prepararAvisos/.test(av))
  caso('trae config y preferencias a la vez', true,
    /Promise\.all\(\[cargarAjustesCorreoDeLaBase\(\), cargarPreferenciasDeLaBase\(\)\]\)/.test(av))
  for (const p of ['Cuotas', 'Papeletas', 'Comunicados', 'Hermanos']) {
    const pant = await readFile(`src/pages/app/${p}.tsx`, 'utf8')
    caso(`${p} lo prepara al abrirse`, true, /void prepararAvisos\(\)/.test(pant))
  }

  // --- La baja y el cambio de IBAN salen SIEMPRE ---
  // Iban por el interruptor «ficha», que viene apagado de fábrica.
  const avisos = await cargar('src/lib/avisosCorreo.ts')
  const gente = [{ id: 'h1', nombre: 'Ana', email: 'ana@correo.es' }]
  const deFabrica = { activo: true, responderA: '', avisaDe: { comunicados: true, cuotas: true, papeletas: true, ficha: false } }
  caso('con la config de fábrica, «ficha» no sale', 0, avisos.destinatariosDe(gente, 'ficha', deFabrica).length)
  caso('pero un aviso importante SÍ', 1, avisos.destinatariosDe(gente, 'importante', deFabrica).length)
  // Ni el hermano lo puede apagar: va sobre su cuenta bancaria y su baja.
  const ah = await cargar('src/lib/avisosHermano.ts')
  caso('el hermano no puede apagar los importantes', true, ah.quiereAviso({ importante: false, ficha: false }, 'importante'))
  caso('los demás sí', false, ah.quiereAviso({ ficha: false }, 'ficha'))
  // Con el correo apagado del todo no sale nada, ni los importantes.
  const apagado = { ...deFabrica, activo: false }
  caso('con el correo apagado no sale ni el importante', 0, avisos.destinatariosDe(gente, 'importante', apagado).length)

  // Y que los dos sitios lo usen.
  const hermanos = await readFile('src/pages/app/Hermanos.tsx', 'utf8')
  caso('la baja usa «importante»', true, /'importante',\n\s+'Tu baja en la hermandad'/.test(hermanos))
  caso('el cambio de IBAN también', true, /'importante',\n\s+'Han cambiado tu cuenta bancaria'/.test(hermanos))

  // --- Los segmentos ---
  const com = await readFile('src/pages/app/Comunicados.tsx', 'utf8')
  // Los criterios guardados mandan sobre el texto legible, y se miran los
  // PRIMEROS: son la única verdad de a quién iba dirigido el comunicado.
  caso('los destinatarios salen de los criterios guardados', true,
    /hermanos: filtrarSegmento\(hermanos, c\.criterios, rolesPorHermano, cargosPorHermano, situacionesDeCuota\)/.test(com))
  caso('y los criterios se guardan en el comunicado', true, /criterios: criteriosGuardados,/.test(com))
  caso('no se guarda como enviado si no hay nadie', true,
    /if \(estado === 'Enviado' && cuantos === 0\)/.test(com))
  // El alcance cuenta a los dos grupos: los del censo y las cuentas de la
  // junta que no tienen ficha. Contando solo los primeros, un comunicado que
  // había llegado a seis personas quedaba registrado con alcance cero.
  caso('el alcance sale de a quién se escribió', true, /alcance: cuantosSon\(alcance\)/.test(com))
  caso('y cuenta también a la junta sin ficha', true,
    /return a\.hermanos\.length \+ a\.soloCorreo\.length/.test(com))
  // «Enviar ahora» del formulario tiene que mandar el correo, no solo el buzón.
  caso('«Enviar ahora» del formulario manda correo', true, /void enviarAhora\(nuevos\[0\]\)/.test(com))

  // Y la columna en la base de datos.
  const sql = await readFile('supabase/comunicados-segmento.sql', 'utf8')
  caso('hay SQL para los criterios', true, /add column if not exists criterios jsonb/.test(sql))
  const db = await readFile('src/lib/db/comunicados.ts', 'utf8')
  caso('se guardan', true, /criterios: c\.criterios/.test(db))
  caso('y se leen', true, /criterios: \(r\.criterios/.test(db))

  // ---------------------------------------------------------------------
  // Cuando el envío falla, ¿se dice algo que sirva?
  // ---------------------------------------------------------------------
  /*
   * EL CASO REAL, vivido: la función estaba desplegada, con sus dos secretos,
   * y la aplicación decía «La función de envío no está instalada en Supabase
   * todavía». Media hora reinstalando algo que ya estaba puesto, sin tocar lo
   * que fallaba de verdad —el interruptor «Verify JWT» de la propia función,
   * que hace que la puerta de Supabase rechace el sondeo que el navegador
   * manda antes de cada petición—.
   *
   * La culpa era de dar por hecha UNA causa: Supabase suelta «Failed to send a
   * request» tanto si la función no existe como si existe y no se llega a
   * ella. Un 404 sí es inequívoco; lo demás hay que contarlo entero.
   */
  const fallo = (message, status) => m.explicarFalloDeEnvio({ message, context: { status } })

  // 404: aquí no hay función, y se puede decir sin miedo.
  const noHay = fallo('Not Found', 404)
  caso('un 404 dice que hay que desplegarla', true, /no está desplegada/.test(noHay))
  caso('y dice dónde', true, /Deploy a new function/.test(noHay))

  // La frase ambigua: NO puede afirmar que falte instalarla.
  const ambiguo = fallo('Failed to send a request to the Edge Function')
  caso('no afirma que falte instalarla', false, /no está desplegada|no está instalada/.test(ambiguo))
  caso('manda a mirar las invocaciones', true, /Invocations/.test(ambiguo))
  caso('y nombra el interruptor que lo causa', true, /Verify JWT/.test(ambiguo))
  // Las dos salidas, para que quien lo lea sepa cuál es la suya.
  caso('explica el caso «no aparece ninguna»', true, /NO aparece/.test(ambiguo))
  caso('y el caso «aparece con error»', true, /aparece con error/.test(ambiguo))

  // Y las otras formas en que el navegador cuenta lo mismo.
  for (const frase of ['Failed to fetch', 'NetworkError when attempting to fetch resource', 'Load failed']) {
    caso(`«${frase}» se trata igual`, true, /Invocations/.test(fallo(frase)))
  }

  // Un rechazo con estado: ahí sí se puede apuntar a la clave.
  const rechazo = fallo('Unauthorized', 401)
  caso('un 401 apunta a la clave y al interruptor', true,
    /RESEND_API_KEY/.test(rechazo) && /Verify JWT/.test(rechazo))

  // Y lo que no se reconoce se dice tal cual, sin inventar.
  caso('lo desconocido se cuenta tal cual', 'Algo raro de Resend', fallo('Algo raro de Resend', 500))

  /*
   * «EDGE FUNCTION RETURNED A NON-2XX STATUS CODE».
   *
   * Este se enseñaba en crudo y es la peor de las tres, porque suena a avería
   * del servidor y significa lo CONTRARIO que las de arriba: la función está
   * desplegada y se llega a ella, pero ha respondido con error. Mandar a
   * desplegarla o a tocar el «Verify JWT» con este mensaje es media hora
   * perdida en lo que ya funciona.
   */
  const dentro = fallo('Edge Function returned a non-2xx status code')
  caso('el non-2xx no manda a desplegar nada', false, /no está desplegada/.test(dentro))
  caso('ni a tocar el interruptor', false, /Verify JWT/.test(dentro))
  caso('dice que el problema está dentro', true, /lo de dentro|ha respondido con un error/.test(dentro))
  // Las tres causas, por orden de frecuencia.
  caso('apunta a la clave de Resend', true, /RESEND_API_KEY/.test(dentro))
  caso('y al dominio sin verificar, que es la número uno', true, /sin verificar/.test(dentro))
  caso('y al remitente', true, /CORREO_REMITENTE/.test(dentro))
  caso('y dice dónde ver el motivo exacto', true, /Invocations/.test(dentro))

  /*
   * Y el reporte de fallos usa el mismo traductor. Salía en crudo, y eso lo
   * lee alguien que YA está intentando contar un problema: darle otro mensaje
   * indescifrable es cerrarle la última puerta que le quedaba.
   */
  const { readFile: leer } = await import('node:fs/promises')
  const rep = await leer('src/lib/reporteFallo.ts', 'utf8')
  caso('contar un fallo traduce el error igual', true, /explicarFalloDeEnvio\(error\)/.test(rep))
  caso('y ya no lo suelta en crudo', false, /error: error\.message \}/.test(rep))

  // ---------------------------------------------------------------------
  // Las cabeceras CORS de la función de envío
  // ---------------------------------------------------------------------
  /*
   * ESTO COSTÓ UNA TARDE. La función respondía al sondeo del navegador
   * autorizando solo «authorization, content-type». Pero el cliente de
   * Supabase manda además `apikey` y `x-client-info` en cada llamada.
   *
   * Lo que se veía era desconcertante: en el panel salían las llamadas OPTIONS
   * con un 200 tan tranquilas —el sondeo llegaba y se contestaba bien— y
   * NINGUNA POST detrás. Porque el navegador manda el sondeo, lee que `apikey`
   * no está permitida, y decide por su cuenta no mandar la petición de verdad.
   * Nunca sale de él. Por eso no había ni rastro en el servidor.
   *
   * La lista tiene que incluir TODAS las que manda el cliente, no solo las que
   * se usan dentro de la función.
   */
  const fuente = await (await import('node:fs/promises')).readFile(
    'supabase/functions/enviar-correo/index.ts', 'utf8')
  const permitidas = (fuente.match(/'Access-Control-Allow-Headers': '([^']+)'/) ?? [])[1] ?? ''
  for (const cabecera of ['authorization', 'apikey', 'x-client-info', 'content-type']) {
    caso(`la función permite «${cabecera}»`, true, permitidas.includes(cabecera))
  }
  caso('y dice qué métodos acepta', true, /'Access-Control-Allow-Methods': '[^']*POST/.test(fuente))
  // El sondeo se contesta antes de comprobar nada: va sin sesión, por diseño.
  caso('el sondeo se contesta el primero', true,
    /if \(req\.method === 'OPTIONS'\) return new Response\('ok', \{ headers: cabeceras \}\)/.test(fuente))
}

/**
 * A QUIÉN NO LE HA LLEGADO, QUE SE SEPA.
 *
 * Las direcciones mal escritas se descartaban en silencio. Una hermandad
 * marcaba 612 destinatarios, y si cuarenta tenían el correo mal en el censo
 * —que en un censo importado de un Excel es lo normal— la pantalla decía
 * «enviado a 572» y nadie caía en la diferencia.
 *
 * Esos cuarenta no se enteran de nada: ni de los cabildos, ni de los cultos,
 * ni de que se les ha emitido la cuota. Y como el comunicado queda guardado
 * como «Enviado», no vuelve a intentarse nunca.
 */
export async function losDescartadosSeCuentan({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const sin = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '')

  const correo = sin(await readFile('src/lib/correo.ts', 'utf8'))
  caso('el resultado dice cuántos se quedaron fuera', true, /sinCorreoValido\?: number/.test(correo))
  caso('y se calculan de verdad', true, /const sinCorreoValido = limpias\.length - para\.length/.test(correo))
  // En TODAS las salidas, no solo en la buena: si falla el envío, saber que
  // además cuarenta no tenían correo sigue siendo lo que hay que arreglar.
  caso('viaja en todas las respuestas', true,
    (correo.match(/sinCorreoValido/g) ?? []).length >= 6)

  const com = sin(await readFile('src/pages/app/Comunicados.tsx', 'utf8'))
  caso('la pantalla lo enseña', true, /r\.sinCorreoValido/.test(com))
  // El texto se arma con singular y plural, así que la frase no está entera:
  // se busca a dónde manda, que es lo que tiene que decir.
  caso('y dice qué hacer', true, /en Hermanos/.test(com) && /rev[ií]salos?/.test(com))
  // No se pinta en verde: 40 hermanos incomunicados no es un envío correcto.
  caso('no se da por bueno si falta alguien', true, /fuera > 0 \? 'error' : 'hecho'/.test(com))
}


/**
 * EL RESGUARDO DE UNA RESERVA LO MANDA EL SERVIDOR, Y NO EL NAVEGADOR.
 *
 * Quien aparta algo en la tienda de la web no tiene sesión: es un vecino del
 * barrio. Así que esa rama de `enviar-correo` va, como la de confirmar una
 * suscripción, ANTES del control de sesión — y eso la convierte en la parte
 * más expuesta de toda la función.
 *
 * Lo que aquí se comprueba no es que mande el correo, sino que NO SE FÍE del
 * navegador para saber a quién: si la dirección viniera en el cuerpo de la
 * petición, cualquiera podría mandarle a quien quisiera un correo firmado con
 * el nombre de la hermandad.
 */
export async function elResguardoDeLaReservaLoMandaElServidor({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const fn = await readFile('supabase/functions/enviar-correo/index.ts', 'utf8')

  caso('la función atiende los resguardos de reserva', true,
    /if \(reserva\) return await mandarResguardoDeReserva\(reserva\)/.test(fn))
  // Del navegador solo llegan la hermandad y la referencia. NO el correo.
  const firma = fn.match(/async function mandarResguardoDeReserva\(\s*datos: \{([^}]*)\}/)
  caso('solo acepta hermandad y referencia', true, Boolean(firma))
  caso('y NO acepta un destinatario de fuera', false, /email/.test(firma?.[1] ?? 'email'))
  // El correo se lee de la propia reserva, con la clave de servicio.
  caso('el destinatario lo lee de la base', true, /rpc\/resguardo_de_reserva/.test(fn))
  caso('con la clave de servicio', true,
    /resguardo_de_reserva[\s\S]{0,400}Bearer \$\{SERVICE_KEY\}/.test(fn))
  caso('y se manda a lo que ella devuelve', true, /to: \[String\(res\.email\)\]/.test(fn))
  // Sin fila se contesta que sí: decir «esa reserva no existe» sería una forma
  // de ir probando referencias hasta dar con una.
  caso('una referencia que no vale no se distingue', true,
    /if \(!res\?\.email\) return respuesta\(\{ enviados: 0 \}\)/.test(fn))

  // Y del lado del navegador: que no mande ninguna dirección.
  const lib = await readFile('src/lib/tienda.ts', 'utf8')
  caso('el navegador solo dice qué reserva', true,
    /body: \{ reserva: \{ hermandadId: hermandad, referencia \} \}/.test(lib))
  // Sin esperarlo: la reserva ya está hecha y un correo que no sale no puede
  // tumbarla ni asustar a quien acaba de apartar algo.
  caso('y no espera al correo para dar la reserva por buena', true,
    /void supabase\.functions[\s\S]{0,200}\.catch\(\(\) => \{\}\)/.test(lib))

  /*
   * LOS TRES CIERRES DE LA FUNCIÓN DE LA BASE. Se leen del fichero suelto, que
   * es donde se tocan; que además funcionen se prueba contra un Postgres de
   * verdad en `basedatos.prueba.mjs`.
   */
  const sql = await readFile('supabase/tienda-web.sql', 'utf8')
  const trozo = sql.match(/create or replace function resguardo_de_reserva[\s\S]*?\$\$;/)?.[0] ?? ''
  caso('solo contesta por una reserva pendiente', true, /estado = 'pendiente'/.test(trozo))
  caso('solo si no se mandó ya', true, /resguardo_enviado_en is null/.test(trozo))
  caso('y solo en la media hora siguiente', true, /creado_en > now\(\) - interval '30 minutes'/.test(trozo))
  caso('la marca al devolverla', true, /update reservas_tienda set resguardo_enviado_en = now\(\)/.test(trozo))
  // Y no la puede llamar el navegador: devuelve un correo y un nombre.
  caso('no la puede llamar nadie desde el navegador', true,
    /revoke all on function resguardo_de_reserva\(uuid, text\) from public, anon, authenticated;/.test(sql))
}
