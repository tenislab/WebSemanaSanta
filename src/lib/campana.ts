import { useEffect, useState } from 'react'
import type { Papeleta } from '../data/papeletas'
import { guardarPlantilla, traerPlantilla } from './plantillasHermandad'
import { isSupabaseConfigured } from './supabase'

/**
 * Una campaña de papeletas de sitio corresponde a la estación de penitencia
 * de un año. Cada año se abre una campaña nueva: quien tuvo sitio el año
 * anterior puede renovarlo hasta la fecha límite; pasado ese día, quien no
 * renovó pierde su sitio y queda libre para otros.
 */
export interface Campana {
  anio: number
  /** Día en que se abre el plazo para los hermanos que participaron el año anterior (renovadores). */
  fechaInicioParticiparon: string
  /** Día en que se abre el plazo para los que NO participaron el año anterior (suele ser algo más tarde). */
  fechaInicioNoParticiparon: string
  /** Fecha límite (fin del plazo) para solicitar/renovar (ISO yyyy-mm-dd). */
  fechaLimiteRenovacion: string
  /** Día de la estación de penitencia de esta edición (ISO), informativo. */
  fechaSalida: string | null
}

const STORAGE_KEY = 'cabildo-campana'

// Fechas de la campaña de muestra: pensadas para que el plazo esté ABIERTO al
// abrir la demo (así se ve funcionar la solicitud del hermano). Cada hermandad
// las ajusta desde Papeletas › Ajustes de campaña. La apertura para quienes NO
// participaron el año anterior va unos días por detrás de la de renovadores.
const CAMPANA_POR_DEFECTO: Campana = {
  anio: 2027,
  fechaInicioParticiparon: '2026-06-01',
  fechaInicioNoParticiparon: '2026-06-20',
  fechaLimiteRenovacion: '2027-02-28',
  fechaSalida: '2027-03-28',
}

/**
 * ¿Es una fecha de verdad? `2027-02-28` sí; `''`, `2027-0` y `31/02/2027` no.
 *
 * Se comprueba el formato Y que el día exista: `new Date('2027-02-31')` no
 * falla, se va al 3 de marzo, y una fecha que se corre sola tres días es peor
 * que una que se rechaza.
 */
function esFecha(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [a, mes, dia] = v.split('-').map(Number)
  /*
   * Se compara por partes y en HORA LOCAL, no con `toISOString()`.
   *
   * Ese atajo estaba escrito aquí y lo cazó `pruebas/fechas.prueba.mjs`:
   * `new Date('2027-02-28T00:00:00')` es medianoche LOCAL, y pasarlo a UTC en
   * España lo deja en el día 27 a las 23:00. O sea que la comprobación habría
   * rechazado TODAS las fechas buenas, y de paso habría vuelto a poner las de
   * fábrica encima de las que la hermandad tenía puestas. El arreglo habría
   * sido peor que el fallo.
   */
  const f = new Date(a, mes - 1, dia)
  return f.getFullYear() === a && f.getMonth() === mes - 1 && f.getDate() === dia
}

/**
 * LO GUARDADO MANDA, PERO SOLO SI ES UNA FECHA.
 *
 * Las fechas de la campaña se guardan AL VUELO: cada cambio del
 * `<input type="date">` llama a `guardarCampana` sin pasar por ningún botón y
 * sin validar nada. Y un campo de fecha vaciado —la equis del navegador, o
 * seleccionar y borrar para reescribirlo— devuelve cadena vacía.
 *
 * Antes esa cadena vacía machacaba el valor de fábrica, y a partir de ahí
 * `diasHasta('')` da NaN; `NaN <= 0` es falso; y `ventanaAbiertaPara` dice que
 * NO para todo el mundo. O sea: ningún hermano podía pedir su papeleta.
 *
 * Sin error, sin aviso y sin nada en pantalla que lo explicara —simplemente
 * dejaba de salir el botón—. Quien abrió los ajustes para cambiar una fecha
 * había cerrado la campaña entera sin enterarse, y quince pantallas leen esto.
 *
 * Se arregla aquí y no en cada una: es el único sitio por el que pasan todas.
 */
