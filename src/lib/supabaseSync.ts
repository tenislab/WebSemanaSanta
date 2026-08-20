import { useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { leerPersistido, useEscuchaOtrasPestanas } from './persistencia'
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
/**
 * Avisar de que una tabla no se ha podido traer.
 *
 * Se reutiliza la misma señal que el fallo al guardar: el marco de la
 * aplicación ya la escucha y pinta la banda de aviso. Que no se pueda LEER es
 * igual de grave que que no se pueda escribir, y hasta ahora solo se contaba
 * lo segundo: la pantalla se quedaba vacía o con lo que hubiera en el
 * navegador, sin decir nada, y la secretaría se ponía a trabajar encima.
 */
function avisarDeFallo(tabla: string, motivo: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('cabildo-sync-error', {
      detail: { tabla, fallos: [`no se pudo cargar «${tabla}»: ${motivo}`] },
    }),
  )
}

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
  opciones?: {
    /**
     * No dejar copia en el navegador ni escuchar la de otras pestañas.
     *
     * Lo usa el ÁREA DEL HERMANO, y hace falta porque el hermano y el panel
     * montan el mismo hook con la misma clave local, pero ven cosas muy
     * distintas: las políticas de Supabase solo le dejan ver SU ficha.
     *
     * Sin esto pasaba lo siguiente, en el ordenador de la casa de hermandad:
     * la secretaria con el panel abierto en Hermanos, y en otra pestaña un
     * hermano entrando en su área. La consulta del hermano devolvía 1 fila y
     * espejaba `cabildo-hermanos` con esa única fila; el evento de
     * almacenamiento llegaba a la pestaña del panel y la secretaria veía cómo
     * sus 400 hermanos se convertían en 1 delante de sus ojos. Y la copia
     * quedaba así aunque cerrara la pestaña.
     */
    sinEspejo?: boolean
  },
) {
  const sinEspejo = opciones?.sinEspejo ?? false
  // Modo local efectivo: sin Supabase configurado, o en modo demostración
  // (aunque Supabase esté configurado pero en pausa). En demo leemos siempre
  // los datos de ejemplo del navegador, sin consultar Supabase, para que el
  // censo/papeletas/cuotas estén disponibles al instante y el acceso funcione.
  const [local] = useState(() => !isSupabaseConfigured || modoDemoActivo())

  const [items, setItemsState] = useState<T[]>(() =>
    local ? leerPersistido(claveLocal, inicial) : [],
  )
  const cargado = useRef(local)

  /**
   * De dónde se tira cuando la consulta falla.
   *
   * NUNCA de `inicial` con base de datos conectada, y este matiz costaba caro:
   * `inicial` son HERMANOS_INICIALES / CUOTAS_INICIALES, o sea los doce
   * hermanos de la demostración con nombre y apellidos que no existen. Bastaba
   * con crear la hermandad, entrar por primera vez (la copia local se acaba de
   * borrar) y que esa primera consulta fallara —el proyecto de Supabase
   * despertando de la pausa, sin ir más lejos— para que el panel enseñara un
   * censo inventado. La tesorera, creyendo que era el suyo, corregía una ficha.
   */
  function deReserva(): T[] {
    return leerPersistido<T[]>(claveLocal, isSupabaseConfigured ? [] : inicial)
  }

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
          // Supabase no responde (proyecto en pausa, token caducado): se tira de
          // la copia de este navegador para que la página siga viéndose.
          console.error(`No se pudo cargar "${tabla}":`, error.message)
          setItemsState(deReserva())
          // Y NO se marca como cargado. Es lo importante de todo esto: con
          // `cargado` puesto, el primer cambio que hiciera la secretaria
          // dispararía `sincronizar`, que compara la lista de antes con la de
          // después y BORRA en Supabase lo que ya no aparece. Comparar contra
          // una lista que nunca vino de la base es borrar el censo entero.
          avisarDeFallo(tabla, error.message)
        } else {
          const traidos = (data ?? []).map(fromRow)
          setItemsState(traidos)
          if (!sinEspejo) espejarEnLocal(claveLocal, traidos)
          cargado.current = true
        }
      }, (err) => {
        // Rechazo de red (fetch fallido) al consultar Supabase: mismo criterio.
        if (cancelado) return
        console.error(`No se pudo cargar "${tabla}" (red):`, err)
        setItemsState(deReserva())
        avisarDeFallo(tabla, 'sin conexión')
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

  // Lo que escriba otra pestaña (el panel mientras el hermano tiene su área
  // abierta, o al revés) entra aquí sin recargar. Se usa `setItemsState` y no
  // `setItems` a propósito: la otra pestaña ya lo mandó a Supabase.
  useEscuchaOtrasPestanas(claveLocal, (crudo) => {
    // El área del hermano no escucha: lo que ve el panel es el censo entero y
    // lo que ve él es su ficha. Dejarle oír al panel le llenaría la pantalla
    // con los datos de los demás.
    if (sinEspejo) return
    setItemsState((actual) => {
      try {
        return JSON.stringify(actual) === crudo ? actual : (JSON.parse(crudo) as T[])
      } catch {
        return actual
      }
    })
  })

  function setItems(actualizador: Actualizador<T>) {
    setItemsState((prev) => {
      const next = typeof actualizador === 'function' ? (actualizador as (p: T[]) => T[])(prev) : actualizador
      if (!local && supabase) {
        if (cargado.current) sincronizar(tabla, prev, next, toRow)
        if (!sinEspejo) espejarEnLocal(claveLocal, next)
      } else if (!sinEspejo) {
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
