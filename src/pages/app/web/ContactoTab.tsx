/**
 * CONTACTO: qué datos de la hermandad se publican y qué no.
 *
 * La pestaña con más cuidado puesto de todas: aquí se decide qué teléfono y
 * qué correo acaban en una página pública, y por defecto NO se publica el
 * contacto personal de quien monta la web. Ver `lib/contactoPublico.ts`.
 */
import AvisoDeCampo from '../../../components/AvisoDeCampo'
import {
  avisoDeDatoPersonal,
  contactoQueSePublica,
  loQueHayEnConfiguracion,
} from '../../../lib/contactoPublico'
import { type HermandadSettings } from '../../../lib/hermandadSettings'
import { nuevoId } from '../../../lib/supabaseSync'
import { problemaDeTelefono } from '../../../lib/telefono'
import {
  esDeGoogleMaps,
  urlMapaIncrustado,
  type RedWeb,
  type TipoRed,
  type WebPublica,
} from '../../../lib/webPublica'
import { Link } from 'react-router-dom'
import { LoQueSePublica } from './LoQueSePublica'
import { type EditarFn } from './comun'
import { REDES } from './pestanas'

export function ContactoTab({ web, hermandad, editar }: { web: WebPublica; hermandad: HermandadSettings; editar: EditarFn }) {
  function editarRed(id: string, c: Partial<RedWeb>) { editar('redes', (xs) => xs.map((r) => (r.id === id ? { ...r, ...c } : r))) }
  const publicado = contactoQueSePublica(web)
  const direccion = publicado.direccion.valor
  const mapa = urlMapaIncrustado(web.mapaUrl, direccion)
  // Un enlace que no es de Google Maps no se incrusta a propósito: un iframe a
  // cualquier sitio es un agujero en la web pública.
  const enlaceNoIncrustable = Boolean(web.mapaUrl.trim()) && !esDeGoogleMaps(web.mapaUrl)

  return (
    <>
      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Dónde estáis y cómo contactar</h2></div>
        {/*
          La web publica SOLO esto, y vacío no publica nada. Antes heredaba lo
          de Configuración —que es interno, el de los recibos— y así acabó
          publicado el móvil y el gmail personales del secretario sin que nadie
          lo hubiera decidido. Si los datos de Configuración SON los que se
          quieren publicar, el botón de cada campo los copia aquí.
        */}
        <p className="form-hint">
          Esto es lo único que se publica. Un campo vacío <b>no publica nada</b>: lo de{' '}
          <Link to="/app/configuracion">Configuración</Link> es interno —identifica a la hermandad
          en los recibos— y no sale a la web por su cuenta.
        </p>
        <div className="form-row">
          <label htmlFor="direccion">Dirección</label>
          <input id="direccion" type="text" value={web.direccion} onChange={(e) => editar('direccion', e.target.value)} placeholder="Calle, número, ciudad" />
          <LoQueSePublica
            dato={publicado.direccion}
            deConfiguracion={loQueHayEnConfiguracion(hermandad, 'direccion')}
            onCopiar={(v) => editar('direccion', v)}
          />
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="telefono">Teléfono</label>
            <input id="telefono" type="tel" inputMode="tel" value={web.telefono} onChange={(e) => editar('telefono', e.target.value)} placeholder="954 00 00 00" />
            {/* Primero QUÉ se publica y luego el reparo: un aviso sobre un dato
                que todavía no se ha dicho se lee dos veces. */}
            <LoQueSePublica
              dato={publicado.telefono}
              deConfiguracion={loQueHayEnConfiguracion(hermandad, 'telefono')}
              onCopiar={(v) => editar('telefono', v)}
            />
            <AvisoDeCampo texto={problemaDeTelefono(web.telefono) ?? avisoDeDatoPersonal(publicado.telefono, 'telefono')} />
          </div>
          <div className="form-row">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" value={web.email} onChange={(e) => editar('email', e.target.value)} placeholder="secretaria@…" />
            <LoQueSePublica
              dato={publicado.email}
              deConfiguracion={loQueHayEnConfiguracion(hermandad, 'email')}
              onCopiar={(v) => editar('email', v)}
            />
            <AvisoDeCampo texto={avisoDeDatoPersonal(publicado.email, 'email')} />
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Horario de secretaría</h2>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => editar('horarios', (xs) => [...xs, { id: nuevoId(), dias: '', horas: '', nota: '' }])}
          >
            + Añadir franja
          </button>
        </div>
        <p className="form-hint">
          Cuándo se atiende y para qué. Es de lo que más se pregunta por teléfono, y si está en la
          web se pregunta bastante menos.
        </p>
        {web.horarios.length === 0 && <p className="form-hint">Sin franjas, la web no enseña ningún horario.</p>}
        <div className="opciones-editor">
          {web.horarios.map((f) => (
            <div className="opcion-row opcion-row--horario" key={f.id}>
              <input
                type="text" value={f.dias} placeholder="Martes y jueves" aria-label="Días"
                onChange={(e) => editar('horarios', (xs) => xs.map((x) => (x.id === f.id ? { ...x, dias: e.target.value } : x)))}
              />
              <input
                type="text" value={f.horas} placeholder="de 20:00 a 21:30" aria-label="Horas"
                onChange={(e) => editar('horarios', (xs) => xs.map((x) => (x.id === f.id ? { ...x, horas: e.target.value } : x)))}
              />
              <input
                type="text" value={f.nota} placeholder="Para qué (opcional)" aria-label="Para qué"
                onChange={(e) => editar('horarios', (xs) => xs.map((x) => (x.id === f.id ? { ...x, nota: e.target.value } : x)))}
              />
              <button
                type="button" className="icon-btn" title="Quitar franja"
                onClick={() => editar('horarios', (xs) => xs.filter((x) => x.id !== f.id))}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head"><h2 className="settings-card__title">Mapa</h2></div>
        <label className="checkbox">
          <input type="checkbox" checked={web.mapaIncrustado} onChange={(e) => editar('mapaIncrustado', e.target.checked)} />
          <span>Enseñar el mapa dentro de la web</span>
        </label>
        <p className="form-hint">
          Con la dirección de arriba ya se dibuja el mapa: no hace falta poner nada más. El enlace
          solo hace falta si quieres apuntar a un sitio concreto de Google Maps.
        </p>
        <div className="form-row">
          <label htmlFor="mapaUrl">Enlace de Google Maps (opcional)</label>
          <input id="mapaUrl" type="text" value={web.mapaUrl} onChange={(e) => editar('mapaUrl', e.target.value)} placeholder="https://maps.app.goo.gl/…" />
        </div>
        {enlaceNoIncrustable && (
          <p className="form-hint form-hint--alerta">
            Ese enlace no es de Google Maps: se publicará como botón «Cómo llegar», pero el mapa
            dibujado se saca de la dirección. Por seguridad no incrustamos páginas de fuera.
          </p>
        )}
        {web.mapaIncrustado && !mapa && !web.mapaUrl.trim() && (
          <p className="form-hint form-hint--alerta">Sin dirección no hay mapa que enseñar.</p>
        )}
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <h2 className="settings-card__title">Redes sociales</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => editar('redes', (xs) => [...xs, { id: nuevoId(), tipo: 'Instagram', url: '' }])}>+ Añadir red</button>
        </div>
        {web.redes.length === 0 && <p className="form-hint">Salen en el pie de la web y en la sección de contacto.</p>}
        {web.redes.map((r) => (
          <div className="assign-box__row" key={r.id} style={{ marginTop: '0.5rem' }}>
            <select value={r.tipo} onChange={(e) => editarRed(r.id, { tipo: e.target.value as TipoRed })} aria-label="Red social">{REDES.map((red) => <option key={red} value={red}>{red}</option>)}</select>
            <input type="text" value={r.url} onChange={(e) => editarRed(r.id, { url: e.target.value })} placeholder="https://instagram.com/…" aria-label="Dirección del perfil" />
            <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => editar('redes', (xs) => xs.filter((x) => x.id !== r.id))}>Quitar</button>
          </div>
        ))}
        <p className="form-hint" style={{ marginTop: '0.8rem' }}>
          El texto del pie y el aviso legal están en <b>Cabecera y pie</b>.
        </p>
      </section>
    </>
  )
}
