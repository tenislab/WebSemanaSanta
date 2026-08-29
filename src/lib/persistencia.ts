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
  // La tienda. Las VENTAS no están aquí a propósito: no se editan desde la
  // pantalla —se registran con una función de la base— así que una copia
  // local solo serviría para enseñar un total que ya no es el de la base.
  productos: 'cabildo-productos',
  descuentos: 'cabildo-descuentos',
  /*
   * Lo que se ha vendido, SOLO EN LA DEMOSTRACIÓN.
   *
   * Con base de datos conectada estas tres no se usan: las ventas las escribe
   * `registrar_venta` y de ahí se leen, porque una factura son seis cosas que
   * tienen que pasar juntas. Aquí viven para que la tienda se pueda enseñar
   * entera sin base de datos, que es como se prueba Gobergo. Ver
   * `lib/tiendaLocal.ts`.
   */
  ventas: 'cabildo-ventas',
  lineasVenta: 'cabildo-lineas-venta',
  movimientosStock: 'cabildo-movimientos-stock',
  reservas: 'cabildo-reservas-tienda',
  lineasReserva: 'cabildo-lineas-reserva',
  // Campañas de recaudación y proyectos. Lo RECAUDADO no está aquí: se cuenta
  // desde los apuntes de Tesorería cada vez, para que no haya dos verdades
  // sobre el mismo dinero. Ver `lib/recaudaciones.ts`.
  recaudaciones: 'cabildo-recaudaciones',
  proyectos: 'cabildo-proyectos',
  tareasProyecto: 'cabildo-tareas-proyecto',
  // Las reglas porcentuales de la cuenta de pérdidas y ganancias. NO son
  // apuntes: no escriben en Tesorería nunca. Ver `lib/repartos.ts`.
  repartos: 'cabildo-repartos',
} as const

/**
 * ¿Lo guardado tiene LA MISMA FORMA que lo que se esperaba?
 *
 * No compara campo a campo —eso sería un validador y aquí no hace falta—:
 * compara la CLASE de valor. Una lista donde se esperaba una lista, un objeto
 * donde se esperaba un objeto, un texto donde se esperaba un texto. Es lo justo
 * para que nadie llame a `.filter` sobre algo que no es una lista.
 */
function mismaForma(valor: unknown, esperado: unknown): boolean {
  // `null` solo vale si lo que se esperaba TAMBIÉN podía ser nulo. Este es el
  // caso que más daño hacía: `JSON.parse('null')` devuelve `null`, y `null`
  // pasaba de largo hasta que alguien le pedía `.length`.
  if (valor === null || valor === undefined) return esperado === null
  if (Array.isArray(esperado)) return Array.isArray(valor)
  if (esperado === null) return typeof valor === 'object'
  if (typeof esperado === 'object') return typeof valor === 'object' && !Array.isArray(valor)
  return typeof valor === typeof esperado
}

/**
 * LEE UNA COLECCIÓN GUARDADA, o devuelve lo que se le diga si no hay nada
 * —o si lo que hay no sirve—.
 *
 * ESA SEGUNDA MITAD ES EL ARREGLO DE UN FALLO QUE COSTÓ CARO, y conviene
 * dejarlo escrito porque la versión de antes parecía correcta:
 *
 *     const raw = localStorage.getItem(clave)
 *     if (raw) return JSON.parse(raw) as T
 *
 * El `as T` es una promesa que TypeScript se cree y que nadie comprueba. Si en
 * el navegador había un `null` —de una versión antigua, de un guardado a
 * medias, de una migración— esto devolvía `null`, y la pantalla siguiente
 * hacía `hermanos.filter(...)` sobre él. React desmonta el árbol entero cuando
 * algo revienta al pintar, así que el resultado era LA PÁGINA EN BLANCO.
 *
 * Y en blanco de verdad: sin mensaje, sin pista, y solo en el navegador de esa
 * persona —en una ventana privada no hay nada guardado y por eso ahí sí
 * arrancaba—. Barriendo las 35 claves con dos formas equivocadas salieron 25
 * combinaciones que tumbaban la aplicación entera; entre ellas el censo, las
 * cuotas, las papeletas, los movimientos, el personal y la suscripción.
 *
 * Ahora, un dato con la forma equivocada se descarta y se sigue con el valor
 * por defecto: la pantalla saldrá vacía, que es incómodo pero se entiende y se
 * puede contar por teléfono. Se avisa por consola para que quede rastro de
 * QUÉ clave estaba mal.
 */
export function leerPersistido<T>(clave: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(clave)
    if (raw === null) return fallback
    const valor = JSON.parse(raw) as unknown
    if (!mismaForma(valor, fallback)) {
      console.warn(`«${clave}» está guardado con una forma que no se esperaba: se ignora.`)
      return fallback
    }
    return valor as T
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
