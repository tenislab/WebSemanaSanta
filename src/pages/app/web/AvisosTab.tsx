/** Los avisos por correo a quien se suscribe desde la web. */
import { hermandadActualId } from '../../../lib/multiHermandad'
import {
  borrarSuscriptor,
  getSuscriptores,
  losQueFaltanPorConfirmar,
  losQueSePuedenAvisar,
  reenviarConfirmaciones,
  type Suscriptor,
} from '../../../lib/suscriptoresWeb'
import { diaCorto } from '../../../lib/visitas'
import { type WebPublica } from '../../../lib/webPublica'
import { useEffect, useState } from 'react'
import { type EditarFn } from './comun'

export function AvisosTab({ web, editar }: { web: WebPublica; editar: EditarFn }) {
  const [lista, setLista] = useState<Suscriptor[]>([])
  const [cargando, setCargando] = useState(true)

  /*
   * `null` = no se pudo preguntar. Se distingue de la lista vacía porque no es
   * lo mismo «todavía no se ha apuntado nadie» que «no lo sé»: lo primero se
   * arregla poniendo el formulario en la web, y lo segundo recargando.
   */
  const [falloAlLeer, setFalloAlLeer] = useState(false)
  async function recargar() {
    setCargando(true)
    const traidos = await getSuscriptores()
    setFalloAlLeer(traidos === null)
    setLista(traidos ?? [])
    setCargando(false)
  }
  useEffect(() => { void recargar() }, [])

  const confirmados = losQueSePuedenAvisar(lista)
  const pendientes = losQueFaltanPorConfirmar(lista)
  const sinConfirmar = pendientes.length

  /*
   * REENVIARLES EL ENLACE DE CONFIRMAR.
   *
   * Aquí es donde se ve el problema —una lista entera en «Sin confirmar»— así
   * que aquí tiene que estar la salida. Y durante mucho tiempo ese correo NO SE
   * MANDABA: no había forma, porque quien se apunta desde la web no tiene
   * sesión y el envío la exigía. O sea que los apuntados de entonces están
   * todos esperando un enlace que nunca salió, y sin esto se quedarían ahí para
   * siempre.
   */
  const [reenviando, setReenviando] = useState(false)
  const [avisoReenvio, setAvisoReenvio] = useState('')

  async function reenviarLasConfirmaciones() {
    setReenviando(true)
    setAvisoReenvio('')
    const hermandadId = await hermandadActualId()
    if (!hermandadId) {
      setReenviando(false)
      setAvisoReenvio('No se ha podido saber de qué hermandad son. Recarga la página e inténtalo otra vez.')
      return
    }
    const { enviados, fallidos } = await reenviarConfirmaciones(hermandadId, pendientes)
    setReenviando(false)
    /*
     * Se dicen LOS DOS NÚMEROS. «Enviado» a secas, con la mitad sin salir, deja
     * a la hermandad creyendo que ya está. Y los que fallan no siempre son un
     * fallo: la base no manda dos correos al mismo sitio en diez minutos, así
     * que pulsar dos veces cuenta el segundo como no enviado.
     */
    setAvisoReenvio(
      enviados === 0
        ? `No ha salido ninguno de los ${pendientes.length}. Si acabas de pulsar, espera diez minutos; `
          + 'si no, mira Configuración → Correo.'
        : `Enlace enviado a ${enviados}${fallidos > 0 ? `, y ${fallidos} sin salir` : ''}.`,
    )
    await recargar()
  }

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Avisos por correo</h2>
        <label className={`interruptor${web.avisosDeCultos ? ' interruptor--on' : ''}`}>
          <input
            type="checkbox"
            checked={web.avisosDeCultos}
            onChange={(e) => editar('avisosDeCultos', e.target.checked)}
          />
          <span />
          <span className="interruptor__texto">
            <b>{web.avisosDeCultos ? 'Encendido' : 'Apagado'}</b>
            <small>
              {web.avisosDeCultos
                ? 'Al final de los cultos sale «Avísame de los cultos».'
                : 'Nadie puede apuntarse desde la web.'}
            </small>
          </span>
        </label>
      </div>
      <p className="form-hint">
        Alrededor de una hermandad hay mucha más gente que hermanos. Esta lista es para ellos: un
        correo y poco más. No entran en el censo — el censo es de hermanos, y de ahí cuelgan las
        cuotas y las papeletas.
      </p>

      {/*
        LO QUE LA HERMANDAD SE COMPROMETE A HACER, escrito antes de encenderlo y
        no en la letra pequeña. Recoger correos no es gratis: hay obligaciones, y
        enterarse después es como acaban las multas.
      */}
      <div className="banner-inline banner-inline--accent">
        <span>
          Al encenderlo, la hermandad se compromete a tres cosas, y las tres las hace la
          aplicación sola: pedir confirmación por correo antes de escribir a nadie, poner el
          enlace de baja en cada aviso, y guardar qué aceptó cada uno y cuándo.
        </span>
      </div>

      {cargando && <p className="form-hint">Cargando…</p>}
      {/*
        NO ES LO MISMO «NO HAY NADIE» QUE «NO LO SÉ».
        Sin este aviso, un fallo al leer la lista se veía exactamente igual que
        una lista vacía: la hermandad se quedaba creyendo que no se ha apuntado
        nadie a su boletín. Y de esta misma lista sale el envío.
      */}
      {!cargando && falloAlLeer && (
        <p className="form-hint form-hint--error">
          No se ha podido leer la lista de suscriptores, así que lo de abajo no es lo que hay.
          Recarga la página para volver a intentarlo.
        </p>
      )}

      {!cargando && (
        <>
          <section className="stat-grid">
            <div className="stat-tile">
              <span className="stat-tile__label">Se les puede avisar</span>
              <span className="stat-tile__value">{confirmados.length}</span>
              <span className="stat-tile__trend stat-tile__trend--ok">Correo confirmado</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">Sin confirmar</span>
              <span className="stat-tile__value">{sinConfirmar}</span>
              {/*
                Se explica por qué NO se les escribe. Un número de «pendientes»
                sin explicar se lee como un fallo, y lo que es es la protección:
                sin confirmar, cualquiera apunta el correo de otro.
              */}
              <span className="stat-tile__trend stat-tile__trend--neutral">
                No han abierto el enlace del correo
              </span>
            </div>
          </section>

          {pendientes.length > 0 && (
            <div className="form-hint pendientes-confirmar">
              <p>
                {pendientes.length === 1
                  ? 'A esa persona no se le escribe hasta que abra el enlace del correo. Si no le llegó, mándaselo otra vez.'
                  : `A esas ${pendientes.length} personas no se les escribe hasta que abran el enlace del correo. `
                    + 'Si no les llegó, mándaselo otra vez.'}
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { void reenviarLasConfirmaciones() }}
                disabled={reenviando}
              >
                {reenviando ? 'Mandando…' : 'Mandar el enlace de confirmar'}
              </button>
              {avisoReenvio && <p role="status">{avisoReenvio}</p>}
            </div>
          )}

          {lista.length === 0 && (
            <p className="form-hint">
              Todavía no se ha apuntado nadie.{' '}
              {web.avisosDeCultos
                ? 'El formulario sale al final de la sección de Cultos.'
                : 'Enciéndelo arriba para que salga el formulario en la web.'}
            </p>
          )}

          {lista.length > 0 && (
            <table className="table-card">
              <thead>
                <tr><th>Correo</th><th>Nombre</th><th>Desde</th><th>Estado</th><th /></tr>
              </thead>
              <tbody>
                {lista.map((s) => (
                  <tr key={s.id}>
                    <td>{s.email}</td>
                    <td>{s.nombre || '—'}</td>
                    <td>{diaCorto(s.altaEn.slice(0, 10))}</td>
                    <td>
                      <span className={`pill ${s.confirmado ? 'pill--ok' : 'pill--off'}`}>
                        {s.confirmado ? 'Confirmado' : 'Sin confirmar'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm rgpd-borrar"
                        onClick={async () => {
                          if (!window.confirm(`¿Quitar a ${s.email} de la lista de avisos?`)) return
                          if (await borrarSuscriptor(s.id)) await recargar()
                        }}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  )
}

/* -------------------------------- Visitas -------------------------------- */
/**
 * EL CONTADOR DE VISITAS.
 *
 * «¿Entra alguien en la web?» es la primera pregunta después de publicarla.
 *
 * No es Google Analytics y no lo pretende: no hay embudos, ni países, ni de
 * dónde vienen. Hay tres cosas —cuántas, si suben o bajan, y qué se lee— y
 * ninguna necesita el cartel de las cookies, porque no se guarda ni una IP.
 * Ver `lib/visitas.ts`.
 */
