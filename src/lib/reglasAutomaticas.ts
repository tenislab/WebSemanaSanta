/**
 * LAS REGLAS QUE SE DISPARAN SOLAS: felicitar el cumpleaños sin acordarse.
 *
 * ============================================================================
 * QUÉ ES UNA REGLA
 * ============================================================================
 *
 * Tres cosas juntas: un SESGO (a quién), una PLANTILLA (qué se dice) y un
 * CUÁNDO (todos los días, o el día 1 de cada mes).
 *
 *   · Felicitar el cumpleaños  →  quien cumple hoy  ·  todos los días
 *   · Felicitación del mes     →  quien cumple este mes  ·  el día 1
 *
 * ----------------------------------------------------------------------------
 * LO QUE ESTO **NO** HACE, Y ES LA DECISIÓN DE TODO EL FICHERO
 * ----------------------------------------------------------------------------
 *
 * NO MANDA NINGÚN CORREO.
 *
 * Cuando a una regla le toca, escribe un comunicado programado para hoy — y ahí
 * se acaba su trabajo. A partir de ese momento sigue el mismo camino que
 * cualquier otro comunicado programado, que ya está hecho y probado:
 * `envioProgramado.ts` lo coge, resuelve el segmento, personaliza el «Hola
 * {nombre}» y lo manda una sola vez aunque entren tres personas a la vez.
 *
 * Eso importa más de lo que parece. Todo lo delicado de mandar ochocientos
 * correos —el candado, los tres intentos, el freno de las marcas mal escritas,
 * el tope de vueltas— está resuelto UNA vez, en un sitio, con sus pruebas. Si
 * esto mandara por su cuenta, habría dos caminos que hacen lo mismo y el
 * segundo iría quedándose atrás. Es literalmente el fallo que este proyecto ha
 * repetido más veces.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ NACEN APAGADAS
 * ----------------------------------------------------------------------------
 *
 * Porque una regla encendida escribe a ochocientas personas en nombre de la
 * hermandad sin que nadie lea el texto antes. Eso está bien para «feliz
 * cumpleaños» y está mal para casi todo lo demás.
 *
 * Se crean apagadas, se ve a cuánta gente alcanzarían HOY, y se encienden
 * cuando se ha visto. Encender es un clic; deshacer ochocientos correos no es
 * nada.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { useSupabaseTable } from './supabaseSync'
import { CLAVES_DATOS } from './persistencia'
import { reglaToRow, rowToRegla } from './db/reglasAutomaticas'
import { CRITERIOS_POR_DEFECTO, type CriteriosSegmento } from './segmentacion'

export interface ReglaAutomatica {
  id: string
  nombre: string
  cada: 'diaria' | 'mensual'
  criterios: CriteriosSegmento
  destinatarios: string
  asunto: string
  cuerpo: string
  activa: boolean
  ultimaVez: string | null
}

/** Una regla que la base nos ha dado para dispararla, y solo a nosotros. */
export interface ReglaReclamada {
  id: string
  nombre: string
  criterios: CriteriosSegmento
  destinatarios: string
  asunto: string
  cuerpo: string
  /** Cuándo se disparó la vez anterior. Vacío = es la primera. */
  ultimaVez: string | null
}

/**
 * LAS DOS DE FÁBRICA, para que una hermandad no tenga que inventárselas.
 *
 * El texto lleva `{nombre}` ya puesto: es lo que hace que se entienda de un
 * vistazo para qué sirven las marcas, mucho mejor que cualquier ayuda. Y está
 * escrito como escribiría una hermandad, no como una notificación de una
 * aplicación.
 *
 * Se ofrecen; no se crean solas. Una hermandad que abre Comunicados y se
 * encuentra dos reglas que no ha puesto se pregunta qué más hay hecho a sus
 * espaldas.
 */
