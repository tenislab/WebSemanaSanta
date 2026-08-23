/**
 * DARLE ACCESO A UN HERMANO QUE YA ESTÁ EN EL CENSO.
 *
 * EL HUECO QUE TAPA. La cuenta de un hermano se creaba en dos sitios: al darlo
 * de alta a mano y al aprobar su solicitud. Pero una hermandad no entra así:
 * entra IMPORTANDO su censo de 800 fichas desde un Excel. Y la importación no
 * crea cuentas —ni debe: 800 altas serían 800 correos de golpe—.
 *
 * Resultado: la hermandad tenía su censo entero y ni un solo hermano podía
 * entrar en su área, sin que nada lo dijera. El hueco no se veía hasta después
 * de importar, que es cuando ya no tiene arreglo fácil.
 *
 * CÓMO FUNCIONA. Se le crea la cuenta con una clave de un solo uso y se le
 * manda por correo, igual que en el alta. Uno o los que se elijan.
 *
 * LO QUE NO HACE, Y ES IMPORTANTE:
 *
 *  · A quien YA TIENE cuenta no le toca nada. Ni le crea otra, ni le manda una
 *    clave. Si alguien ya entró y se puso su contraseña, mandarle una nueva que
 *    además no funciona es peor que no mandar nada.
 *  · A quien no tiene correo, tampoco: no hay por dónde.
 *  · A quien está de baja, tampoco: ya no es hermano.
 *
 * Los tres casos se cuentan aparte y se dicen. Un resumen que solo diga
 * «enviados: 340» de 800 deja a la secretaría sin saber qué ha pasado con los
 * otros 460.
 */
import { crearAccesoHermano } from './accesos'
import { claveDeUnSoloUso } from './claves'
import { darLaBienvenida } from './bienvenida'

export interface HermanoParaAcceso {
  id: string
  nombre: string
  email: string
  dni: string
  numero: number
  estado: string
  authUserId: string | null
}

/** Por qué a uno no se le manda. Cada motivo se cuenta por separado. */
export type MotivoSaltado = 'sin-correo' | 'ya-tiene-cuenta' | 'de-baja'

export interface ResultadoUno {
  ok: boolean
  saltado?: MotivoSaltado
  error?: string
  /** El id de la cuenta recién creada, para anotarlo en su ficha. */
  authUserId?: string | null
  /** Y cómo se llama por dentro, que también va a la ficha. Ver `accesos.ts`. */
  correoAcceso?: string | null
}

/** Quién puede recibir el acceso, y si no, por qué no. */
export function porQueNoSePuede(h: HermanoParaAcceso): MotivoSaltado | null {
  if (h.estado === 'Baja') return 'de-baja'
  if (h.authUserId) return 'ya-tiene-cuenta'
  if (!h.email?.trim() || !h.email.includes('@')) return 'sin-correo'
  return null
}

/**
 * Le crea la cuenta y le manda sus datos. Devuelve qué ha pasado, sin lanzar:
 * en una tanda de 800, uno que falle no puede parar a los demás.
 */
export async function enviarAcceso(
  h: HermanoParaAcceso,
  nombreHermandad: string,
): Promise<ResultadoUno> {
  const no = porQueNoSePuede(h)
  if (no) return { ok: false, saltado: no }

  const clave = claveDeUnSoloUso()
  const acceso = await crearAccesoHermano(h.email, clave, h.dni, h.nombre)
  if (acceso.error) {
    // La cuenta NO se ha creado, así que la clave no vale para nada. No se
    // manda: una contraseña que no funciona hace perder más tiempo que un
    // correo que no llega, porque el hermano la prueba, falla, y llama.
    return { ok: false, error: acceso.error }
  }

  const correo = await darLaBienvenida({
    id: h.id,
    nombre: h.nombre,
    email: h.email,
    dni: h.dni,
    numero: h.numero,
    claveProvisional: clave,
    hermandad: nombreHermandad,
  })
  if (correo.enviados === 0) {
    // Aquí la cuenta SÍ existe pero el hermano no sabe su clave. Hay que
    // decirlo con esas palabras, porque el arreglo no es repetir el envío
    // —la cuenta ya está— sino que use «he olvidado mi contraseña».
    return {
      ok: false,
      error:
        correo.error
        ?? `Se ha creado la cuenta de ${h.nombre}, pero el correo con su clave no ha salido. `
          + 'Dile que entre con «he olvidado mi contraseña».',
    }
  }
  return { ok: true, authUserId: acceso.id, correoAcceso: acceso.correoAcceso ?? null }
}

export interface ResumenTanda {
  enviados: number
  saltados: Record<MotivoSaltado, number>
  fallos: { nombre: string; error: string }[]
  /** Los que han recibido cuenta, con su id de Supabase, para anotarlo en su ficha. */
  cuentas: { id: string; authUserId: string | null; correoAcceso: string | null }[]
}

/**
 * A varios de golpe. De uno en uno y esperando a cada uno: en paralelo, 800
 * altas seguidas hacen que el proveedor de correo empiece a rechazar y medio
 * censo se quede sin su clave sin que nadie sepa cuál.
 *
 * `alAvanzar` sirve para que la pantalla pueda contar por dónde va: una tanda
 * de 800 tarda, y sin señal de vida parece colgada.
 */
export async function enviarAccesoEnTanda(
  hermanos: HermanoParaAcceso[],
  nombreHermandad: string,
  alAvanzar?: (hechos: number, total: number) => void,
): Promise<ResumenTanda> {
  const resumen: ResumenTanda = {
    enviados: 0,
    saltados: { 'sin-correo': 0, 'ya-tiene-cuenta': 0, 'de-baja': 0 },
    fallos: [],
    cuentas: [],
  }
  let hechos = 0
  for (const h of hermanos) {
    const r = await enviarAcceso(h, nombreHermandad)
    if (r.ok) {
      resumen.enviados += 1
      resumen.cuentas.push({ id: h.id, authUserId: r.authUserId ?? null, correoAcceso: r.correoAcceso ?? null })
    } else if (r.saltado) {
      resumen.saltados[r.saltado] += 1
    } else {
      resumen.fallos.push({ nombre: h.nombre, error: r.error ?? 'No se pudo.' })
    }
    hechos += 1
    alAvanzar?.(hechos, hermanos.length)
  }
  return resumen
}

/** El resumen, en una frase que se pueda leer sin contar números. */
export function contarLaTanda(r: ResumenTanda): string {
  const partes: string[] = []
  partes.push(r.enviados === 1 ? 'Enviado a 1 hermano' : `Enviados a ${r.enviados} hermanos`)
  if (r.saltados['ya-tiene-cuenta'] > 0) partes.push(`${r.saltados['ya-tiene-cuenta']} ya tenían acceso`)
  if (r.saltados['sin-correo'] > 0) partes.push(`${r.saltados['sin-correo']} no tienen correo`)
  if (r.saltados['de-baja'] > 0) partes.push(`${r.saltados['de-baja']} están de baja`)
  if (r.fallos.length > 0) partes.push(`${r.fallos.length} han fallado`)
  return `${partes.join(' · ')}.`
}
