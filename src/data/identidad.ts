/**
 * Quién está detrás de Gobergo, para los textos legales.
 *
 * Está en un solo sitio a propósito. Antes, los datos del titular iban
 * escritos como huecos —«[RAZÓN SOCIAL]», «[NIF O CIF]»…— repartidos por el
 * aviso legal, la política de privacidad y la de cookies. Rellenarlos
 * significaba buscarlos por tres documentos y acordarse de todos, y las
 * páginas legales son PÚBLICAS: cualquier hueco que se escape lo ve todo el
 * mundo, y un aviso legal que no identifica a su titular no cumple la ley.
 *
 * Aquí se pone una vez y sale en los tres.
 */
export interface IdentidadGobergo {
  /** El nombre comercial. Es el que ve la gente. */
  nombre: string
  /**
   * El nombre o la razón social de quien responde legalmente: una persona con
   * sus apellidos si es autónomo, o el nombre de la sociedad.
   */
  razonSocial: string
  /** NIF o CIF. Lo exige el artículo 10 de la LSSI, no es opcional. */
  nif: string
  /** El domicilio, completo. También lo exige el artículo 10. */
  domicilio: string
  /** A dónde escribe quien quiere ejercer sus derechos. Tiene que funcionar. */
  correo: string
}

/**
 * Lo que falta va VACÍO, no inventado.
 *
 * El NIF y el domicilio no se pueden rellenar con cualquier cosa: un aviso
 * legal con datos falsos es peor que uno con un hueco, porque el hueco se ve y
 * el dato falso no. La aplicación avisa en rojo mientras estén vacíos
 * (Configuración → Puesta en marcha).
 */
export const GOBERGO: IdentidadGobergo = {
  nombre: 'Gobergo',
  razonSocial: 'Gobergo',
  nif: '',
  domicilio: '',
  // Provisional hasta que haya dominio propio. En cuanto lo haya, esto pasa a
  // ser algo como `hola@gobergo.es`: un correo de empresa da mucha más
  // confianza en un aviso legal que uno personal, y aquí lo va a leer gente
  // que está decidiendo si dejarte el censo de su hermandad.
  correo: 'jrrjaime2004@gmail.com',
}

/** Qué datos del titular faltan por rellenar, con su nombre en cristiano. */
export function datosDelTitularQueFaltan(id: IdentidadGobergo = GOBERGO): string[] {
  const faltan: string[] = []
  if (!id.razonSocial.trim()) faltan.push('el nombre o razón social del titular')
  if (!id.nif.trim()) faltan.push('el NIF o CIF')
  if (!id.domicilio.trim()) faltan.push('el domicilio')
  if (!id.correo.trim()) faltan.push('el correo de contacto')
  return faltan
}

/** Para escribirlo dentro de un texto legal sin que quede un hueco raro. */
export function oPendiente(valor: string, que: string): string {
  return valor.trim() || `[PENDIENTE: ${que}]`
}
