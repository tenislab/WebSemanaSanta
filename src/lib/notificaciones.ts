import type { Cuota } from '../data/cuotas'
import { esAvisado } from '../data/cuotas'
import type { Papeleta } from '../data/papeletas'
import type { Hermano } from '../data/hermanos'
import type { SolicitudAlta } from './solicitudes'
import type { SolicitudPapeleta } from './solicitudesPapeleta'
import { hermanosSinCuota } from './cuotasEmision'
import type { MensajeWeb } from './mensajesWeb'
import { isSupabaseConfigured, supabase } from './supabase'
import { modoDemoActivo } from './demo'
import { resumenMensaje } from './mensajesWeb'

/**
 * TODO LO QUE ESPERA A QUE LA JUNTA HAGA ALGO, EN UN SOLO SITIO.
 *
 * Llegó dicho así: «he mandado una solicitud de crear nuevo hermano y no están
 * en ningún lado», y «hacemos panel de notificaciones donde van todo eso».
 *
 * EL PROBLEMA DE FONDO no es que faltara una pantalla: es que cada cosa que
 * espera respuesta vive en el módulo donde se resuelve, que es lo lógico
 * mientras trabajas y lo peor cuando NO sabes que hay algo esperando.
 *
 *   · el alta de un hermano nuevo      → dentro de Hermanos
 *   · el «ya he pagado» de una cuota   → dentro de Cuotas
 *   · el «ya he pagado» de una papeleta→ dentro de Papeletas
 *   · la petición de papeleta          → dentro de Papeletas
 *
 * Repartido así, para enterarse de que alguien pidió el alta hay que entrar en
 * Hermanos a mirar. Y si no se entra, la persona se queda esperando —que es
 * exactamente lo que pasó—. Un aviso que hay que ir a buscar no es un aviso.
 *
 * Esto NO mueve nada de su sitio: cada cosa se sigue resolviendo donde estaba.
 * Lo que hace es juntar la lista de lo que está esperando, con el botón que lo
 * resuelve al lado.
 *
 * Es una función pura a propósito —se le pasan los datos, devuelve la lista—
 * para poder probar sin pintar nada las dos cosas que de verdad importan: que
 * no se cuele lo ya resuelto, y que no se quede fuera lo que espera.
 */

export type TipoAviso =
  | 'altaHermano' | 'pagoCuota' | 'pagoPapeleta' | 'peticionPapeleta'
  /* Hermanos activos a los que no se les ha emitido la cuota del ejercicio. */
  | 'sinCuota'
  /*
   * QUIEN HA PEDIDO LA BAJA DESDE SU ÁREA.
   *
   * Esto faltaba, y era el peor de todos los silencios de esta pantalla. La
   * baja se guardaba bien —queda marcada en la ficha, con su fecha y su
   * motivo— y llegaba a la base. Lo único que no pasaba es que alguien se
   * enterara: había que buscar al hermano por su nombre para verlo.
   *
   * O sea que una persona pedía darse de baja de su hermandad, la aplicación
   * le decía que quedaba pedida, y allí se quedaba. Semanas. Hasta que llamaba
   * preguntando por qué le seguían pasando el recibo — que es exactamente la
   * llamada más desagradable que puede recibir una hermandad.
   */
  | 'bajaPedida'
  /*
   * LOS MENSAJES DE LA WEB PÚBLICA.
   *
   * Tenían su bandeja desde el principio, pero DENTRO de la pantalla de Web
   * pública: para verlos había que ir a mirarlos, y a esa pantalla se entra
   * cuando se quiere cambiar algo de la web, o sea casi nunca.
   *
   * Un formulario de contacto que nadie mira es peor que no tenerlo: la
   * hermandad publica un «escríbenos» y no contesta.
   */
  | 'mensajeWeb'

