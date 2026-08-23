/**
 * EL CONTADOR DE VISITAS DE LA WEB PÚBLICA.
 *
 * «¿Entra alguien en la web?» es la primera pregunta que hace una hermandad
 * después de publicarla, y no había forma de contestarla.
 *
 * POR QUÉ NO GOOGLE ANALYTICS. Porque obliga a poner el cartel de las cookies.
 * Una web que recibe cien visitas al mes no necesita pagar ese precio: el
 * cartel molesta a todo el que entra, hay que mantenerlo al día, y convierte
 * una web sencilla en algo que pide permiso antes de enseñar nada.
 *
 * Esto cuenta visitas a páginas y NADA más: ni dirección IP, ni cookies, ni
 * seguir a nadie entre páginas. Lo que se guarda es un número por día y por
 * ruta — «el 14 de marzo, la portada tuvo 43 visitas»—, que no son datos
 * personales y no necesita consentimiento.
 *
 * LO QUE NO SABE, y hay que tenerlo claro al mirar los números: cuántas
 * PERSONAS distintas han entrado. Sin seguir a nadie no se puede, y es mejor un
 * número honesto que uno inventado. Si la misma persona abre tres páginas, son
 * tres visitas.
 *
 * PARA ENCENDERLO: ejecuta `supabase/visitas-web.sql` una vez.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { getHermandadDeLaPagina } from './multiHermandad'

/**
 * Lo ya contado en esta pestaña, para no contar dos veces lo mismo.
 *
 * Sin esto, quien deja la web abierta y le da a recargar mientras espera —o
 * quien va y vuelve de una noticia a la portada cinco veces— sube el contador
 * cinco veces, y el número deja de significar nada.
 *
 * Vive en memoria y muere con la pestaña: no es una cookie ni deja rastro. El
 * precio es que quien vuelve mañana cuenta otra vez, y está bien: mañana es
 * otra visita.
 */
const yaContadas = new Set<string>()

/** La ruta limpia: sin lo que va detrás de «?» ni de «#». */
export function rutaLimpia(url: string): string {
  const sinBusqueda = url.split('?')[0].split('#')[0]
  if (!sinBusqueda.startsWith('/')) return '/'
  /*
   * Y sin la barra final: `/noticias` y `/noticias/` son la misma página y, sin
   * quitarla, salían como dos líneas distintas en el panel — que es justo lo
   * que hace que una tabla de visitas no se pueda leer.
   */
  const sinBarra = sinBusqueda.length > 1 ? sinBusqueda.replace(/\/+$/, '') : sinBusqueda
  return sinBarra || '/'
}

/**
 * Cuenta una visita a esta página. No devuelve nada y no falla nunca hacia
 * fuera: un contador que rompa la web de una hermandad sería mucho peor que un
 * contador que no cuente.
 */
export async function contarVisita(ruta: string, hermandadId?: string | null): Promise<void> {
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente) return

  const hermandad = hermandadId ?? getHermandadDeLaPagina()
  // Sin saber de quién es la página no se cuenta: sería una fila sin dueño que
  // no puede ver nadie.
  if (!hermandad) return

  const limpia = rutaLimpia(ruta)
  const clave = `${hermandad}|${limpia}`
  if (yaContadas.has(clave)) return
  // Se marca ANTES de llamar, no después: con dos llamadas a la vez —que pasa
  // al montar dos veces en desarrollo— las dos veían el conjunto vacío y las
  // dos contaban.
  yaContadas.add(clave)

  try {
    await cliente.rpc('contar_visita', { p_hermandad_id: hermandad, p_ruta: limpia })
  } catch {
    /*
     * En silencio a propósito. Si falla —falta ejecutar el SQL, no hay red— el
     * visitante no tiene nada que hacer al respecto y no es asunto suyo. Y
     * `yaContadas` se queda marcada: reintentar en bucle contra un servidor que
     * no responde no arregla nada y gasta la batería del móvil de quien mira la
     * web.
     */
  }
}

/** Un día con su número, tal como sale de la base. */
export interface DiaDeVisitas {
  dia: string
  visitas: number
}

/** Una página con lo que ha recibido en el periodo mirado. */
export interface PaginaVisitada {
  ruta: string
  visitas: number
}

export interface ResumenDeVisitas {
  /** Día a día, del más antiguo al más nuevo: es como se pinta un gráfico. */
  dias: DiaDeVisitas[]
  /** Las páginas más vistas, de más a menos. */
  paginas: PaginaVisitada[]
  total: number
  /** Lo mismo en el periodo ANTERIOR, para poder decir «un 30% más que el mes pasado». */
  totalAnterior: number
  /** ¿Se ha podido preguntar? En falso, no es que haya cero: es que no se sabe. */
  hayDatos: boolean
}

