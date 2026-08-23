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
--   1. ajustes-de-la-hermandad.sql    Los ajustes de cuotas y las etiquetas, guardados en la hermandad
--   2. imagenes.sql                   El almacén de fotos: que la web no lleve las imágenes dentro
--   3. visitas-web.sql                El contador de visitas de la web, sin cookies ni Google Analytics
--   4. suscriptores-web.sql           Avisos por correo para quien sigue a la hermandad sin ser hermano
--   5. copias.sql                     Las copias de seguridad, guardadas solas cada semana
--   6. permisos-eventos-y-web.sql     Los dos módulos que nunca se sembraron: «eventos» y «web»
--
-- -----------------------------------------------------------------------------
-- LO QUE ESTE ARCHIVO NO LLEVA, Y POR QUÉ
-- -----------------------------------------------------------------------------
--
-- 1. `permisos-por-hermandad.sql` NO ESTÁ, y no se debe ejecutar suelto sobre
--    una base al día. Redefine `modulo_permitido()`, que `hermano-con-cargo.sql`
--    vuelve a definir después con una vía más: el hermano que lleva un cargo en
--    su ficha. Manda la última definición que se ejecuta, así que el fichero
--    viejo por su cuenta deja fuera al tesorero que además es hermano. De ahí
--    solo hacía falta el relleno de «eventos» y «web», y ese va arriba, en su
--    propio fichero, sin tocar ninguna función.
--
-- 2. `tareas-programadas.sql` NO ESTÁ porque necesita la extensión `pg_cron`
--    activada antes, y eso se hace a mano: Database → Extensions → pg_cron.
--    Puesta la extensión, ese fichero se ejecuta aparte. Sin él todo funciona;
--    lo único que no pasa solo es la limpieza de visitas viejas y de
--    suscriptores sin confirmar.
--
-- =============================================================================


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
-- Las dos van como `jsonb` en `hermandad_settings`, igual que las plantillas.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table hermandad_settings add column if not exists ajustes_cuotas jsonb;
alter table hermandad_settings add column if not exists etiquetas jsonb;

comment on column hermandad_settings.ajustes_cuotas is
  'Decisiones de la hermandad sobre cuotas: si bloquear la papeleta a quien debe, '
  'y si la mora exige la confirmación de dos cargos. Vivían en localStorage, así que '
  'no valían desde otro ordenador — incluido el control de cuatro ojos de la mora.';

comment on column hermandad_settings.etiquetas is
  'Catálogo de etiquetas de la hermandad (costalero, acólito, banda…). Con ellas se '
  'segmentan los comunicados. Vivían en localStorage: cada ordenador tenía el suyo y '
  'se borraban al cerrar sesión.';

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
language plpgsql security definer set search_path = public as $$
declare
  v_ruta text;
begin
  -- Sin hermandad no se cuenta nada: una visita sin dueño no le sirve a nadie
  -- y sería una fila que no se puede ni leer ni borrar.
  if p_hermandad_id is null then return; end if;
  if not exists (select 1 from hermandades where id = p_hermandad_id) then return; end if;

  /*
   * LA RUTA SE LIMPIA AQUÍ, no en el navegador. Lo que llega de fuera se
   * comprueba de este lado siempre: en el navegador se puede cambiar.
   *
   *   · Solo lo que va antes de «?» o «#».
   *   · Tiene que empezar por «/».
   *   · Y como mucho 200 caracteres: una ruta de verdad no llega ni a 80, y
   *     sin tope alguien puede guardar un texto de un mega por visita.
   */
  v_ruta := split_part(split_part(coalesce(p_ruta, '/'), '?', 1), '#', 1);
  if v_ruta = '' or left(v_ruta, 1) <> '/' then v_ruta := '/'; end if;
  v_ruta := left(v_ruta, 200);

  insert into visitas_web (hermandad_id, dia, ruta, visitas)
  -- La fecha, de este lado y en hora de España: con la del navegador, quien
  -- tenga el reloj mal —o quien quiera— escribe en el día que le apetezca.
  values (p_hermandad_id, (now() at time zone 'Europe/Madrid')::date, v_ruta, 1)
  on conflict (hermandad_id, dia, ruta)
  do update set visitas = visitas_web.visitas + 1;

  /*
   * AQUÍ HABÍA UNA LIMPIEZA «una de cada mil visitas», y se ha quitado.
   *
   * Era un truco para no depender de nada programado, y tenía el defecto de
   * todos los trucos de ese tipo: funciona con tráfico y no funciona sin él. La
   * web que menos visitas tiene —la que menos falta le hace limpiar, pero
   * también la que más años acumula— era justo la que no limpiaba nunca.
   *
   * Ahora lo hace `pg_cron` los domingos de madrugada: ver
   * `supabase/tareas-programadas.sql`. Si no lo has ejecutado, la tabla crece;
   * no se rompe nada, pero conviene.
   */
