/*
 * EL SEPARADOR DE MILES, SIEMPRE.
 *
 * `es-ES` por defecto se lo salta en los números de CUATRO cifras: 2420,00 €
 * pero 10.431,55 €. Para una frase suelta está bien —es la norma— pero esta
 * aplicación es casi toda columnas de dinero, y en una columna eso se lee
 * dudando: `2420,00` al lado de `10.431,55` puede ser dos mil o veinticuatro.
 *
 * Se vio en el estado de cuentas, que es el papel que se lleva al cabildo: la
 * primera partida sin separador y la siguiente con él, una debajo de la otra.
 * Y no se veía leyendo el código, porque ahí `es-ES` parece lo correcto.
 *
 * Cambia eso y nada más: no toca la coma decimal, ni los dos decimales, ni el
 * símbolo detrás.
 *
 * Va `true` y no `'always'` porque los tipos de TypeScript de esta versión
 * todavía declaran la opción como booleana. Son la misma cosa —comprobado
 * ejecutándolo: los dos dan `2.420,00 €`— y `true` compila.
 */
const currency = new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', useGrouping: true,
})

/**
 * UN IMPORTE, EN EUROS Y CÉNTIMOS. Nada de fracciones de céntimo.
 *
 * Se aplica al ENTRAR el dinero —al crear una cuota o un apunte—, que es el
 * único sitio donde se puede cerrar el problema de una vez. Después ese
 * importe se suma en ocho pantallas, se imprime en el estado de cuentas que
 * se lleva al cabildo y viaja al banco dentro de la remesa; si trae medio
 * céntimo pegado, cada una de esas cuentas lo redondea a su manera y dejan de
 * cuadrar entre ellas.
 *
 * El caso concreto que ya mordió: en el fichero SEPA, las líneas sumaban una
 * cosa y la suma de control decía otra, y el banco rechaza el fichero entero
 * cuando eso pasa.
 *
 * `step="0.01"` en el formulario no basta: no todos los navegadores lo
 * imponen, y además hay importes que llegan de una hoja de cálculo.
 */
export function aCentimos(valor: number): number {
  return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : 0
}

/**
 * SUMA DE DINERO, a prueba de una fila rota.
 *
 * Todas las cifras que se enseñan —lo cobrado, la deuda viva, lo recaudado en
 * papeletas, los totales del estado de cuentas— se sacan sumando una columna.
 * Y basta con UN importe que no sea un número —la celda vacía de un Excel, un
 * valor nulo de la base, una copia antigua guardada en el navegador— para que
 * toda la suma dé NaN y la pantalla lea «NaN €». Un dato malo entre
 * seiscientos buenos no puede borrar los seiscientos.
 *
 * Se convierte antes de mirar: Postgres devuelve las columnas `numeric` como
 * TEXTO («60.00»). Y se suma en céntimos enteros, que es lo que evita el
 * 59,999999999 de la coma flotante.
 *
 * Los importes NEGATIVOS sí cuentan: pueden ser una corrección de la
 * tesorería, y esconderlos descuadraría la caja.
 */
export function sumaEuros(importes: readonly (number | string | undefined | null)[]): number {
  const cent = importes.reduce<number>((n, x) => {
    const v = Number(x)
    return n + (Number.isFinite(v) ? Math.round(v * 100) : 0)
  }, 0)
  return cent / 100
}

export function formatCurrency(value: number) {
  return currency.format(value)
}

/**
 * EL CAMINO DE VUELTA: de «3.600,50 €» al número 3600,5.
 *
 * Hace falta para exportar a Excel. Los informes se arman con los importes YA
 * ESCRITOS —así se ven en pantalla, así se imprimen y así salen en el CSV—, y
 * un Excel donde la columna de importes es texto no se puede sumar. Que es lo
 * primero que hace quien lo abre: seleccionar la columna y mirar el total.
 *
 * Es la inversa EXACTA de `formatCurrency`, y hay una prueba que las cruza en
 * los dos sentidos para que no se separen. Por eso es estricta: si lo que
 * llega no tiene la forma que escribe esa función, devuelve `null` y la celda
 * se queda como texto. Prefiero una columna sin sumar a un número inventado
 * dentro de unas cuentas.
 *
 * Los dos detalles que la dejarían coja:
 *
 *   · `Intl` en español separa el importe del € con un ESPACIO FINO —no un
 *     espacio normal—, y el punto de los miles no es el decimal: en «1.234»,
 *     ese punto son los miles, no 1,234.
 *   · Tesorería antepone el menos tipográfico «−» (U+2212), que no es el guion
 *     del teclado. Sin contemplarlo, todos los gastos se exportarían en
 *     positivo: un Excel que suma la caja al revés.
 */
export function importeDeTexto(texto: string): number | null {
  const t = texto.trim()
  // El símbolo es obligatorio: sin él esto no es un importe nuestro, y hay
  // columnas de números que no son dinero (el número de hermano, el aforo).
  if (!t.endsWith('€')) return null
  const cuerpo = t.slice(0, -1).replace(/[\s\u00a0\u202f]/g, '')
  const negativo = cuerpo.startsWith('-') || cuerpo.startsWith('\u2212')
  const cifras = negativo ? cuerpo.slice(1) : cuerpo
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(cifras)) return null
  const n = Number(cifras.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(n)) return null
  // El cero no lleva signo, y «-0» en una hoja de cálculo se lee raro.
  return negativo && n !== 0 ? -n : n
}

export function formatDate(date: Date) {
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Oculta el centro de un IBAN, dejando visibles la entidad y los 4 últimos dígitos. */
export function maskIban(iban: string) {
  const compact = iban.replace(/\s+/g, '')
  if (compact.length <= 8) return iban
  return `${compact.slice(0, 4)} •••• •••• ${compact.slice(-4)}`
}

/**
 * ¿ES ESTE IBAN CORRECTO?
 *
 * Vivía aquí, con su propio `mod97`, y comprobaba menos: la forma y el dígito
 * de control, sin mirar la longitud que le toca a cada país. Y sobre todo, LA
 * REMESA NO LO LLAMABA — solo lo llamaba la ficha del hermano, así que un IBAN
 * malo que hubiera entrado por cualquier otro camino (el importador del censo,
 * por ejemplo) llegaba al banco sin que nadie lo mirara.
 *
 * Ahora hay UNA sola regla, en `lib/iban.ts`, y la usan la ficha, el importador
 * y la remesa. Dos reglas distintas para lo mismo es como el mismo IBAN vale en
 * una pantalla y no en otra.
 */
export { ibanValido as isPlausibleIban, porQueNoValeElIban } from './iban'
