/** Enlaces propios y fichas de la web pública (noticias y titulares). */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/webPublica.ts')

  const titular = (x) => ({ id: 't1', nombre: '', fotoDataUrl: null, descripcion: '', autoria: '', parrafos: [], ...x })

  // --- El enlace de un titular ---
  caso('el enlace sale del nombre', 'ntro-padre-jesus', m.slugTitular(titular({ nombre: 'Ntro. Padre Jesús' })))
  caso('el enlace guardado manda sobre el nombre', 'el-senor', m.slugTitular(titular({ nombre: 'Otro nombre', slug: 'el-senor' })))
  caso('sin nombre se cae al id', 't1', m.slugTitular(titular({ nombre: '' })))
  caso('un nombre de solo signos se cae al id', 't1', m.slugTitular(titular({ nombre: '¿¡...!?' })))
  caso('un enlace en blanco no cuenta', 'maria', m.slugTitular(titular({ nombre: 'María', slug: '   ' })))

  // --- ¿Hay ficha que abrir? ---
  caso('sin texto ni fotos no hay ficha', false, m.titularConFicha(titular({})))
  caso('un párrafo vacío no es ficha', false, m.titularConFicha(titular({ parrafos: [{ id: 'p', subtitulo: '  ', texto: '' }] })))
  caso('con texto sí hay ficha', true, m.titularConFicha(titular({ parrafos: [{ id: 'p', subtitulo: '', texto: 'Su historia.' }] })))
  caso('solo con un subtítulo ya hay ficha', true, m.titularConFicha(titular({ parrafos: [{ id: 'p', subtitulo: 'Hechura', texto: '' }] })))
  caso('con fotos sueltas hay ficha', true, m.titularConFicha(titular({ fotos: ['data:x'] })))
  caso('un titular de una versión vieja no revienta', false, m.titularConFicha({ id: 't', nombre: 'X', fotoDataUrl: null, descripcion: '', autoria: '', parrafos: undefined }))

  // --- Marca de agua ---
  const web = (x) => ({ ...m.WEB_PUBLICA_INICIAL, ...x })
  caso('sin marca no se pinta nada', '', m.marcaDeAgua(web({ marcaAgua: false, titulo: 'Vera-Cruz' }), 'Hdad. de la Vera-Cruz'))
  caso('con marca manda el título de la web', 'Vera-Cruz', m.marcaDeAgua(web({ marcaAgua: true, titulo: 'Vera-Cruz' }), 'Hdad. de la Vera-Cruz'))
  caso('sin título se usa el nombre legal', 'Hdad. de la Vera-Cruz', m.marcaDeAgua(web({ marcaAgua: true, titulo: '' }), 'Hdad. de la Vera-Cruz'))
  caso('sin ninguno de los dos, vacío', '', m.marcaDeAgua(web({ marcaAgua: true, titulo: '  ' }), '  '))

  // --- Lo guardado por una versión anterior se completa ---
  const migrada = m.conDefectos({ titulares: [{ id: 'v', nombre: 'Antiguo' }] })
  caso('un titular viejo gana los campos nuevos', true, Array.isArray(migrada.titulares[0].fotos))
  caso('el aviso de derechos arranca vacío', '', migrada.avisoFotos)
  caso('la marca de agua arranca apagada', false, migrada.marcaAgua)

  // --- Cuenta atrás (W5) ---
  const hoy = new Date(2026, 7, 19) // 19 de agosto de 2026, hora local
  caso('cuenta los días que faltan', 219, m.diasHasta('2027-03-26', hoy))
  caso('hoy es cero', 0, m.diasHasta('2026-08-19', hoy))
  caso('mañana es uno', 1, m.diasHasta('2026-08-20', hoy))
  caso('ayer es menos uno', -1, m.diasHasta('2026-08-18', hoy))
  caso('sin fecha no hay cuenta', null, m.diasHasta(undefined, hoy))
  caso('una fecha en blanco tampoco', null, m.diasHasta('   ', hoy))
  caso('una fecha inventada tampoco', null, m.diasHasta('no-es-fecha', hoy))
  // A las once de la noche de la víspera tiene que decir «1 día», no «0».
  caso('cuenta días, no horas', 1, m.diasHasta('2026-08-20', new Date(2026, 7, 19, 23, 50)))
  // Cambio de hora de marzo: la noche que dura 23 horas no puede comerse un día.
  caso('el cambio de hora no se come un día', 31, m.diasHasta('2027-04-01', new Date(2027, 2, 1)))

  // --- Estilos de un clic (W5) ---
  const boletin = m.ESTILOS.find((e) => e.id === 'boletin')
  caso('«Boletín» trae capitular', true, m.cambiosDeEstilo(boletin).letraCapital)
  caso('«Tradicional» no', false, m.cambiosDeEstilo(m.ESTILOS.find((e) => e.id === 'tradicional')).letraCapital)
  const conBoletin = { ...m.WEB_PUBLICA_INICIAL, ...m.cambiosDeEstilo(boletin) }
  caso('se reconoce el estilo puesto', 'boletin', m.estiloActual(conBoletin)?.id)
  caso('al quitar la capitular ya no es ese estilo', null, m.estiloActual({ ...conBoletin, letraCapital: false }))

  // --- Migración de W5 ---
  const vieja = m.conDefectos({ titulo: 'X' })
  caso('las franjas alternas vienen puestas', true, vieja.fondosAlternos)
  caso('la foto a sangre arranca vacía', null, vieja.sangre.fotoDataUrl)
  caso('sin cifras de fábrica', 0, vieja.cifras.length)
  // Lo guardado por una versión anterior no traía `sangre`: no puede reventar.
  caso('una web antigua no revienta al leer la sangre', '', m.conDefectos({ sangre: undefined }).sangre.texto)

  // --- Peso de la web (W6) ---
  const mb = (n) => 'x'.repeat(Math.round(n * 1024 * 1024))
  caso('cuenta los bytes de lo guardado', true, m.pesoWeb({ ...m.WEB_PUBLICA_INICIAL }) > 100)
  caso('una foto suma su peso', true,
    m.pesoWeb({ ...m.WEB_PUBLICA_INICIAL, avisoFotos: mb(1) }) - m.pesoWeb(m.WEB_PUBLICA_INICIAL) > 1000000)
  // Cuenta BYTES, no letras: una eñe ocupa dos bytes en UTF-8, una ene uno.
  caso('los acentos pesan más que las letras sueltas', 1, m.pesoWeb({ x: 'ñ' }) - m.pesoWeb({ x: 'n' }))

  caso('en kB si es pequeña', '200 kB', m.avisoDePeso(200 * 1024).peso)
  caso('en MB si es grande', '2,5 MB', m.avisoDePeso(2.5 * 1024 * 1024).peso)
  caso('media web ligera está bien', 'ok', m.avisoDePeso(900 * 1024).nivel)
  caso('dos megas ya avisan', 'aviso', m.avisoDePeso(2 * 1024 * 1024).nivel)
  caso('cinco megas es malo', 'malo', m.avisoDePeso(5 * 1024 * 1024).nivel)
  caso('los segundos salen de 400 kB/s', 10, m.avisoDePeso(4_000_000).segundos)
  caso('una web vacía no da segundos', 0, m.avisoDePeso(0).segundos)

  // --- Accesibilidad (W7) ---
  caso('lo guardado antes eran imágenes sueltas', 'a.jpg', m.aFotosWeb(['a.jpg'])[0].url)
  caso('y sin texto alternativo', '', m.aFotosWeb(['a.jpg'])[0].alt)
  caso('lo nuevo se respeta', 'el paso', m.aFotosWeb([{ url: 'a.jpg', alt: 'el paso' }])[0].alt)
  caso('lo que no es lista se ignora', 0, m.aFotosWeb(undefined).length)
  caso('las entradas vacías se caen', 0, m.aFotosWeb(['', null, { alt: 'x' }]).length)

  const conFotos = {
    ...m.WEB_PUBLICA_INICIAL,
    titulares: [{ id: 't', nombre: 'El Señor', fotoDataUrl: 'x', descripcion: '', autoria: '', parrafos: [] }],
    albumes: [{ id: 'a', titulo: 'Salida', descripcion: '', fecha: '', fotos: [{ id: 'f', fotoDataUrl: 'x', pie: '' }] }],
    noticias: [{ id: 'n', titulo: 'Gobergo', fecha: '', resumen: '', fotoDataUrl: 'x', publicada: true }],
  }
  caso('encuentra las fotos sin describir', 3, m.fotosSinDescribir(conFotos).length)
  caso('dice dónde está cada una', 'Titulares,Galería,Actualidad', m.fotosSinDescribir(conFotos).map((f) => f.donde).join(','))
  const descritas = {
    ...conFotos,
    titulares: [{ ...conFotos.titulares[0], alt: 'El Señor con la cruz' }],
    albumes: [{ ...conFotos.albumes[0], fotos: [{ id: 'f', fotoDataUrl: 'x', pie: 'La cruz de guía' }] }],
    noticias: [{ ...conFotos.noticias[0], altFoto: 'El cabildo' }],
  }
  caso('descritas, no avisa', 0, m.fotosSinDescribir(descritas).length)
  // Un titular sin foto no puede tener texto alternativo que falte.
  caso('sin foto no falta nada', 0, m.fotosSinDescribir({ ...m.WEB_PUBLICA_INICIAL, noticias: [], titulares: [], albumes: [] }).length)

  caso('el idioma viene puesto', 'es', m.conDefectos({}).idioma)
  caso('el resumen en otra lengua arranca vacío', '', m.conDefectos({}).resumenOtroIdioma.texto)
  caso('y con el inglés propuesto', 'en', m.conDefectos({}).resumenOtroIdioma.idioma)

  // --- Secciones en borrador (W8) ---
  caso('lo guardado antes no tiene borradores', false, Boolean(m.conDefectos({}).secciones[0].borrador))
  const guion = m.GUION_HISTORIA
  caso('el guion de la historia trae cuatro apartados', 4, guion.parrafos.length)
  caso('y todos con subtítulo', true, guion.parrafos.every((p) => p.subtitulo.trim().length > 0))
  caso('el guion de la estación trae itinerario', true, m.GUION_ESTACION.itinerario.length >= 5)
  caso('con paradas destacadas', true, m.GUION_ESTACION.itinerario.some((p) => p.destacada))
  caso('el guion de caridad trae título', 'Bolsa de caridad', m.GUION_PAGINA_CARIDAD.titulo)
  // El guion de la estación deja la fecha exacta vacía: es de cada hermandad.
  caso('el guion no inventa la fecha de salida', '', m.GUION_ESTACION.fechaSalida)

  // --- Noticias (W3), que comparten mecánica ---
  caso('el enlace de una noticia sale del titular', 'cabildo-general', m.slugNoticia({ id: 'n', titulo: 'Cabildo General', fecha: '', resumen: '', fotoDataUrl: null, publicada: true }))

  await elCartelYLaCaridad({ caso, m })
  await elEnlaceDeUnCulto({ caso, m })
  await laHemeroteca({ caso, m })
}

