/**
 * «He olvidado mi contraseña»: saber que estamos atendiendo una recuperación.
 *
 * POR QUÉ NO BASTA CON MIRAR LA DIRECCIÓN
 *
 * La primera versión de esto leía `window.location.hash` buscando
 * `type=recovery`. Y no funcionaba nunca. Dos motivos, y el segundo es el
 * gordo:
 *
 * 1. `detectSessionInUrl` está encendido, así que supabase-js procesa el
 *    enlace y BORRA lo que venga detrás de la almohadilla nada más arrancar.
 *    Eso pasa al importar el módulo, o sea antes de que React pinte nada: para
 *    cuando la pantalla mira la dirección, ya está limpia.
 *
 * 2. Y sobre todo: supabase-js 2.x usa **PKCE** por defecto en el navegador.
 *    Con PKCE el enlace del correo NO trae `#access_token=…&type=recovery`,
 *    trae `?code=…` como parámetro normal. O sea que `type=recovery` no
 *    aparece en la almohadilla jamás, porque no hay almohadilla.
 *
 * Resultado: el hermano pulsaba el enlace del correo, aterrizaba en su área
 * como si hubiera entrado por su cuenta, y no había manera de cambiar la
 * contraseña. El correo llegaba perfecto y el enlace llevaba al sitio correcto;
 * lo que fallaba era lo de después.
 *
 * LO QUE SÍ FUNCIONA
 *
 * `onAuthStateChange` emite `PASSWORD_RECOVERY` cuando procesa uno de esos
 * enlaces, venga como venga. Ese aviso es el bueno: no depende del formato de
 * la dirección ni de quién llegue antes.
 *
 * Se apunta en `sessionStorage` porque el aviso llega UNA vez y la pantalla se
 * vuelve a dibujar muchas. Y en sessionStorage y no en localStorage porque
 * tiene que morirse al cerrar la pestaña: es un permiso temporal para cambiar
 * una contraseña, no algo que deba sobrevivir a apagar el ordenador.
 */

export const CLAVE_RECUPERACION = 'gobergo-recuperando-clave'

function guardar(valor: string | null) {
  try {
    if (valor === null) sessionStorage.removeItem(CLAVE_RECUPERACION)
    else sessionStorage.setItem(CLAVE_RECUPERACION, valor)
  } catch {
    // Sin sessionStorage (navegación privada de algunos navegadores). Se
    // seguirá sin recordar entre redibujados, que es peor pero no rompe nada.
  }
}

/** Queda constancia de que hay una recuperación en marcha. */
export function marcarRecuperacion(): void {
  guardar('si')
}

/** Se acabó: la contraseña ya se ha cambiado, o se ha salido de ahí. */
export function olvidarRecuperacion(): void {
  guardar(null)
}

/**
 * ¿Hay una recuperación en marcha?
 *
 * Se mira también la dirección, por si el proyecto está configurado con el
 * flujo antiguo (`implicit`), donde sí llega `type=recovery` en la almohadilla.
 * Es un por si acaso barato: lo que de verdad sostiene esto es el aviso de
 * `PASSWORD_RECOVERY`.
 */
export function hayRecuperacionEnMarcha(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const tras = window.location.hash.slice(1)
    if (/(^|&)type=recovery(&|$)/.test(tras)) {
      marcarRecuperacion()
      // Fuera de la barra de direcciones: si se queda, acaba en el historial
      // del navegador y en cualquier captura que haga el hermano para pedir
      // ayuda.
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      return true
    }
    return sessionStorage.getItem(CLAVE_RECUPERACION) === 'si'
  } catch {
    return false
  }
}

/**
 * Se queda a la escucha del aviso de Supabase.
 *
 * Se llama al crear el cliente, que es lo primero que pasa en la aplicación.
 * Registrarlo más tarde —dentro de una pantalla, por ejemplo— llegaría tarde:
 * el aviso se emite mientras se procesa el enlace, antes de que ninguna
 * pantalla exista.
 */
export function vigilarRecuperacionDeClave(cliente: {
  auth: { onAuthStateChange: (fn: (evento: string) => void) => unknown }
}): void {
  try {
    cliente.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') marcarRecuperacion()
    })
  } catch {
    // Un cliente que no lo soporte no debe impedir que arranque la aplicación.
  }
}
