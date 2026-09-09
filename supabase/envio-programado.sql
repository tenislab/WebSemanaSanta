-- =============================================================================
--   QUE UN COMUNICADO PROGRAMADO SE MANDE DE VERDAD
-- =============================================================================
--
-- LO QUE PASABA HASTA AHORA, Y ERA UN FALLO VIVO:
--
-- Un comunicado se podía marcar como «Programado», se le ponía fecha, se
-- guardaba en `fecha_programada` y la pantalla lo contaba en su recuadro.
--
-- Y NO LO MANDABA NADIE. NUNCA. No había una sola línea en el proyecto que
-- leyera esas filas para enviarlas: se quedaban ahí para siempre.
--
-- Es la mitad visible de una función a la que le falta la invisible, que es el
-- fallo que más veces se ha repetido en esta aplicación. Y de los que peor
-- sientan, porque la hermandad programa la convocatoria del cabildo, la ve en
-- la lista como «Programado», y se queda tranquila.
--
-- -----------------------------------------------------------------------------
-- QUIÉN LO MANDA: EL NAVEGADOR DE QUIEN ENTRE, NO UN SERVIDOR
-- -----------------------------------------------------------------------------
--
-- Es la decisión de fondo y conviene entenderla antes de cambiarla.
--
-- Lo «obvio» sería una función de Supabase llamada por `pg_cron`. El problema
-- es QUIÉN SON LOS DESTINATARIOS: eso lo decide `filtrarSegmento()` en
-- `src/lib/segmentacion.ts`, que sabe de estados, cuotas de verdad sacadas de
-- los recibos, edades, etiquetas, cargos efectivos, campos a medida y ahora
-- cumpleaños. Reescribir todo eso en SQL serían DOS versiones de la misma
-- regla, y la segunda siempre se queda atrás. Ese es exactamente el fallo que
-- dejó a media junta sin recibir la convocatoria durante meses.
--
-- Así que lo manda la aplicación, que es donde vive esa regla — y donde están
-- las claves del correo, que tampoco pueden bajar a la base.
--
-- YA HAY PRECEDENTE, y funciona: la copia de seguridad semanal se hace igual
-- (`src/lib/copiaAutomatica.ts`), la lanza quien entra en el panel, y está
-- escrito allí por qué: «en una hermandad es alguien casi todas las semanas».
--
-- LO QUE SE PIERDE: un comunicado programado para el martes a las nueve sale
-- cuando alguien abra el panel, que puede ser el martes a las once. Para una
-- convocatoria de cabildo eso da igual. Y lo que había antes era NUNCA.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ ENTONCES HACE FALTA ESTE SQL
-- -----------------------------------------------------------------------------
--
-- Por una sola cosa, y es la que importa: QUE NO SE MANDE DOS VECES.
--
-- Si la secretaria y el tesorero abren el panel a la vez un martes por la
-- mañana, los dos navegadores ven el mismo comunicado vencido y los dos lo
-- mandan. Ochocientas personas reciben la convocatoria por duplicado.
--
-- Eso no se puede arreglar en el navegador: dos navegadores no se ven entre
-- ellos. Se arregla aquí, donde solo hay una base de datos: se PIDE el
-- comunicado antes de mandarlo, y la base se lo da a uno solo.
--
-- Es la misma idea que `cuotas.remesada_el`, que marca lo que ya viajó en un
-- fichero para que no entre dos veces — y por el mismo motivo: dos remesas con
-- el mismo recibo son dos cargos al hermano.
--
-- Ejecútalo después de `multi-hermandad.sql`. Volver a ejecutarlo no hace nada.
-- =============================================================================

/*
 * QUIÉN LO TIENE COGIDO Y DESDE CUÁNDO. Vacío = libre, que es lo normal.
 *
 * Es una fecha y no un booleano a propósito: una pestaña que se cierra a mitad
 * del envío deja el comunicado cogido para siempre si esto fuera un «sí/no».
 * Con la hora se sabe cuánto lleva cogido y se puede soltar (ver abajo).
 */
alter table comunicados add column if not exists enviando_desde timestamptz;

