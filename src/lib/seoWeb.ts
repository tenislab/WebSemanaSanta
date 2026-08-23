import type { CultoWeb, WebPublica } from './webPublica'
// DEL FICHERO PURO, no de `webPublica`. Esto lo importan las funciones de
// servidor de `api/`, y `webPublica` arrastra React y el cliente de Supabase
// —que lee `import.meta.env`, inexistente en el servidor—. Por ahí se cayó la
// portada de gobergo.com con un 500. Ver el comentario de webPublicaPuro.ts.
import { noticiasPublicadas, slugCulto, slugNoticia, slugTitular } from './webPublicaPuro'
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
/*
 * Los interrogantes de aquí abajo no sobran. La aplicación rellena los huecos
 * al cargar la web (`webGuardada` mezcla los valores por defecto), pero esta
 * función se llama TAMBIÉN desde el servidor, y allí el JSON se lee tal cual
 * está en la base de datos. Una hermandad que guardara su web antes de que
 * existieran estos campos no los tiene, y sin interrogante se caía la cabecera
 * entera: no un error a la vista, sino la página servida sin una sola etiqueta
 * y la hermandad sin saber por qué no se comparte bien.
 */
export function tituloWeb(web: WebPublica, hermandad: HermandadSettings): string {
  return (web.seo?.titulo ?? '').trim() || web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
}

export function descripcionWeb(web: WebPublica): string {
  return (web.seo?.descripcion ?? '').trim() || web.lema || ''
}

/**
 * Datos estructurados (JSON-LD): la hermandad como organización, su sede como
 * lugar y CADA CULTO como evento. Es lo que hace que un culto salga en Google
 * con su fecha y su hora en vez de perdido dentro del texto de la página.
 */
/**
 * La página concreta que se está mirando, cuando no es la portada.
 *
 * Lleva `tipo` y `fecha`, que antes no llevaba: sin el tipo, una noticia y la
 * ficha de un titular se describían igual —y una noticia con fecha es lo que
 * Google puede sacar en Discover y en «noticias recientes», y sin fecha no.
 */
export interface PiezaSeo {
  titulo: string
  descripcion: string
  imagen: string | null
  ruta: string
  tipo?: 'noticia' | 'titular' | 'listado' | 'culto'
  /** Fecha, en `2027-03-15`. La de publicación en una noticia; la del acto en un culto. */
  fecha?: string
  /** Dónde es. Solo el culto la tiene, y es lo que Google enseña en la ficha del acto. */
  lugar?: string
}

