-- ============================================================================
--   LAS COLUMNAS QUE SOLO LLEGABAN A LAS BASES NUEVAS
-- ============================================================================
--
-- QUÉ PASABA. En una hermandad ya montada:
--
--   · Se ponía la HORA DE CITACIÓN de un tramo, se guardaba, y al recargar
--     estaba en blanco otra vez.
--   · Registrar el COBRO DE UNA PAPELETA no dejaba rastro del método ni de la
--     fecha.
--   · ANULAR una papeleta no guardaba el motivo.
--   · El aviso del hermano de «ya lo he pagado por Bizum» no se guardaba en
--     ninguna parte.
--   · El COLOR SECUNDARIO de la hermandad volvía al de fábrica.
--
-- Todo lo mismo, y sin un solo error en pantalla.
--
-- ----------------------------------------------------------------------------
-- POR QUÉ
-- ----------------------------------------------------------------------------
--
-- Estas nueve columnas se fueron añadiendo con el tiempo, y se añadieron donde
-- parecía lo natural: en `schema.sql`, al lado de su tabla, como
-- `alter table … add column if not exists`. El propio fichero lo explica:
--
--   «Va como `alter table` y no dentro del `create table` de arriba PARA LAS
--    BASES QUE YA EXISTEN: el `create table if not exists` no toca una tabla
--    que ya está, así que a ellas la columna solo les llega por aquí.»
--
-- La intención era exactamente la correcta. Lo que falla es el reparto:
-- `schema.sql` solo va en `TODO-EN-UNO.sql`, el instalador. Una hermandad que
-- montó su base hace meses y desde entonces solo pega `ACTUALIZAR.sql` NO
-- VUELVE A EJECUTARLO NUNCA. Así que las columnas «para las bases que ya
-- existen» son justo las que no llegan a las bases que ya existen.
--
-- Y cuando la aplicación escribe en una columna que no está, Postgres rechaza
-- LA SENTENCIA ENTERA. No se pierde ese dato: no se guarda la fila. El tramo
-- entero, el cobro entero, la papeleta entera. En pantalla se ve bien —React
-- ya tiene el dato— y solo al recargar aparece que no se guardó nada.
--
-- Es el mismo reparto que dejó fuera `hermano-con-cargo.sql`. `npm test`
-- comprueba ahora que ninguna columna de `schema.sql` se quede sin camino
-- hasta aquí.
--
-- VA EL PRIMERO de la lista, y tiene que seguir siéndolo: lo que viene detrás
-- crea políticas y funciones que nombran estas columnas.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Es seguro repetirlo: `if not exists` no toca lo que ya está, y ninguna de
--   estas líneas borra ni sobrescribe un dato.
-- ============================================================================

-- Los colores de la hermandad, que se usan en el área del hermano y en la web.
alter table hermandad_settings add column if not exists color_secundario text not null default '#C5A059';

/*
 * LA HORA DE CITACIÓN DEL TRAMO. No salen todos a la vez, y es literalmente la
 * pregunta de la semana antes de la salida — la que satura el teléfono de la
 * secretaría y el grupo de WhatsApp.
 *
 * Sin la columna no se guardaba el tramo ENTERO, ni al crear ni al editar. Y
 * sin tramos no hay cortejo, y sin cortejo las papeletas no se pueden asignar
 * a ningún sitio.
 */
alter table tramos add column if not exists hora_citacion text;

-- El cobro de la cuota, la propuesta de mora y el aviso de pago del hermano.
alter table cuotas add column if not exists metodo_cobro text;
alter table cuotas add column if not exists mora_propuesta_por text;
alter table cuotas add column if not exists mora_propuesta_nombre text;
alter table cuotas add column if not exists pago_comunicado jsonb;

/*
 * Y «En mora» como estado válido. Una base anterior tiene el check viejo, que
 * lo rechaza: la cuota no se puede marcar y el aviso que sale habla de una
 * restricción, no de la cuota.
 *
 * Entre `exception when others then null` porque en una base donde la
 * restricción ya esté bien esto no debe cortar el resto del archivo.
 */
do $$
begin
  alter table cuotas drop constraint if exists cuotas_estado_check;
  alter table cuotas add constraint cuotas_estado_check
    check (estado in ('Pagada', 'Pendiente', 'Devuelta', 'En mora'));
exception when others then null;
end $$;

-- El cobro que registra la secretaría, y el motivo si la papeleta se anula.
alter table papeletas add column if not exists metodo_pago text;
alter table papeletas add column if not exists fecha_pago text;
alter table papeletas add column if not exists motivo_anulacion text;

/*
 * DE DÓNDE SALIÓ CADA APUNTE DE TESORERÍA.
 *
 * Esta no viene de `schema.sql` sino de `apuntes-automaticos.sql`, que tampoco
 * va en la lista de actualizar — pero el efecto es peor todavía, porque
 * `tienda.sql` SÍ va, y su `registrar_venta` escribe en `origen`. En una base
 * que nunca ejecutó aquel fichero, COBRAR EN LA TIENDA FALLA ENTERO: la venta
 * se rechaza con «column "origen" of relation "movimientos" does not exist»,
 * que no le dice nada a nadie.
 *
 * Lo mismo vale para el cobro de una cuota y el de una papeleta: los tres
 * apuntan aquí para no apuntarse dos veces.
 */
alter table movimientos add column if not exists origen text;

/*
 * Y su índice: único POR HERMANDAD —dos hermandades pueden tener cada una su
 * cuota con el mismo identificador de origen sin pisarse— y solo donde hay
 * origen, porque los apuntes escritos a mano en Tesorería no llevan ninguno y
 * son la mayoría.
 *
 * VA DENTRO DE UN `if`, y no por prudencia genérica. Este fichero es EL PRIMERO
 * de los dos repartos, y en el INSTALADOR eso significa que se ejecuta antes que
 * `multi-hermandad.sql`, que es quien parte la base en hermandades y añade
 * `movimientos.hermandad_id`. Sin la comprobación, el instalador entero se
 * detiene aquí con «column "hermandad_id" does not exist» y una base nueva se
 * queda a medio montar.
 *
 * En una base que ya funciona la columna está desde el primer día, así que el
 * índice se crea; y en una nueva lo crea `apuntes-automaticos.sql`, que va
 * detrás de `multi-hermandad.sql` y para eso está.
 */
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'movimientos' and column_name = 'hermandad_id'
  ) then
    create unique index if not exists movimientos_origen_por_hermandad
      on movimientos (hermandad_id, origen) where origen is not null;
  end if;
end $$;
