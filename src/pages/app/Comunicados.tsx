/**
 * COMUNICADOS: lo que la hermandad manda, y a quién.
 *
 * ----------------------------------------------------------------------------
 * LA PANTALLA QUE MÁS CUIDADO PIDE DE TODO EL PANEL
 * ----------------------------------------------------------------------------
 *
 * Desde aquí salen correos en nombre de la hermandad a ochocientas personas, y
 * un envío no se puede deshacer. Por eso tiene DOCE ficheros de prueba
 * mirándola, varios de ellos leyendo su fuente, y por eso casi todas las
 * decisiones de abajo están del lado de «mejor no mandarlo» cuando hay dudas.
 *
 * ----------------------------------------------------------------------------
 * A QUIÉN SE PUEDE ESCRIBIR, QUE SON DOS PÚBLICOS DISTINTOS
 * ----------------------------------------------------------------------------
 *
 *   · LOS HERMANOS, por SEGMENTOS: «activos», «con cuota pendiente»,
 *     «costaleros». Un segmento se guarda con los CRITERIOS con los que se
 *     compuso, no solo con su etiqueta legible: así se puede volver a resolver
 *     más tarde, cuando el censo ya ha cambiado. Ver `lib/segmentacion.ts`.
 *   · LOS SUSCRIPTORES DE LA WEB — vecinos y devotos que no son hermanos y se
 *     apuntaron en la web. De esta lista sale el boletín.
 *
 * ----------------------------------------------------------------------------
 * TRES DISTINCIONES QUE PARECEN SUTILES Y SON LA DIFERENCIA ENTRE MANDAR Y NO
 * ----------------------------------------------------------------------------
 *
 * 1. `suscriptores === null` NO ES LO MISMO QUE `[]`. `null` es «no se ha
 *    podido preguntar»; `[]` es «de verdad no hay ninguno». Dando por buena una
 *    lista vacía que en realidad es un fallo, el envío se hace, no escribe a
 *    nadie y la pantalla dice «Enviado a 0 suscriptores» — y nadie vuelve a
 *    mirarlo.
 * 2. QUIEN NO HA CONFIRMADO NO RECIBE NADA. Si son la mitad de la lista, la
 *    mitad de los avisos de la hermandad no salen de aquí, y en silencio. Hay
 *    un botón para reenviarles el correo de confirmación de una vez.
 * 3. `prepararAvisos()` AL MONTAR, antes de mandar nada: trae de la base la
 *    configuración de correo de la hermandad y lo que cada hermano tenga
 *    APAGADO en sus preferencias. Sin eso, quien entra desde otro ordenador
 *    trabaja con la de fábrica: o no sale ningún aviso, o se le escribe a quien
 *    pidió que no. Los dos en silencio.
 *
 * ----------------------------------------------------------------------------
 * LAS PIEZAS, EN `comunicados/`
 * ----------------------------------------------------------------------------
 *
 * · `mandarElComunicado.ts` — el envío de verdad. Lo que se toca con más miedo.
 * · `losProgramados.ts` — los que salen a una hora. Ver `supabase/envio-programado.sql`.
 * · `PanelDeReglas.tsx` — los «avisos automáticos»: se mandan solos cuando pasa
 *   algo (un hermano se da de alta, una cuota vence).
 * · `PanelDeRedes.tsx` + `redesSociales.ts` — el texto para publicar en redes.
 *   Esto NO publica: genera el texto y lo copia, porque publicar de verdad
 *   necesita credenciales de cada red que una hermandad no tiene.
 * · `PanelDeEncargos.tsx` + `encargosDeRedes.ts` — el encargo a quien lleva las
 *   redes, que es una persona distinta de quien escribe el comunicado.
 * · `alcance.ts` — a cuánta gente llegaría esto, que es lo que se mira antes de
 *   darle al botón.
 *
 * El correo de verdad lo manda la función `enviar-correo` de Supabase, no el
 * navegador; el camino completo está en `docs/COMO-VIAJA-UN-CORREO.md`.
 */
import { llano } from '../../lib/buscar'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { prepararAvisos } from '../../lib/avisosCorreo'
import Drawer from '../../components/Drawer'
import AvisoFalta from '../../components/AvisoFalta'
import { requisito } from '../../lib/requisitos'
import EditorSegmento from '../../components/EditorSegmento'
import { CLAVES_CATALOGOS, useLista } from '../../lib/catalogos'
import {
  CANALES,
  COMUNICADOS_INICIALES,
  REDES_SOCIALES,
  SEGMENTOS,
  SEGMENTO_SUSCRIPTORES,
  type Canal,
  type Comunicado,
  type EstadoComunicado,
  type RedSocial,
} from '../../data/comunicados'
import { formatDate } from '../../lib/format'
import { CLAVES_DATOS, leerDatos } from '../../lib/persistencia'
import { PAPELETAS_INICIALES } from '../../data/papeletas'
import { getCampana } from '../../lib/campana'
import { useTramos } from '../../lib/tramos'
import { conPapeletaDeSitio, etiquetasDe, etiquetasQueSonAutomaticas, indiceRoles } from '../../lib/rolesPapeleta'
import { CLAVE_PERSONAL, cargosEfectivos, getPersonal, personalDelSegmento, type MiembroPersonal } from '../../lib/personal'
import { personalToRow, rowToPersonal } from '../../lib/db/personal'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { comunicadoToRow, rowToComunicado } from '../../lib/db/comunicados'
import { useEtiquetas } from '../../lib/etiquetas'
import {
  CRITERIOS_POR_DEFECTO,
  criteriosDeSegmento,
  filtrarSegmento,
  etiquetaSegmento,
  segmentoDePapeleta,
  type CriteriosSegmento,
} from '../../lib/segmentacion'
import { HERMANOS_INICIALES, type Hermano } from '../../data/hermanos'
import { llevaMarcas, sePuedePersonalizar, vistaPrevia, MARCAS } from '../../lib/personalizar'
import { getHermandadSettings } from '../../lib/hermandadSettings'
import { useReglasAutomaticas } from '../../lib/reglasAutomaticas'
import { hayDatosDeEjemplo } from '../../lib/demo'
import { filaQueAbre } from '../../lib/foco'
import { hoyIso } from '../../lib/hoy'
import { CUOTAS_INICIALES } from '../../data/cuotas'
import { situacionDeTodos } from '../../lib/estadoCuotaHermano'
import { ejercicioDeCuotas } from '../../lib/cuotasEmision'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import {
  COLOR_RED,
  accionDePublicar,
  sePasaDeLargo,
  textoParaRedes,
  LIMITE_X,
} from '../../lib/redesSociales'
import IconoRed from '../../components/IconoRed'
import {
  getSuscriptores, losQueFaltanPorConfirmar, losQueSePuedenAvisar,
  reenviarConfirmaciones, type Suscriptor,
} from '../../lib/suscriptoresWeb'
import { hermandadActualId } from '../../lib/multiHermandad'
import type { Alcance } from './comunicados/alcance'
import { useLosProgramadosQueYaTocaban } from './comunicados/losProgramados'
import { mandarElComunicado } from './comunicados/mandarElComunicado'
import PanelDeReglas from './comunicados/PanelDeReglas'
import { useLasRedes } from './comunicados/redesSociales'
import PanelDeRedes from './comunicados/PanelDeRedes'
import { useEncargosDeRedes } from './comunicados/encargosDeRedes'
import PanelDeEncargos from './comunicados/PanelDeEncargos'

