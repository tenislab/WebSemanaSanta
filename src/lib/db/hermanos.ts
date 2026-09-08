import type { Hermano } from '../../data/hermanos'
import type { Cargo } from '../../data/documentos'

/** camelCase (app) ⇄ snake_case (tabla `hermanos` en Supabase). */
export function hermanoToRow(h: Hermano): Record<string, unknown> {
  return {
    id: h.id,
    numero: h.numero,
    nombre: h.nombre,
    estado: h.estado,
    antiguedad: h.antiguedad,
    email: h.email,
    telefono: h.telefono,
    direccion: h.direccion,
    cuota_al_dia: h.cuotaAlDia,
    iban: h.iban,
    dni: h.dni,
    /*
     * LA CONTRASEÑA YA NO VIAJA A LA BASE.
     *
     * `clave_acceso` guardaba la contraseña del hermano en texto plano dentro
     * de la tabla, y la ficha la imprimía en pantalla. No hacía falta para
     * nada: la de verdad vive cifrada en Supabase Auth y es la que comprueba
     * `signInWithPassword`. Esta era una copia en claro que solo servía para
     * el modo demostración —donde no hay base de datos— y que en producción
     * era un regalo para cualquiera que pudiera leer el censo.
     *
     * Se manda vacía, no se quita del todo: la columna sigue existiendo un
     * tiempo para que la versión anterior de la web no falle al guardar
     * mientras dura el cambio. Ver supabase/seguridad-claves-y-registro.sql.
     */
    clave_acceso: '',
    auth_user_id: h.authUserId,
    correo_acceso: h.correoAcceso ?? null,
    etiquetas: h.etiquetas ?? [],
    fecha_nacimiento: h.fechaNacimiento ?? null,
    foto_data_url: h.fotoDataUrl ?? null,
    consiente_foto: h.consienteFoto ?? false,
    parroquia_bautismo: h.parroquiaBautismo ?? null,
    fecha_bautismo: h.fechaBautismo ?? null,
    talla_tunica: h.tallaTunica ?? null,
    notas_salud: h.notasSalud ?? null,
    /*
     * QUIÉN LO LLEVA. Estas dos líneas —esta y su pareja en `rowToHermano`—
     * faltaban, y con ellas se caía TODO «Mi familia».
     *
     * La columna `hermanos.tutor_id` existe en la base desde
     * `area-hermano.sql`, con su índice y sus políticas. Lo que no existía era
     * que la aplicación la mandara. Así que al aprobar la solicitud de un
     * menor, el vínculo se guardaba… en el espejo del navegador de quien la
     * aprobó, y en ningún sitio más.
     *
     * LO QUE PASABA, y encaja con lo que se reportó: la secretaria aprueba al
     * niño y lo ve bien colgando de su padre. Al recargar —o desde cualquier
     * otro ordenador, o desde el móvil del padre— la consulta trae `tutor_id`
     * a nulo, y el padre entra en su área y no tiene a nadie a su cargo. Sin
     * un solo error: la ficha del niño está, con su número y sus datos; lo
     * único que se ha perdido es de quién es hijo.
     *
     * Y no se podía ver probando en un solo ordenador, que es como se prueba.
     */
    tutor_id: h.tutorId ?? null,
    /*
     * LOS CAMPOS A MEDIDA DE LA HERMANDAD (talla de túnica, nº de llave…).
     *
     * Mismo fallo y peor, porque aquí ni siquiera había columna: se escribían
     * en la ficha desde el panel y se quedaban en ese navegador para siempre.
     * La DEFINICIÓN de los campos sí viajaba —vive en `hermandad_settings`— así
     * que desde otro ordenador se veía el campo «Talla de túnica» perfectamente
     * dibujado y SIEMPRE VACÍO, para los cuatrocientos hermanos.
     *
     * Que la definición viajara y el valor no es lo que lo hacía indetectable:
     * la pantalla se pinta entera y bien.
     *
     * La columna la crea `supabase/campos-del-hermano.sql`.
     */
    campos: h.campos ?? null,
    baja_solicitada: h.bajaSolicitada ?? false,
    baja_solicitada_el: h.bajaSolicitadaEl ?? null,
    motivo_baja: h.motivoBaja ?? null,
    fecha_baja: h.fechaBaja ?? null,
    /* El cargo va EN LA FICHA: es lo que hace que una persona sea una sola
       persona y no dos (hermano nº 47 por un lado, «personal» por otro).
       Quien manda esto no decide nada: en la base hay un disparador que
       devuelve `cargo` y `civil` a su valor anterior si quien escribe no lleva
       el módulo de Personal. Sin él, cualquier hermano se nombraría Hermano
       Mayor desde la consola del navegador. */
    cargo: h.cargo ?? null,
    civil: h.civil ?? false,
  }
}

