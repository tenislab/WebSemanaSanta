/**
 * El error de Supabase, en cristiano.
 *
 * Lo importante aquí es el final. Antes se devolvía el mensaje tal cual cuando
 * no se reconocía, y hay errores que llegan SIN mensaje: en un 500, la
 * respuesta viene con el cuerpo vacío y lo que acababa en pantalla era un
 * `{}`. Un cuadro rojo que pone «{}» no dice absolutamente nada y además
 * parece que la aplicación está rota.
 */
export function translateError(message: string): string {
  const m = String(message ?? '').toLowerCase()

  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed'))
    return 'Aún no has confirmado tu correo. Revisa tu bandeja de entrada.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Ese correo ya tiene una cuenta. Inicia sesión.'
  if (m.includes('password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('unable to validate email')) return 'El correo no parece válido.'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'

  // El registro se cae al mandar el correo de confirmación. La cuenta NO llega
  // a crearse, así que reintentar no arregla nada: hay que mirar el correo
  // saliente. Es el fallo más común al conectar Supabase por primera vez y
  // antes se veía como un 500 sin explicación.
  if (m.includes('error sending') || m.includes('confirmation email') || m.includes('smtp'))
    return 'No se ha podido enviar el correo de confirmación, así que la cuenta no se ha creado. El problema está en el correo saliente configurado en Supabase (Authentication → SMTP Settings), no en lo que has escrito.'

  if (m.includes('database error'))
    return 'La base de datos ha rechazado el alta. Comprueba que has ejecutado el SQL completo en Supabase.'

  // Sin mensaje aprovechable —un 500 con el cuerpo vacío llega como «{}»— se
  // dice lo único cierto que se sabe, en vez de enseñar el hueco.
  const limpio = String(message ?? '').trim()
  if (!limpio || limpio === '{}' || limpio === '[object Object]') {
    return 'El servidor ha respondido con un error y no ha dicho cuál. Suele ser el correo saliente de Supabase. Mira Authentication → Logs para ver el motivo.'
  }
  return limpio
}