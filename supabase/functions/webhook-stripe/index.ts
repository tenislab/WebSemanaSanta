/**
 * EL AVISO DE STRIPE: que el cobro se sepa cuando el dinero entra, no antes.
 *
 * Hoy la suscripción se activa cuando el navegador VUELVE de Stripe a
 * `/app?suscripcion=ok`. Eso no es lo mismo que haber cobrado: si alguien
 * cierra la pestaña a mitad, si la tarjeta se rechaza después de esa
 * pantalla, o si alguien pega esa URL sin haber pagado nada, la cuenta se
 * activaba igual. Esta función es la llamada que Stripe hace DIRECTAMENTE al
 * servidor cuando el cobro se confirma de verdad, y es la que tiene que
 * activar la suscripción — no la vuelta del navegador.
 *
 * NO LA LLAMA UN USUARIO. La llama Stripe, sin ningún token de Supabase, así
 * que no puede pedir el inicio de sesión que llevan las demás funciones: en
 * su lugar comprueba la firma `Stripe-Signature`, que demuestra que el aviso
 * viene de verdad de Stripe y no de cualquiera que adivine esta URL.
 *
 * PARA DESPLEGARLA (sin verificación de sesión: Stripe no manda ninguna):
 *
 *   supabase functions deploy webhook-stripe --no-verify-jwt
 *   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
 *
 * Y EN EL PANEL DE STRIPE: Developers → Webhooks → Add endpoint, con la URL
 * que da `supabase functions deploy` y estos dos eventos:
 *
 *   checkout.session.completed   → activa la suscripción
 *   customer.subscription.deleted → la desactiva
 */

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/** Cinco minutos: lo que Stripe recomienda para no aceptar un aviso reenviado días después. */
const TOLERANCIA_SEGUNDOS = 5 * 60

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Hexadecimal en minúsculas, como lo escribe Stripe en `v1=`. */
function aHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Compara dos cadenas SIN delatar por cuánto tiempo tarda en qué carácter
 * difieren. Con `===` a secas, alguien podría ir adivinando la firma byte a
 * byte midiendo microsegundos — improbable, pero es gratis evitarlo.
 */
function igualesSinFiltrar(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let distinto = 0
  for (let i = 0; i < a.length; i++) distinto |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return distinto === 0
}

/**
 * ¿Viene de verdad de Stripe?
 *
 * La cabecera trae `t=<segundos>,v1=<firma>[,v0=...]`. La firma es un
 * HMAC-SHA256 de `${t}.${cuerpoSinTocar}` con el secreto del webhook —el
 * cuerpo TAL CUAL llegó, antes de convertirlo a JSON, porque `JSON.stringify`
 * de lo que `JSON.parse` ya ha leído no reproduce necesariamente los mismos
 * bytes (espacios, orden de claves) y la firma dejaría de cuadrar.
 */
async function firmaValida(cuerpoCrudo: string, cabecera: string | null): Promise<boolean> {
  if (!cabecera || !STRIPE_WEBHOOK_SECRET) return false
  const partes = Object.fromEntries(
    cabecera.split(',').map((p) => p.split('=')).filter((p) => p.length === 2),
  ) as Record<string, string>
  const t = partes.t
  const v1 = partes.v1
  if (!t || !v1) return false

  const antiguedad = Math.abs(Date.now() / 1000 - Number(t))
  if (!Number.isFinite(antiguedad) || antiguedad > TOLERANCIA_SEGUNDOS) return false

  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(`${t}.${cuerpoCrudo}`))
  return igualesSinFiltrar(aHex(firma), v1)
}

