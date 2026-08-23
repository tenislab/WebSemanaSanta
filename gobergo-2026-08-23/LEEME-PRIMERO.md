# Gobergo — 23 de agosto

Lo de hoy: **once fallos encontrados y arreglados**, cada uno reproducido antes
de tocarlo, y **poder ser hermano de dos hermandades a la vez**.

El detalle está en `docs/CAZA-DE-BUGS-2026-08-23.md`.

---

## Lo que hay que hacer, en este orden

### 1. El SQL

**Supabase → SQL Editor → New query → pegar `supabase/ACTUALIZAR.sql` entero →
Run.**

Es seguro repetirlo y no borra datos de nadie. Al terminar imprime una tabla
diciendo qué ha quedado puesto.

### 2. Volver a desplegar la función de correo

**Supabase → Edge Functions → `enviar-correo` → Deploy a new version**, con el
contenido de `supabase/functions/enviar-correo/index.ts`.

**No es opcional.** Esa función hace ahora dos cosas que antes no hacía nadie:

- manda el **correo de confirmar** una suscripción de la web (antes no se
  mandaba nunca, y por eso la lista de avisos no recibía nada);
- manda el **«he olvidado mi contraseña»** del hermano.

No hace falta ningún secreto nuevo: `SUPABASE_SERVICE_ROLE_KEY` la pone Supabase
sola en todas sus funciones.

### 3. Comprobar que ha entrado

```sql
-- La segunda hermandad ya puede guardar sus catálogos:
select pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'catalogos'::regclass and contype = 'p';
-- tiene que decir: PRIMARY KEY (hermandad_id, clave, valor)

-- El hermano ya no puede cobrarse su propio recibo:
select tgname from pg_trigger
where tgrelid in ('cuotas'::regclass, 'papeletas'::regclass) and not tgisinternal;
-- tienen que salir cuotas_el_hermano_solo_avisa y papeletas_lo_que_toca_el_hermano

-- Y no queda ninguna contraseña guardada en claro:
select count(*) from solicitudes_alta where coalesce(clave_propuesta, '') <> '';
-- tiene que dar 0
```

Todo esto, paso a paso, en `docs/QUE-TOCAR-EN-SUPABASE.md`.

---

## Lo que va a cambiar y conviene que sepas

- **La remesa avisa de quién se queda fuera.** Antes, un domiciliado sin IBAN se
  caía en silencio. Ahora sale un aviso con cuántos son, cuánto dinero es y
  quiénes. Si al mirarlo sale mucha gente, no es un fallo nuevo: es lo que
  llevaba pasando.
- **Un IBAN mal escrito ya no entra.** Ni al dar de alta ni en la remesa. Antes
  se guardaba y hacía que el banco rechazara el fichero entero.
- **El alta por la web ya no pide contraseña.** Se guardaba en claro, a la vista
  de la secretaría. Ahora se genera una clave al aprobar y se le manda por
  correo, que es lo que ya se hacía con el alta de un menor.
- **Se puede ser hermano de dos hermandades.** Mismo correo para los avisos, y
  entra en cada una con su DNI. Las contraseñas son independientes: son dos
  accesos. A quien ya tiene cuenta no le cambia nada.

---

## Para arrancarlo en tu máquina

```
npm install
cp .env.example .env      # y rellena las dos claves de Supabase
npm run dev
```

Y para comprobar que todo sigue en pie:

```
npm run typecheck
npm run lint
npm test
npm run build
```

Hoy: **2.893 pruebas, todas pasan**.

---

## Lo que sigue pendiente

Está en la hoja de ruta, y no lo he tocado:

- **C1** — el webhook de Stripe: sin él se cobra y no nos enteramos.
- **C2** — mandatos SEPA firmados de verdad. Bloqueante antes de la primera
  remesa real.
- **C3** — leer el fichero de devoluciones del banco (19-44 / pain.002).
- **C4** — pago con tarjeta del hermano.

Y una tarea que sí conviene hacer pronto: activar `pg_cron`
(Database → Extensions) y ejecutar `supabase/tareas-programadas.sql`, para que
el registro de actividad y el contador de visitas no crezcan para siempre.
