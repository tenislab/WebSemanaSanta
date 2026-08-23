import { CLAVES_DATOS, leerDatos } from './persistencia'
import { supabase, isSupabaseConfigured } from './supabase'
import { rowToHermano } from './db/hermanos'
import { rowToCuota } from './db/cuotas'
import { rowToPapeleta } from './db/papeletas'
import { rowToIncidencia } from './db/incidencias'
import { HERMANOS_INICIALES, type Hermano } from '../data/hermanos'
import { CUOTAS_INICIALES, type Cuota } from '../data/cuotas'
import { PAPELETAS_INICIALES, type Papeleta } from '../data/papeletas'
import { INCIDENCIAS_INICIALES, type Incidencia } from '../data/incidencias'
import { traducirErrorDeEscritura } from './errorDeBaseDeDatos'

/**
 * Protección de datos (RGPD). Herramientas para atender los derechos de un
 * hermano sobre sus datos personales: acceso (descargar todo lo que la
 * hermandad guarda sobre él) y supresión (borrarlo del censo y de los
 * registros que lo referencian). El registro contable puede tener que
 * conservarse por ley; por eso la supresión avisa y la decide la hermandad.
 */

export interface DatosHermano {
  hermano: Hermano
  cuotas: Cuota[]
  papeletas: Papeleta[]
  incidencias: Incidencia[]
}

