import { useEffect, useState } from 'react'
import { leerPersistido } from './persistencia'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Suscripción de la hermandad a la app. Sin suscripción activa, el panel queda
 * bloqueado (ver AppShell). Ahora hay varios «packs»: cada uno da acceso a un
 * conjunto de capacidades (gestión interna, web pública, extras premium). El
 * cobro real (Stripe) se conectará más adelante; por ahora «Suscribirse»
 * activa la cuenta sin cobrar, para poder probar el flujo.
 *
 * Precios PROVISIONALES (inventados) hasta cerrar la tarifa definitiva.
 */

/** Capacidades que puede desbloquear un pack. */
export type Capacidad = 'gestion' | 'web' | 'premium'

export type PackId = 'gestion' | 'web' | 'completo' | 'todo'
export type Periodo = 'mensual' | 'anual'

export interface Pack {
  id: PackId
  nombre: string
  resumen: string
  /** Precio en euros (número, sin símbolo) para poder formatear según el periodo. */
  precioMensual: number
  precioAnual: number
  capacidades: Capacidad[]
  incluye: string[]
  destacado?: boolean
}

export const PACKS: Pack[] = [
  {
    id: 'gestion',
    nombre: 'Gestión',
    resumen: 'Solo el panel de gestión de la hermandad.',
    precioMensual: 15,
    precioAnual: 150,
    capacidades: ['gestion'],
    incluye: [
      'Censo de hermanos y etiquetas',
      'Cuotas, recibos y remesas',
      'Papeletas de sitio y cortejo',
      'Tesorería e inventario',
    ],
  },
  {
    id: 'web',
    nombre: 'Web',
    resumen: 'Solo la web pública de la hermandad.',
    precioMensual: 9,
    precioAnual: 90,
    capacidades: ['web'],
    incluye: [
      'Web pública propia (secciones, cultos, actualidad)',
      'Boletines y páginas informativas',
      'Enlace público para compartir',
      'Formulario de contacto',
    ],
  },
  {
    id: 'completo',
    nombre: 'Web + Gestión',
    resumen: 'El panel de gestión y la web pública, juntos.',
    precioMensual: 20,
    precioAnual: 200,
    capacidades: ['gestion', 'web'],
    incluye: [
      'Todo lo de Gestión',
      'Todo lo de Web',
      'Los datos de la gestión alimentan la web',
      'Portal del hermano incluido',
    ],
    destacado: true,
  },
  {
    id: 'todo',
    nombre: 'Todo',
    resumen: 'Todo incluido, con los extras premium.',
    precioMensual: 29,
    precioAnual: 290,
    capacidades: ['gestion', 'web', 'premium'],
    incluye: [
      'Todo lo de Web + Gestión',
      'Dominio personalizado propio',
      'Comunicados multicanal (email, SMS, WhatsApp)',
      'Informes avanzados y soporte prioritario',
    ],
  },
]

export function packDe(id: PackId | null): Pack | null {
  return id ? PACKS.find((p) => p.id === id) ?? null : null
}

export function precioPack(pack: Pack, periodo: Periodo): string {
  return periodo === 'anual' ? `${pack.precioAnual} €` : `${pack.precioMensual} €`
}

export function etiquetaPeriodo(periodo: Periodo): string {
  return periodo === 'anual' ? '/año' : '/mes'
}

