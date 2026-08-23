/**
 * ESCRITURAS QUE FALLAN EN SILENCIO.
 *
 * `supabase-js` NO lanza excepción cuando la base rechaza una operación:
 * devuelve `{ error }` y sigue como si nada. Si nadie mira ese objeto, la
 * pantalla da por hecho lo que no ha pasado — y es el fallo que ya costó caro
 * una vez, cuando el censo importado «desaparecía» al recargar.
 *
 * Esta prueba recorre los sitios donde callarse tiene consecuencias que la
 * persona no puede ver ni deshacer. No es un repaso de estilo: cada uno de
 * estos es una promesa que la aplicación estaba haciendo sin poder cumplirla.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const lee = async (f) => (await readFile(f, 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*$/gm, '')

  /*
   * --- 1. EL BORRADO RGPD ---
   *
   * El derecho de supresión del artículo 17, sobre un censo de hermandad, que
   * revela convicciones religiosas y es categoría especial del artículo 9.
   *
   * El DELETE se lanzaba sin mirar el resultado: si la base lo rechazaba por
   * permisos, la función releía el censo —con el hermano todavía dentro—, la
   * pantalla lo repintaba, y la persona quedaba «suprimida» sin haberlo sido.
   */
  const rgpd = await lee('src/lib/rgpd.ts')
  caso('el borrado mira si la base lo ha hecho', true,
    /const \{ error: fallo \} = await supabase\.from\('hermanos'\)\.delete\(\)/.test(rgpd))
  caso('y si no, lo dice en vez de seguir', true, /if \(fallo\)[\s\S]{0,200}?return \{ ok: false/.test(rgpd))
  caso('con el motivo traducido, no el de Postgres', true, /traducirErrorDeEscritura/.test(rgpd))

  const censo = await lee('src/pages/app/Hermanos.tsx')
  caso('la pantalla distingue «no se pudo» de «hecho»', true, /if \(!r\.ok\)/.test(censo))
  caso('y NO repinta el censo cuando ha fallado', true,
    /if \(!r\.ok\) \{[\s\S]{0,300}?return\s*\}/.test(censo))

  /*
   * --- 2. LOS AVISOS QUE EL HERMANO APAGA ---
   *
   * Un interruptor que falla en silencio es peor que no tener interruptor: la
   * persona cree que ya está resuelto, no vuelve a intentarlo, no lo dice en
   * secretaría — y los correos siguen llegando.
   */
  const avisos = await lee('src/lib/avisosHermano.ts')
  caso('guardar preferencias mira el error', true,
    /const \{ error \} = await supabase\.from\('hermanos'\)\.update\(\{ avisos_preferencias/.test(avisos))
  caso('y devuelve si ha salido', true, /Promise<\{ ok: boolean; error\?: string \}>/.test(avisos))
  // Se ESPERA la respuesta: sin await, el fallo llega cuando ya nadie mira.
  caso('el interruptor espera a saberlo', true, /const r = await savePreferenciasAvisos/.test(avisos))
  /*
   * Y VUELVE ATRÁS. Dejar el interruptor apagado mientras los correos siguen
   * llegando es exactamente la mentira que había que quitar.
   */
  caso('si falla, el interruptor vuelve a como estaba', true,
    /setPreferencias\(antes\)/.test(avisos) && /guardarPrefsEnLocal\(hermanoId, antes\)/.test(avisos))

  const buzon = await lee('src/components/BuzonHermano.tsx')
  caso('y se ve el porqué en su área', true, /errorPreferencias &&/.test(buzon))

  await noSePierdaOtraVez({ caso, lee })
}

/**
 * Y LAS QUE YA ESTABAN BIEN, para que no se desanden.
 *
 * Estas tres se arreglaron antes y son las que más duelen: son las que hacen
 * que alguien se quede esperando una respuesta que nadie va a dar.
 */
async function noSePierdaOtraVez({ caso, lee }) {
  const solicitudes = await lee('src/lib/solicitudes.ts')
  caso('la solicitud de alta comprueba que ha entrado', true,
    /if \(error\)[\s\S]{0,200}?return \{ ok: false/.test(solicitudes))
  caso('y el guardado por diferencia junta los fallos', true, /fallos\.push/.test(solicitudes))
  caso('y los cuenta en voz alta', true, /cabildo-sync-error/.test(solicitudes))

  const sync = await lee('src/lib/supabaseSync.ts')
  caso('la sincronización traduce lo que dice Postgres', true, /traducirErrorDeEscritura/.test(sync))
  caso('y avisa a la pantalla', true, /cabildo-sync-error/.test(sync))

  const familia = await lee('src/components/MiFamilia.tsx')
  caso('«solicitud enviada» solo si de verdad salió', true, /if \(!r\.ok\)/.test(familia))

  /*
   * --- LAS SOLICITUDES DE ALTA QUE NO APARECÍAN ---
   *
   * `useSolicitudes` hacía `if (cancelado || error) return`: si la base
   * rechazaba la LECTURA, la función se iba de puntillas y la pantalla se
   * quedaba con lo que hubiera en el navegador, que en un ordenador recién
   * estrenado es una lista vacía.
   *
   * Lo que veía la secretaría: alguien pide el alta desde la web, la solicitud
   * está guardada en la base, y en el panel no aparece nada. Ni la solicitud,
   * ni un aviso, ni un motivo — así que se da por hecho que nadie ha pedido
   * nada, y esa persona se queda sin entrar en la hermandad.
   */
  const sol = await lee('src/lib/solicitudes.ts')
  caso('el error de leer solicitudes ya no se traga', false, /if \(cancelado \|\| error\) return/.test(sol))
  caso('y se avisa de que no se han podido leer', true,
    /cabildo-sync-error[\s\S]{0,300}leer: \$\{error\.message\}/.test(sol))
  /*
   * Y NO SE VACÍA LA LISTA cuando falla. Poner cero solicitudes porque la
   * consulta falló es afirmar algo que no se sabe — y encima es justo la
   * afirmación que hace que nadie mire.
   */
  caso('y no se pone la lista a cero', false,
    /if \(error\)[\s\S]{0,200}setSolicitudes\(\[\]\)/.test(sol))

  /*
   * Y AL GUARDAR: si no se puede leer, no se escribe. Lo que decide qué crear y
   * qué borrar se compara con lo que hay en la base; con la lectura fallida
   * convertida en «no hay nada», el guardado trabaja sobre una foto que no es
   * la de la base. Es la misma trampa que en `supabaseSync`, donde llegaba a
   * borrar.
   */
  caso('guardar solicitudes no trabaja a ciegas', true, /const \{ data, error: errorLeer \}/.test(sol))
  caso('y se para si no ha podido leer', true, /if \(errorLeer\) \{[\s\S]*?\n      \}/.test(sol)
    && /if \(errorLeer\)[\s\S]*?return\n      \}/.test(sol))

  /*
   * Y QUE EL MENSAJE DIGA LO QUE PASÓ. «No se ha guardado nada» delante de
   * alguien que solo estaba mirando una lista le hace buscar qué ha perdido, y
   * le oculta lo único que importa: que la lista está incompleta.
   */
  const err = await lee('src/lib/errorDeBaseDeDatos.ts')
  caso('leer y escribir no se explican igual', true, /if \(operacion === 'leer'\)/.test(err))
  caso('y al leer se avisa de que puede faltar', true, /puede estar `[\s\S]{0,80}incompleto/.test(err))
}
