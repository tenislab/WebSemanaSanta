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
}
