import { useEffect, useState } from 'react'
import { traerTodasLasFilas } from './paginado'
import { leerPersistido } from './persistencia'
import { nuevoId } from './supabaseSync'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Hermano } from '../data/hermanos'

/**
 * Avisos al hermano cuando la secretaría cambia algo de sus datos. Cada cambio
 * genera un aviso (correo simulado hasta conectar el proveedor) que el hermano
 * ve en su área. Así el hermano se entera de cualquier modificación que haga la
 * hermandad sobre su ficha.
 */

/**
 * De qué va el aviso. Sirve para el icono, y para que el hermano pueda decir
 * qué quiere recibir y qué no.
 */
/**
 * Los tipos de aviso.
 *
 * `importante` es distinto de los demás Y NO SE PUEDE APAGAR: son los dos
 * avisos que el propio código llamaba imprescindibles y que, sin embargo, no
 * salían nunca:
 *
 *   - La BAJA en la hermandad. A partir de ese momento el hermano deja de
 *     tener acceso a su área, así que el aviso de dentro no lo va a leer
 *     jamás. El correo no es un extra: es la única forma de enterarse.
 *   - El CAMBIO DE CUENTA BANCARIA. Un cambio de IBAN que el hermano no ha
 *     pedido es lo primero que hay que poder detectar; avisarle es lo que
 *     convierte un error (o algo peor) en algo que se descubre el mismo día.
 *
 * Los dos iban por el interruptor `ficha`, que viene APAGADO de fábrica
 * porque los cambios de ficha son muchos y menores. Resultado: una hermandad
 * recién configurada no mandaba ninguno de los dos y no había forma de saberlo.
 */
export type TipoAviso = 'ficha' | 'comunicado' | 'cuota' | 'papeleta' | 'importante' | 'encargo'

export interface AvisoHermano {
  id: string
  hermanoId: string
  fecha: string
  texto: string
  leido: boolean
  /** Los avisos de antes no lo traían: se tratan como cambios de ficha. */
  tipo?: TipoAviso
  /** Titular del aviso, cuando lo tiene (el asunto de un comunicado). */
  titulo?: string
}

export const TIPOS_AVISO: { id: TipoAviso; nombre: string; icono: string; explica: string }[] = [
  { id: 'comunicado', nombre: 'Comunicados de la hermandad', icono: '📣', explica: 'Convocatorias de cabildo, cultos y avisos generales.' },
  { id: 'cuota', nombre: 'Mis cuotas', icono: '💶', explica: 'Cuando se emite un recibo o se da por pagado.' },
  { id: 'papeleta', nombre: 'Mi papeleta de sitio', icono: '🎟️', explica: 'Cuando te asignan sitio o cambia el estado de tu papeleta.' },
  { id: 'ficha', nombre: 'Cambios en mis datos', icono: '✉️', explica: 'Cuando la secretaría modifica algo de tu ficha.' },
  /*
   * Solo le sale a quien lleva algo: a un hermano de a pie nunca se le
   * encarga nada, así que este interruptor no le estorba — pero se deja
   * apagable como los demás, porque quien acepta un cargo ya sabe que le van
   * a mandar cosas y no hace falta obligarle a leerlas por correo. Que el
   * encargo esté sin hacer se ve igualmente en el panel de quien lo repartió.
   */
  { id: 'encargo', nombre: 'Lo que me encarga la junta', icono: '📋', explica: 'Cuando te reparten un post o una tarea de redes.' },
]

const CLAVE = 'cabildo-avisos-hermano'
const CLAVE_PREFS = 'cabildo-avisos-preferencias'

/** Qué avisos quiere recibir cada hermano. Lo que no está, se recibe. */
export type PreferenciasAvisos = Partial<Record<TipoAviso, boolean>>

/**
 * Qué avisos quiere este hermano.
 *
 * Se lee de la copia local, que es lo único que se puede hacer sin esperar: es
 * una función síncrona y la usa `destinatariosDe` en mitad de un envío. Lo que
 * la mantiene al día es `cargarPreferenciasDeLaBase`, que la trae de la ficha
 * del hermano en cuanto se abre la pantalla que la necesita.
 *
 * EL FALLO QUE ESTO ARREGLA: antes vivía SOLO en el navegador. El hermano
 * apagaba «Mis cuotas» en su móvil, y cuando la tesorera marcaba su recibo como
 * pagado desde el ordenador de la casa de hermandad se leían las preferencias
 * DE ESE ordenador, donde ese hermano no tiene ninguna. Se le escribía igual,
 * después de haberle ofrecido un interruptor para no recibirlo.
 */
