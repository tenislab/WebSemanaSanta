import { useEffect, useState } from 'react'
import type { Hermano } from '../data/hermanos'
import { leerPersistido } from './persistencia'
import { getCamposPropios, type CampoPropio } from './camposPropios'

/**
 * Segmentación de hermanos por criterios, para mandar comunicados solo a quien
 * toca (p. ej. «activos, mayores de edad, con cuota pendiente»). Se calcula al
 * vuelo sobre el censo; no guarda nada.
 */

export interface CriteriosSegmento {
  /**
   * `Cualquiera` no filtra nada (las bajas también entran); `Todos` es «todos
   * menos las bajas», que es lo que se quiere al mandar un comunicado. Sin esa
   * distinción, el censo sin sesgar decía «todos menos bajas» y a la vez las
   * enseñaba.
   */
  estado: 'Cualquiera' | 'Todos' | 'Activo' | 'Nuevo' | 'Baja'
  cuota: 'Todos' | 'AlDia' | 'Pendiente'
  /** Edad: mayores o menores de 18. */
  edad: 'Todos' | 'Mayores' | 'Menores'
  /** Etiqueta concreta, o '' para cualquiera. */
  etiqueta: string
  /**
   * El cargo de junta.
   *
   *   ''          no se mira (lo normal)
   *   '__junta'   cualquiera que lleve un cargo — «solo a la junta»
   *   'Tesorero/a' ese cargo y solo ese
   *
   * FALTABA, y era el sesgo que más se pide. Una hermandad convoca a su junta
   * cada mes, y sin esto había que ir marcando a mano quién es de la junta cada
   * vez, o mandarlo a los 800. Lo primero se abandona y lo segundo no se hace.
   */
  cargo: string
  /** Solo quien tenga correo (para envíos por email). */
  soloConEmail: boolean
  /**
   * Condiciones sobre los campos a medida de la hermandad («talla = L»,
   * «carné de costalero = sí»). Vacío = no se mira ese campo.
   */
  campos?: CondicionCampo[]
}

/** Una condición sobre un campo propio. Solo igualdad: es lo que hace falta. */
export interface CondicionCampo {
  campoId: string
  valor: string
}

/*
 * EL SESGO DE PARTIDA.
 *
 * Empezaba en «Activo», y eso dejaba fuera a TODO el mundo en una hermandad
 * recién montada: un hermano creado a mano nace como «Nuevo», y los importados
 * con antigüedad de este año, también. Así que se abría el sesgo avanzado, se
 * elegía lo que fuera, y alcanzaba a cero personas — no por lo elegido, sino
 * por un filtro que ya venía puesto y que nadie había tocado.
 *
 * Se lee como «esto no funciona», y es lo que llegó reportado.
 *
 * «Todos» es todos menos las bajas, que es justo lo que se quiere al mandar un
 * comunicado — lo dice el comentario del propio campo unas líneas más arriba.
 */
export const CRITERIOS_POR_DEFECTO: CriteriosSegmento = {
  estado: 'Todos',
  cuota: 'Todos',
  edad: 'Todos',
  etiqueta: '',
  cargo: '',
  soloConEmail: true,
  campos: [],
}

/** Edad a día de hoy a partir de la fecha de nacimiento (o null si no hay). */
export function edadDe(fechaNacimiento: string | undefined, hoy = new Date()): number | null {
  if (!fechaNacimiento) return null
  const n = new Date(`${fechaNacimiento}T00:00:00`)
  if (Number.isNaN(n.getTime())) return null
  let e = hoy.getFullYear() - n.getFullYear()
  const m = hoy.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e -= 1
  return e
}

/**
 * Hermanos que cumplen los criterios.
 *
 * `roles` son las etiquetas que salen solas de la papeleta de cada uno (ver
 * `rolesPapeleta.ts`). Se pasan de fuera para que esta función siga siendo
 * pura, pero **hay que pasarlas**: sin ellas, sesgar por «Costalero» no
 * encuentra a los costaleros de este año, que es justo el caso para el que se
 * inventaron los roles automáticos.
 *
 * `cargos` es lo mismo para los cargos de junta (ver `cargosEfectivos` en
 * `personal.ts`): el cargo puede estar en la ficha del censo o en su fila de
 * personal, y hay que mirar las dos.
 */
