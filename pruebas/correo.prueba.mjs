/** P7: el envío de correo (lo que se puede probar sin proveedor). */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/correo.ts')
  localStorage.removeItem(m.CLAVE_CORREO)

  // --- Los valores de partida ---
  const inicial = m.getAjustesCorreo()
  // Apagado de fábrica: encenderlo es una decisión de la hermandad, no algo
  // que pase solo el día que alguien conecta la base de datos.
  caso('el correo empieza apagado', false, inicial.activo)
  caso('los comunicados sí salen por correo cuando se encienda', true, inicial.avisaDe.comunicados)
  caso('las cuotas también', true, inicial.avisaDe.cuotas)
  // Los cambios de ficha son muchos y menores: llenarían la bandeja.
  caso('los cambios de ficha no', false, inicial.avisaDe.ficha)

  // --- Guardar y leer ---
  m.saveAjustesCorreo({ ...inicial, activo: true, responderA: 'secretaria@hermandad.es' })
  caso('se guarda que está activo', true, m.getAjustesCorreo().activo)
  caso('y a dónde se contesta', 'secretaria@hermandad.es', m.getAjustesCorreo().responderA)
  // Lo guardado por una versión anterior no trae los campos nuevos.
  localStorage.setItem(m.CLAVE_CORREO, JSON.stringify({ activo: true }))
  const parcial = m.getAjustesCorreo()
  caso('unos ajustes a medias se completan', true, parcial.avisaDe.comunicados)
  caso('sin perder lo que sí traían', true, parcial.activo)

  // --- ¿Se puede mandar? ---
  // Sin base de datos no hay función de servidor, así que no.
  caso('sin Supabase no se puede mandar', false, m.correoDisponible({ activo: true }))
  caso('y apagado tampoco', false, m.correoDisponible({ activo: false }))

  // --- Nunca lanza ---
  // Quien lo llama está haciendo algo más importante (mandar un comunicado):
  // un fallo de correo no puede tumbar eso.
  const r = await m.enviarCorreo({ para: ['a@b.es'], asunto: 'x', texto: 'y' })
  caso('sin conectar, devuelve un fallo en vez de reventar', false, r.ok)
  caso('y explica por qué', true, (r.error ?? '').length > 10)

  // --- El correo de prueba ---
  const p = m.correoDePrueba('Hdad. de la Vera-Cruz')
  caso('el asunto nombra a la hermandad', true, p.asunto.includes('Hdad. de la Vera-Cruz'))
  caso('trae versión en texto', true, p.texto.length > 40)
  caso('y en HTML', true, p.html.includes('<div'))
  // El nombre de la hermandad se escapa: un «&» o un «<» en el nombre no puede
  // romper el HTML del correo.
  const conSigno = m.correoDePrueba('Hdad. <script>alerta</script> & Cía')
  caso('el nombre se escapa en el HTML', false, conSigno.html.includes('<script>'))
  caso('y se ve escapado', true, conSigno.html.includes('&lt;script&gt;'))
  caso('el «&» también', true, conSigno.html.includes('&amp;'))

  localStorage.removeItem(m.CLAVE_CORREO)

  await correoAuditoria({ cargar, caso })
}

/**
 * Auditoría 2026-08 · Que los correos lleguen de verdad.
 */