export const SIN_VISITAS: ResumenDeVisitas = {
  dias: [], paginas: [], total: 0, totalAnterior: 0, hayDatos: false,
}

/**
 * El resumen de los últimos `dias` días.
 *
 * Se piden también los `dias` anteriores para poder comparar. Un número suelto
 * —«312 visitas»— no dice nada: lo que se quiere saber es si suben o bajan,
 * sobre todo en Cuaresma.
 */
export async function resumenDeVisitas(dias = 30): Promise<ResumenDeVisitas> {
  const cliente = supabase
  if (!isSupabaseConfigured || !cliente) return SIN_VISITAS

  const hoy = new Date()
  const desde = diaISO(restarDias(hoy, dias - 1))
  const desdeAnterior = diaISO(restarDias(hoy, dias * 2 - 1))

  try {
    const { data, error } = await cliente
      .from('visitas_web')
      .select('dia, ruta, visitas')
      .gte('dia', desdeAnterior)
      .order('dia')
    if (error || !data) return SIN_VISITAS

    const filas = data as { dia: string; ruta: string; visitas: number }[]
    const delPeriodo = filas.filter((f) => f.dia >= desde)
    const anteriores = filas.filter((f) => f.dia < desde)

    // Día a día, con los días SIN visitas puestos a cero: un gráfico al que le
    // faltan los días vacíos miente, porque une dos picos con una línea recta
    // como si en medio no hubiera pasado nada.
    const porDia = new Map<string, number>()
    for (let i = dias - 1; i >= 0; i -= 1) porDia.set(diaISO(restarDias(hoy, i)), 0)
    for (const f of delPeriodo) {
      if (porDia.has(f.dia)) porDia.set(f.dia, (porDia.get(f.dia) ?? 0) + f.visitas)
    }

    const porRuta = new Map<string, number>()
    for (const f of delPeriodo) porRuta.set(f.ruta, (porRuta.get(f.ruta) ?? 0) + f.visitas)

    return {
      dias: [...porDia.entries()].map(([dia, visitas]) => ({ dia, visitas })),
      paginas: [...porRuta.entries()]
        .map(([ruta, visitas]) => ({ ruta, visitas }))
        .sort((a, b) => b.visitas - a.visitas),
      total: delPeriodo.reduce((s, f) => s + f.visitas, 0),
      totalAnterior: anteriores.reduce((s, f) => s + f.visitas, 0),
      hayDatos: true,
    }
  } catch {
    return SIN_VISITAS
  }
}

/**
 * Cuánto han subido o bajado, en porcentaje. Null cuando no se puede decir:
 * sin nada con qué comparar, «+100%» sería inventarse una mejora.
 */
export function variacion(total: number, anterior: number): number | null {
  if (anterior === 0) return null
  return Math.round(((total - anterior) / anterior) * 100)
}

/**
 * Cómo se llama una ruta en cristiano, para la tabla del panel. `/n/cabildo` es
 * una dirección; «Noticia: cabildo» es lo que la hermandad reconoce.
 */
export function nombreDeRuta(ruta: string): string {
  if (ruta === '/') return 'Portada'
  if (ruta === '/noticias') return 'Actualidad'
  const [, tipo, ...resto] = ruta.split('/')
  const nombre = resto.join('/').replace(/-/g, ' ')
  if (tipo === 'n') return `Noticia: ${nombre}`
  if (tipo === 't') return `Titular: ${nombre}`
  if (tipo === 'c') return `Culto: ${nombre}`
  return ruta
}

/**
 * `2026-03-14` → «14 mar». Para los extremos del gráfico y el título de cada
 * barra.
 *
 * Se construye la fecha por partes y NO con `new Date('2026-03-14')`: esa
 * forma la interpreta el navegador como medianoche UTC, y al oeste de Greenwich
 * el rótulo sale con el día de antes.
 */
export function diaCorto(iso: string): string {
  const t = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!t) return ''
  const f = new Date(Number(t[1]), Number(t[2]) - 1, Number(t[3]))
  return f.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

/** `2026-03-14` en hora local. Con UTC, de madrugada da el día anterior. */
function diaISO(f: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`
}

function restarDias(f: Date, n: number): Date {
  return new Date(f.getFullYear(), f.getMonth(), f.getDate() - n)
}
