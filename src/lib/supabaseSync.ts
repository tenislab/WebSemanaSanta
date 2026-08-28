import { traducirErrorDeEscritura, type ErrorTraducido } from './errorDeBaseDeDatos'
import { traerTodasLasFilas } from './paginado'
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
  /*
   * Para no reintentar en bucle. Se pone al reintentar y se quita en cuanto
   * una carga se da por buena, así que el siguiente cero sospechoso —en otro
   * momento, por otra causa— vuelve a tener su segunda oportunidad.
   */
  const reintentado = useRef(false)

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

  /* Lo que hay en pantalla AHORA, para poder mirarlo desde dentro del efecto. */
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    if (local || !supabase) return
    let cancelado = false

    function cargar() {
      if (!supabase) return
      /*
       * POR PÁGINAS, que `select('*')` trae mil filas y calla. Ver
       * `lib/paginado.ts`: el censo de mil doscientos se enseñaba con mil, sin
       * ningún aviso y sin nada que lo delatara en pantalla.
       *
       * Se ordena SIEMPRE, aunque quien llama no haya pedido orden: sin
       * `order`, dos páginas de la misma consulta pueden traer filas repetidas
       * y saltarse otras, porque Postgres no promete ningún orden si no se le
       * pide. Por `id` cuando no hay otro criterio, que es único y estable.
       */
      traerTodasLasFilas<Record<string, unknown>>((desde, hasta) => {
        const q = supabase!.from(tabla).select('*')
        return (orderBy ? q.order(orderBy) : q.order('id')).range(desde, hasta)
      }).then(({ data, error }) => {
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
          /*
           * UN CERO SOSPECHOSO NO SE DA POR BUENO A LA PRIMERA.
           *
           * Esto es lo que se reportó como «registro una papeleta y se borran
           * todos los datos», y el mecanismo es este:
           *
           * RLS NO DA ERROR CUANDO DENIEGA. Devuelve CERO FILAS y un `error`
           * a nulo — indistinguible de una tabla vacía—. Y esta carga se
           * repite en cada `onAuthStateChange`: al refrescarse el token, o en
           * cualquier vaivén de la sesión, hay un instante en que
           * `hermandad_actual()` todavía no resuelve y TODAS las políticas
           * deniegan a la vez.
           *
           * Con la rama de éxito tal como estaba, ese instante significaba:
           * pintar la pantalla vacía Y machacar la copia local con `[]`. O sea
           * que además de quedarse el panel en blanco, se destruía la red de
           * seguridad de la que tira `deReserva()` cuando la base no responde.
           *
           * Así que si la consulta trae CERO y aquí había algo, no se acepta a
           * la primera: se reintenta una vez. Si el segundo intento también
           * viene vacío, es que la tabla está vacía de verdad y se acepta.
           *
           * Se reintenta EN VEZ DE rechazarlo siempre porque vaciar una tabla
           * de verdad tiene que poder verse: si otra persona borra el censo
           * entero desde otro ordenador, este tiene que enterarse. Lo que no
           * puede es enterarse de un «no» de RLS y creerse que es un borrado.
           */
          /*
           * `itemsRef` y no `items`: este efecto solo se vuelve a montar
           * cuando cambia `tabla`, así que la `items` que se ve aquí dentro es
           * la del montaje —vacía— para siempre. Con ella, la comprobación
           * habría dado «no teníamos nada» justo cuando más datos había.
           *
           * Y el área del hermano (`sinEspejo`) se queda fuera a propósito: no
           * tiene copia local, y sus consultas SÍ vienen vacías de verdad
           * mientras no ha entrado.
           */
          const teniamos = !sinEspejo
            && (itemsRef.current.length > 0 || leerPersistido<T[]>(claveLocal, []).length > 0)
          if (traidos.length === 0 && teniamos && !reintentado.current) {
            reintentado.current = true
            console.warn(
              `"${tabla}" ha devuelto CERO filas donde había datos. `
              + 'Puede ser un rechazo de permisos (RLS no da error al denegar): se reintenta.',
            )
            setTimeout(() => { if (!cancelado) cargar() }, 600)
            return
          }
          reintentado.current = false
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
  /*
   * Y traducidos. `crear: new row violates row-level security policy for table
   * "hermanos"` es exacto y no sirve de nada: dice que la base ha dicho que no,
   * no qué le falta a la cuenta ni a dónde ir. Detrás de ese mensaje había tres
   * cosas que parecían tres fallos —el censo importado que «desaparecía», las
   * altas que no se podían aceptar y el hermano que no se dejaba crear— y era
   * el mismo rechazo las tres veces.
   */
  const traducidos: ErrorTraducido[] = []
  function anotar(operacion: string, prefijo: string, error: { message: string; code?: string }) {
    fallos.push(`${prefijo}: ${error.message}`)
    traducidos.push(traducirErrorDeEscritura(tabla, operacion, error.message, error.code))
  }
  /*
   * DE DOSCIENTOS EN DOSCIENTOS, y no todo de una vez.
   *
   * Esto es lo que hace falta el día que una hermandad importa su censo de
   * verdad. Con doce hermanos de prueba da igual; con seiscientos, no:
   *
   *   · El BORRADO iba con `.in('id', [...])`, que PostgREST escribe en la
   *     DIRECCIÓN. Seiscientos identificadores son unos veintidós mil
   *     caracteres de URL, y el servidor la rechaza entera («414 Request-URI
   *     Too Large»). O sea: vaciar el censo para volver a importarlo fallaba
   *     justo en los censos grandes, que son los únicos que se vacían.
   *   · El ALTA iba en una sola petición. Un cuerpo de varios megas —y con
   *     fotos dentro, más— se queda en el camino; y si la base rechaza UNA
   *     fila, se cae la petición entera y no entra ninguna de las seiscientas.
   *
   * Troceado, un tropiezo se lleva doscientas y no seiscientas, y lo que sí ha
   * entrado se queda. El aviso dice cuántas han fallado, que es lo que
   * necesita saber quien está mirando.
   */
  const DE_UNA_VEZ = 200
  /*
   * EL BORRADO VA DE CIEN, no de doscientos, y no es una manía.
   *
   * `.in('id', […])` lo escribe PostgREST en la DIRECCIÓN, y un identificador
   * es un UUID de 36 caracteres: doscientos son unos ocho mil de URL, que es
   * justo el tope que traen de fábrica casi todos los servidores y proxys. Un
   * trozo de doscientos pasa hoy y deja de pasar el día que alguien pone un
   * proxy delante, con un «414» que no dice nada. Con cien van cuatro mil, que
   * cabe con holgura en cualquier sitio.
   */
  const DE_UNA_VEZ_BORRAR = 100
  const trozos = <X,>(xs: X[], cuantos = DE_UNA_VEZ): X[][] => {
    const partes: X[][] = []
    for (let i = 0; i < xs.length; i += cuantos) partes.push(xs.slice(i, i + cuantos))
    return partes
  }
  try {
    for (const parte of trozos(eliminados, DE_UNA_VEZ_BORRAR)) {
      const { error } = await supabase.from(tabla).delete().in('id', parte.map((e) => e.id))
      if (error) anotar('borrar', `borrar ${parte.length}`, error)
    }
    for (const parte of trozos(nuevos)) {
      const { error } = await supabase.from(tabla).insert(parte.map(toRow))
      if (error) anotar('crear', `crear ${parte.length}`, error)
    }
    /*
     * LAS MODIFICACIONES: SIGUEN SIENDO UNA POR FILA, PERO EN PARALELO.
     *
     * El problema de partida es real: aquí iba una petición por fila, una
     * detrás de otra. El día que una hermandad vuelve a importar su censo de
     * mil doscientos para actualizarlo —que es un botón, y está en Ajustes—
     * son mil doscientas esperas seguidas: minuto y medio largo con la
     * pantalla diciendo que ya está guardado, y quien cambie de sección a la
     * mitad deja la mitad de las fichas sin actualizar y sin aviso.
     *
     * LO QUE NO SE PUEDE HACER ES `upsert`, aunque sea lo obvio y aunque haga
     * lo mismo que `update` cuando la fila ya existe. PostgREST lo manda como
     * `insert … on conflict do update`, y Postgres comprueba la política de
     * INSERCIÓN aunque acabe actualizando. El hermano tiene permiso para
     * cambiar SU ficha (`hermanos_propio_update`) y no tiene ninguno para
     * crear hermanos —ni debe tenerlo—, así que con `upsert` dejaría de poder
     * cambiar su propio correo o su contraseña, con un «no tienes permiso»
     * que no viene a cuento.
     *
     * Así que se quedan de una en una y se lanzan de seis en seis. Mil
     * doscientas esperas pasan a doscientas, y cada fallo sigue diciendo QUÉ
     * fila ha sido, que es más de lo que diría un envío en bloque.
     */
    const A_LA_VEZ = 6
    for (let i = 0; i < posiblesCambios.length; i += A_LA_VEZ) {
      await Promise.all(posiblesCambios.slice(i, i + A_LA_VEZ).map(async (item) => {
        const { error } = await supabase!.from(tabla).update(toRow(item)).eq('id', item.id)
        if (error) anotar('guardar', `guardar ${item.id}`, error)
      }))
    }
  } catch (err) {
    fallos.push(String(err))
  }
  if (fallos.length > 0) {
    console.error(`No se pudo sincronizar "${tabla}" con Supabase:`, fallos.join(' · '))
    // Aviso visible: quien está usando la app debe enterarse de que lo que ve
    // en pantalla no ha llegado a la base de datos.
    window.dispatchEvent(new CustomEvent('cabildo-sync-error', { detail: { tabla, fallos, traducidos } }))
  }
}
