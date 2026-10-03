import { useEffect, useState, type FormEvent } from 'react'
import Drawer from '../../../components/Drawer'
import AvisoDeCampo from '../../../components/AvisoDeCampo'
import CamposPropiosForm from '../../../components/CamposPropios'
import { crearAccesoHermano } from '../../../lib/accesos'
import { darLaBienvenida } from '../../../lib/bienvenida'
import { claveDeUnSoloUso } from '../../../lib/claves'
import { limpiarDni, mismoDni, problemaDeDocumento } from '../../../lib/dni'
import { isPlausibleIban, porQueNoValeElIban } from '../../../lib/format'
import { nuevoId } from '../../../lib/supabaseSync'
import { problemaDeTelefono } from '../../../lib/telefono'
import type { CampoPropio } from '../../../lib/camposPropios'
import type { HermandadSettings } from '../../../lib/hermandadSettings'
import type { Hermano } from '../../../data/hermanos'

/**
 * EL ALTA DE UN HERMANO: el cajón y lo que hace al guardar.
 *
 * Sale de `Hermanos.tsx` con SU ESTADO DENTRO, que es lo que hace que el corte
 * valga la pena en vez de mover el bulto. Medido antes de tocar nada: dejando
 * el estado fuera, el cajón costaba 13 props por 83 líneas —un mal cambio—; con
 * `handleCreate` y los cuatro avisos de error metidos aquí son 242 líneas por
 * nueve props, y el componente de arriba se queda con seis variables de estado
 * menos.
 *
 * LO QUE SE QUEDA FUERA, y por qué: `setHermanos` (el censo es de la pantalla,
 * no de este cajón), y tres avisos de vuelta —`onCreado`, `onAviso`— porque lo
 * que pasa DESPUÉS de dar de alta —resaltar la fila, limpiar el filtro, contar
 * que el correo no salió— es cosa de la pantalla y no del formulario.
 */
