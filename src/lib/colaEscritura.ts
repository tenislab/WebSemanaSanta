/**
 * LO QUE SE ESCRIBIÓ SIN COBERTURA, GUARDADO PARA MANDARLO DESPUÉS.
 *
 * ============================================================================
 * EL CASO, QUE ES UNO CONCRETO Y NO UNA PRECAUCIÓN GENERAL
 * ============================================================================
 *
 * La madrugada del Viernes Santo. El diputado de tramo pasa lista en la calle,
 * con el móvil, entre dos mil personas y sin cobertura. Marca quién ha llegado,
 * entrega papeletas y cobra en mano a quien viene sin pagar. Tres horas de
 * trabajo que NO SE PUEDEN REHACER: al día siguiente nadie sabe quién estaba.
 *
 * Y hasta ahora se perdía, por los dos caminos que tiene la aplicación para
 * escribir, los dos de la misma forma:
 *
 *   · `plantillasHermandad.guardarPlantilla` —la hoja de asistencia entera—
 *     hacía `catch { return false }`, y quien la llama usa `void`: el valor
 *     devuelto se tiraba. Nadie se enteraba de nada.
 *   · `supabaseSync.sincronizar` —las papeletas y el apunte de Tesorería—
 *     avisaba por pantalla, que es mejor, pero no reintentaba. Y al recargar,
 *     la lectura de la base pisaba el espejo del navegador con lo que la base
 *     tenía: la noche entera, borrada por su propia copia de seguridad.
 *
 * ============================================================================
 * LAS DOS CLASES DE ESCRITURA, Y POR QUÉ SE GUARDAN DISTINTO
 * ============================================================================
 *
 * NO es una distinción de adorno: cambia qué se puede tirar de la cola.
 *
 *   · UN BLOQUE (`asistencia`, `modelo_papeleta`, `campana`…) es un `upsert` de
 *     un JSON entero. Manda el último y los anteriores no aportan nada, así que
 *     de cada clave se guarda UNO SOLO. Trescientos hermanos marcados son
 *     trescientas escrituras y una sola entrada en la cola, que es justo lo que
 *     hace falta cuando el sitio donde se guarda son cinco megas.
 *   · UNA FILA (`papeletas`, `movimientos`) es crear, guardar o borrar una fila
 *     concreta. Aquí el orden IMPORTA y no se puede resumir: crear y luego
 *     borrar no es lo mismo que borrar y luego crear. Van en fila india.
 *
 * ============================================================================
 * LO QUE SE REINTENTA Y LO QUE NO
 * ============================================================================
 *
 * Es la decisión delicada de todo esto. Una cola que reintenta cualquier fallo
 * se convierte en un bucle: un rechazo de permisos (RLS) o una columna que no
 * existe van a fallar igual las mil veces siguientes, y mientras tanto tapan
 * las escrituras que sí habrían entrado y llenan `localStorage`.
 *
 *   · SE ENCOLA solo el fallo de RED: no hay conexión, o la hubo y se cortó.
 *   · NO SE ENCOLA el rechazo de la base. Eso es un error de verdad y ya tiene
 *     su aviso traducido en pantalla.
 *   · Y si algo encolado vuelve con un rechazo de la base al reintentarlo, SE
 *     TIRA con aviso, no se queda dando vueltas para siempre.
 */

export type OperacionDeFila = 'crear' | 'guardar' | 'borrar'

interface Comun {
  /** Identificador de la entrada de la cola (no de la fila). */
  id: string
  /** Cuándo se intentó por primera vez, en ISO. Es lo que se le enseña a la persona. */
  cuando: string
  intentos: number
  /**
   * DE QUÉ HERMANDAD ES ESTO, y no es un extra: sin ello la cola es peligrosa.
   *
   * La cola sobrevive al cierre de sesión a propósito —si no, cerrar sesión se
   * llevaría la madrugada del Viernes Santo por el otro camino, que es
   * exactamente el fallo que esto viene a arreglar—. Pero en el ordenador de la
   * casa de hermandad entra gente distinta, y en Gobergo una cuenta puede
   * llevar dos hermandades: soltar la cola bajo la sesión equivocada sería
   * escribir los datos de una en la otra.
   *
   * Así que cada entrada lleva su hermandad y solo se manda cuando esa es la de
   * la sesión abierta. Lo demás se queda esperando, sin tocarse.
   *
   * `null` es «no se sabía» —no había sesión al apuntarlo— y esas no se mandan
   * nunca solas: se quedan hasta que alguien las mire.
   */
  hermandadId: string | null
}

