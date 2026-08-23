import { asegurarFuentesDeLaWeb } from '../lib/fuentesDeLaWeb'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  PAREJAS_TIPOGRAFICAS,
  ajustesDeLaWeb,
  cargarWebPorSlug,
  diasHasta,
  getWebPublica,
  marcaDeAgua,
  noticiasPublicadas,
  noticiasPorAnio,
  slugNoticia,
  slugTitular,
  slugCulto,
  urlMapaIncrustado,
  type CultoWeb,
  type Noticia,
  type Titular,
  type WebPublica,
} from '../lib/webPublica'
import { AJUSTES_VACIOS, useHermandadSettings, type HermandadSettings } from '../lib/hermandadSettings'
import { constaLaSuscripcion, getSuscripcion, tieneCapacidad } from '../lib/suscripcion'
import { haySesionAbierta } from '../lib/sesion'
import { LogoMark } from '../components/Logo'
import { icsDeUnActo, nombreDeArchivoIcs } from '../lib/ics'
import { contarVisita } from '../lib/visitas'
import SitioContenido, { AvisoFotos, FotoConMarca, Galeria, Parrafos, PieSitio, TarjetaNoticia } from '../components/SitioContenido'
import { cultosDelCalendario } from '../lib/cultosDelCalendario'
import { fijarHermandadDeLaPagina, getHermandadDeLaPagina } from '../lib/multiHermandad'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  baseDeLaWeb,
  baseDeRutas,
  type PiezaSeo,
  datosEstructurados,
  descripcionWeb,
  tituloWeb,
  urlAbsoluta,
} from '../lib/seoWeb'

/**
 * Web pública de la hermandad (/w/:slug). Con ?preview=1 se muestra aunque no
 * esté publicada (para la vista previa del panel). El render vive en
 * SitioContenido, compartido con la vista previa.
 */
