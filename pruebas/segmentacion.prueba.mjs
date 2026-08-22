/** Sesgos del censo: a quién le llega un comunicado. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/segmentacion.ts')
  const H = (id, extra = {}) => ({
    id, numero: 1, nombre: id, estado: 'Activo', antiguedad: 2000,
    email: `${id}@ejemplo.com`, telefono: '', direccion: '', cuotaAlDia: true,
    iban: null, dni: '', claveAcceso: '', authUserId: null, ...extra,
  })
  const base = { estado: 'Cualquiera', cuota: 'Todos', edad: 'Todos', etiqueta: '', cargo: '', soloConEmail: false, campos: [] }
  const ids = (hs, c) => m.filtrarSegmento(hs, c).map((h) => h.id)

  const hs = [
    H('activo'),
    H('nuevo', { estado: 'Nuevo' }),
    H('baja', { estado: 'Baja' }),
    H('debe', { cuotaAlDia: false }),
    H('sincorreo', { email: '' }),
    H('nino', { fechaNacimiento: '2015-05-05' }),
    H('costalero', { etiquetas: ['Costalero'] }),
  ]

  caso('«Cualquiera» los coge a todos', 7, ids(hs, base).length)
  caso('«Todos» deja fuera las bajas', false, ids(hs, { ...base, estado: 'Todos' }).includes('baja'))
  caso('solo activos', ['activo', 'debe', 'sincorreo', 'nino', 'costalero'], ids(hs, { ...base, estado: 'Activo' }))
  caso('solo nuevos', ['nuevo'], ids(hs, { ...base, estado: 'Nuevo' }))
  caso('con la cuota pendiente', ['debe'], ids(hs, { ...base, cuota: 'Pendiente' }))
  caso('solo con correo deja fuera al que no tiene', false,
    ids(hs, { ...base, soloConEmail: true }).includes('sincorreo'))
  caso('por etiqueta', ['costalero'], ids(hs, { ...base, etiqueta: 'Costalero' }))
  caso('menores de edad', ['nino'], ids(hs, { ...base, edad: 'Menores' }))
  caso('sin fecha de nacimiento no cuenta como mayor', [], ids(hs, { ...base, edad: 'Mayores' }))

  const conCampos = [H('conllave', { campos: { llave: 'sí' } }), H('sinllave', { campos: { llave: 'no' } }), H('vacio')]
  caso('por campo propio', ['conllave'], ids(conCampos, { ...base, campos: [{ campoId: 'llave', valor: 'sí' }] }))
  caso('condición de campo vacía no filtra', 3, ids(conCampos, { ...base, campos: [{ campoId: 'llave', valor: '' }] }).length)

  const hoy = new Date(2026, 7, 18)
  caso('edad justo el día del cumpleaños', 18, m.edadDe('2008-08-18', hoy))
  caso('edad el día antes', 17, m.edadDe('2008-08-19', hoy))
  caso('sin fecha, null', null, m.edadDe(undefined, hoy))
  caso('fecha inválida, null', null, m.edadDe('no-es-fecha', hoy))

  await sesgarPorCargo({ cargar, caso })
}

/**
 * SESGAR POR CARGO: «solo a la junta».
 *
 * Faltaba, y era el sesgo que más se pide: una hermandad convoca a su junta
 * cada mes. Sin esto había que ir marcando a mano quién es de la junta cada
 * vez, o mandárselo a los 800 — lo primero se abandona y lo segundo no se hace.
 */
