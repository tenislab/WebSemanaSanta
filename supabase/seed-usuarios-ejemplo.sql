-- =============================================================================
-- Usuarios de ejemplo — completar metadatos y dar de alta en `personal`
-- =============================================================================
-- Antes de ejecutar esto:
--   1. Ve a Authentication → Users → "Add user" en el panel de Supabase.
--   2. Créalos con "Auto Confirm User" marcado (si no, tendrían que confirmar
--      un correo real que no existe) y estas credenciales exactas:
--
--        hermanomayor@tuhermandad.org   /  Cabildo2026!   (titular, acceso completo)
--        secretaria@tuhermandad.org     /  Secre2026!     (cargo: Secretario/a)
--        tesorero@tuhermandad.org       /  Tesoro2026!    (cargo: Tesorero/a)
--
--   3. Luego pega este archivo entero en el SQL Editor y dale a Run: añade el
--      nombre/cargo a cada cuenta y la enlaza con la tabla `personal` para que
--      /app/personal ya la reconozca.
-- =============================================================================

update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"hermandad": "Tu hermandad", "nombre": "Hermano Mayor"}'::jsonb
where email = 'hermanomayor@tuhermandad.org';

update auth.users
set raw_user_meta_data = raw_user_meta_data
  || '{"hermandad": "Tu hermandad", "nombre": "Carmen Ruiz Delgado", "cargo": "Secretario/a"}'::jsonb
where email = 'secretaria@tuhermandad.org';

update auth.users
set raw_user_meta_data = raw_user_meta_data
  || '{"hermandad": "Tu hermandad", "nombre": "Manuel Ortega Vidal", "cargo": "Tesorero/a"}'::jsonb
where email = 'tesorero@tuhermandad.org';

insert into personal (nombre, email, clave, cargo, activo, auth_user_id)
select 'Carmen Ruiz Delgado', 'secretaria@tuhermandad.org', 'Secre2026!', 'Secretario/a', true, id
from auth.users where email = 'secretaria@tuhermandad.org'
on conflict (email) do update set auth_user_id = excluded.auth_user_id;

insert into personal (nombre, email, clave, cargo, activo, auth_user_id)
select 'Manuel Ortega Vidal', 'tesorero@tuhermandad.org', 'Tesoro2026!', 'Tesorero/a', true, id
from auth.users where email = 'tesorero@tuhermandad.org'
on conflict (email) do update set auth_user_id = excluded.auth_user_id;