export default function SitioPublico({ webPorDominio }: { webPorDominio?: WebPublica } = {}) {
  // Las doce letras del catálogo, solo aquí: ver lib/fuentesDeLaWeb.ts.
  useEffect(() => { asegurarFuentesDeLaWeb() }, [])
  const { slug: slugRuta, noticia: slugNot, titular: slugTit, culto: slugCul } = useParams()
  // Cuando se llega por el dominio propio de la hermandad no hay slug en la
  // dirección —se ha entrado por la raíz— así que se toma el de su web.
  const slug = slugRuta ?? webPorDominio?.slug
  const [params] = useSearchParams()
  // La vista previa solo vale desde el panel (misma pestaña/origen): se exige
  // sesión abierta. Si no, cualquiera podía ver con ?preview=1 una web sin
  // publicar o de una hermandad que no tiene contratado el pack Web.
  const preview = params.get('preview') === '1' && haySesionAbierta()
  const [traida, setTraida] = useState<WebPublica | null>(webPorDominio ?? null)
  // Con la base de datos conectada hay que esperar a que llegue: si no, se
  // pintaría «esta web no está disponible» un instante antes de recibirla, y
  // eso es justo lo que ve un rastreador que no espera.
  // Si la web ya viene dada (se ha entrado por el dominio de la hermandad), no
  // hay nada que esperar: ya está buscada.
  const [esperando, setEsperando] = useState(isSupabaseConfigured && !webPorDominio)
  /*
   * De qué hermandad es esta página, como ESTADO y no solo como variable de
   * módulo: hace falta para que el contador de visitas de abajo espere a
   * saberlo. Con dominio propio ya viene resuelto desde `Raiz`.
   */
  const [deQuienEs, setDeQuienEs] = useState<string | null>(
    webPorDominio ? getHermandadDeLaPagina() : null,
  )

  // La web de ESTA hermandad, buscada por el slug de la dirección.
  //
  // Lo guardado en el navegador (`getWebPublica`) es lo que está montando
  // quien la edita, así que solo sirve para él. Cualquier otra persona ve lo
  // que venga de la base de datos, que es lo que hace que la web pública sea
  // pública de verdad. Se sigue usando lo del navegador cuando no hay base de
  // datos (modo local) y como red de seguridad si la consulta falla.
  useEffect(() => {
    if (webPorDominio || !isSupabaseConfigured || !slug) {
      setEsperando(false)
      return
    }
    let cancelado = false
    setEsperando(true)
    cargarWebPorSlug(slug).then((r) => {
      if (cancelado) return
      if (r) setTraida(r.web)
      // De qué hermandad es esta página: lo necesitan sus formularios para
      // saber a qué buzón va lo que escriba el visitante. Se pone SIEMPRE,
      // también a nulo cuando no se encuentra la web: si solo se pusiera al
      // encontrarla, alguien que pasa de la web de una hermandad a la de otra
      // y falla la segunda seguiría escribiendo al buzón de la primera.
      fijarHermandadDeLaPagina(r?.hermandadId ?? null)
      setDeQuienEs(r?.hermandadId ?? null)
      setEsperando(false)
    })
    return () => {
      cancelado = true
    }
  }, [slug, webPorDominio])

  /*
   * LA VISITA SE CUENTA AQUÍ, y depende de la RUTA a propósito.
   *
   * Esta es una sola página que se repinta: al pasar de la portada a una
   * noticia el navegador no recarga nada, así que contando solo al arrancar se
   * perdía todo lo que no fuera la primera página que se abre — que es
   * justamente lo que la hermandad quiere saber, si se leen las noticias.
   *
   * Sin IP, sin cookies y sin seguir a nadie: solo un número por día y por
   * página. Ver `lib/visitas.ts`.
   */
  const { pathname } = useLocation()
  useEffect(() => {
    if (!deQuienEs) return
    void contarVisita(pathname, deQuienEs)
  }, [pathname, deQuienEs])

  const guardadaAqui = getWebPublica()
  const web = traida ?? guardadaAqui

  /**
   * Los datos de la hermandad, PREGUNTADOS POR EL SLUG de esta web.
   *
   * `useHermandadSettings()` no sirve aquí: arranca leyendo la copia del
   * navegador, y en un ordenador donde antes hubiera entrado alguien de otra
   * hermandad esa copia lleva SUS datos —nombre, dirección, logo, IBAN y
   * Bizum—. Como la consulta se hace sin sesión y no devuelve nada, se quedaba
   * con lo de la otra: la sección de donativos de una hermandad llegó a pedir
   * dinero al IBAN de otra.
   *
   * Se sigue usando el hook como reserva SIN base de datos, que es cuando la
   * aplicación funciona entera contra el navegador y esa copia sí es la suya.
   */
  const guardadosAqui = useHermandadSettings()
  const [ajustesWeb, setAjustesWeb] = useState<Partial<HermandadSettings> | null>(null)
  useEffect(() => {
    if (!isSupabaseConfigured || !web.slug) return
    let cancelado = false
    ajustesDeLaWeb(web.slug).then((r) => {
      if (!cancelado) setAjustesWeb(r)
    })
    return () => {
      cancelado = true
    }
  }, [web.slug])
  const hermandad = useMemo(
    () => (isSupabaseConfigured ? { ...AJUSTES_VACIOS, ...(ajustesWeb ?? {}) } : guardadosAqui),
    [ajustesWeb, guardadosAqui],
  )
  // Los próximos cultos salen del módulo de Eventos, para no copiarlos a mano.
  const cultosCalendario = useMemo(() => cultosDelCalendario(), [])
  /**
   * La suscripción NO puede filtrar a un visitante de fuera.
   *
   * EL FALLO QUE ARREGLA ESTO: `getSuscripcion()` lee la clave
   * `cabildo-suscripcion` del navegador de quien mira. La hermandad la tiene
   * en el suyo, así que veía su web perfecta y daba por hecho que estaba
   * publicada. Cualquier otra persona —una ventana de incógnito, el móvil de
   * un hermano, quien abría el enlace desde WhatsApp— no tiene esa clave, se
   * caía en la suscripción de fábrica (`activa: false`) y se encontraba con
   * «Esta web no está disponible. La hermandad no tiene contratada la web
   * pública en su suscripción».
   *
   * O sea: la web pública no la podía ver NADIE de fuera, que es exactamente
   * para lo que existe. Y la hermandad no tenía forma de enterarse.
   *
   * Mientras el pack contratado no venga del servidor —hoy solo vive en el
   * navegador de quien lo contrató— la única lectura honesta es: si a este
   * navegador NO le consta la suscripción, no se le puede cerrar la puerta,
   * porque no saber no es lo mismo que no haber pagado. Para el visitante
   * manda `publicada`, que sí llega de la base de datos y sí está protegido
   * por las políticas de acceso.
   *
   * Así la hermandad que de verdad no tiene el pack sigue viendo el aviso en
   * su propio panel —ahí sí consta— y el de fuera ve la web.
   */
  const conWeb = !constaLaSuscripcion() || tieneCapacidad(getSuscripcion(), 'web')

  if (!preview && !conWeb) {
    return (
      <div className="sitio-noweb">
        <LogoMark size={40} />
        <h1>Esta web no está disponible</h1>
        <p>La hermandad no tiene contratada la web pública en su suscripción.</p>
        <Link to="/hermano" className="sitio-btn">Área del hermano</Link>
      </div>
    )
  }

  if (esperando) {
    return (
      <div className="sitio-noweb" aria-busy="true">
        <LogoMark size={40} />
        <p>Cargando…</p>
      </div>
    )
  }

  if (!preview && (!web.publicada || web.slug !== slug)) {
    return (
      <div className="sitio-noweb">
        <LogoMark size={40} />
        <h1>Esta web no está disponible</h1>
        <p>La hermandad todavía no ha publicado su web, o el enlace no es correcto.</p>
        <Link to="/hermano" className="sitio-btn">Área del hermano</Link>
      </div>
    )
  }

  // Una noticia suelta, con su enlace propio.
  if (slugNot) {
    const n = noticiasPublicadas(web.noticias).find((x) => slugNoticia(x) === slugNot)
    if (!n) {
      return (
        <div className="sitio-noweb">
          <LogoMark size={40} />
          <h1>Esa noticia ya no está</h1>
          <p>Puede que se haya quitado de la web.</p>
          <Link to={baseDeRutas(web) || '/'} className="sitio-btn">Ir a la web</Link>
        </div>
      )
    }
    return (
      <>
        <MetaWeb
          web={web}
          hermandad={hermandad}
          cultos={cultosCalendario}
          pieza={{ titulo: n.titulo, descripcion: n.resumen, imagen: n.fotoDataUrl, ruta: `/n/${slugNoticia(n)}` }}
        />
        <PaginaNoticia web={web} hermandad={hermandad} noticia={n} />
      </>
    )
  }

  // La ficha de un titular, con su enlace propio.
  if (slugTit) {
    const t = web.titulares.find((x) => slugTitular(x) === slugTit)
    if (!t) {
      return (
        <div className="sitio-noweb">
          <LogoMark size={40} />
          <h1>Esa ficha ya no está</h1>
          <p>Puede que se haya quitado de la web.</p>
          <Link to={baseDeRutas(web) || '/'} className="sitio-btn">Ir a la web</Link>
        </div>
      )
    }
    return (
      <>
        <MetaWeb
          web={web}
          hermandad={hermandad}
          cultos={cultosCalendario}
          pieza={{
            titulo: t.nombre,
            descripcion: t.descripcion.trim() || t.autoria.trim(),
            imagen: t.fotoDataUrl,
            ruta: `/t/${slugTitular(t)}`,
          }}
        />
        <PaginaTitular web={web} hermandad={hermandad} titular={t} />
      </>
    )
  }

  /*
   * UN CULTO SUELTO, con su enlace propio.
   *
   * Es el enlace que se pega en el grupo de la hermandad cuando se anuncia un
   * quinario: hasta ahora había que mandar la portada entera y decir «baja
   * hasta cultos». Se busca entre los escritos Y los del calendario, que es lo
   * que se ve en la sección.
   */
  if (slugCul) {
    const c = [...cultosCalendario, ...web.cultos].find((x) => slugCulto(x) === slugCul || x.id === slugCul)
    if (!c) {
      return (
        <div className="sitio-noweb">
          <LogoMark size={40} />
          <h1>Ese culto ya no está</h1>
          <p>Puede que haya pasado y se haya quitado de la web.</p>
          <Link to={baseDeRutas(web) || '/'} className="sitio-btn">Ir a la web</Link>
        </div>
      )
    }
    return (
      <>
        <MetaWeb
          web={web}
          hermandad={hermandad}
          cultos={cultosCalendario}
          pieza={{
            titulo: c.titulo,
            descripcion: [c.fecha, c.lugar].filter((x) => x?.trim()).join(' · ') || c.detalle || '',
            imagen: c.fotoDataUrl,
            ruta: `/c/${slugCulto(c)}`,
            tipo: 'culto',
            fecha: c.fechaIso || undefined,
            lugar: c.lugar || undefined,
          }}
        />
        <PaginaCulto web={web} hermandad={hermandad} culto={c} otros={[...cultosCalendario, ...web.cultos]} />
      </>
    )
  }

  // El listado completo de noticias.
  if (window.location.pathname.endsWith('/noticias')) {
    return (
      <>
        <MetaWeb web={web} hermandad={hermandad} cultos={cultosCalendario} pieza={{ titulo: 'Actualidad', descripcion: '', imagen: null, ruta: '/noticias' }} />
        <ListadoNoticias web={web} hermandad={hermandad} />
      </>
    )
  }

  return (
    <>
      <MetaWeb web={web} hermandad={hermandad} cultos={cultosCalendario} />
      <SitioContenido web={web} hermandad={hermandad} cultosDelCalendario={cultosCalendario} />
    </>
  )
}

