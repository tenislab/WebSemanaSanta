/**
 * LOS COMUNICADOS PROGRAMADOS QUE YA TOCABAN, Y LAS REGLAS QUE SE DISPARAN.
 *
 * Todo lo que ocurre SOLO al abrir Comunicados. Doscientas líneas que no las
 * llama ningún botón, así que al leer la pantalla estorbaban justo donde peor
 * viene: entre los cálculos del segmento y el formulario.
 *
 * Se lleva el candado, los tres intentos, la personalización, el freno de las
 * marcas mal escritas y el apunte del avance cada veinticinco. Nada de eso
 * cambia de sitio; lo que cambia es que ahora se lee de una vez.
 */
/*
 * ==========================================================================
 * LOS PROGRAMADOS QUE YA TOCABAN, AL ABRIR ESTA PANTALLA
 * ==========================================================================
 *
 * Antes «Programado» no significaba nada: se guardaba la fecha y no lo
 * mandaba nadie, nunca.
 *
 * SE HACE AQUÍ Y NO AL ENTRAR EN EL PANEL, y no es pereza: para saber A QUIÉN
 * va un comunicado hace falta el censo entero con sus cuotas resueltas, sus
 * cargos y sus etiquetas — que es justo lo que está cargado en ESTA pantalla
 * y en ninguna otra. Cargarlo en el arranque de la aplicación sería traerse
 * cinco tablas en Tesorería, en el Inventario y en la Web pública, que es lo
 * contrario de lo que se está haciendo para que esto aguante al crecer.
 *
 * Para que alguien entre, el numerito del menú se enciende cuando hay uno
 * vencido (`avisos_que_esperan()` en la base).
 *
 * SE ESPERA A TENER EL CENSO. Con `hermanos` todavía vacío, el segmento se
 * resolvería a cero personas y el comunicado se cerraría como «enviado a 0».
 * Eso es peor que no mandarlo: se pierde y ya no se vuelve a intentar.
 */
import { useEffect, useRef, useState } from 'react'
import type { Comunicado } from '../../../data/comunicados'
import type { Hermano } from '../../../data/hermanos'
import type { TareaRed } from '../../../lib/tareasRedes'
import {
  mandarLosProgramados, reclamarDeLaBase, cerrarEnLaBase, soltarEnLaBase,
  apuntarAvanceEnLaBase, type ComunicadoReclamado,
} from '../../../lib/envioProgramado'
import {
  dispararReglasDeHoy, reclamarReglaDeLaBase, devolverReglaEnLaBase,
} from '../../../lib/reglasAutomaticas'
import { tareasDeUnEncargo } from '../../../lib/tareasRedes'
import { tareaRedToRow } from '../../../lib/db/tareasRedes'
import { comunicadoToRow } from '../../../lib/db/comunicados'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import { agregarAvisoAVarios, getPreferenciasAvisos, quiereAviso } from '../../../lib/avisosHermano'
import { correoDisponible, enviarCorreo, enviarCorreoUnoAUno, getAjustesCorreo } from '../../../lib/correo'
import { cuerpoCorreo } from '../../../lib/avisosCorreo'
import { llevaMarcas, personalizar, sePuedePersonalizar } from '../../../lib/personalizar'
import { getHermandadSettings } from '../../../lib/hermandadSettings'
import { nuevoId } from '../../../lib/supabaseSync'
import { hoyIso } from '../../../lib/hoy'
import type { Alcance } from './alcance'

/**
 * Devuelve lo que hay que decir en pantalla cuando algo ha salido solo —o
 * `null` mientras no haya nada que decir— y el botón para quitarlo. Un envío
 * que ocurre en silencio es indistinguible de uno que no ha ocurrido, y por
 * eso el aviso se pinta; el «Entendido» es de quien lo lee, no de aquí.
 */
