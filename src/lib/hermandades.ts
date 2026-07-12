/**
 * Directorio de hermandades registradas en Cabildo. El área del hermano
 * empieza siempre buscando la hermandad propia (como cualquier SaaS
 * multi-inquilino real): la "principal" es la que gestiona quien ha
 * iniciado sesión como secretaría en /app, con sus datos reales ya
 * persistidos; las demás son hermandades de muestra, cada una con su propio
 * censo pequeño y aislado, para demostrar que cada hermandad ve solo lo
 * suyo. Una vez elegida la hermandad, el hermano entra con su DNI y
 * contraseña o, si aún no está en el censo, solicita el alta (ver
 * lib/solicitudes.ts).
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

/** Glifo del escudo de cada hermandad (ver components/EscudoHermandad.tsx): un símbolo propio, no un logo real. */
export type IconoHermandad =
  | 'cruz'
  | 'corona'
  | 'estrella'
  | 'paloma'
  | 'ancora'
  | 'lirio'
  | 'corazon'
  | 'sol'
  | 'luna'
  | 'concha'

export interface HermandadDirectorio {
  id: string
  nombre: string
  ciudad: string
  color: string
  /** Símbolo del escudo; sin él se usa un círculo con las iniciales. */
  icono?: IconoHermandad
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
    icono: 'ancora',
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
    icono: 'luna',
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
  {
    id: 'borriquita',
    nombre: 'Hermandad de la Borriquita',
    ciudad: 'Sevilla',
    color: '#c9942f',
    icono: 'sol',
    telefono: '954 22 33 44',
    email: 'secretaria@borriquita-sevilla.example',
    bizum: '622 11 33 55',
    iban: 'ES12 0049 1500 0512 3456 7891',
    opcionesPapeleta: [
      { id: 'b-op1', nombre: 'Monaguillo', importe: 8 },
      { id: 'b-op2', nombre: 'Nazareno', importe: 12 },
      { id: 'b-op3', nombre: 'Insignia', importe: 20 },
    ],
  },
  {
    id: 'macarena',
    nombre: 'Hermandad de la Macarena',
    ciudad: 'Sevilla',
    color: '#1f6f8b',
    icono: 'estrella',
    telefono: '954 33 44 55',
    email: 'secretaria@macarena-sevilla.example',
    bizum: '633 22 44 66',
    iban: 'ES55 0075 0100 0206 0567 8912',
    opcionesPapeleta: [
      { id: 'm-op1', nombre: 'Cirio blanco', importe: 14 },
      { id: 'm-op2', nombre: 'Mantilla', importe: 16 },
      { id: 'm-op3', nombre: 'Costalero', importe: 6 },
    ],
  },
  {
    id: 'veracruz',
    nombre: 'Hermandad de la Vera-Cruz',
    ciudad: 'Córdoba',
    color: '#7a1f2b',
    icono: 'cruz',
    telefono: '957 44 55 66',
    email: 'secretaria@veracruz-cordoba.example',
    bizum: '611 33 55 77',
    iban: 'ES33 2038 1234 5678 9012 3456',
    opcionesPapeleta: [
      { id: 'v-op1', nombre: 'Nazareno con cruz', importe: 11 },
      { id: 'v-op2', nombre: 'Acólito', importe: 9 },
      { id: 'v-op3', nombre: 'Papeleta simbólica', importe: 4 },
    ],
  },
  {
    id: 'nazareno',
    nombre: 'Hermandad de Jesús Nazareno',
    ciudad: 'Málaga',
    color: '#8a5a2b',
    icono: 'corona',
    telefono: '952 55 66 77',
    email: 'secretaria@nazareno-malaga.example',
    bizum: '600 44 66 88',
    iban: 'ES44 0182 5678 9012 3456 7890',
    opcionesPapeleta: [
      { id: 'n-op1', nombre: 'Nazareno con cirio', importe: 13 },
      { id: 'n-op2', nombre: 'Penitente descalzo', importe: 10 },
      { id: 'n-op3', nombre: 'Bocina', importe: 18 },
    ],
  },
  {
    id: 'piedad',
    nombre: 'Hermandad de la Piedad',
    ciudad: 'Zaragoza',
    color: '#b23b6b',
    icono: 'corazon',
    telefono: '976 66 77 88',
    email: 'secretaria@piedad-zaragoza.example',
    bizum: '699 55 77 99',
    iban: 'ES66 2085 9012 3456 7890 1234',
    opcionesPapeleta: [
      { id: 'p-op1', nombre: 'Cirio', importe: 10 },
      { id: 'p-op2', nombre: 'Manola', importe: 15 },
      { id: 'p-op3', nombre: 'Papeleta de recuerdo', importe: 3 },
    ],
  },
  {
    id: 'pasion',
    nombre: 'Hermandad de la Pasión',
    ciudad: 'Valladolid',
    color: '#2b3a67',
    icono: 'concha',
    telefono: '983 77 88 99',
    email: 'secretaria@pasion-valladolid.example',
    bizum: '688 66 88 00',
    iban: 'ES77 0128 3456 7890 1234 5678',
    opcionesPapeleta: [
      { id: 'pa-op1', nombre: 'Nazareno', importe: 12 },
      { id: 'pa-op2', nombre: 'Portaestandarte', importe: 16 },
      { id: 'pa-op3', nombre: 'Papeleta simbólica', importe: 5 },
    ],
  },
  {
    id: 'amargura',
    nombre: 'Hermandad de Ntra. Sra. de la Amargura',
    ciudad: 'Granada',
    color: '#4a4f6b',
    icono: 'paloma',
    telefono: '958 88 99 00',
    email: 'secretaria@amargura-granada.example',
    bizum: '677 77 99 11',
    iban: 'ES88 3456 7890 1234 5678 9012',
    opcionesPapeleta: [
      { id: 'am-op1', nombre: 'Mantilla', importe: 15 },
      { id: 'am-op2', nombre: 'Cirio', importe: 11 },
      { id: 'am-op3', nombre: 'Monaguillo', importe: 7 },
    ],
  },
  {
    id: 'trinidad',
    nombre: 'Hermandad de la Santísima Trinidad',
    ciudad: 'Cádiz',
    color: '#c2762a',
    icono: 'lirio',
    telefono: '956 99 00 11',
    email: 'secretaria@trinidad-cadiz.example',
    bizum: '666 88 00 22',
    iban: 'ES99 4567 8901 2345 6789 0123',
    opcionesPapeleta: [
      { id: 't-op1', nombre: 'Nazareno con cirio', importe: 12 },
      { id: 't-op2', nombre: 'Penitente', importe: 9 },
      { id: 't-op3', nombre: 'Papeleta de recuerdo', importe: 3 },
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
  borriquita: [
    { id: 'b1', numero: 4, nombre: 'Rocío Medina Vargas', dni: '13141516X', claveAcceso: 'hermano123', email: 'rocio.medina@example.com', telefono: '655 667 788' },
    { id: 'b2', numero: 21, nombre: 'Sergio Cano Delgado', dni: '14151617Y', claveAcceso: 'hermano123', email: 'sergio.cano@example.com', telefono: '666 778 899' },
  ],
  macarena: [
    { id: 'ma1', numero: 3, nombre: 'Inés Rueda Márquez', dni: '15161718Z', claveAcceso: 'hermano123', email: 'ines.rueda@example.com', telefono: '677 889 900' },
    { id: 'ma2', numero: 56, nombre: 'David Ponce Serrano', dni: '16171819A', claveAcceso: 'hermano123', email: 'david.ponce@example.com', telefono: '688 990 011' },
  ],
  veracruz: [
    { id: 'v1', numero: 9, nombre: 'Beatriz Lozano Vega', dni: '17181920B', claveAcceso: 'hermano123', email: 'beatriz.lozano@example.com', telefono: '699 001 122' },
    { id: 'v2', numero: 27, nombre: 'Hugo Carmona Ríos', dni: '18192021C', claveAcceso: 'hermano123', email: 'hugo.carmona@example.com', telefono: '600 112 233' },
  ],
  nazareno: [
    { id: 'n1', numero: 15, nombre: 'Carmen Aranda Soto', dni: '19202122D', claveAcceso: 'hermano123', email: 'carmen.aranda@example.com', telefono: '611 223 344' },
    { id: 'n2', numero: 62, nombre: 'Rubén Gallardo Peña', dni: '20212223E', claveAcceso: 'hermano123', email: 'ruben.gallardo@example.com', telefono: '622 334 455' },
  ],
  piedad: [
    { id: 'p1', numero: 6, nombre: 'Silvia Montero Cruz', dni: '21222324F', claveAcceso: 'hermano123', email: 'silvia.montero@example.com', telefono: '633 445 566' },
    { id: 'p2', numero: 38, nombre: 'Óscar Reyes Fuentes', dni: '22232425G', claveAcceso: 'hermano123', email: 'oscar.reyes@example.com', telefono: '644 556 677' },
  ],
  pasion: [
    { id: 'pa1', numero: 11, nombre: 'Laura Cabrera Ortiz', dni: '23242526H', claveAcceso: 'hermano123', email: 'laura.cabrera@example.com', telefono: '655 667 788' },
    { id: 'pa2', numero: 44, nombre: 'Marcos Vidal Blanco', dni: '24252627J', claveAcceso: 'hermano123', email: 'marcos.vidal@example.com', telefono: '666 778 899' },
  ],
  amargura: [
    { id: 'am1', numero: 17, nombre: 'Paula Domínguez León', dni: '25262728K', claveAcceso: 'hermano123', email: 'paula.dominguez@example.com', telefono: '677 889 900' },
    { id: 'am2', numero: 53, nombre: 'Iván Cortés Herrero', dni: '26272829L', claveAcceso: 'hermano123', email: 'ivan.cortes@example.com', telefono: '688 990 011' },
  ],
  trinidad: [
    { id: 't1', numero: 5, nombre: 'Alba Reina Muñoz', dni: '27282930M', claveAcceso: 'hermano123', email: 'alba.reina@example.com', telefono: '699 001 122' },
    { id: 't2', numero: 29, nombre: 'Gonzalo Prado Salas', dni: '28293031N', claveAcceso: 'hermano123', email: 'gonzalo.prado@example.com', telefono: '600 112 233' },
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
      bizum: '',
      iban: '',
      opcionesPapeleta: [],
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