export function datosEstructurados(
  web: WebPublica,
  hermandad: HermandadSettings,
  cultos: CultoWeb[],
  base: string,
  pieza?: PiezaSeo,
): Record<string, unknown> {
  const nombre = tituloWeb(web, hermandad)
  const direccion = web.direccion.trim() || hermandad.direccion.trim()
  const grafo: Record<string, unknown>[] = []

  /*
   * `ReligiousOrganization`, no `Organization` a secas.
   *
   * schema.org tiene un tipo que describe EXACTAMENTE lo que es una hermandad,
   * y decírselo a Google cambia bastante: es lo que hace que aparezca como una
   * institución religiosa —con su ficha lateral, su dirección y sus cultos— y
   * no como una empresa cualquiera con un nombre raro.
   *
   * Es una palabra, y es de lo poco en SEO que se nota sin tener que escribir
   * más contenido.
   */
  const organizacion: Record<string, unknown> = {
    '@type': 'ReligiousOrganization',
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
  const redes = (web.redes ?? []).map((r) => r.url).filter((u) => /^https?:\/\//.test(u))
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

  /*
   * Y SI SE ESTÁ MIRANDO UNA PÁGINA SUELTA —una noticia, la ficha de un
   * titular— se describe también ELLA, no solo la hermandad.
   *
   * Sin esto, las cuarenta noticias de una hermandad eran para Google cuarenta
   * copias de la misma ficha: la de la organización. Con esto, cada una es un
   * artículo con su título, su fecha y su foto, que es lo que hace que salga
   * en los resultados con imagen y no como una línea de texto.
   */
  if (pieza) {
    const url = urlAbsoluta(base, pieza.ruta)
    if (pieza.tipo === 'noticia') {
      grafo.push({
        '@type': 'NewsArticle',
        '@id': `${url}#articulo`,
        headline: pieza.titulo,
        url,
        ...(pieza.descripcion.trim() ? { description: pieza.descripcion.trim() } : {}),
        ...(pieza.fecha ? { datePublished: pieza.fecha } : {}),
        // Un `data:` no le sirve a Google: solo se manda si es una dirección.
        ...(pieza.imagen && !pieza.imagen.startsWith('data:') ? { image: pieza.imagen } : {}),
        publisher: { '@id': `${base}#hermandad` },
        // `mainEntityOfPage`, no `isPartOf`: la noticia no es «parte de» la
        // hermandad (eso no significa nada en schema.org), es el contenido
        // principal de su propia página. Es la pareja que Google espera ver
        // en una NewsArticle y la que le dice cuál es la dirección buena.
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      })
    }
    /*
     * UN CULTO ES UN ACTO, y Google tiene ficha para eso: sale con su fecha,
     * su hora y su sitio, en un recuadro aparte, y se puede añadir al
     * calendario desde el propio buscador.
     *
     * Es la diferencia entre que «Solemne Quinario» aparezca como una línea de
     * texto más y que aparezca con el día y la parroquia. Para una hermandad
     * que anuncia sus cultos, es lo que más se nota.
     */
    if (pieza.tipo === 'culto') {
      grafo.push({
        '@type': 'Event',
        '@id': `${url}#acto`,
        name: pieza.titulo,
        url,
        ...(pieza.fecha ? { startDate: pieza.fecha } : {}),
        ...(pieza.descripcion.trim() ? { description: pieza.descripcion.trim() } : {}),
        ...(pieza.imagen && !pieza.imagen.startsWith('data:') ? { image: pieza.imagen } : {}),
        // Un culto es presencial y en un sitio. Sin esto, Google avisa de que
        // la ficha del acto está incompleta y no la enseña.
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        ...(pieza.lugar?.trim()
          ? { location: { '@type': 'Place', name: pieza.lugar.trim() } }
          : {}),
        organizer: { '@id': `${base}#hermandad` },
      })
    }
    /*
     * Las migas de pan. Es lo que hace que en el resultado de Google, debajo
     * del título, se lea «hermandaddetriana.es › Actualidad › El cartel de
     * 2027» en vez de la dirección cruda. Se lee mejor y se pulsa más.
     */
    grafo.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: nombre, item: base },
        ...(pieza.tipo === 'noticia'
          ? [{ '@type': 'ListItem', position: 2, name: 'Actualidad', item: urlAbsoluta(base, '/noticias') }]
          : []),
        // El culto cuelga de la sección de Cultos de la portada, que es de
        // donde se ha llegado a él.
        ...(pieza.tipo === 'culto'
          ? [{ '@type': 'ListItem', position: 2, name: 'Cultos', item: `${base}#cultos` }]
          : []),
        {
          '@type': 'ListItem',
          position: pieza.tipo === 'noticia' || pieza.tipo === 'culto' ? 3 : 2,
          name: pieza.titulo,
          item: url,
        },
      ],
    })
  }

  return { '@context': 'https://schema.org', '@graph': grafo }
}

