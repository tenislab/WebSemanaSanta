// Crea una cuenta real de personal por cada cargo, con contraseña conocida,
// para poder entrar con cada una y comprobar que la RLS por cargo (punto 3)
// funciona de verdad. Solo hace falta ejecutarlo una vez.
//
// Cómo usarlo:
//   1. Rellena SUPABASE_URL, SUPABASE_ANON_KEY, TITULAR_EMAIL y
//      TITULAR_PASSWORD ahí abajo con tus datos reales.
//   2. Desde la raíz del proyecto: node scripts/crear-personal-prueba.mjs
//      (necesita Node 18 o más nuevo; ya tienes @supabase/supabase-js
//      instalado porque lo usa la propia app).
//   3. Cuando termine, borra este archivo o al menos quita tu contraseña de
//      titular: NUNCA lo subas a git con tus credenciales dentro.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tu-proyecto.supabase.co' // <-- pega aquí tu URL
const SUPABASE_ANON_KEY = 'tu-anon-key' // <-- pega aquí tu anon key

const TITULAR_EMAIL = 'titular@tuhermandad.org' // <-- tu correo de titular
const TITULAR_PASSWORD = 'tu-contraseña-de-titular' // <-- tu contraseña de titular

const PASSWORD_PRUEBA = 'Prueba2026!'

const CARGOS = [
  { cargo: 'Hermano Mayor', email: 'prueba.hermanomayor@tuhermandad.org', nombre: 'Prueba Hermano Mayor' },
  { cargo: 'Secretario/a', email: 'prueba.secretaria@tuhermandad.org', nombre: 'Prueba Secretaría' },
  { cargo: 'Tesorero/a', email: 'prueba.tesorero@tuhermandad.org', nombre: 'Prueba Tesorería' },
  { cargo: 'Fiscal', email: 'prueba.fiscal@tuhermandad.org', nombre: 'Prueba Fiscal' },
  { cargo: 'Mayordomo/Prioste', email: 'prueba.mayordomo@tuhermandad.org', nombre: 'Prueba Mayordomo' },
  { cargo: 'Diputado/a Mayor de Gobierno', email: 'prueba.diputado@tuhermandad.org', nombre: 'Prueba Diputado' },
  { cargo: 'Vocal', email: 'prueba.vocal@tuhermandad.org', nombre: 'Prueba Vocal' },
  { cargo: 'Hermano de a pie', email: 'prueba.hermanodeapie@tuhermandad.org', nombre: 'Prueba Hermano de a pie' },
]

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

async function iniciarComoTitular(supabase) {
  const { error } = await supabase.auth.signInWithPassword({
    email: TITULAR_EMAIL,
    password: TITULAR_PASSWORD,
  })
  if (error) throw new Error(`No se pudo iniciar sesión como titular: ${error.message}`)
}

async function main() {
  if (SUPABASE_URL.includes('tu-proyecto') || TITULAR_EMAIL.includes('tuhermandad.org')) {
    console.error('Rellena antes SUPABASE_URL, SUPABASE_ANON_KEY, TITULAR_EMAIL y TITULAR_PASSWORD en este archivo.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await iniciarComoTitular(supabase)
  console.log('Sesión de titular iniciada.\n')

  const resultados = []

  for (const c of CARGOS) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: c.email,
      password: PASSWORD_PRUEBA,
      options: { data: { nombre: c.nombre, cargo: c.cargo, tipo: 'personal' } },
    })
    if (signUpError) {
      console.error(`✗ ${c.cargo}: no se pudo crear la cuenta — ${signUpError.message}`)
      continue
    }

    // signUp puede cambiar la sesión activa a la del usuario recién creado
    // (si la confirmación por correo está desactivada): hay que volver a
    // entrar como titular antes de escribir en la tabla `personal`.
    await iniciarComoTitular(supabase)

    const { error: insertError } = await supabase.from('personal').insert({
      nombre: c.nombre,
      email: c.email,
      clave: PASSWORD_PRUEBA,
      cargo: c.cargo,
      activo: true,
      fecha_alta: new Date().toISOString().slice(0, 10),
      auth_user_id: signUpData.user?.id ?? null,
    })
    if (insertError) {
      console.error(`✗ ${c.cargo}: cuenta creada pero no se pudo guardar en "personal" — ${insertError.message}`)
      continue
    }

    resultados.push(c)
    console.log(`✓ ${c.cargo.padEnd(30)} ${c.email}  /  ${PASSWORD_PRUEBA}`)
    await espera(1200) // evita el límite de peticiones de alta seguidas
  }

  await supabase.auth.signOut()

  console.log(`\nListo: ${resultados.length}/${CARGOS.length} cuentas creadas.`)
  if (resultados.length > 0) {
    console.log('Si tienes activada la confirmación de correo en Supabase, cada cuenta necesita confirmarse antes de poder entrar (ver Authentication → Providers → Email → "Confirm email").')
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
