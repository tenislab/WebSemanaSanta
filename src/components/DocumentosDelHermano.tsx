import { useState } from 'react'
import { formatearTamano, leerArchivo } from '../lib/filestore'
import { type Documento } from '../data/documentos'

/**
 * LOS DOCUMENTOS QUE LA HERMANDAD LE DEJA VER AL HERMANO.
 *
 * Hasta ahora el área del hermano no tenía documentos por ningún camino: ni
 * las reglas, ni el reglamento de régimen interno, ni un boletín. Y el
 * formulario del panel decía «Quién puede verlo: Todos los hermanos», así que
 * la secretaría lo marcaba y daba por hecho que el hermano los tenía.
 *
 * QUÉ SALE AQUÍ: lo marcado para los hermanos y lo marcado para la web. Lo
 * segundo también, y no es un descuido: lo que está colgado en internet lo
 * puede ver cualquiera, así que esconderlo al hermano —que es quien más
 * derecho tiene— sería absurdo. Y se dice cuál es cuál, porque a un hermano le
 * importa saber si lo que está leyendo es público o es de casa.
 *
 * EL FILTRO VA DOS VECES, y a propósito. La base ya solo le manda lo que
 * puede ver (`documentos_hermano_select`), pero el espejo del navegador —el
 * `localStorage` que hace que la pantalla pinte antes de que llegue la red—
 * puede traer filas de cuando esa sesión era de secretaría. Fiarse solo del
 * servidor es correcto en la base y temerario en la pantalla.
 */
export default function DocumentosDelHermano({ documentos }: { documentos: Documento[] }) {
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const mios = documentos
    .filter((d) => d.publicacion === 'hermanos' || d.publicacion === 'web')
    /*
     * Y NUNCA LO RESTRINGIDO A CARGOS. No puede estar marcado para salir —lo
     * frena un `check` de la tabla—, así que esto no debería hacer nada. Está
     * porque es la clase de cosa que un día deja de ser verdad por una
     * migración a medias, y el precio de equivocarse aquí es un acta reservada
     * en la pantalla de un hermano.
     */
    .filter((d) => !d.cargosConAcceso || d.cargosConAcceso.length === 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  if (mios.length === 0) return null

  async function abrir(doc: Documento) {
    setFallo(null)
    setAbriendo(doc.id)
    try {
      const blob = await leerArchivo(doc.id)
      if (!blob) {
        /*
         * SE DICE QUE NO ESTÁ. La ficha del documento y el fichero viven en
         * sitios distintos —una fila y un cubo—, así que puede haber ficha sin
         * fichero: un adjunto borrado, o una copia restaurada a medias. Antes
         * de esto, el panel se quedaba callado y parecía que el botón no
         * funcionaba.
         */
        setFallo('Ese documento no tiene archivo guardado. Pídeselo a la secretaría.')
        return
      }
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      // El objeto se suelta en cuanto el navegador ha tenido tiempo de abrirlo:
      // revocarlo en la línea siguiente deja la pestaña en blanco.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      setFallo('No se ha podido abrir el documento. Vuelve a intentarlo en un momento.')
    } finally {
      setAbriendo(null)
    }
  }

  return (
    <section className="portal__section">
      <h2>Documentos de la hermandad</h2>
      <p className="form-hint">
        Las reglas, los reglamentos y lo que la hermandad publica. Lo que no está aquí es porque es
        de uso interno de la junta.
      </p>
      <ul className="documentos">
        {mios.map((d) => (
          <li key={d.id} className="documentos__fila">
            <div className="documentos__que">
              <b>{d.nombre}</b>
              <span className="table-subtle">
                {d.categoria}
                {d.fecha && ` · ${d.fecha}`}
                {/* Que sepa si lo que lee está en internet o es de casa. */}
                {d.publicacion === 'web' ? ' · también en la web' : ' · solo para hermanos'}
                {d.archivoTamano ? ` · ${formatearTamano(d.archivoTamano)}` : ''}
              </span>
              {d.descripcion && <span className="table-subtle">{d.descripcion}</span>}
            </div>
            <div className="documentos__acciones">
              {d.archivoNombre ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={abriendo === d.id}
                  onClick={() => void abrir(d)}
                >
                  {abriendo === d.id ? 'Abriendo…' : 'Ver / descargar'}
                </button>
              ) : (
                /* Sin adjunto no se ofrece un botón que no va a hacer nada:
                   un botón que no responde se pulsa tres veces y luego se
                   cuenta como que la aplicación no funciona. */
                <span className="table-muted">Sin archivo</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {fallo && <p className="form-hint form-hint--error">{fallo}</p>}
    </section>
  )
}
