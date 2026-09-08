/**
 * TRAER DE LA BASE LO QUE VIVE EN EL NAVEGADOR.
 *
 * Siete cosas de la hermandad se guardan en `hermandad_settings` y se leen
 * desde `localStorage`: el modelo de papeleta, el de recibo, la asistencia, los
 * ajustes de cuotas, las etiquetas, la campaña y los campos propios. Guardarlas
 * ya funcionaba. TRAERLAS DE VUELTA, no.
 *
 * Cada módulo tenía escrita su función `cargar…DeLaBase()`, correcta y
 * probada. Lo que faltaba es que alguien la llamara: cuatro de las siete no se
 * invocaban desde ningún sitio. O sea que el dato subía a la base de la
 * hermandad y se quedaba allí, sin que nadie fuera a buscarlo nunca.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ NO SE VEÍA
 * ----------------------------------------------------------------------------
 *
 * Porque en el ordenador donde se prueba, el dato YA ESTÁ en `localStorage`:
 * lo acabas de escribir tú. Todo funciona. Solo se rompe en el segundo
 * dispositivo, que es justo el que no se prueba.
 *
 * Lo que pasaba de verdad, y está contado —cada uno en su sitio— desde antes
 * de que esto existiera:
 *
 *   · LA ASISTENCIA. El diputado la marca la madrugada del Viernes Santo desde
 *     su móvil, tramo por tramo. Se guardaba bien. Y la secretaria, en su
 *     portátil, abría la ficha del hermano y veía el historial VACÍO. Y el
 *     propio diputado lo perdía al cambiar de móvil. No se puede rehacer: esa
 *     noche no vuelve.
 *
 *   · LOS CAMPOS PROPIOS. Aquí decía que «el VALOR sí viajaba —va dentro de la
 *     ficha, que está en la base— y la definición no». ERA FALSO, y lo escribí
 *     yo: la ficha está en la base, sí, pero `hermanoToRow` no mandaba
 *     `campos`, y en la tabla `hermanos` no existía esa columna siquiera.
 *
 *     O sea que faltaban LAS DOS MITADES, no una. La definición no volvía (eso
 *     lo arregla este fichero) y el valor no llegaba a ir (eso lo arregla
 *     `supabase/campos-del-hermano.sql` y el mapeo de `lib/db/hermanos.ts`).
 *     Desde otro ordenador se veía el campo «Talla de túnica» bien dibujado y
 *     vacío para los cuatrocientos hermanos.
 *
 *   · LOS AJUSTES DE CUOTAS. Esto toca dinero: el bloqueo de papeleta a los
 *     morosos no valía desde otro ordenador, y el control de la mora por dos
 *     cargos se saltaba abriendo otro navegador.
 *
 *   · LAS ETIQUETAS del censo, que ordenan a quién se le manda cada comunicado.
 *
 * ----------------------------------------------------------------------------
 * CÓMO
 * ----------------------------------------------------------------------------
 *
 * Cada `cargar…DeLaBase()` deja el dato en `localStorage` y lanza su evento; los
 * hooks (`useAsistencias`, `useEtiquetas`, `useCamposPropios`,
 * `useAjustesCuotas`) ya lo escuchaban. Así que basta con llamarlas: las
 * pantallas que estén pintadas se refrescan solas. Toda la fontanería estaba
 * puesta menos el grifo.
 *
 * LAS SIETE NO: van las CINCO LIGERAS. `modelo_papeleta` y `modelo_recibo`
 * llevan dentro la imagen escaneada del modelo, y esos los pide la pantalla que
 * los necesita —Papeletas, Cuotas, el área del hermano— porque traerlos en cada
 * arranque sería descargarlos para las quince pantallas que no los usan.
 *
 * NO FALLA NUNCA. Si una no se puede traer, se sigue con las demás y se usa lo
 * que hubiera guardado: es exactamente lo que se hacía antes. Traer un dato de
 * la hermandad no puede impedir entrar.
 */
import { cargarAsistenciaDeLaBase } from './asistencia'
import { cargarCamposPropiosDeLaBase } from './camposPropios'
import { cargarEtiquetasDeLaBase } from './etiquetas'
import { cargarAjustesCuotasDeLaBase } from './ajustesCuotas'
import { cargarCampanaDeLaBase } from './campana'

/**
 * Las que se traen al arrancar, con el nombre de su plantilla al lado para que
 * la prueba pueda cruzarlas con `PlantillaGuardable` y avisar si mañana se
 * añade una que se guarda y no se trae.
 */
export const PLANTILLAS_AL_ARRANCAR = [
  'campana',
  'asistencia',
  'campos_propios',
  'etiquetas',
  'ajustes_cuotas',
] as const

/**
 * Trae las cinco. En paralelo —son cinco lecturas de la misma fila, no hay
 * motivo para encadenarlas— y sin que una que falle se lleve a las otras por
 * delante.
 */
export async function hidratarPlantillas(): Promise<void> {
  await Promise.allSettled([
    cargarCampanaDeLaBase(),
    cargarAsistenciaDeLaBase(),
    cargarCamposPropiosDeLaBase(),
    cargarEtiquetasDeLaBase(),
    cargarAjustesCuotasDeLaBase(),
  ])
}
