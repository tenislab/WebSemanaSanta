import { useEffect, useState } from 'react'
import { traerTodasLasFilas } from './paginado'
import { leerPersistido, useEscuchaOtrasPestanas } from './persistencia'
import { supabase, isSupabaseConfigured } from './supabase'
import { nuevoId } from './supabaseSync'
import { hermandadDestino } from './multiHermandad'
import { traducirErrorDeEscritura } from './errorDeBaseDeDatos'

/**
 * Lo que la web pública RECIBE. Hasta ahora la web solo contaba cosas; con
 * esto también escucha: quien la visita puede escribir a la hermandad, avisar
 * de un donativo o reservar participaciones de lotería sin llamar por
 * teléfono ni pasarse por la casa de hermandad en horario de secretaría.
 *
 * Todo cae en un único buzón que la hermandad ve desde el panel. Las
 * solicitudes de alta no viven aquí: esas ya tienen su circuito propio en
 * secretaría (`solicitudes.ts`), y meterlas en dos sitios sería duplicarlas.
 */
export type TipoMensajeWeb = 'contacto' | 'donativo' | 'loteria'

export interface MensajeWeb {
  id: string
  tipo: TipoMensajeWeb
  /** Fecha legible, como se guarda en el resto de la aplicación. */
  fecha: string
  nombre: string
  email: string
  telefono: string
  asunto: string
  mensaje: string
  leido: boolean
  /** Ya atendido: se contestó, se cobró el donativo, se apartó la lotería. */
  atendido: boolean
  /** Donativo: cuánto dice que ha dado (o va a dar). */
  importe?: number
  /** Donativo o lotería: por qué vía. */
  metodo?: 'Bizum' | 'Transferencia' | 'En la casa de hermandad'
  /** Lotería: cuántas participaciones reserva. */
  participaciones?: number
  /** Donativo: a qué lo destina, de las causas que publique la hermandad. */
  causa?: string
}

export const CLAVE_MENSAJES_WEB = 'cabildo-mensajes-web'

export const TIPOS_MENSAJE: Record<TipoMensajeWeb, { nombre: string; icono: string }> = {
  contacto: { nombre: 'Mensaje', icono: '✉️' },
  donativo: { nombre: 'Donativo', icono: '🤍' },
  loteria: { nombre: 'Lotería', icono: '🎟️' },
}

function mensajeToRow(m: MensajeWeb): Record<string, unknown> {
  return {
    id: m.id,
    tipo: m.tipo,
    fecha: m.fecha,
    nombre: m.nombre,
    email: m.email,
    telefono: m.telefono,
    asunto: m.asunto,
    mensaje: m.mensaje,
    leido: m.leido,
    atendido: m.atendido,
    importe: m.importe ?? null,
    metodo: m.metodo ?? null,
    participaciones: m.participaciones ?? null,
    causa: m.causa ?? null,
  }
}

function rowToMensaje(r: Record<string, unknown>): MensajeWeb {
  return {
    id: r.id as string,
    tipo: (r.tipo as TipoMensajeWeb) ?? 'contacto',
    fecha: (r.fecha as string) ?? '',
    nombre: (r.nombre as string) ?? '',
    email: (r.email as string) ?? '',
    telefono: (r.telefono as string) ?? '',
    asunto: (r.asunto as string) ?? '',
    mensaje: (r.mensaje as string) ?? '',
    leido: !!r.leido,
    atendido: !!r.atendido,
    importe: (r.importe as number | null) ?? undefined,
    metodo: (r.metodo as MensajeWeb['metodo']) ?? undefined,
    participaciones: (r.participaciones as number | null) ?? undefined,
    causa: (r.causa as string | null) ?? undefined,
  }
}

export function getMensajesWeb(): MensajeWeb[] {
  return leerPersistido<MensajeWeb[]>(CLAVE_MENSAJES_WEB, [])
}

