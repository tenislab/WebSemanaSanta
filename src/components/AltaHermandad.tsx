import { useState, useRef } from 'react'
import { useFocoDeDialogo } from '../lib/foco'
import { Link } from 'react-router-dom'
import { saveHermandadSettings, type HermandadSettings } from '../lib/hermandadSettings'
import { comprimirImagen, leerArchivo } from '../lib/imagen'
import { guardarImagen } from '../lib/almacenImagenes'
import { getCampana, saveCampana } from '../lib/campana'
import { CLAVE_ALTA_HECHA } from '../lib/altaHermandad'

/**
 * El alta de la hermandad, en pasos, justo después de crear la cuenta.
 *
 * Al registrarse solo se piden cuatro cosas (nombre, hermandad, correo y
 * contraseña) y eso está bien: doce campos antes del botón de «crear cuenta»
 * espantan a cualquiera. Pero todo lo demás —el CIF, la dirección, el IBAN, el
 * escudo— hace falta de verdad, y hasta ahora había que ir a buscarlo a
 * Configuración. Quien no lo hacía se encontraba media aplicación con huecos:
 * los recibos sin CIF, los documentos sin escudo, la web sin dirección.
 *
 * Aquí se pide en cuatro pasos cortos, **todos saltables**. Lo que se salta no
 * desaparece: queda pendiente en Configuración → Puesta en marcha y avisado en
 * el Inicio.
 */
const PASOS = ['La hermandad', 'Dinero', 'El día grande', 'El censo'] as const
type Paso = 0 | 1 | 2 | 3

