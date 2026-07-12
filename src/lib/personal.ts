import { leerPersistido } from './persistencia'
import type { Cargo } from '../data/documentos'

/**
 * Personal con acceso al panel además del titular de la hermandad: cada
 * uno entra con su propio correo y contraseña, y solo ve los módulos que
 * su cargo tiene permitidos (ver lib/permisos.ts). El titular siempre
 * tiene acceso completo y no aparece en esta lista.
 */
export interface MiembroPersonal {
  id: string
  nombre: string
  email: string
  clave: string
  cargo: Cargo
  activo: boolean
  fechaAlta: string
}

export const CLAVE_PERSONAL = 'cabildo-personal'

const PERSONAL_DE_EJEMPLO: MiembroPersonal[] = [
  {
    id: 'personal-demo-secretario',
    nombre: 'Carmen Ruiz Delgado',
    email: 'secretaria@tuhermandad.org',
    clave: 'secre123',
    cargo: 'Secretario/a',
    activo: true,
    fechaAlta: '2026-01-01',
  },
  {
    id: 'personal-demo-tesorero',
    nombre: 'Manuel Ortega Vidal',
    email: 'tesorero@tuhermandad.org',
    clave: 'tesoro123',
    cargo: 'Tesorero/a',
    activo: true,
    fechaAlta: '2026-01-01',
  },
  {
    id: 'personal-demo-fiscal',
    nombre: 'Isabel Moya Cantero',
    email: 'fiscal@tuhermandad.org',
    clave: 'fiscal123',
    cargo: 'Fiscal',
    activo: true,
    fechaAlta: '2026-01-01',
  },
  {
    id: 'personal-demo-mayordomo',
    nombre: 'Rafael Cordero Nieto',
    email: 'mayordomo@tuhermandad.org',
    clave: 'mayordo123',
    cargo: 'Mayordomo/Prioste',
    activo: true,
    fechaAlta: '2026-01-01',
  },
]

export function getPersonal(): MiembroPersonal[] {
  return leerPersistido<MiembroPersonal[]>(CLAVE_PERSONAL, PERSONAL_DE_EJEMPLO)
}

export function savePersonal(personal: MiembroPersonal[]) {
  localStorage.setItem(CLAVE_PERSONAL, JSON.stringify(personal))
}
