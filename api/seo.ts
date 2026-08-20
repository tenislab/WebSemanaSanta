/**
 * W9 · `sitemap.xml` y `robots.txt` de la web de la hermandad.
 *
 * El sitemap es la lista de páginas que se le da a Google para que las visite:
 * sin él, las noticias y las fichas de los titulares tardan semanas en salir,
 * o no salen. El robots dice quién puede mirar: una web sin publicar se cierra
 * a los buscadores, porque si Google indexa una hermandad a medio hacer luego
 * cuesta meses quitarlo.
 *
 * Si no hay base de datos o la web no existe, se devuelve lo más prudente:
 * un robots que no deja indexar nada y un sitemap vacío. Nunca un error.
 */
import { robotsTxt, sitemapXml } from '../src/lib/seoWeb'
import type { WebPublica } from '../src/lib/webPublica'

interface Peticion { url?: string; headers: Record<string, string | string[] | undefined> }
interface Respuesta {
  status(code: number): Respuesta
  setHeader(k: string, v: string): void
  send(body: string): void
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''

/**
 * La web publicada que corresponde a ESTE dominio.
 *
 * Antes se pedía «la primera web publicada que haya», que valía cuando cada
 * hermandad tenía su propia base de datos. Ahora están todas en la misma, así
 * que eso devolvía una cualquiera: el robots.txt y el sitemap.xml del dominio
 * de una hermandad podían acabar anunciando las páginas de otra.
 *
 * Se busca por el dominio propio que la hermandad tenga configurado en su web.
 * Si el dominio que pide no es de ninguna —por ejemplo el de la propia
 * aplicación— no hay web que servir, y eso es correcto: ahí no vive ninguna
 * hermandad en particular.
 */
async function webPublicada(host: string): Promise<WebPublica | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY || !host) return null
  const limpio = host.trim().toLowerCase().replace(/^www\./, '')
  if (!limpio) return null
  try {
    const filtro =
      `publicada=is.true&select=datos&limit=1` +
      `&or=(datos->>dominio.eq.${encodeURIComponent(limpio)},` +
      `datos->>dominio.eq.${encodeURIComponent(`www.${limpio}`)})`
    const r = await fetch(`${SUPABASE_URL}/rest/v1/web_publica?${filtro}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    if (!r.ok) return null
    const filas = (await r.json()) as { datos: WebPublica }[]
    return filas[0]?.datos ?? null
  } catch {
    return null
  }
}

export default async function handler(req: Peticion, res: Respuesta) {
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '')
  const origen = `https://${host}`
  const esRobots = (req.url ?? '').includes('robots')
  const web = await webPublicada(host)

  if (!web) {
    res.setHeader('Content-Type', esRobots ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8')
    res.send(
      esRobots
        ? 'User-agent: *\nDisallow: /\n'
        : '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n',
    )
    return
  }

  const base = (web.dominio ?? '').trim() ? `https://${web.dominio!.trim()}` : `${origen}/w/${web.slug}`
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400')
  if (esRobots) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(robotsTxt(web, base))
  } else {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.send(sitemapXml(web, base))
  }
}
