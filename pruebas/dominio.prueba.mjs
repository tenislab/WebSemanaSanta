/** P9: la forma del dominio propio. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/dominio.ts')

  // --- Limpiar lo que pegan ---
  // La gente copia la barra de direcciones entera, y eso es lo normal.
  caso('un dominio limpio se queda igual', 'hermandaddetriana.es', m.limpiarDominio('hermandaddetriana.es'))
  caso('se quita el https', 'hermandaddetriana.es', m.limpiarDominio('https://hermandaddetriana.es'))
  caso('y el http', 'hermandaddetriana.es', m.limpiarDominio('http://hermandaddetriana.es'))
  caso('y el www', 'hermandaddetriana.es', m.limpiarDominio('https://www.hermandaddetriana.es'))
  caso('y la ruta', 'hermandaddetriana.es', m.limpiarDominio('https://hermandaddetriana.es/nosotros'))
  caso('y la barra final', 'hermandaddetriana.es', m.limpiarDominio('hermandaddetriana.es/'))
  caso('y el puerto', 'hermandaddetriana.es', m.limpiarDominio('hermandaddetriana.es:8080'))
  caso('y los espacios y mayúsculas', 'hermandaddetriana.es', m.limpiarDominio('  HermandadDeTriana.ES  '))
  caso('y el punto final', 'hermandaddetriana.es', m.limpiarDominio('hermandaddetriana.es.'))

  // --- Qué le pasa ---
  caso('un dominio correcto no tiene problema', null, m.problemaDelDominio('hermandaddetriana.es'))
  caso('con subdominio tampoco', null, m.problemaDelDominio('web.hermandaddetriana.es'))
  caso('con guiones tampoco', null, m.problemaDelDominio('hermandad-de-triana.es'))
  caso('vacío', 'vacio', m.problemaDelDominio(''))
  caso('solo espacios', 'vacio', m.problemaDelDominio('   '))
  caso('un correo', 'esCorreo', m.problemaDelDominio('secretaria@hermandad.es'))
  caso('sin extensión', 'sinPunto', m.problemaDelDominio('hermandaddetriana'))
  // Acentos y eñes: es EL error de una hermandad española.
  caso('con eñe', 'caracteres', m.problemaDelDominio('hermandaddemuñoz.es'))
  caso('con tilde', 'caracteres', m.problemaDelDominio('hermandadmacaréna.es'))
  caso('con espacio dentro', 'caracteres', m.problemaDelDominio('mi hermandad.es'))
  caso('con guion bajo', 'caracteres', m.problemaDelDominio('mi_hermandad.es'))
  caso('empezando por guion', 'guiones', m.problemaDelDominio('-hermandad.es'))
  caso('acabando en guion', 'guiones', m.problemaDelDominio('hermandad-.es'))
  caso('con dos puntos seguidos', 'guiones', m.problemaDelDominio('hermandad..es'))
  caso('extensión de una letra', 'extensionCorta', m.problemaDelDominio('hermandad.e'))

  // --- Todos los problemas se explican ---
  const problemas = ['vacio', 'sinPunto', 'caracteres', 'guiones', 'extensionCorta', 'esCorreo']
  caso('cada problema tiene su explicación', true,
    problemas.every((p) => m.explicarProblema(p).length > 25))
  // Y la explicación dice qué hacer, con un ejemplo o una instrucción.
  caso('la del correo dice qué va en su lugar', true, /hermandaddetriana\.es/.test(m.explicarProblema('esCorreo')))
  caso('la de los caracteres nombra los acentos', true, /acentos/i.test(m.explicarProblema('caracteres')))

  // --- La dirección que se consulta ---
  caso('se consulta el robots del dominio', 'https://hermandaddetriana.es/robots.txt',
    m.urlDeComprobacion('https://www.hermandaddetriana.es/'))

  // --- Los estados se explican ---
  caso('«apunta» lo dice claro', true, /ya sirve/.test(m.explicarEstado('apunta', 'x.es')))
  // Lo importante: que «no responde» no suene a error suyo si acaban de tocar el DNS.
  caso('«no responde» explica lo de la propagación', true, /propagar/i.test(m.explicarEstado('noResponde', 'x.es')))
  caso('«otro sitio» dice dónde mirar', true, /DNS|despliegue/i.test(m.explicarEstado('otroSitio', 'x.es')))
  caso('sin probar no dice nada', '', m.explicarEstado('sinProbar', 'x.es'))

  await dominioRaiz({ cargar, caso })
  await laPuertaPrincipalNoSeCuelga({ cargar, caso })
  await rutasConDominioPropio({ cargar, caso })
}

/**
 * Qué se enseña al entrar por la puerta principal, según el dominio.
 *
 * El caso que motiva esto: la aplicación le decía a la hermandad «compra tu
 * dominio, apúntalo aquí y tu web se verá ahí», y luego en la raíz enseñaba la
 * página de venta de Gobergo. Justo lo contrario de lo prometido.
 */
