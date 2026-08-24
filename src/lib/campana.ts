import { useEffect, useState } from 'react'
import type { Papeleta } from '../data/papeletas'
import { guardarPlantilla, traerPlantilla } from './plantillasHermandad'

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

export function getCampana(): Campana {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...CAMPANA_POR_DEFECTO, ...(JSON.parse(raw) as Partial<Campana>) }
  } catch {
    // localStorage no disponible o datos corruptos: usamos los valores por defecto
  }
  return CAMPANA_POR_DEFECTO
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

/** ¿Sigue abierta la ventana de renovación? (hasta la fecha límite). */
export function ventanaAbierta(campana: Campana): boolean {
  return diasHasta(campana.fechaLimiteRenovacion) >= 0
}

/**
 * ¿Puede este hermano solicitar/renovar HOY, según haya participado o no el
 * año anterior? Los que participaron pueden desde `fechaInicioParticiparon`;
 * el resto desde `fechaInicioNoParticiparon`. Ambos hasta la fecha límite.
 */
export function ventanaAbiertaPara(campana: Campana, participoElAnoAnterior: boolean): boolean {
  const inicio = participoElAnoAnterior ? campana.fechaInicioParticiparon : campana.fechaInicioNoParticiparon
  return diasHasta(inicio) <= 0 && diasHasta(campana.fechaLimiteRenovacion) >= 0
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
