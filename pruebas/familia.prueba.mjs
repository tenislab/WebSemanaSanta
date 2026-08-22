/**
 * LA FAMILIA, CUANDO YA SE HA RESUELTO.
 *
 * Llegó dicho así: «que si se acepta se quede guardado en el portal del
 * hermano como familiar en el apartado mi familia, que se ponga aprobado o
 * rechazado; si es rechazado, un porqué».
 *
 * EL FALLO: «Mi familia» solo enseñaba las solicitudes PENDIENTES. En cuanto
 * secretaría resolvía una, desaparecía de la pantalla de quien la había
 * mandado. Si se aprobaba, el niño aparecía arriba entre los que lleva —sin
 * decir en ningún sitio que aquello venía de su solicitud—; si se rechazaba,
 * no quedaba absolutamente nada. Un día ya no estaba, y a llamar a la
 * hermandad a preguntar qué había pasado.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/familia.ts')

  const base = {
    id: 's1', nombre: 'Lucía Prieto', dni: '11111111A', email: 'l@x.es',
    telefono: '', clavePropuesta: '', fecha: '2026-03-01', estado: 'Pendiente',
    tutorId: 'h1',
  }

  // --- Resolver deja constancia ---
  const aprobada = m.resolverSolicitud(base, 'Aprobada', undefined, '2026-03-05')
  caso('queda aprobada', 'Aprobada', aprobada.estado)
  caso('con la fecha en que se resolvió', '2026-03-05', aprobada.resueltaEl)

  const rechazada = m.resolverSolicitud(base, 'Rechazada', 'Ya está en el censo', '2026-03-05')
  caso('o rechazada', 'Rechazada', rechazada.estado)
  caso('con su porqué', 'Ya está en el censo', rechazada.motivoRechazo)

  /*
   * Y UN RECHAZO NUNCA SE QUEDA SIN MOTIVO. «Rechazada» a secas es peor que no
   * decir nada: la persona sabe que le han dicho que no y no sabe si es un
   * error suyo que puede arreglar o una decisión de la hermandad. Si quien
   * rechaza no escribe nada, se pone el texto que al menos dice a dónde ir.
   */
  caso('sin escribir nada, se dice a dónde preguntar', true,
    /secretaría/i.test(m.resolverSolicitud(base, 'Rechazada', '').motivoRechazo))
  caso('ni con espacios en blanco cuela', true,
    /secretaría/i.test(m.resolverSolicitud(base, 'Rechazada', '   ').motivoRechazo))

  /*
   * Si se rechazó y luego se aprueba, el motivo del rechazo se borra. Dejarlo
   * colgando diría lo contrario de lo que ha pasado: «Aprobada — los datos no
   * son correctos».
   */
  caso('al aprobar se limpia el motivo anterior', undefined,
    m.resolverSolicitud(rechazada, 'Aprobada').motivoRechazo)

  // --- Lo que ve el hermano en su área ---
  const lista = [
    { ...base, id: 's1', nombre: 'Resuelta vieja', estado: 'Aprobada', resueltaEl: '2026-01-10' },
    { ...base, id: 's2', nombre: 'Sigue esperando', estado: 'Pendiente' },
    { ...base, id: 's3', nombre: 'Resuelta ayer', estado: 'Rechazada', resueltaEl: '2026-03-04' },
    { ...base, id: 's4', nombre: 'De otro padre', tutorId: 'h9', estado: 'Pendiente' },
  ]
  const mias = m.solicitudesDeMiFamilia(lista, 'h1')

  /* LO RESUELTO NO SE PIERDE: es el fallo entero. */
  caso('salen las tres suyas, resueltas incluidas', 3, mias.length)
  caso('y ninguna de otro', 0, mias.filter((s) => s.nombre === 'De otro padre').length)

  // Primero lo que sigue esperando: es lo único sobre lo que puede hacer algo.
  caso('lo pendiente arriba', 'Sigue esperando', mias[0].nombre)
  // Y detrás, lo más reciente de lo resuelto.
  caso('luego lo resuelto más reciente', 'Resuelta ayer', mias[1].nombre)
  caso('y al final lo antiguo', 'Resuelta vieja', mias[2].nombre)

  caso('de quien no ha pedido nada, lista vacía', 0, m.solicitudesDeMiFamilia(lista, 'h5').length)
  // Sin sesión no se enseña la familia de nadie.
  caso('sin tutor, nada', 0, m.solicitudesDeMiFamilia(lista, null).length)

  // --- Dicho en su idioma, que lo lee quien la mandó ---
  const explicaRechazo = m.explicarSolicitud({ ...base, estado: 'Rechazada', motivoRechazo: 'Faltan sus datos', resueltaEl: '2026-03-04' })
  caso('el rechazo dice el motivo', true, /Faltan sus datos/.test(explicaRechazo))
  caso('y cuándo fue', true, /marzo/.test(explicaRechazo))
  caso('la aprobada remite a la lista de arriba', true,
    /censo/i.test(m.explicarSolicitud({ ...base, estado: 'Aprobada', resueltaEl: '2026-03-04' })))
  caso('y la pendiente dice que esperan noticias', true,
    /revisará/i.test(m.explicarSolicitud(base)))

  caso('cada estado tiene su etiqueta', 3, [
    m.etiquetaDeSolicitud({ ...base, estado: 'Pendiente' }),
    m.etiquetaDeSolicitud({ ...base, estado: 'Aprobada' }),
    m.etiquetaDeSolicitud({ ...base, estado: 'Rechazada' }),
  ].filter((e) => e.texto.length > 3 && e.clase.startsWith('pill--')).length)

  caso('hay motivos hechos para no escribirlos cada vez', true, m.MOTIVOS_DE_RECHAZO.length >= 4)

  await seGuardaYSeEnsena({ caso })
}

/** Que el motivo viaje a la base, y que las dos pantallas que rechazan lo pidan. */
async function seGuardaYSeEnsena({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const lee = (f) => readFile(f, 'utf8')

  const sol = await lee('src/lib/solicitudes.ts')
  caso('el motivo viaja a la base', true, /motivo_rechazo: s\.motivoRechazo/.test(sol))
  caso('y vuelve de ella', true, /motivoRechazo: \(r\.motivo_rechazo/.test(sol))

  const sql = await lee('supabase/TODO-EN-UNO.sql')
  caso('la columna está en el SQL', true, /motivo_rechazo/.test(sql))
  caso('y la fecha de resolución también', true, /resuelta_el/.test(sql))

  /*
   * Las DOS pantallas desde las que se rechaza. Si una de las dos rechaza sin
   * preguntar el motivo, el hermano recibe un «no» mudo según por dónde haya
   * pasado la secretaría ese día, que es la peor manera de fallar: a veces sí
   * y a veces no.
   */
  const censo = await lee('src/pages/app/Hermanos.tsx')
  caso('el censo pide el motivo al rechazar', true, /resolverSolicitud\(/.test(censo))
  const avisos = await lee('src/pages/app/Notificaciones.tsx')
  caso('y el panel de avisos también', true, /resolverSolicitud\(/.test(avisos))

  const familia = await lee('src/components/MiFamilia.tsx')
  caso('«Mi familia» enseña las resueltas', true, /solicitudesDeMiFamilia|explicarSolicitud/.test(familia))
  caso('con el porqué del rechazo', true, /explicarSolicitud/.test(familia))
}
