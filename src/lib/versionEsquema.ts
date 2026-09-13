/**
 * ¿VA LA BASE DE DATOS AL DÍA CON ESTA VERSIÓN DE LA APLICACIÓN?
 *
 * ============================================================================
 * SI ERES UN PROGRAMADOR Y ACABAS DE LLEGAR, LEE ESTO ANTES DE TOCAR NADA
 * ============================================================================
 *
 * Gobergo se actualiza por dos caminos que NO van juntos:
 *
 *   · La aplicación se despliega y todo el mundo la tiene en cinco minutos.
 *   · La base de datos la actualiza cada hermandad A MANO, pegando
 *     `supabase/ACTUALIZAR.sql` en el SQL Editor de su proyecto de Supabase.
 *
 * O sea que SIEMPRE hay hermandades con la aplicación nueva y la base vieja. No
 * es un caso raro: es el estado normal durante días o semanas.
 *
 * Y hasta ahora eso se rompía en silencio. Cuando la aplicación escribe en una
 * columna que la base no tiene, Postgres NO ignora la columna: rechaza la
 * sentencia entera. No se pierde ese dato, se pierde la fila. El tramo entero.
 * El cobro entero. En pantalla no pasa nada: se rellena, se guarda, dice que se
 * ha guardado, y al recargar está en blanco.
 *
 * Esto convierte ese silencio en un aviso. No arregla el fallo —no se puede
 * desde el navegador— pero dice exactamente qué pasa y qué hay que hacer.
 *
 * ----------------------------------------------------------------------------
 * CUANDO TOQUES CUALQUIER PIEZA .SQL: LO ÚNICO QUE TIENES QUE HACER
 * ----------------------------------------------------------------------------
 *
 * Ejecutar los generadores (`node scripts/generar-todo-en-uno.mjs` y los
 * otros dos), que ya había que ejecutar. La versión sube sola: la calcula
 * `scripts/version-del-esquema.mjs` a partir de una HUELLA del contenido de
 * todas las piezas y la guarda en `supabase/VERSION.json`, que es de donde
 * sale el número de aquí abajo. Y si se te olvida, `npm test` te lo dice por
 * su nombre: hay una prueba que compara la huella guardada con la de las
 * piezas.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ UNA HUELLA, Y NO EL NÚMERO DE PIEZAS NI UNA VERSIÓN INVENTADA
 * ----------------------------------------------------------------------------
 *
 * Una versión inventada («2.3.1») hay que acordarse de subirla, y el día que
 * se olvida el aviso deja de salir justo cuando hacía falta.
 *
 * El número de piezas —que es lo que había aquí antes— sube solo al añadir un
 * fichero, pero NO al editar uno que ya existe. Y las piezas se editan: se le
 * añaden columnas a una tabla, una función a un fichero de siempre. Ese día
 * la base se queda atrasada igual, y la aplicación no avisaba a nadie. Pasó
 * el día en que se cerró este agujero: dos columnas nuevas en
 * `reglas_automaticas`, versión sin subir, y al guardar una regla la base
 * contestaba que la columna no existe.
 *
 * La huella cambia con cualquier cambio. Eso es todo lo que hace falta.
 *
 * ----------------------------------------------------------------------------
 * LO QUE ESTO **NO** ES
 * ----------------------------------------------------------------------------
 *
 * No es un bloqueo. La aplicación sigue funcionando entera con la base
 * atrasada: casi todo va bien, y lo que no, ya avisaba por su cuenta. Bloquear
 * el acceso a una hermandad porque no ha pegado un SQL sería mucho peor que el
 * problema que se está evitando.
 *
 * Y no es una migración automática. La aplicación NO puede ejecutar SQL con
 * permisos de dueño —la clave anónima no los tiene, y menos mal—. Lo tiene que
 * pegar una persona. Esto solo le dice que le toca.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { modoDemoActivo } from './demo'
import versionGuardada from '../../supabase/VERSION.json'

/**
 * POR QUÉ VERSIÓN VA ESTA APLICACIÓN. Sale de `supabase/VERSION.json`, que
 * escriben los generadores del SQL cada vez que cambia cualquier pieza. Ver
 * arriba, y `scripts/version-del-esquema.mjs`.
 */
export const VERSION_ESQUEMA: number = versionGuardada.version

