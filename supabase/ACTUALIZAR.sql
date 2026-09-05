-- =============================================================================
--
--   GOBERGO — ACTUALIZAR UNA BASE QUE YA FUNCIONA
--
-- =============================================================================
--
--   GENERADO. No lo edites a mano: se sobrescribe.
--   Se toca el fichero suelto y se vuelve a generar con
--       node scripts/generar-actualizar.mjs
--
-- -----------------------------------------------------------------------------
-- PARA QUIÉN ES ESTE ARCHIVO
-- -----------------------------------------------------------------------------
--
-- Para una base que YA está montada y a la que le faltan las últimas piezas.
--
-- Si estás empezando de cero, este no: usa `TODO-EN-UNO.sql`, que lo crea
-- todo. Ejecutar los dos tampoco rompe nada, solo sobra.
--
-- -----------------------------------------------------------------------------
-- CÓMO SE USA
-- -----------------------------------------------------------------------------
--
--   1. Abre tu proyecto en supabase.com
--   2. Menú izquierdo → SQL Editor → New query
--   3. Copia ESTE ARCHIVO ENTERO, pégalo y dale a RUN
--
-- Al terminar sale una tabla diciendo qué hay puesto y qué no. Es lo único que
-- devuelve: si sale todo en «puesto», ya está.
--
-- Es seguro volver a ejecutarlo. Todo está escrito para no romperse si ya
-- existía, y nada de lo que hay aquí borra ni sobrescribe datos.
--
-- -----------------------------------------------------------------------------
-- QUÉ AÑADE
-- -----------------------------------------------------------------------------
--
--   1. columnas-que-faltan.sql        Columnas que solo llegaban a las bases nuevas (hora de citación, cobros…)
--   2. ajustes-de-la-hermandad.sql    Los ajustes de cuotas y las etiquetas, guardados en la hermandad
--   3. hermano-con-cargo.sql          Una persona, una ficha: el cargo va en la ficha del hermano
--   4. clave-de-catalogos.sql         Que cada hermandad tenga sus propios catálogos (la clave era global)
--   5. imagenes.sql                   El almacén de fotos: que la web no lleve las imágenes dentro
--   6. visitas-web.sql                El contador de visitas de la web, sin cookies ni Google Analytics
--   7. suscriptores-web.sql           Avisos por correo para quien sigue a la hermandad sin ser hermano
--   8. copias.sql                     Las copias de seguridad, guardadas solas cada semana
--   9. permisos-eventos-y-web.sql     Los dos módulos que nunca se sembraron: «eventos» y «web»
--   10. lo-que-toca-el-hermano.sql     Que el hermano no se ponga la cuota como pagada desde la consola
--   11. sin-contrasenas-en-las-solicitudes.sql Fuera la contraseña en claro que guardaba cada solicitud de alta
--   12. freno-de-los-formularios.sql   Un tope a lo que cualquiera puede meter desde la web pública
--   13. cuenta-por-hermandad.sql       Ser hermano de dos hermandades: una cuenta por hermandad + DNI
--   14. solicitudes-de-papeleta.sql    Que la solicitud de papeleta del hermano llegue a la hermandad
--   15. activar-la-suscripcion.sql     Que el botón de activar la suscripción llegue a la base
--   16. numero-de-recibo-unico.sql     Que no pueda haber dos recibos con el mismo número
--   17. borrar-una-hermandad.sql       Que una hermandad se pueda borrar (el registro lo impedía)
--   18. documentos-restringidos.sql    Que el documento restringido lo sea también en la base
--   19. webhook-stripe.sql             Que la suscripción se active cuando Stripe confirma el cobro, no antes
--   20. mandatos-sepa.sql              El mandato SEPA firmado de verdad, por el propio hermano
--   21. encargos-redes.sql             Encargar un post y que se reparta solo entre la junta
--   22. tienda.sql                     La tienda: productos, ventas, stock y los asientos que generan
--   23. tienda-web.sql                 La tienda en la web: reservar por internet y pagar al recoger
--   24. campanas-y-proyectos.sql       Campañas de recaudación con su barra, y proyectos a largo plazo
--   25. baja-de-hermano.sql            La baja de un hermano, entera y sin romper el escalafón
--   26. campana-con-partida.sql        Enlazar una campaña a sus partidas: la barra se llena sola
--   27. reglas-de-reparto.sql          Gastos porcentuales enlazados a una partida, para pérdidas y ganancias
--   28. pago-tarjeta.sql               Que el hermano pague su cuota o su papeleta con tarjeta
--
-- -----------------------------------------------------------------------------
-- LO QUE ESTE ARCHIVO NO LLEVA, Y POR QUÉ
-- -----------------------------------------------------------------------------
--
-- 1. `permisos-por-hermandad.sql` NO ESTÁ, y no se debe ejecutar suelto sobre
--    una base al día. Redefine `modulo_permitido()`, y `hermano-con-cargo.sql`
--    —que SÍ va en esta lista, en el sitio que le toca— la vuelve a definir
--    después con una vía más: el hermano que lleva un cargo en su propia
--    ficha. Manda la última definición que se ejecute, así que el fichero
--    viejo por su cuenta dejaría fuera otra vez al tesorero que además es
--    hermano. De ahí solo hacía falta el relleno de «eventos» y «web», y ese
--    va arriba, en su propio fichero, sin tocar ninguna función.
--
-- 2. `tareas-programadas.sql` NO ESTÁ porque necesita la extensión `pg_cron`
--    activada antes, y eso se hace a mano: Database → Extensions → pg_cron.
--    Puesta la extensión, ese fichero se ejecuta aparte. Sin él todo funciona;
--    lo único que no pasa solo es la limpieza de visitas viejas y de
--    suscriptores sin confirmar.
--
-- =============================================================================


-- =============================================================================
--   COLUMNAS-QUE-FALTAN.SQL — Columnas que solo llegaban a las bases nuevas (hora de citación, cobros…)
-- =============================================================================

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

-- =============================================================================
--   AJUSTES-DE-LA-HERMANDAD.SQL — Los ajustes de cuotas y las etiquetas, guardados en la hermandad
-- =============================================================================

-- ============================================================================
--   DOS AJUSTES QUE VIVÍAN EN UN SOLO NAVEGADOR
-- ============================================================================
--
-- Mismo problema que tenían el modelo de papeleta y la hoja de asistencia
-- —arreglado en `plantillas-hermandad.sql`— en otros dos sitios que se
-- quedaron atrás. Los dos son decisiones DE LA HERMANDAD, no preferencias de
-- quien está delante del ordenador, y los dos vivían en `localStorage`.
--
-- 1. LOS AJUSTES DE CUOTAS, y este es de dinero.
--
--    `bloquearPapeletaConDeuda` — «a quien deba cuotas no se le saca papeleta».
--    La hermandad lo decide en cabildo, la secretaria lo activa en SU
--    ordenador, y quien atiende el sábado por la mañana desde el otro no tiene
--    el bloqueo: le saca la papeleta a un moroso y nadie se entera hasta que
--    se cuadran las cuentas.
--
--    `moraRequiereDosCargos` — poner a alguien en mora exige que lo proponga
--    un cargo y lo confirme otro distinto. Es un control de cuatro ojos, y un
--    control de cuatro ojos que se salta abriendo otro navegador no es un
--    control.
--
-- 2. EL CATÁLOGO DE ETIQUETAS (costalero, acólito, banda, diputado de tramo…).
--
--    Con él se segmentan los comunicados y se filtra el censo. Cada ordenador
--    tenía el suyo: el mayordomo creaba «Costalero de repuesto» en el suyo y
--    desde el de secretaría esa etiqueta no existía, así que el comunicado a
--    los costaleros de repuesto no se podía mandar. Y al cerrar sesión se
--    borra todo lo que empieza por `cabildo-`, así que el catálogo entero
--    desaparecía.
--
-- 3. LA CAMPAÑA DE PAPELETAS: el año de la estación de penitencia y las tres
--    fechas del plazo (cuándo abren los que salieron el año pasado, cuándo los
--    demás, y cuándo se cierra).
--
--    Esta es la peor de las tres, porque no se queda en una pantalla: la lee
--    el ÁREA DEL HERMANO. La secretaría abría la campaña de 2026 en su
--    ordenador y el hermano, desde el móvil, veía la de fábrica —año 2027, con
--    su plazo y su fecha de salida— y pedía sitio para una Semana Santa que no
--    tocaba. Ninguno de los dos veía nada raro.
--
--    Y de aquí sale también qué papeletas cuentan como «del año», que es lo
--    que ordena el cortejo, los roles y los comunicados por tramo.
--
-- 4. LOS CAMPOS PROPIOS DE LA FICHA (talla de túnica, número de llave, si
--    tiene el carné de costalero al día…).
--
--    Los define cada hermandad, pero el VALOR de cada uno se guarda dentro de
--    la ficha del hermano, que sí va a la base. O sea que el dato viajaba y la
--    definición no: desde otro ordenador, la talla estaba guardada y no se
--    veía por ninguna parte, porque el campo «talla» no existía allí.
--
-- Las cuatro van como `jsonb` en `hermandad_settings`, igual que las plantillas.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table hermandad_settings add column if not exists ajustes_cuotas jsonb;
alter table hermandad_settings add column if not exists etiquetas jsonb;
alter table hermandad_settings add column if not exists campana jsonb;
alter table hermandad_settings add column if not exists campos_propios jsonb;

comment on column hermandad_settings.campana is
  'La campaña de papeletas: el año de la estación de penitencia y las fechas del '
  'plazo. Vivía en localStorage, así que el área del hermano enseñaba la campaña de '
  'fábrica —otro año y otro plazo— en vez de la que había abierto la secretaría.';

comment on column hermandad_settings.campos_propios is
  'Los campos a medida de la ficha del hermano (talla de túnica, número de llave…). '
  'El valor de cada uno ya iba dentro de la ficha; la definición se quedaba en el '
  'navegador, así que desde otro ordenador el dato estaba guardado y no se veía.';

comment on column hermandad_settings.ajustes_cuotas is
  'Decisiones de la hermandad sobre cuotas: si bloquear la papeleta a quien debe, '
  'y si la mora exige la confirmación de dos cargos. Vivían en localStorage, así que '
  'no valían desde otro ordenador — incluido el control de cuatro ojos de la mora.';

comment on column hermandad_settings.etiquetas is
  'Catálogo de etiquetas de la hermandad (costalero, acólito, banda…). Con ellas se '
  'segmentan los comunicados. Vivían en localStorage: cada ordenador tenía el suyo y '
  'se borraban al cerrar sesión.';

-- =============================================================================
--   HERMANO-CON-CARGO.SQL — Una persona, una ficha: el cargo va en la ficha del hermano
-- =============================================================================

-- ============================================================================
--   UNA PERSONA, UNA FICHA — el cargo vive en la ficha del hermano
-- ============================================================================
--
-- EL PROBLEMA
--
--   Hasta ahora, el secretario de una hermandad existía DOS VECES: una como
--   hermano nº 47 en el censo, con sus cuotas y su papeleta, y otra como fila
--   en `personal` con su correo y su cargo. Dos fichas, dos claves, dos
--   maneras de entrar, y nada que las uniera salvo que se llamaban igual.
--
--   Eso no es una molestia de diseño: es la causa del fallo que se veía. Se
--   entraba con el correo, la aplicación miraba en `hermanos`, encontraba la
--   ficha y mandaba al área del hermano. Se entraba por el área del hermano y
--   no había forma de llegar al panel. La persona era la misma y el sistema no
--   lo sabía.
--
-- LO QUE HACE ESTE ARCHIVO
--
--   Pone el cargo EN LA FICHA DEL HERMANO. Una persona, una ficha, un número
--   de hermano, una clave. Si lleva cargo, además entra al panel y ve los
--   módulos de su cargo. Si no lo lleva, tiene su área y ya está.
--
--   La tabla `personal` NO se toca y NO se vacía: sigue existiendo para quien
--   trabaja en la hermandad sin ser hermano y ya estaba dado de alta ahí. Las
--   dos vías conviven. Todo lo que hay aquí SUMA con `or`; no sustituye nada.
--
-- LAS CUATRO COSAS QUE IMPORTAN, POR ORDEN
--
--   1. El trigger `hermanos_solo_personal_toca_el_cargo`. Sin él, esto abre la
--      base entera: cualquier hermano puede reescribir su propia ficha, así
--      que en cuanto `cargo` existe como columna, dos líneas en la consola del
--      navegador le convierten en Hermano Mayor. Es lo primero que se lee.
--   2. `auth_es_hermano()` cambia de significado, y con él las ~60 políticas
--      que empiezan por `not auth_es_hermano()`. Por eso hay que reescribir
--      las políticas «propio»: si no, un tesorero pierde su propia papeleta.
--   3. Las políticas `authenticated_all` se borran. Anulaban el filtro por
--      módulo en catorce tablas — el cargo era interfaz, no seguridad.
--   4. Los permisos de fábrica se ponen al día: la aplicación y la base decían
--      cosas distintas, y se notaba en «guardo y no se guarda».
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
--
--   Va EL ÚLTIMO de todos los archivos: redefine funciones que crean los
--   anteriores, y el que manda es el último que se ejecuta.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Las dos columnas nuevas
-- ----------------------------------------------------------------------------

-- `cargo` es text y no un enum a propósito: `personal.cargo` y
-- `permisos_cargo.cargo` ya son text, y el cruce que decide los permisos es
-- text contra text. Un enum obligaría a convertir en todas partes.
alter table hermanos add column if not exists cargo text;
alter table hermanos add column if not exists civil boolean not null default false;

comment on column hermanos.cargo is
  'Cargo en la junta, si lo lleva. NULL = hermano de a pie, que es lo normal. '
  'Cruza con permisos_cargo.cargo para decidir qué módulos toca. Solo lo puede '
  'cambiar quien tenga el módulo personal: lo vigila el trigger de más abajo.';

comment on column hermanos.civil is
  'Hermano civil: está en el censo y tiene su área, pero NO se le emiten cuotas. '
  'Para quien trabaja en la hermandad sin ser hermano. OJO: en el SQL esta columna '
  'no hace nada — no hay nada en la base que emita cuotas, las emite la aplicación. '
  'Si buscas aquí el filtro, no está: está en src/lib/cuotasEmision.ts (la emisión anual) '
  'y en el cajón de cuota suelta de src/pages/app/Cuotas.tsx.';

-- Para llevar cargo hace falta correo. No es burocracia: con cargo se entra al
-- panel, y el panel lo protegen las políticas, que preguntan por `auth.uid()`.
-- Sin correo no hay cuenta de Supabase, sin cuenta no hay `auth.uid()`, y sin
-- eso no hay ninguna protección del lado del servidor.
do $$
begin
  alter table hermanos add constraint hermanos_cargo_con_correo
    check (cargo is null or email <> '');
exception when duplicate_object then null;
end $$;

-- `modulo_permitido()` va a leer esto en CADA fila de CADA consulta.
create index if not exists hermanos_cargo_idx
  on hermanos (hermandad_id, cargo) where cargo is not null;

-- NO se pone un índice único sobre el correo, y conviene saber por qué para que
-- nadie lo «arregle»: en una hermandad es normalísimo que un padre apunte a sus
-- dos hijos menores con su propio correo, o que un matrimonio comparta el suyo.
-- Un único los dejaría fuera del censo.
--
-- Donde el correo sí tiene que ser único es en las CUENTAS, y de eso ya se
-- encarga Supabase: el segundo alta con el mismo correo falla, y la aplicación
-- lo explica en cristiano (src/lib/accesos.ts). Es decir: dos hermanos pueden
-- compartir correo mientras solo uno de ellos tenga cuenta.
create index if not exists hermanos_email_idx
  on hermanos (hermandad_id, lower(email)) where email <> '';


-- ----------------------------------------------------------------------------
-- 2. EL TRIGGER. Que nadie se ponga un cargo a sí mismo
-- ----------------------------------------------------------------------------
--
-- Esto es lo más importante del archivo.
--
-- `hermanos_propio_update` deja a cada hermano reescribir SU PROPIA FILA. Era
-- inofensivo mientras en esa fila no hubiera nada que diera poder: cambiarse
-- el teléfono no hace daño a nadie. Desde el momento en que existe `cargo`, un
-- hermano cualquiera puede abrir la consola del navegador y escribir:
--
--     supabase.from('hermanos').update({ cargo: 'Hermano Mayor' })
--             .eq('auth_user_id', <el suyo>)
--
-- y a partir de ahí ve el censo entero, la tesorería y los permisos de todos.
--
-- Postgres NO permite limitar columnas dentro de una política RLS: una política
-- deja pasar la fila entera o ninguna. Así que la única forma de proteger DOS
-- columnas de una fila que su dueño sí puede editar es un trigger.
--
-- POR QUÉ REVIERTE EN SILENCIO Y NO DA ERROR. Porque la aplicación manda
-- siempre la fila completa al guardar (supabaseSync.ts), así que un hermano que
-- cambia su teléfono manda también su `cargo` — el mismo que ya tenía. Si esto
-- lanzara una excepción, ese guardado normal fallaría y nadie entendería por
-- qué. Revirtiendo, el valor vuelve a ser el que era y no pasa nada. Quien SÍ
-- tiene derecho a cambiarlo no pasa por aquí.
create or replace function hermanos_solo_personal_toca_el_cargo() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- Sin sesión no es el navegador: es el editor SQL o una función interna, que
  -- ya han pasado por RLS (estas tablas solo abren a `authenticated`). Ahí no
  -- hay nada que proteger y estorbaría para arreglar datos a mano.
  if auth.uid() is null then return new; end if;

  -- Quien gestiona el censo o los cargos escribe la ficha entera. Son dos
  -- módulos y hacen falta los dos: «hermanos» es quien corrige una dirección,
  -- «personal» es quien reparte cargos. Si solo se pidiera «personal», la
  -- secretaria no podría ni cambiar un teléfono.
  if modulo_permitido('hermanos') or modulo_permitido('personal') then return new; end if;

  /*
   * A partir de aquí es el propio hermano escribiendo SU ficha, y solo puede
   * tocar lo suyo. LISTA BLANCA, no lista negra, y la diferencia es todo:
   *
   * Congelar solo `cargo` y `civil` no bastaba, y el agujero era de libro. La
   * única forma que tiene la base de quitarle el cargo a alguien es su
   * `estado`: tanto `auth_es_hermano()` como `modulo_permitido()` preguntan
   * por `estado <> 'Baja'`. Pero `estado` es una columna más de su fila, y RLS
   * no sabe de columnas. Así que al tesorero destituido le bastaba con una
   * línea desde la consola del navegador, con la sesión que ya tenía abierta:
   *
   *     supabase.from('hermanos').update({ estado: 'Activo' }).eq(...)
   *
   * El disparador miraba `cargo`, veía que no cambiaba, y dejaba pasar. En ese
   * instante recuperaba Tesorería, Cuotas, Inventario e Informes.
   *
   * Y de paso se cerraba lo mismo con `numero` (subirse en el escalafón),
   * `cuota_al_dia` (darse la cuota por pagada), `antiguedad` (ganar prioridad
   * al pedir papeleta) e `iban`.
   *
   * Lo que un hermano SÍ puede cambiar de su ficha es lo que ya declara
   * `contactoDelHermanoToRow` en la aplicación —sus datos de contacto—, su
   * foto y sus preferencias de aviso, más pedir la baja. Todo lo demás vuelve
   * a como estaba.
   */
  if tg_op = 'INSERT' then
    -- Un hermano no se da de alta a sí mismo: eso lo hace secretaría o el
    -- formulario público, que pasa por `solicitudes_alta`. Si aun así llegara
    -- aquí, entra sin nada que dé poder.
    new.cargo := null;
    new.civil := false;
    new.estado := 'Nuevo';
    new.numero := 0;
    new.cuota_al_dia := false;
    return new;
  end if;

  new.cargo := old.cargo;
  new.civil := old.civil;
  new.estado := old.estado;
  new.numero := old.numero;
  new.cuota_al_dia := old.cuota_al_dia;
  new.antiguedad := old.antiguedad;
  new.iban := old.iban;
  new.etiquetas := old.etiquetas;
  new.tutor_id := old.tutor_id;
  new.dni := old.dni;
  new.hermandad_id := old.hermandad_id;
  new.auth_user_id := old.auth_user_id;
  return new;
end $$;

drop trigger if exists hermanos_solo_personal_toca_el_cargo on hermanos;
create trigger hermanos_solo_personal_toca_el_cargo
  before insert or update on hermanos
  for each row execute function hermanos_solo_personal_toca_el_cargo();

comment on function hermanos_solo_personal_toca_el_cargo() is
  'Lista blanca de lo que un hermano puede cambiar de SU PROPIA ficha: contacto, foto, '
  'preferencias de aviso y pedir la baja. Todo lo que da poder o posición —cargo, civil, '
  'estado, numero, cuota_al_dia, antiguedad, iban, etiquetas, dni— vuelve a su valor '
  'anterior. Quien lleva el módulo hermanos o el de personal escribe la ficha entera. '
  'Revierte en vez de fallar porque la aplicación manda la fila completa en cada guardado.';


-- ----------------------------------------------------------------------------
-- 3. Quién gestiona: las tres funciones que lo deciden
-- ----------------------------------------------------------------------------

-- `auth_es_hermano()` significa «esta cuenta es SOLO de hermano», y es la que
-- abre y cierra todas las políticas de gestión (todas empiezan por
-- `not auth_es_hermano()`). Añadirle la cuarta condición es lo que hace que un
-- hermano con cargo entre al panel: se vuelve falso para él, y las ~60
-- políticas se adaptan solas sin tocar ni una.
--
-- 'Hermano de a pie' se excluye a propósito. Ese cargo no tiene módulos, así
-- que quien lo llevara se quedaría en tierra de nadie: fuera de las políticas
-- de hermano por tener cargo, y sin ningún módulo por no tener permisos. Sin
-- acceso a nada. La aplicación no lo ofrece al poner un cargo, pero si algún
-- día se cuela, aquí no hace daño.
create or replace function auth_es_hermano() returns boolean
  language sql stable security definer set search_path = public as $$
    select
      exists (select 1 from hermanos where auth_user_id = auth.uid())
      and not exists (select 1 from titulares where auth_user_id = auth.uid())
      and not exists (select 1 from personal where auth_user_id = auth.uid() and activo)
      and not exists (
        select 1 from hermanos
        where auth_user_id = auth.uid()
          and cargo is not null
          and cargo <> 'Hermano de a pie'
          and estado <> 'Baja'
      )
  $$;
grant execute on function auth_es_hermano() to anon, authenticated;

comment on function auth_es_hermano() is
  'Cierto solo si la cuenta es EXCLUSIVAMENTE de hermano: tiene ficha en el censo y '
  'no está en titulares, ni es personal activo, ni lleva cargo en su propia ficha. '
  'Hay TRES formas de gestionar: ser el titular, estar en personal, o llevar cargo '
  'en la ficha. Esta última es la nueva y la que se recomienda.';

-- `modulo_permitido()` es la que decide, módulo a módulo, quién escribe. Tercera
-- rama con `or`: las otras dos NO se tocan, porque la junta que hoy entra por
-- `personal` tiene que seguir entrando.
create or replace function modulo_permitido(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select
      es_titular()
      or exists (
        select 1 from personal p
        join permisos_cargo pc
          on pc.cargo = p.cargo and pc.hermandad_id = p.hermandad_id
        where p.auth_user_id = auth.uid() and p.activo and pc.modulo_id = p_modulo
      )
      -- NUEVO: el cargo en la ficha del hermano.
      or exists (
        select 1 from hermanos h
        join permisos_cargo pc
          -- `pc.hermandad_id = h.hermandad_id` no es opcional: los permisos de
          -- una hermandad no valen dentro de otra.
          on pc.cargo = h.cargo and pc.hermandad_id = h.hermandad_id
        where h.auth_user_id = auth.uid()
          and h.cargo is not null
          -- Un hermano de baja no sigue llevando la tesorería.
          and h.estado <> 'Baja'
          and pc.modulo_id = p_modulo
      )
  $$;
grant execute on function modulo_permitido(text) to authenticated;

comment on function modulo_permitido(text) is
  'Tres vías, sumadas con OR: el titular lo puede todo; el personal activo, lo de su '
  'cargo; y el hermano con cargo en su ficha, lo de su cargo. Hay CUATRO definiciones '
  'de esta función en el repositorio (schema.sql, rls-cargos.sql, rls-endurecer.sql y '
  'permisos-por-hermandad.sql) y la que manda es ESTA, que es la última que se ejecuta.';

-- `auth_es_personal()` responde «¿esta cuenta gestiona?». No la usa ninguna
-- política, pero la aplicación puede preguntarla por RPC y quedaría siendo el
-- único sitio del SQL que dice que un hermano con cargo no gestiona.
create or replace function auth_es_personal() returns boolean
  language sql stable security definer set search_path = public as $$
    select
      es_titular()
      or exists (select 1 from personal where auth_user_id = auth.uid() and activo)
      or exists (
        select 1 from hermanos
        where auth_user_id = auth.uid()
          and cargo is not null and cargo <> 'Hermano de a pie'
          and estado <> 'Baja'
      )
  $$;
grant execute on function auth_es_personal() to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Las políticas «propio»: que quien gestiona no pierda lo suyo
-- ----------------------------------------------------------------------------
--
-- Este es el efecto de segundo orden más caro del cambio, y el que no se ve
-- venir.
--
-- Al volverse `auth_es_hermano()` falso para el hermano con cargo, dejan de
-- aplicarle todas las políticas escritas como `auth_es_hermano() and lo mío`.
-- Casi todas quedan cubiertas por las de gestión, que abren más. Pero DOS no:
--
--   · `papeletas_propio_insert` — un Tesorero/a no tiene de fábrica el módulo
--     «papeletas», así que se quedaría sin poder sacar SU PROPIA papeleta.
--   · `cuotas_propio_aviso_pago` — ni podría avisar de que ha pagado la suya.
--
-- Y lo peor no es que falle: es que NO falla. Un insert bloqueado por RLS no
-- da error en Postgres, actualiza cero filas. La pantalla diría que todo ha ido
-- bien y la papeleta no existiría. Eso se descubre en la puerta de la iglesia
-- el Domingo de Ramos.
--
-- El arreglo es quitar el `auth_es_hermano()` de todas ellas y dejar solo la
-- comprobación de que la fila es suya. No abre nada de más: `hermano_propio_id()`
-- devuelve NULL para quien no tiene ficha, y `columna = NULL` no es cierto para
-- ninguna fila.

-- Su ficha del censo.
drop policy if exists "hermanos_propio_select" on hermanos;
create policy "hermanos_propio_select" on hermanos for select to authenticated
  using (auth_user_id = auth.uid());
-- El `cargo` y el `civil` de esta fila los protege el trigger de arriba, no
-- esta política: RLS no sabe de columnas.
drop policy if exists "hermanos_propio_update" on hermanos;
create policy "hermanos_propio_update" on hermanos for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Sus cuotas: verlas, y avisar de que ha pagado.
drop policy if exists "cuotas_propio_select" on cuotas;
create policy "cuotas_propio_select" on cuotas for select to authenticated
  using (hermano_id = hermano_propio_id());
drop policy if exists "cuotas_propio_aviso_pago" on cuotas;
create policy "cuotas_propio_aviso_pago" on cuotas for update to authenticated
  using (hermano_id = hermano_propio_id())
  with check (hermano_id = hermano_propio_id());

-- Su papeleta: verla, pedirla y renunciar a ella.
drop policy if exists "papeletas_propio_select" on papeletas;
create policy "papeletas_propio_select" on papeletas for select to authenticated
  using (hermano_id = hermano_propio_id());
drop policy if exists "papeletas_propio_insert" on papeletas;
create policy "papeletas_propio_insert" on papeletas for insert to authenticated
  with check (hermano_id = hermano_propio_id());
drop policy if exists "papeletas_propio_update" on papeletas;
create policy "papeletas_propio_update" on papeletas for update to authenticated
  using (hermano_id = hermano_propio_id())
  with check (hermano_id = hermano_propio_id());

-- Sus avisos.
drop policy if exists "avisos_propio_select" on avisos_hermano;
create policy "avisos_propio_select" on avisos_hermano for select to authenticated
  using (hermano_id = hermano_propio_id());
drop policy if exists "avisos_propio_leido" on avisos_hermano;
create policy "avisos_propio_leido" on avisos_hermano for update to authenticated
  using (hermano_id = hermano_propio_id())
  with check (hermano_id = hermano_propio_id());

-- Los suyos: los hijos menores de los que es tutor.
drop policy if exists "hermanos_a_mi_cargo_select" on hermanos;
create policy "hermanos_a_mi_cargo_select" on hermanos for select to authenticated
  using (tutor_id = hermano_propio_id());

-- Los tramos y la agenda: los ve cualquiera que haya entrado, con cargo o sin
-- él. `solo_mi_hermandad` ya se encarga de que sean los de su hermandad.
drop policy if exists "tramos_hermano_select" on tramos;
create policy "tramos_hermano_select" on tramos for select to authenticated
  using (true);
drop policy if exists "eventos_hermano_select" on eventos;
create policy "eventos_hermano_select" on eventos for select to authenticated
  using (true);


-- ----------------------------------------------------------------------------
-- 5. Borrar `authenticated_all`: el filtro por módulo estaba anulado
-- ----------------------------------------------------------------------------
--
-- Esto es un agujero que YA ESTABA, y que este cambio convierte en grave.
--
-- `hermano-auth.sql` crea sobre catorce tablas una política llamada
-- `authenticated_all` que dice solo `not auth_es_hermano()`: sin módulo, sin
-- nada. Y nadie la borra después. Las políticas PERMISSIVE de Postgres se
-- suman con O, así que basta con que una abra para que la fila pase.
--
-- Consecuencia: hasta hoy, cualquier cuenta de gestión escribía en las catorce
-- tablas por mucho que su cargo no tuviera el módulo. «El cargo decide qué
-- módulos ve» era cierto en el menú y falso en la base de datos. Con hermanos
-- llevando cargo, por ahí va a pasar mucha más gente.
--
-- Se borran. Lo que queda son las políticas `_staff_*` de `schema.sql`, que sí
-- exigen `modulo_permitido`.
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'hermandad_settings', 'tramos', 'movimientos', 'incidencias', 'enseres',
      'documentos', 'comunicados', 'cuentas_sociales', 'personal',
      'permisos_cargo', 'solicitudes_alta', 'conceptos_cuota',
      'opciones_papeleta', 'catalogos', 'hermanos', 'cuotas', 'papeletas'
    ])
  loop
    execute format('drop policy if exists "authenticated_all" on %I', t);
  end loop;
end $$;

-- Las tres hermanas de `authenticated_all`, del mismo archivo y con el mismo
-- problema: abren las tres tablas grandes sin mirar el módulo.
drop policy if exists "hermanos_personal_all" on hermanos;
drop policy if exists "cuotas_personal_all" on cuotas;
drop policy if exists "papeletas_personal_all" on papeletas;

-- Y las de gestión que sí miran el módulo, por si esta base se montó con una
-- versión antigua que no llegó a crearlas.
/*
 * LEER EL CENSO YA NO ES GRATIS, y esto es lo que más cambia de todo el
 * archivo para las hermandades que ya están funcionando.
 *
 * Hasta ahora, `hermanos_staff_select` era `not auth_es_hermano()` y nada más:
 * quien entrara al panel se llevaba el censo entero. El insert, el update y el
 * delete de al lado sí exigen el módulo; la lectura, no. Se quedó así de
 * cuando el panel lo abrían seis personas nombradas a dedo.
 *
 * Con los cargos en la ficha, «entrar al panel» deja de ser cosa de seis
 * personas nombradas a dedo: pasa a serlo de cualquiera a quien se le ponga un
 * cargo. Y a cualquiera de ellos le bastaba con escribir esto en la consola
 * del navegador, con la clave pública que viaja en el JavaScript de la web:
 *
 *     await supabase.from('hermanos').select('*')
 *
 * y bajarse las ochocientas filas con DNI, dirección, teléfono, IBAN, notas de
 * salud, fecha de nacimiento y parroquia de bautismo. Salud y convicciones
 * religiosas: categoría especial del RGPD por partida doble. El menú no le
 * enseñaba «Hermanos» y la aplicación le rebotaba a Inicio si tecleaba la
 * dirección, pero eso era pintura: la puerta de la base estaba abierta.
 *
 * Ahora hace falta uno de los módulos que de verdad necesitan el censo. No
 * solo «hermanos»: Cuotas necesita saber a quién es el recibo, Cortejo a quién
 * es el sitio, Papeletas a quién es la papeleta, e Informes imprime el padrón.
 *
 * LO QUE ESTO CAMBIA EN PANTALLA: nada, si la hermandad usa los cargos de
 * fábrica. Los SIETE de la junta llevan al menos uno de esos módulos —el
 * Fiscal y el Vocal entran por «informes», el Tesorero/a por «cuotas», el
 * Mayordomo/Prioste por «cortejo»— así que ninguno pierde nada.
 *
 * Solo cambia para un cargo al que se le hayan quitado a mano TODOS ellos y se
 * le hayan dejado únicamente módulos que no necesitan el censo (tesorería,
 * inventario, archivo, eventos, web o configuración). Ese caso es raro, y es
 * justo el que había que cerrar: no hay razón para que quien lleva el
 * inventario pueda descargarse ochocientos DNI.
 *
 * Hay una prueba (pruebas/cargos.prueba.mjs) que comprueba que ningún cargo de
 * fábrica se queda fuera, para que ampliar la lista de módulos de un cargo no
 * le corte el censo sin querer.
 */
drop policy if exists "hermanos_staff_select" on hermanos;
create policy "hermanos_staff_select" on hermanos for select to authenticated
  using (
    not auth_es_hermano()
    and (
      modulo_permitido('hermanos')
      or modulo_permitido('cuotas')
      or modulo_permitido('papeletas')
      or modulo_permitido('cortejo')
      or modulo_permitido('informes')
      or modulo_permitido('comunicados')
      -- «Personal y permisos» también: es la pantalla que enseña qué hermanos
      -- llevan cargo, y sin leer el censo saldría vacía.
      or modulo_permitido('personal')
    )
  );
drop policy if exists "hermanos_staff_insert" on hermanos;
create policy "hermanos_staff_insert" on hermanos for insert to authenticated
  with check (not auth_es_hermano() and modulo_permitido('hermanos'));
drop policy if exists "hermanos_staff_update" on hermanos;
create policy "hermanos_staff_update" on hermanos for update to authenticated
  using (not auth_es_hermano() and modulo_permitido('hermanos'))
  with check (not auth_es_hermano() and modulo_permitido('hermanos'));
drop policy if exists "hermanos_staff_delete" on hermanos;
create policy "hermanos_staff_delete" on hermanos for delete to authenticated
  using (not auth_es_hermano() and modulo_permitido('hermanos'));


-- ----------------------------------------------------------------------------
-- 5 bis. Las otras dos tablas que cualquiera podía leer
-- ----------------------------------------------------------------------------
--
-- Mismo problema que el censo, misma causa: las políticas de LECTURA de todas
-- las tablas de gestión son `not auth_es_hermano()` a secas. Solo la escritura
-- mira el módulo.
--
-- En la mayoría de las tablas eso es discutible pero no grave: un Vocal
-- leyendo la lista de enseres o los tramos del cortejo no rompe nada. En dos
-- sí lo es, y son justo las dos que guardan lo que una hermandad no enseña:
--
--   · `movimientos` — el libro de tesorería entero, ingresos y gastos con sus
--     conceptos. Lo que se cobra, lo que se paga y a quién.
--   · `documentos` — el archivo: actas de cabildo, contratos, expedientes.
--
-- Las escrituras ya pedían su módulo. Ahora la lectura también.
drop policy if exists "movimientos_staff_select" on movimientos;
create policy "movimientos_staff_select" on movimientos for select to authenticated
  using (not auth_es_hermano() and (modulo_permitido('tesoreria') or modulo_permitido('informes')));

drop policy if exists "documentos_staff_select" on documentos;
create policy "documentos_staff_select" on documentos for select to authenticated
  using (not auth_es_hermano() and modulo_permitido('archivo'));


