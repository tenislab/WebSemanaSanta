/**
 * LA MISMA HERMANDAD CON DOS DIRECCIONES SEGÚN QUÉ PAPEL IMPRIMA.
 *
 * Los ocho documentos que se imprimen —recibo, certificado, factura,
 * justificante, estado de cuentas, cuenta de resultados, memoria e informe—
 * llevan la dirección de la hermandad en la cabecera, y cada uno la montaba por
 * su cuenta pegando campos con `join(', ')`.
 *
 * Tres la escribían con provincia y cinco sin ella. O sea: el recibo de una
 * hermana decía una dirección y el estado de cuentas del mismo día decía otra
 * más larga. Nadie lo había visto porque nadie había mirado los ocho papeles
 * seguidos, y salió al pintarlos para verlos.
 *
 * Y la provincia se repetía: en las capitales, ciudad y provincia son la misma
 * palabra, así que ponía «C/ Pureza, 53, 41010, Sevilla, Sevilla». No es un
 * fallo de quien rellenó las casillas —las dos están bien— pero en un papel
 * sellado parece un error.
 */
import { readdirSync, readFileSync } from 'node:fs'

export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/hermandadSettings.ts')
  const base = {
    ...m.AJUSTES_POR_DEFECTO,
    direccion: 'C/ Pureza, 53',
    codigoPostal: '41010',
    ciudad: 'Sevilla',
    provincia: 'Sevilla',
  }

  // El caso que se vio: capital, donde ciudad y provincia coinciden.
  caso('en una capital la provincia no se repite', 'C/ Pureza, 53, 41010, Sevilla',
    m.direccionEnUnaLinea(base))

  // Y en un pueblo SÍ hace falta: «Écija» sin más no dice de qué provincia.
  caso('en un pueblo la provincia sí sale', 'C/ Pureza, 53, 41010, Écija, Sevilla',
    m.direccionEnUnaLinea({ ...base, ciudad: 'Écija' }))

  /*
   * Se compara sin acentos ni mayúsculas: quien escribe «CÁDIZ» en una casilla
   * y «Cadiz» en la otra está diciendo lo mismo, y lo que no se puede es
   * imprimirle «CÁDIZ, Cadiz».
   */
  caso('«CÁDIZ» y «Cadiz» son la misma', 'C/ Pureza, 53, 41010, CÁDIZ',
    m.direccionEnUnaLinea({ ...base, ciudad: 'CÁDIZ', provincia: 'Cadiz' }))
  caso('y los espacios de sobra tampoco cuentan', 'C/ Pureza, 53, 41010, Sevilla',
    m.direccionEnUnaLinea({ ...base, provincia: '  sevilla ' }))

  // Lo que falta no deja comas huérfanas: una hermandad recién dada de alta
  // todavía no ha puesto nada de esto, y la cabecera tiene que aguantarlo.
  caso('sin provincia no sobra una coma', 'C/ Pureza, 53, 41010, Sevilla',
    m.direccionEnUnaLinea({ ...base, provincia: '' }))
  caso('sin código postal tampoco', 'C/ Pureza, 53, Sevilla',
    m.direccionEnUnaLinea({ ...base, codigoPostal: '', provincia: '' }))
  caso('y sin nada puesto sale vacío', '',
    m.direccionEnUnaLinea({ ...base, direccion: '', codigoPostal: '', ciudad: '', provincia: '' }))

  /*
   * Y LOS OCHO PAPELES LA PIDEN AQUÍ.
   *
   * Esta es la comprobación que impide que vuelva a pasar: si alguien escribe
   * un documento nuevo y se monta la dirección a mano, esto se cae. No basta
   * con haber arreglado los ocho de hoy — el fallo fue que había ocho sitios
   * donde escribirla.
   */
  const conCabecera = readdirSync('src/components')
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => readFileSync(`src/components/${f}`, 'utf8').includes('recibo-doc__logo'))
  caso('se encuentran los papeles con cabecera', true, conCabecera.length >= 8)

  /*
   * Se busca EL MONTAJE, no el nombre de la función. La primera versión de esto
   * miraba si el fichero nombraba `direccionEnUnaLinea` en alguna parte, y
   * cuando rompí un papel a propósito para ver si la prueba saltaba, no saltó:
   * la línea del `import` seguía ahí y bastaba para dar el visto bueno.
   */
  const aMano = conCabecera.filter((f) =>
    /hermandad\.codigoPostal\s*,\s*hermandad\.ciudad/.test(readFileSync(`src/components/${f}`, 'utf8')))
  caso('ningún papel se monta la dirección por su cuenta', '', aMano.join(', '))
}
