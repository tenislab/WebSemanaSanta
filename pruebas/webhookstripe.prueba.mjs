/**
 * EL WEBHOOK DE STRIPE, LEÍDO COMO TEXTO.
 *
 * Igual que `enviar-correo` y `crear-suscripcion`: es una función de Deno, no
 * de Node, así que no se puede importar y ejecutar aquí dentro (`Deno.serve`
 * no existe en este runtime). Lo que sí se puede comprobar sin levantar nada
 * es que el código dice lo que tiene que decir — y es donde ya se coló un
 * fallo real en `enviar-correo`: las cabeceras CORS a medias, que no revienta
 * al escribirlas, solo deja de funcionar en el navegador de alguien.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const fuente = await readFile('supabase/functions/webhook-stripe/index.ts', 'utf8')

  /*
   * 1. NO SE FÍA DE UNA SESIÓN. Las demás funciones (`crear-suscripcion`,
   * `enviar-correo`) miran quién llama con `Authorization: Bearer`. Esta NO
   * puede: Stripe no manda ningún token de Supabase, así que exigirlo dejaría
   * la función sin poder recibir un solo aviso de verdad.
   */
  caso('no lee el token de quien llama, como hacen las demás', false,
    /req\.headers\.get\('Authorization'\)/.test(fuente))
  caso('en su lugar comprueba la firma de Stripe', true, /Stripe-Signature/.test(fuente))

  // 2. LA FIRMA: HMAC-SHA256 de «timestamp.cuerpo», con el secreto del webhook.
  caso('usa HMAC-SHA256', true, /HMAC.*SHA-256/.test(fuente))
  caso('firma sobre el cuerpo SIN TOCAR, no sobre el JSON ya interpretado', true,
    /`\$\{t\}\.\$\{cuerpoCrudo\}`/.test(fuente))
  caso('el cuerpo se lee como texto antes que como JSON', true,
    /const cuerpoCrudo = await req\.text\(\)/.test(fuente)
    && fuente.indexOf('req.text()') < fuente.indexOf('JSON.parse(cuerpoCrudo)'))
  // La comparación no puede ser un `===` a secas: se quiere una que no
  // delate por dónde difieren dos cadenas mirando cuánto tarda.
  caso('compara la firma sin filtrar por tiempo', true, /function igualesSinFiltrar/.test(fuente))
  caso('y la usa de verdad, no la deja escrita y sin llamar', true,
    /return igualesSinFiltrar\(aHex\(firma\), v1\)/.test(fuente))
  // Y rechaza un aviso viejo, para que un aviso capturado no sirva reenviado
  // días después.
  caso('rechaza un aviso demasiado antiguo', true, /TOLERANCIA_SEGUNDOS/.test(fuente))
  caso('la respuesta a una firma mala no explica por qué', true,
    /Firma no válida/.test(fuente) && !/console\.error\(.*[Ff]irma/.test(fuente))

  /*
   * 3. LOS DOS EVENTOS QUE ACTIVAN Y DESACTIVAN, con las funciones que ya
   * tiene permiso de llamar `service_role` (ver `supabase/webhook-stripe.sql`).
   */
  caso('activa con checkout.session.completed', true, /checkout\.session\.completed/.test(fuente))
  caso('llamando a activar_suscripcion_por_usuario', true, /llamarRpc\('activar_suscripcion_por_usuario'/.test(fuente))
  // Los tres datos que hacen falta para saber A QUIÉN se le activa y CON QUÉ referencia de Stripe.
  for (const campo of ['p_usuario', 'p_stripe_customer', 'p_stripe_subscription']) {
    caso(`manda ${campo} al activar`, true, new RegExp(campo).test(fuente))
  }
  // El id de quien pagó sale de donde lo puso `crear-suscripcion`: el mismo
  // dato por dos caminos, por si Stripe deja de mandar uno de los dos.
  caso('el usuario sale de client_reference_id o de metadata.usuario', true,
    /client_reference_id[\s\S]{0,40}metadata\.usuario/.test(fuente))

  /*
   * 3 bis. TERMINAR EL FORMULARIO NO ES HABER PAGADO.
   *
   * `checkout.session.completed` significa «el cliente ha terminado». Con
   * tarjeta eso y el cobro son lo mismo, pero con los métodos de notificación
   * diferida —SEPA y Bizum, justo los que una hermandad va a querer— Stripe
   * manda ese aviso con `payment_status: 'unpaid'` y el dinero tarda días en
   * confirmarse, o no llega.
   *
   * Y aquí NO se fijan los métodos de pago: `crear-suscripcion` no manda
   * `payment_method_types`, así que entra lo que esté encendido en el panel de
   * Stripe. O sea que esto no puede depender de la configuración.
   *
   * Sin la comprobación, la hermandad quedaba activada por rellenar el
   * formulario, y si el adeudo se devolvía no había nada que la desactivara:
   * un pago diferido que falla no llega a `customer.subscription.deleted`.
   */
  caso('no activa sin que el pago esté cobrado', true, /payment_status/.test(fuente))
  caso('y «pagado» incluye la prueba gratuita', true,
    /'paid'[\s\S]{0,30}'no_payment_required'/.test(fuente))
  // Y el cobro que llega días después entra por el mismo sitio.
  caso('atiende el cobro diferido cuando por fin entra', true,
    /checkout\.session\.async_payment_succeeded/.test(fuente))
  // Sin cobrar se contesta 200 y no se activa: un error haría que Stripe lo
  // reintentara para siempre.
  caso('sin cobrar se reconoce pero no se activa', true,
    /no se activa[\s\S]{0,120}recibido: true/.test(fuente))

  caso('desactiva con customer.subscription.deleted', true, /customer\.subscription\.deleted/.test(fuente))
  caso('llamando a cancelar_suscripcion_por_stripe', true, /llamarRpc\('cancelar_suscripcion_por_stripe'/.test(fuente))

  // 4. Un evento sin usuario identificable, o de un tipo que no se maneja: se
  // acepta con 200 y no se calla el porqué. Devolver un error aquí haría que
  // Stripe reintentara para siempre un aviso que nunca se va a poder resolver.
  caso('un evento sin usuario no revienta, se apunta y se acepta', true,
    /console\.error\('checkout\.session\.completed sin/.test(fuente) && /return respuesta\(\{ recibido: true \}\)/.test(fuente))

  // 5. Sin los dos secretos que hacen falta, lo dice y no intenta nada a medias.
  caso('sin STRIPE_WEBHOOK_SECRET o la clave de servicio, no sigue', true,
    /if \(!STRIPE_WEBHOOK_SECRET \|\| !SERVICE_KEY\)/.test(fuente))

  // 6. La clave de servicio nunca sale de esta función ni se manda al navegador.
  caso('la clave de servicio solo se usa para llamar a la propia base', true,
    (fuente.match(/SERVICE_KEY/g) ?? []).length >= 3)
  caso('no hay ninguna cabecera CORS abierta a cualquiera (no la necesita: la llama Stripe, no un navegador)',
    false, /Access-Control-Allow-Origin/.test(fuente))

  // 7. Y que quede escrito cómo se despliega sin verificación de sesión: es
  // justo lo que costó una tarde entera en `enviar-correo` (ver
  // correo.prueba.mjs) cuando el interruptor equivocado dejaba la función
  // inalcanzable sin que el error dijera por qué.
  caso('el desplegado documenta --no-verify-jwt', true, /--no-verify-jwt/.test(fuente))
  caso('y documenta STRIPE_WEBHOOK_SECRET', true, /supabase secrets set STRIPE_WEBHOOK_SECRET/.test(fuente))
}
