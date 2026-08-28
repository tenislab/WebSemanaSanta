/**
 * C4 · QUE EL HERMANO PAGUE SU CUOTA O SU PAPELETA CON TARJETA.
 *
 * Hasta ahora solo podía pagar por domiciliación, por transferencia o
 * pasándose por la casa de hermandad — y las dos últimas acaban en el mismo
 * sitio: un «ya te he hecho el Bizum» por WhatsApp y alguien cotejando el
 * extracto a mano.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL DINERO NO PASA POR GOBERGO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El cobro se crea contra la CUENTA CONECTADA de la hermandad, así que entra
 * en su saldo y se paga a su IBAN. Gobergo no lo toca ni se queda comisión.
 * Es lo que ya prometía `lib/pagoSuscripcion.ts`: lo que los hermanos le pagan
 * a su hermandad va directo a la hermandad.
 *
 * Y la comisión de Stripe la asume la hermandad, que es lo normal: sumársela
 * al hermano significa que un recibo de 30 € se cobra por 30,87 €, y eso es lo
 * primero que se reclama en secretaría.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE DA POR PAGADO ES EL WEBHOOK, NO LA VUELTA DEL NAVEGADOR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Stripe devuelve al hermano a `/hermano?pago=hecho`. Esa dirección NO se cree
 * a efectos de dinero —se puede escribir a mano— y solo sirve para decirle
 * «gracias, en un momento verás tu recibo actualizado». Quien marca la cuota
 * es `cobrar_pago_tarjeta`, desde el webhook y con la clave de servicio.
 *
 * Es la misma lección que costó `webhook-stripe.sql` con las suscripciones.
 */
import { supabase, isSupabaseConfigured } from './supabase'

export type QueSePaga = 'cuota' | 'papeleta'

export type ResultadoPago =
  | { ok: true; url: string }
  | { ok: false; error: string }

/**
 * ¿Está el pago con tarjeta disponible en esta hermandad?
 *
 * Hace falta base de datos y que la hermandad haya enlazado su cuenta. Se
 * comprueba lo segundo AQUÍ y no solo en el servidor para no enseñarle al
 * hermano un botón que va a fallar: un botón de pagar que da error se lee como
 * «no puedo pagar», y a partir de ahí ya no lo intenta por ninguna vía.
 */
export function pagoConTarjetaDisponible(cuentaStripe: string | undefined | null): boolean {
  return isSupabaseConfigured && (cuentaStripe ?? '').trim() !== ''
}

/**
 * Abre la pasarela. Devuelve la dirección a la que mandar el navegador.
 *
 * NO SE MANDA EL IMPORTE. Lo lee el servidor de la propia cuota: si viniera de
 * aquí, cualquiera pagaría su recibo de 60 € por un céntimo cambiando un
 * número en la petición.
 */
export async function pagarConTarjeta(tipo: QueSePaga, referencia: string): Promise<ResultadoPago> {
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente) {
    return { ok: false, error: 'El pago con tarjeta necesita conexión con la base de datos.' }
  }
  try {
    const { data, error } = await cliente.functions.invoke('crear-pago', {
      body: {
        tipo,
        referencia,
        // De dónde ha salido, para volver aquí después de pagar.
        origen: typeof window === 'undefined' ? undefined : window.location.origin,
      },
    })
    if (error) {
      /*
       * El mensaje del servidor se enseña tal cual cuando lo hay: dice cosas
       * que hacen falta —«tu hermandad no ha enlazado su cuenta», «ese recibo
       * ya está cobrado»— y traducirlo a un «no se ha podido» genérico dejaría
       * al hermano sin saber si el problema es suyo o de la hermandad.
       */
      const detalle = (data as { error?: string } | null)?.error
      return { ok: false, error: detalle || 'No se ha podido abrir la pasarela de pago.' }
    }
    const url = (data as { url?: string } | null)?.url
    if (!url) return { ok: false, error: 'La pasarela no ha devuelto ninguna dirección.' }
    return { ok: true, url }
  } catch {
    return { ok: false, error: 'No se ha podido conectar con la pasarela de pago.' }
  }
}

