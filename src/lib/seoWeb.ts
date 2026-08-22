import type { CultoWeb, WebPublica } from './webPublica'
// DEL FICHERO PURO, no de `webPublica`. Esto lo importan las funciones de
// servidor de `api/`, y `webPublica` arrastra React y el cliente de Supabase
// —que lee `import.meta.env`, inexistente en el servidor—. Por ahí se cayó la
// portada de gobergo.com con un 500. Ver el comentario de webPublicaPuro.ts.
import { noticiasPublicadas, slugNoticia, slugTitular } from './webPublicaPuro'
import type { HermandadSettings } from './hermandadSettings'

/**
 * Lo que hace falta para que la web se comparta bien y se encuentre en Google.
 *
 * Todo lo de aquí son funciones puras: reciben la web y devuelven texto. Así
 * las puede usar tanto el navegador (metaetiquetas y datos estructurados en
 * vivo) como una función de servidor que devuelva el HTML ya hecho, que es lo
 * que de verdad arregla la vista previa de WhatsApp.
 */

/** La dirección donde vive la web: el dominio propio si lo hay, o el enlace largo. */
export function baseDeLaWeb(web: WebPublica, origen: string): string {
  const propio = (web.dominio ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (propio) return `https://${propio}`
  return `${origen.replace(/\/+$/, '')}/w/${web.slug}`
}

/**
 * El trozo de dirección que va DELANTE de las páginas sueltas de la web.
 *
 * Hay dos maneras de llegar a la web de una hermandad y cada una tiene su
 * dirección:
 *
 *   gobergo.es/w/hermandad-de-triana/n/cartel   ← sin dominio propio
 *   hermandaddetriana.es/n/cartel               ← con su dominio
 *
 * Escribir siempre `/w/<slug>/…` funcionaba, pero dejaba a la hermandad con su
 * dominio comprado enseñando el enlace largo en la barra de direcciones, y
 * —esto es lo grave— con un `sitemap.xml` que anuncia a Google unas
 * direcciones y unos enlaces internos que llevan a otras. Google entiende que
 * son dos páginas distintas con el mismo contenido y reparte el sitio en dos.
 */
export function baseDeRutas(web: { slug: string; dominio?: string | null }, host?: string): string {
  const propio = (web.dominio ?? '')
    .trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '')
  if (!propio) return `/w/${web.slug}`
  const h = (host ?? (typeof window !== 'undefined' ? window.location.hostname : ''))
    .trim().toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '')
  // Se ha entrado por su dominio: las páginas cuelgan de la raíz.
  return h && h === propio ? '' : `/w/${web.slug}`
}

/** Sin dobles barras al pegar la base con la ruta. */
export function urlAbsoluta(base: string, ruta: string): string {
  if (!ruta || ruta === '/') return base
  return `${base.replace(/\/+$/, '')}/${ruta.replace(/^\/+/, '')}`
}

/** El título y la descripción que se ven al compartir y en Google. */
export function tituloWeb(web: WebPublica, hermandad: HermandadSettings): string {
  return web.seo.titulo.trim() || web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
}

export function descripcionWeb(web: WebPublica): string {
  return web.seo.descripcion.trim() || web.lema || ''
}

/**
 * Datos estructurados (JSON-LD): la hermandad como organización, su sede como
 * lugar y CADA CULTO como evento. Es lo que hace que un culto salga en Google
 * con su fecha y su hora en vez de perdido dentro del texto de la página.
 */
export function datosEstructurados(
  web: WebPublica,
  hermandad: HermandadSettings,
  cultos: CultoWeb[],
  base: string,
): Record<string, unknown> {
  const nombre = tituloWeb(web, hermandad)
  const direccion = web.direccion.trim() || hermandad.direccion.trim()
  const grafo: Record<string, unknown>[] = []

  const organizacion: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': `${base}#hermandad`,
    name: nombre,
    url: base,
  }
  const logo = web.logoDataUrl ?? hermandad.logoDataUrl
  // Un `data:` no le sirve a Google como logo: solo se manda si es una URL.
  if (logo && !logo.startsWith('data:')) organizacion.logo = logo
  const descripcion = descripcionWeb(web)
  if (descripcion) organizacion.description = descripcion
  const telefono = web.telefono.trim() || hermandad.telefono.trim()
  if (telefono) organizacion.telephone = telefono
  const email = web.email.trim() || hermandad.email.trim()
  if (email) organizacion.email = email
  const redes = web.redes.map((r) => r.url).filter((u) => /^https?:\/\//.test(u))
  if (redes.length > 0) organizacion.sameAs = redes
  if (direccion) {
    organizacion.address = {
      '@type': 'PostalAddress',
      streetAddress: direccion,
      ...(hermandad.codigoPostal.trim() ? { postalCode: hermandad.codigoPostal.trim() } : {}),
      ...(hermandad.ciudad.trim() ? { addressLocality: hermandad.ciudad.trim() } : {}),
      ...(hermandad.provincia.trim() ? { addressRegion: hermandad.provincia.trim() } : {}),
      addressCountry: 'ES',
    }
  }
  grafo.push(organizacion)

  if (direccion) {
    grafo.push({
      '@type': 'Place',
      '@id': `${base}#sede`,
      name: web.direccion.trim() ? nombre : `Sede de ${nombre}`,
      address: organizacion.address,
    })
  }

  // Solo los cultos con fecha de verdad: sin `startDate`, Google descarta el
  // evento entero, y uno con «del 3 al 7 de marzo» no se puede convertir.
  cultos
    .filter((c) => c.fechaIso)
    .forEach((c) => {
      grafo.push({
        '@type': 'Event',
        name: c.titulo,
        startDate: c.fechaIso,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        organizer: { '@id': `${base}#hermandad` },
        ...(c.detalle.trim() ? { description: c.detalle.trim() } : {}),
        ...(c.lugar.trim() || direccion
          ? { location: { '@type': 'Place', name: c.lugar.trim() || nombre, ...(direccion ? { address: organizacion.address } : {}) } }
          : {}),
      })
    })

  return { '@context': 'https://schema.org', '@graph': grafo }
}

