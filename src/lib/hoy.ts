/**
 * LA FECHA DE HOY, EN HORA DE AQUÍ.
 *
 * `new Date().toISOString().slice(0, 10)` es la forma corta de escribir la
 * fecha de hoy en formato `2027-03-15`, y está MAL en España.
 *
 * `toISOString()` convierte a UTC, y aquí vamos una hora por delante en
 * invierno y dos en verano. Así que entre las 00:00 y la 01:00 —o las 02:00 en
 * horario de verano— devuelve EL DÍA ANTERIOR.
 *
 * Parece una minucia hasta que se mira dónde caía:
 *
 * - En Tesorería era la fecha con la que venía rellenado un apunte nuevo. Un
 *   ingreso metido a las 00:30 del día 1 se fechaba el último día del mes
 *   anterior, o sea que se iba al balance del mes que ya estaba cerrado. Y el
 *   1 de enero, al ejercicio anterior.
 * - En Comunicados, un aviso mandado de madrugada figuraba enviado el día
 *   antes de existir.
 * - En el Archivo, un acta subida después de un cabildo que acabó tarde
 *   quedaba fechada el día del cabildo anterior.
 *
 * Y no es un caso raro: en una hermandad se trabaja de noche. Los cabildos
 * acaban tarde, la madrugada del Viernes Santo es literalmente de madrugada, y
 * en marzo se cierra la papeleta a las tantas.
 *
 * Esto usa los componentes LOCALES de la fecha, que son los que ve quien está
 * delante del ordenador.
 */
export function hoyIso(cuando: Date = new Date()): string {
  const a = cuando.getFullYear()
  const m = String(cuando.getMonth() + 1).padStart(2, '0')
  const d = String(cuando.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

/**
 * EL DÍA DE UNA FECHA DE LA BASE, EN HORA DE AQUÍ.
 *
 * Las columnas `timestamptz` llegan por la red en UTC —«2026-08-26T22:30:00+00:00»—
 * así que `fecha.slice(0, 10)` da EL DÍA UTC: una venta cobrada a las 00:30 del
 * 27 se fechaba el 26, y con ella la caja del día y la fecha de emisión de su
 * factura. Es el mismo fallo que `toISOString()`, escrito de otra manera.
 *
 * Aguanta las dos formas en las que llega una fecha en esta aplicación: el
 * `timestamptz` de la base y el «2026-08-27» a secas que guarda la
 * demostración. Devuelve cadena vacía si no es ninguna de las dos, y quien
 * llama decide qué hacer con eso — nunca una fecha inventada.
 */
export function diaLocalDe(fecha: string | null | undefined): string {
  const texto = String(fecha ?? '').trim()
  if (!texto) return ''
  // Un día suelto no lleva hora, así que no hay nada que convertir: pasarlo por
  // `new Date` lo interpretaría como medianoche UTC y lo retrasaría un día.
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
  const d = new Date(texto)
  return Number.isNaN(d.getTime()) ? '' : hoyIso(d)
}
