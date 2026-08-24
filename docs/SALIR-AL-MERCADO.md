# Salir al mercado

Los cuatro pasos que quedan, en orden. Cada uno es independiente: se puede
parar entre uno y otro sin dejar nada a medias.

Lo que ya está hecho y probado va marcado con ✅. Lo que depende de que tú
contrates algo o pegues una clave, con ⬜.

---

## Paso 1 · Supabase, una sola base para todas las hermandades

### Lo que ya está hecho

✅ **El SQL entero, en un archivo.** `supabase/TODO-EN-UNO.sql`. Se pega de una
vez en el editor SQL de Supabase. Son 8 bloques; el 8º es el que hace que
quepan todas las hermandades sin que ninguna vea nada de las demás.

✅ **El aislamiento, probado de verdad.** `supabase/PRUEBA-AISLAMIENTO.sql`
levanta dos hermandades con hermanos, cuotas, papeletas, adjuntos y web, y
comprueba 47 cosas. Se ha ejecutado sobre un PostgreSQL 16 real: 47 correctas,
0 fallos. Entre otras:

- Ninguna hermandad lee, modifica, borra ni inserta nada de otra.
- Un hermano solo ve su ficha, sus cuotas y sus papeletas.
- Sin sesión no se ve ningún dato personal.
- Una cuenta registrada que aún no tiene hermandad **no ve absolutamente nada**.
- Los adjuntos del Archivo (actas, contratos) van por carpeta de hermandad.
- El mismo DNI puede estar en dos hermandades y cada una tiene su nº 1.

✅ **Ya no hay que darse de alta a mano como titular.** Antes había que copiar
el identificador de la cuenta desde Supabase y escribir un `insert`. Ahora, la
primera vez que entras, se crea tu hermandad y quedas como titular solo.

### Lo que tienes que hacer tú

1. Entra en tu proyecto de Supabase → **SQL Editor** → **New query**.
2. Pega **`supabase/TODO-EN-UNO.sql`** entero y pulsa **Run**.
   Tiene que decir *Success*. Si da error, no sigas: mándamelo.
3. **Project Settings → API**. Copia *Project URL* y la clave *anon public*.
4. Pégalas en el archivo `.env` del proyecto:

   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

   > La clave **service_role** no se usa nunca en esta aplicación. Si alguien
   > te la pide, no la des: salta todas las protecciones de una vez.

5. `npm run dev`, y **regístrate con tu correo**. Al entrar se crea tu
   hermandad sola.
6. Comprueba en Supabase → Table Editor → `hermandades` que hay una fila.

### Para probar que el aislamiento funciona con tus propios ojos

Regístrate con un segundo correo distinto. Se crea una segunda hermandad. Da
de alta un hermano en cada una y comprueba que desde una no ves el de la otra.

---

## Paso 2 · Los correos

Hay **dos clases** de correo y se contratan por separado. Es la confusión más
habitual, así que conviene tenerlo claro antes de tocar nada.

### 2.a · Los correos de la cuenta (los manda Supabase)

Confirmar el correo al registrarse, recuperar la contraseña, la invitación a un
hermano al que la secretaría le crea el acceso.

⚠️ **Supabase trae un remitente de pruebas que NO sirve para producción**: son
2 o 3 correos por hora y se caen sin avisar. Con una hermandad de 800 hermanos
no llega ni al primer día.

**Este remitente es UNO para todo el proyecto, no uno por hermandad.** Como
todas comparten el mismo Supabase, por aquí salen los correos de cuenta de
todo el mundo. Si se pone una dirección personal, un hermano de una hermandad
cualquiera recibirá su «confirma tu correo» desde ese Gmail:

    De: jrrjaime2004@gmail.com
    Asunto: Confirma tu correo

Funciona, pero se ve mal. Para probar da igual; para vender conviene un
`no-responder@` de un dominio propio.

