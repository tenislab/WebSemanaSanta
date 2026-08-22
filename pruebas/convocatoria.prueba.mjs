/**
 * LA CONVOCATORIA DE PAPELETAS: el correo más importante del año.
 *
 * De él depende que la gente saque su papeleta a tiempo, y quien no la saca en
 * plazo pierde el sitio que llevaba años ocupando.
 *
 * EL FALLO: no mandaba nada. Escribía un comunicado en el navegador, guardaba
 * la marca de «ya convocado» y la pantalla decía «Convocatoria enviada
 * (simulada) a 800 hermanos con correo · El envío real de email se activará al
 * conectar el proveedor». El proveedor llevaba semanas conectado.
 *
 * Lo grave no era solo que no saliera: era que la marca de «convocado» se
 * guardaba igual, así que el botón dejaba de ofrecerse. La hermandad se
 * quedaba convencida de haber avisado a sus ochocientos hermanos sin haber
 * avisado a ninguno, y sin manera de darse cuenta hasta que en febrero
 * faltaran trescientas papeletas por sacar.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/lib/convocatoria.ts', 'utf8')
  /* Sin comentarios: los de este fichero cuentan cómo era el fallo antiguo, y
     buscar la palabra «simulada» en el texto entero encontraba la explicación
     en vez del defecto. Una prueba que se caza a sí misma no vale. */
  const sinComentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const codigo = sinComentar(src)

  // 1. Que MANDE, por el mismo canal que el resto de avisos.
  caso('la convocatoria sale por correo', true, /await avisarPorCorreo\(/.test(codigo))
  caso('y ya no dice que es simulada', false, /simulad/i.test(codigo))
  const pantalla = await readFile('src/pages/app/Papeletas.tsx', 'utf8')
  const pantallaCodigo = sinComentar(pantalla)
  caso('la pantalla tampoco', false, /simulad/i.test(pantallaCodigo))
  caso('ni promete un proveedor por conectar', false, /se activará al conectar el proveedor/.test(pantallaCodigo))

  // 2. La marca de «convocado» SOLO si algo ha salido.
  caso('no se da por convocado si no sale nada', true,
    /if \(r\.enviados > 0\) \{\s*const conv/.test(codigo))
  // Y se cuenta lo que ha salido de verdad, no lo que se pretendía.
  caso('se informa de cuántos han salido', true, /r\.enviados > 0/.test(pantalla))
  caso('y de qué hacer si no sale ninguno', true, /Configuración → Correo/.test(pantalla))

  // 3. Queda registrada donde se dice que queda.
  /*
   * «Queda registrada en Comunicados» y no quedaba: se escribía solo en
   * localStorage, y esa pantalla lee de Supabase.
   */
  caso('el comunicado va a la base cuando la hay', true,
    /supabase\.from\('comunicados'\)\.insert/.test(codigo))

  // 4. EL TEXTO. Está aparte para poder leerlo y probarlo.
  const { build } = await import('esbuild')
  const { tmpdir } = await import('node:os')
  const { mkdtempSync } = await import('node:fs')
  const { join } = await import('node:path')
  const destino = join(mkdtempSync(join(tmpdir(), 'gobergo-conv-')), 'conv.mjs')
  await build({
    entryPoints: ['src/lib/convocatoria.ts'],
    bundle: true, platform: 'node', format: 'esm', outfile: destino,
    define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  })
  const { textoConvocatoria } = await import(destino)
  const t = textoConvocatoria(2027, '2027-02-28', {
    hermandad: 'Real Hermandad del Nazareno', fechaSalidaIso: '2027-03-28',
  })

  // El asunto dice lo que es. En la bandeja se ven cuarenta caracteres y hay
  // que decidir en ese ancho si se abre.
  caso('el asunto dice de qué va', true, /Papeletas de sitio 2027/.test(t.asunto))
  caso('y no es un «comunicado nº 14»', false, /comunicado/i.test(t.asunto))
  caso('el asunto cabe en la bandeja', true, t.asunto.length <= 60)

  const todo = t.parrafos.join(' ')
  // La fecha límite, EN CRISTIANO. Es el único dato por el que se abre este
  // correo, y «2027-02-28» no lo lee nadie.
  caso('la fecha límite va en cristiano', true, todo.includes('28 de febrero de 2027'))
  caso('y no en formato de base de datos', false, /2027-02-28/.test(todo))
  // Y pronto: en el primero o el segundo párrafo.
  caso('la fecha límite se dice pronto', true,
    t.parrafos.slice(0, 2).join(' ').includes('28 de febrero de 2027'))

  // Se dice la consecuencia, que es la razón de que el correo exista.
  caso('se dice qué pasa si no la sacan', true, /pierdes el sitio/.test(todo))
  // Y qué hacer, con el verbo delante.
  caso('se dice cómo sacarla', true, /área de hermano/.test(todo))
  caso('y con qué se entra', true, /DNI/.test(todo))
  // La fecha de salida, si se sabe.
  caso('sale la fecha de la salida', true, /28 de marzo de 2027/.test(todo))
  // De tú, que es la casa de uno.
  caso('se habla de tú', false, /los señores hermanos|se pone en conocimiento|usted/i.test(todo))
  // El pie lleva la hermandad y la salida para dejar de recibirlos.
  caso('el pie lleva la hermandad', true, t.pie.includes('Real Hermandad del Nazareno'))
  caso('y dice cómo apagarlo', true, /apagar/.test(t.pie))

  // Sin fecha de salida no se inventa ninguna.
  const sinSalida = textoConvocatoria(2027, '2027-02-28')
  caso('sin fecha de salida no se la inventa', false, /La salida es/.test(sinSalida.parrafos.join(' ')))
  caso('y aun así dice el plazo', true, sinSalida.parrafos.join(' ').includes('28 de febrero de 2027'))

  // Una fecha rara no rompe el correo: se pone tal cual y se manda igual.
  const rara = textoConvocatoria(2027, 'pronto')
  caso('una fecha que no es fecha no rompe nada', true, rara.parrafos.join(' ').includes('pronto'))

  await bienvenida({ caso })
}

/**
 * EL CORREO DE BIENVENIDA, el que se manda al dar de alta a un hermano.
 *
 * Antes había que decírselo a mano —por teléfono, por WhatsApp o en el
 * mostrador—. En una hermandad que da de alta a treinta personas después de un
 * cabildo, eso son treinta llamadas; y las que no se hacen son treinta
 * personas que no saben que tienen un área.
 */
async function bienvenida({ caso }) {
  const { build } = await import('esbuild')
  const { tmpdir } = await import('node:os')
  const { mkdtempSync } = await import('node:fs')
  const { join } = await import('node:path')
  const destino = join(mkdtempSync(join(tmpdir(), 'gobergo-bien-')), 'b.mjs')
  await build({
    entryPoints: ['src/lib/bienvenida.ts'],
    bundle: true, platform: 'node', format: 'esm', outfile: destino,
    define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  })
  const { textoBienvenida } = await import(destino)

  const t = textoBienvenida({
    id: '1', nombre: 'María Reyes Ortega', email: 'm@x.com', dni: '12345678A',
    numero: 214, claveEsElDni: true, hermandad: 'Real Hermandad del Nazareno',
  })
  const todo = t.parrafos.join(' ')

  caso('el asunto dice que ya es hermano', true, /Ya eres hermano\/a/.test(t.asunto))
  caso('lleva su número', true, todo.includes('214'))
  caso('y su DNI, que es con lo que entra', true, todo.includes('12345678A'))
  caso('dice qué puede hacer en su área', true, /papeleta de sitio/.test(todo))
  caso('y qué hacer si olvida la contraseña', true, /pedir una nueva/.test(todo))

  /*
   * LA CONTRASEÑA NO VA ESCRITA, y es a propósito: mandarla la deja para
   * siempre en un buzón que se sincroniza con el móvil, el ordenador de casa y
   * el del trabajo. Y no hace falta, porque la primera vez es su propio DNI.
   */
  caso('se le pide cambiarla al entrar', true, /[Cc]ámbiala nada más entrar/.test(todo))

  /*
   * Y SE HABLA SIN GÉNERO. «Ya estás dado de alta» hay que concordarlo, y la
   * ficha no guarda el género de nadie ni tiene por qué: escribirle «dado» a
   * María es el tipo de detalle por el que un programa parece de juguete.
   */
  caso('no se le supone el género a nadie', false, /\b(dado|dada) de alta\b/.test(todo))
  caso('se usa una fórmula que vale para cualquiera', true, /ya formas parte de/.test(todo))

  // Sin hermandad configurada no se inventa un nombre, y sin número no se
  // pone un cero.
  const sinNada = textoBienvenida({
    id: '1', nombre: 'Juan Pérez', email: 'j@x.com', dni: '99999999Z',
    numero: 0, claveEsElDni: false,
  })
  caso('sin hermandad no se inventa el nombre', true, /de la hermandad/.test(sinNada.asunto))
  caso('sin número no se pone un cero', false, /número de hermano es el 0/.test(sinNada.parrafos.join(' ')))
  // Y si la clave no es el DNI, no se dice cuál es.
  caso('si la clave no es el DNI, no se escribe', true,
    /que te haya dado la hermandad/.test(sinNada.parrafos.join(' ')))

  // Y la pantalla la manda en los DOS sitios que dan de alta.
  const { readFile } = await import('node:fs/promises')
  const hermanos = await readFile('src/pages/app/Hermanos.tsx', 'utf8')
  caso('se manda en los dos sitios que dan de alta', 2,
    (hermanos.match(/void darLaBienvenida\(/g) || []).length)
  // Con su número ya asignado: mandarlo antes diría «tu número es el 0».
  caso('y con su número ya asignado', true, /numero: suNumero/.test(hermanos))
  // Nunca a un duplicado rechazado.
  caso('no se le da la bienvenida a un duplicado', true, /if \(!duplicado\) \{/.test(hermanos))
}
