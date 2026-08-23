/**
 * LA COPIA DE SEGURIDAD, SOLA Y CADA SEMANA.
 *
 * La copia había que descargarla a mano. Funciona el día que alguien se
 * acuerda, y el problema es que nadie se acuerda: se pulsa el botón la semana
 * que se monta todo y no se vuelve a pulsar en dos años.
 *
 * Y el censo es EL dato que no se puede volver a escribir. Cuatrocientas fichas
 * con su antigüedad, su cuota y su sitio en el cortejo no se reconstruyen: o
 * están, o se han perdido.
 *
 * CUÁNDO SE HACE. Al entrar en el panel, si la última tiene más de una semana.
 * No hay servidor que la lance —no hay `pg_cron` en el plan gratuito— así que
 * la lanza quien entre, que en una hermandad es alguien casi todas las semanas.
 * Si nadie entra en un mes, tampoco hay datos nuevos que perder.
 *
 * DE DÓNDE SE SABE CUÁNDO FUE LA ÚLTIMA: de los propios archivos del cubo, no
 * de una marca guardada aparte. Una marca en el navegador diría «ya está hecha»
 * en el ordenador de la secretaria y «nunca» en el del tesorero; y una marca en
 * una tabla se puede quedar diciendo que hay copia cuando el archivo no llegó a
 * subir. Lo que hay en el cubo es la única verdad.
 *
 * PARA ENCENDERLO: ejecuta `supabase/copias.sql` una vez.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { hermandadActualId } from './multiHermandad'
import { crearCopia } from './backup'

const CUBO = 'copias'

/** Cada cuánto se hace una. */
export const DIAS_ENTRE_COPIAS = 7

/**
 * A partir de cuándo se avisa. Un mes: para entonces han pasado cuatro
 * semanas sin que la copia saliera, y eso ya no es «esta semana no ha entrado
 * nadie» — es que algo no funciona.
 */
export const DIAS_PARA_AVISAR = 31

/**
 * Cuántas se guardan. Ocho semanas es lo que hace falta para el caso de verdad:
 * alguien borra algo por error y se descubre tres o cuatro semanas después, al
 * ir a buscarlo. Con solo la última, la copia buena ya se habría machacado con
 * el error dentro.
 */
export const COPIAS_QUE_SE_GUARDAN = 8

export interface EstadoDeLasCopias {
  /** Cuándo fue la última. Null si no hay ninguna. */
  ultima: Date | null
  cuantas: number
  /** Lleva demasiado sin hacerse: hay que decirlo. */
  hayQueAvisar: boolean
  /** ¿Se ha podido preguntar? En falso NO es que no haya: es que no se sabe. */
  seSabe: boolean
}

export const SIN_SABER: EstadoDeLasCopias = {
  ultima: null, cuantas: 0, hayQueAvisar: false, seSabe: false,
}

/** El nombre lleva la fecha delante para que ordene solo: `2026-08-23T10-15-00.json`. */
function nombreDeCopia(ahora: Date): string {
  return `${ahora.toISOString().replace(/[:.]/g, '-')}.json`
}

/** La fecha que lleva escrita un nombre de copia. Null si no la tiene. */
export function fechaDelNombre(nombre: string): Date | null {
  const t = nombre.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/)
  if (!t) return null
  const f = new Date(Date.UTC(
    Number(t[1]), Number(t[2]) - 1, Number(t[3]), Number(t[4]), Number(t[5]), Number(t[6]),
  ))
  return Number.isNaN(f.getTime()) ? null : f
}

/** Días entre dos fechas, redondeando hacia abajo. */
export function diasDesde(fecha: Date, ahora = new Date()): number {
  return Math.floor((ahora.getTime() - fecha.getTime()) / 86400000)
}

async function carpeta(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null
  return hermandadActualId()
}

/** Qué copias hay, de la más nueva a la más vieja. */
async function listar(): Promise<{ nombre: string; fecha: Date }[] | null> {
  const cliente = supabase
  const dir = await carpeta()
  if (!cliente || !dir) return null
  try {
    const { data, error } = await cliente.storage.from(CUBO).list(dir, { limit: 100 })
    if (error || !data) return null
    return data
      .map((o) => ({ nombre: o.name, fecha: fechaDelNombre(o.name) }))
      .filter((x): x is { nombre: string; fecha: Date } => x.fecha !== null)
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
  } catch {
    return null
  }
}

