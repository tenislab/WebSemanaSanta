/** El panel que enseña lo que le falta a la web, con su enlace a cada pestaña. */
import { useState } from 'react'
import { COMPROBACIONES_WEB, type AvisoWeb } from './avisos'
import { type Pestana } from './pestanas'

export function AvisosWeb({ avisos, irA }: { avisos: AvisoWeb[]; irA: (p: Pestana) => void }) {
  const graves = avisos.filter((a) => a.grave)
  // Se despliega solo si hay algo grave; con detalles sueltos no merece la pena
  // robarle media pantalla al editor. No se congela en el primer render: un
  // aviso grave que aparece después (al borrar la dirección) tiene que salir.
  const [abiertoManual, setAbiertoManual] = useState<boolean | null>(null)
  const abierto = abiertoManual ?? graves.length > 0
  const hechos = COMPROBACIONES_WEB - avisos.length
  const pct = Math.round((hechos / COMPROBACIONES_WEB) * 100)

  if (avisos.length === 0) {
    return (
      <p className="cms-avisos cms-avisos--ok">
        <span className="cms-avisos__icono" aria-hidden="true">✓</span>
        Tu web está completa: portada, historia, titulares, cultos, contacto y aviso legal.
      </p>
    )
  }

  // Primero lo grave: sin dirección ni forma de contactar, la web no sirve.
  const ordenados = [...avisos].sort((a, b) => Number(!!b.grave) - Number(!!a.grave))

  return (
    <section className={`cms-avisos${graves.length ? ' cms-avisos--grave' : ''}`}>
      <button
        type="button"
        className="cms-progreso"
        onClick={() => setAbiertoManual(!abierto)}
        aria-expanded={abierto}
      >
        <span className="cms-progreso__pct">{pct} %</span>
        <span
          className="cms-progreso__barra"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Lo que llevas hecho de la web"
        >
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="cms-progreso__texto">
          {graves.length > 0
            ? `${graves.length} ${graves.length === 1 ? 'cosa importante' : 'cosas importantes'} y ${avisos.length - graves.length} ${avisos.length - graves.length === 1 ? 'detalle' : 'detalles'}`
            : `${avisos.length} ${avisos.length === 1 ? 'detalle' : 'detalles'} por rematar`}
        </span>
        <span className="cms-progreso__flecha" aria-hidden="true">{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <ul className="cms-avisos__lista">
          {ordenados.map((a) => (
            <li key={a.id}>
              {a.grave && <span className="cms-avisos__marca" aria-hidden="true">!</span>}
              <span>{a.texto}</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => irA(a.pestana)}>Arreglar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* --------------------------- Cabecera y pie --------------------------- */
