import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { confirmar, darseDeBaja } from '../lib/suscriptoresWeb'

/**
 * CONFIRMAR EL CORREO Y DARSE DE BAJA.
 *
 * Una sola página para los dos enlaces que salen en los correos de la
 * hermandad: el de confirmar, que va en el primero, y el de darse de baja, que
 * va en TODOS.
 *
 * NO PIDE INICIAR SESIÓN NI PREGUNTA NADA. Quien llega aquí no es hermano, no
 * tiene cuenta y a lo mejor está de pie en la calle. La llave del enlace es
 * toda la identificación que hace falta, y por eso es larga y al azar: sin
 * ella no hay nada que probar ni adivinar.
 *
 * Y LA BAJA SE HACE SOLA AL ABRIR EL ENLACE, sin un botón de «confirmar que
 * quieres la baja». Ese botón de más es lo que hace que alguien lo deje a
 * medias, siga recibiendo correos y acabe marcándolos como spam — que es peor
 * para la hermandad que perder un suscriptor.
 */
export default function AvisosWeb() {
  const [params] = useSearchParams()
  const llaveConfirmar = params.get('c') ?? ''
  const llaveBaja = params.get('baja') ?? ''
  const [estado, setEstado] = useState<'trabajando' | 'confirmado' | 'dadoDeBaja' | 'novale'>('trabajando')

  useEffect(() => {
    let vivo = true
    void (async () => {
      if (llaveBaja) {
        const ok = await darseDeBaja(llaveBaja)
        if (vivo) setEstado(ok ? 'dadoDeBaja' : 'novale')
        return
      }
      if (llaveConfirmar) {
        const ok = await confirmar(llaveConfirmar)
        if (vivo) setEstado(ok ? 'confirmado' : 'novale')
        return
      }
      if (vivo) setEstado('novale')
    })()
    return () => { vivo = false }
  }, [llaveConfirmar, llaveBaja])

  return (
    <div className="verificar">
      <header className="verificar__head">
        <Logo size={32} />
        <Link className="btn btn-outline btn-sm" to="/">Ir a Gobergo</Link>
      </header>
      <main className="verificar__main">
        <article className="verificar__card">
          {estado === 'trabajando' && <p aria-busy="true">Un momento…</p>}

          {estado === 'confirmado' && (
            <>
              <div className="verificar__sello" aria-hidden="true">✓</div>
              <h1>Listo</h1>
              <p className="verificar__nota">
                Ya está confirmado. A partir de ahora te avisamos cuando haya culto o salida, y
                nada más. En cada aviso tienes abajo un enlace para darte de baja cuando quieras.
              </p>
            </>
          )}

          {estado === 'dadoDeBaja' && (
            <>
              <div className="verificar__sello" aria-hidden="true">✓</div>
              <h1>Ya no te escribimos más</h1>
              {/*
                SE DICE QUE SE HA BORRADO, no que «se ha desactivado». Es lo que
                de verdad pasa —la fila se borra— y es lo que quiere oír quien
                pide la baja.
              */}
              <p className="verificar__nota">
                Tu correo se ha borrado de la lista. Si algún día quieres volver, puedes apuntarte
                otra vez desde la web de la hermandad.
              </p>
            </>
          )}

          {estado === 'novale' && (
            <>
              <div className="verificar__sello verificar__sello--err" aria-hidden="true">!</div>
              <h1>Este enlace ya no vale</h1>
              {/*
                LOS DOS MOTIVOS, porque el de abajo es tranquilizador y el de
                arriba no: quien ya se dio de baja y vuelve a pulsar el enlace
                se asusta al ver un error, creyendo que sigue en la lista.
              */}
              <p className="verificar__nota">
                O ya te habías dado de baja —en cuyo caso no te escribimos, tranquilo— o el enlace
                se ha copiado a medias. Prueba a abrirlo desde el correo, pulsándolo en vez de
                copiándolo.
              </p>
            </>
          )}
        </article>
      </main>
    </div>
  )
}
