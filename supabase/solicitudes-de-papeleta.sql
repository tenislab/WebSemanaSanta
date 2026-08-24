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
