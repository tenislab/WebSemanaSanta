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
}