/**
 * EL CARTEL Y LA CARIDAD, las dos secciones nuevas.
 *
 * Lo que se comprueba es lo que rompe una web ya escrita: que una guardada
 * antes de que existieran no se caiga al leerlas, y que entren EN SU SITIO y
 * no detrás de «Contacto», que es el cierre de la web.
 */
async function elCartelYLaCaridad({ caso, m }) {
  // Una web guardada antes de que existieran las secciones nuevas.
  const vieja = m.conDefectos({ titulo: 'Vera-Cruz', secciones: [
    { tipo: 'historia', visible: true },
    { tipo: 'cultos', visible: true },
    { tipo: 'contacto', visible: true },
  ] })
  const tipos = vieja.secciones.map((s) => s.tipo)
  caso('a una web vieja se le añaden las secciones nuevas', true,
    tipos.includes('cartel') && tipos.includes('caridad'))
  // EN SU SITIO. Añadidas al final quedaban detrás de Contacto, que es el
  // cierre de la web: parecía un despiste y había que arrastrarlas a mano.
  caso('y no detrás de Contacto', true, tipos.indexOf('cartel') < tipos.indexOf('contacto'))
  caso('el cartel va después de los cultos', true, tipos.indexOf('cultos') < tipos.indexOf('cartel'))
  // Y lo que ya tenía, intacto y en su orden.
  caso('lo que ya tenía sigue', true, tipos.indexOf('historia') < tipos.indexOf('cultos'))

  // Apagadas de fábrica: una sección de obra social vacía queda peor que no
  // tenerla, y no todas las hermandades tienen cartel propio.
  const nueva = m.conDefectos({})
  caso('el cartel arranca apagado', false, nueva.secciones.find((s) => s.tipo === 'cartel').visible)
  caso('la caridad también', false, nueva.secciones.find((s) => s.tipo === 'caridad').visible)

  // Y los datos, con forma aunque no estuvieran guardados: sin esto la página
  // se cae al leer `web.caridad.cifras`.
  caso('la caridad arranca con sus listas', true,
    Array.isArray(nueva.caridad.cifras) && Array.isArray(nueva.caridad.comoAyudar))
  caso('y los carteles también', true, Array.isArray(nueva.carteles))
  // Un cartel guardado a medias se completa con los huecos vacíos.
  const aMedias = m.conDefectos({ carteles: [{ id: 'c1', titulo: 'Cartel 2027' }] })
  caso('un cartel a medias se completa', '', aMedias.carteles[0].autor)
  caso('sin perder lo que traía', 'Cartel 2027', aMedias.carteles[0].titulo)

  // El orden de los carteles lo manda el AÑO, no cuándo se subieron.
  const ordenados = m.cartelesOrdenados([
    { id: 'a', anio: '2019' }, { id: 'b', anio: '' }, { id: 'c', anio: '2027' },
  ])
  caso('el cartel más reciente va primero', 'c', ordenados[0].id)
  // Y uno sin año no se cuela por delante del de este año solo por subirse
  // después.
  caso('el que no tiene año va al final', 'b', ordenados[2].id)

  /*
   * Y NO SE CAE CON DATOS ROTOS. Esto se lee de un JSON que lleva años
   * guardándose: puede venir de una copia antigua o de una versión a medio
   * migrar. Un `carteles: null` reventaba con «.map is not a function» y
   * dejaba la web ENTERA en blanco, sin decir por qué.
   */
  const rota = m.conDefectos({ carteles: null, caridad: { cifras: 'no soy una lista', conQuien: 42 } })
  caso('con los carteles rotos, lista vacía', 0, rota.carteles.length)
  caso('con las cifras rotas, lista vacía', 0, rota.caridad.cifras.length)
  caso('y con lo demás roto, también', 0, rota.caridad.conQuien.length)
  caso('la web sigue en pie', true, typeof rota.titulo === 'string')

  caso('el guion de la caridad trae cifras', 3, m.GUION_CARIDAD.cifras.length)
  caso('con número y concepto', true, m.GUION_CARIDAD.cifras.every((c) => c.cifra && c.concepto))
}