/*
 * CUÁNTAS VECES SE HA INTENTADO. Es el freno del bucle infinito.
 *
 * Sin esto, un comunicado que revienta a mitad del envío se vuelve a coger a
 * la media hora, revienta otra vez, y así para siempre — mandando cada vez
 * unos cuantos correos a la misma gente. Un bucle que manda correo es lo peor
 * que puede tener esto.
 */
alter table comunicados add column if not exists envio_intentos int not null default 0;

/* Qué falló la última vez, para poder decirlo en pantalla en vez de callar. */
alter table comunicados add column if not exists envio_error text;

/*
 * A CUÁNTOS SE LES MANDÓ YA, PARA NO ESCRIBIRLES DOS VECES.
 *
 * Cuando el comunicado lleva «Hola {nombre}» hay que mandarlo de uno en uno, y
 * ochocientos correos tardan unos minutos con la pestaña abierta. Si se cierra
 * a mitad —o se va la red, o se duerme el portátil— el candado caduca a la
 * media hora y otro navegador lo coge otra vez… y empieza por el primero.
 * Trescientas personas recibirían la convocatoria dos veces.
 *
 * Con esto se apunta por dónde iba, y el reintento se salta a los que ya
 * tienen el suyo.
 *
 * LO QUE ESTO NO GARANTIZA, dicho claro: los destinatarios se ordenan por su
 * identificador para que la lista sea la misma entre un intento y otro, pero si
 * alguien se da de alta EN MEDIO de los dos intentos, la lista cambia y el
 * corte se mueve. Es un caso raro —minutos— y el destrozo es un correo
 * repetido, no uno perdido. Se acepta a cambio de no llevar una tabla con las
 * ochocientas direcciones de cada envío.
 */
alter table comunicados add column if not exists envio_enviados int not null default 0;

comment on column comunicados.envio_enviados is
  'Cuántos correos salieron ya de este comunicado. Si el envío se corta a mitad, '
  'el reintento se salta a esos en vez de escribirles otra vez.';

comment on column comunicados.enviando_desde is
  'Un navegador lo tiene cogido para mandarlo. Vacío = libre. Impide que dos '
  'personas que entran a la vez lo manden dos veces.';
comment on column comunicados.envio_intentos is
  'Intentos de envío. A partir de MAXIMO_INTENTOS deja de intentarse y se avisa: '
  'un bucle que manda correo es peor que un comunicado sin mandar.';

/**
 * PIDE UN COMUNICADO PARA MANDARLO. Devuelve el que te toca, o nada.
 *
 * ===========================================================================
 * ESTO ES UN «COMPARE AND SWAP», Y ES TODA LA GRACIA DEL FICHERO
 * ===========================================================================
 *
 * El `update` lleva DENTRO la condición de que esté libre. Postgres ejecuta
 * los `update` de uno en uno sobre la misma fila, así que de dos navegadores
 * que pidan a la vez, el primero cumple la condición y se lo lleva, y el
 * segundo ya no la cumple y se va con las manos vacías.
 *
 * Preguntar primero («¿está libre?») y actualizar después NO valdría: entre la
 * pregunta y la respuesta cabe el otro navegador. Tiene que ser la misma
 * sentencia.
 *
 * ---------------------------------------------------------------------------
 * LAS CUATRO CONDICIONES, UNA POR UNA
 * ---------------------------------------------------------------------------
 */
create or replace function reclamar_comunicado_programado()
returns table (id uuid, titulo text, cuerpo text, destinatarios text, intentos int, ya_enviados int)
language sql volatile security definer set search_path = public as $$
  update comunicados c
     set enviando_desde = now(),
         envio_intentos = c.envio_intentos + 1
   where c.id = (
     select x.id from comunicados x
      where x.hermandad_id = hermandad_actual()
        -- 1. Que esté programado. Un borrador no se manda solo, y uno ya
        --    enviado no se vuelve a mandar.
        and x.estado = 'Programado'
        -- 2. Que le haya llegado el día. Se compara como texto porque la
        --    columna es texto y las fechas van en `aaaa-mm-dd`, que ordena
        --    igual escrita que como fecha. Es `<=` y no `=`: si el día señalado
        --    no entró nadie al panel, el comunicado sale al día siguiente en
        --    vez de perderse para siempre.
        and x.fecha_programada is not null
        and x.fecha_programada <= to_char(current_date, 'YYYY-MM-DD')
        -- 3. Que no lo tenga cogido nadie. O que lo tenga cogido desde hace
        --    tanto que ya no puede estar mandándolo: media hora es de sobra
        --    para ochocientos correos, y una pestaña cerrada a mitad no puede
        --    dejar la convocatoria bloqueada para siempre.
        and (x.enviando_desde is null or x.enviando_desde < now() - interval '30 minutes')
        -- 4. Y que no lleve ya demasiados intentos. Ver `envio_intentos`.
        and x.envio_intentos < 3
      -- El más antiguo primero: si se acumularon varios, salen en el orden en
      -- que se programaron, que es el orden en que se pensaron.
      order by x.fecha_programada, x.numero
      limit 1
      for update skip locked
   )
  returning c.id, c.titulo, c.cuerpo, c.destinatarios, c.envio_intentos, c.envio_enviados