/** El buzón, reactivo: lo que entra por la web aparece sin recargar el panel. */
export function useMensajesWeb(): [MensajeWeb[], (lista: MensajeWeb[]) => void] {
  const [mensajes, setMensajes] = useState<MensajeWeb[]>(() => getMensajesWeb())
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let cancelado = false
    // Por páginas: el buzón se acumula, un mensaje por cada persona que
    // escribe desde la web, y no se vacía solo. Ver `lib/paginado.ts`.
    traerTodasLasFilas<Record<string, unknown>>((desde, hasta) => supabase!
      .from('mensajes_web')
      .select('*')
      .order('id')
      .range(desde, hasta))
      .then(({ data, error }) => {
        if (cancelado) return
        /*
         * Que no se pueda LEER el buzón es tan grave como no poder escribir:
         * la pantalla se quedaba con lo que hubiera en el navegador —o vacía—
         * y la hermandad daba por hecho que no había escrito nadie.
         */
        if (error) {
          avisarDelBuzon('leer', error.message, error.code)
          return
        }
        if (!data) return
        const traidos = data.map(rowToMensaje)
        setMensajes(traidos)
        localStorage.setItem(CLAVE_MENSAJES_WEB, JSON.stringify(traidos))
      })
    return () => {
      cancelado = true
    }
  }, [])
  useEscuchaOtrasPestanas(CLAVE_MENSAJES_WEB, () => setMensajes(getMensajesWeb()))

  function guardar(lista: MensajeWeb[]) {
    setMensajes(lista)
    localStorage.setItem(CLAVE_MENSAJES_WEB, JSON.stringify(lista))
  }
  return [mensajes, guardar]
}

/**
 * EL BUZÓN NO PUEDE TRAGARSE UN FALLO, y aquí se lo tragaba tres veces.
 *
 * `supabase-js` NO lanza cuando la base rechaza: devuelve `{ error }`. Estas
 * tres funciones escribían en el navegador y mandaban la orden a la base sin
 * mirar la respuesta, así que un rechazo —permisos, red, la sesión caducada—
 * no se notaba en ninguna parte. Y detrás de cada fila hay una persona de
 * fuera que ha escrito a la hermandad dejando su teléfono:
 *
 *   · Marcar «atendido» que no llega: en el ordenador de secretaría queda
 *     atendido y en el de la casa de hermandad sigue pendiente. O se le
 *     contesta dos veces, o —peor— cada uno da por hecho que contestó el otro.
 *   · Borrar que no llega: desaparece de la pantalla y vuelve al recargar.
 *   · Y el DESHACER que no llega, que es el peor de los tres: se recupera un
 *     mensaje borrado sin querer, se ve otra vez en la lista, y a la siguiente
 *     recarga ya no está. La segunda vez no hay deshacer.
 *
 * Se avisa por la misma señal que usa el resto (`cabildo-sync-error`), que el
 * marco de la aplicación ya escucha y pinta.
 */
function avisarDelBuzon(operacion: 'crear' | 'guardar' | 'borrar' | 'leer', mensaje: string, codigo?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('cabildo-sync-error', {
    detail: {
      tabla: 'mensajes_web',
      fallos: [`${operacion}: ${mensaje}`],
      traducidos: [traducirErrorDeEscritura('mensajes_web', operacion, mensaje, codigo)],
    },
  }))
}

/** Marca uno como leído / atendido, en el navegador y en Supabase si lo hay. */
export async function actualizarMensajeWeb(id: string, cambios: Partial<MensajeWeb>) {
  const lista = getMensajesWeb().map((m) => (m.id === id ? { ...m, ...cambios } : m))
  localStorage.setItem(CLAVE_MENSAJES_WEB, JSON.stringify(lista))
  if (isSupabaseConfigured && supabase) {
    const m = lista.find((x) => x.id === id)
    if (!m) return
    const { error } = await supabase.from('mensajes_web').update(mensajeToRow(m)).eq('id', id)
    if (error) avisarDelBuzon('guardar', error.message, error.code)
  }
}

