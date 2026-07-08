export type Canal = 'Email' | 'SMS' | 'WhatsApp' | 'Push' | 'Redes sociales'
export type EstadoComunicado = 'Borrador' | 'Programado' | 'Enviado'
export type RedSocial = 'Facebook' | 'Instagram' | 'X' | 'YouTube' | 'TikTok'

export interface CuentaSocial {
  red: RedSocial
  conectada: boolean
  usuario: string | null
}

export interface Comunicado {
  id: string
  numero: number
  titulo: string
  cuerpo: string
  canal: Canal
  /** Redes elegidas para publicar; solo tiene sentido cuando canal === 'Redes sociales'. */
  redes: RedSocial[] | null
  destinatarios: string
  estado: EstadoComunicado
  fechaCreacion: string
  fechaProgramada: string | null
  fechaEnvio: string | null
  autor: string
  /** Personas alcanzadas; solo se conoce una vez enviado. */
  alcance: number | null
}

export const CANALES: Canal[] = ['Email', 'SMS', 'WhatsApp', 'Push', 'Redes sociales']

export const SEGMENTOS: string[] = [
  'Todos los hermanos',
  'Hermanos con cuota al día',
  'Hermanos con cuota pendiente',
  'Nazarenos con papeleta de sitio',
  'Junta de Gobierno',
]

export const REDES_SOCIALES: RedSocial[] = ['Facebook', 'Instagram', 'X', 'YouTube', 'TikTok']

/**
 * Estado de conexión de ejemplo: Facebook e Instagram ya conectadas (para
 * poder mostrar un comunicado ya publicado en redes), el resto sin
 * conectar. La conexión es simulada — no hay OAuth real todavía.
 */
export const CUENTAS_SOCIALES_INICIALES: CuentaSocial[] = [
  { red: 'Facebook', conectada: true, usuario: '@hermandaddemo' },
  { red: 'Instagram', conectada: true, usuario: '@hermandaddemo' },
  { red: 'X', conectada: false, usuario: null },
  { red: 'YouTube', conectada: false, usuario: null },
  { red: 'TikTok', conectada: false, usuario: null },
]

export const COMUNICADOS_INICIALES: Comunicado[] = [
  {
    id: 'k1', numero: 1, titulo: 'Convocatoria de Cabildo General de Cuentas',
    cuerpo: 'Se convoca a todos los hermanos al Cabildo General de Cuentas, que se celebrará en la casa de hermandad.',
    canal: 'Email', redes: null, destinatarios: 'Todos los hermanos', estado: 'Enviado',
    fechaCreacion: '2026-01-15', fechaProgramada: null, fechaEnvio: '2026-01-15', autor: 'Secretaría', alcance: 612,
  },
  {
    id: 'k2', numero: 2, titulo: 'Recordatorio: cuota del primer trimestre',
    cuerpo: 'Recordamos a los hermanos con recibo pendiente que el plazo de pago termina esta semana.',
    canal: 'SMS', redes: null, destinatarios: 'Hermanos con cuota pendiente', estado: 'Enviado',
    fechaCreacion: '2026-02-10', fechaProgramada: null, fechaEnvio: '2026-02-11', autor: 'Tesorería', alcance: 84,
  },
  {
    id: 'k3', numero: 3, titulo: 'Ya puedes sacar tu papeleta de sitio',
    cuerpo: 'Desde hoy está abierto el plazo para solicitar la papeleta de sitio de la próxima estación de penitencia.',
    canal: 'WhatsApp', redes: null, destinatarios: 'Todos los hermanos', estado: 'Enviado',
    fechaCreacion: '2026-03-01', fechaProgramada: null, fechaEnvio: '2026-03-01', autor: 'Diputación Mayor de Gobierno', alcance: 598,
  },
  {
    id: 'k4', numero: 4, titulo: 'Presentación del cartel de la Cuaresma',
    cuerpo: 'Esta tarde presentamos el cartel oficial de la Cuaresma en la casa de hermandad. ¡Os esperamos!',
    canal: 'Redes sociales', redes: ['Facebook', 'Instagram'], destinatarios: 'Todos los hermanos', estado: 'Enviado',
    fechaCreacion: '2026-02-20', fechaProgramada: null, fechaEnvio: '2026-02-20', autor: 'Junta de Gobierno', alcance: 1830,
  },
  {
    id: 'k5', numero: 5, titulo: 'Horario de cultos de Cuaresma',
    cuerpo: 'Consulta el horario completo de quinarios, triduos y besamanos de esta Cuaresma.',
    canal: 'Email', redes: null, destinatarios: 'Todos los hermanos', estado: 'Enviado',
    fechaCreacion: '2026-02-25', fechaProgramada: null, fechaEnvio: '2026-02-25', autor: 'Secretaría', alcance: 605,
  },
  {
    id: 'k6', numero: 6, titulo: 'Ensayo general de costaleros',
    cuerpo: 'Convocado el ensayo general de la cuadrilla de costaleros previo a la estación de penitencia.',
    canal: 'WhatsApp', redes: null, destinatarios: 'Nazarenos con papeleta de sitio', estado: 'Programado',
    fechaCreacion: '2026-07-01', fechaProgramada: '2026-07-20', fechaEnvio: null, autor: 'Mayordomía', alcance: null,
  },
  {
    id: 'k7', numero: 7, titulo: 'Reunión de Junta de Gobierno de julio',
    cuerpo: 'Se convoca a los miembros de la Junta de Gobierno a la reunión mensual de seguimiento.',
    canal: 'Email', redes: null, destinatarios: 'Junta de Gobierno', estado: 'Programado',
    fechaCreacion: '2026-07-05', fechaProgramada: '2026-07-15', fechaEnvio: null, autor: 'Secretaría', alcance: null,
  },
  {
    id: 'k8', numero: 8, titulo: 'Adelanto del itinerario de la estación de penitencia',
    cuerpo: 'Publicamos un primer adelanto del itinerario para esta próxima Semana Santa.',
    canal: 'Redes sociales', redes: ['Facebook', 'Instagram'], destinatarios: 'Todos los hermanos', estado: 'Programado',
    fechaCreacion: '2026-07-06', fechaProgramada: '2026-07-25', fechaEnvio: null, autor: 'Junta de Gobierno', alcance: null,
  },
  {
    id: 'k9', numero: 9, titulo: 'Campaña de captación de nuevos hermanos',
    cuerpo: 'Borrador de la campaña para animar a familiares y amigos a hacerse hermanos este año.',
    canal: 'Redes sociales', redes: ['Facebook'], destinatarios: 'Todos los hermanos', estado: 'Borrador',
    fechaCreacion: '2026-07-07', fechaProgramada: null, fechaEnvio: null, autor: 'Junta de Gobierno', alcance: null,
  },
  {
    id: 'k10', numero: 10, titulo: 'Aviso de cambio de horario de Secretaría en agosto',
    cuerpo: 'Borrador con el nuevo horario de atención al hermano durante el mes de agosto.',
    canal: 'Push', redes: null, destinatarios: 'Todos los hermanos', estado: 'Borrador',
    fechaCreacion: '2026-07-08', fechaProgramada: null, fechaEnvio: null, autor: 'Secretaría', alcance: null,
  },
]