/** Prefijo con el que se guarda un destinatario que es una etiqueta de hermano. */
const PREFIJO_ETIQUETA = 'Etiqueta: '


function fmt(iso: string | null) {
  if (!iso) return '—'
  return formatDate(new Date(`${iso}T00:00:00`))
}

function claseEstado(estado: EstadoComunicado) {
  if (estado === 'Enviado') return 'pill--ok'
  if (estado === 'Programado') return 'pill--warn'
  return 'pill--off'
}

export default function Comunicados() {
  // Antes de mandar nada, traer de la base la configuración de correo de
  // la hermandad y lo que cada hermano tenga apagado. Sin esto, quien
  // entra desde otro ordenador trabaja con la de fábrica: no sale ningún
  // aviso, o se le escribe a quien pidió que no. Los dos en silencio.
  useEffect(() => {
    void prepararAvisos()
  }, [])

  const [comunicados, setComunicados] = useSupabaseTable<Comunicado>(
    'comunicados',
    CLAVES_DATOS.comunicados,
    COMUNICADOS_INICIALES,
    comunicadoToRow,
    rowToComunicado,
  )
  /*
   * LAS REDES, EN SU SITIO (`comunicados/redesSociales.ts`).
   *
   * Se desarma aquí para que todo lo de abajo siga nombrando `cuentas` y
   * `copiado` como siempre; `redes` entero es lo que se le pasa al panel.
   */
  const redes = useLasRedes()
  const { cuentas, cuentasConectadas, enlaceDeLaWeb, compartirMovil, copiado, setCopiado } = redes
  const canales = useLista(CLAVES_CATALOGOS.canalesComunicado, CANALES)
  const segmentos = useLista(CLAVES_CATALOGOS.segmentosComunicado, SEGMENTOS)
  /*
   * Los de fuera: vecinos y devotos apuntados en la web. Se traen una vez al
   * abrir la pantalla — no cambian mientras se escribe un comunicado, y
   * volverlos a pedir en cada tecla sería una consulta por letra.
   */
  /*
   * `null` = no se ha podido preguntar · `[]` = de verdad no hay ninguno.
   *
   * La diferencia importa porque DE ESTA LISTA SALE EL BOLETÍN: dando por
   * buena una lista vacía que en realidad es un fallo, el envío se hace, no
   * escribe a nadie y la pantalla dice «Enviado a 0 suscriptores».
   */
  const [suscriptores, setSuscriptores] = useState<Suscriptor[] | null>(null)
  useEffect(() => { void getSuscriptores().then(setSuscriptores) }, [])
  const listaSuscriptores = suscriptores ?? []
  const noSeSupoDeLosSuscriptores = suscriptores === null

  /*
   * LOS QUE SE APUNTARON Y NO HAN CONFIRMADO.
   *
   * No es un detalle: a esa gente NO SE LE ESCRIBE, así que si son la mitad de
   * la lista, la mitad de los avisos de la hermandad no salen de aquí. Y hasta
   * ahora era peor —ese correo de confirmar no se mandaba nunca, no había
   * forma— así que están TODOS sin confirmar y esperando un enlace que no
   * llegó. Con el botón de abajo se les manda de una vez.
   */
  const pendientes = losQueFaltanPorConfirmar(listaSuscriptores)
  const [reenviando, setReenviando] = useState(false)
  const [avisoReenvio, setAvisoReenvio] = useState('')

  async function reenviarLasConfirmaciones() {
    setReenviando(true)
    setAvisoReenvio('')
    const hermandadId = await hermandadActualId()
    if (!hermandadId) {
      setReenviando(false)
      setAvisoReenvio('No se ha podido saber de qué hermandad son. Recarga la página e inténtalo otra vez.')
      return
    }
    const { enviados, fallidos } = await reenviarConfirmaciones(hermandadId, pendientes)
    setReenviando(false)
    /*
     * SE DICEN LOS DOS NÚMEROS. «Enviado» a secas, con la mitad sin salir, deja
     * a la hermandad creyendo que ya está y esa gente no vuelve a recibir nada.
     * Y los que fallan no siempre son un fallo: la base no manda dos correos al
     * mismo sitio en diez minutos, así que pulsar dos veces cuenta el segundo
     * como no enviado, que es exactamente lo que ha pasado.
     */
    setAvisoReenvio(
      enviados === 0
        ? `No ha salido ninguno de los ${pendientes.length}. Si acabas de pulsar, espera diez minutos; `
          + 'si no, mira Configuración → Correo.'
        : `Enlace enviado a ${enviados}${fallidos > 0 ? `, y ${fallidos} sin salir` : ''}.`,
    )
    setSuscriptores(await getSuscriptores())
  }
  const [etiquetas] = useEtiquetas()
  /**
   * `leerDatos` y no `leerPersistido`: con base de datos, lista vacía en vez
   * de los DOCE HERMANOS DE EJEMPLO.
   *
   * Aquí es donde peor sienta. Con `leerPersistido`, quien entraba desde otro
   * ordenador y mandaba un comunicado se lo mandaba a doce direcciones
   * inventadas: la pantalla decía «enviado a 12 hermanos» y ni uno solo era de
   * la hermandad. El alcance mentía y el envío también.
   */
  const hermanos = useMemo(() => leerDatos<Hermano>(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  /**
   * En qué situación de cuota está cada hermano, sacada de SUS RECIBOS.
   *
   * Es lo que hace de verdad el sesgo de «los que deben» y «los que están al
   * día». Antes se miraba `h.cuotaAlDia`, un booleano de la ficha que nadie
   * actualizaba al cobrar: el aviso de morosidad salía para el censo entero,
   * gente que había pagado en febrero incluida. Ver lib/estadoCuotaHermano.ts.
   */
  const situacionesDeCuota = useMemo(() => {
    const cuotas = leerDatos(CLAVES_DATOS.cuotas, CUOTAS_INICIALES)
    return new Map(
      situacionDeTodos(cuotas, hermanos, ejercicioDeCuotas(cuotas)).map((s) => [s.hermano.id, s.situacion]),
    )
  }, [hermanos])

  /** Si el destinatario es una etiqueta, devuelve los hermanos que la tienen (con su email). */
  function hermanosDeDestinatario(destinatarios: string): Hermano[] {
    if (!destinatarios.startsWith(PREFIJO_ETIQUETA)) return []
    const etiqueta = destinatarios.slice(PREFIJO_ETIQUETA.length)
    // Cuentan igual las puestas a mano y las que salen de la papeleta: si no,
    // mandar «a los costaleros» no llegaría a los costaleros de este año.
    return hermanos.filter(
      (h) => h.estado !== 'Baja' && etiquetasDe(h, rolesPorHermano.get(h.id) ?? []).includes(etiqueta),
    )
  }
  /**
   * A QUIÉN LE LLEGA ESTE COMUNICADO, resuelto entero.
   *
   * Se mira PRIMERO `criterios`, que es la verdad: los criterios exactos con
   * los que se compuso el segmento. Antes solo se guardaba la etiqueta legible
   * y aquí se intentaba adivinar el destinatario leyendo ese texto — se
   * reconocía «Etiqueta: X» y cualquier cosa con la palabra «todos», y nada
   * más. Un segmento como «Activos · con cuota pendiente» no encajaba en
   * ninguna de las dos y devolvía lista VACÍA: 84 hermanos sin buzón, sin
   * correo y sin nada, con el comunicado guardado como «Enviado».
   *
   * Y eso mismo se llevaba por delante CUATRO DE LAS CINCO opciones del
   * desplegable de fábrica, que es lo que llegó reportado como «comunicados no
   * funciona»:
   *
   *   · «Todos los hermanos»              ✓ la única que iba
   *   · «Hermanos con cuota al día»       0 personas
   *   · «Hermanos con cuota pendiente»    0 personas
   *   · «Nazarenos con papeleta de sitio» 0 personas
   *   · «Junta de Gobierno»               0 personas
   *
   * Ahora el orden es: criterios guardados → etiqueta → nombre del segmento
   * (`criteriosDeSegmento`, que además se combina con la papeleta) → y, de
   * último recurso, el nombre entendido como etiqueta suelta, porque el
   * catálogo de segmentos lo edita la hermandad y ahí acaba escrito «Costaleros»
   * a secas.
   *
   * `reconocido` distingue las dos cosas que antes se confundían: «no hay nadie
   * que cumpla» (bien, se avisa) y «no sé a quién te refieres» (mal, hay que
   * decirlo en pantalla). Sin esa distinción, un segmento inventado se mandaba
   * al vacío y quedaba guardado como enviado.
   */
  function resolverDestinatario(
    c: Pick<Comunicado, 'destinatarios' | 'criterios'>,
  ): Alcance {
    /*
     * LOS DE FUERA, LO PRIMERO. Vecinos y devotos que se apuntaron en la web:
     * no están en el censo, así que ninguna de las reglas de abajo —que buscan
     * hermanos— los encontraría, y el comunicado saldría con alcance cero
     * quedando marcado como «Enviado».
     *
     * Y solo los CONFIRMADOS: a quien no abrió el enlace del correo no se le
     * escribe. Ver `lib/suscriptoresWeb.ts`.
     */
    if (c.destinatarios === SEGMENTO_SUSCRIPTORES) {
      return {
        hermanos: [],
        soloCorreo: losQueSePuedenAvisar(listaSuscriptores).map((s) => ({
          id: s.id, nombre: s.nombre || s.email, email: s.email,
        })),
        reconocido: true,
        aSuscriptores: true,
      }
    }
    if (c.criterios) {
      return {
        hermanos: filtrarSegmento(hermanos, c.criterios, rolesPorHermano, cargosPorHermano, situacionesDeCuota),
        soloCorreo: personalDelSegmento(c.criterios, personal, hermanos),
        reconocido: true,
      }
    }

    // La etiqueta se comprueba por el prefijo, no por si encuentra a alguien:
    // «Etiqueta: Junta» sin nadie dentro NO puede caer luego en la regla de la
    // junta y acabar mandándoselo a los doce de la junta.
    if (c.destinatarios.startsWith(PREFIJO_ETIQUETA)) {
      return { hermanos: hermanosDeDestinatario(c.destinatarios), soloCorreo: [], reconocido: true }
    }

    const papeleta = segmentoDePapeleta(c.destinatarios)
    const criterios = criteriosDeSegmento(c.destinatarios)
    if (papeleta || criterios) {
      const base = criterios ?? { ...CRITERIOS_POR_DEFECTO, soloConEmail: false }
      let lista = filtrarSegmento(hermanos, base, rolesPorHermano, cargosPorHermano, situacionesDeCuota)
      if (papeleta === 'con') lista = lista.filter((h) => conSitio.has(h.id))
      if (papeleta === 'sin') lista = lista.filter((h) => !conSitio.has(h.id))
      // Y la junta que tiene cuenta pero no ficha en el censo: sin esto,
      // «Junta de Gobierno» no alcanzaba a nadie en las hermandades que dan de
      // alta a su junta por Personal, que son muchas.
      const soloCorreo = papeleta ? [] : personalDelSegmento(base, personal, hermanos)
      return { hermanos: lista, soloCorreo, reconocido: true }
    }

    // Un segmento que la hermandad se ha inventado en el catálogo y que coincide
    // con una etiqueta del censo (o con un rol de papeleta), escrito sin el
    // «Etiqueta: » delante.
    const suelta = c.destinatarios.trim()
    const porNombre = suelta
      ? hermanos.filter(
        (h) => h.estado !== 'Baja' && etiquetasDe(h, rolesPorHermano.get(h.id) ?? []).includes(suelta),
      )
      : []
    if (porNombre.length > 0) return { hermanos: porNombre, soloCorreo: [], reconocido: true }

    return { hermanos: [], soloCorreo: [], reconocido: false }
  }

  /** Cuánta gente recibe el comunicado en total: censo y cuentas sueltas. */
  function cuantosSon(a: Alcance): number {
    return a.hermanos.length + a.soloCorreo.length
  }

  const [query, setQuery] = useState('')
  const [filtroCanal, setFiltroCanal] = useState<'Todos' | Canal>('Todos')
  const [selected, setSelected] = useState<Comunicado | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const [canalesNuevos, setCanalesNuevos] = useState<Canal[]>(() => [canales[0] ?? 'Email'])
  const toggleCanal = (c: Canal) =>
    setCanalesNuevos((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  const [estadoNuevo, setEstadoNuevo] = useState<EstadoComunicado>('Borrador')
  const [segmentarAvanzado, setSegmentarAvanzado] = useState(false)
  /**
   * El destinatario elegido, en estado y no solo en el `<select>`. Hace falta
   * para poder decir DEBAJO del desplegable a cuántos hermanos alcanza lo que
   * se acaba de elegir. Antes no se sabía hasta después de guardar —y con
   * cuatro de las cinco opciones alcanzando a cero, no se sabía nunca.
   */
  const [destinatarioNuevo, setDestinatarioNuevo] = useState('')
  const [criterios, setCriterios] = useState<CriteriosSegmento>(CRITERIOS_POR_DEFECTO)
  /**
   * Los roles que salen de la papeleta (costalero, acólito, mantilla). Sin
   esto, «mandar solo a los costaleros de este año» —que es el caso para el que
   se inventaron— no encontraría a nadie.
   */
  // Tramos y opciones se traen de la base de datos, no de la foto que hubiera
  // en el navegador: con la foto, «mandar solo a los costaleros» buscaba los
  // roles de los tramos de EJEMPLO y no encontraba a ninguno de los de verdad.
  const tramosReales = useTramos()
  const papeletasDelAnio = useMemo(() => leerDatos(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES), [])
  const rolesPorHermano = useMemo(
    () => indiceRoles(papeletasDelAnio, tramosReales, getCampana().anio),
    [papeletasDelAnio, tramosReales],
  )
  /**
   * Quién tiene sitio de verdad en el cortejo de este año, para «Nazarenos con
   * papeleta de sitio». No se saca de `rolesPorHermano` a propósito: ahí solo
   * están los tramos con etiqueta puesta, y casi ninguno la lleva.
   */
  const conSitio = useMemo(
    () => conPapeletaDeSitio(papeletasDelAnio, getCampana().anio),
    [papeletasDelAnio],
  )
  /**
   * El cargo que lleva cada hermano DE VERDAD, mirando también su fila de
   * personal. Sin esto, «Junta de Gobierno» se dejaba fuera a quien lleva el
   * cargo por su cuenta de acceso y no lo tiene escrito en su ficha del censo
   * —que en una hermandad que empezó dando de alta a la junta por Personal son
   * todos—. Es el fallo que se reportó como «no puedo mandárselo solo a la
   * junta».
   */
  const [personal] = useSupabaseTable<MiembroPersonal>(
    'personal',
    CLAVE_PERSONAL,
    getPersonal(),
    personalToRow,
    rowToPersonal,
    undefined,
    // Solo se LEE: esta pantalla no da ni quita cargos, eso es cosa de Personal
    // y permisos. `sinEspejo` evita que una consulta que vuelva vacía —por lo
    // que sea— machaque la copia de personal que hay en el navegador.
    { sinEspejo: true },
  )
  const cargosPorHermano = useMemo(() => cargosEfectivos(hermanos, personal), [hermanos, personal])

  /*
   * LOS ENCARGOS DE REDES, EN SU SITIO (`comunicados/encargosDeRedes.ts`).
   *
   * Se desarma `setTareasRedes` porque lo usa el efecto de las reglas
   * automáticas —una regla puede dejar su encargo preparado— y `pendientes`
   * no: eso es de los suscriptores, que es otra cosa con nombre parecido.
   */
  const encargos = useEncargosDeRedes({ hermanos, cargosPorHermano })
  const { setTareasRedes } = encargos
  const rolesDisponibles = useMemo(
    () => etiquetasQueSonAutomaticas(tramosReales),
    [tramosReales],
  )
  /** Todo por lo que se puede mandar: el catálogo de la hermandad y los roles de la papeleta. */
  const etiquetasParaEnviar = useMemo(
    () => [...new Set([...etiquetas, ...rolesDisponibles])].sort((a, b) => a.localeCompare(b, 'es')),
    [etiquetas, rolesDisponibles],
  )
  const segmentoHermanos = useMemo(
    () => filtrarSegmento(hermanos, criterios, rolesPorHermano, cargosPorHermano, situacionesDeCuota),
    [hermanos, criterios, rolesPorHermano, cargosPorHermano, situacionesDeCuota],
  )
  /**
   * A cuántos alcanza el destinatario elegido en el desplegable, para poder
   * enseñarlo debajo. Se calcula solo con el formulario abierto: es un recorrido
   * del censo entero y no hace falta hacerlo mientras se mira la lista.
   *
   * Va aquí abajo y no arriba del todo porque `resolverDestinatario` usa
   * `conSitio` y `rolesPorHermano`, que se declaran unas líneas más arriba.
   */
  const alcanceNuevo: Alcance = formOpen && !segmentarAvanzado
    ? resolverDestinatario({ destinatarios: destinatarioNuevo, criterios: null })
    : { hermanos: [], soloCorreo: [], reconocido: true }


  const filtered = useMemo(() => {
    return comunicados
      .filter((c) => (filtroCanal === 'Todos' ? true : c.canal === filtroCanal))
      .filter((c) => {
        const q = llano(query)
        if (!q) return true
        return (
          String(c.numero).includes(q) ||
          llano(c.titulo).includes(q) ||
          llano(c.cuerpo).includes(q) ||
          llano(c.destinatarios).includes(q)
        )
      })
      .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
  }, [comunicados, query, filtroCanal])

  const stats = useMemo(() => {
    const total = comunicados.length
    const programados = comunicados.filter((c) => c.estado === 'Programado').length
    const ahora = new Date()
    const enviadosEsteMes = comunicados.filter((c) => {
      if (c.estado !== 'Enviado' || !c.fechaEnvio) return false
      const f = new Date(`${c.fechaEnvio}T00:00:00`)
      return f.getFullYear() === ahora.getFullYear() && f.getMonth() === ahora.getMonth()
    }).length
    return { total, programados, enviadosEsteMes, redesConectadas: cuentasConectadas.length }
  }, [comunicados, cuentasConectadas])

  /*
   * LO QUE SALE SOLO AL ABRIR ESTA PANTALLA, en su sitio
   * (`comunicados/losProgramados.ts`): los comunicados programados que ya
   * tocaban y las reglas que se disparan hoy.
   */
  const [programadosSalidos, setProgramadosSalidos] = useLosProgramadosQueYaTocaban({
    hermanos, comunicados, setComunicados, setTareasRedes, resolverDestinatario, cuantosSon,
  })
  const [reglas, setReglas] = useReglasAutomaticas()

  /*
   * EL TÍTULO Y EL CUERPO, EN ESTADO.
   *
   * Antes eran campos sueltos y se leían con `FormData` al guardar, que para un
   * formulario normal está bien. Aquí ya no vale: la vista previa tiene que
   * enseñar el texto CON EL NOMBRE PUESTO mientras se escribe, y el freno de
   * las marcas mal escritas tiene que saltar antes de guardar, no después.
   *
   * Los `name` se quedan puestos: `handleCreate` sigue leyendo por `FormData`,
   * así que esto no cambia por dónde entran los datos, solo permite mirarlos.
   */
  const [tituloNuevo, setTituloNuevo] = useState('')
  const [cuerpoNuevo, setCuerpoNuevo] = useState('')

  /*
   * A QUIÉN SE LE ENSEÑA LA VISTA PREVIA: al primero del segmento elegido.
   *
   * Una vista previa con `{nombre}` en crudo es el mismo texto que ya se está
   * escribiendo: no enseña nada. Con una persona de verdad se ve el resultado
   * y, sobre todo, se ven las FICHAS SIN DATOS — que es donde salta «Hola
   * hermano/a» y uno se entera de que hay que arreglar el censo.
   */
  const ctxPersonalizacion = {
    hermandad: getHermandadSettings().nombreLegal,
    ejercicio: new Date().getFullYear(),
  }
  const revisionMarcas = sePuedePersonalizar(`${tituloNuevo}\n${cuerpoNuevo}`)
  const hayMarcas = llevaMarcas(tituloNuevo) || llevaMarcas(cuerpoNuevo)

  function abrirNuevo() {
    setTituloNuevo('')
    setCuerpoNuevo('')
    setCanalesNuevos([canales[0] ?? 'Email'])
    setSegmentarAvanzado(false)
    setDestinatarioNuevo(segmentos[0] ?? '')
    setEstadoNuevo('Borrador')
    setEnvioCorreo(null)
    setFormOpen(true)
  }

  /*
   * MANDAR, en su sitio (`comunicados/mandarElComunicado.ts`). Se envuelve
   * aquí para que las dos llamadas de abajo —el botón de la ficha y el
   * formulario— sigan escribiendo `enviarAhora(c)` y no tengan que armar el
   * contexto cada una por su cuenta.
   */
  const enviarAhora = (c: Comunicado) => mandarElComunicado(c, {
    resolverDestinatario, cuantosSon, setComunicados, setSelected, setEnvioCorreo,
    listaSuscriptores, noSeSupoDeLosSuscriptores,
  })

  /** El estado del último envío por correo, para no dejarlo en silencio. */
  const [envioCorreo, setEnvioCorreo] = useState<{ estado: 'enviando' | 'hecho' | 'error'; texto?: string } | null>(null)

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const titulo = String(data.get('titulo') ?? '').trim()
    const cuerpo = String(data.get('cuerpo') ?? '').trim()
    const canalesSel = canalesNuevos.length > 0 ? canalesNuevos : [canales[0] ?? 'Email']
    const destinatarios = segmentarAvanzado
      ? etiquetaSegmento(criterios)
      : (destinatarioNuevo || segmentos[0] || '')
    const estado = String(data.get('estado') ?? 'Borrador') as EstadoComunicado
    /*
     * LOS AVISOS, EN VOZ ALTA.
     *
     * Aquí había tres `return` mudos: faltaba el título, o el cuerpo, o no se
     * había elegido red social, y el formulario NO HACÍA NADA. Se pulsaba
     * Guardar, no pasaba nada, y no había forma de saber qué faltaba — se leía
     * como «la aplicación está rota».
     */
    if (!titulo || !cuerpo || canalesSel.length === 0) {
      setEnvioCorreo({
        estado: 'error',
        texto: !titulo ? 'Ponle un título al comunicado.'
          : !cuerpo ? 'El comunicado está vacío: escribe el texto.'
            : 'Elige al menos un canal por el que mandarlo.',
      })
      return
    }

    /*
     * Y NO SE GUARDA CON UNA MARCA QUE NO EXISTE.
     *
     * Ni siquiera como borrador, y esto es a propósito: un borrador se manda
     * más adelante, a lo mejor desde otra pantalla y por otra persona. Dejarlo
     * pasar aquí es dejar la bomba puesta con la mecha más larga.
     */
    const revision = sePuedePersonalizar(`${titulo}\n${cuerpo}`)
    if (!revision.puede) {
      setEnvioCorreo({ estado: 'error', texto: revision.motivo })
      return
    }

    const redes = canalesSel.includes('Redes sociales')
      ? (data.getAll('redes').map((v) => String(v)) as RedSocial[])
      : null
    if (canalesSel.includes('Redes sociales') && (!redes || redes.length === 0)) {
      setEnvioCorreo({ estado: 'error', texto: 'Has elegido redes sociales: marca en cuáles se publica.' })
      return
    }

    const fechaProgramada = estado === 'Programado' ? String(data.get('fechaProgramada') ?? '') || null : null
    if (estado === 'Programado' && !fechaProgramada) {
      setEnvioCorreo({ estado: 'error', texto: 'Has elegido programarlo: dile para qué día.' })
      return
    }

    const hoy = hoyIso()
    const nextNumero = Math.max(0, ...comunicados.map((c) => c.numero)) + 1
    // Los criterios se guardan, no solo su etiqueta: es lo único que permite
    // volver a resolver a quién iba dirigido.
    const criteriosGuardados = segmentarAvanzado ? criterios : null
    const resuelto = resolverDestinatario({ destinatarios, criterios: criteriosGuardados })
    const cuantos = cuantosSon(resuelto)

    /*
     * Un destinatario que no sabemos resolver no sale del borrador. No es lo
     * mismo que «hoy no hay nadie que cumpla»: eso cambia mañana, y un aviso de
     * cuota pendiente programado es legítimo aunque hoy no deba nadie. Esto
     * otro no cambia nunca — el nombre no significa nada para el programa— y si
     * se deja pasar, se manda al vacío y queda guardado como enviado.
     */
    if (estado !== 'Borrador' && !resuelto.reconocido) {
      setEnvioCorreo({
        estado: 'error',
        texto: `No sabemos a quién se refiere «${destinatarios}»: no coincide con ninguna etiqueta `
          + 'del censo ni con ningún criterio que sepamos leer. Elige otro destinatario, o marca '
          + '«Segmentación avanzada» y di a quién por criterios.',
      })
      return
    }

    // Si va a salir AHORA y no hay a quién, no se guarda como enviado: eso
    // dejaba un comunicado «Enviado» con su fecha y su alcance sin que nadie
    // hubiera recibido nada, y sin manera de volver a intentarlo porque el
    // botón de mandar solo sale en los borradores.
    if (estado === 'Enviado' && cuantos === 0) {
      setEnvioCorreo({
        estado: 'error',
        texto: 'Con ese sesgo no sale ningún hermano, así que no hay a quién mandarlo. '
          + 'Revísalo, o guárdalo como borrador y ajústalo luego.',
      })
      return
    }

    const alcance = estado === 'Enviado' ? cuantos : null
    // Un comunicado por cada canal elegido (así cada uno aparece en su canal).
    const nuevos: Comunicado[] = canalesSel.map((canal, idx) => ({
      id: nuevoId(),
      numero: nextNumero + idx,
      titulo,
      cuerpo,
      canal,
      redes: canal === 'Redes sociales' ? redes : null,
      destinatarios,
      criterios: criteriosGuardados,
      estado,
      fechaCreacion: hoy,
      fechaProgramada,
      fechaEnvio: estado === 'Enviado' ? hoy : null,
      autor: 'Tú',
      alcance,
    }))
    setComunicados((prev) => [...nuevos, ...prev])
    if (estado === 'Enviado') {
      /**
       * Y AQUÍ SE MANDA EL CORREO, que es lo que faltaba.
       *
       * Elegir «Enviar ahora» en el formulario solo llenaba el buzón; el
       * correo únicamente salía si se guardaba como borrador y luego se pulsaba
       * el botón «Enviar ahora» de la ficha. Las dos cosas se llaman igual en
       * pantalla y hacían cosas distintas: quien usaba la primera creía haber
       * mandado un correo que no salió nunca.
       *
       * Se llama a la misma rutina que el botón, para que no puedan volver a
       * separarse.
       */
      void enviarAhora(nuevos[0])
    }
    setJustAddedId(nuevos[0].id)
    setFormOpen(false)
    setFiltroCanal('Todos')
    setQuery('')
    form.reset()
    setTimeout(() => setJustAddedId(null), 3000)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Comunicados</p>
          <h1>Avisos y difusión</h1>
          <p className="dash-head__lead">
            {stats.total} comunicados{hayDatosDeEjemplo() ? ' · datos de ejemplo mientras conectamos la base de datos' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo comunicado
        </button>
      </div>

      <PanelDeRedes redes={redes} />

      <PanelDeEncargos encargos={encargos} hermanos={hermanos} />

      {/*
        LO QUE HA SALIDO SOLO AL ABRIR ESTA PANTALLA.

        Un envío que ocurre en silencio es indistinguible de uno que no ha
        ocurrido: la hermandad no sabría nunca si su comunicado salió, ni
        cuándo, ni a cuánta gente. Y si falló, menos.

        Se puede cerrar porque, a diferencia del aviso de la base de datos
        atrasada, esto ya ha pasado: no es un problema que siga ahí.
      */}
      {programadosSalidos && (
        <div
          className={`banner-inline ${/No se ha podido/.test(programadosSalidos) ? 'banner-inline--alerta' : 'banner-inline--accent'}`}
          role="status"
        >
          <span>{/No se ha podido/.test(programadosSalidos) ? '⚠' : '📣'} {programadosSalidos}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setProgramadosSalidos(null)}>Entendido</button>
        </div>
      )}

      {/*
        LAS REGLAS QUE SE DISPARAN SOLAS, en su sitio
        (`comunicados/PanelDeReglas.tsx`). Se le pasan las dos capacidades que
        necesita —a cuántos alcanza una regla hoy, y uno de los que la
        recibirían— en vez del censo entero con sus cargos y sus cuotas.
      */}
      <PanelDeReglas
        reglas={reglas}
        setReglas={setReglas}
        ctxPersonalizacion={ctxPersonalizacion}
        aCuantosAlcanzaHoy={(r) => cuantosSon(resolverDestinatario({
          destinatarios: r.destinatarios,
          criterios: r.criterios,
        }))}
        unoDeLosQueRecibirian={(r) => filtrarSegmento(
          hermanos, r.criterios, rolesPorHermano, cargosPorHermano, situacionesDeCuota,
        )[0] ?? null}
      />

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Total comunicados</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Todos los canales</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Programados</span>
          <span className="stat-tile__value">{stats.programados}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Pendientes de enviar</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Enviados este mes</span>
          <span className="stat-tile__value">{stats.enviadosEsteMes}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Difusión activa</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Redes conectadas</span>
          <span className="stat-tile__value">{stats.redesConectadas}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">de {cuentas.length}</span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por título, texto o destinatarios"
          aria-label="Buscar comunicados por título, texto o destinatarios"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {['Todos', ...canales].map((f) => (
            <button
              key={f}
              className={`chip${filtroCanal === f ? ' chip--active' : ''}`}
              onClick={() => setFiltroCanal(f)}
              type="button"
              aria-pressed={filtroCanal === f}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th className="col-opcional">Nº</th>
              <th>Comunicado</th>
              <th className="col-opcional">Destinatarios</th>
              <th>Estado</th>
              <th className="col-opcional">Fecha</th>
              <th className="col-opcional"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className={c.id === justAddedId ? 'row--flash' : undefined}
                {...filaQueAbre(() => setSelected(c))}
              >
                <td className="num col-opcional">{c.numero}</td>
                <td>
                  <span className="row-person__name">{c.titulo}</span>
                  <br />
                  <span className="table-subtle">
                    {c.canal}
                    {c.redes && c.redes.length > 0 ? ` · ${c.redes.join(', ')}` : ''}
                  </span>
                  {/* En el móvil se ocultan destinatarios y fecha. */}
                  <span className="row-person__sub solo-movil">
                    {c.destinatarios} · {fmt(c.fechaEnvio ?? c.fechaProgramada ?? c.fechaCreacion)}
                  </span>
                </td>
                <td className="col-opcional">{c.destinatarios}</td>
                <td>
                  <span className={`pill ${claseEstado(c.estado)}`}>{c.estado}</span>
                </td>
                <td className="num col-opcional">{fmt(c.fechaEnvio ?? c.fechaProgramada ?? c.fechaCreacion)}</td>
                <td className="col-opcional">
                  <button className="icon-btn" title="Ver comunicado" onClick={(e) => { e.stopPropagation(); setSelected(c) }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  No hay comunicados que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ficha del comunicado */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.titulo ?? ''}
        subtitle={selected ? `Comunicado nº ${selected.numero}` : undefined}
      >
        {selected && (
          <div className="ficha">
            <div className="ficha__row">
              <span className="pill pill--info">{selected.canal}</span>
              <span className={`pill ${claseEstado(selected.estado)}`}>{selected.estado}</span>
            </div>
            <dl className="ficha__list">
              <div>
                <dt>Mensaje</dt>
                <dd>{selected.cuerpo}</dd>
              </div>
              <div>
                <dt>Destinatarios</dt>
                <dd>{selected.destinatarios}</dd>
              </div>
              {(() => {
                /*
                 * Con el resolver entero, no solo con la etiqueta. Antes esta
                 * lista solo aparecía si el destinatario empezaba por
                 * «Etiqueta: », así que en «Junta de Gobierno» o «cuota
                 * pendiente» no se veía a quién le había llegado — que es
                 * justo cuando hace falta comprobarlo.
                 */
                const alcance = resolverDestinatario(selected)
                const receptores = alcance.hermanos
                const total = cuantosSon(alcance)
                if (total === 0) return null
                return (
                  <div>
                    <dt>Aviso por email (simulado)</dt>
                    <dd>
                      Se {selected.estado === 'Enviado' ? 'ha enviado' : 'enviaría'} a{' '}
                      <b>{total}</b> persona{total === 1 ? '' : 's'}:
                      <div className="etiquetas-chips" style={{ marginTop: '0.4rem' }}>
                        {receptores.slice(0, 12).map((h) => (
                          <span key={h.id} className="etiqueta-pill">
                            {h.nombre} · {h.email}
                          </span>
                        ))}
                        {receptores.length > 12 && (
                          <span className="etiqueta-pill">+{receptores.length - 12} más</span>
                        )}
                        {/* La junta con cuenta pero sin ficha en el censo: solo
                            les llega el correo, porque no tienen área donde
                            recibir el aviso. Se marcan para que se vea. */}
                        {alcance.soloCorreo.map((p) => (
                          <span key={p.id} className="etiqueta-pill" title="Solo por correo: no tiene ficha en el censo">
                            {p.nombre} · {p.email} (solo correo)
                          </span>
                        ))}
                      </div>
                      <AvisoFalta compacto requisito={requisito('correo')} />
                    </dd>
                  </div>
                )
              })()}
              {selected.redes && selected.redes.length > 0 && (
                <div>
                  <dt>Publicar en redes</dt>
                  <dd>
                    {/*
                      AQUÍ SE PUBLICA DE VERDAD, en dos pasos.
                      Antes esto era una línea de texto —«Facebook, Instagram»—
                      y ahí se acababa: el comunicado quedaba marcado como
                      enviado y nadie había publicado nada. Ahora se copia el
                      texto y se abre la red, que es lo que se acaba haciendo a
                      mano de todas formas.
                    */}
                    <p className="table-subtle" style={{ marginTop: 0 }}>
                      En X y Facebook se abre la publicación ya escrita y solo hay que confirmarla. En
                      Instagram, TikTok y YouTube el texto va copiado para pegarlo, porque ninguna de las
                      tres deja publicar desde fuera. En todo caso el comunicado no se publica solo: el
                      último clic siempre lo dais vosotros.
                    </p>
                    <textarea
                      className="redes-publicar__texto"
                      readOnly
                      rows={5}
                      value={textoParaRedes(selected.titulo, selected.cuerpo)}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Texto para publicar en redes"
                    />
                    <div className="redes-publicar">
                      {selected.redes.map((r) => {
                        const texto = textoParaRedes(selected.titulo, selected.cuerpo)
                        const cuenta = cuentas.find((c) => c.red === r)
                        /*
                         * El enlace de la web va en la publicación, y no es un
                         * adorno: en X ocupa su sitio del tuit y en Facebook es
                         * lo ÚNICO que permite abrir el cuadro de compartir
                         * —sin dirección que compartir, no hay cuadro—. Antes
                         * no se pasaba, así que Facebook nunca podía componer.
                         */
                        const accion = accionDePublicar(r, texto, cuenta, enlaceDeLaWeb)
                        const largo = sePasaDeLargo(r, texto)
                        return (
                          <div className="redes-publicar__fila" key={r}>
                            <span className="red-marca-mini" style={{ color: COLOR_RED[r] }}>
                              <IconoRed red={r} tam={20} />
                            </span>
                            <div className="redes-publicar__que">
                              <b>{r}</b>
                              <span className="table-subtle">{accion.explica}</span>
                              {/* X corta a los 280 y no avisa: corta y ya. */}
                              {largo && (
                                <span className="form-hint form-hint--error">
                                  Son {texto.length} caracteres y en X caben {LIMITE_X}: acórtalo antes de publicar.
                                </span>
                              )}
                            </div>
                            {/*
                              EL COMPARTIR DEL TELÉFONO, cuando lo hay.
                              Es lo único que mete el texto DENTRO de Instagram
                              o TikTok sin pegar nada: se pulsa, se elige la
                              aplicación y ya está. Solo sale donde existe, que
                              es el móvil — en el ordenador no aparece y no
                              estorba.
                            */}
                            {compartirMovil && accion.modo !== 'componer' && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  void navigator.share({ text: texto, ...(enlaceDeLaWeb ? { url: enlaceDeLaWeb } : {}) })
                                    // Cancelar el menú de compartir NO es un
                                    // error: es alguien que se ha arrepentido.
                                    .catch(() => {})
                                }}
                              >
                                Compartir
                              </button>
                            )}
                            {/*
                              Y el botón que dice lo que va a pasar. Antes eran
                              dos —«Copiar texto» y «Abrir X»— y desde fuera no
                              se sabía cuál publicaba.
                            */}
                            {accion.url ? (
                            <a
                              className={`btn btn-sm ${compartirMovil && accion.modo !== 'componer' ? 'btn-ghost' : 'btn-primary'}`}
                              href={accion.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                // En las que no se puede componer, el texto va
                                // copiado: es lo primero que hace falta al
                                // llegar allí.
                                if (accion.modo === 'copiarYAbrir') void copiarAlPortapapeles(texto)
                              }}
                            >
                              {accion.boton}
                            </a>
                            ) : (
                              /* Sin cuenta conectada no hay a dónde abrir, así
                                 que el botón hace lo único que puede hacer y lo
                                 dice. */
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  void copiarAlPortapapeles(texto).then((ok) => setCopiado(ok ? r : null))
                                }}
                              >
                                {copiado === r ? '✓ Copiado' : accion.boton}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </dd>
                </div>
              )}
              <div>
                <dt>Creado</dt>
                <dd>{fmt(selected.fechaCreacion)} · {selected.autor}</dd>
              </div>
              {selected.fechaProgramada && (
                <div>
                  <dt>Programado para</dt>
                  <dd>{fmt(selected.fechaProgramada)}</dd>
                </div>
              )}
              {selected.fechaEnvio && (
                <div>
                  <dt>Enviado</dt>
                  <dd>{fmt(selected.fechaEnvio)}</dd>
                </div>
              )}
              {selected.alcance !== null && (
                <div>
                  <dt>Alcance</dt>
                  <dd>{selected.alcance.toLocaleString('es-ES')} personas</dd>
                </div>
              )}
            </dl>
            {selected.estado !== 'Enviado' && (
              <div className="assign-box__row">
                <button
                  type="button" className="btn btn-primary"
                  disabled={envioCorreo?.estado === 'enviando'}
                  onClick={() => enviarAhora(selected)}
                >
                  {envioCorreo?.estado === 'enviando' ? 'Enviando…' : 'Enviar ahora'}
                </button>
              </div>
            )}
            {/* Qué ha pasado con el correo. El buzón del hermano se llena
                siempre; el correo puede fallar, y callarlo sería peor. */}
            {envioCorreo?.estado === 'hecho' && (
              <p className="form-hint form-hint--ok">✓ {envioCorreo.texto}</p>
            )}
            {envioCorreo?.estado === 'error' && (
              <div className="aviso-falta" role="note">
                <p className="aviso-falta__titulo">
                  <span className="aviso-falta__marca" aria-hidden="true" />
                  El comunicado se ha publicado, pero no ha salido por correo
                </p>
                <p className="aviso-falta__porque">{envioCorreo.texto}</p>
                <p className="aviso-falta__arreglo">
                  A los hermanos les ha llegado igualmente al buzón de su área. Revisa
                  Configuración → Correo.
                </p>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Nuevo comunicado */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo comunicado"
        subtitle="Comunicados"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="comunicado-form" type="submit">
              Guardar
            </button>
          </>
        }
      >
        <form id="comunicado-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="titulo">Título</label>
            <input
              id="titulo" name="titulo" type="text" required
              placeholder="Ej. Convocatoria de Gobergo"
              value={tituloNuevo}
              onChange={(e) => setTituloNuevo(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="cuerpo">Mensaje</label>
            <textarea
              id="cuerpo" name="cuerpo" rows={4} required
              placeholder={'Texto del comunicado.\n\nPuedes escribir «Hola {nombre},» y a cada uno le llegará con el suyo.'}
              value={cuerpoNuevo}
              onChange={(e) => setCuerpoNuevo(e.target.value)}
            />
            {/*
              LAS MARCAS, CON SU BOTÓN. Escritas a mano se equivoca cualquiera
              —y `{nombe}` mandado a ochocientas personas no se recoge— así que
              se ponen pulsando, y la ayuda dice qué hace cada una.
            */}
            <div className="chips" style={{ marginTop: '0.5rem' }}>
              <span className="form-hint" style={{ marginRight: '0.3rem' }}>Personalizar:</span>
              {MARCAS.map((m) => (
                <button
                  key={m.marca}
                  type="button"
                  className="chip"
                  title={`${m.que} — p. ej. «${m.ejemplo}»`}
                  onClick={() => setCuerpoNuevo((t) => `${t}{${m.marca}}`)}
                >
                  {`{${m.marca}}`}
                </button>
              ))}
            </div>
            {/*
              EL FRENO. Una marca que no existe se mandaría tal cual, entre
              llaves, a todo el mundo. Se dice aquí y se bloquea al guardar:
              es el mismo criterio que `acreedorIncompleto()` con el fichero
              SEPA — no dejar generar algo que va a salir mal en casa de otro.
            */}
            {!revisionMarcas.puede && (
              <p className="form-hint" style={{ color: 'var(--peligro, #b91c1c)', marginTop: '0.45rem' }}>
                ⚠ {revisionMarcas.motivo}
              </p>
            )}
            {/*
              Y CÓMO LE VA A LLEGAR. Con el primero del segmento, que es una
              persona de verdad con sus datos de verdad.
            */}
            {hayMarcas && revisionMarcas.puede && (
              <div className="assign-box" style={{ marginTop: '0.6rem' }}>
                <p className="form-hint" style={{ margin: '0 0 0.35rem' }}>
                  {segmentoHermanos[0]
                    ? `Así le llegará a ${segmentoHermanos[0].nombre}:`
                    : 'Así llegará (no hay nadie en el segmento, se usa un ejemplo):'}
                </p>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {vistaPrevia(tituloNuevo, segmentoHermanos[0] ?? null, ctxPersonalizacion)}
                </p>
                <p style={{ margin: '0.3rem 0 0', whiteSpace: 'pre-wrap' }}>
                  {vistaPrevia(cuerpoNuevo, segmentoHermanos[0] ?? null, ctxPersonalizacion)}
                </p>
              </div>
            )}
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label>Canales (puedes elegir varios)</label>
              <div className="chips">
                {canales.map((c) => {
                  const activo = canalesNuevos.includes(c)
                  return (
                    <button
                      type="button"
                      key={c}
                      className={`chip chip--toggle${activo ? ' chip--active' : ''}`}
                      onClick={() => toggleCanal(c)}
                      aria-pressed={activo}
                    >
                      {activo ? '✓ ' : ''}{c}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="destinatarios">Destinatarios</label>
              <select
                id="destinatarios"
                name="destinatarios"
                value={destinatarioNuevo}
                onChange={(e) => setDestinatarioNuevo(e.target.value)}
                disabled={segmentarAvanzado}
              >
                {segmentos.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                {etiquetasParaEnviar.length > 0 && (
                  <optgroup label="Por etiqueta (solo esos hermanos)">
                    {etiquetasParaEnviar.map((et) => (
                      <option key={et} value={`${PREFIJO_ETIQUETA}${et}`}>
                        {et}{rolesDisponibles.includes(et) && !etiquetas.includes(et) ? ' (por papeleta)' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {/*
                EL ALCANCE, ANTES DE MANDARLO. Es el aviso que faltaba: se
                elegía «Junta de Gobierno», se enviaba, y la pantalla decía
                «Enviado» sin que le hubiera llegado a nadie. Ahora se ve el
                número al elegir, y si el segmento no se entiende se dice.
              */}
              {!segmentarAvanzado && (
                alcanceNuevo.reconocido ? (
                  <p className={`form-hint${cuantosSon(alcanceNuevo) === 0 ? ' form-hint--error' : ''}`}>
                    {cuantosSon(alcanceNuevo) === 0
                      ? 'Ahora mismo no hay ningún hermano que encaje aquí, así que no le llegaría a nadie.'
                      : [
                        alcanceNuevo.hermanos.length > 0
                          && `Le llegará a ${alcanceNuevo.hermanos.length} hermano${alcanceNuevo.hermanos.length === 1 ? '' : 's'}`
                            + ` (${alcanceNuevo.hermanos.filter((h) => h.email?.includes('@')).length} con correo).`,
                        // La junta que entra al panel con su cuenta pero no
                        // tiene ficha en el censo: no tiene área donde recibir
                        // el aviso, así que se le manda solo por correo. Se
                        // dice, para que nadie cuente mal el alcance.
                        alcanceNuevo.soloCorreo.length > 0
                          && `${alcanceNuevo.hermanos.length > 0 ? 'Y por correo' : 'Le llegará por correo'}`
                            + ` a ${alcanceNuevo.soloCorreo.length} cuenta${alcanceNuevo.soloCorreo.length === 1 ? '' : 's'}`
                            + ' de la junta sin ficha en el censo'
                            + ` (${alcanceNuevo.soloCorreo.map((p) => p.nombre).join(', ')}).`,
                      ].filter(Boolean).join(' ')}
                  </p>
                ) : (
                  <p className="form-hint form-hint--error">
                    No sabemos a quién se refiere «{destinatarioNuevo}». Es un segmento del catálogo que no
                    coincide con ninguna etiqueta ni con ningún criterio del censo: elige otro, o usa la
                    segmentación avanzada de aquí abajo.
                  </p>
                )
              )}

              {/*
                LOS QUE FALTAN POR CONFIRMAR, y aquí es donde hay que decirlo:
                justo cuando se elige mandarle algo a los suscriptores y el
                número de arriba sale más bajo de lo que se esperaba. A quien no
                confirmó no se le escribe, así que sin este aviso la cuenta no
                cuadra y no hay forma de saber por qué.
              */}
              {destinatarioNuevo === SEGMENTO_SUSCRIPTORES && pendientes.length > 0 && (
                <div className="form-hint pendientes-confirmar">
                  <p>
                    Hay {pendientes.length} apuntado{pendientes.length === 1 ? '' : 's'} que
                    todavía no ha{pendientes.length === 1 ? '' : 'n'} confirmado su correo, y hasta
                    entonces no se le{pendientes.length === 1 ? '' : 's'} escribe. Mándale
                    {pendientes.length === 1 ? '' : 's'} el enlace.
                  </p>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => { void reenviarLasConfirmaciones() }}
                    disabled={reenviando}
                  >
                    {reenviando ? 'Mandando…' : 'Mandar el enlace de confirmar'}
                  </button>
                  {avisoReenvio && <p role="status">{avisoReenvio}</p>}
                </div>
              )}
            </div>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={segmentarAvanzado}
              onChange={(e) => setSegmentarAvanzado(e.target.checked)}
            />
            <span>Segmentación avanzada (elegir a quién por criterios)</span>
          </label>
          {segmentarAvanzado && (
            <EditorSegmento
              etiquetasExtra={rolesDisponibles}
              criterios={criterios}
              onChange={setCriterios}
              cuantos={segmentoHermanos.length}
              onLimpiar={() => setCriterios(CRITERIOS_POR_DEFECTO)}
            />
          )}

          {canalesNuevos.includes('Redes sociales') && (
            <div className="form-row">
              <label>Publicar en</label>
              {cuentasConectadas.length === 0 ? (
                <p className="form-hint">
                  Ninguna red conectada todavía. Conecta al menos una cuenta arriba para poder publicar aquí.
                </p>
              ) : (
                <div className="archivo-cargos">
                  {REDES_SOCIALES.filter((r) => cuentasConectadas.some((c) => c.red === r)).map((r) => (
                    <label key={r} className="checkbox-row">
                      <input type="checkbox" name="redes" value={r} />
                      {r}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="form-row">
            <label htmlFor="estado">Estado</label>
            <select id="estado" name="estado" value={estadoNuevo} onChange={(e) => setEstadoNuevo(e.target.value as EstadoComunicado)}>
              <option value="Borrador">Guardar como borrador</option>
              <option value="Programado">Programar envío</option>
              <option value="Enviado">Enviar ahora</option>
            </select>
          </div>

          {estadoNuevo === 'Programado' && (
            <div className="form-row">
              <label htmlFor="fechaProgramada">Fecha de envío</label>
              <input id="fechaProgramada" name="fechaProgramada" type="date" required />
            </div>
          )}
        </form>
      </Drawer>
    </div>
  )
}