/** Marco común de las páginas sueltas: la marca arriba y la vuelta a la web. */
function MarcoSuelto({
  web,
  hermandad,
  children,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  children: React.ReactNode
}) {
  const titulo = web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
  const logo = web.logoDataUrl || hermandad.logoDataUrl
  return (
    <SitioMarco web={web}>
      {/* `sitio__nav--suelta` la deja siempre en una fila: la plantilla
          «Clásica» apila la marca sobre el menú, y aquí no hay menú. */}
      <header className="sitio__nav sitio__nav--suelta">
        <Link to={baseDeRutas(web) || '/'} className="sitio__brand">
          {logo ? <img src={logo} alt="" className="sitio__logo" decoding="async" /> : <LogoMark size={30} />}
          <span className="sitio__brand-texto"><span>{titulo}</span></span>
        </Link>
        <Link to={baseDeRutas(web) || '/'} className="sitio-btn sitio-btn--sm">Volver a la web</Link>
      </header>
      <main className="sitio__main">{children}</main>
      {/* El mismo pie que la web: si no, la página se quedaba colgando. */}
      <PieSitio web={web} hermandad={hermandad} titulo={titulo} interactivo />
    </SitioMarco>
  )
}

/**
 * Los tokens de estilo de la web (colores, fuentes, esquinas) para las páginas
 * que no pasan por SitioContenido. Se leen del mismo sitio, así una noticia se
 * ve con el estilo que la hermandad haya elegido.
 */
