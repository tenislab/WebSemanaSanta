/**
 * LAS SOLICITUDES DE ALTA: un asunto completo, con su lógica y su cajón.
 *
 * Alguien que todavía no está en el censo pide entrar —desde la web de la
 * hermandad o desde el área de un familiar— y la secretaría lo aprueba o lo
 * rechaza con un motivo. Aprobar son ciento cuarenta líneas: número
 * correlativo, control de DNI repetido, creación de la cuenta de acceso,
 * correo de bienvenida y un caso aparte para los menores a cargo.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ SALE DEL CENSO, Y POR QUÉ COMO HOOK Y NO COMO COMPONENTE SUELTO
 * ----------------------------------------------------------------------------
 *
 * Medido antes de cortar: de todo lo que toca, solo CINCO cosas vienen de
 * fuera. Es el único trozo del censo con esa cuenta — la ficha del hermano
 * costaba treinta y uno y la lista treinta y tres, y por eso las dos se
 * quedaron donde estaban.
 *
 * Va como hook MÁS cajón porque el censo sigue necesitando dos cosas de aquí
 * que no son el cajón: cuántas hay pendientes —lo dice en la barra de arriba y
 * en el aviso— y poder aprobar una al llegar desde Notificaciones con
 * `?aprobar=`. Un componente suelto habría obligado a duplicar ese estado; el
 * hook lo tiene en un sitio y lo presta.
 */
import type { HermandadSettings } from '../../../lib/hermandadSettings'
import { resolverSolicitud } from '../../../lib/familia'
import { YA_APROBADAS } from './columnas'
import { avisarPorCorreo } from '../../../lib/avisosCorreo'
import { claveDeUnSoloUso } from '../../../lib/claves'
import { crearAccesoHermano } from '../../../lib/accesos'
import { darLaBienvenida } from '../../../lib/bienvenida'
import { limpiarDni, mismoDni } from '../../../lib/dni'
import { nuevoId } from '../../../lib/supabaseSync'
import { saveSolicitudes, useSolicitudes, type SolicitudAlta } from '../../../lib/solicitudes'
import { type Hermano } from '../../../data/hermanos'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

interface Props {
  /** El censo: de aquí salen el número correlativo y el control de DNI repetido. */
  hermanos: Hermano[]
  setHermanos: (f: (prev: Hermano[]) => Hermano[]) => void
  /** La hermandad, para el correo de bienvenida. */
  hermandad: HermandadSettings
  /** Qué contar cuando la cuenta de acceso no se ha podido crear. */
  onAvisoDeAcceso: (aviso: string | null) => void
  /** A quién se acaba de dar de alta, para que el censo lo señale un momento. */
  onReciénDadoDeAlta: (id: string | null) => void
}

