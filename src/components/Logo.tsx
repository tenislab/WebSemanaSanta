import { Link } from 'react-router-dom'

interface LogoProps {
  /** Tamaño de la marca en píxeles. El texto escala en proporción. */
  size?: number
  /** Muestra el nombre junto a la marca. */
  withText?: boolean
  /** Usa tonos claros (para fondos oscuros). */
  light?: boolean
  /** Si es true, envuelve el logo en un enlace a la portada. */
  asLink?: boolean
}

/**
 * LOS COLORES DE LA MARCA, escritos una sola vez.
 *
 * El verde no es un verde cualquiera: es el del logo, y tiene que salir igual
 * en la cabecera, en un recibo impreso y en la pestaña del navegador. Por eso
 * están aquí y no repartidos por el CSS.
 *
 * `VERDE_CLARO` es para fondos oscuros. El verde de siempre sobre el granate
 * de la cabecera se apaga y la marca desaparece; subir la luminosidad es lo
 * único que la salva sin cambiar de color.
 */
const VERDE = '#17787E'
const VERDE_CLARO = '#3FA3A8'
const ROJO = '#8E1C24'
const ROJO_CLARO = '#B23643'
const ORO = '#C4A153'

/**
 * UN CLAVO: cabeza ancha arriba y caña que se afila hacia abajo.
 *
 * Está aquí fuera y no repetido tres veces porque los tres clavos son el mismo
 * dibujo girado. Repitiéndolo, en cuanto se retoca uno los otros dos se quedan
 * atrás y el logo empieza a tener tres clavos distintos.
 */
const CLAVO = 'M56.3 10h7.4l-1 5.8h-5.4zM57.7 15.8h4.6L61.1 54h-2.2z'

/**
 * La marca de Gobergo: una gota con las iniciales GB caladas, tres clavos
 * asomando por arriba y la corona de espinas cruzándola.
 *
 * POR QUÉ ESTÁ DIBUJADA Y NO ES UNA IMAGEN. Va en la barra de la aplicación, en
 * la portada, en el pie de los recibos que se imprimen, en el membrete de los
 * informes que se llevan al cabildo y en el carné del hermano. Un PNG se ve
 * borroso al imprimir y pesa en cada carga; esto se dibuja nítido a cualquier
 * tamaño —de 16 píxeles en la pestaña a media hoja en un cartel— y ocupa lo que
 * ocupa un párrafo de texto.
 *
 * Y NO USA `currentColor`. Los tres colores SON la marca: tienen que salir
 * iguales sobre fondo claro, sobre fondo oscuro y en un papel en blanco y
 * negro. Heredar el color del texto los perdería justo donde más se ven.
 *
 * SI ALGÚN DÍA LLEGA EL ARCHIVO VECTORIAL ORIGINAL, se sustituyen las rutas de
 * aquí dentro y ya está: todo lo demás de la aplicación pide la marca por este
 * componente, así que no hay que tocar ni un sitio más.
 */
