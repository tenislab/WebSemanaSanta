/**
 * EL MOTOR QUE PINTA LA WEB DE UNA HERMANDAD.
 *
 * ----------------------------------------------------------------------------
 * UN SOLO COMPONENTE PARA DOS SITIOS, Y DE AHÍ SALE TODO LO DEMÁS
 * ----------------------------------------------------------------------------
 *
 * Lo usan la web pública de verdad (`pages/SitioPublico.tsx`) y la VISTA PREVIA
 * del editor del panel, en vivo y sin `iframe`. Que sea el mismo es la razón de
 * que la vista previa no mienta nunca: no hay dos pinturas que mantener a la
 * par.
 *
 * Y de ahí la prop que hay que entender antes de tocar nada:
 *
 *   `interactivo` — `true` en la web DE VERDAD, donde los enlaces navegan;
 *   `false` en la VISTA PREVIA. Es fácil de invertir y ya se invirtió una vez:
 *   el botón «Descargar» de los documentos salió apagado para todos los
 *   visitantes y encendido solo en la vista previa, donde no hay nada que
 *   descargar. Si escribes `disabled={interactivo || …}`, está al revés.
 *
 * ----------------------------------------------------------------------------
 * NO LEE DATOS. SE LOS DAN
 * ----------------------------------------------------------------------------
 *
 * `web`, `hermandad` y `cultosDelCalendario` entran por props. Es deliberado:
 * así sirve igual para la web pública —donde los datos vienen de funciones de
 * la base, sin sesión— y para la vista previa, donde vienen del formulario que
 * alguien está escribiendo en ese momento.
 *
 * La excepción son las secciones cuyo contenido NO vive en `web` y llega por su
 * cuenta (el catálogo de la tienda, los documentos del archivo). Esas sí piden
 * lo suyo, y entonces el índice NO PUEDE SABER si hay algo que enseñar, así que
 * dice que sí: es la propia sección la que se calla si está vacía, y en la
 * vista previa dice QUÉ FALTA —si no, la hermandad enciende la sección, no ve
 * nada y cree que está rota cuando lo que pasa es que no ha marcado nada—.
 *
 * ----------------------------------------------------------------------------
 * LAS PIEZAS ESTÁN EN `sitio/`
 * ----------------------------------------------------------------------------
 *
 * Este fichero es el ÍNDICE: decide qué secciones hay, en qué orden y cuáles
 * están visibles. Cada sección la pinta su pieza (`sitio/portada.tsx`,
 * `sitio/Galeria.tsx`, `sitio/Documentos.tsx`, `sitio/marco.tsx`…), y algunas
 * se reexportan desde aquí porque `SitioPublico` las usa suelta para las
 * páginas de una noticia o un titular.
 *
 * `seccionActiva` solo sirve en la vista previa: al cambiar de pestaña en el
 * editor, la vista previa salta a esa sección. Sin eso, editabas «Cultos» y la
 * vista previa seguía en la Historia.
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import { PAREJAS_TIPOGRAFICAS, TIPOGRAFIAS, contenidoVacio, nombreSeccion, type CultoWeb, type TipoSeccion, type WebPublica } from '../lib/webPublica'
import type { HermandadSettings } from '../lib/hermandadSettings'
import { LogoMark } from './Logo'
import type { PropsDeSeccion } from './sitio/comun'
import { pintarHistoria, pintarHazte, pintarEstacion, pintarJunta } from './sitio/seccionesDeLaHermandad'
import { pintarCultos, pintarCartel } from './sitio/seccionesDeCultos'
import { pintarCaridad } from './sitio/seccionCaridad'
import {
  pintarTitulares, pintarGaleria, pintarActualidad, pintarPaginas, pintarBoletines,
} from './sitio/seccionesDeActualidad'
import { pintarDonativos, pintarTienda, pintarLoteria } from './sitio/seccionesDeDinero'
import { pintarDocumentos } from './sitio/seccionDocumentos'
import { pintarContacto } from './sitio/seccionContacto'
import { useTrampaDeFoco } from './sitio/foco'
import type { EnlaceMenu } from './sitio/marco'
import { BotonEntrar, FotoASangre, ResumenOtroIdioma, VolverArriba } from './sitio/piezas'
import { HeroFondo, MenuDesplegable, PieSitio } from './sitio/marco'
import { BloquesPortada } from './sitio/portada'

/*
 * Y SE SIGUEN OFRECIENDO DESDE AQUÍ.
 *
 * `SitioPublico.tsx` importa varias de estas piezas de este fichero, y no
 * tiene por qué enterarse de que se han mudado: lo que ha cambiado es dónde
 * viven, no quién las usa.
 */
