/**
 * «AÑADIR AL CALENDARIO».
 *
 * Un `.ics` mal escrito no da error: el calendario simplemente no lo importa,
 * o coloca el culto en otra hora. Nadie se entera hasta que un hermano se
 * presenta al quinario a las nueve y media.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/ics.ts')

  const base = { id: 'c1', titulo: 'Solemne Quinario', fechaIso: '2027-03-15', hora: '20:30' }
  const ics = m.icsDeUnActo(base)

  caso('empieza como un calendario', true, ics.startsWith('BEGIN:VCALENDAR\r\n'))
  caso('y termina cerrándolo', true, ics.endsWith('END:VCALENDAR\r\n'))
  /*
   * CRLF, no `\n`. Con saltos de línea normales Outlook se traga el archivo
   * entero como una sola línea y no importa nada — sin decir por qué.
   */
  caso('las líneas van con CRLF', false, /[^\r]\n/.test(ics))

  /*
   * LA HORA, EN LOCAL Y SIN ZONA. Escrita en UTC («20:30Z»), a quien lo abra
   * desde Londres le sale a las nueve y media, y en verano cambia sola. Sin
   * zona, en `.ics` significa «la hora que pone, donde se lea», que es
   * exactamente lo que quiere una hermandad.
   */
  caso('la hora va en local', true, ics.includes('DTSTART:20270315T203000'))
  caso('y sin la Z de UTC', false, /DTSTART:[^\r]*Z/.test(ics))
  // Hora y media: es lo que dura una función.
  caso('termina hora y media después', true, ics.includes('DTEND:20270315T220000'))

  // Un acto sin hora es del día entero, y en `.ics` eso se escribe con el día
  // siguiente como fin. Sin fin, unos calendarios lo ponen como un instante y
  // otros lo estiran dos días.
  const todoElDia = m.icsDeUnActo({ ...base, hora: '' })
  caso('sin hora, es un acto de día entero', true, todoElDia.includes('DTSTART;VALUE=DATE:20270315'))
  caso('y acaba el día siguiente', true, todoElDia.includes('DTEND;VALUE=DATE:20270316'))

  // El cambio de día al sumar: un culto a las 23:30 termina el día siguiente.
  const denoche = m.icsDeUnActo({ ...base, hora: '23:30' })
  caso('un culto de noche termina al día siguiente', true, denoche.includes('DTEND:20270316T010000'))

  // --- Sin fecha no hay archivo ---
  // Mejor no ofrecer el botón que dar un archivo que el calendario coloca
  // donde no es.
  caso('sin fecha no se genera', null, m.icsDeUnActo({ ...base, fechaIso: '' }))
  caso('con una fecha en texto tampoco', null, m.icsDeUnActo({ ...base, fechaIso: 'del 3 al 7 de marzo' }))

  /*
   * LAS COMAS Y LOS PUNTOS Y COMA. Sin escapar, «Parroquia de San Juan, plaza
   * Mayor» parte el campo en dos y el calendario se queda con media dirección.
   */
  const conComas = m.icsDeUnActo({ ...base, lugar: 'Parroquia de San Juan, plaza Mayor; nave central' })
  caso('las comas del lugar van escapadas', true, conComas.includes('San Juan\\, plaza Mayor\\; nave central'))
  // Y un salto de línea dentro del detalle no puede partir el archivo.
  const conSalto = m.icsDeUnActo({ ...base, descripcion: 'Primer día\nSegundo día' })
  caso('un salto dentro del texto no parte el archivo', true, conSalto.includes('DESCRIPTION:Primer día\\nSegundo día'))
  caso('y no mete un salto de verdad', false, /DESCRIPTION:Primer día\r\n/.test(conSalto))

  // El identificador: dos actos distintos no pueden pisarse en el calendario
  // de quien los guarda.
  caso('cada acto lleva su identificador', true, ics.includes('UID:c1@gobergo.com'))
  caso('y se puede poner el dominio de la hermandad', true,
    m.icsDeUnActo(base, 'hdadveracruz.es').includes('UID:c1@hdadveracruz.es'))

  // DTSTAMP sí va en UTC: es «cuándo se generó el archivo», y es obligatorio.
  caso('lleva la marca de generación en UTC', true, /DTSTAMP:\d{8}T\d{6}Z/.test(ics))

  caso('el nombre del archivo sale del enlace', 'solemne-quinario.ics', m.nombreDeArchivoIcs('solemne-quinario'))
  caso('y sin enlace no queda sin nombre', 'culto.ics', m.nombreDeArchivoIcs(''))
}
