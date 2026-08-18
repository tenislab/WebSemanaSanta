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
