import { useEffect, useState } from 'react'
import { CLAVES_DATOS, leerDatos, leerPersistido, useEscuchaOtrasPestanas } from './persistencia'
import { isSupabaseConfigured } from './supabase'
import { fetchPermisosPorCargoRemoto, guardarPermisosPorCargoRemoto } from './db/permisos'
import { CARGOS, type Cargo } from '../data/documentos'
import { authUserIdActual, miFichaDeHermano, soyTitular } from './multiHermandad'
import { getPersonal } from './personal'
import { HERMANOS_INICIALES, type Hermano } from '../data/hermanos'

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
  { id: 'campanas', label: 'Campañas y proyectos' },
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
  'Secretario/a': ['hermanos', 'cortejo', 'papeletas', 'archivo', 'eventos', 'campanas', 'comunicados', 'informes', 'web'],
  'Tesorero/a': ['tesoreria', 'cuotas', 'inventario', 'campanas', 'informes'],
  Fiscal: ['archivo', 'informes'],
  'Mayordomo/Prioste': ['cortejo', 'inventario', 'eventos', 'campanas', 'informes'],
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
  // Y lo que cambie en ESTA, que el evento `storage` no cuenta.
  useEffect(() => {
    function alGuardar() {
      setPermisos(getPermisosPorCargo())
    }
    window.addEventListener(AVISO_CAMBIO, alGuardar)
    return () => window.removeEventListener(AVISO_CAMBIO, alGuardar)
  }, [])

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
  avisarDeQueCambiaron()
  if (!isSupabaseConfigured) return { ok: true }
  return guardarPermisosPorCargoRemoto(permisos)
}

/** Nombre del aviso de «los permisos han cambiado EN ESTA pestaña». */
const AVISO_CAMBIO = 'cabildo-permisos-guardados'

/**
 * Avisa a esta misma pestaña de que los permisos han cambiado.
 *
 * POR QUÉ HACE FALTA, que es lo que no era evidente. El evento `storage` del
 * navegador solo lo reciben las OTRAS pestañas: la que escribe nunca se entera
 * de su propio cambio. Así que `usePermisosPorCargo` se quedaba con lo que
 * leyó al abrir la pantalla, y en cuanto Personal marcaba el formulario como
 * «ya guardado», su efecto de sincronizar volvía a poner ESOS valores viejos
 * encima de los recién guardados.
 *
 * Lo que se veía: cambias los permisos, le das a Guardar, sale el visto bueno
 * verde… y las casillas vuelven solas a como estaban. En la base estaban bien
 * guardados; era la pantalla la que se pisaba a sí misma.
 */
function avisarDeQueCambiaron() {
  window.dispatchEvent(new CustomEvent(AVISO_CAMBIO))
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
  hermanos: ConCargo[] = [],
): Cargo | null {
  // Sin identificador de cuenta no hay nada que cruzar. Y esta línea es
  // además la que hace cumplir «para llevar cargo hace falta correo»: sin
  // correo no hay cuenta de Supabase, sin cuenta no hay `auth_user_id`, y sin
  // eso las políticas de la base no pueden saber quién eres.
  if (!authUserId) return esTitular ? null : ('__desconocido__' as Cargo)

  // 1ª vía: la tabla `personal`, que es como entraba la junta hasta ahora.
  // Solo si está ACTIVA: una fila desactivada no manda.
  const miembro = personal.find((m) => m.authUserId === authUserId)
  if (miembro?.activo) return miembro.cargo

  // 2ª vía: el cargo en la ficha del hermano.
  const conCargo = cargoDeSuFicha(hermanos.find((h) => h.authUserId === authUserId))
  if (conCargo) return conCargo

  /*
   * Y si estaba en personal pero desactivado, y tampoco tiene cargo en su
   * ficha, entonces sí: sin permisos. Nunca `null`, que significa titular.
   *
   * EL ORDEN IMPORTA, y aquí se ve por qué. Antes se devolvía
   * '__desconocido__' en cuanto se encontraba una fila de personal
   * desactivada, sin llegar a mirar la ficha. Y esa es EXACTAMENTE la
   * migración natural: «le pongo el cargo en su ficha y desactivo su acceso
   * viejo de personal». La secretaria acababa con 'Secretario/a' escrito en su
   * ficha, la base de datos dejándola escribir —modulo_permitido suma las tres
   * vías con OR— y la aplicación enseñándole un panel sin un solo módulo y su
   * correo debajo del nombre. Guardaba bien y no veía nada, que desconcierta
   * el doble.
   */
  if (miembro) return '__desconocido__' as Cargo

  // No está en ningún sitio. O es el titular, o es una cuenta que no sabemos
  // qué es. Solo lo primero abre la puerta.
  return esTitular ? null : ('__desconocido__' as Cargo)
}

