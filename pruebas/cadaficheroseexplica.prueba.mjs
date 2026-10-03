/**
 * QUE NINGÚN FICHERO EMPIECE POR LOS IMPORTS Y A VER QUIÉN LO ADIVINA.
 *
 * ----------------------------------------------------------------------------
 * QUÉ VIGILA, Y POR QUÉ ES UNA PRUEBA Y NO UNA RECOMENDACIÓN
 * ----------------------------------------------------------------------------
 *
 * Todo fichero de `src/` y de `api/` empieza por un comentario que dice QUÉ
 * HACE. Son 86.570 líneas en 373 ficheros, con un dominio —hermandades,
 * papeletas, cortejo, escalafón— que no se deduce del código: quien llega y
 * abre `Cuotas.tsx` por el medio no tiene forma de saber que emitir dos veces
 * el mismo ejercicio es cobrar dos veces.
 *
 * Esto se escribió DESPUÉS de ponerlas todas, y por eso existe: lo que se pone
 * una vez a mano se descuida en el fichero siguiente. Una norma que nadie
 * comprueba dura hasta el próximo que tenga prisa.
 *
 * ----------------------------------------------------------------------------
 * LO QUE **NO** VIGILA, A PROPÓSITO
 * ----------------------------------------------------------------------------
 *
 * NO MIDE LA CALIDAD de lo que diga el comentario: eso no lo puede hacer una
 * expresión regular, y fingir que sí sería peor que no mirarlo. Vigila lo único
 * que se puede comprobar —que está, y que no es una línea de relleno— y el
 * resto es trabajo de quien escribe y de quien revisa.
 *
 * Y NO EXIGE UNA LONGITUD MÍNIMA DE PALABRAS. Un fichero de treinta líneas con
 * una frase está bien explicado; `Hermanos.tsx` necesita cincuenta líneas. El
 * listón es el mismo —se entiende sin leer el código— y no se mide igual.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const raiz = new URL('..', import.meta.url).pathname

/** Todos los `.ts` y `.tsx` de una carpeta, recorriendo lo que haya dentro. */
async function fuentes(carpeta) {
  const salida = []
  for (const entrada of await readdir(join(raiz, carpeta), { withFileTypes: true })) {
    const ruta = `${carpeta}/${entrada.name}`
    if (entrada.isDirectory()) salida.push(...(await fuentes(ruta)))
    else if (/\.tsx?$/.test(entrada.name) && !/\.d\.ts$/.test(entrada.name)) salida.push(ruta)
  }
  return salida
}

export default async function ({ caso }) {
  const rutas = [...(await fuentes('src')), ...(await fuentes('api'))].sort()

  /*
   * DÓNDE SE BUSCA LA CABECERA: ANTES DEL PRIMER `export`.
   *
   * No en la línea 1. En este repositorio hay dos disposiciones y las dos son
   * buenas: el comentario arriba del todo, o los `import` primero y el
   * comentario justo debajo. Exigir la línea 1 pondría en rojo ciento cincuenta
   * ficheros correctos y obligaría a moverlos por nada, y una guarda que manda
   * hacer trabajo inútil se desactiva en una semana.
   *
   * Lo que sí es la regla: el comentario va ANTES de lo primero que el fichero
   * exporta. Detrás no es una cabecera, es la documentación de otra cosa.
   */
  const sinCabecera = []
  const vacias = []
  for (const ruta of rutas) {
    const texto = await readFile(join(raiz, ruta), 'utf8')
    const lineas = texto.split('\n')
    const inicio = lineas.findIndex((l) => /^\/\*/.test(l))
    const primerExport = lineas.findIndex((l) => /^(export |function )/.test(l))
    if (inicio === -1 || (primerExport !== -1 && inicio > primerExport)) { sinCabecera.push(ruta); continue }

    /*
     * Y SE MIRA QUE DIGA ALGO. Un bloque de comentario VACÍO, o una fila de
     * guiones de adorno, cumpliría la letra de la guarda sin cumplir nada más,
     * y entonces esta prueba se convierte en el trámite que hay que satisfacer
     * para subir un fichero — justo lo contrario de para lo que está.
     *
     * (Y no, aquí no se puede poner el ejemplo literal de un comentario vacío:
     *  cierra ESTE comentario y rompe el fichero. Pasó al escribirlo.)
     *
     * El listón es BAJO a propósito: veinte caracteres de texto de verdad. No
     * se trata de medir cuánto se escribe, sino de que no haya una cáscara.
     */
    const cierra = lineas.findIndex((l, i) => i >= inicio && l.includes('*/'))
    const dentro = lineas
      .slice(inicio, cierra === -1 ? inicio + 1 : cierra + 1)
      .join(' ')
      .replace(/[^\p{L}\p{N} ]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (dentro.length < 20) vacias.push(`${ruta} (${dentro.length})`)
  }

  caso('todo fichero de src/ y api/ empieza explicándose', [], sinCabecera)
  caso('y ninguna cabecera está de adorno', [], vacias)

  /*
   * LAS PANTALLAS GRANDES, CON MÁS MOTIVO. Un fichero de más de cuatrocientas
   * líneas con una frase de cabecera cumple la guarda de arriba y no sirve:
   * ahí hay decisiones, y las decisiones son lo que no se deduce leyendo.
   *
   * CUATROCIENTAS LÍNEAS Y TRESCIENTOS CARACTERES no son cifras sagradas: son
   * las que dejan pasar lo que ya está escrito sin dejar pasar una frase
   * suelta. Si alguien añade una pantalla de mil líneas con un renglón arriba,
   * esto se pone roja, y es lo que se busca.
   */
  const grandesPobres = []
  for (const ruta of rutas) {
    const texto = await readFile(join(raiz, ruta), 'utf8')
    const lineas = texto.split('\n')
    if (lineas.length <= 400) continue
    const inicio = lineas.findIndex((l) => /^\/\*/.test(l))
    if (inicio === -1) continue
    const cierra = lineas.findIndex((l, i) => i >= inicio && l.includes('*/'))
    if (cierra === -1) continue
    const cabecera = lineas.slice(inicio, cierra + 1).join(' ')
      .replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()
    if (cabecera.length < 300) grandesPobres.push(`${ruta} (${lineas.length} líneas, ${cabecera.length} caracteres)`)
  }
  caso('y las pantallas grandes se explican de verdad', [], grandesPobres)
}
