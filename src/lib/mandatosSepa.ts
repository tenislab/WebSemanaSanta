/**
 * EL MANDATO SEPA, FIRMADO DE VERDAD.
 *
 * `supabase/mandatos-sepa.sql` cuenta la historia entera: el fichero de
 * remesa se generaba con un identificador de mandato y una fecha de firma
 * INVENTADOS, porque no había ningún mandato de verdad que consultar. Ahora
 * lo hay, y este fichero es lo que conecta esa tabla con el resto de la
 * aplicación.
 *
 * PARA ENCENDERLO: ejecuta `supabase/mandatos-sepa.sql` una vez (o
 * `ACTUALIZAR.sql`, que ya lo lleva).
 */
import { useSupabaseTable } from './supabaseSync'
import { CLAVES_DATOS } from './persistencia'
import { mandatoSepaToRow, rowToMandatoSepa } from './db/mandatosSepa'
import { limpiarIban } from './iban'

export interface MandatoSepa {
  id: string
  hermanoId: string
  /** Foto del IBAN en el momento de firmar (ver comentario en la tabla). */
  iban: string
  /** El `MndtId` del fichero SEPA: sale del propio id de esta fila, nunca se inventa. */
  referencia: string
  textoAceptado: string
  firmadoEn: string
  /** Solo la pone tesorería, y nunca se puede volver a NULL. */
  revocadoEn?: string
}

/**
 * Lo que el hermano acepta al firmar, palabra por palabra.
 *
 * Se guarda junto con la firma porque es LA PRUEBA de la domiciliación: si el
 * hermano reclama un cargo a su banco —algo que puede hacer hasta ocho
 * semanas después, sin dar explicaciones—, esto es lo único que la hermandad
 * tiene que enseñar.
 */
export function textoDelMandatoSepa(hermandad: string): string {
  return (
    `Autorizo a ${hermandad || 'mi hermandad'} a presentar adeudos domiciliados SEPA en la cuenta `
    + 'que tengo registrada en mi ficha, de acuerdo con las instrucciones dadas a mi entidad '
    + 'financiera. Puedo solicitar la devolución de un adeudo dentro de las ocho semanas '
    + 'siguientes a la fecha de cargo en cuenta, según lo acordado con mi entidad.'
  )
}

/**
 * Los mandatos que puede VER quien pregunta: tesorería, los de toda su
 * hermandad; un hermano, solo el suyo. Lo decide la base (RLS), no este
 * hook — aquí se lee lo que llegue, sea cual sea la vista.
 */
export function useMandatosSepa() {
  return useSupabaseTable<MandatoSepa>(
    'mandatos_sepa',
    CLAVES_DATOS.mandatosSepa,
    [],
    mandatoSepaToRow,
    rowToMandatoSepa,
    'firmado_en',
  )
}

/**
 * El mandato VIGENTE de un hermano: el firmado más reciente, sin revocar, y
 * con el IBAN que tiene HOY en su ficha.
 *
 * NO hace falta revocar nada cuando secretaría le corrige el IBAN: la firma
 * queda ligada al IBAN que tenía al firmar, así que en cuanto ese IBAN deja
 * de ser el actual, la firma deja de encajar y de contar como vigente — sin
 * que nadie tenga que acordarse de anular nada a mano. Ver el comentario
 * completo en `supabase/mandatos-sepa.sql`.
 */
export function mandatoVigente(
  mandatos: MandatoSepa[],
  hermanoId: string,
  ibanActual: string | null | undefined,
): MandatoSepa | null {
  const ibanHoy = limpiarIban(ibanActual ?? '')
  if (!ibanHoy) return null
  const vigentes = mandatos.filter(
    (m) => m.hermanoId === hermanoId && !m.revocadoEn && limpiarIban(m.iban) === ibanHoy,
  )
  if (!vigentes.length) return null
  return vigentes.reduce((mas, m) => (m.firmadoEn > mas.firmadoEn ? m : mas))
}
