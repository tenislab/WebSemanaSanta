/**
 * «NO LO SÉ» NO ES «NO HAY NADA».
 *
 * Una consulta que falla y otra que no encuentra nada tienen que devolver
 * cosas DISTINTAS. Con `[]` para las dos, un tropiezo de red se convierte en
 * una afirmación falsa, y la pantalla la enseña con toda la seguridad del
 * mundo.
 *
 * Ya ha hecho daño de tres formas distintas:
 *
 *   · EL BOLETÍN A NADIE. `getSuscriptores()` devolvía `[]` al fallar, así que
 *     el envío se hacía, no escribía a nadie, y la pantalla decía «Enviado por
 *     correo a 0 suscriptores». La hermandad se quedaba convencida de que su
 *     boletín había salido.
 *   · «TU HERMANDAD NO ESTÁ EN GOBERGO». `hermandadesPublicas()` igual: el
 *     hermano buscaba la suya, no salía, y se iba.
 *   · Y el que empezó todo esto: RLS devuelve cero filas al denegar, y eso
 *     vaciaba la pantalla y la copia local (ver `nosevacia.prueba.mjs`).
 *
 * El criterio lo dejó escrito `historialDeStock` hace tiempo: no se contesta
 * «no hay» a una pregunta que no se ha llegado a hacer.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')

  /** Las que preguntan a la base y tienen que saber decir «no lo sé». */
  const HONESTAS = [
    { fichero: 'src/lib/suscriptoresWeb.ts', fn: 'getSuscriptores', tipo: 'Suscriptor[] | null' },
    { fichero: 'src/lib/multiHermandad.ts', fn: 'hermandadesPublicas', tipo: 'HermandadPublica[] | null' },
    { fichero: 'src/lib/tienda.ts', fn: 'historialDeStock', tipo: 'MovimientoStock[] | null' },
    { fichero: 'src/lib/tienda.ts', fn: 'lineasDeVenta', tipo: 'LineaVenta[] | null' },
  ]

  for (const { fichero, fn, tipo } of HONESTAS) {
    const src = await readFile(fichero, 'utf8')
    caso(`${fn} puede decir «no lo sé»`, true,
      new RegExp(`function ${fn}\\([^)]*\\): Promise<${tipo.replace(/[[\]|]/g, (c) => `\\${c}`)}>`).test(src))
  }

  /*
   * Y QUE NADIE DÉ POR BUENO EL CERO. Las tres pantallas que consumen estas
   * listas tienen que mirar el `null` antes de creerse el número.
   */
  {
    const com = await readFile('src/pages/app/Comunicados.tsx', 'utf8')
    caso('Comunicados distingue el fallo', true, /noSeSupoDeLosSuscriptores/.test(com))
    // Lo importante no es que lo pinte: es que NO MANDE.
    const envio = com.slice(com.indexOf('if (alcance.aSuscriptores) {'))
    caso('y con la lista sin leer NO manda el boletín', true,
      envio.indexOf('noSeSupoDeLosSuscriptores') < envio.indexOf('avisarASuscriptores'))
    caso('y lo dice en vez de callar', true, /no se ha mandado nada/.test(com))

    const web = await readFile('src/pages/app/WebPublica.tsx', 'utf8')
    caso('el panel de suscriptores avisa del fallo', true, /falloAlLeer/.test(web))

    const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
    caso('el buscador de hermandades avisa del fallo', true, /falloElDirectorio/.test(portal))
    caso('y no le dice al hermano que su hermandad no está', true,
      /no quiere decir que la tuya no esté/.test(portal))
  }

  /*
   * Y LO QUE SÍ ES UNA LISTA VACÍA DE VERDAD: sin Supabase configurado no hay
   * nada que preguntar, así que ahí `[]` es la respuesta correcta y no un «no
   * lo sé». Distinguirlo importa para que el modo local siga funcionando.
   */
  {
    const sus = await readFile('src/lib/suscriptoresWeb.ts', 'utf8')
    caso('sin base, lista vacía de verdad', true,
      /if \(!isSupabaseConfigured \|\| !cliente\) return \[\]/.test(sus))
    const multi = await readFile('src/lib/multiHermandad.ts', 'utf8')
    caso('lo mismo en el directorio', true,
      /if \(!isSupabaseConfigured \|\| !supabase\) return \[\]/.test(multi))
  }
}
