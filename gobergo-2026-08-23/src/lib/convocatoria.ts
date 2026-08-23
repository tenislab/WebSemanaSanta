import { useEffect, useState } from 'react'
import { CLAVES_DATOS, leerPersistido } from './persistencia'
import { COMUNICADOS_INICIALES, type Comunicado } from '../data/comunicados'
import type { Hermano } from '../data/hermanos'
import { nuevoId } from './supabaseSync'
import { avisarPorCorreo } from './avisosCorreo'
import { comunicadoToRow } from './db/comunicados'
import { isSupabaseConfigured, supabase } from './supabase'
import { hoyIso } from './hoy'

/**
 * Convocatoria de papeletas: cuando la secretaría abre el plazo, avisa a TODOS
 * los hermanos que pueden sacar papeleta (los activos con correo).
 *
 * Es el correo más importante del año de una hermandad. De él depende que la
 * gente saque su papeleta a tiempo, y quien no la saca dentro de plazo pierde
 * el sitio que llevaba years ocupando. Va escrito para que se entienda de una
 * lectura en el móvil, a las once de la noche, y que quede claro qué hay que
 * hacer y hasta cuándo.
 */

export interface Convocatoria {
  anio: number
  fecha: string
  total: number
}

const CLAVE = 'cabildo-convocatoria'

export function getConvocatoria(): Convocatoria | null {
  return leerPersistido<Convocatoria | null>(CLAVE, null)
}