export function getPreferenciasAvisos(hermanoId: string): PreferenciasAvisos {
  const todas = leerPersistido<Record<string, PreferenciasAvisos>>(CLAVE_PREFS, {})
  return todas[hermanoId] ?? {}
}

function guardarPrefsEnLocal(hermanoId: string, prefs: PreferenciasAvisos) {
  const todas = leerPersistido<Record<string, PreferenciasAvisos>>(CLAVE_PREFS, {})
  localStorage.setItem(CLAVE_PREFS, JSON.stringify({ ...todas, [hermanoId]: prefs }))
}

/**
 * Guarda lo que el hermano elige. En su ficha, para que lo vea todo el mundo.
 *
 * DEVUELVE SI HA SALIDO, y antes no.
 *
 * `supabase-js` no lanza excepción cuando la base rechaza una escritura:
 * devuelve `{ error }` y sigue. Aquí ese error no se miraba y la promesa ni se
 * esperaba, así que un rechazo de permisos pasaba en silencio: el interruptor
 * se quedaba apagado en SU navegador, la copia de la hermandad seguía diciendo
 * que sí, y al hermano le seguían llegando los correos que acababa de apagar
 * —convencido de haberlos apagado—. Es la peor forma de fallar de un
 * interruptor: la que hace pensar que funcionó.
 */
export async function savePreferenciasAvisos(
  hermanoId: string,
  prefs: PreferenciasAvisos,
): Promise<{ ok: boolean; error?: string }> {
  guardarPrefsEnLocal(hermanoId, prefs)
  if (!isSupabaseConfigured || !supabase) return { ok: true }
  const { error } = await supabase.from('hermanos').update({ avisos_preferencias: prefs }).eq('id', hermanoId)
  if (error) {
    console.error('No se pudieron guardar las preferencias de avisos:', error.message)
    return {
      ok: false,
      error: 'No se ha podido guardar en la base de datos, así que puede que te sigan '
        + 'llegando. Inténtalo otra vez en un momento; si sigue igual, dilo en secretaría.',
    }
  }
  return { ok: true }
}

/**
 * Trae de la base de datos las preferencias de toda esta gente y las deja en la
 * copia local, para que `getPreferenciasAvisos` las encuentre.
 *
 * Se llama desde las pantallas que van a mandar avisos (Cuotas, Papeletas,
 * Comunicados, Hermanos) al montar: así la tesorera, aunque nunca haya abierto
 * el móvil de nadie, respeta lo que cada uno apagó.
 */
export async function cargarPreferenciasDeLaBase(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return
  // Por páginas, que son tantas filas como hermanos. Ver `lib/paginado.ts`.
  const { data, error } = await traerTodasLasFilas<{ id: string; avisos_preferencias: unknown }>((desde, hasta) =>
    supabase!.from('hermanos').select('id, avisos_preferencias').order('id').range(desde, hasta))
  if (error || !data) return
  const todas = leerPersistido<Record<string, PreferenciasAvisos>>(CLAVE_PREFS, {})
  for (const fila of data as { id: string; avisos_preferencias: PreferenciasAvisos | null }[]) {
    if (fila.avisos_preferencias) todas[fila.id] = fila.avisos_preferencias
  }
  try {
    localStorage.setItem(CLAVE_PREFS, JSON.stringify(todas))
  } catch {
    // Sin espacio: se seguirá con lo que hubiera. No es motivo para romper nada.
  }
}

/** ¿Quiere este hermano este tipo de aviso? Por defecto, sí. */
export function quiereAviso(prefs: PreferenciasAvisos, tipo: TipoAviso | undefined): boolean {
  // Los importantes tampoco los puede apagar el hermano: van sobre su propia
  // cuenta bancaria y sobre su permanencia en la hermandad. No es
  // publicidad de la que uno se da de baja.
  if (tipo === 'importante') return true
  return prefs[tipo ?? 'ficha'] !== false
}

