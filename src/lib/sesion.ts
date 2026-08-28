/**
 * ¿Hay alguien con sesión abierta en este navegador? Se usa para decidir si se
 * permite la vista previa de la web (?preview=1), que solo tiene sentido desde
 * el panel: sin esta comprobación cualquier visitante podía ver una web sin
 * publicar o de una hermandad sin el pack contratado.
 *
 * Mira tanto la sesión de demostración como la de Supabase (que guarda su
 * token en localStorage con una clave sb-…-auth-token).
 */
export function haySesionAbierta(): boolean {
  try {
    if (sessionStorage.getItem('cabildo-demo-user')) return true
    return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  } catch {
    return false
  }
}

/**
 * LA SESIÓN DEL ÁREA DEL HERMANO.
 *
 * Vive aparte de la de Supabase y en `sessionStorage`: dice QUÉ HERMANO está
 * mirando su área, que no es lo mismo que qué cuenta tiene abierta la sesión.
 *
 * La clave estaba dentro de `HermanoPortal.tsx` y por eso nadie más podía
 * cerrarla — que es justo lo que fallaba. Aquí la ven los dos lados.
 */
export const CLAVE_SESION_HERMANO = 'cabildo-hermano-portal'

/**
 * CERRAR SESIÓN DE VERDAD, LOS DOS SITIOS A LA VEZ.
 *
 * Había DOS sesiones distintas en el mismo navegador —la de Supabase y la del
 * área del hermano— y cada «cerrar sesión» limpiaba solo la suya:
 *
 *   · El portal cerraba las dos. Bien.
 *   · El panel cerraba la de Supabase y DEJABA PUESTA la del hermano.
 *
 * Con eso, quien entraba por su área y luego cerraba sesión desde el panel se
 * encontraba, al volver a `/hermano`, dentro otra vez —sin sesión de Supabase
 * detrás— y la aplicación lo llevaba a su área en vez de a la de gestión. Es
 * lo que llegó como «no se cierra bien sesión y al entrar se va al panel de
 * hermano, no al de la hermandad».
 *
 * Y EN LA CASA DE HERMANDAD ES ADEMÁS UN PROBLEMA DE VERDAD: el ordenador lo
 * usan varios. Cerrar sesión y que el siguiente que abra el área vea el nombre,
 * las cuotas y la papeleta del anterior no es un despiste de navegación.
 *
 * Se muere sola al cerrar la pestaña —es `sessionStorage`— pero cerrar sesión
 * tiene que significar cerrar sesión, no «hasta que cierres el navegador».
 */
export function olvidarSesionDelHermano(): void {
  try {
    sessionStorage.removeItem(CLAVE_SESION_HERMANO)
  } catch {
    // Sin sessionStorage (navegación privada de algunos navegadores): no hay
    // nada que borrar, así que tampoco hay nada que arreglar.
  }
}
