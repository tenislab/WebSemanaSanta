/**
 * UNA WEB GUARDADA A MEDIAS TIRABA LA WEB PÚBLICA ENTERA.
 *
 * ============================================================================
 * DE DÓNDE SALE ESTO
 * ============================================================================
 *
 * La web de la hermandad vive en una columna `jsonb` y en el navegador. Lo que
 * llega es LO QUE SE GUARDÓ EL DÍA QUE SE GUARDÓ: si desde entonces una
 * noticia, una página o un miembro de la junta han ganado un campo, los
 * elementos viejos llegan sin él. No es un caso raro: es lo normal cada vez
 * que se añade algo.
 *
 * `conDefectos` existe justo para eso, y completaba titulares, cultos,
 * carteles, caridad y boletines —cada uno porque alguien se estrelló con él—.
 * NO completaba noticias, páginas, junta, horarios ni redes.
 *
 * Y con esas, la web pública SE CAÍA AL PINTAR. Reproducido en el navegador,
 * sembrando la web y abriendo /w/demo:
 *
 *   · `paginas: [{ id: 'x1' }]` → «Cannot read properties of undefined
 *     (reading 'filter')» (el cuerpo de la página hace `parrafos.filter`).
 *   · `junta: [{ id: 'x1' }]`   → «Cannot read properties of undefined
 *     (reading 'trim')» (`SitioContenido.tsx:220`,
 *     `web.junta.some((m) => m.cargo.trim())`).
 *
 * El visitante no veía la web: veía «Algo se ha roto al abrir esta pantalla».
 *
 * ============================================================================
 * LA GUARDIA ES GENÉRICA A PROPÓSITO
 * ============================================================================
 *
 * Comprobar «páginas y junta» arreglaría el fallo de ayer y dejaría abierto el
 * de mañana: el problema no es esas dos listas, es que CUALQUIERA puede ganar
 * un campo. Así que se recorren TODAS las listas de la web y se exige que cada
 * elemento salga de `conDefectos` con todas sus claves. Si alguien añade una
 * lista nueva sin completarla, esto cae con su nombre.
 */