/** Cómo están las copias. Para enseñarlo en Configuración y para avisar. */
export async function estadoDeLasCopias(ahora = new Date()): Promise<EstadoDeLasCopias> {
  const copias = await listar()
  if (copias === null) return SIN_SABER
  const ultima = copias[0]?.fecha ?? null
  return {
    ultima,
    cuantas: copias.length,
    /*
     * SIN NINGUNA COPIA TAMBIÉN SE AVISA. Es el caso peor y el más fácil de
     * pasar por alto: una hermandad que acaba de subir su censo y no tiene ni
     * una. Mirando solo «hace más de un mes de la última» ese caso no salta
     * nunca, porque no hay última.
     */
    hayQueAvisar: ultima === null || diasDesde(ultima, ahora) >= DIAS_PARA_AVISAR,
    seSabe: true,
  }
}

/**
 * Hace la copia de la semana si tocaba. Devuelve si la ha hecho.
 *
 * No falla nunca hacia fuera: esto se lanza al entrar en el panel, y una copia
 * que no sale no puede impedirle a nadie trabajar.
 */
export async function copiaSemanalSiTocaba(ahora = new Date()): Promise<boolean> {
  const cliente = supabase
  const dir = await carpeta()
  if (!cliente || !dir) return false

  const copias = await listar()
  if (copias === null) return false
  const ultima = copias[0]?.fecha ?? null
  if (ultima && diasDesde(ultima, ahora) < DIAS_ENTRE_COPIAS) return false

  try {
    const copia = await crearCopia()
    /*
     * SI LA COPIA VIENE COJA, NO SE GUARDA.
     *
     * `crearCopia` apunta en `fallos` las tablas que no ha podido traer. Subir
     * eso es peor que no subir nada: queda una copia con fecha de hoy a la que
     * le falta el censo, y el día que haga falta se restaura creyendo que está
     * todo. Mejor no tener copia de esta semana —y que salte el aviso— que
     * tener una que miente.
     */
    if ((copia.fallos ?? []).length > 0) return false

    const cuerpo = new Blob([JSON.stringify(copia)], { type: 'application/json' })
    const { error } = await cliente.storage
      .from(CUBO)
      .upload(`${dir}/${nombreDeCopia(ahora)}`, cuerpo, { contentType: 'application/json', upsert: false })
    if (error) return false

    await tirarLasViejas(dir, copias)
    return true
  } catch {
    return false
  }
}

/**
 * Fuera las que sobran. Se hace DESPUÉS de subir la nueva y nunca antes: si se
 * borrara primero y la subida fallara, la hermandad se quedaría con una copia
 * menos y ninguna nueva.
 */
async function tirarLasViejas(dir: string, habia: { nombre: string }[]): Promise<void> {
  const cliente = supabase
  if (!cliente) return
  // `habia` es lo que había ANTES de subir la de ahora, así que se conservan
  // las (N-1) más nuevas de antes más la recién subida.
  const sobran = habia.slice(COPIAS_QUE_SE_GUARDAN - 1)
  if (sobran.length === 0) return
  try {
    await cliente.storage.from(CUBO).remove(sobran.map((c) => `${dir}/${c.nombre}`))
  } catch {
    // Que no se puedan tirar las viejas no es motivo para dar por mala la
    // copia que sí ha subido.
  }
}

/** Descargar una copia guardada, para restaurarla o llevársela. */
export async function descargarCopiaGuardada(nombre: string): Promise<string | null> {
  const cliente = supabase
  const dir = await carpeta()
  if (!cliente || !dir) return null
  try {
    const { data, error } = await cliente.storage.from(CUBO).download(`${dir}/${nombre}`)
    if (error || !data) return null
    return await data.text()
  } catch {
    return null
  }
}

/** Las copias que hay, para enseñarlas en una lista. */
export async function copiasGuardadas(): Promise<{ nombre: string; fecha: Date }[]> {
  return (await listar()) ?? []
}
