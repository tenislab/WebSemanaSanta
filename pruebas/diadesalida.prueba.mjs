/**
 * EL DÍA DE LA SALIDA Y EL «ASISTE».
 *
 * Dos cosas de la ficha de un tramo que solo se vieron pintándola:
 *
 *  1. El rótulo ponía «día de salida 2027». 2027 no es un día, y la campaña ya
 *     guardaba la fecha de verdad (`fechaSalida`, que se pide en el alta).
 *
 *  2. Con el modo día de salida encendido, la ficha listaba a los MISMOS
 *     hermanos dos veces: arriba para entregar la papeleta, abajo para decir si
 *     salían. En un tramo de cirios son cuarenta nombres, o sea ochenta filas,
 *     y había dos párrafos explicando que el ✓ «de arriba» no era el ✓ «de
 *     abajo». Medido en el navegador: 40 nombres repetidos y 7.569 px de ficha.
 *     Ahora: 0 repetidos y 4.352 px, y con el modo apagado 2.549 px porque la
 *     asistencia va plegada y ni se monta.
 *
 * AVISO PARA QUIEN TOQUE ESTO: dos guardas de este repositorio se han puesto
 * rojas leyendo sus propios comentarios explicativos. Aquí se quitan los
 * comentarios antes de buscar nada en la fuente de una pantalla.
 */
import { fuenteDe, cuerpoDeLaFuncion, sinComentarios } from './fuentes.mjs'

