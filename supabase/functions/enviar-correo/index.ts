/**
 * Envío de correo (P7).
 *
 * POR QUÉ ESTO VIVE EN EL SERVIDOR Y NO EN EL NAVEGADOR: la clave del
 * proveedor de correo permite mandar correo EN NOMBRE DE LA HERMANDAD. Si
 * estuviera en el navegador, cualquiera la sacaría del código en diez segundos
 * y podría suplantar a la hermandad ante sus mil hermanos. Por eso vive aquí,
 * como secreto de la función, y el navegador solo puede pedir «manda esto».
 *
 * CÓMO SE DESPLIEGA:
 *   supabase secrets set RESEND_API_KEY=re_xxx
 *   supabase secrets set CORREO_REMITENTE=no-responder@tudominio.es
 *
 * Solo la dirección: el NOMBRE que ve el hermano lo pone su hermandad.
 *   supabase functions deploy enviar-correo
 *
 * PARA PROBAR SIN DOMINIO PROPIO: Resend deja usar `onboarding@resend.dev`
 * como remitente, pero SOLO puede enviar a la dirección con la que te
 * registraste. Sirve para comprobar que todo el circuito funciona; para
 * escribir a los hermanos hace falta verificar el dominio de la hermandad.
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const REMITENTE = Deno.env.get('CORREO_REMITENTE') ?? 'onboarding@resend.dev'

/**
 * La dirección de dentro de `CORREO_REMITENTE`, venga como venga.
 *
 * El secreto se puede haber puesto como «Gobergo <no-responder@gobergo.es>» o
 * como «no-responder@gobergo.es» a secas. Hace falta la dirección suelta
 * porque el NOMBRE que se enseña ya no es fijo: lo pone cada hermandad.
 */
function soloLaDireccion(remitente: string): string {
  const m = remitente.match(/<([^>]+)>/)
  return (m ? m[1] : remitente).trim()
}

/**
 * Una dirección de correo con la forma que pide Resend.
 *
 * La misma regla que se aplica a los destinatarios, con nombre, porque hace
 * falta en tres sitios y el tercero llegó tarde y caro (ver `replyToValido`).
 */
const ES_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
function correoValido(d: string): boolean {
  return ES_CORREO.test(d.trim())
}

/**
 * EL «RESPONDER A», VALIDADO ANTES DE SALIR — Y POR QUÉ ESTO ERA GRAVE.
 *
 * A `reply_to` iba, sin mirarlo, lo que hubiera en «Configuración → Correo →
 * Responder a», y si eso estaba vacío, el correo de la ficha de la hermandad.
 * Ninguno de los dos se comprobaba en ningún momento.
 *
 * Y Resend no perdona ese campo: si no tiene forma de dirección, RECHAZA EL
 * ENVÍO ENTERO con un 422. No manda el correo sin «responder a» — no manda
 * nada. Así que un espacio de más, un «secretaria» sin dominio o el nombre de
 * la hermandad escrito ahí por confusión dejaban a la hermandad SIN MANDAR UN
 * SOLO CORREO, y el error que se veía hablaba del proveedor, que no tenía
 * ninguna culpa. Nada apuntaba al campo que lo causaba.
 *
 * Ahora, si no vale, se va sin él: las respuestas irán al remitente en vez de
 * a la secretaría, que es un incordio pequeño y reparable. Quedarse sin mandar
 * la convocatoria de papeletas no lo es.
 */
function replyToValido(...candidatos: (string | undefined)[]): string | null {
  for (const c of candidatos) {
    const d = (c ?? '').trim()
    if (!d) continue
    // La primera que haya puesta manda, valga o no: si la hermandad configuró
    // una dirección mala, caer a la siguiente mandaría las respuestas a un
    // sitio que nadie ha elegido, y en silencio.
    return correoValido(d) ? d : null
  }
  return null
}

/**
 * EL REMITENTE DE PRUEBA DE RESEND, Y POR QUÉ HAY QUE DELATARLO.
 *
 * Si no se pone `CORREO_REMITENTE`, se usa `onboarding@resend.dev`. Y eso NO
 * es un remitente cualquiera: Resend solo entrega desde él A LA DIRECCIÓN CON
 * LA QUE TE REGISTRASTE. A cualquier otra la acepta, contesta 200, y no la
 * entrega nunca.
 *
 * Esa combinación —todo dice que sí y no llega nada— es la peor forma posible
 * de fallar, y es exactamente lo que reportó la hermandad piloto: «no me
 * llegan los mails», sin un solo error por ninguna parte. Se pasaron días
 * pensando que era el proveedor.
 *
 * Así que cuando estamos con el de prueba, cada respuesta lo dice. No se
 * bloquea el envío —sirve para comprobar el circuito, que para eso está— pero
 * deja de hacerse pasar por un envío normal.
 */
