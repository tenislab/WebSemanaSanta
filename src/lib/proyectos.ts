/**
 * PROYECTOS: LO QUE LLEVA MESES Y NO CABE EN UNA AGENDA.
 *
 * Pedido por la hermandad piloto: «los proyectos que sean como tareas pero a
 * largo plazo».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO SON EVENTOS CON TAREAS, QUE YA EXISTEN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un evento es UN DÍA con cosas que preparar: la misa del sábado, con el altar
 * y el coro. Se prepara, se celebra y se acabó.
 *
 * Un proyecto no tiene día: tiene un final. Restaurar el manto son dos años,
 * cuatro presupuestos y una junta que cambia por el medio. Metido como evento
 * hay que ponerle una fecha que nadie sabe, y en cuanto pasa desaparece de la
 * agenda arrastrando sus tareas — que era justo lo que había que seguir viendo.
 *
 * De ahí las tres diferencias que importan:
 *
 *   · LA FECHA ES UN OBJETIVO, NO UNA CITA, y puede no estar. «Para la Semana
 *     Santa que viene» es una fecha; «cuando se pueda» también es una respuesta
 *     válida y no puede obligar a inventarse un día.
 *   · TIENE UN RESPONSABLE. Lo que dura dos años se muere si no es de nadie.
 *   · PASADA LA FECHA NO SE ARCHIVA SOLO. Un proyecto que se retrasa sigue
 *     estando, y en rojo. Eso es información, no un error que esconder.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL PRESUPUESTO SE ENLAZA CON LA CAMPAÑA, NO SE COPIA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un proyecto caro suele tener su campaña para pagarlo. En vez de guardar en
 * el proyecto cuánto se lleva recogido —que se descuadraría en cuanto alguien
 * tocara un apunte—, se guarda A QUÉ CAMPAÑA va enganchado, y lo recaudado se
 * cuenta desde Tesorería como en `lib/recaudaciones.ts`. Un dato, un sitio.
 */
import { useSupabaseTable } from './supabaseSync'
import { CLAVES_DATOS } from './persistencia'
import { proyectoToRow, rowToProyecto, tareaProyectoToRow, rowToTareaProyecto } from './db/proyectos'
import { hoyIso } from './hoy'
import { PROYECTOS_INICIALES, TAREAS_PROYECTO_INICIALES } from '../data/objetivos'

/**
 * En qué punto está.
 *
 * «Idea» existe a propósito y es el estado más útil de los cuatro: lo que se
 * habló en un cabildo y quedó ahí. Sin un sitio donde ponerlo se pierde entre
 * un acta y la siguiente, y a los dos años alguien lo vuelve a proponer como
 * nuevo.
 */
export type EstadoProyecto = 'idea' | 'en marcha' | 'parado' | 'hecho'

export const ESTADOS_PROYECTO: EstadoProyecto[] = ['idea', 'en marcha', 'parado', 'hecho']

export interface Proyecto {
  id: string
  nombre: string
  descripcion: string
  estado: EstadoProyecto
  /** Quién responde de que avance. Vacío = de nadie, que es una señal en sí misma. */
  responsableId?: string
  responsableNombre?: string
  /** Para cuándo se quiere (ISO yyyy-mm-dd). Vacía = sin fecha, y no pasa nada. */
  fechaObjetivo?: string
  /** Lo que se calcula que va a costar, en euros. Cero = todavía sin cifrar. */
  presupuesto: number
  /** La campaña que lo paga, si tiene una. Lo recaudado se cuenta desde Tesorería. */
  recaudacionId?: string
  creadoEn: string
}

export interface TareaProyecto {
  id: string
  proyectoId: string
  titulo: string
  hecha: boolean
  hermanoId?: string
  hermanoNombre?: string
  /** Para cuándo toca esta tarea suelta (ISO). Vacía = sin plazo propio. */
  fechaLimite?: string
  creadaEn: string
}

