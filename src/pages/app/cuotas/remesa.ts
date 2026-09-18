/**
 * LA REMESA BANCARIA: LO QUE SE LE MANDA AL BANCO PARA QUE COBRE.
 *
 * Recibos pendientes y domiciliados, con IBAN que valga y con mandato firmado
 * vigente para ESE IBAN. El CSV es un listado de trabajo; el XML es el fichero
 * de adeudo directo SEPA (pain.008.001.02) que exige el banco.
 *
 * Es la pieza que más dinero mueve de una vez —una hermandad de seiscientos
 * cobra el ejercicio entero de golpe— y lleva tres frenos que no se ven y que
 * conviene no perder de vista al tocarla:
 *
 *   · LO YA REMESADO NO VUELVE A ENTRAR SOLO. Mandar dos veces el mismo recibo
 *     son dos cargos al hermano, y el segundo vuelve devuelto y con comisión.
 *   · LOS QUE SE CAEN SE DICEN, Y POR QUÉ. Se caían en silencio: la tesorería
 *     creía cobrar a todos los domiciliados, el recibo se quedaba «Pendiente»
 *     para siempre y nada en la pantalla lo explicaba nunca.
 *   · UN IBAN MAL ESCRITO NO ES UNA LÍNEA RECHAZADA: el banco tira el fichero
 *     ENTERO.
 *
 * CINCO ENTRADAS DE DATOS —salían diez, y cinco eran su propio estado, que se
 * ha venido aquí con ella—: los recibos y su setter, la hermandad (de donde
 * salen el acreedor y el identificador SEPA), el censo, y las dos búsquedas:
 * el hermano de un recibo y su mandato vigente.
 */
import { useMemo, useState } from 'react'
import type { Cuota } from '../../../data/cuotas'
import type { Hermano } from '../../../data/hermanos'
import type { Movimiento } from '../../../data/movimientos'
import type { MandatoSepa } from '../../../lib/mandatosSepa'
import { buildSepaXml, acreedorIncompleto } from '../../../lib/sepa'
import { ibanValido, porQueNoValeElIban } from '../../../lib/iban'
import { conApunteDeCobro, origenDeCuota } from '../../../lib/apuntes'
import { descargarArchivo, toCsv } from '../../../lib/csv'
import { parseFechaEs, simularCobroRemesa } from '../../../lib/cuotasEmision'
import { sumaEuros } from '../../../lib/format'
import { hoyIso } from '../../../lib/hoy'
import { hoy, isoLocal } from './fechas'

