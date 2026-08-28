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
