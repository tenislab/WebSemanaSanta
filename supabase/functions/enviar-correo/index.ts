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
 *   supabase secrets set CORREO_REMITENTE="Hdad. de X <avisos@tudominio.es>"
 *   supabase functions deploy enviar-correo
 *
 * PARA PROBAR SIN DOMINIO PROPIO: Resend deja usar `onboarding@resend.dev`
 * como remitente, pero SOLO puede enviar a la dirección con la que te
 * registraste. Sirve para comprobar que todo el circuito funciona; para
 * escribir a los hermanos hace falta verificar el dominio de la hermandad.
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const REMITENTE = Deno.env.get('CORREO_REMITENTE') ?? 'onboarding@resend.dev'
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
async function quienLlama(req: Request): Promise<{ ok: boolean; motivo?: string }> {
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
  return { ok: true }
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
      from: REMITENTE,
      // Cada hermano en copia OCULTA: mandar el comunicado con las mil
      // direcciones a la vista es filtrar el censo entero, y en una hermandad
      // eso son datos de categoría especial.
      to: [REMITENTE],
      bcc: para,
      subject: cuerpo.asunto,
      ...(cuerpo.html ? { html: cuerpo.html } : {}),
      ...(cuerpo.texto ? { text: cuerpo.texto } : {}),
      ...(cuerpo.responderA ? { reply_to: cuerpo.responderA } : {}),
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
