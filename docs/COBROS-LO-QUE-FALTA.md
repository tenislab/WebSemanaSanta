# Cobrar de verdad: lo que falta

> **Revisado el 8 de septiembre de 2026, comprobando cada línea contra el
> código.** La versión anterior de este documento daba por pendientes cuatro
> cosas que ya estaban hechas — mandatos, webhook, devoluciones y tarjeta del
> hermano— y por eso el plan que salía de él era falso. Al final hay una nota
> de cómo evitar que se vuelva a quedar atrás.
>
> **Y el mismo día se cerró lo que quedaba**: la tarjeta que falla y la columna
> `hasta`. Se tacha aquí en el mismo commit, que es la regla que salió de la
> revisión anterior. De todo el circuito del dinero ya solo queda un trámite
> que no depende de código.

Son dos circuitos de dinero distintos y no se pisan:

| | Quién paga | A quién | Cómo |
|---|---|---|---|
| **Domiciliaciones SEPA** | el hermano | a su hermandad | fichero al banco |
| **Suscripción** | la hermandad | a Gobergo | Stripe |
| **Tarjeta** | el hermano | a su hermandad | Stripe, cuenta conectada |

---

## Resumen: qué falta de verdad

Poco, y nada de ello bloquea a una hermandad para empezar a cobrar.

| | Estado |
|---|---|
| Fichero de remesa `pain.008` | hecho |
| Mandatos SEPA firmados por el hermano | hecho |
| Lectura de devoluciones del banco (`pain.002`) | hecho |
| Webhook de Stripe (alta y baja) | hecho |
| Tarjeta del hermano | hecho |
| `invoice.payment_failed`: la tarjeta que falla | hecho |
| `invoice.paid`: la renovación de cada mes | hecho |
| `suscripciones.hasta` | hecho: la rellena el webhook y la lee la aplicación |
| **Identificador de acreedor SEPA** | **trámite de la hermandad con su banco** |

---

## 1. Domiciliaciones SEPA — cobrar la cuota al hermano

### Hecho

`src/lib/sepa.ts` genera el fichero **`pain.008.001.02`** entero, que es lo que
pide el banco para una remesa CORE. Se descarga desde Cuotas → Preparar remesa.
Y está resuelto lo que suele salir mal:

- `acreedorIncompleto()` no deja generar el fichero sin los datos del acreedor,
  en vez de producir un XML que el banco rechaza tres días después.
- `cuotas.remesada_el` marca lo que ya viajó en un fichero, **para que no entre
  dos veces**. Dos remesas con el mismo recibo son dos cargos al hermano, y el
  segundo se devuelve con comisión.
- El estado `Devuelta` existe y la deuda vuelve a contar.

**LOS MANDATOS SON DE VERDAD.** Este documento decía que el `MndtId` y la fecha
de firma «se sintetizan» a partir del número de hermano, y lo marcaba como lo
único bloqueante. Ya no es así: existe la tabla `mandatos_sepa` —con el IBAN
congelado en el momento de firmar, su referencia única y la fecha— y
`src/lib/sepa.ts` dice literalmente «no hay nada que sintetizar aquí». El
hermano firma el suyo desde su área.

**LAS DEVOLUCIONES SE LEEN.** Decía que se marcaban «una a una a mano».
`src/lib/devoluciones.ts` lee el fichero **`pain.002`** del banco y aplica las
devoluciones de golpe, desde Cuotas.

> Lo que NO lee, y es una decisión escrita en ese mismo fichero, es el cuaderno
> antiguo de ancho fijo (19-14 y parientes). Si alguien sube uno, se le dice por
> su nombre y se le explica que pida a su banco el `pain.002`. Es lo correcto:
> adivinar posiciones de un formato viejo para acabar marcando mal un cobro es
> peor que no leerlo.

### Lo que sigue faltando

**El identificador de acreedor SEPA.** Lo da el banco a la hermandad, es gratis
y tarda. No lo podemos hacer nosotros; conviene que lo pidan pronto. Es lo único
que impide presentar una remesa, y no depende de código.

---

## 2. Stripe — cobrar la suscripción a la hermandad

### Hecho

- `supabase/functions/crear-suscripcion` crea la sesión de Checkout.
- `supabase/functions/webhook-stripe` **existe**, verifica la firma con
  `STRIPE_WEBHOOK_SECRET` sobre el cuerpo sin tocar, y atiende tres eventos:

| Evento | Qué hace |
|---|---|
| `checkout.session.completed` | activa la suscripción |
| `checkout.session.async_payment_succeeded` | la activa cuando el cobro diferido entra por fin |
| `invoice.paid` | apunta la renovación y hasta cuándo está pagada |
| `invoice.payment_failed` | apunta el día del fallo, **sin cortar el acceso** |
| `customer.subscription.deleted` | la da de baja |

Atendía tres eventos y le faltaban los dos que pasan **en medio**, que es donde
vive una suscripción de verdad: que se cobre cada mes y que un día la tarjeta
falle. Están en `supabase/renovacion-y-fallo-de-cobro.sql`.

### La tarjeta que falla: qué era el agujero, y qué no

Conviene contarlo bien, porque es fácil contarlo mal. **No era acceso gratis
para siempre.** Cuando Stripe no consigue cobrar, reintenta unas semanas y al
final cancela la suscripción y manda `customer.subscription.deleted`, que sí se
atendía. El agujero estaba acotado a esas semanas.

