/**
 * A quién se le manda un aviso por correo. Son cuatro filtros encadenados y
 * el orden importa, porque el último —lo que haya decidido el propio hermano—
 * tiene que poder más que lo que encienda la hermandad.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/avisosCorreo.ts')
  const av = await cargar('src/lib/avisosHermano.ts')

  const gente = [
    { id: 'h1', nombre: 'Ana', email: 'ana@ejemplo.test' },
    { id: 'h2', nombre: 'Bruno', email: 'bruno@ejemplo.test' },
    { id: 'h3', nombre: 'Sin correo', email: '' },
    { id: 'h4', nombre: 'Correo roto', email: 'esto-no-es-un-correo' },
  ]
  const encendido = {
    activo: true,
    responderA: '',
    avisaDe: { comunicados: true, cuotas: true, papeletas: true, ficha: true },
  }

  // 1. Con todo encendido: los dos que tienen un correo que lo parece.
  caso('solo los que tienen un correo válido', 2, m.destinatariosDe(gente, 'cuota', encendido).length)
  caso('sin correo, fuera', false, m.destinatariosDe(gente, 'cuota', encendido).some((h) => h.id === 'h3'))
  caso('correo mal escrito, fuera', false, m.destinatariosDe(gente, 'cuota', encendido).some((h) => h.id === 'h4'))

  // 2. El correo apagado del todo: no sale nada, aunque el tipo esté encendido.
  caso(
    'con el correo apagado no sale nada',
    0,
    m.destinatariosDe(gente, 'cuota', { ...encendido, activo: false }).length,
  )

  // 4. Cada tipo mira SU interruptor. Apagar cuotas no puede apagar papeletas.
  const soloPapeletas = { ...encendido, avisaDe: { comunicados: false, cuotas: false, papeletas: true, ficha: false } }
  caso('las cuotas apagadas no salen', 0, m.destinatariosDe(gente, 'cuota', soloPapeletas).length)
  caso('y las papeletas encendidas sí', 2, m.destinatariosDe(gente, 'papeleta', soloPapeletas).length)
  caso('la ficha apagada no sale', 0, m.destinatariosDe(gente, 'ficha', soloPapeletas).length)

  // 5. Lo que decide el hermano manda. Aunque la hermandad lo tenga encendido.
  av.savePreferenciasAvisos('h1', { cuota: false })
  const tras = m.destinatariosDe(gente, 'cuota', encendido)
  caso('el hermano que lo apagó no lo recibe', false, tras.some((h) => h.id === 'h1'))
  caso('y el que no lo apagó, sí', true, tras.some((h) => h.id === 'h2'))
  caso('apagar las cuotas no apaga las papeletas', true, m.destinatariosDe(gente, 'papeleta', encendido).some((h) => h.id === 'h1'))
  av.savePreferenciasAvisos('h1', {})

  // 6. El cuerpo del correo: sin HTML colado por el texto de nadie.
  const cuerpo = m.cuerpoCorreo('Título <script>', ['Cuerpo & "cosas"'], 'Pie')
  caso('el título no cuela etiquetas', false, cuerpo.html.includes('<script>'))
  caso('el ampersand va escapado', true, cuerpo.html.includes('&amp;'))
  caso('la versión en texto plano lleva el título', true, cuerpo.texto.startsWith('Título <script>'))
  caso('y el cuerpo', true, cuerpo.texto.includes('Cuerpo & "cosas"'))
}
