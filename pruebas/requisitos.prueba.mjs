/** P0: el registro de lo que falta por configurar. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/requisitos.ts')
  const vacio = { supabaseListo: false, correoListo: false, hermandad: null, web: null }

  // --- Cada requisito trae las tres piezas que hacen falta ---
  // Un aviso que solo dice «no configurado» deja a la junta igual de perdida:
  // hace falta qué no va, por qué, y quién lo arregla.
  const todos = Object.values(m.requisitos(vacio))
  caso('hay cinco requisitos', 5, todos.length)
  caso('todos dicen qué no va', true, todos.every((r) => r.queNoVa.length > 5))
  caso('todos explican por qué', true, todos.every((r) => r.porQue.length > 20))
  caso('todos dicen quién lo arregla', true, todos.every((r) => r.comoSeArregla.length > 20))
  caso('todos tienen nombre corto', true, todos.every((r) => r.nombre.length > 3))
  caso('el id coincide con la clave', true,
    Object.entries(m.requisitos(vacio)).every(([k, r]) => k === r.id))

  // --- Supabase ---
  caso('sin claves, la base no está lista', false, m.requisito('supabase', { supabaseListo: false }).listo)
  caso('con claves, sí', true, m.requisito('supabase', { supabaseListo: true }).listo)

  // --- Datos de cobro: basta con uno de los dos ---
  const cob = (h) => m.requisito('datosCobro', { hermandad: h }).listo
  caso('sin Bizum ni cuenta, falta', false, cob({ iban: '', bizumTelefono: '' }))
  caso('con solo Bizum, vale', true, cob({ iban: '', bizumTelefono: '655 123 456' }))
  caso('con solo cuenta, vale', true, cob({ iban: 'ES47 2100 0813', bizumTelefono: '' }))
  // Espacios en blanco no son un dato de cobro.
  caso('un espacio no cuenta como Bizum', false, cob({ iban: '   ', bizumTelefono: '  ' }))
  caso('sin hermandad, falta', false, cob(null))

  // --- Pasarela ---
  const pas = (w) => m.requisito('pasarela', { web: w }).listo
  caso('sin enlace de pago, falta la pasarela', false, pas({ donativos: { enlacePasarela: '' } }))
  caso('con enlace, está', true, pas({ donativos: { enlacePasarela: 'https://pagar.example' } }))
  caso('sin web, falta', false, pas(null))

  // --- Dominio ---
  caso('sin dominio, falta', false, m.requisito('dominio', { web: { dominio: '' } }).listo)
  caso('con dominio, está', true, m.requisito('dominio', { web: { dominio: 'hdadtriana.es' } }).listo)

  // --- El correo ---
  // Ya está montado el envío; lo que falta es contratarlo y encenderlo.
  caso('sin contratar, el correo no está listo', false, m.requisito('correo', vacio).listo)
  caso('conectado y encendido, sí', true, m.requisito('correo', { ...vacio, correoListo: true }).listo)
  caso('y dice dónde se configura', true, /Configuración/.test(m.requisito('correo', vacio).enlace.texto))

  // --- Pendientes ---
  caso('sin nada configurado, faltan los cinco', 5, m.requisitosPendientes(vacio).length)
  const casi = {
    supabaseListo: true,
    correoListo: false,
    hermandad: { iban: 'ES47', bizumTelefono: '' },
    web: { dominio: 'x.es', donativos: { enlacePasarela: 'https://p.example' } },
  }
  caso('con todo puesto, solo queda el correo', 1, m.requisitosPendientes(casi).length)
  caso('y es el correo', 'correo', m.requisitosPendientes(casi)[0].id)
}
