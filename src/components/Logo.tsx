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

/* Los colores de la marca viven en `lib/marca.ts`: los necesitan también el
   icono de la pestaña y los documentos impresos, y el generador del icono es
   un script que no puede importar un componente. */

/**
 * ============================================================================
 * LA MARCA: UN NAZARENO
 * ============================================================================
 *
 * Antes eran dos ilustraciones —una orla de filigrana con la G para los tamaños
 * grandes y la misma marca sin orla para los pequeños—. Ahora es un dibujo de
 * línea de un nazareno, y es UNO SOLO para toda la aplicación: una marca es una
 * marca, y enseñar dos dibujos distintos según el tamaño de la caja es tener
 * dos.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ VA EN LÍNEA Y NO COMO IMAGEN, QUE ES LO QUE HABÍA
 * ----------------------------------------------------------------------------
 *
 * Por el color. El dibujo es UN SOLO TRAZO, y la cabecera del panel es granate
 * oscuro (ver `.app-side`). Una imagen granate sobre un fondo granate no se ve:
 * la marca desaparecía del menú lateral y no había manera de arreglarlo desde
 * fuera del archivo.
 *
 * Puesto en línea, el trazo va con `currentColor` y lo decide el CSS: granate
 * sobre papel, marfil sobre la cabecera. Es la misma pieza pintada de dos
 * colores, no dos piezas.
 *
 * De paso se ahorra una petición y queda nítido en cualquier pantalla.
 *
 * ----------------------------------------------------------------------------
 * LA PROPORCIÓN NO ES CUADRADA, Y ESO IMPORTA
 * ----------------------------------------------------------------------------
 *
 * El nazareno mide 1 de ancho por 2,08 de alto. La marca anterior era cuadrada,
 * así que `size` significaba «el lado». Aquí `size` es EL ALTO, y el ancho sale
 * de la proporción: forzando los dos, el nazareno saldría gordo y aplastado
 * —que es de esos fallos que nadie mira dos veces porque la pantalla «se ve
 * bien»—.
 *
 * ----------------------------------------------------------------------------
 * Y EL ICONO DE LA PESTAÑA TAMBIÉN ES EL NAZARENO, PERO ENGORDADO
 * ----------------------------------------------------------------------------
 *
 * Aquí decía que el icono seguía siendo el cuadrado con la G, y era la decisión
 * correcta con el dibujo tal cual: a 16 píxeles una línea fina no existe, se
 * convierte en una manchita gris.
 *
 * La salida no era cambiar de dibujo sino ENGORDAR ESTE. El icono se rasteriza
 * desde el mismo `nazareno.svg` con un `stroke` del mismo color encima, y el
 * grosor lo pone el tamaño: mucho a 16 y 32, poco a 48, ninguno a 180 —donde
 * engordarlo solo le quitaría el trazo a mano—. Está en
 * `scripts/generar-favicon.mjs`, en `engorde()`, con las medidas.
 *
 * Es lo mismo que hace cualquier tipografía, que dibuja distinto el cuerpo
 * pequeño y el titular. Un dibujo, dos pesos, según dónde se mire.
 */

/** Ancho dividido por alto, sacado del `viewBox` del dibujo (535 x 1112). */
const PROPORCION = 535 / 1112

/**
 * El trazo del nazareno. Vive aquí y en ningún otro sitio: `logo.prueba.mjs`
 * comprueba que nadie se lo copie por su cuenta, porque el día del cambio la
 * copia se queda con el dibujo viejo y no se nota hasta verlo impreso.
 *
 * El original está guardado en `docs/marca/`.
 */
const NAZARENO = 'M 229 367 L 228 373 L 232 378 L 242 382 L 248 382 L 250 380 L 250 370 L 245 366 L 232 365 Z M 439 87 L 432 88 L 227 309 L 212 326 L 197 354 L 189 379 L 188 388 L 188 456 L 186 475 L 170 558 L 173 567 L 177 569 L 188 568 L 190 570 L 186 597 L 181 603 L 133 637 L 128 643 L 123 655 L 123 670 L 130 684 L 140 692 L 147 695 L 164 696 L 166 698 L 149 782 L 146 807 L 141 827 L 141 836 L 138 844 L 130 891 L 128 894 L 127 911 L 131 916 L 138 920 L 138 923 L 132 927 L 112 927 L 93 930 L 80 937 L 74 943 L 67 956 L 69 963 L 75 967 L 172 996 L 185 996 L 192 988 L 199 961 L 199 955 L 202 949 L 202 943 L 205 940 L 244 946 L 273 948 L 313 945 L 359 935 L 361 937 L 359 943 L 351 951 L 340 957 L 333 965 L 329 976 L 328 993 L 335 999 L 367 999 L 385 996 L 401 986 L 439 953 L 452 938 L 449 929 L 433 905 L 434 899 L 441 895 L 444 891 L 444 881 L 417 839 L 401 807 L 391 779 L 383 749 L 377 703 L 369 587 L 364 555 L 367 551 L 382 551 L 387 546 L 388 539 L 367 474 L 338 407 L 330 384 L 335 365 L 445 101 L 445 91 Z M 186 937 L 181 952 L 178 970 L 173 977 L 109 959 L 93 952 L 93 950 L 99 946 L 123 945 L 143 941 L 153 935 L 161 927 L 174 932 L 183 933 Z M 416 911 L 429 930 L 430 936 L 383 977 L 377 980 L 368 981 L 351 980 L 349 976 L 364 964 L 374 953 L 380 938 L 381 928 L 412 911 Z M 162 642 L 178 664 L 174 669 L 162 677 L 152 677 L 144 671 L 141 666 L 141 659 L 150 648 L 158 642 Z M 224 549 L 225 553 L 221 563 L 215 573 L 210 575 L 209 569 L 212 557 L 221 549 Z M 286 492 L 296 494 L 305 499 L 343 539 L 351 592 L 359 711 L 367 762 L 375 791 L 386 819 L 405 856 L 420 879 L 421 884 L 417 888 L 383 906 L 348 919 L 308 927 L 264 929 L 222 924 L 198 919 L 152 905 L 147 901 L 187 688 L 191 686 L 200 697 L 205 699 L 214 696 L 253 664 L 279 639 L 294 619 L 308 591 L 315 565 L 313 557 L 309 555 L 302 555 L 298 559 L 287 592 L 270 620 L 242 648 L 211 674 L 205 671 L 184 639 L 179 628 L 211 604 L 229 586 L 242 562 L 250 527 L 256 511 L 263 502 L 273 494 Z M 401 152 L 401 159 L 322 346 L 312 377 L 314 399 L 348 478 L 364 525 L 359 527 L 321 488 L 311 481 L 296 475 L 279 474 L 266 477 L 252 486 L 220 525 L 202 539 L 195 541 L 193 536 L 202 493 L 207 452 L 207 387 L 213 365 L 223 344 L 386 165 L 399 152 Z'

export function LogoMark({
  size = 34,
  claro = false,
}: {
  size?: number
  /** Sobre fondo oscuro: el trazo pasa a marfil. Ver arriba. */
  claro?: boolean
}) {
  /* El alto manda y el ancho lo pone la proporción. Nunca los dos a la vez. */
  const alto = size
  const ancho = Math.round(size * PROPORCION)
  return (
    <span
      className={`logo-mark${claro ? ' logo-mark--claro' : ''}`}
      style={{ width: ancho, height: alto }}
    >
      <svg
        viewBox="0 0 535 1112"
        width={ancho}
        height={alto}
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d={NAZARENO} fillRule="evenodd" />
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