async function sesgarPorCargo({ cargar, caso }) {
  const m = await cargar('src/lib/segmentacion.ts')
  const H = (id, extra = {}) => ({
    id, numero: 1, nombre: id, estado: 'Activo', antiguedad: 2000,
    email: `${id}@ejemplo.com`, telefono: '', direccion: '', cuotaAlDia: true,
    iban: null, dni: '', claveAcceso: '', authUserId: null, ...extra,
  })
  const base = { estado: 'Cualquiera', cuota: 'Todos', edad: 'Todos', etiqueta: '', cargo: '', soloConEmail: false, campos: [] }
  const ids = (hs, c) => m.filtrarSegmento(hs, c).map((h) => h.id)

  const censo = [
    H('mayor', { cargo: 'Hermano Mayor' }),
    H('tesorero', { cargo: 'Tesorero/a' }),
    H('vocal', { cargo: 'Vocal' }),
    H('depie', { cargo: 'Hermano de a pie' }),
    H('sincargo'),
    H('vacio', { cargo: '   ' }),
  ]

  caso('sin pedir cargo salen todos', 6, ids(censo, base).length)
  caso('«toda la junta» son los que llevan cargo',
    ['mayor', 'tesorero', 'vocal'], ids(censo, { ...base, cargo: '__junta' }))
  /*
   * «Hermano de a pie» está en el catálogo pero NO es junta: es lo que se le
   * pone a quien no lleva ninguno. Si contara, «solo a la junta» acabaría
   * siendo «a todo el censo», que es exactamente lo contrario de lo que se
   * pide — y nadie lo notaría hasta que 800 personas recibieran la convocatoria
   * de una reunión a la que no van.
   */
  caso('«Hermano de a pie» no es junta', false, ids(censo, { ...base, cargo: '__junta' }).includes('depie'))
  caso('ni quien no tiene cargo', false, ids(censo, { ...base, cargo: '__junta' }).includes('sincargo'))
  caso('ni un cargo en blanco', false, ids(censo, { ...base, cargo: '__junta' }).includes('vacio'))

  // Y un cargo concreto, para cuando se escribe solo a quien toca.
  caso('un cargo concreto', ['tesorero'], ids(censo, { ...base, cargo: 'Tesorero/a' }))
  caso('uno que no lleva nadie', 0, ids(censo, { ...base, cargo: 'Fiscal' }).length)

  // Se combina con lo demás: «la junta que está al día de cuota».
  const conDeuda = [...censo, H('mayordebe', { cargo: 'Mayordomo/Prioste', cuotaAlDia: false })]
  caso('se combina con la cuota', false,
    ids(conDeuda, { ...base, cargo: '__junta', cuota: 'AlDia' }).includes('mayordebe'))

  // Y el nombre del sesgo lo dice, que es lo que se guarda en el comunicado.
  caso('la etiqueta dice que es la junta', true,
    /de la junta/.test(m.etiquetaSegmento({ ...base, cargo: '__junta' })))
  caso('y con un cargo concreto, cuál', true,
    /Tesorero/.test(m.etiquetaSegmento({ ...base, cargo: 'Tesorero/a' })))

  await elFormularioHabla({ caso })
  await lasCincoOpcionesDelDesplegable({ cargar, caso })
}

/**
 * QUE EL FORMULARIO DIGA POR QUÉ NO GUARDA.
 *
 * Había tres `return` mudos: sin título, sin cuerpo, o con «redes sociales»
 * elegido y ninguna red marcada. Se pulsaba Guardar, NO PASABA NADA, y no
 * había forma de saber qué faltaba. Eso no se lee como «me falta un dato», se
 * lee como «la aplicación está rota».
 */
async function elFormularioHabla({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/pages/app/Comunicados.tsx', 'utf8')

  // Ningún `return` a secas dentro del guardado.
  const guardar = src.slice(src.indexOf('const data = new FormData(form)'))
  const mudos = (guardar.slice(0, 2600).match(/^\s*if \([^)]*\) return$/gm) ?? []).length
  caso('no queda ningún return mudo', 0, mudos)

  caso('dice si falta el título', true, /Ponle un título al comunicado/.test(src))
  caso('dice si está vacío', true, /El comunicado está vacío/.test(src))
  caso('dice si falta el canal', true, /Elige al menos un canal/.test(src))
  caso('dice si faltan las redes', true, /marca en cuáles se publica/.test(src))
  caso('dice si falta la fecha', true, /dile para qué día/.test(src))
  // Y el que ya hablaba, ahora dice qué hacer y no solo qué pasa.
  caso('y con un sesgo vacío, qué hacer', true, /guárdalo como borrador y ajústalo luego/.test(src))
}


