/**
 * QUE UN COMUNICADO PROGRAMADO SE MANDE DE VERDAD.
 *
 * ============================================================================
 * EL FALLO QUE ESTO CIERRA
 * ============================================================================
 *
 * Un comunicado se podía marcar como «Programado», se le ponía fecha, se
 * guardaba y la pantalla lo contaba en su recuadro.
 *
 * Y NO LO MANDABA NADIE. NUNCA. No había una sola línea en el proyecto que
 * leyera esas filas para enviarlas.
 *
 * Es la mitad visible de una función a la que le falta la invisible, y de los
 * que peor sientan: la hermandad programa la convocatoria del cabildo, la ve en
 * la lista puesta como «Programado», y se queda tranquila.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ LO MANDA EL NAVEGADOR Y NO UN SERVIDOR
 * ----------------------------------------------------------------------------
 *
 * Lo «obvio» sería una función de Supabase llamada por `pg_cron`. El problema
 * es QUIÉN SON LOS DESTINATARIOS: eso lo decide `filtrarSegmento()`, que sabe
 * de estados, de cuotas sacadas de los recibos de verdad, de edades, etiquetas,
 * cargos efectivos, campos a medida y cumpleaños.
 *
 * Reescribir todo eso en SQL serían DOS versiones de la misma regla, y la
 * segunda siempre se queda atrás. Es exactamente el fallo que dejó a media
 * junta sin recibir la convocatoria durante meses, y no se comete otra vez a
 * sabiendas.
 *
 * Ya hay precedente y funciona: la copia de seguridad semanal se hace igual
 * (`copiaAutomatica.ts`), la lanza quien entra, y está escrito allí por qué.
 *
 * ----------------------------------------------------------------------------
 * LO QUE ESTO **NO** ES, Y HAY QUE SABERLO
 * ----------------------------------------------------------------------------
 *
 * NO es un servidor que manda a las nueve en punto. Sale cuando alguien abre
 * Comunicados —que es donde está cargado el censo con el que se resuelve a
 * quién va—, y por eso el numerito del menú se enciende cuando hay alguno
 * vencido: para que alguien entre.
 *
 * Para una convocatoria de cabildo, unas horas de retraso dan igual. Y lo que
 * había antes era NUNCA.
 *
 * El paso siguiente —una función de Supabase con `pg_cron`— está planificado
 * como F18.2 en `docs/PLAN-F18-EN-ADELANTE.md`, y exige antes llevarse la
 * resolución del segmento a la base sin duplicarla. Esto se puede cambiar por
 * aquello sin tocar nada de lo demás: el candado de la base ya es el mismo.
 */
import { isSupabaseConfigured, supabase } from './supabase'

/** Un comunicado que la base nos ha dado para mandarlo, y solo a nosotros. */
export interface ComunicadoReclamado {
  id: string
  titulo: string
  cuerpo: string
  destinatarios: string
  intentos: number
}

/**
 * A partir de aquí no se vuelve a intentar. Tiene que ser el mismo número que
 * la condición `envio_intentos < 3` de `supabase/envio-programado.sql`.
 *
 * Un bucle que manda correo es lo peor que puede tener esto: peor que un
 * comunicado sin mandar es el mismo comunicado saliendo cada hora.
 */
export const MAXIMO_INTENTOS = 3

export interface ResultadoProgramados {
  /** Comunicados que han salido enteros. */
  mandados: number
  /** Personas alcanzadas entre todos ellos. */
  personas: number
  /** Los que se han intentado y no han podido, con su motivo. */
  fallidos: { titulo: string; motivo: string }[]
}

/**
 * LAS COSAS QUE ESTA FUNCIÓN NO SABE HACER, y se le pasan de fuera.
 *
 * Se hace así para poder probarla entera sin navegador, sin base de datos y sin
 * mandar un solo correo — que en una función cuyo trabajo es mandar correos a
 * ochocientas personas es la única forma de probarla de verdad.
 */
export interface ComoMandar {
  /** Pide a la base el siguiente comunicado vencido. `null` = no hay o lo tiene otro. */
  reclamar: () => Promise<ComunicadoReclamado | null>
  /** A quién va este comunicado. Es lo que sabe la pantalla y no sabe la base. */
  destinatarios: (c: ComunicadoReclamado) => Promise<{ email: string; nombre: string; numero?: number | null }[]>
  /** Mandarlo. Devuelve a cuántos ha llegado. */
  enviar: (
    c: ComunicadoReclamado,
    a: { email: string; nombre: string; numero?: number | null }[],
  ) => Promise<{ enviados: number; error?: string }>
  /** Ya está: se cierra con su alcance real. */
  cerrar: (id: string, alcance: number) => Promise<void>
  /** No ha podido: se suelta y se apunta por qué, para volver a intentarlo. */
  soltar: (id: string, motivo: string) => Promise<void>
}

