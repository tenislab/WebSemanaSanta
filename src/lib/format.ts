const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

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
 * ¿ES ESTE IBAN CORRECTO? Con el dígito de control, no solo con la forma.
 *
 * Antes solo se miraba la FORMA —dos letras, dos dígitos, la longitud—, y eso
 * deja pasar cualquier IBAN con una cifra mal escrita. Aquí eso no es un
 * detalle: ese IBAN entra en la remesa SEPA, el fichero se manda al banco, y
 * la hermandad se entera cuando se lo devuelven — después de haberle dicho al
 * hermano que ya estaba domiciliado, y con la cuota sin cobrar.
 *
 * El dígito de control (los dos números después de «ES») está pensado
 * exactamente para eso: caza una cifra cambiada y caza dos cifras
 * intercambiadas, que son los dos errores que comete quien copia un IBAN a
 * mano. Son diez líneas.
 *
 * LO QUE SIGUE SIN COMPROBAR, y conviene saberlo: que la cuenta EXISTA. Un
 * IBAN inventado con el dígito de control bien calculado pasa por aquí. Eso
 * solo lo sabe el banco.
 */
export function isPlausibleIban(iban: string) {
  const compact = iban.replace(/[\s-]+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false
  return mod97(compact) === 1
}

/**
 * El mod-97 del IBAN (norma ISO 13616): se pasan los cuatro primeros
 * caracteres al final, cada letra se cambia por su número (A=10 … Z=35) y el
 * resto de dividir entre 97 tiene que ser 1.
 *
 * Se va dividiendo por trozos porque el número entero no cabe en un `number`:
 * un IBAN español son 24 caracteres, que convertidos pasan de los 20 dígitos y
 * ahí JavaScript ya redondea — y un resto calculado sobre un número redondeado
 * daría por bueno cualquier cosa.
 */
function mod97(compact: string): number {
  const movido = compact.slice(4) + compact.slice(0, 4)
  let resto = 0
  for (const c of movido) {
    const valor = c >= 'A' && c <= 'Z' ? String(c.charCodeAt(0) - 55) : c
    for (const d of valor) resto = (resto * 10 + Number(d)) % 97
  }
  return resto
}
