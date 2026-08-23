import { leerPersistido } from './persistencia'
import type { Cargo } from '../data/documentos'
import type { Hermano } from '../data/hermanos'
import type { CriteriosSegmento } from './segmentacion'

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
  /** Id de su cuenta real de Supabase Auth, una vez creada (null en modo demostración o hasta que se cree). */
  authUserId: string | null
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
    authUserId: null,
  },
  {
    id: 'personal-demo-tesorero',
    nombre: 'Manuel Ortega Vidal',
    email: 'tesorero@tuhermandad.org',
    clave: 'tesoro123',
    cargo: 'Tesorero/a',
    activo: true,
    fechaAlta: '2026-01-01',
    authUserId: null,
  },
  {
    id: 'personal-demo-fiscal',
    nombre: 'Isabel Moya Cantero',
    email: 'fiscal@tuhermandad.org',
    clave: 'fiscal123',
    cargo: 'Fiscal',
    activo: true,
    fechaAlta: '2026-01-01',
    authUserId: null,
  },
  {
    id: 'personal-demo-mayordomo',
    nombre: 'Rafael Cordero Nieto',
    email: 'mayordomo@tuhermandad.org',
    clave: 'mayordo123',
    cargo: 'Mayordomo/Prioste',
    activo: true,
    fechaAlta: '2026-01-01',
    authUserId: null,
  },
  {
    id: 'personal-demo-diputado',
    nombre: 'Antonio Reyes Salas',
    email: 'diputado@tuhermandad.org',
    clave: 'diputa123',
    cargo: 'Diputado/a Mayor de Gobierno',
    activo: true,
    fechaAlta: '2026-01-01',
    authUserId: null,
  },
  {
    id: 'personal-demo-vocal',
    nombre: 'Lucía Prieto Gálvez',
    email: 'vocal@tuhermandad.org',
    clave: 'vocal123',
    cargo: 'Vocal',
    activo: true,
    fechaAlta: '2026-01-01',
    authUserId: null,
  },
]

export function getPersonal(): MiembroPersonal[] {
  return leerPersistido<MiembroPersonal[]>(CLAVE_PERSONAL, PERSONAL_DE_EJEMPLO)
}

export function savePersonal(personal: MiembroPersonal[]) {
  localStorage.setItem(CLAVE_PERSONAL, JSON.stringify(personal))
}


/**
 * EL CARGO QUE MANDA DE VERDAD, hermano a hermano.
 *
 * Una persona puede llevar cargo por dos sitios y no son el mismo:
 *
 *   · la ficha del censo (`hermano.cargo`), que es donde se reparten desde la
 *     pestaña de roles;
 *   · su fila de `personal`, que es la cuenta con la que entra al panel.
 *
 * Y cuando están las dos, **gana la de personal**: es la que mira
 * `cargoDeCuenta` para decidir qué ve al entrar. La pantalla de Personal ya lo
 * avisa («la misma persona en las dos listas»).
 *
 * Sin esto, «mandar el comunicado solo a la junta» se dejaba fuera a media
 * junta sin decirlo. El caso típico: María es hermana nº 214 y su ficha no
 * lleva cargo, pero tiene fila de personal como Tesorera. Es la tesorera de la
 * hermandad, entra al panel como tesorera, y no le llegaba la convocatoria de
 * la junta. No daba error: simplemente no estaba en la lista.
 *
 * Se cruzan por cuenta y por correo, que son las dos formas en que la misma
 * persona aparece en las dos listas. Las filas desactivadas no cuentan: a quien
 * se le ha quitado el acceso ya no es junta.
 */
export function cargosEfectivos(
  hermanos: Pick<Hermano, 'id' | 'email' | 'authUserId' | 'cargo'>[],
  personal: MiembroPersonal[],
): Map<string, string> {
  const activos = personal.filter((p) => p.activo)
  const porCuenta = new Map(activos.filter((p) => p.authUserId).map((p) => [p.authUserId as string, p.cargo]))
  const porCorreo = new Map(activos.filter((p) => p.email).map((p) => [p.email.toLowerCase(), p.cargo]))

  const salida = new Map<string, string>()
  for (const h of hermanos) {
    const deLaCuenta = h.authUserId ? porCuenta.get(h.authUserId) : undefined
    const delCorreo = h.email ? porCorreo.get(h.email.toLowerCase()) : undefined
    const cargo = deLaCuenta ?? delCorreo ?? h.cargo ?? ''
    if (cargo) salida.set(h.id, cargo)
  }
  return salida
}


/**
 * LA JUNTA QUE NO ESTÁ EN EL CENSO.
 *
 * Hay hermandades que dan de alta a su junta por Personal y punto: cada uno
 * tiene su cuenta para entrar al panel y ninguno tiene ficha en el censo. Es lo
 * que hace la demostración, y es una forma perfectamente normal de montarlo.
 *
 * Para esas personas, «mandar el comunicado solo a la junta» no encontraba a
 * NADIE —no están en el censo, y el censo es donde se busca—. Ni buzón, ni
 * correo, ni aviso: cero destinatarios y el comunicado guardado como enviado.
 *
 * No tienen área de hermano, así que buzón no hay ninguno que llenar; pero
 * tienen correo, y el correo sí se les puede mandar. Eso es lo que devuelve
 * esta función: los que hay que añadir A MANO al envío por correo.
 *
 * SOLO para sesgos que van por cargo, y solo si el cargo es lo único que se
 * pide. Un miembro del personal no tiene cuota, ni papeleta, ni etiquetas, ni
 * fecha de nacimiento: si entrara en «hermanos con cuota pendiente» estaría
 * entrando por no tener el dato, que es justo al revés. Y en «todos los
 * hermanos» no pinta nada — no es hermano.
 */
export function personalDelSegmento(
  c: CriteriosSegmento,
  personal: MiembroPersonal[],
  hermanos: Pick<Hermano, 'email' | 'authUserId'>[],
): MiembroPersonal[] {
  if (!c.cargo) return []
  // El cargo tiene que ser lo único que se pide (ver arriba).
  const soloElCargo =
    c.cuota === 'Todos'
    && c.edad === 'Todos'
    && !c.etiqueta
    && (c.campos ?? []).every((x) => !x.valor)
    && c.estado !== 'Baja'
  if (!soloElCargo) return []

  const yaEnElCenso = new Set<string>()
  for (const h of hermanos) {
    if (h.authUserId) yaEnElCenso.add(`uid:${h.authUserId}`)
    if (h.email) yaEnElCenso.add(`mail:${h.email.toLowerCase()}`)
  }

  return personal.filter((p) => {
    if (!p.activo) return false
    if (!p.email || !p.email.includes('@')) return false
    // «Hermano de a pie» no es junta: es lo que se le pone a quien no lleva
    // cargo ninguno.
    if (p.cargo === 'Hermano de a pie') return false
    if (c.cargo !== '__junta' && p.cargo !== c.cargo) return false
    // Si ya está en el censo, va por ahí: no se le manda dos veces.
    if (p.authUserId && yaEnElCenso.has(`uid:${p.authUserId}`)) return false
    if (yaEnElCenso.has(`mail:${p.email.toLowerCase()}`)) return false
    return true
  })
}