export function LogoMark({ size = 34, claro = false }: { size?: number; claro?: boolean }) {
  const verde = claro ? VERDE_CLARO : VERDE
  const rojo = claro ? ROJO_CLARO : ROJO
  /**
   * El calado de las letras: SIEMPRE en blanco.
   *
   * Se probó a calarlas en granate sobre fondo oscuro, pensando que el blanco
   * daría un fogonazo. No: las letras no están sobre el fondo de la página,
   * están sobre la GOTA, y la gota es verde en los dos casos. Caladas en
   * granate sobre el verde se convertían en manchas oscuras que a 34 píxeles
   * —el tamaño de la cabecera— no se leían como letras.
   *
   * Lo único que hay que aclarar en fondo oscuro es el verde, para que la gota
   * no se funda con el granate. De eso se encarga `VERDE_CLARO`.
   */
  const calado = '#FFFFFF'

  return (
    <span className="logo-mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
        {/*
          LOS TRES CLAVOS, detrás de la gota.

          Van primero para que la gota los tape por abajo: así asoman solo las
          cabezas y un trozo de caña, que es lo que se ve en el logo. Cada uno
          es la MISMA figura girada, no tres dibujos parecidos: dibujados por
          separado acabarían con grosores distintos y se notaría.

          Y separados de verdad (14°): más juntos, las tres cabezas se tocan y
          a tamaño pequeño quedan como una sola mancha roja.
        */}
        <g fill={rojo}>
          <g transform="rotate(-14 60 58)"><path d={CLAVO} /></g>
          <path d={CLAVO} />
          <g transform="rotate(14 60 58)"><path d={CLAVO} /></g>
        </g>

        {/*
          LA GOTA. Punta arriba, ancha y redondeada abajo. Es el contorno que se
          reconoce de lejos, cuando ya no se distinguen ni las letras ni la
          corona: en la pestaña del navegador solo se ve esto.
        */}
        <path
          d="M60 29c-1.9 0-3.5 1-4.8 2.8-7.9 10.6-13.9 18.3-18 23.5C31.5 62.6 29 70 29 78.2 29 93.6 42 106 60 106s31-12.4 31-27.8c0-8.2-2.5-15.6-8.2-22.9-4.1-5.2-10.1-12.9-18-23.5C63.5 30 61.9 29 60 29z"
          fill={verde}
        />

        {/*
          LAS INICIALES, CALADAS.

          No son un `<text>`: una tipografía que no esté instalada cambiaría la
          marca de sitio en sitio, y en un recibo impreso desde otro ordenador
          saldría otra letra. Dibujadas a trazo son siempre las mismas.

          Van en la BARRIGA de la gota, no en el centro del cuadro: arriba la
          gota se estrecha y la G se salía por el lado.
        */}
        <g stroke={calado} strokeWidth="5.8" fill="none" strokeLinecap="butt">
          {/* La G: el anillo abierto por la derecha, su travesaño y la caída
              que la distingue de una C. */}
          <path d="M57.4 71.6A10.6 10.6 0 1 0 57.4 86.4" />
          <path d="M59.6 80.6h-6.4" />
          <path d="M59.6 78.4v4.8" />
          {/* La B: el asta y las dos panzas. */}
          <path d="M66.6 66.4v25.2" />
          <path d="M66.6 66.4h6.2a6.3 6.3 0 0 1 0 12.6h-6.2" />
          <path d="M66.6 79h7a6.3 6.3 0 0 1 0 12.6h-7" />
        </g>

        {/*
          LA CORONA DE ESPINAS, cruzando por delante.

          Se dibuja al final para que pase por encima de las letras: la corona
          es lo que ata las dos mitades del monograma, y por debajo no se vería.
          Son dos vueltas trenzadas con sus ataduras, no un aro: un aro liso se
          lee como un subrayado y pierde de qué es.
        */}
        <g stroke={ORO} strokeLinecap="round" fill="none">
          <g strokeWidth="3.2">
            <path d="M39.5 71.6c4.6-4.2 12.3-6.4 20.5-6.4s15.9 2.2 20.5 6.4" />
            <path d="M40 76.2c4.7 3.9 12.2 6 20 6s15.3-2.1 20-6" />
          </g>
          {/* Las ataduras del trenzado. */}
          <g strokeWidth="1.9">
            <path d="M46.4 68.4l1.1 6M53.8 66.4l.7 6.4M65.5 66.4l-.7 6.4M72.9 68.4l-1.1 6" />
          </g>
          {/* Las espinas: cortas, alternando arriba y abajo, sin salirse de la gota. */}
          <g strokeWidth="1.9">
            <path d="M42.2 69.2l-2.8-2.4M49.6 66.4l-1.2-3.4M60 65v-3.6M70.4 66.4l1.2-3.4M77.8 69.2l2.8-2.4" />
            <path d="M42.8 77.4l-2.6 2.8M51.2 81l-1 3.6M60 82.4v3.8M68.8 81l1 3.6M77.2 77.4l2.6 2.8" />
          </g>
        </g>
      </svg>
    </span>
  )
}

export default function Logo({
  size = 34,
  withText = true,
  light = false,
  asLink = true,
}: LogoProps) {
  const content = (
    <span className={`brand${light ? ' brand--light' : ''}`}>
      <LogoMark size={size} claro={light} />
      {withText && (
        <span className="brand-texto">
          <span className="brand-name" style={{ fontSize: size * 0.52 }}>
            Gobergo
          </span>
          {/* El lema solo cuando hay sitio: a tamaño pequeño se convierte en
              una línea gris ilegible y estorba más que aporta. */}
          {size >= 40 && (
            <span className="brand-lema" style={{ fontSize: Math.max(8, size * 0.15) }}>
              Gestión de hermandades
            </span>
          )}
        </span>
      )}
    </span>
  )

  if (asLink) {
    return (
      <Link to="/" className="brand-link" aria-label="Gobergo — inicio">
        {content}
      </Link>
    )
  }
  return content
}
