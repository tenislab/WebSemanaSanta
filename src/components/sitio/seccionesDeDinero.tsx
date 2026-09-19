import type { MarcaDeSeccion, PropsDeSeccion, Titulo } from './comun'
import { Tienda } from './Tienda'
import { FormularioDonativo, FormularioLoteria } from '../FormulariosWeb'
import { SECCIONES_INFO, urlSegura } from '../../lib/webPublica'

/**
 * LO QUE PIDE DINERO.
 *
 * Donativos, tienda y lotería, agrupadas igual que en el editor
 * (`web/TabsDeDinero.tsx`). Y las tres con el mismo cuidado: una sección que
 * dice «colabora» y no dice cómo no sirve para nada.
 *
 * No son componentes: son funciones que devuelven JSX y que llama `Seccion`.
 * Ver el porqué en `comun.ts`.
 */

export function pintarDonativos(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  const d = sec.web.donativos
  const bizum = d.bizum.trim() || sec.hermandad.bizumTelefono
  const iban = d.iban.trim() || sec.hermandad.iban
  const pasarela = urlSegura(d.enlacePasarela)
  if (!bizum && !iban && !pasarela) return null
  if (!d.entradilla.trim() && !d.texto.trim() && d.causas.length === 0) return null
  return (
    <section id="donativos" {...marca}>
      <h2>{titulo(SECCIONES_INFO.donativos.publico)}</h2>
      {d.entradilla.trim() && <p className="sitio__entradilla">{d.entradilla}</p>}
      {d.texto.trim() && <p className="sitio__parrafo">{d.texto}</p>}
      {d.causas.length > 0 && (
        <ul className="sitio__causas">
          {d.causas.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
      {/* Si hay pasarela contratada, manda ella: es el único camino en el que
          el visitante paga sin salir de la sec.web. */}
      {pasarela && (
        <p className="sitio__cta">
          <a
            href={sec.interactivo ? pasarela : undefined}
            {...(sec.interactivo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="sitio-btn"
          >
            {d.textoPasarela.trim() || 'Donar ahora'}
          </a>
        </p>
      )}
      <div className="sitio__cobros">
        {bizum && (
          <div className="sitio__cobro">
            <span className="sitio__cobro-titulo">Bizum</span>
            <span className="sitio__cobro-dato">{bizum}</span>
          </div>
        )}
        {iban && (
          <div className="sitio__cobro">
            <span className="sitio__cobro-titulo">Transferencia</span>
            <span className="sitio__cobro-dato">{iban}</span>
          </div>
        )}
        {d.concepto.trim() && (
          <div className="sitio__cobro">
            <span className="sitio__cobro-titulo">En el concepto</span>
            <span className="sitio__cobro-dato">{d.concepto}</span>
          </div>
        )}
      </div>
      {d.avisoDonativo && (
        <FormularioDonativo
          interactivo={sec.interactivo}
          textoProteccionDatos={sec.web.textoProteccionDatos}
          importes={d.importes}
          causas={d.causas}
        />
      )}
    </section>
  )
}

export function pintarTienda(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  return (
    <section id="tienda" {...marca}>
      <h2>{titulo(SECCIONES_INFO.tienda.publico)}</h2>
      <Tienda web={sec.web} interactivo={sec.interactivo} />
    </section>
  )
}

export function pintarLoteria(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  const l = sec.web.loteria
  if (!l.numero.trim() && !l.sorteo.trim()) return null
  const datos = [
    l.juega > 0 && { k: 'Juega', v: `${l.juega} €` },
    l.precio > 0 && { k: 'Donativo incluido', v: `${l.precio} €` },
    l.destinoDonativo.trim() && { k: 'El donativo va a', v: l.destinoDonativo },
    l.dondeRecoger.trim() && { k: 'Se recoge en', v: l.dondeRecoger },
  ].filter(Boolean) as { k: string; v: string }[]
  return (
    <section id="loteria" {...marca}>
      <h2>{titulo(SECCIONES_INFO.loteria.publico)}</h2>
      {l.sorteo.trim() && <p className="sitio__entradilla">{l.sorteo}</p>}
      {l.numero.trim() && (
        <p className="sitio__loteria-numero" aria-label={`Número ${l.numero}`}>{l.numero}</p>
      )}
      {l.texto.trim() && <p className="sitio__parrafo">{l.texto}</p>}
      {datos.length > 0 && (
        <dl className="sitio__estacion-datos">
          {datos.map((x) => <div key={x.k}><dt>{x.k}</dt><dd>{x.v}</dd></div>)}
        </dl>
      )}
      {l.reservaAbierta ? (
        <FormularioLoteria
          interactivo={sec.interactivo}
          textoProteccionDatos={sec.web.textoProteccionDatos}
          maximo={l.maxPorPersona}
          precio={l.precio}
          dondeRecoger={l.dondeRecoger}
        />
      ) : (
        <p className="sitio__parrafo sitio__loteria-cerrada">
          La reserva por internet está cerrada. Puedes preguntar en la casa de hermandad.
        </p>
      )}
    </section>
  )
}

