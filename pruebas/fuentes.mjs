/**
 * LA FUENTE DE UNA PANTALLA QUE VIVE EN VARIOS FICHEROS.
 *
 * ============================================================================
 * POR QUÉ HACE FALTA ESTO
 * ============================================================================
 *
 * Doce ficheros de prueba vigilan el editor de la web LEYENDO SU FUENTE:
 * «que el dominio se siga pidiendo aquí», «que no se haya duplicado el mensaje
 * de deshacer», «que el teléfono pase por su validador». Todos hacían
 * `readFile('src/pages/app/WebPublica.tsx')`.
 *
 * Y ese fichero tenía 4.770 líneas y había que partirlo. Al partirlo, los
 * guardias se dividen en dos clases y UNA DE LAS DOS ES SILENCIOSA:
 *
 *   · `caso('...', true, /lo bueno/.test(fuente))` → se pone ROJO. Molesta, se
 *     ve, se arregla. Sin peligro.
 *   · `caso('...', false, /lo malo/.test(fuente))` → se queda VERDE. El patrón
 *     malo ya no está en ESE fichero porque no está nada, y la comprobación
 *     pasa a no vigilar absolutamente nada sin decirlo. Es justo la clase de
 *     fallo que este proyecto ya ha pagado dos veces.
 *
 * Así que la fuente de una pantalla partida se pide ENTERA, por su nombre, y no
 * fichero a fichero. El día que se mueva otro trozo, los guardias siguen
 * mirando donde tienen que mirar.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const raiz = new URL('..', import.meta.url).pathname

/** Un fichero, tal cual. */
export async function fuente(ruta) {
  return readFile(join(raiz, ruta), 'utf8')
}

/**
 * Todos los ficheros de una carpeta, pegados, con una marca de dónde empieza
 * cada uno. La marca va en un comentario para que quien lea un fallo sepa en
 * qué fichero mirar sin tener que buscar a mano.
 */
async function pegarCarpeta(carpeta) {
  let nombres
  try {
    nombres = (await readdir(join(raiz, carpeta))).filter((n) => /\.tsx?$/.test(n)).sort()
  } catch {
    return '' // la carpeta puede no existir todavía
  }
  const trozos = []
  for (const n of nombres) {
    trozos.push(`\n/* ===== ${carpeta}/${n} ===== */\n`)
    trozos.push(await readFile(join(raiz, carpeta, n), 'utf8'))
  }
  return trozos.join('')
}

/**
 * EL EDITOR DE LA WEB PÚBLICA, ENTERO.
 *
 * La pantalla (`WebPublica.tsx`) más las veintitrés pestañas y los ayudantes
 * que viven en `src/pages/app/web/`. Es lo que tienen que leer los guardias que
 * antes leían el fichero gordo.
 */
export async function fuenteDelEditorWeb() {
  return (await fuente('src/pages/app/WebPublica.tsx')) + (await pegarCarpeta('src/pages/app/web'))
}

/**
 * EL ÁREA DEL HERMANO, ENTERA.
 *
 * La pantalla (`HermanoPortal.tsx`) más lo que viva en `src/pages/portal/`.
 * Aquí el asunto es peor que en el editor de la web: son VEINTITRÉS ficheros de
 * prueba los que la vigilan leyendo su fuente, así que un trozo movido de sitio
 * sin esto deja veintitantos guardias apuntando a un fichero donde ya no está
 * lo que miran.
 */
export async function fuenteDelPortalDelHermano() {
  return (await fuente('src/pages/HermanoPortal.tsx')) + (await pegarCarpeta('src/pages/portal'))
}

/**
 * EL CENSO, ENTERO.
 *
 * `Hermanos.tsx` más lo que viva en `src/pages/app/censo/`. Y aquí son
 * VEINTITRÉS ficheros de prueba los que la vigilan leyendo su fuente: es la
 * pantalla más mirada del proyecto, con motivo —es donde están los datos
 * personales de todos los hermanos—.
 */
export async function fuenteDelCenso() {
  return (await fuente('src/pages/app/Hermanos.tsx')) + (await pegarCarpeta('src/pages/app/censo'))
}