Esto vale solo para los correos de cuenta. Los **comunicados y avisos** que
manda cada hermandad son otro remitente distinto (punto 2.b) y ahí sí puede
salir el nombre de cada una.

### ¿Y si luego quiero cambiar la dirección?

**No es ningún lío, y no ata a nada.** Son dos campos en dos sitios:

| Qué correos | Dónde se cambia |
|---|---|
| Los de cuenta | Supabase → Authentication → SMTP Settings |
| Los de la hermandad | `supabase secrets set CORREO_REMITENTE=...` |

No se pierde ninguna cuenta, no hay que migrar nada, nadie tiene que volver a
registrarse, y los enlaces de los correos ya enviados siguen funcionando
(apuntan al *Site URL*, no al remitente). Lo único que lleva tiempo es
verificar el dominio nuevo en Resend, que se hace una vez.

Así que **no merece la pena esperar**: se arranca con lo que haya, se prueba
todo, y se cambia el día que haya dominio.

Se configura en Supabase → **Authentication → Emails → SMTP Settings**.

#### Antes de nada: los tres errores que es fácil cometer aquí

**1. El «Host» NO es la dirección de tu web.** Es el servidor de correo, que es
otra cosa. `web-semana-santa.vercel.app` es donde vive la aplicación; ahí no hay
ningún servidor de correo escuchando. Y **nunca lleva `https://` delante**: no
es una página web, es un servidor SMTP.

| Mal | Bien |
|---|---|
| `https://web-semana-santa.vercel.app` | `smtp.gmail.com` |
| | `smtp.resend.com` |

**2. El usuario y la contraseña no te los inventas.** Te los da el proveedor de
correo. Poner `GobergoWEB` / `GobergoWEB` no configura nada: es como escribir un
nombre cualquiera en la puerta de un banco.

**3. El remitente tiene que ser de un dominio que controles.** Con Resend no
puedes enviar desde `@gmail.com`: hay que verificar el dominio antes, y
`gmail.com` no es tuyo. Con Gmail (opción A) sí puedes, porque envías desde tu
propia cuenta.

#### Opción A · Gmail — para probar hoy, sin dominio

Funciona en cinco minutos y no hay que comprar nada. Sirve para comprobar que
todo el circuito va: registro, confirmación, contraseña olvidada.

1. Cuenta de Google → **Seguridad**.
2. Activa la **Verificación en 2 pasos**. Sin esto, el paso siguiente no
   aparece; es el motivo por el que la mayoría de la gente se atasca aquí.
3. Busca **«Contraseñas de aplicaciones»** y crea una. Te da 16 letras.
   No es tu contraseña de Gmail: es una aparte, solo para esto.
4. En Supabase:

   | Campo | Valor |
   |---|---|
   | Host | `smtp.gmail.com` |
   | Port number | `465` |
   | Username | tu correo completo de Gmail |
   | Password | las 16 letras del paso 3 |
   | Sender email address | el mismo correo de Gmail |
   | Sender name | `Gobergo` |

⚠️ **Esto es para probar, no para abrir al público.** Gmail corta sobre los 500
correos al día, salen desde una cuenta personal y una buena parte acaba en la
carpeta de spam. Una hermandad de 800 hermanos no cabe.

#### Opción B · Resend — para el día que se abra al público

👉 **La web es https://resend.com**

**Hace falta un dominio propio** (algo como `gobergo.es`). Sin dominio, Resend
no se puede usar para nada más que escribirte a ti mismo, así que si todavía no
lo tienes, quédate en la opción A hasta comprarlo.

1. Compra el dominio donde prefieras.
2. Entra en https://resend.com y regístrate.
3. **Domains → Add Domain** → escribe tu dominio.
4. Resend te enseña unos registros DNS (SPF, DKIM). Cópialos donde compraste el
   dominio. Tarda entre unos minutos y unas horas en dar el visto bueno.