export default function AltaHermandad({
  settings,
  onTerminar,
}: {
  settings: HermandadSettings
  onTerminar: () => void
}) {
  const [paso, setPaso] = useState<Paso>(0)
  const [datos, setDatos] = useState<HermandadSettings>(settings)
  const [fechaSalida, setFechaSalida] = useState(() => getCampana().fechaSalida ?? '')
  const set = (c: Partial<HermandadSettings>) => setDatos((d) => ({ ...d, ...c }))

  function guardarYSeguir() {
    saveHermandadSettings(datos)
    if (paso < 3) setPaso((p) => (p + 1) as Paso)
    else terminar()
  }

  function terminar() {
    saveHermandadSettings(datos)
    if (fechaSalida.trim()) saveCampana({ ...getCampana(), fechaSalida })
    // Se marca hecha aunque se haya saltado todo: si no, el asistente volvería
    // a salir en cada entrada y acabaría cerrándose sin leer.
    localStorage.setItem(CLAVE_ALTA_HECHA, 'si')
    onTerminar()
  }

  const panel = useRef<HTMLDivElement>(null)
  // El asistente tapa la pantalla entera: el foco tiene que entrar y quedarse.
  // Es lo primero que ve una hermandad al empezar, y se rellena a teclado.
  useFocoDeDialogo(true, panel)

  async function subirEscudo(file: File | null) {
    if (!file || !file.type.startsWith('image/')) return
    const crudo = await leerArchivo(file)
    if (!crudo) return
    /*
     * El escudo se intenta subir al almacén, pero aquí es normal que NO se
     * pueda: estamos dando de alta la hermandad, así que puede que todavía no
     * exista la carpeta donde iría. En ese caso se queda dentro de los ajustes
     * —son 512 px, no pesa— y se muda solo al abrir el editor de la web.
     */
    set({ logoDataUrl: await guardarImagen(await comprimirImagen(crudo, 512, 0.9), 'web') })
  }

  return (
    <div ref={panel} tabIndex={-1} className="alta-fondo" role="dialog" aria-modal="true" aria-label="Alta de la hermandad">
      <div className="alta">
        <header className="alta__head">
          <p className="eyebrow">Vamos a dejarlo listo</p>
          <h1>{datos.nombreLegal || 'Tu hermandad'}</h1>
          <ol className="alta__pasos">
            {PASOS.map((p, i) => (
              <li key={p} className={i === paso ? 'alta__paso--ahora' : i < paso ? 'alta__paso--hecho' : undefined}>
                <span>{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
        </header>

        <div className="alta__cuerpo">
          {paso === 0 && (
            <>
              <p className="form-hint">
                Estos datos salen en los recibos, en los documentos y en la web. Sin el CIF, un
                recibo no vale como justificante.
              </p>
              <div className="form-row">
                <label htmlFor="altaNombre">Nombre completo de la hermandad</label>
                <input
                  id="altaNombre" type="text" value={datos.nombreLegal}
                  onChange={(e) => set({ nombreLegal: e.target.value })}
                  placeholder="Real e Ilustre Hermandad de…"
                />
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor="altaCif">CIF</label>
                  <input id="altaCif" type="text" value={datos.cif} onChange={(e) => set({ cif: e.target.value })} placeholder="G41000000" />
                </div>
                <div className="form-row">
                  <label htmlFor="altaTel">Teléfono de secretaría</label>
                  <input id="altaTel" type="tel" value={datos.telefono} onChange={(e) => set({ telefono: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="altaDir">Dirección</label>
                <input id="altaDir" type="text" value={datos.direccion} onChange={(e) => set({ direccion: e.target.value })} placeholder="C/ Pureza, 53" />
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor="altaCiudad">Población</label>
                  <input id="altaCiudad" type="text" value={datos.ciudad} onChange={(e) => set({ ciudad: e.target.value })} />
                </div>
                <div className="form-row">
                  <label htmlFor="altaEmail">Correo de secretaría</label>
                  <input id="altaEmail" type="email" value={datos.email} onChange={(e) => set({ email: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="altaEscudo">Escudo</label>
                <div className="alta__escudo">
                  {datos.logoDataUrl && <img src={datos.logoDataUrl} alt="" />}
                  <input id="altaEscudo" type="file" accept="image/*" onChange={(e) => { subirEscudo(e.target.files?.[0] ?? null); e.target.value = '' }} />
                  <label htmlFor="altaEscudo" className="btn btn-outline btn-sm">
                    {datos.logoDataUrl ? 'Cambiar el escudo' : 'Subir el escudo'}
                  </label>
                </div>
                <p className="form-hint">Sale en los recibos, en las papeletas y en la cabecera de la web.</p>
              </div>
            </>
          )}

          {paso === 1 && (
            <>
              <p className="form-hint">
                Con esto se cobran las cuotas y se le puede decir al hermano dónde pagar. El
                identificador de acreedor hace falta para las remesas del banco; si no lo tenéis a
                mano, se pone después.
              </p>
              <div className="form-row">
                <label htmlFor="altaIban">Cuenta de la hermandad (IBAN)</label>
                <input id="altaIban" type="text" value={datos.iban} onChange={(e) => set({ iban: e.target.value })} placeholder="ES00 0000 0000 0000 0000 0000" />
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor="altaBizum">Bizum</label>
                  <input id="altaBizum" type="tel" value={datos.bizumTelefono} onChange={(e) => set({ bizumTelefono: e.target.value })} placeholder="Teléfono del Bizum" />
                </div>
                <div className="form-row">
                  <label htmlFor="altaAcreedor">Identificador de acreedor SEPA</label>
                  <input id="altaAcreedor" type="text" value={datos.identificadorAcreedor} onChange={(e) => set({ identificadorAcreedor: e.target.value })} placeholder="ES23000B12345678" />
                </div>
              </div>
              <p className="form-hint">
                Gobergo no cobra por vosotros: el dinero va siempre a esta cuenta, nunca a la
                nuestra.
              </p>
            </>
          )}

          {paso === 2 && (
            <>
              <p className="form-hint">
                La fecha de la salida mueve toda la aplicación: la cuenta atrás de la web, el
                reparto de papeletas y el calendario.
              </p>
              <div className="form-row">
                <label htmlFor="altaSalida">Día de la estación de penitencia</label>
                <input id="altaSalida" type="date" value={fechaSalida} onChange={(e) => setFechaSalida(e.target.value)} />
                <p className="form-hint">Se puede cambiar cuando queráis desde Configuración.</p>
              </div>
              <div className="form-row">
                <label htmlFor="altaColor">Color de la hermandad</label>
                <input id="altaColor" type="color" value={datos.colorPrimario} onChange={(e) => set({ colorPrimario: e.target.value })} />
                <p className="form-hint">Tiñe el área del hermano y los documentos.</p>
              </div>
            </>
          )}

          {paso === 3 && (
            <>
              <h2 className="alta__pregunta">¿Tenéis ya el censo en un Excel?</h2>
              <p className="form-hint">
                Casi todas lo tienen. Se sube y se traen los mil hermanos de una vez, en vez de
                teclearlos uno a uno. Antes de tocar nada se enseña qué va a pasar, fila a fila.
              </p>
              <div className="alta__final">
                <Link className="btn btn-primary" to="/app/hermanos" onClick={terminar}>
                  Sí, traer nuestro censo
                </Link>
                <button type="button" className="btn btn-outline" onClick={terminar}>
                  Todavía no
                </button>
              </div>
              <p className="form-hint">
                En Hermanos → Exportar → «Traer vuestro censo». Ahí está siempre, no hay prisa.
              </p>
            </>
          )}
        </div>

        <footer className="alta__pie">
          {paso > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setPaso((p) => (p - 1) as Paso)}>
              Atrás
            </button>
          )}
          {paso < 3 && (
            <>
              <button type="button" className="btn btn-primary" onClick={guardarYSeguir}>
                Guardar y seguir
              </button>
              {/* Saltar tiene que ser fácil: quien no tiene el CIF a mano no
                  puede quedarse atascado en la puerta. */}
              <button type="button" className="btn btn-ghost" onClick={() => setPaso((p) => (p + 1) as Paso)}>
                Ahora no
              </button>
            </>
          )}
          <button type="button" className="btn btn-ghost alta__salir" onClick={terminar}>
            Dejarlo para luego
          </button>
        </footer>
      </div>
    </div>
  )
}