/**
 * COMUNICADOS, ENTERA.
 *
 * `Comunicados.tsx` más lo que viva en `src/pages/app/comunicados/`. Esta es
 * la pantalla con MÁS guardias que leen su fuente de todo el proyecto:
 * dieciséis sitios en doce ficheros de prueba. Y con razón —es la que manda
 * correo en nombre de la hermandad a ochocientas personas—, pero significa que
 * partirla sin esto dejaría dieciséis comprobaciones mirando un fichero donde
 * ya no está lo que vigilan, y la mitad de ellas en silencio.
 */
export async function fuenteDeLosComunicados() {
  return (await fuente('src/pages/app/Comunicados.tsx')) + (await pegarCarpeta('src/pages/app/comunicados'))
}

/**
 * EL CUERPO DE UNA FUNCIÓN, CONTANDO LAS LLAVES.
 *
 * Varios guardias recortan la fuente entre DOS MARCAS —«desde
 * `function crearEncargo` hasta `const rolesDisponibles`»— para mirar solo
 * dentro de esa función. Y eso se rompe en cuanto la función se muda de
 * fichero: la segunda marca se queda en la pantalla y la primera se va a la
 * carpeta, que se pega DESPUÉS, así que el recorte sale al revés y `slice`
 * devuelve la cadena vacía. Toda comprobación de la forma
 * `caso('...', true, /algo/.test(trozo))` se pone roja de golpe; las de la
 * forma `false` se quedarían verdes sin mirar nada.
 *
 * Contando llaves da igual dónde viva: se pide la función por su nombre y se
 * devuelve hasta su cierre. Devuelve '' si no la encuentra, y eso es lo que
 * hace saltar al guardia que la busca.
 */
export function cuerpoDeLaFuncion(fuente, marca) {
  const desde = fuente.indexOf(marca)
  if (desde < 0) return ''
  /*
   * SE SALTA LA LISTA DE PARÁMETROS ANTES DE BUSCAR EL CUERPO.
   *
   * La primera versión cogía la primera `{` después de la marca, y con un
   * `function useConvocar({ campana, … }: { … })` esa llave es la de
   * desestructurar: el conteo se cerraba ahí y devolvía LOS PARÁMETROS, no el
   * cuerpo. Un guardia acotado así no vigila nada —busca en un trozo donde lo
   * que busca nunca está— y sale rojo, o peor, verde por casualidad.
   *
   * Así que primero se cierra el paréntesis de los parámetros, contando, y la
   * llave del cuerpo es la primera que venga DESPUÉS.
   */
  const par = fuente.indexOf('(', desde)
  let arranque = desde
  if (par >= 0 && par < (fuente.indexOf('{', desde) < 0 ? Infinity : fuente.length)) {
    let p = 0
    for (let i = par; i < fuente.length; i++) {
      if (fuente[i] === '(') p++
      else if (fuente[i] === ')' && --p === 0) { arranque = i; break }
    }
  }
  const abre = fuente.indexOf('{', arranque)
  if (abre < 0) return ''
  let nivel = 0
  for (let i = abre; i < fuente.length; i++) {
    if (fuente[i] === '{') nivel++
    else if (fuente[i] === '}' && --nivel === 0) return fuente.slice(desde, i + 1)
  }
  return fuente.slice(desde) // sin cerrar: se devuelve lo que hay
}

/**
 * QUE `primero` ESTÉ, QUE `segundo` ESTÉ, Y QUE VAYA ANTES.
 *
 * Veintiocho guardias del proyecto comprobaban un orden comparando las dos
 * posiciones a secas —`fuente.indexOf(freno) < fuente.indexOf(envío)`— y eso
 * tiene una trampa que se ha cobrado uno de verdad: `indexOf` de algo que no
 * está devuelve **-1**, y `-1` es menor que cualquier posición. O sea que el
 * día que se borra lo que va primero, la comparación sigue siendo cierta y el
 * guardia se queda VERDE justo cuando ha desaparecido lo que vigilaba.
 *
 * Salió rompiendo a propósito el freno del boletín: quitando entero el «si no
 * se pudo leer la lista, no mandes», las 5636 pruebas seguían pasando. Con los
 * `>` es igual pero al revés: es el de la derecha el que puede faltar.
 *
 * Vale para una cadena y para una lista, que es como se usa en las dos formas:
 * el orden de dos trozos de código y el orden de dos elementos de un catálogo.
 */
