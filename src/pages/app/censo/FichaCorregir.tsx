import { useEffect, useState } from 'react'
import AvisoDeCampo from '../../../components/AvisoDeCampo'
import { avisarPorCorreo } from '../../../lib/avisosCorreo'
import { avisarCambiosHermano } from '../../../lib/avisosHermano'
import { limpiarDni, mismoDni, problemaDeDocumento } from '../../../lib/dni'
import { apuntar } from '../../../lib/registroActividad'
import { problemaDeTelefono } from '../../../lib/telefono'
import type { Hermano } from '../../../data/hermanos'

/**
 * CORREGIR LA FICHA: la identidad y los datos de contacto.
 *
 * Sale de `Hermanos.tsx` con todo su estado dentro, que es la única forma
 * honesta de sacarlo. Medido, el bloque de pantalla a secas costaba NUEVE
 * props, y las nueve eran su propio formulario: `ident`, `setIdent`,
 * `identError`, `identSaved`, `contacto`, `setContacto`, `contactoSaved` y los
 * dos manejadores. Trayéndose los manejadores y el efecto que siembra los
 * campos son ciento noventa líneas por CUATRO props, y la pantalla del censo se
 * queda con seis variables de estado menos — seis que, estando arriba,
 * repintaban la tabla entera cada vez que alguien tecleaba una letra del
 * nombre.
 *
 * ----------------------------------------------------------------------------
 * LOS DATOS DE IDENTIDAD SE PUEDEN CORREGIR, Y HASTA HACE POCO NO
 * ----------------------------------------------------------------------------
 *
 * De la ficha solo se podían tocar el contacto y los datos sueltos (talla,
 * parroquia, notas). El nombre, el DNI, el número y las fechas se escribían en
 * el alta y se quedaban así PARA SIEMPRE.
 *
 * Y hay una errata en el nombre o en el DNI de cada dos altas. Peor: cuando se
 * intentaba dar de alta otra vez a alguien que ya estaba, el propio aviso decía
 * «busca la que ya está y edítala» — mandando a hacer justo lo único que no se
 * podía hacer. Con el DNI mal, además, quien no puede entrar en su área es él.
 */
