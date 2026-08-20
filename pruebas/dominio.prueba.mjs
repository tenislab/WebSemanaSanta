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
}

/**
 * Qué se enseña al entrar por la puerta principal, según el dominio.
 *
 * El caso que motiva esto: la aplicación le decía a la hermandad «compra tu
 * dominio, apúntalo aquí y tu web se verá ahí», y luego en la raíz enseñaba la
 * página de venta de Cabildo. Justo lo contrario de lo prometido.
 */
export async function dominioRaiz({ cargar, caso }) {
  const m = await cargar('src/lib/dominio.ts')
  const esCasa = m.esCasaDeCabildo

  // Donde vive la aplicación: la página de Cabildo, sin consultar nada.
  caso('localhost es casa', true, esCasa('localhost'))
  caso('con puerto también', true, esCasa('localhost:5173'))
  caso('el despliegue de Vercel es casa', true, esCasa('web-semana-santa.vercel.app'))
  caso('y las vistas previas de Vercel', true, esCasa('cabildo-git-rama-xyz.vercel.app'))

  // El dominio de una hermandad NO es casa: hay que buscar su web.
  caso('el dominio de una hermandad no es casa', false, esCasa('hermandaddetriana.es'))
  caso('ni con www', false, esCasa('www.hermandaddetriana.es'))

  // Con dominio propio de Cabildo configurado.
  caso('el dominio propio es casa', true, esCasa('cabildo.es', 'cabildo.es'))
  caso('su www también', true, esCasa('www.cabildo.es', 'cabildo.es'))
  caso('y da igual cómo se escriba el ajuste', true, esCasa('cabildo.es', 'www.CABILDO.es'))
  caso('pero el de una hermandad sigue sin serlo', false, esCasa('hermandaddetriana.es', 'cabildo.es'))

  // Un host vacío (renderizado en servidor, sin navegador) no puede acabar
  // buscando la web de nadie: se queda en casa.
  caso('sin host, casa', true, esCasa(''))
}
