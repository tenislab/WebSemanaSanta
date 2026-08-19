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

  // --- Sitemap ---
  const sm = m.sitemapXml(base, 'https://veracruz.es')
  caso('el sitemap es XML', true, sm.startsWith('<?xml version="1.0" encoding="UTF-8"?>'))
  caso('lleva la portada', true, sm.includes('<loc>https://veracruz.es</loc>'))
  caso('y la noticia con su fecha', true, sm.includes('<lastmod>2026-02-02</lastmod>'))
  caso('una sola entrada por página', 4, (sm.match(/<url>/g) || []).length)
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
  caso('la hermandad es una organización', true, tipos.includes('Organization'))
  caso('la sede es un lugar', true, tipos.includes('Place'))
  caso('los cultos con fecha son eventos', 1, tipos.filter((t) => t === 'Event').length)
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
  caso('y no el de Cabildo', false, html.includes('Software para gestionar'))
  caso('con canonical', true, html.includes('<link rel="canonical" href="https://veracruz.es">'))
  caso('con og:url', true, html.includes('content="https://veracruz.es"'))
  caso('con el color de la hermandad', true, html.includes('name="theme-color" content="#6A1A23"'))
  caso('y los datos estructurados dentro', true, html.includes('application/ld+json'))
  // Sin imagen de verdad no se promete una tarjeta grande.
  caso('sin imagen, tarjeta pequeña', true, html.includes('name="twitter:card" content="summary"'))
  caso('una imagen en data: no se manda', false, m.cabeceraHtml({ ...base, heroFotos: ['data:image/png;base64,xx'] }, hermandad, [], 'https://x.es').includes('og:image'))
  caso('una imagen con URL sí', true, m.cabeceraHtml({ ...base, heroFotos: ['https://x.es/foto.jpg'] }, hermandad, [], 'https://x.es').includes('og:image'))

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
}
