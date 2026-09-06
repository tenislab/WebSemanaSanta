-- ============================================================================
--   EL CERTIFICADO DE ANTIGÜEDAD
-- ============================================================================
--
-- Lo prometía la portada —dos veces— y no existía en ninguna parte.
--
-- QUÉ ES. El papel que pide un hermano cuando tiene que ACREDITAR ANTE ALGUIEN
-- que lo es y desde cuándo: para entrar en otra hermandad, para el consejo de
-- cofradías, para una bolsa de caridad, para que le den el varal que va por
-- antigüedad. Lo firma la secretaría y lleva el visto bueno del hermano mayor.
--
-- Es de los pocos papeles que la hermandad emite HACIA FUERA, y por eso no
-- basta con pintarlo en pantalla: hay que poder decir, dos años después, «el
-- certificado nº 14 de 2027 se le expidió a Fulano el día tal».
--
-- ----------------------------------------------------------------------------
-- LOS DATOS VAN COPIADOS, NO ENLAZADOS
-- ----------------------------------------------------------------------------
--
-- El nombre, el DNI, el número de hermano y la antigüedad se guardan aquí
-- copiados, igual que en las facturas de la tienda. Un certificado dice lo que
-- decía EL DÍA QUE SE FIRMÓ: si mañana la secretaría corrige una antigüedad mal
-- importada, el papel que esa persona lleva en la mano no cambia — y el
-- registro tiene que seguir explicando qué se certificó exactamente.
--
-- Por eso también se copian los nombres de quien firma: la junta cambia cada
-- pocos años, y un certificado de 2027 lo firmó quien lo firmó.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Es seguro repetirlo: no borra ni sobrescribe ningún dato.
-- ============================================================================

create table if not exists certificados (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  /*
   * NÚMERO DE REGISTRO, correlativo por hermandad y año, sin huecos.
   *
   * Es lo que convierte un papel bonito en un documento: quien lo recibe puede
   * llamar a la hermandad y preguntar por el nº 14/2027. Lo asigna la función
   * de abajo con un cerrojo, nunca el navegador.
   */
  anio int not null,
  numero int not null,
  -- A quién. El enlace se conserva para poder listar «los certificados de este
  -- hermano», pero NADA de lo que se imprime sale de aquí: sale de las copias.
  hermano_id uuid references hermanos(id) on delete set null,
  hermano_nombre text not null,
  hermano_dni text not null default '',
  hermano_numero int not null default 0,
  -- El año de antigüedad que se certificó, y los años que eran ENTONCES.
  antiguedad int not null default 0,
  anios_de_antiguedad int not null default 0,
  /*
   * PARA QUÉ LO PIDE. No es burocracia: un certificado sin motivo es un papel
   * suelto, y el motivo es lo que la secretaría necesita para saber si el que
   * le piden en marzo es el mismo que ya expidió en enero.
   */
  motivo text not null default '',
  -- Quién lo firmó, copiado. La junta cambia; el papel no.
  firma_secretario text not null default '',
  firma_hermano_mayor text not null default '',
  emitido_por text not null default '',
  creado_en timestamptz not null default now(),
  unique (hermandad_id, anio, numero)
);
create index if not exists certificados_hermano_idx on certificados (hermandad_id, hermano_id, creado_en desc);

alter table certificados enable row level security;

/*
 * QUIÉN. Lo expide quien lleva el censo —la secretaría—, y lo ve el propio
 * hermano en su área: es su papel, y tiene que poder volver a imprimirlo sin
 * llamar a nadie un domingo.
 */
drop policy if exists "solo_mi_hermandad" on certificados;
create policy "solo_mi_hermandad" on certificados as restrictive for all to authenticated
  using (hermandad_id = hermandad_actual()) with check (hermandad_id = hermandad_actual());

drop policy if exists "secretaria_certifica" on certificados;
create policy "secretaria_certifica" on certificados for all to authenticated
  using (modulo_permitido('hermanos')) with check (modulo_permitido('hermanos'));

drop policy if exists "mis_certificados" on certificados;
create policy "mis_certificados" on certificados for select to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id());

grant select, insert, update, delete on certificados to authenticated;


