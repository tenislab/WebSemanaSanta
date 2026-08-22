import type { Cuota } from '../data/cuotas'
import { esAvisado } from '../data/cuotas'
import type { Papeleta } from '../data/papeletas'
import type { Hermano } from '../data/hermanos'
import type { SolicitudAlta } from './solicitudes'
import type { SolicitudPapeleta } from './solicitudesPapeleta'
import { hermanosSinCuota } from './cuotasEmision'

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
    altaHermano: 0,
    sinCuota: 1,
    peticionPapeleta: 2,
    pagoPapeleta: 3,
    pagoCuota: 4,
  }
  return avisos.sort(
    (a, b) => PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo] || a.titulo.localeCompare(b.titulo, 'es'),
  )
}

/** Cuántos hay, para el número del menú. */
export function cuantosAvisos(f: FuentesDeAvisos): number {
  return avisosPendientes(f).length
}

/** Agrupados por tipo, para poder enseñarlos por bloques. */
export function avisosPorTipo(avisos: Aviso[]): { tipo: TipoAviso; titulo: string; avisos: Aviso[] }[] {
  const NOMBRES: Record<TipoAviso, string> = {
    altaHermano: 'Quieren entrar en la hermandad',
    sinCuota: 'Hermanos sin cuota',
    peticionPapeleta: 'Papeletas pedidas',
    pagoPapeleta: 'Pagos de papeleta por confirmar',
    pagoCuota: 'Pagos de cuota por confirmar',
  }
  const orden: TipoAviso[] = ['altaHermano', 'sinCuota', 'peticionPapeleta', 'pagoPapeleta', 'pagoCuota']
  return orden
    .map((tipo) => ({ tipo, titulo: NOMBRES[tipo], avisos: avisos.filter((a) => a.tipo === tipo) }))
    .filter((g) => g.avisos.length > 0)
}