/** Llama a una función de la base con la clave de servicio: la única que puede tocar `suscripciones`. */
async function llamarRpc(nombre: string, argumentos: Record<string, unknown>): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(argumentos),
  })
  if (!r.ok) {
    console.error(`${nombre} falló:`, r.status, await r.text())
  }
  return r.ok
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido.' }, 405)

  if (!STRIPE_WEBHOOK_SECRET || !SERVICE_KEY) {
    console.error('Falta STRIPE_WEBHOOK_SECRET o SUPABASE_SERVICE_ROLE_KEY: el webhook no puede activar nada.')
    return respuesta({ error: 'El servidor no está configurado para recibir avisos de Stripe.' }, 503)
  }

  // El cuerpo se lee UNA SOLA VEZ y como texto: la firma se calcula sobre esos
  // bytes exactos, y solo después se interpreta como JSON.
  const cuerpoCrudo = await req.text()
  if (!(await firmaValida(cuerpoCrudo, req.headers.get('Stripe-Signature')))) {
    // Sin detalle en la respuesta: decir POR QUÉ está mal la firma es
    // exactamente la pista que ayuda a falsificar la siguiente.
    return respuesta({ error: 'Firma no válida.' }, 400)
  }

  let evento: { type?: string; data?: { object?: Record<string, unknown> } }
  try {
    evento = JSON.parse(cuerpoCrudo)
  } catch {
    return respuesta({ error: 'Cuerpo mal formado.' }, 400)
  }

  const objeto = evento.data?.object ?? {}

  /*
   * PAGAR NO ES LO MISMO QUE TERMINAR EL FORMULARIO.
   *
   * `checkout.session.completed` significa «el cliente ha terminado», no «el
   * dinero está». Con tarjeta las dos cosas pasan a la vez, pero con los
   * métodos de notificación diferida —SEPA y Bizum, justo los que una
   * hermandad va a querer— Stripe manda este aviso con `payment_status:
   * 'unpaid'` y el cobro tarda días en confirmarse. O en fallar.
   *
   * Sin mirar esto, una hermandad quedaba con la suscripción activada por
   * haber rellenado el formulario, y si el adeudo se devolvía no había nada
   * que la desactivara: `async_payment_failed` no llega a
   * `customer.subscription.deleted`.
   *
   * Aquí NO se fijan los métodos de pago (`crear-suscripcion` no manda
   * `payment_method_types`), así que los que haya encendidos en el panel de
   * Stripe entran solos. Por eso esto no puede depender de la configuración.
   *
   * `no_payment_required` cuenta como bueno: es lo que devuelve una prueba
   * gratuita o un cupón del 100%.
   */
  const YA_COBRADO = new Set(['paid', 'no_payment_required'])

  // `async_payment_succeeded` es el mismo caso visto días después: el adeudo
  // SEPA ha entrado de verdad. Se trata igual que el completado.
  if (
    evento.type === 'checkout.session.completed'
    || evento.type === 'checkout.session.async_payment_succeeded'
  ) {
    const estadoPago = objeto.payment_status as string | undefined
    if (!YA_COBRADO.has(estadoPago ?? '')) {
      /*
       * Todavía no hay dinero. Se reconoce con 200 y no se activa nada: si el
       * cobro llega, Stripe manda `async_payment_succeeded` y se entra por
       * aquí otra vez; si no llega, no se ha regalado nada.
       */
      console.log('checkout sin cobrar todavía (%s), no se activa:', estadoPago, objeto.id)
      return respuesta({ recibido: true })
    }
    /*
     * `crear-suscripcion` puso `client_reference_id` y `metadata.usuario` al
     * abrir la sesión de pago (ver ese archivo): son el mismo id, por si
     * algún día Stripe deja de mandar uno de los dos.
     */
    const metadata = (objeto.metadata as Record<string, string> | undefined) ?? {}
    const usuario = (objeto.client_reference_id as string | undefined) || metadata.usuario
    const clienteStripe = (objeto.customer as string | undefined) ?? null
    const suscripcionStripe = (objeto.subscription as string | undefined) ?? null

    if (!usuario) {
      console.error('checkout.session.completed sin client_reference_id ni metadata.usuario:', objeto.id)
      // 200 y no 400: Stripe reintentaría un aviso que nunca vamos a poder
      // resolver, y lo que hace falta es verlo en los registros, no un
      // reintento eterno.
      return respuesta({ recibido: true })
    }

    const ok = await llamarRpc('activar_suscripcion_por_usuario', {
      p_usuario: usuario,
      p_pack: metadata.pack || 'todo',
      p_periodo: metadata.periodo || 'mensual',
      p_stripe_customer: clienteStripe,
      p_stripe_subscription: suscripcionStripe,
    })
    if (!ok) return respuesta({ error: 'No se ha podido activar la suscripción.' }, 502)
  } else if (evento.type === 'customer.subscription.deleted') {
    const suscripcionStripe = objeto.id as string | undefined
    if (suscripcionStripe) {
      const ok = await llamarRpc('cancelar_suscripcion_por_stripe', { p_stripe_subscription: suscripcionStripe })
      if (!ok) return respuesta({ error: 'No se ha podido desactivar la suscripción.' }, 502)
    }
  }
  // Cualquier otro tipo de evento (pago rechazado, factura, lo que sea): se
  // reconoce con 200 sin hacer nada. Devolver un error por un evento que no
  // se maneja haría que Stripe lo reintentara para siempre.

  return respuesta({ recibido: true })
})