export interface EscrituraDeFila extends Comun {
  clase: 'fila'
  tabla: string
  op: OperacionDeFila
  filaId: string
  /** La fila tal cual va a la base, ya pasada por `toRow`. Vacía en un borrado. */
  fila: Record<string, unknown>
}

export interface EscrituraDeBloque extends Comun {
  clase: 'bloque'
  /** La columna de `hermandad_settings`: `asistencia`, `campana`… */
  cual: string
  valor: unknown
}

export type Pendiente = EscrituraDeFila | EscrituraDeBloque
/** Una entrada recién nacida: la cola le pone el id, la fecha y los intentos. */
export type Nueva =
  | Omit<EscrituraDeFila, 'id' | 'cuando' | 'intentos' | 'hermandadId'>
  | Omit<EscrituraDeBloque, 'id' | 'cuando' | 'intentos' | 'hermandadId'>

export const CLAVE_COLA = 'cabildo-cola-escritura'

/*
 * La clave donde `multiHermandad` deja qué hermandad tiene espejada este
 * navegador. Se lee de ahí, sin `await`: ver `encolar`.
 */
import { CLAVE_ESPEJO } from './multiHermandad'

/**
 * EL TOPE, Y POR QUÉ HAY QUE PONERLO.
 *
 * La cola vive en `localStorage`, que son unos cinco megas para TODO —el espejo
 * del censo incluido— y es el techo que ya obligó a inventar la ventana de
 * histórico (`ventanaHistorico.ts`). Una cola sin tope, con una tarde sin red,
 * llena el sitio y entonces no se puede guardar ni la cola ni el espejo: se
 * pierde más de lo que se estaba salvando.
 *
 * Doscientas entradas de fila son de sobra para el caso real —una noche de
 * pase de lista son unas pocas docenas de papeletas— y al pasarse se tira LO
 * MÁS ANTIGUO, avisando. Lo más antiguo y no lo más nuevo: lo que se acaba de
 * marcar es lo que quien está delante cree haber guardado.
 */
export const TOPE_DE_FILAS = 200

/**
 * Añade a la cola. Función pura: recibe la cola y devuelve otra.
 *
 * Los bloques se sustituyen por su clave —de `asistencia` solo tiene sentido el
 * último— y las filas se ponen al final, en fila india.
 */
export function anadir(
  cola: Pendiente[],
  nuevas: Nueva[],
  ahora: Date,
  nuevoId: () => string,
  hermandadId: string | null = null,
): { cola: Pendiente[]; tiradas: Pendiente[] } {
  let salida = [...cola]
  const sello = { id: '', cuando: ahora.toISOString(), intentos: 0, hermandadId }
  for (const nueva of nuevas) {
    if (nueva.clase === 'bloque') {
      /*
       * Lo que hubiera de esta clave sobra: manda el último. PERO solo de la
       * MISMA hermandad: la hoja de asistencia de una no sustituye a la de la
       * otra, y en el ordenador de la casa de hermandad eso pasa.
       */
      salida = salida.filter((p) => !(
        p.clase === 'bloque' && p.cual === nueva.cual && p.hermandadId === hermandadId
      ))
      salida.push({ ...nueva, ...sello, id: nuevoId() })
      continue
    }
    salida.push({ ...nueva, ...sello, id: nuevoId() })
  }
  const filas = salida.filter((p): p is EscrituraDeFila => p.clase === 'fila')
  const tiradas: Pendiente[] = []
  if (filas.length > TOPE_DE_FILAS) {
    const sobran = new Set(filas.slice(0, filas.length - TOPE_DE_FILAS).map((f) => f.id))
    tiradas.push(...salida.filter((p) => sobran.has(p.id)))
    salida = salida.filter((p) => !sobran.has(p.id))
  }
  return { cola: salida, tiradas }
}