export async function borrarMensajeWeb(id: string) {
  localStorage.setItem(CLAVE_MENSAJES_WEB, JSON.stringify(getMensajesWeb().filter((m) => m.id !== id)))
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('mensajes_web').delete().eq('id', id)
    if (error) avisarDelBuzon('borrar', error.message, error.code)
  }
}

/**
 * Devolver al buzón un mensaje recién borrado (A4 · deshacer).
 *
 * Lo que hay detrás es una persona de fuera que ha escrito a la hermandad y ha
 * dejado su teléfono. Borrarlo sin querer no da un error: simplemente ese
 * contacto ya no existe y nadie sabe que existió. Se vuelve a insertar con su
 * mismo identificador, así que no se duplica si el borrado no había llegado a
 * la base de datos.
 */
export async function devolverMensajeWeb(mensaje: MensajeWeb, posicion: number) {
  const lista = getMensajesWeb().filter((m) => m.id !== mensaje.id)
  lista.splice(Math.min(Math.max(posicion, 0), lista.length), 0, mensaje)
  localStorage.setItem(CLAVE_MENSAJES_WEB, JSON.stringify(lista))
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('mensajes_web').upsert(mensajeToRow(mensaje))
    // Si el deshacer no llega a la base, hay que decirlo AHORA: el mensaje se
    // ve en la lista y desaparece en la siguiente recarga, y para entonces ya
    // no queda a qué volver.
    if (error) avisarDelBuzon('crear', error.message, error.code)
  }
}

/**
 * Lo que manda quien visita la web. Como no ha iniciado sesión, va por la
 * inserción anónima de `mensajes_web` (igual que las solicitudes de alta): no
 * puede leer el buzón, solo dejar algo en él.
 *
 * Si la inserción falla, se dice. Antes de tener esto, un formulario que
 * «se ha enviado» y solo existía en el navegador del visitante era peor que
 * no tener formulario.
 */
export async function enviarMensajeWeb(
  datos: Omit<MensajeWeb, 'id' | 'fecha' | 'leido' | 'atendido'>,
): Promise<{ ok: boolean; error?: string }> {
  const nuevo: MensajeWeb = {
    ...datos,
    id: nuevoId(),
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
    leido: false,
    atendido: false,
  }
  if (isSupabaseConfigured && supabase) {
    // A qué hermandad va. Sin esto el mensaje se quedaría sin dueño y no lo
    // leería nadie nunca, así que Supabase lo rechaza de entrada.
    const hermandadId = await hermandadDestino()
    if (!hermandadId) {
      return { ok: false, error: 'No se ha podido saber a qué hermandad enviar el mensaje. Recarga la página e inténtalo otra vez.' }
    }
    const { error } = await supabase
      .from('mensajes_web')
      .insert({ ...mensajeToRow(nuevo), hermandad_id: hermandadId })
    if (error) {
      console.error('No se pudo enviar el mensaje:', error.message)
      return { ok: false, error: 'No se ha podido enviar. Inténtalo de nuevo en un momento.' }
    }
    // Y NO se guarda copia en el navegador. Quien manda este formulario es un
    // VISITANTE de la web, no la hermandad: guardárselo en su navegador le
    // metía el mensaje en «su» buzón. Si además esa persona es hermana y entra
    // luego en el panel, se encontraba sus propios mensajes mezclados con los
    // que había recibido la hermandad.
    return { ok: true }
  }

  // Sin base de datos, el buzón vive en este navegador y aquí sí hay que
  // dejarlo: es el único sitio donde puede estar.
  localStorage.setItem(CLAVE_MENSAJES_WEB, JSON.stringify([nuevo, ...getMensajesWeb()]))
  return { ok: true }
}

/* ---------------------------------------------------------------------------
   Validación
   --------------------------------------------------------------------------- */

/**
 * Un correo con la forma mínima: algo, arroba, algo, punto, algo. No se
 * pretende validar el RFC entero (no se puede desde el navegador): se trata de
 * cazar el dedazo, no de rechazar direcciones raras pero legales.
 */