5. **API Keys → Create API Key**. Te da una clave que empieza por `re_`.
   Se enseña UNA vez: cópiala en ese momento.
6. En Supabase:

   | Campo | Valor |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port number | `465` |
   | Username | `resend` (literalmente esa palabra) |
   | Password | la clave `re_...` |
   | Sender email address | `no-responder@tudominio.es` |
   | Sender name | el nombre de la hermandad |

> La misma clave `re_...` vale también para el punto 2.b (los correos que manda
> la hermandad). Allí NO va en esta pantalla, sino como secreto de Supabase.

#### Y una cosa más, que si no los enlaces no funcionan

Authentication → **URL Configuration** → *Site URL*: la dirección real de la
aplicación. Si se queda como está, los enlaces de «confirma tu correo» y
«recupera tu contraseña» apuntan a `localhost` y no le funcionan a nadie.

### 2.b · Los correos que manda la hermandad (los manda Gobergo)

Comunicados, avisos de cuota, papeletas, cambios de ficha, bajas.

✅ **Ya está montado.** La función `supabase/functions/enviar-correo/`, los
ajustes en Configuración → Correo, y los avisos enganchados donde ocurren las
cosas. Los destinatarios van en copia oculta a propósito: mandar un comunicado
con 800 direcciones a la vista sería filtrar el censo entero.

✅ **Lo que sale por correo hoy**, si la hermandad lo tiene encendido y el
hermano no lo ha apagado en su área:

| Cuándo | Aviso |
|---|---|
| Se publica un comunicado | El comunicado entero |
| Se marca una cuota como pagada | «Tu recibo queda pagado» |
| Se le asigna sitio en el cortejo | «Ya tienes sitio: *tramo*» |
| Cambian datos de su ficha | Qué se ha cambiado |
| Le cambian la cuenta bancaria | Aviso aparte, para que lo detecte |
| Se tramita su baja | La baja (aquí el correo es la **única** vía: ya no entra a su área) |

**Lo que tienes que hacer:**

