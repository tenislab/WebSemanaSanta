import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { olvidarRecuperacion } from '../lib/recuperacionClave'

/**
 * La pantalla de «elige una contraseña nueva», al volver del enlace del correo.
 *
 * POR QUÉ EXISTE. Quien pedía recuperar su contraseña desde una cuenta de junta
 * volvía a `/login`. Y ahí, como Supabase ya le había abierto sesión al
 * procesar el enlace, el `useEffect` de esa pantalla lo empujaba directamente a
 * `/app`. O sea: entraba, sí, pero **nunca llegaba a cambiar la contraseña**.
 * La siguiente vez volvía a no poder entrar y a pedir otro correo, en bucle.
 */
export default function PonerClaveNueva({ alTerminar }: { alTerminar: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    const nueva = String(datos.get('nueva') ?? '')
    const repetida = String(datos.get('repetida') ?? '')
    if (nueva.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.')
      return
    }
    if (nueva !== repetida) {
      setError('Las dos contraseñas no coinciden.')
      return
    }
    if (!supabase) {
      setError('No hay conexión con la base de datos.')
      return
    }
    setGuardando(true)
    const { error: fallo } = await supabase.auth.updateUser({ password: nueva })
    setGuardando(false)
    if (fallo) {
      // El enlace del correo caduca. Decirlo es más útil que «error»: lo que
      // hay que hacer es pedir otro, no volver a intentarlo con el mismo.
      setError(
        'No se ha podido cambiar. El enlace del correo puede haber caducado: pide uno nuevo desde «¿Has olvidado tu contraseña?».',
      )
      return
    }
    olvidarRecuperacion()
    alTerminar()
  }

  return (
    <form className="app-form" onSubmit={guardar}>
      <p className="form-hint">
        Has llegado desde el enlace del correo. Elige una contraseña nueva y ya
        podrás entrar con ella.
      </p>
      <div className="form-row">
        <label htmlFor="nueva">Contraseña nueva</label>
        <input id="nueva" name="nueva" type="password" autoComplete="new-password" required minLength={6} />
      </div>
      <div className="form-row">
        <label htmlFor="repetida">Repítela</label>
        <input id="repetida" name="repetida" type="password" autoComplete="new-password" required minLength={6} />
      </div>
      {error && <p className="aviso-falta__error-suelto">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar la contraseña'}
      </button>
    </form>
  )
}
