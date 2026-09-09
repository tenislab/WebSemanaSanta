-- =============================================================================
--   EL NUMERITO DEL MENÚ: CUÁNTAS COSAS HAY ESPERANDO
-- =============================================================================
--
-- La pantalla de Notificaciones funciona y lo enseña todo. Lo que faltaba es
-- que alguien se enterara SIN ENTRAR A MIRARLA.
--
-- Hoy «Notificaciones» es un enlace más del menú, igual que «Hermanos» o
-- «Cuotas», y no cambia nunca de aspecto. Así que si un hermano pide la baja un
-- martes, la secretaria solo se entera si ese día se le ocurre pinchar ahí. Si
-- no entra, la baja sigue esperando el miércoles, el jueves y la semana que
-- viene. Es la diferencia entre un buzón que hay que acordarse de abrir y uno
-- que enciende una luz.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ ESTO ES UNA FUNCIÓN DE LA BASE Y NO UNA CUENTA EN EL NAVEGADOR
-- -----------------------------------------------------------------------------
--
-- Porque la aplicación ya sabe contarlos —`avisosPendientes()` en
-- `src/lib/notificaciones.ts`— pero para eso necesita tener delante las
-- solicitudes, las cuotas, las papeletas, los hermanos y los mensajes.
--
-- Y el numerito va EN EL MENÚ, o sea en todas las pantallas. Contarlo en el
-- navegador significaría cargar esas cinco tablas en Tesorería, en el
-- Inventario, en la Web pública y en todas las demás. Justo lo contrario de lo
-- que se está haciendo para que esto aguante cuando crezca (ver
-- `src/lib/ventanaHistorico.ts`).
--
-- Aquí es UNA consulta que devuelve UN número, y la base ya tiene los índices.
--
-- -----------------------------------------------------------------------------
-- QUÉ CUENTA, Y QUÉ NO. ESTO IMPORTA MÁS DE LO QUE PARECE.
-- -----------------------------------------------------------------------------
--
-- Cuenta LO QUE HA LLEGADO Y ESPERA RESPUESTA:
--
--   · Quien pide entrar en la hermandad.
--   · Quien ha pedido darse de baja.
--   · Quien ha escrito desde la web.
--   · Quien avisa de que ya ha pagado su cuota o su papeleta.
--   · Quien ha pedido su papeleta de sitio.
--
-- NO CUENTA «hermanos sin cuota», que también sale en esa pantalla. Y es a
-- propósito: eso no es algo que HAYA LLEGADO, es un estado de la hermandad. No
-- hay nadie esperando al otro lado, no se resuelve contestando, y estaría en el
-- contador todo el año hasta que se emitieran las cuotas — un numerito que no
-- baja nunca es un numerito que se deja de mirar, y con él se dejan de mirar
-- los que sí importaban.
--
-- Además haría falta saber el ejercicio en curso y el concepto de la cuota
-- anual, que los decide la aplicación. Copiar esa lógica aquí serían dos
-- versiones de la misma regla, y la segunda siempre se queda atrás.
--
-- HAY UNA PRUEBA que comprueba que cada tipo de aviso está o contado aquí o en
-- la lista de excepciones de arriba (`pruebas/contador.prueba.mjs`): añadir un
-- tipo nuevo obliga a decidir de qué lado va, en vez de que se quede fuera sin
-- que nadie lo note.
--
-- Ejecútalo después de `multi-hermandad.sql`. Volver a ejecutarlo no hace nada.
-- =============================================================================

/**
 * Cuántas cosas esperan respuesta en la hermandad de quien pregunta.
 *
 * `security definer` para que dé lo mismo con qué cargo se pregunte: el
 * numerito del menú lo ve todo el mundo, y quien no pueda abrir una sección
 * verá el número igual pero no podrá entrar. Es mejor que enseñar números
 * distintos a cada uno — dos personas mirando la misma hermandad tienen que ver
 * lo mismo.
 *
 * Va acotada a `hermandad_actual()` en las seis cuentas, una por una. No basta
 * con confiar en RLS aquí: `security definer` se la salta.
 */