export interface Suscripcion {
  activa: boolean
  pack: PackId | null
  periodo: Periodo | null
  desde: string | null
  /**
   * HASTA CUÁNDO ESTÁ PAGADA. La rellena el webhook con la fecha que manda
   * Stripe en cada factura cobrada.
   *
   * Estuvo mucho tiempo en la base SIN QUE NADIE LA ESCRIBIERA —el webhook le
   * pasaba siempre `null`— y sin que nadie la leyera. Un dato que parece
   * significar algo y no significa nada es peor que no tenerlo: el día que
   * alguien lo mire para decidir, decidirá sobre vacío.
   *
   * NO ES EL MURO DE PAGO. El muro sigue siendo `activa`, y a propósito: si el
   * acceso dependiera de esta fecha, un webhook que no llegara un día dejaría
   * a la hermandad fuera sin deber nada.
   */
  hasta: string | null
  /**
   * EL DÍA QUE FALLÓ EL COBRO, o `null` —que es lo normal—.
   *
   * Sirve para AVISAR, no para cortar. Stripe reintenta durante semanas y casi
   * siempre acaba cobrando; lo que hacía falta es que la hermandad se entere
   * mientras hay tiempo de cambiar la tarjeta, en vez de quedarse fuera de
   * golpe el día que Stripe se rinde. Ver `renovacion-y-fallo-de-cobro.sql`.
   */
  pagoFallidoEl: string | null
}

export const CLAVE_SUSCRIPCION = 'cabildo-suscripcion'

export const SUSCRIPCION_INICIAL: Suscripcion = {
  activa: false, pack: null, periodo: null, desde: null, hasta: null, pagoFallidoEl: null,
}

/**
 * ¿Este navegador SABE algo de la suscripción de la hermandad?
 *
 * No es lo mismo «no tiene contratada la web» que «no me consta»: la
 * suscripción vive en el navegador de quien la contrató, así que un visitante
 * de fuera, o un hermano en su móvil, no tiene ni la clave. Confundir las dos
 * cosas es lo que hacía que la web pública no la pudiera ver nadie que no
 * fuera la propia hermandad.
 *
 * Quien no tiene la clave no es que no haya pagado: es que no le consta. Y a
 * quien no le consta no se le puede cerrar la puerta.
 */
export function constaLaSuscripcion(): boolean {
  try {
    return localStorage.getItem(CLAVE_SUSCRIPCION) !== null
  } catch {
    // Sin localStorage (navegación privada de algunos navegadores, o un
    // servidor sin ventana). Tampoco consta.
    return false
  }
}

/**
 * Lee la suscripción, migrando el formato antiguo (que guardaba `plan`:
 * 'mensual' | 'anual' sin packs) al nuevo: una suscripción antigua activa pasa
 * a considerarse el pack «Todo», para no dejar a nadie fuera tras el cambio.
 */
/**
 * La suscripción de la hermandad, traída de la base de datos.
 *
 * POR QUÉ NO BASTA CON `getSuscripcion()`. Eso lee `localStorage`, o sea el
 * navegador de quien mira. Dos problemas de golpe:
 *
 *   · La secretaria entra desde el ordenador de la casa de hermandad y se
 *     encuentra el muro de pago, aunque la hermandad esté al corriente: en SU
 *     navegador la clave no existe.
 *   · Y desde la consola del navegador, dos líneas bastan para ponerse el pack
 *     «Todo» sin pagar.
 *
 * Esta la escribe solo el servidor. Se deja copia local para que la pantalla
 * no parpadee mientras llega, pero la que manda es esta.
 */
export async function cargarSuscripcionDeLaBase(): Promise<Suscripcion | null> {
  if (!isSupabaseConfigured || !supabase) return null
  try {
    const { data, error } = await supabase.rpc('mi_suscripcion')
    const fila = (data as Record<string, unknown>[] | null)?.[0]
    if (error || !fila) return null
    const s: Suscripcion = {
      activa: fila.activa === true,
      pack: (fila.pack as PackId | null) ?? null,
      periodo: (fila.periodo as Periodo | null) ?? null,
      desde: (fila.desde as string | null) ?? null,
      /*
       * Estas dos las devuelve `mi_suscripcion()`. En una base que todavía no
       * tiene la pieza de la renovación no vienen, y `?? null` las deja
       * vacías: el aviso simplemente no sale, que es lo correcto mientras no
       * haya nada que decir. (El aviso de esquema atrasado va por su cuenta.)
       */
      hasta: (fila.hasta as string | null) ?? null,
      pagoFallidoEl: (fila.pago_fallido_el as string | null) ?? null,
    }
    try {
      localStorage.setItem(CLAVE_SUSCRIPCION, JSON.stringify(s))
    } catch {
      // Sin localStorage se sigue: ya está en memoria.
    }
    return s
  } catch {
    return null
  }
}