export default function FichaCorregir({ selected, hermanos, setHermanos, quienSoy }: {
  selected: Hermano
  /** El censo entero: hace falta para no repetir un DNI ni un número. */
  hermanos: Hermano[]
  setHermanos: React.Dispatch<React.SetStateAction<Hermano[]>>
  /** Quién está tocando la ficha, para el registro. */
  quienSoy: string
}) {
  const [ident, setIdent] = useState({ nombre: '', dni: '', numero: '', antiguedad: '', fechaNacimiento: '' })
  const [identError, setIdentError] = useState<string | null>(null)
  const [identSaved, setIdentSaved] = useState(false)
  const [contacto, setContacto] = useState({ email: '', telefono: '', direccion: '' })
  const [contactoSaved, setContactoSaved] = useState(false)

  useEffect(() => {
    setContacto({
      email: selected.email ?? '',
      telefono: selected.telefono && selected.telefono !== 'Sin datos' ? selected.telefono : '',
      direccion: selected.direccion && selected.direccion !== 'Sin datos' ? selected.direccion : '',
    })
    setContactoSaved(false)
    setIdent({
      nombre: selected.nombre ?? '',
      dni: selected.dni ?? '',
      numero: String(selected.numero ?? 0),
      antiguedad: String(selected.antiguedad ?? ''),
      fechaNacimiento: selected.fechaNacimiento ?? '',
    })
    setIdentError(null)
    setIdentSaved(false)

    // Solo al CAMBIAR de hermano (por eso la dependencia es el id y no la ficha
    // entera): si dependiera de cada campo, el formulario se reiniciaría solo
    // mientras se está escribiendo en él.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id])

  /**
   * GUARDA LOS DATOS DE IDENTIDAD DE LA FICHA: nombre, DNI, número, año de
   * antigüedad y fecha de nacimiento.
   *
   * Se comprueba lo mismo que en el alta, y por lo mismo:
   *
   *   · EL DNI, letra incluida. Es por lo que entra el hermano en su área, y
   *     con la letra mal el que no puede entrar es él, con un «DNI o
   *     contraseña incorrectos» que le hace probar contraseñas hasta rendirse.
   *   · QUE NO SE REPITA, ni el DNI ni el número. La base tiene índices únicos
   *     para los dos: si se cuela, el error que sale es un «duplicate key» que
   *     no dice nada, y encima llega DESPUÉS de haber cerrado el panel.
   *
   * El número se puede dejar en 0 —el hermano civil no ocupa escalafón— pero
   * no se puede poner uno que ya tenga otro.
   */
  function guardarIdentidad() {
    setIdentError(null)
    const nombre = ident.nombre.trim()
    if (!nombre) { setIdentError('El nombre no puede quedarse vacío.'); return }

    /*
     * EL DNI SE COMPRUEBA SOLO SI SE HA TOCADO.
     *
     * Es la misma regla que en el alta y por el mismo motivo: se valida lo que
     * se teclea HOY, con el hermano delante, no lo que vino de un Excel de
     * hace quince años. Un censo importado trae erratas, y son fichas de gente
     * de verdad.
     *
     * Comprobarlo siempre dejaba la ficha bloqueada entera: con el DNI mal de
     * origen no se podía corregir ni el nombre, que es justo para lo que se
     * abre esto. Se comprueba lo que se cambia, y lo demás se deja pasar.
     */
    const dni = limpiarDni(ident.dni)
    if (!mismoDni(dni, selected.dni)) {
      const problema = problemaDeDocumento(dni)
      if (problema) { setIdentError(problema); return }
    }
    if (hermanos.some((h) => h.id !== selected.id && mismoDni(h.dni, dni))) {
      setIdentError(`Ya hay otro hermano con el DNI ${dni}.`)
      return
    }

    const numero = Number(ident.numero)
    if (!Number.isInteger(numero) || numero < 0) {
      setIdentError('El número de hermano tiene que ser un número entero, o 0 si no ocupa escalafón.')
      return
    }
    if (numero > 0 && hermanos.some((h) => h.id !== selected.id && h.numero === numero)) {
      const quien = hermanos.find((h) => h.id !== selected.id && h.numero === numero)
      setIdentError(`El número ${numero} ya lo tiene ${quien?.nombre}.`)
      return
    }

    const antiguedad = ident.antiguedad.trim() === '' ? selected.antiguedad : Number(ident.antiguedad)
    if (!Number.isInteger(antiguedad) || antiguedad < 1000 || antiguedad > 2999) {
      setIdentError('El año de antigüedad tiene que ser un año de cuatro cifras.')
      return
    }

    const cambios: Partial<Hermano> = {
      nombre,
      dni,
      numero,
      antiguedad,
      fechaNacimiento: ident.fechaNacimiento || undefined,
    }
    setHermanos((prev) => prev.map((h) => (h.id === selected.id ? { ...h, ...cambios } : h)))
    apuntar({
      autorNombre: quienSoy, accion: 'ficha', sobreTipo: 'hermano',
      sobreId: selected.id, sobreNombre: nombre,
      detalle: `Corrigió los datos de la ficha de ${nombre}`,
    })
    setIdentSaved(true)
    setTimeout(() => setIdentSaved(false), 2500)
  }

  /** Guarda los datos de contacto editados en la ficha y avisa al hermano. */
  function guardarContacto() {
    const nuevo: Hermano = {
      ...selected,
      email: contacto.email.trim() || selected.email,
      telefono: contacto.telefono.trim() || 'Sin datos',
      direccion: contacto.direccion.trim() || 'Sin datos',
    }
    const cambio = avisarCambiosHermano(selected, nuevo)
    if (cambio) {
      apuntar({
        autorNombre: quienSoy, accion: 'ficha', sobreTipo: 'hermano',
        sobreId: nuevo.id, sobreNombre: nuevo.nombre, detalle: cambio.replace('La secretaría ha', 'Cambió'),
      })
    }
    // Y por correo, si la hermandad tiene encendido «avisar de cambios en la
    // ficha». Viene apagado de fábrica a propósito: son muchos y menores.
    if (cambio) {
      avisarPorCorreo(
        [{ id: nuevo.id, nombre: nuevo.nombre, email: nuevo.email }],
        'ficha',
        'Han cambiado datos de tu ficha',
        [cambio, 'Si no reconoces este cambio, avisa a la secretaría.'],
        'Este aviso lo puedes apagar desde tu área de hermano.',
      )
    }
    setHermanos((prev) => prev.map((h) => (h.id === selected.id ? nuevo : h)))
    setContactoSaved(true)
    setTimeout(() => setContactoSaved(false), 2500)
  }

  return (
    <>
      <div className="assign-box">
        <label>Corregir la ficha</label>
        <p className="form-hint">
          Los datos con los que se dio de alta. El DNI es con el que entra en su área, así que si
          está mal, quien no puede entrar es él.
        </p>
        <div className="form-row">
          <label htmlFor="identNombre">Nombre y apellidos</label>
          <input
            id="identNombre" value={ident.nombre} maxLength={120}
            onChange={(e) => setIdent((v) => ({ ...v, nombre: e.target.value }))}
          />
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="identDni">DNI o NIE</label>
            <input
              id="identDni" value={ident.dni}
              onChange={(e) => setIdent((v) => ({ ...v, dni: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <label htmlFor="identNumero">Nº de hermano</label>
            <input
              id="identNumero" type="number" min={0} value={ident.numero}
              onChange={(e) => setIdent((v) => ({ ...v, numero: e.target.value }))}
            />
            <p className="form-hint">0 = no ocupa escalafón (hermano civil).</p>
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="identAnt">Año de antigüedad</label>
            <input
              id="identAnt" type="number" min={1000} max={2999} value={ident.antiguedad}
              onChange={(e) => setIdent((v) => ({ ...v, antiguedad: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <label htmlFor="identNac">Fecha de nacimiento</label>
            <input
              id="identNac" type="date" value={ident.fechaNacimiento}
              onChange={(e) => setIdent((v) => ({ ...v, fechaNacimiento: e.target.value }))}
            />
          </div>
        </div>
        <AvisoDeCampo texto={identError} />
        <div className="assign-box__row">
          <button type="button" className="btn btn-primary btn-sm" onClick={guardarIdentidad}>
            Guardar la ficha
          </button>
          {identSaved && <span className="pill pill--ok">Guardado</span>}
        </div>
      </div>

      <div className="assign-box">
        <label>Datos de contacto</label>
        <p className="form-hint">
          Si cambias algún dato, el hermano recibe un aviso en su área (correo simulado hasta
          conectar el proveedor).
        </p>
        <div className="form-row">
          <label htmlFor="emailHermano">Correo electrónico</label>
          <input
            id="emailHermano"
            type="email"
            value={contacto.email}
            onChange={(e) => setContacto((c) => ({ ...c, email: e.target.value }))}
          />
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="telHermano">Teléfono</label>
            <input
              id="telHermano"
              type="tel"
              value={contacto.telefono}
              placeholder="600 000 000"
              onChange={(e) => setContacto((c) => ({ ...c, telefono: e.target.value }))}
            />
            <AvisoDeCampo texto={problemaDeTelefono(contacto.telefono)} />
          </div>
          <div className="form-row">
            <label htmlFor="dirHermano">Dirección</label>
            <input
              id="dirHermano"
              type="text"
              value={contacto.direccion}
              placeholder="Calle y número"
              onChange={(e) => setContacto((c) => ({ ...c, direccion: e.target.value }))}
            />
          </div>
        </div>
        <div className="assign-box__row">
          <button type="button" className="btn btn-primary btn-sm" onClick={guardarContacto}>
            Guardar datos de contacto
          </button>
          {contactoSaved && <span className="form-hint form-hint--ok">Guardado · avisado al hermano.</span>}
        </div>
      </div>
    </>
  )
}
