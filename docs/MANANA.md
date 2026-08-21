# Para mañana

Por fases y en orden. Cada una dice **cuánto tarda** y **qué pasa si te la saltas**.

---

## FASE 1 · Subir lo de anoche

**10 minutos. Todo lo demás depende de esto.**

### 1.1 · El SQL

Supabase → **SQL Editor** → **New query** → pega `TODO-EN-UNO.sql` entero → **Run**.

Verás avisos `NOTICE: … already exists, skipping`. **Eso es normal y correcto**: significa que esa parte ya estaba. Lo que no puede salir es ningún `ERROR` en rojo.

> Está probado tres pasadas seguidas contra un Postgres de verdad. Se puede repetir sin miedo.

### 1.2 · El zip

Súbelo como siempre.

> **El orden importa.** El zip usa funciones que crea el SQL. Al revés, la app entra pero le faltan cosas.

### 1.3 · Comprobar que va

- Entra al panel → deben salir **todos los módulos** en la barra lateral
- Mira la pestaña del navegador → el **logo granate**, no el globo gris
- Área del hermano → elige una hermandad → debe **coger sus colores**

---

## FASE 2 · Que lleguen los correos

**20 minutos. Sin esto, ningún comunicado ni aviso sale de la aplicación.**

### 2.1 · Los dos secretos

Supabase → **Edge Functions** → **Secrets** → *Add new secret*:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | tu clave `re_...` |
| `CORREO_REMITENTE` | `no-responder@gobergo.com` |

> Solo la dirección, **sin nombre delante**. El nombre lo pone cada hermandad: al hermano le llega «Hdad. de la Amargura \<no-responder@gobergo.com\>».

### 2.2 · Desplegar la función

Supabase → **Edge Functions** → **Deploy a new function**

- Nombre: **`enviar-correo`** ← exactamente así
- Contenido: `supabase/functions/enviar-correo/index.ts` (está en el zip)

### 2.3 · Encenderlo y probar

Gobergo → **Configuración → Correo** → activar → **Enviar correo de prueba**.

Luego manda un comunicado de verdad a dos hermanos.

> Si algo falla, el mensaje ahora explica qué falta en vez de soltar un error incomprensible.

---

## FASE 3 · Las plantillas en español

**15 minutos. Se puede dejar para otro día, pero da mala imagen.**

Supabase → **Authentication → Emails → Templates**. Una pestaña por tipo; cambias el asunto y el cuerpo. Están en `docs/PLANTILLAS-CORREO.md`.

Empieza por **Reset Password**, que es la que ya sabes probar.

> **No toques `{{ .ConfirmationURL }}`.** Es donde Supabase mete el enlace de verdad.

**Por qué importa:** ahora mismo el hermano recibe *«We received a request to reset your password»*. En inglés, de una hermandad de Sevilla. Eso le suena a timo y lo borra.

---

## FASE 4 · Activar tu suscripción

**2 minutos.**

La suscripción ya no vive en el navegador: es una tabla que solo escribe el servidor. Antes cualquiera se activaba el pack «Todo» gratis desde la consola.

Primero busca el id de tu hermandad:

```sql
select id, nombre from hermandades;
```

Y actívala:

```sql
select activar_suscripcion('PEGA-AQUI-EL-ID', 'todo', 'anual');
```

> Si te la saltas, verás el muro de pago.

---

## FASE 5 · Con calma, cuando quieras

- **Pasar la guía a la hermandad piloto** — `docs/GUIA-HERMANDAD-PILOTO.md`
- **Rellenar los datos legales** — Configuración → Puesta en marcha te los marca en rojo
- **Meter tu censo de verdad** — empieza por veinte fichas, no por mil

---

## Lo que NO hay que hacer todavía

| | Por qué |
|---|---|
| **Mandar una remesa al banco** | El fichero se genera bien, pero la primera quiero verla contigo. Un error ahí son cargos a cientos de personas. |
| **Conectar Stripe** | Falta el webhook que recoge la vuelta del pago. Hoy se paga y la cuenta seguiría bloqueada. |

---

## Y si algo sale mal

Mándame **la captura y el mensaje entero**, aunque parezca un galimatías. No investigues por qué: cuéntalo y sigue con otra cosa.

Si es algo de **dinero** —un recibo repetido, un importe que no cuadra— **para y avisa antes de seguir**.