export { AvisoFotos, Cita, FotoConMarca, Parrafos } from './sitio/piezas'
export { Galeria } from './sitio/Galeria'
export { PieSitio } from './sitio/marco'
export { BloqueTitular, TarjetaNoticia } from './sitio/portada'


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
  const menuRef = useRef<HTMLElement>(null)
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

  // Con el menú de móvil abierto, el foco se queda dentro: es un panel que tapa
  // la página, y tabulando se salía a lo que hay debajo sin verlo.
  useTrampaDeFoco(menuAbierto && interactivo, menuRef)

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

  /**
   * Entrada suave de cada bloque al bajar por la página.
   *
   * Solo en la web de verdad: en la vista previa del panel el marco tiene su
   * propio scroll y las secciones se habrían quedado en blanco. Y solo si el
   * visitante no ha pedido «reducir movimiento» en su sistema.
   */
  useEffect(() => {
    if (!interactivo || !web.animaciones || !raiz.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const nodos = raiz.current.querySelectorAll<HTMLElement>('.sitio__seccion, .sitio__portada, .sitio__sangre')
    if (nodos.length === 0) return
    nodos.forEach((n) => n.classList.add('sitio__entra'))
    const obs = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (!e.isIntersecting) return
          e.target.classList.add('sitio__entra--visto')
          // Una vez visto se deja en paz: la entrada es de una sola vez, no un
          // parpadeo cada vez que se sube y se baja.
          obs.unobserve(e.target)
        })
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    nodos.forEach((n) => obs.observe(n))
    return () => obs.disconnect()
  }, [interactivo, web.animaciones, web.secciones, web.paginas])

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
  // Una sección en borrador se ve en la vista previa del panel, con su marca,
  // pero no en la web: así se puede ir escribiendo sin ocultarla entera.
  const seccionesVisibles = web.secciones.filter((s) => s.visible && (!interactivo || !s.borrador))
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
    // Un cartel sin imagen no es un cartel: la ficha sola no se enseña.
    if (tipo === 'cartel') return (web.carteles ?? []).some((c) => Boolean(c.imagenDataUrl))
    if (tipo === 'caridad') {
      const c = web.caridad
      return Boolean(c.entradilla.trim() || c.cifras.length || c.parrafos.some((p) => p.texto.trim())
        || c.comoAyudar.length || c.conQuien.length)
    }
    if (tipo === 'galeria') return web.albumes.some((a) => a.fotos.length > 0)
    if (tipo === 'actualidad') return web.noticias.some((n) => n.publicada)
    if (tipo === 'paginas') return web.paginas.filter((p) => p.enMenu !== false).length > 0
    if (tipo === 'boletines') return web.boletines.length > 0
    /*
     * LA DE DOCUMENTOS SE PORTA COMO LA TIENDA: lo que enseña no vive en
     * `web`, vive en el archivo documental y llega por su cuenta. Así que
     * desde aquí no se puede saber si hay algo, y se dice que sí: la propia
     * sección se calla si no hay nada marcado para la web.
     */
    if (tipo === 'documentos') return true
    if (tipo === 'donativos') {
      const d = web.donativos
      // Sin una vía de pago no hay donativo que valga: una sección que solo
      // dice «colabora» y no dice cómo, no sirve para nada.
      return Boolean((d.bizum.trim() || d.iban.trim() || d.enlacePasarela.trim())
        && (d.entradilla.trim() || d.texto.trim() || d.causas.length > 0))
    }
    if (tipo === 'loteria') return Boolean(web.loteria.numero.trim() || web.loteria.sorteo.trim())
    /*
     * LA TIENDA ES LA EXCEPCIÓN a la regla de esta función, y conviene que se
     * vea escrito. Aquí se decide si una sección se enlaza en el menú mirando
     * lo que la hermandad escribió, que está en memoria; el género de la
     * tienda está en la base y llega después, así que en este momento no hay
     * forma de saber si hay algo publicado sin mentir.
     *
     * Se deja pasar a propósito, y el riesgo es acotado: la sección sale
     * APAGADA de fábrica —se enciende cuando ya hay artículos marcados—, y si
     * aun así se abre vacía dice «ahora mismo no hay nada publicado» en vez de
     * quedarse en blanco. Un enlace que lleva a una frase honesta es mejor que
     * ocultar la tienda de una hermandad que sí tiene género porque la
     * consulta todavía no había vuelto.
     */
    if (tipo === 'tienda') return true
    if (tipo === 'contacto')
      return Boolean(
        // Sin herencia de Configuración: ver `contactoPublico.ts`. Si nadie ha
        // escrito el contacto en la web, la página de contacto no se ofrece.
        web.direccion || web.telefono || web.email || web.mapaUrl || web.horarios.length > 0,
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

  /**
   * Detrás de qué sección va la foto a sangre. Si la elegida no se pinta (no
   * tiene contenido), se cae a la primera que sí, para no dejarla suelta al
   * final ni desaparecida.
   */
  const conContenido = seccionesVisibles.filter((s) => tieneContenido(s.tipo))
  const seccionSangre = web.sangre.fotoDataUrl
    ? (conContenido.find((s) => s.tipo === web.sangre.despuesDe)?.tipo ?? conContenido[0]?.tipo)
    : undefined

  return (
    <div
      ref={raiz}
      lang={web.idioma || 'es'}
      className={
        'sitio'
        + (web.cabecera.fija ? ' sitio--navfija' : '')
        + (web.fondosAlternos ? ' sitio--franjas' : '')
        + (web.letraCapital ? ' sitio--capital' : '')
        + (web.animaciones ? ' sitio--anima' : '')
      }
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
          {web.cabecera.mostrarLogo && (logo ? <img src={logo} alt="" className="sitio__logo" decoding="async" /> : <LogoMark size={30} />)}
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
          ref={menuRef}
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
        <BloquesPortada web={web} cultos={cultosVisibles} interactivo={interactivo} />
        <ResumenOtroIdioma resumen={web.resumenOtroIdioma} />
        {seccionesVisibles.map((s) => (
          <Fragment key={s.tipo}>
            <Seccion
              tipo={s.tipo}
              nombre={s.nombre}
              activa={s.tipo === seccionActiva}
              borrador={s.borrador}
              interactivo={interactivo}
              cultos={cultosVisibles}
              web={web}
              hermandad={hermandad}
            />
            {/* La foto a sangre parte la página en dos justo detrás de la
                sección que elija la hermandad. */}
            {s.tipo === seccionSangre && <FotoASangre sangre={web.sangre} />}
          </Fragment>
        ))}
      </main>

      {interactivo && <VolverArriba />}

      <PieSitio
        web={web}
        titulo={titulo}
        interactivo={interactivo}
        activo={seccionActiva === 'pie'}
      />
    </div>
  )
}






















