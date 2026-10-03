import { useEffect, useState } from 'react'
import { isPlausibleIban, maskIban, porQueNoValeElIban } from '../../../lib/format'
import { agregarAvisoHermano } from '../../../lib/avisosHermano'
import { avisarPorCorreo } from '../../../lib/avisosCorreo'
import { apuntar } from '../../../lib/registroActividad'
import type { Hermano } from '../../../data/hermanos'

/**
 * LA CUENTA BANCARIA DEL HERMANO, en su ficha.
 *
 * Sale de `Hermanos.tsx` con su estado y su guardado dentro: medido, el bloque
 * de pantalla solo costaba siete props, de las que CUATRO eran su propio
 * borrador y sus dos avisos. Trayéndose `guardarIban` son setenta líneas por
 * tres props, y la pantalla del censo se queda con tres variables de estado
 * menos — tres que, estando arriba, repintaban la tabla entera del censo cada
 * vez que alguien escribía una cifra del IBAN.
 *
 * LO QUE HACE Y NO SE VE: cambiar una cuenta avisa al hermano, lo apunta en el
 * registro y le manda un correo como «importante». No es celo de más: un
 * cambio de cuenta que el hermano no ha pedido es lo primero que hay que poder
 * detectar, y el interruptor de avisos de «ficha» viene apagado de fábrica, así
 * que por ahí no salía nunca.
 */
export default function FichaCobro({ selected, setHermanos, quienSoy }: {
  selected: Hermano
  setHermanos: React.Dispatch<React.SetStateAction<Hermano[]>>
  /** Quién está tocando la ficha, para el registro. */
  quienSoy: string
}) {
  const [ibanDraft, setIbanDraft] = useState(selected.iban ?? '')
  const [ibanError, setIbanError] = useState<string | null>(null)
  const [ibanSaved, setIbanSaved] = useState(false)

  /*
   * AL CAMBIAR DE HERMANO, EL BORRADOR VUELVE A SER EL SUYO.
   *
   * Esto estaba en un `useEffect` gigante de la pantalla que reiniciaba a la
   * vez el IBAN, el contacto, el certificado y media ficha más. Aquí es tres
   * líneas y se lee de un tirón: si no, el IBAN del hermano anterior se queda
   * escrito en la ficha del siguiente, y con el botón de «Guardar» al lado.
   */
  useEffect(() => {
    setIbanDraft(selected.iban ?? '')
    setIbanError(null)
    setIbanSaved(false)
  }, [selected.id, selected.iban])

  function guardarIban() {
    const trimmed = ibanDraft.trim()
    if (trimmed && !isPlausibleIban(trimmed)) {
      // Se dice QUÉ le pasa. «No parece válido» delante de un IBAN de veinte
      // cifras no ayuda a nadie: al que le faltan cifras y al que tiene una
      // cambiada se les arregla de maneras distintas.
      setIbanError(`Ese IBAN no vale: ${porQueNoValeElIban(trimmed)}. Ejemplo: ES91 2100 0418 4502 0005 1332.`)
      return
    }
    const nuevoIban = trimmed || null
    if ((selected.iban ?? null) !== nuevoIban) {
      const texto = 'La secretaría ha actualizado tu cuenta bancaria.'
      agregarAvisoHermano(selected.id, texto)
      apuntar({
        autorNombre: quienSoy, accion: 'iban', sobreTipo: 'hermano',
        sobreId: selected.id, sobreNombre: selected.nombre,
        // El IBAN NO se apunta: duplicaría datos bancarios en una segunda
        // tabla que nadie vigila. Con saber quién lo tocó y cuándo basta.
        detalle: `Cambió la cuenta bancaria de ${selected.nombre}`,
      })
      // Este en concreto conviene que salga por correo: un cambio de cuenta
      // que el hermano no ha pedido es lo primero que hay que poder detectar.
      avisarPorCorreo(
        [{ id: selected.id, nombre: selected.nombre, email: selected.email }],
        // «importante», no «ficha»: el interruptor de ficha viene apagado de
        // fábrica, así que este aviso —el que permite detectar un cambio de
        // cuenta que el hermano no ha pedido— no salía NUNCA.
        'importante',
        'Han cambiado tu cuenta bancaria',
        [texto, 'Si no lo has pedido tú, avisa a la secretaría cuanto antes.'],
      )
    }
    setHermanos((prev) => prev.map((h) => (h.id === selected.id ? { ...h, iban: nuevoIban } : h)))
    setIbanError(null)
    setIbanSaved(true)
    setTimeout(() => setIbanSaved(false), 2500)
  }

  return (
        <div className="assign-box">
          <label htmlFor="ibanHermano">
            Cuenta bancaria (para domiciliar sus cuotas)
          </label>
          <div className="assign-box__row">
            <input
              id="ibanHermano"
              type="text"
              placeholder="ES00 0000 0000 0000 0000 0000"
              value={ibanDraft}
              onChange={(e) => {
                setIbanDraft(e.target.value)
                setIbanError(null)
              }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={guardarIban}>
              Guardar
            </button>
          </div>
          {ibanError && <p className="form-hint form-hint--error">{ibanError}</p>}
          {ibanSaved && !ibanError && <p className="form-hint form-hint--ok">Cuenta guardada.</p>}
          {!selected.iban && !ibanDraft && !ibanError && (
            <p className="form-hint">
              Sin cuenta registrada, sus cuotas no se pueden domiciliar todavía.
            </p>
          )}
          {selected.iban && !ibanError && ibanDraft === selected.iban && (
            <p className="form-hint">Cuenta actual: {maskIban(selected.iban)}</p>
          )}
        </div>
  )
}
