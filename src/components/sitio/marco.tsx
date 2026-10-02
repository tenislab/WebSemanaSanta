import { BotonEntrar } from './piezas'
import IconoRed from '../IconoRed'
import { type WebPublica, urlSegura } from '../../lib/webPublica'
import { useEffect, useState } from 'react'
import { useQuieto } from '../../lib/imprimir'

export interface EnlaceMenu {
  ancla: string
  texto: string
  hijos?: { ancla: string; texto: string }[]
}

/**
 * EL MARCO DE LA WEB: LA CABECERA, EL MENÚ Y EL PIE.
 *
 * Lo que rodea al contenido y se repite en todas las páginas. Se agrupa igual
 * que en el editor, donde es una sola pestaña («Cabecera y pie»).
 */

/**
 * Entrada del menú con submenú. Se abre al pasar por encima en escritorio y al
 * pulsarla con el dedo; el desplegable es un <details> para que funcione con
 * teclado sin inventar nada.
 */
export function MenuDesplegable({
  enlace,
  interactivo,
  enPantalla,
}: {
  enlace: EnlaceMenu
  interactivo: boolean
  enPantalla: string
}) {
  // Además del :hover, se abre al pulsarlo: en una tableta táctil no hay ratón
  // que pasar por encima y el submenú era inalcanzable.
  const [abierto, setAbierto] = useState(false)
  const aqui = enlace.hijos?.some((h) => h.ancla === enPantalla) ?? false
  return (
    <div
      className={`sitio__menu-grupo${aqui ? ' sitio__menu-a--aqui' : ''}${abierto ? ' sitio__menu-grupo--abierto' : ''}`}
      onMouseLeave={() => setAbierto(false)}
    >
      <button
        type="button"
        className="sitio__menu-grupo-btn"
        onClick={(e) => { e.stopPropagation(); setAbierto((v) => !v) }}
        aria-expanded={abierto}
      >
        {enlace.texto}
        <span aria-hidden="true">▾</span>
      </button>
      <div className="sitio__menu-sub">
        {enlace.hijos?.map((h) => (
          <a
            key={h.ancla}
            href={interactivo ? `#${h.ancla}` : undefined}
            className={enPantalla === h.ancla ? 'sitio__menu-a--aqui' : undefined}
          >
            {h.texto}
          </a>
        ))}
      </div>
    </div>
  )
}

/**
 * LAS FOTOS DE FONDO DE LA PORTADA, PASANDO UNA TRAS OTRA.
 *
 * Ya se alternaban, pero de GOLPE: el fondo era un `backgroundImage` en la
 * propia sección y cambiarlo es un corte seco. Detrás del nombre de la
 * hermandad, un corte cada cinco segundos es un parpadeo, no un paso.
 *
 * Ahora cada foto es una capa propia y lo que cambia es su opacidad, así que
 * se cruzan. Y están TODAS en el árbol desde el principio, que es lo que hace
 * que el paso no se vea en blanco: con una sola capa que cambia de dirección,
 * la primera vuelta pide la imagen cuando ya le toca enseñarla.
 *
 * SI EL VISITANTE PIDE QUIETO, SE QUEDA QUIETO. Una foto que se mueve detrás de
 * un texto es exactamente lo que marea a quien lleva `prefers-reduced-motion`
 * puesto, y ese ajuste no se pone por capricho. Entonces se ve la primera y no
 * pasa nada más: no se cruza y tampoco se cambia a saltos, porque quitar la
 * transición y dejar el temporizador es el corte seco de antes con otro nombre.
 */
export function HeroFondo({ web, titulo, interactivo }: { web: WebPublica; titulo: string; interactivo: boolean }) {
  const fotos = web.heroFotos
  const [i, setI] = useState(0)
  const quieto = useQuieto()
  useEffect(() => {
    if (fotos.length < 2 || quieto) return
    const t = setInterval(() => setI((n) => (n + 1) % fotos.length), 5000)
    return () => clearInterval(t)
  }, [fotos.length, quieto])
  /*
   * El índice se recorta al número de fotos. Si la hermandad quita fotos
   * mientras alguien tiene la portada abierta —sucede: el editor guarda y la
   * vista previa se entera—, `i` se queda apuntando a una que ya no está y la
   * cabecera se queda sin fondo hasta la siguiente vuelta.
   */
  const puesta = fotos.length ? i % fotos.length : 0
  const fondo = fotos[puesta]

  return (
    <section
      className={`sitio__hero sitio__hero--${web.heroAltura}${fondo ? '' : ' sitio__hero--sinfoto'}`}
    >
      {fotos.map((f, n) => (
        <div
          key={n}
          className={`sitio__hero-foto${n === puesta ? ' sitio__hero-foto--puesta' : ''}`}
          style={{ backgroundImage: `url(${f})` }}
          /* Decorativa: el nombre de la hermandad lo dice el `h1` de al lado,
             así que un lector de pantalla no tiene nada que hacer aquí. */
          aria-hidden="true"
        />
      ))}
      <div className="sitio__hero-overlay" style={fondo ? { background: `rgba(15,8,10,${web.heroOverlay / 100})` } : undefined} />
      <div className="sitio__hero-inner">
        <h1>{titulo}</h1>
        {web.lema && <p className="sitio__lema">{web.lema}</p>}
        <BotonEntrar interactivo={interactivo} clase="sitio-btn sitio-btn--hero">{web.heroTextoBoton || 'Portal del hermano'} →</BotonEntrar>
      </div>
    </section>
  )
}