/**
 * EL ENLACE DE UN CULTO.
 *
 * Lleva el año pegado, y no es un capricho: los cultos de una hermandad se
 * llaman todos igual año tras año («Solemne Quinario»), y sin el año dos
 * cultos de dos años distintos comparten dirección — el primero que se
 * encuentra gana y el otro no se puede abrir.
 */
async function elEnlaceDeUnCulto({ caso, m }) {
  const culto = (x) => ({ id: 'c1', titulo: '', detalle: '', fecha: '', lugar: '', fotoDataUrl: null, ...x })

  caso('el enlace sale del título y el año', 'solemne-quinario-2027',
    m.slugCulto(culto({ titulo: 'Solemne Quinario', fechaIso: '2027-03-02' })))
  // Escrito a mano no hay fecha de verdad: se busca el año en el texto.
  caso('escrito a mano, el año sale del texto', 'funcion-principal-2026',
    m.slugCulto(culto({ titulo: 'Función Principal', fecha: 'Domingo 15 de marzo de 2026, 12:00' })))
  // Y sin año en ninguna parte, el título solo: es lo que había antes.
  caso('sin año, solo el título', 'besapies',
    m.slugCulto(culto({ titulo: 'Besapiés' })))
  // Lo que de verdad importa: dos años, dos direcciones.
  caso('dos años dan dos enlaces distintos', false,
    m.slugCulto(culto({ titulo: 'Quinario', fechaIso: '2026-03-02' }))
    === m.slugCulto(culto({ titulo: 'Quinario', fechaIso: '2027-03-02' })))
  caso('sin título se cae al id', 'c1', m.slugCulto(culto({ titulo: '' })))
  // Un número que no es un año (una hora, un número de calle) no cuenta.
  caso('un número que no es año no se coge', 'via-crucis',
    m.slugCulto(culto({ titulo: 'Vía Crucis', fecha: 'a las 20:30, calle Mayor 118' })))
}

