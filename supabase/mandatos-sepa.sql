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