export function useLaRemesa({
  cuotas, setCuotas, setMovimientos, setSelected, hermandad, hermanos, hermanoDe, mandatoDe,
}: {
  cuotas: Cuota[]
  setCuotas: React.Dispatch<React.SetStateAction<Cuota[]>>
  setMovimientos: React.Dispatch<React.SetStateAction<Movimiento[]>>
  setSelected: React.Dispatch<React.SetStateAction<Cuota | null>>
  hermandad: { nombreLegal: string; iban: string; identificadorAcreedor: string; cif: string }
  hermanos: Hermano[]
  hermanoDe: (id: string) => Hermano | undefined
  mandatoDe: (hermanoId: string, iban: string | null | undefined) => MandatoSepa | null
}) {
  const [remesaOpen, setRemesaOpen] = useState(false)
  const [fechaRemesa, setFechaRemesa] = useState('')

  /**
   * Auto-pagado simulado: marca como cobrada la remesa (sin pasarela real). Una
   * fracción determinista se devuelve, para que se vean también las devoluciones.
   */
  function simularCobro() {
    const ids = recibosRemesables.map((c) => c.id)
    if (ids.length === 0) return
    const fecha = hoy()
    const despues = simularCobroRemesa(cuotas, ids, fecha)
    setCuotas(despues)
    // El recibo abierto en la ficha también se actualiza (si no, seguía diciendo
    // «Pendiente» y al marcarlo pagado pisaba la devolución simulada).
    setSelected((prev) => (prev ? simularCobroRemesa([prev], ids, fecha)[0] : prev))

    /*
     * Y AL LIBRO DE CUENTAS, QUE ES LO QUE FALTABA.
     *
     * Esta es la vía que más dinero mueve de toda la aplicación: una hermandad
     * de seiscientos cobra aquí el ejercicio entero de una vez. Y no apuntaba
     * NADA — la cuota salía pagada, el hermano quedaba al día, y Tesorería no
     * se enteraba de que habían entrado veinte mil euros. No se nota hasta que
     * se cierra el año, y entonces ya no hay forma de reconstruir qué faltó.
     *
     * Solo las que de verdad quedaron cobradas: en la remesa hay devoluciones,
     * y apuntar una devuelta sería contar un dinero que el banco no ha dado.
     */
    const cobradas = despues.filter((c) => ids.includes(c.id) && c.estado === 'Pagada')
    setMovimientos((prev) => cobradas.reduce(
      (libro, c) => conApunteDeCobro(libro, {
        origen: origenDeCuota(c.id),
        concepto: `${c.concepto} — ${hermanos.find((h) => h.id === c.hermanoId)?.nombre ?? 'hermano/a'}`,
        categoria: 'Cuotas Hermanos/as',
        importe: c.importe,
        fecha,
        // Una remesa es un adeudo en cuenta: nunca es efectivo, aunque el
        // recibo llevara otro método apuntado de antes.
        metodo: 'Domiciliado',
      }),
      prev,
    ))
    setRemesaOpen(false)
  }

  // Remesa bancaria: recibos pendientes y domiciliados con IBAN, listos para
  // presentar al banco. El CSV es un listado de trabajo; el XML es el
  // fichero de adeudo directo SEPA (pain.008.001.02) que exige el banco.
  // Solo entran los recibos cuya fecha de cobro ya ha llegado (o llega en la
  // fecha elegida para la remesa). Sin este filtro, un fraccionamiento mensual
  // presentaba de golpe los doce meses del año al banco.
  const limiteRemesa = useMemo(() => {
    if (fechaRemesa) return new Date(`${fechaRemesa}T23:59:59`)
    const d = new Date()
    d.setDate(d.getDate() + 5)
    d.setHours(23, 59, 59, 999)
    return d
  }, [fechaRemesa])

  const recibosRemesables = useMemo(
    () =>
      cuotas.filter((c) => {
        // El IBAN tiene que estar Y valer. Uno mal escrito no se queda en una
        // línea rechazada: el banco tira el fichero ENTERO. Ver `lib/iban.ts`.
        if (c.estado !== 'Pendiente' || !c.domiciliada || !ibanValido(hermanoDe(c.hermanoId)?.iban ?? '')) return false
        // Y hace falta un mandato FIRMADO vigente para ESE IBAN: sin él no hay
        // orden del hermano que enseñarle al banco si reclama el cargo. Ver
        // `supabase/mandatos-sepa.sql` y `lib/mandatosSepa.ts`.
        const h = hermanoDe(c.hermanoId)!
        if (!mandatoDe(h.id, h.iban)) return false
        // Ya salió en un fichero descargado: no puede volver a entrar sola.
        // Mandar dos veces el mismo recibo al banco son dos cargos al hermano,
        // y el segundo vuelve devuelto y con comisión.
        if (c.remesadaEl) return false
        const cobro = parseFechaEs(c.fechaCobro)
        // Si la fecha no se puede interpretar, se incluye (no se pierde el recibo).
        return !cobro || cobro <= limiteRemesa
      }),
    [cuotas, hermanoDe, mandatoDe, limiteRemesa],
  )

  /**
   * LOS DOMICILIADOS QUE SE CAEN DE LA REMESA, Y POR QUÉ.
   *
   * Se caían EN SILENCIO. La tesorería generaba la remesa creyendo que cobraba
   * a todos los domiciliados, y a estos no. Su recibo se quedaba «Pendiente»
   * para siempre, entraba otra vez en la siguiente remesa, se volvía a caer, y
   * nada en la pantalla decía nunca por qué.
   *
   * En una hermandad son bastantes: el IBAN se importa del Excel de siempre,
   * donde alguien lo tecleó a mano hace años. Faltan cifras, sobran, está el
   * número de cuenta antiguo sin el «ES» delante, o sencillamente no está. Y
   * desde que existe el mandato firmado, hay un motivo más: el IBAN vale, pero
   * el hermano todavía no ha firmado su domiciliación desde su área.
   */
  const fueraDeLaRemesa = useMemo(() => {
    const fuera = cuotas
      .filter((c) => c.estado === 'Pendiente' && c.domiciliada && !c.remesadaEl)
      .map((c) => ({ cuota: c, hermano: hermanoDe(c.hermanoId) }))
      .filter((x) => x.hermano != null)
      .map((x) => ({
        ...x,
        motivo: !ibanValido(x.hermano!.iban ?? '')
          ? porQueNoValeElIban(x.hermano!.iban ?? '') ?? ''
          : !mandatoDe(x.hermano!.id, x.hermano!.iban)
            ? 'no ha firmado todavía el mandato SEPA de domiciliación'
            : null,
      }))
      .filter((x) => x.motivo != null)
      .map((x) => ({
        id: x.cuota.id,
        nombre: x.hermano!.nombre,
        numero: x.hermano!.numero,
        importe: x.cuota.importe,
        motivo: x.motivo as string,
      }))
    // Una fila por hermano, no una por recibo: al tesorero le sirve la lista de
    // a quién hay que pedirle el IBAN, y repetir al mismo cuatro veces —una por
    // recibo del año— la hace ilegible.
    const porHermano = new Map<number, typeof fuera[number] & { recibos: number }>()
    for (const f of fuera) {
      const ya = porHermano.get(f.numero)
      if (ya) { ya.recibos += 1; ya.importe += f.importe }
      else porHermano.set(f.numero, { ...f, recibos: 1 })
    }
    return [...porHermano.values()].sort((a, b) => a.numero - b.numero)
  }, [cuotas, hermanoDe, mandatoDe])

  const dineroFuera = useMemo(
    () => sumaEuros(fueraDeLaRemesa.map((f) => f.importe)),
    [fueraDeLaRemesa],
  )

  /** Pendientes que ya viajaron en un fichero descargado y por eso no entran. */
  const yaRemesados = useMemo(
    () => cuotas.filter((c) => c.remesadaEl && c.estado === 'Pendiente'),
    [cuotas],
  )
  const ultimaRemesa = useMemo(
    () => { const fechas = yaRemesados.map((c) => c.remesadaEl!).sort(); return fechas.length ? fechas[fechas.length - 1] : null },
    [yaRemesados],
  )

  const acreedor = useMemo(
    () => ({
      nombre: hermandad.nombreLegal,
      iban: hermandad.iban,
      identificadorAcreedor: hermandad.identificadorAcreedor,
      // El NIF va para que se pueda comprobar que el identificador es SUYO y no
      // el de otra hermandad: el identificador lo lleva dentro. Ver `sepa.ts`.
      nif: hermandad.cif,
    }),
    [hermandad],
  )
  const avisoAcreedor = useMemo(() => acreedorIncompleto(acreedor), [acreedor])

  function abrirRemesa() {
    const dentroCincoDias = new Date()
    dentroCincoDias.setDate(dentroCincoDias.getDate() + 5)
    // isoLocal, no toISOString: si no, se propone un día antes y encima se
    // arrastra al fichero del banco.
    setFechaRemesa(isoLocal(dentroCincoDias))
    setRemesaOpen(true)
  }

  function exportarRemesaCsv() {
    const filas = recibosRemesables.map((c) => {
      const h = hermanoDe(c.hermanoId)!
      return [c.numero, h.nombre, h.iban ?? '', c.concepto, c.importe.toFixed(2).replace('.', ','), c.fechaCobro]
    })
    const csv = toCsv(['Nº recibo', 'Hermano', 'IBAN', 'Concepto', 'Importe (€)', 'Fecha de cobro'], filas)
    descargarArchivo(`remesa-cuotas-${hoyIso()}.csv`, csv)
  }

  function descargarSepaXml() {
    if (avisoAcreedor || !fechaRemesa) return
    const recibos = recibosRemesables.map((c) => {
      const h = hermanoDe(c.hermanoId)!
      // Vigente por construcción: `recibosRemesables` ya exige que exista.
      const mandato = mandatoDe(h.id, h.iban)!
      return {
        numero: c.numero,
        importe: c.importe,
        concepto: `${c.concepto} — ${hermandad.nombreLegal || 'Hermandad'}`,
        deudor: {
          nombre: h.nombre,
          iban: h.iban ?? '',
          numeroHermano: h.numero,
          mandatoId: mandato.referencia,
          fechaFirma: new Date(mandato.firmadoEn),
        },
      }
    })
    const xml = buildSepaXml(acreedor, recibos, new Date(`${fechaRemesa}T00:00:00`), new Date())
    descargarArchivo(`remesa-sepa-${fechaRemesa}.xml`, xml, 'application/xml;charset=utf-8;')
    // Queda apuntado en cada recibo que ya viajó en un fichero. Antes no
    // quedaba rastro de ninguna clase: el recibo seguía «Pendiente» y
    // domiciliado, así que a la semana siguiente entraba otra vez en la remesa
    // y el hermano recibía el segundo cargo.
    const hoy = isoLocal(new Date())
    const enLaRemesa = new Set(recibosRemesables.map((c) => c.id))
    setCuotas((prev) => prev.map((c) => (enLaRemesa.has(c.id) ? { ...c, remesadaEl: hoy } : c)))
    setRemesaOpen(false)
  }

  /**
   * Soltar los recibos de la última remesa para poder volver a incluirlos.
   *
   * Hace falta porque descargar un fichero no significa haberlo mandado: se
   * descarga, se ve que la fecha estaba mal, se borra y se rehace. Sin esta
   * salida, esos recibos se quedarían fuera de toda remesa para siempre y
   * nadie entendería por qué no se les cobra.
   */
  function soltarRemesados() {
    const sueltos = cuotas.filter((c) => c.remesadaEl && c.estado === 'Pendiente')
    if (sueltos.length === 0) return
    if (!window.confirm(
      `Vas a devolver ${sueltos.length} recibo${sueltos.length === 1 ? '' : 's'} a la remesa. ` +
      'Hazlo solo si el fichero anterior NO llegó a mandarse al banco: si ya se mandó, ' +
      'volverías a cobrarles.',
    )) return
    const ids = new Set(sueltos.map((c) => c.id))
    setCuotas((prev) => prev.map((c) => (ids.has(c.id) ? { ...c, remesadaEl: undefined } : c)))
  }

  return {
    remesaOpen, setRemesaOpen, fechaRemesa, setFechaRemesa,
    recibosRemesables, fueraDeLaRemesa, dineroFuera, yaRemesados, ultimaRemesa,
    avisoAcreedor, abrirRemesa, exportarRemesaCsv, descargarSepaXml,
    soltarRemesados, simularCobro,
  }
}
