import { borrarTodosLosArchivos, guardarArchivo, todosLosArchivos } from './filestore'
import { supabase, isSupabaseConfigured } from './supabase'
import { traerTodasLasFilas } from './paginado'

/**
 * Copia de seguridad completa de una hermandad: mientras no hay base de datos
 * en la nube, todo vive en este navegador (localStorage + IndexedDB). Esta
 * copia permite descargar un único archivo JSON con TODO (hermanos, cuotas,
 * papeletas, tesorería, documentos y sus archivos adjuntos…) para no perderlo
 * al cambiar de ordenador o limpiar el navegador, y restaurarlo en otro
 * equipo. Cuando se conecte Supabase, los datos vivirán en la nube y esto
 * pasará a ser una exportación puntual, no la única red de seguridad.
 */

const PREFIJO = 'cabildo-'
/**
 * Lo que NUNCA viaja en una copia.
 *
 * No son datos de la hermandad, son estado de ESTE navegador, y restaurarlos
 * en otro sitio hace estropicios callados:
 *
 *   - `cabildo-demo-user`: quién está conectado. La copia son los datos, no
 *     la sesión.
 *   - `cabildo-hermandad-espejada`: de qué hermandad es la copia local. Si
 *     entra una copia hecha en otro equipo, al siguiente inicio de sesión no
 *     coincide con la hermandad de verdad y se borra TODO el espejo.
 *   - `cabildo-demo-modo`: la marca del modo demostración. Restaurar una copia
 *     hecha en modo demostración dejaba la aplicación sin hablar con Supabase
 *     y sin decirlo: la secretaría trabajaba contra un censo de mentira.
 */
const EXCLUIR = new Set(['cabildo-demo-user', 'cabildo-hermandad-espejada', 'cabildo-demo-modo'])

/**
 * Las tablas de la hermandad, tal como las nombra la base de datos.
 *
 * Con Supabase conectado la copia se hace de AQUÍ, no del navegador. El motivo
 * es que `localStorage` solo tiene lo que se haya ido mirando: quien entra,
 * pasa por Inicio y le da a «Descargar copia» se llevaba un archivo sin el
 * archivo documental, sin el inventario y sin los eventos, porque no había
 * abierto esos módulos. Y el archivo no decía en ninguna parte que le faltara
 * la mitad. Una copia de seguridad incompleta es peor que no tenerla, porque
 * se descubre el día que hace falta.
 *
 * Es la misma lista que lleva `hermandad_id` en `multi-hermandad.sql`, así que
 * las políticas de acceso ya se encargan de que solo salgan las filas propias.
 */
export const TABLAS_COPIA = [
  'hermanos', 'tramos', 'cuotas', 'papeletas', 'movimientos', 'incidencias',
  'enseres', 'documentos', 'comunicados', 'cuentas_sociales', 'permisos_cargo',
  'solicitudes_alta', 'conceptos_cuota', 'opciones_papeleta', 'catalogos',
  'eventos', 'personal', 'hermandad_settings', 'web_publica', 'mensajes_web',
] as const

/**
 * POR QUÉ COLUMNA SE ORDENA CADA TABLA AL TRAERLA POR PÁGINAS.
 *
 * Hace falta ordenar: sin `order`, dos páginas de la misma consulta pueden
 * traer filas repetidas y saltarse otras, porque Postgres no promete ningún
 * orden si no se le pide. Y una copia con filas repetidas y filas ausentes es
 * peor que una copia corta, porque parece completa.
 *
 * Casi todas las tablas tienen `id`, pero DOS NO LO TIENEN: `permisos_cargo`
 * va por `(hermandad_id, cargo, modulo_id)` y `catalogos` por `(clave, valor)`.
 * Pedirles `order('id')` da error, y en la copia un error se apunta como fallo
 * — y la copia automática se niega a subir una copia con fallos. O sea que
 * ordenar por `id` a ciegas dejaría a la hermandad SIN NINGUNA COPIA, cada
 * semana y en silencio, por arreglar lo de las mil filas.
 */
const ORDEN_DE_LA_TABLA: Record<string, string> = {
  permisos_cargo: 'cargo',
  catalogos: 'clave',
  // La clave primaria es la red («Facebook», «Instagram»…), no un id.
  cuentas_sociales: 'red',
}

export interface ArchivoCopia {
  id: string
  nombre: string
  tipo: string
  base64: string
}

