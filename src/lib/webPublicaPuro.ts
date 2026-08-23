import type { Cartel, CultoWeb, Noticia, Titular } from './webPublica'

/*
 * Las cuatro funciones de la web pública que TAMBIÉN corren en el servidor.
 *
 * POR QUÉ ESTÁN AQUÍ Y NO EN `webPublica.ts`, QUE ES SU SITIO NATURAL:
 *
 * La función de servidor que sirve el HTML de la web (`api/w.ts`) necesitaba
 * tres de ellas. Las importaba de `webPublica.ts`, que a su vez importa React
 * y `./supabase`. Y `./supabase` hace esto en la primera línea:
 *
 *     const url = import.meta.env.VITE_SUPABASE_URL
 *
 * `import.meta.env` es cosa de Vite: en el navegador existe, en el servidor
 * NO. Así que al arrancar la función reventaba con un
 *
 *     TypeError: Cannot read properties of undefined (reading 'VITE_SUPABASE_URL')
 *
 * antes de ejecutar una sola línea nuestra. Y como `vercel.json` manda a esa
 * función la RAÍZ del dominio y todas las webs de hermandad, lo que se veía en
 * gobergo.com era «This Serverless Function has crashed · 500». La puerta
 * principal, caída, sin que nada de la aplicación estuviera mal.
 *
 * Es de los fallos que no se ven en local: en desarrollo esa función no se
 * ejecuta, y las pruebas no la arrancaban. Por eso ahora hay una que la
 * construye igual que Vercel y la importa (`pruebas/servidor.prueba.mjs`).
 *
 * De paso, el paquete de la función pasó de 900 KB —con React y el cliente
 * entero de Supabase dentro— a lo que de verdad usa, que es `fetch`.
 *
 * REGLA PARA EL FUTURO: lo que importe `api/`, que no importe nada del
 * navegador. Ni React, ni `./supabase`, ni `import.meta.env`, ni
 * `localStorage`. Este fichero no importa NADA en tiempo de ejecución, solo
 * tipos, y así tiene que seguir.
 */

/** «Cartel de la Salida 2027» → «cartel-de-la-salida-2027». */
export function aSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** El trozo de dirección de una noticia: el suyo, o uno sacado del titular. */
export function slugNoticia(n: Noticia): string {
  return n.slug?.trim() || aSlug(n.titulo) || n.id
}

/** Igual, para un titular. */
export function slugTitular(t: Titular): string {
  return t.slug?.trim() || aSlug(t.nombre) || t.id
}

/**
 * Y para un culto.
 *
 * Lleva el AÑO pegado a propósito: los cultos de una hermandad se llaman todos
 * igual año tras año —«Solemne Quinario», «Función Principal de Instituto»— y
 * sin el año dos cultos de dos años distintos comparten dirección. El primero
 * que se encuentra gana y el otro no se puede abrir.
 *
 * Cuando el culto viene del calendario hay fecha de verdad y de ahí sale el
 * año; escrito a mano, se busca un año de cuatro cifras en el texto de la
 * fecha, y si no lo hay se queda solo con el título — que es lo que había
 * antes y sigue funcionando.
 */
export function slugCulto(c: CultoWeb): string {
  const base = aSlug(c.titulo) || c.id
  const anio = c.fechaIso?.slice(0, 4) || (c.fecha.match(/\b(19|20)\d{2}\b/) ?? [])[0] || ''
  return anio ? `${base}-${anio}` : base
}

/**
 * Los carteles, el más reciente primero. Se ordena por el año escrito, y los
 * que no lo tengan van al final: un cartel sin año no puede colarse por
 * delante del de este año solo porque se subiera después.
 */
export function cartelesOrdenados(carteles: Cartel[]): Cartel[] {
  return [...carteles].sort((a, b) => (Number(b.anio) || 0) - (Number(a.anio) || 0))
}

/**
 * Las noticias agrupadas por año, de lo más nuevo a lo más viejo: la
 * hemeroteca.
 *
 * Sin esto, la actualidad de una hermandad con seis años de web es una lista
 * infinita donde para llegar al Quinario de 2023 hay que bajar doscientas
 * veces. Las que no tienen fecha se agrupan aparte, al final, en vez de
 * colarse en el año en curso.
 */
export function noticiasPorAnio(noticias: Noticia[]): { anio: string; noticias: Noticia[] }[] {
  const porAnio = new Map<string, Noticia[]>()
  for (const n of noticiasPublicadas(noticias)) {
    const anio = /^\d{4}/.test(n.fecha ?? '') ? n.fecha.slice(0, 4) : ''
    const lista = porAnio.get(anio)
    if (lista) lista.push(n)
    else porAnio.set(anio, [n])
  }
  return [...porAnio.entries()]
    .map(([anio, ns]) => ({ anio, noticias: ns }))
    .sort((a, b) => {
      // Las sin fecha, siempre las últimas: no son «del año 0».
      if (!a.anio) return 1
      if (!b.anio) return -1
      return b.anio.localeCompare(a.anio)
    })
}

/** Las noticias que se ven en la web, la destacada primero y por fecha. */
export function noticiasPublicadas(noticias: Noticia[]): Noticia[] {
  return noticias
    .filter((n) => n.publicada)
    .sort((a, b) => {
      // La destacada manda sobre la fecha: es la que la hermandad quiere arriba.
      if (Boolean(a.destacada) !== Boolean(b.destacada)) return a.destacada ? -1 : 1
      return (b.fecha || '').localeCompare(a.fecha || '')
    })
}
