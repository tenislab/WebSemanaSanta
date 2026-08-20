/**
 * Los errores de Supabase, en cristiano.
 *
 * El caso que motiva esto: al conectar Supabase por primera vez, el registro
 * devolvía un 500 con el cuerpo vacío y en pantalla salía un cuadro rojo que
 * ponía «{}». No dice nada y parece que la aplicación está rota, cuando lo que
 * falla es el correo saliente.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/erroresAuth.ts')
  const t = m.translateError

  // Lo que NUNCA puede salir en pantalla.
  for (const vacio of ['{}', '[object Object]', '', '   ', null, undefined]) {
    const r = t(vacio)
    caso(`«${String(vacio)}» no se enseña tal cual`, false, ['{}', '[object Object]', ''].includes(r.trim()))
    caso(`«${String(vacio)}» dice algo útil`, true, r.length > 30)
  }

  // El fallo del correo saliente: la cuenta NO se crea, así que reintentar no
  // sirve. El mensaje tiene que mandar a mirar el SMTP.
  caso('el fallo de correo apunta al SMTP', true, /SMTP|correo saliente/i.test(t('Error sending confirmation email')))
  caso('y avisa de que la cuenta no se ha creado', true, /no se ha creado/i.test(t('Error sending confirmation email')))

  // Los de siempre siguen funcionando.
  caso('credenciales', 'Correo o contraseña incorrectos.', t('Invalid login credentials'))
  caso('ya registrado', 'Ese correo ya tiene una cuenta. Inicia sesión.', t('User already registered'))
  caso('contraseña corta', 'La contraseña debe tener al menos 6 caracteres.', t('Password should be at least 6 characters'))
  caso('demasiados intentos', 'Demasiados intentos. Espera un momento e inténtalo de nuevo.', t('Rate limit exceeded'))
  caso('sin confirmar', 'Aún no has confirmado tu correo. Revisa tu bandeja de entrada.', t('Email not confirmed'))

  // Un mensaje que no se reconoce pero que dice algo, se respeta: puede ser
  // justo la pista que hace falta.
  caso('un mensaje desconocido se respeta', 'Vaya cosa más rara', t('Vaya cosa más rara'))
}
