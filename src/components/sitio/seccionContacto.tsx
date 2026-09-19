import type { MarcaDeSeccion, PropsDeSeccion, Titulo } from './comun'
import { FormularioContacto } from '../FormulariosWeb'
import { SECCIONES_INFO, urlMapaIncrustado, urlSegura } from '../../lib/webPublica'

/**
 * EL CONTACTO.
 *
 * Dirección, teléfono, correo, horarios y el formulario. Y NO hereda nada de
 * Configuración: esos son los datos personales de quien lleva la secretaría,
 * no los de la hermandad. Ver `pruebas/contactopublico.prueba.mjs`.
 *
 * No son componentes: son funciones que devuelven JSX y que llama `Seccion`.
 * Ver el porqué en `comun.ts`.
 */

export function pintarContacto(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  const dir = sec.web.direccion
  const tel = sec.web.telefono
  const email = sec.web.email
  // Sin ningún dato de contacto la sección no se pinta… salvo que haya
  // formulario: entonces sigue habiendo por dónde escribir a la hermandad.
  if (!dir && !tel && !email && !sec.web.mapaUrl && sec.web.horarios.length === 0 && !sec.web.formularioContacto) return null
  const mapa = sec.web.mapaIncrustado ? urlMapaIncrustado(sec.web.mapaUrl, dir) : null
  const enlaceMapa = urlSegura(sec.web.mapaUrl)
  return (
    <section id="contacto" {...marca}>
      <h2>{titulo(SECCIONES_INFO.contacto.publico)}</h2>
      {/* Sin mapa no se monta la rejilla: los datos ocupaban media columna
          y dejaban un hueco enorme al lado. */}
      <div className={mapa ? 'sitio__contacto-grid' : undefined}>
        <div>
          <ul className="sitio__contacto">
            {dir && <li>{dir}</li>}
            {tel && <li>Tel. <a href={sec.interactivo ? `tel:${tel.replace(/\s+/g, '')}` : undefined}>{tel}</a></li>}
            {email && <li><a href={sec.interactivo ? `mailto:${email}` : undefined}>{email}</a></li>}
          </ul>
          {sec.web.horarios.length > 0 && (
            <div className="sitio__horario">
              <h3>Cuándo atendemos</h3>
              <ul>
                {sec.web.horarios.map((f) => (
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
              href={sec.interactivo ? enlaceMapa : undefined}
              {...(sec.interactivo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
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
      {sec.web.formularioContacto && (
        <FormularioContacto interactivo={sec.interactivo} textoProteccionDatos={sec.web.textoProteccionDatos} />
      )}
    </section>
  )
}