export type EstadoDelEsquema =
  /* Todavía no se ha preguntado, o no hay base a la que preguntar. */
  | { estado: 'sin_saber' }
  /* La base va al día, o más adelantada que la aplicación (despliegue a medias). */
  | { estado: 'al_dia'; enLaBase: number }
  /*
   * La base va POR DETRÁS. Es el caso que importa. Se dan los dos números
   * —por cuál va y cuál necesita— y NO su diferencia: la versión sube uno
   * por cada cambio en las piezas, así que restar no cuenta piezas ni nada
   * que se le pueda decir a nadie.
   */
  | { estado: 'atrasada'; enLaBase: number; necesita: number }
  /*
   * La base es TAN vieja que ni siquiera tiene el contador. Toda hermandad que
   * montó su base antes de que esto existiera está aquí, y no se le puede decir
   * cuánto le falta porque no hay con qué compararlo. Se le dice lo otro: que
   * pegue `ACTUALIZAR.sql`, que es la respuesta correcta en cualquier caso.
   */
  | { estado: 'sin_sellar' }

/**
 * Le pregunta a la base por qué versión va.
 *
 * NO LANZA NUNCA. Si la consulta falla —la base en pausa, la función que aún no
 * existe, sin red— devuelve `sin_saber`, y quien lo pinta no enseña nada. Un
 * aviso sobre actualizaciones no puede ser el motivo de que alguien no pueda
 * entrar a gestionar su hermandad.
 */
export async function mirarElEsquema(): Promise<EstadoDelEsquema> {
  if (!isSupabaseConfigured || !supabase) return { estado: 'sin_saber' }
  // En la demostración no hay base de datos de verdad a la que preguntar.
  if (modoDemoActivo()) return { estado: 'sin_saber' }
  try {
    const { data, error } = await supabase.rpc('version_del_esquema')
    /*
     * UN ERROR AQUÍ ES «NO LO SÉ», NO «ESTÁ ATRASADA», y la diferencia importa.
     *
     * La función `version_del_esquema()` la crea la propia pieza que estamos
     * comprobando. En una base que no la tiene, la llamada da error 404 — que
     * es, literalmente, la señal de que la base está atrasadísima.
     *
     * Y aun así NO se aprovecha para decirlo, porque el mismo error 404 sale
     * cuando el proyecto de Supabase está despertando de la pausa, cuando la
     * clave ha caducado y cuando hay un proxy de por medio. Decir «tu base está
     * atrasada» por una caída de red sería mandar a alguien a pegar un SQL de
     * 6.000 líneas sin necesidad ninguna.
     *
     * Callar cuando no se sabe es lo correcto: el fallo que esto vigila avisa
     * solo por otras vías, y una alarma que salta sin motivo se acaba
     * ignorando también los días que tiene razón.
     */
    if (error) return { estado: 'sin_saber' }
    const enLaBase = typeof data === 'number' ? data : Number(data ?? 0)
    if (!Number.isFinite(enLaBase) || enLaBase <= 0) return { estado: 'sin_sellar' }
    if (enLaBase >= VERSION_ESQUEMA) return { estado: 'al_dia', enLaBase }
    return { estado: 'atrasada', enLaBase, necesita: VERSION_ESQUEMA }
  } catch {
    return { estado: 'sin_saber' }
  }
}

/**
 * El aviso, en castellano, para pintarlo tal cual. Devuelve `null` cuando no
 * hay nada que decir, que es el caso normal.
 *
 * Se saca aparte de la pantalla para poder probar el texto: es lo único que va
 * a leer quien tenga el problema, y tiene que decir QUÉ PASA y QUÉ HACER, no
 * «error de versión».
 */
export function avisoDelEsquema(e: EstadoDelEsquema): { titulo: string; texto: string } | null {
  if (e.estado === 'sin_saber' || e.estado === 'al_dia') return null
  const queHacer =
    'Entra en tu proyecto de Supabase → SQL Editor → New query, pega el contenido de '
    + '«supabase/ACTUALIZAR.sql» y dale a RUN. Tarda unos segundos y es seguro repetirlo.'
  if (e.estado === 'sin_sellar') {
    return {
      titulo: 'Tu base de datos puede estar sin actualizar',
      texto:
        'No se ha podido comprobar por qué versión va tu base de datos, lo que suele significar que '
        + 'lleva tiempo sin actualizarse. Mientras esté atrasada, hay datos que parecen guardarse y '
        + 'no se guardan. ' + queHacer,
    }
  }
  return {
    titulo: 'Tu base de datos va por detrás de la aplicación',
    texto:
      `Tu base va por la versión ${e.enLaBase} y esta aplicación necesita la ${e.necesita}. `
      + 'Mientras tanto hay pantallas que dirán que han guardado sin haber guardado, porque escriben '
      + 'en columnas que tu base todavía no tiene. ' + queHacer,
  }
}