/** Todas las direcciones de la web, para el sitemap y para el buscador. */
export function rutasDeLaWeb(web: WebPublica): { ruta: string; fecha?: string }[] {
  const rutas: { ruta: string; fecha?: string }[] = [{ ruta: '/' }]
  const noticias = noticiasPublicadas(web.noticias ?? [])
  if (noticias.length > 0) rutas.push({ ruta: '/noticias' })
  noticias.forEach((n) => rutas.push({ ruta: `/n/${slugNoticia(n)}`, fecha: n.fecha || undefined }))
  ;(web.titulares ?? []).forEach((t) => {
    const conFicha = (t.parrafos ?? []).some((p) => p.texto.trim() || p.subtitulo.trim()) || (t.fotos ?? []).length > 0
    if (conFicha) rutas.push({ ruta: `/t/${slugTitular(t)}` })
  })
  /*
   * Y cada culto, con su dirección.
   *
   * Solo los ESCRITOS en la web, no los del calendario: esta función también
   * la llama el servidor para el sitemap, y allí no hay navegador de donde
   * leer el módulo de Eventos. Prometerle a Google una dirección que no se
   * puede servir es peor que no prometerla.
   */
  ;(web.cultos ?? []).forEach((c) => {
    if (c.titulo?.trim()) rutas.push({ ruta: `/c/${slugCulto(c)}` })
  })
  /*
   * Y NINGUNA REPETIDA. Dos cultos con el mismo título y el mismo año dan el
   * mismo enlace —«Besapiés» dos veces en marzo, por ejemplo—, y el sitemap
   * los prometía dos veces. Google lo cuenta como contenido duplicado y la
   * página baja de posición: es peor prometerla dos veces que una.
   */
  const vistas = new Set<string>()
  return rutas.filter((r) => (vistas.has(r.ruta) ? false : (vistas.add(r.ruta), true)))
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
/**
 * El idioma que se puede escribir en el HTML sin miedo.
 *
 * Lo que hay guardado en `web.idioma` lo escribe una persona en el editor, y
 * de ahí va derecho al atributo `lang` de la página. Si alguien guardara ahí
 * unas comillas, cerraría el atributo y podría escribir HTML por su cuenta.
 * Un código de idioma es siempre letras y guiones («es», «en», «pt-BR»): si no
 * lo parece, se sirve en castellano y no se discute.
 */
export function idiomaSeguro(idioma: string | null | undefined): string {
  const limpio = (idioma ?? '').trim()
  return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/.test(limpio) ? limpio : 'es'
}

export function cabeceraHtml(
  web: WebPublica,
  hermandad: HermandadSettings,
  cultos: CultoWeb[],
  base: string,
  pieza?: PiezaSeo,
): string {
  const nombre = tituloWeb(web, hermandad)
  const titulo = pieza ? `${pieza.titulo} · ${nombre}` : nombre
  const descripcion = pieza ? pieza.descripcion.trim() || descripcionWeb(web) : descripcionWeb(web)
  /*
   * LA IMAGEN DE LA TARJETA. Se coge la primera que SIRVA, no la primera que
   * haya: una foto escrita dentro del contenido (`data:`) no la lee ningún
   * rastreador, y quedándose con ella se descartaba también la de portada, que
   * a lo mejor sí valía. Resultado: una noticia con foto antigua se compartía
   * sin ninguna imagen aunque la web tuviera portada.
   */
  const imagen = [pieza?.imagen, web.seo?.imagenDataUrl, web.heroFotos?.[0]]
    .find((x): x is string => typeof x === 'string' && x.trim() !== '' && !x.startsWith('data:')) ?? null
  const url = urlAbsoluta(base, pieza?.ruta ?? '/')
  const et = (x: string) => escaparXml(x)
  const lineas = [
    `<title>${et(titulo)}</title>`,
    `<link rel="canonical" href="${et(url)}">`,
    `<meta name="description" content="${et(descripcion)}">`,
    // `article` para una noticia: es lo que la separa de «una página más» a
    // ojos de Facebook y de WhatsApp, y lo que hace que se comparta con su
    // fecha en vez de con el nombre de la hermandad y ya está.
    `<meta property="og:type" content="${pieza?.tipo === 'noticia' ? 'article' : 'website'}">`,
    `<meta property="og:site_name" content="${et(nombre)}">`,
    `<meta property="og:title" content="${et(titulo)}">`,
    `<meta property="og:description" content="${et(descripcion)}">`,
    `<meta property="og:url" content="${et(url)}">`,
    `<meta property="og:locale" content="${et((web.idioma || 'es') === 'es' ? 'es_ES' : web.idioma)}">`,
    `<meta name="theme-color" content="${et(web.colorPrimario)}">`,
  ]
  if (pieza?.tipo === 'noticia' && pieza.fecha) {
    lineas.push(`<meta property="article:published_time" content="${et(pieza.fecha)}">`)
  }
  if (imagen) {
    // ABSOLUTA siempre. WhatsApp y Facebook piden la imagen desde SUS
    // servidores, no desde el navegador de nadie: una dirección que empiece
    // por «/» allí no apunta a ningún sitio y la tarjeta sale sin foto.
    const absoluta = /^https?:\/\//i.test(imagen) ? imagen : urlAbsoluta(base, imagen)
    lineas.push(`<meta property="og:image" content="${et(absoluta)}">`)
    // El texto alternativo de la tarjeta: lo lee el lector de pantalla de
    // quien recibe el enlace por WhatsApp.
    lineas.push(`<meta property="og:image:alt" content="${et(pieza?.titulo ?? nombre)}">`)
    lineas.push('<meta name="twitter:card" content="summary_large_image">')
    lineas.push(`<meta name="twitter:image" content="${et(absoluta)}">`)
  } else {
    lineas.push('<meta name="twitter:card" content="summary">')
  }
  lineas.push(
    `<script type="application/ld+json">${JSON.stringify(datosEstructurados(web, hermandad, cultos, base, pieza)).replace(/</g, '\\u003c')}</script>`,
  )
  return lineas.join('\n')
}
