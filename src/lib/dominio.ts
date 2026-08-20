/**
 * El dominio propio de la hermandad. Aquí solo va lo que se puede razonar sin
 * navegador: si lo que han escrito tiene forma de dominio, y qué le pasa.
 *
 * Hasta ahora se aceptaba cualquier cosa en la casilla, incluida una URL
 * entera con `https://` y barra final, un correo, o un espacio en blanco. Eso
 * acababa en el `sitemap.xml` y en las etiquetas de compartir, así que un
 * dedazo se propagaba a Google sin que nadie lo viera.
 */

/**
 * Limpia lo que han escrito: quita el protocolo, el `www.`, la ruta, el puerto,
 * los espacios y las mayúsculas. La gente copia y pega la barra de direcciones
 * entera, y eso es lo normal, no un error suyo.
 */
export function limpiarDominio(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.+$/, '')
}

export type ProblemaDominio = 'vacio' | 'sinPunto' | 'caracteres' | 'guiones' | 'extensionCorta' | 'esCorreo'

/**
 * Qué le pasa a este dominio, o `null` si está bien. Se comprueba la FORMA, no
 * que exista: eso solo se sabe consultándolo, y eso es cosa del navegador.
 */
export function problemaDelDominio(valor: string): ProblemaDominio | null {
  const bruto = valor.trim()
  if (!bruto) return 'vacio'
  if (bruto.includes('@')) return 'esCorreo'
  const d = limpiarDominio(bruto)
  if (!d) return 'vacio'
  if (!d.includes('.')) return 'sinPunto'
  // Letras, números, guiones y puntos. Nada más.
  if (!/^[a-z0-9.-]+$/.test(d)) return 'caracteres'
  // Ninguna etiqueta puede empezar ni acabar en guion, ni estar vacía.
  const partes = d.split('.')
  if (partes.some((p) => p === '' || p.startsWith('-') || p.endsWith('-'))) return 'guiones'
  const extension = partes[partes.length - 1]
  if (extension.length < 2) return 'extensionCorta'
  return null
}

/** El problema, explicado para que se pueda arreglar. */
export function explicarProblema(p: ProblemaDominio): string {
  switch (p) {
    case 'vacio':
      return 'Escribe el dominio que habéis comprado, por ejemplo hermandaddetriana.es'
    case 'esCorreo':
      return 'Eso parece un correo electrónico. Aquí va solo el dominio: hermandaddetriana.es'
    case 'sinPunto':
      return 'Falta la extensión. Un dominio lleva punto: hermandaddetriana.es, no hermandaddetriana'
    case 'caracteres':
      return 'Un dominio solo lleva letras, números, guiones y puntos. Quita los acentos, las eñes y los espacios.'
    case 'guiones':
      return 'Hay un guion o un punto mal colocado. No puede haber dos puntos seguidos ni empezar o acabar en guion.'
    case 'extensionCorta':
      return 'La extensión es demasiado corta. Debería ser .es, .org, .com…'
  }
}

/**
 * La dirección que hay que consultar para comprobar si el dominio apunta aquí.
 * Se pide una ruta que la propia aplicación sirve; si contesta y es la nuestra,
 * el dominio está bien apuntado.
 */
export function urlDeComprobacion(dominio: string): string {
  return `https://${limpiarDominio(dominio)}/robots.txt`
}

export type EstadoDominio = 'sinProbar' | 'comprobando' | 'apunta' | 'noResponde' | 'otroSitio'

/** Qué contarle a la hermandad según lo que haya salido de la comprobación. */
export function explicarEstado(estado: EstadoDominio, dominio: string): string {
  switch (estado) {
    case 'apunta':
      return `${dominio} ya sirve vuestra web. No hay nada más que hacer.`
    case 'noResponde':
      return `${dominio} todavía no responde. Si acabáis de tocar el DNS, es normal: puede tardar desde unos minutos hasta unas horas en propagarse. Volved a comprobarlo más tarde.`
    case 'otroSitio':
      return `${dominio} responde, pero no está sirviendo esta web. Revisad en el panel de despliegue que el dominio esté añadido, y que el registro DNS apunte a donde os han dicho.`
    default:
      return ''
  }
}


/**
 * ¿Este dominio es donde vive la aplicación, o es el de una hermandad?
 *
 * Al entrar por la puerta principal hay que decidir qué enseñar: la página de
 * Cabildo o la web de la hermandad que tenga puesto ese dominio. Aquí solo se
 * responde lo primero —si estamos en casa— para poder pintar la página de
 * Cabildo al momento, sin preguntar nada a la base de datos por cada visita.
 *
 * `VITE_DOMINIO_APP` es el dominio propio de Cabildo cuando lo haya. Sin
 * definirlo también funciona: entonces se consulta, se ve que ninguna
 * hermandad tiene ese dominio y se acaba enseñando la página de Cabildo
 * igualmente. Definirlo solo ahorra la consulta.
 */
export function esCasaDeCabildo(host: string, dominioApp?: string): boolean {
  const h = host.trim().toLowerCase().replace(/:\d+$/, '')
  if (!h) return true
  if (h === 'localhost' || h === '127.0.0.1') return true
  // Los despliegues de Vercel, incluidas las vistas previas de cada cambio.
  if (h.endsWith('.vercel.app')) return true
  const propio = (dominioApp ?? import.meta.env.VITE_DOMINIO_APP ?? '').trim().toLowerCase().replace(/^www\./, '')
  if (!propio) return false
  return h === propio || h === `www.${propio}`
}