async function dominioRaiz({ cargar, caso }) {
  const m = await cargar('src/lib/dominio.ts')
  const esCasa = m.esCasaDeGobergo

  // Donde vive la aplicación: la página de Gobergo, sin consultar nada.
  caso('localhost es casa', true, esCasa('localhost'))
  caso('con puerto también', true, esCasa('localhost:5173'))
  caso('el despliegue de Vercel es casa', true, esCasa('web-semana-santa.vercel.app'))
  caso('y las vistas previas de Vercel', true, esCasa('cabildo-git-rama-xyz.vercel.app'))

  // El dominio de una hermandad NO es casa: hay que buscar su web.
  caso('el dominio de una hermandad no es casa', false, esCasa('hermandaddetriana.es'))
  caso('ni con www', false, esCasa('www.hermandaddetriana.es'))

  // Con dominio propio de Gobergo configurado.
  caso('el dominio propio es casa', true, esCasa('cabildo.es', 'cabildo.es'))
  caso('su www también', true, esCasa('www.cabildo.es', 'cabildo.es'))
  caso('y da igual cómo se escriba el ajuste', true, esCasa('cabildo.es', 'www.CABILDO.es'))
  caso('pero el de una hermandad sigue sin serlo', false, esCasa('hermandaddetriana.es', 'cabildo.es'))

  // Un host vacío (renderizado en servidor, sin navegador) no puede acabar
  // buscando la web de nadie: se queda en casa.
  caso('sin host, casa', true, esCasa(''))
}


/**
 * Las direcciones de las páginas sueltas, según por dónde se haya entrado.
 *
 * EL BUG: la hermandad que conectaba su dominio se quedaba con una web de una
 * sola página. `/noticias`, `/n/<noticia>` y `/t/<titular>` no existían como
 * rutas colgando de la raíz, así que caían en el comodín y volvían a la
 * portada. Y esas son EXACTAMENTE las direcciones que la propia aplicación
 * anuncia en el `sitemap.xml` y las que se pegan en el grupo de WhatsApp.
 * Google recibía una lista de enlaces que todos llevaban al mismo sitio.
 *
 * Aquí se comprueba la pieza que decide el prefijo. Las rutas se comprueban
 * abajo leyendo `App.tsx`: no hay navegador donde montarlas.
 */
async function rutasConDominioPropio({ cargar, caso }) {
  const m = await cargar('src/lib/seoWeb.ts')
  const base = m.baseDeRutas

  // Sin dominio propio, la web vive dentro de Gobergo: enlace largo.
  caso('sin dominio, el enlace largo', '/w/triana', base({ slug: 'triana', dominio: '' }, 'gobergo.es'))
  caso('sin dominio, aunque sea nulo', '/w/triana', base({ slug: 'triana', dominio: null }, 'gobergo.es'))

  // Con su dominio Y entrando por él, las páginas cuelgan de la raíz.
  caso('por su dominio, cuelga de la raíz', '', base({ slug: 'triana', dominio: 'hermandaddetriana.es' }, 'hermandaddetriana.es'))
  caso('con www da igual', '', base({ slug: 'triana', dominio: 'hermandaddetriana.es' }, 'www.hermandaddetriana.es'))
  caso('y al revés también', '', base({ slug: 'triana', dominio: 'www.hermandaddetriana.es' }, 'hermandaddetriana.es'))
  caso('con https delante en el ajuste', '', base({ slug: 'triana', dominio: 'https://hermandaddetriana.es/' }, 'hermandaddetriana.es'))
  caso('en local, con puerto', '', base({ slug: 'triana', dominio: 'hermandaddetriana.es' }, 'hermandaddetriana.es:5173'))

  // Tiene dominio configurado, pero se ha entrado por Gobergo: enlace largo.
  // Si no, los enlaces saltarían de un dominio a otro a mitad de visita.
  caso('con dominio pero entrando por Gobergo, enlace largo', '/w/triana',
    base({ slug: 'triana', dominio: 'hermandaddetriana.es' }, 'gobergo.es'))
  caso('ni desde el despliegue de pruebas', '/w/triana',
    base({ slug: 'triana', dominio: 'hermandaddetriana.es' }, 'web-semana-santa.vercel.app'))

  // Las rutas tienen que existir. Sin esto el prefijo vacío lleva a un 404.
  const { readFile } = await import('node:fs/promises')
  const app = await readFile('src/App.tsx', 'utf8')
  for (const ruta of ['/noticias', '/n/:noticia', '/t/:titular']) {
    caso(`la ruta ${ruta} existe en la raíz`, true, app.includes(`path="${ruta}"`))
  }

  // Y el servidor tiene que saber resolver la hermandad por el dominio, o la
  // vista previa de WhatsApp seguiría diciendo «Gobergo».
  const w = await readFile('api/w.ts', 'utf8')
  caso('el servidor busca la web por el dominio', true, /datos->>dominio\.eq\./.test(w))
  caso('y no depende solo del slug de la ruta', true, /enRutaLarga/.test(w))

  // Y Vercel tiene que mandar esas direcciones a esa función.
  const vercel = JSON.parse(await readFile('vercel.json', 'utf8'))
  const aLaFuncion = vercel.rewrites.filter((r) => r.destination === '/api/w').map((r) => r.source)
  for (const ruta of ['/', '/noticias', '/n/:slug', '/t/:slug']) {
    caso(`vercel manda ${ruta} a la función`, true, aLaFuncion.includes(ruta))
  }
  // El comodín va el último: si se colara antes, se quedaría con todo.
  const comodin = vercel.rewrites.findIndex((r) => r.source === '/(.*)')
  caso('el comodín va el último', vercel.rewrites.length - 1, comodin)

  // Desde que la raíz pasa por la función, la vuelta a la portada cuando algo
  // falla no puede ser incondicional: se llamaría a sí misma y el navegador
  // daría «demasiadas redirecciones».
  caso('la función no se redirige a sí misma', true, /ruta\.pathname !== '\/'/.test(w))
}