const REMITENTE_DE_PRUEBA = 'onboarding@resend.dev'
function conElRemitenteDePrueba(): boolean {
  return soloLaDireccion(REMITENTE).toLowerCase() === REMITENTE_DE_PRUEBA
}

/** El aviso que acompaña a toda respuesta mientras no haya remitente propio. */
function avisoDelRemitente(): string | undefined {
  if (!conElRemitenteDePrueba()) return undefined
  return (
    'OJO: se está enviando desde onboarding@resend.dev, el remitente de pruebas de Resend. '
    + 'Solo entrega a la dirección con la que te registraste en Resend; a cualquier otra la '
    + 'acepta y NO la entrega, sin dar ningún error. Para escribir a los hermanos hay que '
    + 'verificar el dominio de la hermandad en Resend y poner el secreto CORREO_REMITENTE.'
  )
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

/** Cuántas direcciones como mucho de una vez. Resend admite 50 por llamada. */
const MAXIMO_DESTINATARIOS = 50

/*
 * Las cabeceras que el navegador tiene que ver para dejar pasar la llamada.
 *
 * ESTO ESTUVO MAL Y COSTÓ UNA TARDE. Aquí solo ponía «authorization,
 * content-type», y el cliente de Supabase manda además `apikey` y
 * `x-client-info` en cada llamada a una función.
 *
 * Lo que se veía era desconcertante: en el panel de Supabase salían las
 * llamadas OPTIONS con un 200 tan tranquilas —el sondeo llegaba y se
 * contestaba bien— y NINGUNA POST detrás. Porque el navegador manda el sondeo,
 * lee que `apikey` no está entre las permitidas, y decide por su cuenta no
 * mandar la petición de verdad. Nunca sale de él. Por eso no había ni rastro
 * en el servidor, y por eso el error que llegaba a la pantalla era el inútil
 * «Failed to send a request to the Edge Function».
 *
 * La lista tiene que incluir TODAS las que manda el cliente, no solo las que
 * uno usa dentro.
 */
const cabeceras = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

/**
 * Toda respuesta lleva el aviso del remitente de pruebas, si toca.
 *
 * Va aquí y no en cada sitio a propósito: son ocho ramas distintas —el envío
 * normal, la confirmación de la lista, el resguardo de una reserva, las dos de
 * recuperar contraseña…— y si el aviso se pone a mano en cada una, la novena
 * se olvida. Y la novena será justo la que alguien esté depurando.
 */
function respuesta(cuerpo: unknown, estado = 200): Response {
  const aviso = avisoDelRemitente()
  const conAviso = aviso && cuerpo && typeof cuerpo === 'object'
    ? { ...(cuerpo as Record<string, unknown>), aviso }
    : cuerpo
  return new Response(JSON.stringify(conAviso), { status: estado, headers: cabeceras })
}

/**
 * Solo la junta manda correos. Se comprueba contra Supabase con el token de
 * quien llama: sin esto, cualquiera con la clave pública podría usar esta
 * función para mandar correo en nombre de la hermandad, que es exactamente lo
 * que se quería evitar sacando la clave del navegador.
 */
async function quienLlama(req: Request): Promise<{ ok: boolean; motivo?: string; auth?: string }> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return { ok: false, motivo: 'Hace falta iniciar sesión.' }
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON_KEY },
  })
  if (!r.ok) return { ok: false, motivo: 'La sesión no es válida.' }
  const usuario = await r.json()
  // Los hermanos tienen `tipo: 'hermano'` en su metadata: pueden entrar en su
  // área, pero no mandar correo a nadie.
  if (usuario?.user_metadata?.tipo === 'hermano') {
    return { ok: false, motivo: 'Tu cuenta no puede enviar correos.' }
  }
  return { ok: true, auth }
}

/**
 * Con qué nombre y a dónde se responde, según la hermandad de quien escribe.
 *
 * EL NOMBRE SE LEE AQUÍ, EN EL SERVIDOR, Y NO SE ACEPTA DEL NAVEGADOR. Si
 * viniera de fuera, cualquiera con una sesión podría mandar correos firmados
 * como «Banco Santander» desde un dominio verificado, que es justo lo que hace
 * falta para un fraude creíble.
 *
 * Se consulta con el token de quien llama, así que las políticas de Supabase
 * hacen el resto: solo puede salir la ficha de SU hermandad.
 */
