# Actualizar la base de datos — septiembre de 2026

Guía corta para poner al día una hermandad que **ya está funcionando**.

---

## Lo único que hay que hacer

1. Entra en tu proyecto en **supabase.com**
2. Menú de la izquierda → **SQL Editor** → **New query**
3. Abre `ACTUALIZAR.sql`, cópialo **entero**, pégalo y dale a **RUN**

Al terminar sale **una tabla** diciendo qué hay puesto y qué no. Es lo único
que devuelve. Si sale todo en `t` (verdadero) menos `pg_cron`, ya está.

> `pg_cron` sale en `f` a propósito: se enciende a mano desde el panel de
> Supabase (Database → Extensions) y solo hace falta para las copias
> automáticas.

**Es seguro repetirlo.** Todo está escrito para no romperse si ya existía, y
nada de lo que hay ahí borra ni sobrescribe datos.

---

## Si empiezas de cero

`ACTUALIZAR.sql` **no** vale para una base vacía: solo trae lo que se ha ido
añadiendo después de la instalación. Para montar una base nueva usa
**`TODO-EN-UNO.sql`**, que lo crea todo.

Ejecutar los dos tampoco rompe nada, solo sobra.

---

## Qué añade esta tanda

Cuatro cosas nuevas, con sus tablas y sus permisos:

| Fichero | Qué es |
|---|---|
| `campanas-y-proyectos.sql` | Campañas de recaudación con su barra, y proyectos a largo plazo |
| `reglas-de-reparto.sql` | Gastos porcentuales enlazados a una partida, para pérdidas y ganancias |
| `tienda-web.sql` | La tienda en la web pública: reservar por internet y pagar al recoger |
| `pago-tarjeta.sql` | Que el hermano pague su cuota o su papeleta con tarjeta |

Y un arreglo que **no crea nada** pero hace falta:

| Fichero | Qué arregla |
|---|---|
| `cuenta-por-hermandad.sql` | El `gen_random_bytes ... does not exist` que rompía el correo de contraseña del hermano |

`pgcrypto` está instalada en tu proyecto, pero en el esquema `extensions`, y las
funciones no la encontraban. Ya viene corregido dentro de `ACTUALIZAR.sql`: con
volver a ejecutarlo entero queda arreglado.

Los cinco van dentro de `ACTUALIZAR.sql`, así que **no hay que ejecutarlos
sueltos**: con pegar `ACTUALIZAR.sql` entero es suficiente.

### Un módulo de permisos nuevo: «campañas»

Con las campañas y los proyectos aparece un módulo nuevo en **Personal y
permisos**. El SQL se lo siembra al Hermano Mayor, al Secretario, al Tesorero
y al Mayordomo, que son los cargos a los que le pega.

Si en tu hermandad lo lleva otra persona, se le da desde
**Personal y permisos**, como cualquier otro.

> Solo se le añade a los cargos que tu hermandad **ya reconoce**. Si nunca
> tuviste un «Vocal», no se te inventa uno ahora. Y lo que le hayas quitado a
> alguien a propósito se respeta: esto solo añade lo que nunca estuvo.

---

## Lo otro que hay que hacer, y que NO es SQL

**Volver a desplegar la función de correo.** El diagnóstico de correo nuevo
—el botón de Configuración que dice por qué no llegan los mensajes— no
funciona con la versión antigua:

```
supabase functions deploy enviar-correo
```

### Y si quieres el pago con tarjeta

Esto es **opcional**. Ejecutar el SQL no enciende nada: mientras no hagas los
tres pasos de abajo, el botón de tarjeta no le sale a nadie y todo sigue
cobrándose como hasta ahora (Bizum, transferencia y domiciliación).

1. La clave de Stripe y la función que abre el cobro:

   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase functions deploy crear-pago
   ```

2. En el panel de Stripe, en el mismo endpoint del webhook que ya tienes,
   asegúrate de que están estos dos eventos —son los mismos que usa la
   suscripción, así que lo normal es que ya estén:

   ```
   checkout.session.completed
   checkout.session.async_payment_succeeded
   ```

3. En Gobergo, **Configuración** → pegar el identificador de la cuenta de
   Stripe de la hermandad (`acct_…`).

> **El dinero va a la cuenta de la hermandad, no a la de Gobergo**, y por eso
> hace falta ese `acct_…`: es el destinatario del cobro. **No es una clave
> secreta** y no sirve para cobrar nada por su cuenta; la clave vive en el
> servidor y no sale de ahí. La comisión de Stripe la asume la hermandad, que
> es lo normal: sumársela al hermano significa cobrar un recibo de 30 € por
> 30,87 €, y eso es lo primero que se reclama en secretaría.

---

## Si algo sale mal

Ejecuta `DIAGNOSTICO.sql` en el mismo SQL Editor. Dice qué falta y por qué,
en cristiano, y no toca nada.

Para el caso concreto de «no me deja hacer X y no sé por qué», está
`POR-QUE-NO-PUEDO.sql`, que mira los permisos de una cuenta en concreto.
