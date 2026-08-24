/**
 * EL BUZÓN LOCAL NO PUEDE TUMBAR UN COMUNICADO.
 *
 * Cada aviso se escribe en DOS sitios: en la base —de donde lo lee el
 * hermano— y en una copia del navegador, para que la pantalla de quien acaba
 * de mandarlo lo enseñe ya sin esperar a la red.
 *
 * Esa copia era ilimitada y no estaba protegida. Un comunicado a ochocientos
 * hermanos escribe OCHOCIENTAS filas de golpe, cada una con el cuerpo entero
 * del comunicado repetido. Tres o cuatro envíos y el navegador se planta: el
 * hueco que da un navegador para esto son unos cinco megas.
 *
 * Y el orden en que se hacían las cosas convertía ese tope en algo caro. En
 * `enviarAhora`:
 *
 *   1. Se marca el comunicado como «Enviado», con su fecha y su alcance.
 *   2. Se escriben los avisos en el buzón.   ← aquí reventaba
 *   3. Se manda el correo.
 *
 * Si el paso 2 lanza, el 3 no llega a ejecutarse. Resultado: el comunicado
 * queda registrado como enviado a ochenta y cuatro personas, y no le ha
 * llegado a nadie. Sin error en pantalla y sin forma de saberlo.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/avisosHermano.ts')

  const original = localStorage.setItem.bind(localStorage)
  localStorage.clear()

  // El navegador lleno: `setItem` lanza, que es lo que hace de verdad.
  let lanzo = false
  localStorage.setItem = (k, v) => {
    if (k === 'cabildo-avisos-hermano') {
      const e = new Error('QuotaExceededError')
      e.name = 'QuotaExceededError'
      throw e
    }
    return original(k, v)
  }
  try {
    m.agregarAvisoAVarios(['h1', 'h2'], 'Cabildo general', 'comunicado', 'Convocatoria')
  } catch {
    lanzo = true
  }
  localStorage.setItem = original
  caso('con el navegador lleno, el aviso no tumba el envío', false, lanzo)

  // Y lo mismo con uno solo (una cuota dada por pagada, un encargo repartido).
  let lanzoUno = false
  localStorage.setItem = (k) => {
    if (k === 'cabildo-avisos-hermano') throw new Error('QuotaExceededError')
    return original(k, '')
  }
  try {
    m.agregarAvisoHermano('h1', 'Tu recibo queda pagado', 'cuota', 'Recibo')
  } catch {
    lanzoUno = true
  }
  localStorage.setItem = original
  caso('ni un aviso suelto tumba lo que se acaba de guardar', false, lanzoUno)

  /*
   * Y LA COPIA SE MANTIENE ACOTADA, que es lo que evita llegar al tope.
   *
   * No hace falta guardar aquí el buzón entero de la hermandad: esta copia
   * existe para que quien acaba de hacer la acción lo vea al instante, y para
   * el modo demostración. Lo del hermano de verdad vive en la base y se trae
   * por su id.
   */
  localStorage.clear()
  for (let i = 0; i < 5; i += 1) {
    m.agregarAvisoAVarios(
      Array.from({ length: 300 }, (_, n) => `h${i}-${n}`),
      'Un cuerpo de comunicado que ocupa lo suyo, repetido en cada fila.',
      'comunicado',
      'Convocatoria',
    )
  }
  const cuantos = m.getAvisosHermano().length
  caso('la copia local no crece sin freno', true, cuantos > 0 && cuantos <= 600)
  // Y lo que queda es lo MÁS NUEVO, que es lo que se acaba de hacer.
  caso('y lo que se conserva es lo último', true,
    m.getAvisosHermano()[0].hermanoId.startsWith('h4-'))

  /*
   * QUITAR UN AVISO DE LA VISTA TIENE QUE AGUANTAR UNA RECARGA.
   *
   * El hermano NO puede borrar de la base —su política solo le deja marcar
   * `leido`— y es lo correcto: el aviso es la constancia de que se le comunicó
   * algo. Pero «quitar del buzón» se limitaba a sacarlo de la lista y marcarlo
   * leído, y los avisos se vuelven a bajar de la base en CADA visita. Así que
   * el hermano pulsaba la equis, el aviso desaparecía, volvía a entrar y ahí
   * estaba otra vez. Un botón que se deshace solo.
   *
   * Ahora lo que se quita se apunta por su id y se filtra al enseñarlo: la
   * fila sigue en la base, que es lo que hay que conservar, y de su buzón se
   * va de verdad.
   */
  localStorage.clear()
  caso('de partida no hay ninguno quitado', 0, m.getAvisosOcultos().length)
  m.ocultarAviso('aviso-1')
  caso('quitar uno lo deja apuntado', true, m.getAvisosOcultos().includes('aviso-1'))
  // Y sobrevive a la recarga: está en el almacenamiento, no en memoria.
  caso('y sigue apuntado al volver a entrar', true,
    JSON.parse(localStorage.getItem('cabildo-avisos-ocultos')).includes('aviso-1'))
  // Quitar el mismo dos veces no lo duplica.
  m.ocultarAviso('aviso-1')
  caso('quitarlo dos veces no lo duplica', 1, m.getAvisosOcultos().length)
  m.ocultarAviso('aviso-2')
  caso('y el segundo se apunta también', 2, m.getAvisosOcultos().length)
}