export default async function ({ cargar, caso }) {
  const w = await cargar('src/lib/webPublica.ts')

  /*
   * LAS LISTAS DE LA WEB Y LA FORMA DE SU ELEMENTO. Se declara aquí porque una
   * lista vacía en el inicial no dice qué campos tiene su elemento, y es
   * justamente en las vacías donde estaba el fallo.
   */
  const LISTAS = {
    noticias: w.NOTICIA_VACIA,
    paginas: w.PAGINA_VACIA,
    junta: w.MIEMBRO_JUNTA_VACIO,
    horarios: w.FRANJA_HORARIO_VACIA,
    redes: w.RED_VACIA,
    carteles: w.CARTEL_VACIO,
  }

  for (const [lista, vacio] of Object.entries(LISTAS)) {
    caso(`hay una forma declarada para un elemento de «${lista}»`, true, !!vacio)
    if (!vacio) continue
    const completado = w.conDefectos({ publicada: true, slug: 'd', [lista]: [{ id: 'x1' }] })[lista][0]
    const faltan = Object.keys(vacio).filter((k) => !(k in completado))
    caso(`un elemento a medias de «${lista}» sale completo`, '', faltan.join(', '))
    // Y sin perder lo que sí venía escrito.
    const conDato = w.conDefectos({ publicada: true, slug: 'd', [lista]: [{ id: 'x1', ...primerTexto(vacio) }] })[lista][0]
    const [clave, valor] = Object.entries(primerTexto(vacio))[0] ?? []
    if (clave) caso(`y no se pisa lo escrito en «${lista}.${clave}»`, valor, conDato[clave])
  }

  /*
   * Y LAS QUE YA SE COMPLETABAN SIGUEN COMPLETÁNDOSE. Aquí la referencia sí
   * sale del propio inicial, que trae elementos de ejemplo.
   */
  for (const lista of ['cultos', 'titulares', 'boletines']) {
    const modelo = (w.WEB_PUBLICA_INICIAL[lista] ?? [])[0]
      ?? w.conDefectos({ publicada: true, slug: 'd', [lista]: [{ id: 'm' }] })[lista][0]
    const completado = w.conDefectos({ publicada: true, slug: 'd', [lista]: [{ id: 'x1' }] })[lista][0]
    const faltan = Object.keys(modelo).filter((k) => !(k in completado))
    caso(`un elemento a medias de «${lista}» sigue saliendo completo`, '', faltan.join(', '))
  }

  /*
   * UN `null` DONDE DEBÍA HABER UNA LISTA TAMPOCO PUEDE TUMBARLA.
   *
   * Es lo que llega de una copia de seguridad antigua o de una versión a medio
   * migrar, y `carteles` ya lo tenía cubierto con el ayudante `lista()`. Ahora
   * lo tienen todas.
   */
  for (const lista of Object.keys(LISTAS)) {
    for (const basura of [null, undefined, 'texto', 42, { id: 'x' }]) {
      let r
      try { r = w.conDefectos({ publicada: true, slug: 'd', [lista]: basura })[lista] } catch (e) { r = `REVIENTA: ${e.message}` }
      caso(`«${lista}» con ${JSON.stringify(basura) ?? 'undefined'} dentro sigue siendo una lista`, true, Array.isArray(r))
    }
  }

  /*
   * Y LO QUE DE VERDAD IMPORTABA: que el SEO no reviente con eso.
   *
   * `api/w.ts` le daba a `cabeceraHtml` la web CRUDA de la base. Un culto sin
   * `detalle` —campo añadido en agosto— la hacía fallar, el `try/catch` de
   * arriba devolvía el `index.html` sin cabecera, y la vista previa de
   * WhatsApp de esa hermandad volvía a decir «Gobergo — Software para
   * gestionar tu hermandad». Sin error, sin 500 y sin que nadie se enterara.
   */
  const seo = await cargar('src/lib/seoWeb.ts')
  const hermandad = {
    nombreLegal: 'Hermandad', cif: '', direccion: '', codigoPostal: '', ciudad: '', provincia: '',
    telefono: '', email: '', iban: '', bizumTelefono: '', identificadorAcreedor: '',
    logoDataUrl: null, colorPrimario: '#6A1A23', colorSecundario: '#C5A059', textoPieDocumentos: '',
  }
  const crudaDeLaBase = {
    publicada: true, slug: 'demo', titulo: 'Hdad',
    cultos: [{ id: 'c1', titulo: 'Triduo', fechaIso: '2027-03-03' }],
    paginas: [{ id: 'p1' }],
    junta: [{ id: 'j1' }],
  }
  // Cruda revienta: es el fallo, y se deja escrito que revienta.
  let crudo = 'no revienta'
  try { seo.cabeceraHtml(crudaDeLaBase, hermandad, crudaDeLaBase.cultos, 'https://x.es') } catch { crudo = 'revienta' }
  caso('la web CRUDA de la base revienta el SEO (por eso hay que completarla)', 'revienta', crudo)
  // Y completada, no.
  let completa = 'revienta'
  const buena = w.conDefectos(crudaDeLaBase)
  try {
    const html = seo.cabeceraHtml(buena, hermandad, buena.cultos, 'https://x.es')
    completa = html.includes('<title>Hdad</title>') ? 'ok con el título de la hermandad' : 'ok sin título'
  } catch (e) { completa = `revienta: ${e.message}` }
  caso('completada con conDefectos, el SEO sale bien', 'ok con el título de la hermandad', completa)

  /*
   * Y QUE `api/w.ts` LA COMPLETE. Esta lee el fichero porque no hay otra: es
   * una función de servidor que necesita Supabase y una petición. Lo que
   * vigila no es estético — es que no se vuelva a dar la web cruda al SEO.
   */
  const { readFile } = await import('node:fs/promises')
  const apiw = await readFile('api/w.ts', 'utf8')
  caso('api/w.ts completa la web antes de mirarla', true, /const web = conDefectos\(webGuardada\)/.test(apiw))
  caso('y no le pasa al SEO lo que saca de la base a pelo', false,
    /const web = filas\?\.\[0\]\?\.datos/.test(apiw))
}

/** Un campo de texto del elemento vacío, con un valor escrito, para ver que no se pisa. */
function primerTexto(vacio) {
  const clave = Object.keys(vacio).find((k) => typeof vacio[k] === 'string')
  return clave ? { [clave]: 'ESCRITO A MANO' } : {}
}