function hoy(): string {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function getAvisosHermano(): AvisoHermano[] {
  return leerPersistido<AvisoHermano[]>(CLAVE, [])
}

function saveAvisos(lista: AvisoHermano[]) {
  localStorage.setItem(CLAVE, JSON.stringify(lista))
}

/**
 * EL BUZÓN DEL HERMANO ESTABA EN EL ORDENADOR DE LA SECRETARÍA.
 *
 * La tabla `avisos_hermano` existe desde el principio, con sus políticas: el
 * hermano lee los suyos y puede marcarlos leídos, y el personal de la
 * hermandad los escribe. Lo que faltaba era que alguien la usara. Todos los
 * avisos se guardaban en `localStorage` Y EN NINGÚN OTRO SITIO.
 *
 * Así que: la secretaria da un recibo por pagado desde su ordenador, se
 * escribe «Tu recibo de Cuota anual queda pagado» en SU navegador, y el
 * hermano abre su área en el móvil y no tiene nada. La campana con el punto
 * rojo, el buzón, los avisos de papeleta, los de cuota, el de la baja: todo
 * vacío para siempre, sin un error por medio.
 *
 * Se escribe en los DOS sitios a propósito:
 *
 *   · En la base, que es de donde lo lee el hermano.
 *   · Y en la copia local, para que la pantalla de quien acaba de hacer la
 *     acción lo enseñe ya, sin esperar a la red — y para que el modo
 *     demostración, que no tiene base, siga funcionando igual.
 *
 * El envío a la base NO se espera (`void`): quien llama está en mitad de dar
 * un recibo por pagado y el aviso es un acompañamiento, no la operación. Si
 * falla, se deja dicho en la consola y se sigue: perder el aviso es malo,
 * bloquear el cobro por él sería peor.
 */
function mandarALaBase(filas: { hermano_id: string; texto: string; tipo: TipoAviso; titulo?: string }[]) {
  if (!isSupabaseConfigured || !supabase || filas.length === 0) return
  /*
   * `hermandad_id` no se manda: la columna lleva `default hermandad_actual()`,
   * igual que en el resto de tablas. Y `fecha` tampoco, que su `default` es
   * `now()` — la hora del servidor, que es la buena, y no la del ordenador de
   * quien esté delante.
   */
  void supabase
    .from('avisos_hermano')
    .insert(filas.map((f) => ({
      hermano_id: f.hermano_id,
      texto: f.texto,
      tipo: f.tipo,
      titulo: f.titulo ?? null,
    })))
    .then(({ error }) => {
      // `supabase-js` no lanza excepción cuando la base rechaza: devuelve
      // `{ error }` y sigue. Sin mirarlo, esto volvería a fallar en silencio.
      if (error) console.error('No se pudo guardar el aviso al hermano:', error.message)
    })
}

/** Registra un aviso para un hermano (correo simulado). */
export function agregarAvisoHermano(hermanoId: string, texto: string, tipo: TipoAviso = 'ficha', titulo?: string) {
  const nuevo: AvisoHermano = { id: nuevoId(), hermanoId, fecha: hoy(), texto, leido: false, tipo, titulo }
  saveAvisos([nuevo, ...getAvisosHermano()])
  mandarALaBase([{ hermano_id: hermanoId, texto, tipo, titulo }])
}

/** El mismo aviso para muchos hermanos de una vez (un comunicado). */
export function agregarAvisoAVarios(hermanoIds: string[], texto: string, tipo: TipoAviso, titulo?: string) {
  if (hermanoIds.length === 0) return
  const fecha = hoy()
  const nuevos: AvisoHermano[] = hermanoIds.map((hermanoId) => ({
    id: nuevoId(), hermanoId, fecha, texto, leido: false, tipo, titulo,
  }))
  saveAvisos([...nuevos, ...getAvisosHermano()])
  /*
   * De doscientos en doscientos, como el resto de escrituras en bloque: un
   * comunicado a ochocientos hermanos son ochocientas filas, y un cuerpo de
   * varios megas se queda en el camino. Ver `supabaseSync.ts`.
   */
  for (let i = 0; i < hermanoIds.length; i += 200) {
    mandarALaBase(hermanoIds.slice(i, i + 200).map((hermano_id) => ({ hermano_id, texto, tipo, titulo })))
  }
}

/**
 * Los avisos de ESTE hermano, traídos de la base.
 *
 * Se pide por su id y no «todos»: las políticas ya le acotan a los suyos, pero
 * pedirlos explícitamente hace que el mismo hook valga en el panel —donde la
 * secretaría sí ve los de todos— sin traerse el buzón de la hermandad entera.
 */
async function traerAvisosDeLaBase(hermanoId: string): Promise<AvisoHermano[] | null> {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await traerTodasLasFilas<Record<string, unknown>>((desde, hasta) =>
    supabase!.from('avisos_hermano').select('*').eq('hermano_id', hermanoId)
      .order('fecha', { ascending: false }).range(desde, hasta))
  if (error || !data) return null
  return data.map((r) => ({
    id: r.id as string,
    hermanoId: r.hermano_id as string,
    // La fecha viene como marca de tiempo y se enseña como en el resto de la
    // aplicación: «03 feb 2026».
    fecha: new Date(r.fecha as string).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    }),
    texto: (r.texto as string) ?? '',
    leido: Boolean(r.leido),
    tipo: (r.tipo as TipoAviso | null) ?? 'ficha',
    titulo: (r.titulo as string | null) ?? undefined,
  }))
}

