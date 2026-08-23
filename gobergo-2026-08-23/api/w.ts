/**
 * W9 · El HTML de la web pública, servido con los datos de la hermandad.
 *
 * EL PROBLEMA QUE RESUELVE: la web es una aplicación de una sola página. El
 * título, la descripción y la imagen los pone el navegador con JavaScript,
 * cuando la página ya se ha cargado. Pero WhatsApp, Facebook, X y buena parte
 * de los rastreadores NO ejecutan JavaScript: piden el HTML y leen lo que hay.
 * Sin esta función, al pegar el enlace de la hermandad en el grupo de WhatsApp
 * la vista previa dice «Gobergo — Software para gestionar tu hermandad».
 *
 * CÓMO FUNCIONA: pide el `index.html` de este mismo despliegue, le mete en el
 * `<head>` las etiquetas de esa hermandad y lo devuelve. La aplicación arranca
 * igual que siempre; lo único que cambia es lo que ve quien no ejecuta JS.
 *
 * SI ALGO FALLA (no hay base de datos, la web no existe, la consulta peta) se
 * devuelve el `index.html` tal cual: la web sigue funcionando como hasta ahora.
 * Nunca se rompe la página por culpa de esto.
 *
 * PARA ENCENDERLO:
 *   1. Ejecuta `supabase/web-publica.sql` en tu proyecto.
 *   2. Ejecuta `supabase/imagenes.sql`. Sin esto la cabecera sale sin foto:
 *      las imágenes se quedan escritas dentro del contenido y ni WhatsApp ni
 *      Facebook leen una imagen en `data:` — ver `lib/almacenImagenes.ts`.
 *   3. Define SUPABASE_URL y SUPABASE_ANON_KEY en el despliegue.
 *   4. Deja los `rewrites` de `vercel.json` como están.
 */
/*
 * NADA SE IMPORTA ARRIBA, y esto es a propósito.
 *
 * Un `import` de arriba se resuelve AL CARGAR el módulo, antes de que se
 * ejecute una sola línea nuestra — antes incluso de que exista la red de
 * seguridad de más abajo. Si ese import falla, Vercel no tiene a quién
 * preguntar: devuelve «This Serverless Function has crashed · 500».
 *
 * Y ya pasó. `seoWeb` arrastraba `webPublica`, que arrastraba `supabase`, cuya
 * primera línea es `import.meta.env.VITE_SUPABASE_URL`. `import.meta.env` es
 * cosa de Vite: en el navegador existe y en el servidor NO. La función
 * reventaba al arrancar con
 *
 *     TypeError: Cannot read properties of undefined (reading 'VITE_SUPABASE_URL')
 *
 * y como `vercel.json` manda a esta función la RAÍZ del dominio y todas las
 * webs de hermandad, lo que se veía en gobergo.com era la pantalla de error de
 * Vercel. La puerta principal caída sin que nada de la aplicación estuviera mal.
 *
 * Se arregló el import. Pero arreglar EL CASO no arregla LA CLASE: cualquiera
 * puede volver a colar mañana un import de navegador en `seoWeb`, y volveríamos
 * aquí. Así que ahora lo que se trae se pide DENTRO del manejador, con
 * `await import(...)`, y por tanto dentro del try. Si algún día vuelve a
 * fallar, se sirve la página sin las etiquetas de la hermandad —se comparte
 * peor por WhatsApp, nada más— en vez de caerse la casa entera.
 *
 * Los `import type` sí se quedan: los borra el compilador y no existen en
 * tiempo de ejecución.
 */
import type { WebPublica } from '../src/lib/webPublica'
import type { PiezaSeo } from '../src/lib/seoWeb'
import type { HermandadSettings } from '../src/lib/hermandadSettings'
import type { CultoWeb } from '../src/lib/webPublica'

interface Peticion { url?: string; headers: Record<string, string | string[] | undefined> }
interface Respuesta {
  status(code: number): Respuesta
  setHeader(k: string, v: string): void
  send(body: string): void
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''

/** Una consulta a la API REST de Supabase, sin cliente ni dependencias. */
async function consulta<T>(tabla: string, filtro: string): Promise<T[] | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${filtro}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    if (!r.ok) return null
    return (await r.json()) as T[]
  } catch {
    return null
  }
}

/** Una función del servidor de Supabase (RPC), igual de a pelo. */
async function funcion<T>(nombre: string, args: Record<string, unknown>): Promise<T[] | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    })
    if (!r.ok) return null
    return (await r.json()) as T[]
  } catch {
    return null
  }
}

/**
 * ¿Este dominio es el de la propia aplicación?
 *
 * Se repite aquí en vez de traerlo de `src/lib/dominio.ts` porque aquello lee
 * `import.meta.env`, que en el servidor no existe. Es la misma regla: los
 * despliegues de Vercel, el ordenador de casa y el dominio propio de Gobergo
 * cuando lo haya.
 */
function esCasa(host: string): boolean {
  if (host === 'localhost' || host === '127.0.0.1') return true
  if (host.endsWith('.vercel.app')) return true
  const propio = (process.env.DOMINIO_APP ?? process.env.VITE_DOMINIO_APP ?? '')
    .trim().toLowerCase().replace(/^www\./, '')
  return !!propio && host === propio
}

