import { useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured } from './supabase'

/**
 * Claves de localStorage de cada colección de datos. Centralizadas aquí para
 * que "Restablecer datos de ejemplo" (Configuración) pueda borrarlas todas y
 * para que el panel de Inicio pueda leerlas sin montar cada módulo.
 * Papeletas y Cortejo comparten la misma clave a propósito: son dos vistas
 * de la misma colección, y al navegar entre ellas cada página se monta de
 * nuevo y lee la última versión guardada.
 */
export const CLAVES_DATOS = {
  hermanos: 'cabildo-hermanos',
  cuotas: 'cabildo-cuotas',
  papeletas: 'cabildo-papeletas',
  incidencias: 'cabildo-incidencias',
  movimientos: 'cabildo-movimientos',
  enseres: 'cabildo-enseres',
  documentos: 'cabildo-documentos',
  comunicados: 'cabildo-comunicados',
  cuentasSociales: 'cabildo-cuentas-sociales',
  eventos: 'cabildo-eventos',
  mandatosSepa: 'cabildo-mandatos-sepa',
  tareasRedes: 'cabildo-tareas-redes',
} as const

/** Lee una colección guardada, o devuelve los datos de ejemplo si aún no hay nada. */
export function leerPersistido<T>(clave: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(clave)
    if (raw) return JSON.parse(raw) as T
  } catch {
    // localStorage no disponible o datos corruptos: seguimos con los de ejemplo
  }
  return fallback
}

/**
 * Como `leerPersistido`, pero para las colecciones de datos de la hermandad
 * (el censo, las cuotas, las papeletas...) cuando hace falta consultarlas
 * desde una pantalla que no es la suya.
 *
 * La diferencia está en qué se devuelve cuando en el navegador no hay nada, y
 * es toda la diferencia del mundo:
 *
 *   · SIN base de datos (demostración): los datos de ejemplo. Es lo que hace
 *     que se pueda enseñar la aplicación funcionando.
 *   · CON base de datos: **vacío**. Ahí, «no hay nada guardado en este
 *     navegador» significa «esta pantalla todavía no ha traído nada», no
 *     «usa el censo de ejemplo».
 *
 * Sin esta distinción, una hermandad recién creada abría el panel y se
 * encontraba con doce hermanos, cuatro cuotas pendientes y un recibo cobrado
 * que no existían: los ejemplos que vienen con la aplicación, colándose como
 * si fueran suyos. Y no era un detalle estético, porque los informes salían
 * cuadrados sobre datos inventados.
 *
 * Mejor enseñar cero que enseñar mentiras.
 */
export function leerDatos<T>(clave: string, ejemplos: T[]): T[] {
  return leerPersistido<T[]>(clave, isSupabaseConfigured ? [] : ejemplos)
}

/**
 * Guarda en localStorage avisando si no cabe. Las imágenes (modelos de
 * papeleta/recibo, fotos de la web) se guardan como base64 y pueden agotar el
 * espacio del navegador (~5 MB); sin este aviso, el fallo sería silencioso y
 * el usuario creería que se guardó cuando no fue así. Devuelve true si se
 * guardó, false si no cupo.
 */
export function guardarConAviso(clave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
    return true
  } catch {
    if (typeof window !== 'undefined') {
      window.alert(
        'No se ha podido guardar: el navegador se ha quedado sin espacio. ' +
          'Usa imágenes más ligeras o quita algunas fotos y vuelve a intentarlo.',
      )
    }
    return false
  }
}

/**
 * Se entera de que OTRA pestaña ha tocado esta clave.
 *
 * Hasta ahora cada colección se leía una sola vez, al montar el componente.
 * Con el panel de la hermandad en una pestaña y el área del hermano en otra
 * —que es como se prueba y como se trabaja de verdad— lo que se hacía en una
 * no aparecía en la otra hasta recargar: el tesorero marcaba una cuota pagada
 * y el hermano seguía viéndola pendiente.
 *
 * El navegador dispara `storage` solo en las DEMÁS pestañas, nunca en la que
 * escribe, así que no hay ida y vuelta posible.
 */
export function useEscuchaOtrasPestanas(clave: string, alCambiar: (crudo: string) => void) {
  const cb = useRef(alCambiar)
  cb.current = alCambiar
  useEffect(() => {
    function alStorage(e: StorageEvent) {
      // `newValue` nulo = la clave se ha borrado (restablecer datos de
      // ejemplo). No se vacía la pantalla a ciegas: esa pestaña recarga sola.
      if (e.key !== clave || e.storageArea !== localStorage || e.newValue == null) return
      cb.current(e.newValue)
    }
    window.addEventListener('storage', alStorage)
    return () => window.removeEventListener('storage', alStorage)
  }, [clave])
}

/**
 * Como useState, pero cada cambio queda guardado en localStorage, de modo
 * que altas, pagos, asignaciones, etc. sobreviven a una recarga de página.
 * Es el paso intermedio hasta conectar Supabase: la firma no cambia, así
 * que sustituirlo por la base de datos real no tocará los componentes.
 */
export function usePersistentState<T>(clave: string, inicial: T) {
  const [value, setValue] = useState<T>(() => leerPersistido(clave, inicial))

  useEffect(() => {
    try {
      localStorage.setItem(clave, JSON.stringify(value))
    } catch {
      // sin espacio o sin localStorage: la app sigue funcionando en memoria
    }
  }, [clave, value])

  // Lo que cambie en otra pestaña se refleja aquí. Si ya es lo mismo se
  // devuelve el estado tal cual: sin cambio de estado no hay efecto, y sin
  // efecto no se vuelve a escribir (que es lo que provocaría un ping-pong).
  useEscuchaOtrasPestanas(clave, (crudo) => {
    setValue((actual) => {
      try {
        return JSON.stringify(actual) === crudo ? actual : (JSON.parse(crudo) as T)
      } catch {
        return actual
      }
    })
  })

  return [value, setValue] as const
}

/** Borra todos los datos guardados y vuelve a los de ejemplo (recarga incluida). */
export function restablecerDatosDeEjemplo() {
  // Todas las claves de la app (colecciones, configuración, catálogos, tramos,
  // campaña…) comparten el prefijo cabildo-; se barre todo salvo la sesión demo.
  Object.keys(localStorage)
    .filter((clave) => clave.startsWith('cabildo-') && clave !== 'cabildo-demo-user')
    .forEach((clave) => localStorage.removeItem(clave))
  window.location.reload()
}