create or replace function avisos_que_esperan() returns integer
language sql stable security definer set search_path = public as $$
  select
    -- Quien pide entrar. El que más duele dejar esperando: hay una persona al
    -- otro lado que no sabe si su solicitud ha llegado siquiera.
    (select count(*) from solicitudes_alta
      where hermandad_id = hermandad_actual() and estado = 'Pendiente')
    -- Quien ha pedido darse de baja. `baja_solicitada` es «lo ha pedido» y
    -- `estado = 'Baja'` es «se ha tramitado»: hay que mirar las dos, o el
    -- número no bajaría nunca al tramitarla.
  + (select count(*) from hermanos
      where hermandad_id = hermandad_actual()
        and baja_solicitada and estado <> 'Baja')
    -- Quien ha escrito desde la web y todavía no se ha leído.
  + (select count(*) from mensajes_web
      where hermandad_id = hermandad_actual() and not leido)
    -- «Ya he pagado» — la misma regla que `esAvisado()` en `data/cuotas.ts`.
  + (select count(*) from cuotas
      where hermandad_id = hermandad_actual()
        and pago_comunicado is not null and estado <> 'Pagada')
    /*
     * Y lo mismo con la papeleta, PERO LA COLUMNA NO SE LLAMA IGUAL.
     *
     * En `cuotas` el aviso de pago es un `jsonb` (`pago_comunicado`); en
     * `papeletas` son DOS columnas sueltas, `pago_metodo` y `pago_fecha`. Es
     * una diferencia histórica entre las dos tablas y no se ve desde la
     * aplicación, porque `papeletaToRow` las junta y las llama `pagoComunicado`
     * en los dos sitios.
     *
     * Copié aquí el `pago_comunicado is not null` de la línea de arriba y
     * Postgres rechazó la instalación entera: `create function ... language sql`
     * comprueba el cuerpo al crearla. Que la caiga ahí es lo mejor que podía
     * pasar — en una función `plpgsql` no se habría notado hasta llamarla.
     *
     * Aquí son además TRES los estados que la cierran, no uno.
     */
  + (select count(*) from papeletas
      where hermandad_id = hermandad_actual()
        and pago_metodo is not null
        and estado not in ('Pagada', 'Entregada', 'Anulada'))
    -- Quien ha pedido su papeleta de sitio.
  + (select count(*) from solicitudes_papeleta
      where hermandad_id = hermandad_actual() and estado = 'Pendiente')
    /*
     * Y LOS COMUNICADOS PROGRAMADOS A LOS QUE YA LES TOCABA SALIR.
     *
     * Este es distinto de los otros cinco y merece la explicación: no hay
     * nadie al otro lado esperando respuesta. Lo que hay es un comunicado que
     * la hermandad dio por hecho —lo programó, lo vio como «Programado» y se
     * quedó tranquila— y que NO SALE HASTA QUE ALGUIEN ABRE COMUNICADOS.
     *
     * Sale de ahí y no de un servidor porque para saber a quién va hace falta
     * el censo entero con sus cuotas resueltas, y eso solo está cargado en esa
     * pantalla (el porqué entero, en `src/lib/envioProgramado.ts`).
     *
     * Así que el numerito es lo que hace que alguien entre, y por eso este
     * cuenta aunque no sea una petición: sin él, un comunicado programado por
     * alguien que ya no entra en Comunicados se quedaría esperando meses.
     *
     * Y baja solo en cuanto sale, que es la condición para que un contador se
     * siga mirando.
     */
  + (select count(*) from comunicados
      where hermandad_id = hermandad_actual()
        and estado = 'Programado'
        and fecha_programada is not null
        and fecha_programada <= to_char(current_date, 'YYYY-MM-DD'))
$$;

grant execute on function avisos_que_esperan() to authenticated;

/*
 * LOS ÍNDICES QUE HACEN QUE ESTO NO CUESTE NADA.
 *
 * Esta función se llama al entrar y cada vez que se sale de Notificaciones, o
 * sea muchas veces al día y en todas las hermandades a la vez. Son seis cuentas
 * y todas filtran por `hermandad_id`, que ya tiene índice desde
 * `multi-hermandad.sql`.
 *
 * Los dos de aquí abajo son los que faltaban, y son PARCIALES —solo indexan las
 * filas que cumplen la condición—. Eso importa: la inmensa mayoría de los
 * recibos están pagados y la inmensa mayoría de los hermanos no han pedido la
 * baja, así que estos índices ocupan casi nada y aciertan siempre.
 */
create index if not exists hermanos_baja_pedida_idx
  on hermanos (hermandad_id) where baja_solicitada;

create index if not exists mensajes_web_sin_leer_idx
  on mensajes_web (hermandad_id) where not leido;
