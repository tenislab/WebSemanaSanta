import { aCentimos } from '../../../lib/format'
import { ofrecerDeshacer, reinsertar } from '../../../lib/deshacer'
import { saveConceptosCuota } from '../../../lib/conceptosCuota'
import { saveLista } from '../../../lib/catalogos'

/**
 * LOS CATÁLOGOS DE LA HERMANDAD Y SUS CONCEPTOS DE CUOTA.
 *
 * Las listas que la hermandad rellena a su manera —cargos, canales, segmentos,
 * tipos de documento— y los conceptos por los que cobra, cada uno con su
 * importe y su periodicidad.
 *
 * NO TOMA NADA DE LA PANTALLA. Cero entradas: se trae sus propias listas, las
 * edita y las guarda. Es la única sección de Ajustes que es de verdad
 * independiente, y por eso el hook vive DENTRO del componente en vez de subir
 * a la pantalla: nadie más lo necesita.
 *
 * UNA PROP, `abierta`, y nada más.
 */
import { useEffect, useState } from 'react'
import { CATALOGOS_DEF } from './catalogosDef'
import { useCatalogos } from '../../../lib/catalogos'
import { useConceptosCuota, type ConceptoCuotaConfig } from '../../../lib/conceptosCuota'
import { nuevoId } from '../../../lib/supabaseSync'