export function filtrarSegmento(
  hermanos: Hermano[],
  c: CriteriosSegmento,
  roles: Map<string, string[]> = new Map(),
  cargos: Map<string, string> = new Map(),
): Hermano[] {
  return hermanos.filter((h) => {
    // Las bajas nunca reciben salvo que se pidan explícitamente.
    if (c.estado !== 'Cualquiera' && (c.estado === 'Todos' ? h.estado === 'Baja' : h.estado !== c.estado)) return false
    if (c.cuota === 'AlDia' && !h.cuotaAlDia) return false
    /*
     * «Pendiente» es el sesgo con el que se manda el aviso a quien debe, y es
     * lo más parecido a un aviso de morosidad que hay en la aplicación.
     *
     * El civil queda fuera SIEMPRE, y si no se hace es un fallo seguro: nace
     * con `cuotaAlDia: false` y nunca se le emite un recibo, así que se queda
     * «pendiente» para siempre. Al administrativo contratado le llegarían
     * todos los avisos de morosidad de la hermandad, uno tras otro, por una
     * deuda que no existe.
     */
    if (c.cuota === 'Pendiente' && (h.cuotaAlDia || h.civil)) return false
    if (c.edad !== 'Todos') {
      const e = edadDe(h.fechaNacimiento)
      if (e == null) return false
      if (c.edad === 'Mayores' && e < 18) return false
      if (c.edad === 'Menores' && e >= 18) return false
    }
    if (c.etiqueta) {
      const suyas = h.etiquetas ?? []
      const automaticas = roles.get(h.id) ?? []
      if (!suyas.includes(c.etiqueta) && !automaticas.includes(c.etiqueta)) return false
    }
    if (c.cargo) {
      /*
       * El cargo puede venir de la ficha del censo o de su fila de personal, y
       * cuando están las dos manda la de personal —es la que decide qué ve al
       * entrar—. `cargosEfectivos` ya lo resuelve; aquí solo se usa.
       *
       * Mirando solo `h.cargo` se quedaba fuera media junta: quien lleva el
       * cargo por su cuenta de acceso y no lo tiene escrito en su ficha del
       * censo no recibía la convocatoria, y no había ningún aviso de que
       * faltara.
       */
      const suyo = (cargos.get(h.id) ?? h.cargo ?? '').trim()
      // «Hermano de a pie» está en el catálogo de cargos pero no es junta: es
      // lo que se le pone a quien no lleva ninguno. Si contara, «solo a la
      // junta» sería «a todo el censo», que es exactamente lo contrario.
      const esDeJunta = suyo !== '' && suyo !== 'Hermano de a pie'
      if (c.cargo === '__junta') {
        if (!esDeJunta) return false
      } else if (suyo !== c.cargo) {
        return false
      }
    }
    for (const cond of c.campos ?? []) {
      if (!cond.valor) continue
      if ((h.campos?.[cond.campoId] ?? '') !== cond.valor) return false
    }
    if (c.soloConEmail && !(h.email && h.email.includes('@'))) return false
    return true
  })
}

/** Etiqueta legible del segmento, para mostrarla como destinatario del comunicado. */
export function etiquetaSegmento(c: CriteriosSegmento, campos: CampoPropio[] = []): string {
  const partes: string[] = [
    c.estado === 'Cualquiera' ? 'Todo el censo'
      : c.estado === 'Todos' ? 'Hermanos'
        : c.estado === 'Activo' ? 'Activos'
          : c.estado === 'Nuevo' ? 'Nuevos' : 'Bajas',
  ]
  if (c.edad === 'Mayores') partes.push('mayores de edad')
  if (c.edad === 'Menores') partes.push('menores de edad')
  if (c.cuota === 'AlDia') partes.push('al día de cuota')
  if (c.cuota === 'Pendiente') partes.push('con cuota pendiente')
  if (c.etiqueta) partes.push(`etiqueta «${c.etiqueta}»`)
  if (c.cargo === '__junta') partes.push('de la junta')
  else if (c.cargo) partes.push(`cargo «${c.cargo}»`)
  for (const cond of c.campos ?? []) {
    if (!cond.valor) continue
    const campo = campos.find((x) => x.id === cond.campoId)
    if (campo) partes.push(`${campo.nombre.toLowerCase()}: ${cond.valor === 'si' ? 'sí' : cond.valor}`)
  }
  return partes.join(' · ')
}

/* ------------------------------ Sesgos guardados ------------------------------ */

/**
 * Un sesgo guardado: los criterios de siempre, con nombre. Secretaría repite
 * las mismas búsquedas cada año («costaleros al día de cuota», «nazarenos
 * menores de edad») y volvía a montarlas a mano cada vez.
 */
export interface SesgoGuardado {
  id: string
  nombre: string
  criterios: CriteriosSegmento
}

export const CLAVE_SESGOS = 'cabildo-sesgos'

export function getSesgos(): SesgoGuardado[] {
  return leerPersistido<SesgoGuardado[]>(CLAVE_SESGOS, [])
}

export function saveSesgos(sesgos: SesgoGuardado[]) {
  localStorage.setItem(CLAVE_SESGOS, JSON.stringify(sesgos))
}

