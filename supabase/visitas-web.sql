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