export interface CopiaSeguridad {
  app: 'cabildo'
  version: number
  exportadoEl: string
  datos: Record<string, unknown>
  /**
   * Las filas tal cual las tiene la base de datos, una lista por tabla. Solo
   * está cuando la copia se hizo con Supabase conectado; es entonces la parte
   * de verdad y `datos` pasa a ser un añadido (ajustes de este navegador).
   */
  tablas?: Record<string, unknown[]>
  /** Qué tablas no se pudieron traer, y por qué. Una copia a medias LO DICE. */
  fallos?: string[]
  archivos: ArchivoCopia[]
}

function clavesGobergo(): string[] {
  const claves: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIJO) && !EXCLUIR.has(k)) claves.push(k)
  }
  return claves
}

function leerDatosLocales(): Record<string, unknown> {
  const datos: Record<string, unknown> = {}
  clavesGobergo().forEach((k) => {
    const raw = localStorage.getItem(k)
    if (raw === null) return
    try {
      datos[k] = JSON.parse(raw)
    } catch {
      datos[k] = raw
    }
  })
  return datos
}

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = String(reader.result)
      // "data:...;base64,XXXX" → nos quedamos solo con la parte base64.
      resolve(res.slice(res.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function base64AFile(a: ArchivoCopia): File {
  const binario = atob(a.base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return new File([bytes], a.nombre || a.id, { type: a.tipo || 'application/octet-stream' })
}

/** Construye el objeto de copia (datos + archivos adjuntos en base64). */
/**
 * Trae de la base de datos todas las filas de la hermandad, tabla por tabla.
 *
 * Si alguna falla NO se calla: se apunta en `fallos` y sale en pantalla. Una
 * copia de seguridad a la que le falta algo tiene que decirlo, porque el día
 * que se necesita ya es tarde para enterarse.
 */
async function traerTablas(): Promise<{ tablas: Record<string, unknown[]>; fallos: string[] }> {
  const tablas: Record<string, unknown[]> = {}
  const fallos: string[] = []
  if (!supabase) return { tablas, fallos }
  for (const nombre of TABLAS_COPIA) {
    try {
      /*
       * POR PÁGINAS, y aquí es donde más importa. `select('*')` trae mil filas
       * y no da error, así que una copia con el censo cortado a mil salía sin
       * un solo fallo apuntado — y `copiaAutomatica` solo se niega a subir las
       * que traen fallos. O sea: se subía cada semana una copia incompleta con
       * la marca de estar completa. Ver `lib/paginado.ts`.
       */
      const columna = ORDEN_DE_LA_TABLA[nombre] ?? 'id'
      const { data, error } = await traerTodasLasFilas<Record<string, unknown>>((desde, hasta) =>
        supabase!.from(nombre).select('*').order(columna).range(desde, hasta))
      if (error) fallos.push(`${nombre}: ${error.message}`)
      else tablas[nombre] = data ?? []
    } catch (e) {
      fallos.push(`${nombre}: ${e instanceof Error ? e.message : 'no se pudo consultar'}`)
    }
  }
  return { tablas, fallos }
}

export async function crearCopia(): Promise<CopiaSeguridad> {
  const archivos = await todosLosArchivos()
  const archivosB64 = await Promise.all(
    archivos.map(async ({ id, blob }) => ({
      id,
      nombre: blob instanceof File ? blob.name : id,
      tipo: blob.type || '',
      base64: await blobABase64(blob),
    })),
  )
  const deLaBase = isSupabaseConfigured ? await traerTablas() : null
  return {
    app: 'cabildo',
    version: VERSION_COPIA,
    exportadoEl: new Date().toISOString(),
    datos: leerDatosLocales(),
    ...(deLaBase ? { tablas: deLaBase.tablas, fallos: deLaBase.fallos } : {}),
    archivos: archivosB64,
  }
}

/** Valida que un JSON tenga forma de copia de Gobergo. */
export const VERSION_COPIA = 1

/**
 * Lo que se le enseña a la hermandad ANTES de dejarle sustituir todos sus
 * datos: de cuándo es la copia, cuánto trae y si la hizo una versión más nueva
 * de Gobergo.
 *
 * Hasta ahora la copia guardaba su versión y su fecha y **nadie las leía**: se
 * confirmaba a ciegas, antes siquiera de abrir el archivo, y una copia de hace
 * dos años se restauraba igual que la de ayer sin que nadie se enterara.
 */
export interface ResumenCopia {
  fecha: string | null
  /** Cuántas claves de datos trae (hermanos, cuotas, papeletas…). */
  bloques: number
  archivos: number
  /** La hizo una versión de Gobergo posterior a esta. */
  masNueva: boolean
}

export function resumirCopia(copia: CopiaSeguridad): ResumenCopia {
  const iso = copia.exportadoEl
  const d = iso ? new Date(iso) : null
  return {
    fecha: d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
      : null,
    bloques: Object.keys(copia.datos ?? {}).length,
    archivos: (copia.archivos ?? []).length,
    masNueva: typeof copia.version === 'number' && copia.version > VERSION_COPIA,
  }
}

export function esCopiaValida(obj: unknown): obj is CopiaSeguridad {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as CopiaSeguridad).app === 'cabildo' &&
    typeof (obj as CopiaSeguridad).datos === 'object'
  )
}

/**
 * ¿Se puede restaurar una copia en este momento?
 *
 * NO cuando hay base de datos conectada, y esto no es una limitación menor:
 * `restaurarCopia` escribe en el navegador, y con Supabase conectado el
 * navegador es solo un espejo. Al recargar, cada pantalla vuelve a leer de la
 * base de datos y sobreescribe lo restaurado.
 *
 * O sea: salía el aviso «esto sustituirá TODOS los datos actuales», se
 * aceptaba, decía «Copia restaurada. Recargando…», recargaba… y estaba todo
 * exactamente igual que antes. Un botón que dice que ha hecho algo y no lo ha
 * hecho es peor que no tenerlo: quien lo pulsa se queda tranquilo.
 *
 * Restaurar de verdad contra la base de datos (vaciar cada tabla y volver a
 * meter las filas, dentro de la hermandad y sin romper lo que apunta a lo que)
 * es una operación seria y va aparte. Mientras tanto, esto lo dice claro.
 */
export function sePuedeRestaurar(): boolean {
  return !isSupabaseConfigured
}

/**
 * Restaura una copia: borra los datos actuales de la hermandad y los sustituye
 * por los de la copia (localStorage + archivos adjuntos). No toca la sesión.
 *
 * Solo tiene sentido sin base de datos conectada; ver `sePuedeRestaurar`.
 */
export async function restaurarCopia(copia: CopiaSeguridad): Promise<void> {
  // Cinturón además del tirante: aunque el botón esté desactivado, quien
  // llegue aquí por otro camino no puede acabar creyendo que ha restaurado.
  if (!sePuedeRestaurar()) {
    throw new Error(
      'Con la base de datos conectada no se puede restaurar desde aquí: lo que se escribiera en este ' +
        'navegador lo volvería a sobreescribir la base de datos en cuanto se recargara. La copia sigue ' +
        'siendo válida; para volcarla hay que hacerlo contra la base de datos.',
    )
  }
  // Primero se prepara TODO en memoria y se guarda una copia de lo que hay.
  // Antes se borraba el almacenamiento y luego se escribía: si a mitad no
  // cabía (las copias llevan fotos y PDF en base64), quedaban los datos viejos
  // borrados y los nuevos a medias, con un mensaje que decía «no se pudo leer
  // el archivo», como si no hubiera pasado nada.
  const entradas = Object.entries(copia.datos)
    .filter(([k]) => k.startsWith(PREFIJO) && !EXCLUIR.has(k))
    .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)] as const)

  const anterior = clavesGobergo().map((k) => [k, localStorage.getItem(k)] as const)
  clavesGobergo().forEach((k) => localStorage.removeItem(k))
  try {
    entradas.forEach(([k, v]) => localStorage.setItem(k, v))
  } catch {
    // Marcha atrás: se deja el navegador como estaba y se avisa de verdad.
    clavesGobergo().forEach((k) => localStorage.removeItem(k))
    anterior.forEach(([k, v]) => { if (v !== null) localStorage.setItem(k, v) })
    throw new Error('La copia no cabe en este navegador (suele ser por las fotos y los PDF). No se ha cambiado nada.')
  }
  // Solo se vacía el almacén de adjuntos si la copia trae adjuntos: si no,
  // una copia antigua (sin esa sección) borraba todos los archivos guardados.
  if (copia.archivos && copia.archivos.length > 0) {
    await borrarTodosLosArchivos()
  }
  for (const a of copia.archivos ?? []) {
    try {
      await guardarArchivo(a.id, base64AFile(a))
    } catch {
      // Un adjunto que no se pueda restaurar no debe frenar el resto.
    }
  }
}
