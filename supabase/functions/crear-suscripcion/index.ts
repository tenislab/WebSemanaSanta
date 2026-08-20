/**
 * Abre una sesión de pago de Stripe para la suscripción de una hermandad a
 * Cabildo.
 *
 * Va en el servidor porque la clave secreta de Stripe NO puede estar en el
 * navegador: quien la tenga puede cobrar, devolver y consultar todo lo de la
 * cuenta. Aquí vive como secreto de Supabase y no sale de esta función.
 *
 * PARA DESPLEGARLA:
 *
 *   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
 *   supabase functions deploy crear-suscripcion
 *
 * Devuelve `{ url }`: la página de Stripe a la que mandar al navegador. La
 * tarjeta la teclea la persona en Stripe, no en Cabildo.
 */

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''

const cabeceras = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

/**
 * Quién llama. Solo alguien con sesión abierta puede empezar una suscripción,
 * y nunca un hermano: la suscripción la contrata la hermandad, no sus
 * hermanos, y dejar que cualquiera abra sesiones de pago a nombre de otro es
 * pedir un disgusto.
 */
async function quienLlama(req: Request): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
    })
    if (!r.ok) return null
    const u = await r.json()
    if (u?.user_metadata?.tipo === 'hermano') return null
    return u?.id ? { id: u.id, email: u.email ?? '' } : null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras })

  if (!STRIPE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Falta la clave de Stripe (STRIPE_SECRET_KEY) en los secretos.' }),
      { status: 500, headers: cabeceras },
    )
  }

  const usuario = await quienLlama(req)
  if (!usuario) {
    return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401, headers: cabeceras })
  }

  let cuerpo: { precio?: string; pack?: string; periodo?: string; volverBien?: string; volverMal?: string }
  try {
    cuerpo = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Petición mal formada.' }), { status: 400, headers: cabeceras })
  }

  const { precio, pack, periodo, volverBien, volverMal } = cuerpo
  if (!precio || !volverBien || !volverMal) {
    return new Response(JSON.stringify({ error: 'Faltan datos para abrir el pago.' }), {
      status: 400,
      headers: cabeceras,
    })
  }

  // La API de Stripe se habla con formulario, no con JSON. Se usa `fetch` a
  // pelo en vez de su librería para no arrastrar dependencias a la función.
  const form = new URLSearchParams()
  form.set('mode', 'subscription')
  form.set('line_items[0][price]', precio)
  form.set('line_items[0][quantity]', '1')
  form.set('success_url', volverBien)
  form.set('cancel_url', volverMal)
  if (usuario.email) form.set('customer_email', usuario.email)
  // Con esto, el aviso que Stripe manda al cobrar dice de quién es el pago.
  // Sin ello no habría forma de saber qué hermandad ha pagado.
  form.set('client_reference_id', usuario.id)
  form.set('metadata[usuario]', usuario.id)
  if (pack) form.set('metadata[pack]', pack)
  if (periodo) form.set('metadata[periodo]', periodo)

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  const datos = await r.json()
  if (!r.ok) {
    return new Response(
      JSON.stringify({ error: datos?.error?.message ?? 'Stripe ha rechazado la petición.' }),
      { status: 502, headers: cabeceras },
    )
  }
  return new Response(JSON.stringify({ url: datos.url }), { headers: cabeceras })
})
