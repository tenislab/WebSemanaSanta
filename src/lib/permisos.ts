import { useEffect, useState } from 'react'
import { leerPersistido, useEscuchaOtrasPestanas } from './persistencia'
import { isSupabaseConfigured } from './supabase'
import { fetchPermisosPorCargoRemoto, guardarPermisosPorCargoRemoto } from './db/permisos'
import { CARGOS, type Cargo } from '../data/documentos'
import { authUserIdActual, soyTitular } from './multiHermandad'
import { getPersonal } from './personal'

export interface Modulo {
  id: string
  label: string
}

/**
 * Módulos del panel que se pueden restringir por cargo. "Inicio" no está
 * aquí a propósito: el resumen general es visible para cualquier persona
 * con acceso al panel, tenga el cargo que tenga.
 */
export const MODULOS: Modulo[] = [
  { id: 'hermanos', label: 'Hermanos' },
  { id: 'cortejo', label: 'Cortejo' },
  { id: 'cuotas', label: 'Cuotas' },
  { id: 'papeletas', label: 'Papeletas de sitio' },
  { id: 'tesoreria', label: 'Tesorería' },
  { id: 'inventario', label: 'Inventario' },
  { id: 'archivo', label: 'Archivo documental' },
  { id: 'eventos', label: 'Eventos y tareas' },
  { id: 'comunicados', label: 'Comunicados' },
  { id: 'informes', label: 'Informes' },
  { id: 'web', label: 'Web pública' },
  { id: 'personal', label: 'Personal y permisos' },
  { id: 'configuracion', label: 'Configuración' },
]

const TODOS = MODULOS.map((m) => m.id)

/** Permisos de fábrica por cargo: un punto de partida razonable, pensado para editarse desde Personal. */
export const PERMISOS_POR_DEFECTO: Record<Cargo, string[]> = {
  'Hermano Mayor': TODOS,
  'Secretario/a': ['hermanos', 'cortejo', 'papeletas', 'archivo', 'eventos', 'comunicados', 'informes', 'web'],
  'Tesorero/a': ['tesoreria', 'cuotas', 'inventario', 'informes'],
  Fiscal: ['archivo', 'informes'],
  'Mayordomo/Prioste': ['cortejo', 'inventario', 'eventos', 'informes'],
  'Diputado/a Mayor de Gobierno': ['hermanos', 'cortejo', 'papeletas', 'eventos', 'informes'],
  Vocal: ['eventos', 'comunicados', 'informes'],
  'Hermano de a pie': [],
}

const STORAGE_KEY = 'cabildo-permisos-cargo'

/** Permisos actuales por cargo: los de fábrica, sustituidos por los que la hermandad haya personalizado. */
export function getPermisosPorCargo(): Record<Cargo, string[]> {
  const guardado = leerPersistido<Partial<Record<Cargo, string[]>>>(STORAGE_KEY, {})
  const combinado = { ...PERMISOS_POR_DEFECTO }
  for (const cargo of CARGOS) {
    if (guardado[cargo]) combinado[cargo] = guardado[cargo] as string[]
  }
  return combinado
}

/**
 * Refresca la caché local de permisos desde Supabase (si está conectado) y
 * devuelve una versión que cambia cuando llegan datos nuevos: úsala como
 * dependencia para recalcular menús/rutas en cuanto lleguen permisos reales,
 * no solo los que hubiera en este navegador.
 */
export function usePermisosSincronizados(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelado = false
    fetchPermisosPorCargoRemoto(PERMISOS_POR_DEFECTO).then((remoto) => {
      if (cancelado || !remoto) return
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remoto))
      setVersion((v) => v + 1)
    })
    return () => {
      cancelado = true
    }
  }, [])
  return version
}

/** Como `getPermisosPorCargo`, pero con Supabase conectado trae la tabla real en cuanto llega. */
export function usePermisosPorCargo(): Record<Cargo, string[]> {
  const version = usePermisosSincronizados()
  const [permisos, setPermisos] = useState<Record<Cargo, string[]>>(() => getPermisosPorCargo())
  useEffect(() => {
    setPermisos(getPermisosPorCargo())
    // Se relee de localStorage (ya actualizado por usePermisosSincronizados) cada vez que llega una versión nueva.
  }, [version])
  // Lo que cambie en otra pestaña (el panel y el área del hermano abiertos a
  // la vez) se refleja aquí sin recargar.
  useEscuchaOtrasPestanas(STORAGE_KEY, () => setPermisos(getPermisosPorCargo()))

  return permisos
}

/**
 * Guarda los permisos por cargo, y DICE si se ha podido.
 *
 * Antes se tragaba el error: la pantalla ponía «Permisos guardados» en verde
 * pasara lo que pasara. Se le quitaba «hermanos» al tesorero, salía el visto
 * bueno, y al volver a entrar seguía viéndolo. Nadie sabía por qué.
 */
