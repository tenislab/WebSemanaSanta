-- ============================================================================
--   LA DEUDA DE SEGURIDAD: contraseñas y registro de actividad
-- ============================================================================
--
-- Tres cosas que llevaban ahí desde antes de los cargos y que había que
-- cerrar antes de que entren datos de una hermandad de verdad. Ochocientos DNI
-- con IBAN y notas de salud es categoría especial del RGPD por partida doble.
--
-- ----------------------------------------------------------------------------
-- 1. LA CONTRASEÑA EN CLARO
-- ----------------------------------------------------------------------------
--
-- `hermanos.clave_acceso` guardaba la contraseña del hermano TAL CUAL, en
-- texto, dentro de la tabla. Y encima la ficha la imprimía en pantalla.
--
-- Eso no hacía falta para nada: la contraseña de verdad vive en Supabase Auth,
-- cifrada, y es la que comprueba `signInWithPassword`. Esta columna era una
-- copia en claro que solo servía para el modo demostración —donde no hay base
-- de datos— y que en producción era un regalo para cualquiera que pudiera leer
-- el censo.
--
-- Agravante: la contraseña inicial de un hermano ERA SU PROPIO DNI, y el DNI
-- está en su ficha. O sea que quien pudiera leer el censo podía entrar como
-- cualquier hermano que no la hubiera cambiado — y nadie le obligaba.
--
-- QUÉ SE HACE AQUÍ. La columna NO se borra: se vacía y se deja opcional.
--
-- Borrarla parece más limpio y es peor. Si se borra y alguien todavía tiene
-- abierta la versión anterior de la web, cada guardado de una ficha fallaría
-- con «column clave_acceso does not exist». Y al revés: si se dejara `not
-- null` sin valor por defecto, la versión NUEVA —que ya no la manda— fallaría
-- con «null value violates not-null constraint».
--
-- Dejándola vacía, opcional y con valor por defecto, funcionan LAS DOS
-- versiones mientras dure el cambio, y las contraseñas desaparecen igual.
-- Cuando esté todo actualizado se puede borrar de verdad, y hay una línea
-- preparada al final para eso.
alter table hermanos alter column clave_acceso drop not null;
alter table hermanos alter column clave_acceso set default '';
update hermanos set clave_acceso = '' where clave_acceso <> '';

comment on column hermanos.clave_acceso is
  'SIN USO. Guardaba la contraseña en claro; se vació por seguridad. La contraseña '
  'de verdad vive en Supabase Auth y no la lee nadie. Esta columna solo sigue aquí '
  'para que la versión anterior de la aplicación no falle al guardar mientras dure '
  'el cambio; se puede borrar con `alter table hermanos drop column clave_acceso`.';

-- Lo mismo en `personal`, que tenía la suya.
alter table personal alter column clave drop not null;
alter table personal alter column clave set default '';
update personal set clave = '' where clave <> '';

comment on column personal.clave is
  'SIN USO, igual que hermanos.clave_acceso: guardaba la contraseña en claro y se '
  'vació. La de verdad vive en Supabase Auth.';


-- ----------------------------------------------------------------------------
-- 2. EL REGISTRO DE ACTIVIDAD LO ESCRIBÍA EL NAVEGADOR
-- ----------------------------------------------------------------------------
--
-- `registro_actividad` es lo que contesta «¿quién dio de baja a este hermano y
-- cuándo?» en un cabildo. Y lo escribía la APLICACIÓN, mandando el nombre del
-- autor y la frase como texto libre.
--
-- Dos agujeros:
--
--   · Un cambio hecho por fuera de la aplicación —desde la consola del
--     navegador, o con la clave pública que viaja en el JavaScript— no dejaba
--     ningún rastro. El registro decía la verdad solo mientras todo el mundo
--     usara la puerta.
--   · Y como la fila la componía el cliente, quien tuviera cargo podía meter
--     lo que quisiera: un apunte con el nombre de otro. Y el propio fichero
--     presume de que no se puede modificar ni borrar, así que esa mentira se
--     quedaba para siempre.
--
-- QUÉ SE HACE. Un disparador en las tablas que importan, que apunta el cambio
-- DESDE DENTRO de la base con `auth.uid()`. Ese identificador lo pone el
-- servidor al validar el token: no se puede falsificar desde el navegador.
--
-- Los apuntes automáticos se marcan con `origen = 'base'` para distinguirlos
-- de los que sigue escribiendo la aplicación, que son más explicativos («le
-- cambió el IBAN») y siguen valiendo.
alter table registro_actividad add column if not exists origen text not null default 'app';

comment on column registro_actividad.origen is
  '«base» si lo escribió un disparador de Postgres (no se puede falsificar: el autor '
  'sale de auth.uid()); «app» si lo escribió la aplicación, que es más explicativa '
  'pero se fía de lo que le mande el navegador.';

/**
 * Quién está haciendo esto, con el nombre que tenga ahora.
 *
 * SECURITY DEFINER porque tiene que mirar `titulares`, `personal` y `hermanos`
 * saltándose las políticas: si no, un hermano no podría ni saber su propio
 * nombre para el apunte.
 */
create or replace function quien_soy_ahora() returns text
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select 'Titular' from titulares where auth_user_id = auth.uid() limit 1),
    (select p.nombre from personal p where p.auth_user_id = auth.uid() limit 1),
    (select h.nombre from hermanos h where h.auth_user_id = auth.uid() limit 1),
    'Sistema'
  )
$$;
grant execute on function quien_soy_ahora() to authenticated;

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

  insert into registro_actividad
    (hermandad_id, autor_id, autor_nombre, accion, sobre_tipo, sobre_id, sobre_nombre, detalle, origen)
  values (
    coalesce((fila->>'hermandad_id')::uuid, hermandad_actual()),
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
  'Apunta en registro_actividad quién ha tocado una fila, con auth.uid() como autor. '
  'Lo pone el servidor al validar el token, así que no se puede falsificar desde el '
  'navegador — que es justo lo que sí se podía con los apuntes que manda la aplicación.';

/*
 * Se pone SOLO en las tablas que se preguntan en un cabildo: el censo, el
 * dinero y las papeletas. Ponerlo en todas llenaría la tabla de ruido —cada
 * tecla del editor de la web sería un apunte— y el registro dejaría de servir
 * para lo que sirve, que es encontrar una cosa concreta.
 */
do $$
declare t text;
begin
  foreach t in array array['hermanos', 'cuotas', 'papeletas', 'movimientos'] loop
    execute format('drop trigger if exists apuntar_%s on %I', t, t);
    execute format(
      'create trigger apuntar_%s after insert or update or delete on %I
         for each row execute function apuntar_cambio(%L)', t, t, t
    );
  end loop;
end $$;

-- Y que nadie pueda borrar ni cambiar lo apuntado. Ya no había políticas de
-- update ni de delete —lo que en Postgres significa que no se puede— pero
-- conviene dejarlo escrito para quien venga después.
comment on table registro_actividad is
  'Solo se AÑADE. No hay política de update ni de delete a propósito: en Postgres, '
  'sin política no se puede. Ni el titular puede reescribir la historia.';


-- ----------------------------------------------------------------------------
-- 3. PARA CUANDO TODO ESTÉ ACTUALIZADO
-- ----------------------------------------------------------------------------
--
-- Cuando lleve unos días funcionando y nadie tenga abierta la versión
-- anterior, se pueden borrar del todo las dos columnas. NO va descomentado: se
-- ejecuta a mano y a conciencia, porque no tiene vuelta atrás.
--
--   alter table hermanos drop column if exists clave_acceso;
--   alter table personal drop column if exists clave;
