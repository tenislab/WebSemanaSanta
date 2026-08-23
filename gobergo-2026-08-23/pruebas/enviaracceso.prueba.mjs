/**
 * DARLE ACCESO A UN HERMANO QUE YA ESTÁ EN EL CENSO.
 *
 * El hueco que tapa: la cuenta se creaba al dar de alta a mano y al aprobar una
 * solicitud, pero una hermandad entra IMPORTANDO 800 fichas. La importación no
 * crea cuentas —ni debe—, así que la hermandad tenía su censo entero y ni un
 * hermano podía entrar, sin que nada lo dijera.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/enviarAcceso.ts')

  const h = (o = {}) => ({
    id: 'h1', nombre: 'Jaime Rivas', email: 'jaime@ejemplo.com',
    dni: '12345678A', numero: 1, estado: 'Activo', authUserId: null, ...o,
  })

  // --- A quién NO se le manda, y por qué ---
  caso('a uno normal, sí se le puede', null, m.porQueNoSePuede(h()))
  // Quien ya entró y se puso su contraseña no puede recibir otra: la cuenta no
  // se crearía, así que sería una clave que no funciona.
  caso('a quien ya tiene cuenta, no', 'ya-tiene-cuenta', m.porQueNoSePuede(h({ authUserId: 'u-1' })))
  caso('a quien no tiene correo, no', 'sin-correo', m.porQueNoSePuede(h({ email: '' })))
  caso('ni con un correo a medias', 'sin-correo', m.porQueNoSePuede(h({ email: 'jaime' })))
  caso('ni con espacios', 'sin-correo', m.porQueNoSePuede(h({ email: '   ' })))
  // Un hermano de baja ya no es hermano: darle acceso a su área sería un fallo
  // de protección de datos, no una comodidad.
  caso('a quien está de baja, no', 'de-baja', m.porQueNoSePuede(h({ estado: 'Baja' })))
  // El orden importa: si está de baja Y no tiene correo, lo que hay que decir
  // es que está de baja, que es la razón de fondo.
  caso('de baja manda sobre lo demás', 'de-baja',
    m.porQueNoSePuede(h({ estado: 'Baja', email: '' })))
  // Un hermano nuevo sí: es justo el caso de después de importar.
  caso('a uno nuevo, sí', null, m.porQueNoSePuede(h({ estado: 'Nuevo' })))

  // --- Sin Supabase no se rompe: se comporta como en el resto de la app ---
  const r = await m.enviarAcceso(h(), 'Real Hermandad del Nazareno')
  caso('sin base de datos no revienta', true, typeof r.ok === 'boolean')

  // --- El resumen de una tanda ---
  const resumen = {
    enviados: 340,
    saltados: { 'sin-correo': 12, 'ya-tiene-cuenta': 448, 'de-baja': 0 },
    fallos: [{ nombre: 'Ana', error: 'x' }],
    cuentas: [],
  }
  const texto = m.contarLaTanda(resumen)
  // El resumen tiene que contar TODOS. Uno que solo diga «enviados: 340» de 800
  // deja a la secretaría sin saber qué pasó con los otros 460.
  caso('el resumen dice los enviados', true, /340 hermanos/.test(texto))
  caso('y los que ya tenían', true, /448 ya tenían acceso/.test(texto))
  caso('y los que no tienen correo', true, /12 no tienen correo/.test(texto))
  caso('y los que han fallado', true, /1 han fallado/.test(texto))
  // Lo que vale cero no se nombra: un resumen con «0 están de baja» se lee peor.
  caso('lo que vale cero no se dice', false, /de baja/.test(texto))

  caso('en singular también se lee bien', true,
    /Enviado a 1 hermano/.test(m.contarLaTanda({
      enviados: 1, saltados: { 'sin-correo': 0, 'ya-tiene-cuenta': 0, 'de-baja': 0 },
      fallos: [], cuentas: [],
    })))

  // --- La tanda va de uno en uno y no se para en el primero que falle ---
  const fuente = await (await import('node:fs/promises')).readFile('src/lib/enviarAcceso.ts', 'utf8')
  caso('la tanda espera a cada uno', true, /for \(const h of hermanos\)[\s\S]{0,120}await enviarAcceso/.test(fuente))
  caso('y no lanza a mitad', false, /throw /.test(fuente))
  // Si la cuenta no se crea, NO se manda la clave: una contraseña que no
  // funciona hace perder más tiempo que un correo que no llega.
  caso('sin cuenta no se manda clave', true,
    /if \(acceso\.error\) \{[\s\S]{0,400}return \{ ok: false, error: acceso\.error \}/.test(fuente))

  /*
   * Y QUE LA PANTALLA LO USE BIEN. La lógica puede estar impecable y el botón
   * no llamarla, o llamarla y no anotar el resultado — y entonces se le manda
   * una segunda clave al mismo hermano, que además no funcionaría.
   */
  const pantalla = await (await import('node:fs/promises')).readFile('src/pages/app/Hermanos.tsx', 'utf8')
  caso('la ficha llama a enviarAcceso', true, /onClick=\{\(\) => mandarAccesoATodos?\(|mandarAcceso\(selected\)/.test(pantalla))
  // Se anota la cuenta en la ficha: es lo que apaga el botón y evita la segunda
  // clave. Sin esto, el botón seguiría ahí invitando a repetirlo.
  caso('anota la cuenta al crearla', true, /authUserId: r\.authUserId/.test(pantalla))
  caso('y en la tanda también', true, /porId\.get\(x\.id\)/.test(pantalla))
  // A quien ya tiene acceso no se le ofrece el botón, se le explica qué hacer.
  caso('a quien ya tiene, no le ofrece el botón', true,
    /selected\.authUserId \? \([\s\S]{0,200}Ya tiene acceso/.test(pantalla))
  caso('y le dice cómo recuperar su contraseña', true, /he olvidado mi contraseña/.test(pantalla))
  // Sin correo no se puede: se dice, en vez de dejar un botón que fallaría.
  caso('sin correo lo dice en vez de fallar', true, /Para darle acceso hace falta su correo/.test(pantalla))
  // La tanda pide confirmación: son correos de verdad a gente de verdad.
  caso('la tanda pregunta antes', true, /window\.confirm\([\s\S]{0,180}enviarles su clave/.test(pantalla))
  // Y enseña por dónde va: 800 tardan, y sin señal parece colgada.
  caso('la tanda dice por dónde va', true, /Enviando… \$\{tandaAcceso\.hechos\} de/.test(pantalla))
  // Los fallos, con nombre: «3 han fallado» sin decir cuáles no sirve de nada.
  caso('los fallos van con nombre', true, /r\.fallos\.map\(\(f\) => f\.nombre\)/.test(pantalla))
}