export function getCampana(): Campana {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const g = JSON.parse(raw) as Partial<Campana>
      return {
        anio: typeof g.anio === 'number' && Number.isFinite(g.anio) ? g.anio : CAMPANA_POR_DEFECTO.anio,
        fechaInicioParticiparon: esFecha(g.fechaInicioParticiparon)
          ? g.fechaInicioParticiparon : CAMPANA_POR_DEFECTO.fechaInicioParticiparon,
        fechaInicioNoParticiparon: esFecha(g.fechaInicioNoParticiparon)
          ? g.fechaInicioNoParticiparon : CAMPANA_POR_DEFECTO.fechaInicioNoParticiparon,
        fechaLimiteRenovacion: esFecha(g.fechaLimiteRenovacion)
          ? g.fechaLimiteRenovacion : CAMPANA_POR_DEFECTO.fechaLimiteRenovacion,
        fechaSalida: esFecha(g.fechaSalida) ? g.fechaSalida : CAMPANA_POR_DEFECTO.fechaSalida,
      }
    }
  } catch {
    // localStorage no disponible o datos corruptos: usamos los valores por defecto
  }
  return CAMPANA_POR_DEFECTO
}

/**
 * ¿HA CREADO LA HERMANDAD SU CAMPAÑA, O ESTÁ VIENDO LA DE FÁBRICA?
 *
 * ============================================================================
 * POR QUÉ HACE FALTA DISTINGUIRLO
 * ============================================================================
 *
 * `getCampana()` NUNCA devuelve vacío: si la hermandad no ha creado ninguna,
 * devuelve `CAMPANA_POR_DEFECTO`, que trae fechas inventadas para que la
 * demostración se vea funcionando.
 *
 * Eso está bien para pintar una pantalla y MUY MAL para decidir. Con las
 * fechas de fábrica, una hermandad que no ha creado su campaña parecía tener
 * una abierta —hoy cae dentro de ese plazo inventado— y se le ofrecía
 * «Convocar papeletas»: el correo más importante del año, anunciando un plazo
 * que nadie ha fijado y un año que a lo mejor no es el suyo.
 *
 * Y no se queda ahí: de `campana.anio` salen las papeletas «del año», que son
 * las que ordenan el cortejo y reparten los sitios.
 *
 * ----------------------------------------------------------------------------
 * CÓMO SE SABE
 * ----------------------------------------------------------------------------
 *
 * Por si la clave está escrita. Solo la escriben dos sitios: `saveCampana()`
 * —o sea, alguien la creó— y `cargarCampanaDeLaBase()`, que la trae si la
 * hermandad ya la tenía guardada. La de fábrica no se escribe nunca.
 *
 * MIENTRAS LA BASE NO HA CONTESTADO devuelve `false` unos instantes, y eso es
 * lo correcto: ante la duda, no ofrecer mandar un correo a ochocientas
 * personas. Se corrige solo en cuanto llega la respuesta.
 */
export function hayCampanaCreada(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    // Sin `localStorage` no se puede saber. Mismo criterio: no.
    return false
  }
}

/** Si ya contestó la base. Módulo, no estado: lo consultan varias pantallas. */
let seLePreguntoALaBase = false

/**
 * EN QUÉ SITUACIÓN ESTÁ LA CAMPAÑA. Tres, no dos.
 *
 *   'creada'    — la hermandad la tiene puesta. Lo normal.
 *   'sin-crear' — la base ha contestado y no hay ninguna.
 *   'sin-saber' — todavía no ha contestado.
 *
 * ============================================================================
 * POR QUÉ HACE FALTA LA TERCERA
 * ============================================================================
 *
 * Porque sin ella, durante el segundo que tarda la base en contestar, a una
 * hermandad que SÍ tiene su campaña se le decía «todavía no habéis creado la
 * campaña de papeletas». Es un mensaje que asusta y que además es falso, y sale
 * justo al abrir la pantalla, que es cuando más se lee.
 *
 * «No consta» y «no hay» no son lo mismo, y confundirlos es el mismo fallo que
 * ya estaba resuelto en `constaLaSuscripcion()`: a quien no le consta no se le
 * puede decir que no ha pagado.
 *
 * Mientras no se sepa NO se ofrece convocar —ante la duda no se manda un correo
 * a ochocientas personas— pero tampoco se afirma nada.
 */
