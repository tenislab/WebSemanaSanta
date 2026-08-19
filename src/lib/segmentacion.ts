import { useEffect, useState } from 'react'
import type { Hermano } from '../data/hermanos'
import { leerPersistido } from './persistencia'
import { getCamposPropios, type CampoPropio } from './camposPropios'

/**
 * Segmentación de hermanos por criterios, para mandar comunicados solo a quien
 * toca (p. ej. «activos, mayores de edad, con cuota pendiente»). Se calcula al
 * vuelo sobre el censo; no guarda nada.
 */

export interface CriteriosSegmento {
  /**
   * `Cualquiera` no filtra nada (las bajas también entran); `Todos` es «todos
   * menos las bajas», que es lo que se quiere al mandar un comunicado. Sin esa
   * distinción, el censo sin sesgar decía «todos menos bajas» y a la vez las
   * enseñaba.
   */
  estado: 'Cualquiera' | 'Todos' | 'Activo' | 'Nuevo' | 'Baja'
  cuota: 'Todos' | 'AlDia' | 'Pendiente'
  /** Edad: mayores o menores de 18. */
  edad: 'Todos' | 'Mayores' | 'Menores'
  /** Etiqueta concreta, o '' para cualquiera. */
  etiqueta: string
  /** Solo quien tenga correo (para envíos por email). */
  soloConEmail: boolean
  /**
   * Condiciones sobre los campos a medida de la hermandad («talla = L»,
   * «carné de costalero = sí»). Vacío = no se mira ese campo.
   */
  campos?: CondicionCampo[]
}

/** Una condición sobre un campo propio. Solo igualdad: es lo que hace falta. */
export interface CondicionCampo {
  campoId: string
  valor: string
}

export const CRITERIOS_POR_DEFECTO: CriteriosSegmento = {
  estado: 'Activo',
  cuota: 'Todos',
  edad: 'Todos',
  etiqueta: '',
  soloConEmail: true,
  campos: [],
}

/** Edad a día de hoy a partir de la fecha de nacimiento (o null si no hay). */
export function edadDe(fechaNacimiento: string | undefined, hoy = new Date()): number | null {
  if (!fechaNacimiento) return null
  const n = new Date(`${fechaNacimiento}T00:00:00`)
  if (Number.isNaN(n.getTime())) return null
  let e = hoy.getFullYear() - n.getFullYear()
  const m = hoy.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e -= 1
  return e
}

/**
 * Hermanos que cumplen los criterios.
 *
 * `roles` son las etiquetas que salen solas de la papeleta de cada uno (ver
 * `rolesPapeleta.ts`). Se pasan de fuera para que esta función siga siendo
 * pura, pero **hay que pasarlas**: sin ellas, sesgar por «Costalero» no
 * encuentra a los costaleros de este año, que es justo el caso para el que se
 * inventaron los roles automáticos.
 */
export function filtrarSegmento(
  hermanos: Hermano[],
  c: CriteriosSegmento,
  roles: Map<string, string[]> = new Map(),
): Hermano[] {
  return hermanos.filter((h) => {
    // Las bajas nunca reciben salvo que se pidan explícitamente.
    if (c.estado !== 'Cualquiera' && (c.estado === 'Todos' ? h.estado === 'Baja' : h.estado !== c.estado)) return false
    if (c.cuota === 'AlDia' && !h.cuotaAlDia) return false
    if (c.cuota === 'Pendiente' && h.cuotaAlDia) return false
    if (c.edad !== 'Todos') {
      const e = edadDe(h.fechaNacimiento)
      if (e == null) return false
      if (c.edad === 'Mayores' && e < 18) return false
      if (c.edad === 'Menores' && e >= 18) return false
    }
    if (c.etiqueta) {
      const suyas = h.etiquetas ?? []
      const automaticas = roles.get(h.id) ?? []
      if (!suyas.includes(c.etiqueta) && !automaticas.includes(c.etiqueta)) return false
    }
    for (const cond of c.campos ?? []) {
      if (!cond.valor) continue
      if ((h.campos?.[cond.campoId] ?? '') !== cond.valor) return false
    }
    if (c.soloConEmail && !(h.email && h.email.includes('@'))) return false
    return true
  })
}

/** Etiqueta legible del segmento, para mostrarla como destinatario del comunicado. */
export function etiquetaSegmento(c: CriteriosSegmento, campos: CampoPropio[] = []): string {
  const partes: string[] = [
    c.estado === 'Cualquiera' ? 'Todo el censo'
      : c.estado === 'Todos' ? 'Hermanos'
        : c.estado === 'Activo' ? 'Activos'
          : c.estado === 'Nuevo' ? 'Nuevos' : 'Bajas',
  ]
  if (c.edad === 'Mayores') partes.push('mayores de edad')
  if (c.edad === 'Menores') partes.push('menores de edad')
  if (c.cuota === 'AlDia') partes.push('al día de cuota')
  if (c.cuota === 'Pendiente') partes.push('con cuota pendiente')
  if (c.etiqueta) partes.push(`etiqueta «${c.etiqueta}»`)
  for (const cond of c.campos ?? []) {
    if (!cond.valor) continue
    const campo = campos.find((x) => x.id === cond.campoId)
    if (campo) partes.push(`${campo.nombre.toLowerCase()}: ${cond.valor === 'si' ? 'sí' : cond.valor}`)
  }
  return partes.join(' · ')
}

/* ------------------------------ Sesgos guardados ------------------------------ */

/**
 * Un sesgo guardado: los criterios de siempre, con nombre. Secretaría repite
 * las mismas búsquedas cada año («costaleros al día de cuota», «nazarenos
 * menores de edad») y volvía a montarlas a mano cada vez.
 */
export interface SesgoGuardado {
  id: string
  nombre: string
  criterios: CriteriosSegmento
}

export const CLAVE_SESGOS = 'cabildo-sesgos'

export function getSesgos(): SesgoGuardado[] {
  return leerPersistido<SesgoGuardado[]>(CLAVE_SESGOS, [])
}

export function saveSesgos(sesgos: SesgoGuardado[]) {
  localStorage.setItem(CLAVE_SESGOS, JSON.stringify(sesgos))
}

/** Hook con los sesgos guardados y un setter que persiste. */
export function useSesgos(): [SesgoGuardado[], (siguiente: SesgoGuardado[]) => void] {
  const [sesgos, setSesgosState] = useState<SesgoGuardado[]>(() => getSesgos())

  useEffect(() => {
    function sincronizar() {
      setSesgosState(getSesgos())
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  function setSesgos(siguiente: SesgoGuardado[]) {
    setSesgosState(siguiente)
    saveSesgos(siguiente)
  }

  return [sesgos, setSesgos]
}

/** ¿Son los mismos criterios? Sirve para marcar el sesgo activo en la lista. */
export function mismosCriterios(a: CriteriosSegmento, b: CriteriosSegmento): boolean {
  const norm = (c: CriteriosSegmento) => JSON.stringify({
    ...c,
    campos: (c.campos ?? []).filter((x) => x.valor).sort((x, y) => x.campoId.localeCompare(y.campoId)),
  })
  return norm(a) === norm(b)
}

/**
 * Los campos propios que ya no existen se ignoran al aplicar un sesgo viejo:
 * si no, un sesgo guardado hace un año podría no devolver a nadie sin decir
 * por qué.
 */
export function limpiarCriterios(c: CriteriosSegmento): CriteriosSegmento {
  const vigentes = new Set(getCamposPropios().map((x) => x.id))
  return { ...c, campos: (c.campos ?? []).filter((x) => vigentes.has(x.campoId)) }
}