/** Hook con los sesgos guardados y un setter que persiste. */
export function useSesgos(): [SesgoGuardado[], (siguiente: SesgoGuardado[]) => void] {
  const [sesgos, setSesgosState] = useState<SesgoGuardado[]>(() => getSesgos())

  useEffect(() => {
    function sincronizar() {
      setSesgosState(getSesgos())
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  function setSesgos(siguiente: SesgoGuardado[]) {
    setSesgosState(siguiente)
    saveSesgos(siguiente)
  }

  return [sesgos, setSesgos]
}

/** ¿Son los mismos criterios? Sirve para marcar el sesgo activo en la lista. */
export function mismosCriterios(a: CriteriosSegmento, b: CriteriosSegmento): boolean {
  const norm = (c: CriteriosSegmento) => JSON.stringify({
    ...c,
    campos: (c.campos ?? []).filter((x) => x.valor).sort((x, y) => x.campoId.localeCompare(y.campoId)),
  })
  return norm(a) === norm(b)
}

/**
 * Los campos propios que ya no existen se ignoran al aplicar un sesgo viejo:
 * si no, un sesgo guardado hace un año podría no devolver a nadie sin decir
 * por qué.
 */
export function limpiarCriterios(c: CriteriosSegmento): CriteriosSegmento {
  const vigentes = new Set(getCamposPropios().map((x) => x.id))
  return { ...c, campos: (c.campos ?? []).filter((x) => vigentes.has(x.campoId)) }
}

/* --------------------- Los segmentos de siempre, resueltos --------------------- */

/** Minúsculas y sin tildes, para que «al día» y «al dia» sean lo mismo. */
function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * EL DESPLEGABLE DE DESTINATARIOS, TRADUCIDO A CRITERIOS.
 *
 * EL FALLO QUE TAPA, y era el módulo entero. El desplegable ofrece cinco
 * opciones de fábrica, y quien las resolvía solo sabía hacer dos cosas: las que
 * empiezan por «Etiqueta: » y las que contienen la palabra «todos».
 *
 * O sea que de las cinco, CUATRO no alcanzaban a nadie:
 *
 *   · «Todos los hermanos»              ✓ funcionaba
 *   · «Hermanos con cuota al día»       0 personas
 *   · «Hermanos con cuota pendiente»    0 personas
 *   · «Nazarenos con papeleta de sitio» 0 personas
 *   · «Junta de Gobierno»               0 personas
 *
 * Y no fallaba con un error: el comunicado se guardaba, decía «Enviado», y no
 * lo recibía nadie. Ofrecer una opción que no hace nada es peor que no
 * ofrecerla.
 *
 * Se reconoce por partes y no por la frase entera a propósito: la lista de
 * segmentos es un catálogo que la hermandad edita, así que ahí acaba habiendo
 * «Junta de Gobierno saliente», «Hermanos que deben cuota» o «Mayores de edad»
 * escritos a su manera. Cada trozo reconocido suma un criterio, de forma que un
 * nombre compuesto —«Junta de Gobierno mayores de edad»— sale bien.
 *
 * Devuelve `null` si no reconoce NADA. Eso no es «no hay nadie»: es «no sé a
 * quién te refieres», y quien llama tiene que decirlo en pantalla en vez de
 * mandar el comunicado al vacío.
 */
export function criteriosDeSegmento(nombre: string): CriteriosSegmento | null {
  /*
   * `soloConEmail: false` a posta. Un comunicado llega SIEMPRE al buzón del
   * área del hermano, tenga correo o no; el email es un extra que se manda
   * después a los que sí lo tienen. Filtrar aquí por correo dejaría fuera del
   * buzón a quien no lo ha dado, que es justo quien más depende del área.
   */
  const c: CriteriosSegmento = { ...CRITERIOS_POR_DEFECTO, soloConEmail: false }
  const n = sinAcentos(nombre)
  let reconocido = false

  if (/\bal dia\b|al corriente|\bpagad/.test(n)) { c.cuota = 'AlDia'; reconocido = true }
  if (/pendiente|moros|impagad|\bdeuda\b|\bdeben?\b/.test(n)) { c.cuota = 'Pendiente'; reconocido = true }
  if (/junta|directiv|oficiales/.test(n)) { c.cargo = '__junta'; reconocido = true }
  if (/mayores de edad|\badultos\b/.test(n)) { c.edad = 'Mayores'; reconocido = true }
  if (/menores|\bninos\b|infantil/.test(n)) { c.edad = 'Menores'; reconocido = true }
  const nombraTodos = /\btodos\b|\bcenso\b|\bgeneral\b/.test(n)
  // Las bajas nunca entran salvo que se las nombre. Y «todos» + «bajas» no es
  // solo las bajas: es el censo entero, bajas incluidas.
  const nombraBajas = /\bbajas?\b/.test(n)
  if (nombraBajas) c.estado = nombraTodos ? 'Cualquiera' : 'Baja'
  if (nombraTodos || nombraBajas) reconocido = true

  return reconocido ? c : null
}

/**
 * ¿El segmento habla de la papeleta de sitio? `con` = los que la tienen,
 * `sin` = los que no, `null` = no va de eso.
 *
 * Va aparte de `criteriosDeSegmento` porque no se puede resolver mirando solo
 * el censo: hay que ir a las papeletas del año en curso. Los dos se combinan,
 * así que «Junta de Gobierno sin papeleta» funciona.
 */
export function segmentoDePapeleta(nombre: string): 'con' | 'sin' | null {
  const n = sinAcentos(nombre)
  if (!/papeleta|nazaren|\bsitio\b|cortejo/.test(n)) return null
  return /\bsin\b|\bno\b|\bfaltan?\b|aun no|todavia no/.test(n) ? 'sin' : 'con'
}