export const REGLAS_DE_FABRICA: Omit<ReglaAutomatica, 'id' | 'activa' | 'ultimaVez'>[] = [
  {
    nombre: 'Felicitar el cumpleaños',
    cada: 'diaria',
    /*
     * EL SESGO ENTERO, no solo el trozo que cambia. Y sin `as`.
     *
     * Aquí ponía `{ cumpleanos: 'Hoy' } as CriteriosSegmento`, y esa línea hizo
     * que la función no felicitara a NADIE nunca: a `filtrarSegmento` le
     * faltaba el `estado` y descartaba a todo el mundo. Cero personas, sin un
     * error y sin forma de arreglarlo desde la pantalla.
     *
     * El `as` fue lo que lo escondió: es exactamente lo que le dice a
     * TypeScript «calla, que yo sé lo que hago». Partiendo de
     * `CRITERIOS_POR_DEFECTO` no hace falta, y el compilador vuelve a avisar el
     * día que falte un campo.
     */
    criterios: { ...CRITERIOS_POR_DEFECTO, cumpleanos: 'Hoy' },
    destinatarios: 'Hermanos que cumplen años hoy',
    asunto: '¡Felicidades, {nombre}!',
    cuerpo:
      'Hola {nombre},\n\n'
      + 'Desde {hermandad} queremos felicitarte en tu cumpleaños y desearte un día estupendo '
      + 'rodeado de los tuyos.\n\n'
      + 'Un abrazo.',
  },
  {
    nombre: 'Felicitación del mes',
    cada: 'mensual',
    criterios: { ...CRITERIOS_POR_DEFECTO, cumpleanos: 'EsteMes' },
    destinatarios: 'Hermanos que cumplen años este mes',
    asunto: 'Este mes cumples años, {nombre}',
    cuerpo:
      'Hola {nombre},\n\n'
      + 'Este mes es tu cumpleaños y en {hermandad} no queríamos dejar pasar la ocasión de '
      + 'felicitarte.\n\n'
      + 'Un abrazo.',
  },
]

/* ------------------------------------------------------------------------- */

/**
 * DISPARA LAS REGLAS QUE TOCAN HOY.
 *
 * Devuelve cuántos comunicados ha creado. No manda nada: los deja programados
 * para hoy, y quien los manda es `mandarLosProgramados()`, que corre justo
 * después en la misma pantalla.
 *
 * `TOPE` es el mismo cinturón que allí: si `crear` fallara en silencio, la base
 * seguiría dando la misma regla y esto escribiría comunicados hasta cerrar la
 * pestaña. Con el tope el destrozo máximo son cinco, no infinitos. Y cinco es
 * de sobra: una hermandad no tiene cinco reglas.
 */
export const TOPE_REGLAS = 5

/**
 * CUÁNTOS DÍAS ATRÁS SE RECUPERAN.
 *
 * ============================================================================
 * POR QUÉ HACE FALTA RECUPERAR NADA
 * ============================================================================
 *
 * Las reglas se miran cuando alguien entra en Comunicados, y en una hermandad
 * eso puede ser una vez por semana. Sin recuperar, «felicitar el cumpleaños»
 * solo alcanzaba a quien cumpliera JUSTO el día que alguien abrió esa pantalla:
 * se perdían casi todos, que es como no tener la función.
 *
 * ----------------------------------------------------------------------------
 * Y POR QUÉ CUATRO Y NO TODOS
 * ----------------------------------------------------------------------------
 *
 * Porque una felicitación tiene fecha de caducidad. «¡Felicidades!» un día
 * tarde se agradece; nueve días tarde es peor que no mandar nada — se lee como
 * que la hermandad se acordó por casualidad revisando una lista.
 *
 * Cuatro días cubre el fin de semana largo y la semana normal de quien entra
 * los lunes. Lo que quede fuera de eso se pierde, y se pierde a propósito.
 */
export const DIAS_QUE_SE_RECUPERAN = 4

export interface ComoDisparar {
  /** Pide a la base la siguiente regla que toca. `null` = no hay o la tiene otro. */
  reclamar: () => Promise<ReglaReclamada | null>
  /** A cuánta gente alcanza hoy. Sirve para no crear un comunicado a nadie. */
  cuantos: (r: ReglaReclamada) => number
  /** Crea el comunicado programado para hoy. */
  crear: (r: ReglaReclamada) => Promise<void>
  /** No se pudo: se devuelve para que se intente mañana. */
  devolver: (id: string) => Promise<void>
}

