/**
 * CONTRASEÑAS QUE NO SE PUEDEN ADIVINAR.
 *
 * EL FALLO QUE ARREGLA. La contraseña con la que un hermano entraba por
 * primera vez era SU PROPIO DNI. Y el DNI está en su ficha, que puede leer
 * cualquiera que tenga acceso al censo.
 *
 * O sea que la cadena entera era:
 *
 *   1. Alguien con un cargo cualquiera lee el censo.
 *   2. Coge el correo y el DNI del Hermano Mayor.
 *   3. Entra como él con `signInWithPassword(correo, su DNI)`.
 *   4. Cargo de Hermano Mayor: los trece módulos, incluido «Personal y
 *      permisos», desde donde se reparten cargos a quien se quiera.
 *
 * Y nadie obligaba a cambiarla nunca, así que la mayoría del censo seguiría
 * con ella años después.
 *
 * Lo mismo en la importación masiva, que era peor: `clavePorDefecto`, LA MISMA
 * para las ochocientas fichas del Excel.
 */

/*
 * Sin las que se confunden al leerlas en voz alta o copiarlas de un papel:
 * ni O ni 0, ni I ni l ni 1. Una contraseña que hay que dictar por teléfono se
 * dicta mal, y entonces se llama a secretaría.
 */
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const NUMEROS = '23456789'

/**
 * Una contraseña de un solo uso: la que se le pone a la cuenta al crearla y
 * que se cambia en el primer acceso.
 *
 * Sale en grupos separados por guiones —`KRPT-4829-MXWD`— porque se lee de un
 * correo en el móvil y se teclea en otro sitio. Sin los guiones se pierde uno
 * a la mitad.
 */
export function claveDeUnSoloUso(): string {
  const dado = (alfabeto: string, n: number) => {
    const bytes = new Uint32Array(n)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
  }
  return `${dado(LETRAS, 4)}-${dado(NUMEROS, 4)}-${dado(LETRAS, 4)}`
}

/**
 * ¿Esta contraseña es una de las que había que quitar de en medio?
 *
 * Sirve para avisar a las hermandades que ya venían usando la aplicación: sus
 * hermanos siguen teniendo el DNI como contraseña, y eso no se puede arreglar
 * solo cambiando el código — hay que decírselo y que la cambien.
 */
export function claveAdivinable(clave: string, dni: string): boolean {
  const limpia = (s: string) => s.trim().toUpperCase().replace(/[^0-9A-Z]/g, '')
  const c = limpia(clave)
  if (!c) return false
  return c === limpia(dni)
}
