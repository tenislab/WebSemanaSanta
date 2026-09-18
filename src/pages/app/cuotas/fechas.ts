/**
 * LAS DOS FECHAS DE LOS RECIBOS.
 *
 * Viven aparte porque las usan la pantalla y la remesa, y la remesa se fue a su
 * fichero. Son dos formatos distintos a propósito y mezclarlos escribe una
 * fecha que luego no se sabe leer.
 */

/**
 * Hoy como lo escribe un recibo: «18 sep 2026».
 *
 * Es el formato en el que están guardadas las fechas de los recibos —texto, no
 * ISO— desde la primera versión. No es `hoyIso()`, que da «2026-09-18» y es el
 * que se usa para todo lo nuevo; los dos conviven hasta que las fechas de los
 * recibos se normalicen.
 */
export function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Fecha en ISO pero con la hora LOCAL.
 *
 * Con `toISOString`, en España (UTC+1/+2) la medianoche local es el día
 * anterior en UTC y toda fecha salía un día antes.
 */
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
