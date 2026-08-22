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
    clave_acceso: h.claveAcceso,
    auth_user_id: h.authUserId,
    etiquetas: h.etiquetas ?? [],
    fecha_nacimiento: h.fechaNacimiento ?? null,
    foto_data_url: h.fotoDataUrl ?? null,
    consiente_foto: h.consienteFoto ?? false,
    parroquia_bautismo: h.parroquiaBautismo ?? null,
    fecha_bautismo: h.fechaBautismo ?? null,
    talla_tunica: h.tallaTunica ?? null,
    notas_salud: h.notasSalud ?? null,
    baja_solicitada: h.bajaSolicitada ?? false,
    baja_solicitada_el: h.bajaSolicitadaEl ?? null,
    motivo_baja: h.motivoBaja ?? null,
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
    claveAcceso: r.clave_acceso as string,
    authUserId: (r.auth_user_id as string | null) ?? null,
    etiquetas: (r.etiquetas as string[] | null) ?? [],
    fechaNacimiento: (r.fecha_nacimiento as string | null) ?? undefined,
    fotoDataUrl: (r.foto_data_url as string | null) ?? null,
    consienteFoto: Boolean(r.consiente_foto),
    parroquiaBautismo: (r.parroquia_bautismo as string | null) ?? undefined,
    fechaBautismo: (r.fecha_bautismo as string | null) ?? undefined,
    tallaTunica: (r.talla_tunica as string | null) ?? undefined,
    notasSalud: (r.notas_salud as string | null) ?? undefined,
    bajaSolicitada: Boolean(r.baja_solicitada),
    bajaSolicitadaEl: (r.baja_solicitada_el as string | null) ?? undefined,
    motivoBaja: (r.motivo_baja as string | null) ?? undefined,
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
