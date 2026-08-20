/**
 * El cobro de la suscripción a Gobergo. Esto es lo que la hermandad le paga a
 * Gobergo, y NO tiene nada que ver con lo que los hermanos le pagan a su
 * hermandad (cuotas y papeletas): ese dinero no pasa por aquí en ningún
 * momento, va directo a la cuenta de la hermandad. Ver `requisitos.ts`.
 *
 * Va por Stripe Checkout: se pide al servidor que abra una sesión de pago y se
 * manda al navegador a la página de Stripe. La tarjeta NO la ve esta
 * aplicación en ningún momento, que es justo el motivo de hacerlo así: sin
 * tocar un número de tarjeta, el cumplimiento de PCI se queda en el mínimo.
 *
 * MIENTRAS NO ESTÉ CONECTADO, todo esto se queda quieto y la pantalla de
 * suscripción sigue activando la cuenta sin cobrar, como hasta ahora, para
 * poder probar la aplicación entera. `stripeConfigurado()` es el interruptor:
 * en cuanto haya claves, el botón lleva a Stripe.
 *
 * PARA CONECTARLO (ver LANZAMIENTO.md):
 *   1. En Stripe, crea un producto por pack y dos precios (mensual y anual).
 *   2. Pon los identificadores de precio en las variables de entorno de abajo.
 *   3. Despliega la función `crear-suscripcion` con la clave secreta de Stripe.
 */
import { supabase, isSupabaseConfigured } from './supabase'
import type { PackId, Periodo } from './suscripcion'

/**
 * Los identificadores de precio de Stripe, uno por pack y periodo. Van en
 * variables de entorno y no en el código porque son distintos en la cuenta de
 * pruebas y en la de verdad, y no se puede depender de acordarse de cambiarlos
 * al desplegar.
 *
 * NO son secretos: un identificador de precio es público, se ve en cualquier
 * página de pago. El secreto es la clave con la que el servidor habla con
 * Stripe, y esa vive en la función del servidor, nunca aquí.
 */
const PRECIOS: Record<string, string | undefined> = {
  'gestion:mensual': import.meta.env.VITE_STRIPE_PRECIO_GESTION_MES,
  'gestion:anual': import.meta.env.VITE_STRIPE_PRECIO_GESTION_ANIO,
  'web:mensual': import.meta.env.VITE_STRIPE_PRECIO_WEB_MES,
  'web:anual': import.meta.env.VITE_STRIPE_PRECIO_WEB_ANIO,
  'completo:mensual': import.meta.env.VITE_STRIPE_PRECIO_COMPLETO_MES,
  'completo:anual': import.meta.env.VITE_STRIPE_PRECIO_COMPLETO_ANIO,
  'todo:mensual': import.meta.env.VITE_STRIPE_PRECIO_TODO_MES,
  'todo:anual': import.meta.env.VITE_STRIPE_PRECIO_TODO_ANIO,
}

export function precioDe(pack: PackId, periodo: Periodo): string | undefined {
  return PRECIOS[`${pack}:${periodo}`]?.trim() || undefined
}

/**
 * ¿Está el cobro conectado? Hace falta base de datos (la sesión de pago la
 * abre una función del servidor) y al menos un precio configurado.
 *
 * Se comprueba que haya precios y no solo una clave: con la clave puesta pero
 * sin precios, el botón llevaría a un error de Stripe en vez de a una página
 * de pago, que es peor que no tenerlo.
 */
export function stripeConfigurado(): boolean {
  if (!isSupabaseConfigured) return false
  return Object.values(PRECIOS).some((p) => (p ?? '').trim() !== '')
}

export interface ResultadoCheckout {
  ok: boolean
  /** A dónde mandar al navegador para pagar. */
  url?: string
  error?: string
}

/**
 * Abre una sesión de pago y devuelve a dónde hay que mandar al navegador.
 *
 * No redirige por su cuenta a propósito: quien llama decide cuándo, y así
 * también se puede probar sin que la página se vaya a ninguna parte.
 */
export async function iniciarSuscripcion(pack: PackId, periodo: Periodo): Promise<ResultadoCheckout> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Sin base de datos conectada no se puede cobrar.' }
  }
  const precio = precioDe(pack, periodo)
  if (!precio) {
    return { ok: false, error: `No hay precio configurado para el pack ${pack} ${periodo}.` }
  }
  try {
    const { data, error } = await supabase.functions.invoke('crear-suscripcion', {
      body: {
        precio,
        pack,
        periodo,
        // A dónde vuelve el navegador después de pagar (o de arrepentirse).
        volverBien: `${window.location.origin}/app?suscripcion=ok`,
        volverMal: `${window.location.origin}/app?suscripcion=cancelada`,
      },
    })
    if (error) return { ok: false, error: error.message }
    const url = (data as { url?: string } | null)?.url
    if (!url) return { ok: false, error: 'El servidor no ha devuelto una página de pago.' }
    return { ok: true, url }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo abrir la página de pago.' }
  }
}
