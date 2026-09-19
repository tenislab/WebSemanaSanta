import { hoy } from './fechas'
import { useMemo, useState } from 'react'
import { useSolicitudesPapeleta } from '../../../lib/solicitudesPapeleta'

import { gruposAutomaticos, precioDeTramo, tramosDeCuerpo, type Tramo } from '../../../lib/tramos'
import { nuevoId } from '../../../lib/supabaseSync'
import { type Campana } from '../../../lib/campana'
import { type Papeleta } from '../../../data/papeletas'
import { type SolicitudPapeleta } from '../../../lib/solicitudesPapeleta'

/**
 * LAS PAPELETAS QUE PIDEN LOS HERMANOS DESDE SU ÁREA.
 *
 * Aceptar una solicitud le da sitio: se le busca el primer tramo del cuerpo
 * que pidió y que tenga hueco —sin amontonar ni desbordar el aforo— y la
 * secretaría puede recolocarlo luego en Cortejo.
 *
 * `actuales` se pasa a mano y no se lee del estado: aceptando varias seguidas,
 * el estado todavía no se ha actualizado y las tres irían al mismo hueco.
 *
 * CINCO ENTRADAS.
 */
export function useLasSolicitudes({
  campana, tramos, precioBase, setPapeletas, siguienteNumero,
}: {
  campana: Campana
  tramos: Tramo[]
  precioBase: number
  setPapeletas: React.Dispatch<React.SetStateAction<Papeleta[]>>
  siguienteNumero: (lista: Papeleta[], anio?: number) => number
}) {
  const [solicitudes, setSolicitudes] = useSolicitudesPapeleta()
  const [solicitudesOpen, setSolicitudesOpen] = useState(false)
  const solicitudesPendientes = useMemo(
    () => solicitudes.filter((s) => s.anio === campana.anio && s.estado === 'Pendiente'),
    [solicitudes, campana.anio],
  )

  /** Acepta una solicitud online: le emite la papeleta con lo pedido y marca la solicitud como aceptada. */
  /**
   * Tramo del cortejo con el que se emite una solicitud aceptada, para que la
   * papeleta entre directa en el cortejo (sin colocarla a mano). Se elige del
   * cuerpo pedido: cirio (reparto por número) para nazareno/penitente, o el
   * primer tramo del cuerpo en otro caso. La secretaría puede recolocarlo luego.
   */
  /**
   * Elige el tramo con el que se emite una solicitud aceptada, para que la
   * papeleta entre directa en el cortejo. Del cuerpo pedido, prioriza el CIRIO
   * con más hueco (reparto por número); si no queda cirio con sitio, cualquier
   * tramo del cuerpo con hueco. `actuales` = papeletas del momento (para no
   * amontonar ni desbordar). La secretaría puede recolocarlo luego en Cortejo.
   */
  function tramoParaSolicitud(s: SolicitudPapeleta, actuales: Papeleta[]): Tramo | null {
    const cuerpo = s.tramoSolicitado && s.tramoSolicitado !== 'Sin preferencia' ? s.tramoSolicitado : null
    const enCuerpo = cuerpo ? tramosDeCuerpo(cuerpo, tramos) : tramos
    if (enCuerpo.length === 0) return null
    const ocupados = (tId: string) =>
      actuales.filter(
        (p) => p.tramoId === tId && p.anio === campana.anio && p.estado !== 'Anulada' && p.estado !== 'Renuncia',
      ).length
    const libres = (t: Tramo) => (t.capacidad ?? 999) - ocupados(t.id)
    // En los tramos por número el reparto es en CASCADA sobre el grupo entero,
    // y todas las papeletas se guardan con el id del primer tramo del grupo.
    // Mirando tramo a tramo, el 2º tramo de un grupo lleno parecía vacío y se
    // aceptaba (y se cobraba) una papeleta que luego salía «Excede aforo».
    const gruposConHueco = gruposAutomaticos(enCuerpo)
      .map((g) => ({
        grupo: g,
        libres: g.tramos.reduce((n, t) => n + (t.capacidad ?? 999), 0) - g.tramos.reduce((n, t) => n + ocupados(t.id), 0),
      }))
      .filter((g) => g.libres > 0)
      .sort((a, b) => b.libres - a.libres)
    if (gruposConHueco.length > 0) return gruposConHueco[0].grupo.tramos[0]
    const conHueco = enCuerpo.filter((t) => libres(t) > 0)
    return (conHueco[0] ?? enCuerpo[0]) ?? null
  }

  function aceptarSolicitud(s: SolicitudPapeleta) {
    setPapeletas((prev) => {
      const tramo = tramoParaSolicitud(s, prev)
      const tramoId = tramo ? tramo.id : null
      const importe = tramo ? precioDeTramo(tramo, precioBase) : precioBase
      // Con tramo → va al cortejo; sin tramo (sin cuerpo posible) → papeleta suelta.
      const opcion = tramoId ? null : `${s.modalidad}${s.preferencia ? ` · ${s.preferencia}` : ''}`
      const actual = prev.find((p) => p.hermanoId === s.hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        /**
         * SI YA ESTÁ COBRADA O ENTREGADA, NO SE TOCA.
         *
         * Este es el caso, y pasa: el hermano pide su sitio desde su área y
         * queda una solicitud pendiente. Antes de que nadie la mire, ese mismo
         * hermano pasa por el mostrador y la secretaría le emite la papeleta y
         * le cobra en efectivo, con su apunte en el libro. Días después alguien
         * abre el buzón —la solicitud sigue ahí, nadie la cerró— y pulsa
         * «Aceptar y emitir».
         *
         * Antes, eso devolvía la papeleta a «Asignada» con el importe
         * recalculado: el hermano volvía a figurar como que no ha pagado, con
         * el apunte del cobro ya hecho en Tesorería y sin nada que lo ate. Se
         * le reclamaba otra vez un dinero que ya había dado.
         *
         * Ahora se deja como está y solo se cierra la solicitud.
         */
        if (actual.estado === 'Pagada' || actual.estado === 'Entregada') return prev
        return prev.map((p) => (p.id === actual.id ? { ...p, opcion, tramoId, estado: 'Asignada', importe } : p))
      }
      const nueva: Papeleta = {
        id: nuevoId(),
        numero: siguienteNumero(prev),
        hermanoId: s.hermanoId,
        anio: campana.anio,
        tramoId,
        opcion,
        importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    setSolicitudes(solicitudes.map((x) => (x.id === s.id ? { ...x, estado: 'Aceptada' } : x)))
  }

  function rechazarSolicitud(s: SolicitudPapeleta) {
    setSolicitudes(solicitudes.map((x) => (x.id === s.id ? { ...x, estado: 'Rechazada' } : x)))
  }
  return {
    solicitudes, solicitudesPendientes, solicitudesOpen, setSolicitudesOpen,
    aceptarSolicitud, rechazarSolicitud,
  }
}
