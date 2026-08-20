/**
 * A4 · Deshacer lo que se acaba de borrar.
 *
 * EL PROBLEMA. Media aplicación borra con un clic y sin vuelta atrás. Una
 * noticia con su cuerpo escrito, un titular con su historia, un evento con sus
 * veinte tareas: `filter(x => x.id !== id)` y se acabó. Con datos de ejemplo da
 * igual; con una hermandad de verdad delante, eso es una tarde de trabajo que
 * desaparece porque alguien pulsó donde no era.
 *
 * QUÉ NO ES ESTO. No es una papelera con treinta días de retención: eso pide
 * una columna `borrado_en` en diecisiete tablas, tocar las políticas de RLS y
 * una pantalla nueva. Se hará, pero es de después del dominio.
 *
 * QUÉ SÍ ES. La red que hace falta hoy, que cubre el caso real: el clic sin
 * querer. Se borra, sale una barra abajo diciendo qué se ha borrado y con un
 * botón de deshacer, y durante unos segundos se puede volver atrás.
 *
 * POR QUÉ FUNCIONA CON SUPABASE. Las colecciones se guardan con
 * `useSupabaseTable`, que compara la lista de antes con la de después: lo que
 * ya no está lo borra, y lo que aparece lo inserta. Devolver el elemento a la
 * lista es, para esa comparación, un alta con su mismo identificador. La fila
 * vuelve tal cual estaba.
 *
 * LO QUE NO ENTRA AQUÍ. El borrado de un hermano por el artículo 17 del RGPD
 * (derecho de supresión) es permanente A PROPÓSITO: si se pudiera deshacer no
 * sería una supresión. Y las papeletas no se borran nunca, se anulan. Ninguna
 * de las dos cosas pasa por este módulo.
 */

/** Cuánto tiempo se puede deshacer, en segundos. */
export const SEGUNDOS_PARA_DESHACER = 12

export interface OfertaDeshacer {
  /** Un número que cambia con cada oferta, para que React sepa que es otra. */
  id: number
  /** Qué se ha borrado, en cristiano: «Noticia eliminada». */
  texto: string
  /** Devolverlo a su sitio. */
  volverAtras: () => void
}

let oferta: OfertaDeshacer | null = null
let contador = 0
let reloj: ReturnType<typeof setTimeout> | null = null
const oyentes = new Set<() => void>()

function avisar() {
  for (const oyente of oyentes) oyente()
}

function pararReloj() {
  if (reloj !== null) {
    clearTimeout(reloj)
    reloj = null
  }
}

/**
 * «Se ha borrado esto; durante unos segundos se puede recuperar.»
 *
 * Solo hay una oferta viva a la vez. Si se borran dos cosas seguidas, la
 * segunda sustituye a la primera: guardar una pila de deshaceres invitaría a
 * pulsar el botón varias veces esperando que fuera atrás sin fin, y eso no es
 * lo que hace.
 */
export function ofrecerDeshacer(texto: string, volverAtras: () => void): void {
  pararReloj()
  contador += 1
  oferta = { id: contador, texto, volverAtras }
  const mio = contador
  reloj = setTimeout(() => {
    // Solo caduca la suya: si mientras tanto ha entrado otra, esta ya no manda.
    if (oferta?.id === mio) {
      oferta = null
      avisar()
    }
  }, SEGUNDOS_PARA_DESHACER * 1000)
  avisar()
}

/** Volver atrás. La oferta se consume: no se puede deshacer dos veces. */
export function deshacer(): void {
  const actual = oferta
  if (!actual) return
  pararReloj()
  oferta = null
  avisar()
  actual.volverAtras()
}

/**
 * Retirar la oferta sin deshacer nada.
 *
 * Se llama al cambiar de pantalla: la función de volver atrás escribe en el
 * estado de la pantalla que la creó, y esa pantalla ya no está montada. Dejar
 * el botón ahí sería ofrecer algo que no va a pasar.
 */
export function descartarDeshacer(): void {
  if (!oferta) return
  pararReloj()
  oferta = null
  avisar()
}

/** Para `useSyncExternalStore`. */
export function suscribirseADeshacer(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export function ofertaActual(): OfertaDeshacer | null {
  return oferta
}

/**
 * Devolver un elemento a la posición que ocupaba.
 *
 * Ponerlo al final sería más fácil y estaría mal: en una lista ordenada a mano
 * —los titulares de la web, los apartados de una página— el orden ES el
 * contenido. Quien deshace espera que todo quede como estaba, no que además se
 * le haya movido de sitio.
 */
export function reinsertar<T>(lista: T[], elemento: T, posicion: number): T[] {
  const copia = [...lista]
  copia.splice(Math.min(Math.max(posicion, 0), copia.length), 0, elemento)
  return copia
}
