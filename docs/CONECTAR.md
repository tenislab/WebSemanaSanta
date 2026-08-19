# Conectar lo que falta

Cabildo funciona entero sin nada de esto: se lleva el censo, se cobran las
cuotas, se reparten las papeletas y se publica la web. Lo de aquí es lo que le
falta para funcionar **del todo**, y casi todo lo contrata la hermandad a su
nombre, no nosotros.

Dentro de la aplicación está en **Configuración → Puesta en marcha**, con el
estado de cada cosa. Lo que falta se avisa en rojo allí donde se nota, no se
esconde: un botón que no funciona se queda donde está y al lado se explica qué
le falta y quién lo arregla.

| Qué | Quién lo contrata | Coste aproximado |
|---|---|---|
| Base de datos (Supabase) | Quien administre Cabildo | Gratis para el tamaño de una hermandad |
| Envío de correo | La hermandad | Gratis o unos euros al mes |
| Pasarela de cobro | **La hermandad, a su nombre** | Comisión por cobro |
| Dominio propio | La hermandad | 10–15 € al año |

---

## 1. La base de datos (Supabase)

Sin ella, todo lo que se guarda vive **en ese navegador**: no lo ve nadie más de
la junta, y si se borran los datos de navegación, se pierde.

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. En **Project Settings → API**, copiar la *Project URL* y la clave *anon
   public*, y pegarlas en el archivo `.env` (hay plantilla en `.env.example`).
3. En **SQL Editor**, ejecutar por este orden los archivos de `supabase/`:
   - `schema.sql` (base nueva) **o** `migracion-2026-08.sql` (base ya creada
     con una versión anterior).
   - `rls-cargos.sql` y **acto seguido** `rls-endurecer.sql`. El segundo es
     **obligatorio**: sin él, cualquiera que se registre en `/registro` obtiene
     acceso de escritura a toda la base de datos.
   - `hermano-auth.sql`, `web-publica.sql` y `mensajes-web.sql`.
4. Reiniciar `npm run dev`.

### Probar antes con una base de verdad, en tu ordenador

No hace falta SQLite ni nada parecido. La propia Supabase levanta el stack
entero en tu máquina con Docker:

```
supabase start
```

Da una URL local y una clave; se ponen en el `.env` igual que las de la nube. **No
se cambia ni una línea de código** y valen los mismos archivos SQL. Se puede
romper y recrear sin miedo, porque no hay nadie más dentro.

### Ojo con el censo importado

Con Supabase conectado, el área del hermano usa **cuentas de acceso reales**
(Supabase Auth), no la contraseña guardada en la ficha. La importación de censo
**no crea esas cuentas**, y no puede: no se dan de alta mil cuentas desde un
navegador, y **quien no tiene correo no puede tener cuenta** —que en una
hermandad son muchos—.

Los hermanos importados entran en el censo con todos sus datos y la hermandad
trabaja con ellos con normalidad (cuotas, papeletas, cortejo, comunicados). Lo
que queda pendiente es darles acceso a *su* área, y eso se hace desde su ficha,
uno a uno, cuando lo pidan. Si algún día hiciera falta hacerlo en masa, tendría
que ser con un script del lado del servidor usando la clave de servicio, nunca
desde el navegador.

La aplicación lo avisa en la propia pantalla de importación.

---

## 2. El correo

Hoy los avisos llegan al buzón que cada hermano tiene dentro de su área, pero
**no sale ningún correo electrónico** hasta que se contrate un proveedor.

**El envío ya está montado**: la función de servidor, la pantalla de
configuración y el correo de prueba. Lo que falta es la cuenta del proveedor.

### Para empezar a probar hoy (15 minutos, gratis, sin dominio)

