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

**Lo que tienes que hacer:**

1. Supabase → **Authentication → Emails → SMTP Settings**.
2. Activa *Enable Custom SMTP* y mete los datos de un proveedor. Con Resend:
   - Host: `smtp.resend.com` · Puerto: `465` · Usuario: `resend`
   - Contraseña: tu clave de API de Resend
   - Sender email: un correo **de tu dominio verificado**
3. Authentication → **URL Configuration** → *Site URL*: la dirección real de la
   aplicación. Si no, los enlaces de los correos apuntan a `localhost`.

### 2.b · Los correos que manda la hermandad (los manda Cabildo)

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
   La hermandad  ──paga la suscripción──►  Cabildo      (paso 3.a)
   Los hermanos  ──pagan cuotas──────────►  Su hermandad (paso 3.b)
```

El dinero de los hermanos **no pasa por Cabildo en ningún momento**. No puede:
cobrar en nombre de otro exige ser entidad de pago. Va directo a la cuenta de
la hermandad.

### 3.a · La suscripción a Cabildo (esto lo cobras tú)

✅ **Preparado y apagado.** `src/lib/pagoSuscripcion.ts` y la función
`supabase/functions/crear-suscripcion/`. Mientras no haya claves, la pantalla
de suscripción activa la cuenta sin cobrar y **lo dice** («pago simulado»). En
cuanto haya precios, el mismo botón lleva a Stripe y el texto cambia solo. No
hay que tocar código.

Va por **Stripe Checkout**: la tarjeta se teclea en Stripe, no en Cabildo. Eso
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

5. Prueba con la cuenta de test de Stripe (`sk_test_...` y tarjeta
   `4242 4242 4242 4242`) **antes** de poner las claves de verdad.

⬜ **Queda por hacer:** el webhook que apunta el cobro cuando Stripe lo
confirma. Hoy la cuenta se activa al volver del pago; con el webhook se activa
cuando el dinero entra de verdad, que es lo correcto. Para empezar a vender no
bloquea, pero conviene tenerlo antes de tener muchos clientes.

### 3.b · Lo que los hermanos pagan a su hermandad

Hay **tres formas**, y las tres están ya en la aplicación:

**1. Domiciliación bancaria (SEPA) — es como cobra el 90% de las hermandades**

✅ Cabildo genera el fichero de remesa (XML `pain.008`, el que pide el banco)
desde Cuotas. Se descarga y se sube a la banca electrónica. No hace falta
contratar nada: se usa la cuenta que ya tiene la hermandad.

⚠️ **Antes de la primera remesa real, hablar con el banco.** Cabildo todavía no
guarda los mandatos SEPA firmados: el identificador de mandato lo compone a
partir del número de hermano. Es un punto de partida razonable, pero el banco
tiene que dar el visto bueno, y por ley hace falta la orden firmada de cada
hermano. Está avisado en el propio código.

**2. Bizum o transferencia**

✅ La hermandad pone su teléfono Bizum y su IBAN en Configuración. El hermano
paga y avisa desde su área; la tesorería lo confirma al ver el ingreso.

**3. Pasarela de pago propia (tarjeta)**

✅ Si la hermandad contrata una pasarela **a su nombre y con su CIF** (su banco,
Redsys o Stripe), pega el enlace de pago en Web pública → Donativos y ya cobra
con tarjeta. El dinero entra en su cuenta, no en la tuya.

⬜ **Más adelante, si lo quieres más redondo:** Stripe Connect. Cada hermandad
se da de alta desde dentro de Cabildo, en unos minutos y sin salir de la
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

✅ **El interruptor del modo local de reserva.** Hoy, si Supabase está en pausa,
la aplicación sigue funcionando con los datos del navegador. Eso está muy bien
mientras se monta, y es un problema en producción: la secretaría entraría,
vería un censo que no es el suyo y pasaría la tarde dando altas que no existen
en ningún sitio. Con `VITE_SIN_MODO_LOCAL=1` se cae con su error, que es lo
correcto cuando hay hermandades de verdad.

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
   VITE_SIN_MODO_LOCAL=1
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
| Correos de cuenta (confirmación, contraseña) | ⬜ Falta el SMTP propio en Supabase |
| Remesas SEPA | ✅ Genera el fichero · ⚠️ sin mandatos firmados guardados |
| Suscripción por Stripe | ✅ Preparado · ⬜ falta la cuenta y los precios · ⬜ falta el webhook |
| Cobro de las hermandades a sus hermanos | ✅ SEPA, Bizum y enlace de pasarela |
| Textos legales | ⬜ Con huecos por rellenar |
| Contrato de encargo (art. 28) | ⬜ Redactado, sin firmar con nadie |
| Copias de seguridad | ⬜ Hay que activarlas en Supabase |

**Lo que NO haría todavía:** cobrar a una hermandad grande antes de haber hecho
una remesa SEPA de verdad con su banco. Es lo único que puede salir caro y lo
único que no se puede probar sin un banco delante.
