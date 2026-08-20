/** P0: el registro de lo que falta por configurar. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/requisitos.ts')
  // `huecosLegales` se pasa a mano: si no, la prueba dependería de cuántos
  // corchetes queden hoy en los documentos legales.
  const vacio = { supabaseListo: false, correoListo: false, huecosLegales: 3, hermandad: null, web: null }

  // --- Cada requisito trae las tres piezas que hacen falta ---
  // Un aviso que solo dice «no configurado» deja a la junta igual de perdida:
  // hace falta qué no va, por qué, y quién lo arregla.
  const todos = Object.values(m.requisitos(vacio))
  caso('hay seis requisitos', 6, todos.length)
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
  // --- Las páginas legales ---
  // Son públicas: publicarlas con «[RAZÓN SOCIAL]» dentro lo ve cualquiera.
  caso('con huecos, la parte legal no está lista', false, m.requisito('legal', vacio).listo)
  caso('y dice cuántos son', true, /3 huecos/.test(m.requisito('legal', vacio).queNoVa))
  caso('sin huecos, lista', true, m.requisito('legal', { ...vacio, huecosLegales: 0 }).listo)
  caso('con uno solo, en singular', true, /1 hueco sin/.test(m.requisito('legal', { ...vacio, huecosLegales: 1 }).queNoVa))

  caso('sin nada configurado, faltan los seis', 6, m.requisitosPendientes(vacio).length)
  const casi = {
    supabaseListo: true,
    correoListo: false,
    huecosLegales: 0,
    hermandad: { iban: 'ES47', bizumTelefono: '' },
    web: { dominio: 'x.es', donativos: { enlacePasarela: 'https://p.example' } },
  }
  caso('con todo puesto, solo queda el correo', 1, m.requisitosPendientes(casi).length)
  caso('y es el correo', 'correo', m.requisitosPendientes(casi)[0].id)

  await avisoDeEjemplo({ cargar, caso })

  await loQueVaEnLaBase({ cargar, caso })
}

/**
 * «Datos de ejemplo» solo cuando de verdad lo son.
 *
 * Media aplicación lo daba por hecho: cinco pantallas ponían «datos de ejemplo
 * mientras conectamos la base de datos» pasara lo que pasara, así que una
 * hermandad con su censo de verdad dentro leía eso encima de sus 800 hermanos.
 *
 * Y en los documentos impresos era peor: el pie de un recibo decía «datos de
 * ejemplo, sin validez fiscal» POR DEFECTO. Ese papel se entrega en mano, y lo
 * que ponía era que no valía para nada.
 */
async function avisoDeEjemplo({ cargar, caso }) {
  const m = await cargar('src/lib/demo.ts')

  // En estas pruebas no hay Supabase: es modo demostración de verdad y el
  // aviso TIENE que salir. Quitarlo aquí sería el error contrario.
  caso('sin base de datos, sí son datos de ejemplo', true, m.hayDatosDeEjemplo())

  // Y con la marca del modo demo puesta, también.
  localStorage.setItem('cabildo-demo-modo', 'llena')
  caso('en modo demostración, también', true, m.hayDatosDeEjemplo())
  localStorage.removeItem('cabildo-demo-modo')

  // Que ninguna pantalla ni documento lo tenga escrito a fuego.
  const { readFile } = await import('node:fs/promises')
  for (const f of [
    'src/pages/app/Hermanos.tsx', 'src/pages/app/Comunicados.tsx',
    'src/pages/app/Inventario.tsx', 'src/pages/app/Archivo.tsx',
    'src/pages/app/Tesoreria.tsx', 'src/components/Recibo.tsx',
    'src/components/MovimientoJustificante.tsx', 'src/components/InformeImpreso.tsx',
  ]) {
    const src = await readFile(f, 'utf8')
    const loDice = /datos de ejemplo/.test(src)
    const loComprueba = /hayDatosDeEjemplo\(\)/.test(src)
    caso(`${f.split('/').pop()} solo lo dice si lo comprueba`, true, !loDice || loComprueba)
  }
}

/**
 * Auditoría 2026-08 · Lo que vive en el navegador y debería vivir en la base.
 *
 * Un patrón repetido por toda la aplicación: un dato de LA HERMANDAD guardado
 * en `localStorage`. Siempre falla igual de mal y siempre en silencio: quien
 * entra desde otro ordenador ve otra cosa, y nadie entiende por qué.
 */
async function loQueVaEnLaBase({ caso }) {
  const { readFile } = await import('node:fs/promises')

  // La suscripción. Dos caras: la secretaria se topaba con el muro de pago
  // aunque la hermandad estuviera al corriente, y desde la consola del
  // navegador dos líneas bastaban para ponerse el pack «Todo» sin pagar.
  const susc = await readFile('src/lib/suscripcion.ts', 'utf8')
  caso('la suscripción se trae del servidor', true, /export async function cargarSuscripcionDeLaBase/.test(susc))
  caso('y el hook la usa', true, /void cargarSuscripcionDeLaBase\(\)/.test(susc))
  const sql = await readFile('supabase/suscripcion.sql', 'utf8')
  caso('hay tabla para ella', true, /create table if not exists suscripciones/.test(sql))
  // Lo importante: SOLO LECTURA desde el navegador. Si se pudiera escribir,
  // seguiría siendo gratis para quien sepa abrir la consola.
  caso('se puede leer la propia', true, /for select to authenticated/.test(sql))
  caso('pero NO escribir', true, /revoke insert, update, delete on suscripciones from anon, authenticated;/.test(sql))

  // Los permisos por cargo, que además mandaban sobre las otras hermandades.
  const perm = await readFile('supabase/permisos-por-hermandad.sql', 'utf8')
  caso('los permisos van por hermandad', true, /and pc\.hermandad_id = p\.hermandad_id/.test(perm))
  caso('y cada hermandad nace con los suyos', true, /sembrar_permisos_de_fabrica/.test(perm))

  // El correo, que se activaba en un portátil y no salía desde ningún otro.
  const correo = await readFile('src/lib/correo.ts', 'utf8')
  caso('la config de correo se comparte', true, /cargarAjustesCorreoDeLaBase/.test(correo))
  // Y cuando la función no está instalada, que lo diga en cristiano.
  caso('explica si falta desplegar la función', true, /La función de envío no está instalada/.test(correo))

  // El borrado del artículo 17 tiene que llevarse TODO, no solo la ficha.
  const rgpd = await readFile('src/lib/rgpd.ts', 'utf8')
  caso('el borrado RGPD se lleva la solicitud de alta', true, /solicitudes_alta'\)\.delete\(\)/.test(rgpd))

  // Y los adjuntos de la copia, paginados: `list()` da 100 y no avisa.
  const fs = await readFile('src/lib/filestore.ts', 'utf8')
  caso('los adjuntos se leen paginados', true, /limit: DE_UNA_VEZ, offset: desde/.test(fs))
}
