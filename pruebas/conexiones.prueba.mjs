/**
 * QUÉ HAY CONECTADO Y QUÉ FALTA.
 *
 * Llegó dicho así: «no hay apartado que dé opción de conectar, no está en
 * ajustes». Y era verdad: cada cosa se conectaba en su módulo —el correo en
 * Configuración, las redes dentro de una tarjeta de Comunicados, el dominio
 * dentro de un desplegable de la Web— así que no había ningún sitio donde
 * preguntar «¿qué me queda por conectar?». Y ese sitio, para cualquiera, es
 * Ajustes: es donde se va a buscar, y es donde no estaba.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/conexiones.ts')

  /** Una hermandad recién creada: nada conectado. */
  const nada = {
    correoListo: false, redesConectadas: 0, totalRedes: 5,
    webPublicada: false, dominioEnElPack: true, tieneIban: false,
  }
  const todo = {
    correoListo: true, remitente: 'secretaria@hdad.es', redesConectadas: 2, totalRedes: 5,
    dominio: 'hermandaddetriana.es', webPublicada: true, dominioEnElPack: true,
    tieneIban: true, bizum: '655 000 111', stripeCuenta: 'acct_1DeLaHermandad',
  }

  const lista = m.conexiones(nada)
  caso('están las cinco cosas que se conectan', 5, lista.length)
  caso('ninguna repite identificador', 5, new Set(lista.map((c) => c.id)).size)
  caso('recién creada, ninguna conectada', 0, lista.filter((c) => c.estado === 'conectado').length)
  caso('con todo puesto, las cinco', 5,
    m.conexiones(todo).filter((c) => c.estado === 'conectado').length)

  /*
   * CADA UNA DICE DÓNDE SE HACE, y lo dice de dos maneras: el enlace y el
   * nombre de la pantalla. El nombre hace falta para quien lo lee en el móvil o
   * se lo apunta para hacerlo luego — un enlace no se puede apuntar en un papel.
   */
  const alcanzables = lista.filter((c) => c.estado !== 'noDisponible')
  caso('todas dicen a qué pantalla ir', alcanzables.length,
    alcanzables.filter((c) => c.donde.startsWith('/app')).length)
  caso('y cómo llegar por el menú', alcanzables.length,
    alcanzables.filter((c) => c.comoLlegar.includes('→') || c.comoLlegar.length > 8).length)
  caso('y para qué sirve cada una', alcanzables.length,
    alcanzables.filter((c) => c.paraQue.length > 25).length)

  /*
   * LO QUE TODAVÍA NO SE PUEDE, CON SU MOTIVO. Un apartado en gris sin
   * explicación se lee como que está roto, y genera justo la llamada que se
   * quería evitar.
   */
  const apagadas = lista.filter((c) => c.estado === 'noDisponible')
  caso('lo que no se puede, se dice por qué', apagadas.length,
    apagadas.filter((c) => (c.porQueNo ?? '').length > 20).length)
  /*
   * EL PAGO CON TARJETA YA SE PUEDE (C4), así que aquí ya no es un apartado en
   * gris: es una conexión más, que se enciende enlazando la cuenta de cobro de
   * la hermandad. Esta prueba decía «sigue sin estar» y era verdad hasta que
   * dejó de serlo — que es justo el momento en el que una pantalla se queda
   * diciendo lo contrario de lo que hace el programa.
   */
  const conTarjeta = m.conexiones(todo)
  caso('con la cuenta enlazada, la tarjeta está conectada', 'conectado',
    conTarjeta.find((c) => c.id === 'pasarela').estado)
  caso('sin enlazarla, se puede conectar', 'sinConectar',
    m.conexiones({ ...todo, stripeCuenta: '' }).find((c) => c.id === 'pasarela').estado)
  caso('y ya no se dice que no se puede', undefined,
    conTarjeta.find((c) => c.id === 'pasarela').porQueNo)

  // El dominio depende del pack, y eso también se dice en vez de esconderlo.
  const sinPack = m.conexiones({ ...todo, dominioEnElPack: false })
  const dom = sinPack.find((c) => c.id === 'dominio')
  caso('sin el pack, el dominio no se ofrece', 'noDisponible', dom.estado)
  caso('y se dice que va con el pack Todo', true, /pack «Todo»/.test(dom.porQueNo))

  // Lo que hay puesto se enseña: «2 de 5», el dominio, el remitente.
  const conTodo = m.conexiones(todo)
  caso('se ve cuántas redes hay', '2 de 5', conTodo.find((c) => c.id === 'redes').detalle)
  caso('y qué dominio', 'hermandaddetriana.es', conTodo.find((c) => c.id === 'dominio').detalle)
  caso('y las dos formas de cobrar', 'Cuenta bancaria · Bizum', conTodo.find((c) => c.id === 'cobros').detalle)
  // Con Bizum pero sin cuenta, ya se cobra: no puede salir «sin conectar».
  caso('solo con Bizum ya cuenta', 'conectado',
    m.conexiones({ ...nada, bizum: '600 000 000' }).find((c) => c.id === 'cobros').estado)

  /*
   * El resumen de arriba no cuenta lo que no se puede conectar: «1 de 5» cuando
   * una de las cinco es imposible se lee como un suspenso injusto.
   *
   * Se mide sobre una hermandad SIN el pack que incluye dominio propio, porque
   * desde C4 el pago con tarjeta ya se puede enchufar y esa era la otra
   * imposible: con la lista normal esto ya no probaba nada.
   */
  const r = m.resumenConexiones(m.conexiones({ ...nada, dominioEnElPack: false }))
  caso('el resumen no cuenta lo imposible', 4, r.posibles)
  caso('y empieza en cero', 0, r.conectadas)
  caso('con todo hecho, todas', 5, m.resumenConexiones(conTodo).conectadas)

  await estaEnAjustes({ caso })
}

/** Y que esté donde se fue a buscarlo. */
async function estaEnAjustes({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const cfg = (await readFile('src/pages/app/Configuracion.tsx', 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  caso('«Conexiones» es una sección de Ajustes', true, /id: 'conexiones', label: 'Conexiones'/.test(cfg))
  caso('y se pinta', true, /seccion === 'conexiones' && <ConexionesCard \/>/.test(cfg))
  caso('sale del catálogo, no escrita a mano', true, /conexiones\(\{/.test(cfg))

  /*
   * Esto NO mueve nada de su sitio: el dominio se sigue poniendo junto a la
   * web y las redes junto a los comunicados, que es donde tienen sentido
   * mientras se trabaja. Si algún día se duplicara el formulario aquí, habría
   * dos sitios donde cambiar lo mismo y uno se quedaría atrás.
   */
  const web = await readFile('src/pages/app/WebPublica.tsx', 'utf8')
  caso('el dominio se sigue poniendo en la Web', true, /id="dominio"/.test(web))
  caso('y no se ha duplicado en Ajustes', false, /id="dominio"/.test(cfg))
}
