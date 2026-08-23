/**
 * «AÑADIR AL CALENDARIO».
 *
 * Un culto anunciado en la web se lee y se olvida. La hermandad publica el
 * Quinario en enero, la gente lo ve, y en marzo nadie se acuerda de que era el
 * martes. Un archivo `.ics` lo mete en el calendario del móvil de un toque, y
 * a partir de ahí avisa él solo.
 *
 * Se genera aquí, en el navegador, y no hace falta servidor: un `.ics` es un
 * archivo de texto con seis líneas. El formato lo entienden el calendario de
 * iPhone, el de Android, Google Calendar y Outlook — es el único que entienden
 * todos.
 *
 * LO QUE TIENE TRAMPA, y por qué está escrito así:
 *
 *   · LAS HORAS. Un culto es a las ocho y media DE AQUÍ. Escribiéndolo en UTC
 *     («20:30Z»), a un hermano que lo abra desde Londres le sale a las nueve y
 *     media, y en verano cambia solo. Se escribe en hora LOCAL SIN ZONA
 *     (`20260315T203000`), que en `.ics` significa exactamente «la hora que
 *     pone, donde se lea». Es lo que quiere una hermandad.
 *
 *   · LOS SALTOS DE LÍNEA. El formato los exige como CRLF (`\r\n`). Con `\n` a
 *     secas, Outlook se traga el archivo entero como una línea y no importa
 *     nada — sin dar error.
 *
 *   · LAS COMAS Y LOS PUNTOS Y COMA. Dentro de un texto hay que escaparlos: un
 *     lugar como «Parroquia de San Juan, plaza Mayor» parte el campo en dos y
 *     el calendario se queda con media dirección.
 */

/** Escapa el texto que va dentro de un campo: comas, puntos y comas, barras y saltos. */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * `2027-03-15` + `20:30` → `20270315T203000`. Sin hora, el día suelto
 * (`20270315`), que es como se escribe un acto de todo el día.
 */
function marca(fechaIso: string, hora?: string): string | null {
  const f = fechaIso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!f) return null
  const dia = `${f[1]}${f[2]}${f[3]}`
  const h = (hora ?? '').trim().match(/^(\d{1,2}):(\d{2})/)
  if (!h) return dia
  return `${dia}T${h[1].padStart(2, '0')}${h[2]}00`
}

export interface ActoDelCalendario {
  /** Con qué nombre entra en el calendario. */
  titulo: string
  /** `2027-03-15`. Sin esto no hay archivo que valga. */
  fechaIso: string
  /** `20:30`. Vacío = acto de todo el día. */
  hora?: string
  lugar?: string
  descripcion?: string
  /** La dirección de la página del culto, para poder volver a ella. */
  url?: string
  /** Para que dos actos distintos no se pisen en el calendario de quien los guarda. */
  id: string
}

/**
 * El archivo `.ics` de un acto, como texto. Devuelve null si no hay fecha:
 * mejor no ofrecer el botón que dar un archivo que el calendario rechaza.
 */
export function icsDeUnActo(acto: ActoDelCalendario, dominio = 'gobergo.com'): string | null {
  const inicio = marca(acto.fechaIso, acto.hora)
  if (!inicio) return null
  const conHora = inicio.includes('T')
  /*
   * Cuándo TERMINA. Un `.ics` sin fin lo colocan unos calendarios como un
   * instante y otros como un día entero, y en la agenda del móvil quedaba un
   * acto que ocupaba desde el martes hasta el miércoles.
   *
   * Hora y media: es lo que dura una función, y lo que menos molesta cuando no
   * es exacto. Sin hora, el acto es del día y basta con el día siguiente.
   */
  const fin = conHora ? sumarMinutos(inicio, 90) : marcaDelDiaSiguiente(inicio)
  const campoFecha = conHora ? 'DTSTART' : 'DTSTART;VALUE=DATE'
  const campoFin = conHora ? 'DTEND' : 'DTEND;VALUE=DATE'

  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gobergo//Cultos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${acto.id}@${dominio}`,
    /*
     * DTSTAMP es obligatorio y tiene que ir en UTC. Es «cuándo se generó este
     * archivo», no cuándo es el acto, así que aquí sí toca UTC — y es el único
     * sitio donde toca.
     */
    `DTSTAMP:${ahoraUtc()}`,
    `${campoFecha}:${inicio}`,
    `${campoFin}:${fin}`,
    `SUMMARY:${escapar(acto.titulo)}`,
    ...(acto.lugar?.trim() ? [`LOCATION:${escapar(acto.lugar.trim())}`] : []),
    ...(acto.descripcion?.trim() ? [`DESCRIPTION:${escapar(acto.descripcion.trim())}`] : []),
    ...(acto.url?.trim() ? [`URL:${escapar(acto.url.trim())}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  // CRLF, no `\n`: con saltos de línea normales Outlook no importa nada y no
  // dice por qué.
  return `${lineas.join('\r\n')}\r\n`
}

/** `20270315T203000` + 90 minutos. Se hace con Date para no equivocarse en el cambio de día. */
function sumarMinutos(marcaLocal: string, minutos: number): string {
  const [dia, hora] = marcaLocal.split('T')
  const d = new Date(
    Number(dia.slice(0, 4)), Number(dia.slice(4, 6)) - 1, Number(dia.slice(6, 8)),
    Number(hora.slice(0, 2)), Number(hora.slice(2, 4)) + minutos,
  )
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
}

/** El día siguiente de `20270315`. En `.ics` el fin de un acto de un día es el día de después. */
function marcaDelDiaSiguiente(dia: string): string {
  const d = new Date(Number(dia.slice(0, 4)), Number(dia.slice(4, 6)) - 1, Number(dia.slice(6, 8)) + 1)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

/** `20260823T140355Z`. Solo para DTSTAMP. */
function ahoraUtc(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`
    + `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

/** El nombre del archivo que se descarga: «solemne-quinario.ics». */
export function nombreDeArchivoIcs(slug: string): string {
  return `${slug || 'culto'}.ics`
}