/**
 * LAS CINCO OPCIONES DEL DESPLEGABLE, UNA POR UNA.
 *
 * El fallo reportado: «comunicados no deja mandar a la junta». Al mirarlo, no
 * era la junta — era que de las CINCO opciones de fábrica, cuatro alcanzaban a
 * cero personas. Quien las resolvía solo sabía dos cosas: los destinatarios que
 * empiezan por «Etiqueta: » y los que contienen la palabra «todos». Todo lo
 * demás caía en un `return []` y el comunicado se guardaba como «Enviado» sin
 * que le llegara a nadie.
 *
 * Esta prueba recorre `SEGMENTOS` de verdad, no una copia: si mañana alguien
 * añade una opción al desplegable y no la enseña a resolver, esto se pone rojo
 * antes de que se mande el primer comunicado al vacío.
 */
async function lasCincoOpcionesDelDesplegable({ cargar, caso }) {
  const m = await cargar('src/lib/segmentacion.ts')
  const roles = await cargar('src/lib/rolesPapeleta.ts')
  const { SEGMENTOS } = await cargar('src/data/comunicados.ts')

  const H = (id, extra = {}) => ({
    id, numero: 1, nombre: id, estado: 'Activo', antiguedad: 2000,
    email: `${id}@ejemplo.com`, telefono: '', direccion: '', cuotaAlDia: true,
    iban: null, dni: '', claveAcceso: '', authUserId: null, ...extra,
  })
  const censo = [
    H('aldia'),
    H('debe', { cuotaAlDia: false }),
    H('nuevodebe', { estado: 'Nuevo', cuotaAlDia: false }),
    H('tesorero', { cargo: 'Tesorero/a' }),
    H('depie', { cargo: 'Hermano de a pie' }),
    H('baja', { estado: 'Baja' }),
    H('civil', { cuotaAlDia: false, civil: true }),
  ]
  /** Resuelve un nombre del desplegable igual que lo hace la pantalla. */
  const aQuien = (nombre, conSitio = new Set()) => {
    const papeleta = m.segmentoDePapeleta(nombre)
    const criterios = m.criteriosDeSegmento(nombre)
    if (!papeleta && !criterios) return null            // no se sabe resolver
    const base = criterios ?? { ...m.CRITERIOS_POR_DEFECTO, soloConEmail: false }
    let lista = m.filtrarSegmento(censo, base)
    if (papeleta === 'con') lista = lista.filter((h) => conSitio.has(h.id))
    if (papeleta === 'sin') lista = lista.filter((h) => !conSitio.has(h.id))
    return lista.map((h) => h.id)
  }

  // NINGUNA opción del desplegable puede quedarse sin resolver. Esta es la
  // que habría cazado el fallo el primer día.
  for (const nombre of SEGMENTOS) {
    caso(`«${nombre}» se sabe a quién va`, true, aQuien(nombre) !== null)
  }

  caso('«Todos los hermanos» son todos menos las bajas',
    ['aldia', 'debe', 'nuevodebe', 'tesorero', 'depie', 'civil'], aQuien('Todos los hermanos'))
  caso('«Hermanos con cuota al día»', ['aldia', 'tesorero', 'depie'], aQuien('Hermanos con cuota al día'))
  caso('«Hermanos con cuota pendiente»', ['debe', 'nuevodebe'], aQuien('Hermanos con cuota pendiente'))
  // El civil contratado no debe cuota: nace sin ella y nunca se le emite un
  // recibo. Si entrara aquí le llegarían todos los avisos de morosidad.
  caso('el personal civil no debe cuota', false, aQuien('Hermanos con cuota pendiente').includes('civil'))
  caso('«Junta de Gobierno» es quien lleva cargo', ['tesorero'], aQuien('Junta de Gobierno'))
  caso('y «Hermano de a pie» no es junta', false, aQuien('Junta de Gobierno').includes('depie'))

  // El nuevo entra. Empezar en «Activo» dejaba fuera a TODO el censo de una
  // hermandad recién montada, porque un hermano creado a mano nace «Nuevo».
  caso('los recién dados de alta también reciben', true, aQuien('Todos los hermanos').includes('nuevodebe'))
  caso('el sesgo de partida no filtra por estado', 'Todos', m.CRITERIOS_POR_DEFECTO.estado)

  // La papeleta.
  const conSitio = new Set(['aldia', 'tesorero'])
  caso('«Nazarenos con papeleta de sitio»', ['aldia', 'tesorero'],
    aQuien('Nazarenos con papeleta de sitio', conSitio))
  caso('los que NO la tienen', ['debe', 'nuevodebe', 'depie', 'civil'],
    aQuien('Sin papeleta de sitio', conSitio))

  // Nombres que la hermandad se inventa en su catálogo de segmentos.
  caso('«Hermanos que deben cuota»', ['debe', 'nuevodebe'], aQuien('Hermanos que deben cuota'))
  caso('«Junta de Gobierno saliente»', ['tesorero'], aQuien('Junta de Gobierno saliente'))
  caso('sin tilde también', ['aldia', 'tesorero', 'depie'], aQuien('Hermanos al dia'))
  caso('compuesto: junta con papeleta', ['tesorero'], aQuien('Junta de Gobierno con papeleta', conSitio))
  caso('«Bajas» solo si se piden por su nombre', ['baja'], aQuien('Bajas'))
  caso('un nombre que no dice nada no se inventa a quién', null, aQuien('Boletín de primavera'))

  // Quién tiene sitio de verdad en el cortejo.
  const P = (hermanoId, extra = {}) => ({ id: hermanoId, numero: 1, hermanoId, anio: 2027, tramoId: 't1', importe: 18, estado: 'Asignada', fechaSolicitud: '', ...extra })
  const papeletas = [
    P('sale'),
    P('pagada', { estado: 'Pagada' }),
    P('entregada', { estado: 'Entregada' }),
    P('simbolica', { tramoId: null }),
    P('solicitada', { estado: 'Solicitada' }),
    P('anulada', { estado: 'Anulada' }),
    P('otroanio', { anio: 2026 }),
  ]
  const sitio = roles.conPapeletaDeSitio(papeletas, 2027)
  caso('tiene sitio quien lleva tramo', true, sitio.has('sale') && sitio.has('pagada') && sitio.has('entregada'))
  // La simbólica es justamente la de quien NO sale: no da sitio en el cortejo.
  caso('la simbólica no da sitio', false, sitio.has('simbolica'))
  caso('ni la que solo está solicitada', false, sitio.has('solicitada'))
  caso('ni la anulada', false, sitio.has('anulada'))
  caso('ni la del año pasado', false, sitio.has('otroanio'))

  await elCargoVieneDeDosSitios({ cargar, caso })
  await laPantallaLoUsa({ caso })
}

