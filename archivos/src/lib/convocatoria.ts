import { useEffect, useState } from 'react'
import { CLAVES_DATOS, leerPersistido } from './persistencia'
import { COMUNICADOS_INICIALES, type Comunicado } from '../data/comunicados'
import type { Hermano } from '../data/hermanos'
import { nuevoId } from './supabaseSync'

/**
 * Convocatoria de papeletas: cuando la secretaría abre el plazo, avisa a TODOS
 * los hermanos que pueden sacar papeleta (los activos con correo). El aviso se
 * registra como un comunicado por email (envío simulado hasta conectar el
 * proveedor) y se guarda que ya se convocó ese año.
 */

export interface Convocatoria {
  anio: number
  fecha: string
  total: number
}

const CLAVE = 'cabildo-convocatoria'

export function getConvocatoria(): Convocatoria | null {
  return leerPersistido<Convocatoria | null>(CLAVE, null)
}

export function useConvocatoria(): [Convocatoria | null, () => void] {
  const [conv, setConv] = useState<Convocatoria | null>(() => getConvocatoria())
  useEffect(() => {
    const sync = () => setConv(getConvocatoria())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const refrescar = () => setConv(getConvocatoria())
  return [conv, refrescar]
}

/** Hermanos que pueden sacar papeleta y a los que llegaría el aviso (activos con correo). */
export function destinatariosConvocatoria(hermanos: Hermano[]): Hermano[] {
  return hermanos.filter((h) => h.estado !== 'Baja' && h.email && h.email.includes('@'))
}

/**
 * Registra la convocatoria del año: crea el comunicado por email a todos los
 * hermanos y guarda la marca de «convocado». Devuelve a cuántos se avisó.
 */
export function enviarConvocatoria(anio: number, hermanos: Hermano[], fechaLimite: string): number {
  const destinatarios = destinatariosConvocatoria(hermanos)
  const hoyIso = new Date().toISOString().slice(0, 10)

  // Comunicado por email (aparece en el módulo Comunicados; envío simulado).
  const comunicados = leerPersistido<Comunicado[]>(CLAVES_DATOS.comunicados, COMUNICADOS_INICIALES)
  const nuevo: Comunicado = {
    id: nuevoId(),
    numero: Math.max(0, ...comunicados.map((c) => c.numero)) + 1,
    titulo: `Apertura del plazo de papeletas de sitio ${anio}`,
    cuerpo: `Se ha abierto el plazo para solicitar la papeleta de sitio de la Estación de Penitencia ${anio}. Puedes solicitarla desde tu área del hermano hasta el ${fechaLimite}.`,
    canal: 'Email',
    redes: null,
    destinatarios: 'Todos los hermanos',
    estado: 'Enviado',
    fechaCreacion: hoyIso,
    fechaProgramada: null,
    fechaEnvio: hoyIso,
    autor: 'Secretaría',
    alcance: destinatarios.length,
  }
  localStorage.setItem(CLAVES_DATOS.comunicados, JSON.stringify([nuevo, ...comunicados]))

  const conv: Convocatoria = { anio, fecha: hoyIso, total: destinatarios.length }
  localStorage.setItem(CLAVE, JSON.stringify(conv))
  return destinatarios.length
}