/**
 * ¿VA TARDE?
 *
 * Se comparan las fechas COMO TEXTO, no como `Date`. En formato ISO el orden
 * alfabético ES el cronológico, y así no entra en juego ninguna zona horaria.
 * Comparando objetos `Date`, un proyecto para hoy sale «tarde» desde la
 * medianoche de Canarias, y el día 1 de mes salía atrasado el día anterior.
 * Ver `lib/hoy.ts`, donde está contado entero.
 *
 * Y lo que está HECHO nunca va tarde, aunque se acabara en marzo lo que era
 * para enero: terminado es terminado, y pintarlo en rojo para siempre es
 * castigar a quien lo sacó adelante.
 */
export function vaTarde(p: Pick<Proyecto, 'estado' | 'fechaObjetivo'>, hoy = hoyIso()): boolean {
  if (p.estado === 'hecho') return false
  if (!p.fechaObjetivo) return false
  return p.fechaObjetivo < hoy
}

/** Lo mismo para una tarea suelta. */
export function tareaVaTarde(t: Pick<TareaProyecto, 'hecha' | 'fechaLimite'>, hoy = hoyIso()): boolean {
  if (t.hecha) return false
  if (!t.fechaLimite) return false
  return t.fechaLimite < hoy
}

/**
 * CÓMO VA, contando sus tareas.
 *
 * Un proyecto SIN TAREAS devuelve 0, no 100. Es la diferencia entre «no hay
 * nada que hacer» y «no se ha desglosado todavía», y son casos opuestos: uno
 * está listo y el otro ni ha empezado. Devolver 100 —que es lo que sale de
 * dividir 0 entre 0 y arreglarlo mal— pinta la barra llena en el proyecto que
 * nadie ha tocado, que es justo el que hay que mirar.
 */
export function comoVaElProyecto(tareas: readonly TareaProyecto[]): { hechas: number, total: number, pct: number } {
  const total = tareas.length
  const hechas = tareas.filter((t) => t.hecha).length
  return { hechas, total, pct: total === 0 ? 0 : Math.round((hechas / total) * 100) }
}

/** Las tareas de un proyecto, las hechas al final y por plazo dentro de cada grupo. */
export function tareasDelProyecto(todas: readonly TareaProyecto[], proyectoId: string): TareaProyecto[] {
  return todas
    .filter((t) => t.proyectoId === proyectoId)
    .sort((a, b) => {
      if (a.hecha !== b.hecha) return a.hecha ? 1 : -1
      // Las que no tienen plazo van detrás de las que sí: lo que tiene fecha
      // es lo que corre prisa.
      const fa = a.fechaLimite || '9999-12-31'
      const fb = b.fechaLimite || '9999-12-31'
      if (fa !== fb) return fa < fb ? -1 : 1
      return a.creadaEn < b.creadaEn ? -1 : 1
    })
}

/**
 * El orden en que se enseñan los proyectos.
 *
 * Lo que va tarde primero, luego lo que está en marcha, y lo hecho al final.
 * Es el orden en el que hay que mirarlos: la lista de proyectos se abre para
 * ver qué se ha atascado, no para leer lo que ya salió bien.
 */
export function ordenDeProyectos(lista: readonly Proyecto[], hoy = hoyIso()): Proyecto[] {
  const peso = (p: Proyecto) => {
    if (vaTarde(p, hoy)) return 0
    if (p.estado === 'en marcha') return 1
    if (p.estado === 'parado') return 2
    if (p.estado === 'idea') return 3
    return 4 // hecho
  }
  return [...lista].sort((a, b) => {
    const pa = peso(a)
    const pb = peso(b)
    if (pa !== pb) return pa - pb
    const fa = a.fechaObjetivo || '9999-12-31'
    const fb = b.fechaObjetivo || '9999-12-31'
    if (fa !== fb) return fa < fb ? -1 : 1
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

export function useProyectos() {
  return useSupabaseTable<Proyecto>(
    'proyectos',
    CLAVES_DATOS.proyectos,
    PROYECTOS_INICIALES,
    proyectoToRow,
    rowToProyecto,
    'creado_en',
  )
}

export function useTareasProyecto() {
  return useSupabaseTable<TareaProyecto>(
    'tareas_proyecto',
    CLAVES_DATOS.tareasProyecto,
    TAREAS_PROYECTO_INICIALES,
    tareaProyectoToRow,
    rowToTareaProyecto,
    'creada_en',
  )
}