/**
 * Los ÚNICOS campos que un hermano puede cambiar de su propia ficha.
 *
 * EL DESTROZO QUE EVITA. El área del hermano guardaba con el mismo circuito
 * que el panel, y ese manda `hermanoToRow` ENTERO: número, estado, cuota al
 * día, IBAN, contraseña, etiquetas, baja solicitada… con los valores que su
 * navegador cargó al iniciar sesión, que en su móvil no se refresca nunca.
 *
 *   10:00  Manuel entra en su área.
 *   10:05  La secretaría le corrige el IBAN, le pone la etiqueta «Diputado de
 *          tramo» y le marca la cuota al día.
 *   10:10  Manuel, sin recargar, cambia su teléfono y guarda.
 *
 * Y las tres cosas de las 10:05 se deshacían. Con una baja tramitada a media
 * mañana pasaba lo mismo: el hermano volvía a estar activo por haber tocado su
 * número de teléfono.
 *
 * Mandando solo estos tres campos, lo que él no puede tocar no viaja siquiera.
 */
export function contactoDelHermanoToRow(h: Pick<Hermano, 'email' | 'telefono' | 'direccion'>): Record<string, unknown> {
  return { email: h.email, telefono: h.telefono, direccion: h.direccion }
}

export function rowToHermano(r: Record<string, unknown>): Hermano {
  return {
    id: r.id as string,
    numero: r.numero as number,
    nombre: r.nombre as string,
    estado: r.estado as Hermano['estado'],
    antiguedad: r.antiguedad as number,
    email: r.email as string,
    telefono: r.telefono as string,
    direccion: r.direccion as string,
    cuotaAlDia: r.cuota_al_dia as boolean,
    iban: (r.iban as string | null) ?? null,
    dni: r.dni as string,
    // Nunca se lee de la base: en modo demostración vive solo en el navegador,
    // y con Supabase la contraseña la guarda Auth, no nosotros.
    claveAcceso: '',
    authUserId: (r.auth_user_id as string | null) ?? null,
    correoAcceso: (r.correo_acceso as string | null) ?? null,
    etiquetas: (r.etiquetas as string[] | null) ?? [],
    fechaNacimiento: (r.fecha_nacimiento as string | null) ?? undefined,
    fotoDataUrl: (r.foto_data_url as string | null) ?? null,
    consienteFoto: Boolean(r.consiente_foto),
    parroquiaBautismo: (r.parroquia_bautismo as string | null) ?? undefined,
    fechaBautismo: (r.fecha_bautismo as string | null) ?? undefined,
    tallaTunica: (r.talla_tunica as string | null) ?? undefined,
    notasSalud: (r.notas_salud as string | null) ?? undefined,
    // Las dos parejas de lo de arriba. Sin estas, subiría y no volvería.
    tutorId: (r.tutor_id as string | null) ?? undefined,
    campos: (r.campos as Record<string, string> | null) ?? undefined,
    bajaSolicitada: Boolean(r.baja_solicitada),
    bajaSolicitadaEl: (r.baja_solicitada_el as string | null) ?? undefined,
    motivoBaja: (r.motivo_baja as string | null) ?? undefined,
    fechaBaja: (r.fecha_baja as string | null) ?? undefined,
    cargo: (r.cargo as Cargo | null) ?? null,
    civil: Boolean(r.civil),
  }
}

/**
 * Guardar el cargo de un hermano COMPROBANDO que la base lo ha aceptado.
 *
 * EL FALLO QUE EVITA, que es de los peores que hay: en la base hay un
 * disparador que devuelve `cargo` a su valor anterior si quien escribe no
 * tiene permiso para repartir cargos. Y lo hace EN SILENCIO, a propósito —la
 * aplicación manda la fila entera en cada guardado, así que lanzar un error
 * rompería el guardado normal de cualquier hermano—.
 *
 * El efecto secundario es que un guardado revertido es indistinguible de uno
 * que ha ido bien: la petición no da error, el espejo no tiene nada que
 * avisar, y React ya ha pintado el cargo nuevo. La secretaria ve a Juan Luis
 * de Tesorero/a, cierra el navegador tranquila, y en la base Juan Luis sigue
 * sin cargo. Se descubre al día siguiente, cuando Juan Luis entra y no ve
 * Tesorería.
 *
 * Por eso esto pide la fila DE VUELTA y compara. Si la base ha devuelto otra
 * cosa, se dice. Es el mismo problema que ya costó caro en la tabla de
 * permisos, donde el visto bueno verde salía aunque no se hubiera guardado.
 */
export async function guardarCargoDeHermano(
  id: string,
  cargo: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  const { isSupabaseConfigured, supabase } = await import('../supabase')
  if (!isSupabaseConfigured || !supabase) return { ok: true, error: null }
  try {
    const { data, error } = await supabase
      .from('hermanos').update({ cargo }).eq('id', id).select('cargo').maybeSingle()
    if (error) return { ok: false, error: `No se ha podido guardar el cargo: ${error.message}` }
    if (!data) {
      // Cero filas: las políticas no han dejado pasar el update. No es un
      // error de Postgres, es una fila que no existe para esta cuenta.
      return {
        ok: false,
        error: 'No se ha podido guardar el cargo: tu cuenta no tiene permiso para escribir en esa ficha.',
      }
    }
    if ((data.cargo ?? null) !== cargo) {
      return {
        ok: false,
        error:
          'No se ha podido cambiar el cargo: tu cuenta no tiene permiso para repartir cargos en la '
          + 'base de datos. Hace falta el módulo «Personal y permisos», o el módulo «Hermanos». '
          + 'Pídeselo a quien lleve la hermandad.',
      }
    }
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: `No se ha podido guardar el cargo: ${(e as Error).message}` }
  }
}