export default function AltaDeHermano({
  abierto, onCerrar, hermanos, setHermanos, hermandad, camposDeAlta, onCreado, onAviso,
}: {
  abierto: boolean
  onCerrar: () => void
  hermanos: Hermano[]
  setHermanos: React.Dispatch<React.SetStateAction<Hermano[]>>
  hermandad: HermandadSettings
  camposDeAlta: CampoPropio[]
  /** Se ha dado de alta: la pantalla resalta su fila y limpia los filtros. */
  onCreado: (id: string) => void
  /** Algo que contar de la creación de la cuenta (el correo que no salió). */
  onAviso: (mensaje: string) => void
}) {
  /*
   * EL ESTADO DEL FORMULARIO VIVE AQUÍ, no en la pantalla del censo. Son
   * cuatro avisos de error y un «guardando» que no le importan a nadie más:
   * mientras estuvieron arriba, cualquier cambio en uno de ellos repintaba la
   * tabla entera del censo.
   */
  const [camposNuevo, setCamposNuevo] = useState<Record<string, string>>({})
  const [guardandoAlta, setGuardandoAlta] = useState(false)
  const [dniError, setDniError] = useState<string | null>(null)
  const [telefonoError, setTelefonoError] = useState<string | null>(null)
  const [ibanAltaError, setIbanAltaError] = useState<string | null>(null)

  /*
   * AL ABRIRSE SE LIMPIAN LOS AVISOS, y lo hace el cajón porque son suyos.
   *
   * Antes los limpiaba quien abría: `setDniError(null)` iba pegado a
   * `setFormOpen(true)` en TRES sitios —el botón de «+ Nuevo hermano», el de
   * la pantalla vacía y la vuelta desde una URL con `?nuevo=`— y el cuarto
   * camino que alguien añadiera se olvidaría, dejando el aviso de un alta
   * anterior encima de un formulario en blanco.
   */
  useEffect(() => {
    if (!abierto) return
    setDniError(null)
    setTelefonoError(null)
    setIbanAltaError(null)
  }, [abierto])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const nombre = String(data.get('nombre') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    /**
     * El DNI se guarda SIEMPRE limpio: sin puntos, sin guiones, sin espacios.
     *
     * Antes se guardaba tal cual lo escribieran, y eso rompía dos cosas a la
     * vez, las dos en silencio:
     *
     *   - El control de duplicados. «12.345.678-A» y «12345678A» son el mismo
     *     señor, pero comparados en crudo no coinciden: se daba de alta dos
     *     veces al mismo hermano, con dos números distintos.
     *   - Y peor: el hermano no podía entrar en su área. Ahí escribe su DNI
     *     como lo lleva la tarjeta, y la búsqueda no encontraba la ficha. El
     *     mensaje que veía era «DNI o contraseña incorrectos», así que probaba
     *     contraseñas hasta rendirse y llamar a secretaría.
     */
    const dni = limpiarDni(String(data.get('dni') ?? ''))
    if (!nombre || !email || !dni) return
    if (guardandoAlta) return
    setGuardandoAlta(true)

    if (hermanos.some((h) => limpiarDni(h.dni) === dni)) {
      setDniError(`Ya hay un hermano registrado con el DNI ${dni}.`)
      // Sin esto el botón se quedaba en «Guardando…» y deshabilitado para
      // siempre: había que cerrar el panel y volver a escribirlo todo.
      setGuardandoAlta(false)
      return
    }
    /*
     * Y QUE EL DOCUMENTO ESTÉ BIEN. Se comprueba AQUÍ y no al importar: un DNI
     * que se teclea hoy, con el hermano delante, se puede comprobar; uno que
     * viene de un Excel de hace quince años, no —ver `lib/dni.ts`—.
     *
     * De ese número cuelgan tres cosas que se rompen calladamente: es la llave
     * con la que el hermano entra en su área, es lo que evita darlo de alta dos
     * veces, y es lo que va en el mandato SEPA que se le enseña al banco.
     */
    const malDocumento = problemaDeDocumento(dni)
    if (malDocumento) {
      setDniError(malDocumento)
      setGuardandoAlta(false)
      return
    }
    setDniError(null)

    /*
     * Y EL TELÉFONO. No tumba nada, pero es por donde se llama al hermano
     * cuando hay que llamarle —una papeleta que no recoge, un cargo devuelto—,
     * y un número con una cifra de menos no se descubre hasta que hace falta.
     */
    const telefonoTecleado = String(data.get('telefono') ?? '')
    const malTelefono = problemaDeTelefono(telefonoTecleado)
    if (malTelefono) {
      setTelefonoError(malTelefono)
      setGuardandoAlta(false)
      return
    }
    setTelefonoError(null)

    /*
     * EL IBAN MAL ESCRITO SE DECÍA, NO SE TIRABA.
     *
     * Antes: `ibanRaw && isPlausibleIban(ibanRaw) ? ibanRaw : null`. O sea, se
     * borraba en silencio. La secretaria daba de alta al hermano con su cuenta
     * delante, se comía una cifra, y la ficha se guardaba SIN IBAN sin decir
     * nada. Después nadie entendía por qué a ese hermano no se le cobraba: en
     * su ficha no había ninguna cuenta, y ella recordaba haberla escrito.
     */
    const ibanRaw = String(data.get('iban') ?? '').trim()
    if (ibanRaw && !isPlausibleIban(ibanRaw)) {
      setIbanAltaError(`Ese IBAN no vale: ${porQueNoValeElIban(ibanRaw)}.`)
      /*
       * Y SE SUELTA EL BOTÓN, que no se soltaba. Esta era la ÚNICA de las
       * cuatro salidas tempranas de esta función que se iba sin
       * `setGuardandoAlta(false)`: el botón se quedaba en «Guardando…» y
       * deshabilitado para siempre, y había que cerrar el cajón y volver a
       * escribirlo todo. Es el mismo fallo que ya se arregló dos ramas más
       * arriba para el DNI duplicado —el comentario de allí lo cuenta— y que
       * se quedó sin arreglar aquí. Salió al leer la función entera para
       * moverla de sitio.
       */
      setGuardandoAlta(false)
      return
    }
    setIbanAltaError(null)
    const iban = ibanRaw || null
    const fechaNacimiento = String(data.get('fechaNacimiento') ?? '').trim() || undefined

    const nuevo: Hermano = {
      id: nuevoId(),
      // Se numera dentro del setHermanos de abajo, con la lista más reciente.
      numero: 0,
      nombre,
      estado: 'Nuevo',
      antiguedad: new Date().getFullYear(),
      email,
      telefono: String(data.get('telefono') ?? '') || 'Sin datos',
      direccion: String(data.get('direccion') ?? '') || 'Sin datos',
      cuotaAlDia: false,
      iban,
      dni,
      /*
       * Su contraseña provisional es ALEATORIA, no su DNI.
       *
       * Antes era el DNI, «fácil de comunicar». Y también fácil de adivinar:
       * el DNI está en su ficha, así que cualquiera con acceso al censo podía
       * entrar como cualquier hermano que no la hubiera cambiado — incluido el
       * Hermano Mayor, cuyo cargo abre los trece módulos. Ver src/lib/claves.ts.
       *
       * No se guarda en ninguna parte: se usa para crear la cuenta, se le manda
       * por correo y aquí queda en blanco. La de verdad vive cifrada en
       * Supabase Auth.
       */
      claveAcceso: '',
      authUserId: null,
      fechaNacimiento,
      campos: Object.keys(camposNuevo).length ? camposNuevo : undefined,
    }
    const claveProvisional = claveDeUnSoloUso()
    const acceso = await crearAccesoHermano(email, claveProvisional, dni, nombre)
    nuevo.authUserId = acceso.id
    // Cómo se llama su cuenta por dentro. Sin apuntarlo, la pantalla de entrar
    // no la encuentra a partir de su DNI y esa persona no entra nunca.
    nuevo.correoAcceso = acceso.correoAcceso ?? null
    if (acceso.error) onAviso(acceso.error)
    // El duplicado se vuelve a mirar DENTRO del updater: entre el clic y la
    // respuesta de Supabase pasan segundos, y pulsando dos veces se daban de
    // alta dos hermanos con el mismo DNI.
    let duplicado = false
    let suNumero = 0
    setHermanos((prev) => {
      // El tecleado ya viene limpio; el del censo hay que limpiarlo también.
      // Comparar uno limpio contra otro sin limpiar es no comparar nada: un
      // censo importado con puntos no reconocía al que ya estaba dentro, y la
      // misma persona se daba de alta DOS VECES, con dos números.
      if (prev.some((h) => mismoDni(h.dni, dni))) {
        duplicado = true
        return prev
      }
      suNumero = Math.max(0, ...prev.map((h) => h.numero)) + 1
      return [...prev, { ...nuevo, numero: suNumero }]
    })
    // La bienvenida, igual que en el alta desde solicitud.
    // La bienvenida, igual que en el alta desde solicitud, y con la contraseña
    // de un solo uso: es la única vez que se escribe en algún sitio.
    if (!duplicado) {
      void darLaBienvenida({
        id: nuevo.id, nombre: nuevo.nombre, email: nuevo.email, dni: nuevo.dni,
        numero: suNumero, claveProvisional: acceso.id ? claveProvisional : null,
        hermandad: hermandad.nombreLegal,
      })
    }
    if (duplicado) {
      setDniError('Ya hay un hermano con ese DNI.')
      setGuardandoAlta(false)
      return
    }
    onCreado(nuevo.id)
    onCerrar()
    form.reset()
    setCamposNuevo({})
    setGuardandoAlta(false)
      }

  return (
      <Drawer
        open={abierto}
        onClose={onCerrar}
        title="Nuevo hermano"
        subtitle="Alta en el censo"
        footer={
          <>
            <button className="btn btn-ghost" onClick={onCerrar}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="hermano-form" type="submit" disabled={guardandoAlta}>
              {guardandoAlta ? 'Guardando…' : 'Guardar hermano'}
            </button>
          </>
        }
      >
        <form id="hermano-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="nombre">Nombre y apellidos</label>
            <input id="nombre" name="nombre" type="text" placeholder="Nombre completo" required />
          </div>
          <div className="form-row">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" placeholder="correo@ejemplo.com" required />
          </div>
          <div className="form-row">
            <label htmlFor="dni">DNI / NIE</label>
            <input id="dni" name="dni" type="text" placeholder="12345678A" required />
            {dniError && <p className="form-hint form-hint--error">{dniError}</p>}
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="telefono">Teléfono</label>
              <input id="telefono" name="telefono" type="tel" inputMode="tel" placeholder="600 00 00 00" />
              <AvisoDeCampo texto={telefonoError} />
            </div>
            <div className="form-row">
              <label htmlFor="fechaNacimiento">Fecha de nacimiento</label>
              <input id="fechaNacimiento" name="fechaNacimiento" type="date" />
              <p className="form-hint">Necesaria para los avisos por edad (p. ej. solo mayores de edad).</p>
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="direccion">Dirección</label>
            <input id="direccion" name="direccion" type="text" placeholder="Calle y número" />
          </div>
          <div className="form-row">
            <label htmlFor="iban">Cuenta bancaria (opcional)</label>
            <input
              id="iban" name="iban" type="text" placeholder="ES00 0000 0000 0000 0000 0000"
              aria-invalid={ibanAltaError ? true : undefined}
            />
            {ibanAltaError && <p className="form-hint form-hint--error">{ibanAltaError}</p>}
          </div>
          <CamposPropiosForm
            campos={camposDeAlta}
            valores={camposNuevo}
            onChange={setCamposNuevo}
            idPrefijo="alta"
          />
          <p className="form-hint">
            Se le asignará automáticamente el siguiente número de hermano disponible y quedará en
            estado «Nuevo». Su usuario será su DNI y la contraseña provisional también su DNI, que
            podrá cambiar desde su área del hermano. Sin cuenta bancaria, sus cuotas no podrán
            domiciliarse hasta que la añada.
          </p>
        </form>
      </Drawer>
  )
}