$$;

grant execute on function reclamar_comunicado_programado() to authenticated;

/**
 * YA ESTÁ MANDADO: se cierra.
 *
 * Se suelta el candado y se deja el alcance real —a cuántos se le ha escrito
 * de verdad—, que es lo que luego se lee en la lista. Y se borra el error
 * anterior si lo había: un intento que sale bien limpia lo de antes.
 */
create or replace function cerrar_comunicado_enviado(p_id uuid, p_alcance int)
returns void
language sql volatile security definer set search_path = public as $$
  update comunicados
     set estado = 'Enviado',
         fecha_envio = to_char(current_date, 'YYYY-MM-DD'),
         alcance = p_alcance,
         enviando_desde = null,
         envio_error = null,
         -- Cerrado y a cero: si algún día se reenviara a mano, empieza limpio.
         envio_enviados = 0
   where id = p_id and hermandad_id = hermandad_actual()
$$;

grant execute on function cerrar_comunicado_enviado(uuid, int) to authenticated;

/**
 * NO SE HA PODIDO: se suelta y se apunta por qué.
 *
 * SE QUEDA EN «Programado» A PROPÓSITO, para que se vuelva a intentar. Lo que
 * NO se hace es reintentar sin fin: `envio_intentos` ya subió al pedirlo, y a
 * la tercera deja de cogerse.
 *
 * Y el motivo se guarda para poder enseñarlo. Un comunicado que lleva tres
 * días sin salir y no dice por qué es un comunicado que nadie va a arreglar.
 */
create or replace function soltar_comunicado_fallido(p_id uuid, p_error text)
returns void
language sql volatile security definer set search_path = public as $$
  update comunicados
     set enviando_desde = null,
         envio_error = left(coalesce(p_error, 'No se pudo mandar.'), 500)
   where id = p_id and hermandad_id = hermandad_actual()
$$;

grant execute on function soltar_comunicado_fallido(uuid, text) to authenticated;

/*
 * EL ÍNDICE. Esta consulta se hace al entrar en el panel, o sea muchas veces al
 * día y en todas las hermandades.
 *
 * Es PARCIAL —solo indexa lo que está programado— y eso importa: de mil
 * comunicados de una hermandad, los programados son dos o tres. El índice ocupa
 * casi nada y acierta siempre.
 */
create index if not exists comunicados_programados_idx
  on comunicados (hermandad_id, fecha_programada)
  where estado = 'Programado';

/**
 * APUNTA POR DÓNDE VA EL ENVÍO.
 *
 * Se llama cada pocos correos, no en cada uno: ochocientas escrituras a la base
 * para acompañar a ochocientos correos duplicarían el trabajo sin ganar nada
 * —perder cinco de ochocientos por redondeo es aceptable, y perder cinco es
 * mandar cinco repetidos, no dejar a nadie sin el suyo—.
 *
 * `greatest` para que no pueda ir hacia atrás: si dos navegadores se pisaran,
 * el que va más adelantado manda. Retroceder aquí es reenviar.
 */
create or replace function apuntar_avance_del_envio(p_id uuid, p_enviados int)
returns void
language sql volatile security definer set search_path = public as $$
  update comunicados
     set envio_enviados = greatest(envio_enviados, p_enviados)
   where id = p_id and hermandad_id = hermandad_actual()
$$;

grant execute on function apuntar_avance_del_envio(uuid, int) to authenticated;