/**
 * EL CARGO PUEDE ESTAR EN DOS SITIOS, Y HAY QUE MIRAR LOS DOS.
 *
 * Este es el fallo de verdad detrás de «no puedo mandarle el comunicado solo a
 * la junta». Una persona lleva cargo por la ficha del censo (que es donde se
 * reparten desde la pestaña de roles) o por su fila de `personal` (la cuenta
 * con la que entra al panel). Y cuando están las dos, manda la de personal: es
 * la que decide qué ve al entrar.
 *
 * Mirando solo la ficha del censo, la tesorera de la hermandad —que entra al
 * panel como tesorera todos los días— no recibía la convocatoria de la junta.
 * Sin error y sin aviso: simplemente no salía en la lista.
 */
async function elCargoVieneDeDosSitios({ cargar, caso }) {
  const m = await cargar('src/lib/segmentacion.ts')
  const per = await cargar('src/lib/personal.ts')
  const H = (id, extra = {}) => ({
    id, numero: 1, nombre: id, estado: 'Activo', antiguedad: 2000,
    email: `${id}@ejemplo.com`, telefono: '', direccion: '', cuotaAlDia: true,
    iban: null, dni: '', claveAcceso: '', authUserId: null, ...extra,
  })
  const P = (id, cargo, extra = {}) => ({
    id, nombre: id, email: `${id}@ejemplo.com`, clave: 'x', cargo,
    activo: true, fechaAlta: '2026-01-01', authUserId: null, ...extra,
  })

  const censo = [
    H('maria'),                                   // sin cargo en su ficha…
    H('juan', { cargo: 'Fiscal' }),               // …con cargo solo en la ficha
    H('ana', { cargo: 'Vocal' }),                 // …con cargo en las dos, distinto
    H('pedro'),                                   // ni una cosa ni la otra
    H('luis', { authUserId: 'uid-luis' }),        // cruzado por cuenta, no por correo
    H('sara'),                                    // su fila está desactivada
  ]
  const personal = [
    P('maria', 'Tesorero/a'),
    P('ana', 'Secretario/a'),
    P('cuenta-luis', 'Mayordomo/Prioste', { email: 'otro@ejemplo.com', authUserId: 'uid-luis' }),
    P('sara', 'Vocal', { activo: false }),
    P('externo', 'Hermano Mayor', { email: 'externo@ejemplo.com' }),   // no está en el censo
  ]
  const cargos = per.cargosEfectivos(censo, personal)

  caso('la fila de personal da cargo aunque la ficha no lo tenga', 'Tesorero/a', cargos.get('maria'))
  caso('sin fila de personal manda la ficha', 'Fiscal', cargos.get('juan'))
  // La de personal gana: es la que mira `cargoDeCuenta` para decidir qué ve al
  // entrar. Si aquí ganara la ficha, la lista diría una cosa y el panel otra.
  caso('con las dos, manda la de personal', 'Secretario/a', cargos.get('ana'))
  caso('quien no lleva nada, no lleva nada', undefined, cargos.get('pedro'))
  caso('también se cruza por cuenta, no solo por correo', 'Mayordomo/Prioste', cargos.get('luis'))
  // A quien se le ha quitado el acceso ya no es junta.
  caso('una fila desactivada no da cargo', undefined, cargos.get('sara'))
  caso('personal que no está en el censo no inventa hermanos', 6, censo.length)

  const base = { estado: 'Cualquiera', cuota: 'Todos', edad: 'Todos', etiqueta: '', cargo: '', soloConEmail: false, campos: [] }
  const junta = m.filtrarSegmento(censo, { ...base, cargo: '__junta' }, new Map(), cargos).map((h) => h.id)
  caso('«solo a la junta» los coge a todos', ['maria', 'juan', 'ana', 'luis'], junta)
  caso('y a la tesorera la primera', true, junta.includes('maria'))
  // Y un cargo concreto sale del sitio bueno: Ana es Secretaria por su cuenta,
  // aunque su ficha del censo siga diciendo «Vocal».
  caso('un cargo concreto sale del sitio que manda', ['ana'],
    m.filtrarSegmento(censo, { ...base, cargo: 'Secretario/a' }, new Map(), cargos).map((h) => h.id))
  caso('y el viejo de la ficha ya no cuenta', 0,
    m.filtrarSegmento(censo, { ...base, cargo: 'Vocal' }, new Map(), cargos).length)
  // Sin el mapa, se sigue mirando la ficha: las pantallas que aún no lo pasan
  // no se quedan sin nada.
  caso('sin el mapa, la ficha del censo', ['juan', 'ana'],
    m.filtrarSegmento(censo, { ...base, cargo: '__junta' }).map((h) => h.id))

  /*
   * Y LA JUNTA QUE NO ESTÁ EN EL CENSO.
   *
   * Hay hermandades que dan de alta a su junta por Personal y punto: cada uno
   * con su cuenta para entrar, ninguno con ficha de hermano. Es lo que hace la
   * demostración. Para esos, «mandar solo a la junta» no encontraba a NADIE,
   * porque se busca en el censo y en el censo no están.
   *
   * No tienen área donde recibir el aviso, pero tienen correo.
   */
  const soloCuenta = per.personalDelSegmento({ ...base, cargo: '__junta' }, personal, censo)
  caso('la junta sin ficha se alcanza por correo', ['externo'], soloCuenta.map((p) => p.id))
  // Quien ya está en el censo va por ahí: no se le manda dos veces.
  caso('no se duplica a quien sí tiene ficha', false, soloCuenta.some((p) => p.id === 'maria'))
  caso('ni por cuenta', false, soloCuenta.some((p) => p.id === 'cuenta-luis'))
  caso('ni las filas desactivadas', false, soloCuenta.some((p) => p.id === 'sara'))
  caso('un cargo concreto, solo ese', 1,
    per.personalDelSegmento({ ...base, cargo: 'Hermano Mayor' }, personal, censo).length)
  caso('y otro cargo, ninguno', 0,
    per.personalDelSegmento({ ...base, cargo: 'Fiscal' }, personal, censo).length)
  /*
   * SOLO cuando el cargo es lo único que se pide. Un miembro del personal no
   * tiene cuota, ni papeleta, ni fecha de nacimiento: si entrara en «la junta
   * que debe cuota» estaría entrando por no tener el dato, que es al revés. Y
   * en «todos los hermanos» no pinta nada, porque no es hermano.
   */
  caso('sin cargo pedido, ninguno', 0, per.personalDelSegmento(base, personal, censo).length)
  caso('con la cuota de por medio, ninguno', 0,
    per.personalDelSegmento({ ...base, cargo: '__junta', cuota: 'Pendiente' }, personal, censo).length)
  caso('con una etiqueta de por medio, ninguno', 0,
    per.personalDelSegmento({ ...base, cargo: '__junta', etiqueta: 'Costalero' }, personal, censo).length)
  caso('con la edad de por medio, ninguno', 0,
    per.personalDelSegmento({ ...base, cargo: '__junta', edad: 'Mayores' }, personal, censo).length)
  caso('pidiendo las bajas, ninguno', 0,
    per.personalDelSegmento({ ...base, cargo: '__junta', estado: 'Baja' }, personal, censo).length)
  // Y «Hermano de a pie» no es junta ni aquí.
  caso('«Hermano de a pie» tampoco cuenta aquí', 0,
    per.personalDelSegmento({ ...base, cargo: '__junta' }, [
      { id: 'x', nombre: 'x', email: 'x@ejemplo.com', clave: 'x', cargo: 'Hermano de a pie', activo: true, fechaAlta: '', authUserId: null },
    ], censo).length)
  // Sin correo no se le puede mandar nada: no cuenta como alcanzado.
  caso('sin correo no cuenta', 0,
    per.personalDelSegmento({ ...base, cargo: '__junta' }, [
      { id: 'y', nombre: 'y', email: '', clave: 'x', cargo: 'Vocal', activo: true, fechaAlta: '', authUserId: null },
    ], censo).length)
}

