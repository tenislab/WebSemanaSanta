/**
 * EL PANEL DE LAS CINCO REDES.
 *
 * Una tira de fichas con las cuentas de la hermandad, y debajo el formulario
 * de la que se esté editando —uno cada vez, para que la tira no se descoloque—.
 *
 * Se lleva UNA prop y no trece: `redes` es lo que devuelve `useLasRedes()` de
 * una pieza. Pasar los trece sueltos habría dejado un componente imposible de
 * leer en su primera línea, que es justo lo que se intenta evitar al partir el
 * fichero.
 */
import type { CSSProperties } from 'react'
import { COLOR_RED, enlaceDeLaCuenta } from '../../../lib/redesSociales'
import IconoRed from '../../../components/IconoRed'
import type { LasRedes } from './redesSociales'

export default function PanelDeRedes({ redes }: { redes: LasRedes }) {
  const {
    cuentas, cuentasConectadas, conectando, setConectando,
    usuarioInput, setUsuarioInput, errorRed, setErrorRed,
    conectar, desconectar,
  } = redes
  return (
    <>
    {/*
      LAS CINCO REDES, A LA VISTA Y EN UNA SOLA TIRA.
      Esto era un desplegable con cinco tarjetas grandes, cada una con su
      botón «Conectar» en rojo: cerrado no se veía para qué servía, y abierto
      empujaba los comunicados —que son el contenido de la pantalla— media
      página hacia abajo. Ahora es una tira de fichas que cabe de un vistazo,
      siempre visible, y el color dice el estado sin tener que leer: la marca
      va encendida cuando la cuenta está puesta y apagada cuando no. Al pulsar
      una ficha, el formulario se abre debajo (uno cada vez, para que la tira
      no se descoloque).
    */}
    <section className="redes-panel" aria-labelledby="redes-titulo">
      <header className="redes-panel__head">
        <div className="redes-panel__que">
          <h2 id="redes-titulo">
            Redes sociales de la hermandad
            <span className="redes-panel__marcador">
              <b>{cuentasConectadas.length}</b> de {cuentas.length} puestas
            </span>
          </h2>
          <p className="table-subtle">
            Di cuál es la cuenta de la hermandad en cada red. Con eso, los comunicados salen con el
            texto listo y un botón que abre la red, y los iconos aparecen en el pie de la web.
          </p>
        </div>
      </header>

      <div className="redes-tira">
        {cuentas.map((c) => {
          const enlace = enlaceDeLaCuenta(c)
          return (
            <div
              key={c.red}
              className={`red-ficha${c.conectada ? ' red-ficha--puesta' : ''}${conectando === c.red ? ' red-ficha--editando' : ''}`}
              style={{ '--marca': COLOR_RED[c.red] } as CSSProperties}
            >
              <button
                type="button"
                className="red-ficha__boton"
                onClick={() => {
                  if (conectando === c.red) { setConectando(null); setUsuarioInput(''); setErrorRed(''); return }
                  setConectando(c.red)
                  setUsuarioInput(c.enlace ?? c.usuario ?? '')
                  setErrorRed('')
                }}
                aria-expanded={conectando === c.red}
              >
                <span className="red-ficha__marca"><IconoRed red={c.red} tam={22} /></span>
                <span className="red-ficha__texto">
                  <b>{c.red}</b>
                  {/* El título trae el nombre entero: la ficha es estrecha y
                      un «@hermandaddelaverac…» no dice cuál es la cuenta. */}
                  <span className="red-ficha__estado" title={c.conectada ? (c.usuario || undefined) : undefined}>
                    {c.conectada ? (c.usuario || 'Puesta') : 'Sin poner'}
                  </span>
                </span>
              </button>
              {/* El enlace a la cuenta va FUERA del botón: dos cosas que se
                  pulsan no pueden estar una dentro de otra, y aquí son de
                  verdad dos —editar y abrir la página de la hermandad—. */}
              {c.conectada && enlace && (
                <a
                  className="red-ficha__ir"
                  href={enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Abrir ${c.red} en otra pestaña`}
                  aria-label={`Abrir la cuenta de ${c.red} en otra pestaña`}
                >
                  ↗
                </a>
              )}
            </div>
          )
        })}
      </div>

      {/* El formulario, debajo de la tira y uno cada vez. */}
      {conectando && (
        <div className="redes-editor">
          <label htmlFor="redCuenta">
            La cuenta de la hermandad en <b>{conectando}</b>
          </label>
          <div className="redes-editor__fila">
            <input
              id="redCuenta"
              type="text"
              placeholder="@lahermandad o la dirección de su página"
              value={usuarioInput}
              onChange={(e) => { setUsuarioInput(e.target.value); setErrorRed('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') conectar(conectando) }}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={() => conectar(conectando)}>
              Guardar
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setConectando(null); setUsuarioInput(''); setErrorRed('') }}
            >
              Cancelar
            </button>
            {cuentas.find((c) => c.red === conectando)?.conectada && (
              <button className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => desconectar(conectando)}>
                Quitar
              </button>
            )}
          </div>
          {errorRed && <p className="form-hint form-hint--error">{errorRed}</p>}
        </div>
      )}

      {/*
        LA VERDAD SOBRE PUBLICAR SOLO, dicha donde se decide.
        Publicar sin abrir la red exige una aplicación aprobada por cada
        plataforma (Meta revisa a mano, X cobra por la API, TikTok y YouTube
        auditan) y una clave secreta que no puede estar en el navegador: si
        está en la web, cualquiera publica en nombre de la hermandad. Decirlo
        aquí es mejor que un botón que diga «publicado» sin publicar nada.
      */}
      <p className="redes-panel__nota">
        <b>Publicar se hace en dos pasos, y es de verdad.</b> El comunicado deja el texto preparado y
        un botón que abre la red; se pega y se publica. Publicar sin salir de aquí exige que cada
        plataforma apruebe la aplicación de la hermandad (Meta lo revisa a mano, X cobra por ello), así
        que de momento no lo prometemos.
      </p>
    </section>
    </>
  )
}