export function useLosProgramadosQueYaTocaban({
  hermanos, comunicados, setComunicados, setTareasRedes, resolverDestinatario, cuantosSon,
}: {
  hermanos: Hermano[]
  comunicados: Comunicado[]
  setComunicados: React.Dispatch<React.SetStateAction<Comunicado[]>>
  setTareasRedes: React.Dispatch<React.SetStateAction<TareaRed[]>>
  resolverDestinatario: (c: Pick<Comunicado, 'destinatarios' | 'criterios'>) => Alcance
  cuantosSon: (a: Alcance) => number
}): [string | null, (v: string | null) => void] {
  const [programadosSalidos, setProgramadosSalidos] = useState<string | null>(null)
  const yaLoIntente = useRef(false)
  useEffect(() => {
    if (yaLoIntente.current) return
    if (hermanos.length === 0) return          // todavía no ha llegado el censo
    yaLoIntente.current = true
    /*
     * PRIMERO LAS REGLAS, LUEGO EL ENVÍO. El orden no es casual: una regla
     * crea un comunicado programado PARA HOY, así que si se dispara después de
     * enviar, la felicitación de hoy no sale hasta que alguien vuelva a abrir
     * esta pantalla — o sea, casi siempre mañana. Y felicitar el cumpleaños al
     * día siguiente es peor que no felicitarlo.
     */
    void dispararReglasDeHoy({
      reclamar: reclamarReglaDeLaBase,
      /*
       * A CUÁNTA GENTE ALCANZA HOY. Si no es a nadie —que es lo normal casi
       * todos los días: de ochocientos hermanos, la mayoría de los días no
       * cumple ninguno— no se crea nada. Un comunicado a cero personas por día
       * llenaría la lista hasta enterrar los de verdad.
       */
      cuantos: (r) => cuantosSon(resolverDestinatario({
        destinatarios: r.destinatarios,
        criterios: r.criterios,
      })),
      crear: async (r) => {
        const hoy = hoyIso()
        const nuevo: Comunicado = {
          id: nuevoId(),
          numero: Math.max(0, ...comunicados.map((c) => c.numero)) + 1,
          titulo: r.asunto,
          cuerpo: r.cuerpo,
          canal: 'Email',
          redes: null,
          destinatarios: r.destinatarios,
          criterios: r.criterios,
          /*
           * PROGRAMADO PARA HOY, no «Enviado». Así entra por el camino de
           * siempre —candado, tres intentos, personalización, freno de las
           * marcas— en vez de tener el suyo propio.
           */
          estado: 'Programado',
          fechaCreacion: hoy,
          fechaProgramada: hoy,
          fechaEnvio: null,
          autor: r.nombre,
          alcance: null,
        }
        /*
         * SE ESCRIBE EN LA BASE **ESPERANDO**, y no con `setComunicados`.
         *
         * ============================================================
         * ESTE ERA UN FALLO MUDO, Y DE LOS PEORES
         * ============================================================
         *
         * `setComunicados` lanza la escritura y sigue: no la espera y no dice
         * si ha fallado. Y peor: `useSupabaseTable` SE SALTA la escritura
         * entera mientras su tabla no haya terminado de cargar
         * (`cargado.current`). Este efecto espera al censo, que es OTRO hook
         * con su propia carga, así que la carrera es real.
         *
         * Lo que pasaba entonces: la regla se marcaba como disparada —eso sí
         * llega a la base—, el comunicado se quedaba solo en la memoria de esa
         * pestaña, y la felicitación se perdía sin que nadie llegara a saberlo.
         * Y la regla no vuelve a tocar hasta mañana.
         *
         * Escribiendo aquí directamente, un fallo LANZA, `dispararReglasDeHoy`
         * devuelve la regla, y mañana se vuelve a intentar. Que es lo que tiene
         * que pasar.
         */
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.from('comunicados').insert(comunicadoToRow(nuevo))
          if (error) throw new Error(error.message)
        }
        // Y ya en la pantalla, para que se vea sin recargar.
        setComunicados((prev) => [nuevo, ...prev])
      },
      /*
       * Y EL ENCARGO DE REDES, si la regla lo lleva.
       *
       * Queda SIN REPARTIR: la regla no sabe a quién le toca, y adivinarlo
       * sería peor. Aparece en «Encargos de redes» de esta misma pantalla,
       * que es donde lo mira quien las lleva, y desde ahí se reparte —igual
       * que un encargo escrito a mano.
       *
       * Lo que se publica es `textoRedes`, NO el cuerpo del correo: ese va
       * personalizado («Hola Manuel») y un post lo lee cualquiera.
       */
      encargar: async (r) => {
        const nuevas = tareasDeUnEncargo({
          titulo: r.nombre,
          texto: r.textoRedes,
          redes: r.redes,
          notas: 'Lo ha dejado preparado la regla automática. Falta repartirlo.',
        })
        // Esperando y en la base, por lo mismo que el comunicado: `setTareasRedes`
        // no espera ni avisa si falla, y se perdería el encargo en silencio.
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.from('tareas_redes').insert(nuevas.map(tareaRedToRow))
          if (error) throw new Error(error.message)
        }
        setTareasRedes((prev) => [...prev, ...nuevas])
      },
      devolver: devolverReglaEnLaBase,
    }).then(() => mandarLosProgramados({
      reclamar: reclamarDeLaBase,
      destinatarios: async (c: ComunicadoReclamado) => {
        /*
         * Se resuelve con los criterios GUARDADOS del comunicado, que es lo
         * único que sabe a quién iba. La fila que devuelve la base no los trae
         * —vienen en `jsonb` y no hacen falta para el candado— así que se busca
         * el comunicado ya cargado en esta pantalla, que es el mismo.
         */
        const guardado = comunicados.find((x) => x.id === c.id)
        const alcance = resolverDestinatario({
          destinatarios: c.destinatarios,
          criterios: guardado?.criterios ?? null,
        })
        if (!alcance.reconocido) throw new Error('No se sabe a quién iba dirigido.')
        // Al buzón del área SIEMPRE, igual que en el envío a mano.
        agregarAvisoAVarios(alcance.hermanos.map((h) => h.id), c.cuerpo, 'comunicado', c.titulo)
        const ajustes = getAjustesCorreo()
        if (!correoDisponible(ajustes) || !ajustes.avisaDe.comunicados) return []
        return [
          ...alcance.hermanos
            .filter((h) => quiereAviso(getPreferenciasAvisos(h.id), 'comunicado'))
            .map((h) => ({ email: h.email, nombre: h.nombre, numero: h.numero })),
          ...alcance.soloCorreo.map((p) => ({ email: p.email, nombre: p.nombre, numero: null })),
        ].filter((d) => d.email && d.email.includes('@'))
      },
      enviar: async (c, gente) => {
        const ctx = {
          hermandad: getHermandadSettings().nombreLegal,
          ejercicio: new Date().getFullYear(),
        }
        /*
         * El mismo freno que en el envío a mano: un comunicado guardado antes
         * de que existieran las marcas puede llevar `{nombe}` dentro. Aquí no
         * hay nadie mirando la pantalla, así que con más razón.
         */
        const revision = sePuedePersonalizar(`${c.titulo}\n${c.cuerpo}`)
        if (!revision.puede) return { enviados: 0, error: revision.motivo }
        if (llevaMarcas(c.cuerpo) || llevaMarcas(c.titulo)) {
          const mensajes = gente.map((d) => {
            const asunto = personalizar(c.titulo, d, ctx)
            const cuerpo = personalizar(c.cuerpo, d, ctx)
            const { texto, html } = cuerpoCorreo(asunto, cuerpo.split('\n\n'))
            return { para: d.email, asunto, texto, html }
          })
          /*
           * SE VA APUNTANDO POR DÓNDE VA, cada veinticinco.
           *
           * Si se cierra la pestaña a mitad de ochocientos, el candado caduca a
           * la media hora y otro navegador lo coge — y sin esto empezaría por el
           * primero: trescientas personas con la convocatoria repetida.
           *
           * Cada veinticinco y no cada uno porque ochocientas escrituras a la
           * base para acompañar a ochocientos correos duplican el trabajo sin
           * ganar nada: perder veinticinco por redondeo es mandar veinticinco
           * repetidos en un caso raro, no dejar a nadie sin el suyo.
           */
          const u = await enviarCorreoUnoAUno(mensajes, (hechos) => {
            if (hechos % 25 === 0) void apuntarAvanceEnLaBase(c.id, c.yaEnviados + hechos)
          })
          return { enviados: u.enviados, error: u.error }
        }
        const { texto, html } = cuerpoCorreo(c.titulo, c.cuerpo.split('\n\n'))
        const r = await enviarCorreo({ para: gente.map((d) => d.email), asunto: c.titulo, texto, html })
        return { enviados: r.ok ? (r.enviados ?? gente.length) : 0, error: r.error }
      },
      cerrar: cerrarEnLaBase,
      soltar: soltarEnLaBase,
    }).then((r) => {
      if (r.mandados === 0 && r.fallidos.length === 0) return
      /*
       * Y SE DICE. Un envío que ocurre solo y en silencio es indistinguible de
       * uno que no ha ocurrido: la hermandad no sabría nunca si su comunicado
       * salió, ni cuándo, ni a cuántos.
       */
      setProgramadosSalidos(
        r.fallidos.length > 0
          ? `No se ha podido mandar «${r.fallidos[0].titulo}»: ${r.fallidos[0].motivo}`
          : `Se ${r.mandados === 1 ? 'ha mandado el comunicado programado' : `han mandado ${r.mandados} comunicados programados`}`
            + ` que ya tocaba${r.mandados === 1 ? '' : 'n'}, a ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}.`,
      )
    }))
    // Solo al llegar el censo, una vez. `yaLoIntente` lo garantiza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hermanos.length])

  return [programadosSalidos, setProgramadosSalidos]
}