export function useSolicitudesDeAlta({
  hermanos,
  setHermanos,
  hermandad,
  onAvisoDeAcceso,
  onReciénDadoDeAlta,
}: Props) {
  /* La dirección se pide aquí: es un hook, no estado que venga de fuera. */
  const [params, setParams] = useSearchParams()
  const solicitudesRemotas = useSolicitudes()
  const [solicitudes, setSolicitudesState] = useState<SolicitudAlta[]>(solicitudesRemotas)
  useEffect(() => setSolicitudesState(solicitudesRemotas), [solicitudesRemotas])
  /* Qué solicitud se está rechazando y con qué motivo. Se pide SIEMPRE: un
     «no» sin explicación obliga a la persona a llamar a la hermandad. */
  const [rechazando, setRechazando] = useState<string | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const pendientes = useMemo(() => solicitudes.filter((s) => s.estado === 'Pendiente'), [solicitudes])

  function actualizarSolicitudes(next: SolicitudAlta[]) {
    setSolicitudesState(next)
    saveSolicitudes(next)
  }

  /*
   * APROBAR AL LLEGAR DESDE NOTIFICACIONES.
   *
   * Allí el botón pone «Dar de alta», y antes solo traía aquí: llegó dicho
   * como «si le doy a dar de alta en notificaciones no funciona, tengo que
   * irme a Hermanos». Y tenía razón — un botón que promete un alta y solo
   * cambia de pantalla es una promesa rota.
   *
   * Se hace así, con un parámetro, y NO copiando la lógica al otro lado: dar
   * de alta a un hermano son cincuenta líneas con número correlativo, control
   * de DNI repetido, creación de la cuenta de acceso y correo de bienvenida
   * —y un caso aparte para los menores a cargo—. Duplicarlo sería tener dos
   * altas distintas, y la copia se quedaría atrás a la primera.
   *
   * `hecho` evita repetirlo si React vuelve a montar el efecto: aprobar dos
   * veces daría de alta a la misma persona dos veces.
   */
  useEffect(() => {
    const id = params.get('aprobar')
    if (!id || YA_APROBADAS.has(id)) return
    const sol = solicitudes.find((x) => x.id === id && x.estado === 'Pendiente')
    if (!sol) return
    /*
     * Se apunta ANTES de empezar, y en el módulo, no en un `useRef`.
     *
     * Con el ref se daba de alta DOS VECES: React monta, desmonta y vuelve a
     * montar los componentes en desarrollo, y en el remontaje el ref vuelve a
     * empezar. Se veía en el censo — la misma persona repetida— y el control
     * de DNI de dentro no lo pillaba porque las dos aprobaciones leían la
     * lista antes de que ninguna hubiera terminado.
     *
     * Un `Set` del módulo sobrevive al remontaje y a las dos llamadas del
     * mismo tirón, que es lo único que hace falta aquí.
     */
    YA_APROBADAS.add(id)
    void aprobarSolicitud(sol).then(() => {
      const limpio = new URLSearchParams(params)
      limpio.delete('aprobar')
      setParams(limpio, { replace: true })
    })
    /* Sin `aprobarSolicitud` ni `setParams` en las dependencias: la primera se
       recrea en cada pintado y volvería a ejecutar el efecto en bucle. Lo que
       hace seguro dejarlas fuera es el `aprobadaAlLlegar`, que no deja aprobar
       dos veces el mismo identificador. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, solicitudes])

  async function aprobarSolicitud(sol: SolicitudAlta) {
    // Limpio, igual que en el alta a mano: si no, el mismo señor con puntos y
    // sin puntos pasaba el control y entraba dos veces en el censo.
    const dniSolicitud = limpiarDni(sol.dni)
    if (hermanos.some((h) => limpiarDni(h.dni) === dniSolicitud)) {
      // Este rechazo lo decide la aplicación, así que el motivo lo escribe
      // ella: es el único caso en que se sabe seguro por qué.
      actualizarSolicitudes(solicitudes.map((s) => (
        s.id === sol.id
          ? resolverSolicitud(s, 'Rechazada', 'Ya hay un hermano/a con ese DNI en el censo de la hermandad.')
          : s
      )))
      return
    }
    const nuevo: Hermano = {
      id: nuevoId(),
      // El número definitivo se asigna dentro del setHermanos de abajo, ya con
      // la lista más reciente: calcularlo aquí (antes del await) podía repetir
      // número si entretanto se daba de alta a otro hermano.
      numero: 0,
      nombre: sol.nombre,
      estado: 'Nuevo',
      antiguedad: new Date().getFullYear(),
      email: sol.email,
      telefono: sol.telefono || 'Sin datos',
      direccion: 'Sin datos',
      cuotaAlDia: false,
      iban: null,
      dni: dniSolicitud,
      // Vacía a propósito: la de verdad vive en Supabase Auth. Ver claves.ts.
      claveAcceso: '',
      authUserId: null,
      // Si la pidió un hermano para un hijo suyo, el menor queda a su cargo y
      // podrá gestionarle la papeleta desde su propia cuenta.
      ...(sol.tutorId ? { tutorId: sol.tutorId } : {}),
      ...(sol.fechaNacimiento ? { fechaNacimiento: sol.fechaNacimiento } : {}),
    }
    /*
     * A UN MENOR NO SE LE CREA CUENTA, y no hacerlo es el arreglo.
     *
     * Cuando un hermano pide el alta de un hijo desde su área, del menor no se
     * piden ni correo ni contraseña: entra su tutor por él, desde su propia
     * cuenta. La solicitud viaja con `clavePropuesta: ''` y con el correo DEL
     * PADRE, que es a quien hay que escribir.
     *
     * Y aquí se le intentaba crear una cuenta igualmente. Fallaba siempre, y
     * por partida doble: la contraseña vacía no la acepta Supabase, y el
     * correo del padre ya tiene cuenta. Así que aprobar el alta de un hijo
     * terminaba SIEMPRE con la banda de aviso «la ficha se ha guardado, pero
     * NO se ha creado su acceso: el correo ya lo usa otra cuenta» — un aviso
     * que no significa nada aquí, porque ese menor no necesita ninguna cuenta,
     * y que hacía pensar que el alta no había funcionado.
     */
    /*
     * MENOR ES QUIEN TIENE TUTOR, Y SOLO ESO.
     *
     * Aquí ponía `Boolean(sol.tutorId) || !sol.clavePropuesta.trim()`. El
     * segundo trozo era un cinturón de más mientras el formulario pedía una
     * contraseña; desde que NO la pide —se guardaba en claro, ver
     * `FormulariosWeb.tsx`— todas las solicitudes llegan sin ella, y con esa
     * condición TODO EL MUNDO pasaría por menor: se aprobaría el alta y no se
     * le crearía cuenta a nadie, sin un solo aviso. Quien tiene tutor es menor;
     * lo demás no lo dice la contraseña.
     */
    const esMenorACargo = Boolean(sol.tutorId)
    /* Una clave de un solo uso, que se le manda por correo al darle la
       bienvenida. No se guarda en la ficha. */
    const claveProvisional = claveDeUnSoloUso()
    const acceso = esMenorACargo
      ? { id: null, error: null }
      : await crearAccesoHermano(sol.email, claveProvisional, sol.dni, sol.nombre)
    nuevo.authUserId = acceso.id
    // Cómo se llama su cuenta por dentro. Sin apuntarlo, la pantalla de entrar
    // no la encuentra a partir de su DNI y esa persona no entra nunca.
    nuevo.correoAcceso = acceso.correoAcceso ?? null
    // Si no se ha podido crear su acceso, se DICE. Ver crearAccesoHermano().
    if (acceso.error) onAvisoDeAcceso(acceso.error)
    // La comprobación de DNI se repite AQUÍ, ya con la lista más reciente: entre
    // el clic y el final del alta (una llamada de red) pudo entrar otro hermano.
    let duplicado = false
    let suNumero = 0
    setHermanos((prev) => {
      // Con `limpiarDni`, igual que la comprobación de arriba: con
      // `toUpperCase()` a secas, «12.345.678-A» y «12345678A» pasaban por
      // personas distintas y la misma entraba dos veces.
      if (prev.some((h) => mismoDni(h.dni, sol.dni))) {
        duplicado = true
        return prev
      }
      suNumero = Math.max(0, ...prev.map((h) => h.numero)) + 1
      return [...prev, { ...nuevo, numero: suNumero }]
    })
    /*
     * Y SE LE DA LA BIENVENIDA por correo, con su número y cómo entrar.
     *
     * Antes había que decírselo a mano, por teléfono o en el mostrador. En una
     * hermandad que da de alta a treinta personas después de un cabildo, eso
     * son treinta llamadas — y las que no se hacen son treinta personas que no
     * saben que tienen un área.
     *
     * La contraseña NO va escrita en el correo: ver src/lib/bienvenida.ts.
     */
    if (!duplicado) {
      if (esMenorACargo) {
        /* Al menor no se le manda «entra con tu DNI»: no tiene cuenta. Se
           avisa a QUIEN LO PIDIÓ, que es quien va a gestionarlo. */
        const tutor = hermanos.find((h) => h.id === sol.tutorId)
        if (tutor?.email) {
          void avisarPorCorreo(
            [{ id: tutor.id, nombre: tutor.nombre, email: tutor.email }],
            'ficha',
            'Ya está dado de alta',
            [
              `${nuevo.nombre} ya está en el censo de la hermandad, con el número ${suNumero}.`,
              'Lo gestionas desde tu propia área de hermano, en «Mi familia»: desde ahí puedes '
              + 'ver sus cuotas y sacarle la papeleta de sitio.',
            ],
            'Este aviso lo puedes apagar desde tu área de hermano.',
          )
        }
      } else {
        void darLaBienvenida({
          id: nuevo.id, nombre: nuevo.nombre, email: nuevo.email, dni: nuevo.dni,
          numero: suNumero,
          // Siempre se la mandamos: nunca la ha elegido ella. Y solo si su
          // cuenta se ha llegado a crear, claro.
          claveProvisional: acceso.id ? claveProvisional : null,
          hermandad: hermandad.nombreLegal,
        })
      }
    }
    // Sobre el estado más reciente de las solicitudes, no sobre el de antes del
    // await: si no, aprobar dos seguidas revertía la primera a «Pendiente».
    setSolicitudesState((prev) => {
      const next = prev.map((s) => (s.id === sol.id
        ? resolverSolicitud(
          s,
          duplicado ? 'Rechazada' : 'Aprobada',
          duplicado ? 'Ya hay un hermano/a con ese DNI en el censo de la hermandad.' : undefined,
        )
        : s))
      saveSolicitudes(next)
      return next
    })
    onReciénDadoDeAlta(nuevo.id)
    setTimeout(() => onReciénDadoDeAlta(null), 3000)
  }


  /**
   * Rechaza una solicitud CON EL PORQUÉ, que es lo que se pidió.
   *
   * Antes se ponía «Rechazada» y ya. Quien la había mandado no volvía a saber
   * nada: la solicitud desaparecía de su área sin decir si le habían dado de
   * alta, si se había perdido o si le habían dicho que no. El motivo se guarda
   * en la solicitud y se lee en «Mi familia» (ver lib/familia.ts).
   */
  function rechazarSolicitud(sol: SolicitudAlta, motivo: string) {
    actualizarSolicitudes(solicitudes.map((s) => (
      s.id === sol.id ? resolverSolicitud(s, 'Rechazada', motivo) : s
    )))
    setRechazando(null)
    setMotivoRechazo('')
  }

  return {
    solicitudes,
    pendientes,
    aprobarSolicitud,
    rechazarSolicitud,
    rechazando,
    setRechazando,
    motivoRechazo,
    setMotivoRechazo,
  }
}