async function correoAuditoria({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')

  // --- Más de 50 destinatarios ---
  // Una hermandad de 612 mandaba a los 612 de una vez; el servidor corta en 50
  // y devolvía un 400, así que NO LE LLEGABA A NADIE. Y el comunicado ya se
  // había guardado como «Enviado», con el botón de mandarlo escondido.
  const m = await cargar('src/lib/correo.ts')
  caso('el tamaño de tanda está declarado', 50, m.POR_TANDA)
  const src = await readFile('src/lib/correo.ts', 'utf8')
  caso('se trocea si hay más', true, /if \(para\.length > POR_TANDA\)/.test(src))
  caso('las tandas van una detrás de otra', true, /await enviarCorreo\(\{ \.\.\.mensaje, para: tanda \}\)/.test(src))
  caso('si sale una parte, se dice cuál', true, /Salieron \$\{enviados\} de/.test(src))
  // Y el servidor tiene que cortar en el mismo número, o el troceo no sirve.
  const fn = await readFile('supabase/functions/enviar-correo/index.ts', 'utf8')
  const tope = fn.match(/const MAXIMO_DESTINATARIOS = (\d+)/)
  caso('el servidor corta en el mismo número', '50', tope && tope[1])

  // --- La configuración es de la HERMANDAD, no del portátil ---
  // El secretario la activaba en su portátil; la tesorera, desde el ordenador
  // de la casa de hermandad, marcaba cuotas como pagadas y no salía ni un
  // aviso: en ESE navegador la configuración no existe, así que se leía la de
  // fábrica —apagado— y la lista salía vacía. Sin error y sin mensaje.
  caso('se trae de la base de datos', true, /export async function cargarAjustesCorreoDeLaBase/.test(src))
  caso('y se guarda en ella', true, /export async function guardarAjustesCorreoEnLaBase/.test(src))
  caso('el hook hace las dos cosas', true,
    /void cargarAjustesCorreoDeLaBase\(\)/.test(src) && /void guardarAjustesCorreoEnLaBase\(a\)/.test(src))
  const sqlCorreo = await readFile('supabase/correo-hermandad.sql', 'utf8')
  caso('hay columna para ella', true, /add column if not exists correo jsonb/.test(sqlCorreo))

  // Y que las pantallas que mandan avisos la traigan antes de escribir.
  const av = await readFile('src/lib/avisosCorreo.ts', 'utf8')
  caso('hay una función que lo prepara todo', true, /export async function prepararAvisos/.test(av))
  caso('trae config y preferencias a la vez', true,
    /Promise\.all\(\[cargarAjustesCorreoDeLaBase\(\), cargarPreferenciasDeLaBase\(\)\]\)/.test(av))
  for (const p of ['Cuotas', 'Papeletas', 'Comunicados', 'Hermanos']) {
    const pant = await readFile(`src/pages/app/${p}.tsx`, 'utf8')
    caso(`${p} lo prepara al abrirse`, true, /void prepararAvisos\(\)/.test(pant))
  }

  // --- La baja y el cambio de IBAN salen SIEMPRE ---
  // Iban por el interruptor «ficha», que viene apagado de fábrica.
  const avisos = await cargar('src/lib/avisosCorreo.ts')
  const gente = [{ id: 'h1', nombre: 'Ana', email: 'ana@correo.es' }]
  const deFabrica = { activo: true, responderA: '', avisaDe: { comunicados: true, cuotas: true, papeletas: true, ficha: false } }
  caso('con la config de fábrica, «ficha» no sale', 0, avisos.destinatariosDe(gente, 'ficha', deFabrica).length)
  caso('pero un aviso importante SÍ', 1, avisos.destinatariosDe(gente, 'importante', deFabrica).length)
  // Ni el hermano lo puede apagar: va sobre su cuenta bancaria y su baja.
  const ah = await cargar('src/lib/avisosHermano.ts')
  caso('el hermano no puede apagar los importantes', true, ah.quiereAviso({ importante: false, ficha: false }, 'importante'))
  caso('los demás sí', false, ah.quiereAviso({ ficha: false }, 'ficha'))
  // Con el correo apagado del todo no sale nada, ni los importantes.
  const apagado = { ...deFabrica, activo: false }
  caso('con el correo apagado no sale ni el importante', 0, avisos.destinatariosDe(gente, 'importante', apagado).length)

  // Y que los dos sitios lo usen.
  const hermanos = await readFile('src/pages/app/Hermanos.tsx', 'utf8')
  caso('la baja usa «importante»', true, /'importante',\n\s+'Tu baja en la hermandad'/.test(hermanos))
  caso('el cambio de IBAN también', true, /'importante',\n\s+'Han cambiado tu cuenta bancaria'/.test(hermanos))

  // --- Los segmentos ---
  const com = await readFile('src/pages/app/Comunicados.tsx', 'utf8')
  caso('los destinatarios salen de los criterios guardados', true,
    /if \(c\.criterios\) return filtrarSegmento\(hermanos, c\.criterios, rolesPorHermano\)/.test(com))
  caso('y los criterios se guardan en el comunicado', true, /criterios: criteriosGuardados,/.test(com))
  caso('no se guarda como enviado si no hay nadie', true,
    /if \(estado === 'Enviado' && reciben\.length === 0\)/.test(com))
  caso('el alcance sale de a quién se escribió', true, /alcance: reciben\.length/.test(com))
  // «Enviar ahora» del formulario tiene que mandar el correo, no solo el buzón.
  caso('«Enviar ahora» del formulario manda correo', true, /void enviarAhora\(nuevos\[0\]\)/.test(com))

  // Y la columna en la base de datos.
  const sql = await readFile('supabase/comunicados-segmento.sql', 'utf8')
  caso('hay SQL para los criterios', true, /add column if not exists criterios jsonb/.test(sql))
  const db = await readFile('src/lib/db/comunicados.ts', 'utf8')
  caso('se guardan', true, /criterios: c\.criterios/.test(db))
  caso('y se leen', true, /criterios: \(r\.criterios/.test(db))
}
