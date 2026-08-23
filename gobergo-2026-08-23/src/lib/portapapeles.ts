/**
 * Copiar al portapapeles sin que se quede en nada.
 *
 * EL FALLO: se llamaba a `navigator.clipboard.writeText(...).then(...)` y ya.
 * Sin `catch`. Y esa promesa se rompe más a menudo de lo que parece:
 *
 *   · El navegador tiene el permiso denegado (Firefox lo trae así de fábrica
 *     en algunas configuraciones).
 *   · La página no va por HTTPS. Ahí `navigator.clipboard` ni existe, así que
 *     el `?.` daba `undefined` y `.then` reventaba con un error distinto.
 *   · Safari lo rechaza si no ve un gesto de la persona lo bastante cerca.
 *
 * Y cuando se rompía, el botón «Copiar enlace» no hacía NADA. Ni se copiaba,
 * ni cambiaba a «✓ Enlace copiado», ni aparecía un aviso. La persona lo pulsa,
 * se va al grupo de WhatsApp de la hermandad, pega... y pega otra cosa.
 *
 * Aquí se intentan las dos formas —la moderna y la de toda la vida— y se
 * DEVUELVE si ha salido bien, para que quien llama pueda enseñar el enlace y
 * que se copie a mano si no hay manera.
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    // Permiso denegado o rechazo del navegador: se prueba la otra forma.
  }

  // La de toda la vida: un cuadro de texto invisible, seleccionar y copiar.
  // Está marcada como obsoleta pero sigue funcionando en todos los navegadores
  // y no pide permiso, que es justo lo que hace falta cuando el otro camino
  // se ha cerrado.
  try {
    const caja = document.createElement('textarea')
    caja.value = texto
    // Fuera de la vista, pero NO con `display:none` ni `hidden`: si no se
    // pinta, no se puede seleccionar y la copia no hace nada.
    caja.setAttribute('readonly', '')
    caja.style.position = 'fixed'
    caja.style.top = '-1000px'
    caja.style.opacity = '0'
    document.body.appendChild(caja)
    caja.select()
    caja.setSelectionRange(0, texto.length)
    const salio = document.execCommand('copy')
    caja.remove()
    return salio
  } catch {
    return false
  }
}
