import type { Dispatch, SetStateAction } from 'react'
import type { MarcaDeSeccion, PropsDeSeccion, Titulo } from './comun'
import { BotonEntrar, Contenido } from './piezas'
import { FormularioAlta } from '../FormulariosWeb'
import { SECCIONES_INFO, contenidoVacio } from '../../lib/webPublica'

/**
 * LAS SECCIONES DE LA HERMANDAD.
 *
 * Quién es, de dónde viene, quién la gobierna y cómo hacerse hermano. Se
 * agrupan igual que en el editor (`web/TabsDeLaHermandad.tsx`), que es el
 * reparto que ya usa el proyecto.
 *
 * No son componentes: son funciones que devuelven JSX y que llama `Seccion`.
 * Ver el porqué en `comun.ts`.
 */

export function pintarHistoria(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  if (contenidoVacio(sec.web.historia)) return null
  return (
    <section id="historia" {...marca}>
      <h2>{titulo(SECCIONES_INFO.historia.publico)}</h2>
      <Contenido c={sec.web.historia} />
    </section>
  )
}

export function pintarHazte(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion, altaAbierta: boolean, setAltaAbierta: Dispatch<SetStateAction<boolean>>) {
  const h = sec.web.hazte
  if (!h.entradilla.trim() && h.requisitos.length === 0 && h.pasos.length === 0 && !h.cuota.trim()) return null
  return (
    <section id="hazte" {...marca}>
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
          {/* Pedir el alta sin salir de la sec.web es lo que más convierte: quien
              se va al área del hermano a buscar dónde apuntarse, no vuelve. */}
          {sec.web.altaDesdeWeb ? (
            <button
              type="button"
              className="sitio-btn"
              aria-expanded={altaAbierta}
              onClick={() => setAltaAbierta((v) => !v)}
            >
              {h.textoBoton}
            </button>
          ) : h.alAreaDelHermano ? (
            <BotonEntrar interactivo={sec.interactivo} clase="sitio-btn">{h.textoBoton}</BotonEntrar>
          ) : (
            <a href={sec.interactivo ? '#contacto' : undefined} className="sitio-btn">{h.textoBoton}</a>
          )}
        </p>
      )}
      {sec.web.altaDesdeWeb && altaAbierta && (
        <FormularioAlta
          interactivo={sec.interactivo}
          textoProteccionDatos={sec.web.textoProteccionDatos}
          onCerrar={() => setAltaAbierta(false)}
        />
      )}
      {sec.web.altaDesdeWeb && (
        <p className="sitio__hazte-yasoy">
          ¿Ya eres hermano/a? <BotonEntrar interactivo={sec.interactivo} clase="sitio-enlace">Entra en tu área</BotonEntrar>
        </p>
      )}
    </section>
  )
}

export function pintarEstacion(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  const e = sec.web.estacion
  if (!e.dia.trim() && !e.horaSalida.trim() && e.itinerario.length === 0) return null
  const datos = [
    e.horaSalida.trim() && { k: 'Salida', v: e.horaSalida },
    e.salidaDesde.trim() && { k: 'Desde', v: e.salidaDesde },
    e.horaEntrada.trim() && { k: 'Entrada', v: e.horaEntrada },
  ].filter(Boolean) as { k: string; v: string }[]
  return (
    <section id="estacion" {...marca}>
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

export function pintarJunta(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  const miembros = sec.web.junta.filter((m) => m.cargo.trim() || m.nombre.trim())
  if (miembros.length === 0) return null
  return (
    <section id="junta" {...marca}>
      <h2>{titulo(SECCIONES_INFO.junta.publico)}</h2>
      <ul className="sitio__junta">
        {miembros.map((m) => (
          <li key={m.id}>
            <span className="sitio__junta-cargo">{m.cargo}</span>
            <span className="sitio__junta-sec.nombre">{m.nombre}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

