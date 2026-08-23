/**
 * EL IBAN, CON SU DÍGITO DE CONTROL.
 *
 * Antes solo se miraba la FORMA —dos letras, dos dígitos, la longitud—, y eso
 * deja pasar cualquier IBAN con una cifra mal escrita.
 *
 * Aquí eso no es un detalle de validación: ese IBAN entra en la remesa SEPA, el
 * fichero se manda al banco, y la hermandad se entera cuando se lo devuelven —
 * después de haberle dicho al hermano que ya estaba domiciliado, con la cuota
 * sin cobrar y con la comisión de devolución encima.
 *
 * El dígito de control existe exactamente para esto: caza una cifra cambiada y
 * caza dos cifras intercambiadas, que son los dos errores de quien copia un
 * IBAN a mano de una libreta.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/format.ts')

  // --- Los que tienen que pasar ---
  // El de ejemplo del Banco de España.
  caso('un IBAN español correcto pasa', true, m.isPlausibleIban('ES9121000418450200051332'))
  // Nadie lo escribe todo junto: se copia de la libreta con los espacios.
  caso('con espacios también', true, m.isPlausibleIban('ES91 2100 0418 4502 0005 1332'))
  caso('y con guiones', true, m.isPlausibleIban('ES91-2100-0418-4502-0005-1332'))
  caso('en minúsculas también', true, m.isPlausibleIban('es9121000418450200051332'))
  // No todos los hermanos tienen cuenta en España: los hay viviendo fuera.
  caso('un IBAN alemán pasa', true, m.isPlausibleIban('DE89370400440532013000'))
  caso('uno británico, con letras dentro, también', true, m.isPlausibleIban('GB82WEST12345698765432'))

  /*
   * --- LOS DOS ERRORES QUE DE VERDAD SE COMETEN ---
   * Son los que antes pasaban y llegaban al banco.
   */
  caso('una cifra cambiada NO pasa', false, m.isPlausibleIban('ES9121000418450200051333'))
  caso('dos cifras intercambiadas tampoco', false, m.isPlausibleIban('ES9121000418450200051323'))
  caso('y un dígito de control mal, tampoco', false, m.isPlausibleIban('ES0021000418450200051332'))

  // --- Lo que ni siquiera tiene forma de IBAN ---
  caso('demasiado corto no', false, m.isPlausibleIban('ES91'))
  caso('vacío no', false, m.isPlausibleIban(''))
  caso('un número de cuenta antiguo no', false, m.isPlausibleIban('2100 0418 45 0200051332'))
  caso('letras donde van los dígitos de control, no', false, m.isPlausibleIban('ESAB21000418450200051332'))

  /*
   * --- Y QUE EL NÚMERO NO SE REDONDEE ---
   *
   * Un IBAN convertido a número pasa de veinte dígitos, y ahí JavaScript ya
   * redondea. Calculado de golpe, el resto sale de un número redondeado y da
   * por bueno casi cualquier cosa. Por eso se divide por trozos.
   *
   * Esta es la comprobación de que eso está bien hecho: los IBAN largos
   * —Malta, 31 caracteres— son justo donde se notaría.
   */
  caso('un IBAN largo bueno pasa', true, m.isPlausibleIban('MT84MALT011000012345MTLCAST001S'))
  caso('y el mismo con una cifra cambiada, no', false, m.isPlausibleIban('MT84MALT011000012345MTLCAST002S'))
}