/**
 * El cargo que da una ficha de hermano, o nada.
 *
 * TIENE QUE DEVOLVER `undefined` Y NO `null` cuando no hay cargo, y ese
 * detalle es la trampa número uno de todo este cambio.
 *
 * En esta misma casa, `null` significa TITULAR: acceso a todo. Y en la ficha
 * de un hermano, `cargo: null` significa exactamente lo contrario — hermano de
 * a pie, sin panel. Son el mismo valor queriendo decir cosas opuestas. Si
 * alguien escribe `puedeVerModulo(hermano.cargo, ...)` le abre la aplicación
 * entera a cualquier hermano del censo.
 *
 * Por eso el cargo de un hermano NO se pasa nunca directamente a
 * `permisosDeCargo` ni a `puedeVerModulo`: pasa por aquí, que solo devuelve
 * algo cuando de verdad hay un cargo.
 */
export type ConCargo = { cargo?: Cargo | null; authUserId: string | null; estado: string }

function cargoDeSuFicha(h: ConCargo | undefined): Cargo | undefined {
  if (!h || !h.cargo) return undefined
  // Un hermano dado de baja no sigue llevando la tesorería.
  if (h.estado === 'Baja') return '__desconocido__' as Cargo
  // 'Hermano de a pie' es un cargo del catálogo sin ningún módulo. Ponérselo a
  // alguien sería darle una cuenta de panel vacío, así que cuenta como no
  // llevar cargo. La pantalla de Personal no lo ofrece; esto es el cinturón.
  if (h.cargo === 'Hermano de a pie') return undefined
  return h.cargo
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
  return useCargoDeLaSesionConEstado().cargo
}

/**
 * El cargo Y si ya se sabe cuál es.
 *
 * `resuelto` importa más de lo que parece. «Todavía no lo sé» y «no tiene
 * permisos» son cosas distintas, y confundirlas costó caro:
 *
 * El marco de la aplicación mira el cargo para decidir si redirige a Inicio. Y
 * como el hook empezaba en `'__desconocido__'` —sin permisos— la redirección
 * saltaba en el primer pintado, ANTES de que la respuesta llegara. Resultado:
 * pulsabas «Cuotas» y aparecías en Inicio. Todas las secciones, siempre, para
 * todo el mundo. El cargo se resolvía medio segundo después y ya daba igual,
 * porque el navegador ya estaba en otra dirección.
 *
 * Empezar abierto tampoco vale: habría un instante en cada carga en el que el
 * tesorero ve el censo. Por eso la respuesta correcta no es un valor, son dos:
 * quien decide algo con esto tiene que ESPERAR mientras `resuelto` sea falso.
 */
export function useCargoDeLaSesionConEstado(): { cargo: Cargo | null; resuelto: boolean } {
  const [estado, setEstado] = useState<{ cargo: Cargo | null; resuelto: boolean }>({
    cargo: '__desconocido__' as Cargo,
    resuelto: false,
  })
  useEffect(() => {
    let cancelado = false
    async function resolver() {
      // En la demostración no hay base de datos a la que preguntar, así que el
      // cargo sale de la cuenta de ejemplo con la que se ha entrado.
      const deLaDemo = cargoDeLaCuentaDemo()
      if (deLaDemo !== undefined) {
        setEstado({ cargo: deLaDemo, resuelto: true })
        return
      }
      const [uid, titular, ficha] = await Promise.all([
        authUserIdActual(),
        soyTitular(),
        // Mi propia ficha del censo, preguntada a la base. NO se lee del
        // espejo del navegador: está vacío la primera vez que se abre la
        // aplicación en un ordenador nuevo, y el secretario se quedaría sin
        // su cargo sin saber por qué.
        miFichaDeHermano(),
      ])
      if (cancelado) return
      const mios = ficha ? [{ ...ficha, authUserId: uid ?? null }] : []
      setEstado({ cargo: cargoDeCuenta(uid, getPersonal(), titular, mios), resuelto: true })
    }
    void resolver()
    return () => {
      cancelado = true
    }
  }, [])
  return estado
}

