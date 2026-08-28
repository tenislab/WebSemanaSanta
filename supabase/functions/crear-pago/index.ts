/**
 * C4 · ABRE EL COBRO CON TARJETA DE UNA CUOTA O UNA PAPELETA.
 *
 * El hermano le da a «Pagar con tarjeta» en su área y esto le devuelve la
 * dirección de la pasarela. La tarjeta la teclea en Stripe, nunca aquí.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL DINERO VA A LA HERMANDAD, NO A GOBERGO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El cobro se crea CONTRA LA CUENTA CONECTADA de la hermandad
 * (`Stripe-Account`), así que el dinero entra en su saldo y se paga a su IBAN.
 * Gobergo no lo toca ni un segundo, y no se queda ninguna comisión: no se
 * manda `application_fee_amount`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOS COSAS QUE NO SE FÍAN DEL NAVEGADOR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. EL IMPORTE NO LO MANDA EL NAVEGADOR. Se lee en la base, de la cuota o de
 *    la papeleta (`abrir_pago_tarjeta`). Si viniera de fuera, cualquiera
 *    pagaría su cuota de 60 € por un céntimo cambiando un número en la
 *    petición.
 *
 * 2. DE QUIÉN ES LA CUOTA TAMPOCO. Se comprueba contra la ficha del hermano
 *    que ha iniciado sesión: sin eso, se podría abrir un pago con el
 *    identificador de la cuota de otro y dejarla pagada a su nombre.
 *
 * Y quien da por cobrado no es esto: es el webhook. Ver `pago-tarjeta.sql`.
 *
 * PARA DESPLEGARLA:
 *   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
 *   supabase functions deploy crear-pago
 */

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const cabeceras = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

function respuesta(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: cabeceras })
}

/** Quién llama. Aquí SÍ es un hermano: es él quien paga lo suyo. */
async function quienLlama(req: Request): Promise<{ id: string } | null> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: ANON_KEY },
    })
    if (!r.ok) return null
    const u = await r.json()
    return u?.id ? { id: u.id } : null
  } catch {
    return null
  }
}

async function conLaClaveDeServicio(ruta: string, cuerpo: unknown) {
  return await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras })

  if (!STRIPE_KEY || !SERVICE_KEY) {
    return respuesta({
      error: 'El pago con tarjeta no está configurado en el servidor. '
        + 'Faltan STRIPE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY.',
    }, 503)
  }

  const usuario = await quienLlama(req)
  if (!usuario) return respuesta({ error: 'Hay que haber iniciado sesión.' }, 401)

  const cuerpo = await req.json().catch(() => ({})) as {
    tipo?: string
    referencia?: string
    origen?: string
  }
  if (cuerpo.tipo !== 'cuota' && cuerpo.tipo !== 'papeleta') {
    return respuesta({ error: 'No se sabe qué se está pagando.' }, 400)
  }
  if (!cuerpo.referencia) return respuesta({ error: 'Falta qué recibo se paga.' }, 400)

  /*
   * DE QUIÉN ES ESTA CUOTA, Y A QUÉ HERMANDAD.
   *
   * Se pregunta con la clave de servicio y se comprueba contra la ficha del
   * que llama. Es lo que impide abrir un pago con el identificador del recibo
   * de otro.
   */
  const rFicha = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/hermano_propio_id`,
    { method: 'POST', headers: { Authorization: req.headers.get('Authorization') ?? '', apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: '{}' },
  )
  const hermanoId = rFicha.ok ? await rFicha.json() : null
  if (!hermanoId) {
    return respuesta({ error: 'Esta cuenta no está enlazada con ninguna ficha de hermano.' }, 403)
  }

  const rDatos = await fetch(
    `${SUPABASE_URL}/rest/v1/${cuerpo.tipo === 'cuota' ? 'cuotas' : 'papeletas'}`
    + `?id=eq.${cuerpo.referencia}&select=hermano_id,hermandad_id`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
  )
  const filas = rDatos.ok ? await rDatos.json() : []
  const fila = filas?.[0]
  if (!fila) return respuesta({ error: 'Ese recibo no existe.' }, 404)
  if (fila.hermano_id !== hermanoId) {
    // No se dice «no es tuyo» con detalle: quien lo intenta no tiene por qué
    // averiguar de quién es.
    return respuesta({ error: 'Ese recibo no es tuyo.' }, 403)
  }

  // La cuenta conectada de la hermandad. Sin ella no hay a dónde mandar el
  // dinero, y cobrarlo a la cuenta de Gobergo sería justo lo que no se hace.
  const rHermandad = await fetch(
    `${SUPABASE_URL}/rest/v1/hermandad_settings?hermandad_id=eq.${fila.hermandad_id}&select=stripe_cuenta,nombre_legal`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
  )
  const ajustes = (rHermandad.ok ? await rHermandad.json() : [])?.[0]
  const cuentaHermandad = (ajustes?.stripe_cuenta ?? '').trim()
  if (!cuentaHermandad) {
    return respuesta({
      error: 'Tu hermandad todavía no ha enlazado su cuenta de cobro, así que el pago con tarjeta '
        + 'no está disponible. Puedes pagar por los otros medios.',
    }, 503)
  }

  // Se abre el intento EN LA BASE antes que en Stripe: el importe sale de ahí.
  const rAbrir = await conLaClaveDeServicio('rpc/abrir_pago_tarjeta', {
    p_hermandad_id: fila.hermandad_id,
    p_tipo: cuerpo.tipo,
    p_referencia: cuerpo.referencia,
    p_hermano_id: hermanoId,
  })
  const intento = rAbrir.ok ? await rAbrir.json() : null
  if (!intento?.id) {
    return respuesta({ error: 'Ese recibo ya está cobrado o no se puede pagar.' }, 409)
  }

  const origen = (cuerpo.origen ?? '').replace(/\/+$/, '') || 'https://gobergo.com'
  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(intento.importe_cent),
    'line_items[0][price_data][product_data][name]':
      cuerpo.tipo === 'cuota' ? 'Cuota de hermano' : 'Papeleta de sitio',
    success_url: `${origen}/hermano?pago=hecho`,
    cancel_url: `${origen}/hermano?pago=cancelado`,
    // La marca que el webhook usa para saber qué cerrar.
    'metadata[tipo]': cuerpo.tipo,
    'metadata[pago]': String(intento.id),
  })

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // ESTO es lo que hace que el dinero sea de la hermandad y no de Gobergo.
      'Stripe-Account': cuentaHermandad,
    },
    body: params,
  })
  if (!r.ok) {
    const detalle = await r.text()
    console.error('Stripe rechazó la sesión de pago:', r.status, detalle)
    return respuesta({ error: 'La pasarela de pago ha rechazado la operación.' }, 502)
  }
  const sesion = await r.json()

  // Se ata la sesión al intento: es el hilo por el que el webhook lo encuentra.
  await conLaClaveDeServicio('rpc/fijar_sesion_pago', { p_id: intento.id, p_session: sesion.id })

  return respuesta({ url: sesion.url })
})
