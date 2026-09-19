import type { Asignacion as AsignacionPapeleta } from '../../../lib/cortejo'
import { type Tramo } from '../../../lib/tramos'
import { useState } from 'react'

import { type Hermano } from '../../../data/hermanos'
import { type Papeleta } from '../../../data/papeletas'
import { useMemo } from 'react'

/**
 * IMPRIMIR LAS PAPELETAS EN MASA: UN PDF CON UNA POR PÁGINA.
 *
 * Y SE RECOGE CON `afterprint`, no en la línea de después de `print()`:
 * `window.print()` no promete devolver el control cuando el papel ya ha
 * salido. En un navegador que vuelve enseguida se estaban tirando las
 * cuatrocientas papeletas MIENTRAS se imprimían. Con red de seguridad a los
 * diez segundos por si `afterprint` no llega.
 *
 * TRES ENTRADAS.
 */
export interface ItemImpresion {
  papeleta: Papeleta
  hermano: Hermano
  tramo: Tramo | null
  puesto: number | null
  excedeAforo: boolean
}

export function useLaImpresion({
  papeletasActivas, asignacionPorPapeleta, hermanoDe,
}: {
  papeletasActivas: Papeleta[]
  asignacionPorPapeleta: Map<string, AsignacionPapeleta>
  hermanoDe: (id: string) => Hermano | undefined
}) {
  const [imprimirOpen, setImprimirOpen] = useState(false)
  const [imprimirEstados, setImprimirEstados] = useState<Record<string, boolean>>({ Asignada: true, Pagada: true, Entregada: true })
  const [listaImpresion, setListaImpresion] = useState<ItemImpresion[] | null>(null)

  // ---- Impresión masiva: un único PDF con una papeleta por página ----
  const contadorImpresion = useMemo(() => {
    const c: Record<string, number> = { Asignada: 0, Pagada: 0, Entregada: 0 }
    papeletasActivas.forEach((p) => {
      if (p.estado in c) c[p.estado] += 1
    })
    return c
  }, [papeletasActivas])

  const totalAImprimir = (['Asignada', 'Pagada', 'Entregada'] as const)
    .filter((e) => imprimirEstados[e])
    .reduce((s, e) => s + (contadorImpresion[e] ?? 0), 0)


  function generarImpresion() {
    const lista: ItemImpresion[] = papeletasActivas
      .filter((p) => imprimirEstados[p.estado])
      .map((p) => {
        const asig = asignacionPorPapeleta.get(p.id)
        return {
          papeleta: p,
          hermano: hermanoDe(p.hermanoId)!,
          tramo: asig?.tramo ?? null,
          puesto: asig?.puesto ?? null,
          excedeAforo: asig?.estado === 'Excede aforo',
        }
      })
      .filter((it) => it.hermano)
      .sort((a, b) => (a.hermano.numero || Infinity) - (b.hermano.numero || Infinity))
    if (lista.length === 0) return
    setListaImpresion(lista)
    setImprimirOpen(false)
    // Espera a que se pinten las páginas antes de abrir el diálogo de impresión.
    document.body.classList.add('print-masivo')
    setTimeout(() => {
      // Y se recoge con `afterprint`, no en la línea de después de print():
      // `window.print()` no promete devolver el control cuando el papel ya ha
      // salido. En un navegador que vuelve enseguida, aquí se estaban tirando
      // las cuatrocientas papeletas MIENTRAS se imprimían. Red de seguridad a
      // los diez segundos por si `afterprint` no llega.
      let recogido = false
      const recoger = () => {
        if (recogido) return
        recogido = true
        document.body.classList.remove('print-masivo')
        setListaImpresion(null)
      }
      window.addEventListener('afterprint', recoger, { once: true })
      window.setTimeout(recoger, 10000)
      window.print()
    }, 300)
  }
  return {
    imprimirOpen, setImprimirOpen, imprimirEstados, setImprimirEstados,
    listaImpresion, contadorImpresion, totalAImprimir, generarImpresion,
  }
}