export function useConvocatoria(): [Convocatoria | null, () => void] {
  const [conv, setConv] = useState<Convocatoria | null>(() => getConvocatoria())
  useEffect(() => {
    const sync = () => setConv(getConvocatoria())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const refrescar = () => setConv(getConvocatoria())
  return [conv, refrescar]
}

/**
 * Hermanos que pueden sacar papeleta y a los que llegaría el aviso (activos
 * con correo).
 *
 * Los CIVILES quedan fuera: están en el censo porque trabajan en la hermandad,
 * no porque vayan a salir en la estación de penitencia. Recibir un «ya puedes
 * sacar tu papeleta de sitio» sería, para el administrativo contratado, un
 * correo que no entiende — y para quien lo manda, un número de destinatarios
 * que no cuadra con el censo.
 */
export function destinatariosConvocatoria(hermanos: Hermano[]): Hermano[] {
  return hermanos.filter((h) => h.estado !== 'Baja' && !h.civil && h.email && h.email.includes('@'))
}

/** Una fecha en cristiano: «28 de febrero de 2027». */
function enCristiano(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return iso
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`
}

export interface TextoConvocatoria {
  asunto: string
  parrafos: string[]
  pie: string
}

/**
 * EL TEXTO DEL CORREO. Está aparte para poder leerlo, cambiarlo y probarlo sin
 * tocar nada de lo que lo manda.
 *
 * Cómo está escrito, y por qué:
 *
 * - EL ASUNTO DICE LO QUE ES. «Papeletas de sitio 2027: ya puedes sacar la
 *   tuya» y no «Comunicado nº 14 de la hermandad». En la bandeja de entrada se
 *   ven cuarenta caracteres y hay que decidir en ese ancho si se abre.
 * - LA FECHA LÍMITE VA EN EL PRIMER PÁRRAFO, en cristiano y no en 2027-02-28.
 *   Es el único dato por el que la gente abre este correo.
 * - SE DICE LA CONSECUENCIA, sin dramatizar: quien no la saca a tiempo pierde
 *   el sitio del año pasado. Es la razón de que el correo exista.
 * - UNA SOLA COSA QUE HACER, y dicha con el verbo delante. Nada de «se pone en
 *   conocimiento de los señores hermanos».
 * - DE USTED NO, de tú: es la casa de uno.
 * - SIN ADJUNTOS Y SIN IMÁGENES. Se lee en el móvil y en un cliente que
 *   bloquea todo lo que puede.
 */
export function textoConvocatoria(
  anio: number,
  fechaLimiteIso: string,
  extra?: { hermandad?: string; fechaSalidaIso?: string | null; horarioSecretaria?: string },
): TextoConvocatoria {
  const limite = enCristiano(fechaLimiteIso)
  const casa = extra?.hermandad?.trim()
  const parrafos: string[] = [
    `Ya está abierto el plazo para sacar la papeleta de sitio de la Estación de Penitencia de ${anio}.`,
    `Tienes de plazo hasta el ${limite}.`,
    'Puedes sacarla tú desde tu área de hermano, entrando con tu DNI y tu clave. '
      + 'Eliges el sitio que quieres, y si el año pasado ya saliste puedes renovar el mismo con un solo clic.',
    `Si no la sacas antes del ${limite}, pierdes el sitio que tuviste el año pasado y `
      + 'tendrás que pedir uno nuevo entre los que queden libres.',
  ]
  if (extra?.fechaSalidaIso) {
    parrafos.push(`La salida es el ${enCristiano(extra.fechaSalidaIso)}.`)
  }
  if (extra?.horarioSecretaria?.trim()) {
    parrafos.push(`Si prefieres hacerlo en persona, secretaría atiende ${extra.horarioSecretaria.trim()}.`)
  } else {
    parrafos.push('Si prefieres hacerlo en persona o tienes cualquier duda, escríbenos respondiendo a este correo.')
  }
  return {
    asunto: `Papeletas de sitio ${anio}: ya puedes sacar la tuya`,
    parrafos,
    pie: casa
      ? `${casa} · Este aviso lo puedes apagar desde tu área de hermano.`
      : 'Este aviso lo puedes apagar desde tu área de hermano.',
  }
}

export interface ResultadoConvocatoria {
  /** A cuántos se les ha mandado de verdad. */
  enviados: number
  /** A cuántos se podía mandar (activos, no civiles, con correo). */
  total: number
  /** Qué ha fallado, si ha fallado algo. */
  error?: string
}

/**
 * Manda la convocatoria y la deja registrada.
 *
 * ANTES NO MANDABA NADA. Escribía un comunicado en el navegador, guardaba la
 * marca de «ya convocado» y la pantalla decía «Convocatoria enviada (simulada)
 * a N hermanos». Nadie recibía nada, y la marca de convocado quedaba puesta:
 * el botón ya no volvía a ofrecerse. Es decir, la hermandad se quedaba
 * convencida de haber avisado a sus ochocientos hermanos sin haber avisado a
 * ninguno.
 *
 * Ahora sale de verdad por el mismo canal que el resto de avisos, y la marca
 * de «convocado» SOLO se guarda si algo ha salido. Si el correo está apagado o
 * falla, se dice y se puede volver a intentar.
 */
export async function enviarConvocatoria(
  anio: number,
  hermanos: Hermano[],
  fechaLimite: string,
  extra?: { hermandad?: string; fechaSalidaIso?: string | null; horarioSecretaria?: string },
): Promise<ResultadoConvocatoria> {
  const destinatarios = destinatariosConvocatoria(hermanos)
  const { asunto, parrafos, pie } = textoConvocatoria(anio, fechaLimite, extra)

  const r = await avisarPorCorreo(
    destinatarios.map((h) => ({ id: h.id, nombre: h.nombre, email: h.email })),
    'papeleta',
    asunto,
    parrafos,
    pie,
  )

  // Hora local: con toISOString, convocar de madrugada la fechaba el día antes.
  const cuando = hoyIso()

  const comunicados = leerPersistido<Comunicado[]>(CLAVES_DATOS.comunicados, COMUNICADOS_INICIALES)
  const nuevo: Comunicado = {
    id: nuevoId(),
    numero: Math.max(0, ...comunicados.map((c) => c.numero)) + 1,
    titulo: asunto,
    cuerpo: parrafos.join('\n\n'),
    canal: 'Email',
    redes: null,
    destinatarios: 'Todos los hermanos',
    estado: r.enviados > 0 ? 'Enviado' : 'Borrador',
    fechaCreacion: cuando,
    fechaProgramada: null,
    fechaEnvio: r.enviados > 0 ? cuando : null,
    autor: 'Secretaría',
    alcance: r.enviados,
  }
  /*
   * El comunicado va A LA BASE cuando la hay, no solo al navegador.
   *
   * Escribirlo únicamente en `localStorage` era otra media verdad: la pantalla
   * de Comunicados lee de Supabase, así que ese registro no aparecía por
   * ninguna parte. «Queda registrada en Comunicados» y no quedaba.
   */
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('comunicados').insert([comunicadoToRow(nuevo)])
    if (error) console.error('La convocatoria no se pudo registrar en Comunicados:', error.message)
  } else {
    localStorage.setItem(CLAVES_DATOS.comunicados, JSON.stringify([nuevo, ...comunicados]))
  }

  /*
   * La marca de «ya convocado» SOLO si algo ha salido. Guardarla pasara lo que
   * pasara escondía el botón para siempre, y con él la única forma de volver a
   * intentarlo.
   */
  if (r.enviados > 0) {
    const conv: Convocatoria = { anio, fecha: cuando, total: r.enviados }
    localStorage.setItem(CLAVE, JSON.stringify(conv))
  }

  return { enviados: r.enviados, total: destinatarios.length, error: r.error }
}
