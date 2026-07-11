/**
 * Directorio de hermandades registradas en Cabildo. El área del hermano
 * identifica con un único DNI + contraseña y busca la coincidencia en la
 * hermandad "principal" (la que gestiona quien ha iniciado sesión como
 * secretaría en /app, con sus datos reales ya persistidos) y, si no la
 * encuentra, en las hermandades de muestra de aquí abajo — cada una con su
 * propio censo pequeño y aislado, para demostrar que cada hermandad ve solo
 * lo suyo y que el hermano no tiene que elegir nada: la app le lleva
 * directo a la hermandad que le dio de alta.
 */
import type { OpcionPapeleta } from './opcionesPapeleta'

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
  /** Teléfono del Bizum de la hermandad, al que los hermanos pagan sus papeletas. */
  bizum: string
  /** Cuenta de la hermandad para pagos por transferencia. */
  iban: string
  /** Papeletas que esta hermandad ofrece, con su nombre y precio propios. */
  opcionesPapeleta: OpcionPapeleta[]
}

export const ID_HERMANDAD_PRINCIPAL = 'principal'

export const HERMANDADES_MUESTRA: HermandadDirectorio[] = [
  {
    id: 'esperanza',
    nombre: 'Hermandad de Ntra. Sra. de la Esperanza',
    ciudad: 'Triana, Sevilla',
    color: '#2f7a4f',
    telefono: '954 11 22 33',
    email: 'secretaria@esperanza-triana.example',
    bizum: '683 45 67 89',
    iban: 'ES21 1465 0100 7220 3087 6545',
    opcionesPapeleta: [
      { id: 'e-op1', nombre: 'Cirio', importe: 12 },
      { id: 'e-op2', nombre: 'Mantilla', importe: 15 },
      { id: 'e-op3', nombre: 'Papeleta simbólica', importe: 5 },
    ],
  },
  {
    id: 'soledad',
    nombre: 'Hermandad de la Soledad',
    ciudad: 'Écija',
    color: '#5a4fc4',
    telefono: '955 44 55 66',
    email: 'secretaria@soledad-ecija.example',
    bizum: '644 98 76 54',
    iban: 'ES76 2100 0813 6101 2345 6789',
    opcionesPapeleta: [
      { id: 's-op1', nombre: 'Nazareno con cirio', importe: 10 },
      { id: 's-op2', nombre: 'Penitente con cruz', importe: 10 },
      { id: 's-op3', nombre: 'Papeleta de recuerdo', importe: 3 },
    ],
  },
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
