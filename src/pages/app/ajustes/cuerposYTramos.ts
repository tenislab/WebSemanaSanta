import { aforoDeCuerpo, cuerposPresentes as cuerposPresentesDe, getCuerpos, gruposAutomaticos, precioDeTramo, repartoDe, saveCuerpos, saveTramos, type Cuerpo, type Tramo } from '../../../lib/tramos'
import { nuevoId } from '../../../lib/supabaseSync'
import { ofrecerDeshacer, reinsertar } from '../../../lib/deshacer'
import { saveHermandadSettings } from '../../../lib/hermandadSettings'

/**
 * LOS CUERPOS DEL CORTEJO Y SUS TRAMOS.
 *
 * Un cuerpo es un paso con su acompañamiento —el nombre lo pone la hermandad,
 * que no hay dos que los llamen igual— y dentro de cada uno van los tramos, en
 * orden, con su aforo y su precio de papeleta.
 *
 * Lo que hay que no perder de vista al tocar esto son los frenos, que no se
 * ven y son lo único que separa un cambio de ajustes de un destrozo en el
 * cortejo del año:
 *
 *   · NO SE QUITA UN CUERPO QUE TIENE TRAMOS, y vaciarle el nombre cuenta
 *     igual que quitarlo: si no, los tramos se quedan colgando de un cuerpo
 *     que ya no existe y no salen en ninguna parte.
 *   · NO SE QUITA UN TRAMO QUE TIENE GENTE DENTRO sin avisar antes de cuánta:
 *     son papeletas ya repartidas de este año.
 *   · TIENE QUE QUEDAR AL MENOS UN CUERPO. «Único» si van sin dividir.
 *
 * TRES ENTRADAS: las papeletas del año (solo para poder avisar), el precio
 * base de la papeleta y los ajustes de la hermandad —que los guarda este mismo
 * botón—. Devuelve `tramos` porque lo necesita también la sección de
 * papeletas.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Papeleta } from '../../../data/papeletas'
import { useTramos, getTramos } from '../../../lib/tramos'
import { type HermandadSettings } from '../../../lib/hermandadSettings'
import type { CuerpoEdit } from './tipos'

export function useCuerposYTramos({ papeletasDelAnio, precioBase, settings }: {
  /** Las papeletas de la campaña activa, para avisar antes de quitar un tramo. */
  papeletasDelAnio: Papeleta[]
  precioBase: number
  /*
   * Los ajustes de la hermandad, porque el precio de la papeleta se edita en
   * ESTA tarjeta y lo guarda ESTE botón. Dejarlo colgando del botón de
   * «Identidad y datos» era pedir que se perdiera.
   */
  settings: HermandadSettings
}) {
  const tramosRemotos = useTramos()
  const [tramos, setTramos] = useState<Tramo[]>(tramosRemotos)
  const [tramosTocado, setTramosTocado] = useState(false)
  useEffect(() => {
    if (!tramosTocado) setTramos(tramosRemotos)
  }, [tramosRemotos, tramosTocado])
  const [tramosSaved, setTramosSaved] = useState(false)

  // ---- Cuerpos del cortejo (los pasos y su acompañamiento; nombres libres) ----
  const [cuerposGuardados, setCuerposGuardados] = useState<Cuerpo[]>(() => getCuerpos())
  const [cuerposEdit, setCuerposEdit] = useState<CuerpoEdit[]>(() =>
    getCuerpos().map((c) => ({ original: c, actual: c })),
  )
  const [cuerposSaved, setCuerposSaved] = useState(false)
  const [cuerposError, setCuerposError] = useState<string | null>(null)

  function updateCuerpo(index: number, actual: string) {
    setCuerposEdit((prev) => prev.map((c, i) => (i === index ? { ...c, actual } : c)))
    setCuerposSaved(false)
    setCuerposError(null)
  }

  function addCuerpo() {
    setCuerposEdit((prev) => [...prev, { original: null, actual: '' }])
    setCuerposSaved(false)
  }

  function removeCuerpo(index: number) {
    const c = cuerposEdit[index]
    // Una fila recién añadida (sin original) aún no existe: siempre se puede quitar.
    if (c.original && tramos.some((t) => t.cuerpo === c.original)) {
      setCuerposError(`No puedes quitar «${c.original}»: tiene tramos. Cambia antes esos tramos de cuerpo.`)
      return
    }
    setCuerposEdit((prev) => prev.filter((_, i) => i !== index))
    setCuerposSaved(false)
    setCuerposError(null)
  }

  async function handleSaveCuerpos() {
    // Vaciar el nombre de un cuerpo equivale a quitarlo: misma guardia que el botón de quitar.
    const vaciadoEnUso = cuerposEdit.find(
      (c) => c.original && !c.actual.trim() && tramos.some((t) => t.cuerpo === c.original),
    )
    if (vaciadoEnUso) {
      setCuerposError(
        `El cuerpo «${vaciadoEnUso.original}» tiene tramos: ponle nombre o cambia antes esos tramos de cuerpo.`,
      )
      return
    }
    const nombres = cuerposEdit.map((c) => c.actual.trim()).filter(Boolean)
    if (nombres.length === 0) {
      setCuerposError('Debe haber al menos un cuerpo (p. ej. «Único» si vais en un solo bloque).')
      return
    }
    if (new Set(nombres).size !== nombres.length) {
      setCuerposError('Hay nombres de cuerpo repetidos.')
      return
    }
    // Renombrados: los tramos que apuntaban al nombre antiguo pasan al nuevo.
    // En una sola pasada (mapa antiguo→nuevo) para que hasta un intercambio de
    // nombres entre dos cuerpos (A→B y B→A) se aplique sin corromper nada.
    const renombres = new Map<string, string>()
    cuerposEdit.forEach((c) => {
      const nuevo = c.actual.trim()
      if (c.original && nuevo && c.original !== nuevo) renombres.set(c.original, nuevo)
    })
    const renombra = (t: Tramo): Tramo => {
      const nuevo = renombres.get(t.cuerpo)
      return nuevo ? { ...t, cuerpo: nuevo } : t
    }
    // El renombrado se persiste sobre los tramos GUARDADOS (no arrastra las
    // ediciones sin guardar del editor de abajo); el editor en pantalla se
    // renombra también, pero sus demás cambios siguen pendientes de «Guardar tramos».
    if (renombres.size > 0) {
      setTramosTocado(true)
      await saveTramos(getTramos().map(renombra))
      setTramos((prev) => prev.map(renombra))
    }
    saveCuerpos(nombres)
    setCuerposGuardados(nombres)
    setCuerposEdit(nombres.map((n) => ({ original: n, actual: n })))
    setCuerposError(null)
    setCuerposSaved(true)
    setTimeout(() => setCuerposSaved(false), 3000)
  }

  const aforos = useMemo(
    () => cuerposGuardados.map((c) => ({ cuerpo: c, total: aforoDeCuerpo(c, tramos) })).filter((a) => a.total > 0),
    [tramos, cuerposGuardados],
  )

  // Un grupo «por número» (mismo cuerpo y tipo) cobra un único precio: el del
  // primer tramo del grupo. Si la hermandad pone precios distintos dentro del
  // mismo grupo, se le avisa (sin bloquear) para que no haya sorpresas.
  const gruposConPrecioMixto = useMemo(() => {
    const avisos: string[] = []
    cuerposPresentesDe(tramos).forEach((cuerpo) => {
      gruposAutomaticos(tramos.filter((t) => t.cuerpo === cuerpo)).forEach((g) => {
        const precios = new Set(g.tramos.map((t) => precioDeTramo(t, precioBase)))
        if (precios.size > 1) avisos.push(`${cuerpo} — ${g.etiqueta}`)
      })
    })
    return avisos
  }, [tramos, precioBase])

  function updateTramo<K extends keyof Tramo>(id: string, key: K, value: Tramo[K]) {
    setTramos((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: value } : t)))
    setTramosTocado(true)
    setTramosSaved(false)
  }

  function addTramo() {
    setTramos((prev) => [
      ...prev,
      {
        id: nuevoId(),
        nombre: 'Nuevo tramo',
        cuerpo: cuerposGuardados[0] ?? 'Único',
        capacidad: 20,
        tipo: '',
        reparto: 'solicitud',
        precio: null,
      },
    ])
    setTramosTocado(true)
    setTramosSaved(false)
  }

  function removeTramo(id: string) {
    const posicion = tramos.findIndex((t) => t.id === id)
    const tramo = tramos[posicion]
    /**
     * Si hay gente dentro, se pregunta. Y se dice cuánta.
     *
     * Quitar un tramo con papeletas dentro hacía desaparecer a esos hermanos
     * del cortejo sin ningún aviso: no entraban en ningún reparto, no salían
     * en «Pendientes» ni entre las anuladas, y su ficha seguía diciendo
     * «Renovada». Ocho personas con su papeleta ya cobrada, fuera de la
     * procesión, y nadie se enteraba hasta el día de la salida.
     *
     * Ahora Cortejo además las recoge y las enseña para recolocarlas, pero
     * mejor avisar antes que arreglarlo después.
     */
    const dentro = papeletasDelAnio.filter((p) => p.tramoId === id).length
    if (dentro > 0) {
      const quienes = dentro === 1 ? 'un hermano tiene' : `${dentro} hermanos tienen`
      if (!window.confirm(
        `En «${tramo?.nombre ?? 'este tramo'}» ${quienes} su papeleta de este año.\n\n` +
        'Si lo quitas, se quedan sin sitio en el cortejo y habrá que recolocarlos a mano ' +
        'desde Cortejo. ¿Continuar?',
      )) return
    }
    setTramos((prev) => prev.filter((t) => t.id !== id))
    if (tramo) {
      ofrecerDeshacer(`Tramo «${tramo.nombre}» quitado`, () => {
        setTramos((prev) => reinsertar(prev, tramo, posicion))
        setTramosTocado(true)
      })
    }
    setTramosTocado(true)
    setTramosSaved(false)
  }

  function moveTramo(id: string, dir: -1 | 1) {
    setTramos((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      const swapWith = idx + dir
      if (idx < 0 || swapWith < 0 || swapWith >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapWith]] = [next[swapWith], next[idx]]
      return next
    })
    setTramosTocado(true)
    setTramosSaved(false)
  }

  const [tramosError, setTramosError] = useState<string | null>(null)

  async function handleSaveTramos() {
    // Se guarda el reparto de forma explícita (los datos antiguos lo deducían del tipo).
    const explicitos = tramos.map((t) => ({ ...t, reparto: repartoDe(t) }))
    setTramos(explicitos)
    const r = await saveTramos(explicitos)
    // El precio se edita en ESTA tarjeta, así que lo guarda ESTE botón. Dejarlo
    // colgando del botón de «Identidad y datos» era pedir que se perdiera.
    const rAjustes = await saveHermandadSettings(settings)
    /*
     * EL VERDE SOLO SI DE VERDAD SE HA GUARDADO.
     *
     * Antes salía siempre. Y como el guardado de tramos llevaba fallando en
     * todos los casos —a la tabla le faltaba una columna—, lo que veía la
     * hermandad era el visto bueno verde de «Tramos guardados» encima de unos
     * tramos que no existían en ninguna parte. Al recargar, Cortejo decía
     * «0/0 puestos cubiertos».
     *
     * Es el mismo arreglo que ya se hizo con la tabla de permisos, y por la
     * misma razón: un visto bueno que sale pase lo que pase no informa de
     * nada, engaña.
     */
    if (!r.ok || !rAjustes.ok) {
      setTramosError(
        !r.ok
          ? `No se han podido guardar los tramos: ${r.error ?? 'la base de datos los ha rechazado.'}`
          : `Los tramos se han guardado, pero el precio no: ${rAjustes.error ?? 'la base de datos lo ha rechazado.'}`,
      )
      setTramosSaved(false)
      return
    }
    setTramosError(null)
    setTramosTocado(false)
    setTramosSaved(true)
    setTimeout(() => setTramosSaved(false), 3000)
  }

  return {
    tramos, setTramos, tramosSaved, setTramosSaved, tramosError,
    cuerposGuardados, cuerposEdit, cuerposSaved, cuerposError,
    updateCuerpo, addCuerpo, removeCuerpo, handleSaveCuerpos,
    aforos, gruposConPrecioMixto,
    updateTramo, addTramo, removeTramo, moveTramo, handleSaveTramos,
  }
}
