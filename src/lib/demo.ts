import { CLAVES_DATOS } from './persistencia'

/**
 * Modo demostración con dos puntos de partida, para probar la app sin base de
 * datos:
 *   - LLENA: censo, papeletas, cuotas… de ejemplo (para ver funciones ya con
 *     datos).
 *   - VACÍA: una hermandad sin hermanos ni registros (para empezar de cero y
 *     crear tus propios datos), pero con la configuración por defecto (tramos,
 *     cargos, campaña) para que todo siga funcionando.
 *
 * Ambas escriben en localStorage y NO tocan el usuario demo. Los módulos leen
 * su colección al montarse, así que basta con navegar o recargar para verlo.
 */

/** Colecciones de personas y registros que se vacían en la demo vacía. */
const CLAVES_COLECCIONES = [
  CLAVES_DATOS.hermanos,
  CLAVES_DATOS.cuotas,
  CLAVES_DATOS.papeletas,
  CLAVES_DATOS.incidencias,
  CLAVES_DATOS.movimientos,
  CLAVES_DATOS.enseres,
  CLAVES_DATOS.documentos,
  CLAVES_DATOS.comunicados,
  CLAVES_DATOS.cuentasSociales,
  CLAVES_DATOS.eventos,
  'cabildo-solicitudes-papeleta',
  'cabildo-convocatoria',
  // Personal con acceso al panel: en una hermandad vacía tampoco hay cargos
  // de ejemplo (si no, la demo «de cero» aparecía con seis accesos creados).
  'cabildo-personal',
]

/** Se conservan al restablecer una demo (sesión demo y consentimiento del hermano). */
const CLAVES_CONSERVADAS = new Set(['cabildo-demo-user', 'cabildo-hermano-consent'])

const CLAVE_MODO = 'cabildo-demo-modo'

/** Borra todo dato guardado de la app salvo las claves que se conservan. */
function limpiarTodo() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('cabildo-') && !CLAVES_CONSERVADAS.has(k))
    .forEach((k) => localStorage.removeItem(k))
}

/** Deja el navegador con los datos de ejemplo completos (censo, papeletas, cuotas…). */
export function sembrarDemoLlena() {
  limpiarTodo()
  localStorage.setItem(CLAVE_MODO, 'llena')
}

/** Deja una hermandad vacía: sin hermanos, papeletas ni registros (config por defecto). */
export function sembrarDemoVacia() {
  limpiarTodo()
  CLAVES_COLECCIONES.forEach((k) => localStorage.setItem(k, '[]'))
  localStorage.setItem(CLAVE_MODO, 'vacia')
}

/**
 * Restaura solo el censo/papeletas/cuotas de ejemplo, sin tocar el resto
 * (web, colores, tramos…). Sirve para que el acceso demo del hermano funcione
 * siempre, aunque el navegador tenga un censo viejo de pruebas anteriores.
 */
export function restaurarCensoDemo() {
  localStorage.removeItem(CLAVES_DATOS.hermanos)
  localStorage.removeItem(CLAVES_DATOS.papeletas)
  localStorage.removeItem(CLAVES_DATOS.cuotas)
}

/** Punto de partida de demo activo, si se eligió alguno. */
export function demoModo(): 'llena' | 'vacia' | null {
  try {
    const v = localStorage.getItem(CLAVE_MODO) ?? sessionStorage.getItem(CLAVE_MODO)
    return v === 'llena' || v === 'vacia' ? v : null
  } catch {
    return null
  }
}

/**
 * ¿Estamos en modo demo? Cuando lo estamos, los datos deben leerse en local
 * (censo, papeletas… de ejemplo) sin depender de Supabase, aunque el proyecto
 * esté configurado pero en pausa. Así el acceso demo funciona siempre.
 */
export function modoDemoActivo(): boolean {
  try {
    // Los dos sitios: en `localStorage` lo deja «sembrar datos de ejemplo»
    // (deliberado, dura entre sesiones); en `sessionStorage`, el acceso rápido
    // del portal del hermano, que solo debe durar esta pestaña.
    return localStorage.getItem(CLAVE_MODO) !== null || sessionStorage.getItem(CLAVE_MODO) !== null
  } catch {
    return false
  }
}

/**
 * Marca el modo demo (sin borrar nada) si aún no había ninguno elegido.
 *
 * En `sessionStorage`, no en `localStorage`: la marca no debe sobrevivir al
 * cierre del navegador. Un clic en «entrar en modo demo» dejaba el panel
 * trabajando SOLO contra el navegador —sin escribir en la base de datos y sin
 * avisar de nada— para siempre, y la secretaría podía pasar días dando altas
 * que no existían en ningún otro sitio.
 */
export function marcarModoDemo() {
  try {
    if (!sessionStorage.getItem(CLAVE_MODO) && !localStorage.getItem(CLAVE_MODO)) {
      sessionStorage.setItem(CLAVE_MODO, 'llena')
    }
  } catch {
    // sin almacenamiento: la app sigue en memoria
  }
}

/** Sale del modo demo (p. ej. al iniciar sesión de verdad contra Supabase). */
export function limpiarModoDemo() {
  try {
    localStorage.removeItem(CLAVE_MODO)
    sessionStorage.removeItem(CLAVE_MODO)
  } catch {
    // nada que hacer
  }
}