export function pareceEmail(valor: string): boolean {
  const v = valor.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

/** Un teléfono español o internacional escrito de cualquier forma razonable. */
export function pareceTelefono(valor: string): boolean {
  const solo = valor.replace(/[\s.-]/g, '')
  return /^\+?\d{9,15}$/.test(solo)
}

export interface CamposFormulario {
  nombre: string
  email: string
  telefono?: string
  mensaje?: string
  consiente: boolean
}

/**
 * Qué le falta al formulario, campo a campo, para poder pintar el error justo
 * debajo de cada uno. Devuelve `{}` cuando está listo para enviarse.
 *
 * `mensaje` solo se exige donde tiene sentido (el formulario de contacto): en
 * un donativo o una reserva de lotería, obligar a escribir un texto es
 * ponerle una barrera a quien ya te está dando dinero.
 */
export function erroresFormulario(
  c: CamposFormulario,
  opciones: { exigeMensaje?: boolean; exigeTelefono?: boolean } = {},
): Partial<Record<'nombre' | 'email' | 'telefono' | 'mensaje' | 'consiente', string>> {
  const e: Partial<Record<'nombre' | 'email' | 'telefono' | 'mensaje' | 'consiente', string>> = {}
  if (c.nombre.trim().length < 2) e.nombre = 'Escribe tu nombre.'
  if (!c.email.trim()) e.email = 'Hace falta un correo para poder contestarte.'
  else if (!pareceEmail(c.email)) e.email = 'Ese correo no parece correcto.'
  const tel = (c.telefono ?? '').trim()
  if (opciones.exigeTelefono && !tel) e.telefono = 'Hace falta un teléfono.'
  else if (tel && !pareceTelefono(tel)) e.telefono = 'Ese teléfono no parece correcto.'
  if (opciones.exigeMensaje && (c.mensaje ?? '').trim().length < 5) e.mensaje = 'Cuéntanos algo más.'
  if (!c.consiente) e.consiente = 'Hay que aceptarlo para poder escribirte.'
  return e
}

/**
 * ¿Esto lo ha mandado un robot? Un formulario público sin ninguna defensa se
 * llena de basura en semanas, y la hermandad acaba desactivándolo. Sin
 * depender de ningún servicio externo (ni captcha, ni cuentas, ni cookies de
 * terceros) hay dos señales que cazan casi todo el spam automático:
 *
 * 1. El campo trampa: una casilla que no ve nadie y que los robots rellenan
 *    porque leen el HTML, no la pantalla.
 * 2. El tiempo: nadie rellena un formulario en un segundo. Un envío
 *    instantáneo es un script, no una persona.
 *
 * Cuando salta, el formulario dice «enviado» igual y no guarda nada: si se le
 * enseña el error, el robot reintenta hasta acertar.
 *
 * El umbral es deliberadamente bajo (1,2 s). Tirar el mensaje de una persona
 * de verdad es MUCHO peor que colarse un spam: la trampa caza casi todo, y el
 * reloj está solo para el envío instantáneo que ni con autocompletar se da.
 */
export const MS_MINIMOS_HUMANOS = 1200

export function pareceRobot(trampa: string, msDesdeQueSeAbrio: number): boolean {
  if (trampa.trim() !== '') return true
  return msDesdeQueSeAbrio < MS_MINIMOS_HUMANOS
}

/** Una línea que resume el mensaje para la lista del buzón. */
export function resumenMensaje(m: MensajeWeb): string {
  if (m.tipo === 'donativo') {
    const cuanto = m.importe ? `${m.importe} €` : 'Donativo'
    return m.causa ? `${cuanto} · ${m.causa}` : cuanto
  }
  if (m.tipo === 'loteria') {
    const n = m.participaciones ?? 0
    return `${n} ${n === 1 ? 'participación' : 'participaciones'}`
  }
  return m.asunto || m.mensaje.slice(0, 60)
}

/** Cuántos están sin leer (lo que se enseña como marca en el panel). */
export function sinLeer(mensajes: MensajeWeb[]): number {
  return mensajes.filter((m) => !m.leido).length
}
