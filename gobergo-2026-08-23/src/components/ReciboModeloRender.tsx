import { valorDeCampoRecibo, type DatosRecibo } from '../lib/modeloRecibo'
import type { ModeloPapeleta } from '../lib/modeloPapeleta'

interface Props {
  modelo: ModeloPapeleta
  datos: DatosRecibo
  maxAncho?: number
}

/**
 * Dibuja el modelo de recibo subido por la hermandad con los datos reales de
 * la cuota encima. Misma mecánica que PapeletaModeloRender (unidades cqw para
 * que escale igual en pantalla y al imprimir), pero con los datos del recibo.
 */
export default function ReciboModeloRender({ modelo, datos, maxAncho }: Props) {
  return (
    <div className="modelo-render print-doc" style={{ maxWidth: maxAncho }}>
      <div className="modelo-render__lienzo">
        <img src={modelo.imagenDataUrl} alt="Modelo de recibo" className="modelo-render__img" />
        {modelo.campos.map((campo) => {
          const texto = valorDeCampoRecibo(campo, datos)
          if (!texto) return null
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