export default function CatalogosYCuotas({ abierta }: { abierta: boolean }) {
  // ---- Catálogos de la hermandad (conceptos de cuota + listas simples) ----
  const conceptosCuotaRemotos = useConceptosCuota()
  const [conceptosCuota, setConceptosCuota] = useState<ConceptoCuotaConfig[]>(conceptosCuotaRemotos)
  const catalogosRemotos = useCatalogos(CATALOGOS_DEF)
  const [catalogos, setCatalogos] = useState<Record<string, string[]>>(catalogosRemotos)
  const [catalogosTocado, setCatalogosTocado] = useState(false)
  useEffect(() => {
    if (!catalogosTocado) {
      setConceptosCuota(conceptosCuotaRemotos)
      setCatalogos(catalogosRemotos)
    }
  }, [conceptosCuotaRemotos, catalogosRemotos, catalogosTocado])
  const [catalogosSaved, setCatalogosSaved] = useState(false)

  function updateConceptoCuota<K extends keyof ConceptoCuotaConfig>(id: string, key: K, value: ConceptoCuotaConfig[K]) {
    setConceptosCuota((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function addConceptoCuota() {
    setConceptosCuota((prev) => [...prev, { id: nuevoId(), nombre: 'Nueva cuota', importe: 10 }])
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function removeConceptoCuota(id: string) {
    const posicion = conceptosCuota.findIndex((c) => c.id === id)
    const concepto = conceptosCuota[posicion]
    setConceptosCuota((prev) => prev.filter((c) => c.id !== id))
    if (concepto) {
      ofrecerDeshacer(`Cuota «${concepto.nombre}» quitada del catálogo`, () => {
        setConceptosCuota((prev) => reinsertar(prev, concepto, posicion))
        setCatalogosTocado(true)
      })
    }
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function updateCatalogo(k: string, index: number, valor: string) {
    setCatalogos((prev) => ({ ...prev, [k]: prev[k].map((v, i) => (i === index ? valor : v)) }))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function addCatalogoValor(k: string) {
    setCatalogos((prev) => ({ ...prev, [k]: [...prev[k], ''] }))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  function removeCatalogoValor(k: string, index: number) {
    setCatalogos((prev) => ({ ...prev, [k]: prev[k].filter((_, i) => i !== index) }))
    setCatalogosTocado(true)
    setCatalogosSaved(false)
  }

  const [catalogosError, setCatalogosError] = useState<string | null>(null)

  async function handleSaveCatalogos() {
    /*
     * Se recogen los fallos y el verde solo sale si no hay ninguno.
     *
     * Estos guardados BORRAN y vuelven a insertar, así que un alta que falle
     * no deja las cosas como estaban: deja la tabla vacía. Y aquí se guarda la
     * lista de precios de la hermandad —los conceptos de cuota con su importe—
     * así que perderla en silencio no es una molestia, es una tarde de trabajo
     * y unas cuentas que ya no cuadran.
     */
    const fallos: string[] = []
    const r0 = await saveConceptosCuota(conceptosCuota.filter((c) => c.nombre.trim()))
    if (!r0.ok) fallos.push(`conceptos de cuota (${r0.error})`)
    const limpios: Record<string, string[]> = {}
    for (const d of CATALOGOS_DEF) {
      const valores = (catalogos[d.k] ?? []).map((v) => v.trim()).filter(Boolean)
      limpios[d.k] = valores.length > 0 ? valores : [...d.porDefecto]
      const r = await saveLista(d.clave, limpios[d.k])
      if (!r.ok) fallos.push(`${d.k} (${r.error})`)
    }
    if (fallos.length > 0) {
      setCatalogosError(`No se han podido guardar: ${fallos.join(' · ')}`)
      setCatalogosSaved(false)
      return
    }
    setCatalogosError(null)
    setCatalogos(limpios)
    setConceptosCuota((prev) => prev.filter((c) => c.nombre.trim()))
    setCatalogosTocado(false)
    setCatalogosSaved(true)
    setTimeout(() => setCatalogosSaved(false), 3000)
  }

  if (!abierta) return null
  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Catálogos de la hermandad</h2>
      </div>
      <p className="form-hint">
        Las listas que usan los demás módulos, adaptadas a vuestra forma de trabajar: conceptos y
        precios de las cuotas, categorías de tesorería e inventario, tipos de incidencia del día
        de salida, canales y destinatarios de los comunicados. Añade, renombra o quita lo que
        necesites: los módulos las usan al momento.
      </p>

      <div className="catalogo-bloque">
        <div className="catalogo-bloque__head">
          <h3>Conceptos de cuota</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={addConceptoCuota}>
            + Añadir
          </button>
        </div>
        <div className="opciones-editor">
          {conceptosCuota.map((c) => (
            <div className="opcion-row" key={c.id}>
              <input
                type="text"
                value={c.nombre}
                onChange={(e) => updateConceptoCuota(c.id, 'nombre', e.target.value)}
                placeholder="Ej. Cuota juvenil"
                aria-label="Nombre del concepto de cuota"
              />
              <div className="opcion-row__importe">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={c.importe}
                  /* A céntimos aquí, que es de donde salen los importes de casi
                     todos los recibos: si el catálogo guarda 12,345, ese medio
                     céntimo acaba en la remesa y el banco la rechaza entera. */
                  onChange={(e) => updateConceptoCuota(c.id, 'importe', aCentimos(Number(e.target.value)))}
                  aria-label="Importe de la cuota en euros"
                />
                <span>€</span>
              </div>
              <button type="button" className="icon-btn" title="Quitar concepto" onClick={() => removeConceptoCuota(c.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="catalogos-grid">
        {CATALOGOS_DEF.map((d) => (
          <div className="catalogo-bloque" key={d.k}>
            <div className="catalogo-bloque__head">
              <h3>{d.titulo}</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => addCatalogoValor(d.k)}>
                + Añadir
              </button>
            </div>
            <div className="opciones-editor">
              {(catalogos[d.k] ?? []).map((valor, i) => (
                <div className="opcion-row opcion-row--cuerpo" key={`${d.k}-${i}`}>
                  <input
                    type="text"
                    value={valor}
                    onChange={(e) => updateCatalogo(d.k, i, e.target.value)}
                    aria-label={d.titulo}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    title="Quitar"
                    onClick={() => removeCatalogoValor(d.k, i)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="settings-actions">
        {catalogosSaved && <span className="alert-item alert-item--ok">Catálogos guardados</span>}
        {catalogosError && <span className="alert-item alert-item--alerta">{catalogosError}</span>}
        <button type="button" className="btn btn-primary" onClick={handleSaveCatalogos}>
          Guardar catálogos
        </button>
      </div>
    </section>
  )
}