export function estadoDeLaCampana(): 'creada' | 'sin-crear' | 'sin-saber' {
  if (hayCampanaCreada()) return 'creada'
  /*
   * SIN BASE DE DATOS NO HAY NADA QUE ESPERAR, y esto estaba mal.
   *
   * «Sin saber» solo tiene sentido mientras hay una consulta en marcha. Sin
   * Supabase —modo demostración, o una hermandad que todavía no la ha
   * conectado— no hay consulta ninguna: la respuesta es inmediata y es lo que
   * diga este navegador.
   *
   * Sin esta línea, esas pantallas se quedaban en «Comprobando la campaña de la
   * hermandad…» PARA SIEMPRE, y con el botón de convocar apagado sin más
   * explicación que un mensaje que nunca se resolvía.
   */
  if (!isSupabaseConfigured) return 'sin-crear'
  return seLePreguntoALaBase ? 'sin-crear' : 'sin-saber'
}

/**
 * Avisa a las pantallas abiertas de que la campaña ha cambiado.
 *
 * Hace falta porque `getCampana()` es SÍNCRONA y la usan quince sitios: si la
 * base contesta después de que la pantalla se haya pintado —y contesta
 * después siempre, es una llamada de red— nadie se entera de que lo que se
 * está enseñando es lo de fábrica.
 */
const EVENTO = 'cabildo-campana'

export function saveCampana(campana: Campana) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(campana))
  window.dispatchEvent(new Event(EVENTO))
  /*
   * Y A LA BASE, porque la campaña es de la hermandad y no del navegador.
   *
   * Esto es lo que estaba roto: la secretaría abría la campaña de 2026 desde
   * Papeletas › Ajustes de campaña, y eso se guardaba en SU ordenador. El
   * hermano, desde el móvil, leía la de fábrica: otro año, otro plazo y otra
   * fecha de salida. Pedía sitio para una Semana Santa que no tocaba y la
   * pantalla se lo daba por bueno.
   *
   * Y no se quedaba ahí: de `campana.anio` salen las papeletas «del año», que
   * son las que ordenan el cortejo, reparten los roles y deciden a quién le
   * llega cada comunicado por tramo.
   */
  void guardarPlantilla('campana', campana)
}

/**
 * Trae la campaña de la hermandad y la deja en la copia de este navegador.
 *
 * Se llama al arrancar, tanto en el panel como en el área del hermano: los
 * dos leen la campaña y los dos tienen que leer LA MISMA.
 */
export async function cargarCampanaDeLaBase(): Promise<void> {
  const c = await traerPlantilla<Partial<Campana>>('campana')
  /*
   * SE APUNTA QUE YA SE PREGUNTÓ, conteste lo que conteste.
   *
   * Sin esto no se puede distinguir «esta hermandad no ha creado campaña» de
   * «todavía no ha llegado la respuesta», y son cosas muy distintas: a la
   * segunda no se le puede decir «no habéis creado la campaña», porque a lo
   * mejor sí la tiene y solo va lenta la red. Ver `estadoDeLaCampana()`.
   */
  seLePreguntoALaBase = true
  window.dispatchEvent(new Event(EVENTO))
  if (!c || typeof c !== 'object' || c.anio === undefined) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...CAMPANA_POR_DEFECTO, ...c }))
  window.dispatchEvent(new Event(EVENTO))
}

/**
 * La campaña, refrescándose sola cuando llega la de la base o la cambia otra
 * pestaña. Para las pantallas que la pintan; quien solo la consulta de paso
 * puede seguir con `getCampana()`.
 */
export function useCampana(): Campana {
  const [campana, setCampana] = useState<Campana>(() => getCampana())
  useEffect(() => {
    function sync() {
      setCampana(getCampana())
    }
    window.addEventListener('storage', sync)
    window.addEventListener(EVENTO, sync)
    void cargarCampanaDeLaBase()
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(EVENTO, sync)
    }
  }, [])
  return campana
}