export interface Aviso {
  /** Único entre todos los tipos: el mismo id puede existir en dos tablas. */
  id: string
  tipo: TipoAviso
  /** De quién es, en una línea. */
  titulo: string
  /** Lo que hace falta para decidir: el importe, el método, la fecha. */
  detalle: string
  /** Para ordenar. Formato ISO cuando se sabe; si no, cadena vacía. */
  fecha: string
  /** El hermano al que afecta, si lo hay (un alta todavía no es hermano). */
  hermanoId?: string
  /** El id de la fila original, para poder resolverla. */
  refId: string
  /** Lo que pone el botón de aceptar, dicho por lo que va a pasar. */
  aceptar: string
  /** Y el de rechazar, cuando rechazar tiene sentido. */
  rechazar?: string
  /** A dónde ir para verlo entero. */
  donde: string
}

/** Lo que hace falta para armar la lista. Se pasa de fuera: esto es puro. */
export interface FuentesDeAvisos {
  solicitudes: SolicitudAlta[]
  cuotas: Cuota[]
  papeletas: Papeleta[]
  peticionesPapeleta: SolicitudPapeleta[]
  hermanos: Hermano[]
  /**
   * El ejercicio en curso y el concepto de la cuota anual, para poder avisar
   * de a quién le falta. Si no se saben, ese aviso no sale: es mejor no decir
   * nada que decir «faltan 40 cuotas» del año equivocado.
   */
  ejercicio?: number | null
  conceptoCuota?: string | null
  /**
   * Los mensajes de la web pública. Opcional: quien no los pase —una pantalla
   * que solo quiera el número del menú— sigue funcionando igual.
   */
  mensajesWeb?: MensajeWeb[]
}

function nombreDe(hermanos: Hermano[], id: string | undefined): string {
  if (!id) return 'Un hermano'
  return hermanos.find((h) => h.id === id)?.nombre ?? 'Un hermano'
}

