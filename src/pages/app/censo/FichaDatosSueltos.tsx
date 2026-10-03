import FotoHermano from '../../../components/FotoHermano'
import type { Hermano } from '../../../data/hermanos'

/**
 * LA FOTO Y LOS DATOS SUELTOS DE LA FICHA.
 *
 * El bloque más barato de sacar de todo el censo: medido, DOS props —la ficha
 * abierta y la función de guardar— para setenta y cuatro líneas de pantalla.
 * No tiene estado propio porque no lo necesita: todo se guarda al escribir,
 * sin botón, igual que el resto de la ficha.
 *
 * QUÉ SON ESTOS CAMPOS Y POR QUÉ ESTÁN JUNTOS: son los que la hermandad acaba
 * apuntando en un papel aparte. El bautismo lo pide el expediente; la talla de
 * túnica se pregunta cada año en el reparto; y las notas del día de la salida
 * —alergias, quién no puede andar mucho— son ocho horas de pie y no son
 * curiosidad. Al estar en papel se pierden todos los años.
 */
export default function FichaDatosSueltos({ selected, aplicarHermano }: {
  selected: Hermano
  /** Cambia unos cuantos campos del hermano. Guarda al escribir, sin botón. */
  aplicarHermano: (hermanoId: string, cambios: Partial<Hermano>) => void
}) {
  return (
    <>
      <div className="assign-box">
        <label>Foto</label>
        <FotoHermano
          nombre={selected.nombre}
          foto={selected.fotoDataUrl}
          consiente={selected.consienteFoto}
          onCambiar={(foto, consiente) => aplicarHermano(selected.id, { fotoDataUrl: foto, consienteFoto: consiente })}
        />
      </div>

      <div className="assign-box">
        <label>Datos que suelen hacer falta</label>
        <p className="form-hint">
          El expediente pide el bautismo; la talla y las notas de salud se acaban apuntando en un
          papel aparte que se pierde todos los años.
        </p>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="parroquiaBautismo">Parroquia de bautismo</label>
            <input
              id="parroquiaBautismo" type="text" value={selected.parroquiaBautismo ?? ''}
              onChange={(e) => aplicarHermano(selected.id, { parroquiaBautismo: e.target.value })}
              placeholder="Parroquia de Santa Ana"
            />
          </div>
          <div className="form-row">
            <label htmlFor="fechaBautismo">Fecha de bautismo</label>
            <input
              id="fechaBautismo" type="date" value={selected.fechaBautismo ?? ''}
              onChange={(e) => aplicarHermano(selected.id, { fechaBautismo: e.target.value })}
            />
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="tallaTunica">Talla de túnica</label>
            <input
              id="tallaTunica" type="text" value={selected.tallaTunica ?? ''}
              onChange={(e) => aplicarHermano(selected.id, { tallaTunica: e.target.value })}
              placeholder="M · 1,75 m"
            />
          </div>
          <div className="form-row">
            <label htmlFor="notasSalud">Para el día de la salida</label>
            <input
              id="notasSalud" type="text" value={selected.notasSalud ?? ''}
              onChange={(e) => aplicarHermano(selected.id, { notasSalud: e.target.value })}
              placeholder="Alergia a…, no puede andar mucho"
            />
            <p className="form-hint">Son ocho horas de pie: esto no es curiosidad.</p>
          </div>
        </div>
      </div>
    </>
  )
}
