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
**no sale ningún correo electrónico**.

1. **Contratar un proveedor de envío**: Resend, SendGrid o Amazon SES. Para el
   volumen de una hermandad, todos tienen plan gratuito o de unos euros al mes.
2. **Verificar el dominio de la hermandad** ante el proveedor. Le darán unos
   registros DNS —**SPF**, **DKIM** y **DMARC**— que hay que añadir en el panel
   del registrador donde compraron el dominio. **Esto no es opcional**: sin la
   verificación, los correos van a la carpeta de spam o se rechazan
   directamente.
3. **La clave del proveedor no puede vivir en el navegador.** Cualquiera la
   sacaría del código y mandaría correo en nombre de la hermandad. Va en una
   función de servidor (Edge Function de Supabase), y la aplicación le pide a
   esa función que envíe.

Se configura en el mismo sitio que el dominio, porque los registros van en el
mismo panel del registrador: tiene sentido hacer las dos cosas de una vez.

Mientras no esté, el buzón sigue funcionando y el aviso rojo lo dice.

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
