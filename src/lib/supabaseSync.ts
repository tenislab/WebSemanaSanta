import { useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { leerPersistido } from './persistencia'
import { modoDemoActivo } from './demo'

/**
 * Id nuevo para cualquier registro que se vaya a crear. Antes se usaba
 * `x-${Date.now()}`; ahora hace falta un UUID real porque las tablas de
 * Supabase usan `uuid` como clave primaria (y sigue funcionando igual de
 * bien como clave de React o de localStorage en modo demostración).
 */
export function nuevoId(): string {
  return crypto.randomUUID()
}

type Actualizador<T> = T[] | ((prev: T[]) => T[])

/**
 * Copia de reserva en localStorage, incluso con Supabase conectado: otras
 * páginas que todavía leen esta colección con `leerPersistido` (referencias
 * de solo lectura entre módulos, p. ej. Hermanos mostrando el tramo de cada
 * uno a partir de las papeletas) ven así los datos tal como estaban la
 * última vez que esta página se cargó en este navegador, en vez de quedarse
 * con los datos de ejemplo para siempre.
 */
function espejarEnLocal(claveLocal: string, items: unknown[]) {
  try {
    localStorage.setItem(claveLocal, JSON.stringify(items))
  } catch {
    // sin espacio o sin localStorage: no pasa nada, ya está en memoria
  }
}

/**
 * Como `usePersistentState`, pero cuando Supabase está conectado sincroniza
 * la colección con una tabla real en vez de con localStorage: compara el
 * array anterior con el nuevo y manda solo los inserts/updates/deletes que
 * hacen falta. La firma `[items, setItems]` es idéntica a la de
 * `usePersistentState`, así que las páginas que ya gestionan sus datos como
 * "reemplaza el array entero" no tienen que cambiar su lógica, solo de
 * dónde viene el hook.
 *
 * Sin Supabase configurado (modo demostración), se comporta exactamente
 * como `usePersistentState` sobre `claveLocal`.
 */
export function useSupabaseTable<T extends { id: string }>(
  tabla: string,
  claveLocal: string,
  inicial: T[],
  toRow: (item: T) => Record<string, unknown>,
  fromRow: (row: Record<string, unknown>) => T,
  orderBy?: string,
) {
  // Modo local efectivo: sin Supabase configurado, o en modo demostración
  // (aunque Supabase esté configurado pero en pausa). En demo leemos siempre
  // los datos de ejemplo del navegador, sin consultar Supabase, para que el
  // censo/papeletas/cuotas estén disponibles al instante y el acceso funcione.
  const [local] = useState(() => !isSupabaseConfigured || modoDemoActivo())

  const [items, setItemsState] = useState<T[]>(() =>
    local ? leerPersistido(claveLocal, inicial) : [],
  )
  const cargado = useRef(local)

  useEffect(() => {
    if (local || !supabase) return
    let cancelado = false

    function cargar() {
      if (!supabase) return
      let query = supabase.from(tabla).select('*')
      if (orderBy) query = query.order(orderBy)
      query.then(({ data, error }) => {
        if (cancelado) return
        if (error) {
          // Supabase no responde (p. ej. proyecto en pausa): en vez de dejar la
          // tabla vacía, se usa la copia local para que la página siga viéndose.
          console.error(`No se pudo cargar "${tabla}":`, error.message)
          setItemsState(leerPersistido(claveLocal, inicial))
        } else {
          const traidos = (data ?? []).map(fromRow)
          setItemsState(traidos)
          espejarEnLocal(claveLocal, traidos)
        }
        cargado.current = true
      }, (err) => {
        // Rechazo de red (fetch fallido) al consultar Supabase: misma reserva local.
        if (cancelado) return
        console.error(`No se pudo cargar "${tabla}" (red):`, err)
        setItemsState(leerPersistido(claveLocal, inicial))
        cargado.current = true
      })
    }

    cargar()
    // Vuelve a cargar cuando cambia la sesión: el área del hermano monta este
    // hook antes de que el hermano haya iniciado sesión (todavía no tiene
    // acceso a sus filas por RLS), así que la carga inicial llega vacía y
    // hace falta repetirla en cuanto entra.
    const { data: sub } = supabase.auth.onAuthStateChange(() => cargar())
    return () => {
      cancelado = true
      sub.subscription.unsubscribe()
    }
    // Solo al montar/cambio de sesión: cada página monta este hook una vez por colección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla])

  function setItems(actualizador: Actualizador<T>) {
    setItemsState((prev) => {
      const next = typeof actualizador === 'function' ? (actualizador as (p: T[]) => T[])(prev) : actualizador
      if (!local && supabase) {
        if (cargado.current) sincronizar(tabla, prev, next, toRow)
        espejarEnLocal(claveLocal, next)
      } else {
        espejarEnLocal(claveLocal, next)
      }
      return next
    })
  }

  return [items, setItems] as const
}

async function sincronizar<T extends { id: string }>(
  tabla: string,
  prev: T[],
  next: T[],
  toRow: (item: T) => Record<string, unknown>,
) {
  if (!supabase) return
  const prevPorId = new Map(prev.map((p) => [p.id, p]))
  const nextIds = new Set(next.map((n) => n.id))

  const eliminados = prev.filter((p) => !nextIds.has(p.id))
  const nuevos = next.filter((n) => !prevPorId.has(n.id))
  const posiblesCambios = next.filter((n) => {
    const anterior = prevPorId.get(n.id)
    return anterior && JSON.stringify(anterior) !== JSON.stringify(n)
  })

  // supabase-js NO lanza excepción cuando la base rechaza la operación (columna
  // que no existe, restricción incumplida…): devuelve `error` en la respuesta.
  // Sin mirarlo, un guardado fallido pasaba totalmente inadvertido: la pantalla
  // decía que se había guardado y al recargar el cambio no estaba.
  const fallos: string[] = []
  try {
    if (eliminados.length > 0) {
      const { error } = await supabase.from(tabla).delete().in('id', eliminados.map((e) => e.id))
      if (error) fallos.push(`borrar: ${error.message}`)
    }
    if (nuevos.length > 0) {
      const { error } = await supabase.from(tabla).insert(nuevos.map(toRow))
      if (error) fallos.push(`crear: ${error.message}`)
    }
    for (const item of posiblesCambios) {
      const { error } = await supabase.from(tabla).update(toRow(item)).eq('id', item.id)
      if (error) fallos.push(`guardar ${item.id}: ${error.message}`)
    }
  } catch (err) {
    fallos.push(String(err))
  }
  if (fallos.length > 0) {
    console.error(`No se pudo sincronizar "${tabla}" con Supabase:`, fallos.join(' · '))
    // Aviso visible: quien está usando la app debe enterarse de que lo que ve
    // en pantalla no ha llegado a la base de datos.
    window.dispatchEvent(new CustomEvent('cabildo-sync-error', { detail: { tabla, fallos } }))
  }
}