/**
 * ¿ESTO ES FALTA DE RED O ES QUE LA BASE HA DICHO NO?
 *
 * De esta pregunta depende todo lo demás, y no hay una forma limpia de
 * responderla: `fetch` no da un código, da un `TypeError` cuyo texto pone cada
 * navegador como quiere. Son estos, medidos:
 *
 *   · Chrome y Firefox → «Failed to fetch» / «NetworkError when attempting…»
 *   · Safari (el del móvil del diputado) → «Load failed». Sí: dos palabras.
 *   · supabase-js, cuando lo envuelve → «TypeError: Failed to fetch»
 *
 * Se mira también `navigator.onLine`, pero NO se decide con él: dice que hay
 * red cuando el móvil está enganchado a un wifi sin salida, que es la mitad de
 * los casos de una casa de hermandad. Sirve para sumar, no para descartar.
 */
export function esFalloDeRed(motivo: string): boolean {
  const t = motivo.toLowerCase()
  return t.includes('failed to fetch')
    || t.includes('load failed')
    || t.includes('networkerror')
    || t.includes('network request failed')
    || t.includes('err_internet_disconnected')
    || t.includes('err_network')
    || t.includes('fetch failed')
    || t.includes('sin conexión')
    || t.includes('timeout')
    || t.includes('etimedout')
    || t.includes('econnrefused')
    || t.includes('enotfound')
}

/**
 * ¿Y es un rechazo que va a fallar igual la próxima vez?
 *
 * Lo que NO se reintenta: permisos, restricciones, columnas que no existen.
 * Reintentar eso es un bucle que además tapa lo que sí entraría.
 *
 * La clave duplicada es el caso curioso y hay que tratarlo aparte: significa
 * que el `crear` YA ENTRÓ —se perdió la respuesta, no la escritura— así que no
 * es un fallo, es un «ya estaba». Lo resuelve `reproducir`.
 */
export function esRechazoDefinitivo(motivo: string, code?: string): boolean {
  if (esFalloDeRed(motivo)) return false
  if (code && /^(42|23|22|PGRST)/.test(code)) return true
  const t = motivo.toLowerCase()
  return t.includes('row-level security')
    || t.includes('permission denied')
    || t.includes('violates')
    || t.includes('does not exist')
    || t.includes('invalid input syntax')
}

/** Una clave duplicada quiere decir que esa fila ya está: no es un fallo. */
export function yaEstaba(motivo: string, code?: string): boolean {
  return code === '23505' || /duplicate key|already exists/i.test(motivo)
}

/**
 * Lo de ESTA hermandad, que es lo único que se puede mandar ahora.
 *
 * El resto no se pierde ni se toca: se queda en la cola hasta que se abra la
 * sesión a la que pertenece. Y lo que no lleva hermandad (`null`) tampoco se
 * manda: se apuntó sin sesión y no se sabe de quién es.
 */
export function loDeEstaHermandad(cola: Pendiente[], hermandadId: string | null): {
  mias: Pendiente[]
  deOtros: Pendiente[]
} {
  const mias: Pendiente[] = []
  const deOtros: Pendiente[] = []
  for (const p of cola) {
    if (hermandadId !== null && p.hermandadId === hermandadId) mias.push(p)
    else deOtros.push(p)
  }
  return { mias, deOtros }
}

/** Lo que pasó al intentar una escritura. `null` = ha entrado. */
export type Respuesta = { message: string; code?: string } | null

export interface Resultado {
  /** Las que han entrado (o que ya estaban). */
  hechas: Pendiente[]
  /** Las que siguen esperando red. */
  sigue: Pendiente[]
  /** Las que la base ha rechazado de verdad, con el motivo, para avisar. */
  tiradas: { entrada: Pendiente; motivo: string }[]
}

/**
 * Vuelve a intentar la cola, en orden.
 *
 * `escribir` se recibe de fuera a propósito: así esto se puede probar entero
 * con datos y sin red, que es la única forma de comprobar una cola —con red de
 * verdad no se puede provocar un corte a voluntad.
 *
 * SE PARA EN EL PRIMER FALLO DE RED y deja el resto en la cola. Seguir sería
 * mandar cien peticiones que van a fallar todas, y en un móvil sin cobertura
 * eso es batería y un minuto de espera para nada. Pero no se para en un
 * rechazo: ese se tira y se sigue con lo siguiente, que puede entrar bien.
 */
