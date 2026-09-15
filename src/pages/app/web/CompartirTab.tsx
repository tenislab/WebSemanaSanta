/**
 * COMPARTIR: el dominio, el SEO y cómo sale la web en WhatsApp y en Google.
 *
 * Es donde toca seguir trabajando (el editor de SEO de la F19), y es la razón
 * de haber partido el fichero antes y no después.
 */
import { type HermandadSettings } from '../../../lib/hermandadSettings'
import {
  LARGO_TITULO,
  baseDeLaWeb,
  revisarSeo,
  robotsTxt,
  rutasDeLaWeb,
  sitemapXml,
} from '../../../lib/seoWeb'
import { type WebPublica } from '../../../lib/webPublica'
import { descargarTexto, leerImagen, recortar, type EditarFn } from './comun'

export function CompartirTab({
  web, hermandad, editar, enlace,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  editar: EditarFn
  enlace: string
}) {
  const titulo = web.seo.titulo.trim() || web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
  const descripcion = web.seo.descripcion.trim()
  const imagen = web.seo.imagenDataUrl ?? web.heroFotos[0] ?? null
  const dominio = (() => {
    try { return new URL(enlace).host } catch { return 'tuhermandad.es' }
  })()
  const largoOk = descripcion.length > 0 && descripcion.length <= 160

  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Al compartir el enlace</h2></div>
        <p className="form-hint">
          Así se ve tu web cuando alguien pega el enlace en WhatsApp o la encuentra en Google.
        </p>

        {/* Las dos previas, con el recorte de verdad de cada sitio: es lo que
            convence de rellenarlo, y lo que evita el «pero si yo lo escribí». */}
        <div className="compartir-previas">
          <div>
            <p className="compartir-previa__eti">En Google</p>
            <div className="google-previa">
              <div className="google-previa__marca">
                <span className="google-previa__favicon" aria-hidden="true">
                  {(titulo[0] ?? 'H').toUpperCase()}
                </span>
                <span>
                  <b>{web.titulo || hermandad.nombreLegal || 'Tu hermandad'}</b>
                  <small>{dominio}</small>
                </span>
              </div>
              <p className="google-previa__titulo">{recortar(titulo, 60)}</p>
              <p className="google-previa__desc">
                {descripcion
                  ? recortar(descripcion, 155)
                  : 'Sin descripción, Google se inventa un trozo del texto de tu web.'}
              </p>
            </div>
          </div>
          <div>
            <p className="compartir-previa__eti">En WhatsApp</p>
            <div className="compartir-previa">
              <div className="compartir-previa__img">
                {imagen ? <img src={imagen} alt="" /> : <span>Sin imagen</span>}
              </div>
              <div className="compartir-previa__texto">
                <b>{recortar(titulo, 65)}</b>
                <p>{recortar(descripcion, 120) || 'Sin descripción. Aquí saldría el texto que escribas abajo.'}</p>
                <span className="compartir-previa__dominio">{dominio}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: '1rem' }}>
          <label htmlFor="seoTitulo">Título</label>
          <input
            id="seoTitulo"
            type="text"
            value={web.seo.titulo}
            onChange={(e) => editar('seo', (x) => ({ ...x, titulo: e.target.value }))}
            placeholder={web.titulo || 'Nombre de la hermandad'}
            aria-invalid={titulo.length > LARGO_TITULO}
          />
          {/*
            EL CONTADOR, IGUAL QUE EL DE LA DESCRIPCIÓN. La descripción lo tenía
            y el título no, así que se escribía a ciegas justo en el campo que
            más se corta: Google enseña unos sesenta caracteres y lo que sobra
            desaparece — normalmente el nombre de la hermandad, si va al final.
          */}
          <p className={`form-hint${titulo.length > LARGO_TITULO ? ' form-hint--alerta' : ''}`}>
            {titulo.length} de {LARGO_TITULO} caracteres
            {titulo.length > LARGO_TITULO && ' — Google cortará el resto.'}
            {titulo.length === 0 && ' · Si lo dejas vacío se usa el nombre de la web.'}
          </p>
        </div>

        <div className="form-row">
          <label htmlFor="seoDesc">Descripción</label>
          <textarea
            id="seoDesc"
            rows={3}
            value={web.seo.descripcion}
            onChange={(e) => editar('seo', (x) => ({ ...x, descripcion: e.target.value }))}
            placeholder="Hermandad de … Cultos, historia, hermanamiento y estación de penitencia el Viernes Santo."
            aria-invalid={descripcion.length > 160}
          />
          <p className={`form-hint${descripcion.length > 160 ? ' form-hint--alerta' : ''}`}>
            {descripcion.length} de 160 caracteres
            {descripcion.length > 160 && ' — Google cortará el resto.'}
            {!largoOk && descripcion.length === 0 && ' · Dos líneas contando quiénes sois y cuándo salís.'}
          </p>
        </div>

        <div className="form-row">
          <label>Imagen al compartir</label>
          <div className="assign-box__row">
            {web.seo.imagenDataUrl && <img src={web.seo.imagenDataUrl} alt="" style={{ width: 72, height: 40, objectFit: 'cover', borderRadius: 6 }} />}
            <label className="btn btn-outline btn-sm">
              {web.seo.imagenDataUrl ? 'Cambiar' : 'Subir imagen'}
              <input type="file" accept="image/*" hidden onChange={(e) => leerImagen(e, (d) => editar('seo', (x) => ({ ...x, imagenDataUrl: d })))} />
            </label>
            {web.seo.imagenDataUrl && (
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('seo', (x) => ({ ...x, imagenDataUrl: null }))}>Quitar</button>
            )}
          </div>
          <p className="form-hint">
            Sin imagen propia se usa la primera foto de la portada. Se ve mejor apaisada (1200×630).
          </p>
        </div>
      </section>

      {/*
        ====================================================================
        LA REVISIÓN: LO QUE DE VERDAD ROMPE, Y NADA MÁS
        ====================================================================

        Antes esto se escribía a ciegas: se rellenaba el título y la
        descripción y no había forma de saber si estaba bien puesto hasta que
        alguien pegaba el enlace en un grupo de WhatsApp y salía en gris.

        Son POCOS avisos a propósito. Una lista larga de reproches no la lee
        nadie — ya pasó en esta misma pantalla, y hubo que convertir los avisos
        de la web en una barra de progreso para que se miraran. Aquí solo entra
        lo que cambia algo de verdad para quien busca la hermandad o comparte
        el enlace.

        Y cada uno dice QUÉ HACER. Un aviso que solo dice qué está mal es un
        reproche: quien lo lee no sabe si le toca a él ni por dónde empezar.
      */}
      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Revisión</h2>
        </div>
        {(() => {
          const avisos = revisarSeo(web, hermandad)
          if (avisos.length === 0) {
            return (
              <p className="form-hint form-hint--ok">
                ✓ Todo lo que depende de vosotros está puesto: título, descripción, imagen y dominio.
                Salir el primero en Google no lo decide esto —ni ninguna otra herramienta—, pero la
                web está bien presentada.
              </p>
            )
          }
          return (
            <ul className="lista-limpia">
              {/* Lo grave primero: mezclado con lo demás se lee igual y se ignora igual. */}
              {[...avisos].sort((a, b) => Number(b.grave) - Number(a.grave)).map((a) => (
                <li key={a.id} className={`aviso aviso--${a.grave ? 'warn' : 'info'}`} style={{ marginBottom: '0.5rem' }}>
                  <b>{a.texto}</b>
                  <br />
                  <span className="table-subtle">{a.queHacer}</span>
                </li>
              ))}
            </ul>
          )
        })()}
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Para Google</h2></div>
        <p className="form-hint">
          El <b>sitemap</b> es la lista de páginas que se le da a Google para que las visite: sin
          él, las noticias y las fichas de los titulares tardan semanas en salir, o no salen. El
          <b> robots</b> dice quién puede mirar.
        </p>
        <div className="assign-box__row">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => descargarTexto('sitemap.xml', sitemapXml(web, baseDeLaWeb(web, window.location.origin)), 'application/xml')}
          >
            Descargar sitemap.xml
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => descargarTexto('robots.txt', robotsTxt(web, baseDeLaWeb(web, window.location.origin)), 'text/plain')}
          >
            Descargar robots.txt
          </button>
        </div>
        <p className="form-hint">
          {rutasDeLaWeb(web).length} {rutasDeLaWeb(web).length === 1 ? 'página' : 'páginas'} en el
          sitemap. {!web.publicada && 'Mientras la web no esté publicada, el robots pide a los buscadores que no la indexen: si Google indexa una hermandad a medio hacer, luego cuesta meses quitarlo.'}
        </p>

        <div className="banner-inline banner-inline--accent" style={{ marginTop: '0.8rem' }}>
          <span>
            <b>Lo que Google sí ve.</b> El título, la descripción, la dirección buena de cada
            página, el escudo en la pestaña y los datos de cada culto (con su fecha y su hora) ya
            van puestos: Google ejecuta JavaScript al indexar y los lee.
          </span>
        </div>
        <div className="banner-inline banner-inline--warn">
          <span>
            <b>Lo que WhatsApp todavía no ve.</b> WhatsApp y Facebook no ejecutan JavaScript: piden
            el HTML y leen lo que hay. Para que la vista previa del enlace diga el nombre de tu
            hermandad y no el de Gobergo, hace falta encender la parte de servidor. Está escrita y
            lista: son dos pasos, y están explicados en <code>docs/SEO.md</code>.
          </span>
        </div>
      </section>
    </>
  )
}

/**
 * Un campo de contacto vacío: lo que NO se publica, y el atajo para llenarlo.
 *
 * La web ya no hereda el contacto de Configuración (ver `contactoPublico.ts`):
 * vacío es vacío. Así que aquí se dice eso —y, si en Configuración hay algo,
 * se ofrece copiarlo de un clic. Lo copiado queda ESCRITO en el campo, a la
 * vista, en vez de publicarse por debajo como antes.
 */