/** Y que la pantalla llame de verdad a lo que se acaba de probar. */
async function laPantallaLoUsa({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = (await readFile('src/pages/app/Comunicados.tsx', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')

  caso('la pantalla resuelve el nombre del segmento', true, /criteriosDeSegmento\(/.test(src))
  caso('y mira la papeleta del año', true, /segmentoDePapeleta\(/.test(src))
  caso('con quién tiene sitio de verdad', true, /conPapeletaDeSitio\(/.test(src))
  // La etiqueta se reconoce por el prefijo y no por si encuentra a alguien: si
  // no, «Etiqueta: Junta» sin nadie dentro caería en la regla de la junta y
  // acabaría yéndose a los doce de la junta.
  caso('la etiqueta se reconoce por el prefijo', true, /startsWith\(PREFIJO_ETIQUETA\)/.test(src))
  caso('se distingue «no hay nadie» de «no sé quién»', true, /reconocido/.test(src))
  caso('y se dice antes de mandarlo', true, /No sabemos a quién se refiere/.test(src))
  caso('se ve a cuántos alcanza al elegirlo', true, /Le llegará a /.test(src))
  // El cargo se mira en los dos sitios: la ficha del censo y la fila de
  // personal. Si esta pantalla solo mirara la ficha, «solo a la junta» se
  // dejaría fuera a quien lleva el cargo por su cuenta de acceso.
  caso('el cargo se mira en los dos sitios', true, /cargosEfectivos\(/.test(src))

  // Y en Hermanos igual, o el mismo sesgo guardado devuelve gente distinta
  // según en qué pantalla se abra.
  const herm = (await readFile('src/pages/app/Hermanos.tsx', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')
  caso('y en Hermanos también', true, /cargosEfectivos\(/.test(herm))
  caso('el sesgo del censo lo usa', true, /filtrarSegmento\(hermanos, limpiarCriterios\(criterios\), roles, cargosPorHermano\)/.test(herm))
}