export async function reproducir(
  cola: Pendiente[],
  escribir: (entrada: Pendiente) => Promise<Respuesta>,
): Promise<Resultado> {
  const hechas: Pendiente[] = []
  const tiradas: { entrada: Pendiente; motivo: string }[] = []
  let i = 0
  for (; i < cola.length; i += 1) {
    const entrada = cola[i]!
    let respuesta: Respuesta
    try {
      respuesta = await escribir(entrada)
    } catch (err) {
      respuesta = { message: String(err) }
    }
    if (respuesta === null || yaEstaba(respuesta.message, respuesta.code)) {
      hechas.push(entrada)
      continue
    }
    if (esRechazoDefinitivo(respuesta.message, respuesta.code)) {
      tiradas.push({ entrada, motivo: respuesta.message })
      continue
    }
    // Sigue sin haber red: se deja esta y todo lo que venga detrás.
    break
  }
  const sigue = cola.slice(i).map((p) => ({ ...p, intentos: p.intentos + 1 }))
  return { hechas, sigue, tiradas }
}

/**
 * Qué se le dice a la persona.
 *
 * Se cuentan las ESCRITURAS, no las entradas, y por eso un bloque no dice «1
 * cambio»: la hoja de asistencia de una noche es una entrada y trescientas
 * marcas. Decir «1 cambio pendiente» cuando hay una noche entera esperando
 * sería el aviso más engañoso posible.
 */
export function resumen(cola: Pendiente[]): string {
  if (cola.length === 0) return ''
  const filas = cola.filter((p) => p.clase === 'fila').length
  const bloques = cola.filter((p): p is EscrituraDeBloque => p.clase === 'bloque')
  const partes: string[] = []
  if (filas > 0) partes.push(filas === 1 ? '1 cambio' : `${filas} cambios`)
  for (const b of bloques) partes.push(NOMBRES_DE_BLOQUE[b.cual] ?? b.cual)
  const desde = cola.map((p) => p.cuando).sort()[0]
  const hora = desde
    ? new Date(desde).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : ''
  return `${partes.join(' y ')} sin guardar en la base${hora ? `, desde las ${hora}` : ''}.`
}

/** En castellano y con el nombre que usa la hermandad, no el de la columna. */
const NOMBRES_DE_BLOQUE: Record<string, string> = {
  asistencia: 'el pase de lista del cortejo',
  modelo_papeleta: 'el modelo de papeleta',
  modelo_recibo: 'el modelo de recibo',
  ajustes_cuotas: 'los ajustes de cuotas',
  etiquetas: 'las etiquetas',
  campana: 'la campaña',
  campos_propios: 'los campos de la ficha',
}

/* ==========================================================================
 * Y AHORA LA PARTE QUE TOCA EL NAVEGADOR Y LA RED
 *
 * Todo lo de arriba es puro y se prueba con datos. Lo de aquí abajo es la capa
 * fina que lee `localStorage`, habla con Supabase y avisa a la pantalla: lo
 * mínimo, para que la lógica de verdad se pueda comprobar sin nada de eso.
 * ========================================================================== */

/** La cola guardada. Nunca lanza: sin `localStorage` es una cola vacía. */
export function leerCola(): Pendiente[] {
  try {
    const crudo = localStorage.getItem(CLAVE_COLA)
    if (!crudo) return []
    const leido = JSON.parse(crudo)
    return Array.isArray(leido) ? (leido as Pendiente[]) : []
  } catch {
    return []
  }
}

function guardarCola(cola: Pendiente[]) {
  try {
    if (cola.length === 0) localStorage.removeItem(CLAVE_COLA)
    else localStorage.setItem(CLAVE_COLA, JSON.stringify(cola))
  } catch {
    /*
     * Sin sitio. No hay nada mejor que hacer aquí: la alternativa sería borrar
     * el espejo del censo para meter la cola, y eso es cambiar una pérdida por
     * otra. El aviso de abajo sale igual, así que quien está delante sabe que
     * hay algo sin guardar aunque no se haya podido apuntar.
     */
  }
  avisarDeLaCola()
}

