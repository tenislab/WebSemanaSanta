import type { Hermano } from '../data/hermanos'

/**
 * El escalafón: quién va delante de quién. Es lo más delicado de toda la
 * aplicación, porque un número mal puesto cambia el sitio de alguien en el
 * cortejo y no se nota hasta el día de la salida.
 *
 * Está aquí, aparte de la pantalla, para poder probarlo de verdad.
 *
 * Dos ideas que hay que tener claras:
 *
 * - El **número** es la posición en el escalafón, y se mueve: cuando alguien se
 *   da de baja, todos los de debajo suben uno.
 * - La **antigüedad** es el AÑO en que entró, y no se mueve nunca. No cambia
 *   porque se dé de baja otro.
 *
 * Quien está de baja queda con número 0: fuera de la numeración, pero con su
 * ficha y su historial intactos.
 *
 * Y hay un segundo grupo fuera de la numeración: los hermanos CIVILES. Un
 * administrativo contratado tiene su ficha y su acceso, pero no ocupa un
 * puesto del escalafón — no va en el cortejo y no tiene antigüedad que
 * defender. Si se le diera número, todos los hermanos de detrás bajarían uno,
 * y eso se ve el día de la salida.
 */

/** Fuera del escalafón: los de baja y los civiles. */
function enElEscalafon(h: { estado: string; numero: number; civil?: boolean }): boolean {
  return h.estado !== 'Baja' && !h.civil && h.numero > 0
}

/**
 * Da de baja y recoloca el escalafón. El número del que se va queda libre y
 * todos los de número mayor descienden uno.
 */
export function darDeBajaEnCenso<
  T extends Pick<Hermano, 'id' | 'estado' | 'numero'> & { civil?: boolean; cargo?: unknown },
>(
  censo: T[],
  hermanoId: string,
): T[] {
  const actual = censo.find((h) => h.id === hermanoId)
  if (!actual || actual.estado === 'Baja') return censo
  /*
   * SU NÚMERO, Y SI ESE NÚMERO OCUPABA SITIO DE VERDAD.
   *
   * No todo el mundo en el censo tiene puesto en el escalafón. El hermano
   * CIVIL —un administrativo contratado, un asesor— lleva número 0 a
   * propósito, y una ficha recién importada puede llegar con 0 mientras se
   * termina de numerar.
   *
   * Aquí abajo se recolocaba «a todos los de número mayor que el suyo». Con
   * número 0, eso es TODO EL CENSO: al tramitarle la baja al administrativo,
   * el hermano nº 1 se iba al 0 —o sea, fuera de la numeración, como si
   * estuviera de baja él también— y los demás bajaban un puesto cada uno.
   *
   * Y no se nota el día que pasa. Se nota el día de la salida, con el
   * escalafón entero corrido y el hermano más antiguo desaparecido de la
   * lista. Quien no ocupaba sitio no deja hueco al irse.
   */
  const numBaja = actual.numero
  const ocupabaSitio = numBaja > 0
  return censo.map((h) => {
    /*
     * La baja QUITA EL CARGO, y no es un detalle de limpieza.
     *
     * La única forma que tiene la base de datos de revocarle los permisos a
     * alguien es su `estado`: tanto `auth_es_hermano()` como
     * `modulo_permitido()` preguntan por `estado <> 'Baja'`. Dejar el cargo
     * escrito en la ficha del tesorero destituido es dejar la puerta apoyada:
     * basta con que su estado vuelva a 'Activo' —por un error de secretaría,
     * por una reincorporación— para que recupere Tesorería sin que nadie lo
     * decida.
     */
    if (h.id === hermanoId) {
      return { ...h, estado: 'Baja' as const, numero: 0, bajaSolicitada: false, cargo: null }
    }
    // Solo descienden los que están DENTRO de la numeración activa: los de
    // baja ya están fuera (número 0) y no se tocan.
    if (ocupabaSitio && enElEscalafon(h) && h.numero > numBaja) return { ...h, numero: h.numero - 1 }
    return h
  })
}

