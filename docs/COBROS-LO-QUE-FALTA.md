# Cobrar de verdad: lo que falta

> Apuntado para más adelante. **No hay prisa**: nada de esto bloquea el uso
> diario de Gobergo, y lo de aquí abajo son trámites y piezas que se enchufan
> cuando toque. Lo que sí conviene es leerlo antes de prometerle a una
> hermandad que ya se le puede cobrar.

Son dos circuitos de dinero distintos y no se pisan:

| | Quién paga | A quién | Cómo |
|---|---|---|---|
| **Domiciliaciones SEPA** | el hermano | a su hermandad | fichero al banco |
| **Suscripción** | la hermandad | a Gobergo | Stripe |

---

## 1. Domiciliaciones SEPA — cobrar la cuota al hermano

### Lo que ya está hecho

`src/lib/sepa.ts` genera el fichero **`pain.008.001.02`** entero, que es el
formato que pide el banco para una remesa CORE. Se descarga desde Cuotas →
Preparar remesa. Y ya está resuelto lo que suele salir mal:

- `acreedorIncompleto()` no deja generar el fichero sin los datos del acreedor,
  en vez de producir un XML que el banco rechaza tres días después.
- `cuotas.remesada_el` marca lo que ya viajó en un fichero, **para que no entre
  dos veces**. Dos remesas con el mismo recibo son dos cargos al hermano, y el
  segundo se devuelve con comisión.
- El estado `Devuelta` existe y la deuda vuelve a contar.

### Lo que falta

**a) Mandatos firmados de verdad.** Es lo único que es *bloqueante*, y es
legal, no técnico. Hoy el identificador de mandato (`MndtId`) y su fecha de
firma **se sintetizan** a partir del número de hermano y su antigüedad —lo dice
la cabecera del propio módulo—. Para una demostración vale; para una remesa
real no, porque el mandato es el papel que autoriza el cargo y el que decide
quién gana si el hermano lo reclama.

Hace falta: una tabla de mandatos, la pantalla para recogerlos (o para volcar
los que la hermandad ya tenga en papel) y que el XML lleve la referencia y la
fecha reales.

> **Que no se escape:** ninguna hermandad debería presentar su primera remesa
> real hasta tener esto.

**b) El identificador de acreedor SEPA.** Lo da el banco a la hermandad, es
gratis y tarda. No lo podemos hacer nosotros; conviene que lo pidan pronto.

**c) Leer el fichero de devoluciones del banco** (cuaderno 19-44 / `pain.002`).
Hoy las devoluciones se marcan una a una a mano. Con 600 recibos y un 3 % de
devoluciones son veinte apuntes a mano cada mes, y los que no se hacen son
deuda que desaparece de los números.

---

## 2. Stripe — cobrar la suscripción a la hermandad

### Lo que ya está hecho

`supabase/functions/crear-suscripcion/index.ts` crea la sesión de Checkout en
`mode: subscription`, con `client_reference_id` y los metadatos puestos, y
devuelve la `url` a la que se manda a la hermandad. Esa parte funciona.

### Lo que falta: **el webhook**

En `supabase/functions/` solo hay `crear-suscripcion` y `enviar-correo`. **No
hay webhook.** Y sin webhook, Stripe cobra y la aplicación no se entera nunca:

- la suscripción no se activa sola al pagar;
- una baja no se detecta: quien cancele sigue usándolo todo;
- una tarjeta que falla tampoco.

Hace falta una función `stripe-webhook` que verifique la firma con
`STRIPE_WEBHOOK_SECRET` (sin eso cualquiera puede regalarse una suscripción
mandando un POST) y atienda cuatro eventos:

| Evento | Qué hacer |
|---|---|
| `checkout.session.completed` | activar la suscripción de esa hermandad |
| `invoice.paid` | renovar el periodo |
| `invoice.payment_failed` | avisar, y dar margen antes de cerrar |
| `customer.subscription.deleted` | dar de baja |

---

## 3. Y aparte: que el hermano pague con tarjeta

La pasarela para que el hermano pague **su cuota o su papeleta** con tarjeta
está marcada `noDisponible` en la aplicación. Hoy paga por Bizum o
transferencia y avisa desde su área; la tesorería lo confirma contra el banco
(eso sí funciona, y llega al panel de Notificaciones).

---

## Por dónde empezaría

1. **El webhook de Stripe.** Es lo que decide si se cobra o no: sin él, quien
   cancele se queda con el producto gratis.
2. **Los mandatos SEPA**, antes de que ninguna hermandad presente su primera
   remesa de verdad.
3. Lo demás —devoluciones automáticas, tarjeta del hermano— cuando haya
   hermandades cobrando y se note la falta.
