/**
 * IDENTIFICARSE EN EL ÁREA DEL HERMANO.
 *
 * La primera de las dos pantallas de `/hermano`: buscar tu hermandad, entrar
 * con tu DNI, pedir el alta si todavía no estás en el censo, o poner una
 * contraseña nueva viniendo del enlace del correo. Cuando alguien entra, lo
 * único que sale de aquí es una sesión: `onSesion`.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ ESTÁ AQUÍ Y NO DENTRO DE `HermanoPortal.tsx`
 * ----------------------------------------------------------------------------
 *
 * Porque se midió antes de cortar. El portal es UN solo componente con ciento
 * setenta y tres bindings dentro, y sacar de él una sección cualquiera costaba
 * entre veinte y cuarenta props: un componente de cuarenta props se lee peor
 * que el fichero gordo, así que esas secciones se quedaron donde estaban.
 *
 * Esta pantalla no. De los treinta y cuatro bindings del padre que usaba,
 * TREINTA Y UNO eran solo suyos, así que su estado, sus efectos y sus
 * manejadores se han mudado con ella y el contrato queda en siete props — las
 * siete cosas que de verdad vienen de fuera.
 *
 * Y no es una sección del portal: es LA OTRA PANTALLA. Las dos nunca se pintan
 * a la vez —el padre enseña esta mientras no hay hermano dentro— así que
 * separarlas no parte nada que estuviera junto.
 */
import EscudoHermandad from '../../components/EscudoHermandad'
import type { HermandadSettings } from '../../lib/hermandadSettings'

import {
  DNI_DEMO,
  MENSAJE_BAJA,
  guardarSesion,
  guardarSolicitudMuestra,
  hoy,
  type Sesion,
  type TablaMuestra,
} from './sesion'
import {
  fijarHermandadDeLaPagina,
  hermandadesPublicas,
  papelesDeLaCuenta,
  type HermandadPublica,
  type PapelesDeLaCuenta,
} from '../../lib/multiHermandad'
import { ID_HERMANDAD_PRINCIPAL, buscarHermandades, type HermandadDirectorio,
  type HermanoDirectorio,
} from '../../lib/hermandades'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { LogoMark } from '../../components/Logo'
import { PortalHead } from './PortalHead'
import { crearSolicitudPrincipal, type SolicitudAlta } from '../../lib/solicitudes'
import { estiloTema, inicialesHermandad } from '../../lib/color'
import { hayRecuperacionEnMarcha, olvidarRecuperacion } from '../../lib/recuperacionClave'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { limpiarDni, mismoDni } from '../../lib/dni'
import { marcarModoDemo, restaurarCensoDemo } from '../../lib/demo'
import { nuevoId } from '../../lib/supabaseSync'
import { pedirRecuperacion, ponerClaveConToken } from '../../lib/recuperarHermano'
import { problemaDeTelefono } from '../../lib/telefono'
import { type Hermano } from '../../data/hermanos'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

interface Props {
  /** El censo de la hermandad de este dominio: es donde se busca el DNI. */
  hermanos: Hermano[]
  /** Los censos de las hermandades de muestra, para el modo demostración. */
  censosMuestra: TablaMuestra<HermanoDirectorio>
  /** Si hay base de datos. Sin ella, el directorio es el de muestra. */
  usarSupabase: boolean
  /** Esta hermandad, para que salga en el buscador del directorio. */
  hermandadPrincipal: HermandadSettings
  nombrePrincipal: string
  /** Con qué color se tiñe la entrada mientras no se ha elegido hermandad. */
  colorActivo: string
  /**
   * Con qué DNI llega el campo rellenado.
   *
   * Sale de `?dni=` de la dirección, y es un PROP y no una lectura de la URL
   * aquí por una razón concreta: al salir del área, esta pantalla se vuelve a
   * montar de cero, así que leyéndolo de la URL el campo se rellenaría OTRA
   * VEZ con el DNI de quien acaba de salir. Antes de partir el fichero eso no
   * pasaba porque `salir()` vaciaba el campo a mano; ahora lo vacía el padre
   * poniendo esto a cadena vacía, que es lo mismo visto desde fuera.
   */
  dniInicial: string
  /** Lo único que produce esta pantalla: quién ha entrado. */
  onSesion: (sesion: Sesion | null) => void
}