/**
 * Reactiva a quien estaba de baja. Hay dos formas y **no da igual cuál**:
 *
 * - `recuperarAntiguedad = false`: entra con el último número, como uno nuevo.
 *   Vale para quien se fue hace veinte años y vuelve.
 * - `recuperarAntiguedad = true`: vuelve al puesto que le toca por su año de
 *   entrada, y los de debajo descienden uno. Es lo normal en una hermandad
 *   cuando alguien se reincorpora.
 *
 * A igualdad de año se le pone DETRÁS de los que ya están: quien no ha faltado
 * en todos estos años no debe caer por debajo de quien vuelve.
 */
export function reactivarEnCenso<
  T extends Pick<Hermano, 'id' | 'estado' | 'numero' | 'antiguedad'> & { civil?: boolean },
>(
  censo: T[],
  hermanoId: string,
  recuperarAntiguedad: boolean,
): T[] {
  const actual = censo.find((h) => h.id === hermanoId)
  if (!actual || actual.estado !== 'Baja') return censo

  /*
   * EL CIVIL QUE VUELVE NO ENTRA EN EL ESCALAFÓN, igual que no entró la
   * primera vez. Vuelve a estar activo y se queda con su número 0.
   *
   * Sin esta línea, reactivar al administrativo «recuperando su antigüedad»
   * le buscaba sitio por su año de entrada y empujaba un puesto a TODOS los
   * hermanos de detrás; y mandándolo «al final» se le daba el último número,
   * dejando un hueco que rompe la numeración. Ninguna de las dos cosas la ha
   * pedido nadie: lo único que se está diciendo es que el contratado vuelve.
   */
  if (actual.civil) {
    return censo.map((h) => (h.id === hermanoId ? { ...h, estado: 'Activo' as const, numero: 0 } : h))
  }

  if (!recuperarAntiguedad) {
    const siguiente = Math.max(0, ...censo.map((h) => h.numero)) + 1
    return censo.map((h) => (h.id === hermanoId ? { ...h, estado: 'Activo' as const, numero: siguiente } : h))
  }

  const activos = censo.filter(enElEscalafon).sort((a, b) => a.numero - b.numero)
  // Su sitio es delante del primero que entró DESPUÉS que él.
  const detras = activos.find((h) => h.antiguedad > actual.antiguedad)
  /**
   * Y si no hay nadie más moderno, al final. AL FINAL DE VERDAD.
   *
   * Antes era `activos.length + 1`, que solo coincide con el último número
   * cuando la numeración no tiene huecos. Y los tiene siempre: cada baja deja
   * el suyo vacío. Con 300 activos numerados hasta el 512, reincorporar a
   * alguien le daba el 301 — o sea, por delante de doscientos hermanos MÁS
   * ANTIGUOS que él, y empujándolos a todos un número.
   *
   * En una hermandad eso no es un detalle de listado: la antigüedad es lo que
   * ordena el cortejo y lo que da prioridad al pedir papeleta.
   */
  const suNumero = detras ? detras.numero : Math.max(0, ...activos.map((h) => h.numero)) + 1
  return censo.map((h) => {
    if (h.id === hermanoId) return { ...h, estado: 'Activo' as const, numero: suNumero }
    if (enElEscalafon(h) && h.numero >= suNumero) return { ...h, numero: h.numero + 1 }
    return h
  })
}

/**
 * ¿Está la numeración sana? Sirve para comprobarlo en las pruebas y, más
 * adelante, para avisar si una importación o una migración la dejó rota.
 */
export function numeracionSana<T extends Pick<Hermano, 'estado' | 'numero'> & { civil?: boolean }>(
  censo: T[],
): boolean {
  // Los civiles no entran: llevan número 0 a propósito, y sin esta línea un
  // censo perfectamente sano daría «rota» solo por tener un contratado.
  const activos = censo.filter((h) => h.estado !== 'Baja' && !h.civil).map((h) => h.numero)
  if (activos.some((n) => n <= 0)) return false
  if (new Set(activos).size !== activos.length) return false
  // Sin huecos: del 1 al total, sin saltarse ninguno.
  const ordenados = [...activos].sort((a, b) => a - b)
  return ordenados.every((n, i) => n === i + 1)
}