1. Date de alta en [Resend](https://resend.com) y **verifica tu dominio**
   (te da unos registros DNS que hay que pegar donde tengas el dominio).
   Sin dominio verificado solo puedes escribirte a ti mismo.
2. Guarda la clave como secreto de Supabase — **nunca en el `.env`**, que
   acaba en el navegador:

   ```
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set CORREO_REMITENTE="Hermandad <no-responder@tudominio.es>"
   supabase functions deploy enviar-correo
   ```

3. En la aplicación: **Configuración → Correo** → enciéndelo y usa
   **«Enviar correo de prueba»**. Si falla, ahí sale el motivo real.

---

## Paso 3 · Los pagos

Aquí hay **dos dineros distintos** y no se mezclan nunca. Es lo primero que hay
que entender, porque cambia qué hay que contratar y a nombre de quién.

```
   La hermandad  ──paga la suscripción──►  Gobergo      (paso 3.a)
   Los hermanos  ──pagan cuotas──────────►  Su hermandad (paso 3.b)
```

El dinero de los hermanos **no pasa por Gobergo en ningún momento**. No puede:
cobrar en nombre de otro exige ser entidad de pago. Va directo a la cuenta de
la hermandad.

### 3.a · La suscripción a Gobergo (esto lo cobras tú)

✅ **Preparado y apagado.** `src/lib/pagoSuscripcion.ts` y la función
`supabase/functions/crear-suscripcion/`. Mientras no haya claves, la pantalla
de suscripción activa la cuenta sin cobrar y **lo dice** («pago simulado»). En
cuanto haya precios, el mismo botón lleva a Stripe y el texto cambia solo. No
hay que tocar código.

Va por **Stripe Checkout**: la tarjeta se teclea en Stripe, no en Gobergo. Eso
deja el cumplimiento de PCI en el mínimo.

**Lo que tienes que hacer, cuando quieras empezar a cobrar:**

1. Crea la cuenta de Stripe y complétala (necesita tu CIF y una cuenta bancaria).
2. **Products** → un producto por pack (Gestión, Web, Completo, Todo) y **dos
   precios recurrentes** en cada uno: mensual y anual.
3. Copia los identificadores (`price_...`) al `.env` del despliegue:

   ```
   VITE_STRIPE_PRECIO_GESTION_MES=price_...
   VITE_STRIPE_PRECIO_GESTION_ANIO=price_...
   VITE_STRIPE_PRECIO_WEB_MES=price_...
   VITE_STRIPE_PRECIO_WEB_ANIO=price_...
   VITE_STRIPE_PRECIO_COMPLETO_MES=price_...
   VITE_STRIPE_PRECIO_COMPLETO_ANIO=price_...
   VITE_STRIPE_PRECIO_TODO_MES=price_...
   VITE_STRIPE_PRECIO_TODO_ANIO=price_...
   ```

   > Los `price_...` **no son secretos**: se ven en cualquier página de pago.
   > El secreto es la clave con la que el servidor habla con Stripe.

4. La clave secreta, como secreto de Supabase:

   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase functions deploy crear-suscripcion
   ```

5. **El webhook**, que es lo que activa la suscripción cuando el dinero entra
   DE VERDAD y no cuando el navegador vuelve de Stripe (`supabase/functions/webhook-stripe/`):

   ```
   supabase functions deploy webhook-stripe --no-verify-jwt
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

   Y en el panel de Stripe: **Developers → Webhooks → Add endpoint**, con la
   URL que da el comando de arriba y estos dos eventos:
   `checkout.session.completed` y `customer.subscription.deleted`. Ejecuta
   antes `supabase/webhook-stripe.sql` (ya va dentro de `ACTUALIZAR.sql`):
   sin él, `activar_suscripcion` no tiene permiso para que la llame el
   webhook.

6. Prueba con la cuenta de test de Stripe (`sk_test_...` y tarjeta
   `4242 4242 4242 4242`) **antes** de poner las claves de verdad. El propio
   panel de Stripe deja mandar un evento de prueba al webhook sin pagar nada.

### 3.b · Lo que los hermanos pagan a su hermandad

Hay **tres formas**, y las tres están ya en la aplicación:

**1. Domiciliación bancaria (SEPA) — es como cobra el 90% de las hermandades**

✅ Gobergo genera el fichero de remesa (XML `pain.008`, el que pide el banco)
desde Cuotas. Se descarga y se sube a la banca electrónica. No hace falta
contratar nada: se usa la cuenta que ya tiene la hermandad.

✅ **El mandato SEPA se firma de verdad.** El hermano lo firma desde su propia
área, con un clic sobre el texto legal de la domiciliación (igual que el
consentimiento del boletín). Queda guardado quién, cuándo, con qué IBAN y qué
texto aceptó. Un recibo domiciliado sin mandato vigente para su IBAN actual no
entra en la remesa: se cae de la lista con el motivo a la vista, junto a los
que se caían por un IBAN inválido. Ver `supabase/mandatos-sepa.sql`.

**2. Bizum o transferencia**

✅ La hermandad pone su teléfono Bizum y su IBAN en Configuración. El hermano
paga y avisa desde su área; la tesorería lo confirma al ver el ingreso.

**3. Pasarela de pago propia (tarjeta)**

✅ Si la hermandad contrata una pasarela **a su nombre y con su CIF** (su banco,
Redsys o Stripe), pega el enlace de pago en Web pública → Donativos y ya cobra
con tarjeta. El dinero entra en su cuenta, no en la tuya.

⬜ **Más adelante, si lo quieres más redondo:** Stripe Connect. Cada hermandad
se da de alta desde dentro de Gobergo, en unos minutos y sin salir de la
aplicación, y cobra con tarjeta con el dinero yendo a su cuenta. Tú puedes
llevarte una comisión por operación si quieres. Es bastante trabajo (alta de
cuentas, verificación de identidad, reparto, devoluciones), así que **no es
para el lanzamiento**: es lo que se hace cuando ya hay hermandades pagando y
alguna lo pide.

---

## Paso 4 · Dejarla lista para el público

### Lo que ya está hecho

✅ **Los accesos de demostración desaparecen solos** en cuanto hay Supabase
configurado. No hay que borrar nada: están puestos detrás de «si no hay base de
datos». Los botones de «datos de ejemplo», las hermandades de muestra del área
del hermano y los accesos rápidos por cargo se ocultan todos.

✅ **El modo local de reserva, apagado de fábrica.** Si Supabase está en pausa,
la aplicación se cae con su error en vez de seguir con los datos del navegador.
Esto era antes un interruptor que había que acordarse de poner
(`VITE_SIN_MODO_LOCAL=1`), y un seguro que hay que acordarse de activar no es
un seguro: el día que de verdad hace falta es justo el día en que hay quince
cosas que hacer. Ahora viene puesto y lo que se pide a mano es quitarlo
(`VITE_MODO_LOCAL=1`), solo para desarrollar. Sin él, la secretaría entraría,
vería un censo que no es el suyo y pasaría la tarde dando altas que no existen
en ningún sitio.

### Lo que tienes que hacer tú

1. **Rellenar los textos legales.** Aviso legal, privacidad y cookies tienen
   huecos como `[RAZÓN SOCIAL]`. La aplicación te los marca en rojo sola:
   Configuración → Puesta en marcha. **Esto es obligatorio, no opcional**: el
   censo de una hermandad revela convicciones religiosas y es categoría
   especial del RGPD (artículo 9).
2. **El contrato de encargo de tratamiento** con cada hermandad
   (`docs/CONTRATO-ENCARGO.md`). Lo exige el artículo 28 del RGPD: sin él, tú y
   la hermandad estáis los dos en infracción desde el primer hermano que entre.
3. **Variables del despliegue** (Vercel → Settings → Environment Variables):

   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   SUPABASE_URL=...            (para el servidor: /w/:slug y el sitemap)
   SUPABASE_ANON_KEY=...
   ```

4. `npm run prelanzamiento` — 23 comprobaciones, incluida la de que no se te
   ha colado la clave `service_role` en el `.env`.
5. Copia de seguridad: Supabase → Database → Backups. En el plan gratuito no
   hay copias automáticas. Con datos de hermanos de verdad, eso no vale.

---

## Lo que hay que mirar de cerca, sin adornos

| Cosa | Estado |
|---|---|
| Aislamiento entre hermandades | ✅ Probado, 47 comprobaciones |
| Correos de la hermandad | ✅ Montado · ⬜ falta contratar el proveedor |
| Correos de cuenta (confirmación, contraseña) | ✅ SMTP propio puesto (Resend, `no-responder@gobergo.com`) |
| Remesas SEPA | ✅ Genera el fichero · ✅ mandatos firmados por el hermano |
| Suscripción por Stripe | ✅ Webhook montado · ⬜ falta la cuenta y los precios |
| Cobro de las hermandades a sus hermanos | ✅ SEPA, Bizum y enlace de pasarela |
| Textos legales | ⬜ Con huecos por rellenar |
| Contrato de encargo (art. 28) | ⬜ Redactado, sin firmar con nadie |
| Copias de seguridad | ⬜ Hay que activarlas en Supabase |

**Lo que NO haría todavía:** cobrar a una hermandad grande antes de haber hecho
una remesa SEPA de verdad con su banco, aunque ya lleve mandatos firmados. El
mandato es lo que le pide la ley y lo que enseñar si un hermano reclama; que
el fichero concreto que genera Gobergo lo acepte SIN peros el banco de esa
hermandad en concreto es algo que solo confirma un envío real.