/**
 * Deja la suscripción activada EN LA HERMANDAD.
 *
 * Contra `activar_suscripcion_propia`, que solo puede llamar el titular y solo
 * para la suya. La otra —`activar_suscripcion`— está revocada para
 * `authenticated` a propósito: es la que llamará el webhook de Stripe con la
 * clave de servicio, y desde el navegador no se puede tocar.
 */
export async function guardarSuscripcionEnLaBase(
  pack: PackId,
  periodo: Periodo,
): Promise<{ ok: boolean; error?: string }> {
  // Sin base de datos —modo demostración— no hay nada que guardar y la copia
  // local es la buena: no es un fallo, es que no hay a dónde mandarlo.
  if (!isSupabaseConfigured || !supabase) return { ok: true }
  try {
    const { error } = await supabase.rpc('activar_suscripcion_propia', {
      p_pack: pack ?? 'todo',
      p_periodo: periodo ?? 'mensual',
    })
    if (!error) return { ok: true }
    console.error('No se pudo activar la suscripción:', error.message)
    return {
      ok: false,
      error: 'Se ha activado en este ordenador, pero no se ha podido guardar en la hermandad: '
        + 'desde otro equipo seguirá saliendo la pantalla de suscripción. Vuelve a intentarlo '
        + 'en un momento; si sigue igual, hay que ejecutar «activar-la-suscripcion.sql» en Supabase.',
    }
  } catch {
    return { ok: false, error: 'No se ha podido conectar para guardar la suscripción.' }
  }
}

/** La da de baja en la hermandad. La fila se queda: cuándo entró y cuándo salió. */
export async function cancelarSuscripcionEnLaBase(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return
  try {
    const { error } = await supabase.rpc('cancelar_suscripcion_propia')
    if (error) console.error('No se pudo cancelar la suscripción:', error.message)
  } catch {
    // Sin conexión: queda cancelada aquí y se volverá a leer de la base.
  }
}

export function getSuscripcion(): Suscripcion {
  const raw = leerPersistido<Record<string, unknown>>(CLAVE_SUSCRIPCION, SUSCRIPCION_INICIAL as unknown as Record<string, unknown>)
  const activa = Boolean(raw.activa)
  if (!activa) return SUSCRIPCION_INICIAL
  // Formato nuevo
  if (raw.pack && PACKS.some((p) => p.id === raw.pack)) {
    return {
      activa: true,
      pack: raw.pack as PackId,
      periodo: (raw.periodo as Periodo) ?? 'mensual',
      desde: (raw.desde as string) ?? null,
      hasta: (raw.hasta as string) ?? null,
      pagoFallidoEl: (raw.pagoFallidoEl as string) ?? null,
    }
  }
  // Formato antiguo ({ activa, plan: 'mensual'|'anual' }) → pack «Todo»
  if (raw.plan === 'anual' || raw.plan === 'mensual') {
    return {
      activa: true, pack: 'todo', periodo: raw.plan, desde: (raw.desde as string) ?? null,
      hasta: null, pagoFallidoEl: null,
    }
  }
  // Suscripción con un pack que no reconocemos: se trata como NO activa. Antes
  // se concedía «Todo» (todas las capacidades) ante cualquier dato inesperado.
  return SUSCRIPCION_INICIAL
}