export function Redes({ web, interactivo }: { web: WebPublica; interactivo: boolean }) {
  if (web.redes.length === 0) return null
  return (
    <div className="sitio__redes">
      {web.redes
        .map((r) => ({ ...r, href: urlSegura(r.url) }))
        .filter((r) => r.href)
        .map((r) => (
          // En la vista previa no navegan: pulsar una red desde el panel se
          // llevaba al secretario fuera de la aplicación.
          // EL LOGOTIPO, no el nombre escrito.
          //
          // El pie de la web enseñaba «Instagram Facebook X» en texto, y el
          // propio panel promete que «los iconos aparecen en el pie de la
          // web». Además, una fila de nombres en un pie no se lee como lo que
          // es: nadie busca la palabra «Instagram», se busca su marca.
          // El nombre sigue ahí para los lectores de pantalla.
          <a
            key={r.id}
            href={interactivo ? r.href : undefined}
            {...(interactivo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="sitio__red"
            title={r.tipo}
          >
            <IconoRed red={r.tipo} tam={20} />
            <span className="sr-only">{r.tipo}</span>
          </a>
        ))}
    </div>
  )
}

/**
 * Pie de la web: columnas de enlaces a medida, datos de contacto, redes y el
 * aviso legal. Antes era una sola línea de texto; ahora cada hermandad monta el
 * suyo. Todo lo que quede vacío no se pinta: un pie con títulos huérfanos da
 * peor impresión que un pie escueto.
 */
export function PieSitio({
  web,
  titulo,
  interactivo,
  activo,
}: {
  web: WebPublica
  titulo: string
  /** En la vista previa del panel los enlaces no navegan. */
  interactivo: boolean
  /** Se está editando el pie en el panel: se marca en la vista previa. */
  activo?: boolean
}) {
  // Lo que se publica es lo que se ha escrito en la pestaña de Contacto de la
  // web, y nada más: Configuración es interna (ver `contactoPublico.ts`).
  const dir = web.direccion
  const tel = web.telefono
  const email = web.email

  // Los enlaces pasan por el mismo filtro que el resto de la web: sin URL
  // válida no se pintan, y una columna que se queda sin enlaces desaparece.
  const columnas = web.pie.columnas
    .map((c) => ({
      ...c,
      enlaces: c.enlaces
        .map((e) => ({ ...e, href: urlSegura(e.url) }))
        .filter((e) => e.href && e.texto.trim()),
    }))
    .filter((c) => c.enlaces.length > 0)

  const hayContacto = web.pie.mostrarContacto && Boolean(dir || tel || email)

  return (
    <footer data-seccion="pie" className={`sitio__foot${activo ? ' sitio__marco--activo' : ''}`}>
      {(columnas.length > 0 || hayContacto) && (
        <div className="sitio__foot-cols">
          {columnas.map((c) => (
            <div className="sitio__foot-col" key={c.id}>
              {c.titulo.trim() && <h4>{c.titulo}</h4>}
              {c.enlaces.map((e) => (
                <a
                  key={e.id}
                  href={interactivo ? e.href : undefined}
                  {...(interactivo && /^https?:/i.test(e.href ?? '') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {e.texto}
                </a>
              ))}
            </div>
          ))}
          {hayContacto && (
            <div className="sitio__foot-col">
              <h4>Contacto</h4>
              {dir && <span>{dir}</span>}
              {tel && <a href={interactivo ? `tel:${tel.replace(/\s+/g, '')}` : undefined}>{tel}</a>}
              {email && <a href={interactivo ? `mailto:${email}` : undefined}>{email}</a>}
            </div>
          )}
        </div>
      )}
      <div className="sitio__foot-barra">
        <span>{web.textoPie || `© ${titulo}`}</span>
        <div className="sitio__foot-right">
          {web.pie.mostrarRedes && <Redes web={web} interactivo={interactivo} />}
          <BotonEntrar interactivo={interactivo} clase="sitio-btn sitio-btn--sm">Área del hermano</BotonEntrar>
        </div>
      </div>
      {web.pie.textoLegal.trim() && <p className="sitio__foot-legal">{web.pie.textoLegal}</p>}
    </footer>
  )
}
