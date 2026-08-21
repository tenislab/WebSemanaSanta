import { useEffect, useState } from 'react'
import QrCode from './QrCode'
import { datosCarneDe, urlCarne } from '../lib/verificacion'
import { aniosDeHermandad } from '../lib/hermanoFicha'
import type { Hermano } from '../data/hermanos'

/**
 * El carné digital del hermano, con su QR.
 *
 * Sirve para dos cosas: enseñarlo en secretaría o en la casa de hermandad sin
 * llevar el carné de cartón encima, y acreditarse el día de la salida. Por eso
 * se puede poner a pantalla completa, con el brillo al máximo y sin nada
 * alrededor: es lo que un diputado de tramo necesita escanear en la calle, de
 * noche y con prisa.
 */
export default function CarneHermano({
  hermano,
  hermandadNombre,
  logo,
}: {
  hermano: Hermano
  hermandadNombre: string
  logo: string | null
}) {
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const enlace = urlCarne(datosCarneDe(hermano, hermandadNombre))
  const anios = aniosDeHermandad(hermano.antiguedad)

  /**
   * Al imprimir, la hoja de estilo deja visible SOLO lo marcado como
   * `print-doc`. El carné se marca justo mientras dura la impresión: si lo
   * llevara siempre, saldría también al imprimir un recibo.
   */
  useEffect(() => {
    if (!imprimiendo) return
    const alTerminar = () => setImprimiendo(false)
    window.addEventListener('afterprint', alTerminar)
    window.print()
    return () => window.removeEventListener('afterprint', alTerminar)
  }, [imprimiendo])

  // A pantalla completa: Escape cierra y el fondo no se desplaza detrás.
  useEffect(() => {
    if (!pantallaCompleta) return
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setPantallaCompleta(false)
    }
    window.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = antes
    }
  }, [pantallaCompleta])

  const tarjeta = (grande: boolean) => (
    <div className={`carne${grande ? ' carne--grande' : ''}${imprimiendo && !grande ? ' print-doc' : ''}`}>
      <div className="carne__cabeza">
        {logo ? <img src={logo} alt="" className="carne__escudo" /> : <span className="carne__escudo carne__escudo--sin" aria-hidden="true">✝</span>}
        <span className="carne__hermandad">{hermandadNombre}</span>
      </div>
      {/* La foto, si la ha puesto. Es lo que convierte el carné en algo que
          sirve para identificar a alguien y no solo para leerle el número. */}
      {hermano.fotoDataUrl && (
        <img className="carne__foto" src={hermano.fotoDataUrl} alt={`Foto de ${hermano.nombre}`} />
      )}
      <p className="carne__nombre">{hermano.nombre}</p>
      <div className="carne__datos">
        <div>
          <span>Nº de hermano/a</span>
          <b>{hermano.numero > 0 ? hermano.numero : '—'}</b>
        </div>
        <div>
          <span>Desde</span>
          <b>{hermano.antiguedad || '—'}</b>
        </div>
        <div>
          <span>Antigüedad</span>
          {/* Sin año de antigüedad, una raya. Antes salía «NaN años» en el
              carné del hermano, que es lo que enseña en la puerta. */}
          <b>{anios === null ? '—' : `${anios} años`}</b>
        </div>
      </div>
      <div className="carne__qr">
        <QrCode value={enlace} size={grande ? 240 : 120} />
        <span>Escanea para comprobarlo</span>
      </div>
      <span className={`pill ${hermano.estado === 'Activo' ? 'pill--ok' : hermano.estado === 'Nuevo' ? 'pill--info' : 'pill--off'} carne__estado`}>
        {hermano.estado}
      </span>
    </div>
  )

  return (
    <section className="portal__section" id="mi-carne">
      <h2>Mi carné</h2>
      <p className="portal__lead">
        Tu carné de hermano/a, con un código que cualquiera puede escanear para comprobar que eres
        de la casa. Ponlo a pantalla completa el día de la salida.
      </p>
      {tarjeta(false)}
      <div className="assign-box__row">
        <button type="button" className="btn btn-primary" onClick={() => setPantallaCompleta(true)}>
          Ver a pantalla completa
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setImprimiendo(true)}>
          Imprimir / Descargar
        </button>
      </div>

      {pantallaCompleta && (
        <div className="carne-pleno" role="dialog" aria-modal="true" aria-label="Carné a pantalla completa">
          <button
            type="button"
            className="carne-pleno__cerrar"
            onClick={() => setPantallaCompleta(false)}
            aria-label="Cerrar"
            autoFocus
          >
            ✕
          </button>
          {tarjeta(true)}
        </div>
      )}
    </section>
  )
}
