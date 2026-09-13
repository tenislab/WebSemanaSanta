/**
 * LO QUE SE ESTÁ ROMPIENDO EN PRODUCCIÓN, PARA PODER MIRARLO.
 *
 * `lib/vigilancia.ts` recoge desde hace semanas todo lo que revienta en el
 * navegador de una hermandad y lo deja en `errores_cliente`. Y ahí se quedaba:
 * NO HABÍA NINGUNA PANTALLA QUE LO LEYERA. Se recogía y no lo miraba nadie ni
 * una vez, que es la peor de las dos formas de no tener vigilancia —la otra,
 * no recogerlos, al menos no engaña.
 *
 * Lo pide la fase 6 del plan de bugs con estas palabras: «falta mirarlo: un
 * sitio en la aplicación que lo enseñe, y la costumbre de abrirlo».
 *
 * ----------------------------------------------------------------------------
 * SOLO SOPORTE, Y NO ES UNA DECISIÓN NUEVA
 * ----------------------------------------------------------------------------
 *
 * `supabase/vigilancia.sql` dejó escrito por qué la tabla no tiene política de
 * lectura: «TypeError: Cannot read properties of undefined» no es información
 * para una secretaria, y sí es un motivo para preocuparse. Los fallos son para
 * quien los puede arreglar. Eso no se toca: el candado está en la base
 * (`es_soporte()` dentro de `errores_de_produccion`), no aquí — para cualquier
 * otra cuenta la lista llega vacía aunque alguien se invente la dirección.
 *
 * ----------------------------------------------------------------------------
 * Y NO LANZA NUNCA
 * ----------------------------------------------------------------------------
 *
 * Igual que `soporte.ts`. Una base que todavía no tenga la función —porque no
 * se ha pegado el SQL nuevo— contesta con un error, y aquí eso es «no hay nada
 * que enseñar»: una pantalla de diagnóstico que revienta al abrirla es un
 * chiste malo.
 */
import { isSupabaseConfigured, supabase } from './supabase'

export interface ErrorAgrupado {
  /** El mensaje, ya limpio de números y fechas: es la clave por la que se agrupa. */
  mensaje: string
  /** 'js' (el navegador), 'promesa' (un await sin recoger) o 'base' (la base lo rechazó). */
  clase: string
  /** Cuántas veces ha pasado en la ventana pedida. */
  veces: number
  /** En cuántas hermandades distintas. Es lo que dice si es el código o un ordenador. */
  hermandades: number
  /** La última vez, en ISO. */
  ultima: string
  /** Dónde estaba la última vez que pasó. */
  ruta: string
  /** Con qué versión de la aplicación. Dice si sigue pasando con el arreglo puesto. */
  versionApp: string
  /** La pila del último. En producción viene comprimida, pero distingue dos fallos. */
  pila: string
}

/** Cuántos días se miran por defecto. La tabla se limpia a los 60. */
export const DIAS_POR_DEFECTO = 7

/**
 * Los fallos agrupados por mensaje, lo más reciente primero.
 *
 * Devuelve `[]` sin base de datos, sin la función puesta, o si quien pregunta
 * no es una cuenta de soporte. Los tres casos son «nada que enseñar» y ninguno
 * es un error que haya que pintar.
 */
export async function erroresDeProduccion(dias = DIAS_POR_DEFECTO): Promise<ErrorAgrupado[]> {
  if (!isSupabaseConfigured || !supabase) return []
  try {
    const { data, error } = await supabase.rpc('errores_de_produccion', { p_dias: dias })
    if (error || !Array.isArray(data)) return []
    return (data as Record<string, unknown>[]).map((f) => ({
      mensaje: String(f.mensaje ?? ''),
      clase: String(f.clase ?? 'js'),
      veces: Number(f.veces ?? 0),
      hermandades: Number(f.hermandades ?? 0),
      ultima: String(f.ultima ?? ''),
      ruta: String(f.ruta ?? ''),
      versionApp: String(f.version_app ?? ''),
      pila: String(f.pila ?? ''),
    }))
  } catch {
    return []
  }
}

/**
 * Una frase con lo que hay, para el resumen de arriba.
 *
 * Se separa de la pantalla porque es la única parte con decisiones —singular y
 * plural, y distinguir «no se rompe nada» de «no lo sé»— y así se puede
 * comprobar con datos en vez de leyendo el JSX.
 */
export function comoVaLaCosa(errores: ErrorAgrupado[], dias: number): string {
  if (errores.length === 0) return `Ni un fallo en los últimos ${dias} días.`
  const veces = errores.reduce((t, e) => t + e.veces, 0)
  const distintos = errores.length === 1 ? '1 fallo distinto' : `${errores.length} fallos distintos`
  const total = veces === 1 ? '1 vez' : `${veces} veces`
  return `${distintos}, ${total} en ${dias} días.`
}

/**
 * ¿Es un fallo que le pasa a varias hermandades? Entonces es el código, no el
 * ordenador de alguien — y es lo primero que se quiere saber para ordenar el
 * trabajo. Con una sola hermandad puede ser su navegador, su red o su móvil.
 */
export function esDeTodos(e: ErrorAgrupado): boolean {
  return e.hermandades > 1
}
