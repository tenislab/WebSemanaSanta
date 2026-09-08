/**
 * NOVEDADES: ENCENDER UNA FUNCIÓN NUEVA PARA UNA HERMANDAD ANTES QUE PARA TODAS.
 *
 * ============================================================================
 * SI ERES UN PROGRAMADOR Y ACABAS DE LLEGAR
 * ============================================================================
 *
 * Gobergo es una sola página que se despliega de golpe. No hay «solo el 5 %», no
 * hay vuelta atrás gradual: subes el paquete y a los cinco minutos lo tienen
 * todas las hermandades. Un despliegue malo las rompe a todas a la vez, y si
 * cae en Semana Santa —que es la semana en que se imprimen las papeletas— no
 * hay margen para «lo miramos el lunes».
 *
 * Esto no arregla el despliegue: arregla lo otro, que es lo que hace falta el
 * 90 % de las veces. El código nuevo se despliega a todos y SOLO SE ENCIENDE
 * para quien tú digas, desde una línea de SQL. Apagarlo tarda diez segundos y
 * no depende de reconstruir nada.
 *
 * El detalle de la tabla y de cómo se enciende está en
 * `supabase/canal-de-actualizacion.sql`.
 *
 * ----------------------------------------------------------------------------
 * CÓMO SE USA, EN TRES LÍNEAS
 * ----------------------------------------------------------------------------
 *
 *     import { esNovedad, NOVEDADES } from '../lib/novedades'
 *
 *     if (esNovedad(NOVEDADES.cuotasVentana)) {
 *       // el camino nuevo
 *     } else {
 *       // EL DE SIEMPRE, que sigue aquí entero
 *     }
 *
 * ----------------------------------------------------------------------------
 * LAS TRES REGLAS. LA TERCERA ES LA QUE DE VERDAD IMPORTA.
 * ----------------------------------------------------------------------------
 *
 *   1. `esNovedad()` ES SÍNCRONA y responde al instante. Lee de una lista que
 *      se trajo al arrancar. Una bandera que hubiera que esperar no se podría
 *      consultar dentro de un `render`, y entonces no serviría para nada.
 *
 *   2. LO QUE NO SE SABE ESTÁ APAGADO. Antes de que llegue la lista, mientras
 *      llega, si la consulta falla, si la base está atrasada y no tiene la
 *      tabla: `esNovedad()` devuelve `false`. Siempre. El camino que lleva años
 *      funcionando es el que gana cuando hay dudas.
 *
 *   3. LA BANDERA ENVUELVE CÓDIGO NUEVO; NUNCA SUSTITUYE AL VIEJO.
 *
 *      Esta es la regla que hay que respetar de verdad, y la única que ninguna
 *      prueba puede comprobar por ti. El camino de siempre tiene que seguir
 *      ahí, entero y funcionando, mientras la bandera exista. Si borras el
 *      camino viejo «porque ya está el nuevo», la bandera deja de ser una
 *      marcha atrás y pasa a ser un interruptor entre «funciona» y «no
 *      funciona» — que es exactamente lo que se estaba evitando.
 *
 *      Cuando la novedad lleve meses en 'estable' y ya no pienses volver
 *      atrás: borra la bandera Y el camino viejo, en el mismo commit. Una
 *      bandera que se queda para siempre es deuda; dos caminos que se quedan
 *      para siempre son dos caminos que mantener.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { modoDemoActivo } from './demo'

/**
 * LAS BANDERAS QUE EXISTEN, con su nombre tal como está en la tabla.
 *
 * Están aquí y no sueltas por el código para que se puedan contar: una lista de
 * banderas es una lista de cosas a medio terminar, y conviene que se vea de un
 * vistazo cuántas hay.
 */
export const NOVEDADES = {
  /**
   * Cuotas y Papeletas se traen solo los dos últimos ejercicios en vez del
   * histórico entero. Ver `src/lib/supabaseSync.ts`, la sección de la ventana.
   *
   * Va detrás de bandera porque cambia QUÉ DATOS HAY EN PANTALLA, que es la
   * clase de cambio en la que un fallo no se ve hasta que alguien echa en falta
   * un recibo de hace tres años.
   */
  cuotasVentana: 'cuotas-ventana',
} as const

export type ClaveNovedad = (typeof NOVEDADES)[keyof typeof NOVEDADES]

/**
 * Lo que está encendido para esta hermandad. Empieza vacío: ver la regla 2.
 *
 * Un `Set` de módulo y no un estado de React a propósito — lo consultan
 * funciones puras que no son componentes, y pasarlo por contexto obligaría a
 * convertirlas en hooks para nada.
 */
let encendidas = new Set<string>()

/** ¿Está encendida esta novedad para la hermandad de quien está dentro? */
export function esNovedad(clave: ClaveNovedad): boolean {
  return encendidas.has(clave)
}

/**
 * Trae la lista de la base. Se llama UNA VEZ al arrancar, desde `AppShell`.
 *
 * NO LANZA NUNCA y no hay que esperarla para pintar: mientras no conteste,
 * todo está apagado, que es el estado correcto. Si contesta tarde, las
 * pantallas que ya estén pintadas no cambian solas — y está bien: encender una
 * función a mitad de rellenar un formulario sería peor que encenderla al
 * recargar.
 */
export async function traerNovedades(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return
  if (modoDemoActivo()) return
  try {
    const { data, error } = await supabase.rpc('mis_novedades')
    if (error || !Array.isArray(data)) return
    encendidas = new Set(data.map((x) => String(x)))
  } catch {
    // Regla 2: si no se sabe, se queda apagado.
  }
}

/** Solo para las pruebas. */
export function ponerNovedadesParaPruebas(claves: string[]): void {
  encendidas = new Set(claves)
}