/**
 * MANDA TODOS LOS QUE ESTÉN VENCIDOS.
 *
 * ============================================================================
 * EL BUCLE, Y POR QUÉ TIENE UN TOPE
 * ============================================================================
 *
 * Se pide uno, se manda, se pide otro. La base va dando de uno en uno y solo a
 * quien pregunta primero, así que dos personas que entren a la vez se reparten
 * la lista en vez de mandarla dos veces cada una.
 *
 * `TOPE_POR_VUELTA` es un cinturón por si algo va mal: si `cerrar` fallara en
 * silencio, la base devolvería el mismo comunicado una y otra vez y esto
 * mandaría correos hasta que se cerrara la pestaña. Con el tope, el destrozo
 * máximo son diez envíos y no infinitos.
 *
 * No es un número pensado para limitar el trabajo de verdad: una hermandad no
 * programa diez comunicados para el mismo día. Si alguna vez los tuviera, los
 * que sobren salen la próxima vez que alguien entre.
 */
export const TOPE_POR_VUELTA = 10

export async function mandarLosProgramados(como: ComoMandar): Promise<ResultadoProgramados> {
  const r: ResultadoProgramados = { mandados: 0, personas: 0, fallidos: [] }

  for (let vuelta = 0; vuelta < TOPE_POR_VUELTA; vuelta++) {
    let c: ComunicadoReclamado | null = null
    try {
      c = await como.reclamar()
    } catch {
      /*
       * Si la base no contesta, se deja para la próxima vez. Esto corre al
       * abrir una pantalla: no puede tumbarla porque no haya red.
       */
      break
    }
    if (!c) break

    try {
      const gente = await como.destinatarios(c)

      /*
       * SIN NADIE A QUIEN MANDÁRSELO NO ES UN FALLO, PERO TAMPOCO UN ÉXITO.
       *
       * Un segmento puede quedarse vacío legítimamente —«los que cumplen años
       * hoy» algunos días no es nadie—. Se cierra como enviado con alcance 0 en
       * vez de reintentarlo tres veces: reintentar no va a hacer aparecer
       * gente, y dejarlo colgado es peor, porque se queda vencido para siempre
       * encendiendo el numerito del menú.
       */
      if (gente.length === 0) {
        await como.cerrar(c.id, 0)
        r.mandados++
        continue
      }

      const envio = await como.enviar(c, gente)

      /*
       * Y SI NO HA SALIDO NI UNO, NO SE DA POR ENVIADO.
       *
       * Es la diferencia entre «lo intentamos y no salió» y «ya está hecho».
       * Marcarlo como enviado con cero alcance es cómo se pierde una
       * convocatoria: el botón desaparece y nadie vuelve a mirarlo.
       */
      if (envio.enviados === 0) {
        const motivo = envio.error ?? 'No salió ningún correo.'
        await como.soltar(c.id, motivo)
        r.fallidos.push({ titulo: c.titulo, motivo: conElIntento(motivo, c.intentos) })
        continue
      }

      await como.cerrar(c.id, envio.enviados)
      r.mandados++
      r.personas += envio.enviados
    } catch (e) {
      /*
       * CUALQUIER COSA QUE REVIENTE SE SUELTA. Si no, el comunicado se queda
       * cogido media hora —el tiempo que tarda el candado en caducar— y quien
       * mire la pantalla no ve ni que ha salido ni que ha fallado.
       */
      const motivo = e instanceof Error ? e.message : 'Error inesperado al mandarlo.'
      try {
        await como.soltar(c.id, motivo)
      } catch {
        // Si tampoco se puede soltar, el candado caduca solo a la media hora.
      }
      r.fallidos.push({ titulo: c.titulo, motivo: conElIntento(motivo, c.intentos) })
    }
  }

  return r
}

/**
 * El motivo, diciendo si aún quedan intentos.
 *
 * Importa porque son dos situaciones distintas para quien lo lee: «se volverá a
 * intentar» es esperar, y «ya no se va a intentar más» es ponerse a arreglarlo.
 * Sin distinguirlas, un comunicado que ya no va a salir nunca parece que sigue
 * en camino.
 */
function conElIntento(motivo: string, intentos: number): string {
  return intentos >= MAXIMO_INTENTOS
    ? `${motivo} Es el intento ${intentos} y ya no se va a intentar más: arréglalo y vuelve a programarlo.`
    : `${motivo} Se volverá a intentar (intento ${intentos} de ${MAXIMO_INTENTOS}).`
}

/* ------------------------------------------------------------------------- */
/*  Y las tres llamadas de verdad a la base, que es lo único que no se prueba */
/*  sin Postgres. Van aquí y no en la pantalla para que `mandarLosProgramados` */
/*  se pueda leer sin saber nada de Supabase.                                 */
/* ------------------------------------------------------------------------- */

export async function reclamarDeLaBase(): Promise<ComunicadoReclamado | null> {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.rpc('reclamar_comunicado_programado')
  if (error) return null
  const fila = (data as Record<string, unknown>[] | null)?.[0]
  if (!fila) return null
  return {
    id: String(fila.id),
    titulo: String(fila.titulo ?? ''),
    cuerpo: String(fila.cuerpo ?? ''),
    destinatarios: String(fila.destinatarios ?? ''),
    intentos: Number(fila.intentos ?? 1),
  }
}

export async function cerrarEnLaBase(id: string, alcance: number): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return
  await supabase.rpc('cerrar_comunicado_enviado', { p_id: id, p_alcance: alcance })
}

export async function soltarEnLaBase(id: string, motivo: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return
  await supabase.rpc('soltar_comunicado_fallido', { p_id: id, p_error: motivo })
}