/*
 * La red de seguridad.
 *
 * `vercel.json` manda a esta función la RAÍZ del dominio y todas las webs de
 * hermandad. O sea que cualquier cosa que reviente aquí dentro no rompe una
 * página: rompe la puerta principal de Gobergo, con un «This Serverless
 * Function has crashed · 500» delante de quien entre.
 *
 * Ya pasó, y por un motivo tonto: un `import` que arrastraba código de
 * navegador (ver webPublicaPuro.ts). Se arregló el import, pero la lección es
 * la otra: esto NUNCA debería haber podido devolver un 500. Lo que hace esta
 * función es adornar el HTML con las etiquetas de la hermandad para que la
 * vista previa de WhatsApp salga bien. Si el adorno falla, se sirve la página
 * sin adornar y ya está. Que se vea peor al compartirla es un problema
 * pequeño; que no se vea, no.
 */
export default async function handler(req: Peticion, res: Respuesta) {
  try {
    await servir(req, res)
  } catch (e) {
    console.error('La función de la web ha fallado; se sirve la página sin adornar:', e)
    try {
      const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '')
      const r = await fetch(`https://${host}/index.html`)
      res.status(200)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.send(await r.text())
    } catch {
      // Ni el HTML de siempre se ha podido pedir. Aquí ya no queda nada que
      // hacer, pero al menos se dice en cristiano y sin pantalla de error.
      res.status(503)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.send('<!doctype html><meta charset="utf-8"><title>No disponible</title><p>La página no está disponible ahora mismo. Vuelve a intentarlo en unos minutos.</p>')
    }
  }
}

