/**
 * ENCARGAR UN POST Y QUE SE REPARTA SOLO.
 *
 * Quien lleva redes escribe UNA vez qué hay que publicar y en qué redes, y de
 * ahí salen las tareas: escribirlo, subirlo a Facebook, subirlo a Instagram.
 * Cada una con su responsable, y cada responsable la ve en SU área sin entrar
 * al panel.
 *
 * Lo que se guarda es una fila POR TAREA, no por encargo: es lo que se asigna,
 * lo que se marca y lo que se pregunta. El porqué, entero, está en
 * `supabase/encargos-redes.sql`.
 *
 * PARA ENCENDERLO: ejecuta `supabase/encargos-redes.sql` una vez (o
 * `ACTUALIZAR.sql`, que ya lo lleva).
 */
import { useSupabaseTable, nuevoId } from './supabaseSync'
import { CLAVES_DATOS } from './persistencia'
import { tareaRedToRow, rowToTareaRed } from './db/tareasRedes'
import type { RedSocial } from '../data/comunicados'

/** Escribir el post, o subirlo a una red concreta. */
export type QueHacer = 'crear' | 'publicar'

export interface TareaRed {
  id: string
  /** Lo que mantiene juntas las tareas que salieron del mismo encargo. */
  encargoId: string
  titulo: string
  texto: string
  que: QueHacer
  /** Vacía en la tarea de escribir: esa no es de ninguna red. */
  red?: RedSocial
  /** A quién le toca. Vacío = encargo preparado pero sin repartir. */
  hermanoId?: string
  estado: 'pendiente' | 'hecha'
  creadoEn: string
  hechaEn?: string
  hechaPor?: string
  notas: string
}

/** Cómo se lee cada tarea en pantalla, sin que nadie la escriba a mano. */
export function loQueHayQueHacer(t: Pick<TareaRed, 'que' | 'red'>): string {
  return t.que === 'crear' ? 'Escribir el post y preparar la foto' : `Subirlo a ${t.red}`
}

/**
 * UN ENCARGO SE CONVIERTE EN SUS TAREAS.
 *
 * Función pura y aparte de la pantalla a propósito: es la regla del reparto
 * —qué tareas salen y en qué orden— y así se puede comprobar sin montar nada.
 *
 * LA DE ESCRIBIR VA PRIMERO Y ES UNA SOLA. No una por red: el post se escribe
 * una vez y se sube a las que sean. Ponerla por red haría que la misma persona
 * viera «escribir el post» tres veces y no supiera si son tres cosas o una.
 *
 * Y si no se pide ninguna red, sale igualmente la de escribir: hay encargos
 * que son solo eso —preparar el texto para el boletín— y quedarse sin ninguna
 * tarea sería tragarse el encargo entero en silencio.
 */
export function tareasDeUnEncargo(
  encargo: {
    titulo: string
    texto?: string
    redes: RedSocial[]
    /** Quién escribe. Vacío = sin repartir todavía. */
    quienCrea?: string
    /** Quién sube a cada red. Lo que no esté aquí, queda sin repartir. */
    quienPublica?: Partial<Record<RedSocial, string>>
    notas?: string
  },
  hacerId: () => string = nuevoId,
): TareaRed[] {
  const encargoId = hacerId()
  const ahora = new Date().toISOString()
  const comun = {
    encargoId,
    titulo: encargo.titulo.trim(),
    texto: (encargo.texto ?? '').trim(),
    estado: 'pendiente' as const,
    creadoEn: ahora,
    notas: (encargo.notas ?? '').trim(),
  }
  const tareas: TareaRed[] = [
    { ...comun, id: hacerId(), que: 'crear', hermanoId: encargo.quienCrea || undefined },
  ]
  // Sin repetir una red aunque venga dos veces en la lista: dos tareas
  // idénticas para la misma persona se leen como un fallo, no como dos cosas.
  for (const red of [...new Set(encargo.redes)]) {
    tareas.push({
      ...comun,
      id: hacerId(),
      que: 'publicar',
      red,
      hermanoId: encargo.quienPublica?.[red] || undefined,
    })
  }
  return tareas
}

/** Lo que le queda pendiente a una persona, lo más antiguo primero. */
export function misTareasPendientes(tareas: TareaRed[], hermanoId: string | undefined): TareaRed[] {
  if (!hermanoId) return []
  return tareas
    .filter((t) => t.hermanoId === hermanoId && t.estado === 'pendiente')
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
}

/**
 * Las tareas agrupadas por encargo, para poder enseñarlas juntas en el panel.
 * El encargo más nuevo primero, que es el que se está repartiendo ahora.
 */
export function porEncargo(tareas: TareaRed[]): { encargoId: string; titulo: string; tareas: TareaRed[] }[] {
  const grupos = new Map<string, TareaRed[]>()
  for (const t of tareas) {
    const ya = grupos.get(t.encargoId)
    if (ya) ya.push(t)
    else grupos.set(t.encargoId, [t])
  }
  return [...grupos.values()]
    .map((ts) => ({
      encargoId: ts[0].encargoId,
      titulo: ts[0].titulo,
      // Dentro del encargo: escribir primero, luego las redes por orden.
      tareas: [...ts].sort((a, b) => (a.que === b.que ? (a.red ?? '').localeCompare(b.red ?? '') : a.que === 'crear' ? -1 : 1)),
    }))
    .sort((a, b) => b.tareas[0].creadoEn.localeCompare(a.tareas[0].creadoEn))
}

/** Cuántas quedan y cuántas hay: «2 de 4 hechas». */
export function comoVa(tareas: TareaRed[]): { hechas: number; total: number } {
  return { hechas: tareas.filter((t) => t.estado === 'hecha').length, total: tareas.length }
}

/**
 * Las tareas de redes de la hermandad.
 *
 * Quien lleva redes las ve todas; un responsable, solo las suyas. Lo decide la
 * base (RLS), no este hook: aquí se lee lo que llegue.
 *
 * Y JUSTO POR ESO EL ÁREA DEL HERMANO TIENE QUE PASAR `sinEspejo`. Los dos
 * montan este mismo hook con la misma clave de navegador pero ven cosas muy
 * distintas: al hermano la base solo le devuelve LAS SUYAS. Sin `sinEspejo`,
 * su área guarda esas dos en el navegador, el aviso de almacenamiento llega a
 * la pestaña del panel, y quien lleva redes ve cómo sus cuarenta encargos se
 * convierten en dos delante de sus ojos. Está contado entero en
 * `supabaseSync.ts`, y ya pasó una vez con el censo.
 */
export function useTareasRedes(opciones?: { sinEspejo?: boolean }) {
  return useSupabaseTable<TareaRed>(
    'tareas_redes',
    CLAVES_DATOS.tareasRedes,
    [],
    tareaRedToRow,
    rowToTareaRed,
    'creado_en',
    opciones,
  )
}
