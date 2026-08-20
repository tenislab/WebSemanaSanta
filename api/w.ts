/**
 * W9 · El HTML de la web pública, servido con los datos de la hermandad.
 *
 * EL PROBLEMA QUE RESUELVE: la web es una aplicación de una sola página. El
 * título, la descripción y la imagen los pone el navegador con JavaScript,
 * cuando la página ya se ha cargado. Pero WhatsApp, Facebook, X y buena parte
 * de los rastreadores NO ejecutan JavaScript: piden el HTML y leen lo que hay.
 * Sin esta función, al pegar el enlace de la hermandad en el grupo de WhatsApp
 * la vista previa dice «Cabildo — Software para gestionar tu hermandad».
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
 *   2. Define SUPABASE_URL y SUPABASE_ANON_KEY en el despliegue.
 *   3. Deja los `rewrites` de `vercel.json` como están.
 */
import { cabeceraHtml } from '../src/lib/seoWeb'
import type { WebPublica } from '../src/lib/webPublica'
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

export default async function handler(req: Peticion, res: Respuesta) {
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '')
  const origen = `https://${host}`
  const ruta = new URL(req.url ?? '/', origen)
  // /w/<slug>[/n/<noticia>|/t/<titular>|/noticias]
  const partes = ruta.pathname.split('/').filter(Boolean)
  const slug = partes[1] ?? ''

  // El HTML de siempre. Si ni siquiera esto se puede pedir, no hay nada que hacer.
  let html: string
  try {
    const r = await fetch(`${origen}/index.html`)
    html = await r.text()
  } catch {
    res.status(302)
    res.setHeader('Location', '/')
    res.send('')
    return
  }

  const filas = await consulta<{ datos: WebPublica; publicada: boolean }>(
    'web_publica',
    `slug=eq.${encodeURIComponent(slug)}&publicada=is.true&select=datos,publicada`,
  )
  const web = filas?.[0]?.datos
  if (!web) {
    // Sin datos se devuelve la página tal cual: la aplicación se apaña sola.
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
    return
  }

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

  // La pieza concreta que se está compartiendo, si es una página suelta.
  let pieza: { titulo: string; descripcion: string; imagen: string | null; ruta: string } | undefined
  if (partes[2] === 'n' && partes[3]) {
    const n = (web.noticias ?? []).find((x) => (x.slug?.trim() || '') === partes[3] || x.id === partes[3])
    if (n) pieza = { titulo: n.titulo, descripcion: n.resumen, imagen: n.fotoDataUrl, ruta: `/n/${partes[3]}` }
  } else if (partes[2] === 't' && partes[3]) {
    const t = (web.titulares ?? []).find((x) => (x.slug?.trim() || '') === partes[3] || x.id === partes[3])
    if (t) pieza = { titulo: t.nombre, descripcion: t.descripcion || t.autoria, imagen: t.fotoDataUrl, ruta: `/t/${partes[3]}` }
  }

  const base = (web.dominio ?? '').trim() ? `https://${web.dominio!.trim()}` : `${origen}/w/${slug}`
  const cabecera = cabeceraHtml(web, hermandad, cultos, base, pieza)

  // Se quitan el título y la descripción genéricos de la aplicación para que no
  // haya dos, y se mete la cabecera de la hermandad justo antes de </head>.
  const limpio = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Cache corta: la hermandad cambia su web y quiere verlo hoy, no mañana.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400')
  res.send(limpio.replace('</head>', `${cabecera}\n</head>`))
}
