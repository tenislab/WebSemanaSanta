import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'
import { CLAVES_DATOS, leerDatos } from '../persistencia'
import { cuentasCompletas } from '../redesSociales'
import { CUENTAS_SOCIALES_INICIALES, type Comunicado, type CuentaSocial } from '../../data/comunicados'

export function comunicadoToRow(c: Comunicado): Record<string, unknown> {
  return {
    id: c.id,
    numero: c.numero,
    titulo: c.titulo,
    cuerpo: c.cuerpo,
    canal: c.canal,
    destinatarios: c.destinatarios,
    criterios: c.criterios ?? null,
    estado: c.estado,
    fecha_creacion: c.fechaCreacion,
    fecha_programada: c.fechaProgramada,
    fecha_envio: c.fechaEnvio,
    autor: c.autor,
    alcance: c.alcance,
    redes: c.redes,
  }
}

export function rowToComunicado(r: Record<string, unknown>): Comunicado {
  return {
    id: r.id as string,
    numero: r.numero as number,
    titulo: r.titulo as string,
    cuerpo: r.cuerpo as string,
    canal: r.canal as string,
    redes: (r.redes as Comunicado['redes']) ?? null,
    destinatarios: r.destinatarios as string,
    criterios: (r.criterios as Comunicado['criterios']) ?? null,
    estado: r.estado as Comunicado['estado'],
    fechaCreacion: r.fecha_creacion as string,
    fechaProgramada: (r.fecha_programada as string | null) ?? null,
    fechaEnvio: (r.fecha_envio as string | null) ?? null,
    autor: r.autor as string,
    alcance: (r.alcance as number | null) ?? null,
  }
}

function cuentaToRow(c: CuentaSocial): Record<string, unknown> {
  // La fila entera, no solo lo que ha cambiado: esto se guarda con `upsert`,
  // así que la primera vez es un INSERT y tiene que ir completo. `hermandad_id`
  // no se manda — lo pone la base de datos sola con su valor por defecto, que
  // es la única forma de que no se pueda escribir en la hermandad de otro.
  return {
    red: c.red,
    conectada: c.conectada,
    usuario: c.usuario,
    enlace: c.enlace ?? null,
  }
}

function rowToCuenta(r: Record<string, unknown>): CuentaSocial {
  return {
    red: r.red as CuentaSocial['red'],
    conectada: r.conectada as boolean,
    usuario: (r.usuario as string | null) ?? null,
    enlace: (r.enlace as string | null) ?? null,
  }
}

/**
 * Cuentas sociales conectadas: solo 5 filas fijas (una por red), así que en
 * vez del hook genérico por `id` se sincroniza cada fila por su `red`
 * cuando cambia. Misma firma `[cuentas, setCuentas]` de siempre.
 */
export function useCuentasSociales() {
  /*
   * SIEMPRE LAS CINCO. `cuentasCompletas` junta el catálogo de redes (que lo
   * pone el programa) con lo que haya guardado.
   *
   * Sin esto, la pantalla decía «0 de 0» y no salía ni una tarjeta: la lista
   * se sacaba de la base de datos, la base venía vacía, y una red que no
   * aparece se lee como que el módulo no funciona. Pero es que Facebook existe
   * aunque la hermandad no lo haya conectado — la tarjeta «no conectada» es
   * justamente la que hay que enseñar para poder conectarlo.
   */
  const [cuentas, setCuentasState] = useState<CuentaSocial[]>(() =>
    cuentasCompletas(leerDatos(CLAVES_DATOS.cuentasSociales, CUENTAS_SOCIALES_INICIALES)),
  )

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let cancelado = false
    supabase
      .from('cuentas_sociales')
      .select('*')
      .then(({ data, error }) => {
        if (cancelado || error || !data) return
        // Sin `data.length === 0`: que la hermandad no tenga ninguna conectada
        // es lo normal el primer día, y no es motivo para quedarse con lo que
        // hubiera en el navegador. `cuentasCompletas` rellena las que falten.
        const traidas = cuentasCompletas(data.map(rowToCuenta))
        setCuentasState(traidas)
        localStorage.setItem(CLAVES_DATOS.cuentasSociales, JSON.stringify(traidas))
      })
    return () => {
      cancelado = true
    }
  }, [])

  function setCuentas(actualizador: CuentaSocial[] | ((prev: CuentaSocial[]) => CuentaSocial[])) {
    setCuentasState((prev) => {
      const next = typeof actualizador === 'function' ? actualizador(prev) : actualizador
      if (isSupabaseConfigured && supabase) {
        /*
         * `upsert`, no `update`. Era un `update ... .eq('red', ...)` sobre una
         * fila que NO EXISTÍA: en Postgres eso no da error, actualiza cero
         * filas. Así que conectar una red decía que sí, se veía conectada, y
         * al volver a entrar estaba igual que antes. El fallo más difícil de
         * pillar de los tres, porque no dejaba ni rastro.
         *
         * El conflicto va por (hermandad_id, red), que es la clave que crea
         * `supabase/redes-sociales.sql`. Con la clave global de antes, la
         * segunda hermandad se estrellaba contra la fila de la primera.
         */
        const anteriores = new Map(prev.map((c) => [c.red, c]))
        next.forEach((c) => {
          const antes = anteriores.get(c.red)
          const cambia = !antes
            || antes.conectada !== c.conectada
            || antes.usuario !== c.usuario
            || (antes.enlace ?? null) !== (c.enlace ?? null)
          if (!cambia) return
          supabase!
            .from('cuentas_sociales')
            .upsert(cuentaToRow(c), { onConflict: 'hermandad_id,red' })
            .then(({ error }) => {
              if (error) console.error('No se pudo guardar la cuenta social:', error.message)
            })
        })
      }
      try {
        localStorage.setItem(CLAVES_DATOS.cuentasSociales, JSON.stringify(next))
      } catch {
        // sin espacio o sin localStorage: la app sigue funcionando en memoria
      }
      return next
    })
  }

  return [cuentas, setCuentas] as const
}
