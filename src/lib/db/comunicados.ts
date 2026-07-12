import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'
import { CLAVES_DATOS, leerPersistido } from '../persistencia'
import { CUENTAS_SOCIALES_INICIALES, type Comunicado, type CuentaSocial } from '../../data/comunicados'

export function comunicadoToRow(c: Comunicado): Record<string, unknown> {
  return {
    id: c.id,
    numero: c.numero,
    titulo: c.titulo,
    cuerpo: c.cuerpo,
    canal: c.canal,
    destinatarios: c.destinatarios,
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
    estado: r.estado as Comunicado['estado'],
    fechaCreacion: r.fecha_creacion as string,
    fechaProgramada: (r.fecha_programada as string | null) ?? null,
    fechaEnvio: (r.fecha_envio as string | null) ?? null,
    autor: r.autor as string,
    alcance: (r.alcance as number | null) ?? null,
  }
}

function cuentaToRow(c: Partial<CuentaSocial>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (c.conectada !== undefined) row.conectada = c.conectada
  if (c.usuario !== undefined) row.usuario = c.usuario
  return row
}

function rowToCuenta(r: Record<string, unknown>): CuentaSocial {
  return {
    red: r.red as CuentaSocial['red'],
    conectada: r.conectada as boolean,
    usuario: (r.usuario as string | null) ?? null,
  }
}

/**
 * Cuentas sociales conectadas: solo 5 filas fijas (una por red), así que en
 * vez del hook genérico por `id` se sincroniza cada fila por su `red`
 * cuando cambia. Misma firma `[cuentas, setCuentas]` de siempre.
 */
export function useCuentasSociales() {
  const [cuentas, setCuentasState] = useState<CuentaSocial[]>(() =>
    leerPersistido(CLAVES_DATOS.cuentasSociales, CUENTAS_SOCIALES_INICIALES),
  )

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let cancelado = false
    supabase
      .from('cuentas_sociales')
      .select('*')
      .then(({ data, error }) => {
        if (cancelado || error || !data || data.length === 0) return
        const traidas = data.map(rowToCuenta)
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
        next.forEach((c, i) => {
          const anterior = prev[i]
          if (anterior && anterior.red === c.red && (anterior.conectada !== c.conectada || anterior.usuario !== c.usuario)) {
            supabase!
              .from('cuentas_sociales')
              .update(cuentaToRow(c))
              .eq('red', c.red)
              .then(({ error }) => {
                if (error) console.error('No se pudo actualizar la cuenta social:', error.message)
              })
          }
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