/**
 * EL AVISO DE QUE LA TARJETA HA FALLADO, en castellano y listo para pintar.
 *
 * ============================================================================
 * POR QUÉ ESTE AVISO EXISTE
 * ============================================================================
 *
 * Porque el fallo que arregla no era «acceso gratis»: Stripe reintenta unas
 * semanas y, si no cobra, cancela y la hermandad se queda fuera. Eso ya estaba
 * atendido. Lo que NO estaba es que alguien se lo dijera. La hermandad se
 * enteraba el día que se quedaba fuera de golpe, sin un solo aviso previo, y
 * si tocaba en marzo se enteraba en la peor semana del año.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ NO ES UN CORREO
 * ----------------------------------------------------------------------------
 *
 * Porque el correo de verdad depende de tener un dominio verificado, y hasta
 * entonces lo que se manda acaba en la carpeta de correo no deseado. Un aviso
 * que no se lee es peor que ninguno: da la sensación de haber avisado. Dentro
 * de la aplicación se ve seguro, porque para trabajar hay que entrar.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ SE DICE CUÁNTOS DÍAS LLEVA
 * ----------------------------------------------------------------------------
 *
 * Porque «tu tarjeta ha fallado» dicho el día 1 y dicho el día 18 son dos
 * situaciones distintas y piden dos reacciones distintas, y el texto tiene que
 * notarlo. Si no, el aviso del día 18 se lee con la misma calma que el del día
 * 1 — y ese es el que ya no admite calma.
 *
 * Devuelve `null` cuando no hay nada que decir, que es el caso de siempre.
 *
 * @param hoyISO Se pasa desde fuera para poder probarlo con una fecha fija. Sin
 *   él habría que esperar tres semanas para comprobar el segundo texto.
 */
export function avisoDePagoFallido(
  s: Suscripcion,
  hoyISO?: string,
): { titulo: string; texto: string; urgente: boolean } | null {
  if (!s.pagoFallidoEl) return null
  const dias = diasDesde(s.pagoFallidoEl, hoyISO)
  /*
   * A partir de aquí se da por urgente. Stripe deja de reintentar alrededor de
   * las tres semanas; a los catorce días quedan pocos intentos y el aviso pasa
   * de «cámbiala cuando puedas» a «cámbiala hoy».
   *
   * El número es DELIBERADAMENTE prudente: si Stripe cambiara su calendario,
   * equivocarse por avisar pronto no le cuesta nada a nadie, y equivocarse por
   * avisar tarde deja a una hermandad fuera.
   */
  const urgente = dias >= 14
  const cuanto =
    dias <= 0 ? 'hoy'
      : dias === 1 ? 'ayer'
        : `hace ${dias} días`
  return {
    titulo: urgente
      ? 'Tu suscripción está a punto de cancelarse'
      : 'No hemos podido cobrar tu suscripción',
    texto:
      `El cobro falló ${cuanto} —lo normal es una tarjeta caducada o un banco que rechazó el cargo—. `
      + 'No se ha bloqueado nada y podéis seguir trabajando con normalidad. '
      + (urgente
        ? 'Pero quedan pocos intentos: si el siguiente tampoco entra, la suscripción se cancelará y el panel se cerrará. '
        : 'Se volverá a intentar solo durante unos días. ')
      + 'Actualiza la tarjeta desde Configuración → Suscripción y el aviso desaparecerá en cuanto entre el cobro.',
    urgente,
  }
}

/**
 * Días completos entre una fecha «YYYY-MM-DD» y hoy. Nunca negativo.
 *
 * Se parte la cadena a mano en vez de `new Date(iso)`, porque esa forma
 * interpreta «2026-03-01» como medianoche EN UTC y en España eso es el 28 de
 * febrero por la noche: el aviso diría «ayer» el mismo día que ha fallado.
 */
function diasDesde(iso: string, hoyISO?: string): number {
  const aUTC = (t: string) => {
    const [a, m, d] = t.slice(0, 10).split('-').map(Number)
    return Date.UTC(a, (m ?? 1) - 1, d ?? 1)
  }
  const hoy = hoyISO ? aUTC(hoyISO) : (() => {
    const n = new Date()
    return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())
  })()
  const dif = Math.round((hoy - aUTC(iso)) / 86_400_000)
  return Number.isFinite(dif) && dif > 0 ? dif : 0
}

