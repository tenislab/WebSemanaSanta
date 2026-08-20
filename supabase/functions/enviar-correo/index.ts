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
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

/** Cuántas direcciones como mucho de una vez. Resend admite 50 por llamada. */
const MAXIMO_DESTINATARIOS = 50

const cabeceras = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
}

function respuesta(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras })
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras })
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405)

  if (!RESEND_API_KEY) {
    return respuesta(
      { error: 'Falta la clave del proveedor de correo. Configúrala con: supabase secrets set RESEND_API_KEY=…' },
      503,
    )
  }

  const permiso = await quienLlama(req)
  if (!permiso.ok) return respuesta({ error: permiso.motivo }, 401)

  // Con qué nombre firma esta hermandad, y a dónde van las respuestas.
  const firma = await comoFirmaSuHermandad(permiso.auth ?? '')
  const remitente = firmarComo(firma.nombre)

  let cuerpo: { para?: string[]; asunto?: string; texto?: string; html?: string; responderA?: string }
  try {
    cuerpo = await req.json()
  } catch {
    return respuesta({ error: 'El cuerpo de la petición no es JSON.' }, 400)
  }

  const para = (cuerpo.para ?? []).map((d) => d.trim()).filter((d) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d))
  if (para.length === 0) return respuesta({ error: 'No hay ninguna dirección válida a la que enviar.' }, 400)
  if (para.length > MAXIMO_DESTINATARIOS) {
    return respuesta({ error: `Como mucho ${MAXIMO_DESTINATARIOS} direcciones por envío.` }, 400)
  }
  if (!cuerpo.asunto?.trim()) return respuesta({ error: 'Falta el asunto.' }, 400)
  if (!cuerpo.texto?.trim() && !cuerpo.html?.trim()) return respuesta({ error: 'El correo está vacío.' }, 400)

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
      ...((cuerpo.responderA ?? firma.responderA)
        ? { reply_to: cuerpo.responderA || firma.responderA }
        : {}),
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
