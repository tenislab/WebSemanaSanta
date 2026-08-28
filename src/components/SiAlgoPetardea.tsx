/**
 * LA RED DE SEGURIDAD: QUE UN FALLO NO DEJE LA PANTALLA EN BLANCO.
 *
 * Esto nace de un aviso real: «en mi navegador principal se queda en blanco,
 * pero en una ventana privada no». Esa frase es el síntoma clásico de un dato
 * guardado en el navegador que la aplicación ya no sabe leer —en privada no
 * hay nada guardado, por eso ahí arranca— y hasta ahora no había NADA que lo
 * atrapara: React desmonta el árbol entero cuando algo revienta al pintar, y
 * lo que queda es un `<div id="root">` vacío.
 *
 * Una pantalla en blanco es la peor forma de fallar. No dice qué ha pasado, no
 * dice qué hacer, y quien la ve da por hecho que la aplicación entera está
 * rota —cuando lo que suele estar roto es una sola clave del almacenamiento—.
 * Y desde el otro lado del teléfono no hay forma de averiguar nada: «se queda
 * en blanco» es todo lo que se puede contar.
 *
 * Así que aquí se atrapa y se enseñan tres cosas:
 *
 *   1. Que el fallo está en ESTE navegador y sus datos, no en la hermandad.
 *   2. EL ERROR TAL CUAL, para poder copiarlo y mandarlo. Sin esto, la única
 *      forma de saber qué pasó es que alguien abra la consola del navegador,
 *      y eso no va a ocurrir.
 *   3. Un botón que borra lo guardado y recarga. Es la salida que funciona
 *      casi siempre, y tenerla a mano evita el «pues bórralo todo tú» por
 *      teléfono.
 *
 * EL BOTÓN AVISA DE LO QUE SE LLEVA POR DELANTE, y no es palabrería: sin base
 * de datos conectada, lo guardado en el navegador ES la hermandad. Por eso
 * pide confirmación y por eso lo dice en dos frases.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { CLAVES_DATOS } from '../lib/persistencia'

interface Props { children: ReactNode }
interface Estado { error: Error | null; donde: string }

export default class SiAlgoPetardea extends Component<Props, Estado> {
  state: Estado = { error: null, donde: '' }

  static getDerivedStateFromError(error: Error): Partial<Estado> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A la consola también: quien sepa mirarla verá el árbol de componentes,
    // que es lo que dice en qué pantalla ha sido.
    console.error('Gobergo se ha caído al pintar:', error, info.componentStack)
    this.setState({ donde: (info.componentStack ?? '').split('\n').slice(0, 4).join('\n').trim() })
  }

  /**
   * Borra lo que guarda la aplicación y recarga.
   *
   * SOLO LAS CLAVES DE GOBERGO, no `localStorage.clear()`: en el mismo dominio
   * puede haber cosas de otras herramientas, y llevárselas por delante sería
   * pasarse de listo con datos que no son nuestros.
   */
  private vaciar = () => {
    const seguro = window.confirm(
      'Se van a borrar los datos que esta aplicación guarda en ESTE navegador.\n\n'
      + 'Si la hermandad tiene la base de datos conectada, no se pierde nada: todo vuelve a '
      + 'bajarse al entrar. Si NO la tiene, se pierde lo que hayas metido en este ordenador.\n\n'
      + '¿Sigo?',
    )
    if (!seguro) return
    try {
      const suyas = Object.keys(localStorage).filter((k) => k.startsWith('cabildo-'))
      for (const k of [...suyas, ...Object.values(CLAVES_DATOS)]) localStorage.removeItem(k)
    } catch { /* sin localStorage no hay nada que borrar */ }
    window.location.reload()
  }

  render() {
    const { error, donde } = this.state
    if (!error) return this.props.children

    return (
      <div className="petardazo">
        <div className="petardazo__caja">
          <h1>Algo se ha roto al abrir esta pantalla</h1>
          <p>
            Casi siempre es un dato guardado en <b>este navegador</b> que la aplicación ya no sabe
            leer. Si en una ventana privada sí funciona, es exactamente eso.
          </p>
          <p>
            Lo de la hermandad <b>no se ha perdido</b>: si la base de datos está conectada, está
            allí y vuelve a bajarse al entrar.
          </p>

          <div className="petardazo__botones">
            <button className="btn btn-primary" onClick={this.vaciar}>
              Vaciar los datos de este navegador y volver a entrar
            </button>
            <button className="btn btn-ghost" onClick={() => window.location.reload()}>
              Solo recargar
            </button>
          </div>

          {/* El error, para copiarlo y mandarlo. Es lo único que permite
              arreglar la causa en vez de ir tapando síntomas. */}
          <details className="petardazo__detalle">
            <summary>Ver el fallo (cópialo y mándalo si sigue pasando)</summary>
            <pre>{error.name}: {error.message}{donde ? `\n\n${donde}` : ''}</pre>
          </details>
        </div>
      </div>
    )
  }
}