function todos() {
  const hermanos = leerDatos(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
  const cuotas = leerDatos(CLAVES_DATOS.cuotas, CUOTAS_INICIALES)
  const papeletas = leerDatos(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES)
  const incidencias = leerDatos(CLAVES_DATOS.incidencias, INCIDENCIAS_INICIALES)
  return { hermanos, cuotas, papeletas, incidencias }
}

/**
 * Recopila todo lo que la hermandad guarda sobre un hermano. Con Supabase
 * conectado consulta la base de datos directamente (no la copia local), para
 * que el export del derecho de acceso incluya SIEMPRE los datos reales —
 * sobre todo las incidencias, que el área del hermano no carga en local y de
 * otro modo saldrían siempre vacías.
 */
export async function recopilarDatosHermano(hermanoId: string): Promise<DatosHermano | null> {
  if (isSupabaseConfigured && supabase) {
    const cliente = supabase
    const { data: filaHermano } = await cliente.from('hermanos').select('*').eq('id', hermanoId).maybeSingle()
    if (!filaHermano) return null
    const [{ data: cuotasRows }, { data: papeletasRows }] = await Promise.all([
      cliente.from('cuotas').select('*').eq('hermano_id', hermanoId),
      cliente.from('papeletas').select('*').eq('hermano_id', hermanoId),
    ])
    const susPapeletas = (papeletasRows ?? []).map(rowToPapeleta)
    const idsPapeletas = susPapeletas.map((p) => p.id)
    const { data: incidenciasRows } = idsPapeletas.length
      ? await cliente.from('incidencias').select('*').in('papeleta_id', idsPapeletas)
      : { data: [] as Record<string, unknown>[] }
    return {
      hermano: rowToHermano(filaHermano),
      cuotas: (cuotasRows ?? []).map(rowToCuota),
      papeletas: susPapeletas,
      incidencias: (incidenciasRows ?? []).map(rowToIncidencia),
    }
  }

  const { hermanos, cuotas, papeletas, incidencias } = todos()
  const hermano = hermanos.find((h) => h.id === hermanoId)
  if (!hermano) return null
  const susPapeletas = papeletas.filter((p) => p.hermanoId === hermanoId)
  const idsPapeletas = new Set(susPapeletas.map((p) => p.id))
  return {
    hermano,
    cuotas: cuotas.filter((c) => c.hermanoId === hermanoId),
    papeletas: susPapeletas,
    incidencias: incidencias.filter((i) => idsPapeletas.has(i.papeletaId)),
  }
}

/** JSON legible con los datos personales del hermano, para entregárselo (derecho de acceso). */
export function exportarDatosHermano(datos: DatosHermano): string {
  return JSON.stringify(
    {
      documento: 'Datos personales — Reglamento General de Protección de Datos (RGPD)',
      generadoEl: new Date().toISOString(),
      hermano: datos.hermano,
      cuotas: datos.cuotas,
      papeletasDeSitio: datos.papeletas,
      incidencias: datos.incidencias,
    },
    null,
    2,
  )
}

/**
 * El resultado de un borrado RGPD. Son TRES cosas distintas y hay que
 * distinguirlas: ver `borrarDatosHermano`.
 */
export type ResultadoBorrado =
  /** Borrado y censo releído. */
  | { ok: true; censo: Hermano[] }
  /** Borrado, pero no se pudo releer el censo (fallo de red al recargar). */
  | { ok: true; censo: null }
  /** La base NO lo borró. Con el motivo ya traducido a lenguaje llano. */
  | { ok: false; motivo: string; queHacer: string }

/**
 * Borra al hermano y todos los registros que lo referencian (cuotas,
 * papeletas e incidencias).
 *
 * Con Supabase conectado, basta con borrar la fila de `hermanos`: sus
 * cuotas y papeletas (y las incidencias de esas papeletas) tienen
 * `on delete cascade` y se borran solas en la base de datos. Sin Supabase,
 * hay que hacer esa cascada a mano sobre las cuatro colecciones en
 * localStorage.
 *
 * SE MIRA SI LA BASE LO HA HECHO, y antes no.
 *
 * `supabase-js` no lanza excepción cuando la base rechaza un borrado: devuelve
 * `{ error }` y sigue. Así que un DELETE bloqueado por permisos pasaba
 * inadvertido, la función releía el censo —con el hermano todavía dentro—, la
 * pantalla lo repintaba y daba por hecha la supresión.
 *
 * Y esto no es un fallo cualquiera: es el derecho de supresión del artículo 17
 * del RGPD sobre un censo de hermandad, que revela convicciones religiosas y
 * es categoría especial del artículo 9. Decirle a alguien que sus datos se han
 * borrado cuando siguen ahí es lo peor que puede hacer esta pantalla.
 */
export async function borrarDatosHermano(hermanoId: string): Promise<ResultadoBorrado> {
  if (isSupabaseConfigured && supabase) {
    /**
     * TAMBIÉN LO QUE QUEDA FUERA DE SU FICHA.
     *
     * Borrar la fila de `hermanos` no era una supresión: dejaba atrás la
     * SOLICITUD DE ALTA con la que entró, y esa fila lleva su nombre, su DNI,
     * su correo, su teléfono y —esto es lo grave— la contraseña que propuso,
     * escrita en claro.
     *
     * O sea que después de ejercer su derecho de supresión del artículo 17,
     * sus datos seguían en la base. Y no unos cualquiera: los de un censo de
     * hermandad, que revelan convicciones religiosas y son categoría especial
     * del artículo 9.
     *
     * Se busca por DNI y por correo porque la solicitud es anterior a que
     * existiera su ficha: no hay ningún identificador que las una.
     */
    const { data: ficha } = await supabase
      .from('hermanos')
      .select('dni, email')
      .eq('id', hermanoId)
      .maybeSingle()
    const suDni = (ficha as { dni?: string } | null)?.dni?.trim()
    const suEmail = (ficha as { email?: string } | null)?.email?.trim()

    const { error: fallo } = await supabase.from('hermanos').delete().eq('id', hermanoId)
    if (fallo) {
      // Se DICE, y se dice en cristiano. Callarlo sería certificar una
      // supresión que no ha ocurrido.
      console.error('La base no ha borrado al hermano:', fallo.message)
      const dicho = traducirErrorDeEscritura('hermanos', 'borrar', fallo.message, fallo.code)
      return { ok: false, motivo: dicho.mensaje, queHacer: dicho.queHacer }
    }

    /*
     * Las solicitudes de alta, por los dos caminos. Se hace DESPUÉS de borrar
     * la ficha: si algo de esto fallara, lo importante ya está hecho.
     *
     * Si estas dos fallan NO se aborta —la ficha, que es lo gordo, ya no
     * está—, pero se deja escrito en la consola: esas filas llevan el DNI y la
     * contraseña que propuso al pedir el alta, así que quedarían huérfanas y
     * hay que poder rastrearlo.
     */
    if (suDni) {
      const { error } = await supabase.from('solicitudes_alta').delete().eq('dni', suDni)
      if (error) console.error('Quedó su solicitud de alta (por DNI):', error.message)
    }
    if (suEmail) {
      const { error } = await supabase.from('solicitudes_alta').delete().eq('email', suEmail)
      if (error) console.error('Quedó su solicitud de alta (por correo):', error.message)
    }

    const { data, error } = await supabase.from('hermanos').select('*').order('numero')
    if (error) {
      // OJO: null = «no se pudo releer», NO «el censo está vacío». Devolver []
      // hacía que un fallo puntual de red borrase el censo entero de la vista.
      console.error('No se pudo recargar el censo tras borrar el hermano:', error.message)
      return { ok: true, censo: null }
    }
    return { ok: true, censo: (data ?? []).map(rowToHermano) }
  }

  const { hermanos, cuotas, papeletas, incidencias } = todos()
  const idsPapeletas = new Set(papeletas.filter((p) => p.hermanoId === hermanoId).map((p) => p.id))

  const hermanosRest = hermanos.filter((h) => h.id !== hermanoId)
  const cuotasRest = cuotas.filter((c) => c.hermanoId !== hermanoId)
  const papeletasRest = papeletas.filter((p) => p.hermanoId !== hermanoId)
  const incidenciasRest = incidencias.filter((i) => !idsPapeletas.has(i.papeletaId))

  localStorage.setItem(CLAVES_DATOS.hermanos, JSON.stringify(hermanosRest))
  localStorage.setItem(CLAVES_DATOS.cuotas, JSON.stringify(cuotasRest))
  localStorage.setItem(CLAVES_DATOS.papeletas, JSON.stringify(papeletasRest))
  localStorage.setItem(CLAVES_DATOS.incidencias, JSON.stringify(incidenciasRest))

  // Y su solicitud de alta, que lleva el DNI y la contraseña en claro.
  try {
    const elBorrado = hermanos.find((h) => h.id === hermanoId)
    if (elBorrado) {
      const crudo = localStorage.getItem('cabildo-solicitudes-alta')
      if (crudo) {
        const solicitudes = JSON.parse(crudo) as { dni?: string; email?: string }[]
        const limpio = (v?: string) => (v ?? '').replace(/[\s.-]/g, '').toUpperCase()
        const quedan = solicitudes.filter(
          (s) =>
            limpio(s.dni) !== limpio(elBorrado.dni) &&
            (s.email ?? '').trim().toLowerCase() !== (elBorrado.email ?? '').trim().toLowerCase(),
        )
        localStorage.setItem('cabildo-solicitudes-alta', JSON.stringify(quedan))
      }
    }
  } catch {
    // Una solicitud que no se pueda leer no debe impedir el borrado del resto.
  }

  return { ok: true, censo: hermanosRest }
}
