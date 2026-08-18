import { valorDeCampo, type DatosModelo, type ModeloPapeleta } from '../lib/modeloPapeleta'
import QrCode from './QrCode'

interface Props {
  modelo: ModeloPapeleta
  datos: DatosModelo
  /** Ancho máximo en píxeles del render (por defecto ocupa el contenedor). */
  maxAncho?: number
  /** Versión física para imprimir: oculta el código QR (que es para la de móvil). */
  sinQr?: boolean
}

/**
 * Dibuja la imagen del modelo de papeleta subido por la hermandad y coloca
 * encima, en las posiciones definidas, los datos reales del hermano. Sirve
 * tanto para la vista previa como para imprimir (clase print-doc).
 *
 * Posiciones y tamaños se guardan en % del ancho de la imagen y se aplican con
 * unidades `cqw` (porcentaje del ancho del contenedor), así que el resultado
 * se ve idéntico en pantalla y en papel, sea cual sea el tamaño de la imagen.
 */
export default function PapeletaModeloRender({ modelo, datos, maxAncho, sinQr }: Props) {
  return (
    <div className="modelo-render print-doc" style={{ maxWidth: maxAncho }}>
      <div className="modelo-render__lienzo">
        <img src={modelo.imagenDataUrl} alt="Modelo de papeleta" className="modelo-render__img" />
        {modelo.campos.map((campo) => {
          if (sinQr && campo.clave === 'qr') return null
          const texto = valorDeCampo(campo, datos)
          if (!texto) return null
          // El campo QR se dibuja como un código real (escaneable), del tamaño
          // que se le haya dado; el resto de campos son texto.
          if (campo.clave === 'qr') {
            return (
              <span
                key={campo.id}
                className="modelo-campo modelo-campo--qr"
                style={{ left: `${campo.xPct}%`, top: `${campo.yPct}%`, width: `${campo.tamanoPct * 3.2}cqw` }}
              >
                <QrCode value={texto} size={240} />
              </span>
            )
          }
          return (
            <span
              key={campo.id}
              className={`modelo-campo modelo-campo--${campo.align}`}
              style={{
                left: `${campo.xPct}%`,
                top: `${campo.yPct}%`,
                fontSize: `${campo.tamanoPct}cqw`,
                fontWeight: campo.negrita ? 700 : 400,
                color: campo.color,
              }}
            >
              {texto}
            </span>
          )
        })}
      </div>
    </div>
  )
}