Lo grave era otra cosa: **nadie se lo decía a la hermandad**. Se enteraba el día
que se quedaba fuera de golpe, sin un solo aviso previo — y si tocaba en marzo,
en la peor semana del año.

Ahora se apunta el día del fallo y la aplicación lo enseña arriba mientras siga
fallando, con dos tonos: a los catorce días pasa de «cámbiala cuando puedas» a
«está a punto de cancelarse».

**Y no se corta el acceso.** Es la decisión de todo el circuito: una tarjeta
caducada no es un impago. Cortar el día uno dejaría sin papeletas a
cuatrocientas personas por un trámite de dos minutos, y trataría como morosa a
una hermandad que lleva dos años pagando. El cierre, si de verdad no se cobra
nunca, lo sigue trayendo Stripe.

> **El aviso va dentro de la aplicación, no por correo.** El correo de verdad
> depende de tener un dominio verificado (fase F15, pendiente); hasta entonces
> lo que se manda acaba en la carpeta de correo no deseado, y un aviso que no se
> lee es peor que ninguno porque da la sensación de haber avisado.

### `suscripciones.hasta` ya significa algo

La columna existía y decía «hasta cuándo está pagada», pero `activar_suscripcion`
la recibía como parámetro y **el webhook siempre le pasaba `null`**, así que
estaba vacía en todas las filas; y la aplicación no la leía nunca.

Ahora la rellena `invoice.paid` con la fecha real —la del periodo de la línea de
la factura, que en la primera factura no es la misma que la de la suscripción— y
`mi_suscripcion()` la devuelve. Se rellenó en vez de quitarla porque es lo que
permite decir «te caduca en una semana» ANTES de que caduque.

Sigue **sin ser el muro de pago**: ese es `activa`, y a propósito. Si el acceso
dependiera de esta fecha, un webhook que no llegara un día dejaría fuera a una
hermandad que no debe nada.

---

## 3. Que el hermano pague con tarjeta — hecho

Este documento lo daba por no disponible. Está: `supabase/functions/crear-pago`
abre el cobro de una cuota o una papeleta.

Y lleva dentro la decisión que importa: **el cobro se crea contra la cuenta
conectada de la hermandad** (`Stripe-Account`), así que el dinero entra en su
saldo y se paga a su IBAN. Gobergo no lo toca ni un segundo y no se queda
comisión — no se manda `application_fee_amount`.

Sigue existiendo el otro camino, el de siempre: el hermano paga por Bizum o
transferencia y avisa desde su área; tesorería lo confirma contra el banco y le
salta en Notificaciones.

---

## Por dónde seguir

1. **Recordarle a la hermandad piloto que pida su identificador de acreedor
   SEPA al banco**, que tarda, no depende de nosotros y es lo único que impide
   presentar una remesa.
2. **El correo de verdad (fase F15)**, con dominio verificado. Hasta que exista,
   los avisos que importan van dentro de la aplicación.
3. Con `hasta` ya rellena, se puede avisar de **«te caduca en una semana»** antes
   de que caduque. No hace falta nada nuevo en la base: el dato ya está.

---

## Por qué este documento se quedó atrás, y cómo evitarlo

Se escribió cuando era verdad, se fueron haciendo las cosas, y nadie volvió a
abrirlo. Es exactamente lo que le pasó a `DIAGNOSTICO.sql` —que llevaba meses
sin mirar siete tablas— y al generador de iconos, que ni arrancaba.

La diferencia es que aquellos dos se podían vigilar mecánicamente y ya se
vigilan. Un documento en prosa no. Lo único que funciona con esto es una regla
de trabajo: **al cerrar algo que aparece en un documento como pendiente, se
tacha en el mismo commit.** Está en `docs/COMO-TRABAJAR.md`.

Y si aun así se duda de si un documento dice la verdad, la comprobación es la
de siempre: mirar el código, no el documento. Cuatro `grep` bastaron para ver
que este daba por pendientes cuatro cosas hechas.

### Dos puntos ciegos que aparecieron al cerrar esto

Merecen quedar escritos porque los dos eran de la misma familia —algo que
parecía vigilado y no lo estaba— y ninguno daba error en ningún sitio:

- **`DIAGNOSTICO.sql` no miraba el circuito del dinero.** Sacaba la lista de
  funciones de las llamadas `.rpc(…)` que hay en `src`, o sea del navegador. Y
  las funciones del cobro no las llama el navegador **a propósito**: las llama
  el webhook con la clave de servicio. Trece funciones fuera del diagnóstico,
  entre ellas las cinco de las que depende cobrar. Ahora se leen también las
  funciones de Supabase.

- **`ACTUALIZAR.sql` escribía en `suscripciones` sin garantizar la tabla.** La
  crea `suscripcion.sql`, que solo iba en el instalador. Una hermandad que
  montó su base antes de que existiera la tabla y desde entonces solo ha ido
  pegando `ACTUALIZAR.sql` se encontraba con «relation "suscripciones" does not
  exist» y la actualización parada a la mitad.

Los dos los cazaron pruebas que ya existían, en cuanto se tocó algo cerca. Es
el argumento entero a favor de escribirlas.