export async function dispararReglasDeHoy(como: ComoDisparar): Promise<{ creados: number; nombres: string[] }> {
  const r = { creados: 0, nombres: [] as string[] }

  for (let vuelta = 0; vuelta < TOPE_REGLAS; vuelta++) {
    let regla: ReglaReclamada | null = null
    try {
      regla = await como.reclamar()
    } catch {
      break     // sin red: mañana será otro día
    }
    if (!regla) break

    /*
     * SE TAPA EL HUECO DE LOS DÍAS QUE NADIE MIRÓ.
     *
     * Si la regla se disparó por última vez hace tres días, hoy tiene que
     * felicitar también a quien cumplió en esos tres. El sesgo se completa con
     * la fecha, y `filtrarSegmento` lo entiende como «hoy o desde entonces».
     *
     * Con un hueco mayor que el tope no se recupera nada: se felicita solo a
     * quien cumple hoy. Ver `DIAS_QUE_SE_RECUPERAN`.
     */
    if (regla.criterios?.cumpleanos === 'Hoy' && regla.ultimaVez) {
      const hueco = diasEntre(regla.ultimaVez, hoyDelSistema())
      if (hueco > 1 && hueco <= DIAS_QUE_SE_RECUPERAN + 1) {
        regla = { ...regla, criterios: { ...regla.criterios, cumpleDesde: regla.ultimaVez } }
      }
    }

    try {
      /*
       * SI HOY NO CUMPLE NADIE, NO SE CREA NADA — Y LA REGLA SE QUEDA MARCADA.
       *
       * Es el caso NORMAL: la mayoría de los días no cumple años ninguno de los
       * ochocientos. Crear un comunicado vacío llenaría la lista de comunicados
       * a cero personas, uno por día, hasta enterrar los de verdad.
       *
       * Y se queda marcada como disparada, que es lo correcto: la regla SÍ se
       * ha mirado hoy. Devolverla haría que se volviera a mirar cada vez que
       * alguien abre la pantalla.
       */
      if (como.cuantos(regla) === 0) continue

      await como.crear(regla)
      r.creados++
      r.nombres.push(regla.nombre)
    } catch {
      /*
       * Y SI FALLA AL CREARLO, SE DEVUELVE. Dejarla marcada perdería la
       * felicitación de hoy sin que nadie llegue a saberlo — que es exactamente
       * la clase de fallo mudo que esta aplicación lleva persiguiendo.
       */
      try {
        await como.devolver(regla.id)
      } catch {
        // Si tampoco se puede devolver, se pierde el día. No hay más que hacer.
      }
      break
    }
  }

  return r
}

/* --------------------------- las llamadas a la base ----------------------- */

export async function reclamarReglaDeLaBase(): Promise<ReglaReclamada | null> {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.rpc('reclamar_regla_de_hoy')
  if (error) return null
  const fila = (data as Record<string, unknown>[] | null)?.[0]
  if (!fila) return null
  return {
    id: String(fila.id),
    nombre: String(fila.nombre ?? ''),
    /*
     * SE COMPLETA CON LOS VALORES DE FÁBRICA. La columna es `jsonb`: lo que
     * llega es lo que hubiera guardado, y las reglas creadas antes de este
     * arreglo tienen dentro solo `{ cumpleanos: 'Hoy' }`. Sin esto, esas reglas
     * seguirían sin alcanzar a nadie después de actualizar.
     */
    criterios: { ...CRITERIOS_POR_DEFECTO, ...((fila.criterios ?? {}) as Partial<CriteriosSegmento>) },
    destinatarios: String(fila.destinatarios ?? ''),
    asunto: String(fila.asunto ?? ''),
    cuerpo: String(fila.cuerpo ?? ''),
    ultimaVez: (fila.ultima_vez as string | null) ?? null,
  }
}

export async function devolverReglaEnLaBase(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return
  await supabase.rpc('devolver_regla', { p_id: id })
}

/** Las reglas de la hermandad, para la pantalla que las gobierna. */
export function useReglasAutomaticas(opciones?: { sinEspejo?: boolean }) {
  return useSupabaseTable<ReglaAutomatica>(
    'reglas_automaticas',
    CLAVES_DATOS.reglasAutomaticas,
    [],
    reglaToRow,
    rowToRegla,
    'creada_en',
    opciones,
  )
}

/** Días de `desde` a `hasta`, las dos en `aaaa-mm-dd`. */
function diasEntre(desde: string, hasta: string): number {
  const aUTC = (t: string) => {
    const [a, m, d] = t.slice(0, 10).split('-').map(Number)
    return Date.UTC(a, (m ?? 1) - 1, d ?? 1)
  }
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86_400_000)
}

/** Hoy en `aaaa-mm-dd`, en hora de aquí. Ver `lib/hoy.ts` para el porqué. */
function hoyDelSistema(): string {
  const n = new Date()
  const dos = (x: number) => String(x).padStart(2, '0')
  return `${n.getFullYear()}-${dos(n.getMonth() + 1)}-${dos(n.getDate())}`
}
