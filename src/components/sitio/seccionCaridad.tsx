import type { MarcaDeSeccion, PropsDeSeccion, Titulo } from './comun'
import { SECCIONES_INFO } from '../../lib/webPublica'

/**
 * LA BOLSA DE CARIDAD.
 *
 * En su propio fichero, como en el editor (`web/CaridadTab.tsx`): son setenta
 * y cinco líneas con cifras, párrafos, con quién se colabora y cómo ayudar.
 *
 * No son componentes: son funciones que devuelven JSX y que llama `Seccion`.
 * Ver el porqué en `comun.ts`.
 */

  /*
   * LA CARIDAD, con las cifras delante.
   *
   * Es la pregunta que llega de fuera —«¿y esto en qué se gasta?»— y hasta
   * ahora la respuesta estaba en un párrafo dentro de Historia. Las cifras van
   * primero y en grande porque una obra social contada solo con adjetivos no
   * convence a nadie, y porque son lo único de esta sección que se lee entero
   * desde un móvil.
   */
export function pintarCaridad(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  const c = sec.web.caridad
  const conTexto = c.parrafos.filter((p) => p.texto.trim() || p.subtitulo.trim())
  if (!c.entradilla.trim() && c.cifras.length === 0 && conTexto.length === 0
    && c.comoAyudar.length === 0 && c.conQuien.length === 0) return null
  const correo = c.correo.trim() || sec.web.email || ''
  return (
    <section id="caridad" {...marca}>
      <h2>{titulo(SECCIONES_INFO.caridad.publico)}</h2>
      {c.entradilla.trim() && <p className="sitio__entradilla">{c.entradilla}</p>}
      {c.cifras.length > 0 && (
        <ul className="sitio__caridad-cifras">
          {c.cifras.map((x) => (
            <li key={x.id}>
              <strong>{x.cifra}</strong>
              <span>{x.concepto}</span>
            </li>
          ))}
        </ul>
      )}
      {conTexto.length > 0 && (
        <div className="sitio__caridad-texto">
          {conTexto.map((p) => (
            <div key={p.id}>
              {p.subtitulo.trim() && <h3>{p.subtitulo}</h3>}
              {p.texto.trim() && <p>{p.texto}</p>}
            </div>
          ))}
        </div>
      )}
      {c.fotos.length > 0 && (
        <div className="sitio__caridad-fotos">
          {c.fotos.map((f, i) => (
            <img key={i} src={f.url} alt={f.alt} loading="lazy" decoding="async" />
          ))}
        </div>
      )}
      <div className="sitio__caridad-abajo">
        {c.comoAyudar.length > 0 && (
          <div className="sitio__caridad-bloque">
            <h3>Cómo ayudar</h3>
            <ul className="sitio__lista-marcada">
              {c.comoAyudar.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
            {/* El correo, aquí y no en Contacto: quien acaba de leer esto es
                justo el que quiere escribir, y mandarlo a buscar el
                formulario al final de la web es perderlo. */}
            {correo && (
              <p className="sitio__caridad-correo">
                Escríbenos a <a href={`mailto:${correo}`}>{correo}</a>
              </p>
            )}
          </div>
        )}
        {c.conQuien.length > 0 && (
          <div className="sitio__caridad-bloque">
            <h3>Con quién trabajamos</h3>
            <ul className="sitio__caridad-entidades">
              {c.conQuien.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

