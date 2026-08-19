import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PAREJAS_TIPOGRAFICAS, SECCIONES_INFO, TIPOGRAFIAS, contenidoVacio, marcaDeAgua, nombreSeccion, noticiasPublicadas, slugNoticia, slugTitular, titularConFicha, urlMapaIncrustado, urlSegura, type AlbumGaleria, type ContenidoRico, type CultoWeb, type Noticia, type TipoSeccion, type Titular, type WebPublica } from '../lib/webPublica'
import type { HermandadSettings } from '../lib/hermandadSettings'
import { LogoMark } from './Logo'
import { formatDate } from '../lib/format'

/**
 * A dónde puede saltar la vista previa: una sección del cuerpo, o el marco de
 * la web (la barra de arriba y el pie), que no son secciones pero también se
 * editan.
 */
export type FocoPreview = TipoSeccion | 'cabecera' | 'pie'

/**
 * Render de la web pública a partir de un objeto WebPublica. Lo usan tanto la
 * página pública (/w/:slug) como la vista previa del panel (en vivo, sin
 * iframe). Con `interactivo=false` los botones no navegan (para la preview).
 */
export default function SitioContenido({
  web,
  hermandad,
  interactivo = true,
  seccionActiva,
  cultosDelCalendario = [],
}: {
  web: WebPublica
  hermandad: HermandadSettings
  interactivo?: boolean
  /**
   * Los próximos cultos sacados del módulo de Eventos. Se pasan de fuera a
   * propósito: este componente pinta lo que le dan y no lee datos por su
   * cuenta, así sirve igual para la web pública y para la vista previa.
   */
  cultosDelCalendario?: CultoWeb[]
  /** Sección que se está editando: se resalta y se trae a la vista (solo en la vista previa). */
  seccionActiva?: FocoPreview
}) {
  const raiz = useRef<HTMLDivElement>(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  /** Ancla de la sección que se está viendo, para resaltarla en el menú. */
  const [enPantalla, setEnPantalla] = useState<string>('')

  // En la vista previa, al cambiar de pestaña en el editor se salta a esa
  // sección: si no, editabas «Cultos» y la vista previa seguía en la Historia.
  useEffect(() => {
    if (interactivo || !seccionActiva || !raiz.current) return
    const destino = raiz.current.querySelector(`[data-seccion="${seccionActiva}"]`)
    destino?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [seccionActiva, interactivo])

  // Con el menú abierto: Escape lo cierra y la página de detrás no se mueve.
  useEffect(() => {
    if (!menuAbierto) return
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuAbierto(false)
    }
    document.addEventListener('keydown', tecla)
    // En la vista previa no se toca el scroll del panel: el menú vive dentro
    // del marco del dispositivo, no ocupa la pantalla del que edita.
    const antes = interactivo ? document.body.style.overflow : ''
    if (interactivo) document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      if (interactivo) document.body.style.overflow = antes
    }
  }, [menuAbierto, interactivo])

  /**
   * Qué sección se está viendo, para marcarla en el menú. Con
   * IntersectionObserver: nada de escuchar el scroll y recalcular posiciones
   * en cada píxel.
   */
  useEffect(() => {
    if (!interactivo || !raiz.current) return
    const secciones = raiz.current.querySelectorAll('section[id]')
    if (secciones.length === 0) return
    const visibles = new Set<string>()
    const obs = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) visibles.add(e.target.id)
          else visibles.delete(e.target.id)
        })
        // La primera en orden de documento de las que se ven: al bajar, manda
        // la de arriba, que es la que el visitante está leyendo.
        const primera = [...secciones].find((s) => visibles.has(s.id))
        setEnPantalla(primera?.id ?? '')
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )
    secciones.forEach((s) => obs.observe(s))
    return () => obs.disconnect()
  }, [interactivo, web.secciones, web.paginas])

  const titulo = web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
  const color = web.colorPrimario || hermandad.colorPrimario || '#6A1A23'
  const color2 = web.colorSecundario || '#C5A059'
  // La pareja manda; `tipografia` se conserva para las webs de antes, que no
  // tenían pareja elegida.
  const pareja = PAREJAS_TIPOGRAFICAS.find((p) => p.id === web.pareja)
  const fuente = pareja?.texto ?? TIPOGRAFIAS.find((t) => t.id === web.tipografia)?.css ?? TIPOGRAFIAS[0].css
  const fuenteTitulos = pareja?.titulos ?? fuente
  const radio = { recto: '0px', suave: '10px', redondo: '20px' }[web.redondeo] ?? '10px'
  const aire = { compacta: '0.72', normal: '1', amplia: '1.35' }[web.densidad] ?? '1'
  const logo = web.logoDataUrl || hermandad.logoDataUrl
  const seccionesVisibles = web.secciones.filter((s) => s.visible)
  // Los del calendario van primero: son los que están al caer.
  const cultosVisibles = web.cultosDelCalendario ? [...cultosDelCalendario, ...web.cultos] : web.cultos

  /**
   * ¿Tiene esta sección algo que enseñar? El menú solo enlaza secciones con
   * contenido real: una visible pero vacía (galería sin fotos, contacto sin
   * datos…) no pinta ancla muerta ni título huérfano.
   */
  function tieneContenido(tipo: TipoSeccion): boolean {
    if (tipo === 'historia') return !contenidoVacio(web.historia)
    if (tipo === 'hazte') {
      const h = web.hazte
      return Boolean(h.entradilla.trim() || h.requisitos.length || h.pasos.length || h.cuota.trim())
    }
    if (tipo === 'estacion') {
      const e = web.estacion
      return Boolean(e.dia.trim() || e.horaSalida.trim() || e.itinerario.length)
    }
    if (tipo === 'junta') return web.junta.some((m) => m.cargo.trim() || m.nombre.trim())
    if (tipo === 'titulares') return web.titulares.length > 0
    if (tipo === 'cultos') return cultosVisibles.length > 0
    if (tipo === 'galeria') return web.albumes.some((a) => a.fotos.length > 0)
    if (tipo === 'actualidad') return web.noticias.some((n) => n.publicada)
    if (tipo === 'paginas') return web.paginas.filter((p) => p.enMenu !== false).length > 0
    if (tipo === 'boletines') return web.boletines.length > 0
    if (tipo === 'contacto')
      return Boolean(
        web.direccion || hermandad.direccion || web.telefono || hermandad.telefono
        || web.email || hermandad.email || web.mapaUrl || web.horarios.length > 0,
      )
    return true
  }

  /**
   * Los enlaces del menú. Las páginas cuelgan de un submenú («La Hermandad»)
   * en vez de soltar una a una en la barra: con cuatro páginas, el menú se
   * comía la cabecera entera.
   */
  const enlacesMenu: EnlaceMenu[] = seccionesVisibles
    .filter((s) => tieneContenido(s.tipo))
    .flatMap((s): EnlaceMenu[] => {
      if (s.tipo !== 'paginas') return [{ ancla: s.tipo, texto: nombreSeccion(s) }]
      const pags = web.paginas.filter((p) => p.enMenu !== false)
      const hijos = pags.map((p) => ({ ancla: `pagina-${p.id}`, texto: p.titulo || 'Página' }))
      // Con una sola página no hace falta desplegable: es un enlace y ya.
      if (hijos.length <= 1) return hijos
      return [{ ancla: hijos[0].ancla, texto: nombreSeccion(s), hijos }]
    })

  return (
    <div
      ref={raiz}
      className={`sitio${web.cabecera.fija ? ' sitio--navfija' : ''}`}
      data-plantilla={web.plantilla}
      data-tema={web.tema}
      style={{
        ['--sitio-color' as string]: color,
        ['--sitio-color2' as string]: color2,
        ['--sitio-fuente' as string]: fuente,
        ['--sitio-fuente-titulos' as string]: fuenteTitulos,
        ['--sitio-radio' as string]: radio,
        ['--sitio-aire' as string]: aire,
      }}
    >
      {/* Con teclado había que pasar por todo el menú en cada visita. */}
      {interactivo && (
        <a className="sitio__saltar" href="#sitio-contenido">Saltar al contenido</a>
      )}
      <header
        data-seccion="cabecera"
        className={`sitio__nav${web.cabecera.fija ? ' sitio__nav--fija' : ''}${seccionActiva === 'cabecera' ? ' sitio__marco--activo' : ''}`}
      >
        <div className="sitio__brand">
          {web.cabecera.mostrarLogo && (logo ? <img src={logo} alt="" className="sitio__logo" /> : <LogoMark size={30} />)}
          {(web.cabecera.mostrarNombre || web.cabecera.mostrarLema) && (
            <span className="sitio__brand-texto">
              {web.cabecera.mostrarNombre && <span>{titulo}</span>}
              {web.cabecera.mostrarLema && web.lema && <small>{web.lema}</small>}
            </span>
          )}
        </div>
        {/* Con ocho secciones, en un móvil el menú suelto ocupaba tres
            renglones antes de que empezara la web. */}
        <button
          type="button"
          className={`sitio__hamburguesa${menuAbierto ? ' sitio__hamburguesa--abierta' : ''}`}
          onClick={() => setMenuAbierto((v) => !v)}
          aria-expanded={menuAbierto}
          aria-controls="sitio-menu"
          aria-label={menuAbierto ? 'Cerrar el menú' : 'Abrir el menú'}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <nav
          id="sitio-menu"
          className={`sitio__menu${menuAbierto ? ' sitio__menu--abierto' : ''}`}
          onClick={() => setMenuAbierto(false)}
        >
          {enlacesMenu.map((e) =>
            e.hijos ? (
              <MenuDesplegable key={e.ancla} enlace={e} interactivo={interactivo} enPantalla={enPantalla} />
            ) : (
              <a
                key={e.ancla}
                href={interactivo ? `#${e.ancla}` : undefined}
                className={enPantalla === e.ancla ? 'sitio__menu-a--aqui' : undefined}
                aria-current={enPantalla === e.ancla ? 'true' : undefined}
              >
                {e.texto}
              </a>
            ),
          )}
          {web.cabecera.textoBoton.trim() && (
            <BotonEntrar interactivo={interactivo} clase="sitio-btn sitio-btn--entrar">{web.cabecera.textoBoton}</BotonEntrar>
          )}
        </nav>
      </header>

      <HeroFondo web={web} titulo={titulo} interactivo={interactivo} />

      <main className="sitio__main" id="sitio-contenido" tabIndex={-1}>
        {seccionesVisibles.map((s) => (
          <Seccion
            key={s.tipo}
            tipo={s.tipo}
            nombre={s.nombre}
            activa={s.tipo === seccionActiva}
            interactivo={interactivo}
            cultos={cultosVisibles}
            web={web}
            hermandad={hermandad}
          />
        ))}
      </main>

      {interactivo && <VolverArriba />}

      <PieSitio
        web={web}
        hermandad={hermandad}
        titulo={titulo}
        interactivo={interactivo}
        activo={seccionActiva === 'pie'}
      />
    </div>
  )
}

