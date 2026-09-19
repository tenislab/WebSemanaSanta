import type { MarcaDeSeccion, PropsDeSeccion, Titulo } from './comun'
import { FormularioAvisos } from '../FormulariosWeb'
import { Link } from 'react-router-dom'
import { SECCIONES_INFO, cartelesOrdenados, slugCulto } from '../../lib/webPublica'
import { baseDeRutas } from '../../lib/seoWeb'

/**
 * LOS CULTOS Y EL CARTEL.
 *
 * Lo que la hermandad celebra y el cartel del año. Van juntos porque son las
 * dos cosas que cambian de Cuaresma a Cuaresma y se miran a la vez.
 *
 * No son componentes: son funciones que devuelven JSX y que llama `Seccion`.
 * Ver el porqué en `comun.ts`.
 */

export function pintarCultos(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  if (sec.cultos.length === 0) return null
  return (
    <section id="cultos" {...marca}>
      <h2>{titulo(SECCIONES_INFO.cultos.publico)}</h2>
      <div className="sitio__cultos">
        {sec.cultos.map((c) => (
          <article key={c.id} className="sitio__culto">
            {c.fotoDataUrl && <img className="sitio__culto-foto" src={c.fotoDataUrl} alt="" loading="lazy" decoding="async" />}
            <h3>
              {/*
                Cada culto lleva a SU página. Es el enlace que se pega en el
                grupo cuando se anuncia un quinario: antes había que mandar
                la portada entera y decir «baja hasta sec.cultos».

                En la vista previa del panel no navega —`interactivo`—: ahí
                pulsarlo sacaría a la sec.hermandad del editor.
              */}
              {sec.interactivo
                ? <Link to={`${baseDeRutas(sec.web)}/c/${slugCulto(c)}`}>{c.titulo}</Link>
                : c.titulo}
            </h3>
            {(c.fecha?.trim() || c.lugar?.trim()) && (
              <p className="sitio__culto-cuando">
                {[c.fecha, c.lugar].filter((x) => x?.trim()).join(' · ')}
              </p>
            )}
            {c.detalle && <p>{c.detalle}</p>}
          </article>
        ))}
      </div>
      {/*
        «Avísame de los sec.cultos», JUSTO AQUÍ y no en Contacto.
        Quien acaba de leer que hay quinario es exactamente el que quiere que
        se lo recuerden. Metido al final de la sec.web, en el formulario de
        contacto, lo rellena quien ya venía buscándolo — o sea, casi nadie.
      */}
      {sec.web.avisosDeCultos && (
        <FormularioAvisos interactivo={sec.interactivo} nombreHermandad={sec.hermandad.nombreLegal ?? sec.web.titulo} />
      )}
    </section>
  )
}

  /*
   * EL CARTEL. Se enseña grande y solo: es la pieza que se comparte, y
   * metida en una rejilla con otras cosas deja de serlo. Debajo, la ficha
   * —autor, técnica, presentación— que es lo que nadie encuentra cuando el
   * cartel se sube como una foto más de la galería.
   *
   * Y los de años anteriores en una tira pequeña: la colección de carteles de
   * una hermandad es media historia gráfica, y ocupa lo que ocupa una fila.
   */
export function pintarCartel(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  const conImagen = cartelesOrdenados(sec.web.carteles ?? []).filter((c) => c.imagenDataUrl)
  if (conImagen.length === 0) return null
  const [actual, ...anteriores] = conImagen
  return (
    <section id="cartel" {...marca}>
      <h2>{titulo(SECCIONES_INFO.cartel.publico)}</h2>
      <div className="sitio__cartel">
        <figure className="sitio__cartel-obra">
          <img
            src={actual.imagenDataUrl as string}
            alt={actual.alt.trim() || actual.titulo || 'Cartel'}
            loading="lazy"
            decoding="async"
          />
        </figure>
        <div className="sitio__cartel-ficha">
          {actual.anio.trim() && <p className="sitio__cartel-anio">{actual.anio}</p>}
          <h3>{actual.titulo || `Cartel ${actual.anio}`}</h3>
          <dl className="sitio__cartel-datos">
            {actual.autor.trim() && (
              <div><dt>Autor</dt><dd>{actual.autor}</dd></div>
            )}
            {actual.tecnica.trim() && (
              <div><dt>Técnica</dt><dd>{actual.tecnica}</dd></div>
            )}
            {actual.presentacion.trim() && (
              <div><dt>Presentación</dt><dd>{actual.presentacion}</dd></div>
            )}
          </dl>
          {actual.texto.trim() && <p className="sitio__cartel-texto">{actual.texto}</p>}
        </div>
      </div>
      {anteriores.length > 0 && (
        <div className="sitio__cartel-antes">
          <h3>Carteles anteriores</h3>
          <ul className="sitio__cartel-tira">
            {anteriores.map((c) => (
              <li key={c.id}>
                <img
                  src={c.imagenDataUrl as string}
                  alt={c.alt.trim() || c.titulo || `Cartel ${c.anio}`}
                  loading="lazy"
                  decoding="async"
                />
                <span>{c.anio || c.titulo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

