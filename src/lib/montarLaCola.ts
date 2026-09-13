/**
 * LA CAJA QUE SABE HABLAR CON SUPABASE, para que la cola no tenga que saberlo.
 *
 * `colaEscritura.ts` decide QUÉ se reintenta y en qué orden, y no importa nada
 * de la base: así se puede probar entera con datos, que es la única forma de
 * comprobar una cola —con red de verdad no se puede provocar un corte cuando
 * uno quiere—. Aquí vive lo otro: cómo se escribe cada entrada, y cuándo se
 * intenta.
 *
 * CUÁNDO SE INTENTA, que es la mitad del asunto:
 *
 *   · Al arrancar la aplicación. El diputado llega a casa, abre el panel, y lo
 *     de la madrugada entra sin que él haga nada.
 *   · Al volver la conexión (`online`). Es el caso bueno: se sale del túnel,
 *     el móvil engancha, y se manda sin haber cerrado la aplicación.
 *   · Al volver a la pestaña (`visibilitychange`). Porque `online` NO SALTA
 *     cuando el wifi tenía señal pero no salida a internet —la mitad de los
 *     casos de una casa de hermandad— y ahí el único aviso es que la persona
 *     vuelve a mirar.
 */
import { supabase } from './supabase'
import { hermandadActualId } from './multiHermandad'
import { leerCola, soltarLaCola, type Pendiente, type Respuesta } from './colaEscritura'

/** Escribe UNA entrada. Devuelve `null` si ha entrado, o el error tal cual. */
async function escribirEnLaBase(entrada: Pendiente): Promise<Respuesta> {
  if (!supabase) return { message: 'sin conexión: no hay cliente de base de datos' }
  if (entrada.clase === 'bloque') {
    /*
     * La hermandad DE LA ENTRADA, no la de ahora. `intentarLaCola` ya ha
     * filtrado para que sean la misma; usar la de la entrada es lo que hace que
     * siga siendo verdad si algo cambia entre medias.
     */
    if (!entrada.hermandadId) return { message: 'sin conexión: no se sabe de qué hermandad es' }
    const { error } = await supabase
      .from('hermandad_settings')
      .upsert({ hermandad_id: entrada.hermandadId, [entrada.cual]: entrada.valor }, { onConflict: 'hermandad_id' })
    return error ? { message: error.message, code: error.code } : null
  }
  const t = supabase.from(entrada.tabla)
  const { error } = entrada.op === 'borrar'
    ? await t.delete().eq('id', entrada.filaId)
    : entrada.op === 'crear'
      ? await t.insert(entrada.fila)
      : await t.update(entrada.fila).eq('id', entrada.filaId)
  return error ? { message: error.message, code: error.code } : null
}

/**
 * Suelta la cola ahora. Devuelve cuántas han entrado.
 *
 * SOLO LO DE LA HERMANDAD DE ESTA SESIÓN. En el ordenador de la casa de
 * hermandad entra gente distinta, y una cuenta puede llevar dos hermandades:
 * mandar la cola bajo la sesión equivocada sería escribir los datos de una en
 * la otra. Lo que no es de esta se queda esperando, sin tocarse.
 */
export async function intentarLaCola(): Promise<number> {
  if (leerCola().length === 0) return 0
  const deQuien = await hermandadActualId()
  if (!deQuien) return 0
  const { hechas } = await soltarLaCola(escribirEnLaBase, deQuien)
  return hechas.length
}

let montada = false

/**
 * Engancha los tres momentos. Se llama una vez, desde el marco de la
 * aplicación. Devuelve la función de desenganche.
 */
export function montarLaCola(): () => void {
  if (typeof window === 'undefined' || montada) return () => {}
  montada = true
  const intentar = () => { void intentarLaCola() }
  // Al arrancar, pero no en el mismo instante: primero que se pinte la
  // pantalla. Quien abre la aplicación viene a hacer algo, no a esperar.
  const alArrancar = window.setTimeout(intentar, 1500)
  const alVolverLaVista = () => { if (document.visibilityState === 'visible') intentar() }
  window.addEventListener('online', intentar)
  document.addEventListener('visibilitychange', alVolverLaVista)
  return () => {
    window.clearTimeout(alArrancar)
    window.removeEventListener('online', intentar)
    document.removeEventListener('visibilitychange', alVolverLaVista)
    montada = false
  }
}