/** Le dice al marco de la aplicación cuántas cosas esperan. */
function avisarDeLaCola() {
  if (typeof window === 'undefined') return
  const cola = leerCola()
  window.dispatchEvent(new CustomEvent('cabildo-cola', {
    detail: { cuantas: cola.length, texto: resumen(cola) },
  }))
}

/** ¿Hay algo esperando de esta clave de bloque? Lo pregunta `traerPlantilla`. */
export function bloquePendiente(cual: string): boolean {
  return leerCola().some((p) => p.clase === 'bloque' && p.cual === cual)
}

export function hayPendientes(): boolean {
  return leerCola().length > 0
}

/**
 * Encola, si el motivo es falta de red. Devuelve si lo ha hecho.
 *
 * Quien llama no tiene que decidir nada: le pasa el motivo tal cual se lo dio
 * la base o el `catch`, y aquí se mira. Así la regla de qué se reintenta vive
 * en un sitio y no en cada sitio que escribe.
 */
export function encolarSiEsDeRed(motivo: string, nuevas: Nueva[]): boolean {
  if (!esFalloDeRed(motivo)) return false
  encolar(nuevas)
  return true
}

/**
 * Encola sin preguntar.
 *
 * La hermandad se lee de donde la dejó la sesión, SIN `await`: esto se llama
 * desde dentro de un `catch` de una escritura fallida —a veces sin red— y una
 * consulta más ahí sería otra espera que también falla. `multiHermandad` deja
 * el id en el navegador justo para poder leerlo así.
 */
export function encolar(nuevas: Nueva[]) {
  if (nuevas.length === 0) return
  let deQuien: string | null = null
  try { deQuien = localStorage.getItem(CLAVE_ESPEJO) } catch { /* sin localStorage */ }
  const { cola, tiradas } = anadir(leerCola(), nuevas, new Date(), idDeEntrada, deQuien)
  guardarCola(cola)
  if (tiradas.length > 0) {
    console.warn(
      `La cola de escritura estaba llena (${TOPE_DE_FILAS}): se han tirado `
      + `${tiradas.length} cambios, los más antiguos.`,
    )
  }
}

let contador = 0
function idDeEntrada(): string {
  contador += 1
  // No hace falta que sea universal: solo distingue entradas de esta cola.
  return `cola-${Date.now().toString(36)}-${contador}`
}

/**
 * Suelta la cola contra la base. Se llama al arrancar, al volver la conexión y
 * después de cada escritura que sí ha entrado.
 *
 * `escribir` se inyecta para poder probarlo; en la aplicación lo pone
 * `montarLaCola()`, que es lo único que conoce Supabase.
 */
export async function soltarLaCola(
  escribir: (entrada: Pendiente) => Promise<Respuesta>,
  hermandadId: string | null,
): Promise<Resultado> {
  const { mias, deOtros } = loDeEstaHermandad(leerCola(), hermandadId)
  if (mias.length === 0) return { hechas: [], sigue: [], tiradas: [] }
  const resultado = await reproducir(mias, escribir)
  // Lo de otras hermandades se vuelve a guardar tal cual: no se manda y no se
  // pierde. Delante, porque es lo más antiguo.
  guardarCola([...deOtros, ...resultado.sigue])
  if (resultado.tiradas.length > 0 && typeof window !== 'undefined') {
    /*
     * Lo rechazado NO se calla. Es lo que se marcó en la calle y la base no ha
     * querido: si nadie lo dice, la hermandad cree que está guardado porque lo
     * vio en la pantalla del móvil aquella noche.
     */
    window.dispatchEvent(new CustomEvent('cabildo-sync-error', {
      detail: {
        tabla: 'cola de escritura',
        fallos: resultado.tiradas.map(({ entrada, motivo }) => (
          entrada.clase === 'fila'
            ? `${entrada.op} en ${entrada.tabla} (${entrada.filaId}): ${motivo}`
            : `${entrada.cual}: ${motivo}`
        )),
      },
    }))
  }
  return resultado
}
