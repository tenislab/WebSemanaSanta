/**
 * Directorio de hermandades registradas en Cabildo, usado por el área del
 * hermano para que cada persona identifique primero su propia hermandad y
 * después entre con su DNI y contraseña. Mientras no hay backend real, la
 * hermandad "principal" (la que gestiona quien ha iniciado sesión como
 * secretaría en /app) vive en los datos ya persistidos de la app
 * (hermandadSettings + censo de hermanos). Las demás son hermandades de
 * muestra, con su propio censo pequeño y aislado, para demostrar que cada
 * hermandad ve solo lo suyo.
 */

export interface HermanoDirectorio {
  id: string
  numero: number
  nombre: string
  dni: string
  claveAcceso: string
  email: string
  telefono: string
}

export interface HermandadDirectorio {
  id: string
  nombre: string
  ciudad: string
  color: string
  telefono: string
  email: string
}

export const ID_HERMANDAD_PRINCIPAL = 'principal'

export const HERMANDADES_MUESTRA: HermandadDirectorio[] = [
  { id: 'esperanza', nombre: 'Hermandad de Ntra. Sra. de la Esperanza', ciudad: 'Triana, Sevilla', color: '#2f7a4f', telefono: '954 11 22 33', email: 'secretaria@esperanza-triana.example' },
  { id: 'soledad', nombre: 'Hermandad de la Soledad', ciudad: 'Écija', color: '#5a4fc4', telefono: '955 44 55 66', email: 'secretaria@soledad-ecija.example' },
]

export const HERMANOS_MUESTRA: Record<string, HermanoDirectorio[]> = {
  esperanza: [
    { id: 'e1', numero: 12, nombre: 'Álvaro Núñez Prieto', dni: '66778899R', claveAcceso: 'hermano123', email: 'alvaro.nunez@example.com', telefono: '655 001 122' },
    { id: 'e2', numero: 45, nombre: 'Marta Iglesias Roldán', dni: '77889900S', claveAcceso: 'hermano123', email: 'marta.iglesias@example.com', telefono: '622 334 455' },
    { id: 'e3', numero: 88, nombre: 'Cristian Osuna Bravo', dni: '88990011T', claveAcceso: 'hermano123', email: 'cristian.osuna@example.com', telefono: '699 887 766' },
  ],
  soledad: [
    { id: 's1', numero: 7, nombre: 'Lorena Campos Díaz', dni: '99001122U', claveAcceso: 'hermano123', email: 'lorena.campos@example.com', telefono: '611 223 344' },
    { id: 's2', numero: 19, nombre: 'Álvaro Bautista Reyes', dni: '10111213V', claveAcceso: 'hermano123', email: 'alvaro.bautista@example.com', telefono: '633 445 566' },
    { id: 's3', numero: 33, nombre: 'Nieves Palomo Guerra', dni: '12131415W', claveAcceso: 'hermano123', email: 'nieves.palomo@example.com', telefono: '644 556 677' },
  ],
}

export interface DatosHermandadPrincipal {
  nombre: string
  ciudad: string
  color: string
  telefono: string
  email: string
}

/** Combina la hermandad principal (con sus datos reales ya configurados) con las de muestra, para el buscador del portal. */
export function directorioCompleto(principal: DatosHermandadPrincipal): HermandadDirectorio[] {
  return [
    {
      id: ID_HERMANDAD_PRINCIPAL,
      nombre: principal.nombre || 'Tu hermandad (modo demo)',
      ciudad: principal.ciudad,
      color: principal.color || '#caa24a',
      telefono: principal.telefono,
      email: principal.email,
    },
    ...HERMANDADES_MUESTRA,
  ]
}

export function buscarHermandades(query: string, principal: DatosHermandadPrincipal): HermandadDirectorio[] {
  const q = query.trim().toLowerCase()
  const todas = directorioCompleto(principal)
  if (!q) return todas
  return todas.filter((h) => h.nombre.toLowerCase().includes(q) || h.ciudad.toLowerCase().includes(q))
}
