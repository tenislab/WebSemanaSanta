import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'

/**
 * Suscripción de la hermandad a la app. Sin suscripción activa, el panel queda
 * bloqueado (ver AppShell). Ahora hay varios «packs»: cada uno da acceso a un
 * conjunto de capacidades (gestión interna, web pública, extras premium). El
 * cobro real (Stripe) se conectará más adelante; por ahora «Suscribirse»
 * activa la cuenta sin cobrar, para poder probar el flujo.
 *
 * Precios PROVISIONALES (inventados) hasta cerrar la tarifa definitiva.
 */

/** Capacidades que puede desbloquear un pack. */
export type Capacidad = 'gestion' | 'web' | 'premium'

export type PackId = 'gestion' | 'web' | 'completo' | 'todo'
export type Periodo = 'mensual' | 'anual'

export interface Pack {
  id: PackId
  nombre: string
  resumen: string
  /** Precio en euros (número, sin símbolo) para poder formatear según el periodo. */
  precioMensual: number
  precioAnual: number
  capacidades: Capacidad[]
  incluye: string[]
  destacado?: boolean
}

export const PACKS: Pack[] = [
  {
    id: 'gestion',
    nombre: 'Gestión',
    resumen: 'Solo el panel de gestión de la hermandad.',
    precioMensual: 15,
    precioAnual: 150,
    capacidades: ['gestion'],
    incluye: [
      'Censo de hermanos y etiquetas',
      'Cuotas, recibos y remesas',
      'Papeletas de sitio y cortejo',
      'Tesorería e inventario',
    ],
  },
  {
    id: 'web',
    nombre: 'Web',
    resumen: 'Solo la web pública de la hermandad.',
    precioMensual: 9,
    precioAnual: 90,
    capacidades: ['web'],
    incluye: [
      'Web pública propia (secciones, cultos, actualidad)',
      'Boletines y páginas informativas',
      'Enlace público para compartir',
      'Formulario de contacto',
    ],
  },
  {
    id: 'completo',
    nombre: 'Web + Gestión',
    resumen: 'El panel de gestión y la web pública, juntos.',
    precioMensual: 20,
    precioAnual: 200,
    capacidades: ['gestion', 'web'],
    incluye: [
      'Todo lo de Gestión',
      'Todo lo de Web',
      'Los datos de la gestión alimentan la web',
      'Portal del hermano incluido',
    ],
    destacado: true,
  },
  {
    id: 'todo',
    nombre: 'Todo',
    resumen: 'Todo incluido, con los extras premium.',
    precioMensual: 29,
    precioAnual: 290,
    capacidades: ['gestion', 'web', 'premium'],
    incluye: [
      'Todo lo de Web + Gestión',
      'Dominio personalizado propio',
      'Comunicados multicanal (email, SMS, WhatsApp)',
      'Informes avanzados y soporte prioritario',
    ],
  },
]

export function packDe(id: PackId | null): Pack | null {
  return id ? PACKS.find((p) => p.id === id) ?? null : null
}

export function precioPack(pack: Pack, periodo: Periodo): string {
  return periodo === 'anual' ? `${pack.precioAnual} €` : `${pack.precioMensual} €`
}

export function etiquetaPeriodo(periodo: Periodo): string {
  return periodo === 'anual' ? '/año' : '/mes'
}

export interface Suscripcion {
  activa: boolean
  pack: PackId | null
  periodo: Periodo | null
  desde: string | null
}

export const CLAVE_SUSCRIPCION = 'cabildo-suscripcion'

export const SUSCRIPCION_INICIAL: Suscripcion = { activa: false, pack: null, periodo: null, desde: null }

/**
 * Lee la suscripción, migrando el formato antiguo (que guardaba `plan`:
 * 'mensual' | 'anual' sin packs) al nuevo: una suscripción antigua activa pasa
 * a considerarse el pack «Todo», para no dejar a nadie fuera tras el cambio.
 */
export function getSuscripcion(): Suscripcion {
  const raw = leerPersistido<Record<string, unknown>>(CLAVE_SUSCRIPCION, SUSCRIPCION_INICIAL as unknown as Record<string, unknown>)
  const activa = Boolean(raw.activa)
  if (!activa) return SUSCRIPCION_INICIAL
  // Formato nuevo
  if (raw.pack && PACKS.some((p) => p.id === raw.pack)) {
    return {
      activa: true,
      pack: raw.pack as PackId,
      periodo: (raw.periodo as Periodo) ?? 'mensual',
      desde: (raw.desde as string) ?? null,
    }
  }
  // Formato antiguo ({ activa, plan: 'mensual'|'anual' }) → pack «Todo»
  if (raw.plan === 'anual' || raw.plan === 'mensual') {
    return { activa: true, pack: 'todo', periodo: raw.plan, desde: (raw.desde as string) ?? null }
  }
  // Suscripción con un pack que no reconocemos: se trata como NO activa. Antes
  // se concedía «Todo» (todas las capacidades) ante cualquier dato inesperado.
  return SUSCRIPCION_INICIAL
}

export function saveSuscripcion(s: Suscripcion) {
  localStorage.setItem(CLAVE_SUSCRIPCION, JSON.stringify(s))
}

/** Capacidades activas de una suscripción (vacío si no está activa). */
export function capacidadesDe(s: Suscripcion): Capacidad[] {
  if (!s.activa) return []
  return packDe(s.pack)?.capacidades ?? []
}

export function tieneCapacidad(s: Suscripcion, cap: Capacidad): boolean {
  return capacidadesDe(s).includes(cap)
}

/**
 * Capacidad que exige cada módulo del panel. Los módulos no listados (inicio,
 * personal, configuración, seguridad) no exigen ninguna: son de la propia
 * cuenta, y hacen falta con cualquier pack (p. ej. para dar acceso a quien
 * edita la web).
 */
export const CAPACIDAD_DE_MODULO: Record<string, Capacidad> = {
  hermanos: 'gestion',
  cortejo: 'gestion',
  cuotas: 'gestion',
  papeletas: 'gestion',
  tesoreria: 'gestion',
  inventario: 'gestion',
  archivo: 'gestion',
  eventos: 'gestion',
  comunicados: 'gestion',
  informes: 'gestion',
  web: 'web',
}

/** ¿La suscripción da acceso a este módulo? (los no restringidos, siempre.) */
export function moduloPermitidoPorPack(s: Suscripcion, modulo: string | undefined | null): boolean {
  if (!modulo) return true
  const cap = CAPACIDAD_DE_MODULO[modulo]
  if (!cap) return true
  return tieneCapacidad(s, cap)
}

/** Hook con la suscripción y acciones para activarla o cancelarla. */
export function useSuscripcion() {
  const [suscripcion, setSuscripcion] = useState<Suscripcion>(() => getSuscripcion())

  useEffect(() => {
    function sincronizar() {
      setSuscripcion(getSuscripcion())
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  function activar(pack: PackId, periodo: Periodo, fechaISO: string) {
    const s: Suscripcion = { activa: true, pack, periodo, desde: fechaISO }
    setSuscripcion(s)
    saveSuscripcion(s)
  }

  function cancelar() {
    setSuscripcion(SUSCRIPCION_INICIAL)
    saveSuscripcion(SUSCRIPCION_INICIAL)
  }

  return { suscripcion, activar, cancelar }
}