-- ----------------------------------------------------------------------------
-- 6. Los permisos de fábrica, al día
-- ----------------------------------------------------------------------------
--
-- La aplicación y la base decían cosas distintas, y llevaban así desde que se
-- añadió el módulo de eventos. `PERMISOS_POR_DEFECTO` (src/lib/permisos.ts) da
-- al Hermano Mayor los TRECE módulos; la siembra de la base le daba once: le
-- faltaban «eventos» y «web».
--
-- El síntoma era de los peores: el menú enseña «Eventos y tareas», se entra, se
-- crea un culto, se le da a guardar, no se guarda y no hay ningún mensaje. La
-- política dice que no y la pantalla no se entera.
--
-- Esta siembra es ahora la copia exacta de PERMISOS_POR_DEFECTO. Si se cambia
-- una, hay que cambiar la otra; hay una prueba que lo comprueba
-- (pruebas/roles.prueba.mjs) para que no vuelva a separarse.
create or replace function sembrar_permisos_de_fabrica(p_hermandad_id uuid) returns void
  language sql security definer set search_path = public as $$
    insert into permisos_cargo (hermandad_id, cargo, modulo_id)
    select p_hermandad_id, cargo, modulo_id from (values
      ('Hermano Mayor','hermanos'),('Hermano Mayor','cortejo'),('Hermano Mayor','cuotas'),
      ('Hermano Mayor','papeletas'),('Hermano Mayor','tesoreria'),('Hermano Mayor','inventario'),
      ('Hermano Mayor','archivo'),('Hermano Mayor','eventos'),('Hermano Mayor','comunicados'),
      ('Hermano Mayor','informes'),('Hermano Mayor','web'),('Hermano Mayor','personal'),
      ('Hermano Mayor','configuracion'),('Hermano Mayor','campanas'),
      ('Secretario/a','hermanos'),('Secretario/a','cortejo'),('Secretario/a','papeletas'),
      ('Secretario/a','archivo'),('Secretario/a','eventos'),('Secretario/a','comunicados'),
      ('Secretario/a','informes'),('Secretario/a','web'),('Secretario/a','campanas'),
      ('Tesorero/a','tesoreria'),('Tesorero/a','cuotas'),('Tesorero/a','inventario'),
      ('Tesorero/a','informes'),('Tesorero/a','campanas'),
      ('Fiscal','archivo'),('Fiscal','informes'),
      ('Mayordomo/Prioste','cortejo'),('Mayordomo/Prioste','inventario'),
      ('Mayordomo/Prioste','eventos'),('Mayordomo/Prioste','informes'),
      ('Mayordomo/Prioste','campanas'),
      ('Diputado/a Mayor de Gobierno','hermanos'),('Diputado/a Mayor de Gobierno','cortejo'),
      ('Diputado/a Mayor de Gobierno','papeletas'),('Diputado/a Mayor de Gobierno','eventos'),
      ('Diputado/a Mayor de Gobierno','informes'),
      ('Vocal','eventos'),('Vocal','comunicados'),('Vocal','informes')
    ) as f(cargo, modulo_id)
    on conflict do nothing
  $$;
revoke execute on function sembrar_permisos_de_fabrica(uuid) from public;
revoke execute on function sembrar_permisos_de_fabrica(uuid) from anon, authenticated;

-- 'Hermano de a pie' no se siembra a propósito: no tiene módulos. Ponérselo a
-- alguien sería darle una cuenta de panel que no ve nada.

-- Y se rellena lo que falte en las hermandades que ya existen. `on conflict do
-- nothing` dentro de la función: lo que cada hermandad haya cambiado a mano se
-- respeta, esto solo añade lo que nunca estuvo.
/*
 * Y se rellena SOLO en las hermandades que no han tocado nunca sus permisos.
 *
 * El `on conflict do nothing` de dentro no basta, y esto es importante:
 * `guardarPermisosPorCargoRemoto` guarda borrando las filas y reinsertando
 * solo lo marcado, así que un módulo DESMARCADO es una fila ausente —
 * exactamente igual que un módulo que nunca estuvo. La siembra no puede
 * distinguirlos.
 *
 * Sin esta comprobación, una hermandad que le hubiera quitado «cuotas» al
 * Tesorero/a a propósito se lo encontraría puesto otra vez cada vez que
 * alguien vuelve a ejecutar el SQL — y la cabecera promete que ejecutarlo dos
 * veces es seguro. Nadie recibiría ningún aviso.
 */
do $$
declare h uuid;
begin
  for h in select id from hermandades loop
    if not exists (select 1 from permisos_cargo where hermandad_id = h) then
      perform sembrar_permisos_de_fabrica(h);
    end if;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 7. Aviso para quien venga después
-- ----------------------------------------------------------------------------
--
-- SECURITY DEFINER no se salta las políticas por sí solo. Funciona porque el
-- dueño de estas funciones (`postgres`) es también el dueño de las tablas, y el
-- dueño de una tabla está exento de sus políticas MIENTRAS no se active
-- `force row level security`.
--
-- Varias guías de endurecimiento de Supabase recomiendan activarlo. Si alguien
-- ejecuta `alter table hermanos force row level security`, TODAS estas
-- funciones entran en recursión infinita de golpe: `auth_es_hermano()` lee
-- `hermanos`, cuya política llama a `auth_es_hermano()`. Lo mismo con
-- `hermandad_actual()`, `hermano_propio_id()` y el `modulo_permitido()` de
-- aquí arriba.
--
-- Si hace falta activarlo algún día, hay que crear antes un rol propio para
-- estas funciones y darle `bypassrls`.

-- =============================================================================
--   CLAVE-DE-CATALOGOS.SQL — Que cada hermandad tenga sus propios catálogos (la clave era global)
-- =============================================================================

-- =============================================================================
--   CLAVE-DE-CATALOGOS.SQL — Que cada hermandad tenga sus propios catálogos
-- =============================================================================
--
-- EL MISMO FALLO QUE `redes-sociales.sql`, en la otra tabla que se quedó
-- fuera. Y aquí es peor, porque `catalogos` se toca mucho más.
--
-- La tabla nació con `primary key (clave, valor)`. Esa clave es GLOBAL. Al
-- pasar a varias hermandades se le añadió `hermandad_id` como a todas las
-- demás, pero la clave se quedó igual — a diferencia del DNI del hermano, del
-- número de hermano, de los ajustes, de la web y de las redes, que sí se
-- arreglaron en su día.
--
-- LO QUE HAY EN ESA TABLA son las listas que configura cada hermandad en
-- Configuración: las categorías de ingreso y de gasto, las cuentas de
-- tesorería, los tipos de incidencia, las categorías del inventario, los
-- canales y los segmentos de los comunicados.
--
-- Y son las MENOS DISTINTIVAS QUE HAY. «Cera», «Flores», «Limosnas»,
-- «Caja», «Bueno», «Restaurado»: las escribe igual todo el mundo, porque son
-- las palabras de siempre de una hermandad. O sea que la SEGUNDA hermandad que
-- entrara no podía guardar prácticamente ninguna de las suyas: la fila ya
-- existía, de otra gente, y el guardado se estrellaba contra una clave
-- duplicada.
--
-- No es un caso raro que aparezca con el tiempo. Aparece con la hermandad
-- número dos y con el primer valor obvio que escriba.
--
-- Y encima no se ve venir: por la frontera de seguridad
-- (`hermandad_id = hermandad_actual()`), la fila que estorba es de otra
-- hermandad y por tanto INVISIBLE. En pantalla no hay nada repetido, y aun así
-- no se puede guardar.
--
-- Se puede ejecutar sobre una base ya en uso. No borra ningún catálogo de
-- ninguna hermandad.

-- 1. La columna y su valor por defecto (por si esta base es anterior).
alter table catalogos add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table catalogos alter column hermandad_id set default hermandad_actual();

-- 2. La clave, por hermandad y no global.
--
--    En dos pasos y con aviso en vez de romper: una clave primaria no admite
--    nulos, así que primero se le busca dueño a lo que hubiera suelto de antes
--    de multi-hermandad —se le da a la primera hermandad, que es de quien era—
--    y solo si no queda nada huérfano se cambia la clave. Si quedara algo, se
--    deja como estaba y se avisa: es preferible eso a que la instalación se
--    pare a la mitad y todo lo que va detrás no llegue a crearse.
do $$
declare v_huerfanos int;
begin
  update catalogos set hermandad_id = (select id from hermandades order by creada_en limit 1)
   where hermandad_id is null;

  select count(*) into v_huerfanos from catalogos where hermandad_id is null;
  if v_huerfanos > 0 then
    -- Pasa si la base no tiene ninguna hermandad todavía. Entonces tampoco hay
    -- catálogos de nadie que arreglar, y esto se vuelve a ejecutar solo con
    -- correr el archivo otra vez después de crear la primera.
    raise warning 'catalogos: quedan % filas sin hermandad; la clave primaria se deja como estaba', v_huerfanos;
    return;
  end if;

  alter table catalogos alter column hermandad_id set not null;
  alter table catalogos drop constraint if exists catalogos_pkey;
  alter table catalogos add constraint catalogos_pkey primary key (hermandad_id, clave, valor);
end $$;

comment on table catalogos is
  'Las listas que configura cada hermandad (categorías, cuentas, tipos…). La '
  'clave es (hermandad_id, clave, valor): con la clave global de antes, la '
  'segunda hermandad no podía guardar ni «Cera», porque la fila ya era de otra '
  'y encima no la veía.';

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Después de ejecutarlo, esto tiene que decir «hermandad_id, clave, valor»:
--
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'catalogos'::regclass and contype = 'p';
--
-- Si sigue diciendo solo «clave, valor», es que quedaban filas sin hermandad:
-- míralas con
--
--   select * from catalogos where hermandad_id is null;
--
-- y vuelve a ejecutar este archivo cuando estén asignadas.

-- =============================================================================
--   IMAGENES.SQL — El almacén de fotos: que la web no lleve las imágenes dentro
-- =============================================================================

-- ============================================================================
-- EL ALMACÉN DE IMÁGENES
--
-- Hasta ahora las fotos de la web viajaban DENTRO del contenido, escritas como
-- texto (`data:image/webp;base64,...`). Funciona, pero tiene tres techos:
--
--   1. La web entera es una sola fila de la tabla `web_publica`. Veinte fotos
--      de una salida y esa fila pesa quince megas: cada guardado los sube
--      enteros otra vez, y cada visita los descarga enteros aunque no cambie
--      ni una coma.
--   2. El navegador no puede guardar en caché una foto que va dentro del HTML.
--      La misma imagen se descarga en cada página.
--   3. Y lo que bloqueaba de verdad: WhatsApp, Facebook y X NO leen una
--      imagen en `data:`. Por eso al pegar el enlace de la hermandad salía la
--      tarjeta sin foto. Para que salga tiene que haber una dirección de
--      verdad, y para eso hace falta esto.
--
-- Ejecútalo UNA VEZ en el SQL Editor de tu proyecto, después de
-- `multi-hermandad.sql` (de ahí sale `hermandad_actual()`).
--
-- CADA HERMANDAD, EN SU CARPETA. Todas comparten el mismo cubo, así que lo
-- primero de la ruta es el id de la hermandad:
--
--     imagenes/6f3a…-e21b/web/9c1d…-4a7f.webp
--
-- No es orden: es la seguridad. Las políticas de abajo miran esa primera
-- carpeta para decidir quién puede escribir. Una foto subida fuera de ella la
-- rechaza el propio Storage.
--
-- POR QUÉ EL CUBO ES PÚBLICO. Lo que hay dentro son las fotos de la web de la
-- hermandad: están puestas para que las vea todo el mundo, y la tarjeta de
-- WhatsApp no funciona de otra manera. Las fotos del CENSO también viven aquí,
-- bajo `hermanos/`, con un nombre aleatorio de 128 bits que no aparece en
-- ninguna página pública. La alternativa —cubo privado y direcciones firmadas—
-- obligaría a resolver cada foto con una llamada al servidor antes de
-- pintarla, caduca a las horas y rompe el carné impreso. Si algún día una
-- hermandad necesita lo otro, el sitio donde se cambia es este archivo y
-- `src/lib/almacenImagenes.ts`, no las cincuenta pantallas que enseñan fotos.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('imagenes', 'imagenes', true)
on conflict (id) do update set public = true;

-- LEER: cualquiera. Es una web pública; el cubo lo sirve sin pasar por aquí,
-- pero la política se deja escrita para que no dependa de una casilla del
-- panel de Supabase que alguien puede desmarcar sin querer.
drop policy if exists "imagenes_leer" on storage.objects;
create policy "imagenes_leer" on storage.objects
  for select
  to public
  using (bucket_id = 'imagenes');

-- ESCRIBIR: solo con sesión iniciada, y solo dentro de la carpeta de tu
-- hermandad. Es lo que impide que una hermandad pise las fotos de otra.
drop policy if exists "imagenes_subir" on storage.objects;
create policy "imagenes_subir" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  );

drop policy if exists "imagenes_actualizar" on storage.objects;
create policy "imagenes_actualizar" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  )
  with check (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  );

drop policy if exists "imagenes_borrar" on storage.objects;
create policy "imagenes_borrar" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  );

-- =============================================================================
--   VISITAS-WEB.SQL — El contador de visitas de la web, sin cookies ni Google Analytics
-- =============================================================================

-- =============================================================================
--   EL CONTADOR DE VISITAS DE LA WEB
-- =============================================================================
--
-- «¿Entra alguien en la web?» es la primera pregunta que hace una hermandad
-- después de publicarla, y hasta ahora no había forma de contestarla.
--
-- POR QUÉ NO GOOGLE ANALYTICS. Porque obliga a poner el cartel de las cookies.
-- Una web de hermandad que recibe cien visitas al mes no necesita pagar ese
-- precio: el cartel molesta a todo el que entra, hay que mantenerlo al día, y
-- convierte una web sencilla en algo que pide permiso antes de enseñar nada.
--
-- Esto cuenta VISITAS A PÁGINAS y nada más:
--
--   · NO guarda la dirección IP.
--   · NO pone cookies ni nada parecido.
--   · NO sigue a nadie entre páginas ni entre días.
--   · NO se puede saber quién ha entrado, ni volver atrás y averiguarlo.
--
-- Lo que se guarda es un número por día y por página: «el 14 de marzo, la
-- portada tuvo 43 visitas». Eso no son datos personales, así que no hace falta
-- ni cartel ni consentimiento. Y es lo que de verdad se quiere saber.
--
-- LO QUE NO PUEDE DECIR, y conviene tenerlo claro antes de mirar los números:
-- no sabe cuántas PERSONAS distintas han entrado. Sin seguir a nadie no se
-- puede, y prefiero un número honesto a uno inventado. Cuenta visitas a
-- páginas: si la misma persona abre tres, son tres.
--
-- Ejecútalo una vez en el SQL Editor, después de `multi-hermandad.sql`.
-- =============================================================================

create table if not exists visitas_web (
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  -- El día, en hora de España. Lo pone el servidor: fiarse de la fecha que
  -- mande el navegador es dejar que cualquiera escriba en el día que quiera.
  dia date not null,
  /*
   * Qué página. Se guarda la RUTA, nunca la dirección entera: la dirección
   * puede traer pegado detrás lo que sea —el `?utm_...` de una campaña, el
   * texto que alguien buscó— y eso ya no es «qué página se vio».
   */
  ruta text not null,
  visitas integer not null default 0,
  primary key (hermandad_id, dia, ruta)
);

create index if not exists visitas_web_dia_idx on visitas_web (hermandad_id, dia desc);

alter table visitas_web enable row level security;

/*
 * NADIE ESCRIBE AQUÍ A MANO, ni siquiera para sumar uno.
 *
 * Con una política de INSERT abierta —como la del buzón de mensajes— cualquiera
 * con la clave pública podría meter cien mil filas y reventar la tabla, o
 * inflar el contador de una hermandad hasta que sus números no valgan nada.
 *
 * Se entra por la función de abajo, que solo sabe hacer una cosa: sumar uno.
 */
drop policy if exists "las visitas se leen desde el panel" on visitas_web;
create policy "las visitas se leen desde el panel"
  on visitas_web for select
  to authenticated
  using (hermandad_id = hermandad_actual() and not auth_es_hermano());

/**
 * Suma una visita. Es lo único que se puede hacer desde fuera.
 *
 * `security definer` para poder escribir en una tabla que no deja escribir a
 * nadie, y `search_path` fijado para que nadie pueda colar otra tabla con el
 * mismo nombre por delante.
 */
/*
 * Y QUE NO CREZCA PARA SIEMPRE. Una hermandad con veinte páginas genera unas
 * 7.000 filas al año; en diez años, setenta mil, para enseñar un gráfico de los
 * últimos treinta días. Se guardan DOS AÑOS, que es lo que hace falta para
 * comparar una Semana Santa con la anterior, y lo de antes se tira.
 *
 * La lanza `pg_cron` los domingos de madrugada — ver
 * `supabase/tareas-programadas.sql`, que hay que ejecutar aparte porque
 * primero hay que encender la extensión en el panel de Supabase.
 */
create or replace function limpiar_visitas_viejas() returns void
language sql security definer set search_path = public as $$
  delete from visitas_web where dia < current_date - interval '2 years'
$$;
revoke execute on function limpiar_visitas_viejas() from public, anon, authenticated;

create or replace function contar_visita(p_hermandad_id uuid, p_ruta text)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_ruta text;
  v_dia date;
  v_distintas int;
begin
  if p_hermandad_id is null then return; end if;
  if not exists (select 1 from hermandades where id = p_hermandad_id) then return; end if;

  v_ruta := split_part(split_part(coalesce(p_ruta, '/'), '?', 1), '#', 1);
  if v_ruta = '' or left(v_ruta, 1) <> '/' then v_ruta := '/'; end if;
  v_ruta := left(v_ruta, 200);

  -- La fecha, de este lado y en hora de España: con la del navegador, quien
  -- tenga el reloj mal —o quien quiera— escribe en el día que le apetezca.
  v_dia := (now() at time zone 'Europe/Madrid')::date;

  -- Si esta ruta ya se contó hoy no hay nada que mirar: la fila existe y solo
  -- se le suma uno. El tope solo importa cuando iría a crear una fila nueva.
  if not exists (select 1 from visitas_web
                  where hermandad_id = p_hermandad_id and dia = v_dia and ruta = v_ruta) then
    select count(*) into v_distintas from visitas_web
     where hermandad_id = p_hermandad_id and dia = v_dia;
    if v_distintas >= 300 then v_ruta := '/otras'; end if;
  end if;

  insert into visitas_web (hermandad_id, dia, ruta, visitas)
  values (p_hermandad_id, v_dia, v_ruta, 1)
  on conflict (hermandad_id, dia, ruta)
  do update set visitas = visitas_web.visitas + 1;
end $$;
grant execute on function contar_visita(uuid, text) to anon, authenticated;

comment on function contar_visita(uuid, text) is
  'Suma una visita a una página de la web pública. No guarda IP, ni cookies, ni '
  'nada que identifique a nadie: solo un número por día y por ruta.';

-- =============================================================================
--   SUSCRIPTORES-WEB.SQL — Avisos por correo para quien sigue a la hermandad sin ser hermano
-- =============================================================================

-- =============================================================================
--   AVISADME DE LOS CULTOS — quien sigue a la hermandad sin ser hermano
-- =============================================================================
--
-- Alrededor de una hermandad hay mucha más gente que hermanos: vecinos del
-- barrio, devotos, gente que se crió allí y vive fuera, quien va todos los años
-- a ver la salida. Toda esa gente se entera de los cultos por casualidad —o no
-- se entera— porque los avisos van al censo y ellos no están en el censo.
--
-- Y NO SE LES PUEDE METER EN EL CENSO. Un censo es la lista de hermanos y de
-- ahí cuelgan las cuotas, las papeletas y la antigüedad. Meter a un vecino ahí
-- para poder avisarle rompe el censo y le da una condición que no tiene.
--
-- Esto es una lista aparte: un correo y poco más.
--
-- LO QUE EXIGE EL RGPD, y por qué está cada cosa:
--
--   · CONSENTIMIENTO EXPRESO. Una casilla que hay que marcar a mano —nunca
--     premarcada— y se guarda QUÉ texto aceptó y CUÁNDO. Sin eso, si algún día
--     alguien reclama, la hermandad no puede demostrar nada.
--   · CONFIRMAR EL CORREO. Sin confirmar, cualquiera apunta el correo de otro:
--     se le manda un enlace y hasta que no lo abre no se le escribe. Además es
--     lo que evita que los envíos de la hermandad acaben en spam.
--   · DARSE DE BAJA DE UN CLIC. Cada suscriptor lleva su propia llave, y con
--     ella se borra solo, sin escribir a nadie ni dar explicaciones.
--
-- Ejecútalo una vez en el SQL Editor, después de `multi-hermandad.sql`.
-- =============================================================================

/*
 * LA LLAVE DE BAJA NO NECESITA NINGUNA EXTENSIÓN, Y ESO ES A PROPÓSITO.
 *
 * Salía de `gen_random_bytes`, que es de `pgcrypto`. Y un `default` de columna
 * se resuelve AL CREAR LA TABLA, con el `search_path` que haya en ese momento:
 * en Supabase pgcrypto vive en el esquema `extensions`, así que la tabla no se
 * podía ni crear —«function gen_random_bytes(integer) does not exist»— y el
 * fichero entero se paraba ahí.
 *
 * `gen_random_uuid()` viene con Postgres desde la 13, sin extensiones. Dos
 * seguidos dan 64 caracteres al azar, que es más de lo que hacía falta.
 *
 * La llave sirve para dos cosas —confirmar y darse de baja— y es lo único que
 * hace falta saber para las dos: por eso va en la dirección del correo y por
 * eso es larga. Con un id normal, cualquiera que probara identificadores podría
 * dar de baja a otro; con esto no hay nada que probar.
 */
create extension if not exists pgcrypto;

create table if not exists suscriptores_web (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  email text not null,
  nombre text not null default '',

  /*
   * LA LLAVE. Sirve para dos cosas —confirmar y darse de baja— y es lo único
   * que hace falta saber para las dos: por eso va en la dirección del correo
   * que se le manda y por eso es larga y al azar.
   *
   * Con un id normal, cualquiera que probara identificadores podría dar de baja
   * a otro. Con esto, no hay nada que probar.
   */
  -- `gen_random_uuid()` es de Postgres a secas desde la 13: no hace falta
  -- ninguna extensión, y por eso este `default` se puede resolver siempre.
  -- Dos seguidos, sin guiones, son 64 caracteres al azar — de sobra para lo
  -- que hace falta, y sin depender de dónde esté instalada pgcrypto.
  llave text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),

  -- Hasta que no abre el enlace del correo, no se le escribe.
  confirmado boolean not null default false,
  confirmado_en timestamptz,

  -- Qué aceptó exactamente y cuándo. Es la prueba del consentimiento.
  texto_aceptado text not null default '',
  alta_en timestamptz not null default now(),

  -- De dónde salió: «web», «formulario de contacto»… Para saber qué funciona.
  origen text not null default 'web'
);

-- Un correo, una vez por hermandad. Sin esto, quien pulsa dos veces el botón
-- acaba recibiendo cada aviso por duplicado.
/*
 * CUÁNDO SE LE MANDÓ EL CORREO DE CONFIRMAR.
 *
 * No es informativo: es el freno. Sin él, pedir «mándame la confirmación» mil
 * veces con el correo de otro le llena la bandeja a esa persona, firmado por la
 * hermandad. Con él, del segundo intento en diez minutos no sale nada.
 */
alter table suscriptores_web
  add column if not exists confirmacion_enviada_en timestamptz;

create unique index if not exists suscriptores_web_email_uniq
  on suscriptores_web (hermandad_id, lower(email));
create index if not exists suscriptores_web_hermandad_idx on suscriptores_web (hermandad_id);

alter table suscriptores_web enable row level security;

/*
 * NADIE ESCRIBE AQUÍ DIRECTAMENTE, ni siquiera para apuntarse.
 *
 * Con un INSERT abierto —como el del buzón de mensajes— la lista sería una
 * puerta para meter mil correos de golpe, y sobre todo se podría LEER lo que
 * otro acaba de escribir si alguien afina la consulta. Una lista de correos es
 * exactamente lo que busca quien manda spam.
 *
 * Se entra por las tres funciones de abajo, que hacen una cosa cada una.
 */
drop policy if exists "la hermandad ve sus suscriptores" on suscriptores_web;
create policy "la hermandad ve sus suscriptores"
  on suscriptores_web for select
  to authenticated
  using (hermandad_id = hermandad_actual() and not auth_es_hermano());

drop policy if exists "la hermandad borra sus suscriptores" on suscriptores_web;
create policy "la hermandad borra sus suscriptores"
  on suscriptores_web for delete
  to authenticated
  using (hermandad_id = hermandad_actual() and not auth_es_hermano());

/**
 * Apuntarse. DEVUELVE SÍ O NO, y nunca la llave.
 *
 * ANTES DEVOLVÍA LA LLAVE, y ese era el agujero. La llave es lo único que hace
 * falta para confirmar un alta (`confirmar_suscripcion`) y para darla de baja
 * (`baja_de_la_web`), y esta función la puede llamar cualquiera desde fuera sin
 * identificarse. Pero es que además, por el `on conflict … returning`, cuando
 * el correo YA ESTABA no devolvía una llave nueva: devolvía LA DE ESA PERSONA.
 *
 * O sea, que con la dirección de alguien de la lista —que no es ningún
 * secreto— se podía:
 *
 *   · CONFIRMAR SU ALTA sin que llegara a ver el correo. Y entonces la
 *     hermandad tiene apuntado «esta persona confirmó tal día», que es la
 *     prueba del consentimiento, y es falsa. La hermandad se pone a escribirle
 *     a alguien que nunca pidió nada, con un papel que dice que sí.
 *   · O DARLE DE BAJA. Una dirección detrás de otra, y la lista se vacía sin
 *     que nadie se entere: los suscriptores dejan de recibir los cultos y la
 *     hermandad no ve más que una lista que mengua.
 *
 * La llave se queda dentro de la base. Sale por dos sitios y solo por dos: el
 * correo que se le manda a esa persona, y el panel de la hermandad.
 *
 * SIGUE SIN DECIR SI EL CORREO YA ESTABA. Contestar «ese correo ya está
 * apuntado» le diría a cualquiera quién está en la lista, y eso es filtrar los
 * datos de otro. Devuelve `true` en los dos casos.
 */
