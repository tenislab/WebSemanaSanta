/**
 * QUE NINGUNA PLANTILLA SE GUARDE Y NO SE LEA.
 *
 * Siete cosas de la hermandad viven en `localStorage` y se guardan en
 * `hermandad_settings` para que viajen entre dispositivos: el modelo de
 * papeleta, el de recibo, la asistencia, los ajustes de cuotas, las etiquetas,
 * la campaña y los campos propios.
 *
 * CUATRO DE LAS SIETE SE GUARDABAN Y NO LAS LEÍA NADIE. Cada una tenía escrita
 * su `cargar…DeLaBase()`, correcta y probada. Lo que faltaba era la llamada. El
 * dato subía a la base de la hermandad y se quedaba allí.
 *
 * Y NO SE VE DE NINGUNA MANERA AL PROBAR A MANO, porque en el ordenador donde
 * se prueba el dato ya está en `localStorage` —lo acabas de escribir tú—. Todo
 * funciona. Solo se rompe en el SEGUNDO dispositivo:
 *
 *   · El diputado marca la asistencia la madrugada del Viernes Santo desde su
 *     móvil. La secretaria abre la ficha en su portátil: historial vacío. Y esa
 *     noche no vuelve.
 *   · La talla de túnica estaba guardada en la ficha, pero desde otro ordenador
 *     no se veía por ninguna parte: el valor viajaba y la definición del campo
 *     no.
 *   · El bloqueo de papeleta a los morosos no valía desde otro ordenador.
 *
 * Por eso esta prueba mira el código fuente. La regla es una sola:
 *
 *     TODA PLANTILLA QUE SE ESCRIBE TIENE QUE LEERSE DESDE ALGÚN SITIO.
 *
 * Da igual dónde —en el arranque para las ligeras, en su pantalla para las que
 * pesan—, pero alguien tiene que ir a buscarla.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function fuentes(dir, base = dir) {
  const salida = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) salida.push(...fuentes(ruta, base))
    else if (/\.tsx?$/.test(nombre)) {
      salida.push({ ruta: ruta.slice(base.length + 1), texto: readFileSync(ruta, 'utf8') })
    }
  }
  return salida
}

export default async function ({ caso }) {
  const archivos = fuentes('src')
  const todo = archivos.map((a) => a.texto).join('\n')

  /* --- Las siete, sacadas del tipo que las declara --- */
  const tipo = readFileSync('src/lib/plantillasHermandad.ts', 'utf8')
  const declaradas = [...tipo.matchAll(/^\s*\|\s*'([a-z_]+)'/gm)].map((m) => m[1])
  caso('las plantillas declaradas son siete', 7, declaradas.length)

  /*
   * QUIÉN ESCRIBE CADA UNA. Se busca la llamada literal
   * `guardarPlantilla('loquesea'` por el código.
   */
  const seEscriben = declaradas.filter((p) => todo.includes(`guardarPlantilla('${p}'`))
  caso('todas se escriben', declaradas, seEscriben)

  /*
   * Y QUIÉN LAS LEE. Cada módulo envuelve su `traerPlantilla('x')` en una
   * `cargar…DeLaBase()`; lo que importa es que ESA función se llame desde
   * fuera del módulo que la define — si solo existe, el dato no vuelve.
   */
  const sinLector = []
  for (const plantilla of declaradas) {
    // El fichero que la trae.
    const duenio = archivos.find((a) => a.texto.includes(`traerPlantilla<`) && a.texto.includes(`'${plantilla}'`))
    if (!duenio) { sinLector.push(`${plantilla} (nadie la trae)`); continue }
    const cargador = duenio.texto.match(/export async function (cargar\w*DeLaBase)/)
    if (!cargador) { sinLector.push(`${plantilla} (sin cargar…DeLaBase)`); continue }
    const llamadaFuera = archivos.some(
      (a) => a.ruta !== duenio.ruta && new RegExp(`\\b${cargador[1]}\\s*\\(`).test(a.texto),
    )
    if (!llamadaFuera) sinLector.push(`${plantilla} → ${cargador[1]}() no la llama nadie`)
  }
  caso('ninguna se guarda sin que alguien la lea de vuelta', [], sinLector)

  /*
   * LAS LIGERAS, EN EL ARRANQUE.
   *
   * `modelo_papeleta` y `modelo_recibo` llevan dentro la imagen escaneada del
   * modelo, y los pide la pantalla que los necesita. Las otras cinco son
   * pequeñas y las leen quince pantallas con funciones síncronas, así que
   * tienen que estar en `localStorage` ANTES de que se pinte ninguna.
   */
  const hidratar = archivos.find((a) => a.ruta === 'lib/hidratar.ts')
  caso('existe el hidratador', true, !!hidratar)
  const enElArranque = declaradas.filter((p) => hidratar.texto.includes(`'${p}'`))
  caso(
    'las cinco ligeras se traen al arrancar',
    ['asistencia', 'ajustes_cuotas', 'etiquetas', 'campana', 'campos_propios'].sort(),
    enElArranque.slice().sort(),
  )
  caso(
    'y las dos que llevan imagen dentro, no',
    [],
    ['modelo_papeleta', 'modelo_recibo'].filter((p) => enElArranque.includes(p)),
  )

  /*
   * Y SE LLAMA DESDE LOS DOS SITIOS QUE HAY.
   *
   * El panel y el área del hermano son rutas distintas: el área NO pasa por el
   * `AppShell`. Se olvidó justo ahí una vez —la secretaría abría la campaña de
   * 2026 y el hermano veía la de fábrica en su móvil— así que se comprueba por
   * separado.
   */
  const llama = (ruta) => {
    const a = archivos.find((x) => x.ruta === ruta)
    return !!a && /hidratarPlantillas\s*\(/.test(a.texto)
  }
  caso('el panel la llama al arrancar', true, llama('components/AppShell.tsx'))
  caso('y el área del hermano también', true, llama('pages/HermanoPortal.tsx'))
}
