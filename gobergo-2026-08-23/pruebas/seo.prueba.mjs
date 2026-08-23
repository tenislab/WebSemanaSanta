/** W9: lo que hace que la web se comparta bien y se encuentre en Google. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/seoWeb.ts')
  const w = await cargar('src/lib/webPublica.ts')

  const hermandad = {
    nombreLegal: 'Hermandad de la Vera-Cruz', cif: '', direccion: 'C/ Real, 12',
    codigoPostal: '41010', ciudad: 'Sevilla', provincia: 'Sevilla',
    telefono: '954 00 00 00', email: 'hola@vera-cruz.es', iban: '', bizumTelefono: '',
    identificadorAcreedor: '', logoDataUrl: null, colorPrimario: '#6A1A23',
    colorSecundario: '#C5A059', textoPieDocumentos: '',
  }
  const base = {
    ...w.WEB_PUBLICA_INICIAL,
    publicada: true, slug: 'vera-cruz', titulo: 'Hdad. de la Vera-Cruz',
    seo: { titulo: '', descripcion: 'Hermandad de penitencia fundada en 1595.', imagenDataUrl: null },
    redes: [{ id: 'r', tipo: 'Instagram', url: 'https://instagram.com/veracruz' }],
    noticias: [
      { id: 'n1', titulo: 'Cabildo General', fecha: '2026-02-02', resumen: 'x', fotoDataUrl: null, publicada: true },
      { id: 'n2', titulo: 'Sin publicar', fecha: '2026-03-01', resumen: '', fotoDataUrl: null, publicada: false },
    ],
    titulares: [
      { id: 't1', nombre: 'Ntro. Padre Jesús', fotoDataUrl: null, descripcion: '', autoria: '', parrafos: [{ id: 'p', subtitulo: '', texto: 'Su historia.' }] },
      { id: 't2', nombre: 'Sin ficha', fotoDataUrl: null, descripcion: '', autoria: '', parrafos: [] },
    ],
  }

  // --- Dónde vive la web ---
  caso('sin dominio propio, el enlace largo', 'https://cabildo.app/w/vera-cruz', m.baseDeLaWeb(base, 'https://cabildo.app'))
  caso('con dominio propio, el dominio', 'https://veracruz.es', m.baseDeLaWeb({ ...base, dominio: 'veracruz.es' }, 'https://cabildo.app'))
  caso('el dominio se limpia de https y barras', 'https://veracruz.es', m.baseDeLaWeb({ ...base, dominio: 'https://veracruz.es/' }, 'https://x.es'))
  caso('sin barras dobles al pegar', 'https://veracruz.es/noticias', m.urlAbsoluta('https://veracruz.es/', '/noticias'))
  caso('la raíz se queda como está', 'https://veracruz.es', m.urlAbsoluta('https://veracruz.es', '/'))

  // --- Las páginas de la web ---
  const rutas = m.rutasDeLaWeb(base).map((r) => r.ruta)
  caso('la portada siempre está', true, rutas.includes('/'))
  caso('el listado de noticias, si hay', true, rutas.includes('/noticias'))
  caso('la noticia publicada', true, rutas.includes('/n/cabildo-general'))
  caso('la que NO está publicada, no', false, rutas.includes('/n/sin-publicar'))
  caso('el titular con ficha', true, rutas.includes('/t/ntro-padre-jesus'))
  caso('el titular sin ficha, no', false, rutas.includes('/t/sin-ficha'))
  caso('sin noticias no hay listado', false, m.rutasDeLaWeb({ ...base, noticias: [] }).map((r) => r.ruta).includes('/noticias'))
  /*
   * Y CADA CULTO, con su dirección. El enlace lleva el año pegado: los cultos
   * se llaman todos igual año tras año y sin él dos quinarios comparten
   * dirección.
   *
   * Solo los ESCRITOS en la web, no los del calendario: esto también lo llama
   * el servidor para el sitemap, y allí no hay navegador de donde leer el
   * módulo de Eventos. Prometerle a Google una dirección que no se puede
   * servir es peor que no prometerla.
   */
  caso('cada culto tiene su dirección', true, rutas.some((r) => r.startsWith('/c/')))
  caso('y un culto sin título no', false,
    m.rutasDeLaWeb({ ...base, cultos: [{ id: 'c', titulo: '  ', detalle: '', fecha: '', lugar: '', fotoDataUrl: null }] })
      .map((r) => r.ruta).some((r) => r.startsWith('/c/')))

  // --- Sitemap ---
  const sm = m.sitemapXml(base, 'https://veracruz.es')
  caso('el sitemap es XML', true, sm.startsWith('<?xml version="1.0" encoding="UTF-8"?>'))
  caso('lleva la portada', true, sm.includes('<loc>https://veracruz.es</loc>'))
  caso('y la noticia con su fecha', true, sm.includes('<lastmod>2026-02-02</lastmod>'))
  // Portada, listado, la noticia publicada, el titular con ficha y los dos
  // cultos del guion. Lo que importa es que no salga NINGUNA dos veces:
  // Google penaliza el mismo contenido en dos direcciones.
  caso('una sola entrada por página', 6, (sm.match(/<url>/g) || []).length)
  caso('y ninguna repetida', true, new Set(m.rutasDeLaWeb(base).map((r) => r.ruta)).size === m.rutasDeLaWeb(base).length)
  /*
   * Ni siquiera con dos cultos que dan el mismo enlace: «Besapiés» dos veces
   * en el mismo año pasa de verdad. Google cuenta la misma página prometida
   * dos veces como contenido duplicado y la baja de posición.
   */
  const dosIguales = m.rutasDeLaWeb({ ...base, cultos: [
    { id: 'c1', titulo: 'Besapiés', detalle: '', fecha: '', lugar: '', fotoDataUrl: null, fechaIso: '2027-03-01' },
    { id: 'c2', titulo: 'Besapiés', detalle: '', fecha: '', lugar: '', fotoDataUrl: null, fechaIso: '2027-09-14' },
  ] }).map((r) => r.ruta)
  caso('dos cultos con el mismo enlace solo salen una vez', 1,
    dosIguales.filter((r) => r === '/c/besapies-2027').length)
  caso('escapa los ampersands', true, m.sitemapXml({ ...base, slug: 'a&b' }, 'https://x.es/w/a&b').includes('a&amp;b'))

  // --- Robots ---
  caso('publicada, se deja indexar', true, m.robotsTxt(base, 'https://veracruz.es').includes('Allow: /'))
  caso('y se apunta al sitemap', true, m.robotsTxt(base, 'https://veracruz.es').includes('Sitemap: https://veracruz.es/sitemap.xml'))
  caso('sin publicar, se cierra', 'User-agent: *\nDisallow: /\n', m.robotsTxt({ ...base, publicada: false }, 'https://veracruz.es'))

  // --- Datos estructurados ---
  const cultos = [
    { id: 'c1', titulo: 'Quinario', detalle: 'En la sede', fecha: 'Del 3 al 7', lugar: 'Parroquia', fotoDataUrl: null, fechaIso: '2027-03-03' },
    { id: 'c2', titulo: 'Sin fecha', detalle: '', fecha: 'en marzo', lugar: '', fotoDataUrl: null },
  ]
  const ld = m.datosEstructurados(base, hermandad, cultos, 'https://veracruz.es')
  const tipos = ld['@graph'].map((x) => x['@type'])
  /*
   * `ReligiousOrganization`, no `Organization` a secas. schema.org tiene un
   * tipo que describe exactamente lo que es una hermandad, y decírselo a
   * Google es lo que hace que salga como institución religiosa —con su ficha,
   * su dirección y sus cultos— en vez de como una empresa con un nombre raro.
   */
  caso('la hermandad es una organización religiosa', true, tipos.includes('ReligiousOrganization'))
  caso('la sede es un lugar', true, tipos.includes('Place'))
  caso('los cultos con fecha son eventos', 1, tipos.filter((t) => t === 'Event').length)

  /*
   * Y UNA PÁGINA SUELTA SE DESCRIBE A SÍ MISMA.
   *
   * Sin esto, las cuarenta noticias de una hermandad eran para Google cuarenta
   * copias de la misma ficha —la de la organización— y ninguna tenía fecha ni
   * foto propia. Con esto, cada una es un artículo, y sale en los resultados
   * con su imagen en vez de como una línea de texto.
   */
  const conNoticia = m.datosEstructurados(base, hermandad, cultos, 'https://veracruz.es', {
    titulo: 'Ya está el cartel de 2027', descripcion: 'Lo firma Rocío Medina.',
    imagen: 'https://veracruz.es/cartel.jpg', ruta: '/n/cartel-2027',
    tipo: 'noticia', fecha: '2027-01-15',
  })
  const tiposN = conNoticia['@graph'].map((x) => x['@type'])
  caso('una noticia es un artículo', true, tiposN.includes('NewsArticle'))
  const art = conNoticia['@graph'].find((x) => x['@type'] === 'NewsArticle')
  caso('con su fecha', '2027-01-15', art.datePublished)
  caso('con su foto', 'https://veracruz.es/cartel.jpg', art.image)
  caso('y colgando de la hermandad', 'https://veracruz.es#hermandad', art.publisher['@id'])
  caso('y apuntando a su propia página', 'https://veracruz.es/n/cartel-2027', art.mainEntityOfPage['@id'])
  caso('sin el `isPartOf` que no decía nada', undefined, art.isPartOf)

  // Las migas de pan: lo que hace que en Google se lea «hermandad › Actualidad
  // › El cartel de 2027» debajo del título, en vez de la dirección cruda.
  const migas = conNoticia['@graph'].find((x) => x['@type'] === 'BreadcrumbList')
  caso('hay migas de pan', true, Boolean(migas))
  caso('con tres escalones para una noticia', 3, migas.itemListElement.length)
  caso('y el último es la noticia', 'Ya está el cartel de 2027',
    migas.itemListElement[2].name)

  // Una foto en `data:` no la lee ningún rastreador: mejor no prometerla.
  const conDataUrl = m.datosEstructurados(base, hermandad, cultos, 'https://veracruz.es', {
    titulo: 'X', descripcion: '', imagen: 'data:image/png;base64,AAAA', ruta: '/n/x', tipo: 'noticia',
  })
  const artD = conDataUrl['@graph'].find((x) => x['@type'] === 'NewsArticle')
  caso('una foto en data: no se promete', undefined, artD.image)
  // Y sin fecha no se inventa ninguna.
  caso('sin fecha no se inventa', undefined, artD.datePublished)

  // La ficha de un titular NO es un artículo —no tiene fecha ni es actualidad—
  // pero sí lleva sus migas.
  const conTitular = m.datosEstructurados(base, hermandad, cultos, 'https://veracruz.es', {
    titulo: 'Nuestro Padre Jesús', descripcion: '', imagen: null, ruta: '/t/jesus', tipo: 'titular',
  })
  const tiposT = conTitular['@graph'].map((x) => x['@type'])
  caso('un titular no es una noticia', false, tiposT.includes('NewsArticle'))
  caso('pero sí lleva migas', true, tiposT.includes('BreadcrumbList'))
  const migasT = conTitular['@graph'].find((x) => x['@type'] === 'BreadcrumbList')
  caso('con dos escalones', 2, migasT.itemListElement.length)
  const org = ld['@graph'][0]
  caso('con su nombre', 'Hdad. de la Vera-Cruz', org.name)
  caso('su teléfono', '954 00 00 00', org.telephone)
  caso('su ciudad', 'Sevilla', org.address.addressLocality)
  caso('y sus redes', 'https://instagram.com/veracruz', org.sameAs[0])
  // Un logo en `data:` no le sirve a Google.
  caso('el escudo en data: no se manda', undefined, m.datosEstructurados({ ...base, logoDataUrl: 'data:image/png;base64,xx' }, hermandad, [], 'https://x.es')['@graph'][0].logo)
  caso('el escudo con URL sí', 'https://x.es/e.png', m.datosEstructurados({ ...base, logoDataUrl: 'https://x.es/e.png' }, hermandad, [], 'https://x.es')['@graph'][0].logo)
  const evento = ld['@graph'].find((x) => x['@type'] === 'Event')
  caso('el evento lleva fecha ISO', '2027-03-03', evento.startDate)
  caso('y su sitio', 'Parroquia', evento.location.name)

  // --- La cabecera que devuelve el servidor ---
  const html = m.cabeceraHtml(base, hermandad, cultos, 'https://veracruz.es')
  caso('lleva el título de la hermandad', true, html.includes('<title>Hdad. de la Vera-Cruz</title>'))
  caso('y no el de Gobergo', false, html.includes('Software para gestionar'))
  caso('con canonical', true, html.includes('<link rel="canonical" href="https://veracruz.es">'))
  caso('con og:url', true, html.includes('content="https://veracruz.es"'))
  caso('con el color de la hermandad', true, html.includes('name="theme-color" content="#6A1A23"'))
  caso('y los datos estructurados dentro', true, html.includes('application/ld+json'))
  // Sin imagen de verdad no se promete una tarjeta grande.
  caso('sin imagen, tarjeta pequeña', true, html.includes('name="twitter:card" content="summary"'))
  caso('una imagen en data: no se manda', false, m.cabeceraHtml({ ...base, heroFotos: ['data:image/png;base64,xx'] }, hermandad, [], 'https://x.es').includes('og:image'))
  caso('una imagen con URL sí', true, m.cabeceraHtml({ ...base, heroFotos: ['https://x.es/foto.jpg'] }, hermandad, [], 'https://x.es').includes('og:image'))

  /*
   * LA FOTO QUE SE COGE ES LA PRIMERA QUE SIRVA, no la primera que haya.
   *
   * Una noticia escrita antes del almacén lleva su foto dentro del contenido
   * (`data:`), y eso no lo lee ningún rastreador. Antes esa foto ganaba el
   * turno y luego se descartaba, así que la noticia se compartía SIN imagen
   * aunque la web tuviera una portada perfectamente válida.
   */
  const noticiaVieja = m.cabeceraHtml(
    { ...base, heroFotos: ['https://x.es/portada.jpg'] }, hermandad, [], 'https://x.es',
    { titulo: 'Cabildo', descripcion: '', imagen: 'data:image/png;base64,xx', ruta: '/n/cabildo' },
  )
  caso('con la foto de dentro, se cae a la portada', true, noticiaVieja.includes('content="https://x.es/portada.jpg"'))
  caso('y la tarjeta vuelve a ser grande', true, noticiaVieja.includes('content="summary_large_image"'))

  /*
   * Y SIEMPRE ABSOLUTA. WhatsApp y Facebook piden la foto desde sus propios
   * servidores: una dirección que empiece por «/» allí no lleva a ningún
   * sitio, y la tarjeta sale sin imagen sin decir por qué.
   */
  const relativa = m.cabeceraHtml({ ...base, heroFotos: ['/fotos/portada.jpg'] }, hermandad, [], 'https://x.es')
  caso('una ruta relativa se hace absoluta', true, relativa.includes('content="https://x.es/fotos/portada.jpg"'))
  // Y la que ya es absoluta no se toca (si no, saldría https://x.es/https://…).
  caso('y la absoluta se queda como está', false,
    m.cabeceraHtml({ ...base, heroFotos: ['https://cdn.example/f.jpg'] }, hermandad, [], 'https://x.es')
      .includes('https://x.es/https'))

  // La tarjeta lleva texto alternativo: lo lee el lector de pantalla de quien
  // recibe el enlace.
  caso('la tarjeta lleva texto alternativo', true, relativa.includes('property="og:image:alt"'))

  // Una pieza suelta (una noticia) manda su título y su dirección.
  const conPieza = m.cabeceraHtml(base, hermandad, [], 'https://veracruz.es', {
    titulo: 'Cabildo General', descripcion: 'Se convoca a todos los hermanos.', imagen: null, ruta: '/n/cabildo-general',
  })
  caso('la noticia manda en el título', true, conPieza.includes('<title>Cabildo General · Hdad. de la Vera-Cruz</title>'))
  caso('y en el canonical', true, conPieza.includes('href="https://veracruz.es/n/cabildo-general"'))
  caso('y en la descripción', true, conPieza.includes('content="Se convoca a todos los hermanos."'))

  // Comillas y ángulos no pueden romper el HTML.
  const peligro = m.cabeceraHtml({ ...base, titulo: 'La "Vera" <b>Cruz</b>', seo: { ...base.seo, titulo: '' } }, hermandad, [], 'https://x.es')
  caso('escapa las comillas del título', true, peligro.includes('&quot;Vera&quot;'))
  caso('y las etiquetas', false, peligro.includes('<b>Cruz</b>'))
  caso('el JSON-LD no puede cerrar el script', false,
    m.cabeceraHtml({ ...base, lema: '</script><script>alert(1)' }, hermandad, [], 'https://x.es').includes('</script><script>alert(1)'))

  // --- Una web guardada antes de que existieran estos campos ---
  // En el navegador nunca pasa: al cargar se rellenan los huecos. Pero el
  // servidor lee el JSON tal cual está en la base de datos, y una web vieja
  // no trae `seo` ni `redes`. Antes eso tiraba la cabecera entera y la página
  // se servía pelada, sin una sola etiqueta, sin que nadie se enterara.
  const vieja = { ...base }
  delete vieja.seo
  delete vieja.redes
  delete vieja.heroFotos
  delete vieja.noticias
  delete vieja.titulares
  const htmlViejo = m.cabeceraHtml(vieja, hermandad, [], 'https://veracruz.es')
  caso('una web sin `seo` no tumba la cabecera', true, htmlViejo.includes('<title>'))
  caso('y cae en el título de la web', true, htmlViejo.includes('Hdad. de la Vera-Cruz'))
  caso('y sigue llevando sus datos', true, htmlViejo.includes('application/ld+json'))
  caso('y sin fotos no promete imagen', false, htmlViejo.includes('og:image'))

  // --- El idioma de la página ---
  // El `index.html` viene con `lang="es"` fijo. El servidor lo corrige con el
  // idioma de la hermandad, y de ahí sale al HTML: si no se limpia, unas
  // comillas guardadas en el editor cierran el atributo.
  caso('el castellano pasa', 'es', m.idiomaSeguro('es'))
  caso('el inglés también', 'en', m.idiomaSeguro('en'))
  caso('y una variante regional', 'pt-BR', m.idiomaSeguro('pt-BR'))
  caso('lo vacío cae en castellano', 'es', m.idiomaSeguro(''))
  caso('y lo que no está', 'es', m.idiomaSeguro(undefined))
  caso('unas comillas no salen al HTML', 'es', m.idiomaSeguro('es" onload="alert(1)'))
  caso('ni un signo de mayor', 'es', m.idiomaSeguro('es><script>'))
}
