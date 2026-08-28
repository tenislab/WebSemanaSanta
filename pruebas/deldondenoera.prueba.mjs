/**
 * LO QUE LLEGA DE FUERA SE LEE DE LA BASE, NO DE ESTE NAVEGADOR.
 *
 * Esta prueba vigila UNA CLASE DE FALLO ENTERA, no tres casos sueltos. Ya ha
 * aparecido tres veces:
 *
 *   · «la notificación de papeleta no llega a Notificaciones, sí a Papeletas»
 *   · la portada del panel contaba CERO altas pendientes habiendo gente
 *     esperando
 *   · y antes de todo eso: «he mandado una solicitud de crear nuevo hermano y
 *     no están en ningún lado»
 *
 * Siempre es lo mismo. Hay colecciones que NO se escriben desde el panel:
 * llegan del móvil del hermano o del formulario de la web pública. Leerlas con
 * un `getX()` —que mira `localStorage`— es preguntarle a un ordenador por algo
 * que ha pasado en otro. Y no falla con un error: contesta CERO, que se lee
 * como «no hay nada» y no como «no lo sé».
 *
 * Por eso cada una tiene su hook, y por eso las pantallas tienen que usarlo.
 */
export default async function ({ caso }) {
  const { readFile, readdir } = await import('node:fs/promises')

  /**
   * Las colecciones que llegan DE FUERA del panel, con el getter que no vale y
   * el hook que sí. Añadir una aquí es lo que hace que esto siga sirviendo.
   */
  const DE_FUERA = [
    { que: 'solicitudes de papeleta', get: 'getSolicitudesPapeleta', hook: 'useSolicitudesPapeleta' },
    { que: 'solicitudes de alta', get: 'getSolicitudes', hook: 'useSolicitudes' },
  ]

  // Las pantallas del panel. El área del hermano y la web pública NO entran:
  // ahí el `get` es correcto —son sus propios datos, en su propio navegador—.
  const pantallas = (await readdir('src/pages/app'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `src/pages/app/${f}`)

  caso('hay pantallas que revisar', true, pantallas.length >= 10)

  for (const { que, get, hook } of DE_FUERA) {
    const culpables = []
    for (const f of pantallas) {
      const src = await readFile(f, 'utf8')
      // Sin comentarios: la explicación de por qué algo se quitó no puede
      // hacer fallar la prueba de que está quitado.
      const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      // La llamada, no el nombre suelto: `useSolicitudes` contiene
      // «getSolicitudes» dentro si se busca a lo bruto.
      if (new RegExp(`(?<![A-Za-z])${get}\\(`).test(codigo)) culpables.push(f.split('/').pop())
    }
    caso(`ninguna pantalla lee ${que} del navegador`, '', culpables.join(', '))
    // Y que el hook exista de verdad, para que el consejo sea seguible.
    const lib = await readFile(
      get === 'getSolicitudesPapeleta' ? 'src/lib/solicitudesPapeleta.ts' : 'src/lib/solicitudes.ts', 'utf8')
    caso(`${hook} existe`, true, new RegExp(`export function ${hook}`).test(lib))
  }

  /*
   * Y LAS DOS PANTALLAS QUE FALLARON, comprobadas por su nombre: son las que
   * más duelen porque su trabajo entero es que no haga falta ir módulo por
   * módulo a mirar si hay algo esperando.
   */
  {
    const noti = await readFile('src/pages/app/Notificaciones.tsx', 'utf8')
    caso('Notificaciones monta el hook de papeletas', true, /useSolicitudesPapeleta\(\)/.test(noti))
    const inicio = await readFile('src/pages/app/DashboardHome.tsx', 'utf8')
    caso('la portada monta el hook de altas', true, /useSolicitudes\(\)/.test(inicio))
    caso('y cuenta sobre lo que trae', true, /solicitudes\.filter\(\(s\) => s\.estado === 'Pendiente'\)/.test(inicio))
  }

  /*
   * EL ÁREA DEL HERMANO SÍ PUEDE USAR EL GET, y no es una excepción a la regla:
   * es la regla. Ahí los datos son suyos y están en SU navegador, que es de
   * donde vienen.
   */
  {
    const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
    caso('el portal del hermano sigue leyendo lo suyo', true, /getSolicitudes\(\)/.test(portal))
  }
}