async function comoFirmaSuHermandad(auth: string): Promise<{ nombre: string; responderA: string }> {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/hermandad_settings?select=nombre_legal,email`,
      { headers: { Authorization: auth, apikey: ANON_KEY } },
    )
    if (!r.ok) return { nombre: '', responderA: '' }
    const filas = await r.json()
    const fila = Array.isArray(filas) ? filas[0] : null
    return {
      nombre: (fila?.nombre_legal ?? '').trim(),
      responderA: (fila?.email ?? '').trim(),
    }
  } catch {
    return { nombre: '', responderA: '' }
  }
}

/**
 * El remitente tal como lo verá el hermano en su bandeja.
 *
 *     Hdad. de la Amargura <no-responder@gobergo.es>
 *
 * La dirección es siempre la misma —la del dominio verificado— y lo que cambia
 * es el nombre. Que cada hermandad mandara desde su propio dominio obligaría a
 * verificar uno por cada una, con sus registros DNS, y eso convierte el alta de
 * una hermandad en una gestión técnica de días. Así funciona desde el primer
 * momento y el hermano ve el nombre de SU hermandad, que es lo que mira.
 *
 * Las comillas del nombre se quitan porque romperían la cabecera del correo.
 */
function firmarComo(nombreHermandad: string): string {
  const direccion = soloLaDireccion(REMITENTE)
  const limpio = nombreHermandad.replace(/[<>"\r\n]/g, '').trim()
  return limpio ? `${limpio} <${direccion}>` : REMITENTE
}

/*
 * ---------------------------------------------------------------------------
 *   EL CORREO DE CONFIRMAR UNA SUSCRIPCIÓN — el único que sale sin sesión
 * ---------------------------------------------------------------------------
 *
 * POR QUÉ HACE FALTA. La lista de «avisadme de los cultos» es de doble
 * confirmación: hasta que la persona no abre el enlace que se le manda, no se
 * le escribe. Ese correo NO LO PODÍA MANDAR NADIE. Quien se apunta desde la web
 * no tiene sesión, y todo lo demás de esta función la exige — así que el
 * formulario decía «te hemos mandado un correo» y no salía ninguno. Nadie
 * confirmaba jamás, la lista se llenaba de gente a la que no se podía escribir
 * y los comunicados a suscriptores llegaban a cero personas.
 *
 * POR QUÉ NO ABRE UN BOQUETE. Esta rama no acepta ni destinatario, ni asunto,
 * ni cuerpo: se los pone ella. Lo único que llega de fuera es a qué hermandad y
 * qué correo, y el correo tiene que estar YA APUNTADO y sin confirmar para que
 * salga algo. Y la llave —lo único con lo que se puede confirmar o dar de
 * baja— se lee AQUÍ, con la clave de servicio, y no pasa nunca por el
 * navegador de quien pide el envío.
 *
 * El freno de verdad está en la base: `llave_para_confirmar` no devuelve nada
 * dos veces en diez minutos para el mismo correo. Así, pedir mil envíos con la
 * dirección de otra persona no le llena la bandeja.
 */

const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/**
 * A dónde apunta el enlace de confirmar.
 *
 * NO SE ACEPTA DEL NAVEGADOR TAL CUAL. Si viniera de fuera sin mirarlo,
 * cualquiera podría hacer que la hermandad mandara, con su nombre y desde su
 * dominio verificado, un correo con un enlace a otro sitio. Eso es exactamente
 * la materia prima de una suplantación.
 *
 * Se admite lo que diga el navegador solo si es el sitio de siempre o un
 * subdominio suyo; si no, se usa el de siempre y punto.
 */
const WEB_BASE = (Deno.env.get('GOBERGO_WEB') ?? 'https://gobergo.com').replace(/\/+$/, '')

function origenDeConfianza(propuesto: string | undefined): string {
  if (!propuesto) return WEB_BASE
  try {
    const suyo = new URL(propuesto)
    const base = new URL(WEB_BASE)
    if (suyo.protocol !== 'https:') return WEB_BASE
    if (suyo.hostname === base.hostname || suyo.hostname.endsWith(`.${base.hostname}`)) {
      return suyo.origin
    }
  } catch { /* una dirección que no se puede leer se trata como si no viniera */ }
  return WEB_BASE
}

/** Para meter texto de la base dentro del HTML sin que se lo coma el marcado. */
function escapar(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function mandarConfirmacion(
  datos: { hermandadId?: string; email?: string; origen?: string },
): Promise<Response> {
  if (!SERVICE_KEY) {
    // Se dice, y no se calla: sin este secreto la confirmación no sale y la
    // lista se queda igual de muerta que antes, pero al menos se sabe por qué.
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY: no se puede mandar la confirmación.')
    return respuesta({ error: 'El servidor no está configurado para confirmar suscripciones.' }, 503)
  }
  const email = (datos.email ?? '').trim()
  if (!datos.hermandadId || !correoValido(email)) {
    return respuesta({ error: 'Faltan datos para mandar la confirmación.' }, 400)
  }

  // La llave y el nombre de la hermandad, con la clave de servicio. Devuelve
  // null si ese correo no está apuntado, si ya está confirmado o si se le mandó
  // hace menos de diez minutos.
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/llave_para_confirmar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_hermandad_id: datos.hermandadId, p_email: email }),
  })
  if (!r.ok) {
    console.error('llave_para_confirmar falló:', r.status, await r.text())
    return respuesta({ error: 'No se ha podido preparar la confirmación.' }, 502)
  }
  const fila = await r.json()
  /*
   * SIN LLAVE SE CONTESTA QUE SÍ, y no «ese correo ya estaba» ni «ese correo no
   * está». Distinguirlo desde fuera sería una forma de preguntar quién está en
   * la lista de la hermandad, que es justo lo que no puede saberse.
   */
  if (!fila?.llave) return respuesta({ enviados: 0 })

  const base = origenDeConfianza(datos.origen)
  const enlace = `${base}/avisos?c=${encodeURIComponent(String(fila.llave))}`
  const hermandad = String(fila.hermandad ?? '').trim()
  const dequien = hermandad || 'la hermandad'
  const asunto = `Confirma tu correo para recibir los avisos de ${dequien}`
  const texto = [
    `Alguien —esperamos que tú— ha pedido recibir los avisos de cultos de ${dequien} en esta dirección.`,
    '',
    'Para empezar a recibirlos, abre este enlace:',
    enlace,
    '',
    'Si no has sido tú, no hagas nada: sin abrir el enlace no te escribimos.',
  ].join('\n')
  const html = `<p>Alguien —esperamos que tú— ha pedido recibir los avisos de cultos de
    <b>${escapar(dequien)}</b> en esta dirección.</p>
    <p><a href="${escapar(enlace)}">Confirmar mi correo</a></p>
    <p style="color:#666">Si no has sido tú, no hagas nada: sin abrir el enlace no te escribimos.</p>`

  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    // Aquí SÍ va en `to` y no en copia oculta: es un correo para una persona.
    body: JSON.stringify({ from: firmarComo(hermandad), to: [email], subject: asunto, text: texto, html }),
  })
  if (!envio.ok) {
    console.error('Resend devolvió un error al confirmar:', envio.status, await envio.text())
    return respuesta({ error: 'No se ha podido mandar el correo de confirmación.' }, 502)
  }
  return respuesta({ enviados: 1 })
}

/*
 * ---------------------------------------------------------------------------
 *   EL RESGUARDO DE UNA RESERVA DE LA TIENDA
 * ---------------------------------------------------------------------------
 *
 * Quien aparta algo en la tienda de la web no tiene cuenta: lo único que se
 * lleva es la referencia que sale en pantalla, y si cierra la pestaña sin
 * apuntarla se planta en la casa de hermandad sin saber qué dijo.
 *
 * Se manda desde aquí y no desde el navegador por lo mismo que la confirmación
 * de la lista de avisos: si el destinatario viniera de fuera, esto sería una
 * forma de mandarle a cualquiera un correo con el membrete de la hermandad. El
 * navegador solo dice QUÉ RESERVA; el correo lo lee `resguardo_de_reserva` con
 * la clave de servicio, y esa función solo contesta si está pendiente, se creó
 * hace menos de media hora y no se había mandado ya.
 */
async function mandarResguardoDeReserva(
  datos: { hermandadId?: string; referencia?: string },
): Promise<Response> {
  if (!SERVICE_KEY) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY: no se puede mandar el resguardo.')
    return respuesta({ error: 'El servidor no está configurado para mandar resguardos.' }, 503)
  }
  if (!datos.hermandadId || !(datos.referencia ?? '').trim()) {
    return respuesta({ error: 'Faltan datos para mandar el resguardo.' }, 400)
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resguardo_de_reserva`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_hermandad_id: datos.hermandadId, p_referencia: datos.referencia }),
  })
  if (!r.ok) {
    console.error('resguardo_de_reserva falló:', r.status, await r.text())
    return respuesta({ error: 'No se ha podido preparar el resguardo.' }, 502)
  }
  const res = await r.json()
  // Igual que con la confirmación: sin fila se contesta que sí y ya está.
  // Decir «esa reserva no existe» sería una forma de ir probando referencias.
  if (!res?.email) return respuesta({ enviados: 0 })

  const hermandad = String(res.hermandad ?? '').trim()
  const dequien = hermandad || 'la hermandad'
  const euros = (n: unknown) => `${Number(n ?? 0).toFixed(2).replace('.', ',')} €`
  const lineas = (Array.isArray(res.lineas) ? res.lineas : []) as
    { nombre?: string; cantidad?: number; importe?: number }[]
  const nombre = String(res.nombre ?? '').trim()
  const saluda = nombre ? `Hola, ${nombre.split(' ')[0]}:` : 'Hola:'
  const plazo = res.recoger_antes_de
    ? `Puedes pasar a recogerlo hasta el ${String(res.recoger_antes_de)}.`
    : 'Pásate cuando puedas por la casa de hermandad.'

  const asunto = `Tu reserva ${res.referencia} en ${dequien}`
  const texto = [
    saluda,
    '',
    `Te hemos apartado esto en ${dequien}:`,
    ...lineas.map((l) => `  · ${l.cantidad} × ${l.nombre} — ${euros(l.importe)}`),
    '',
    `Total a pagar al recogerlo: ${euros(res.total)}`,
    `Referencia: ${res.referencia}`,
    '',
    'No has pagado nada por internet: se paga al recogerlo en la casa de hermandad.',
    plazo,
  ].join('\n')
  const html = `<p>${escapar(saluda)}</p>
    <p>Te hemos apartado esto en <b>${escapar(dequien)}</b>:</p>
    <ul>${lineas.map((l) =>
      `<li>${Number(l.cantidad ?? 0)} × ${escapar(String(l.nombre ?? ''))} — ${euros(l.importe)}</li>`).join('')}</ul>
    <p><b>Total a pagar al recogerlo: ${euros(res.total)}</b><br>
    Referencia: <b>${escapar(String(res.referencia))}</b></p>
    <p>No has pagado nada por internet: se paga al recogerlo en la casa de hermandad.<br>
    ${escapar(plazo)}</p>`

  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: firmarComo(hermandad), to: [String(res.email)], subject: asunto, text: texto, html,
    }),
  })
  if (!envio.ok) {
    console.error('Resend devolvió un error al mandar el resguardo:', envio.status, await envio.text())
    return respuesta({ error: 'No se ha podido mandar el resguardo.' }, 502)
  }
  return respuesta({ enviados: 1 })
}