function Seccion({
  tipo,
  nombre,
  activa,
  borrador,
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
  /** En borrador: solo se ve aquí, con su marca, no en la web. */
  borrador?: boolean
  /** En la vista previa del panel los enlaces no navegan. */
  interactivo: boolean
  /** Los del calendario ya mezclados con los escritos a mano. */
  cultos: CultoWeb[]
  web: WebPublica
  hermandad: HermandadSettings
}) {
  const titulo = (t: string) => nombre?.trim() || t
  // El formulario de alta arranca plegado: quien viene a leer qué hace falta
  // para hacerse hermano no quiere encontrarse un formulario largo de golpe.
  const [altaAbierta, setAltaAbierta] = useState(false)
  // Se aplican a todas las secciones por igual: la marca para poder saltar a
  // ella desde el editor y el resaltado de «estás editando esto».
  const props = {
    'data-seccion': tipo,
    className:
      `sitio__seccion${activa ? ' sitio__seccion--activa' : ''}${borrador ? ' sitio__seccion--borrador' : ''}`,
  }

  /*
   * EL DESPACHADOR.
   *
   * Cada tipo de sección se pinta en su fichero de `sitio/`, agrupados como en
   * el editor. Aquí solo queda decir cuál es cuál, que es lo que se quiere ver
   * de un vistazo al abrir este fichero.
   */
  const sec: PropsDeSeccion = { tipo, nombre, activa, borrador, interactivo, cultos, web, hermandad }
  if (tipo === 'historia') return pintarHistoria(sec, titulo, props)
  if (tipo === 'titulares') return pintarTitulares(sec, titulo, props)
  if (tipo === 'hazte') return pintarHazte(sec, titulo, props, altaAbierta, setAltaAbierta)
  if (tipo === 'estacion') return pintarEstacion(sec, titulo, props)
  if (tipo === 'junta') return pintarJunta(sec, titulo, props)
  if (tipo === 'cultos') return pintarCultos(sec, titulo, props)
  if (tipo === 'cartel') return pintarCartel(sec, titulo, props)
  if (tipo === 'caridad') return pintarCaridad(sec, titulo, props)
  if (tipo === 'galeria') return pintarGaleria(sec, titulo, props)
  if (tipo === 'actualidad') return pintarActualidad(sec, titulo, props)
  if (tipo === 'paginas') return pintarPaginas(sec, props)
  if (tipo === 'boletines') return pintarBoletines(sec, titulo, props)
  if (tipo === 'documentos') return pintarDocumentos(sec, titulo, props)
  if (tipo === 'donativos') return pintarDonativos(sec, titulo, props)
  if (tipo === 'loteria') return pintarLoteria(sec, titulo, props)
  if (tipo === 'tienda') return pintarTienda(sec, titulo, props)
  if (tipo === 'contacto') return pintarContacto(sec, titulo, props)
  return null
}