function SitioMarco({ web, children }: { web: WebPublica; children: React.ReactNode }) {
  const pareja = PAREJAS_TIPOGRAFICAS.find((p) => p.id === web.pareja)
  return (
    <div
      className="sitio"
      lang={web.idioma || 'es'}
      data-plantilla={web.plantilla}
      data-tema={web.tema}
      style={{
        ['--sitio-color' as string]: web.colorPrimario,
        ['--sitio-color2' as string]: web.colorSecundario,
        ['--sitio-fuente' as string]: pareja?.texto ?? '',
        ['--sitio-fuente-titulos' as string]: pareja?.titulos ?? '',
        ['--sitio-radio' as string]: { recto: '0px', suave: '10px', redondo: '20px' }[web.redondeo] ?? '10px',
        ['--sitio-aire' as string]: { compacta: '0.72', normal: '1', amplia: '1.35' }[web.densidad] ?? '1',
      }}
    >
      {children}
    </div>
  )
}

function PaginaNoticia({
  web,
  hermandad,
  noticia,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  noticia: Noticia
}) {
  return (
    <MarcoSuelto web={web} hermandad={hermandad}>
      <article className="sitio__noticia-pagina">
        <p className="sitio__noticia-fecha">{fechaLegible(noticia.fecha)}</p>
        <h1>{noticia.titulo}</h1>
        {noticia.resumen && <p className="sitio__entradilla">{noticia.resumen}</p>}
        {noticia.fotoDataUrl && (
          <img src={noticia.fotoDataUrl} alt={noticia.altFoto ?? ''} className="sitio__noticia-foto" decoding="async" />
        )}
        <Parrafos parrafos={noticia.parrafos ?? []} />
      </article>
    </MarcoSuelto>
  )
}

