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
export default async function ({ caso, cargar }) {
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


  /*
   * ==========================================================================
   * Y QUE NO SE PUEDA CONVOCAR FUERA DE PLAZO
   * ==========================================================================
   *
   * El botón «Convocar papeletas» no miraba ni una fecha. Se podía pulsar en
   * agosto, y lo que sale es un correo que dice «ya está abierto el plazo» y
   * «tienes de plazo hasta el {fecha}»: dos mentiras a la vez, cada una con su
   * destrozo.
   *
   *   · ANTES DE ABRIR, ochocientas personas entran a sacar la papeleta y el
   *     área del hermano —que SÍ mira las fechas— les dice que no pueden.
   *     Ochocientas personas convencidas de que esto está roto.
   *   · DESPUÉS DE CERRAR, el correo anuncia como plazo un día que ya pasó.
   *     Quien lo lea deprisa cree que aún llega. Y ese hermano salió el año
   *     pasado: su sitio está a punto de repartirse.
   *
   * Un correo a ochocientas personas no se puede deshacer, y por eso es un
   * bloqueo y no un aviso.
   */
  const campana = await cargar('src/lib/campana.ts')
  const C = {
    anio: 2027,
    fechaInicioParticiparon: '2026-06-01',
    fechaInicioNoParticiparon: '2026-06-20',
    fechaLimiteRenovacion: '2027-02-28',
    fechaSalida: '2027-03-28',
  }

  /*
   * --- SIN CAMPAÑA CREADA NO SE CONVOCA NADA. LLEGÓ REPORTADO ---
   *
   * `getCampana()` NUNCA devuelve vacío: si la hermandad no ha creado ninguna,
   * devuelve la de fábrica, con fechas inventadas para que la demostración se
   * vea funcionando.
   *
   * Y hoy caemos dentro de ese plazo inventado. Así que una hermandad recién
   * montada, que no ha fijado ni el año ni el plazo, veía «Convocar papeletas»
   * ofrecido y activo — el correo más importante del año, anunciando a
   * ochocientas personas un plazo que nadie ha decidido y un año que a lo mejor
   * no es el suyo.
   *
   * Va ANTES que cualquier comprobación de fechas, y por eso está aquí arriba:
   * sin campaña, las fechas que se compararían son inventadas, así que
   * cualquier respuesta sería una respuesta sobre nada.
   */
  const sinCampana = campana.sePuedeConvocar(C, '2026-11-15', false)
  caso('sin campaña creada no se convoca', false, sinCampana.puede)
  caso('aunque las fechas de ejemplo digan que sí', true,
    campana.sePuedeConvocar(C, '2026-11-15', true).puede)
  caso('y se dice que las fechas son de ejemplo', true, /de ejemplo/.test(sinCampana.motivo))
  caso('y dónde se crea', true, /Ajustes de campaña/.test(sinCampana.motivo))

  /*
   * Y SE SABE POR SI LA CLAVE ESTÁ ESCRITA: solo la escriben `saveCampana()`
   * —alguien la creó— y la carga desde la base. La de fábrica no se escribe
   * nunca, que es justo lo que permite distinguirlas.
   */
  const srcCampana = await readFile('src/lib/campana.ts', 'utf8')
  caso('se distingue la de fábrica de una creada', true,
    /export function hayCampanaCreada/.test(srcCampana))
  caso('mirando si está guardada', true,
    /localStorage\.getItem\(STORAGE_KEY\) !== null/.test(srcCampana))
  /*
   * Y ANTE LA DUDA, NO. Mientras la base no ha contestado no consta que haya
   * campaña, y lo correcto es no ofrecer mandar un correo a ochocientas
   * personas. Se corrige solo en cuanto llega la respuesta.
   */
  caso('sin poder saberlo, no se convoca', true,
    /catch \{[\s\S]{0,140}?return false/.test(srcCampana))

  // --- DENTRO DE PLAZO: se convoca, que es el caso de todos los días ---
  caso('el día que abre ya se puede', true, campana.sePuedeConvocar(C, '2026-06-01').puede)
  caso('a mitad de plazo también', true, campana.sePuedeConvocar(C, '2026-11-15').puede)
  caso('y el último día, todavía', true, campana.sePuedeConvocar(C, '2027-02-28').puede)
  caso('cuando se puede, no se da ningún motivo', '', campana.sePuedeConvocar(C, '2026-11-15').motivo)

  // --- ANTES DE ABRIR ---
  const pronto = campana.sePuedeConvocar(C, '2026-05-31')
  caso('la víspera todavía no', false, pronto.puede)
  caso('y se dice que es mañana', true, /mañana/.test(pronto.motivo))
  const agosto = campana.sePuedeConvocar(C, '2025-08-15')
  caso('en agosto del año anterior, ni de lejos', false, agosto.puede)
  caso('se dice cuántos días faltan', true, /dentro de 290 días/.test(agosto.motivo))
  /*
   * Y SE DICE DÓNDE SE ARREGLA. Es lo que separa un freno de un muro: si las
   * fechas de la hermandad no son las que están puestas, lo que hay que
   * cambiar son las fechas — que son las mismas que van a decidir quién pierde
   * su sitio— y no saltarse el freno.
   */
  caso('y a dónde ir si las fechas están mal', true, /Ajustes de campaña/.test(agosto.motivo))
  caso('y qué pasaría si se convocara igual', true, /no podrán/.test(agosto.motivo))

  // --- DESPUÉS DE CERRAR, que es el caso que más caro sale ---
  const tarde = campana.sePuedeConvocar(C, '2027-03-01')
  caso('al día siguiente de cerrar, ya no', false, tarde.puede)
  caso('se dice el día en que se cerró, en cristiano', true,
    /28 de febrero de 2027/.test(tarde.motivo))
  caso('y por qué no vale mandarlo', true, /ya ha pasado/.test(tarde.motivo))

  /*
   * SE ABRE CON LA FECHA DE LOS RENOVADORES, NO CON LA OTRA. Hay dos aperturas
   * —los que salieron el año pasado pueden antes— y la convocatoria va a todos
   * a la vez. Se toma la primera: en cuanto alguien puede sacar su papeleta, el
   * correo dice verdad para ese alguien. Con la segunda se perderían diecinueve
   * días de plazo para los renovadores, que son justo los que tienen sitio que
   * perder.
   */
  caso('entre las dos aperturas ya se puede convocar', true,
    campana.sePuedeConvocar(C, '2026-06-10').puede)

  // --- Y LA PANTALLA LO USA DE VERDAD, EN LOS DOS SITIOS ---
  // Ya está leída arriba, en `pantalla`.
  /*
   * Y QUE LA PANTALLA SE LO PASE DE VERDAD. El tercer parámetro tiene valor por
   * defecto —`true`— para no arrastrarlo por las veinte pruebas de fechas, así
   * que si la pantalla se olvidara de pasarlo, TODO seguiría en verde y el
   * fallo volvería tal cual. Esta línea es la que lo impide.
   */
  caso('la pantalla pregunta antes de convocar', true,
    /sePuedeConvocar\(campana, undefined, hayCampanaCreada\(\)\)/.test(pantalla))
  // Y el texto del recuadro tampoco invita a convocar lo que no existe.
  caso('sin campaña, el recuadro no invita a nada', true,
    /Antes de convocar hay que crear la campaña/.test(pantalla))
  caso('el botón se apaga', true, /disabled=\{convocando \|\| !puedeConvocar\.puede\}/.test(pantalla))
  /*
   * Y LA FUNCIÓN TAMBIÉN COMPRUEBA, no solo el botón. Un botón desactivado es
   * un estado de la pantalla: sobrevive a una pestaña abierta desde ayer y a
   * cualquiera que llame a `convocar()` desde otro sitio mañana. Lo que no
   * sobrevive a nada es un correo mandado a ochocientas personas.
   */
  caso('y la función se planta aunque la llamen por otro lado', true,
    /if \(!puedeConvocar\.puede\) \{[\s\S]{0,120}?return/.test(pantalla))
  // Y no se queda en gris sin explicar: eso se lee como «está roto».
  caso('se explica por qué no se puede', true, /\{puedeConvocar\.motivo\}<\/p>/.test(pantalla))

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
    numero: 214, claveProvisional: 'KRPT-4829-MXWD', hermandad: 'Real Hermandad del Nazareno',
  })
  const todo = t.parrafos.join(' ')

  caso('el asunto dice que ya es hermano', true, /Ya eres hermano\/a/.test(t.asunto))
  caso('lleva su número', true, todo.includes('214'))
  caso('y su DNI, que es con lo que entra', true, todo.includes('12345678A'))
  caso('dice qué puede hacer en su área', true, /papeleta de sitio/.test(todo))
  caso('y qué hacer si olvida la contraseña', true, /pedir una nueva/.test(todo))

  /*
   * LA CONTRASEÑA VA EN EL CORREO, y ahora sí hace falta.
   *
   * Antes la inicial era su propio DNI: no había que mandarla porque ya se la
   * sabía — y también se la sabía cualquiera que pudiera leer el censo. Ahora
   * es aleatoria y no se guarda en ninguna parte, así que este correo es la
   * única vez que se escribe.
   */
  caso('lleva la contraseña de un solo uso', true, todo.includes('KRPT-4829-MXWD'))
  caso('y dice que es de un solo uso', true, /un solo uso/.test(todo))
  caso('se le pide cambiarla al entrar', true, /[Cc]ámbiala nada más entrar/.test(todo))
  caso('y se avisa de que no se repite', true, /único correo donde aparece/.test(todo))

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
    numero: 0, claveProvisional: null,
  })
  caso('sin hermandad no se inventa el nombre', true, /de la hermandad/.test(sinNada.asunto))
  caso('sin número no se pone un cero', false, /número de hermano es el 0/.test(sinNada.parrafos.join(' ')))
  // Si la eligió ella al pedir el alta, no se le repite: ya la sabe, y
  // escribirla otra vez solo añade un sitio más donde queda.
  caso('si la eligió ella, no se le repite', true,
    /la que elegiste al pedir el alta/.test(sinNada.parrafos.join(' ')))

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