/**
 * El cargo de la cuenta de ejemplo con la que se ha entrado en la demostración.
 * `undefined` si no estamos en demostración: entonces manda la base de datos.
 *
 * EL FALLO QUE ARREGLA: la pantalla de acceso ofrece «entra como un cargo
 * concreto y comprueba qué ve cada uno». Y no cumplía. Se entraba como Carmen
 * Ruiz, Secretaria, y salía el panel ENTERO —Tesorería, Inventario, Personal y
 * permisos, Configuración— con un «Titular de la hermandad» debajo de su
 * nombre. Justo lo contrario de lo que se estaba enseñando.
 *
 * El motivo: sin Supabase no hay tabla `titulares` a la que preguntar, así que
 * `soyTitular()` contesta que sí para no bloquear la demostración. Y titular
 * quiere decir acceso completo.
 *
 * Aquí SÍ se mira el metadata de la sesión, que en el resto de la aplicación
 * está prohibido a propósito —lo puede reescribir el propio usuario, y por ahí
 * se coló en su día que todo el personal entrara como titular—. La diferencia
 * es que esto solo corre CON SUPABASE APAGADO: no hay datos de nadie que
 * proteger, no hay sesión que falsificar y no hay nada que ganar falsificando.
 * Con base de datos conectada esta función devuelve `undefined` y no se toca.
 */
function cargoDeLaCuentaDemo(): Cargo | null | undefined {
  if (isSupabaseConfigured) return undefined
  try {
    const crudo = sessionStorage.getItem('cabildo-demo-user')
    if (!crudo) return undefined
    const marcas = (JSON.parse(crudo) as {
      user_metadata?: { personalId?: string; hermanoId?: string }
    })?.user_metadata
    const idPersonal = marcas?.personalId
    const idHermano = marcas?.hermanoId

    // Sin NINGUNA de las dos marcas es la cuenta de titular de la
    // demostración: manda todo. Hay que mirar las dos antes de decidirlo —
    // cuando solo se miraba `personalId`, un hermano de demostración entraba
    // de titular con el panel entero.
    if (!idPersonal && !idHermano) return null

    if (idPersonal) {
      const miembro = getPersonal().find((p) => p.id === idPersonal)
      // No está en la lista (lo han borrado, o se han restablecido los datos
      // de ejemplo). NO es el titular: sin permisos. Devolver `null` aquí
      // convertía esa sesión abierta en titular de golpe.
      if (!miembro) return '__desconocido__' as Cargo
      // Desactivado no es titular: se queda sin permisos, igual que de verdad.
      return miembro.activo ? miembro.cargo : ('__desconocido__' as Cargo)
    }

    const censo = leerDatos<Hermano>(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
    const hermano = censo.find((h) => h.id === idHermano)
    if (!hermano) return '__desconocido__' as Cargo
    if (hermano.estado === 'Baja' || !hermano.cargo) return '__desconocido__' as Cargo
    if (hermano.cargo === 'Hermano de a pie') return '__desconocido__' as Cargo
    return hermano.cargo
  } catch {
    return undefined
  }
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
  // Con los cargos en la ficha del hermano, esto sale mucho más que antes:
  // cualquier hermano que llegue al panel cae aquí. Por eso NO puede sonar a
  // error — no lo es, es lo normal para quien solo es hermano.
  if (cargo === ('__desconocido__' as Cargo)) return correo || 'Hermano/a de la hermandad'
  return cargo
}