/**
 * La ficha de un titular: su foto grande, su autoría, su historia entera y las
 * fotos que la hermandad haya subido de él. En la portada solo se asoma; aquí
 * está todo, y este es el enlace que se pega en redes.
 */
function PaginaTitular({
  web,
  hermandad,
  titular: t,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  titular: Titular
}) {
  const marca = marcaDeAgua(web, hermandad.nombreLegal ?? '')
  const parrafos = (t.parrafos ?? []).filter((p) => p.texto.trim() || p.subtitulo.trim())
  const fotos = t.fotos ?? []
  const otros = web.titulares.filter((x) => x.id !== t.id)
  return (
    <MarcoSuelto web={web} hermandad={hermandad}>
      <article className="sitio__ficha">
        <header className="sitio__ficha-cabeza">
          {t.fotoDataUrl && (
            <figure className="sitio__ficha-foto">
              <FotoConMarca src={t.fotoDataUrl} alt={t.alt?.trim() || t.nombre} marca={marca} />
              {t.credito?.trim() && <figcaption>Foto: {t.credito}</figcaption>}
            </figure>
          )}
          <div className="sitio__ficha-titulo">
            <h1>{t.nombre}</h1>
            {t.autoria.trim() && <p className="sitio__autoria">{t.autoria}</p>}
            {t.descripcion.trim() && <p className="sitio__entradilla">{t.descripcion}</p>}
          </div>
        </header>

        <Parrafos parrafos={parrafos} />

        {fotos.length > 0 && (
          <div className="sitio__ficha-fotos">
            {/* La misma galería que la sección: se abren a pantalla completa y
                se pasa de una a otra con las flechas. El aviso de derechos lo
                pone la ficha una sola vez, más abajo. */}
            <Galeria
              albumes={[{ id: 'ficha', titulo: '', descripcion: '', fecha: '', fotos: fotos.map((f, i) => ({ id: `ficha-${i}`, fotoDataUrl: f.url, pie: f.alt })) }]}
              interactivo
              marca={marca}
              aviso=""
            />
          </div>
        )}

        <AvisoFotos texto={web.avisoFotos} />
      </article>

      {otros.length > 0 && (
        <nav className="sitio__otros" aria-label="Los demás titulares">
          <h2>Los demás titulares</h2>
          <ul>
            {otros.map((o) => (
              <li key={o.id}>
                <Link to={`${baseDeRutas(web)}/t/${slugTitular(o)}`}>
                  {o.fotoDataUrl && <img src={o.fotoDataUrl} alt="" loading="lazy" decoding="async" />}
                  <span>{o.nombre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </MarcoSuelto>
  )
}

/**
 * LA PÁGINA DE UN CULTO.
 *
 * Es el enlace que se pega en el grupo de la hermandad cuando se anuncia un
 * quinario. Hasta ahora había que mandar la portada entera y decir «baja hasta
 * cultos»; y el que lo abría desde el móvil, en la calle, tenía que leerse la
 * web para encontrar la hora.
 *
 * Lo importante de esta página son tres datos —cuándo, dónde y qué es— y un
 * botón: meterlo en el calendario. Un culto anunciado en enero se lee y se
 * olvida; metido en el calendario, avisa él solo.
 */
function PaginaCulto({
  web,
  hermandad,
  culto: c,
  otros,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  culto: CultoWeb
  otros: CultoWeb[]
}) {
  const marca = marcaDeAgua(web, hermandad.nombreLegal ?? '')
  const proximos = otros.filter((x) => x.id !== c.id).slice(0, 4)
  const faltan = diasHasta(c.fechaIso)
  const lugar = c.lugar?.trim() || web.direccion || hermandad.direccion || ''
  return (
    <MarcoSuelto web={web} hermandad={hermandad}>
      <article className="sitio__culto-pagina">
        {c.fotoDataUrl && (
          <figure className="sitio__culto-pagina-foto">
            <FotoConMarca src={c.fotoDataUrl} alt="" marca={marca} />
          </figure>
        )}
        <h1>{c.titulo}</h1>
        {/* «Faltan 12 días» solo cuando falta poco y hay fecha de verdad: a
            cuatro meses vista no dice nada, y a dos días lo dice todo. */}
        {faltan !== null && faltan >= 0 && faltan <= 60 && (
          <p className="sitio__culto-faltan">
            {faltan === 0 ? 'Es hoy' : faltan === 1 ? 'Es mañana' : `Faltan ${faltan} días`}
          </p>
        )}
        <dl className="sitio__culto-datos">
          {c.fecha?.trim() && <div><dt>Cuándo</dt><dd>{c.fecha}</dd></div>}
          {lugar && <div><dt>Dónde</dt><dd>{lugar}</dd></div>}
        </dl>
        {c.detalle?.trim() && <p className="sitio__culto-detalle">{c.detalle}</p>}

        <BotonCalendario culto={c} web={web} />

        {web.mapaUrl && urlSeguraMapa(web.mapaUrl, lugar) && (
          <div className="sitio__culto-mapa">
            <iframe
              src={urlSeguraMapa(web.mapaUrl, lugar) as string}
              title={`Dónde es ${c.titulo}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </article>

      {proximos.length > 0 && (
        <nav className="sitio__otros" aria-label="Los demás cultos">
          <h2>Los demás cultos</h2>
          <ul>
            {proximos.map((o) => (
              <li key={o.id}>
                <Link to={`${baseDeRutas(web)}/c/${slugCulto(o)}`}>
                  {o.fotoDataUrl && <img src={o.fotoDataUrl} alt="" loading="lazy" decoding="async" />}
                  <span>{o.titulo}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </MarcoSuelto>
  )
}

/** El mapa de la web, si es de Google y se puede incrustar sin abrir la puerta a nadie. */
function urlSeguraMapa(mapaUrl: string, direccion: string): string | null {
  return urlMapaIncrustado(mapaUrl, direccion)
}

/**
 * «AÑADIR AL CALENDARIO».
 *
 * Solo sale cuando el culto tiene fecha de verdad (`fechaIso`), que es cuando
 * viene del módulo de Eventos. Escrita a mano —«del 3 al 7 de marzo»— no hay
 * forma honesta de sacar un día: mejor no ofrecer el botón que dar un archivo
 * que el calendario coloca donde no es.
 *
 * La hora sí se busca en el texto: «Viernes 15, 20:30» tiene hora aunque la
 * fecha venga por otro lado.
 */
function BotonCalendario({ culto, web }: { culto: CultoWeb; web: WebPublica }) {
  const baseWeb = baseDeRutas(web)
  /*
   * `Blob` y no `data:`: Safari en iOS abre un `data:text/calendar` como texto
   * plano en una pestaña nueva en vez de pasárselo al calendario.
   *
   * Y CON `useMemo` + LIMPIEZA, no suelto en el render. `createObjectURL`
   * reserva memoria en el navegador hasta que se le dice que la suelte;
   * llamándolo en cada render se dejaba una copia del archivo tirada cada vez
   * que se repintaba la página, y no las recoge nadie hasta recargar.
   */
  const enlace = useMemo(() => {
    if (!culto.fechaIso) return null
    const hora = (culto.fecha ?? '').match(/\b(\d{1,2}):(\d{2})\b/)
    const ics = icsDeUnActo({
      id: culto.id,
      titulo: culto.titulo,
      fechaIso: culto.fechaIso,
      hora: hora ? `${hora[1]}:${hora[2]}` : undefined,
      lugar: culto.lugar || undefined,
      descripcion: culto.detalle || undefined,
      url: `${window.location.origin}${baseWeb}/c/${slugCulto(culto)}`,
    })
    if (!ics) return null
    return URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  }, [culto, baseWeb])

  useEffect(() => {
    if (!enlace) return
    return () => URL.revokeObjectURL(enlace)
  }, [enlace])

  if (!enlace) return null
  return (
    <a className="sitio-btn sitio__culto-calendario" href={enlace} download={nombreDeArchivoIcs(slugCulto(culto))}>
      Añadir al calendario
    </a>
  )
}

/**
 * LA HEMEROTECA.
 *
 * Sin agrupar por año, la actualidad de una hermandad con seis años de web es
 * una lista infinita: para llegar a la presentación del cartel de 2023 hay que
 * bajar doscientas veces. Y esas noticias viejas no son basura — son el
 * archivo de la hermandad, lo que cuenta lo que se ha hecho.
 *
 * Con la tira de años arriba se salta al que sea de un toque. Se enseña el año
 * más reciente y desde ahí se navega, en vez de cargar de golpe doscientas
 * tarjetas con sus doscientas fotos.
 */
function ListadoNoticias({ web, hermandad }: { web: WebPublica; hermandad: HermandadSettings }) {
  const porAnio = useMemo(() => noticiasPorAnio(web.noticias), [web.noticias])
  const [anioAbierto, setAnioAbierto] = useState<string | null>(null)
  // El más reciente por defecto. Se calcula aquí y no en el `useState` porque
  // las noticias llegan de la base de datos DESPUÉS de montar: con el valor
  // inicial se quedaba en null y no se veía nada.
  const anio = anioAbierto ?? porAnio[0]?.anio ?? null
  const grupo = porAnio.find((g) => g.anio === anio)
  const rotulo = (a: string) => a || 'Sin fecha'

  return (
    <MarcoSuelto web={web} hermandad={hermandad}>
      <h1>Actualidad</h1>
      {porAnio.length === 0 && <p>Todavía no hay noticias publicadas.</p>}
      {/* Con un solo año la tira sobra: sería un botón suelto que no lleva a
          ninguna parte distinta de donde ya estás. */}
      {porAnio.length > 1 && (
        <nav className="sitio__hemeroteca" aria-label="Noticias por año">
          {porAnio.map((g) => (
            <button
              key={g.anio || 'sin-fecha'}
              type="button"
              className={`sitio__hemeroteca-anio${g.anio === anio ? ' sitio__hemeroteca-anio--abierto' : ''}`}
              aria-current={g.anio === anio ? 'true' : undefined}
              onClick={() => setAnioAbierto(g.anio)}
            >
              {rotulo(g.anio)}
              <span>{g.noticias.length}</span>
            </button>
          ))}
        </nav>
      )}
      {grupo && (
        <>
          {porAnio.length > 1 && <h2 className="sitio__hemeroteca-titulo">{rotulo(grupo.anio)}</h2>}
          <div className="sitio__noticias">
            {grupo.noticias.map((n) => (
              <TarjetaNoticia key={n.id} noticia={n} interactivo baseWeb={baseDeRutas(web)} />
            ))}
          </div>
        </>
      )}
    </MarcoSuelto>
  )
}

/** «2 de febrero de 2026» a partir de una fecha ISO. */
function fechaLegible(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Título y etiquetas de la página: lo que se ve en la pestaña del navegador, en
 * los resultados de Google y al pegar el enlace en WhatsApp. Se escriben en el
 * documento al montar y se dejan como estaban al salir, para no contaminar el
 * resto de la aplicación.
 */
function MetaWeb({
  web,
  hermandad,
  cultos,
  pieza,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  /** Los próximos cultos, para los datos estructurados de Google. */
  cultos: CultoWeb[]
  /**
   * En una página suelta (una noticia, la ficha de un titular, un culto)
   * mandan SU título, SU descripción y SU foto: es lo que se pega en WhatsApp.
   */
  pieza?: PiezaSeo
}) {
  // Se sacan los campos sueltos a propósito: `pieza` es un objeto nuevo en cada
  // render, y como dependencia del efecto lo dispararía una y otra vez.
  const hayPieza = Boolean(pieza)
  const piezaTitulo = pieza?.titulo ?? ''
  const piezaDescripcion = pieza?.descripcion ?? ''
  const piezaImagen = pieza?.imagen ?? null
  const piezaRuta = pieza?.ruta ?? '/'
  const piezaTipo = pieza?.tipo
  const piezaFecha = pieza?.fecha
  const piezaLugar = pieza?.lugar
  useEffect(() => {
    const anterior = document.title
    const base = baseDeLaWeb(web, window.location.origin)
    const nombreWeb = tituloWeb(web, hermandad)
    // En una página suelta manda la pieza: es lo que se comparte.
    const titulo = hayPieza ? `${piezaTitulo} · ${nombreWeb}` : nombreWeb
    const descripcion = hayPieza ? piezaDescripcion.trim() || descripcionWeb(web) : descripcionWeb(web)
    const imagen =
      piezaImagen
      ?? web.seo.imagenDataUrl
      ?? web.heroFotos[0]
      ?? web.logoDataUrl
      ?? hermandad.logoDataUrl
      ?? ''
    const url = urlAbsoluta(base, piezaRuta)
    document.title = titulo

    const puestas: Element[] = []
    // Las que ya existen (las de la aplicación, en index.html) se REEMPLAZAN y
    // se restauran al salir: si solo se añadieran, seguiría mandando la
    // descripción genérica de Gobergo y no la de la hermandad.
    const restaurar: { el: Element; attr: string; antes: string | null }[] = []
    function meta(clave: 'name' | 'property', valor: string, contenido: string) {
      if (!contenido) return
      const existente = document.head.querySelector(`meta[${clave}="${valor}"]`)
      if (existente) {
        restaurar.push({ el: existente, attr: 'content', antes: existente.getAttribute('content') })
        existente.setAttribute('content', contenido)
        return
      }
      const el = document.createElement('meta')
      el.setAttribute(clave, valor)
      el.setAttribute('content', contenido)
      document.head.appendChild(el)
      puestas.push(el)
    }
    /** Un <link> (canonical, icono) que se pone o se cambia y se deja como estaba. */
    function enlace(rel: string, href: string, tipo?: string) {
      if (!href) return
      const existente = document.head.querySelector(`link[rel="${rel}"]`)
      if (existente) {
        restaurar.push({ el: existente, attr: 'href', antes: existente.getAttribute('href') })
        existente.setAttribute('href', href)
        return
      }
      const el = document.createElement('link')
      el.setAttribute('rel', rel)
      el.setAttribute('href', href)
      if (tipo) el.setAttribute('type', tipo)
      document.head.appendChild(el)
      puestas.push(el)
    }

    meta('name', 'description', descripcion)
    meta('property', 'og:title', titulo)
    meta('property', 'og:description', descripcion)
    meta('property', 'og:type', 'website')
    meta('property', 'og:url', url)
    meta('property', 'og:image', imagen)
    meta('property', 'og:site_name', nombreWeb)
    meta('name', 'twitter:card', imagen ? 'summary_large_image' : 'summary')
    // El color de la barra del navegador en el móvil: con el de la hermandad,
    // la web deja de parecer prestada.
    meta('name', 'theme-color', web.colorPrimario)
    // Cuál es la dirección buena de esta página. Con dominio propio configurado
    // apunta al dominio, no al enlace largo, para que Google no cuente dos.
    enlace('canonical', url)
    // El escudo de la hermandad en la pestaña, en vez del de Gobergo.
    const escudo = web.logoDataUrl ?? hermandad.logoDataUrl
    if (escudo) enlace('icon', escudo)

    /*
     * Datos estructurados: la hermandad, su sede y cada culto con su fecha.
     * Google sí ejecuta JavaScript al indexar, así que esto le llega; WhatsApp
     * no, y por eso hace falta además la función de servidor (ver docs/SEO.md).
     *
     * Y CON LA PIEZA. Antes se mandaba siempre la ficha de la hermandad y solo
     * eso: las cuarenta noticias eran para Google cuarenta copias de la misma
     * ficha. La función de servidor sí mandaba la de cada una, así que la
     * página servida y la página ya cargada decían cosas distintas — y la que
     * gana es la segunda.
     */
    const ld = document.createElement('script')
    ld.type = 'application/ld+json'
    const piezaLd: PiezaSeo | undefined = hayPieza
      ? {
        titulo: piezaTitulo, descripcion: piezaDescripcion, imagen: piezaImagen, ruta: piezaRuta,
        tipo: piezaTipo, fecha: piezaFecha, lugar: piezaLugar,
      }
      : undefined
    ld.textContent = JSON.stringify(datosEstructurados(web, hermandad, cultos, base, piezaLd))
    document.head.appendChild(ld)
    puestas.push(ld)

    return () => {
      document.title = anterior
      puestas.forEach((el) => el.remove())
      restaurar.forEach(({ el, attr, antes }) => {
        if (antes === null) el.removeAttribute(attr)
        else el.setAttribute(attr, antes)
      })
    }
  }, [web, hermandad, cultos, hayPieza, piezaTitulo, piezaDescripcion, piezaImagen, piezaRuta, piezaTipo, piezaFecha, piezaLugar])

  return null
}