export default async function ({ cargar, caso }) {
  // ---------------------------------------------------------------------
  // 1. EL RÓTULO: se ejecuta, no se lee.
  // ---------------------------------------------------------------------
  const { rotuloDiaDeSalida } = await cargar('src/lib/campana.ts')
  const campana = (extra) => ({
    anio: 2027,
    fechaInicioParticiparon: '2026-06-01',
    fechaInicioNoParticiparon: '2026-06-20',
    fechaLimiteRenovacion: '2027-02-28',
    fechaSalida: '2027-03-28',
    ...extra,
  })

  caso('con fecha, dice el día entero', 'domingo 28 de marzo de 2027',
    rotuloDiaDeSalida(campana()))
  // Sin la coma de `es-ES`: esto se pega detrás de un «·» o de un «del», y dos
  // signos seguidos se leen como un tropiezo.
  caso('y sin coma, que va detrás de un «·»', false,
    rotuloDiaDeSalida(campana()).includes(','))

  /*
   * EL FALLO QUE SE ARREGLÓ, DICHO AL REVÉS: pase lo que pase con la fecha, el
   * rótulo no puede quedarse en «día de salida 2027», que es un año donde se
   * promete un día. Si no hay fecha se dice «de 2027», con preposición, que al
   * menos se lee como el año de la edición.
   */
  /*
   * Y EL CASO CON FECHA VA EN LA MISMA LISTA, que es el hueco que tenía esto.
   * Rompiendo la función a propósito —dejándola devolver «día de salida 2027»
   * tal cual— solo se puso roja UNA comprobación, la del día entero, porque
   * las ocho del «nunca» probaban nada más los caminos sin fecha. Una guarda
   * que no cubre el camino que de verdad se recorre no vigila ese camino.
   */
  for (const [queTiene, c] of [
    ['con fecha', campana()],
    ['sin fecha', campana({ fechaSalida: undefined })],
    ['con la fecha vacía', campana({ fechaSalida: '' })],
    ['con una fecha que no lo es', campana({ fechaSalida: 'el viernes' })],
    ['con un mes que no existe', campana({ fechaSalida: '2027-13-40' })],
  ]) {
    const r = rotuloDiaDeSalida(c)
    caso(`${queTiene}: nunca «día de salida 2027»`, false, /día de salida 2027/.test(r))
    // Un año pelado detrás de cualquier palabra es el mismo fallo con otro
    // sujeto: lo que no puede haber es un 2027 que no vaya precedido de «de».
    caso(`${queTiene}: ningún año suelto`, false, /(?<!de )2027/.test(r))
    if (queTiene !== 'con fecha') {
      caso(`${queTiene}: se lee como un año`, true, /día de salida de 2027/.test(r))
    }
  }

  // ---------------------------------------------------------------------
  // 2. EL RECUENTO: función pura, con listas a mano.
  // ---------------------------------------------------------------------
  const { cuentaAsistencia } = await cargar('src/lib/asistencia.ts')
  caso('el tramo vacío no inventa pendientes', { asisten: 0, noAsisten: 0, pendientes: 0 },
    cuentaAsistencia([]))
  caso('los tres números suman el tramo', { asisten: 2, noAsisten: 1, pendientes: 3 },
    cuentaAsistencia(['asiste', 'pendiente', 'no_asiste', 'asiste', 'pendiente', 'pendiente']))
  // Lo que no está marcado cuenta como pendiente, no como ausente: el día de la
  // salida «sin confirmar» y «no viene» son dos cosas muy distintas.
  caso('sin marcar es pendiente, no ausente', { asisten: 0, noAsisten: 0, pendientes: 4 },
    cuentaAsistencia(['pendiente', 'pendiente', 'pendiente', 'pendiente']))

  // ---------------------------------------------------------------------
  // 3. UNA SOLA LISTA EN LA FICHA DEL TRAMO.
  // ---------------------------------------------------------------------
  /*
   * CON `sinComentarios`, que ahora vive en `fuentes.mjs`. Aquí había un
   * `replace` a ojo, y el de otra prueba se comió media pantalla porque un
   * `accept="image/*"` tiene un `/*` literal dentro de un texto. La pieza
   * compartida lee la fuente sabiendo cuándo está dentro de un texto.
   */
  const cortejo = sinComentarios(await fuenteDe('src/pages/app/Cortejo.tsx'))
  const ficha = cuerpoDeLaFuncion(cortejo, 'function TramoFicha')
  caso('se encuentra la ficha del tramo', true, ficha.length > 500)

  /*
   * LA PRUEBA DE QUE NO HAY DOS LISTAS: los chips de asistencia se pintan
   * DENTRO del recorrido del reparto, el mismo que pinta la fila de la
   * entrega. Si alguien los vuelve a sacar a una lista aparte, `ChipsAsistencia`
   * deja de estar entre el `reparto.map(` y el `</ul>` que lo cierra.
   */
  const recorrido = ficha.slice(ficha.indexOf('reparto.map('), ficha.indexOf('</ul>'))
  caso('los chips van en la misma fila que la entrega', true,
    recorrido.includes('<ChipsAsistencia'))
  caso('y la entrega sigue en esa misma fila', true,
    recorrido.includes('onPresente(a.papeleta.id)'))

  /*
   * Y EL «ARRIBA / ABAJO» NO VUELVE. Mientras hubo dos listas, la ficha tenía
   * que explicar por escrito dónde estaba cada control: «eso es el ✓ de
   * arriba». Esa frase es el síntoma, y desde la asistencia el ✓ de la papeleta
   * quedaba además fuera de la pantalla, así que la referencia ni se sostenía.
   */
  caso('no se explica dónde está el otro tic', false,
    /de (arriba|abajo)—?:/.test(ficha) || /más abajo, en/.test(ficha))

  /*
   * CON EL MODO ENCENDIDO NO HAY SEGUNDA LISTA. `AsistenciaTramo` sigue
   * existiendo —lo usa el área del diputado de tramo, donde no hay papeletas
   * que entregar—, pero en esta ficha solo se monta con el modo APAGADO y
   * dentro del plegable.
   */
  const usos = ficha.split('<AsistenciaTramo')
  caso('AsistenciaTramo se monta una sola vez', 2, usos.length)
  caso('y solo con el día de salida apagado', true,
    /!diaDeSalida && confirmados\.length > 0/.test(ficha))

  /*
   * EL PLEGABLE NO MONTA LO QUE NO SE VE. `details` cerrado no pinta a sus
   * hijos, pero React sí los construye: eran cuarenta pares de chips en el
   * árbol que nadie estaba mirando. Medido: 0 chips en el DOM con el plegable
   * cerrado, 80 al abrirlo.
   */
  caso('la asistencia plegada solo se monta al abrirla', true,
    /asistenciaAbierta && \(\s*<AsistenciaTramo/.test(ficha))
  caso('y el plegable sabe si está abierto', true,
    /onToggle=\{\(e\) => setAsistenciaAbierta\(/.test(ficha))

  /*
   * Y EL RECUENTO NO SALE DOS VECES SEGUIDAS. El rótulo del plegable ya lleva
   * los tres números —es para lo que sirve estando cerrado—, así que dentro se
   * apaga. La primera versión los enseñaba en el rótulo y otra vez debajo.
   */
  caso('el plegable no repite el recuento', true, /sinResumen/.test(ficha))

  // ---------------------------------------------------------------------
  // 4. LO QUE NO SE PUEDE PERDER AL REORDENAR LA FILA.
  // ---------------------------------------------------------------------
  /*
   * «Marcar pagada» ya se cayó una vez al fusionar las dos listas, y lo cazó el
   * compilador porque dejó un parámetro sin usar. Si el día que se toque esto
   * el parámetro se sigue usando en otro sitio, el compilador se calla: por eso
   * la fila se vigila aquí.
   */
  for (const [que, trozo] of [
    ['marcar pagada', 'onPagada(a.papeleta.id)'],
    ['registrar incidencia', 'onIncidencia(a.papeleta.id)'],
    ['resolver la incidencia', 'onResolver(a.papeleta.id, false)'],
    ['la baja definitiva', 'onResolver(a.papeleta.id, true)'],
  ]) {
    caso(`la fila conserva ${que}`, true, recorrido.includes(trozo))
  }

  /*
   * A QUIEN EXCEDE EL AFORO NO SE LE PREGUNTA SI SALE: no tiene sitio todavía,
   * y marcarle «asiste» sería guardar en el histórico que salió alguien que no
   * tenía puesto.
   */
  caso('al que excede el aforo no se le pregunta', true,
    /diaDeSalida && a\.estado !== 'Excede aforo'/.test(recorrido))

  // ---------------------------------------------------------------------
  // 5. LA FILA CABE EN EL PANEL DE 440 px.
  // ---------------------------------------------------------------------
  /*
   * Al juntar en una sola fila el nombre, la pastilla, los dos iconos y los dos
   * chips, el nombre se partía en tres renglones y la pastilla «Confirmada» se
   * pintaba encima del tercero. En el código la fila era un `flex` correcto; el
   * choque solo se vio con cuarenta nazarenos de nombre largo. Se arregla
   * dándole al hermano la línea entera.
   */
  const css = await fuenteDe('src/styles/global.css')
  caso('el hermano se queda con la línea entera', true,
    /\.cortejo-roster--dia \.row-person \{[^}]*flex: 1 1 100%/.test(css))
  caso('y el motivo baja a su propia línea', true,
    /\.cortejo-roster--dia \.asistencia__motivo \{[^}]*flex: 1 1 100%/.test(css))
}