1. Crear cuenta en **[Resend](https://resend.com)**. El plan gratuito da 3.000
   correos al mes y 100 al día: de sobra para una hermandad.
2. Copiar la clave de API (`re_…`).
3. Instalar la herramienta de Supabase y guardar la clave **como secreto**, que
   es lo que la mantiene fuera del navegador:

   ```
   npm i -g supabase
   supabase login
   supabase link --project-ref TU-REF
   supabase secrets set RESEND_API_KEY=re_xxx
   supabase functions deploy enviar-correo
   ```

4. En Cabildo: **Configuración → Correo**, encender el envío y darle a
   **«Enviar prueba»**.

> **Sin dominio propio, Resend solo deja escribir a la dirección con la que te
> registraste**, usando `onboarding@resend.dev` como remitente. Es justo lo que
> hace falta para comprobar que todo el circuito funciona antes de meterse con
> el dominio.

### Para escribir de verdad a los hermanos

Hace falta **verificar el dominio de la hermandad** en Resend. Te dará tres
registros DNS que hay que poner donde compraron el dominio:

| Registro | Para qué |
|---|---|
| **SPF** | Dice qué servidores pueden enviar en nombre del dominio |
| **DKIM** | Firma cada correo, para que el destinatario compruebe que no está falsificado |
| **DMARC** | Dice qué hacer con los que no pasen las dos anteriores |

**Esto no es opcional.** Sin verificar, los correos van a spam o se rechazan
directamente, y una hermandad que manda una convocatoria de cabildo a spam es
peor que una que no la manda.

Después, cambiar el remitente:

```
supabase secrets set CORREO_REMITENTE="Hdad. de la Vera-Cruz <avisos@hermandad.es>"
supabase functions deploy enviar-correo
```

### Cómo está montado, y por qué así

- **La clave vive en el servidor, nunca en el navegador.** Permite escribir en
  nombre de la hermandad: si estuviera en el código del navegador, cualquiera la
  sacaría en diez segundos y podría suplantarla ante sus mil hermanos.
- **Solo la junta puede mandar.** La función comprueba quién llama contra
  Supabase; una cuenta de hermano no puede usarla.
- **Los hermanos van en copia oculta.** Mandar el comunicado con las mil
  direcciones a la vista sería filtrar el censo entero, y en una hermandad eso
  son datos de categoría especial.
- **Se respeta lo que cada hermano haya apagado** en su área. Que la hermandad
  encienda el correo no le quita a nadie su decisión.
- **Si el correo falla, el comunicado se publica igual** y llega al buzón. Se
  dice qué ha pasado, en vez de callarlo o de perder el comunicado.

---

## 3. Cobrar con tarjeta

**Cabildo no cobra por la hermandad.** El dinero tiene que entrar en una cuenta
suya, y eso exige una pasarela contratada a su nombre, con su CIF. Nosotros
ponemos el camino, no la caja.

### Lo que ya funciona: Bizum y transferencia

El hermano ve el Bizum y el IBAN de la hermandad con el concepto ya escrito
(`Recibo 1045 - Nombre`), paga desde su banco y avisa. A la tesorería le salta
en el Inicio y en Cuotas, comprueba el ingreso y lo confirma en un clic.

Esto no es un apaño provisional: **con Bizum no hay forma de que la aplicación
se entere sola** de que el dinero entró, porque el banco no se lo cuenta a
nadie. O pasarela, o alguien mira el extracto. Ventaja: cero comisión, y lo
tiene todo el mundo.

### Cuando contraten pasarela

Con Stripe (o con la pasarela de su banco) el pago se marca solo, con
justificante, y Stripe **también admite Bizum** en España: o sea, Bizum
automático. A cambio hay comisión por cobro (en torno al 1,5 % + 0,25 € en
tarjeta europea).

Para enchufarlo:

1. La hermandad se da de alta en Stripe con su CIF y su cuenta.
2. Se pega el enlace de pago en **Web pública → Donativos → Cobrar con tarjeta
   desde la web**. El botón de la web lleva a él.
3. Para marcar la cuota o la papeleta como pagada **automáticamente** hace
   falta un paso más, y es el importante: **la marca la pone el servidor, no el
   navegador**. Si el navegador dice «ya he pagado» y la aplicación se lo cree,
   cualquiera se hace una papeleta gratis. Stripe avisa al servidor por
   *webhook*, el servidor comprueba la firma de ese aviso y **entonces** marca.
   Eso va en una Edge Function.

---

## 4. El dominio propio

**Lo que hace la hermandad, fuera de Cabildo:**

1. **Comprar el dominio** en un registrador (IONOS, GoDaddy, Namecheap,
   Dinahosting…). Unos 10–15 € al año para un `.es` o un `.org`.
2. En el panel de despliegue (**Vercel → Settings → Domains**) añadir el
   dominio. Vercel dirá qué registro DNS poner: normalmente un **A** para el
   dominio pelado y un **CNAME** para el `www`.
3. Poner ese registro en el panel del registrador.
4. En unos minutos —a veces unas horas, por cómo se propaga el DNS— el dominio
   sirve la web, **con certificado HTTPS que Vercel emite solo**.

**Ojo con el `www`.** Media España lo escribe. Hay que añadir los dos
(`hermandaddetriana.es` y `www.hermandaddetriana.es`) y decirle a Vercel que
uno redirija al otro; si no, quien escriba el `www` no llegará.

**Lo que hace Cabildo:** guardar el dominio y usarlo en el enlace que se
comparte, en el `sitemap.xml` y en el `robots.txt`. Además valida la forma de lo
que se escribe (quita el `https://`, el `www.` y la ruta si pegan la barra de
direcciones entera; avisa de acentos y eñes, que es el error típico) y tiene un
botón **«Comprobar si ya apunta aquí»** que lo consulta de verdad, en vez de
fiarse de que lo escribieron bien.