export async function savePermisosPorCargo(
  permisos: Record<Cargo, string[]>,
): Promise<{ ok: boolean; error?: string }> {
  // Primero el navegador, para que al menos quede aquí si la red falla.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(permisos))
  if (!isSupabaseConfigured) return { ok: true }
  return guardarPermisosPorCargoRemoto(permisos)
}

/**
 * Módulos visibles para un cargo, o null si no tiene restricción.
 *
 * `null` significa «titular de la hermandad», y por eso NO puede ser lo que
 * salga cuando el cargo no se reconoce: el cargo viene del metadata de la
 * cuenta, y bastaba con borrarlo para que la aplicación abriera todos los
 * módulos. Un cargo que no está en el catálogo no tiene permisos, punto.
 */
export function permisosDeCargo(cargo: Cargo | undefined | null): string[] | null {
  if (cargo === null || cargo === undefined) return null
  return getPermisosPorCargo()[cargo] ?? []
}

/**
 * ¿Puede este cargo ver el módulo? Solo el titular (sin cargo) lo ve todo; con
 * cargo, hay que tenerlo concedido explícitamente.
 */
export function puedeVerModulo(cargo: Cargo | undefined | null, moduloId: string) {
  const permisos = permisosDeCargo(cargo)
  return permisos === null || permisos.includes(moduloId)
}

/**
 * ¿Es una cuenta de personal (con cargo) o el titular?
 *
 * SE DECIDE POR EL IDENTIFICADOR DE LA CUENTA (`auth_user_id`), que es lo
 * único que el usuario no puede tocar. Antes se buscaba por
 * `user_metadata.personalId`, y ahí estaba el agujero: ese campo SOLO se
 * escribe en el acceso de demostración. Cuando el Hermano Mayor daba de alta
 * al tesorero de verdad, el registro no lo guardaba, así que al entrar:
 *
 *     personalId → undefined → cargoDeCuenta(undefined) → null → TITULAR
 *
 * Y `null` significa «el que manda». Resultado: todo el personal con cuenta de
 * verdad entraba con el panel entero abierto. La persona a la que le habías
 * dado solo Tesorería veía el censo completo, con DNI, teléfonos, direcciones
 * y datos de salud. Eso no es un permiso de más: es categoría especial del
 * RGPD delante de quien no debía.
 *
 * `esTitular` viene de la base de datos (tabla `titulares`). Sin él no se
 * puede distinguir «el titular, que no está en personal» de «una cuenta que no
 * hemos podido identificar», y ante la duda hay que cerrar, no abrir.
 */
export function cargoDeCuenta(
  authUserId: string | undefined,
  personal: { cargo: Cargo; activo: boolean; authUserId: string | null }[],
  esTitular = false,
): Cargo | null {
  if (!authUserId) return esTitular ? null : ('__desconocido__' as Cargo)
  const miembro = personal.find((m) => m.authUserId === authUserId)
  if (miembro) {
    // Desactivado NO es el titular: se queda sin permisos hasta que alguien lo
    // arregle. Devolver `null` aquí volvería a abrir el panel entero.
    return miembro.activo ? miembro.cargo : ('__desconocido__' as Cargo)
  }
  // No está en personal. O es el titular, o es una cuenta que no sabemos qué
  // es. Solo lo primero abre la puerta.
  return esTitular ? null : ('__desconocido__' as Cargo)
}


/**
 * El cargo de quien está dentro, resuelto bien: por el identificador de su
 * cuenta contra la tabla de personal, y preguntando a la base si es titular.
 *
 * Se usa desde el marco y desde las pantallas que enseñan cosas distintas
 * según el cargo. Mientras la respuesta no ha llegado se devuelve
 * `'__desconocido__'`, o sea SIN permisos: si empezara abierto, habría un
 * instante en cada carga en el que el tesorero ve el censo entero.
 */
export function useCargoDeLaSesion(): Cargo | null {
  const [cargo, setCargo] = useState<Cargo | null>('__desconocido__' as Cargo)
  useEffect(() => {
    let cancelado = false
    async function resolver() {
      const [uid, titular] = await Promise.all([authUserIdActual(), soyTitular()])
      if (cancelado) return
      setCargo(cargoDeCuenta(uid, getPersonal(), titular))
    }
    void resolver()
    return () => {
      cancelado = true
    }
  }, [])
  return cargo
}


/**
 * El cargo, escrito para una persona.
 *
 * `'__desconocido__'` es una marca interna que significa «no sabemos qué es
 * esta cuenta, así que sin permisos». Salió tal cual en la barra lateral,
 * debajo del nombre del Hermano Mayor recién registrado: «Jaime Rivas ·
 * __desconocido__». Eso no se le enseña a nadie.
 */
export function cargoEnCristiano(cargo: Cargo | null, correo?: string | null): string {
  if (cargo === null) return 'Titular de la hermandad'
  if (cargo === ('__desconocido__' as Cargo)) return correo || 'Sin cargo asignado'
  return cargo
}
