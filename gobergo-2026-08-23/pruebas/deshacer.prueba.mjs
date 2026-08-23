/**
 * A4 · Deshacer lo que se acaba de borrar.
 *
 * Media aplicación borraba con un clic y sin vuelta atrás. Con datos de
 * ejemplo da igual; con una hermandad de verdad, un evento con sus veinte
 * tareas o el acceso de la secretaria eran una tarde de trabajo que se iba
 * porque alguien pulsó donde no era.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/deshacer.ts')

  // --- Lo básico ---
  caso('al principio no hay nada que deshacer', null, m.ofertaActual())

  let volvio = false
  m.ofrecerDeshacer('Evento «Cabildo» eliminado', () => { volvio = true })
  caso('tras borrar, hay oferta', true, m.ofertaActual() !== null)
  caso('y dice qué se ha borrado', 'Evento «Cabildo» eliminado', m.ofertaActual().texto)

  m.deshacer()
  caso('deshacer llama a lo suyo', true, volvio)
  caso('y consume la oferta', null, m.ofertaActual())

  // No se puede deshacer dos veces: sería volver atrás algo ya devuelto.
  volvio = false
  m.deshacer()
  caso('deshacer dos veces no hace nada', false, volvio)

  // --- Descartar ---
  let noDeberia = false
  m.ofrecerDeshacer('Algo', () => { noDeberia = true })
  m.descartarDeshacer()
  caso('descartar quita la oferta', null, m.ofertaActual())
  caso('y NO deshace nada', false, noDeberia)

  // --- Solo una viva a la vez ---
  // Si se borran dos cosas seguidas, la segunda manda. Guardar una pila
  // invitaría a pulsar varias veces esperando ir atrás sin fin.
  let primera = false
  let segunda = false
  m.ofrecerDeshacer('Primera', () => { primera = true })
  m.ofrecerDeshacer('Segunda', () => { segunda = true })
  caso('la segunda sustituye a la primera', 'Segunda', m.ofertaActual().texto)
  m.deshacer()
  caso('y se deshace la segunda', true, segunda)
  caso('no la primera', false, primera)

  // --- Avisa a quien escucha ---
  let avisos = 0
  const dejarDeEscuchar = m.suscribirseADeshacer(() => { avisos += 1 })
  m.ofrecerDeshacer('Otra', () => {})
  caso('avisa al ofrecer', 1, avisos)
  m.descartarDeshacer()
  caso('y al descartar', 2, avisos)
  dejarDeEscuchar()
  m.ofrecerDeshacer('Ya no escucho', () => {})
  caso('tras darse de baja, ya no avisa', 2, avisos)
  m.descartarDeshacer()

  // --- Volver al sitio, no al final ---
  // En una lista ordenada a mano el orden ES el contenido. Quien deshace
  // espera que todo quede como estaba, no que además se le haya movido.
  const lista = ['a', 'b', 'c']
  caso('vuelve a su posición', 'a,x,b,c', m.reinsertar(lista, 'x', 1).join(','))
  caso('al principio', 'x,a,b,c', m.reinsertar(lista, 'x', 0).join(','))
  caso('al final', 'a,b,c,x', m.reinsertar(lista, 'x', 3).join(','))
  caso('una posición imposible no rompe', 'a,b,c,x', m.reinsertar(lista, 'x', 99).join(','))
  caso('ni una negativa', 'x,a,b,c', m.reinsertar(lista, 'x', -5).join(','))
  caso('la lista original no se toca', 'a,b,c', lista.join(','))

  // --- Que esté enchufado donde hace falta ---
  const { readFile } = await import('node:fs/promises')
  for (const [fichero, quePasa] of [
    ['src/pages/app/Eventos.tsx', 'un evento se lleva sus tareas y a quién estaba asignada cada una'],
    ['src/pages/app/Personal.tsx', 'el acceso de la secretaria'],
    ['src/pages/app/Configuracion.tsx', 'un campo propio, con lo que cada hermano tenga apuntado'],
    ['src/pages/app/WebPublica.tsx', 'el mensaje de alguien que escribió desde la web'],
  ]) {
    const src = await readFile(fichero, 'utf8')
    caso(`${fichero.split('/').pop()} ofrece deshacer (${quePasa})`, true, /ofrecerDeshacer\(/.test(src))
  }

  // La barra va montada una sola vez, en el marco.
  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('la barra está montada en el marco', true, /<BarraDeshacer\s*\/>/.test(shell))

  // Y NO se queda ofreciendo algo imposible al cambiar de pantalla: lo que
  // devolvería el elemento escribe en el estado de una pantalla desmontada.
  const barra = await readFile('src/components/BarraDeshacer.tsx', 'utf8')
  caso('al cambiar de pantalla se retira', true, /descartarDeshacer\(\)/.test(barra) && /pathname/.test(barra))
  // Sin atajo de teclado: Ctrl+Z ya está cogido por el editor de la web.
  caso('no roba el Ctrl+Z', false, /ctrlKey|metaKey/.test(barra))

  // El borrado del artículo 17 del RGPD es permanente A PROPÓSITO: si se
  // pudiera deshacer no sería una supresión.
  const hermanos = await readFile('src/pages/app/Hermanos.tsx', 'utf8')
  const rgpd = hermanos.slice(hermanos.indexOf('async function borrarHermanoRgpd'))
  caso('el borrado RGPD NO se puede deshacer', false, /ofrecerDeshacer/.test(rgpd.slice(0, 1200)))

  // El adjunto tampoco: se van los bytes. Ahí lo que hay es una pregunta.
  const archivo = await readFile('src/pages/app/Archivo.tsx', 'utf8')
  caso('borrar un adjunto pregunta antes', true, /no se puede deshacer/.test(archivo))
}