function euros(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`
}

/**
 * ¿Está pagada ya? Se mira el estado, no el aviso.
 *
 * Un pago avisado y ya cobrado NO es un aviso: es historia. Si se colara, la
 * lista crecería sola con cosas resueltas y en dos semanas nadie la miraría,
 * que es la manera de que un panel de avisos deje de servir.
 */
function papeletaEsperaCobro(p: Papeleta): boolean {
  return !!p.pagoComunicado && p.estado !== 'Pagada' && p.estado !== 'Entregada' && p.estado !== 'Anulada'
}

export function avisosPendientes(f: FuentesDeAvisos): Aviso[] {
  const avisos: Aviso[] = []

  // 1. Quien pide entrar en la hermandad. Es el que más duele dejar esperando:
  //    hay una persona al otro lado que no sabe si su solicitud ha llegado.
  for (const s of f.solicitudes.filter((x) => x.estado === 'Pendiente')) {
    avisos.push({
      id: `alta:${s.id}`,
      tipo: 'altaHermano',
      titulo: `${s.nombre} pide entrar como hermano/a`,
      detalle: [s.dni, s.email, s.tutorId ? 'A cargo de un hermano (menor)' : null]
        .filter(Boolean).join(' · '),
      fecha: s.fecha,
      refId: s.id,
      aceptar: 'Dar de alta',
      rechazar: 'Rechazar',
      donde: '/app/hermanos',
    })
  }

  // 2. «Ya he pagado mi cuota» — Bizum o transferencia, avisado desde su área.
  for (const c of f.cuotas.filter(esAvisado)) {
    const m = c.pagoComunicado!
    avisos.push({
      id: `cuota:${c.id}`,
      tipo: 'pagoCuota',
      titulo: `${nombreDe(f.hermanos, c.hermanoId)} ha pagado su cuota por ${m.metodo}`,
      detalle: `${euros(c.importe)} · avisado el ${m.fecha}`,
      fecha: m.fecha,
      hermanoId: c.hermanoId,
      refId: c.id,
      // El botón dice lo que va a pasar, no «Aceptar»: lo que pasa es que el
      // recibo queda cobrado.
      aceptar: 'Dar por cobrada',
      donde: '/app/cuotas',
    })
  }

  // 3. Lo mismo con la papeleta de sitio.
  for (const p of f.papeletas.filter(papeletaEsperaCobro)) {
    const m = p.pagoComunicado!
    avisos.push({
      id: `papeleta:${p.id}`,
      tipo: 'pagoPapeleta',
      titulo: `${nombreDe(f.hermanos, p.hermanoId)} ha pagado su papeleta por ${m.metodo}`,
      detalle: `Nº ${p.numero} · ${euros(p.importe)} · avisado el ${m.fecha}`,
      fecha: m.fecha,
      hermanoId: p.hermanoId,
      refId: p.id,
      aceptar: 'Dar por pagada',
      donde: '/app/papeletas',
    })
  }

  // 4. Y quien ha pedido su papeleta y espera que se le asigne sitio.
  for (const s of f.peticionesPapeleta.filter((x) => x.estado === 'Pendiente')) {
    avisos.push({
      id: `peticion:${s.id}`,
      tipo: 'peticionPapeleta',
      titulo: `${nombreDe(f.hermanos, s.hermanoId)} ha pedido su papeleta de sitio`,
      detalle: `Campaña ${s.anio}`,
      fecha: String(s.anio),
      hermanoId: s.hermanoId,
      refId: s.id,
      aceptar: 'Ver y asignar',
      donde: '/app/papeletas',
    })
  }

  /*
   * --- QUIEN HA PEDIDO LA BAJA ---
   *
   * Es el aviso que más falta hacía y el que no estaba. La baja se guardaba
   * bien y llegaba a la base; simplemente no la miraba nadie, así que había que
   * buscar al hermano por su nombre para enterarse de que la había pedido.
   *
   * SE MIRA `bajaSolicitada` Y NO `estado === 'Baja'`: son dos cosas distintas
   * y confundirlas haría que el aviso no se fuera nunca. `bajaSolicitada` es
   * «lo ha pedido»; `estado` es «se ha tramitado». Mientras secretaría no la
   * tramite, el hermano sigue Activo y con la marca puesta — que es justo el
   * estado en el que hay que avisar. Al tramitarla, `darDeBajaEnCenso` limpia
   * la marca y el aviso desaparece solo.
   */
  for (const h of f.hermanos.filter((x) => x.bajaSolicitada && x.estado !== 'Baja')) {
    avisos.push({
      id: `baja:${h.id}`,
      tipo: 'bajaPedida',
      titulo: `${h.nombre} ha pedido darse de baja`,
      /*
       * EL MOTIVO VA AQUÍ, entero. No se le obliga a darlo —exigir que alguien
       * se justifique para irse está feo— pero cuando lo da es lo único que
       * permite intentar retenerle antes de tramitarla.
       */
      detalle: [
        h.numero > 0 ? `Hermano/a nº ${h.numero}` : null,
        h.bajaSolicitadaEl ? `pedida el ${h.bajaSolicitadaEl}` : null,
        h.motivoBaja || 'sin motivo indicado',
      ].filter(Boolean).join(' · '),
      fecha: h.bajaSolicitadaEl ?? '',
      hermanoId: h.id,
      refId: h.id,
      // No se tramita desde aquí: dar de baja toca el escalafón, las cuotas
      // pendientes y la papeleta del año. Eso lo hace la ficha, con todo delante.
      aceptar: 'Ver su ficha',
      /*
       * DIRECTO A SU FICHA, no a la lista. `?ficha=` ya lo entiende la pantalla
       * de Hermanos. Llevar a la lista de cuatrocientos y decirle a alguien que
       * busque a Fulano es la mitad del trabajo, y es la mitad que se olvida.
       */
      donde: `/app/hermanos?ficha=${h.id}`,
    })
  }

  /*
   * --- LOS MENSAJES DE LA WEB PÚBLICA ---
   *
   * Tenían su bandeja desde el principio, pero solo DENTRO de la pantalla de
   * Web pública, y a esa pantalla se entra cuando se quiere cambiar algo de la
   * web: casi nunca. Un formulario de contacto que nadie mira es peor que no
   * tenerlo, porque la hermandad publica un «escríbenos» y no contesta.
   *
   * SOLO LOS NO LEÍDOS. Un mensaje leído y sin contestar ya no es un aviso: es
   * trabajo pendiente de alguien, y esta pantalla es para enterarse, no para
   * llevar una lista de tareas.
   */
  for (const m of (f.mensajesWeb ?? []).filter((x) => !x.leido)) {
    avisos.push({
      id: `web:${m.id}`,
      tipo: 'mensajeWeb',
      titulo: `${m.nombre || 'Alguien'} ha escrito desde la web`,
      detalle: [resumenMensaje(m), m.email, m.telefono].filter(Boolean).join(' · '),
      fecha: m.fecha,
      refId: m.id,
      aceptar: 'Leerlo',
      /*
       * A LA PESTAÑA DEL BUZÓN, no a «Web pública» a secas.
       *
       * El buzón vive dentro de la pantalla de la web, y esa pantalla se abre
       * por la última pestaña que se estuviera tocando —se guarda en la
       * sesión—. Así que «Leerlo» llevaba a Diseño, o a Portada, o a donde
       * fuera: parecía que el botón te sacaba a la web en vez de abrirte el
       * mensaje. Con `ir` se dice a qué pestaña, y con `mensaje` cuál.
       */
      donde: `/app/web?ir=buzon&mensaje=${m.id}`,
    })
  }

  /*
   * QUIEN NO TIENE CUOTA. Llegó dicho así: «las cuotas tienen que ir por
   * hermanos, no puede haber hermano y cuota vacía».
   *
   * La maquinaria de emitirlas ya existía y está bien: `hermanosSinCuota()`
   * sabe exactamente a quién le falta. Lo que no había era manera de
   * ENTERARSE — solo pasaba si alguien entraba en Cuotas y le daba a emitir—,
   * así que un hermano dado de alta en marzo se quedaba el año entero sin
   * recibo y sin que nadie lo notara.
   *
   * Va como AVISO y no se emite sola desde aquí a propósito: emitir una cuota
   * es un acto de tesorería que necesita concepto, importe, fecha de cobro y
   * método, y todo eso lo pregunta la pantalla de Cuotas. Crearlas por detrás
   * con valores supuestos es meter dinero inventado en la contabilidad de una
   * hermandad.
   */
  if (f.ejercicio && f.conceptoCuota) {
    const faltan = hermanosSinCuota(f.cuotas, f.hermanos, f.ejercicio, f.conceptoCuota)
    if (faltan.length > 0) {
      avisos.push({
        id: `sincuota:${f.ejercicio}`,
        tipo: 'sinCuota',
        titulo: faltan.length === 1
          ? `${faltan[0].nombre} no tiene la cuota de ${f.ejercicio}`
          : `${faltan.length} hermanos no tienen la cuota de ${f.ejercicio}`,
        detalle: faltan.length === 1
          ? `Alta sin recibo de «${f.conceptoCuota}»`
          : faltan.slice(0, 3).map((h) => h.nombre).join(', ')
            + (faltan.length > 3 ? ` y ${faltan.length - 3} más` : ''),
        fecha: String(f.ejercicio),
        refId: String(f.ejercicio),
        aceptar: 'Emitir sus cuotas',
        donde: '/app/cuotas',
      })
    }
  }

  /*
   * Lo más reciente arriba. Las fechas de esta aplicación vienen en formatos
   * distintos según de dónde salgan («18 ene 2026», ISO, un año suelto), así
   * que no se pueden comparar como fechas sin equivocarse: se ordena por tipo
   * —primero lo que tiene a una persona esperando— y dentro, alfabético, que
   * al menos es estable y no baila entre recargas.
   */
  const PRIORIDAD: Record<TipoAviso, number> = {
    // Los tres primeros tienen a una PERSONA esperando respuesta. Va por delante
    // de cualquier trabajo, por urgente que parezca el trabajo.
    altaHermano: 0,
    bajaPedida: 1,
    mensajeWeb: 2,
    sinCuota: 3,
    peticionPapeleta: 4,
    pagoPapeleta: 5,
    pagoCuota: 6,
  }
  return avisos.sort(
    (a, b) => PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo] || a.titulo.localeCompare(b.titulo, 'es'),
  )
}

/**
 * ============================================================================
 * EL NUMERITO DEL MENÚ
 * ============================================================================
 *
 * La pantalla de Notificaciones lo enseña todo, pero solo si entras a mirarla.
 * Esto es la luz del buzón: el número que sale al lado de «Notificaciones» en
 * el menú, en todas las pantallas.
 *
 * LO CUENTA LA BASE, NO EL NAVEGADOR, y esa es la decisión de todo el asunto.
 * `cuantosAvisos()` de aquí abajo sabe contarlos, pero necesita tener delante
 * las solicitudes, las cuotas, las papeletas, los hermanos y los mensajes. Y el
 * numerito sale EN TODAS LAS PANTALLAS: contarlo aquí obligaría a cargar esas
 * cinco tablas en Tesorería, en el Inventario y en la Web pública, que es justo
 * lo contrario de lo que se está haciendo para que esto aguante al crecer.
 *
 * La función del servidor es una consulta y devuelve un número. El detalle de
 * qué cuenta —y qué NO cuenta, que importa más— está en
 * `supabase/contador-de-avisos.sql`.
 *
 * NO LANZA NUNCA. Si falla —base atrasada sin la función, sin red, proyecto en
 * pausa— devuelve 0, o sea «no hay nada que ver», que es exactamente como se
 * comportaba antes de existir el contador. Un adorno del menú no puede impedir
 * que nadie entre a trabajar.
 */
export async function contarAvisosQueEsperan(): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 0
  if (modoDemoActivo()) return 0
  try {
    const { data, error } = await supabase.rpc('avisos_que_esperan')
    if (error) return 0
    const n = Number(data ?? 0)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

/**
 * LOS TIPOS QUE **NO** ENTRAN EN EL NUMERITO, con su motivo.
 *
 * Se exporta para que una prueba pueda comprobar que todo tipo de aviso está o
 * contado en la función de la base o aquí. Así, añadir un tipo nuevo obliga a
 * decidir de qué lado va en vez de que se quede fuera sin que nadie lo note.
 */
export const NO_CUENTAN_EN_EL_MENU: Partial<Record<TipoAviso, string>> = {
  /*
   * «Hermanos sin cuota» no es algo que HAYA LLEGADO: es un estado de la
   * hermandad. No hay nadie esperando al otro lado, no se resuelve
   * contestando, y estaría en el contador todo el año hasta que se emitieran
   * las cuotas. Un numerito que no baja nunca es un numerito que se deja de
   * mirar — y con él se dejan de mirar los que sí importaban.
   */
  sinCuota: 'es un estado de la hermandad, no algo que espere respuesta',
}

/** Cuántos hay, para el número del menú. */
export function cuantosAvisos(f: FuentesDeAvisos): number {
  return avisosPendientes(f).length
}

/** Agrupados por tipo, para poder enseñarlos por bloques. */
export function avisosPorTipo(avisos: Aviso[]): { tipo: TipoAviso; titulo: string; avisos: Aviso[] }[] {
  const NOMBRES: Record<TipoAviso, string> = {
    altaHermano: 'Quieren entrar en la hermandad',
    bajaPedida: 'Han pedido darse de baja',
    sinCuota: 'Hermanos sin cuota',
    peticionPapeleta: 'Papeletas pedidas',
    pagoPapeleta: 'Pagos de papeleta por confirmar',
    pagoCuota: 'Pagos de cuota por confirmar',
    mensajeWeb: 'Mensajes desde la web',
  }
  /*
   * LAS BAJAS VAN LAS SEGUNDAS, justo detrás de quien quiere entrar.
   *
   * No es por gusto: son las dos únicas cosas de esta lista donde hay una
   * PERSONA esperando una respuesta de la hermandad. Lo demás es trabajo, y el
   * trabajo puede esperar al martes; una baja sin contestar acaba en una
   * llamada preguntando por qué le siguen pasando el recibo.
   */
  const orden: TipoAviso[] = [
    'altaHermano', 'bajaPedida', 'mensajeWeb',
    'sinCuota', 'peticionPapeleta', 'pagoPapeleta', 'pagoCuota',
  ]
  return orden
    .map((tipo) => ({ tipo, titulo: NOMBRES[tipo], avisos: avisos.filter((a) => a.tipo === tipo) }))
    .filter((g) => g.avisos.length > 0)
}
