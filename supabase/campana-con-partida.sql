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