/**
 * LA PUERTA PRINCIPAL NO PUEDE QUEDARSE COLGADA.
 *
 * Pasó de verdad: `www.gobergo.com` se quedó en «Cargando…» un buen rato, sin
 * que nadie hubiera tocado nada. El mecanismo, entero:
 *
 *   1. `VITE_DOMINIO_APP` no estaba puesta —está comentada en `.env.example`,
 *      y encima el ejemplo decía `.es` cuando el dominio real es `.com`—.
 *   2. Sin ella, `esCasaDeGobergo()` NO puede saber que gobergo.com es la
 *      casa, así que devuelve falso.
 *   3. Y entonces la portada le pregunta a la base de datos de qué hermandad
 *      es este dominio... en CADA visita.
 *   4. `cargarWebPorDominio` no tenía tope de espera. Con el plan gratuito de
 *      Supabase, que duerme el proyecto tras unas horas sin visitas, la
 *      primera visita del día se comía el arranque entero mirando la pantalla
 *      de carga.
 *
 * Se arregla por los dos lados, y los dos hacen falta: definir la variable
 * quita la consulta, y el tope de espera protege igualmente a quien no la haya
 * definido — que es justo quien se lo va a encontrar.
 */
export async function laPuertaPrincipalNoSeCuelga({ cargar, caso }) {
  const m = await cargar('src/lib/dominio.ts')
  const { readFile } = await import('node:fs/promises')

  /*
   * 1. EL CASO EXACTO QUE FALLÓ. Con la variable puesta, gobergo.com y su www
   * son casa: se pintan al momento y no se consulta nada.
   */
  caso('con la variable puesta, gobergo.com es casa', true,
    m.esCasaDeGobergo('gobergo.com', 'gobergo.com'))
  caso('y www.gobergo.com también', true,
    m.esCasaDeGobergo('www.gobergo.com', 'gobergo.com'))
  /*
   * Y SIN LA VARIABLE, NO LO ES. Esto no es un fallo de `esCasaDeGobergo` —no
   * puede adivinar cuál es tu dominio— pero es la razón por la que la portada
   * acababa consultando, así que queda escrito aquí.
   */
  caso('sin la variable no puede saberlo, y por eso consulta', false,
    m.esCasaDeGobergo('www.gobergo.com', ''))

  // 2. EL TOPE DE ESPERA, que es lo que protege cuando la variable falta.
  const raiz = await readFile('src/pages/Raiz.tsx', 'utf8')
  caso('la portada tiene un tope de espera', true, /const ESPERA_MAXIMA = \d+/.test(raiz))
  caso('y se usa para dejar de bloquear', true,
    /setTimeout\([\s\S]{0,80}setBuscando\(false\)[\s\S]{0,40}ESPERA_MAXIMA\)/.test(raiz))
  /*
   * Y LO QUE NO SE PUEDE PERDER AL PONER EL TOPE: la consulta sigue viva. Si
   * contesta tarde y resulta que el dominio SÍ es de una hermandad, su web
   * entra igualmente. Cortar la consulta dejaría a esa hermandad enseñando la
   * página de venta de Gobergo en su propio dominio, que es peor que la espera.
   */
  caso('pero la consulta sigue viva y puede llegar tarde', true,
    /clearTimeout\(reloj\)[\s\S]{0,120}setWeb\(r\.web\)/.test(raiz))

  // 3. Y que el aviso del .env.example diga lo que cuesta no ponerla.
  const env = await readFile('.env.example', 'utf8')
  caso('el .env.example avisa de lo que pasa sin ella', true, /Cargando/.test(env))
}