/** Días que faltan hasta una fecha ISO (negativo si ya pasó), normalizado a medianoche. */
export function diasHasta(iso: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - hoy.getTime()) / 86_400_000)
}

/**
 * ¿Sigue abierta la ventana de renovación? (hasta la fecha límite).
 *
 * ============================================================================
 * EL TERCER PARÁMETRO NO ES DECORATIVO: SIN ÉL ESTO MENTÍA
 * ============================================================================
 *
 * `getCampana()` nunca devuelve vacío: sin campaña creada devuelve la de
 * fábrica, con fechas de ejemplo. Y hoy caemos dentro de ese plazo inventado.
 *
 * Así que una hermandad recién montada veía «Renovación abierta hasta el 28 feb
 * 2027» en su pantalla de inicio y en Papeletas — un plazo que nadie había
 * fijado, dicho en negrita, y por tanto creído.
 *
 * `= true` por defecto para no arrastrarlo por las pruebas de fechas, que
 * hablan de campañas que existen. Lo que sujeta los sitios de verdad es una
 * prueba que RECORRE `src` y exige que todas las llamadas lo pasen: sin ella,
 * olvidarlo en una pantalla nueva no daría ningún error.
 */
export function ventanaAbierta(campana: Campana, hayCampana = true): boolean {
  if (!hayCampana) return false
  return diasHasta(campana.fechaLimiteRenovacion) >= 0
}

/**
 * ¿Puede este hermano solicitar/renovar HOY, según haya participado o no el
 * año anterior? Los que participaron pueden desde `fechaInicioParticiparon`;
 * el resto desde `fechaInicioNoParticiparon`. Ambos hasta la fecha límite.
 */
export function ventanaAbiertaPara(
  campana: Campana,
  participoElAnoAnterior: boolean,
  /*
   * SIN CAMPAÑA CREADA, CERRADA. Ver `ventanaAbierta` para el porqué entero.
   *
   * Aquí duele más que en ninguna otra parte: esta función es la que decide si
   * al HERMANO se le enseña «Solicitar mi papeleta de sitio» en su área. Con las
   * fechas de ejemplo se le ofrecía pedir sitio para una Semana Santa que su
   * hermandad no ha convocado — y eso no lo ve la junta, lo ven los
   * ochocientos.
   */
  hayCampana = true,
): boolean {
  if (!hayCampana) return false
  const inicio = participoElAnoAnterior ? campana.fechaInicioParticiparon : campana.fechaInicioNoParticiparon
  return diasHasta(inicio) <= 0 && diasHasta(campana.fechaLimiteRenovacion) >= 0
}