/*
 * ---------------------------------------------------------------------------
 *   «TU RESERVA ESTÁ LISTA»
 * ---------------------------------------------------------------------------
 *
 * Lo dispara una persona desde el panel cuando lo que alguien apartó ya se
 * puede recoger. Va DESPUÉS de comprobar quién llama, al revés que el
 * resguardo: aquel lo pide la web pública, sin sesión de nadie; este lo pide la
 * casa de hermandad, que sí la tiene.
 *
 * Los cierres de verdad están en la base (`datos_para_avisar_reserva`): solo
 * contesta si alguien ha marcado la reserva como lista, y solo una vez al día.
 */
async function mandarAvisoDeReservaLista(
  datos: { hermandadId?: string; referencia?: string },
): Promise<Response> {
  if (!SERVICE_KEY) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY: no se puede avisar de la reserva.')
    return respuesta({ error: 'El servidor no está configurado para mandar avisos.' }, 503)
  }
  if (!datos.hermandadId || !(datos.referencia ?? '').trim()) {
    return respuesta({ error: 'Faltan datos para mandar el aviso.' }, 400)
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/datos_para_avisar_reserva`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_hermandad_id: datos.hermandadId, p_referencia: datos.referencia }),
  })
  if (!r.ok) {
    console.error('datos_para_avisar_reserva falló:', r.status, await r.text())
    return respuesta({ error: 'No se ha podido preparar el aviso.' }, 502)
  }
  const res = await r.json()
  /*
   * Sin fila —o sin correo— se contesta que no se ha mandado nada, y ya está.
   * No es un error: es «esa persona no dejó dirección», o «ya se le avisó hoy»,
   * y las dos son respuestas buenas. El panel lo dice en pantalla.
   */
  if (!res?.email) return respuesta({ enviados: 0 })

  const hermandad = String(res.hermandad ?? '').trim()
  const dequien = hermandad || 'la hermandad'
  const euros = (n: unknown) => `${Number(n ?? 0).toFixed(2).replace('.', ',')} €`
  const lineas = (Array.isArray(res.lineas) ? res.lineas : []) as
    { nombre?: string; cantidad?: number; importe?: number }[]
  const nombre = String(res.nombre ?? '').trim()
  const saluda = nombre ? `Hola, ${nombre.split(' ')[0]}:` : 'Hola:'
  const plazo = res.recoger_antes_de
    ? `Te lo guardamos hasta el ${String(res.recoger_antes_de)}.`
    : 'Pásate cuando puedas por la casa de hermandad.'

  const asunto = `Ya puedes recoger tu reserva ${res.referencia}`
  const texto = [
    saluda,
    '',
    `Ya está listo lo que apartaste en ${dequien}:`,
    ...lineas.map((l) => `  · ${l.cantidad} × ${l.nombre} — ${euros(l.importe)}`),
    '',
    `Se paga al recogerlo: ${euros(res.total)}`,
    `Referencia: ${res.referencia}`,
    '',
    plazo,
  ].join('\n')
  const html = `<p>${escapar(saluda)}</p>
    <p>Ya está listo lo que apartaste en <b>${escapar(dequien)}</b>:</p>
    <ul>${lineas.map((l) =>
      `<li>${Number(l.cantidad ?? 0)} × ${escapar(String(l.nombre ?? ''))} — ${euros(l.importe)}</li>`).join('')}</ul>
    <p><b>Se paga al recogerlo: ${euros(res.total)}</b><br>
    Referencia: <b>${escapar(String(res.referencia))}</b></p>
    <p>${escapar(plazo)}</p>`

  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: firmarComo(hermandad), to: [String(res.email)], subject: asunto, text: texto, html,
    }),
  })
  if (!envio.ok) {
    console.error('Resend devolvió un error al avisar de la reserva:', envio.status, await envio.text())
    return respuesta({ error: 'No se ha podido mandar el aviso.' }, 502)
  }
  return respuesta({ enviados: 1 })
}

/*
 * ---------------------------------------------------------------------------
 *   «HE OLVIDADO MI CONTRASEÑA» — la recuperación del hermano
 * ---------------------------------------------------------------------------
 *
 * POR QUÉ NO LA HACE SUPABASE. La hacía: `resetPasswordForEmail` mandaba el
 * correo a la dirección de la cuenta. Pero desde que la cuenta de un hermano se
 * llama por dentro «DNI + hermandad» —para que quien es hermano de dos
 * hermandades pueda entrar en las dos—, esa dirección NO RECIBE NADA. El correo
 * de esa persona está en su ficha, que es otra cosa.
 *
 * Así que el enlace lo mandamos nosotros, al correo de su ficha. Y de paso deja
 * de salir por el servidor de Supabase para salir por el de la hermandad, que
 * es donde debería haber estado siempre.
 *
 * QUÉ NO PASA POR EL NAVEGADOR: ni el token ni el correo. El navegador solo
 * dice «este DNI de esta hermandad quiere recuperar»; lo demás se lee aquí con
 * la clave de servicio. Es lo mismo que se hace con el correo de confirmar una
 * suscripción, y por el mismo motivo.
 */

/** Lo que se contesta SIEMPRE, salga correo o no. Ver abajo. */
const RESPUESTA_DE_SIEMPRE = { enviados: 1 }

async function pedirRecuperacion(
  datos: { hermandadId?: string; dni?: string; origen?: string },
): Promise<Response> {
  if (!SERVICE_KEY) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY: no se puede recuperar ninguna contraseña.')
    return respuesta({ error: 'El servidor no está configurado para recuperar contraseñas.' }, 503)
  }
  if (!datos.hermandadId || !(datos.dni ?? '').trim()) {
    return respuesta({ error: 'Faltan datos.' }, 400)
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pedir_recuperacion_hermano`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_hermandad_id: datos.hermandadId, p_dni: datos.dni }),
  })
  if (!r.ok) {
    console.error('pedir_recuperacion_hermano falló:', r.status, await r.text())
    return respuesta({ error: 'No se ha podido preparar la recuperación.' }, 502)
  }
  const fila = await r.json()
  /*
   * SIN TOKEN SE CONTESTA QUE SÍ, Y ESTO NO ES UN DESCUIDO.
   *
   * Si aquí se dijera «ese DNI no está», cualquiera podría ir probando
   * documentos para averiguar quién es hermano de qué hermandad. Y eso revela
   * convicciones religiosas, que es categoría especial del RGPD: una pantalla
   * de contraseña olvidada no puede ser una forma de comprobar la fe de nadie.
   *
   * La pantalla ya dice «si ese DNI está en el censo, te hemos mandado…», que
   * es verdad de las dos maneras.
   */
  if (!fila?.token) return respuesta(RESPUESTA_DE_SIEMPRE)

  const base = origenDeConfianza(datos.origen)
  const enlace = `${base}/hermano?recuperar=${encodeURIComponent(String(fila.token))}`
  const nombre = String(fila.nombre ?? '').trim().split(' ')[0]
  const asunto = 'Para poner una contraseña nueva'
  const texto = [
    `${nombre ? `Hola, ${nombre}.` : 'Hola.'}`,
    '',
    'Has pedido cambiar la contraseña de tu área de hermano. Abre este enlace:',
    enlace,
    '',
    'Vale durante dos horas y una sola vez.',
    'Si no has sido tú, no hagas nada: tu contraseña sigue siendo la de siempre.',
  ].join('\n')
  const html = `<p>${nombre ? `Hola, ${escapar(nombre)}.` : 'Hola.'}</p>
    <p>Has pedido cambiar la contraseña de tu área de hermano.</p>
    <p><a href="${escapar(enlace)}">Poner una contraseña nueva</a></p>
    <p style="color:#666">Vale durante dos horas y una sola vez. Si no has sido tú, no hagas
    nada: tu contraseña sigue siendo la de siempre.</p>`

  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: firmarComo(''), to: [String(fila.email)], subject: asunto, text: texto, html,
    }),
  })
  if (!envio.ok) {
    console.error('Resend devolvió un error al recuperar:', envio.status, await envio.text())
    return respuesta({ error: 'No se ha podido mandar el correo.' }, 502)
  }
  return respuesta(RESPUESTA_DE_SIEMPRE)
}