/**
 * ¿Vuelve de pagar? Lo dice el parámetro que pone Stripe al devolverlo.
 *
 * Sirve SOLO para el mensaje de la pantalla. Que ponga `pago=hecho` no
 * significa que el dinero esté: eso lo dice el webhook, y por eso el mensaje
 * habla de «en un momento» y no da nada por cobrado.
 */
export function comoVuelveDePagar(busqueda: string): 'hecho' | 'cancelado' | null {
  const p = new URLSearchParams(busqueda).get('pago')
  return p === 'hecho' || p === 'cancelado' ? p : null
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE EL HERMANO YA HA INTENTADO PAGAR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Entre que Stripe cobra y el webhook marca el recibo pasan segundos, y a veces
 * minutos. En ese hueco el hermano vuelve a su área, ve su cuota todavía en
 * «Pendiente» y hace lo que haría cualquiera: pagarla otra vez.
 *
 * Por eso se leen sus intentos. La tabla los guarda todos —también los que se
 * quedaron a medias— y su política de acceso está escrita justo para esto: el
 * hermano ve LOS SUYOS, y nada más.
 */
export type EstadoIntento = 'abierto' | 'pagado' | 'fallido' | 'caducado'

export interface IntentoDePago {
  id: string
  tipo: QueSePaga
  /** El recibo que se estaba pagando: la cuota o la papeleta. */
  referenciaId: string
  importeCent: number
  estado: EstadoIntento
  /** Cuándo se abrió, tal como lo guarda la base. */
  creadoEn: string
}

/**
 * Los intentos de pago del hermano que ha iniciado sesión.
 *
 * DEVUELVE `null` CUANDO NO SE SABE, y `[]` solo cuando de verdad no hay
 * ninguno. No es una distinción de adorno: si un fallo de red o un permiso
 * denegado se contestara con la lista vacía, la pantalla diría «no tienes
 * ningún pago en marcha» justo cuando lo que pasa es que no hemos podido
 * mirarlo — y el hermano pagaría dos veces. Misma regla que `historialDeStock`.
 */
export async function misPagosConTarjeta(): Promise<IntentoDePago[] | null> {
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente) return []
  const { data, error } = await cliente
    .from('pagos_tarjeta')
    .select('id, tipo, referencia_id, importe_cent, estado, creado_en')
    .order('creado_en', { ascending: false })
    .limit(50)
  if (error) return null
  return (data ?? []).map((f) => ({
    id: String(f.id),
    tipo: f.tipo as QueSePaga,
    referenciaId: String(f.referencia_id),
    importeCent: Number(f.importe_cent) || 0,
    estado: f.estado as EstadoIntento,
    creadoEn: String(f.creado_en ?? ''),
  }))
}

/**
 * Cuánto tiempo se considera «en marcha» un intento abierto.
 *
 * Una sesión de pago de Stripe caduca a las 24 horas, pero un intento de hace
 * cinco horas no es alguien pagando: es alguien que cerró la pestaña. Avisar de
 * eso como si el dinero estuviera en camino asustaría más que ayudar, así que
 * media hora, que es de sobra para teclear una tarjeta.
 */
const MINUTOS_EN_MARCHA = 30

/**
 * ¿Hay un pago de este recibo a medio hacer? Devuelve el intento, para poder
 * decir de cuándo es.
 *
 * Con `intentos` a `null` —no se ha podido mirar— devuelve `null` también: lo
 * que no se sabe no se afirma.
 */
export function pagoEnMarcha(
  intentos: IntentoDePago[] | null,
  tipo: QueSePaga,
  referenciaId: string,
  ahora: Date = new Date(),
): IntentoDePago | null {
  if (!intentos) return null
  return intentos.find((i) => {
    if (i.tipo !== tipo || i.referenciaId !== referenciaId || i.estado !== 'abierto') return false
    const abiertoEn = Date.parse(i.creadoEn)
    // Una fecha que no se entiende NO se da por vieja: se prefiere avisar de
    // más antes que dejar que alguien pague dos veces.
    if (!Number.isFinite(abiertoEn)) return true
    return ahora.getTime() - abiertoEn < MINUTOS_EN_MARCHA * 60 * 1000
  }) ?? null
}