/**
 * LA HEMEROTECA. Sin agrupar por año, la actualidad de una hermandad con seis
 * años de web es una lista infinita donde para llegar al Quinario de 2023 hay
 * que bajar doscientas veces.
 */
async function laHemeroteca({ caso, m }) {
  const n = (id, fecha, extra) => ({ id, titulo: id, fecha, resumen: '', fotoDataUrl: null, publicada: true, ...extra })
  const anios = m.noticiasPorAnio([
    n('a', '2024-03-01'), n('b', '2026-01-15'), n('c', '2024-11-02'), n('d', '2026-05-05'), n('e', ''),
  ])
  caso('se agrupa por año', 3, anios.length)
  caso('el año más nuevo primero', '2026', anios[0].anio)
  caso('con sus dos noticias', 2, anios[0].noticias.length)
  caso('y dentro, la más reciente antes', 'd', anios[0].noticias[0].id)
  // Las sin fecha no son «del año 0»: van al final, aparte.
  caso('las que no tienen fecha van al final', '', anios[2].anio)
  // Y las ocultas no salen ni en la hemeroteca.
  const conOculta = m.noticiasPorAnio([n('x', '2025-01-01'), n('y', '2025-02-01', { publicada: false })])
  caso('una noticia oculta no entra', 1, conOculta[0].noticias.length)
}
