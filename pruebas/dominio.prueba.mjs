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
}
