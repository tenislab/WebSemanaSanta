import { MARCA_RED, MARCA_WEB } from '../lib/redesSociales'
import type { RedSocial } from '../data/comunicados'

/**
 * El logotipo de una red, dibujado.
 *
 * Antes era una inicial dentro de un círculo de color: una «f», un «IG», una
 * nota musical para TikTok. Se entendía, pero se leía como un apaño justo en
 * una pantalla que la junta enseña a otras hermandades. Un logotipo se
 * reconoce sin leer nada.
 *
 * Toma el color de `currentColor`, así que quien lo usa decide si va en el
 * color de la marca (conectada) o apagado (sin conectar) sin tocar el dibujo.
 *
 * Es decorativo: el nombre de la red va escrito al lado en todos los sitios
 * donde se usa, así que se oculta a los lectores de pantalla en vez de
 * repetirlo.
 */
export default function IconoRed({ red, tam = 20 }: { red: RedSocial | 'Web'; tam?: number }) {
  const trazos = red === 'Web' ? MARCA_WEB : MARCA_RED[red]
  return (
    <svg
      className="icono-red"
      viewBox="0 0 24 24"
      width={tam}
      height={tam}
      aria-hidden="true"
      focusable="false"
    >
      {trazos.map((t, i) => {
        // El contorno se dibuja con línea y sin relleno; lo macizo, al revés.
        const hueco = 'hueco' in t && t.hueco
        const pinta = hueco
          ? { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
          : { fill: 'currentColor' }
        if (t.forma === 'rect') {
          return <rect key={i} x={t.x} y={t.y} width={t.w} height={t.h} rx={t.r} {...pinta} />
        }
        if (t.forma === 'circulo') {
          return <circle key={i} cx={t.cx} cy={t.cy} r={t.r} {...pinta} />
        }
        return <path key={i} d={t.d} {...pinta} />
      })}
    </svg>
  )
}
