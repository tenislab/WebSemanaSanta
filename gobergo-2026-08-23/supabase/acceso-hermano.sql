-- ============================================================================
-- Gobergo — cerrar el barrido de DNI en el acceso del hermano
-- ============================================================================
--
-- QUÉ ARREGLA (auditoría de agosto de 2026)
--
-- `resolver_email_hermano(hermandad, dni)` está concedida a `anon`, y tiene
-- que estarlo: el hermano escribe su DNI ANTES de tener sesión, y hace falta
-- traducirlo a un correo para poder abrirle sesión.
--
-- El problema no es que exista, es que no tenía freno. Desde cualquier
-- navegador, sin identificarse:
--
--     const { data: hs } = await supabase.rpc('hermandades_publicas')
--     await supabase.rpc('resolver_email_hermano',
--                        { p_hermandad_id: hs[0].id, p_dni: '12345678Z' })
--
-- Si devuelve un correo, esa persona es hermana de esa hermandad. Si devuelve
-- null, no lo es. En bucle, eso es un padrón.
--
-- Y NO es un dato cualquiera: pertenecer a una hermandad revela convicciones
-- religiosas, que el RGPD trata como CATEGORÍA ESPECIAL (artículo 9), el nivel
-- más alto de protección que existe. Publicar quién pertenece a cuál, aunque
-- sea de uno en uno, es exactamente lo que ese artículo prohíbe.
--
-- CÓMO SE CIERRA
--
-- Con un tope por hermandad y ventana de tiempo. Un hermano de verdad prueba
-- una o dos veces; quien barre necesita miles. El límite se nota enseguida
-- para el segundo y no molesta al primero.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

-- --- El registro de intentos -------------------------------------------------
--
-- No se guarda el DNI en claro: no hace falta para contar, y una tabla con
-- DNI de gente que ni siquiera es hermana no debería existir. Se guarda su
-- huella, que sirve para no contar diez veces el mismo dedazo.
create table if not exists intentos_acceso (
  id bigserial primary key,
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  huella_dni text not null,
  cuando timestamptz not null default now()
);

create index if not exists intentos_acceso_ventana_idx
  on intentos_acceso (hermandad_id, cuando desc);

alter table intentos_acceso enable row level security;

-- Nadie la lee ni la escribe desde fuera. La escribe la función, que es
-- SECURITY DEFINER y se salta las políticas a propósito. Sin ninguna política,
-- una tabla con RLS activo está cerrada a cal y canto, que es lo que se quiere.
revoke all on intentos_acceso from anon, authenticated;

-- --- La función, ahora con freno --------------------------------------------
create or replace function resolver_email_hermano(p_hermandad_id uuid, p_dni text)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_dni text;
  v_huella text;
  v_recientes int;
  v_email text;
begin
  -- Se quitan también los PUNTOS. La versión anterior solo quitaba espacios y
  -- guiones, así que quien escribía su DNI como lo lleva la tarjeta —
  -- «12.345.678-A», que es como lo escribe medio mundo— no entraba: se
  -- comparaba «12.345.678A» contra «12345678A» y no casaba. Y el mensaje que
  -- veía era «DNI o contraseña incorrectos».
  v_dni := upper(regexp_replace(coalesce(p_dni, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_dni = '' or p_hermandad_id is null then
    return null;
  end if;
  -- `md5` es de Postgres de serie: no hace falta ninguna extensión, y aquí no
  -- está guardando un secreto. Solo sirve para contar sin dejar escritos los
  -- DNI de gente que ni siquiera es hermana. Lleva dentro el id de la
  -- hermandad para que la misma huella no valga en dos sitios.
  v_huella := md5(v_dni || ':' || p_hermandad_id::text);

  -- Cuántos DNI DISTINTOS se han probado contra esta hermandad en la última
  -- media hora. Se cuentan distintos a propósito: quien se equivoca al teclear
  -- el suyo y lo repite cinco veces no es el que preocupa.
  select count(distinct huella_dni) into v_recientes
    from intentos_acceso
   where hermandad_id = p_hermandad_id
     and cuando > now() - interval '30 minutes';

  if v_recientes >= 25 then
    -- Se avisa en vez de devolver null: un hermano legítimo que llega justo
    -- después de un barrido tiene derecho a saber por qué no le funciona.
    raise exception 'Demasiados intentos de acceso en esta hermandad. Espera unos minutos y vuelve a probar.'
      using errcode = 'P0001';
  end if;

  insert into intentos_acceso (hermandad_id, huella_dni) values (p_hermandad_id, v_huella);

  -- La limpieza va aquí, aprovechando el viaje: sin esto la tabla crece para
  -- siempre y haría falta una tarea programada, que es una pieza más que
  -- mantener. Se borra lo de hace más de un día, no lo de hace media hora,
  -- para poder mirar un barrido después de que haya pasado.
  delete from intentos_acceso where cuando < now() - interval '1 day';

  select email into v_email from hermanos
   where hermandad_id = p_hermandad_id
     -- Y lo mismo del lado guardado: en el censo importado hay DNI escritos
     -- de las dos maneras, y los dos son el mismo señor.
     and upper(regexp_replace(dni, '[^A-Za-z0-9]', '', 'g')) = v_dni
     and estado <> 'Baja'
     and email <> ''
   limit 1;

  return v_email;
end $$;

grant execute on function resolver_email_hermano(uuid, text) to anon, authenticated;