/** Marca uno o todos como leídos en la base. Es lo único que el hermano toca. */
function marcarEnLaBase(hermanoId: string, ids: string[] | null, leido: boolean) {
  if (!isSupabaseConfigured || !supabase) return
  const q = supabase.from('avisos_hermano').update({ leido }).eq('hermano_id', hermanoId)
  void (ids ? q.in('id', ids) : q).then(({ error }) => {
    if (error) console.error('No se pudo marcar el aviso como leído:', error.message)
  })
}

/** Etiquetas legibles de los campos que el hermano vería como "suyos". */
const CAMPOS_AVISABLES: { campo: keyof Hermano; etiqueta: string }[] = [
  { campo: 'nombre', etiqueta: 'nombre' },
  { campo: 'email', etiqueta: 'correo electrónico' },
  { campo: 'telefono', etiqueta: 'teléfono' },
  { campo: 'direccion', etiqueta: 'dirección' },
  { campo: 'iban', etiqueta: 'cuenta bancaria' },
  { campo: 'estado', etiqueta: 'estado como hermano/a' },
]

/**
 * Compara la ficha anterior con la nueva y, si cambió algún dato del hermano,
 * le genera un aviso describiendo qué se cambió.
 *
 * Devuelve el texto del aviso, o `null` si no había nada que avisar. Devuelve
 * el texto y no un sí/no para que quien llama pueda mandar además el mismo
 * mensaje por correo sin volver a componerlo (y sin que este módulo tenga que
 * saber nada de correos, que acabaría en dos módulos importándose el uno al
 * otro). Como `null` es falso y un texto es verdadero, quien solo quiera saber
 * si hubo aviso puede seguir usándolo en un `if` igual que antes.
 */