/** Todas las direcciones de la web, para el sitemap y para el buscador. */
export function rutasDeLaWeb(web: WebPublica): { ruta: string; fecha?: string }[] {
  const rutas: { ruta: string; fecha?: string }[] = [{ ruta: '/' }]
  const noticias = noticiasPublicadas(web.noticias)
  if (noticias.length > 0) rutas.push({ ruta: '/noticias' })
  noticias.forEach((n) => rutas.push({ ruta: `/n/${slugNoticia(n)}`, fecha: n.fecha || undefined }))
  web.titulares.forEach((t) => {
    const conFicha = (t.parrafos ?? []).some((p) => p.texto.trim() || p.subtitulo.trim()) || (t.fotos ?? []).length > 0
    if (conFicha) rutas.push({ ruta: `/t/${slugTitular(t)}` })
  })
  return rutas
}

/** Escapa lo que va dentro de XML o de un atributo HTML. */
export function escaparXml(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** El sitemap: la lista de páginas que se le da a Google para que las visite. */
export function sitemapXml(web: WebPublica, base: string): string {
  const urls = rutasDeLaWeb(web)
    .map(({ ruta, fecha }) => {
      const loc = escaparXml(urlAbsoluta(base, ruta))
      return `  <url>\n    <loc>${loc}</loc>${fecha ? `\n    <lastmod>${escaparXml(fecha)}</lastmod>` : ''}\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

/**
 * El robots.txt. Una web sin publicar se cierra a los buscadores: si no, Google
 * indexa una hermandad a medio hacer y luego cuesta meses quitarlo.
 */
export function robotsTxt(web: WebPublica, base: string): string {
  if (!web.publicada) return 'User-agent: *\nDisallow: /\n'
  return `User-agent: *\nAllow: /\n\nSitemap: ${urlAbsoluta(base, '/sitemap.xml')}\n`
}

/**
 * El `<head>` con los datos de ESTA hermandad, ya escrito, para que lo devuelva
 * un servidor. Es lo único que arregla la vista previa de WhatsApp: ni WhatsApp
 * ni Facebook ejecutan JavaScript, así que lo que ponga el navegador después de
 * cargar no lo ven.
 */
export function cabeceraHtml(
  web: WebPublica,
  hermandad: HermandadSettings,
  cultos: CultoWeb[],
  base: string,
  pieza?: { titulo: string; descripcion: string; imagen: string | null; ruta: string },
): string {
  const nombre = tituloWeb(web, hermandad)
  const titulo = pieza ? `${pieza.titulo} · ${nombre}` : nombre
  const descripcion = pieza ? pieza.descripcion.trim() || descripcionWeb(web) : descripcionWeb(web)
  const imagen = pieza?.imagen ?? web.seo.imagenDataUrl ?? web.heroFotos[0] ?? null
  const url = urlAbsoluta(base, pieza?.ruta ?? '/')
  const et = (x: string) => escaparXml(x)
  const lineas = [
    `<title>${et(titulo)}</title>`,
    `<link rel="canonical" href="${et(url)}">`,
    `<meta name="description" content="${et(descripcion)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${et(titulo)}">`,
    `<meta property="og:description" content="${et(descripcion)}">`,
    `<meta property="og:url" content="${et(url)}">`,
    `<meta property="og:locale" content="${et((web.idioma || 'es') === 'es' ? 'es_ES' : web.idioma)}">`,
    `<meta name="theme-color" content="${et(web.colorPrimario)}">`,
  ]
  // Una imagen en `data:` no la lee ningún rastreador: mejor no prometerla.
  if (imagen && !imagen.startsWith('data:')) {
    lineas.push(`<meta property="og:image" content="${et(imagen)}">`)
    lineas.push('<meta name="twitter:card" content="summary_large_image">')
  } else {
    lineas.push('<meta name="twitter:card" content="summary">')
  }
  lineas.push(
    `<script type="application/ld+json">${JSON.stringify(datosEstructurados(web, hermandad, cultos, base)).replace(/</g, '\\u003c')}</script>`,
  )
  return lineas.join('\n')
}
