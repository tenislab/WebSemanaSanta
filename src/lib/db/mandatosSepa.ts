/**
 * LOS MANDATOS SEPA · camelCase (aplicación) ⇄ snake_case (tabla).
 *
 * Un fichero por tabla, y los dos traductores se le pasan a `useSupabaseTable`.
 * El porqué de que esto esté en un solo sitio, y los TRES SITIOS que hay que
 * tocar al añadir un campo —el tipo, los dos traductores y la columna—, está
 * contado en `lib/db/hermanos.ts`. Olvidar `fromRow` no da error: el dato se
 * guarda y no vuelve, y eso se lee como «se ha perdido».
 */
import type { MandatoSepa } from '../mandatosSepa'

/**
 * `hermandad_id` no se manda: la pone la base por defecto (`hermandad_actual()`)
 * y el disparador de `mandatos_sepa` la vuelve a fijar de todas formas, igual
 * que el resto de columnas que firma el hermano. Mandarla desde aquí no
 * cambiaría nada, solo confundiría a quien lea este fichero.
 */
export function mandatoSepaToRow(m: MandatoSepa): Record<string, unknown> {
  return {
    id: m.id,
    hermano_id: m.hermanoId,
    iban: m.iban,
    referencia: m.referencia,
    texto_aceptado: m.textoAceptado,
    firmado_en: m.firmadoEn,
    revocado_en: m.revocadoEn ?? null,
  }
}

export function rowToMandatoSepa(r: Record<string, unknown>): MandatoSepa {
  return {
    id: r.id as string,
    hermanoId: r.hermano_id as string,
    iban: r.iban as string,
    referencia: r.referencia as string,
    textoAceptado: r.texto_aceptado as string,
    firmadoEn: r.firmado_en as string,
    revocadoEn: (r.revocado_en as string | null) ?? undefined,
  }
}