end $$;

-- La puede llamar cualquiera que entre en la web, que es de lo que se trata.
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
  llave text not null default encode(gen_random_bytes(24), 'hex'),

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
 * Apuntarse. Devuelve la llave, que es lo que hay que meter en el enlace del
 * correo de confirmación.
 *
 * Si ese correo ya estaba, NO se crea otro ni se dice que ya estaba: se
 * devuelve su llave y punto. Contestar «ese correo ya está apuntado» es decirle
 * a cualquiera quién está en la lista, y eso es filtrar datos de otro.
 */
create or replace function suscribirse_a_la_web(
  p_hermandad_id uuid,
  p_email text,
  p_nombre text default '',
  p_texto text default ''
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_llave text;
begin
  if p_hermandad_id is null then return null; end if;
  if not exists (select 1 from hermandades where id = p_hermandad_id) then return null; end if;

  v_email := lower(trim(coalesce(p_email, '')));
  -- Una comprobación mínima, del lado de acá. La de verdad la hace el correo de
  -- confirmación: si la dirección no existe, nunca se confirma.
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then return null; end if;

  insert into suscriptores_web (hermandad_id, email, nombre, texto_aceptado)
  values (p_hermandad_id, v_email, left(trim(coalesce(p_nombre, '')), 120), left(coalesce(p_texto, ''), 1000))
  on conflict (hermandad_id, lower(email))
  -- Sin cambiar nada de lo que ya había: ni el consentimiento, ni la fecha de
  -- alta, ni si estaba confirmado. Volver a apuntarse no puede borrar la prueba
  -- de cuándo aceptó.
  do update set email = suscriptores_web.email
  returning llave into v_llave;

  return v_llave;
end $$;
grant execute on function suscribirse_a_la_web(uuid, text, text, text) to anon, authenticated;

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
  ('Permiso de «eventos» al Hermano Mayor',
   (select count(*) = 0 from hermandades h where not exists (
      select 1 from permisos_cargo pc
       where pc.hermandad_id = h.id and pc.cargo = 'Hermano Mayor' and pc.modulo_id = 'eventos'))),
  ('Permiso de «web» al Hermano Mayor',
   (select count(*) = 0 from hermandades h where not exists (
      select 1 from permisos_cargo pc
       where pc.hermandad_id = h.id and pc.cargo = 'Hermano Mayor' and pc.modulo_id = 'web'))),
  ('Almacén de imágenes de la web',
   (select count(*) > 0 from storage.buckets where id = 'imagenes')),
  ('Contador de visitas',
   (select to_regclass('public.visitas_web') is not null)),
  ('Suscriptores de la web',
   (select to_regclass('public.suscriptores_web') is not null)),
  ('Copias de seguridad',
   (select count(*) > 0 from storage.buckets where id = 'copias')),
  ('Limpieza automática (pg_cron, se activa a mano)',
   (select count(*) > 0 from pg_extension where extname = 'pg_cron'))
) as t(que, esta)
order by esta, que;
