/**
 * LAS DEVOLUCIONES DEL BANCO.
 *
 * Se manda la remesa, el banco cobra, y unos días después devuelve una parte.
 * Sin esto TODOS los recibos se quedaban «Pagada»: la hermandad creía tener un
 * dinero que no tenía, al hermano devuelto no se le volvía a pasar el recibo, y
 * a la remesa siguiente entraba otra vez la cuenta cancelada, con su comisión
 * otra vez.
 *
 * SE LEE Y SE ENSEÑA ANTES DE TOCAR NADA. Aplicar directo al soltar el fichero
 * sería cambiar veinte recibos y dos docenas de apuntes sin que nadie haya
 * visto qué trae: si el fichero es de otra remesa, o de otra hermandad, el
 * destrozo ya está hecho.
 *
 * CINCO PROPS —salían nueve y una no se usaba—, y ocho cosas se mudan con él: el fichero leído, el cruce, el
 * fallo de lectura, si está aplicando y el propio cajón no los usa nadie más.
 */
import { useMemo, useState } from 'react'
import type { Cuota } from '../../../data/cuotas'
import type { Hermano } from '../../../data/hermanos'
import type { Movimiento } from '../../../data/movimientos'
import {
  leerDevoluciones, cruzarConRecibos, type Cruce, type Devolucion,
} from '../../../lib/devoluciones'
import { conContraApunteDeDevolucion } from '../../../lib/apuntes'
import { origenDeDevolucion } from '../../../lib/devoluciones'
import { agregarAvisoHermano } from '../../../lib/avisosHermano'
import { apuntar } from '../../../lib/registroActividad'
import { hoyIso } from '../../../lib/hoy'

export interface LasDevoluciones {
  devolucionesOpen: boolean
  setDevolucionesOpen: (v: boolean) => void
  /** El fichero ya leído, o `null` si no hay ninguno cargado. */
  lectura: { devoluciones: Devolucion[] } | null
  falloLectura: string
  aplicando: boolean
  /** Lo que trae el fichero cruzado con los recibos de la hermandad. */
  cruceDevoluciones: Cruce<Cuota> | null
  cargarFicheroDeDevoluciones: (archivo: File) => Promise<void>
  aplicarDevoluciones: () => void
  /** Abre el cajón EN LIMPIO: lo que se leyó la vez anterior no se queda. */
  abrirDevoluciones: () => void
  /** Y al cerrarlo se suelta el fichero leído, por lo mismo. */
  cerrarDevoluciones: () => void
}