export function avisarCambiosHermano(anterior: Hermano, nuevo: Hermano): string | null {
  const cambiados = CAMPOS_AVISABLES.filter(({ campo }) => (anterior[campo] ?? '') !== (nuevo[campo] ?? ''))
  if (cambiados.length === 0) return null
  const lista = cambiados.map((c) => c.etiqueta)
  const enumerado =
    lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`
  const texto = `La secretaría ha actualizado tu ${enumerado}.`
  agregarAvisoHermano(nuevo.id, texto)
  return texto
}

/** Hook reactivo con los avisos de un hermano (más nuevos primero). */
export function useAvisosHermano(hermanoId: string | null): {
  avisos: AvisoHermano[]
  sinLeer: number
  marcarLeidos: () => void
  marcarLeido: (id: string, leido: boolean) => void
  borrar: (id: string) => void
  preferencias: PreferenciasAvisos
  cambiarPreferencia: (tipo: TipoAviso, quiere: boolean) => void
  /** Por qué no se pudo guardar el último cambio, si es que no se pudo. */
  errorPreferencias: string | null
} {
  const [todos, setTodos] = useState<AvisoHermano[]>(() => getAvisosHermano())
  const [preferencias, setPreferencias] = useState<PreferenciasAvisos>(() =>
    hermanoId ? getPreferenciasAvisos(hermanoId) : {},
  )
  const [errorPrefs, setErrorPrefs] = useState<string | null>(null)
  useEffect(() => {
    const sync = () => {
      setTodos(getAvisosHermano())
      if (hermanoId) setPreferencias(getPreferenciasAvisos(hermanoId))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [hermanoId])

  /*
   * Y LOS DE LA BASE, que son los que le ha mandado la hermandad.
   *
   * Lo que hubiera en la copia de este navegador solo son los que se
   * escribieron DESDE AQUÍ. En el móvil del hermano eso es siempre nada, que
   * es por lo que su buzón salía vacío: la secretaria daba el recibo por
   * pagado en su ordenador y el aviso se quedaba allí.
   *
   * Los de la base MANDAN sobre la copia local, y se conservan los locales que
   * la base todavía no conoce —el que se acaba de escribir hace medio
   * segundo—, para que la pantalla de quien hizo la acción no parpadee.
   */
  useEffect(() => {
    if (!hermanoId) return
    let cancelado = false
    void traerAvisosDeLaBase(hermanoId).then((deLaBase) => {
      if (cancelado || !deLaBase) return
      setTodos((locales) => {
        const suyosEnLaBase = new Set(deLaBase.map((a) => a.texto + '|' + a.fecha))
        const deOtros = locales.filter((a) => a.hermanoId !== hermanoId)
        const recienEscritos = locales.filter(
          (a) => a.hermanoId === hermanoId && !suyosEnLaBase.has(a.texto + '|' + a.fecha),
        )
        return [...recienEscritos, ...deLaBase, ...deOtros]
      })
    })
    return () => { cancelado = true }
  }, [hermanoId])
  useEffect(() => {
    setPreferencias(hermanoId ? getPreferenciasAvisos(hermanoId) : {})
  }, [hermanoId])

  // Se filtra al enseñarlos y no al crearlos: si el hermano vuelve a activar un
  // tipo, recupera lo que le habían mandado en vez de encontrarse el hueco.
  const avisos = hermanoId
    ? todos.filter((a) => a.hermanoId === hermanoId && quiereAviso(preferencias, a.tipo))
    : []
  const sinLeer = avisos.filter((a) => !a.leido).length

  function guardar(actualizados: AvisoHermano[]) {
    saveAvisos(actualizados)
    setTodos(actualizados)
  }


  /*
   * Leer y borrar tocan LOS DOS sitios. Si solo se tocara el local, el punto
   * rojo de la campana volvería a aparecer en cuanto el hermano recargara —o
   * entrara desde otro teléfono—, que es la forma más molesta de que un aviso
   * «no se pueda quitar de encima».
   *
   * `guardar` actualiza la lista de la pantalla; los de la base se cambian
   * aparte, porque en la copia local hay avisos de otros hermanos (los que
   * escribió esta misma secretaría) que no le tocan a nadie más.
   */
  function marcarLeidos() {
    if (!hermanoId) return
    guardar(todos.map((a) => (a.hermanoId === hermanoId ? { ...a, leido: true } : a)))
    marcarEnLaBase(hermanoId, null, true)
  }

  function marcarLeido(id: string, leido: boolean) {
    guardar(todos.map((a) => (a.id === id ? { ...a, leido } : a)))
    if (hermanoId) marcarEnLaBase(hermanoId, [id], leido)
  }

  /*
   * BORRAR ES DARLO POR LEÍDO, no quitarlo de la base.
   *
   * El hermano no tiene permiso para borrar —su política solo le deja marcar
   * `leido`— y es lo correcto: un aviso es la constancia de que se le comunicó
   * algo. La baja, el cambio de cuenta bancaria y el recibo cobrado son cosas
   * que a la hermandad le interesa poder demostrar que se dijeron. Se le quita
   * de la vista y se queda registrado.
   */
  function borrar(id: string) {
    guardar(todos.filter((a) => a.id !== id))
    if (hermanoId) marcarEnLaBase(hermanoId, [id], true)
  }

  /**
   * Cambia un interruptor y SE ESPERA A SABER SI SE HA GUARDADO.
   *
   * Si la base lo rechaza, el interruptor VUELVE a como estaba y se dice por
   * qué. Dejarlo apagado mientras los correos siguen llegando es peor que no
   * haber ofrecido el interruptor: la persona cree que ya está resuelto y no
   * vuelve a intentarlo ni lo dice en secretaría.
   */
  async function cambiarPreferencia(tipo: TipoAviso, quiere: boolean) {
    if (!hermanoId) return
    const antes = preferencias
    const siguientes = { ...preferencias, [tipo]: quiere }
    setPreferencias(siguientes)
    setErrorPrefs(null)
    const r = await savePreferenciasAvisos(hermanoId, siguientes)
    if (!r.ok) {
      setPreferencias(antes)
      guardarPrefsEnLocal(hermanoId, antes)
      setErrorPrefs(r.error ?? 'No se ha podido guardar.')
    }
  }

  return {
    avisos, sinLeer, marcarLeidos, marcarLeido, borrar,
    preferencias, cambiarPreferencia, errorPreferencias: errorPrefs,
  }
}