drop function if exists suscribirse_a_la_web(uuid, text, text, text);
create or replace function suscribirse_a_la_web(
  p_hermandad_id uuid,
  p_email text,
  p_nombre text default '',
  p_texto text default ''
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_recientes int;
begin
  if p_hermandad_id is null then return false; end if;
  if not exists (select 1 from hermandades where id = p_hermandad_id) then return false; end if;

  v_email := lower(trim(coalesce(p_email, '')));
  -- Una comprobación mínima, del lado de acá. La de verdad la hace el correo de
  -- confirmación: si la dirección no existe, nunca se confirma.
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then return false; end if;

  /*
   * EL FRENO. Esto lo llama cualquiera sin identificarse, así que sin un tope
   * se le pueden meter cien mil correos a una hermandad en una tarde: la lista
   * queda inservible y hay que borrarla entera a mano.
   *
   * Sesenta altas nuevas por hora es mucho más de lo que da de sí el
   * formulario de una hermandad, incluso el día siguiente a la salida. Se
   * cuentan solo las NUEVAS: quien vuelve a apuntarse con un correo que ya
   * estaba no crea fila y no gasta cupo.
   */
  select count(*) into v_recientes from suscriptores_web
   where hermandad_id = p_hermandad_id and alta_en > now() - interval '1 hour';
  if v_recientes >= 60 then
    raise exception 'Ahora mismo no se pueden recoger más altas. Inténtalo dentro de un rato.'
      using errcode = 'P0001';
  end if;

  insert into suscriptores_web (hermandad_id, email, nombre, texto_aceptado)
  values (p_hermandad_id, v_email, left(trim(coalesce(p_nombre, '')), 120), left(coalesce(p_texto, ''), 1000))
  on conflict (hermandad_id, lower(email))
  -- Sin cambiar nada de lo que ya había: ni el consentimiento, ni la fecha de
  -- alta, ni si estaba confirmado. Volver a apuntarse no puede borrar la prueba
  -- de cuándo aceptó.
  do update set email = suscriptores_web.email;

  return true;
end $$;
grant execute on function suscribirse_a_la_web(uuid, text, text, text) to anon, authenticated;

/**
 * LA LLAVE PARA EL CORREO DE CONFIRMAR — y solo para el servidor.
 *
 * Esta es la única puerta por la que la llave sale de la base hacia quien
 * manda el correo, y NO SE LE DA A `anon` NI A `authenticated`: solo a
 * `service_role`, que es la clave que vive dentro de la función `enviar-correo`
 * y nunca pisa un navegador. Si algún día alguien le da el permiso a `anon`,
 * vuelve el agujero entero.
 *
 * Devuelve null —y no manda nada— en tres casos:
 *
 *   · Ese correo no está apuntado en esa hermandad. Sin esto, sería una forma
 *     de preguntar «¿está fulano en vuestra lista?».
 *   · Ya está confirmado. No hay nada que confirmar y mandarlo otra vez es
 *     spam.
 *   · Se le mandó hace menos de diez minutos. Es el freno de verdad: sin él,
 *     pedir la confirmación mil veces con el correo de otra persona le llena la
 *     bandeja, y firmado por la hermandad.
 *
 * Deja apuntado el envío en la misma consulta, así que dos peticiones a la vez
 * no consiguen dos correos.
 */
create or replace function llave_para_confirmar(p_hermandad_id uuid, p_email text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_llave text;
  v_nombre text;
begin
  if p_hermandad_id is null then return null; end if;
  update suscriptores_web
     set confirmacion_enviada_en = now()
   where hermandad_id = p_hermandad_id
     and lower(email) = lower(trim(coalesce(p_email, '')))
     and not confirmado
     and (confirmacion_enviada_en is null or confirmacion_enviada_en < now() - interval '10 minutes')
  returning llave into v_llave;
  if v_llave is null then return null; end if;

  -- El nombre va en el mismo viaje. Quien manda el correo lo necesita para
  -- firmarlo, y una segunda consulta para leer un nombre es una pieza más que
  -- se puede caer justo entre las dos.
  select nombre into v_nombre from hermandades where id = p_hermandad_id;
  return jsonb_build_object('llave', v_llave, 'hermandad', coalesce(v_nombre, ''));
end $$;
revoke all on function llave_para_confirmar(uuid, text) from public, anon, authenticated;
grant execute on function llave_para_confirmar(uuid, text) to service_role;

/** Confirmar, con la llave del enlace. Decir si ha valido o no. */
create or replace function confirmar_suscripcion(p_llave text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hay boolean;
begin
  update suscriptores_web
     set confirmado = true,
         -- Solo la primera vez: si vuelve a abrir el enlace del correo dentro
         -- de un año, la fecha buena sigue siendo la de entonces.
         confirmado_en = coalesce(confirmado_en, now())
   where llave = p_llave
  returning true into v_hay;
  return coalesce(v_hay, false);
end $$;
grant execute on function confirmar_suscripcion(text) to anon, authenticated;

/**
 * Darse de baja. Se BORRA la fila, no se marca.
 *
 * Guardar «este pidió la baja» obliga a seguir teniendo su correo para
 * acordarse de no escribirle, que es justo lo contrario de lo que ha pedido. Si
 * algún día vuelve, se apunta otra vez.
 */
create or replace function baja_de_la_web(p_llave text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hay boolean;
begin
  delete from suscriptores_web where llave = p_llave returning true into v_hay;
  return coalesce(v_hay, false);
end $$;
grant execute on function baja_de_la_web(text) to anon, authenticated;

-- =============================================================================
--   COPIAS.SQL — Las copias de seguridad, guardadas solas cada semana
-- =============================================================================

-- =============================================================================
--   LAS COPIAS DE SEGURIDAD, GUARDADAS SOLAS
-- =============================================================================
--
-- Hasta ahora la copia había que descargarla a mano. Funciona el día que
-- alguien se acuerda, y el problema es que nadie se acuerda: se pulsa el botón
-- la semana que se monta todo y no se vuelve a pulsar en dos años.
--
-- Y el censo de una hermandad es EL dato que no se puede volver a escribir.
-- Cuatrocientas fichas con su antigüedad, su cuota y su sitio en el cortejo no
-- se reconstruyen: o están, o se han perdido.
--
-- Esto es un cubo donde la aplicación deja una copia cada semana, sola.
--
-- POR QUÉ UN CUBO PRIVADO Y NO EL DE LAS IMÁGENES. Porque una copia lleva el
-- censo entero: nombres, DNI, teléfonos, direcciones, IBAN y datos de salud.
-- Es lo más sensible que hay en toda la aplicación. El cubo de las imágenes es
-- público —tiene que serlo, para que WhatsApp lea las fotos— y aquí eso sería
-- publicar el censo de la hermandad en internet.
--
-- Ejecútalo una vez en el SQL Editor, después de `multi-hermandad.sql`.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('copias', 'copias', false)
on conflict (id) do update set public = false;

/*
 * CADA HERMANDAD, EN SU CARPETA, y solo la suya.
 *
 * Es la misma regla que el archivo documental, pero aquí importa más: quien
 * pudiera leer la carpeta de otra hermandad se llevaría su censo completo de
 * una sola descarga.
 *
 * Y NO LO VE UN HERMANO. `auth_es_hermano()` fuera: el hermano entra en su área
 * a ver SU ficha, no el censo de los demás en un archivo.
 */
drop policy if exists "copias_leer" on storage.objects;
create policy "copias_leer" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'copias'
    and (storage.foldername(name))[1] = hermandad_actual()::text
    and not auth_es_hermano()
  );

drop policy if exists "copias_guardar" on storage.objects;
create policy "copias_guardar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'copias'
    and (storage.foldername(name))[1] = hermandad_actual()::text
    and not auth_es_hermano()
  );

/*
 * BORRAR SÍ, y hace falta: las copias viejas se van tirando para que el cubo no
 * crezca sin fin. Lo que NO se puede es sobrescribir una copia existente — no
 * hay política de update a propósito. Una copia que se puede pisar no es una
 * copia de seguridad.
 */
drop policy if exists "copias_borrar" on storage.objects;
create policy "copias_borrar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'copias'
    and (storage.foldername(name))[1] = hermandad_actual()::text
    and not auth_es_hermano()
  );

-- =============================================================================
--   PERMISOS-EVENTOS-Y-WEB.SQL — Los dos módulos que nunca se sembraron: «eventos» y «web»
-- =============================================================================

-- ============================================================================
--   LOS DOS MÓDULOS QUE NUNCA SE SEMBRARON: «eventos» y «web»
-- ============================================================================
--
-- La lista de permisos de fábrica se quedó corta desde el principio. Faltaba
-- «eventos» en cinco cargos y «web» en dos, así que en cualquier hermandad ya
-- creada el Hermano Mayor —que lo puede todo por definición— no podía guardar
-- un evento ni publicar la web: la pantalla se lo ofrecía, la política lo
-- rechazaba.
--
-- POR QUÉ ESTÁ EN SU PROPIO FICHERO Y NO DENTRO DE
-- `permisos-por-hermandad.sql`, QUE ES DONDE ESTABA.
--
-- Porque ese fichero no se puede ejecutar suelto sobre una base al día, y este
-- sí. `permisos-por-hermandad.sql` redefine `modulo_permitido()`, y esa función
-- la vuelve a redefinir después `hermano-con-cargo.sql` añadiéndole una tercera
-- vía: el hermano que lleva un cargo en su ficha. De todas las definiciones
-- manda la última que se ejecuta, así que ejecutar el fichero viejo por su
-- cuenta DEJA SIN ACCESO a todo hermano con cargo en la ficha — que es como
-- están hoy los tesoreros y secretarios que además son hermanos.
--
-- Este arreglo, en cambio, no toca ninguna función: solo añade filas que
-- faltan. Por eso se puede ejecutar solo, y por eso vive aparte.
--
-- Y SE AÑADEN SOLO ESTOS DOS, no se resiembra la lista entera. Volver a
-- sembrarla devolvería permisos que una hermandad haya quitado a propósito
-- —«al Secretario no le dejo tocar el censo»— y eso es peor que el fallo que
-- se viene a arreglar. Nadie ha podido quitar a mano algo que nunca estuvo.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Es seguro repetirlo.
-- ============================================================================

insert into permisos_cargo (hermandad_id, cargo, modulo_id)
select h.id, f.cargo, f.modulo_id
from hermandades h
cross join (values
  ('Hermano Mayor','eventos'),('Hermano Mayor','web'),
  ('Secretario/a','eventos'),('Secretario/a','web'),
  ('Mayordomo/Prioste','eventos'),
  ('Diputado/a Mayor de Gobierno','eventos'),
  ('Vocal','eventos')
) as f(cargo, modulo_id)
-- Solo a los cargos que esta hermandad ya reconoce: si nunca se le sembró
-- «Vocal», no se le inventa uno ahora.
where exists (
  select 1 from permisos_cargo pc
  where pc.hermandad_id = h.id and pc.cargo = f.cargo
)
on conflict do nothing;



-- ============================================================================
--   Y QUE EL MÓDULO «WEB» SIRVA PARA ALGO
-- ============================================================================
--
-- El módulo existía y la pantalla lo respetaba —quien no lo tiene no ve la
-- sección de la web—, pero LA BASE DE DATOS NO LO PEDÍA. La política decía
-- solo «no es un hermano»:
--
--     using (not auth_es_hermano()) with check (not auth_es_hermano())
--
-- O sea que cualquiera del personal, con el cargo que fuera, podía reescribir
-- la web pública de la hermandad desde la consola del navegador sin pasar por
-- ninguna pantalla. El diputado de tramo, el fiscal, el mayordomo: todos.
--
-- Es el mismo error que en la ficha del hermano y en las cuotas: LO QUE ESCONDE
-- LA PANTALLA NO PROTEGE NADA. Quien tiene sesión habla con la base
-- directamente, y ahí solo manda lo que digan las políticas.
--
-- Y aquí duele más de lo que parece, porque la web pública es lo que ve el
-- barrio entero: una portada cambiada la ve más gente en una tarde que
-- cualquier otra cosa de la aplicación.
--
-- Va DETRÁS de la siembra de arriba a propósito: primero el módulo existe para
-- los cargos que lo tienen que tener, y solo después se exige. Al revés, la
-- hermandad se quedaría un rato sin poder editar su web. Y `es_titular()`
-- entra siempre dentro de `modulo_permitido`, así que quien la lleva no se
-- queda fuera pase lo que pase.
drop policy if exists "el personal edita la web" on web_publica;
create policy "el personal edita la web" on web_publica for all to authenticated
  using (not auth_es_hermano() and modulo_permitido('web'))
  with check (not auth_es_hermano() and modulo_permitido('web'));

-- =============================================================================
--   LO-QUE-TOCA-EL-HERMANO.SQL — Que el hermano no se ponga la cuota como pagada desde la consola
-- =============================================================================

-- =============================================================================
--   LO-QUE-TOCA-EL-HERMANO.SQL — El hermano no se pone la cuota como pagada
-- =============================================================================
--
-- EL AGUJERO, y es el mismo que ya se cerró en la ficha del hermano con
-- `hermanos_solo_personal_toca_el_cargo`. Aquí quedó abierto.
--
-- El hermano necesita poder escribir en SU recibo: es como avisa de que ya ha
-- pagado por Bizum o por transferencia. Para eso hay una política de UPDATE
-- sobre `cuotas`. Y el razonamiento con el que se dejó sin acotar por columnas
-- está escrito en `area-hermano.sql`:
--
--     «No hace falta acotar más por columnas: lo único que la aplicación le
--      deja tocar ahí es el aviso de pago.»
--
-- Y AHÍ ESTÁ EL FALLO. Lo que le deje tocar la aplicación no protege nada: el
-- hermano tiene una sesión de verdad, y desde la consola del navegador —la que
-- se abre con F12— puede hablar con la base de datos directamente, sin pasar
-- por ninguna pantalla:
--
--     supabase.from('cuotas').update({ estado: 'Pagada', importe: 0 })
--             .eq('hermano_id', ...)
--
-- Comprobado contra un Postgres de verdad: la fila cambia. En ese momento su
-- recibo queda pagado y a cero, él sale como al corriente, se lleva su papeleta
-- de sitio, y las cuentas de la hermandad dicen que ese dinero entró. La
-- tesorería no tiene forma de notarlo: en su pantalla el recibo está pagado.
--
-- Y NO ES UN CASO DE LABORATORIO. Es una línea, con la sesión que ya tiene
-- abierta, sin herramientas y sin saber nada de bases de datos: se busca en
-- cualquier sitio. En una hermandad de seiscientos hermanos basta con que a uno
-- se le ocurra y se lo cuente al de al lado.
--
-- LO MISMO EN LAS PAPELETAS. Ahí el hermano sí hace cosas de verdad —renovar
-- su sitio, renunciar, avisar de que ha pagado—, pero no puede ponerse la
-- papeleta como «Pagada» ni como «Entregada», ni cambiarse el número, ni
-- ponerse fecha de entrega.
--
-- Se arregla como se arregló en la ficha: LISTA BLANCA. Se dice qué puede
-- cambiar y todo lo demás vuelve a como estaba. Lista blanca y no lista negra,
-- porque una lista negra se queda corta el día que alguien añade una columna.
--
-- Se puede ejecutar sobre una base ya en uso: no toca ninguna fila.

/**
 * Lo único que un hermano puede cambiar de SU recibo: el aviso de pago.
 *
 * Ni el estado, ni el importe, ni la fecha de cobro, ni si está domiciliado, ni
 * si ya viajó en una remesa. Todo eso lo decide la tesorería al confirmar.
 */
create or replace function cuotas_el_hermano_solo_avisa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Sin sesión no es el navegador: es el editor SQL o una función interna, que
  -- ya han pasado por RLS. Ahí no hay nada que proteger y estorbaría para
  -- arreglar datos a mano.
  if auth.uid() is null then return new; end if;

  -- Quien lleva las cuotas escribe la fila entera, que es su trabajo.
  if modulo_permitido('cuotas') or modulo_permitido('tesoreria') then return new; end if;

  -- Un hermano no se emite recibos a sí mismo.
  if tg_op = 'INSERT' then
    raise exception 'Un hermano no puede crearse recibos.' using errcode = 'P0001';
  end if;

  new.numero := old.numero;
  new.hermano_id := old.hermano_id;
  new.concepto := old.concepto;
  new.importe := old.importe;
  new.estado := old.estado;
  new.fecha_emision := old.fecha_emision;
  new.fecha_cobro := old.fecha_cobro;
  new.domiciliada := old.domiciliada;
  new.metodo_cobro := old.metodo_cobro;
  new.fecha_pago := old.fecha_pago;
  new.ejercicio := old.ejercicio;
  new.hermandad_id := old.hermandad_id;
  new.remesada_el := old.remesada_el;
  -- La mora la propone quien lleva las cuotas, no el que la debe.
  new.mora_propuesta_por := old.mora_propuesta_por;
  new.mora_propuesta_nombre := old.mora_propuesta_nombre;
  -- Y `pago_comunicado` es lo que sí se le deja: es el aviso.
  return new;
end $$;

drop trigger if exists cuotas_el_hermano_solo_avisa on cuotas;
create trigger cuotas_el_hermano_solo_avisa
  before insert or update on cuotas
  for each row execute function cuotas_el_hermano_solo_avisa();

comment on function cuotas_el_hermano_solo_avisa() is
  'Lista blanca de lo que un hermano puede cambiar de SU recibo: solo el aviso de pago. '
  'Sin esto, con su propia sesión y una línea desde la consola del navegador se ponía el '
  'recibo como pagado y a cero, salía al corriente y se llevaba su papeleta.';


/**
 * Y en su papeleta: puede renovar, renunciar y avisar de que ha pagado.
 *
 * No puede ponerse la papeleta como pagada ni como entregada —eso lo dice quien
 * la cobra y quien la entrega—, ni cambiarse el número, que es el sitio en el
 * cortejo y va por antigüedad.
 */
create or replace function papeletas_lo_que_toca_el_hermano() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if modulo_permitido('papeletas') or modulo_permitido('cortejo') then return new; end if;

  if tg_op = 'INSERT' then
    -- Pedirla sí puede; nace sin cobrar y sin entregar.
    new.estado := 'Asignada';
    new.fecha_entrega := null;
    new.pago_fecha := null;
    new.fecha_pago := null;
    new.motivo_anulacion := null;
    return new;
  end if;

  new.numero := old.numero;
  new.hermano_id := old.hermano_id;
  new.anio := old.anio;
  new.hermandad_id := old.hermandad_id;
  new.fecha_solicitud := old.fecha_solicitud;
  -- Lo que dice que está cobrada o entregada no lo pone él.
  new.fecha_entrega := old.fecha_entrega;
  new.pago_metodo := old.pago_metodo;
  new.pago_fecha := old.pago_fecha;
  new.metodo_pago := old.metodo_pago;
  new.fecha_pago := old.fecha_pago;
  new.motivo_anulacion := old.motivo_anulacion;

  /*
   * EL ESTADO, solo a los dos sitios a los que él puede llevarlo: pedir su
   * sitio y renunciar. «Pagada» y «Entregada» las dice quien cobra y quien
   * entrega; «Anulada» la dice la hermandad.
   */
  if new.estado is distinct from old.estado
     and new.estado not in ('Asignada', 'Renuncia') then
    new.estado := old.estado;
  end if;

  return new;
end $$;

drop trigger if exists papeletas_lo_que_toca_el_hermano on papeletas;
create trigger papeletas_lo_que_toca_el_hermano
  before insert or update on papeletas
  for each row execute function papeletas_lo_que_toca_el_hermano();

comment on function papeletas_lo_que_toca_el_hermano() is
  'Lista blanca de lo que un hermano puede cambiar de SU papeleta: pedir sitio, renunciar '
  'y avisar del pago. Ni cobrarla, ni entregarla, ni cambiarse el número.';

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Los dos disparadores tienen que estar:
--
--   select tgname from pg_trigger
--    where tgrelid in ('cuotas'::regclass, 'papeletas'::regclass) and not tgisinternal;
--
-- Tiene que salir `cuotas_el_hermano_solo_avisa` y `papeletas_lo_que_toca_el_hermano`,
-- además de los `apuntar_*` del registro de actividad.

-- =============================================================================
--   SIN-CONTRASENAS-EN-LAS-SOLICITUDES.SQL — Fuera la contraseña en claro que guardaba cada solicitud de alta
-- =============================================================================

-- =============================================================================
--   SIN-CONTRASEÑAS-EN-LAS-SOLICITUDES.SQL
-- =============================================================================
--
-- EL FALLO: `solicitudes_alta.clave_propuesta` guardaba EN CLARO la contraseña
-- que tecleaba quien pedía el alta desde la web pública.
--
-- Quién la ve: cualquiera del personal con el módulo «hermanos» —el Hermano
-- Mayor, la Secretaría, el Diputado Mayor—, y no en una pantalla escondida sino
-- en la propia fila de la solicitud. Y se queda ahí mientras la solicitud está
-- pendiente, que en una hermandad pueden ser semanas.
--
-- POR QUÉ IMPORTA MÁS DE LO QUE PARECE: la gente repite contraseñas. La que
-- veía la secretaria es, con mucha probabilidad, la del correo de esa persona.
-- Quien pide el alta no está dándole una contraseña a una empresa con un equipo
-- de seguridad: se la está dando a un vecino que lleva la secretaría los martes.
--
-- Y NO HACÍA FALTA NINGUNA. El camino de «se genera una clave de un solo uso al
-- aprobar y se manda por correo» ya existía —se usaba en el alta de un menor,
-- que llega sin contraseña—. Ahora se usa siempre, y el formulario pide un
-- campo menos.
--
-- Esto hace dos cosas, y las dos hacen falta:
--
--   1. BORRA LAS QUE YA ESTUVIERAN GUARDADAS. Mientras existan, el problema
--      sigue existiendo aunque el formulario ya no pida ninguna.
--   2. IMPIDE QUE ENTREN MÁS, con un disparador. Y esto tampoco sobra: la
--      hermandad puede tener el navegador con la versión anterior de la
--      aplicación abierta desde ayer, y esa sí manda la contraseña.
--
-- No se borra la columna: quitarla rompería a esa versión anterior en cuanto
-- alguien la use, y una solicitud perdida es peor que una columna vacía. Queda
-- ahí, siempre en blanco.
--
-- Se puede ejecutar sobre una base ya en uso.

-- 1. Fuera las que hay.
update solicitudes_alta set clave_propuesta = '' where coalesce(clave_propuesta, '') <> '';

-- 2. Y que no vuelvan a entrar.
create or replace function solicitudes_sin_clave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- En blanco siempre, venga de donde venga. No se rechaza la solicitud: lo
  -- que importa es el alta, y quien la pide no tiene por qué quedarse fuera
  -- porque su navegador tenga la versión de ayer.
  new.clave_propuesta := '';
  return new;
end $$;

drop trigger if exists solicitudes_sin_clave on solicitudes_alta;
create trigger solicitudes_sin_clave
  before insert or update on solicitudes_alta
  for each row execute function solicitudes_sin_clave();

comment on column solicitudes_alta.clave_propuesta is
  'SIEMPRE VACÍA. Guardaba en claro la contraseña que proponía quien pedía el alta, '
  'a la vista de la secretaría durante semanas. La clave se genera al aprobar y se '
  'manda por correo. La columna se queda para no romper versiones anteriores de la '
  'aplicación; un disparador la deja en blanco.';

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Después de ejecutarlo, esto tiene que devolver 0:
--
--   select count(*) from solicitudes_alta where coalesce(clave_propuesta, '') <> '';

-- =============================================================================
--   FRENO-DE-LOS-FORMULARIOS.SQL — Un tope a lo que cualquiera puede meter desde la web pública
-- =============================================================================

-- =============================================================================
--   FRENO-DE-LOS-FORMULARIOS.SQL — Que nadie llene la base desde fuera
-- =============================================================================
--
-- HAY TRES PUERTAS QUE PUEDE EMPUJAR CUALQUIERA SIN IDENTIFICARSE, y ninguna
-- tenía tope:
--
--   · el buzón de la web (`mensajes_web`): contacto, donativos, lotería;
--   · las solicitudes de alta (`solicitudes_alta`);
--   · el contador de visitas, que tiene su freno en `visitas-web.sql`, donde
--     vive la función. Ponerlo aquí la redefiniría, y entonces ese fichero
--     dejaría de poder ejecutarse suelto sin deshacer el freno.
--
-- Las tres se abren a `anon` a propósito y así tiene que seguir siendo: es la
-- web pública y el visitante no tiene sesión ni la va a tener. Lo que faltaba
-- era el freno.
--
-- LO QUE HAY EN EL NAVEGADOR NO CUENTA. Los formularios llevan un campo trampa
-- para robots, y está bien, pero solo lo ve quien pasa por el formulario. Quien
-- habla con la base directamente —que es de lo que va esto— no lo pisa.
--
-- QUÉ PASA SIN FRENO, y son dos cosas distintas:
--
--   1. SE AHOGA EL BUZÓN. Diez mil mensajes de relleno y los tres de verdad
--      —un donativo, una consulta, alguien que quiere hacerse hermano— no hay
--      quien los encuentre. No hace falta tirar nada abajo para hacer daño.
--   2. SE LLENA LA BASE. Un proyecto de Supabase del plan gratuito tiene el
--      espacio contado, y ahí no se cae solo el buzón: se cae la hermandad
--      entera, con su censo y sus cuotas dentro.
--
-- Y AL TEXTO TAMPOCO SE LE PEDÍA MEDIDA: un solo mensaje podía traer megas.
-- Se recorta aquí, del lado de la base, porque lo que recorta el navegador se
-- quita quitando el navegador de en medio.
--
-- LOS TOPES SON HOLGADOS A PROPÓSITO. Sesenta mensajes por hora en una
-- hermandad es muchísimo —el día siguiente a la salida no llegan ni diez—, y
-- cuarenta altas por hora son casi mil al día. No se trata de acotar el uso de
-- verdad, sino de que el abuso no salga gratis.
--
-- Se puede ejecutar sobre una base ya en uso: no toca ninguna fila.

/**
 * El buzón: se recorta el texto y se cuentan los de la última hora.
 *
 * El personal de la hermandad no pasa por aquí (`auth.uid()` con sesión y sin
 * ser hermano): si algún día se importa un buzón entero, no se topa consigo
 * mismo.
 */
create or replace function mensajes_web_con_freno() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_recientes int;
begin
  -- Medida a todo lo que llega. Va antes del tope: aunque la fila entre, no
  -- puede entrar con megas dentro.
  new.nombre   := left(coalesce(new.nombre, ''), 120);
  new.email    := left(coalesce(new.email, ''), 160);
  new.telefono := left(coalesce(new.telefono, ''), 40);
  new.asunto   := left(coalesce(new.asunto, ''), 200);
  new.mensaje  := left(coalesce(new.mensaje, ''), 4000);
  new.causa    := left(coalesce(new.causa, ''), 200);
  new.metodo   := left(coalesce(new.metodo, ''), 60);

  if tg_op <> 'INSERT' then return new; end if;
  -- Quien tiene sesión y no es hermano es la propia hermandad: no se le frena.
  if auth.uid() is not null and not auth_es_hermano() then return new; end if;

  /*
   * LA HORA LA PONE LA BASE, Y ESTO NO ES UN DETALLE: ES EL FRENO.
   *
   * El tope de abajo cuenta los de la última hora por `creado_en`. Si esa
   * columna llega de fuera, basta con ponerla tres días atrás para que el
   * contador no vea ninguno y el freno no exista. Comprobado: entraban los
   * doscientos.
   *
   * Y de paso, `leido` y `atendido` tampoco los pone quien escribe: si no, se
   * puede dejar un mensaje ya marcado como leído y atendido, o sea, invisible
   * en el buzón de la hermandad.
   */
  new.creado_en := now();
  new.leido := false;
  new.atendido := false;

  select count(*) into v_recientes from mensajes_web
   where hermandad_id = new.hermandad_id and creado_en > now() - interval '1 hour';
  if v_recientes >= 60 then
    -- Se avisa en cristiano: quien llega justo detrás de un barrido tiene
    -- derecho a saber por qué no le funciona y a que le digan que vuelva.
    raise exception 'Ahora mismo no se pueden recoger más mensajes. Inténtalo dentro de un rato.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists mensajes_web_con_freno on mensajes_web;
create trigger mensajes_web_con_freno
  before insert or update on mensajes_web
  for each row execute function mensajes_web_con_freno();


/**
 * Las solicitudes de alta, igual.
 *
 * `fecha` es texto («23 ago 2026») y no sirve para contar por hora, así que se
 * cuentan las que no están resueltas: una avalancha las deja todas pendientes,
 * que es exactamente la señal.
 */
create or replace function solicitudes_con_freno() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pendientes int;
begin
  new.nombre   := left(coalesce(new.nombre, ''), 120);
  new.dni      := left(coalesce(new.dni, ''), 40);
  new.email    := left(coalesce(new.email, ''), 160);
  new.telefono := left(coalesce(new.telefono, ''), 40);

  if tg_op <> 'INSERT' then return new; end if;
  if auth.uid() is not null and not auth_es_hermano() then return new; end if;

  /*
   * Y EL ESTADO LO PONE LA BASE, por lo mismo y por algo peor.
   *
   * El tope de abajo cuenta las PENDIENTES, así que mandándolas con
   * `estado: 'Aprobada'` no cuentan y el freno no existe. Pero es que además,
   * una solicitud que llega ya aprobada desde fuera aparece en el panel de la
   * secretaría como si la hubiera aprobado alguien de la casa.
   */
  new.estado := 'Pendiente';
  new.resuelta_el := null;
  new.motivo_rechazo := null;

  select count(*) into v_pendientes from solicitudes_alta
   where hermandad_id = new.hermandad_id and estado = 'Pendiente';
  /*
   * Trescientas pendientes A LA VEZ no las tiene ninguna hermandad: son las que
   * caben en el panel de la secretaría antes de que deje de poder mirarlas. Y
   * el tope se suelta solo según las va resolviendo, que es lo que la hace
   * distinta de un tope por hora — aquí no hay que esperar a nada.
   */
  if v_pendientes >= 300 then
    raise exception 'Ahora mismo no se pueden recoger más solicitudes. Inténtalo dentro de unos días.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists solicitudes_con_freno on solicitudes_alta;
create trigger solicitudes_con_freno
  before insert or update on solicitudes_alta
  for each row execute function solicitudes_con_freno();



-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Los dos disparadores tienen que estar:
--
--   select tgname from pg_trigger
--    where tgrelid in ('mensajes_web'::regclass, 'solicitudes_alta'::regclass)
--      and not tgisinternal;

-- =============================================================================
--   CUENTA-POR-HERMANDAD.SQL — Ser hermano de dos hermandades: una cuenta por hermandad + DNI
-- =============================================================================

-- =============================================================================
--   CUENTA-POR-HERMANDAD.SQL — Ser hermano de dos hermandades a la vez
-- =============================================================================
--
-- EN ANDALUCÍA SER HERMANO DE DOS O TRES HERMANDADES ES LO NORMAL. Y hasta
-- ahora, cuando las dos estaban en Gobergo, esa persona solo podía entrar en el
-- área de UNA.
--
-- El censo ya lo contemplaba: el DNI se hizo único POR HERMANDAD en su día, con
-- el comentario «la misma persona puede ser hermana de dos». Su ficha está dos
-- veces, una en cada hermandad, y eso está bien. Lo que faltaba era la cuenta.
--
-- POR QUÉ FALLABA. Un hermano entra así:
--
--     elige hermandad → escribe su DNI → escribe su contraseña
--
-- El correo NO LO TECLEA NUNCA: la aplicación lo busca a partir del DNI y con
-- él inicia la sesión. Pero las cuentas de Supabase se identifican POR CORREO, y
-- el correo es único en todo el sistema. Así que al aprobar el alta en la
-- segunda hermandad, la creación de la cuenta se estrellaba con «el correo ya lo
-- usa otra cuenta»: esa persona quedaba en el censo de la segunda y sin poder
-- entrar en su área.
--
-- LO QUE SE SEPARA AQUÍ son dos cosas que estaban pegadas sin necesidad:
--
--   · `email`         — el correo de la persona, donde recibe los avisos. Es el
--                       MISMO en las dos hermandades, y no se toca.
--   · `correo_acceso` — cómo se llama su cuenta por dentro. Uno por hermandad.
--                       No lo ve ni lo teclea nadie.
--
-- Con eso, hermandad + DNI ES la cuenta, que es exactamente como se entra. Dos
-- hermandades, dos cuentas, dos contraseñas —independientes, porque son dos
-- accesos distintos— y un solo correo para los avisos.
--
-- NADIE QUE YA TENGA CUENTA SE ENTERA DE ESTO. Su `correo_acceso` está a null, y
-- `resolver_email_hermano` devuelve entonces el correo de siempre: entran igual
-- que ayer. El identificador derivado solo lo usan las cuentas que se crean a
-- partir de ahora.
--
-- Se puede ejecutar sobre una base ya en uso: no toca ninguna fila.

/*
 * `gen_random_bytes` y `digest` vienen con `pgcrypto`, no con Postgres a secas.
 *
 * DECLARARLA NO BASTA, Y ESTO COSTÓ UN FALLO EN PRODUCCIÓN.
 *
 * En Supabase pgcrypto viene encendida de fábrica pero EN EL ESQUEMA
 * `extensions`, no en `public`. Así que este `create extension if not exists`
 * no hace nada —ya está instalada— y una función declarada con
 * `set search_path = public` NO LA VE. El error que sale es
 *
 *     function gen_random_bytes(integer) does not exist
 *
 * que manda a buscar una función cuando lo que pasa es que está en otro
 * esquema. La recuperación de contraseña del hermano estuvo rota por esto.
 *
 * Por eso las funciones de este archivo llevan `set search_path = public,
 * extensions`. Un esquema que no exista se ignora sin quejarse, así que la
 * misma línea vale en Supabase y en un Postgres normal —donde la extensión
 * acaba en `public` y se encuentra igual—.
 *
 * Y por eso las pruebas montan ahora `extensions` como lo hace Supabase: con
 * pgcrypto en `public`, esto pasaba en verde.
 */
create extension if not exists pgcrypto;

alter table hermanos add column if not exists correo_acceso text;

/*
 * Único, porque es el nombre de una cuenta. Parcial —solo donde no es nulo—
 * para no chocar con todas las fichas viejas, que lo tienen vacío.
 */
create unique index if not exists hermanos_correo_acceso_uniq
  on hermanos (lower(correo_acceso)) where correo_acceso is not null;

comment on column hermanos.correo_acceso is
  'Cómo se llama su cuenta POR DENTRO, una por hermandad. No es su correo: ese es '
  '«email» y sirve para los avisos, es el mismo en todas sus hermandades y no se '
  'toca. Nulo en las fichas anteriores a este cambio, que siguen entrando con su '
  'correo de siempre.';

/**
 * El identificador interno de una cuenta: hermandad + DNI.
 *
 * NO ES UN CORREO DE VERDAD y no tiene por qué serlo: no recibe nada, y quien
 * escribe a esa persona usa el `email` de su ficha. Tiene forma de correo porque
 * es lo que Supabase pide para nombrar una cuenta.
 *
 * Lleva un trozo del id de la hermandad para que el mismo DNI dé dos cuentas
 * distintas, que es de lo que va todo esto. Y el DNI va limpio —sin puntos ni
 * guiones— porque en el censo importado está escrito de las dos maneras y son la
 * misma persona.
 *
 * Se GUARDA en la ficha en cuanto se crea la cuenta, no se recalcula cada vez.
 * Si mañana la secretaría corrige un DNI mal tecleado —que en un censo importado
 * de un Excel pasa— la cuenta tiene que seguir siendo la suya; recalculándolo se
 * quedaría sin poder entrar y sin que nadie entendiera por qué.
 */
create or replace function correo_de_acceso(p_hermandad_id uuid, p_dni text)
returns text
language sql immutable as $$
  select upper(regexp_replace(coalesce(p_dni, ''), '[^A-Za-z0-9]', '', 'g'))
      || '.' || left(replace(p_hermandad_id::text, '-', ''), 12)
      || '@acceso.gobergo.com'
$$;

/**
 * Y el que busca la aplicación para iniciar sesión: el interno si lo tiene, y
 * si no el de siempre.
 *
 * Ese `coalesce` es lo que hace que este cambio no se note: las fichas de antes
 * no tienen identificador interno y siguen entrando con su correo, exactamente
 * igual que ayer.
 *
 * Y DE PASO SE CIERRA UNA FUGA. Esta función se la puede llamar cualquiera sin
 * identificarse —es como entra un hermano— y devolvía EL CORREO REAL de esa
 * persona. Un DNI no es ningún secreto: sabiendo el de alguien se obtenía su
 * dirección. Hay freno (25 DNI distintos por media hora), pero contra una
 * persona concreta funciona a la primera. Para las cuentas nuevas ya no
 * devuelve nada que diga nada de nadie.
 */
create or replace function resolver_email_hermano(p_hermandad_id uuid, p_dni text)
returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_dni text;
  v_huella text;
  v_recientes int;
  v_email text;
begin
  v_dni := upper(regexp_replace(coalesce(p_dni, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_dni = '' or p_hermandad_id is null then
    return null;
  end if;

  v_huella := md5(v_dni || ':' || p_hermandad_id::text);

  select count(distinct huella_dni) into v_recientes
    from intentos_acceso
   where hermandad_id = p_hermandad_id
     and cuando > now() - interval '30 minutes';

  if v_recientes >= 25 then
    raise exception 'Demasiados intentos de acceso en esta hermandad. Espera unos minutos y vuelve a probar.'
      using errcode = 'P0001';
  end if;

  insert into intentos_acceso (hermandad_id, huella_dni) values (p_hermandad_id, v_huella);
  delete from intentos_acceso where cuando < now() - interval '1 day';

  select coalesce(nullif(correo_acceso, ''), nullif(email, '')) into v_email
    from hermanos
   where hermandad_id = p_hermandad_id
     and upper(regexp_replace(dni, '[^A-Za-z0-9]', '', 'g')) = v_dni
     and estado <> 'Baja'
   limit 1;

  return v_email;
end $$;

grant execute on function resolver_email_hermano(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- La columna tiene que estar, y vacía en todas las fichas de hoy:
--
--   select count(*) as fichas, count(correo_acceso) as con_cuenta_propia from hermanos;
--
-- «con_cuenta_propia» en 0 al principio es lo correcto: se va llenando según se
-- creen cuentas nuevas.


-- =============================================================================
--   Y LA RECUPERACIÓN DE CONTRASEÑA, NUESTRA
-- =============================================================================
--
-- POR QUÉ HACE FALTA: «he olvidado mi contraseña» hacía que Supabase mandara un
-- correo a la dirección de la cuenta. Con el identificador interno de arriba,
-- esa dirección NO RECIBE NADA — así que el enlace no llegaría nunca y cada
-- hermano nuevo se quedaría sin poder recuperar su acceso. Eso es meter un
-- fallo, no quitarlo, y por eso esto entra en el mismo archivo.
--
-- CÓMO FUNCIONA, y es igual que el correo de confirmar una suscripción: el
-- navegador solo dice «este DNI de esta hermandad quiere recuperar». Ni el
-- token ni el correo de la persona pasan por él. La función `enviar-correo` los
-- lee aquí con la clave de servicio y manda el enlace al correo DE VERDAD de su
-- ficha.

create table if not exists recuperaciones_hermano (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  hermano_id uuid not null references hermanos(id) on delete cascade,
  /*
   * LA HUELLA DEL TOKEN, NO EL TOKEN. Quien pudiera leer esta tabla tendría si
   * no la llave para entrar en la cuenta de cualquiera que haya pedido
   * recuperarla. Guardando el resumen, la tabla no sirve de nada por sí sola.
   */
  huella text not null unique,
  caduca_en timestamptz not null,
  usada_en timestamptz,
  creada_en timestamptz not null default now()
);
create index if not exists recuperaciones_hermano_idx on recuperaciones_hermano (hermano_id, creada_en desc);

alter table recuperaciones_hermano enable row level security;
-- Nadie la toca desde fuera. Las dos funciones de abajo son SECURITY DEFINER y
-- se saltan las políticas a propósito; sin ninguna política, una tabla con RLS
-- encendido está cerrada del todo, que es lo que se quiere.
revoke all on recuperaciones_hermano from anon, authenticated;

/**
 * Paso 1: se pide. Devuelve el token, el correo DE VERDAD y el nombre, para que
 * quien manda el correo sepa a dónde y cómo escribir.
 *
 * SOLO PARA `service_role`. Si esto se le diera a `anon`, sería regalar la
 * llave de la cuenta de cualquiera con solo saber su DNI, que es justo lo
 * contrario de lo que viene a hacer.
 *
 * Devuelve null —y no se manda nada— si ese DNI no está en esa hermandad, si
 * está de baja, si no tiene correo donde escribirle, o si ya pidió una hace
 * menos de cinco minutos. Lo último es el freno: sin él, pedir la recuperación
 * mil veces con el DNI de otro le llena la bandeja, firmado por la hermandad.
 */
create or replace function pedir_recuperacion_hermano(p_hermandad_id uuid, p_dni text)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_dni text;
  v_hermano record;
  v_token text;
begin
  if p_hermandad_id is null then return null; end if;
  v_dni := upper(regexp_replace(coalesce(p_dni, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_dni = '' then return null; end if;

  select id, nombre, email into v_hermano from hermanos
   where hermandad_id = p_hermandad_id
     and upper(regexp_replace(dni, '[^A-Za-z0-9]', '', 'g')) = v_dni
     and estado <> 'Baja'
     and coalesce(email, '') <> ''
     -- Sin cuenta no hay contraseña que recuperar.
     and auth_user_id is not null
   limit 1;
  if v_hermano.id is null then return null; end if;

  if exists (select 1 from recuperaciones_hermano
              where hermano_id = v_hermano.id and creada_en > now() - interval '5 minutes') then
    return null;
  end if;

  -- Largo y al azar: es lo único que hace falta saber para ponerle otra
  -- contraseña a esa cuenta, así que no puede haber nada que adivinar.
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Las anteriores de esta persona dejan de valer: pedir una nueva tiene que
  -- invalidar la de antes, o un enlace viejo reenviado sigue abriendo.
  update recuperaciones_hermano set usada_en = now()
   where hermano_id = v_hermano.id and usada_en is null;

  insert into recuperaciones_hermano (hermandad_id, hermano_id, huella, caduca_en)
  values (p_hermandad_id, v_hermano.id, encode(digest(v_token, 'sha256'), 'hex'),
          now() + interval '2 hours');

  -- Y se limpia lo viejo aprovechando el viaje, para no tener que programar nada.
  delete from recuperaciones_hermano where creada_en < now() - interval '7 days';

  return jsonb_build_object('token', v_token, 'email', v_hermano.email, 'nombre', v_hermano.nombre);
end $$;
revoke all on function pedir_recuperacion_hermano(uuid, text) from public, anon, authenticated;
grant execute on function pedir_recuperacion_hermano(uuid, text) to service_role;

/**
 * Paso 2: se canjea. Devuelve de qué cuenta es, para poder ponerle la
 * contraseña nueva.
 *
 * También solo para `service_role`: la contraseña se cambia con la clave de
 * servicio desde la función `enviar-correo`, porque eso no se puede hacer desde
 * SQL ni desde el navegador.
 *
 * SE MARCA COMO USADA EN LA MISMA CONSULTA. Un token de un solo uso que se
 * comprueba y se marca en dos pasos se puede canjear dos veces si llegan a la
 * vez, y aquí eso es dos cambios de contraseña.
 */
create or replace function canjear_recuperacion_hermano(p_token text)
returns uuid
language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_auth uuid;
begin
  if coalesce(p_token, '') = '' then return null; end if;

  update recuperaciones_hermano r
     set usada_en = now()
    from hermanos h
   where h.id = r.hermano_id
     and r.huella = encode(digest(p_token, 'sha256'), 'hex')
     and r.usada_en is null
     and r.caduca_en > now()
     and h.estado <> 'Baja'
  returning h.auth_user_id into v_auth;

  return v_auth;
end $$;
revoke all on function canjear_recuperacion_hermano(text) from public, anon, authenticated;
grant execute on function canjear_recuperacion_hermano(text) to service_role;

-- =============================================================================
--   SOLICITUDES-DE-PAPELETA.SQL — Que la solicitud de papeleta del hermano llegue a la hermandad
-- =============================================================================

-- ============================================================================
--   LA SOLICITUD DE PAPELETA DEL HERMANO NO LLEGABA A NINGUNA PARTE
-- ============================================================================
--
-- El área del hermano tiene un formulario para pedir la papeleta de sitio:
-- modalidad, tramo, preferencia y un comentario. El hermano lo rellena, le da
-- a enviar, y la pantalla le dice que su solicitud ha quedado registrada.
--
-- Y se guardaba EN SU MÓVIL. En `localStorage`, con la clave
-- `cabildo-solicitudes-papeleta`, y en ningún otro sitio.
--
-- La secretaría abre Papeletas › Solicitudes desde el ordenador de la casa de
-- hermandad y lee `localStorage`… el suyo. Que está vacío. Los dos lados de la
-- misma función leyendo cajones distintos: el hermano ve la suya y cree que ya
-- está pedida, la hermandad no ve ninguna y cree que nadie ha pedido.
--
-- Nada avisa. No hay error, no hay banda roja, no hay una fila a medias: hay
-- dos pantallas contándose cosas distintas. Y el día que se cierra el plazo,
-- las solicitudes que no se atendieron no es que se perdieran — es que nunca
-- salieron del teléfono.
--
-- Aquí se le da la tabla que le faltaba, con las mismas reglas que el resto:
--
--   · El hermano SOLO puede crear la suya, y solo puede leer las suyas.
--   · El estado lo pone el servidor: nadie se acepta su propia papeleta.
--   · Una pendiente por hermano y año. Ni cero (se perdería) ni cincuenta.
--   · La secretaría las ve y las resuelve, si tiene el módulo de papeletas.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

create table if not exists solicitudes_papeleta (
  id uuid primary key default gen_random_uuid(),
  -- `default hermandad_actual()`, igual que papeletas, cuotas y hermanos: la
  -- hermandad la pone la base a partir de quién está preguntando, así que la
  -- aplicación no la manda y no la puede equivocar.
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  hermano_id uuid not null references hermanos(id) on delete cascade,
  -- El nombre y el número se copian al pedirla, y no es dato duplicado por
  -- descuido: es lo que la secretaría necesita leer en la lista sin cruzar el
  -- censo entero, y lo que hace que la solicitud siga contando quién la pidió
  -- aunque esa ficha cambie de número por una baja de otro.
  hermano_nombre text not null default '',
  hermano_numero int not null default 0,
  anio int not null,
  modalidad text not null default 'Nazareno',
  preferencia text not null default '',
  tramo_solicitado text not null default '',
  comentario text not null default '',
  fecha text not null default '',
  estado text not null default 'Pendiente'
    check (estado in ('Pendiente', 'Aceptada', 'Rechazada'))
);

alter table solicitudes_papeleta enable row level security;

create index if not exists solicitudes_papeleta_hermandad
  on solicitudes_papeleta (hermandad_id, anio);

/*
 * UNA PENDIENTE POR HERMANO Y AÑO.
 *
 * Es el freno y a la vez la regla del negocio. Sin él, el botón de enviar se
 * puede pulsar cuarenta veces —desde el móvil, con la conexión regular, se
 * pulsa dos o tres sin querer— y la secretaría se encuentra la misma petición
 * repetida sin saber cuál mirar.
 *
 * Parcial, solo sobre las pendientes: a quien se le rechazó una tiene que
 * poder volver a pedirla, que para eso se le explica el motivo.
 */
create unique index if not exists solicitudes_papeleta_una_pendiente
  on solicitudes_papeleta (hermano_id, anio)
  where estado = 'Pendiente';

/*
 * LO QUE PONE EL SERVIDOR, PASE LO QUE PASE.
 *
 * La política de abajo deja al hermano CREAR su solicitud, y una política no
 * sabe de columnas: puede escribir las que quiera. Sin este disparador, quien
 * supiera abrir la consola del navegador se mandaba su propia solicitud ya
 * «Aceptada» —que es lo que la secretaría convierte en papeleta—, o la creaba
 * a nombre de otro hermano para quitarle el sitio.
 *
 * Es lista BLANCA, no negra: se fija lo que tiene que valer y lo demás se
 * queda como venga. Una lista negra hay que ampliarla cada vez que se añade
 * una columna, y el día que se olvide no avisa nadie.
 *
 * `security definer` porque lee `hermanos`, que el propio hermano solo ve en
 * su fila.
 */
create or replace function solicitud_papeleta_del_hermano() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_hermano hermanos%rowtype;
begin
  -- Al personal no se le toca nada: es quien acepta y rechaza, y para eso
  -- tiene que poder escribir el estado.
  if not auth_es_hermano() then return new; end if;

  select * into v_hermano from hermanos where auth_user_id = auth.uid();
  if v_hermano.id is null then
    raise exception 'Esta cuenta no tiene ficha de hermano.';
  end if;

  if tg_op = 'INSERT' then
    -- Suya, de su hermandad, con sus datos y siempre pendiente.
    new.hermano_id := v_hermano.id;
    new.hermandad_id := v_hermano.hermandad_id;
    new.hermano_nombre := v_hermano.nombre;
    new.hermano_numero := v_hermano.numero;
    new.estado := 'Pendiente';
    -- Un hermano de baja no pide sitio en el cortejo.
    if v_hermano.estado = 'Baja' then
      raise exception 'Una persona de baja en la hermandad no puede pedir papeleta.';
    end if;
    return new;
  end if;

  -- Y modificar, no modifica: la resuelve la hermandad, no él.
  raise exception 'La solicitud la resuelve la hermandad.';
end $$;

drop trigger if exists solicitud_papeleta_del_hermano on solicitudes_papeleta;
create trigger solicitud_papeleta_del_hermano
  before insert or update on solicitudes_papeleta
  for each row execute function solicitud_papeleta_del_hermano();

-- ---------------------------------------------------------------------------
-- Quién ve y quién toca
-- ---------------------------------------------------------------------------

-- El corte por hermandad va aparte y RESTRICTIVO, igual que en el resto de
-- tablas: se suma a todo lo demás en vez de competir con ello.
drop policy if exists "solo_mi_hermandad" on solicitudes_papeleta;
create policy "solo_mi_hermandad" on solicitudes_papeleta as restrictive for all to authenticated
  using (hermandad_id = hermandad_actual())
  with check (hermandad_id = hermandad_actual());

drop policy if exists "el hermano pide la suya" on solicitudes_papeleta;
create policy "el hermano pide la suya" on solicitudes_papeleta for insert to authenticated
  with check (auth_es_hermano() and hermano_id = hermano_propio_id());

drop policy if exists "el hermano ve las suyas" on solicitudes_papeleta;
create policy "el hermano ve las suyas" on solicitudes_papeleta for select to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id());

drop policy if exists "la hermandad las lee" on solicitudes_papeleta;
create policy "la hermandad las lee" on solicitudes_papeleta for select to authenticated
  using (not auth_es_hermano());

drop policy if exists "la hermandad las resuelve" on solicitudes_papeleta;
create policy "la hermandad las resuelve" on solicitudes_papeleta for update to authenticated
  using (not auth_es_hermano() and modulo_permitido('papeletas'))
  with check (not auth_es_hermano() and modulo_permitido('papeletas'));

drop policy if exists "la hermandad las borra" on solicitudes_papeleta;
create policy "la hermandad las borra" on solicitudes_papeleta for delete to authenticated
  using (not auth_es_hermano() and modulo_permitido('papeletas'));

grant select, insert, update, delete on solicitudes_papeleta to authenticated;

comment on table solicitudes_papeleta is
  'Lo que el hermano pide desde su área para la estación de penitencia. Vivía en el '
  'localStorage de su móvil, así que la secretaría no la recibía nunca: el hermano '
  'la veía enviada y la hermandad no veía ninguna, sin un solo aviso por medio.';

-- =============================================================================
--   ACTIVAR-LA-SUSCRIPCION.SQL — Que el botón de activar la suscripción llegue a la base
-- =============================================================================

-- ============================================================================
--   EL BOTÓN DE ACTIVAR LA SUSCRIPCIÓN NO LLEGABA A LA BASE
-- ============================================================================
--
-- Sin suscripción activa, el panel entero está bloqueado: `AppShell` enseña la
-- pantalla de suscripción y no deja pasar a ningún módulo. Es lo primero que
-- se encuentra una hermandad al entrar.
--
-- La pantalla tiene su botón de activar, y ese botón escribía en
-- `localStorage`. En ningún otro sitio. Lo que pasaba entonces:
--
--   1. El Hermano Mayor activa desde su ordenador. Entra. Funciona.
--   2. La secretaria abre el panel desde el suyo y se encuentra el muro de
--      pago, con la hermandad supuestamente activada.
--   3. Y en el ordenador del Hermano Mayor, al recargar, el muro TAMBIÉN
--      vuelve: `cargarSuscripcionDeLaBase()` pregunta a la base, la base
--      contesta «no hay suscripción», y esa respuesta pisa la copia local.
--
-- O sea que el botón no servía para nada más que para el rato que durase esa
-- pestaña abierta. Y no había forma de saberlo desde dentro: no da error, no
-- avisa, simplemente vuelve a salir el muro.
--
-- LA ÚNICA MANERA DE ACTIVAR ERA `activar_suscripcion(...)` DESDE EL EDITOR
-- SQL DE SUPABASE, porque esa función está revocada para `authenticated` a
-- propósito: se pensó para que la llamara el webhook de Stripe con la clave de
-- servicio. Mientras no exista ese webhook, la aplicación se queda sin ninguna
-- forma de activar nada.
--
-- QUÉ AÑADE ESTE ARCHIVO
--
-- `activar_suscripcion_propia()`: la puede llamar el TITULAR de la hermandad,
-- y solo para SU hermandad. Es exactamente lo que la pantalla ya ofrece —hoy
-- la activación es gratuita mientras no haya precios de Stripe puestos, y así
-- lo dice— pero guardándolo donde tiene que estar.
--
-- OJO, Y ESTO HAY QUE LEERLO ANTES DE COBRAR: mientras esta función exista,
-- cualquier titular puede activarse el pack que quiera sin pagar. Hoy da
-- igual, porque el botón de la pantalla ya lo hace y no hay pasarela. EL DÍA
-- QUE SE CONECTE STRIPE hay que revocarla y dejar solo la de service_role, que
-- es la que llamará el webhook:
--
--     revoke execute on function activar_suscripcion_propia(text, text) from authenticated;
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

create or replace function activar_suscripcion_propia(
  p_pack text default 'todo',
  p_periodo text default 'mensual'
) returns void
language plpgsql security definer set search_path = public as $$
declare v_hermandad uuid;
begin
  -- SOLO EL TITULAR, y solo la suya. `hermandad_actual()` sale de quién está
  -- preguntando, así que no hay ningún identificador que se pueda cambiar
  -- desde el navegador para activarle la suscripción a otra hermandad.
  if not es_titular() then
    raise exception 'Solo quien lleva la hermandad puede activar la suscripción.';
  end if;
  v_hermandad := hermandad_actual();
  if v_hermandad is null then
    raise exception 'Esta cuenta no tiene ninguna hermandad.';
  end if;

  -- Los valores se acotan aquí y no se toman tal cual: son los que decide la
  -- pantalla, pero la pantalla se puede saltar.
  if coalesce(p_pack, '') not in ('todo', 'gestion', 'web') then p_pack := 'todo'; end if;
  if coalesce(p_periodo, '') not in ('mensual', 'anual') then p_periodo := 'mensual'; end if;

  insert into suscripciones (hermandad_id, activa, pack, periodo, desde, actualizada_en)
  values (v_hermandad, true, p_pack, p_periodo, current_date, now())
  on conflict (hermandad_id) do update set
    activa = true, pack = excluded.pack, periodo = excluded.periodo,
    desde = coalesce(suscripciones.desde, excluded.desde), actualizada_en = now();
end $$;

revoke all on function activar_suscripcion_propia(text, text) from public, anon;
grant execute on function activar_suscripcion_propia(text, text) to authenticated;

-- Y darla de baja, por lo mismo: cancelándola solo en el navegador, la
-- hermandad seguía entrando desde cualquier otro ordenador.
create or replace function cancelar_suscripcion_propia() returns void
language plpgsql security definer set search_path = public as $$
declare v_hermandad uuid;
begin
  if not es_titular() then
    raise exception 'Solo quien lleva la hermandad puede cancelar la suscripción.';
  end if;
  v_hermandad := hermandad_actual();
  if v_hermandad is null then return; end if;
  -- Se marca inactiva, NO se borra la fila: cuándo se dio de alta y cuándo se
  -- fue es justo lo que hay que poder mirar cuando alguien reclama.
  update suscripciones set activa = false, actualizada_en = now()
   where hermandad_id = v_hermandad;
end $$;

revoke all on function cancelar_suscripcion_propia() from public, anon;
grant execute on function cancelar_suscripcion_propia() to authenticated;

comment on function activar_suscripcion_propia(text, text) is
  'Activa la suscripción de SU hermandad, para el titular. Existe porque el botón de la '
  'pantalla de suscripción solo escribía en localStorage: al recargar volvía el muro de '
  'pago, y desde otro ordenador no había entrado nunca. Revocar para authenticated el día '
  'que se conecte Stripe: entonces activa el webhook con activar_suscripcion().';

-- =============================================================================
--   NUMERO-DE-RECIBO-UNICO.SQL — Que no pueda haber dos recibos con el mismo número
-- =============================================================================

-- ============================================================================
--   DOS RECIBOS CON EL MISMO NÚMERO
-- ============================================================================
--
-- El número de recibo es lo que va impreso en el justificante que se le
-- entrega al hermano, y es por lo que pregunta la tesorería al cuadrar el
-- extracto del banco: «el 412 no me aparece». Que haya dos 412 no es un
-- detalle de listado: es que esa conversación deja de tener respuesta.
--
-- Y se podían crear. `hermanos` tiene su número protegido
-- (`hermanos_numero_por_hermandad`) y `papeletas` también
-- (`papeletas_numero_unico`); `cuotas` se quedó sin nada. Comprobado: dos
-- inserciones seguidas con el mismo número entran las dos y nadie protesta.
--
-- No hace falta mala suerte para que pase. El número lo calcula la aplicación
-- con «el mayor que veo, más uno», y lo que ve es la lista que tiene cargada:
--
--   · Dos personas emitiendo desde dos ordenadores a la vez —el día del
--     cabildo son dos, y a veces tres—.
--   · Emitir en una pestaña mientras la otra tiene la tabla a medio cargar.
--   · Importar el histórico de cuotas de otro programa, que trae sus propios
--     números y no sabe cuáles hay ya.
--
-- QUÉ HACE ESTE ARCHIVO, Y QUÉ NO HACE
--
-- Pone el índice único. Y ANTES MIRA si la base ya tiene repetidos, porque una
-- hermandad que lleve meses trabajando puede tenerlos:
--
--   · Si no hay ninguno, lo pone y ya está.
--   · Si los hay, NO LOS TOCA y NO PONE EL ÍNDICE: avisa diciendo cuáles son.
--
-- No se renumeran solos a propósito. Esos números están impresos en recibos
-- que ya se entregaron y anotados en la conciliación del banco: cambiarlos
-- desde un script, de madrugada y sin que nadie mire, es peor que el problema.
-- Que la tesorería decida cuál se queda con el número y cuál se corrige, y
-- después se vuelve a ejecutar esto.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada. Si avisa de repetidos, mira el aviso.
-- ============================================================================

do $$
declare
  v_repetidos int;
  v_detalle text;
begin
  -- Si ya está puesto, no hay nada que hacer.
  if exists (select 1 from pg_indexes where indexname = 'cuotas_numero_por_hermandad') then
    raise notice 'El número de recibo ya era único. Nada que hacer.';
    return;
  end if;

  select count(*), string_agg(t.detalle, ' · ')
    into v_repetidos, v_detalle
  from (
    select 'nº ' || numero || ' (' || count(*) || ' recibos)' as detalle
      from cuotas
     where hermandad_id is not null
     group by hermandad_id, numero
    having count(*) > 1
     order by numero
     limit 20
  ) t;

  if coalesce(v_repetidos, 0) > 0 then
    raise warning 'NO se ha puesto el índice: ya hay números de recibo repetidos. %', v_detalle;
    raise warning 'Míralos en Cuotas, decide cuál se queda con cada número, corrige el otro y vuelve a ejecutar esto.';
    return;
  end if;

  /*
   * Por HERMANDAD, no global: cada una lleva su propia numeración y el recibo
   * nº 1 de una no tiene nada que ver con el nº 1 de la otra.
   *
   * Y NO por ejercicio, aunque parezca lo natural: la aplicación numera
   * seguido, sin reiniciar cada año (`emitirCuotasAnuales` coge el mayor de
   * TODOS y suma uno). Poner el índice por ejercicio dejaría pasar dos recibos
   * con el mismo número en años distintos, que es exactamente lo que la
   * tesorería no puede distinguir cuando busca «el 412» en el extracto.
   */
  create unique index cuotas_numero_por_hermandad
    on cuotas (hermandad_id, numero)
    where hermandad_id is not null;
  raise notice 'Puesto: a partir de ahora no puede haber dos recibos con el mismo número.';
end $$;

comment on table cuotas is
  'Recibos de cuota. El número es único por hermandad: va impreso en el justificante '
  'del hermano y es por lo que pregunta la tesorería al cuadrar el banco. Se podían '
  'crear dos con el mismo número emitiendo desde dos ordenadores a la vez.';

-- =============================================================================
--   BORRAR-UNA-HERMANDAD.SQL — Que una hermandad se pueda borrar (el registro lo impedía)
-- =============================================================================

-- ============================================================================
--   UNA HERMANDAD NO SE PODÍA BORRAR
-- ============================================================================
--
-- `delete from hermandades where id = ...` fallaba entero y no borraba nada:
--
--   ERROR:  insert or update on table "registro_actividad" violates foreign
--           key constraint "registro_actividad_hermandad_id_fkey"
--   DETAIL: Key (hermandad_id)=(…) is not present in table "hermandades".
--   CONTEXT: PL/pgSQL function apuntar_cambio() line 32
--
-- LA CADENA. Borrar la hermandad arrastra en cascada su censo, sus cuotas, sus
-- papeletas y sus apuntes. Cada una de esas bajas dispara `apuntar_cambio()`
-- —el registro de «quién hizo qué», que existe por el artículo 32 del RGPD—, y
-- ese disparador intenta escribir una fila de registro CON EL ID DE LA
-- HERMANDAD. Que ya no está. La clave ajena lo rechaza y se cae el borrado
-- completo.
--
-- DÓNDE MUERDE. En `BORRAR-PRUEBAS.sql`, que es justo el archivo que se ejecuta
-- para quitar las hermandades de prueba cuando entra la primera de verdad. Se
-- lanza, da un error largo de clave ajena que no dice nada de esto, y las
-- hermandades de prueba siguen ahí.
--
-- EL ARREGLO. Si la hermandad ya no existe, no se apunta nada y se sigue.
-- No es que se pierda el rastro: es que el rastro de una hermandad que se ha
-- ido no tiene dónde vivir —la propia tabla de registro se borra con ella— y
-- lo que hay que conservar de un borrado así es la copia de seguridad, no una
-- línea de registro huérfana.
--
-- Se toca SOLO el disparador. La cascada, las claves ajenas y el registro se
-- quedan como estaban.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

create or replace function apuntar_cambio() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  que text;
  sobre text;
  quien uuid;
  -- La fila, en JSON. Es la clave de que esto funcione en las cuatro tablas.
  --
  -- Escrito como `new.nombre`, PL/pgSQL revienta en las tablas que no tienen
  -- esa columna —papeletas, cuotas, movimientos— con «record "new" has no
  -- field "nombre"». Y no revienta al crear el disparador, sino al guardar la
  -- primera fila: el SQL se instala sin una queja y lo que deja de funcionar
  -- es emitir papeletas, cobrar cuotas y apuntar en tesorería.
  --
  -- Con `->>` no hay tal cosa: la columna que no existe vale NULL y ya está.
  fila jsonb;
  v_hermandad uuid;
begin
  quien := auth.uid();
  -- Sin sesión es el editor SQL o una función interna. Se apunta igual, pero
  -- sin autor: es información, no una acusación.
  que := lower(tg_argv[0]) || '_' || lower(tg_op);
  fila := to_jsonb(case tg_op when 'DELETE' then old else new end);
  -- Cómo se llama la fila, según lo que tenga cada tabla: el censo tiene
  -- `nombre`; una cuota o un apunte, `concepto`; una papeleta, su número.
  sobre := coalesce(
    fila->>'nombre',
    fila->>'concepto',
    fila->>'titulo',
    nullif(fila->>'numero', ''),
    ''
  );

  v_hermandad := coalesce((fila->>'hermandad_id')::uuid, hermandad_actual());

  /*
   * SI LA HERMANDAD YA NO ESTÁ, NO SE APUNTA NADA.
   *
   * Es el caso de borrar una hermandad entera: la cascada va bajando sus
   * hermanos, cuotas y papeletas, cada baja dispara esto, y esto intentaba
   * escribir una fila de registro con el id de una hermandad que acaba de
   * desaparecer. La clave ajena lo rechazaba y se caía el borrado completo,
   * dejando la hermandad donde estaba y un error que no explicaba nada.
   *
   * No se pierde ningún rastro que hiciera falta: la tabla de registro también
   * se borra con la hermandad, así que esa fila no habría durado ni un
   * instante. Lo que conserva un borrado de estos es la copia de seguridad.
   *
   * Y el caso normal —una baja suelta, un recibo anulado— no cambia: ahí la
   * hermandad existe y se apunta igual que siempre.
   */
  if v_hermandad is null or not exists (select 1 from hermandades where id = v_hermandad) then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  insert into registro_actividad
    (hermandad_id, autor_id, autor_nombre, accion, sobre_tipo, sobre_id, sobre_nombre, detalle, origen)
  values (
    v_hermandad,
    quien,
    quien_soy_ahora(),
    que,
    tg_argv[0],
    fila->>'id',
    sobre,
    case tg_op
      when 'INSERT' then 'Creado desde la base de datos'
      when 'DELETE' then 'Borrado'
      else 'Modificado'
    end,
    'base'
  );

  return case tg_op when 'DELETE' then old else new end;
end $$;

comment on function apuntar_cambio() is
  'Escribe el registro de «quién hizo qué» (RGPD art. 32) al crear, cambiar o borrar '
  'una fila. Si la hermandad ya no existe —se está borrando entera— no apunta nada: '
  'antes intentaba escribir una fila huérfana y la clave ajena tiraba el borrado completo.';

-- =============================================================================
--   DOCUMENTOS-RESTRINGIDOS.SQL — Que el documento restringido lo sea también en la base
-- =============================================================================

-- ============================================================================
--   EL DOCUMENTO «RESTRINGIDO» LO ENTREGABA LA BASE A CUALQUIERA
-- ============================================================================
--
-- El Archivo deja marcar un documento como restringido y elegir a qué cargos:
-- «Expediente disciplinario — visible solo para Hermano Mayor y Fiscal». La
-- pantalla lo respeta, pinta el candado, y a quien no está en la lista le
-- enseña «Documento restringido» en vez del contenido.
--
-- La base de datos no pedía nada de eso. Su política de lectura decía:
--
--     using (not auth_es_hermano() and modulo_permitido('archivo'))
--
-- O sea: cualquiera con el módulo de archivo —Hermano Mayor, Secretario/a y
-- Fiscal— se llevaba TODOS los documentos, con su nombre, su categoría y su
-- descripción. Comprobado: la Secretaria, que no figura en ninguna de las dos
-- listas, recibe los dos expedientes con el título completo.
--
-- Y no hace falta ni abrir la consola. El panel carga la tabla entera para
-- pintarla, así que los documentos restringidos ya están dentro de la página y
-- en la copia del navegador: se ven abriendo el almacenamiento local, que es
-- dos clics.
--
-- ES EL MISMO FALLO DE SIEMPRE, otra vez: lo que esconde la pantalla no
-- protege nada. Ya pasó con la ficha del hermano, con las cuotas y con la web
-- pública. Aquí duele especialmente porque lo que se restringe es justo lo que
-- no puede salir: un expediente, un informe reservado, una carta del obispado.
--
-- CÓMO QUEDA
--
-- Se añade la condición que faltaba, con el mismo criterio EXACTO que la
-- pantalla: se ve si el documento no está restringido, o si tu cargo está en
-- su lista. Sin excepciones, tampoco para el cargo más alto — es lo que dice
-- el comentario de `canView` en `Archivo.tsx` y lo que promete el aviso que lee
-- la persona: «Visible solo para: …».
--
-- SI ALGUIEN SE DEJA FUERA A SÍ MISMO —restringe un documento a un cargo que
-- luego cambia de manos— deja de verlo y ya no puede editar la lista, porque
-- para editarla hay que verlo. Se sale desde aquí, desde el editor SQL:
--
--     update documentos set cargos_con_acceso = null where numero = 412;
--
-- Es a propósito que la salida esté fuera de la aplicación: si estuviera
-- dentro, no sería una restricción.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

/**
 * El cargo de quien está preguntando.
 *
 * Por los dos sitios donde puede llevarlo, y en este orden, que es el mismo que
 * usa la aplicación (`cargosEfectivos` en `lib/personal.ts`):
 *
 *   1. su fila de `personal`, que es la cuenta con la que entra al panel;
 *   2. el cargo escrito en su ficha del censo.
 *
 * Manda la de personal cuando están las dos: es la que decide qué ve al entrar.
 * Y las filas desactivadas no cuentan — a quien se le ha quitado el acceso ya
 * no lleva ese cargo.
 */
create or replace function mi_cargo() returns text
  language sql stable security definer set search_path = public as $$
    select coalesce(
      (select p.cargo from personal p
        where p.auth_user_id = auth.uid() and p.activo limit 1),
      (select h.cargo from hermanos h
        where h.auth_user_id = auth.uid() and h.cargo is not null and h.estado <> 'Baja' limit 1)
    )
  $$;
grant execute on function mi_cargo() to authenticated;

comment on function mi_cargo() is
  'El cargo de quien pregunta: primero su fila de personal (la cuenta con la que entra), '
  'y si no, el cargo de su ficha del censo. Mismo orden que cargosEfectivos() en la '
  'aplicación, para que la base y la pantalla no puedan contestar cosas distintas.';

/**
 * ¿Puedo ver este documento?
 *
 * `cargos_con_acceso` a NULL es un documento institucional: lo ve todo el que
 * tenga el módulo de archivo. Con lista, hay que estar en ella.
 *
 * Va como función y no escrita dentro de la política porque la usan las cuatro
 * —leer, crear, cambiar y borrar—, y tenerla cuatro veces es tenerla arreglada
 * en unas y rota en otras.
 */
create or replace function puedo_ver_documento(p_cargos text[]) returns boolean
  language sql stable security definer set search_path = public as $$
    select p_cargos is null
        or array_length(p_cargos, 1) is null
        or mi_cargo() = any(p_cargos)
  $$;
grant execute on function puedo_ver_documento(text[]) to authenticated;

-- LEER. Es la que de verdad estaba abierta.
drop policy if exists "documentos_staff_select" on documentos;
create policy "documentos_staff_select" on documentos for select to authenticated
  using (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  );

/*
 * Y CAMBIARLO Y BORRARLO TAMBIÉN, que si no la restricción es de mentira: sin
 * esto, quien no puede leer el expediente sí puede borrarlo, o quitarle la
 * restricción y leerlo después. `with check` mira la fila COMO QUEDA, para que
 * nadie se saque a sí mismo de la lista de un documento que sí ve y luego se
 * quede sin poder devolverlo — y sobre todo para que nadie meta un documento
 * restringido a un cargo del que no forma parte.
 */
drop policy if exists "documentos_staff_update" on documentos;
create policy "documentos_staff_update" on documentos for update to authenticated
  using (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  )
  with check (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  );

drop policy if exists "documentos_staff_delete" on documentos;
create policy "documentos_staff_delete" on documentos for delete to authenticated
  using (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  );

comment on column documentos.cargos_con_acceso is
  'Cargos que pueden ver este documento. NULL = institucional, lo ve quien tenga el '
  'módulo de archivo. Con lista, la base lo comprueba de verdad: antes solo lo hacía la '
  'pantalla, y el panel se descargaba todos los documentos igualmente.';

-- ============================================================================
--   Y EL PDF, QUE ES LO QUE DE VERDAD NO PUEDE SALIR
-- ============================================================================
--
-- Todo lo de arriba tapa LA FICHA del documento: su nombre, su categoría, su
-- descripción. Y estaba a medias, porque el expediente no es la ficha: es el
-- PDF escaneado que cuelga de ella, y ese vivía en el almacén con otra
-- política, puesta en `multi-hermandad.sql`, que solo miraba dos cosas:
--
--     bucket_id = 'documentos'
--     and split_part(name, '/', 1) = hermandad_actual()::text
--     and not auth_es_hermano()
--
-- O sea: separa una hermandad de otra —eso sí— y deja fuera al hermano de a
-- pie. Pero DENTRO de la hermandad no distingue: cualquiera de la junta se
-- descarga cualquier adjunto, incluido el del expediente que la pantalla le
-- esconde y que la política de arriba le acaba de negar.
--
-- COMPROBADO, con la Secretaria y un expediente restringido al Hermano Mayor:
--
--     la fila del expediente ..... no la ve      ✓ como debe ser
--     el PDF de ese expediente ... SÍ lo alcanza ✗
--     y al listar la carpeta ..... ve el fichero ✗ de ahí saca el id
--
-- Y ese último renglón es el que lo hace fácil: el nombre del fichero ES el id
-- del documento, así que listando la carpeta —una llamada, la misma que usa la
-- aplicación en `lib/filestore.ts`— se tiene la lista de todo lo que hay y se
-- descarga uno por uno. No hace falta adivinar nada.
--
-- Es EL MISMO FALLO DE SIEMPRE una vez más, y van unas cuantas: lo que esconde
-- la pantalla no protege nada. Aquí se había arreglado la mitad visible y se
-- había dejado abierta la que guarda el contenido.

/**
 * ¿Puedo abrir el adjunto que se llama así?
 *
 * El nombre dentro del cubo es `<hermandad>/<id del documento>`, así que del
 * propio nombre se saca a qué documento pertenece y se le pregunta lo mismo
 * que a la ficha.
 *
 * SI NO HAY FICHA, SE DEJA PASAR, y no es un descuido. El adjunto se sube
 * ANTES de crear la fila (`Archivo.tsx` sube el fichero y después guarda el
 * documento), así que en ese instante no hay ficha que consultar todavía; y si
 * el guardado se cae por el camino queda un fichero huérfano que, sin esta
 * salida, no podría borrar ni quien lo subió. No abre nada: para que un
 * adjunto restringido quedara huérfano habría que borrar su ficha, y para
 * borrarla hay que poder verla — o sea, poder abrirlo ya.
 */
create or replace function puedo_abrir_el_adjunto(p_nombre text) returns boolean
  language sql stable security definer set search_path = public as $$
    select not exists (
        select 1 from documentos d where d.id::text = split_part(p_nombre, '/', 2)
      )
      or exists (
        select 1 from documentos d
         where d.id::text = split_part(p_nombre, '/', 2)
           and puedo_ver_documento(d.cargos_con_acceso)
      )
  $$;
grant execute on function puedo_abrir_el_adjunto(text) to authenticated;

/*
 * LEER Y ESCRIBIR PIDEN COSAS DISTINTAS, y tiene que ser así.
 *
 * `using` (descargar, listar, reemplazar, borrar) sí puede preguntar por la
 * ficha: a esas alturas existe.
 *
 * `with check` (subir) NO puede, porque cuando se sube todavía no hay ficha
 * —es el orden que lleva `Archivo.tsx`—. Exigirlo ahí no cerraría ningún
 * agujero y rompería toda subida de adjuntos, que es peor que el problema.
 * Lo que sí se le añade es el módulo de archivo, que es lo que se pide en las
 * otras cuatro políticas y aquí faltaba.
 */
drop policy if exists "documentos_mi_hermandad" on storage.objects;
create policy "documentos_mi_hermandad" on storage.objects for all to authenticated
  using (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) = hermandad_actual()::text
    and not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_abrir_el_adjunto(name)
  )
  with check (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) = hermandad_actual()::text
    and not auth_es_hermano()
    and modulo_permitido('archivo')
  );

-- =============================================================================
--   WEBHOOK-STRIPE.SQL — Que la suscripción se active cuando Stripe confirma el cobro, no antes
-- =============================================================================

-- ============================================================================
--   EL WEBHOOK DE STRIPE — que el cobro se sepa cuando el dinero entra, no antes
-- ============================================================================
--
-- Hoy la suscripción se activa cuando el navegador VUELVE de Stripe a
-- `/app?suscripcion=ok`. Eso no es lo mismo que haber cobrado: si alguien
-- cierra la pestaña a mitad, si la tarjeta se rechaza después de esa pantalla,
-- o si alguien pega esa URL sin haber pagado nada, la cuenta se activa igual.
--
-- Lo correcto es que Stripe avise DIRECTAMENTE al servidor cuando el cobro se
-- confirma de verdad — eso es un webhook— y que sea esa llamada, y no la vuelta
-- del navegador, la que active la suscripción.
--
-- `activar_suscripcion(...)` ya existía para esto («se ejecuta desde el editor
-- SQL, que es lo único que corre con permisos de administrador» decía el
-- comentario), pero estaba revocada de todo el mundo — ni siquiera
-- `service_role`, que es con la que habla la función del servidor, la podía
-- llamar. Aquí se le da el permiso que le faltaba y se le añaden dos columnas
-- que la tabla `suscripciones` ya tenía preparadas (`stripe_customer_id`,
-- `stripe_subscription_id`) y que nadie rellenaba todavía.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

/**
 * Activa la suscripción, ahora también con la referencia de Stripe.
 *
 * Los dos parámetros nuevos van AL FINAL y con valor por defecto: quien ya
 * llamaba a esta función a mano desde el editor SQL —para dar de alta a una
 * hermandad sin pasar por Stripe— sigue pudiendo hacerlo exactamente igual.
 *
 * SE BORRA LA VERSIÓN VIEJA PRIMERO. `create or replace` no vale aquí porque
 * cambia la lista de parámetros: sin el `drop`, Postgres se queda con DOS
 * funciones — la de cuatro parámetros y esta, de seis— y la de cuatro se
 * queda ahí, revocada de todo el mundo, como una puerta trasera que no lleva
 * a ningún sitio pero que confunde a quien lea el esquema.
 */
drop function if exists activar_suscripcion(uuid, text, text, date);
create or replace function activar_suscripcion(
  p_hermandad_id uuid,
  p_pack text default 'todo',
  p_periodo text default 'mensual',
  p_hasta date default null,
  p_stripe_customer text default null,
  p_stripe_subscription text default null
) returns void
language sql security definer set search_path = public as $$
  insert into suscripciones
    (hermandad_id, activa, pack, periodo, desde, hasta, stripe_customer_id, stripe_subscription_id, actualizada_en)
  values
    (p_hermandad_id, true, p_pack, p_periodo, current_date, p_hasta, p_stripe_customer, p_stripe_subscription, now())
  on conflict (hermandad_id) do update set
    activa = true, pack = excluded.pack, periodo = excluded.periodo, hasta = excluded.hasta,
    -- Sin pisar con NULL: si esta llamada no trae referencia de Stripe (el
    -- alta a mano desde el editor), no se borra la que ya hubiera.
    stripe_customer_id = coalesce(excluded.stripe_customer_id, suscripciones.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, suscripciones.stripe_subscription_id),
    actualizada_en = now()
$$;
revoke execute on function activar_suscripcion(uuid, text, text, date, text, text) from public;
revoke execute on function activar_suscripcion(uuid, text, text, date, text, text) from anon, authenticated;
-- Y AQUÍ ESTABA EL AGUJERO AL REVÉS: nunca se le dio el permiso a
-- `service_role`, que es la clave con la que habla el webhook. Sin esta línea,
-- la función existía, estaba bien escrita, y NADIE la podía llamar salvo quien
-- la ejecutara a mano en el editor SQL.
grant execute on function activar_suscripcion(uuid, text, text, date, text, text) to service_role;

/**
 * Resuelve la hermandad a partir de quién pagó, y activa.
 *
 * Stripe no sabe qué es una «hermandad»: sabe qué usuario abrió la sesión de
 * pago, porque `crear-suscripcion` se lo manda como `client_reference_id`
 * (ver ese archivo). Aquí se traduce ese id de usuario a su hermandad —por la
 * tabla `titulares`, que es quien puede contratar— y se activa la suya.
 *
 * Solo `service_role`: es el webhook quien la llama, nunca el navegador.
 */
create or replace function activar_suscripcion_por_usuario(
  p_usuario uuid,
  p_pack text,
  p_periodo text,
  p_stripe_customer text,
  p_stripe_subscription text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_hermandad uuid;
begin
  select hermandad_id into v_hermandad from titulares where auth_user_id = p_usuario;
  if v_hermandad is null then
    -- No se calla: si esto pasa es que Stripe ha confirmado un cobro que no
    -- se sabe a qué hermandad corresponde, y eso hay que poder verlo en los
    -- registros de la función en vez de perderlo en silencio.
    raise exception 'No se ha encontrado ninguna hermandad para el usuario %', p_usuario;
  end if;
  perform activar_suscripcion(v_hermandad, p_pack, p_periodo, null, p_stripe_customer, p_stripe_subscription);
end $$;
revoke all on function activar_suscripcion_por_usuario(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function activar_suscripcion_por_usuario(uuid, text, text, text, text) to service_role;

/**
 * Cancela por el id de suscripción de Stripe, para cuando Stripe avisa de que
 * se ha dado de baja o ha dejado de cobrarse (`customer.subscription.deleted`).
 *
 * Si no encuentra la fila no hace nada: puede ser una suscripción de prueba
 * en el panel de Stripe, o un evento repetido, y no hay nada que romper.
 */
create or replace function cancelar_suscripcion_por_stripe(p_stripe_subscription text) returns void
language sql security definer set search_path = public as $$
  update suscripciones set activa = false, actualizada_en = now()
   where stripe_subscription_id = p_stripe_subscription
$$;
revoke all on function cancelar_suscripcion_por_stripe(text) from public, anon, authenticated;
grant execute on function cancelar_suscripcion_por_stripe(text) to service_role;

comment on column suscripciones.stripe_customer_id is
  'El cliente de Stripe que pagó. La columna ya existía; nada la rellenaba hasta el webhook.';
comment on column suscripciones.stripe_subscription_id is
  'La suscripción de Stripe. Con ella se encuentra la fila cuando Stripe avisa de un '
  'impago o una baja, sin tener que volver a preguntar por el usuario.';

-- =============================================================================
--   MANDATOS-SEPA.SQL — El mandato SEPA firmado de verdad, por el propio hermano
-- =============================================================================

-- ============================================================================
--   EL MANDATO SEPA FIRMADO DE VERDAD
-- ============================================================================
--
-- El fichero de remesa (`pain.008`) ya se generaba bien, pero el identificador
-- de mandato (`MndtId`) se INVENTABA a partir del número de hermano, y la
-- fecha de firma se ponía como el 1 de enero de su año de antigüedad — no
-- porque nadie hubiera firmado ese día, sino como valor de partida razonable
-- mientras no hubiera nada mejor. Está avisado en el propio código de
-- `lib/sepa.ts` desde el principio.
--
-- Y no es un detalle de formato. Un adeudo directo SEPA exige que exista una
-- orden firmada por el titular de la cuenta autorizando el cargo, con esa
-- referencia concreta. Sin eso, si un hermano reclama un cargo a su banco
-- —lo que en SEPA se puede hacer hasta ocho semanas después, sin dar
-- explicaciones—, la hermandad no tiene nada que enseñar.
--
-- CÓMO QUEDA: el hermano firma desde SU área, con un clic sobre el texto legal
-- del mandato, igual que ya se hace con el consentimiento del boletín. Se
-- guarda quién, cuándo, con qué IBAN y qué texto aceptó exactamente.
--
--   · SOLO EL PROPIO HERMANO FIRMA EL SUYO. Ni la secretaría, ni un
--     familiar, ni una importación pueden fabricar una firma a nombre de
--     otro: es la persona titular de la cuenta la que da la orden.
--   · Un mandato firmado NO SE REESCRIBE. Tesorería puede revocarlo —cuando
--     el hermano lo pide en persona o por teléfono—, pero no cambiarle la
--     fecha ni el texto: eso falsificaría cuándo y qué se aceptó.
--   · SIN FIRMA VIGENTE PARA SU IBAN ACTUAL, EL RECIBO NO ENTRA EN LA REMESA.
--     Igual que pasó con el IBAN sin validar (`S5`): se cae de la lista con
--     su motivo a la vista, no en silencio.
--
-- Y ES A PROPÓSITO QUE NO HAGA FALTA REVOCAR NADA CUANDO CAMBIA EL IBAN. La
-- firma queda ligada al IBAN que tenía en ese momento; si la secretaría
-- corrige la cuenta después, esa firma vieja deja de encajar con la cuenta
-- actual —y por tanto deja de contar como vigente— sin que nadie tenga que
-- acordarse de anular nada a mano. Y si el IBAN vuelve a ser el de antes, la
-- firma antigua sigue siendo válida: nunca se retiró, solo dejó de encajar un
-- tiempo.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

create table if not exists mandatos_sepa (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  hermano_id uuid not null references hermanos(id) on delete cascade,
  -- Foto del IBAN en el momento de firmar. No es el IBAN de la ficha —ese
  -- puede cambiar después—: es lo que este mandato concreto autoriza.
  iban text not null,
  -- El identificador del mandato (MndtId en el XML), único y de verdad: sale
  -- del propio id de esta fila, no de datos que puedan repetirse.
  referencia text not null,
  texto_aceptado text not null default '',
  firmado_en timestamptz not null default now(),
  -- Puesta, no NULL: «este mandato ya no vale», lo dice tesorería cuando el
  -- hermano lo pide en persona. Nunca se puede volver a NULL: si hace falta
  -- domiciliar otra vez, se firma uno nuevo.
  revocado_en timestamptz
);

alter table mandatos_sepa enable row level security;

create unique index if not exists mandatos_sepa_referencia_uniq on mandatos_sepa (referencia);
-- Por hermano y por IBAN: es exactamente lo que se pregunta al montar una
-- remesa — «¿tiene este hermano, con ESTE IBAN, un mandato vigente?».
create index if not exists mandatos_sepa_hermano_iban_idx
  on mandatos_sepa (hermano_id, iban) where revocado_en is null;

/**
 * LO QUE PONE EL SERVIDOR, PASE LO QUE PASE.
 *
 * Lista BLANCA: en un INSERT solo puede venir de un hermano firmando la suya,
 * y todo lo que trae la fila lo pone la base, no quien escribe. En un UPDATE
 * solo tesorería puede tocar algo, y solo `revocado_en`.
 */
create or replace function mandatos_sepa_firma() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_hermano hermanos%rowtype;
begin
  if tg_op = 'INSERT' then
    /*
     * LA IDENTIDAD SALE DE LA FICHA, NO DE `auth_es_hermano()`.
     *
     * `auth_es_hermano()` contesta «¿esta cuenta gestiona, o es solo un
     * hermano de a pie?» — desde `hermano-con-cargo.sql` da FALSO en cuanto
     * el hermano lleva cualquier cargo (Fiscal, Vocal, diputado de tramo...),
     * a propósito, para que esa cuenta entre por el panel y no por el área.
     * Usarla aquí como comprobación de identidad dejaba a todo hermano con
     * cargo SIN PODER FIRMAR SU PROPIA DOMICILIACIÓN: la firma exigía ser
     * «hermano de a pie», y ser fiscal, vocal o diputado no te lo quita.
     *
     * Lo que hace falta aquí no es esa pregunta, sino la otra: «¿de quién es
     * esta ficha?» — y esa la sigue contestando `hermano_propio_id()` (ver su
     * comentario en `hermano-con-cargo.sql`: «Son dos preguntas distintas:
     * ¿qué puede tocar? y ¿cuál es su ficha?»), da igual el cargo que lleve.
     * Que `v_hermano.id = new.hermano_id` sea justo lo que pide la fila ya
     * impide que nadie firme la de otro; no hace falta nada más encima.
     */
    select * into v_hermano from hermanos where auth_user_id = auth.uid();
    if v_hermano.id is null then
      raise exception 'Esta cuenta no tiene ficha de hermano.';
    end if;
    if v_hermano.id <> new.hermano_id then
      raise exception 'No puedes firmar la domiciliación de otro hermano.';
    end if;
    if coalesce(v_hermano.iban, '') = '' then
      raise exception 'Tu ficha no tiene ninguna cuenta bancaria apuntada. Pide a secretaría que la añada antes de firmar.';
    end if;

    new.hermandad_id := v_hermano.hermandad_id;
    new.hermano_id := v_hermano.id;
    new.iban := v_hermano.iban;
    new.texto_aceptado := left(coalesce(nullif(trim(new.texto_aceptado), ''),
      'Autorizo a mi hermandad a presentar adeudos SEPA en mi cuenta según la orden dada.'), 2000);
    new.firmado_en := now();
    new.revocado_en := null;
    /*
     * EL IDENTIFICADOR DEL MANDATO SALE DEL PROPIO ID DE LA FILA.
     *
     * `new.id` ya está resuelto aquí: el valor por defecto (`gen_random_uuid()`)
     * se calcula ANTES de que corra un disparador BEFORE, así que se puede leer
     * y no hay que generar nada aparte.
     *
     * Y por qué del id y no del hermano, que es lo que hacía el código viejo:
     * un hermano puede firmar más de un mandato en su vida —cambia de banco,
     * se le corrige un IBAN mal tecleado— y cada firma es un mandato DISTINTO
     * para SEPA. Reutilizar el mismo identificador para dos cuentas diferentes
     * es justo el error que tenía el código anterior.
     *
     * 'MND' (3) + el UUID sin guiones (32) = 35, que es el máximo que admite
     * `MndtId` en el estándar (`Max35Text`).
     */
    new.referencia := 'MND' || replace(new.id::text, '-', '');
    return new;
  end if;

  -- UPDATE: solo tesorería, y solo para revocar.
  if auth_es_hermano() or not (modulo_permitido('cuotas') or modulo_permitido('tesoreria')) then
    raise exception 'Un mandato firmado no se modifica. Puede revocarlo quien lleva cuotas o tesorería.';
  end if;
  new.hermandad_id := old.hermandad_id;
  new.hermano_id := old.hermano_id;
  new.iban := old.iban;
  new.referencia := old.referencia;
  new.texto_aceptado := old.texto_aceptado;
  new.firmado_en := old.firmado_en;
  -- No se puede «desrevocar»: si ya estaba puesto, se queda puesto.
  if old.revocado_en is not null then
    new.revocado_en := old.revocado_en;
  elsif new.revocado_en is null then
    new.revocado_en := old.revocado_en;
  end if;
  return new;
end $$;

drop trigger if exists mandatos_sepa_firma on mandatos_sepa;
create trigger mandatos_sepa_firma
  before insert or update on mandatos_sepa
  for each row execute function mandatos_sepa_firma();

-- ---------------------------------------------------------------------------
-- Quién ve y quién toca
-- ---------------------------------------------------------------------------

drop policy if exists "solo_mi_hermandad" on mandatos_sepa;
create policy "solo_mi_hermandad" on mandatos_sepa as restrictive for all to authenticated
  using (hermandad_id = hermandad_actual())
  with check (hermandad_id = hermandad_actual());

-- Sin `auth_es_hermano()`: esa función da falso en cuanto el hermano lleva
-- cargo, y firmar o ver la propia domiciliación no depende de si gestionas
-- algo — depende solo de que la ficha sea la tuya, que es lo que comprueba
-- `hermano_propio_id()`. Ver el comentario del disparador, arriba.
drop policy if exists "el hermano firma la suya" on mandatos_sepa;
create policy "el hermano firma la suya" on mandatos_sepa for insert to authenticated
  with check (hermano_id = hermano_propio_id());

drop policy if exists "el hermano ve las suyas" on mandatos_sepa;
create policy "el hermano ve las suyas" on mandatos_sepa for select to authenticated
  using (hermano_id = hermano_propio_id());

drop policy if exists "quien lleva cuotas los lee" on mandatos_sepa;
create policy "quien lleva cuotas los lee" on mandatos_sepa for select to authenticated
  using (not auth_es_hermano() and (modulo_permitido('cuotas') or modulo_permitido('tesoreria')));

drop policy if exists "quien lleva cuotas revoca" on mandatos_sepa;
create policy "quien lleva cuotas revoca" on mandatos_sepa for update to authenticated
  using (not auth_es_hermano() and (modulo_permitido('cuotas') or modulo_permitido('tesoreria')));

-- Sin política de DELETE, a propósito: un mandato —firmado o revocado— es un
-- registro de lo que se autorizó, y eso no se borra. Igual que el registro de
-- actividad y los avisos al hermano.
grant select, insert, update on mandatos_sepa to authenticated;

comment on table mandatos_sepa is
  'La orden SEPA que el hermano firma desde su área, ligada al IBAN que tenía en ese '
  'momento. Antes el identificador de mandato y su fecha se inventaban a partir del '
  'número de hermano; sin un mandato de verdad, un cargo reclamado al banco no tenía '
  'nada detrás que enseñar.';

-- =============================================================================
--   ENCARGOS-REDES.SQL — Encargar un post y que se reparta solo entre la junta
-- =============================================================================

-- ============================================================================
--   ENCARGAR UN POST Y QUE SE REPARTA SOLO
-- ============================================================================
--
-- Lo que se pedía, tal cual: el Hermano Mayor —o quien lleve redes— encarga un
-- post, y de ese encargo salen SOLAS las tareas que hacen falta: escribirlo,
-- subirlo a Facebook, subirlo a Instagram. Cada una con su responsable, y cada
-- responsable lo ve en SU área, sin tener que entrar al panel.
--
-- POR QUÉ UNA FILA POR TAREA Y NO UNA POR ENCARGO. Porque lo que se asigna, se
-- hace y se marca no es «el post»: es «subirlo a Instagram». Con una fila por
-- encargo habría que meter dentro una lista de tareas, y entonces dos personas
-- marcando la suya a la vez se pisarían — la última en guardar borraría lo que
-- acababa de marcar la otra. Con una fila por tarea, cada una es suya y no hay
-- forma de pisarse.
--
-- `encargo_id` es lo que las mantiene juntas: todas las tareas que salieron del
-- mismo encargo lo llevan igual, así se pueden enseñar agrupadas.
--
--   · LA ASIGNA QUIEN LLEVA REDES. Un hermano no puede repartirse trabajo a sí
--     mismo ni cambiarle la tarea a otro.
--   · Y EL RESPONSABLE SOLO PUEDE DECIR «HECHO». No puede reasignarla, ni
--     cambiar el texto, ni borrarla: si algo no cuadra, se habla con quien la
--     encargó. Lo que se apunta es quién la hizo y cuándo.
--   · SIN BORRADO PARA NADIE, igual que el registro de actividad: un encargo
--     hecho es lo que demuestra que se hizo.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

create table if not exists tareas_redes (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  -- Lo que agrupa las tareas que salieron del mismo encargo.
  encargo_id uuid not null,
  titulo text not null,
  -- El texto del post, para que quien lo suba no tenga que pedirlo por WhatsApp.
  texto text not null default '',
  /*
   * QUÉ HAY QUE HACER. «crear» es escribirlo y preparar la foto; «publicar» es
   * subirlo a una red concreta. Se guarda separado del nombre de la red porque
   * la tarea de crear no tiene red: es una sola para todo el encargo.
   */
  que text not null check (que in ('crear', 'publicar')),
  red text,
  -- A quién le toca. Puede ir vacía: un encargo se puede dejar preparado y
  -- repartir después.
  hermano_id uuid references hermanos(id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecha')),
  creado_en timestamptz not null default now(),
  hecha_en timestamptz,
  -- Quién la dio por hecha. No es lo mismo que `hermano_id`: quien lleva redes
  -- puede cerrarla él si la tarea se hizo por otra vía.
  hecha_por uuid references hermanos(id) on delete set null,
  notas text not null default ''
);

alter table tareas_redes enable row level security;

-- Por responsable y estado: es lo que se pregunta al pintar el área del
-- hermano —«¿qué tengo pendiente?»— y se hace en cada visita suya.
create index if not exists tareas_redes_mias_idx
  on tareas_redes (hermano_id, estado) where estado = 'pendiente';
create index if not exists tareas_redes_encargo_idx on tareas_redes (encargo_id);

/**
 * LO QUE PONE EL SERVIDOR, PASE LO QUE PASE.
 *
 * Lista BLANCA otra vez, como en `mandatos_sepa`: al crear, todo lo que no sea
 * el contenido del encargo lo pone la base; al modificar, se mira QUIÉN es y
 * solo se le deja tocar lo suyo.
 */
create or replace function tareas_redes_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid;
  v_lleva_redes boolean;
begin
  v_yo := hermano_propio_id();
  /*
   * QUIÉN LLEVA REDES. Se pregunta por el módulo, no por el cargo: así una
   * hermandad que le da «comunicados» a su vocal de juventud no tiene que
   * pedirle permiso a nadie para que pueda repartir posts.
   *
   * `hermano_propio_id()` y no `auth_es_hermano()`, y esto ya costó un fallo
   * en los mandatos SEPA: `auth_es_hermano()` da FALSO en cuanto el hermano
   * lleva cargo, y aquí los responsables son justo esos — la junta. Sirve para
   * saber si alguien gestiona, no para saber de quién es una ficha.
   */
  v_lleva_redes := modulo_permitido('comunicados') or modulo_permitido('web');

  if tg_op = 'INSERT' then
    if not v_lleva_redes then
      raise exception 'Solo quien lleva comunicados o la web puede encargar un post.';
    end if;
    new.hermandad_id := hermandad_actual();
    new.estado := 'pendiente';
    new.creado_en := now();
    new.hecha_en := null;
    new.hecha_por := null;
    -- Una tarea de crear no es de ninguna red, y una de publicar necesita
    -- saber a cuál. Sin esto se cuelan tareas que no dicen qué hacer.
    if new.que = 'crear' then new.red := null;
    elsif coalesce(trim(new.red), '') = '' then
      raise exception 'Una tarea de publicar tiene que decir en qué red.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    /*
     * Salvo cuando se va la hermandad entera: `hermandad_id` es `on delete
     * cascade`, y esa cascada pasa por aquí.
     *
     * Sin esto, una hermandad con un solo encargo no se puede borrar, y el
     * error que sale —«Un encargo no se borra»— manda a mirar al sitio
     * equivocado. Muerde justo en `BORRAR-PRUEBAS.sql`, que es el archivo que
     * se ejecuta para quitar las hermandades de prueba cuando entra la primera
     * de verdad. Es exactamente el mismo tropiezo que ya cuenta
     * `borrar-una-hermandad.sql`, con otra tabla.
     *
     * Se reconoce porque la hermandad YA NO ESTÁ: la fila se acaba de borrar
     * en esta misma orden. Nadie puede colarse por aquí para borrar un
     * encargo suelto sin llevarse la hermandad por delante.
     */
    if not exists (select 1 from hermandades where id = old.hermandad_id) then
      return old;
    end if;
    raise exception 'Un encargo no se borra. Si ya no hace falta, márcalo como hecho con una nota.';
  end if;

  /*
   * PRIMERO: ¿ES LA PROPIA BASE LIMPIANDO TRAS UN BORRADO?
   *
   * `hermano_id` y `hecha_por` llevan `on delete set null`. Cuando se da de
   * baja a un hermano, Postgres lanza UN UPDATE sobre esta tabla para dejarlos
   * a nulo — y ese UPDATE pasa por aquí, con el permiso de quien esté
   * borrando.
   *
   * Y quien borra hermanos es quien lleva el módulo «hermanos»: el Diputado
   * Mayor de Gobierno, por ejemplo, que NO lleva redes. Así que caía en la
   * rama de abajo y se llevaba un «Esta tarea no es tuya», que además no
   * explica nada. Resultado: no se podía dar de baja a un hermano que tuviera
   * un encargo abierto, y el mensaje mandaba a mirar al sitio equivocado.
   *
   * Se reconoce por su forma exacta: el hermano al que apuntaba YA NO EXISTE
   * (la fila se acaba de borrar en esta misma orden) y lo único que cambia es
   * ese campo. Un responsable no puede colarse por aquí para quitarse la
   * tarea de encima: tendría que borrarse a sí mismo del censo primero.
   */
  if (old.hermano_id is not null and new.hermano_id is null
      and not exists (select 1 from hermanos where id = old.hermano_id))
     or (old.hecha_por is not null and new.hecha_por is null
      and not exists (select 1 from hermanos where id = old.hecha_por)) then
    if new.hermandad_id is not distinct from old.hermandad_id
       and new.encargo_id is not distinct from old.encargo_id
       and new.titulo is not distinct from old.titulo
       and new.texto is not distinct from old.texto
       and new.que is not distinct from old.que
       and new.red is not distinct from old.red
       and new.estado is not distinct from old.estado
       and new.creado_en is not distinct from old.creado_en
       and new.notas is not distinct from old.notas then
      return new;
    end if;
  end if;

  -- UPDATE. Dos permisos distintos y muy desiguales.
  if v_lleva_redes then
    -- Quien lleva redes puede reasignar y corregir el texto. Lo único que no
    -- puede es cambiar de hermandad ni inventarse cuándo se creó.
    new.hermandad_id := old.hermandad_id;
    new.creado_en := old.creado_en;
    new.encargo_id := old.encargo_id;
  else
    /*
     * EL RESPONSABLE SOLO PUEDE DECIR «HECHO».
     *
     * Ni reasignarla, ni cambiarle el texto, ni quitársela de encima
     * dejándola sin dueño. Todo vuelve a como estaba menos el estado.
     */
    if v_yo is null or old.hermano_id is distinct from v_yo then
      raise exception 'Esta tarea no es tuya.';
    end if;
    new.hermandad_id := old.hermandad_id;
    new.encargo_id := old.encargo_id;
    new.titulo := old.titulo;
    new.texto := old.texto;
    new.que := old.que;
    new.red := old.red;
    new.hermano_id := old.hermano_id;
    new.creado_en := old.creado_en;
    new.notas := old.notas;
  end if;

  -- La fecha y el autor de «hecho» los pone la base, los toque quien los toque.
  if new.estado = 'hecha' and old.estado <> 'hecha' then
    new.hecha_en := now();
    new.hecha_por := coalesce(v_yo, old.hecha_por);
  elsif new.estado = 'pendiente' then
    -- Se puede reabrir —el post salió mal y hay que rehacerlo— y entonces se
    -- limpia el rastro anterior en vez de dejar una fecha que ya no es de nada.
    new.hecha_en := null;
    new.hecha_por := null;
  else
    new.hecha_en := old.hecha_en;
    new.hecha_por := old.hecha_por;
  end if;
  return new;
end $$;

drop trigger if exists tareas_redes_guardia on tareas_redes;
create trigger tareas_redes_guardia
  before insert or update or delete on tareas_redes
  for each row execute function tareas_redes_guardia();

-- ---------------------------------------------------------------------------
-- Quién ve y quién toca
-- ---------------------------------------------------------------------------

drop policy if exists "solo_mi_hermandad" on tareas_redes;
create policy "solo_mi_hermandad" on tareas_redes as restrictive for all to authenticated
  using (hermandad_id = hermandad_actual())
  with check (hermandad_id = hermandad_actual());

-- Quien lleva redes: lo ve todo y lo reparte.
drop policy if exists "redes_lee" on tareas_redes;
create policy "redes_lee" on tareas_redes for select to authenticated
  using (modulo_permitido('comunicados') or modulo_permitido('web'));

drop policy if exists "redes_encarga" on tareas_redes;
create policy "redes_encarga" on tareas_redes for insert to authenticated
  with check (modulo_permitido('comunicados') or modulo_permitido('web'));

drop policy if exists "redes_reparte" on tareas_redes;
create policy "redes_reparte" on tareas_redes for update to authenticated
  using (modulo_permitido('comunicados') or modulo_permitido('web'));

/*
 * Y EL RESPONSABLE VE LA SUYA Y LA CIERRA. Sin `auth_es_hermano()` a
 * propósito: los responsables de esto son la junta, y esa función da falso en
 * cuanto alguien lleva cargo. Lo que hace falta saber aquí es de quién es la
 * tarea, y eso lo contesta `hermano_propio_id()`.
 */
drop policy if exists "el responsable ve la suya" on tareas_redes;
create policy "el responsable ve la suya" on tareas_redes for select to authenticated
  using (hermano_id = hermano_propio_id());

drop policy if exists "el responsable la cierra" on tareas_redes;
create policy "el responsable la cierra" on tareas_redes for update to authenticated
  using (hermano_id = hermano_propio_id());

-- Sin política de DELETE, a propósito: lo dice también el disparador.
grant select, insert, update on tareas_redes to authenticated;

comment on table tareas_redes is
  'Las tareas que salen de encargar un post: escribirlo y subirlo a cada red. Una fila '
  'por tarea y no por encargo, para que dos responsables marcando la suya a la vez no '
  'se pisen. `encargo_id` las mantiene juntas.';

-- =============================================================================
--   TIENDA.SQL — La tienda: productos, ventas, stock y los asientos que generan
-- =============================================================================

-- ============================================================================
--   LA TIENDA DE LA HERMANDAD
-- ============================================================================
--
-- Vender merchandising —camisetas, medallas, llaveros, el libro del centenario—
-- es una fuente de ingresos real y hasta ahora no estaba en ningún sitio: se
-- llevaba en una libreta y se metía en Tesorería a final de mes, a ojo. Con eso
-- no se sabe qué se vende, qué queda ni cuánto se gana.
--
-- LO QUE HAY AQUÍ. Cuatro tablas y una función:
--
--   · `productos`         la ficha de cada artículo: código, precio, coste,
--                         IVA, cuántos quedan y por debajo de cuántos avisar.
--   · `ventas`            una por operación, con su número de factura.
--   · `lineas_venta`      lo que llevaba cada venta, con FOTO del producto.
--   · `movimientos_stock` por qué subió o bajó el stock: venta, rotura, compra…
--   · `descuentos`        rebajas por colectivo (los costaleros, los del coro…).
--   · `registrar_venta()` la que lo hace TODO de una vez, y es el corazón.
--
-- POR QUÉ UNA FUNCIÓN Y NO ESCRIBIR DESDE LA APLICACIÓN. Una venta son seis
-- cosas que tienen que pasar juntas o no pasar: coger el número de factura,
-- guardar la venta, guardar sus líneas, bajar el stock, apuntar por qué bajó,
-- y dejar los dos asientos en Tesorería. Hechas desde el navegador, una
-- conexión que se corta a la mitad deja stock descontado sin venta, o una
-- factura con un número que otro ya usó.
--
-- Y hay dos cosas que NO se pueden hacer desde el navegador de ninguna manera:
--
--   1. EL NÚMERO DE FACTURA. Tiene que ser correlativo y sin huecos. Calculado
--      con un `max()+1` desde dos mostradores a la vez, salen dos facturas con
--      el mismo número. Aquí se coge con un cerrojo.
--   2. QUE NO SE VENDA LO QUE NO HAY. Dos personas cobrando la última camiseta
--      a la vez la venden las dos. Aquí el stock se descuenta con la fila
--      bloqueada.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Los productos
-- ----------------------------------------------------------------------------
--
-- OJO, ESTO NO ES `enseres`. Aquel es el patrimonio de la hermandad —la cruz de
-- guía, los faldones, los ciriales—: cosas que se inventarían, se aseguran y
-- se restauran, y que no se venden nunca. Esto es género para vender. Mezclar
-- las dos cosas en una tabla haría que un candelabro del siglo XVIII apareciera
-- en el listado de la tienda con un precio.
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  -- El código de artículo que la hermandad usa en su etiqueta. Único dentro de
  -- la hermandad, no en toda la base: dos hermandades pueden llamar «CAM-01» a
  -- su camiseta y las dos tienen razón.
  codigo text not null,
  nombre text not null,
  descripcion text not null default '',
  /*
   * EL PRECIO ES CON IVA INCLUIDO, que es lo que se dice en el mostrador y lo
   * que el hermano ve en la etiqueta. La base imponible y la cuota de IVA se
   * calculan a partir de él para la factura.
   *
   * Al revés —guardar la base y sumar el IVA— obliga a quien da de alta un
   * producto a hacer una división para poner «12,40» cuando lo que quiere es
   * vender a 15. Es la fuente de erratas más tonta que hay.
   */
  precio numeric(10, 2) not null default 0,
  -- Lo que le costó a la hermandad. De aquí sale el beneficio y el asiento de
  -- gasto cuando se vende.
  coste numeric(10, 2) not null default 0,
  -- El IVA que se repercute. Una hermandad exenta lo deja en 0 y la factura
  -- sale sin desglose.
  iva numeric(5, 2) not null default 21 check (iva >= 0 and iva <= 100),
  stock int not null default 0,
  -- Por debajo de esto se avisa a quien lleva el inventario. 0 = no avisar.
  stock_minimo int not null default 0,
  activo boolean not null default true,
  -- Si sale o no en la tienda de la web pública.
  visible_en_web boolean not null default false,
  foto_url text,
  creado_en timestamptz not null default now(),
  unique (hermandad_id, codigo)
);
create index if not exists productos_hermandad_idx on productos (hermandad_id, activo);

comment on column productos.precio is
  'PVP con IVA incluido: es lo que se dice en el mostrador. La base y la cuota se calculan a partir de él.';
comment on column productos.stock_minimo is
  'Por debajo de esta cantidad se avisa a quien lleva el módulo de inventario. 0 = no avisar.';


-- ----------------------------------------------------------------------------
-- 2. Los descuentos por colectivo
-- ----------------------------------------------------------------------------
--
-- «A los costaleros, la camiseta a mitad de precio.» Se resuelve por las
-- etiquetas que ya lleva la ficha del hermano, que es donde la hermandad tiene
-- escrito quién es costalero, quién va en el coro y quién es acólito. Sin
-- inventar una segunda lista que habría que mantener aparte y que se quedaría
-- vieja.
create table if not exists descuentos (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  nombre text not null,
  porcentaje numeric(5, 2) not null default 0 check (porcentaje >= 0 and porcentaje <= 100),
  -- La etiqueta de la ficha que da derecho a él. Vacío = cualquier hermano.
  etiqueta text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index if not exists descuentos_hermandad_idx on descuentos (hermandad_id, activo);

/*
 * A QUIÉN LE TOCA UN DESCUENTO: UNA SOLA DEFINICIÓN DEL CRITERIO.
 *
 * Estaba escrito dentro de `registrar_venta`, y con el descuento llegando
 * también a la web pública habría acabado escrito TRES VECES: aquí, en el
 * catálogo y en la reserva. Tres sitios donde decidir lo mismo son tres sitios
 * donde se puede decidir distinto, y entonces la web promete un precio y el
 * mostrador cobra otro.
 *
 * Devuelve el porcentaje, o `null` si no le toca. `null` y no cero a propósito:
 * son dos cosas distintas —«no le corresponde» y «le corresponde un 0 %»— y de
 * esa diferencia depende que `registrar_venta` rechace la venta o la deje pasar.
 */
create or replace function pct_de_descuento(
  p_hermandad_id uuid,
  p_descuento_id uuid,
  p_hermano_id uuid
) returns numeric
language sql stable security definer set search_path = public as $$
  select d.porcentaje
    from descuentos d
   where d.id = p_descuento_id
     and d.hermandad_id = p_hermandad_id
     and d.activo
     and (
       -- Sin etiqueta vale para cualquier hermano… pero hermano tiene que ser:
       -- los descuentos son de la hermandad para su gente.
       (d.etiqueta is null and p_hermano_id is not null)
       or (p_hermano_id is not null and exists (
            select 1 from hermanos h
             where h.id = p_hermano_id
               and h.hermandad_id = p_hermandad_id
               and h.estado <> 'Baja'
               and d.etiqueta = any (coalesce(h.etiquetas, array[]::text[]))
          ))
     )
$$;

comment on function pct_de_descuento(uuid, uuid, uuid) is
  'El porcentaje de un descuento SI le corresponde a ese hermano, y null si no. Es el único sitio '
  'donde se decide: lo usan el mostrador, el catálogo de la web y la reserva.';

/*
 * Y EL MEJOR QUE LE TOCA, cuando no lo elige nadie a mano.
 *
 * En el mostrador el descuento lo elige una persona de una lista. En la web no
 * hay nadie que elija, así que hay que decidirlo: SE APLICA UNO SOLO, EL MAYOR.
 *
 * No es una comodidad, es lo único que la factura puede representar: `ventas`
 * tiene una columna `descuento_id`, no una tabla puente. Prometer en la web una
 * suma de descuentos que la factura no puede explicar es prometer mal.
 *
 * A igualdad de porcentaje, el más antiguo: así el número no baila de un día
 * para otro por haber creado otro descuento igual.
 */
create or replace function mejor_descuento_para(p_hermandad_id uuid, p_hermano_id uuid)
returns table (id uuid, porcentaje numeric)
language sql stable security definer set search_path = public as $$
  select d.id, d.porcentaje
    from descuentos d
   where d.hermandad_id = p_hermandad_id
     and d.activo
     and pct_de_descuento(p_hermandad_id, d.id, p_hermano_id) is not null
   order by d.porcentaje desc, d.creado_en
   limit 1
$$;

comment on function mejor_descuento_para(uuid, uuid) is
  'El descuento activo de mayor porcentaje que le corresponde a un hermano. Uno solo: la factura '
  'guarda un descuento, no una lista.';

/*
 * Ninguna de las dos se le concede a `anon`. La web pública nunca las llama
 * directamente: las llaman `catalogo_web` y `crear_reserva_web`, que son
 * `security definer` y por tanto las ejecutan como su dueño. Concedérselas
 * sería dejar preguntar «¿qué descuento tiene el hermano tal?» desde la consola
 * del navegador.
 */
revoke all on function pct_de_descuento(uuid, uuid, uuid) from public, anon;
revoke all on function mejor_descuento_para(uuid, uuid) from public, anon;
grant execute on function pct_de_descuento(uuid, uuid, uuid) to authenticated;
grant execute on function mejor_descuento_para(uuid, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Las ventas
-- ----------------------------------------------------------------------------
create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  /*
   * NÚMERO DE FACTURA, correlativo y sin huecos dentro de su serie.
   *
   * No es una manía: una numeración con saltos o repetida es lo primero que
   * mira una inspección. Lo asigna `registrar_venta()` con un cerrojo, nunca
   * la aplicación.
   */
  serie text not null default 'A',
  numero int not null,
  canal text not null default 'fisica' check (canal in ('fisica', 'online')),
  forma_pago text not null default 'Efectivo',
  -- A quién se le vendió, si es hermano. Vacío = una venta de mostrador a
  -- alguien de fuera.
  hermano_id uuid references hermanos(id) on delete set null,
  -- Los datos fiscales van COPIADOS, no enlazados: una factura no puede cambiar
  -- porque el comprador se mude o se corrija su NIF tres años después.
  comprador_nombre text not null default '',
  comprador_nif text not null default '',
  comprador_direccion text not null default '',
  descuento_id uuid references descuentos(id) on delete set null,
  descuento_pct numeric(5, 2) not null default 0,
  -- Los tres importes, cerrados en el momento de cobrar.
  base numeric(10, 2) not null default 0,
  iva_total numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  -- Lo que le costó a la hermandad lo vendido. De aquí sale el asiento de gasto
  -- y el beneficio de las gráficas.
  coste_total numeric(10, 2) not null default 0,
  estado text not null default 'Cobrada' check (estado in ('Cobrada', 'Anulada')),
  fecha timestamptz not null default now(),
  notas text not null default '',
  unique (hermandad_id, serie, numero)
);
create index if not exists ventas_hermandad_fecha_idx on ventas (hermandad_id, fecha desc);
create index if not exists ventas_hermano_idx on ventas (hermano_id) where hermano_id is not null;


-- ----------------------------------------------------------------------------
-- 4. Lo que llevaba cada venta
-- ----------------------------------------------------------------------------
--
-- CON FOTO DEL PRODUCTO, y esto es lo importante de esta tabla. El nombre, el
-- precio y el coste se copian aquí tal como estaban al vender. Si mañana sube
-- el precio de la camiseta, o se corrige su nombre, o se borra el producto
-- entero, la factura de hace dos años tiene que seguir diciendo exactamente lo
-- que decía. Una factura que cambia sola no es una factura.
create table if not exists lineas_venta (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  venta_id uuid not null references ventas(id) on delete cascade,
  -- Se conserva el enlace para poder mirar «qué se ha vendido de esto», pero la
  -- factura no depende de él: por eso `set null` y no `cascade`.
  producto_id uuid references productos(id) on delete set null,
  codigo text not null,
  nombre text not null,
  cantidad int not null check (cantidad > 0),
  -- Lo que se cobró de verdad por unidad, ya con el descuento o la rebaja.
  precio_unitario numeric(10, 2) not null,
  -- Y lo que ponía en la ficha, para poder ver qué se rebajó y cuánto.
  precio_tarifa numeric(10, 2) not null default 0,
  coste_unitario numeric(10, 2) not null default 0,
  iva numeric(5, 2) not null default 21
);
create index if not exists lineas_venta_venta_idx on lineas_venta (venta_id);
create index if not exists lineas_venta_producto_idx on lineas_venta (producto_id);


-- ----------------------------------------------------------------------------
-- 5. Por qué subió o bajó el stock
-- ----------------------------------------------------------------------------
--
-- El stock del producto es un número, y un número solo no explica nada. Cuando
-- al final de la temporada faltan nueve camisetas, la pregunta no es «cuántas
-- quedan» sino «dónde han ido»: vendidas, rotas, regaladas en el cabildo, o
-- nunca llegaron de la imprenta. Esta tabla es la respuesta.
create table if not exists movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  tipo text not null check (tipo in ('compra', 'venta', 'rotura', 'ajuste', 'devolucion')),
  -- Positivo entra, negativo sale. Guardar el signo aquí —en vez de deducirlo
  -- del tipo— deja hacer un ajuste en los dos sentidos sin inventar dos tipos.
  cantidad int not null check (cantidad <> 0),
  motivo text not null default '',
  venta_id uuid references ventas(id) on delete set null,
  quien uuid references hermanos(id) on delete set null,
  fecha timestamptz not null default now()
);
create index if not exists movimientos_stock_producto_idx on movimientos_stock (producto_id, fecha desc);


-- ----------------------------------------------------------------------------
-- 6. Quién puede tocar qué
-- ----------------------------------------------------------------------------
--
-- El módulo es `inventario`, el mismo que ya lleva los enseres: quien lleva el
-- inventario de la hermandad lleva también el género de la tienda. No se crea
-- un módulo nuevo para no obligar a cada hermandad a repartir permisos otra vez.
--
-- Y `tesoreria` puede LEER las ventas aunque no lleve inventario: de ellas
-- salen los asientos del libro, y quien cuadra las cuentas tiene que poder ver
-- de dónde vino cada uno.

alter table productos enable row level security;
alter table descuentos enable row level security;
alter table ventas enable row level security;
alter table lineas_venta enable row level security;
alter table movimientos_stock enable row level security;

do $$
declare t text;
begin
  foreach t in array array['productos', 'descuentos', 'ventas', 'lineas_venta', 'movimientos_stock'] loop
    execute format('drop policy if exists "solo_mi_hermandad" on %I', t);
    execute format(
      'create policy "solo_mi_hermandad" on %I as restrictive for all to authenticated '
      'using (hermandad_id = hermandad_actual()) with check (hermandad_id = hermandad_actual())', t);

    execute format('drop policy if exists "tienda_gestiona" on %I', t);
    execute format(
      'create policy "tienda_gestiona" on %I for all to authenticated '
      'using (modulo_permitido(''inventario'')) with check (modulo_permitido(''inventario''))', t);

    execute format('drop policy if exists "tesoreria_lee" on %I', t);
    execute format(
      'create policy "tesoreria_lee" on %I for select to authenticated '
      'using (modulo_permitido(''tesoreria'') or modulo_permitido(''informes''))', t);

    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

/*
 * Y EL HERMANO VE LO QUE HA COMPRADO ÉL, y solo eso.
 *
 * `hermano_propio_id()` y no `auth_es_hermano()`: esto ya costó un fallo en los
 * mandatos SEPA. `auth_es_hermano()` da FALSO en cuanto el hermano lleva un
 * cargo, y el Hermano Mayor también compra camisetas.
 */
drop policy if exists "el hermano ve lo suyo" on ventas;
create policy "el hermano ve lo suyo" on ventas for select to authenticated
  using (hermano_id = hermano_propio_id());

drop policy if exists "el hermano ve sus lineas" on lineas_venta;
create policy "el hermano ve sus lineas" on lineas_venta for select to authenticated
  using (exists (
    select 1 from ventas v where v.id = venta_id and v.hermano_id = hermano_propio_id()
  ));

-- El catálogo de la tienda lo puede ver cualquiera que haya entrado: hace falta
-- para la tienda de la web y para que el hermano vea qué hay. Solo lo visible y
-- lo activo; el coste NO se enseña aquí (ver la vista de abajo).
drop policy if exists "el catalogo se ve" on productos;
create policy "el catalogo se ve" on productos for select to authenticated
  using (activo and visible_en_web);


-- ----------------------------------------------------------------------------
-- 7. El catálogo público, SIN el coste
-- ----------------------------------------------------------------------------
--
-- La política de arriba abre la fila entera, y en la fila está `coste`. Que
-- cualquier hermano pueda ver lo que le cuesta a la hermandad cada camiseta no
-- es una fuga de datos personales, pero es información de negocio que no tiene
-- por qué salir de la junta —y en un pueblo, el margen de la hermandad es
-- conversación de barra—.
--
-- Esta vista es lo que lee la tienda: las mismas filas sin las columnas que no
-- le importan a quien compra.
create or replace view catalogo_tienda
with (security_invoker = true) as
  select id, hermandad_id, codigo, nombre, descripcion, precio, iva, stock,
         (stock > 0) as hay_existencias, foto_url
    from productos
   where activo and visible_en_web;

grant select on catalogo_tienda to authenticated, anon;

comment on view catalogo_tienda is
  'El catálogo tal como lo ve quien compra: sin `coste` ni `stock_minimo`. '
  '`security_invoker` para que siga aplicando la RLS de `productos`.';


-- ----------------------------------------------------------------------------
-- 8. REGISTRAR UNA VENTA: todo o nada
-- ----------------------------------------------------------------------------
--
-- Una venta son seis cosas que tienen que pasar juntas o no pasar:
--
--   1. coger el número de factura,
--   2. guardar la venta,
--   3. guardar sus líneas con la foto del producto,
--   4. bajar el stock,
--   5. apuntar por qué bajó,
--   6. y dejar los DOS asientos en Tesorería.
--
-- LOS DOS ASIENTOS, y esto se habló y se decidió: ingreso por lo COBRADO y
-- gasto por lo que COSTÓ el género. Vendida una camiseta de 15 € que costó 6:
-- ingreso 15, gasto 6. La caja cuadra con el banco y el beneficio (9 €) sale
-- calculado en las gráficas de la tienda.
--
-- La otra forma —ingreso por el beneficio y gasto por el coste— deja la caja en
-- −2 € vendiendo algo por lo que han entrado 15, y el Estado de Cuentas del
-- cabildo diría que la hermandad tiene menos dinero del que tiene.
--
-- Y DOS COSAS QUE NO SE PUEDEN HACER DESDE EL NAVEGADOR:
--
--   · EL NÚMERO DE FACTURA tiene que ser correlativo y sin huecos. Con un
--     `max()+1` desde dos mostradores a la vez salen dos facturas con el mismo
--     número, y una numeración repetida es lo primero que mira una inspección.
--   · QUE NO SE VENDA LO QUE NO HAY. Dos personas cobrando la última camiseta
--     a la vez la venden las dos, y una de las dos se queda esperando un pedido
--     que no existe.
--
-- Las dos se resuelven aquí con cerrojos, dentro de una sola transacción.
create or replace function registrar_venta(
  p_lineas jsonb,                        -- [{producto_id, cantidad, precio_unitario?}]
  p_canal text default 'fisica',
  p_forma_pago text default 'Efectivo',
  p_hermano_id uuid default null,
  p_descuento_id uuid default null,
  p_comprador_nombre text default '',
  p_comprador_nif text default '',
  p_comprador_direccion text default '',
  p_notas text default '',
  p_serie text default 'A'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_yo uuid := hermano_propio_id();
  v_venta uuid;
  v_numero int;
  v_pct numeric(5, 2) := 0;
  v_linea jsonb;
  v_prod productos%rowtype;
  v_cant int;
  v_precio numeric(10, 2);
  v_bruto numeric(10, 2);
  v_base numeric(10, 2) := 0;
  v_iva numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_coste numeric(10, 2) := 0;
  v_base_linea numeric(10, 2);
  v_num_mov int;
  v_disp int;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede registrar ventas.';
  end if;
  if v_hermandad is null then
    raise exception 'No se sabe de qué hermandad es esta venta.';
  end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Una venta sin artículos no es una venta.';
  end if;

  /*
   * EL DESCUENTO SE COMPRUEBA AQUÍ, no se acepta el que mande el navegador.
   * Si no, cualquiera con la consola abierta se aplica el 50 % de costaleros
   * sin serlo. Tiene que estar activo, ser de esta hermandad, y —si va por
   * etiqueta— el comprador tiene que llevarla en su ficha.
   */
  if p_descuento_id is not null then
    v_pct := pct_de_descuento(v_hermandad, p_descuento_id, p_hermano_id);
    if v_pct is null then
      raise exception 'Ese descuento no se le puede aplicar a esta venta.';
    end if;
  end if;

  /*
   * EL NÚMERO DE FACTURA, con cerrojo de transacción.
   *
   * `pg_advisory_xact_lock` y no `for update` sobre las ventas: no hay ninguna
   * fila que bloquear cuando es la primera venta de la serie. El cerrojo se
   * suelta solo al terminar la transacción, salga bien o mal.
   */
  perform pg_advisory_xact_lock(hashtext(v_hermandad::text || '|' || p_serie));
  select coalesce(max(v.numero), 0) + 1 into v_numero
    from ventas v where v.hermandad_id = v_hermandad and v.serie = p_serie;

  insert into ventas (
    hermandad_id, serie, numero, canal, forma_pago, hermano_id,
    comprador_nombre, comprador_nif, comprador_direccion,
    descuento_id, descuento_pct, notas
  ) values (
    v_hermandad, p_serie, v_numero, p_canal, p_forma_pago, p_hermano_id,
    p_comprador_nombre, p_comprador_nif, p_comprador_direccion,
    p_descuento_id, v_pct, p_notas
  ) returning id into v_venta;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cant := coalesce((v_linea ->> 'cantidad')::int, 0);
    if v_cant <= 0 then
      raise exception 'Una línea sin cantidad no se puede vender.';
    end if;

    -- `for update`: se bloquea la fila del producto hasta el final. Es lo que
    -- impide que dos mostradores vendan la misma última unidad.
    select * into v_prod from productos p
     where p.id = (v_linea ->> 'producto_id')::uuid
       and p.hermandad_id = v_hermandad
     for update;
    if not found then
      raise exception 'Ese artículo no está en el catálogo de la hermandad.';
    end if;
    /*
     * SE MIRA LO DISPONIBLE, NO LO QUE HAY EN LA ESTANTERÍA.
     *
     * Aquí ponía `v_prod.stock < v_cant`, y con eso el mostrador vendía sin
     * pestañear las dos camisetas que alguien había apartado por la web para
     * pasar a recogerlas el sábado. `stock` sigue diciendo 2 hasta que la
     * reserva se entrega, así que la caja no veía nada raro.
     *
     * Pasaban las dos cosas malas a la vez: quien reservó venía el sábado y no
     * había nada —con su resguardo y su referencia en la mano—, y la reserva se
     * quedaba IMPOSIBLE DE ENTREGAR, porque al intentarlo esta misma línea
     * decía que no queda género. Pendiente para siempre, bloqueando existencias
     * que ya no existen.
     *
     * El `for update` de arriba ya serializa: la cuenta que se hace aquí ve lo
     * que el mostrador de al lado acabe de confirmar, no una foto vieja.
     */
    v_disp := disponible_de(v_prod.id);
    if v_disp < v_cant then
      raise exception 'De «%» solo quedan % sin apartar: hay % en la estantería y % comprometidas por la web.',
        v_prod.nombre, greatest(v_disp, 0), v_prod.stock, v_prod.stock - v_disp;
    end if;

    /*
     * EL PRECIO. Si viene uno a mano —«te lo dejo en diez»— manda ese y el
     * descuento por colectivo no se suma encima: rebajar dos veces sobre una
     * rebaja que ya se ha decidido a ojo no lo espera nadie. Si no viene, se
     * aplica el porcentaje del descuento sobre el de la ficha.
     */
    if (v_linea ? 'precio_unitario') and (v_linea ->> 'precio_unitario') is not null then
      v_precio := round((v_linea ->> 'precio_unitario')::numeric, 2);
      if v_precio < 0 then
        raise exception 'Un precio no puede ser negativo.';
      end if;
    else
      v_precio := round(v_prod.precio * (1 - v_pct / 100), 2);
    end if;

    insert into lineas_venta (
      hermandad_id, venta_id, producto_id, codigo, nombre, cantidad,
      precio_unitario, precio_tarifa, coste_unitario, iva
    ) values (
      v_hermandad, v_venta, v_prod.id, v_prod.codigo, v_prod.nombre, v_cant,
      v_precio, v_prod.precio, v_prod.coste, v_prod.iva
    );

    -- El precio lleva el IVA dentro (ver el comentario de `productos.precio`),
    -- así que la base se saca dividiendo y la cuota es la diferencia. Así los
    -- tres números suman exactamente el total, sin un céntimo de desfase.
    v_bruto := round(v_precio * v_cant, 2);
    v_base_linea := round(v_bruto / (1 + v_prod.iva / 100), 2);
    v_total := v_total + v_bruto;
    v_base := v_base + v_base_linea;
    v_iva := v_iva + (v_bruto - v_base_linea);
    v_coste := v_coste + round(v_prod.coste * v_cant, 2);

    update productos set stock = stock - v_cant where id = v_prod.id;
    insert into movimientos_stock (hermandad_id, producto_id, tipo, cantidad, motivo, venta_id, quien)
      values (v_hermandad, v_prod.id, 'venta', -v_cant,
              format('Venta %s-%s', p_serie, v_numero), v_venta, v_yo);
  end loop;

  update ventas set base = v_base, iva_total = v_iva, total = v_total, coste_total = v_coste
   where id = v_venta;

  /*
   * Y LOS DOS ASIENTOS EN EL LIBRO.
   *
   * Nacen PENDIENTES, no conciliados, igual que los de cuotas y papeletas
   * (ver `lib/apuntes.ts`): que se haya cobrado significa «me consta», no «lo
   * he visto en el extracto». Conciliar es lo segundo y lo hace el tesorero.
   *
   * `origen` los ata a esta venta: sirve para no apuntar dos veces y para
   * poder retirarlos si la venta se anula.
   */
  select coalesce(max(m.numero), 0) into v_num_mov from movimientos m where m.hermandad_id = v_hermandad;

  /*
   * EL IVA VA EN SU PROPIA LÍNEA, y no metido dentro del ingreso.
   *
   * De una camiseta de 15 €, 12,40 € son de la hermandad y 2,60 € se le están
   * cobrando a quien compra PARA HACIENDA. Entran en la misma caja, pero no
   * son lo mismo: sumados en una sola línea, el libro dice que la tienda
   * ingresa un 21 % más de lo que ingresa, y a la hora del modelo 303 no hay
   * de dónde sacar la cifra sin recorrer las facturas una a una.
   *
   * Las dos líneas suman EXACTAMENTE el total, así que la caja sigue
   * cuadrando: es la misma cantidad de dinero, contada por separado.
   *
   * Si la hermandad no repercute IVA —lo normal en la mayoría— `v_iva` es cero
   * y sale una sola línea por el total, como antes. Un asiento de cero euros
   * solo ensucia el libro.
   *
   * Los tres números se cuentan de uno en uno según se van poniendo, y no
   * `+1 / +2 / +3` de golpe: cuando el IVA es cero, el 2 no se lo lleva nadie y
   * el libro queda con un hueco que parece un apunte borrado.
   */
  v_num_mov := v_num_mov + 1;
  insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
  values (
    v_hermandad, v_num_mov, to_char(now(), 'YYYY-MM-DD'),
    format('Venta en tienda %s-%s', p_serie, v_numero),
    'Otros ingresos', 'Ingreso', v_total - v_iva,
    case when lower(p_forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
    'Pendiente', 'venta:' || v_venta
  );

  if v_iva > 0 then
    v_num_mov := v_num_mov + 1;
    insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
    values (
      v_hermandad, v_num_mov, to_char(now(), 'YYYY-MM-DD'),
      format('IVA repercutido en la venta %s-%s', p_serie, v_numero),
      'IVA repercutido', 'Ingreso', v_iva,
      case when lower(p_forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
      'Pendiente', 'iva-venta:' || v_venta
    );
  end if;

  -- El gasto solo si de verdad costó algo: un artículo donado tiene coste 0 y
  -- un asiento de cero euros solo ensucia el libro.
  if v_coste > 0 then
    v_num_mov := v_num_mov + 1;
    insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
    values (
      v_hermandad, v_num_mov, to_char(now(), 'YYYY-MM-DD'),
      format('Coste del género vendido %s-%s', p_serie, v_numero),
      'Gastos varios menores', 'Gasto', v_coste,
      case when lower(p_forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
      'Pendiente', 'coste-venta:' || v_venta
    );
  end if;

  return jsonb_build_object(
    'id', v_venta, 'serie', p_serie, 'numero', v_numero,
    'base', v_base, 'iva', v_iva, 'total', v_total, 'coste', v_coste,
    'descuento_pct', v_pct
  );
end $$;

revoke all on function registrar_venta(jsonb, text, text, uuid, uuid, text, text, text, text, text) from public, anon;
grant execute on function registrar_venta(jsonb, text, text, uuid, uuid, text, text, text, text, text) to authenticated;

comment on function registrar_venta(jsonb, text, text, uuid, uuid, text, text, text, text, text) is
  'Registra una venta entera en una sola transacción: número de factura con cerrojo, líneas con foto '
  'del producto, stock descontado con la fila bloqueada, y los dos asientos en Tesorería (ingreso por '
  'lo cobrado, gasto por el coste). Devuelve el id, el número y los importes.';


-- ----------------------------------------------------------------------------
-- 9. «Queda poco de esto»: el aviso a quien lleva el inventario
-- ----------------------------------------------------------------------------
--
-- Se avisa AL CRUZAR el mínimo, no cada vez que se vende algo por debajo de él.
-- La diferencia es todo: con veinte camisetas por debajo del mínimo y treinta
-- ventas en el besamanos, avisar en cada una son treinta avisos idénticos, y a
-- partir del tercero nadie los lee. Se avisa una vez, cuando pasa de estar por
-- encima a estar por debajo, y no se vuelve a avisar hasta que se repone y
-- vuelve a bajar.
--
-- Y va a quien LLEVA EL MÓDULO de inventario, por las dos vías por las que se
-- gestiona en esta aplicación: el hermano con cargo en su ficha, y el personal
-- activo. Igual que `modulo_permitido()`, para que no se quede fuera nadie que
-- sí tiene la pantalla.
create or replace function productos_avisar_si_queda_poco() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_texto text;
begin
  if new.stock_minimo <= 0 then return new; end if;
  -- Solo el cruce hacia abajo.
  if not (old.stock >= new.stock_minimo and new.stock < new.stock_minimo) then
    return new;
  end if;

  v_texto := format(
    'Quedan %s de «%s» (%s) y el mínimo está en %s. Conviene reponer.',
    new.stock, new.nombre, new.codigo, new.stock_minimo);

  insert into avisos_hermano (hermandad_id, hermano_id, texto, tipo, titulo)
  select distinct new.hermandad_id, h.id, v_texto, 'existencias', 'Queda poco género'
    from hermanos h
   where h.hermandad_id = new.hermandad_id
     and h.estado <> 'Baja'
     and (
       -- Por su cargo en la ficha…
       exists (
         select 1 from permisos_cargo pc
          where pc.hermandad_id = h.hermandad_id
            and pc.cargo = h.cargo
            and pc.modulo_id = 'inventario'
       )
       -- …o por estar en «personal» con un cargo que lo lleve.
       or exists (
         select 1 from personal p
           join permisos_cargo pc2
             on pc2.cargo = p.cargo and pc2.hermandad_id = p.hermandad_id
          where p.hermandad_id = h.hermandad_id
            and p.auth_user_id = h.auth_user_id
            and p.activo
            and pc2.modulo_id = 'inventario'
       )
     );
  return new;
end $$;

drop trigger if exists productos_avisar_si_queda_poco on productos;
create trigger productos_avisar_si_queda_poco
  after update of stock on productos
  for each row execute function productos_avisar_si_queda_poco();


-- ----------------------------------------------------------------------------
-- 10. Romper, reponer y ajustar
-- ----------------------------------------------------------------------------
--
-- Todo lo que mueve stock sin que haya una venta de por medio. Va por función y
-- no por escritura directa para que el stock y su explicación se muevan juntos:
-- un stock que baja sin una línea que diga por qué es exactamente el agujero
-- por el que se pierden nueve camisetas al año.
--
-- `drop` antes de `create`: el parámetro nuevo lleva valor por defecto, y un
-- `create or replace` con un parámetro más NO SUSTITUYE a la función vieja
-- —crea una segunda con otra firma—, y entonces toda llamada de cuatro
-- argumentos queda ambigua y falla. Sin este `drop`, volver a ejecutar el
-- fichero rompe la tienda entera.
drop function if exists mover_stock(uuid, text, int, text);
create or replace function mover_stock(
  p_producto_id uuid,
  p_tipo text,          -- 'compra' | 'rotura' | 'ajuste' | 'devolucion'
  p_cantidad int,       -- positivo entra, negativo sale
  p_motivo text default '',
  -- Una rotura es un hecho, no una petición: si se han roto tres, se han roto
  -- tres aunque hubiera dos apartadas. Lo que no puede pasar es que se apunten
  -- sin que nadie se entere de a quién deja colgado.
  p_aunque_este_apartado boolean default false
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_prod productos%rowtype;
  v_apartado int;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede mover existencias.';
  end if;
  if p_tipo not in ('compra', 'rotura', 'ajuste', 'devolucion') then
    raise exception 'Ese motivo de movimiento no existe: %', p_tipo;
  end if;
  if p_cantidad = 0 then
    raise exception 'Un movimiento de cero unidades no mueve nada.';
  end if;
  -- Una rotura resta, siempre, aunque venga con el signo cambiado por error.
  if p_tipo = 'rotura' and p_cantidad > 0 then
    p_cantidad := -p_cantidad;
  end if;

  select * into v_prod from productos p
   where p.id = p_producto_id and p.hermandad_id = v_hermandad for update;
  if not found then
    raise exception 'Ese artículo no está en el catálogo de la hermandad.';
  end if;
  -- El stock no puede quedar en negativo: un almacén con «−3 camisetas» no
  -- significa nada y arrastra el error a todas las cuentas de después.
  if v_prod.stock + p_cantidad < 0 then
    raise exception 'No se pueden quitar % de «%»: solo hay %.',
      abs(p_cantidad), v_prod.nombre, v_prod.stock;
  end if;

  /*
   * Y TAMPOCO POR DEBAJO DE LO QUE YA ESTÁ PROMETIDO.
   *
   * Bajar el stock a mano —una rotura, un ajuste de recuento— dejaba al
   * descubierto lo que la web tenía apartado sin decir una palabra, y el
   * descuadre no aparecía hasta que alguien venía a recoger su reserva. Ahora
   * se para y se dice con quién choca.
   *
   * Se puede hacer igualmente, porque a veces hay que hacerlo: se repite
   * marcando la casilla, y entonces queda apuntado que se hizo sabiéndolo.
   */
  v_apartado := v_prod.stock - disponible_de(v_prod.id);
  if p_cantidad < 0 and v_prod.stock + p_cantidad < v_apartado and not p_aunque_este_apartado then
    raise exception 'De «%» quedarían % y hay % apartadas por la web. Suelta esas reservas, o repite marcando que se hace igualmente.',
      v_prod.nombre, v_prod.stock + p_cantidad, v_apartado;
  end if;

  update productos set stock = stock + p_cantidad where id = v_prod.id;
  insert into movimientos_stock (hermandad_id, producto_id, tipo, cantidad, motivo, quien)
    values (v_hermandad, v_prod.id, p_tipo, p_cantidad, p_motivo, hermano_propio_id());

  return v_prod.stock + p_cantidad;
end $$;

revoke all on function mover_stock(uuid, text, int, text, boolean) from public, anon;
grant execute on function mover_stock(uuid, text, int, text, boolean) to authenticated;


-- ----------------------------------------------------------------------------
-- 11. Anular una venta
-- ----------------------------------------------------------------------------
--
-- LA FACTURA NO SE BORRA. Una factura emitida no se hace desaparecer: se anula,
-- y su número se queda ocupado. Borrarla dejaría un hueco en la numeración, que
-- es justo lo que no puede pasar.
--
-- Lo que sí se deshace: el género vuelve al almacén y los dos asientos del libro
-- se contra-apuntan. No se borran tampoco —un asiento borrado es un descuadre
-- que nadie puede rastrear—: se mete el contrario al lado, que es como se
-- corrige en contabilidad.
--
-- DEVUELVE SI LA HA ANULADO AHORA (`true`) o si ya lo estaba (`false`). No es
-- un adorno: la pantalla contesta «anulada, el género ha vuelto al almacén», y
-- eso solo es verdad la primera vez. Con `void`, anular dos veces —dos cargos
-- a la vez, o una pantalla que se quedó vieja— decía exactamente lo mismo las
-- dos, y la segunda era mentira.
--
-- `drop` antes de `create` porque cambia el tipo devuelto, y `create or
-- replace` no lo permite: sin esto, volver a ejecutar el fichero falla aquí.
drop function if exists anular_venta(uuid, text);
create or replace function anular_venta(p_venta_id uuid, p_motivo text default '')
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_venta ventas%rowtype;
  v_linea lineas_venta%rowtype;
  v_num int;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede anular una venta.';
  end if;

  select * into v_venta from ventas v
   where v.id = p_venta_id and v.hermandad_id = v_hermandad for update;
  if not found then
    raise exception 'Esa venta no es de esta hermandad.';
  end if;
  if v_venta.estado = 'Anulada' then
    -- Ya estaba: anular dos veces no puede devolver el género dos veces. Se
    -- dice que no se ha hecho nada en vez de callarse.
    return false;
  end if;

  for v_linea in select * from lineas_venta l where l.venta_id = p_venta_id loop
    if v_linea.producto_id is not null then
      update productos set stock = stock + v_linea.cantidad where id = v_linea.producto_id;
      insert into movimientos_stock (hermandad_id, producto_id, tipo, cantidad, motivo, venta_id, quien)
        values (v_hermandad, v_linea.producto_id, 'devolucion', v_linea.cantidad,
                format('Anulada la venta %s-%s. %s', v_venta.serie, v_venta.numero, p_motivo),
                p_venta_id, hermano_propio_id());
    end if;
  end loop;

  select coalesce(max(m.numero), 0) into v_num from movimientos m where m.hermandad_id = v_hermandad;

  /*
   * El contrario del ingreso: un gasto por lo que se devuelve. Y el del IVA
   * aparte, como se apuntó: si se contra-apuntara todo junto, el 303 saldría
   * con el IVA repercutido de una venta que ya no existe.
   *
   * `v_num := v_num + 1` DELANTE DE CADA APUNTE, y no `+1 / +2 / +3` escritos a
   * mano. Aquí ponía `+1`, `+4` y `+2`: los tres apuntes de una misma anulación
   * salían en el libro desordenados, con un hueco en el 3 que no era de nadie,
   * y el último —el género que vuelve al almacén— por delante del IVA. Contar
   * de verdad además cierra el otro agujero, el que tenía también el apunte de
   * la venta: cuando el IVA es cero, el número que le tocaba no se salta.
   */
  v_num := v_num + 1;
  insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
  values (v_hermandad, v_num, to_char(now(), 'YYYY-MM-DD'),
          format('Anulada la venta %s-%s', v_venta.serie, v_venta.numero),
          'Gastos varios menores', 'Gasto', v_venta.total - v_venta.iva_total,
          case when lower(v_venta.forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
          'Pendiente', 'anula-venta:' || p_venta_id);

  if v_venta.iva_total > 0 then
    v_num := v_num + 1;
    insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
    values (v_hermandad, v_num, to_char(now(), 'YYYY-MM-DD'),
            format('IVA de la venta anulada %s-%s', v_venta.serie, v_venta.numero),
            'IVA repercutido', 'Gasto', v_venta.iva_total,
            case when lower(v_venta.forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
            'Pendiente', 'anula-iva-venta:' || p_venta_id);
  end if;

  -- Y el contrario del coste, si lo hubo.
  if v_venta.coste_total > 0 then
    v_num := v_num + 1;
    insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
    values (v_hermandad, v_num, to_char(now(), 'YYYY-MM-DD'),
            format('Vuelve al almacén el género de %s-%s', v_venta.serie, v_venta.numero),
            'Otros ingresos', 'Ingreso', v_venta.coste_total,
            case when lower(v_venta.forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
            'Pendiente', 'anula-coste-venta:' || p_venta_id);
  end if;

  update ventas set estado = 'Anulada',
         notas = trim(both ' ' from coalesce(notas, '') || ' · Anulada: ' || coalesce(p_motivo, ''))
   where id = p_venta_id;
  return true;
end $$;

revoke all on function anular_venta(uuid, text) from public, anon;
grant execute on function anular_venta(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 12. LOS DATOS DE LA TIENDA, YA SUMADOS
-- ----------------------------------------------------------------------------
--
-- La pantalla de datos necesita tres cosas: cuánto se vendió cada mes, qué
-- artículos se venden más, y cómo paga la gente. Y las tres, separadas por
-- canal —mostrador e internet— porque esa es justamente la pregunta.
--
-- SE SUMA AQUÍ Y NO EN EL NAVEGADOR, y no es una optimización prematura. Para
-- saber qué artículo se vende más hay que recorrer TODAS las líneas de venta
-- del ejercicio: una hermandad que vende en el besamanos, en la cuaresma y en
-- la salida junta varios miles al año. Bajarlas por la red para sumarlas en
-- una tabla de doce filas es tirar los datos móviles de quien mira esto desde
-- el teléfono, y encima obligaría a abrir `lineas_venta` entera a una pantalla
-- que solo necesita totales.
--
-- LAS ANULADAS NO CUENTAN, en ninguno de los tres bloques. Una factura anulada
-- no ha entrado en caja, y su género ha vuelto al almacén: sumarla diría que
-- se vendió algo que se devolvió.
--
-- Devuelve un solo `jsonb` con todo dentro. Una llamada y no cuatro: son
-- cuatro consultas sobre las mismas dos tablas, y hacerlas por separado
-- multiplica por cuatro la espera con la conexión de una casa de hermandad.
create or replace function datos_tienda(p_anio int)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_desde timestamptz;
  v_hasta timestamptz;
begin
  /*
   * QUIÉN PUEDE MIRAR ESTO. El inventario porque es su tienda, y la tesorería
   * porque son sus ingresos. A nadie más: aquí está lo que gana la hermandad
   * con cada artículo, que es información de junta.
   */
  if not (modulo_permitido('inventario') or modulo_permitido('tesoreria')) then
    raise exception 'No tienes permiso para ver los datos de la tienda.';
  end if;
  if v_hermandad is null then
    raise exception 'No se sabe de qué hermandad son estos datos.';
  end if;

  /*
   * EL AÑO SE ACOTA POR FECHAS Y NO CON `extract(year from fecha)`.
   *
   * Con `extract` no se puede usar el índice de `ventas (hermandad_id, fecha)`
   * y hay que leer la tabla entera. Y hay algo peor: `extract` sacaría el año
   * en la zona horaria de la sesión, que en Supabase es UTC — así que una
   * venta del 1 de enero a las 00:30 en España caería en el ejercicio
   * anterior. Con `make_timestamptz(..., 'Europe/Madrid')` los límites son las
   * medianoches DE AQUÍ, que es lo que entiende quien cierra el ejercicio.
   */
  v_desde := make_timestamptz(p_anio, 1, 1, 0, 0, 0, 'Europe/Madrid');
  v_hasta := make_timestamptz(p_anio + 1, 1, 1, 0, 0, 0, 'Europe/Madrid');

  return jsonb_build_object(
    'anio', p_anio,

    -- Los años que tienen algo, para el selector. Sin esto la pantalla
    -- ofrecería años vacíos o se quedaría solo con el actual.
    'anios', coalesce((
      select jsonb_agg(distinct a order by a desc) from (
        select extract(year from (v.fecha at time zone 'Europe/Madrid'))::int as a
          from ventas v where v.hermandad_id = v_hermandad and v.estado <> 'Anulada'
      ) t
    ), '[]'::jsonb),

    -- Mes a mes, por canal. Solo los meses que tienen algo: la pantalla
    -- rellena los doce, que es donde se sabe cuántos hacen falta.
    'meses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'mes', m, 'canal', canal, 'total', total, 'base', base,
               'iva', iva, 'coste', coste, 'ventas', n) order by m, canal)
        from (
          select extract(month from (v.fecha at time zone 'Europe/Madrid'))::int as m,
                 v.canal,
                 sum(v.total)::numeric(12, 2) as total,
                 sum(v.base)::numeric(12, 2) as base,
                 sum(v.iva_total)::numeric(12, 2) as iva,
                 sum(v.coste_total)::numeric(12, 2) as coste,
                 count(*)::int as n
            from ventas v
           where v.hermandad_id = v_hermandad and v.estado <> 'Anulada'
             and v.fecha >= v_desde and v.fecha < v_hasta
           group by 1, 2
        ) t
    ), '[]'::jsonb),

    -- Lo que más se vende. Se agrupa por CÓDIGO y no por artículo, para que un
    -- artículo borrado del catálogo siga contando: su nombre quedó copiado en
    -- la línea, que es justo para lo que se copió.
    'articulos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'codigo', codigo, 'nombre', nombre, 'canal', canal,
               'unidades', unidades, 'importe', importe, 'coste', coste)
             order by importe desc)
        from (
          select l.codigo, min(l.nombre) as nombre, v.canal,
                 sum(l.cantidad)::int as unidades,
                 sum(round(l.precio_unitario * l.cantidad, 2))::numeric(12, 2) as importe,
                 sum(round(l.coste_unitario * l.cantidad, 2))::numeric(12, 2) as coste
            from lineas_venta l
            join ventas v on v.id = l.venta_id
           where v.hermandad_id = v_hermandad and v.estado <> 'Anulada'
             and v.fecha >= v_desde and v.fecha < v_hasta
           group by l.codigo, v.canal
        ) t
    ), '[]'::jsonb),

    -- Y cómo paga la gente, que es lo que decide si hace falta datáfono.
    'formas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'forma', forma, 'canal', canal, 'total', total, 'ventas', n)
             order by total desc)
        from (
          select coalesce(nullif(trim(v.forma_pago), ''), 'Sin indicar') as forma,
                 v.canal,
                 sum(v.total)::numeric(12, 2) as total,
                 count(*)::int as n
            from ventas v
           where v.hermandad_id = v_hermandad and v.estado <> 'Anulada'
             and v.fecha >= v_desde and v.fecha < v_hasta
           group by 1, 2
        ) t
    ), '[]'::jsonb)
  );
end $$;

revoke all on function datos_tienda(int) from public, anon;
grant execute on function datos_tienda(int) to authenticated;

comment on function datos_tienda(int) is
  'Lo vendido en un ejercicio, ya sumado: por mes, por artículo y por forma de pago, '
  'separado por canal. Sin las anuladas. El año se acota en hora de Madrid.';

-- =============================================================================
--   TIENDA-WEB.SQL — La tienda en la web: reservar por internet y pagar al recoger
-- =============================================================================

-- ============================================================================
--   LA TIENDA EN LA WEB: RESERVAR Y RECOGER
-- ============================================================================
--
-- La hermandad publica su género en la web y la gente lo APARTA desde casa;
-- luego pasa por la casa hermandad, paga y se lo lleva.
--
-- SIN PAGO ONLINE, Y ES UNA DECISIÓN, no una simplificación por pereza:
--
--   · El dinero de la tienda va a la hermandad, no a Gobergo. Cobrar por ella
--     convertiría a Gobergo en intermediario de pagos, con lo que eso trae.
--   · Y una tienda que cobra por internet arrastra obligaciones de comercio
--     electrónico —desistimiento de catorce días, condiciones de venta,
--     resolución de litigios— que una hermandad que vende ochenta camisetas al
--     año no tiene por qué asumir.
--
-- Reservar no es comprar: es apartar. Por eso aquí no hay factura ni asiento
-- en el libro. Los dos nacen cuando se recoge y se paga, y entonces la venta
-- pasa por `registrar_venta()` como cualquier otra, con `canal = 'online'`
-- para saber de dónde vino.
--
-- EL STOCK NO SE DESCUENTA AL RESERVAR. `stock` significa «lo que hay en el
-- almacén», y mientras la camiseta no se la lleve nadie, ahí sigue. Lo que se
-- calcula es lo DISPONIBLE = stock − reservado, que es lo que se puede
-- prometer. Descontarlo al reservar haría que el recuento del almacén no
-- cuadrara nunca con las estanterías.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada. Necesita `tienda.sql` ejecutado antes.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Las reservas
-- ----------------------------------------------------------------------------
create table if not exists reservas_tienda (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  /*
   * LA REFERENCIA, para decirla por teléfono y para que la busque quien está
   * en el mostrador: «R-2027-14». Correlativa por hermandad y año, con
   * cerrojo, por lo mismo que el número de factura: calculada con un `max()+1`
   * desde dos navegadores a la vez salen dos reservas con la misma.
   */
  referencia text not null,
  nombre text not null,
  email text not null default '',
  telefono text not null default '',
  notas text not null default '',
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'entregada', 'anulada', 'caducada')),
  -- Hasta cuándo se le guarda. Pasada la fecha, la hermandad puede soltarla y
  -- el género vuelve a estar disponible.
  recoger_antes_de date,
  total numeric(10, 2) not null default 0,
  -- La venta que salió de ella al recogerla. Vacío mientras no se entregue.
  venta_id uuid references ventas(id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (hermandad_id, referencia)
);
create index if not exists reservas_tienda_pendientes_idx
  on reservas_tienda (hermandad_id, estado, creado_en desc);

/*
 * QUIÉN APARTÓ, SI RESULTÓ SER HERMANO.
 *
 * Va como `alter table` para las bases que ya existen. Y NO ES UN CAMPO QUE
 * MANDE EL NAVEGADOR: lo resuelve `crear_reserva_web` contra la sesión, porque
 * un `hermano_id` que llegara de fuera sería el 50 % de costaleros para
 * cualquiera con la consola abierta.
 *
 * De saberlo salen dos cosas: el precio de hermano en la web —que hasta ahora
 * solo existía en el mostrador, así que el hermano que compraba por internet
 * pagaba tarifa— y poder avisarle cuando lo suyo está listo.
 */
alter table reservas_tienda add column if not exists hermano_id uuid references hermanos(id) on delete set null;
alter table reservas_tienda add column if not exists descuento_id uuid references descuentos(id) on delete set null;
alter table reservas_tienda add column if not exists descuento_pct numeric(5, 2) not null default 0;

create table if not exists lineas_reserva (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  reserva_id uuid not null references reservas_tienda(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  -- Copiados, igual que en las líneas de venta: lo que se le prometió a quien
  -- reservó no puede cambiar porque mañana suba el precio.
  codigo text not null,
  nombre text not null,
  cantidad int not null check (cantidad > 0),
  precio_unitario numeric(10, 2) not null default 0
);
-- Lo que costaba de tarifa, para poder enseñar en el resguardo lo que NO se le
-- cobró. `precio_unitario` ya viene rebajado si a quien apartó le tocaba.
alter table lineas_reserva add column if not exists precio_tarifa numeric(10, 2);
create index if not exists lineas_reserva_reserva_idx on lineas_reserva (reserva_id);
create index if not exists lineas_reserva_producto_idx on lineas_reserva (producto_id);


-- ----------------------------------------------------------------------------
-- 2. Lo que de verdad se puede prometer
-- ----------------------------------------------------------------------------
--
-- `stock` es lo que hay en la estantería. `disponible` es lo que se puede
-- vender o reservar sin dejar a nadie colgado: lo de la estantería menos lo
-- que ya está apartado y sin recoger.
--
-- Separarlos importa el día del besamanos: si el mostrador vende las tres
-- últimas camisetas que estaban apartadas para alguien que viene por la tarde,
-- esa persona se encuentra con que su reserva no vale nada.
--
-- Y eso es exactamente lo que pasaba, porque esta vista estaba escrita desde el
-- primer día y NO LA MIRABA NADIE: ni el mostrador, ni el almacén, ni el
-- navegador. La web sí descontaba lo apartado, así que el circuito estaba
-- partido por la mitad — internet contaba una cosa y el mostrador otra, sobre
-- el mismo estante—. Ahora la cuenta vive en una sola función y la usan los
-- dos lados.

/*
 * PUEDE SALIR NEGATIVO, y sale a propósito. Un −2 significa que se ha vendido
 * género que ya estaba comprometido con alguien: es justo el aviso que hay que
 * ver, y taparlo con un `greatest(0, …)` sería esconder el descuadre donde más
 * falta hace mirarlo. En la web sí se enseña topado a cero —a quien compra no
 * le sirve de nada un número negativo—, pero eso lo hace `catalogo_web`.
 *
 * `security definer` porque la llaman tanto la web pública (sin sesión) como el
 * panel; devuelve UN NÚMERO de un artículo que quien pregunta ya está viendo,
 * así que no descubre nada que no supiera.
 */
create or replace function disponible_de(p_producto_id uuid)
returns int
language sql stable security definer set search_path = public as $$
  select p.stock - coalesce((
           select sum(l.cantidad)::int
             from lineas_reserva l
             join reservas_tienda r on r.id = l.reserva_id
            where l.producto_id = p.id and r.estado = 'pendiente'
         ), 0)
    from productos p
   where p.id = p_producto_id
$$;

comment on function disponible_de(uuid) is
  'Lo que queda sin comprometer de un artículo: el stock de la estantería menos lo apartado por '
  'reservas de la web todavía sin recoger. Puede ser negativo, y entonces significa que se ha '
  'vendido en el mostrador algo que ya estaba prometido.';

grant execute on function disponible_de(uuid) to authenticated, anon;

create or replace view existencias_tienda
with (security_invoker = true) as
  select
    p.id,
    p.hermandad_id,
    p.codigo,
    p.nombre,
    p.stock,
    p.stock - disponible_de(p.id) as reservado,
    disponible_de(p.id) as disponible
  from productos p;

grant select on existencias_tienda to authenticated, anon;

comment on view existencias_tienda is
  '`stock` es lo que hay en la estantería; `disponible` es lo que se puede prometer, '
  'descontando lo apartado y sin recoger. `security_invoker` para que aplique la RLS de `productos`.';


-- ----------------------------------------------------------------------------
-- 3. RESERVAR DESDE LA WEB, sin sesión
-- ----------------------------------------------------------------------------
--
-- Quien reserva es un visitante: no ha entrado en ningún sitio y la única
-- llave que trae es la pública que viaja en el JavaScript de la web. Así que
-- esto NO puede ser un `insert` con una política abierta: sería dejar que el
-- navegador dijera qué cuesta cada cosa.
--
-- LO QUE SE COMPRUEBA AQUÍ, y ninguna de las cinco sobra:
--
--   1. Que el artículo sea de ESA hermandad, esté activo y publicado en la web.
--      Sin esto se puede reservar el género de otra hermandad, o uno retirado.
--   2. Que haya de verdad. Contra `disponible`, no contra `stock`.
--   3. EL PRECIO LO PONE LA BASE. Si viniera del navegador, cualquiera reserva
--      la medalla de cuarenta euros por cero.
--   4. Un tope por hora, como el resto de formularios públicos: sin él, un
--      barrido deja mil reservas y el género entero apartado para nadie.
--   5. Y se recorta todo lo que llega, para que no entre con megas dentro.
create or replace function crear_reserva_web(
  p_hermandad_id uuid,
  p_lineas jsonb,            -- [{producto_id, cantidad}]
  p_nombre text,
  p_email text default '',
  p_telefono text default '',
  p_notas text default '',
  p_dias_para_recoger int default 14
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_reserva uuid;
  v_ref text;
  v_anio int := extract(year from now())::int;
  v_n int;
  v_linea jsonb;
  v_prod productos%rowtype;
  v_disp int;
  v_cant int;
  v_total numeric(10, 2) := 0;
  v_recientes int;
  v_nombre text;
  v_hermano uuid;
  v_desc uuid;
  v_pct numeric(5, 2) := 0;
  v_precio numeric(10, 2);
begin
  if p_hermandad_id is null or not exists (select 1 from hermandades where id = p_hermandad_id) then
    raise exception 'No se sabe de qué hermandad es esta reserva.';
  end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'No has apartado nada.';
  end if;
  -- Un carrito con doscientas líneas no es una reserva, es un barrido.
  if jsonb_array_length(p_lineas) > 30 then
    raise exception 'Demasiados artículos en una sola reserva.';
  end if;

  v_nombre := left(trim(coalesce(p_nombre, '')), 120);
  if v_nombre = '' then
    raise exception 'Hace falta un nombre para poder llamarte.';
  end if;

  /*
   * ¿ESTÁ APARTANDO UN HERMANO?
   *
   * Se resuelve CONTRA LA SESIÓN y NUNCA desde un parámetro. Esta función está
   * concedida a `anon` —quien reserva desde la web no ha entrado en ningún
   * sitio—, así que un `p_hermano_id` sería el 50 % de costaleros para
   * cualquiera que abra la consola del navegador y escriba un uuid.
   *
   * `hermano_propio_id()` sale de `auth.uid()`, que aquí es de verdad quien
   * llama: `security definer` cambia con qué permisos se ejecuta esto, no quién
   * ha iniciado sesión. Si el hermano entró en su área y desde esa misma pestaña
   * abre la web de su hermandad, lleva el mismo cliente y el mismo JWT.
   *
   * Y se comprueba que sea de ESTA hermandad y no esté de baja: un hermano de
   * otra hermandad no tiene por qué llevarse el descuento de esta.
   */
  select h.id into v_hermano
    from hermanos h
   where h.id = hermano_propio_id()
     and h.hermandad_id = p_hermandad_id
     and h.estado <> 'Baja';

  if v_hermano is not null then
    select m.id, m.porcentaje into v_desc, v_pct
      from mejor_descuento_para(p_hermandad_id, v_hermano) m;
    v_pct := coalesce(v_pct, 0);
  end if;

  /*
   * EL TOPE POR HORA. La hora la pone la base (`creado_en` tiene `default
   * now()` y aquí no se toca), por lo mismo que en `mensajes_web_con_freno`:
   * si esa columna llegara de fuera, bastaría con ponerla tres días atrás para
   * que el contador no viera ninguna y el freno no existiera.
   */
  select count(*) into v_recientes from reservas_tienda
   where hermandad_id = p_hermandad_id and creado_en > now() - interval '1 hour';
  if v_recientes >= 40 then
    raise exception 'Ahora mismo no se pueden recoger más reservas. Inténtalo dentro de un rato.'
      using errcode = 'P0001';
  end if;

  -- La referencia, con cerrojo: dos navegadores a la vez sacarían la misma.
  perform pg_advisory_xact_lock(hashtext(p_hermandad_id::text || '|reserva|' || v_anio));
  select coalesce(max(substring(referencia from '[0-9]+$')::int), 0) + 1 into v_n
    from reservas_tienda
   where hermandad_id = p_hermandad_id and referencia like 'R-' || v_anio || '-%';
  v_ref := format('R-%s-%s', v_anio, v_n);

  insert into reservas_tienda (
    hermandad_id, referencia, nombre, email, telefono, notas, recoger_antes_de
  ) values (
    p_hermandad_id, v_ref, v_nombre,
    left(trim(coalesce(p_email, '')), 160),
    left(trim(coalesce(p_telefono, '')), 40),
    left(trim(coalesce(p_notas, '')), 1000),
    current_date + greatest(1, least(90, coalesce(p_dias_para_recoger, 14)))
  ) returning id into v_reserva;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cant := coalesce((v_linea ->> 'cantidad')::int, 0);
    if v_cant <= 0 then
      raise exception 'Una línea sin cantidad no se puede apartar.';
    end if;
    -- Un tope por línea: nadie aparta doscientas camisetas desde la web.
    if v_cant > 50 then
      raise exception 'Para tantas unidades, llama a la hermandad.';
    end if;

    -- `for update` sobre el producto: es lo que impide que dos visitantes
    -- aparten a la vez la última unidad.
    select * into v_prod from productos p
     where p.id = (v_linea ->> 'producto_id')::uuid
       and p.hermandad_id = p_hermandad_id
       and p.activo and p.visible_en_web
     for update;
    if not found then
      raise exception 'Ese artículo ya no está a la venta.';
    end if;

    select disponible into v_disp from existencias_tienda where id = v_prod.id;
    if coalesce(v_disp, 0) < v_cant then
      raise exception 'De «%» ya solo quedan % sin apartar.', v_prod.nombre, greatest(0, coalesce(v_disp, 0));
    end if;

    /*
     * EL PRECIO, CON LA MISMA FÓRMULA QUE COBRA EL MOSTRADOR.
     *
     * `round(precio * (1 - pct/100), 2)`, letra por letra igual que en
     * `registrar_venta`. No es celo: si la web dijera 0,57 y la caja cobrara
     * 0,58, el problema no sería el céntimo — sería que la web mintió, y con un
     * resguardo por escrito de por medio.
     */
    v_precio := round(v_prod.precio * (1 - v_pct / 100), 2);

    insert into lineas_reserva (
      hermandad_id, reserva_id, producto_id, codigo, nombre, cantidad, precio_unitario, precio_tarifa
    ) values (
      p_hermandad_id, v_reserva, v_prod.id, v_prod.codigo, v_prod.nombre, v_cant, v_precio, v_prod.precio
    );
    v_total := v_total + round(v_precio * v_cant, 2);
  end loop;

  update reservas_tienda
     set total = v_total, hermano_id = v_hermano, descuento_id = v_desc, descuento_pct = v_pct
   where id = v_reserva;

  /*
   * Y SE AVISA A QUIEN LLEVA EL INVENTARIO. Una reserva que nadie mira es
   * alguien que se planta en la casa hermandad a por algo que no le han
   * apartado. Mismo criterio que el aviso de «queda poco»: a quien lleva el
   * módulo, por las dos vías por las que se gestiona.
   */
  insert into avisos_hermano (hermandad_id, hermano_id, texto, tipo, titulo)
  select distinct p_hermandad_id, h.id,
         format('%s ha apartado %s€ desde la web (%s). Pasará a recogerlo.',
                v_nombre, to_char(v_total, 'FM999999990.00'), v_ref),
         'existencias', 'Nueva reserva en la tienda'
    from hermanos h
   where h.hermandad_id = p_hermandad_id
     and h.estado <> 'Baja'
     and (
       exists (select 1 from permisos_cargo pc
                where pc.hermandad_id = h.hermandad_id and pc.cargo = h.cargo
                  and pc.modulo_id = 'inventario')
       or exists (select 1 from personal p
                    join permisos_cargo pc2 on pc2.cargo = p.cargo and pc2.hermandad_id = p.hermandad_id
                   where p.hermandad_id = h.hermandad_id and p.auth_user_id = h.auth_user_id
                     and p.activo and pc2.modulo_id = 'inventario')
     );

  return jsonb_build_object('referencia', v_ref, 'total', v_total,
                            'recoger_antes_de', current_date + greatest(1, least(90, coalesce(p_dias_para_recoger, 14))));
end $$;

revoke all on function crear_reserva_web(uuid, jsonb, text, text, text, text, int) from public;
-- A `anon` a propósito: quien reserva desde la web no ha entrado en ningún
-- sitio. Todo lo que puede hacer está acotado ahí arriba.
grant execute on function crear_reserva_web(uuid, jsonb, text, text, text, text, int) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 4. Entregar una reserva: se cobra y se convierte en venta
-- ----------------------------------------------------------------------------
--
-- Aquí es donde nace la factura y donde entran los dos asientos, no antes.
-- Se reutiliza `registrar_venta()` entera para que una venta de la web y una
-- del mostrador se apunten EXACTAMENTE igual: el día que cambie la forma de
-- contabilizar, cambia en un sitio.
create or replace function entregar_reserva(
  p_reserva_id uuid,
  p_forma_pago text default 'Efectivo'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_res reservas_tienda%rowtype;
  v_lineas jsonb;
  v_venta jsonb;
  v_huerfanas int;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede entregar una reserva.';
  end if;

  select * into v_res from reservas_tienda r
   where r.id = p_reserva_id and r.hermandad_id = v_hermandad for update;
  if not found then
    raise exception 'Esa reserva no es de esta hermandad.';
  end if;
  if v_res.estado <> 'pendiente' then
    raise exception 'Esa reserva ya está %.', v_res.estado;
  end if;

  /*
   * SI ALGÚN ARTÍCULO DE LA RESERVA YA NO EXISTE, SE PARA.
   *
   * El `producto_id is not null` de abajo descartaba en silencio las líneas
   * huérfanas —las de un artículo borrado del catálogo después de reservarlo—.
   * Con tres artículos apartados y uno borrado, se facturaban dos y el tercero
   * desaparecía sin que nadie lo dijera: ni quien cobra ni quien recoge se
   * enteraban de que la reserva no era la que se firmó.
   *
   * Se cuenta primero y se avisa, que es lo que ya hacía la rama de la
   * demostración. Rehacer la reserva es trabajo de un minuto; descubrir dentro
   * de un mes que faltó un artículo en una factura, no.
   */
  select count(*) into v_huerfanas
    from lineas_reserva l
   where l.reserva_id = p_reserva_id and l.producto_id is null;
  if v_huerfanas > 0 then
    raise exception 'Esta reserva tiene % % que ya no está% en el catálogo. Suéltala y hazla de nuevo con lo que sí hay.',
      v_huerfanas,
      case when v_huerfanas = 1 then 'artículo' else 'artículos' end,
      case when v_huerfanas = 1 then '' else 'n' end;
  end if;

  -- Las líneas, con el precio que se le prometió a quien reservó. Si la
  -- hermandad ha subido el precio entretanto, se respeta el de la reserva: se
  -- lo apartaron a ese precio.
  select jsonb_agg(jsonb_build_object(
           'producto_id', l.producto_id,
           'cantidad', l.cantidad,
           'precio_unitario', l.precio_unitario))
    into v_lineas
    from lineas_reserva l
   where l.reserva_id = p_reserva_id and l.producto_id is not null;

  if v_lineas is null then
    raise exception 'Esa reserva se ha quedado sin artículos: ya no existen en el catálogo.';
  end if;

  /*
   * LA RESERVA SE MARCA ENTREGADA **ANTES** DE FACTURARLA, y el orden no es un
   * capricho: es la trampa entera de este arreglo.
   *
   * Desde que `registrar_venta` mira lo disponible y no el stock, las líneas de
   * esta misma reserva cuentan como apartadas mientras siga «pendiente». Con el
   * `update` detrás, la reserva se bloqueaba a sí misma: entregar una reserva
   * perfectamente válida contestaba «de "Camiseta" solo quedan 0 sin apartar».
   *
   * Es la misma transacción, así que no se abre ningún hueco: si `registrar_venta`
   * levanta una excepción, se deshace también este `update` y la reserva sigue
   * pendiente, igual que antes.
   */
  update reservas_tienda set estado = 'entregada' where id = p_reserva_id;

  /*
   * SE FACTURA A NOMBRE DEL HERMANO Y CON SU DESCUENTO, si lo hubo.
   *
   * Las líneas siguen llevando el precio PROMETIDO, y no hay doble descuento:
   * la regla «precio a mano manda» de `registrar_venta` lo garantiza, y ese
   * precio ya viene rebajado de cuando se apartó. El `descuento_id` va para que
   * la factura y los informes puedan decir POR QUÉ costó eso; sin él, una
   * factura de la web con precios rebajados no tiene explicación en ninguna
   * parte.
   *
   * El `case when` no sobra: si entre la reserva y la entrega alguien apaga ese
   * descuento —o el hermano pierde la etiqueta—, `registrar_venta` levantaría
   * excepción y la reserva no se podría entregar. Lo que se le prometió se le
   * cobra igual; lo único que se pierde es la nota de por qué.
   */
  v_venta := registrar_venta(
    v_lineas, 'online', p_forma_pago,
    v_res.hermano_id,
    case when pct_de_descuento(v_hermandad, v_res.descuento_id, v_res.hermano_id) is not null
         then v_res.descuento_id end,
    v_res.nombre, '', '',
    format('Reserva %s', v_res.referencia)
  );

  update reservas_tienda
     set venta_id = (v_venta ->> 'id')::uuid
   where id = p_reserva_id;

  return v_venta;
end $$;

revoke all on function entregar_reserva(uuid, text) from public, anon;
grant execute on function entregar_reserva(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Soltar una reserva
-- ----------------------------------------------------------------------------
--
-- No se borra, se marca. Una reserva borrada es una llamada de teléfono que
-- nadie puede explicar: «yo aparté una camiseta la semana pasada» y no hay
-- rastro de nada. Al dejar de estar «pendiente», el género vuelve a contar
-- como disponible solo (`existencias_tienda` mira el estado).
/*
 * DEVUELVE SI DE VERDAD HA SOLTADO ALGO, y esto no es un detalle.
 *
 * Empezó devolviendo `void`, con las tres condiciones metidas en el `where` del
 * `update`. Y ahí un `update` que no encuentra fila NO ES UN ERROR: afecta a
 * cero filas y Postgres dice que todo ha ido bien. Así que soltar una reserva
 * que ya estaba entregada —o de otra hermandad, o que otro acababa de anular
 * desde el ordenador de al lado— no hacía nada y la pantalla contestaba
 * «anulada, el género vuelve a estar disponible». Una pantalla que da por
 * hecho lo que no ha pasado es peor que un error: nadie vuelve a mirarlo.
 *
 * `drop` antes de `create`: cambia el tipo devuelto y `create or replace` no
 * lo permite. Sin esto, volver a ejecutar el fichero fallaba aquí.
 */
drop function if exists soltar_reserva(uuid, text, text);
create or replace function soltar_reserva(
  p_reserva_id uuid,
  p_motivo text default '',
  p_estado text default 'anulada'
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_cuantas int;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede soltar una reserva.';
  end if;
  if p_estado not in ('anulada', 'caducada') then
    raise exception 'Una reserva solo se puede soltar como anulada o caducada.';
  end if;
  update reservas_tienda
     set estado = p_estado,
         notas = trim(both ' ' from coalesce(notas, '') || ' · ' || coalesce(p_motivo, ''))
   where id = p_reserva_id and hermandad_id = v_hermandad and estado = 'pendiente';
  get diagnostics v_cuantas = row_count;
  return v_cuantas > 0;
end $$;

revoke all on function soltar_reserva(uuid, text, text) from public, anon;
grant execute on function soltar_reserva(uuid, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Quién ve qué
-- ----------------------------------------------------------------------------
alter table reservas_tienda enable row level security;
alter table lineas_reserva enable row level security;

do $$
declare t text;
begin
  foreach t in array array['reservas_tienda', 'lineas_reserva'] loop
    execute format('drop policy if exists "solo_mi_hermandad" on %I', t);
    execute format(
      'create policy "solo_mi_hermandad" on %I as restrictive for all to authenticated '
      'using (hermandad_id = hermandad_actual()) with check (hermandad_id = hermandad_actual())', t);
    execute format('drop policy if exists "tienda_gestiona" on %I', t);
    execute format(
      'create policy "tienda_gestiona" on %I for all to authenticated '
      'using (modulo_permitido(''inventario'')) with check (modulo_permitido(''inventario''))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

/*
 * QUIEN RESERVA NO PUEDE LEER NADA, ni siquiera lo suyo.
 *
 * No hay política para `anon`, y es a propósito: con una lectura abierta,
 * cualquiera se baja los nombres, correos y teléfonos de todo el que ha
 * reservado. El resguardo se le enseña en pantalla al terminar y se le manda
 * por correo; para lo demás está el teléfono de la hermandad.
 */


-- ----------------------------------------------------------------------------
-- 7. EL CATÁLOGO QUE VE EL VISITANTE
-- ----------------------------------------------------------------------------
--
-- `catalogo_tienda` y `existencias_tienda` NO le sirven a quien entra en la
-- web sin cuenta, y conviene entender por qué antes de tocar nada.
--
-- Las dos son vistas `security_invoker`: se ejecutan con los permisos de quien
-- las mira. La política que abre `productos` está escrita `to authenticated`,
-- así que un visitante anónimo las lee vacías —o directamente le rebota, si
-- por debajo hay una tabla sobre la que no tiene ni el `grant`—. Es exactamente
-- lo que debe pasar: quitar ese `to authenticated` para que la web funcione
-- sería abrir la tabla entera, con el `coste` dentro.
--
-- Y en `existencias_tienda` sería peor: para calcular lo reservado mira
-- `lineas_reserva`, que cuelga de `reservas_tienda`, donde están los nombres,
-- los correos y los teléfonos de todo el que ha apartado algo.
--
-- Así que la web pública lee por AQUÍ, que es como leen todo lo demás las
-- páginas públicas de Gobergo (`hermandad_de_la_web`, `hermandades_publicas`):
-- una función que devuelve UNO A UNO los campos que ya salen impresos en la
-- página. Si mañana `productos` gana una columna con algo delicado, no se cuela
-- sola por aquí.
--
-- Va por SLUG, no por identificador: es lo que el navegador tiene en la barra
-- de direcciones. Y solo responde si la web está publicada — una hermandad que
-- está preparando la suya no enseña su género todavía.
/*
 * EL PRECIO DE HERMANO, TAMBIÉN AQUÍ.
 *
 * Hasta ahora el descuento de hermano solo existía en el mostrador: el hermano
 * que compraba por internet pagaba tarifa, y no había nada en pantalla que le
 * dijera que entrando en su área le habría costado menos. Un descuento que solo
 * conoce quien ya lo tenía no es un descuento, es un secreto.
 *
 * EL NAVEGADOR NO DICE QUIÉN ES Y NO SE LE CREE NADA. La página se limita a
 * llamar aquí; quién está navegando lo resuelve la base con `hermano_propio_id()`
 * a partir de la sesión, y el precio lo calcula ella. Sin sesión, `precio_hermano`
 * viene `null` —no igual al precio— para que la página pueda distinguir «no le
 * toca ninguno» de «no ha entrado», que se dicen de forma muy distinta.
 *
 * Y NO SE DEVUELVE NI EL NOMBRE NI EL ID DEL HERMANO: solo números. Esta función
 * la puede llamar cualquiera, y lo que contesta no puede servir para averiguar
 * quién es nadie.
 *
 * `drop` antes de `create`: cambia el tipo devuelto y `create or replace` no lo
 * permite. Sin esto, volver a ejecutar el fichero falla aquí — es exactamente
 * lo que ya le pasó a `soltar_reserva`.
 */
drop function if exists catalogo_web(text);
create or replace function catalogo_web(p_slug text)
returns table (
  id uuid,
  codigo text,
  nombre text,
  descripcion text,
  precio numeric,
  precio_hermano numeric,
  descuento_pct numeric,
  iva numeric,
  foto_url text,
  disponible int
)
language sql stable security definer set search_path = public as $$
  with sitio as (
    select w.hermandad_id
      from web_publica w
     where w.slug = p_slug
       -- Publicada, o de la gente de esa misma hermandad: es lo que hace que la
       -- vista previa del panel enseñe el género antes de publicar la web. La
       -- excepción NO se la cree a nadie por decirlo —no hay ningún parámetro de
       -- «soy de la casa»—: se comprueba contra la sesión, aquí y en el servidor.
       and (w.publicada or w.hermandad_id = hermandad_actual())
  ),
  -- Quien esté navegando, SI ha entrado en su área y SI es hermano de esta
  -- hermandad. Para todos los demás esto está vacío y no pasa nada más.
  quien as (
    select h.id
      from hermanos h, sitio s
     where h.id = hermano_propio_id()
       and h.hermandad_id = s.hermandad_id
       and h.estado <> 'Baja'
  ),
  suyo as (
    select m.porcentaje
      from sitio s, quien q, mejor_descuento_para(s.hermandad_id, q.id) m
  )
  select
    p.id, p.codigo, p.nombre, p.descripcion, p.precio,
    -- La misma fórmula, letra por letra, que aplica `registrar_venta` al cobrar.
    (select round(p.precio * (1 - porcentaje / 100), 2) from suyo) as precio_hermano,
    (select porcentaje from suyo) as descuento_pct,
    p.iva, p.foto_url,
    -- Topado a cero: a quien compra no le sirve de nada un número negativo. En
    -- el panel sí se enseña tal cual, porque allí es la alarma.
    greatest(0, disponible_de(p.id))::int as disponible
  from sitio s
  join productos p on p.hermandad_id = s.hermandad_id
  where p.activo and p.visible_en_web
  order by p.nombre
$$;

revoke all on function catalogo_web(text) from public;
grant execute on function catalogo_web(text) to anon, authenticated;

comment on function catalogo_web(text) is
  'El género publicado de una hermandad, para su web pública. Sin `coste` y sin '
  '`stock` real: solo lo que se puede prometer.';


-- ----------------------------------------------------------------------------
-- 8. Y DE QUÉ HERMANDAD ES ESA WEB
-- ----------------------------------------------------------------------------
--
-- `crear_reserva_web` necesita el identificador de la hermandad, y el
-- navegador solo tiene el slug. Esto lo traduce, y únicamente si la web está
-- publicada: sin esa condición, el slug sería una forma de averiguar el
-- identificador de una hermandad que todavía no ha salido.
create or replace function hermandad_de_la_tienda(p_slug text) returns uuid
language sql stable security definer set search_path = public as $$
  select w.hermandad_id from web_publica w where w.slug = p_slug and w.publicada limit 1
$$;

revoke all on function hermandad_de_la_tienda(text) from public;
grant execute on function hermandad_de_la_tienda(text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 9. EL RESGUARDO POR CORREO
-- ----------------------------------------------------------------------------
--
-- Quien reserva no tiene cuenta y no puede volver a consultar nada: lo único
-- que se lleva es la referencia que sale en pantalla. Si cierra la pestaña sin
-- apuntarla, se planta en la casa de hermandad sin saber qué dijo, y quien
-- está en el mostrador tiene que buscarla por el nombre.
--
-- Así que se le manda por correo. Y lo manda EL SERVIDOR, no el navegador, por
-- lo mismo que la confirmación de la lista de avisos: el navegador diría a qué
-- dirección, y entonces esta función sería una forma de mandarle un correo con
-- membrete de la hermandad a quien uno quiera. Aquí el destinatario se LEE de
-- la reserva que se acaba de crear.
--
-- LOS TRES CIERRES, y ninguno sobra:
--
--   · Solo si está pendiente. Una reserva entregada o anulada no manda nada.
--   · Solo en la media hora siguiente a crearla. Pasado eso, probar
--     referencias una detrás de otra —R-2027-1, R-2027-2…— no sirve de nada.
--   · Solo UNA VEZ. Se marca al devolverla, así que repetir la llamada con la
--     misma referencia no le llena el buzón a nadie.
alter table reservas_tienda add column if not exists resguardo_enviado_en timestamptz;

create or replace function resguardo_de_reserva(p_hermandad_id uuid, p_referencia text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res reservas_tienda%rowtype;
  v_lineas jsonb;
  v_hermandad text;
begin
  select * into v_res from reservas_tienda r
   where r.hermandad_id = p_hermandad_id
     and r.referencia = p_referencia
     and r.estado = 'pendiente'
     and r.resguardo_enviado_en is null
     and r.creado_en > now() - interval '30 minutes'
   for update;
  -- Sin fila se devuelve NADA, sin decir por qué: distinguir «no existe» de
  -- «ya se mandó» desde fuera sería una forma de preguntar quién ha reservado.
  if not found then return null; end if;
  if v_res.email = '' then return null; end if;

  select jsonb_agg(jsonb_build_object(
           'nombre', l.nombre, 'cantidad', l.cantidad, 'importe', l.precio_unitario * l.cantidad)
         order by l.nombre)
    into v_lineas
    from lineas_reserva l where l.reserva_id = v_res.id;

  select h.nombre into v_hermandad from hermandades h where h.id = p_hermandad_id;

  update reservas_tienda set resguardo_enviado_en = now() where id = v_res.id;

  return jsonb_build_object(
    'email', v_res.email,
    'nombre', v_res.nombre,
    'referencia', v_res.referencia,
    'total', v_res.total,
    'recoger_antes_de', v_res.recoger_antes_de,
    'hermandad', coalesce(v_hermandad, ''),
    'lineas', coalesce(v_lineas, '[]'::jsonb)
  );
end $$;

-- Solo la clave de servicio, que es la que usa `enviar-correo`. Desde el
-- navegador NO: devuelve el correo y el teléfono de quien reservó.
revoke all on function resguardo_de_reserva(uuid, text) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 10. «TU RESERVA ESTÁ LISTA»
-- ----------------------------------------------------------------------------
--
-- Lo que faltaba del circuito y lo que más se nota: quien aparta algo por la
-- web recibe su resguardo y luego NO VUELVE A SABER NADA. Se le dice «pásate
-- cuando puedas» y ahí acaba. Si el género hay que pedirlo, o hay que grabar la
-- medalla, la persona se planta un martes por la tarde a por algo que todavía
-- no está — o no se planta nunca, y el plazo se cumple con la reserva viva y el
-- género apartado para nadie.
--
-- LO DISPARA UNA PERSONA DESDE EL PANEL, no un reloj. Y no por comodidad:
-- mandar un correo desde la base exigiría guardar dentro de ella la clave del
-- proveedor de envío, y eso está descartado por escrito en
-- `tareas-programadas.sql`. Quien prepara la reserva es quien sabe que está
-- lista, así que es quien lo dice.
--
-- LLEGA POR DOS SITIOS, Y LOS DOS HACEN FALTA:
--
--   · Un aviso en su área del hermano, si resultó ser hermano de la casa. Ahí
--     se queda escrito y no depende de que el correo llegue.
--   · Y un correo, si dejó dirección. Es lo único que llega a quien no es
--     hermano y a quien no entra nunca en su área.

alter table reservas_tienda add column if not exists lista_en   timestamptz;
alter table reservas_tienda add column if not exists avisada_en timestamptz;

/*
 * MARCARLA COMO LISTA. La llama el panel, con sesión y con permiso.
 *
 * Devuelve `hermandad_id` y `referencia` porque es lo que el navegador necesita
 * para pedir el correo después, y no tiene por qué adivinarlo; y `hay_correo`
 * para poder decir en pantalla si de verdad se va a mandar algo o si a esa
 * persona hay que llamarla por teléfono.
 */
create or replace function avisar_reserva_lista(p_reserva_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_res reservas_tienda%rowtype;
  v_repetida boolean;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede avisar de una reserva.';
  end if;

  select * into v_res from reservas_tienda r
   where r.id = p_reserva_id and r.hermandad_id = v_hermandad
   for update;
  if not found then
    raise exception 'Esa reserva no es de esta hermandad.';
  end if;
  if v_res.estado <> 'pendiente' then
    raise exception 'Esa reserva ya está %, así que no hay nada que avisar.', v_res.estado;
  end if;

  -- Avisar dos veces el mismo día no es insistir, es molestar. Se dice que ya
  -- estaba avisada en vez de callarse: la pantalla tiene que poder contarlo.
  v_repetida := v_res.avisada_en is not null and v_res.avisada_en > now() - interval '1 day';

  update reservas_tienda set lista_en = coalesce(lista_en, now()) where id = p_reserva_id;

  /*
   * EL AVISO EN SU ÁREA, si es hermano. Va aquí y no en el correo porque es lo
   * único que no se pierde: un correo puede acabar en la carpeta de spam, y
   * entonces no queda rastro de que se le avisó.
   */
  if v_res.hermano_id is not null and not v_repetida then
    insert into avisos_hermano (hermandad_id, hermano_id, texto, tipo, titulo)
    values (
      v_hermandad, v_res.hermano_id,
      format('Ya puedes pasar a recoger lo que apartaste (%s). Son %s€, que se pagan al recogerlo%s.',
             v_res.referencia,
             to_char(v_res.total, 'FM999999990.00'),
             case when v_res.recoger_antes_de is null then ''
                  else format(', y te lo guardamos hasta el %s',
                              to_char(v_res.recoger_antes_de, 'DD/MM/YYYY')) end),
      'tienda', 'Tu reserva está lista'
    );
  end if;

  return jsonb_build_object(
    'hermandad_id', v_hermandad,
    'referencia', v_res.referencia,
    'hay_correo', v_res.email <> '',
    'es_hermano', v_res.hermano_id is not null,
    'ya_avisada', v_repetida
  );
end $$;

revoke all on function avisar_reserva_lista(uuid) from public, anon;
grant execute on function avisar_reserva_lista(uuid) to authenticated;

/*
 * Y LO QUE LEE `enviar-correo` PARA MANDARLO, con los mismos cierres que el
 * resguardo. Calcada de `resguardo_de_reserva` a propósito: es la misma clase
 * de función —devuelve un correo y un nombre— y los mismos cierres tienen que
 * seguir puestos.
 *
 *   · Solo si alguien la ha marcado lista. Sin eso, esto sería una forma de
 *     sacar el correo de cualquiera que haya reservado, probando referencias.
 *   · Solo una vez al día. Sin ese freno, el botón del panel sería una manera
 *     de mandarle veinte correos a alguien.
 *   · Y sin fila, NADA, sin decir por qué: distinguir «no existe» de «ya se
 *     mandó» desde fuera vuelve a ser una forma de preguntar quién ha
 *     reservado.
 */
create or replace function datos_para_avisar_reserva(p_hermandad_id uuid, p_referencia text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res reservas_tienda%rowtype;
  v_lineas jsonb;
  v_hermandad text;
begin
  select * into v_res from reservas_tienda r
   where r.hermandad_id = p_hermandad_id
     and r.referencia = p_referencia
     and r.estado = 'pendiente'
     and r.lista_en is not null
     and (r.avisada_en is null or r.avisada_en < now() - interval '1 day')
   for update;
  if not found then return null; end if;
  if v_res.email = '' then return null; end if;

  select jsonb_agg(jsonb_build_object(
           'nombre', l.nombre, 'cantidad', l.cantidad, 'importe', l.precio_unitario * l.cantidad)
         order by l.nombre)
    into v_lineas
    from lineas_reserva l where l.reserva_id = v_res.id;

  select h.nombre into v_hermandad from hermandades h where h.id = p_hermandad_id;

  update reservas_tienda set avisada_en = now() where id = v_res.id;

  return jsonb_build_object(
    'email', v_res.email,
    'nombre', v_res.nombre,
    'referencia', v_res.referencia,
    'total', v_res.total,
    'recoger_antes_de', v_res.recoger_antes_de,
    'hermandad', coalesce(v_hermandad, ''),
    'lineas', coalesce(v_lineas, '[]'::jsonb)
  );
end $$;

-- Solo la clave de servicio, igual que el resguardo: desde el navegador NO,
-- porque devuelve el correo de quien reservó.
revoke all on function datos_para_avisar_reserva(uuid, text) from public, anon, authenticated;

-- =============================================================================
--   CAMPANAS-Y-PROYECTOS.SQL — Campañas de recaudación con su barra, y proyectos a largo plazo
-- =============================================================================

-- ============================================================================
--   CAMPAÑAS DE RECAUDACIÓN Y PROYECTOS
-- ============================================================================
--
-- Lo que se pidió, tal cual: «hay que crear una parte de campañas y proyectos,
-- en la que las campañas sean recolecciones de dinero con una barra hasta que
-- se llegue al objetivo, y los proyectos que sean como tareas pero a largo
-- plazo».
--
-- ----------------------------------------------------------------------------
-- LA DECISIÓN QUE EXPLICA TODO LO DEMÁS: LO RECAUDADO NO SE GUARDA AQUÍ
-- ----------------------------------------------------------------------------
--
-- En esta tabla no hay ninguna columna «recaudado». Lo que lleva reunido una
-- campaña se cuenta sumando los APUNTES DE TESORERÍA que llevan su marca en
-- `origen` — `campana:<id>:<aportacion>` — igual que las cuotas y las
-- papeletas (ver `lib/apuntes.ts`).
--
-- Un contador propio sería más rápido de leer y estaría mal a las dos semanas:
--
--   · En cuanto alguien corrige un apunte en Tesorería —una cifra mal
--     tecleada, un donativo que se anula—, el contador se queda con el número
--     viejo. Y entonces hay DOS VERDADES sobre el mismo dinero: la que enseña
--     la barra y la que dice el libro. La que se publica en la web es siempre
--     la equivocada, porque nadie republica una barra.
--
--   · Es exactamente la queja que trajo esto: «el concepto de cuota no se pasa
--     a tesorería». Dinero que entra y del que el libro no se entera. Contando
--     desde el libro eso no puede pasar: un donativo que no está en Tesorería
--     no mueve la barra, así que si la barra sube, el tesorero lo tiene.
--
-- Cuesta una consulta más. Merece la pena.
--
-- ----------------------------------------------------------------------------
-- QUIÉN PUEDE QUÉ
-- ----------------------------------------------------------------------------
--
-- Módulo nuevo, `campanas`. Se siembra a los cargos que tienen sentido: el
-- Hermano Mayor, el Secretario, el Tesorero (una campaña es dinero) y el
-- Mayordomo (los proyectos suelen ser suyos: el paso, el manto, la casa).
--
-- Tesorería e Informes pueden LEER sin poder tocar: el tesorero necesita saber
-- a qué campaña corresponde un apunte que está conciliando, y el Estado de
-- Cuentas anual quiere poder decir cuánto se recaudó para qué.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Es seguro repetirlo: no borra ni sobrescribe nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Las campañas
-- ----------------------------------------------------------------------------

create table if not exists campanas_recaudacion (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  nombre text not null,
  descripcion text not null default '',
  /*
   * EL OBJETIVO, EN CÉNTIMOS Y ENTERO.
   *
   * En `numeric` con dos decimales habría que decidir qué pasa con el tercer
   * decimal, y JavaScript y Postgres no redondean igual los empates: una
   * campaña de 12.345,675 € se guardaría como una cosa y se leería como otra.
   * En céntimos no hay nada que redondear. Es lo mismo que se hace en la
   * tienda con los precios, y por lo mismo.
   *
   * CERO SIGNIFICA «SIN OBJETIVO» y es un caso de verdad, no un hueco: el
   * cepillo de caridad se abre sin cifra. Esas no tienen barra —no hay nada
   * que llenar—, solo total. Por eso `>= 0` y no `> 0`.
   */
  objetivo_cent bigint not null default 0 check (objetivo_cent >= 0),
  fecha_inicio date not null default current_date,
  fecha_fin date,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  -- Si sale en la web pública con su barra, para que done gente de fuera.
  en_la_web boolean not null default false,
  creada_en timestamptz not null default now(),
  -- Una campaña que acaba antes de empezar es una errata, no una campaña.
  constraint campanas_fechas_con_sentido check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

alter table campanas_recaudacion enable row level security;

-- Lo que se pregunta al pintar la web pública: las abiertas que salen fuera.
create index if not exists campanas_en_la_web_idx
  on campanas_recaudacion (hermandad_id) where en_la_web and estado = 'abierta';


-- ----------------------------------------------------------------------------
-- 2. Los proyectos
-- ----------------------------------------------------------------------------

create table if not exists proyectos (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  nombre text not null,
  descripcion text not null default '',
  /*
   * «idea» existe a propósito y es el estado más útil de los cuatro: lo que se
   * habló en un cabildo y quedó ahí. Sin un sitio donde ponerlo se pierde
   * entre un acta y la siguiente, y a los dos años alguien lo vuelve a
   * proponer como nuevo.
   */
  estado text not null default 'idea' check (estado in ('idea', 'en marcha', 'parado', 'hecho')),
  responsable_id uuid references hermanos(id) on delete set null,
  /*
   * EL NOMBRE DEL RESPONSABLE SE GUARDA ADEMÁS DEL IDENTIFICADOR.
   *
   * No es duplicar por duplicar: un proyecto dura años y el hermano que lo
   * llevaba puede darse de baja. Con solo el identificador, `on delete set
   * null` lo deja a nulo y el proyecto se queda sin nombre —«responsable:
   * nadie»— justo cuando hace falta saber quién sabía de esto. Guardando el
   * nombre queda el rastro aunque la ficha ya no esté.
   */
  responsable_nombre text,
  -- La fecha es un OBJETIVO, no una cita, y puede no estar: «cuando se pueda»
  -- es una respuesta válida y no puede obligar a inventarse un día.
  fecha_objetivo date,
  presupuesto_cent bigint not null default 0 check (presupuesto_cent >= 0),
  -- La campaña que lo paga, si tiene una. Lo recaudado se cuenta desde
  -- Tesorería, no se copia aquí.
  recaudacion_id uuid references campanas_recaudacion(id) on delete set null,
  creado_en timestamptz not null default now()
);

alter table proyectos enable row level security;

create table if not exists tareas_proyecto (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  titulo text not null,
  hecha boolean not null default false,
  hermano_id uuid references hermanos(id) on delete set null,
  hermano_nombre text,
  fecha_limite date,
  creada_en timestamptz not null default now()
);

alter table tareas_proyecto enable row level security;

create index if not exists tareas_proyecto_del_proyecto_idx on tareas_proyecto (proyecto_id);


-- ----------------------------------------------------------------------------
-- 3. Cada hermandad, la suya
-- ----------------------------------------------------------------------------
--
-- El mismo patrón que el resto: una política RESTRICTIVA que encierra la fila
-- en su hermandad —esa se cumple SIEMPRE, se sume a las demás o no— y encima
-- las permisivas, que dicen quién puede tocar qué.
--
-- Y el disparador que vuelve a fijar `hermandad_id`: el `default` solo actúa
-- cuando no se manda la columna, y quien manda desde el navegador puede
-- mandarla. Sin esto, un `insert` con la hermandad de otro se cuela.

do $$
declare t text;
begin
  foreach t in array array['campanas_recaudacion', 'proyectos', 'tareas_proyecto'] loop
    execute format('drop policy if exists "solo_mi_hermandad" on %I', t);
    execute format(
      'create policy "solo_mi_hermandad" on %I as restrictive for all to authenticated '
      'using (hermandad_id = hermandad_actual()) with check (hermandad_id = hermandad_actual())', t);

    execute format('drop policy if exists "campanas_gestiona" on %I', t);
    execute format(
      'create policy "campanas_gestiona" on %I for all to authenticated '
      'using (modulo_permitido(''campanas'')) with check (modulo_permitido(''campanas''))', t);

    /*
     * TESORERÍA E INFORMES LEEN, SIN PODER TOCAR.
     *
     * El tesorero necesita saber a qué campaña corresponde un apunte que está
     * conciliando: en el libro solo ve `campana:<id>`, y sin poder leer esta
     * tabla eso es un identificador y nada más. Y el Estado de Cuentas anual
     * quiere poder decir cuánto se recaudó y para qué.
     *
     * Solo `select`: quien lleva el dinero no decide qué campañas hay.
     */
    execute format('drop policy if exists "tesoreria_lee_campanas" on %I', t);
    execute format(
      'create policy "tesoreria_lee_campanas" on %I for select to authenticated '
      'using (modulo_permitido(''tesoreria'') or modulo_permitido(''informes''))', t);

    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

create or replace function campanas_fija_hermandad() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.hermandad_id := hermandad_actual();
  else
    -- Una fila no se muda de hermandad. Ni por error ni a mano.
    new.hermandad_id := old.hermandad_id;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['campanas_recaudacion', 'proyectos', 'tareas_proyecto'] loop
    execute format('drop trigger if exists %I on %I', t || '_fija_hermandad', t);
    execute format(
      'create trigger %I before insert or update on %I '
      'for each row execute function campanas_fija_hermandad()', t || '_fija_hermandad', t);
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 4. El módulo nuevo, sembrado en las hermandades que ya existen
-- ----------------------------------------------------------------------------
--
-- Sin esto, `modulo_permitido('campanas')` da falso para TODO el mundo en
-- cualquier hermandad ya creada, incluido el Hermano Mayor: la pantalla se lo
-- ofrecería y la política lo rechazaría, que es justo el fallo que ya pasó una
-- vez con «eventos» y «web» (ver `permisos-eventos-y-web.sql`).
--
-- Y SE AÑADE SOLO A LOS CARGOS QUE ESA HERMANDAD YA RECONOCE. Si nunca se le
-- sembró «Vocal», no se le inventa uno ahora.

insert into permisos_cargo (hermandad_id, cargo, modulo_id)
select h.id, f.cargo, 'campanas'
from hermandades h
cross join (values
  ('Hermano Mayor'),
  ('Secretario/a'),
  ('Tesorero/a'),
  ('Mayordomo/Prioste')
) as f(cargo)
where exists (
  select 1 from permisos_cargo pc
  where pc.hermandad_id = h.id and pc.cargo = f.cargo
)
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- 5. Las campañas que salen en la web pública
-- ----------------------------------------------------------------------------
--
-- Quien visita la web NO ha entrado en ningún sitio: es `anon`, y las
-- políticas de arriba son todas `to authenticated`. Así que la web no vería ni
-- una campaña — el mismo tropiezo que ya está contado en `tienda-web.sql`.
--
-- Se resuelve igual: una función SECURITY DEFINER que devuelve SOLO lo
-- publicable, con columnas con nombre. No se abre la tabla a `anon`, porque
-- entonces se vería también la campaña que la hermandad tiene preparada y
-- todavía no ha anunciado.
--
-- LO RECAUDADO SE CALCULA AQUÍ DENTRO, desde los apuntes, por lo mismo que en
-- todas partes. Y se devuelve solo el TOTAL: quién ha donado y cuánto no sale
-- de la hermandad.

create or replace function campanas_de_la_web(p_slug text)
returns table (
  id uuid,
  nombre text,
  descripcion text,
  objetivo_cent bigint,
  recaudado_cent bigint,
  aportaciones integer,
  fecha_fin date
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.nombre,
    c.descripcion,
    c.objetivo_cent,
    -- Los gastos de la campaña se RESTAN: enseñar lo bruto como si fuera lo
    -- disponible es mentir sobre cuánto falta.
    coalesce((
      select sum(case when m.tipo = 'Ingreso' then round(m.importe * 100)
                      else -round(m.importe * 100) end)::bigint
      from movimientos m
      where m.hermandad_id = c.hermandad_id
        and m.origen like 'campana:' || c.id::text || ':%'
    ), 0),
    coalesce((
      select count(*)::integer
      from movimientos m
      where m.hermandad_id = c.hermandad_id
        and m.tipo = 'Ingreso'
        and m.origen like 'campana:' || c.id::text || ':%'
    ), 0),
    c.fecha_fin
  from campanas_recaudacion c
  join web_publica w on w.hermandad_id = c.hermandad_id
  where w.slug = p_slug
    -- Una web sin publicar se puede ver desde su propia hermandad, para poder
    -- comprobar cómo va a quedar antes de anunciarla.
    and (w.publicada or w.hermandad_id = hermandad_actual())
    and c.en_la_web
    and c.estado = 'abierta'
  order by c.creada_en;
$$;

grant execute on function campanas_de_la_web(text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 6. ¿Ha quedado puesto?
-- ----------------------------------------------------------------------------
--
-- AQUÍ NO SE DEVUELVE NADA A PROPÓSITO. La comprobación de este fichero vive
-- en el informe único del final de `ACTUALIZAR.sql`, junto a la de todos los
-- demás.
--
-- Tenía su propio `select` al final y estaba mal: `ACTUALIZAR.sql` promete en
-- su cabecera que «al terminar sale una tabla» y que «es lo único que
-- devuelve». Con un `select` suelto por el medio salen dos, y quien lo ejecuta
-- —que no es informático— se queda mirando una tabla de tres números sin
-- título preguntándose si eso es un error.

-- =============================================================================
--   BAJA-DE-HERMANO.SQL — La baja de un hermano, entera y sin romper el escalafón
-- =============================================================================

-- ============================================================================
--   LA BAJA DE UN HERMANO, EN UN SOLO PASO Y SIN ROMPER EL ESCALAFÓN
-- ============================================================================
--
-- QUÉ PASABA. Al tramitar una baja saltaba esto, veinte veces seguidas:
--
--   guardar 660b6973-…: duplicate key value violates unique constraint
--   "hermanos_numero_por_hermandad"
--
-- Y la baja NO se guardaba. En la pantalla salía tramitada; en la base seguía
-- todo igual. Los dos lados diciendo cosas distintas sobre el censo, que es de
-- lo peor que puede pasar aquí.
--
-- ----------------------------------------------------------------------------
-- POR QUÉ
-- ----------------------------------------------------------------------------
--
-- Dar de baja no toca una ficha: toca TODO EL ESCALAFÓN. El que se va sale de
-- la numeración (número 0) y todos los de detrás suben un puesto, que es como
-- funciona un escalafón — el hueco se cierra.
--
-- En una hermandad de mil, dar de baja al nº 8 son novecientas noventa y dos
-- fichas cambiadas. La aplicación las mandaba de seis en seis Y EN PARALELO, y
-- ahí está el fallo: el nº 9 intenta ponerse el 8 mientras el 8 todavía es el
-- 8, porque su petición va en el mismo lote y nadie garantiza el orden. El
-- índice único `(hermandad_id, numero)` lo rechaza, y lo rechaza casi todo.
--
-- No se arregla mandándolas de una en una y en orden: son cientos de viajes, y
-- si se corta a la mitad —se cierra el portátil, se cae la conexión— queda un
-- escalafón con la mitad corrida y la otra mitad no. Eso no hay quien lo
-- deshaga después.
--
-- ----------------------------------------------------------------------------
-- CÓMO SE ARREGLA
-- ----------------------------------------------------------------------------
--
-- Aquí, en una sola llamada y dentro de una transacción: o se hace entero o no
-- se hace nada.
--
-- Y el hueco se cierra EN DOS PASOS, con las fichas pasando por números
-- negativos. No es un truco caprichoso: el índice único es PARCIAL, solo mira
-- `where numero > 0`. En negativo las fichas quedan FUERA del índice, así que
-- se pueden mover todas sin que ninguna choque con ninguna; y al volver a
-- positivo, los huecos ya están libres.
--
-- Un solo `update numero = numero - 1` no valdría: Postgres comprueba la
-- unicidad fila a fila, no al final de la instrucción, así que la primera que
-- se mueve ya choca con la siguiente.
--
-- SECURITY INVOKER a propósito: la baja la tiene que poder hacer quien tenga
-- permiso para tocar el censo, y no más. Con DEFINER, cualquiera con la clave
-- pública podría dar de baja a quien quisiera.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Es seguro repetirlo: no borra ni sobrescribe datos.
-- ============================================================================

create or replace function dar_de_baja_hermano(p_hermano uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_hermandad uuid;
  v_numero int;
begin
  select hermandad_id, numero into v_hermandad, v_numero
    from hermanos where id = p_hermano;

  -- Sin ficha (o sin permiso para verla) no hay nada que hacer. No se lanza
  -- error: quien no la ve tampoco tiene por qué enterarse de que existe.
  if v_hermandad is null then return; end if;

  /*
   * LA BAJA QUITA EL CARGO, y no es limpieza.
   *
   * La única forma que tiene la base de revocarle los permisos a alguien es su
   * `estado`: `auth_es_hermano()` y `modulo_permitido()` preguntan por
   * `estado <> 'Baja'`. Dejarle el cargo escrito al tesorero destituido es
   * dejar la puerta apoyada: basta con que su estado vuelva a «Activo» —un
   * error de secretaría, una reincorporación— para que recupere Tesorería sin
   * que nadie lo haya decidido.
   */
  update hermanos
     set estado = 'Baja',
         numero = 0,
         cargo = null,
         baja_solicitada = false
   where id = p_hermano;

  -- Quien no ocupaba sitio no deja hueco al irse: el hermano civil y la ficha
  -- recién importada llevan número 0 a propósito.
  if v_numero > 0 then
    update hermanos
       set numero = -numero
     where hermandad_id = v_hermandad and numero > v_numero;

    update hermanos
       set numero = (-numero) - 1
     where hermandad_id = v_hermandad and numero < 0;
  end if;
end $$;

comment on function dar_de_baja_hermano(uuid) is
  'Da de baja a un hermano y cierra el hueco que deja en el escalafón, entero y de una vez. '
  'Los de detrás suben un puesto pasando por números negativos, que quedan fuera del índice '
  'único parcial (numero > 0) y por eso no chocan entre ellos. Hacerlo desde el navegador, '
  'ficha a ficha, chocaba con ese índice y dejaba la baja sin guardar.';

grant execute on function dar_de_baja_hermano(uuid) to authenticated;

-- =============================================================================
--   CAMPANA-CON-PARTIDA.SQL — Enlazar una campaña a sus partidas: la barra se llena sola
-- =============================================================================

-- ============================================================================
--   LA CAMPAÑA ENLAZADA A SUS PARTIDAS DE TESORERÍA
-- ============================================================================
--
-- Lo que se pidió, tal cual: «cuando se crea una campaña debe de poder ir
-- asociada una cuenta de gasto o ingreso a ella; entonces cuando se anote un
-- ingreso o gasto con razón a esa partida se rellena parte de la barra
-- automáticamente».
--
-- ----------------------------------------------------------------------------
-- QUÉ CAMBIA, Y QUÉ NO
-- ----------------------------------------------------------------------------
--
-- Hasta ahora la barra solo subía con lo que se apuntaba DESDE LA PROPIA
-- PANTALLA de la campaña, que deja su marca en `movimientos.origen`
-- (`campana:<id>:<aportacion>`). Eso obliga al tesorero a apuntar el donativo
-- por la campaña y no por Tesorería, que es donde él trabaja — y si lo apunta
-- en Tesorería, la barra no se entera.
--
-- Con esto, la campaña puede decir «lo que entre por la partida Donativos es
-- mío». El tesorero sigue apuntando donde siempre y la barra se llena sola.
--
-- NO se toca cómo se cuenta: se sigue contando desde el libro, sin ninguna
-- columna «recaudado». Lo único que cambia es QUÉ apuntes se miran. Todo lo
-- que dice `campanas-y-proyectos.sql` sobre por qué no hay contador sigue en
-- pie, y con más motivo: ahora hay dos formas de que un apunte entre en la
-- barra, y un contador tendría que acordarse de las dos.
--
-- ----------------------------------------------------------------------------
-- POR QUÉ VARIAS PARTIDAS Y NO UNA
-- ----------------------------------------------------------------------------
--
-- Porque una campaña tiene las dos caras: los donativos que entran y los
-- gastos que genera —la imprenta de las huchas, el transporte del paso—. Con
-- una sola habría que elegir cuál de las dos cuenta, y enseñar lo bruto como
-- si fuera lo disponible es mentir sobre cuánto falta.
--
-- ----------------------------------------------------------------------------
-- LA VENTANA DE FECHAS, QUE ES LO QUE HACE QUE ESTO SEA SEGURO
-- ----------------------------------------------------------------------------
--
-- Un apunte solo cuenta por partida si su fecha cae DENTRO de las fechas de la
-- campaña. Sin esa regla, abrir hoy una campaña enlazada a «Donativos,
-- Ofrendas y Cepillos» enseñaría de golpe todos los donativos de la historia
-- de la hermandad como si fueran suyos: la barra saldría llena el primer día,
-- y encima en la web pública.
--
-- Eso se comprueba en la aplicación (`lib/recaudaciones.ts`), que es donde se
-- suma. Aquí solo se guarda la lista.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Es seguro repetirlo: no borra ni sobrescribe nada.
-- ============================================================================

alter table campanas_recaudacion
  add column if not exists partidas text[] not null default '{}';

comment on column campanas_recaudacion.partidas is
  'Partidas de Tesorería enlazadas. Todo apunte de estas partidas cuyo día caiga '
  'entre fecha_inicio y fecha_fin cuenta para la barra sin tener que marcarlo a mano. '
  'Vacío = ninguna, y la campaña solo suma lo que se apunta desde su propia pantalla. '
  'Son los nombres de CATEGORIAS_INGRESO y CATEGORIAS_GASTO de data/movimientos.ts.';

-- =============================================================================
--   REGLAS-DE-REPARTO.SQL — Gastos porcentuales enlazados a una partida, para pérdidas y ganancias
-- =============================================================================

-- ============================================================================
--   GASTOS PORCENTUALES ENLAZADOS A UNA PARTIDA
-- ============================================================================
--
-- Lo que se pidió: «opción de añadir gastos porcentuales a los ingresos,
-- gastos, etc. que se pueda enlazar», para la cuenta de pérdidas y ganancias.
--
-- Son DOS COSAS distintas, las dos normales en una hermandad, y el «a los
-- ingresos, GASTOS, etc.» dice que la regla se engancha a cualquiera de los
-- dos. Están las dos y se elige al crearla:
--
--   · REPARTO — trocear un gasto REAL entre partidas. «La luz: 60 % a la casa
--     hermandad, 40 % al almacén.» El dinero ya salió y el total NO cambia:
--     solo se dice a qué corresponde cada trozo.
--
--   · COMPROMISO — apartar un % de lo que entre por una partida. «El 10 % de
--     la lotería va a caridad.» Aquí no ha salido dinero todavía.
--
-- ----------------------------------------------------------------------------
-- ESTO NO ESCRIBE NI UN APUNTE EN TESORERÍA. NUNCA.
-- ----------------------------------------------------------------------------
--
-- Es la decisión que hay que entender antes de tocar nada aquí, y por eso no
-- existe ningún disparador que genere movimientos desde esta tabla.
--
-- Un compromiso NO es un gasto: es dinero que sigue en la cuenta. Apuntarlo en
-- el libro rompería las dos cosas a la vez:
--
--   1. EL SALDO DEJARÍA DE CUADRAR CON EL BANCO. El libro diría que hay 1.000 €
--      menos de los que hay, y el tesorero buscaría en el extracto un pago que
--      no existe.
--
--   2. SE CONTARÍA DOS VECES. El día que de verdad se dé el dinero a caridad,
--      ESE sí es un apunte real. Con el compromiso ya apuntado, la caridad
--      saldría por el doble.
--
-- Un reparto tampoco: el gasto ya está en el libro entero y por su importe
-- bueno, que es el de la factura. Trocearlo ahí sería cambiar una línea que
-- cuadra con un papel por tres que no cuadran con nada.
--
-- Así que esto es una tabla de CONFIGURACIÓN, no de movimientos: dice cómo se
-- lee el informe, no qué ha pasado con el dinero.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Es seguro repetirlo: no borra ni sobrescribe nada.
-- ============================================================================

create table if not exists reglas_reparto (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'reparto' check (tipo in ('reparto', 'compromiso')),
  -- La partida a la que se ENGANCHA. Se guarda el NOMBRE de la categoría, no
  -- un identificador: las categorías las define cada hermandad en su catálogo
  -- (`CLAVES_CATALOGOS`) y no hay tabla a la que apuntar.
  categoria_base text not null,
  /*
   * EL PORCENTAJE, EN CENTÉSIMAS DE PUNTO Y ENTERO: 12,5 % → 1250.
   *
   * Por lo mismo que el dinero va en céntimos. En `numeric` con decimales,
   * JavaScript y Postgres redondean distinto los empates, así que el informe de
   * la pantalla y el que saliera de una consulta a la base darían cifras
   * distintas para el mismo año — y las dos parecerían correctas.
   *
   * El tope es 10000 (100 %): nadie puede repartir más de lo que hay.
   */
  porcentaje_cent integer not null check (porcentaje_cent > 0 and porcentaje_cent <= 10000),
  categoria_destino text not null,
  activo boolean not null default true,
  nota text not null default '',
  creado_en timestamptz not null default now(),
  /*
   * ENGANCHARLA A SÍ MISMA deja un informe absurdo —«el 40 % de Mantenimiento
   * va a Mantenimiento»— y no da error en ninguna parte. Es un despiste de un
   * clic, porque las dos listas de la pantalla son idénticas, y después nadie
   * entiende por qué los números no cambian.
   */
  constraint reglas_reparto_no_a_si_misma check (categoria_base <> categoria_destino)
);

alter table reglas_reparto enable row level security;

create index if not exists reglas_reparto_activas_idx
  on reglas_reparto (hermandad_id) where activo;


-- ----------------------------------------------------------------------------
-- Cada hermandad, las suyas
-- ----------------------------------------------------------------------------
--
-- El mismo patrón que el resto: una política RESTRICTIVA que encierra la fila
-- en su hermandad —esa se cumple siempre— y encima las permisivas.

drop policy if exists "solo_mi_hermandad" on reglas_reparto;
create policy "solo_mi_hermandad" on reglas_reparto as restrictive for all to authenticated
  using (hermandad_id = hermandad_actual())
  with check (hermandad_id = hermandad_actual());

-- Quien lleva el dinero es quien decide cómo se reparte.
drop policy if exists "tesoreria_manda" on reglas_reparto;
create policy "tesoreria_manda" on reglas_reparto for all to authenticated
  using (modulo_permitido('tesoreria'))
  with check (modulo_permitido('tesoreria'));

/*
 * Y QUIEN SACA LOS INFORMES TIENE QUE PODER LEERLAS, aunque no lleve el dinero.
 *
 * Sin esto, el Secretario abre la cuenta de pérdidas y ganancias y le sale sin
 * ninguna regla aplicada: no un error, sino OTRAS CIFRAS. Y RLS no avisa —
 * devuelve cero filas y ya—. Dos personas de la misma junta imprimirían el
 * mismo informe del mismo año con resultados distintos, y no habría forma de
 * saber cuál es el bueno mirando el papel.
 *
 * Solo `select`: leerlas para el informe, no decidirlas.
 */
drop policy if exists "informes_lee" on reglas_reparto;
create policy "informes_lee" on reglas_reparto for select to authenticated
  using (modulo_permitido('informes'));

grant select, insert, update, delete on reglas_reparto to authenticated;

-- Una fila no se muda de hermandad, ni por error ni a mano: el `default` solo
-- actúa cuando no se manda la columna, y quien escribe desde el navegador
-- puede mandarla.
create or replace function reglas_reparto_fija_hermandad() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.hermandad_id := hermandad_actual();
  else
    new.hermandad_id := old.hermandad_id;
  end if;
  return new;
end $$;

drop trigger if exists reglas_reparto_fija_hermandad on reglas_reparto;
create trigger reglas_reparto_fija_hermandad
  before insert or update on reglas_reparto
  for each row execute function reglas_reparto_fija_hermandad();

-- =============================================================================
--   PAGO-TARJETA.SQL — Que el hermano pague su cuota o su papeleta con tarjeta
-- =============================================================================

-- ============================================================================
--   C4 · QUE EL HERMANO PAGUE SU CUOTA O SU PAPELETA CON TARJETA
-- ============================================================================
--
-- Hoy el hermano solo puede pagar por domiciliación, por transferencia o
-- pasándose por la casa de hermandad. Con tarjeta lo hace desde el sofá, y la
-- hermandad se ahorra el «avísame cuando lo hagas» y el cotejo a mano.
--
-- ----------------------------------------------------------------------------
-- EL DINERO NO PASA POR GOBERGO. NUNCA.
-- ----------------------------------------------------------------------------
--
-- Esta es la decisión que manda sobre todo lo demás, y ya estaba escrita en
-- `lib/pagoSuscripcion.ts`: lo que los hermanos le pagan a su hermandad va
-- DIRECTO a la cuenta de la hermandad.
--
-- Se hace con una cuenta conectada de Stripe (Connect): la hermandad enlaza su
-- cuenta, el cobro se crea contra ELLA, y el dinero cae en su saldo y se paga
-- a su IBAN. Gobergo no lo toca ni un segundo.
--
-- Y AQUÍ NO SE GUARDA NINGUNA CLAVE SECRETA. Lo que se guarda es el
-- identificador de la cuenta conectada (`acct_…`), que no es un secreto: no
-- sirve para cobrar nada por su cuenta. La clave con la que se habla con
-- Stripe vive en la función del servidor, como la del webhook.
--
-- Guardar la clave secreta de cada hermandad en esta tabla habría sido más
-- fácil y es exactamente lo que no se puede hacer: una fuga de esta tabla
-- serían cobros y devoluciones en la cuenta de veinte hermandades.
--
-- ----------------------------------------------------------------------------
-- LO QUE DA POR PAGADO ES EL WEBHOOK, NO EL NAVEGADOR
-- ----------------------------------------------------------------------------
--
-- Cuando Stripe termina, devuelve al hermano a una página nuestra. Esa vuelta
-- NO vale como prueba de pago: se puede escribir esa dirección a mano, y una
-- conexión que se corta deja al hermano pagado y a la aplicación sin enterarse.
--
-- Es la misma lección que costó `webhook-stripe.sql` con las suscripciones
-- («sin él se cobra y no nos enteramos»). Así que la cuota se marca pagada
-- AQUÍ, desde una función que solo puede llamar la clave de servicio, y solo
-- cuando Stripe confirma que el dinero está.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run. Es seguro repetirlo.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. La cuenta de Stripe de la hermandad
-- ----------------------------------------------------------------------------
--
-- `acct_…`. No es un secreto —es el destinatario del cobro, no la llave— pero
-- solo lo puede tocar quien lleva Configuración.

alter table hermandad_settings add column if not exists stripe_cuenta text;

comment on column hermandad_settings.stripe_cuenta is
  'Cuenta conectada de Stripe (acct_…) a la que va el dinero de cuotas y papeletas. '
  'NO es una clave secreta: la clave vive en la función del servidor.';


-- ----------------------------------------------------------------------------
-- 2. Los intentos de pago
-- ----------------------------------------------------------------------------
--
-- Una fila por intento, no por cobro conseguido. Los que se quedan a medias
-- —el hermano abre la pasarela y cierra la pestaña— también se guardan, y eso
-- es a propósito: cuando alguien dice «yo pagué» hace falta poder mirar si
-- llegó a intentarlo y qué pasó.

create table if not exists pagos_tarjeta (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  -- Qué se está pagando. Se guarda el tipo aparte del id porque un id de cuota
  -- y uno de papeleta se parecen demasiado para distinguirlos por la forma.
  tipo text not null check (tipo in ('cuota', 'papeleta')),
  referencia_id uuid not null,
  hermano_id uuid references hermanos(id) on delete set null,
  -- En céntimos y entero, como el resto del dinero de la aplicación: es lo que
  -- se le manda a Stripe, que también los pide así.
  importe_cent bigint not null check (importe_cent > 0),
  estado text not null default 'abierto' check (estado in ('abierto', 'pagado', 'fallido', 'caducado')),
  -- La sesión de Stripe. Es lo que une este intento con lo que cuenta el
  -- webhook, y por eso es única.
  stripe_session text unique,
  creado_en timestamptz not null default now(),
  pagado_en timestamptz
);

alter table pagos_tarjeta enable row level security;

create index if not exists pagos_tarjeta_referencia_idx on pagos_tarjeta (referencia_id);
-- Lo que se pregunta al pintar el área del hermano: «¿tengo algo a medias?».
create index if not exists pagos_tarjeta_mios_idx on pagos_tarjeta (hermano_id, estado);


-- ----------------------------------------------------------------------------
-- 3. Quién ve qué
-- ----------------------------------------------------------------------------

drop policy if exists "solo_mi_hermandad" on pagos_tarjeta;
create policy "solo_mi_hermandad" on pagos_tarjeta as restrictive for all to authenticated
  using (hermandad_id = hermandad_actual())
  with check (hermandad_id = hermandad_actual());

-- Quien lleva las cuotas o el dinero, para poder mirar qué pasó con un cobro.
drop policy if exists "tesoreria_ve_los_pagos" on pagos_tarjeta;
create policy "tesoreria_ve_los_pagos" on pagos_tarjeta for select to authenticated
  using (modulo_permitido('cuotas') or modulo_permitido('tesoreria') or modulo_permitido('papeletas'));

-- Y el hermano ve LOS SUYOS, que es como sabe si su pago llegó.
drop policy if exists "el hermano ve sus pagos" on pagos_tarjeta;
create policy "el hermano ve sus pagos" on pagos_tarjeta for select to authenticated
  using (hermano_id = hermano_propio_id());

/*
 * NADIE ESCRIBE AQUÍ DESDE EL NAVEGADOR. Ni el hermano ni la junta.
 *
 * Las filas las crea `crear-pago` y las cierra el webhook, las dos con la
 * clave de servicio. Si se pudiera escribir desde el navegador, cualquiera
 * marcaría su pago como «pagado» desde la consola y su cuota quedaría cobrada
 * sin que hubiera entrado un euro — que es exactamente el agujero que ya se
 * cerró con las cuotas en `lo-que-toca-el-hermano.sql`.
 */
grant select on pagos_tarjeta to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Dar por cobrado un pago: SOLO desde el webhook
-- ----------------------------------------------------------------------------
--
-- Marca el intento como pagado, marca la cuota o la papeleta, y deja el asiento
-- en Tesorería. Las tres cosas en la misma orden: si se hicieran por separado,
-- un corte por el medio dejaría la cuota cobrada y el libro sin enterarse, que
-- es la avería que se lleva arreglando todo el proyecto.

create or replace function cobrar_pago_tarjeta(p_session text)
returns boolean
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_pago pagos_tarjeta;
  v_num int;
  v_nombre text;
  v_concepto text;
begin
  select * into v_pago from pagos_tarjeta where stripe_session = p_session;
  if v_pago.id is null then
    raise warning 'cobrar_pago_tarjeta: no hay ningún intento con la sesión %', p_session;
    return false;
  end if;

  /*
   * DOS VECES NO. Stripe reintenta un webhook que no contestó a la primera, y
   * puede mandar `completed` y `async_payment_succeeded` por el mismo cobro.
   * Sin esto, el segundo aviso metería un segundo asiento en el libro por un
   * dinero que entró una vez.
   */
  if v_pago.estado = 'pagado' then
    return true;
  end if;

  update pagos_tarjeta set estado = 'pagado', pagado_en = now() where id = v_pago.id;

  select nombre into v_nombre from hermanos where id = v_pago.hermano_id;

  if v_pago.tipo = 'cuota' then
    select concepto into v_concepto from cuotas where id = v_pago.referencia_id;
    update cuotas
       set estado = 'Pagada',
           fecha_pago = to_char(now(), 'YYYY-MM-DD'),
           metodo_cobro = 'Tarjeta'
     where id = v_pago.referencia_id
       and hermandad_id = v_pago.hermandad_id;
  else
    v_concepto := 'Papeleta de sitio';
    /*
     * La papeleta usa `estado`, no una columna de pago aparte, y sus valores
     * son los del cortejo ('Solicitada', 'Asignada', 'Pagada'…). Se pone
     * 'Pagada' y se apunta el método en `metodo_pago`, que es la columna que
     * usa la secretaría para registrar el cobro — `pago_metodo` es otra cosa:
     * ahí el HERMANO avisa de que ha pagado, y solo admite Bizum o
     * transferencia.
     */
    update papeletas
       set estado = 'Pagada',
           metodo_pago = 'Tarjeta',
           fecha_pago = to_char(now(), 'YYYY-MM-DD')
     where id = v_pago.referencia_id
       and hermandad_id = v_pago.hermandad_id;
  end if;

  -- El asiento. Nace PENDIENTE como todos: conciliar es cotejarlo con el
  -- extracto, y eso lo hace el tesorero. Ver `lib/apuntes.ts`.
  select coalesce(max(numero), 0) + 1 into v_num
    from movimientos where hermandad_id = v_pago.hermandad_id;

  insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
  values (
    v_pago.hermandad_id, v_num, to_char(now(), 'YYYY-MM-DD'),
    format('%s con tarjeta — %s', coalesce(v_concepto, 'Cobro'), coalesce(v_nombre, 'hermano/a')),
    case when v_pago.tipo = 'cuota' then 'Cuotas Hermanos/as' else 'Papeletas de sitio' end,
    'Ingreso',
    v_pago.importe_cent / 100.0,
    -- Una tarjeta nunca es efectivo: entra en el banco.
    'Cuenta bancaria', 'Pendiente',
    format('%s:%s', v_pago.tipo, v_pago.referencia_id)
  )
  -- Si ya estaba apuntado por otra vía —el hermano avisó y secretaría lo dio
  -- por bueno antes de que llegara el webhook— no se duplica.
  on conflict do nothing;

  return true;
end $$;

revoke all on function cobrar_pago_tarjeta(text) from public, anon, authenticated;

comment on function cobrar_pago_tarjeta(text) is
  'La llama el webhook de Stripe con la clave de servicio. Desde el navegador NO: '
  'sería marcarse la cuota como pagada sin pagar.';


-- ----------------------------------------------------------------------------
-- 5. Abrir un intento: también solo desde el servidor
-- ----------------------------------------------------------------------------
--
-- La abre `crear-pago` con la clave de servicio, después de comprobar quién
-- pide el cobro y por cuánto. El IMPORTE NO LO PONE EL NAVEGADOR: se lee aquí
-- de la cuota o de la papeleta. Si lo mandara el navegador, cualquiera pagaría
-- su cuota de 60 € por un céntimo.

create or replace function abrir_pago_tarjeta(
  p_hermandad_id uuid, p_tipo text, p_referencia uuid, p_hermano_id uuid
) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_importe numeric;
  v_estado text;
  v_id uuid;
begin
  if p_tipo not in ('cuota', 'papeleta') then return null; end if;

  if p_tipo = 'cuota' then
    select importe, estado into v_importe, v_estado
      from cuotas where id = p_referencia and hermandad_id = p_hermandad_id;
    -- Una cuota ya cobrada no se vuelve a cobrar.
    if v_estado = 'Pagada' then return null; end if;
  else
    select importe, estado into v_importe, v_estado
      from papeletas where id = p_referencia and hermandad_id = p_hermandad_id;
    -- Ni una ya cobrada, ni una anulada o renunciada: cobrar eso sería cobrar
    -- por un sitio que ya no existe.
    if v_estado in ('Pagada', 'Entregada', 'Anulada', 'Renuncia') then return null; end if;
  end if;

  if v_importe is null or v_importe <= 0 then return null; end if;

  insert into pagos_tarjeta (hermandad_id, tipo, referencia_id, hermano_id, importe_cent)
  values (p_hermandad_id, p_tipo, p_referencia, p_hermano_id, round(v_importe * 100))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'importe_cent', round(v_importe * 100));
end $$;

revoke all on function abrir_pago_tarjeta(uuid, text, uuid, uuid) from public, anon, authenticated;

/** Anota la sesión de Stripe en el intento recién abierto. */
create or replace function fijar_sesion_pago(p_id uuid, p_session text)
returns boolean
language sql volatile security definer set search_path = public, extensions as $$
  update pagos_tarjeta set stripe_session = p_session where id = p_id returning true
$$;

revoke all on function fijar_sesion_pago(uuid, text) from public, anon, authenticated;


-- =============================================================================
--   QUÉ HA QUEDADO PUESTO
-- =============================================================================

select * from (values
  ('Ajustes de cuotas de la hermandad',
   (select count(*) > 0 from information_schema.columns
     where table_name = 'hermandad_settings' and column_name = 'ajustes_cuotas')),
  ('Catálogo de etiquetas',
   (select count(*) > 0 from information_schema.columns
     where table_name = 'hermandad_settings' and column_name = 'etiquetas')),
  /*
   * Los dos módulos que faltaban, mirando SOLO las hermandades que tienen
   * permisos sembrados.
   *
   * Una hermandad sin NINGUNA fila en «permisos_cargo» es otra avería
   * distinta —nadie con cargo puede hacer nada allí— y el relleno no la toca a
   * propósito: no se le inventan cargos que nunca tuvo. Metiéndola en esta
   * cuenta, el informe decía «no» después de haber hecho su trabajo bien, que
   * es la peor manera de informar: parece que el fichero ha fallado. Va en su
   * propia línea, abajo.
   */
  ('Permiso de «eventos» al Hermano Mayor',
   (select count(*) = 0 from hermandades h
     where exists (select 1 from permisos_cargo pc where pc.hermandad_id = h.id)
       and not exists (
      select 1 from permisos_cargo pc
       where pc.hermandad_id = h.id and pc.cargo = 'Hermano Mayor' and pc.modulo_id = 'eventos'))),
  ('Permiso de «web» al Hermano Mayor',
   (select count(*) = 0 from hermandades h
     where exists (select 1 from permisos_cargo pc where pc.hermandad_id = h.id)
       and not exists (
      select 1 from permisos_cargo pc
       where pc.hermandad_id = h.id and pc.cargo = 'Hermano Mayor' and pc.modulo_id = 'web'))),
  /*
   * Y si alguna hermandad se quedó SIN PERMISOS DE NINGÚN TIPO, se dice. Pasa
   * con las creadas antes de que existiera la siembra: la junta entra, no
   * puede tocar nada y no hay forma de saber por qué. Se arregla ejecutando
   * «permisos-por-hermandad.sql», que sí siembra desde cero.
   */
  ('Ninguna hermandad se ha quedado sin permisos',
   (select count(*) = 0 from hermandades h
     where not exists (select 1 from permisos_cargo pc where pc.hermandad_id = h.id))),
  ('Almacén de imágenes de la web',
   (select count(*) > 0 from storage.buckets where id = 'imagenes')),
  ('Contador de visitas',
   (select to_regclass('public.visitas_web') is not null)),
  ('Suscriptores de la web',
   (select to_regclass('public.suscriptores_web') is not null)),
  ('Copias de seguridad',
   (select count(*) > 0 from storage.buckets where id = 'copias')),
  ('Limpieza automática (pg_cron, se activa a mano)',
   (select count(*) > 0 from pg_extension where extname = 'pg_cron')),
  ('Webhook de Stripe (activar_suscripcion_por_usuario)',
   (select count(*) > 0 from pg_proc where proname = 'activar_suscripcion_por_usuario')),
  ('Mandatos SEPA firmados por el hermano',
   (select to_regclass('public.mandatos_sepa') is not null)),
  ('Encargos de redes repartidos a la junta',
   (select to_regclass('public.tareas_redes') is not null)),
  ('La tienda (productos, ventas y stock)',
   (select to_regclass('public.ventas') is not null)),
  ('La venta registra sola sus asientos',
   (select count(*) > 0 from pg_proc where proname = 'registrar_venta')),
  ('Reservas de la tienda por internet',
   (select to_regclass('public.reservas_tienda') is not null)),
  ('Reservar sin cuenta, desde la web pública',
   (select count(*) > 0 from pg_proc where proname = 'crear_reserva_web')),
  ('Campañas de recaudación y proyectos',
   (select to_regclass('public.campanas_recaudacion') is not null)),
  /*
   * El módulo nuevo, mirando SOLO las hermandades que tienen permisos
   * sembrados, por lo mismo que se explica arriba con «eventos» y «web»: a una
   * hermandad sin ninguna fila en «permisos_cargo» no se le inventan cargos, y
   * meterla en esta cuenta haría que el informe dijera «no» después de haber
   * hecho su trabajo bien.
   */
  ('Permiso de «campañas» al Hermano Mayor',
   (select count(*) = 0 from hermandades h
     where exists (select 1 from permisos_cargo pc where pc.hermandad_id = h.id)
       and not exists (
      select 1 from permisos_cargo pc
       where pc.hermandad_id = h.id and pc.cargo = 'Hermano Mayor' and pc.modulo_id = 'campanas'))),
  ('Gastos porcentuales para pérdidas y ganancias',
   (select to_regclass('public.reglas_reparto') is not null)),
  ('Pago con tarjeta del hermano',
   (select to_regclass('public.pagos_tarjeta') is not null))
) as t(que, esta)
order by esta, que;