export function useLasDevoluciones({
  cuotas, setCuotas, setMovimientos, hermanos, miNombre,
}: {
  cuotas: Cuota[]
  setCuotas: React.Dispatch<React.SetStateAction<Cuota[]>>
  setMovimientos: React.Dispatch<React.SetStateAction<Movimiento[]>>
  hermanos: Hermano[]
  /** Quién ha cargado el fichero, para el registro de actividad. */
  miNombre: string
}): LasDevoluciones {
  const [devolucionesOpen, setDevolucionesOpen] = useState(false)
  const [lectura, setLectura] = useState<{ devoluciones: Devolucion[] } | null>(null)
  const [falloLectura, setFalloLectura] = useState('')
  const [aplicando, setAplicando] = useState(false)

  /*
   * ─────────────────────────────────────────────────────────────────────────
   * C3 · LAS DEVOLUCIONES DEL BANCO
   * ─────────────────────────────────────────────────────────────────────────
   *
   * Se manda la remesa, el banco cobra, y unos días después devuelve una parte.
   * Sin esto, TODOS los recibos se quedaban «Pagada»: la hermandad creía tener
   * un dinero que no tenía, al hermano devuelto no se le volvía a pasar el
   * recibo, y a la remesa siguiente entraba otra vez la cuenta cancelada — con
   * su comisión otra vez.
   *
   * SE LEE Y SE ENSEÑA ANTES DE TOCAR NADA. Aplicar directo al soltar el
   * fichero sería cambiar veinte recibos y dos docenas de apuntes sin que nadie
   * haya visto qué trae: si el fichero es de otra remesa, o de otra hermandad,
   * el destrozo ya está hecho.
   */
  async function cargarFicheroDeDevoluciones(archivo: File) {
    setFalloLectura('')
    setLectura(null)
    const texto = await archivo.text()
    const r = leerDevoluciones(texto)
    if (!r.ok) { setFalloLectura(r.error); return }
    setLectura({ devoluciones: r.devoluciones })
  }

  const cruceDevoluciones = useMemo(
    () => (lectura ? cruzarConRecibos(lectura.devoluciones, cuotas) : null),
    [lectura, cuotas],
  )

  function aplicarDevoluciones() {
    if (!cruceDevoluciones || cruceDevoluciones.casadas.length === 0) return
    setAplicando(true)
    const hoy = hoyIso()

    /*
     * EL RECIBO VUELVE A «Devuelta», NO A «Pendiente».
     *
     * Son cosas distintas y se tratan distinto: «Pendiente» es un recibo que
     * todavía no se ha intentado cobrar, y volvería a entrar en la siguiente
     * remesa tal cual — o sea, otra vez a la misma cuenta cancelada y otra
     * comisión. «Devuelta» dice que ya se intentó y falló, que es lo que hay
     * que mirar antes de volver a pasarlo.
     *
     * Y se le quita `remesadaEl`: ese recibo ya no está en ninguna remesa viva.
     */
    const porId = new Map(cruceDevoluciones.casadas.map((c) => [c.recibo.id, c.devolucion]))
    setCuotas((prev) => prev.map((c) => (porId.has(c.id)
      ? { ...c, estado: 'Devuelta' as const, fechaPago: undefined, remesadaEl: undefined }
      : c)))

    /*
     * Y AL LIBRO, COMO GASTO Y SIN BORRAR EL INGRESO. El dinero entró y volvió
     * a salir: las dos cosas están en el extracto del banco, y el libro tiene
     * que poder cuadrarse contra él línea a línea. Ver `lib/apuntes.ts`.
     */
    setMovimientos((prev) => cruceDevoluciones.casadas.reduce((libro, { recibo, devolucion }) => {
      const nombre = hermanos.find((h) => h.id === recibo.hermanoId)?.nombre ?? 'un hermano'
      return conContraApunteDeDevolucion(libro, {
        origen: origenDeDevolucion(recibo.id),
        concepto: `Devolución de ${recibo.concepto} — ${nombre} (${devolucion.motivo})`,
        categoria: 'Cuotas Hermanos/as',
        importe: devolucion.importe > 0 ? devolucion.importe : recibo.importe,
        fecha: hoy,
      })
    }, prev))

    // Y al hermano se le dice, que es quien tiene que arreglarlo con su banco.
    for (const { recibo, devolucion } of cruceDevoluciones.casadas) {
      agregarAvisoHermano(
        recibo.hermanoId,
        `El banco ha devuelto tu recibo de ${recibo.concepto}: ${devolucion.motivo.toLowerCase()}. `
        + 'Ponte en contacto con la secretaría para arreglarlo.',
        'cuota',
        'Un recibo devuelto',
      )
    }

    apuntar({
      autorNombre: miNombre, accion: 'cuota_devuelta', sobreTipo: 'cuota',
      sobreId: '', sobreNombre: '',
      detalle: `Cargó las devoluciones del banco: ${cruceDevoluciones.casadas.length} recibo(s) a «Devuelta»`,
    })

    setAplicando(false)
    setDevolucionesOpen(false)
    setLectura(null)
  }

  function abrirDevoluciones() {
    setDevolucionesOpen(true)
    setLectura(null)
    setFalloLectura('')
  }

  function cerrarDevoluciones() {
    setDevolucionesOpen(false)
    setLectura(null)
    setFalloLectura('')
  }

  return {
    devolucionesOpen, setDevolucionesOpen, abrirDevoluciones, cerrarDevoluciones,
    lectura, falloLectura, aplicando, cruceDevoluciones,
    cargarFicheroDeDevoluciones, aplicarDevoluciones,
  }
}