async function servir(req: Peticion, res: Respuesta) {
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '')
  const origen = `https://${host}`
  const ruta = new URL(req.url ?? '/', origen)
  const partes = ruta.pathname.split('/').filter(Boolean)

  // Hay dos formas de pedir la misma página y las dos pasan por aquí:
  //
  //   /w/<slug>[/n/<noticia>|/t/<titular>|/c/<culto>|/noticias]  ← sin dominio propio
  //   /[n/<noticia>|t/<titular>|c/<culto>|noticias]               ← con su dominio
  //
  // En la segunda no hay slug en la dirección: la hermandad se averigua por el
  // dominio por el que ha entrado. Sin esto, la hermandad que acaba de conectar
  // su dominio —justo la que ha pagado por tenerlo— era la única cuya vista
  // previa de WhatsApp seguía diciendo «Gobergo · Software para hermandades».
  const enRutaLarga = partes[0] === 'w' && !!partes[1]
  const slugRuta = enRutaLarga ? partes[1] : ''
  const tipoPieza = enRutaLarga ? partes[2] : partes[0]
  const slugPieza = enRutaLarga ? partes[3] : partes[1]

  // El HTML de siempre. Si ni siquiera esto se puede pedir, no hay nada que hacer.
  let html: string
  try {
    const r = await fetch(`${origen}/index.html`)
    html = await r.text()
  } catch {
    // Mandar a la portada solo vale si no estamos YA en la portada: desde que
    // la raíz también pasa por aquí, ese redirección se llamaría a sí misma y
    // el navegador daría «demasiadas redirecciones» en vez del error real.
    if (ruta.pathname !== '/') {
      res.status(302)
      res.setHeader('Location', '/')
      res.send('')
      return
    }
    res.status(503)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.send('<!doctype html><meta charset="utf-8"><title>No disponible</title><p>La página no está disponible ahora mismo. Vuelve a intentarlo en unos minutos.</p>')
    return
  }

  const porSlug = `slug=eq.${encodeURIComponent(slugRuta)}&publicada=is.true&select=datos,publicada`
  // Por dominio: se acepta con y sin `www.`, porque la hermandad escribe uno u
  // otro en su web y el visitante teclea el que le da la gana.
  const hostLimpio = host.trim().toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '')
  const porDominio =
    `publicada=is.true&select=datos,publicada&limit=1` +
    `&or=(datos->>dominio.eq.${encodeURIComponent(hostLimpio)},` +
    `datos->>dominio.eq.${encodeURIComponent(`www.${hostLimpio}`)})`

  // La puerta principal de Gobergo no se consulta: ahí no vive ninguna
  // hermandad y ya se sabe. Sin este atajo, cada visita a la portada pagaría
  // una consulta a la base de datos para enterarse de que no hay nada.
  const filas = slugRuta
    ? await consulta<{ datos: WebPublica; publicada: boolean }>('web_publica', porSlug)
    : hostLimpio && !esCasa(hostLimpio)
      ? await consulta<{ datos: WebPublica; publicada: boolean }>('web_publica', porDominio)
      : null
  const web = filas?.[0]?.datos
  if (!web) {
    // No hay hermandad detrás de esta dirección: puede ser la puerta principal
    // de Gobergo, o un dominio recién apuntado que todavía no ha configurado
    // nadie. Se devuelve la página tal cual y la aplicación se apaña sola.
    // La caché larga es a propósito: así la portada no paga una consulta a la
    // base de datos por cada visita.
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400')
    res.send(html)
    return
  }
  /* Se pide aquí, no arriba: ver la nota del principio del fichero. */
  const { cabeceraHtml, idiomaSeguro } = await import('../src/lib/seoWeb')
  const slug = web.slug || slugRuta

  // Los datos de la hermandad (nombre legal, dirección, logo) salen de una
  // función que devuelve solo los campos que esta página enseña, buscando por
  // el slug de la web. Leer `hermandad_settings` directamente, como antes, no
  // funcionaba ni funcionará: esa tabla lleva el IBAN y el CIF y no la puede
  // abrir nadie sin sesión. Además, ahora todas las hermandades comparten
  // tabla y pedir «la fila 1» traería la de cualquiera.
  const ajustes = await funcion<Record<string, string | null>>('hermandad_de_la_web', { p_slug: slug })
  const fila = ajustes?.[0] ?? {}
  const hermandad = {
    nombreLegal: fila.nombre_legal ?? '',
    direccion: fila.direccion ?? '',
    codigoPostal: fila.codigo_postal ?? '',
    ciudad: fila.ciudad ?? '',
    provincia: fila.provincia ?? '',
    telefono: fila.telefono ?? '',
    email: fila.email ?? '',
    logoDataUrl: fila.logo_data_url ?? null,
  } as HermandadSettings
  const cultos: CultoWeb[] = []

  /*
   * La pieza concreta que se está compartiendo, si es una página suelta.
   *
   * Va con TIPO y con FECHA. Sin el tipo, una noticia y la ficha de un titular
   * se describían igual a ojos de Google; y una noticia sin fecha no puede
   * salir en Discover ni en «lo más reciente», que es justo donde una
   * hermandad quiere aparecer cuando publica el cartel.
   */
  let pieza: PiezaSeo | undefined
  if (tipoPieza === 'n' && slugPieza) {
    const n = (web.noticias ?? []).find((x) => (x.slug?.trim() || '') === slugPieza || x.id === slugPieza)
    if (n) {
      pieza = {
        titulo: n.titulo, descripcion: n.resumen, imagen: n.fotoDataUrl,
        ruta: `/n/${slugPieza}`, tipo: 'noticia', fecha: n.fecha || undefined,
      }
    }
  } else if (tipoPieza === 't' && slugPieza) {
    const t = (web.titulares ?? []).find((x) => (x.slug?.trim() || '') === slugPieza || x.id === slugPieza)
    if (t) {
      pieza = {
        titulo: t.nombre, descripcion: t.descripcion || t.autoria, imagen: t.fotoDataUrl,
        ruta: `/t/${slugPieza}`, tipo: 'titular',
      }
    }
  } else if (tipoPieza === 'c' && slugPieza) {
    /*
     * UN CULTO. Se busca por su enlace, que lleva el año pegado: los cultos de
     * una hermandad se llaman todos igual año tras año, y sin el año dos
     * quinarios de dos años distintos comparten dirección.
     *
     * Solo se miran los ESCRITOS en la web: los del calendario viven en el
     * navegador de la hermandad y aquí no hay navegador.
     */
    const { slugCulto } = await import('../src/lib/webPublicaPuro')
    const c = (web.cultos ?? []).find((x) => slugCulto(x) === slugPieza || x.id === slugPieza)
    if (c) {
      pieza = {
        titulo: c.titulo,
        descripcion: [c.fecha, c.lugar].filter((x) => x?.trim()).join(' · ') || c.detalle || '',
        imagen: c.fotoDataUrl,
        ruta: `/c/${slugPieza}`,
        tipo: 'culto',
        fecha: c.fechaIso || undefined,
        lugar: c.lugar || undefined,
      }
    }
  } else if (tipoPieza === 'noticias') {
    pieza = { titulo: 'Actualidad', descripcion: '', imagen: null, ruta: '/noticias', tipo: 'listado' }
  }

  const base = (web.dominio ?? '').trim() ? `https://${web.dominio!.trim()}` : `${origen}/w/${slug}`
  const cabecera = cabeceraHtml(web, hermandad, cultos, base, pieza)

  // El idioma de la página. El `index.html` viene con `lang="es"` fijo porque
  // la aplicación es española, pero una hermandad puede publicar su web en
  // otra lengua, y entonces esa etiqueta miente: Google la indexa como
  // castellano y un lector de pantalla la lee con acento castellano. Aquí se
  // sabe el idioma de verdad, así que se corrige.
  const idioma = idiomaSeguro(web.idioma)

  // Se quitan el título y la descripción genéricos de la aplicación para que no
  // haya dos, y se mete la cabecera de la hermandad justo antes de </head>.
  const htmlSinCabecera = html
    .replace(/<html([^>]*)\slang=["'][^"']*["']/i, `<html$1 lang="${idioma}"`)
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Cache corta: la hermandad cambia su web y quiere verlo hoy, no mañana.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400')
  res.send(htmlSinCabecera.replace('</head>', `${cabecera}\n</head>`))
}