export default function Identificarse({
  hermanos,
  censosMuestra,
  usarSupabase,
  hermandadPrincipal,
  nombrePrincipal,
  colorActivo,
  dniInicial,
  onSesion,
}: Props) {
  // La dirección y sus parámetros se piden AQUÍ, no se reciben: son hooks, no
  // estado, y pedirlos otra vez no cuesta nada.
  const [searchParams] = useSearchParams()
  /**
   * ¿Se ha llegado aquí porque el panel de gestión ha echado a esta cuenta?
   *
   * Lo manda `ProtectedRoute`. Sin contarlo, el rebote se lee como que la
   * aplicación está rota: pulsas «Gestiono la hermandad» y acabas en el área
   * del hermano, como si los dos botones llevaran al mismo sitio.
   */
  const ubicacion = useLocation()
  const echadoDelPanel = (ubicacion.state as { motivo?: string } | null)?.motivo === 'cuenta-de-hermano'

  // Qué es esta cuenta. Puede ser las dos cosas a la vez, que es lo normal.
  const [papelesAqui, setPapelesAqui] = useState<PapelesDeLaCuenta>({ esHermano: false, gestiona: false, seguro: false })
  useEffect(() => {
    void papelesDeLaCuenta().then(setPapelesAqui)
  }, [])

  // ---- Identificación: buscar hermandad → iniciar sesión o solicitar alta ----
  const [paso, setPaso] = useState<'buscar' | 'acceso'>('buscar')
  const [queryHermandad, setQueryHermandad] = useState('')
  const [hermandadElegida, setHermandadElegida] = useState<HermandadDirectorio | null>(null)
  const [modoAcceso, setModoAcceso] = useState<'login' | 'solicitud'>('login')
  const [dniInput, setDniInput] = useState(dniInicial)
  const [claveInput, setClaveInput] = useState('')
  const [errorLogin, setErrorLogin] = useState<string | null>(null)
  /** El acuse de «te hemos mandado un correo», o el motivo por el que no se puede. */
  const [recuperacion, setRecuperacion] = useState<{ tipo: 'hecho' | 'aviso'; texto: string } | null>(null)
  const [recuperando, setRecuperando] = useState(false)
  /**
   * Se ha llegado desde el enlace del correo de «he olvidado mi contraseña».
   *
   * Supabase deja un `type=recovery` en la parte de después de la almohadilla
   * y abre una sesión limitada, solo para cambiar la contraseña. Hay que
   * atenderlo aquí: si no, el hermano pulsa el enlace, aterriza en la pantalla
   * de entrar como si nada, y no entiende para qué le hemos mandado el correo.
   */
  /*
   * EL TOKEN DEL ENLACE QUE MANDAMOS NOSOTROS.
   *
   * `hayRecuperacionEnMarcha()` mira lo que deja Supabase tras la almohadilla,
   * y sigue valiendo para los hermanos que ya tenían cuenta antes de que las
   * cuentas pasaran a llamarse por hermandad + DNI. Los de ahora llegan con
   * `?recuperar=…`, que es el nuestro. Se atienden los dos: si no, la mitad de
   * la gente pulsa el enlace y aterriza en la pantalla de entrar sin entender
   * para qué le hemos mandado el correo.
   */
  const tokenDelEnlace = new URLSearchParams(window.location.search).get('recuperar') ?? ''

  const [poniendoClaveNueva, setPoniendoClaveNueva] = useState(
    () => hayRecuperacionEnMarcha() || tokenDelEnlace !== '',
  )
  const [claveNuevaError, setClaveNuevaError] = useState<string | null>(null)
  const [claveNuevaHecha, setClaveNuevaHecha] = useState(false)
  const [solicitudEnviada, setSolicitudEnviada] = useState(false)
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null)

  // Las hermandades dadas de alta de verdad. Todas comparten un mismo
  // Supabase, así que el hermano tiene que decir cuál es la suya ANTES de
  // escribir el DNI: el mismo DNI puede estar en dos hermandades (alguien que
  // es hermano de dos) y sin esto no se sabría a cuál entra.
  const [hermandadesReales, setHermandadesReales] = useState<HermandadPublica[]>([])
  const [falloElDirectorio, setFalloElDirectorio] = useState(false)
  useEffect(() => {
    if (!usarSupabase) return
    let cancelado = false
    hermandadesPublicas().then((lista) => {
      if (cancelado) return
      // `null` = no se pudo preguntar. Sin distinguirlo, quien busca su
      // hermandad no la encuentra y se va creyendo que no está en Gobergo.
      setFalloElDirectorio(lista === null)
      setHermandadesReales(lista ?? [])
    })
    return () => {
      cancelado = true
    }
  }, [usarSupabase])

  const datosPrincipalDirectorio = useMemo(
    () => ({
      nombre: nombrePrincipal,
      ciudad: hermandadPrincipal.ciudad,
      color: hermandadPrincipal.colorPrimario,
      telefono: hermandadPrincipal.telefono,
      email: hermandadPrincipal.email,
    }),
    [nombrePrincipal, hermandadPrincipal],
  )
  const opcionesHermandad = useMemo(
    () => buscarHermandades(queryHermandad, datosPrincipalDirectorio, hermandadesReales),
    [queryHermandad, datosPrincipalDirectorio, hermandadesReales],
  )

  function elegirHermandad(h: HermandadDirectorio) {
    setHermandadElegida(h)
    // De qué hermandad va esta página. Lo necesita la solicitud de alta, que
    // la rellena alguien que todavía no es hermano y no ha iniciado sesión:
    // sin esto no habría forma de saber a qué secretaría mandarla.
    if (usarSupabase) fijarHermandadDeLaPagina(h.id)
    setPaso('acceso')
    setModoAcceso('login')
    setErrorLogin(null)
    setErrorSolicitud(null)
    setSolicitudEnviada(false)
    // Se conserva el DNI que venga en el enlace (…/hermano?dni=…), que es como
    // llegan los hermanos desde un correo: si no, al elegir hermandad se borraba.
    setDniInput(searchParams.get('dni') ?? '')
    setClaveInput('')
  }

  // El enlace del correo puede llegar SIN recargar la página: si el hermano
  // ya tenía su área abierta, pulsar el enlace solo cambia lo que va detrás de
  // la almohadilla y el navegador no vuelve a montar nada. Sin escuchar esto,
  // se quedaría mirando la pantalla de entrar sin entender qué ha pasado.
  useEffect(() => {
    function alCambiarLaDireccion() {
      if (hayRecuperacionEnMarcha()) setPoniendoClaveNueva(true)
    }
    window.addEventListener('hashchange', alCambiarLaDireccion)
    return () => window.removeEventListener('hashchange', alCambiarLaDireccion)
  }, [])

  /** Guarda la contraseña nueva de quien viene del enlace del correo. */
  async function guardarClaveNueva(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    const nueva = String(datos.get('nueva') ?? '')
    const repetida = String(datos.get('repetida') ?? '')
    if (nueva.length < 6) {
      setClaveNuevaError('La contraseña tiene que tener al menos 6 caracteres.')
      return
    }
    if (nueva !== repetida) {
      setClaveNuevaError('Las dos contraseñas no coinciden.')
      return
    }
    if (!supabase) {
      setClaveNuevaError('No hay conexión con la base de datos.')
      return
    }
    /*
     * DOS CAMINOS, y hacen falta los dos.
     *
     * Con `?recuperar=…` es un enlace de los nuestros: el cambio lo hace la
     * función `enviar-correo` con la clave de servicio, porque una contraseña
     * no se puede cambiar desde el navegador sin una sesión.
     *
     * Sin él, es un enlace de Supabase de los de antes —los hermanos que ya
     * tenían cuenta siguen usándolos— y ahí sí hay sesión abierta.
     */
    if (tokenDelEnlace) {
      const r = await ponerClaveConToken(tokenDelEnlace, nueva)
      if (!r.ok) { setClaveNuevaError(r.error); return }
    } else {
      const { error } = await supabase.auth.updateUser({ password: nueva })
      if (error) {
        // El enlace del correo caduca. Decirlo es más útil que «error»: lo que
        // hay que hacer es pedir otro, no volver a intentarlo.
        setClaveNuevaError(
          'No se ha podido cambiar. El enlace del correo puede haber caducado: pide uno nuevo desde «¿Has olvidado tu contraseña?».',
        )
        return
      }
    }
    setClaveNuevaError(null)
    setClaveNuevaHecha(true)
    setPoniendoClaveNueva(false)
    olvidarRecuperacion()
  }

  function volverABuscar() {
    setPaso('buscar')
    setHermandadElegida(null)
    // Se deja de apuntar a ninguna: si no, quien vuelve atrás sin elegir otra
    // seguiría mandando su solicitud a la hermandad que miró antes.
    if (usarSupabase) fijarHermandadDeLaPagina(null)
    setErrorLogin(null)
    setErrorSolicitud(null)
    setSolicitudEnviada(false)
  }

  /**
   * «He olvidado mi contraseña». Manda al hermano un correo para ponerse otra.
   *
   * LO IMPORTANTE AQUÍ NO ES EL CORREO, ES LO QUE SE RESPONDE. La respuesta es
   * SIEMPRE la misma, exista o no ese DNI en el censo. Si dijera «ese DNI no
   * está», cualquiera podría ir probando documentos para averiguar quién es
   * hermano de qué hermandad — y eso revela convicciones religiosas, que es
   * categoría especial del RGPD. Una pantalla de login no puede ser una forma
   * de comprobar la fe de nadie.
   *
   * Tampoco se enseña a qué dirección se ha mandado, por lo mismo.
   */
  async function recuperarClave() {
    setErrorLogin(null)
    setRecuperacion(null)
    /* `limpiarDni` y no `normaliza`: este DNI viaja a la base de datos, y allí
       están guardados sin puntos ni guiones. Escrito «12.345.678-A» no
       encontraba a nadie y la recuperación decía que no existe esa cuenta. */
    const dni = limpiarDni(dniInput)
    if (!dni) {
      setRecuperacion({ tipo: 'aviso', texto: 'Escribe tu DNI y volvemos a intentarlo.' })
      return
    }

    // Sin base de datos no hay correos que mandar: la contraseña la cambia la
    // secretaría desde el panel, y eso es lo que hay que decir.
    if (!usarSupabase || !supabase || !hermandadElegida) {
      setRecuperacion({
        tipo: 'aviso',
        texto: 'Escribe a tu secretaría para que te pongan una nueva. Desde aquí todavía no se puede.',
      })
      return
    }

    setRecuperando(true)
    /*
     * LO MANDA EL SERVIDOR. Antes se le pedía a Supabase que escribiera a la
     * dirección de la cuenta; desde que la cuenta se llama por hermandad + DNI,
     * esa dirección no recibe nada. Ahora la función `enviar-correo` busca el
     * correo DE VERDAD en la ficha y manda ahí el enlace, y ni el token ni la
     * dirección pasan por este navegador. Ver `lib/recuperarHermano.ts`.
     */
    await pedirRecuperacion(hermandadElegida.id, dni)
    setRecuperando(false)
    setRecuperacion({
      tipo: 'hecho',
      texto:
        'Si ese DNI está en el censo y tiene un correo puesto, te acabamos de mandar un enlace para cambiar la contraseña. Míralo también en la carpeta de spam.',
    })
  }

  /** DNI + contraseña, ya dentro de la hermandad elegida — no hace falta adivinar dónde busca. */
  async function identificar(e: FormEvent) {
    e.preventDefault()
    if (!hermandadElegida) return
    /* Limpio: va dentro de `resolver_email_hermano`, y en la base los DNI
       están sin puntos. Con `normaliza` a secas, quien escribiera el suyo
       puntuado NO PODÍA ENTRAR, y el mensaje decía que los datos no son
       correctos — que es exactamente lo contrario de lo que pasaba. */
    const dni = limpiarDni(dniInput)

    // Con la base de datos conectada, la hermandad elegida es una de verdad y
    // su id viaja en la consulta. Es imprescindible: el DNI ya no es único en
    // toda la base —la misma persona puede ser hermana de dos hermandades— y
    // buscar solo por DNI podía devolver el correo de otra.
    if (usarSupabase && supabase) {
      const { data: email, error: rpcError } = await supabase.rpc('resolver_email_hermano', {
        p_hermandad_id: hermandadElegida.id,
        p_dni: dni,
      })
      if (rpcError || !email) {
        setErrorLogin('DNI o contraseña incorrectos.')
        return
      }
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: claveInput,
      })
      if (signInError || !signInData.session) {
        setErrorLogin('DNI o contraseña incorrectos.')
        return
      }
      // Sin filtrar por hermandad: ya con la sesión abierta, las políticas de
      // Supabase hacen que esta persona solo vea su propia ficha y ninguna más.
      const { data: fila } = await supabase.from('hermanos').select('*').eq('dni', dni).maybeSingle()
      if (!fila) {
        setErrorLogin('No se pudo cargar tu ficha. Inténtalo de nuevo en unos segundos.')
        return
      }
      if (fila.estado === 'Baja') {
        // La contraseña era correcta, así que la sesión de Supabase ya está
        // abierta: se cierra antes de salir.
        await supabase.auth.signOut()
        setErrorLogin(MENSAJE_BAJA)
        return
      }
      // La sesión sigue guardando ID_HERMANDAD_PRINCIPAL, que aquí significa
      // «la hermandad de verdad, la que está en la base de datos», frente a
      // las de muestra del modo demostración. Ya dentro, un hermano pertenece
      // a una sola hermandad y todo lo que lee viene filtrado por Supabase.
      const nueva = { hermandadId: ID_HERMANDAD_PRINCIPAL, hermanoId: fila.id as string }
      guardarSesion(nueva)
      onSesion(nueva)
      setErrorLogin(null)
      return
    }

    if (hermandadElegida.id === ID_HERMANDAD_PRINCIPAL) {
      const encontrado = hermanos.find((h) => mismoDni(h.dni, dni) && h.claveAcceso === claveInput)
      if (!encontrado) {
        setErrorLogin('DNI o contraseña incorrectos.')
        return
      }
      if (encontrado.estado === 'Baja') {
        setErrorLogin(MENSAJE_BAJA)
        return
      }
      const nueva = { hermandadId: ID_HERMANDAD_PRINCIPAL, hermanoId: encontrado.id }
      guardarSesion(nueva)
      onSesion(nueva)
      setErrorLogin(null)
      return
    }

    const censo = censosMuestra[hermandadElegida.id]?.[0] ?? []
    const encontrado = censo.find((c) => mismoDni(c.dni, dni) && c.claveAcceso === claveInput)
    if (!encontrado) {
      setErrorLogin('DNI o contraseña incorrectos.')
      return
    }
    const nueva = { hermandadId: hermandadElegida.id, hermanoId: encontrado.id }
    guardarSesion(nueva)
    onSesion(nueva)
    setErrorLogin(null)
  }

  /** Quien todavía no está en el censo pide el alta; la secretaría la aprueba o la rechaza desde Hermanos. */
  function solicitarAlta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!hermandadElegida) return
    const data = new FormData(e.currentTarget)
    const nombre = String(data.get('nombre') ?? '').trim()
    /* Limpio antes de guardarlo en la solicitud: si entra con puntos, se queda
       con puntos en la base y luego no coincide con nada — ni con su ficha
       cuando se apruebe, ni con el barrido de supresión del RGPD, que busca
       las solicitudes por DNI para borrarlas. */
    const dni = limpiarDni(String(data.get('dni') ?? ''))
    const email = String(data.get('email') ?? '').trim()
    const telefono = String(data.get('telefono') ?? '').trim()
    /*
     * NO SE PIDE CONTRASEÑA, Y ESO ES EL ARREGLO. Se guardaba EN CLARO en
     * `solicitudes_alta`, donde la lee cualquiera del personal con el módulo
     * «hermanos» y donde se quedaba mientras la solicitud estuviera pendiente.
     * La gente repite contraseñas: la que veía la secretaria es probablemente
     * la de su correo. La clave se genera al aprobar y se manda por correo.
     */
    if (!nombre || !dni || !email) {
      setErrorSolicitud('Rellena tu nombre, DNI y correo.')
      return
    }
    // El teléfono es opcional, pero si lo pone tiene que servir para llamarle:
    // es por donde secretaría le avisa de que su alta está aprobada.
    const malTelefono = problemaDeTelefono(telefono)
    if (malTelefono) {
      setErrorSolicitud(malTelefono)
      return
    }

    // Con Supabase conectado esta comprobación no se puede hacer aquí: quien
    // rellena esto no ha iniciado sesión y no puede leer el censo de nadie
    // —faltaría más—. Si el DNI ya estuviera, lo verá la secretaría al recibir
    // la solicitud, que es quien tiene que decidir.
    const yaEsHermano =
      usarSupabase
        ? false
        : hermandadElegida.id === ID_HERMANDAD_PRINCIPAL
          ? hermanos.some((h) => mismoDni(h.dni, dni))
          : (censosMuestra[hermandadElegida.id]?.[0] ?? []).some((h) => mismoDni(h.dni, dni))
    if (yaEsHermano) {
      setErrorSolicitud('Ya hay un hermano/a con ese DNI en esta hermandad. Prueba a iniciar sesión.')
      return
    }

    const nueva: SolicitudAlta = {
      id: nuevoId(),
      nombre,
      dni,
      email,
      telefono,
      clavePropuesta: '',
      fecha: hoy(),
      estado: 'Pendiente',
    }

    if (usarSupabase || hermandadElegida.id === ID_HERMANDAD_PRINCIPAL) {
      // Se espera al resultado: antes se decía «tu solicitud se ha enviado a
      // la secretaría» aunque no hubiera salido del navegador.
      crearSolicitudPrincipal(nueva).then((r) => {
        if (r.ok) {
          setErrorSolicitud(null)
          setSolicitudEnviada(true)
        } else {
          setErrorSolicitud(r.error ?? 'No se pudo enviar la solicitud.')
        }
      })
      return
    }
    guardarSolicitudMuestra(hermandadElegida.id, nueva)
    setErrorSolicitud(null)
    setSolicitudEnviada(true)
  }

  function entrarComoDemo(hermanoId: string = DNI_DEMO) {
    // El navegador puede tener un censo viejo (de pruebas anteriores) que ya no
    // incluye a este hermano de muestra. En vez de fallar, restauramos el censo
    // de ejemplo y recargamos: la sesión queda guardada y, al volver, el hermano
    // ya existe. Así el acceso demo funciona siempre, sin depender del estado
    // previo del navegador.
    if (!hermanos.some((h) => h.id === hermanoId)) {
      marcarModoDemo()
      restaurarCensoDemo()
      guardarSesion({ hermandadId: ID_HERMANDAD_PRINCIPAL, hermanoId })
      window.location.reload()
      return
    }
    marcarModoDemo()
    const nueva = { hermandadId: ID_HERMANDAD_PRINCIPAL, hermanoId }
    guardarSesion(nueva)
    onSesion(nueva)
  }


  // Unos cuantos hermanos del censo para entrar de un clic en modo local (igual
  // que los accesos rápidos del panel de la hermandad, pero del lado del hermano).
  /**
   * Accesos rápidos de demostración. Solo cuando NO hay Supabase configurado
   * en absoluto: `usarSupabase` también es false cuando Supabase está caído o
   * en pausa, y en ese caso `hermanos` no son los de ejemplo sino el CENSO
   * REAL espejado en este navegador. Enseñar ahí el DNI y la contraseña de
   * cuatro hermanos de verdad, en una pantalla pública, es una fuga.
   */
  const hayDemo = !isSupabaseConfigured
  const hermanosDemo = useMemo(
    () => (hayDemo ? hermanos.filter((h) => h.estado !== 'Baja').slice(0, 4) : []),
    [hermanos, hayDemo],
  )


  return (
    <div className="portal portal--entrada" style={estiloTema(hermandadElegida?.color ?? '#6A1A23')}>
      {/* Las manchas de color, el damasco y la luz del fondo. Van en su
          propia capa para poder quedarse DEBAJO del arco de piedra y de la
          filigrana, que se pintan con los pseudoelementos de `.portal`.

          Y `portal--entrada` porque toda esa escena es SOLO la entrada: una
          vez dentro, el hermano está trabajando y el fondo es el normal. */}
      <div className="portal__ambiente" aria-hidden="true" />
      <PortalHead
        hermandad={hermandadElegida?.nombre ?? 'Gobergo'}
        logo={hermandadElegida?.logoDataUrl ?? null}
        color={hermandadElegida?.color}
        icono={hermandadElegida?.icono}
      />
      <main className="portal__stage">
        <aside className="portal__aside" style={{ ['--portal-accent' as string]: hermandadElegida?.color ?? colorActivo }}>
          {/* El lacre. Es lo primero que se ve al entrar, así que lleva el
              escudo de SU hermandad si lo ha subido; la marca de Gobergo solo
              mientras no ha elegido ninguna, porque a partir de ahí el
              hermano tiene que ver lo suyo, no lo nuestro. */}
          <div className="portal__sello">
            <span className="portal__sello-disco">
              {hermandadElegida?.logoDataUrl ? (
                <img src={hermandadElegida.logoDataUrl} alt="" className="portal__aside-escudo" />
              ) : (
                /* `claro` porque el lacre es cera GRANATE: sin esto la marca
                   se pintaba del mismo color que el fondo y no se veía. El
                   tono exacto —oro, como el anillo del lacre— lo pone el CSS;
                   esto es el cinturón por si esa regla desaparece. */
                <LogoMark size={64} claro />
              )}
            </span>
          </div>
          <h2 className="portal__aside-title">Tu hermandad, en tu bolsillo</h2>
          <p className="portal__aside-sub">Entra en tu área personal y gestiona todo sin pasar por secretaría.</p>
          <ul className="portal__aside-list">
            <li>Tus cuotas y recibos al día</li>
            <li>Tu papeleta de sitio y su pago</li>
            <li>Solicitudes y tus datos personales</li>
            <li>Avisos y comunicados de la hermandad</li>
          </ul>
        </aside>
        <div className="portal__card">
          {echadoDelPanel && !poniendoClaveNueva && (
            <div className="banner-inline banner-inline--warn" role="status">
              <span>
                <b>Esta cuenta no lleva ningún cargo en la hermandad.</b> Por eso te hemos traído
                aquí, a tu área. Si tienes cargo y no puedes entrar al panel, pídele a secretaría
                que te lo ponga en tu ficha, en «Personal y permisos». No hace falta otra cuenta ni
                otra contraseña: es la misma.
              </span>
            </div>
          )}

          {/* Y al revés: quien SÍ gestiona y ha venido a su área tiene que
              poder volver sin cerrar sesión. Casi todo el que lleva una
              hermandad es además hermano, así que este camino se hace todos
              los días. */}
          {papelesAqui.gestiona && !poniendoClaveNueva && (
            <div className="banner-inline" role="status">
              <span>Estás en tu área personal.</span>
              <Link to="/app" className="btn btn-ghost btn-sm">Ir al panel de gestión</Link>
            </div>
          )}

          {/* `!poniendoClaveNueva`: viniendo del enlace del correo, el
              buscador de hermandad no pinta nada. Sin esto se quedaba
              ARRIBA, con el formulario de la contraseña debajo del todo, y
              el hermano leía «Busca tu hermandad» y se paraba ahí. */}
          {paso === 'buscar' && !poniendoClaveNueva && (
            <>
              <div className="portal__card-head">
                <span className="portal__card-head-titulo">Tu espacio personal</span>
                <span className="portal__card-head-marca">Gobergo</span>
              </div>

              <h1>Encuentra tu hermandad</h1>
              <p className="portal__lead">
                Escribe el nombre completo o la ciudad para acceder a tu área personal.
              </p>

              <div className="portal__buscador">
                <label htmlFor="buscarHermandad" className="sr-only">Tu hermandad</label>
                <input
                  id="buscarHermandad"
                  type="text"
                  value={queryHermandad}
                  onChange={(e) => setQueryHermandad(e.target.value)}
                  placeholder="Nombre o ciudad…"
                  autoFocus
                />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />
                </svg>
              </div>
              <ul className="portal__picker">
                {opcionesHermandad.map((h) => (
                  <li key={h.id}>
                    <button type="button" className="portal__picker-item" onClick={() => elegirHermandad(h)}>
                      <EscudoHermandad color={h.color} icono={h.icono} logoDataUrl={h.logoDataUrl} nombre={h.nombre} size={30} />
                      <span>
                        <b>{h.nombre}</b>
                        {h.ciudad && <small>{h.ciudad}</small>}
                      </span>
                    </button>
                  </li>
                ))}
                {opcionesHermandad.length === 0 && (
                  <li className="portal__picker-empty">
                    {/*
                      SI NO SE PUDO LEER LA LISTA, SE DICE. Antes un tropiezo
                      de red se veía igual que «tu hermandad no está»: quien
                      busca la suya y no la encuentra se va convencido de que
                      no usa Gobergo, y no vuelve.
                    */}
                    {falloElDirectorio
                      ? 'No se ha podido cargar la lista de hermandades. Recarga la página e '
                        + 'inténtalo otra vez; no quiere decir que la tuya no esté.'
                      : queryHermandad.trim()
                        ? 'No encontramos ninguna hermandad con ese nombre.'
                        : 'Todavía no hay ninguna hermandad dada de alta en Gobergo.'}
                  </li>
                )}
              </ul>

              {hayDemo && (
                <div className="banner banner--info banner--demo" role="status" style={{ marginTop: '0.4rem' }}>
                  <div>
                    <strong>Modo demostración.</strong> Entra con datos de ejemplo (censo, cuotas y
                    papeleta) y prueba el área del hermano sin escribir nada.
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => entrarComoDemo()}
                  >
                    Entrar en modo demo (datos de ejemplo)
                  </button>
                  {hermanosDemo.length > 0 && (
                    <>
                      <div className="demo-accounts__label">O entra como un hermano concreto:</div>
                      <div className="demo-accounts">
                        {hermanosDemo.map((h) => (
                          <button
                            type="button"
                            key={h.id}
                            className="demo-account"
                            onClick={() => entrarComoDemo(h.id)}
                          >
                            <span className="demo-account__avatar">{inicialesHermandad(h.nombre)}</span>
                            <span>
                              <b>{h.nombre}</b>
                              <small>Hermano/a nº {h.numero}</small>
                              <small className="demo-account__cred">DNI {h.dni} · {h.claveAcceso}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="portal__foot">
                <Link to="/" className="portal__foot-back">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  Volver a la portada
                </Link>
              </div>
            </>
          )}

          {/* Viene del enlace del correo: lo único que tiene que hacer aquí es
              poner su contraseña nueva. Se enseña por delante de todo lo
              demás, hermandad incluida: ya está identificado por el enlace. */}
          {poniendoClaveNueva && (
            <div className="portal__recuperar">
              <h2>Pon tu contraseña nueva</h2>
              <p className="form-hint">
                Has llegado desde el enlace que te mandamos por correo. Elige una contraseña y ya
                puedes entrar con ella.
              </p>
              <form onSubmit={guardarClaveNueva}>
                <div className="form-row">
                  <label htmlFor="claveNueva">Contraseña nueva</label>
                  <input id="claveNueva" name="nueva" type="password" autoComplete="new-password" autoFocus required />
                </div>
                <div className="form-row">
                  <label htmlFor="claveNuevaRepetida">Repítela</label>
                  <input id="claveNuevaRepetida" name="repetida" type="password" autoComplete="new-password" required />
                </div>
                {claveNuevaError && <p className="form-hint form-hint--error">{claveNuevaError}</p>}
                <button type="submit" className="btn btn-primary btn-block">
                  Guardar y entrar
                </button>
              </form>
            </div>
          )}

          {claveNuevaHecha && (
            <div className="banner-inline banner-inline--accent" style={{ marginBottom: '1rem' }}>
              Contraseña cambiada. Entra abajo con tu DNI y la nueva.
            </div>
          )}

          {paso === 'acceso' && hermandadElegida && !poniendoClaveNueva && (
            <>
              <button type="button" className="portal__back" onClick={volverABuscar}>
                ← Cambiar de hermandad
              </button>
              <div className="portal__chosen" style={{ borderColor: hermandadElegida.color }}>
                <EscudoHermandad
                  color={hermandadElegida.color}
                  icono={hermandadElegida.icono}
                  logoDataUrl={hermandadElegida.logoDataUrl}
                  nombre={hermandadElegida.nombre}
                  size={34}
                />
                <span>
                  <b>{hermandadElegida.nombre}</b>
                  {hermandadElegida.ciudad && <small>{hermandadElegida.ciudad}</small>}
                </span>
              </div>

              <div className="portal__tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={modoAcceso === 'login'}
                  className={`portal__tab${modoAcceso === 'login' ? ' portal__tab--active' : ''}`}
                  onClick={() => setModoAcceso('login')}
                >
                  Ya soy hermano/a
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={modoAcceso === 'solicitud'}
                  className={`portal__tab${modoAcceso === 'solicitud' ? ' portal__tab--active' : ''}`}
                  onClick={() => setModoAcceso('solicitud')}
                >
                  Quiero ser hermano/a
                </button>
              </div>

              {modoAcceso === 'login' && (
                <>
                  <p className="portal__lead">Entra con tu DNI y tu contraseña.</p>
                  <form className="app-form" onSubmit={identificar}>
                    <div className="form-row">
                      <label htmlFor="dniHermano">DNI / NIE</label>
                      <input
                        id="dniHermano"
                        type="text"
                        value={dniInput}
                        onChange={(e) => setDniInput(e.target.value)}
                        placeholder="12345678A"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="form-row">
                      <label htmlFor="claveHermano">Contraseña</label>
                      <input
                        id="claveHermano"
                        type="password"
                        value={claveInput}
                        onChange={(e) => setClaveInput(e.target.value)}
                        placeholder="Tu contraseña (al alta, tu DNI)"
                        required
                      />
                    </div>
                    {errorLogin && <p className="form-hint form-hint--error">{errorLogin}</p>}
                    <button type="submit" className="btn btn-primary btn-block">
                      Entrar
                    </button>
                    {/* Debajo del botón y no arriba: quien se sabe su
                        contraseña no tiene por qué leer esto. */}
                    <button
                      type="button"
                      className="portal__olvide"
                      onClick={recuperarClave}
                      disabled={recuperando}
                    >
                      {recuperando ? 'Mandando…' : '¿Has olvidado tu contraseña?'}
                    </button>
                    {recuperacion && (
                      <p
                        className={`form-hint${recuperacion.tipo === 'hecho' ? ' form-hint--ok' : ''}`}
                        role="status"
                      >
                        {recuperacion.texto}
                      </p>
                    )}
                  </form>
                  {!usarSupabase && hermandadElegida.id === ID_HERMANDAD_PRINCIPAL && (
                    <>
                      <div className="auth-sep"><span>o</span></div>
                      <button
                        type="button"
                        className="btn btn-outline btn-block"
                        onClick={() => entrarComoDemo()}
                      >
                        Entrar en modo demo (sin escribir)
                      </button>
                    </>
                  )}
                </>
              )}

              {modoAcceso === 'solicitud' &&
                (solicitudEnviada ? (
                  <div className="banner-inline banner-inline--accent">
                    Tu solicitud se ha enviado a la secretaría de {hermandadElegida.nombre}. Te avisarán en cuanto la
                    revisen.
                  </div>
                ) : (
                  <>
                    <p className="portal__lead">
                      Pide el alta como hermano/a de {hermandadElegida.nombre}. La secretaría revisará tu solicitud.
                    </p>
                    <form className="app-form" onSubmit={solicitarAlta}>
                      <div className="form-row">
                        <label htmlFor="solNombre">Nombre y apellidos</label>
                        <input id="solNombre" name="nombre" type="text" placeholder="Nombre completo" required />
                      </div>
                      <div className="form-row">
                        <label htmlFor="solDni">DNI / NIE</label>
                        <input id="solDni" name="dni" type="text" placeholder="12345678A" required />
                      </div>
                      <div className="form-row">
                        <label htmlFor="solEmail">Correo electrónico</label>
                        <input id="solEmail" name="email" type="email" placeholder="tucorreo@ejemplo.com" required />
                      </div>
                      <div className="form-row">
                        <label htmlFor="solTelefono">Teléfono</label>
                        <input id="solTelefono" name="telefono" type="tel" inputMode="tel" placeholder="600 00 00 00" />
                      </div>
                      <p className="form-hint">
                        Si la hermandad te da de alta, te llega una clave a ese correo para entrar
                        en tu área. La cambias por la que quieras en cuanto entres.
                      </p>
                      {errorSolicitud && <p className="form-hint form-hint--error">{errorSolicitud}</p>}
                      <button type="submit" className="btn btn-primary btn-block">
                        Enviar solicitud
                      </button>
                    </form>
                  </>
                ))}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