/**
 * ¿SE PUEDE CONVOCAR HOY? Y si no, por qué no.
 *
 * ============================================================================
 * EL FALLO QUE ESTO CIERRA
 * ============================================================================
 *
 * «Convocar papeletas» manda a TODOS los hermanos con correo el aviso más
 * importante del año, y no miraba ni una fecha. Se podía pulsar en agosto.
 *
 * Y lo que sale es un correo que dice, literalmente, «ya está abierto el plazo»
 * y «tienes de plazo hasta el {fecha}». Pulsado fuera de temporada eso son dos
 * mentiras a la vez, y cada una hace un destrozo distinto:
 *
 *   · ANTES DE ABRIR. Ochocientas personas entran a sacar su papeleta y el
 *     área del hermano —que sí mira las fechas, con `ventanaAbiertaPara()`— les
 *     dice que no pueden. Ochocientas personas convencidas de que la aplicación
 *     está rota, y secretaría cogiendo el teléfono toda la semana.
 *
 *   · DESPUÉS DE LA FECHA LÍMITE. El correo anuncia como plazo una fecha QUE YA
 *     PASÓ. Quien lo lea deprisa entiende que aún llega, y quien no, entiende
 *     que ha perdido el sitio por culpa de un aviso que llegó tarde. Este es el
 *     peor de los dos: el año pasado ese hermano salió, y el sitio se reparte.
 *
 * Un correo a ochocientas personas NO SE PUEDE DESHACER. Por eso esto es un
 * bloqueo y no un aviso: es exactamente el mismo criterio que
 * `acreedorIncompleto()` con el fichero SEPA —no dejar generar algo que va a
 * salir mal en casa de otro— y que `cuotas.remesada_el` con las remesas.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ LA APERTURA ES LA DE LOS RENOVADORES
 * ----------------------------------------------------------------------------
 *
 * Hay dos fechas de apertura: los que salieron el año pasado pueden antes, y
 * los demás unos días después. La convocatoria va a todos a la vez, así que se
 * toma la PRIMERA: en cuanto alguien puede sacar su papeleta, el plazo está
 * abierto y el correo dice verdad para ese alguien.
 *
 * ----------------------------------------------------------------------------
 * LA SALIDA, CUANDO LAS FECHAS SON LAS QUE ESTÁN MAL
 * ----------------------------------------------------------------------------
 *
 * No hay «convocar de todas formas», a propósito. Si una hermandad de verdad
 * necesita convocar hoy, es que sus fechas de campaña no son las que dice tener
 * — y entonces lo que hay que arreglar son las fechas, no saltarse el freno:
 * porque esas mismas fechas son las que van a decidir quién puede sacar
 * papeleta y quién pierde su sitio. Por eso el motivo dice a dónde ir.
 *
 * @param hoyIso Se pasa desde fuera para poder probarlo con una fecha fija.
 */
export function sePuedeConvocar(
  campana: Campana,
  hoyIso?: string,
  /*
   * ¿HAY CAMPAÑA DE VERDAD, o es la de fábrica?
   *
   * Por defecto `true` porque las pruebas de las FECHAS —que son la mayoría—
   * hablan de una campaña que existe, y arrastrar el tercer parámetro por
   * todas ellas solo añadiría ruido. Lo que sí hay es una prueba que comprueba
   * que la PANTALLA se lo pasa de verdad: es ahí donde el descuido costaría.
   */
  hayCampana = true,
): { puede: boolean; motivo: string } {
  /*
   * LO PRIMERO DE TODO. Sin campaña creada, las fechas que se estarían mirando
   * son inventadas, así que cualquier respuesta que saliera de compararlas
   * sería una respuesta sobre nada.
   */
  if (!hayCampana) {
    /*
     * SIN CAMPAÑA, EL MOTIVO ES CORTO. Y esto es una corrección de algo que se
     * veía fatal en pantalla.
     *
     * Aquí se explicaba entero —qué falta, dónde se crea, qué se pone— y justo
     * encima hay una banda que dice EXACTAMENTE eso. Se quedaban las dos
     * seguidas contando lo mismo con otras palabras, que es la forma más rápida
     * de que no se lea ninguna.
     *
     * La explicación larga vive en la banda de arriba, que es la que manda; esto
     * solo tiene que decir por qué el botón está apagado.
     */
    return { puede: false, motivo: 'Primero hay que crear la campaña.' }
  }
  const dias = (iso: string) => (hoyIso ? diasEntre(hoyIso, iso) : diasHasta(iso))
  const abre = campana.fechaInicioParticiparon
  const cierra = campana.fechaLimiteRenovacion

  const faltan = dias(abre)
  if (faltan > 0) {
    return {
      puede: false,
      motivo:
        `El plazo de la campaña ${campana.anio} todavía no ha abierto: empieza el ${enCristianoCorto(abre)}`
        + `${faltan === 1 ? ' (mañana)' : `, dentro de ${faltan} días`}. `
        + 'Si convocas ahora, el correo dirá que ya pueden sacar la papeleta y no podrán. '
        + 'Si las fechas no son las buenas, cámbialas en Ajustes de campaña.',
    }
  }

  const quedan = dias(cierra)
  if (quedan < 0) {
    return {
      puede: false,
      motivo:
        `El plazo de la campaña ${campana.anio} se cerró el ${enCristianoCorto(cierra)}. `
        + 'El correo anunciaría como fecha límite un día que ya ha pasado. '
        + 'Si vas a ampliarlo, cambia la fecha en Ajustes de campaña y vuelve a convocar.',
    }
  }

  return { puede: true, motivo: '' }
}