interface EnlaceMenu {
  ancla: string
  texto: string
  hijos?: { ancla: string; texto: string }[]
}

/**
 * Entrada del menú con submenú. Se abre al pasar por encima en escritorio y al
 * pulsarla con el dedo; el desplegable es un <details> para que funcione con
 * teclado sin inventar nada.
 */
function MenuDesplegable({
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
 * Botón que lleva al área del hermano. Vive en el módulo, NO dentro de
 * SitioContenido: definido allí se recreaba en cada render y React desmontaba
 * y volvía a montar el botón entero en cada tecla del editor.
 */
function BotonEntrar({ interactivo, clase, children }: { interactivo: boolean; clase: string; children: ReactNode }) {
  return interactivo
    ? <Link to="/hermano" className={clase}>{children}</Link>
    : <span className={clase}>{children}</span>
}

/**
 * Botón para volver arriba. Aparece al bajar un par de pantallas: una web de
 * hermandad con historia, titulares, cultos y galería es larguísima en el
 * móvil, y había que arrastrar hasta arriba para llegar al menú.
 */
function VolverArriba() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    function alDesplazar() { setVisible(window.scrollY > 900) }
    alDesplazar()
    window.addEventListener('scroll', alDesplazar, { passive: true })
    return () => window.removeEventListener('scroll', alDesplazar)
  }, [])
  return (
    <button
      type="button"
      className={`sitio__arriba${visible ? ' sitio__arriba--visible' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Volver arriba"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      ↑
    </button>
  )
}

function HeroFondo({ web, titulo, interactivo }: { web: WebPublica; titulo: string; interactivo: boolean }) {
  const fotos = web.heroFotos
  const [i, setI] = useState(0)
  useEffect(() => {
    if (fotos.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % fotos.length), 5000)
    return () => clearInterval(t)
  }, [fotos.length])
  const fondo = fotos[i] ?? fotos[0]

  return (
    <section
      className={`sitio__hero sitio__hero--${web.heroAltura}${fondo ? '' : ' sitio__hero--sinfoto'}`}
      style={fondo ? { backgroundImage: `url(${fondo})` } : undefined}
    >
      <div className="sitio__hero-overlay" style={fondo ? { background: `rgba(15,8,10,${web.heroOverlay / 100})` } : undefined} />
      <div className="sitio__hero-inner">
        <h1>{titulo}</h1>
        {web.lema && <p className="sitio__lema">{web.lema}</p>}
        <BotonEntrar interactivo={interactivo} clase="sitio-btn sitio-btn--hero">{web.heroTextoBoton || 'Portal del hermano'} →</BotonEntrar>
      </div>
    </section>
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
  hermandad,
  titulo,
  interactivo,
  activo,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  titulo: string
  /** En la vista previa del panel los enlaces no navegan. */
  interactivo: boolean
  /** Se está editando el pie en el panel: se marca en la vista previa. */
  activo?: boolean
}) {
  const dir = web.direccion || hermandad.direccion
  const tel = web.telefono || hermandad.telefono
  const email = web.email || hermandad.email

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

/**
 * La galería, por álbumes, con visor a pantalla completa. Antes era un montón
 * único de fotos sin contexto: con doce salidas seguidas no había forma de
 * saber qué era cada cosa.
 */
export function Galeria({
  albumes,
  interactivo,
  marca,
  aviso,
}: {
  albumes: AlbumGaleria[]
  interactivo: boolean
  /** Texto de la marca de agua; vacío = sin marca. */
  marca: string
  /** Aviso de derechos bajo la galería. */
  aviso: string
}) {
  // Todas las fotos en una sola lista para poder pasar de una a la siguiente
  // aunque estén en álbumes distintos.
  const todas = albumes.flatMap((a) => a.fotos.map((f) => ({ ...f, album: a.titulo })))
  const [abierta, setAbierta] = useState<number | null>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)

  const hayVisor = interactivo && abierta !== null
  useEffect(() => {
    if (!hayVisor) return
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierta(null)
      if (e.key === 'ArrowRight') setAbierta((i) => (i === null ? null : (i + 1) % todas.length))
      if (e.key === 'ArrowLeft') setAbierta((i) => (i === null ? null : (i - 1 + todas.length) % todas.length))
    }
    window.addEventListener('keydown', tecla)
    // El foco entra en el visor: si no, al abrirlo con el teclado seguías
    // tabulando por la página de detrás sin ver dónde estabas.
    cerrarRef.current?.focus()
    // Con el visor abierto, el fondo no debe desplazarse detrás.
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = previo
    }
  }, [hayVisor, todas.length])

  const foto = abierta === null ? null : todas[abierta]

  return (
    <>
      {albumes.map((a) => (
        <div className="sitio__album" key={a.id}>
          {(a.titulo.trim() || a.fecha.trim() || a.descripcion.trim()) && (
            <div className="sitio__album-head">
              {a.titulo.trim() && <h3>{a.titulo}</h3>}
              {a.fecha.trim() && <span className="sitio__album-fecha">{a.fecha}</span>}
              {a.descripcion.trim() && <p>{a.descripcion}</p>}
            </div>
          )}
          <div className="sitio__galeria">
            {a.fotos.map((f) => {
              const i = todas.findIndex((t) => t.id === f.id)
              return (
                <figure className="sitio__foto" key={f.id}>
                  {interactivo ? (
                    <button type="button" className="sitio__foto-boton" onClick={() => setAbierta(i)}>
                      <FotoConMarca src={f.fotoDataUrl} alt={f.pie || a.titulo} marca={marca} />
                      <span className="sitio__foto-lupa" aria-hidden="true">⤢</span>
                    </button>
                  ) : (
                    <FotoConMarca src={f.fotoDataUrl} alt={f.pie || a.titulo} marca={marca} />
                  )}
                  {(f.pie.trim() || f.autor?.trim()) && (
                    <figcaption>
                      {f.pie}
                      {f.autor?.trim() && <span className="sitio__credito">Foto: {f.autor}</span>}
                    </figcaption>
                  )}
                </figure>
              )
            })}
          </div>
        </div>
      ))}
      <AvisoFotos texto={aviso} />

      {foto && (
        <div className="sitio__visor" role="dialog" aria-modal="true" aria-label="Foto ampliada">
          {/* El fondo cierra: es lo que todo el mundo intenta primero. */}
          <button type="button" className="sitio__visor-fondo" aria-label="Cerrar" onClick={() => setAbierta(null)} />
          <button ref={cerrarRef} type="button" className="sitio__visor-cerrar" aria-label="Cerrar" onClick={() => setAbierta(null)}>✕</button>
          {todas.length > 1 && (
            <button
              type="button"
              className="sitio__visor-flecha sitio__visor-flecha--izq"
              aria-label="Foto anterior"
              onClick={() => setAbierta((i) => (i === null ? null : (i - 1 + todas.length) % todas.length))}
            >
              ‹
            </button>
          )}
          <figure className="sitio__visor-figura">
            {/* La marca va sobre todo aquí: es la foto grande, la que se guarda. */}
            <FotoConMarca src={foto.fotoDataUrl} alt={foto.pie || foto.album} marca={marca} />
            <figcaption>
              {foto.pie || foto.album}
              {foto.autor?.trim() && <span className="sitio__credito">Foto: {foto.autor}</span>}
              {todas.length > 1 && <span className="sitio__visor-n">{(abierta ?? 0) + 1} / {todas.length}</span>}
            </figcaption>
          </figure>
          {todas.length > 1 && (
            <button
              type="button"
              className="sitio__visor-flecha sitio__visor-flecha--der"
              aria-label="Foto siguiente"
              onClick={() => setAbierta((i) => (i === null ? null : (i + 1) % todas.length))}
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  )
}

function Redes({ web, interactivo }: { web: WebPublica; interactivo: boolean }) {
  if (web.redes.length === 0) return null
  return (
    <div className="sitio__redes">
      {web.redes
        .map((r) => ({ ...r, href: urlSegura(r.url) }))
        .filter((r) => r.href)
        .map((r) => (
          // En la vista previa no navegan: pulsar una red desde el panel se
          // llevaba al secretario fuera de la aplicación.
          <a
            key={r.id}
            href={interactivo ? r.href : undefined}
            {...(interactivo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="sitio__red"
          >
            {r.tipo}
          </a>
        ))}
    </div>
  )
}

/**
 * Una noticia en el listado. Con enlace propio: es lo que se pega en redes, y
 * hasta ahora la única forma de compartir una noticia era mandar la web entera.
 */
/**
 * Un titular a lo ancho: foto grande a un lado y su texto al otro, alternando
 * el lado en cada uno. Antes eran tres líneas centradas en una rejilla de
 * tarjetas, y es la sección con más devoción detrás de toda la web.
 */
export function BloqueTitular({
  titular: t,
  vuelto,
  slugWeb,
  marca,
  interactivo,
}: {
  titular: Titular
  /** La foto a la derecha en vez de a la izquierda. */
  vuelto?: boolean
  slugWeb: string
  /** Texto de la marca de agua; vacío = sin marca. */
  marca: string
  interactivo: boolean
}) {
  const parrafos = (t.parrafos ?? []).filter((p) => p.texto.trim() || p.subtitulo.trim())
  const conFicha = titularConFicha(t)
  const enlace = `/w/${slugWeb}/t/${slugTitular(t)}`
  // En la portada se asoma el arranque de su historia; el resto vive en la
  // ficha, para que la sección no se convierta en un muro de texto.
  const asomo = parrafos.find((p) => p.texto.trim())?.texto ?? ''
  return (
    <article className={`sitio__titular${vuelto ? ' sitio__titular--vuelto' : ''}`}>
      {t.fotoDataUrl && (
        <figure className="sitio__titular-foto">
          <FotoConMarca src={t.fotoDataUrl} alt={t.alt?.trim() || t.nombre} marca={marca} />
          {t.credito?.trim() && <figcaption>Foto: {t.credito}</figcaption>}
        </figure>
      )}
      <div className="sitio__titular-texto">
        <h3>{t.nombre}</h3>
        {t.autoria?.trim() && <p className="sitio__autoria">{t.autoria}</p>}
        {t.descripcion.trim() && <p className="sitio__entradilla">{t.descripcion}</p>}
        {asomo && <p className="sitio__texto">{recorta(asomo, 300)}</p>}
        {conFicha && (
          <a className="sitio__seguir" href={interactivo ? enlace : undefined}>
            Conoce su historia →
          </a>
        )}
      </div>
    </article>
  )
}

/**
 * Una foto con la marca de agua encima, si la hermandad la ha pedido. Va en un
 * `span` y no en un `div` porque también se usa dentro de botones.
 */
export function FotoConMarca({
  src,
  alt,
  marca,
  clase,
}: {
  src: string
  alt: string
  marca: string
  clase?: string
}) {
  return (
    <span className="sitio__conmarca">
      <img src={src} alt={alt} loading="lazy" className={clase} />
      {marca && <span className="sitio__marca-agua" aria-hidden="true">{marca}</span>}
    </span>
  )
}

/** El aviso de derechos bajo las fotos, si la hermandad lo ha escrito. */
export function AvisoFotos({ texto }: { texto: string }) {
  if (!texto.trim()) return null
  return <p className="sitio__derechos">{texto}</p>
}

/** Corta por la última palabra entera antes del límite, sin partir a medias. */
function recorta(texto: string, max: number): string {
  const limpio = texto.trim()
  if (limpio.length <= max) return limpio
  const corte = limpio.slice(0, max)
  const espacio = corte.lastIndexOf(' ')
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[.,;:\s]+$/, '')}…`
}

export function TarjetaNoticia({
  noticia: n,
  interactivo,
  slugWeb,
  grande = false,
}: {
  noticia: Noticia
  interactivo: boolean
  slugWeb: string
  grande?: boolean
}) {
  const enlace = `/w/${slugWeb}/n/${slugNoticia(n)}`
  const tieneCuerpo = (n.parrafos ?? []).some((p) => p.texto.trim())
  return (
    <article className={`sitio__noticia${grande ? ' sitio__noticia--grande' : ''}`}>
      {n.fotoDataUrl && <img src={n.fotoDataUrl} alt="" loading="lazy" />}
      <div>
        <span className="sitio__noticia-fecha">{fechaBonita(n.fecha)}</span>
        <h3>
          {tieneCuerpo && interactivo ? <a href={enlace}>{n.titulo}</a> : n.titulo}
        </h3>
        <p>{n.resumen}</p>
        {tieneCuerpo && (
          <a className="sitio__seguir" href={interactivo ? enlace : undefined}>Seguir leyendo →</a>
        )}
      </div>
    </article>
  )
}

function fechaBonita(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : formatDate(d)
}

/** Bloque de contenido con formato (entradilla, párrafos con subtítulo y fotos). */
function Contenido({ c }: { c: ContenidoRico }) {
  return (
    <>
      {c.entradilla.trim() && <p className="sitio__entradilla">{c.entradilla}</p>}
      {c.fotos.length > 0 && (
        <div className="sitio__galeria">
          {c.fotos.map((f, i) => (
            <figure className="sitio__foto" key={i}><img src={f} alt="" /></figure>
          ))}
        </div>
      )}
      {c.parrafos
        .filter((p) => p.texto.trim() || p.subtitulo.trim())
        .map((p) => (
          <div className="sitio__parrafo" key={p.id}>
            {p.subtitulo.trim() && <h4>{p.subtitulo}</h4>}
            {p.texto.trim() && <p className="sitio__texto">{p.texto}</p>}
          </div>
        ))}
    </>
  )
}

function Seccion({
  tipo,
  nombre,
  activa,
  interactivo,
  cultos,
  web,
  hermandad,
}: {
  tipo: TipoSeccion
  /** Título a medida de la hermandad; si está vacío, el de fábrica. */
  nombre?: string
  /** Se está editando esta sección: se marca en la vista previa. */
  activa?: boolean
  /** En la vista previa del panel los enlaces no navegan. */
  interactivo: boolean
  /** Los del calendario ya mezclados con los escritos a mano. */
  cultos: CultoWeb[]
  web: WebPublica
  hermandad: HermandadSettings
}) {
  const titulo = (t: string) => nombre?.trim() || t
  // Se aplican a todas las secciones por igual: la marca para poder saltar a
  // ella desde el editor y el resaltado de «estás editando esto».
  const props = {
    'data-seccion': tipo,
    className: `sitio__seccion${activa ? ' sitio__seccion--activa' : ''}`,
  }

  if (tipo === 'historia') {
    if (contenidoVacio(web.historia)) return null
    return (
      <section id="historia" {...props}>
        <h2>{titulo(SECCIONES_INFO.historia.publico)}</h2>
        <Contenido c={web.historia} />
      </section>
    )
  }
  if (tipo === 'titulares') {
    if (web.titulares.length === 0) return null
    return (
      <section id="titulares" {...props}>
        <h2>{titulo(SECCIONES_INFO.titulares.publico)}</h2>
        <div className="sitio__titulares">
          {web.titulares.map((t, i) => (
            <BloqueTitular
              key={t.id}
              titular={t}
              // Alternos: la foto salta de un lado al otro en cada titular,
              // que es lo que rompe la columna centrada de siempre.
              vuelto={i % 2 === 1}
              slugWeb={web.slug}
              marca={marcaDeAgua(web, hermandad.nombreLegal ?? '')}
              interactivo={interactivo}
            />
          ))}
        </div>
        <AvisoFotos texto={web.avisoFotos} />
      </section>
    )
  }
  if (tipo === 'hazte') {
    const h = web.hazte
    if (!h.entradilla.trim() && h.requisitos.length === 0 && h.pasos.length === 0 && !h.cuota.trim()) return null
    return (
      <section id="hazte" {...props}>
        <h2>{titulo(SECCIONES_INFO.hazte.publico)}</h2>
        {h.entradilla.trim() && <p className="sitio__entradilla">{h.entradilla}</p>}
        <div className="sitio__hazte">
          {h.requisitos.length > 0 && (
            <div className="sitio__hazte-bloque">
              <h3>Qué hace falta</h3>
              <ul className="sitio__lista-marcada">
                {h.requisitos.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          {h.pasos.length > 0 && (
            <div className="sitio__hazte-bloque">
              <h3>Cómo se hace</h3>
              <ol className="sitio__pasos">
                {h.pasos.map((r, i) => <li key={i}>{r}</li>)}
              </ol>
            </div>
          )}
          {h.cuota.trim() && (
            <div className="sitio__hazte-bloque sitio__hazte-cuota">
              <h3>La cuota</h3>
              <p className="sitio__cuota-cifra">{h.cuota}</p>
              <p>Con ella se sostienen los cultos, la caridad y el patrimonio de la hermandad.</p>
            </div>
          )}
        </div>
        {h.textoBoton.trim() && (
          <p className="sitio__cta">
            {h.alAreaDelHermano ? (
              <BotonEntrar interactivo={interactivo} clase="sitio-btn">{h.textoBoton}</BotonEntrar>
            ) : (
              <a href={interactivo ? '#contacto' : undefined} className="sitio-btn">{h.textoBoton}</a>
            )}
          </p>
        )}
      </section>
    )
  }
  if (tipo === 'estacion') {
    const e = web.estacion
    if (!e.dia.trim() && !e.horaSalida.trim() && e.itinerario.length === 0) return null
    const datos = [
      e.horaSalida.trim() && { k: 'Salida', v: e.horaSalida },
      e.salidaDesde.trim() && { k: 'Desde', v: e.salidaDesde },
      e.horaEntrada.trim() && { k: 'Entrada', v: e.horaEntrada },
    ].filter(Boolean) as { k: string; v: string }[]
    return (
      <section id="estacion" {...props}>
        <h2>{titulo(SECCIONES_INFO.estacion.publico)}</h2>
        {(e.dia.trim() || e.anio.trim()) && (
          <p className="sitio__estacion-dia">
            {e.dia}{e.dia.trim() && e.anio.trim() ? ' · ' : ''}{e.anio}
          </p>
        )}
        {datos.length > 0 && (
          <dl className="sitio__estacion-datos">
            {datos.map((d) => (
              <div key={d.k}><dt>{d.k}</dt><dd>{d.v}</dd></div>
            ))}
          </dl>
        )}
        {e.itinerario.length > 0 && (
          <ol className="sitio__itinerario">
            {e.itinerario.map((par) => (
              <li key={par.id} className={par.destacada ? 'sitio__parada--hito' : undefined}>
                {par.hora.trim() && <span className="sitio__parada-hora">{par.hora}</span>}
                <span className="sitio__parada-lugar">{par.lugar}</span>
              </li>
            ))}
          </ol>
        )}
        {e.nota.trim() && <p className="sitio__estacion-nota">{e.nota}</p>}
      </section>
    )
  }
  if (tipo === 'junta') {
    const miembros = web.junta.filter((m) => m.cargo.trim() || m.nombre.trim())
    if (miembros.length === 0) return null
    return (
      <section id="junta" {...props}>
        <h2>{titulo(SECCIONES_INFO.junta.publico)}</h2>
        <ul className="sitio__junta">
          {miembros.map((m) => (
            <li key={m.id}>
              <span className="sitio__junta-cargo">{m.cargo}</span>
              <span className="sitio__junta-nombre">{m.nombre}</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }
  if (tipo === 'cultos') {
    if (cultos.length === 0) return null
    return (
      <section id="cultos" {...props}>
        <h2>{titulo(SECCIONES_INFO.cultos.publico)}</h2>
        <div className="sitio__cultos">
          {cultos.map((c) => (
            <article key={c.id} className="sitio__culto">
              {c.fotoDataUrl && <img className="sitio__culto-foto" src={c.fotoDataUrl} alt="" />}
              <h3>{c.titulo}</h3>
              {(c.fecha?.trim() || c.lugar?.trim()) && (
                <p className="sitio__culto-cuando">
                  {[c.fecha, c.lugar].filter((x) => x?.trim()).join(' · ')}
                </p>
              )}
              {c.detalle && <p>{c.detalle}</p>}
            </article>
          ))}
        </div>
      </section>
    )
  }
  if (tipo === 'galeria') {
    const albumes = web.albumes.filter((a) => a.fotos.length > 0)
    if (albumes.length === 0) return null
    return (
      <section id="galeria" {...props}>
        <h2>{titulo(SECCIONES_INFO.galeria.publico)}</h2>
        <Galeria
          albumes={albumes}
          interactivo={interactivo}
          marca={marcaDeAgua(web, hermandad.nombreLegal ?? '')}
          aviso={web.avisoFotos}
        />
      </section>
    )
  }
  if (tipo === 'actualidad') {
    const todas = noticiasPublicadas(web.noticias)
    if (todas.length === 0) return null
    // En la portada solo van las tres últimas: con quince noticias, la sección
    // se comía la web entera y había que bajar media pantalla para pasar de ella.
    const enPortada = todas.slice(0, 3)
    const [primera, ...resto] = enPortada
    const hayMas = todas.length > enPortada.length
    return (
      <section id="actualidad" {...props}>
        {/* En la web pública, sin la coletilla "(noticias)" del editor. */}
        <h2>{titulo('Actualidad')}</h2>
        <TarjetaNoticia noticia={primera} interactivo={interactivo} slugWeb={web.slug} grande />
        {resto.length > 0 && (
          <div className="sitio__noticias">
            {resto.map((n) => (
              <TarjetaNoticia key={n.id} noticia={n} interactivo={interactivo} slugWeb={web.slug} />
            ))}
          </div>
        )}
        {hayMas && (
          <p className="sitio__cta">
            <a
              href={interactivo ? `/w/${web.slug}/noticias` : undefined}
              className="sitio-btn sitio-btn--sm"
            >
              Ver todas las noticias ({todas.length})
            </a>
          </p>
        )}
      </section>
    )
  }
  if (tipo === 'paginas') {
    // Cada página del menú es su propia sección anclable (#pagina-<id>).
    const pags = web.paginas.filter((p) => p.enMenu !== false)
    if (pags.length === 0) return null
    return (
      <>
        {pags.map((p) => (
          <section id={`pagina-${p.id}`} key={p.id} {...props}>
            {/* El icono es una ayuda del editor del panel: en la web pública el título va limpio. */}
            {p.antetitulo && <span className="sitio__pagina-ante">{p.antetitulo}</span>}
            <h2>{p.titulo}</h2>
            {/* Mismo render que la Historia: un solo sitio que mantener. */}
            <Contenido c={{ entradilla: p.entradilla, parrafos: p.parrafos, fotos: p.fotos }} />
          </section>
        ))}
      </>
    )
  }
  if (tipo === 'boletines') {
    if (web.boletines.length === 0) return null
    return (
      <section id="boletines" {...props}>
        <h2>{titulo(SECCIONES_INFO.boletines.publico)}</h2>
        <div className="sitio__boletines">
          {web.boletines.map((bo) => {
            // Se puede haber subido el archivo o dado la dirección donde está.
            const destino = bo.pdfDataUrl || urlSegura(bo.pdfUrl)
            return (
              <article key={bo.id} className="sitio__boletin">
                <div className="sitio__boletin-portada">
                  {bo.portadaDataUrl
                    ? <img src={bo.portadaDataUrl} alt="" />
                    : <span className="sitio__boletin-sinportada" aria-hidden="true">PDF</span>}
                </div>
                <div className="sitio__boletin-datos">
                  {bo.fecha.trim() && <span className="sitio__boletin-fecha">{bo.fecha}</span>}
                  <h3>{bo.titulo}</h3>
                  {bo.subtitulo.trim() && <p>{bo.subtitulo}</p>}
                  {destino ? (
                    <a
                      href={interactivo ? destino : undefined}
                      {...(interactivo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      {...(interactivo && bo.pdfDataUrl ? { download: bo.pdfNombre ?? 'boletin.pdf' } : {})}
                      className="sitio-btn sitio-btn--sm"
                    >
                      Descargar PDF
                    </a>
                  ) : (
                    // Sin archivo ni dirección no se promete una descarga que no existe.
                    <span className="sitio__boletin-pendiente">Próximamente</span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    )
  }
  if (tipo === 'contacto') {
    const dir = web.direccion || hermandad.direccion
    const tel = web.telefono || hermandad.telefono
    const email = web.email || hermandad.email
    // Sin ningún dato de contacto, la sección no se pinta (nada de títulos vacíos).
    if (!dir && !tel && !email && !web.mapaUrl && web.horarios.length === 0) return null
    const mapa = web.mapaIncrustado ? urlMapaIncrustado(web.mapaUrl, dir) : null
    const enlaceMapa = urlSegura(web.mapaUrl)
    return (
      <section id="contacto" {...props}>
        <h2>{titulo(SECCIONES_INFO.contacto.publico)}</h2>
        {/* Sin mapa no se monta la rejilla: los datos ocupaban media columna
            y dejaban un hueco enorme al lado. */}
        <div className={mapa ? 'sitio__contacto-grid' : undefined}>
          <div>
            <ul className="sitio__contacto">
              {dir && <li>{dir}</li>}
              {tel && <li>Tel. <a href={interactivo ? `tel:${tel.replace(/\s+/g, '')}` : undefined}>{tel}</a></li>}
              {email && <li><a href={interactivo ? `mailto:${email}` : undefined}>{email}</a></li>}
            </ul>
            {web.horarios.length > 0 && (
              <div className="sitio__horario">
                <h3>Cuándo atendemos</h3>
                <ul>
                  {web.horarios.map((f) => (
                    <li key={f.id}>
                      <b>{f.dias}</b>
                      <span>{f.horas}</span>
                      {f.nota && <small>{f.nota}</small>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {enlaceMapa && (
              <a
                href={interactivo ? enlaceMapa : undefined}
                {...(interactivo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="sitio-btn sitio-btn--sm"
              >
                Cómo llegar
              </a>
            )}
          </div>
          {mapa && (
            <div className="sitio__mapa">
              {/* Sin clave de Google: el mapa se pide con la dirección tal cual. */}
              <iframe
                src={mapa}
                title="Dónde estamos"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </section>
    )
  }
  return null
}