export function antesQue(donde, primero, segundo) {
  const a = donde.indexOf(primero)
  const b = donde.indexOf(segundo)
  return a >= 0 && b >= 0 && a < b
}

/**
 * LAS CUOTAS, ENTERA.
 *
 * `Cuotas.tsx` más lo que viva en `src/pages/app/cuotas/`. Quince sitios en
 * once ficheros de prueba la vigilan leyendo su fuente, y aquí lo que se
 * vigila es dinero: la remesa que va al banco, el fichero de devoluciones, la
 * emisión del ejercicio y la mora. Un guardia que deje de mirar en silencio
 * sale caro de verdad.
 */
export async function fuenteDeLasCuotas() {
  return (await fuente('src/pages/app/Cuotas.tsx')) + (await pegarCarpeta('src/pages/app/cuotas'))
}

/**
 * LOS AJUSTES, ENTERA.
 *
 * `Configuracion.tsx` más lo que viva en `src/pages/app/ajustes/`. Dieciséis
 * sitios en trece ficheros de prueba la vigilan leyendo su fuente, y lo que
 * miran es variado y delicado: el NIF y el IBAN de la hermandad, el
 * identificador de acreedor SEPA, la copia cifrada, el correo, los campos
 * propios del censo y el teclado de los formularios.
 */
export async function fuenteDeLosAjustes() {
  return (await fuente('src/pages/app/Configuracion.tsx')) + (await pegarCarpeta('src/pages/app/ajustes'))
}

/**
 * LA WEB PÚBLICA PINTADA, ENTERA.
 *
 * `SitioContenido.tsx` más lo que viva en `src/components/sitio/`. Aquí no son
 * dieciséis guardias como en otras pantallas: son pocos, pero uno de ellos es
 * de la clase silenciosa y de los que más duelen —que la web NO herede el
 * teléfono, la dirección ni el correo personales de Configuración—. Leyendo un
 * fichero que ha adelgazado, ese guardia se queda verde mientras el patrón
 * puede volver a aparecer en los ficheros nuevos.
 */
export async function fuenteDelSitio() {
  return (await fuente('src/components/SitioContenido.tsx')) + (await pegarCarpeta('src/components/sitio'))
}

/**
 * LAS PAPELETAS DE SITIO, ENTERA.
 *
 * `Papeletas.tsx` más lo que viva en `src/pages/app/papeletas/`. Ocho sitios en
 * ocho ficheros de prueba la vigilan, y lo que miran es delicado por partida
 * doble: el cobro de la papeleta —que va al libro de cuentas— y el sitio que le
 * toca a cada hermano en el cortejo, que es lo que una hermandad discute
 * durante todo el año.
 */
export async function fuenteDeLasPapeletas() {
  return (await fuente('src/pages/app/Papeletas.tsx')) + (await pegarCarpeta('src/pages/app/papeletas'))
}

/**
 * La fuente de lo que vive en esa ruta, contando con que una pantalla puede
 * estar partida en varios ficheros.
 *
 * Sirve para los guardias que recorren una LISTA de rutas —«estos seis
 * ficheros usan `problemaDeTelefono`»—: se cambia `readFile` por esto y la
 * lista se queda como estaba, con el nombre de la pantalla, que es lo que se
 * entiende al leerla.
 */
export async function fuenteDe(ruta) {
  if (ruta === 'src/pages/app/WebPublica.tsx') return fuenteDelEditorWeb()
  if (ruta === 'src/pages/HermanoPortal.tsx') return fuenteDelPortalDelHermano()
  if (ruta === 'src/pages/app/Hermanos.tsx') return fuenteDelCenso()
  if (ruta === 'src/pages/app/Comunicados.tsx') return fuenteDeLosComunicados()
  if (ruta === 'src/pages/app/Cuotas.tsx') return fuenteDeLasCuotas()
  if (ruta === 'src/pages/app/Configuracion.tsx') return fuenteDeLosAjustes()
  if (ruta === 'src/components/SitioContenido.tsx') return fuenteDelSitio()
  if (ruta === 'src/pages/app/Papeletas.tsx') return fuenteDeLasPapeletas()
  return fuente(ruta)
}