export function saveSuscripcion(s: Suscripcion) {
  localStorage.setItem(CLAVE_SUSCRIPCION, JSON.stringify(s))
}

/** Capacidades activas de una suscripción (vacío si no está activa). */
export function capacidadesDe(s: Suscripcion): Capacidad[] {
  if (!s.activa) return []
  return packDe(s.pack)?.capacidades ?? []
}

export function tieneCapacidad(s: Suscripcion, cap: Capacidad): boolean {
  return capacidadesDe(s).includes(cap)
}

/**
 * Capacidad que exige cada módulo del panel. Los módulos no listados (inicio,
 * personal, configuración, seguridad) no exigen ninguna: son de la propia
 * cuenta, y hacen falta con cualquier pack (p. ej. para dar acceso a quien
 * edita la web).
 */
export const CAPACIDAD_DE_MODULO: Record<string, Capacidad> = {
  hermanos: 'gestion',
  cortejo: 'gestion',
  cuotas: 'gestion',
  papeletas: 'gestion',
  tesoreria: 'gestion',
  inventario: 'gestion',
  archivo: 'gestion',
  eventos: 'gestion',
  comunicados: 'gestion',
  informes: 'gestion',
  web: 'web',
}

/** ¿La suscripción da acceso a este módulo? (los no restringidos, siempre.) */
export function moduloPermitidoPorPack(s: Suscripcion, modulo: string | undefined | null): boolean {
  if (!modulo) return true
  const cap = CAPACIDAD_DE_MODULO[modulo]
  if (!cap) return true
  return tieneCapacidad(s, cap)
}

/** Hook con la suscripción y acciones para activarla o cancelarla. */
export function useSuscripcion() {
  const [suscripcion, setSuscripcion] = useState<Suscripcion>(() => getSuscripcion())

  useEffect(() => {
    function sincronizar() {
      setSuscripcion(getSuscripcion())
    }
    window.addEventListener('storage', sincronizar)
    // Y la de la hermandad, que es la que manda: sin esto, cada miembro de la
    // junta veía la suscripción de SU navegador y quien entraba por primera
    // vez desde otro ordenador se topaba con el muro de pago.
    void cargarSuscripcionDeLaBase().then((r) => {
      if (r) setSuscripcion(r)
    })
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  /*
   * ACTIVAR ESCRIBE EN LA BASE, no en este navegador.
   *
   * Escribía solo en `localStorage`, y eso no aguantaba ni una recarga: el
   * efecto de arriba pregunta a la base al montar, la base contestaba «no hay
   * suscripción» y esa respuesta pisaba la copia local. Así que el Hermano
   * Mayor activaba, entraba, recargaba… y le volvía a salir el muro de pago.
   * Y desde el ordenador de la secretaria no había entrado nunca.
   *
   * Se guarda primero en local para que la pantalla pase YA —es un botón, y
   * quien lo pulsa quiere entrar— y se manda a la base detrás. Si la base lo
   * rechaza se dice, en vez de dejar a la hermandad creyendo que está dada de
   * alta hasta la siguiente recarga.
   */
  const [error, setError] = useState<string | null>(null)

  async function activar(pack: PackId, periodo: Periodo, fechaISO: string) {
    const s: Suscripcion = {
      activa: true, pack, periodo, desde: fechaISO, hasta: null, pagoFallidoEl: null,
    }
    setSuscripcion(s)
    saveSuscripcion(s)
    setError(null)
    const r = await guardarSuscripcionEnLaBase(pack, periodo)
    if (!r.ok) setError(r.error ?? 'No se ha podido guardar la suscripción.')
  }

  async function cancelar() {
    setSuscripcion(SUSCRIPCION_INICIAL)
    saveSuscripcion(SUSCRIPCION_INICIAL)
    await cancelarSuscripcionEnLaBase()
  }

  return { suscripcion, activar, cancelar, error }
}