/** Días de `desde` a `hasta`, las dos en `yyyy-mm-dd`. Negativo si `hasta` ya pasó. */
function diasEntre(desde: string, hasta: string): number {
  const aUTC = (t: string) => {
    const [a, m, d] = t.slice(0, 10).split('-').map(Number)
    return Date.UTC(a, (m ?? 1) - 1, d ?? 1)
  }
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86_400_000)
}

/** «2027-02-28» -> «28 de febrero de 2027». Para decírselo a una persona. */
function enCristianoCorto(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${d} de ${meses[(m ?? 1) - 1]} de ${a}`
}

/**
 * ¿Participó el hermano en la campaña de ese año? Cuenta cualquier papeleta
 * emitida —de tramo o personalizada (mantilla, simbólica, aceptada online)—
 * salvo las anuladas y las renuncias. Sirve para decidir qué fecha de apertura
 * le aplica en la campaña siguiente (renovadores vs. nuevos), sin excluir a
 * quien salió con una papeleta sin sitio en el cortejo.
 */
export function participoEnCampana(hermanoId: string, papeletas: Papeleta[], anio: number): boolean {
  return papeletas.some(
    (p) => p.hermanoId === hermanoId && p.anio === anio && p.estado !== 'Anulada' && p.estado !== 'Renuncia',
  )
}

export type EstadoRenovacion =
  | 'Renovada'
  | 'Nueva'
  | 'Por renovar'
  | 'No renovada'
  | 'Sin papeleta'

export interface RenovacionHermano {
  estado: EstadoRenovacion
  /** Papeleta con puesto del año anterior (el «sitio guardado»), o null. */
  sitioAnterior: Papeleta | null
  /** Papeleta del año de la campaña activa (no anulada), o null. */
  papeletaActual: Papeleta | null
}

/**
 * Estado de renovación de un hermano en la campaña activa, derivado de sus
 * papeletas (nada se guarda: se recalcula). «Renuncia» y el fin de la ventana
 * de renovación producen ambos el estado «No renovada» (pierde el sitio).
 */
export function renovacionDeHermano(
  hermanoId: string,
  papeletas: Papeleta[],
  campana: Campana,
): RenovacionHermano {
  /**
   * Su sitio del año pasado, si de verdad salió.
   *
   * EL FILTRO DE ESTADO NO SOBRA. Antes solo se miraba que hubiera papeleta
   * con tramo, sin importar cómo acabó. Así, a quien anularon la papeleta el
   * año anterior —«no llegó a pagar»— le salía este año «Por renovar», con la
   * columna «Sitio 2026» diciendo su tramo y el botón «Renovar Cristo — Cirio
   * 1º tramo». O sea: la hermandad le guardaba el sitio y la prioridad a quien
   * no salió y no pagó, delante de los que sí.
   *
   * `participoEnCampana`, aquí al lado, SÍ excluía las anuladas: las dos
   * funciones daban respuestas distintas sobre si el hermano había salido.
   * Ahora usan el mismo criterio.
   */
  const sitioAnterior =
    papeletas.find(
      (p) =>
        p.hermanoId === hermanoId &&
        p.anio === campana.anio - 1 &&
        p.tramoId !== null &&
        p.estado !== 'Anulada' &&
        p.estado !== 'Renuncia',
    ) ?? null
  const papeletaActual =
    papeletas.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada') ?? null

  let estado: EstadoRenovacion
  if (papeletaActual?.estado === 'Renuncia') {
    estado = 'No renovada'
  } else if (papeletaActual) {
    estado = sitioAnterior ? 'Renovada' : 'Nueva'
  } else if (sitioAnterior) {
    estado = ventanaAbierta(campana) ? 'Por renovar' : 'No renovada'
  } else {
    estado = 'Sin papeleta'
  }

  return { estado, sitioAnterior, papeletaActual }
}