-- ----------------------------------------------------------------------------
--   EXPEDIRLO
-- ----------------------------------------------------------------------------
--
-- Todo lo que se imprime se resuelve AQUÍ y se guarda copiado. Si el navegador
-- mandara el nombre o la antigüedad, cualquiera con la consola abierta se
-- expediría un certificado de 1950.
--
-- `security definer` para poder leer el censo y la junta con las reglas de la
-- casa, y con `modulo_permitido('hermanos')` delante: expedir certificados es
-- de la secretaría, no de cualquiera que tenga cuenta.
create or replace function emitir_certificado(p_hermano_id uuid, p_motivo text default '')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_h hermanos%rowtype;
  v_anio int := extract(year from now())::int;
  v_num int;
  v_id uuid;
  v_secre text;
  v_mayor text;
  v_yo text;
begin
  if not modulo_permitido('hermanos') then
    raise exception 'Solo quien lleva el censo puede expedir un certificado.';
  end if;

  select * into v_h from hermanos h where h.id = p_hermano_id and h.hermandad_id = v_hermandad;
  if not found then
    raise exception 'Ese hermano no es de esta hermandad.';
  end if;
  /*
   * A UN HERMANO DE BAJA NO SE LE CERTIFICA QUE LO ES.
   *
   * Un certificado de antigüedad dice, en presente, que esa persona figura
   * inscrita. De quien causó baja se puede certificar que LO FUE, y eso es otro
   * papel con otro texto; darle este sería firmar algo que no es verdad.
   */
  if v_h.estado = 'Baja' then
    raise exception 'Ese hermano figura de baja: no se le puede certificar que está inscrito.';
  end if;

  -- Quién firma, del censo. Si el cargo está vacante, la línea de la firma sale
  -- en blanco con su título, que es lo que hace un papel de verdad.
  select h.nombre into v_secre from hermanos h
   where h.hermandad_id = v_hermandad and h.cargo = 'Secretario/a' and h.estado <> 'Baja' limit 1;
  select h.nombre into v_mayor from hermanos h
   where h.hermandad_id = v_hermandad and h.cargo = 'Hermano Mayor' and h.estado <> 'Baja' limit 1;
  select h.nombre into v_yo from hermanos h where h.id = hermano_propio_id();

  /*
   * EL NÚMERO, con cerrojo de transacción y no con `max()+1` a secas: dos
   * secretarios expidiendo a la vez sacarían el mismo, y dos certificados con
   * el mismo número son dos papeles que no se pueden distinguir por teléfono.
   */
  perform pg_advisory_xact_lock(hashtext(v_hermandad::text || '|certificado|' || v_anio));
  select coalesce(max(c.numero), 0) + 1 into v_num
    from certificados c where c.hermandad_id = v_hermandad and c.anio = v_anio;

  insert into certificados (
    hermandad_id, anio, numero, hermano_id, hermano_nombre, hermano_dni, hermano_numero,
    antiguedad, anios_de_antiguedad, motivo,
    firma_secretario, firma_hermano_mayor, emitido_por
  ) values (
    v_hermandad, v_anio, v_num, v_h.id, v_h.nombre, coalesce(v_h.dni, ''), coalesce(v_h.numero, 0),
    coalesce(v_h.antiguedad, 0),
    -- Los años que lleva, contados hasta hoy. Nunca negativo: una antigüedad
    -- mal importada con un año futuro daría «lleva −3 años» en un papel oficial.
    greatest(0, v_anio - coalesce(v_h.antiguedad, v_anio)),
    left(trim(coalesce(p_motivo, '')), 300),
    coalesce(v_secre, ''), coalesce(v_mayor, ''), coalesce(v_yo, '')
  ) returning id into v_id;

  return jsonb_build_object('id', v_id, 'anio', v_anio, 'numero', v_num);
end $$;

comment on function emitir_certificado(uuid, text) is
  'Expide un certificado de antigüedad y lo deja registrado con su número correlativo del año. '
  'Todo lo que se imprime se copia en el momento: el papel dice lo que decía el día que se firmó.';

revoke all on function emitir_certificado(uuid, text) from public, anon;
grant execute on function emitir_certificado(uuid, text) to authenticated;
