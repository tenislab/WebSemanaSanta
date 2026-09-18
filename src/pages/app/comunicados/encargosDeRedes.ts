/**
 * ENCARGAR UN POST Y QUE SE REPARTA SOLO.
 *
 * Se escribe una vez —de qué es, el texto, en qué redes, a quién le toca— y de
 * ahí salen las tareas: una de escribirlo y una de subirlo por cada red. Y lo
 * importante, que es la mitad que se olvida siempre: SE AVISA AL RESPONSABLE.
 * Una tarea que solo aparece cuando al responsable se le ocurre entrar en su
 * área no se ha repartido; se ha dejado escrita en un sitio donde nadie mira.
 *
 * Toma dos cosas de la pantalla —el censo y el cargo efectivo de cada uno— y
 * devuelve todo lo demás. `setTareasRedes` sale también porque lo necesita el
 * efecto de las reglas automáticas: una regla puede dejar su encargo preparado.
 */
import { useMemo, useState, type FormEvent } from 'react'
import type { RedSocial } from '../../../data/comunicados'
import type { Hermano } from '../../../data/hermanos'
import { useTareasRedes, tareasDeUnEncargo, porEncargo, loQueHayQueHacer, type TareaRed } from '../../../lib/tareasRedes'
import { agregarAvisoHermano } from '../../../lib/avisosHermano'
import { avisarPorCorreo } from '../../../lib/avisosCorreo'

export interface LosEncargos {
  tareasRedes: TareaRed[]
  setTareasRedes: React.Dispatch<React.SetStateAction<TareaRed[]>>
  /** A quién se le puede encargar: la junta primero, agrupada. */
  laJunta: Hermano[]
  /** Y el resto de hermanos activos, que también pueden llevar las redes. */
  otrosHermanos: Hermano[]
  hayAQuienEncargar: boolean
  /** Los encargos con algo pendiente. Los terminados no estorban la pantalla. */
  encargosAbiertos: { encargoId: string; titulo: string; tareas: TareaRed[] }[]
  crearEncargo: (e: FormEvent<HTMLFormElement>) => void
  encargoHecho: string
  encargoError: string
}