/**
 * Y el segundo paso: llega con el token del enlace y la contraseña nueva.
 *
 * La contraseña se cambia con la clave de servicio porque no se puede hacer de
 * otra manera: ni desde SQL ni desde el navegador. El token se canjea primero
 * —de un solo uso y con caducidad— y solo si vale se toca la cuenta.
 */
async function canjearRecuperacion(datos: { token?: string; clave?: string }): Promise<Response> {
  if (!SERVICE_KEY) return respuesta({ error: 'El servidor no está configurado.' }, 503)
  const clave = String(datos.clave ?? '')
  if (!datos.token || clave.length < 6) {
    return respuesta({ error: 'La contraseña tiene que tener al menos 6 caracteres.' }, 400)
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/canjear_recuperacion_hermano`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token: datos.token }),
  })
  if (!r.ok) {
    console.error('canjear_recuperacion_hermano falló:', r.status, await r.text())
    return respuesta({ error: 'No se ha podido cambiar la contraseña.' }, 502)
  }
  const uid = await r.json()
  if (!uid) {
    // Se dice qué pasa, porque aquí SÍ se puede: quien llega con un enlace ya
    // no tiene nada que averiguar, y lo que necesita es saber que pida otro.
    return respuesta({ error: 'Ese enlace ya no vale. Pide uno nuevo desde «¿Has olvidado tu contraseña?».' }, 400)
  }

  const cambio = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: clave }),
  })
  if (!cambio.ok) {
    console.error('No se ha podido cambiar la contraseña:', cambio.status, await cambio.text())
    return respuesta({ error: 'No se ha podido cambiar la contraseña.' }, 502)
  }
  return respuesta({ ok: true })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras })
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405)

  if (!RESEND_API_KEY) {
    return respuesta(
      { error: 'Falta la clave del proveedor de correo. Configúrala con: supabase secrets set RESEND_API_KEY=…' },
      503,
    )
  }

  /*
   * LA CONFIRMACIÓN DE UNA SUSCRIPCIÓN VA ANTES DEL CONTROL DE SESIÓN, y es la
   * única que va antes. Quien se apunta desde la web pública no tiene sesión ni
   * la va a tener: es un vecino del barrio, no un hermano. Exigirle una es lo
   * que hacía que ese correo no se mandara nunca.
   *
   * No abre nada: esta rama se pone ella el destinatario, el asunto y el
   * cuerpo, y solo manda algo si ese correo YA ESTÁ apuntado y sin confirmar.
   * Ver `mandarConfirmacion` arriba.
   */
  let cuerpoCrudo: Record<string, unknown>
  try {
    cuerpoCrudo = await req.json()
  } catch {
    return respuesta({ error: 'El cuerpo de la petición no es JSON.' }, 400)
  }
  /*
   * EL DIAGNÓSTICO, que es lo que convierte «no me llegan los mails» en una
   * respuesta de diez segundos.
   *
   * Va antes del control de sesión por lo mismo que las otras dos ramas
   * públicas: si lo que está roto es la propia configuración, exigir una
   * sesión para poder mirarla es cerrar la puerta justo cuando hace falta
   * abrirla. Y NO REVELA NINGÚN SECRETO: solo dice si cada uno está puesto o
   * no, y qué dominio se usa de remitente —que es público, va en cada correo
   * que sale—. Con esto no se puede mandar nada ni entrar en ningún sitio.
   */
  if (cuerpoCrudo.diagnostico === true) {
    const remitente = soloLaDireccion(REMITENTE)
    return respuesta({
      diagnostico: {
        claveDeResend: Boolean(RESEND_API_KEY),
        remitentePropio: !conElRemitenteDePrueba(),
        // El dominio, no la dirección entera: basta para saber si es el suyo.
        dominioRemitente: remitente.split('@')[1] ?? '(sin dirección)',
        claveDeServicio: Boolean(SERVICE_KEY),
        urlDeSupabase: Boolean(SUPABASE_URL),
        // Lo que hace falta para que salga UN correo cualquiera.
        listoParaEnviar: Boolean(RESEND_API_KEY) && !conElRemitenteDePrueba(),
        // Y lo que hace falta además para recuperar contraseñas y mandar
        // resguardos, que leen datos con la clave de servicio.
        listoParaContrasenas: Boolean(RESEND_API_KEY) && Boolean(SERVICE_KEY) && Boolean(SUPABASE_URL),
      },
    })
  }

  const suscripcion = cuerpoCrudo.suscripcion as
    { hermandadId?: string; email?: string; origen?: string } | undefined
  if (suscripcion) return await mandarConfirmacion(suscripcion)

  /*
   * Y EL RESGUARDO DE UNA RESERVA DE LA TIENDA, por lo mismo: quien aparta
   * algo desde la web no tiene sesión ni la va a tener. Tampoco abre nada — se
   * pone ella el destinatario, que lo lee de la propia reserva. Ver
   * `mandarResguardoDeReserva` arriba.
   */
  const reserva = cuerpoCrudo.reserva as { hermandadId?: string; referencia?: string } | undefined
  if (reserva) return await mandarResguardoDeReserva(reserva)

  /*
   * Y LA RECUPERACIÓN DE CONTRASEÑA DEL HERMANO, por lo mismo: quien la pide es
   * justamente quien no puede iniciar sesión. Tampoco abre nada — se pone ella
   * el destinatario (el correo de la ficha, que lee aquí) y el texto.
   */
  const recuperar = cuerpoCrudo.recuperar as
    { hermandadId?: string; dni?: string; origen?: string; token?: string; clave?: string } | undefined
  if (recuperar?.token) return await canjearRecuperacion(recuperar)
  if (recuperar) return await pedirRecuperacion(recuperar)

  const permiso = await quienLlama(req)
  if (!permiso.ok) return respuesta({ error: permiso.motivo }, 401)

  /*
   * «Tu reserva está lista» va AQUÍ, detrás de la comprobación, y no arriba con
   * el resguardo: aquel lo pide la web pública sin sesión de nadie, y este lo
   * dispara una persona de la casa de hermandad, que sí la tiene.
   */
  const listaAviso = cuerpoCrudo.reservaLista as { hermandadId?: string; referencia?: string } | undefined
  if (listaAviso) return await mandarAvisoDeReservaLista(listaAviso)

  // Con qué nombre firma esta hermandad, y a dónde van las respuestas.
  const firma = await comoFirmaSuHermandad(permiso.auth ?? '')
  const remitente = firmarComo(firma.nombre)

  // Ya está leído arriba: el cuerpo de una petición solo se puede leer una vez.
  const cuerpo = cuerpoCrudo as
    { para?: string[]; asunto?: string; texto?: string; html?: string; responderA?: string }

  const para = (cuerpo.para ?? []).map((d) => d.trim()).filter((d) => correoValido(d))
  if (para.length === 0) return respuesta({ error: 'No hay ninguna dirección válida a la que enviar.' }, 400)
  if (para.length > MAXIMO_DESTINATARIOS) {
    return respuesta({ error: `Como mucho ${MAXIMO_DESTINATARIOS} direcciones por envío.` }, 400)
  }
  if (!cuerpo.asunto?.trim()) return respuesta({ error: 'Falta el asunto.' }, 400)
  if (!cuerpo.texto?.trim() && !cuerpo.html?.trim()) return respuesta({ error: 'El correo está vacío.' }, 400)

  const responderA = replyToValido(cuerpo.responderA, firma.responderA)
  const responderAPuesto = (cuerpo.responderA ?? firma.responderA ?? '').trim()
  if (responderAPuesto && !responderA) {
    // Se apunta, porque si no el arreglo tapa el problema: las respuestas de
    // los hermanos dejan de llegar a la secretaría y nadie lo sabe. Sale en
    // Supabase → Edge Functions → enviar-correo → Invocations.
    console.error(
      'El «responder a» no tiene forma de dirección de correo y se ha ido sin él:',
      JSON.stringify(responderAPuesto),
      '· Arréglalo en Configuración → Correo, o en el correo de la ficha de la hermandad.',
    )
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: remitente,
      // Cada hermano en copia OCULTA: mandar el comunicado con las mil
      // direcciones a la vista es filtrar el censo entero, y en una hermandad
      // eso son datos de categoría especial.
      to: [soloLaDireccion(REMITENTE)],
      bcc: para,
      subject: cuerpo.asunto,
      ...(cuerpo.html ? { html: cuerpo.html } : {}),
      ...(cuerpo.texto ? { text: cuerpo.texto } : {}),
      // A dónde contesta el hermano si le da a «responder». Primero lo que la
      // hermandad haya puesto en Configuración → Correo; si no, el correo de su
      // ficha. Sin esto, las respuestas se perderían en un buzón que no lee
      // nadie, y el hermano creería que ha contestado a su secretaría.
      //
      // Va comprobado: si no tiene forma de dirección, Resend rechaza el envío
      // ENTERO con un 422 y no sale ni un correo. Ver `replyToValido`.
      ...(responderA ? { reply_to: responderA } : {}),
    }),
  })

  if (!r.ok) {
    const detalle = await r.text()
    console.error('Resend devolvió un error:', r.status, detalle)
    // El mensaje del proveedor se devuelve tal cual: casi siempre dice
    // exactamente qué falta (dominio sin verificar, remitente no permitido).
    return respuesta({ error: `El proveedor de correo ha rechazado el envío: ${detalle}` }, 502)
  }

  const datos = await r.json()
  return respuesta({ ok: true, id: datos.id, enviados: para.length })
})
