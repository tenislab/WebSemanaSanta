/**
 * El almacén de plantillas, de mentira, para poder probar el hidratador.
 *
 * `hidratarPlantillas()` llama a cinco funciones de cinco módulos distintos, y
 * las cinco acaban aquí. Poniendo este doble en medio se ve QUÉ SE PIDE de
 * verdad, sin base de datos y sin red — que es la única forma de comprobar que
 * la llamada existe, porque el fallo que se está evitando es justo ese: la
 * función escrita y nadie llamándola.
 */

/** Lo que «hay guardado en la base». Lo pone cada prueba antes de hidratar. */
export const guardado = new Map()

/** Lo que se ha pedido, en orden. */
export const pedidas = []

/** Lo que se ha escrito. */
export const escritas = []

export function reiniciar() {
  guardado.clear()
  pedidas.length = 0
  escritas.length = 0
}

export async function traerPlantilla(cual) {
  pedidas.push(cual)
  return guardado.has(cual) ? guardado.get(cual) : null
}

export async function guardarPlantilla(cual, valor) {
  escritas.push({ cual, valor })
  return true
}