export function useEncargosDeRedes({ hermanos, cargosPorHermano }: {
  hermanos: Hermano[]
  cargosPorHermano: Map<string, string>
}): LosEncargos {
  const [tareasRedes, setTareasRedes] = useTareasRedes()
  const [encargoHecho, setEncargoHecho] = useState('')
  const [encargoError, setEncargoError] = useState('')
  /*
   * A QUIÉN SE LE PUEDE ENCARGAR: la junta, no el censo entero.
   *
   * Se mira el cargo EFECTIVO —el de su ficha o el de personal, que es lo que
   * ya calcula `cargosEfectivos` para todo lo demás— y no una lista aparte: si
   * fuera aparte, cambiar la junta obligaría a acordarse de cambiarla también
   * aquí, y no se acordaría nadie.
   *
   * Y se dejan fuera las bajas: encargarle un post a quien ya no está es
   * mandar trabajo a un sitio del que nadie va a contestar.
   */
  const laJunta = useMemo(
    () => hermanos
      .filter((h) => h.estado !== 'Baja' && (cargosPorHermano.get(h.id)?.length ?? 0) > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [hermanos, cargosPorHermano],
  )
  /*
   * Y EL RESTO DE HERMANOS ACTIVOS, QUE TAMBIÉN PUEDEN LLEVAR LAS REDES.
   *
   * Aquí solo se ofrecía la junta, y la razón escrita era que un hermano de a
   * pie «no podría verlo, porque quien no lleva nada no entra al panel». Eso
   * es FALSO, y es justo lo contrario de para lo que se hizo esto: la tarea le
   * sale en SU ÁREA, sin pisar el panel — es lo primero que dice
   * `lib/tareasRedes.ts`.
   *
   * Con esa restricción, una hermandad que todavía no ha repartido cargos en
   * las fichas se encontraba las dos listas VACÍAS y sin explicación. Llegó
   * reportado como «no deja asignar hermanos en tareas de redes», y desde
   * fuera no se distingue de que el desplegable esté roto.
   *
   * Quien lleva el Instagram de una hermandad es muchas veces alguien joven
   * sin cargo ninguno. Decidir si se le encarga o no es de la hermandad, no de
   * la aplicación; lo que tiene que hacer la aplicación es dejarlo elegir. La
   * junta va primero, agrupada, porque es el caso normal.
   */
  const otrosHermanos = useMemo(
    () => hermanos
      .filter((h) => h.estado !== 'Baja' && (cargosPorHermano.get(h.id)?.length ?? 0) === 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [hermanos, cargosPorHermano],
  )
  const hayAQuienEncargar = laJunta.length > 0 || otrosHermanos.length > 0
  /** Los encargos con algo pendiente. Los terminados no estorban la pantalla. */
  const encargosAbiertos = useMemo(
    () => porEncargo(tareasRedes).filter((g) => g.tareas.some((t) => t.estado === 'pendiente')),
    [tareasRedes],
  )

  function crearEncargo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const titulo = String(data.get('titulo') ?? '').trim()
    // Y se dice qué falta, en vez de no hacer nada: un botón que no responde
    // no se lee como «me falta un dato», se lee como «esto está roto».
    if (!titulo) {
      setEncargoError('Pon de qué es el post, aunque sea en tres palabras: es lo que verá quien lo tenga que hacer.')
      return
    }
    setEncargoError('')
    const redes = data.getAll('redes').map((v) => String(v)) as RedSocial[]
    const quienSube = String(data.get('quienSube') ?? '')
    const nuevas = tareasDeUnEncargo({
      titulo,
      texto: String(data.get('texto') ?? ''),
      redes,
      quienCrea: String(data.get('quienCrea') ?? ''),
      // El mismo responsable para todas las redes: es como se reparte de
      // verdad —quien lleva las redes las lleva todas— y pedir uno por red
      // haría el formulario el doble de largo para el caso raro. Se puede
      // cambiar tarea a tarea después.
      quienPublica: quienSube
        ? Object.fromEntries(redes.map((r) => [r, quienSube])) as Partial<Record<RedSocial, string>>
        : undefined,
    })
    setTareasRedes((prev) => [...prev, ...nuevas])

    /*
     * Y SE LE AVISA. Esto es la mitad que pedía el encargo: si la tarea solo
     * aparece cuando al responsable se le ocurre entrar en su área, no se ha
     * repartido nada — se ha dejado escrito en un sitio donde nadie mira.
     *
     * Un aviso POR PERSONA y no por tarea: a quien le tocan las tres redes le
     * llegarían tres correos iguales seguidos, que se lee como un fallo. Se
     * agrupa lo suyo en un solo mensaje que dice qué le toca.
     *
     * Va DESPUÉS de guardar, como en Cuotas: si el correo falla, el encargo ya
     * está y lo verá igual la próxima vez que entre.
     */
    const porPersona = new Map<string, string[]>()
    for (const t of nuevas) {
      if (!t.hermanoId) continue
      const ya = porPersona.get(t.hermanoId)
      if (ya) ya.push(loQueHayQueHacer(t))
      else porPersona.set(t.hermanoId, [loQueHayQueHacer(t)])
    }
    for (const [hermanoId, quehaceres] of porPersona) {
      const texto = `Te han encargado «${titulo}»: ${quehaceres.join(' y ')}.`
      agregarAvisoHermano(hermanoId, texto, 'encargo', 'Tienes un encargo')
      const h = hermanos.find((x) => x.id === hermanoId)
      if (h) {
        void avisarPorCorreo(
          [{ id: h.id, nombre: h.nombre, email: h.email }],
          'encargo',
          'Tienes un encargo de la hermandad',
          [texto, ...(String(data.get('texto') ?? '').trim() ? [`Texto del post: ${String(data.get('texto')).trim()}`] : [])],
          'Lo tienes también en tu área de hermano, con el botón para marcarlo hecho.',
        )
      }
    }

    form.reset()
    const aCuantos = porPersona.size
    setEncargoHecho(
      `Encargado en ${nuevas.length} tarea${nuevas.length === 1 ? '' : 's'}`
      + (aCuantos > 0
        ? `, y avisad${aCuantos === 1 ? 'o' : 'os'} ${aCuantos} responsable${aCuantos === 1 ? '' : 's'}.`
        // Sin responsables no se dice «repartido»: se ha dejado preparado, y
        // hay que volver para asignarlo o no lo hará nadie.
        : '. Nadie lo tiene asignado todavía.'),
    )
    setTimeout(() => setEncargoHecho(''), 4000)
  }

  return {
    tareasRedes, setTareasRedes,
    laJunta, otrosHermanos, hayAQuienEncargar,
    encargosAbiertos, crearEncargo,
    encargoHecho, encargoError,
  }
}
