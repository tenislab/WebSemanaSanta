# Cuando tengas dominio y correo de empresa

Todo lo que hay que cambiar, y solo eso. **No hay que tocar código**: la
aplicación usa siempre la dirección desde la que se abre, así que no lleva
ningún dominio escrito dentro. Es todo configuración.

Supongamos que el dominio es `gobergo.es`. Cambia el nombre por el tuyo.

---

## Antes de nada: quién manda cada correo

Con dominio propio hay **dos remitentes** y conviene no mezclarlos:

| Tipo de correo | Quién lo manda | Ejemplo |
|---|---|---|
| Personas escribiendo a personas | **Google Workspace** | `jaime@gobergo.es` |
| Los que manda la máquina | **Resend** | `no-responder@gobergo.es` |

**No mandes los automáticos desde Workspace.** Google corta a las ~2.000 al día
y, sobre todo, si un envío masivo cae en spam se arrastra la reputación de tu
correo personal: dejarían de llegar también los que escribes tú a mano. Se
separan a propósito.

---

## 1 · El dominio

Cómpralo donde prefieras (DonDominio, Namecheap, Cloudflare...). Un `.es`
ronda los 12 € al año.

Apúntate dónde está el **panel de DNS**, que es donde se hace casi todo lo de
abajo.

---

## 2 · Los DNS (aquí está la única trampa)

Hay que meter registros de tres sitios distintos en el mismo panel.

### Para que la web abra en tu dominio (Vercel)

Vercel te los dará al añadir el dominio (paso 3). Suele ser:

```
A      @      76.76.21.21
CNAME  www    cname.vercel-dns.com
```

### Para el correo de empresa (Google Workspace)

Los da Google al configurar Workspace. Son los `MX`:

```
MX  @  1   ASPMX.L.GOOGLE.COM
MX  @  5   ALT1.ASPMX.L.GOOGLE.COM
MX  @  5   ALT2.ASPMX.L.GOOGLE.COM
MX  @  10  ALT3.ASPMX.L.GOOGLE.COM
MX  @  10  ALT4.ASPMX.L.GOOGLE.COM
```

### Para los correos automáticos (Resend)

Resend te los da en *Domains → Add Domain*. Son un `DKIM` y un `MX` de
seguimiento, cada uno en su subdominio propio.

### ⚠️ LA TRAMPA: solo puede haber UN registro SPF

Google te pedirá uno y Resend te pedirá otro. **Si pones los dos, ninguno
funciona** y los correos empiezan a rebotar sin explicación. Es el fallo más
común y el más difícil de encontrar, porque todo *parece* bien configurado.

Se juntan en una sola línea:

```
TXT  @  v=spf1 include:_spf.google.com include:amazonses.com ~all
```

Una sola línea, un solo `v=spf1`, un solo `~all`. Los `include` se encadenan.

### Y el DMARC, que conviene

```
TXT  _dmarc  v=DMARC1; p=none; rua=mailto:jaime@gobergo.es
```

`p=none` es «solo avísame, no rechaces nada». Se empieza así y se endurece
más adelante, cuando lleves semanas viendo que todo llega bien.

---

## 3 · Vercel

**Settings → Domains → Add** → `gobergo.es`

Te dice qué registros DNS poner (los `A`/`CNAME` de arriba). Cuando los
detecte, el certificado HTTPS se genera solo.

Añade también `www.gobergo.es` redirigiendo al principal, que la gente lo
escribe.

### Y dos variables más

**Settings → Environment Variables:**

```
VITE_DOMINIO_APP=gobergo.es
```

Esta es **opcional** y solo sirve para ir más rápido. Al entrar por la puerta
principal la aplicación tiene que decidir qué enseñar: la página de venta de
Gobergo, o la web de la hermandad que tenga puesto ese dominio. Diciéndole cuál
es el tuyo, se salta la consulta. Sin ponerla funciona igual, solo que
preguntando a la base de datos en cada visita a la portada.

El modo local de reserva ya viene **apagado de fábrica**: si Supabase deja de
responder, la aplicación enseña su error en vez de seguir con los datos del
navegador. No hay que poner nada. (Antes había que acordarse de
`VITE_SIN_MODO_LOCAL=1`; ahora es al revés, y `VITE_MODO_LOCAL=1` solo se usa
para desarrollar sin base de datos.)

> Después de añadirla, **Redeploy**. Vercel no aplica las variables a lo que ya
> está construido.

---

## 4 · Supabase · las direcciones

**Authentication → URL Configuration**

| Campo | Valor |
|---|---|
| Site URL | `https://gobergo.es` |

**Redirect URLs** — se añaden, no se sustituyen:

```
https://gobergo.es/login
https://gobergo.es/hermano
https://www.gobergo.es/login
https://www.gobergo.es/hermano
http://localhost:5173/login
http://localhost:5173/hermano
```

Las de `localhost` se dejan para poder seguir probando en tu ordenador. Las de
`vercel.app` puedes dejarlas también: no molestan y te sirven de reserva.

> Si esto no se cambia, los enlaces de «confirma tu correo» seguirán llevando
> al dominio viejo. El correo llega igual, y por eso cuesta darse cuenta: lo
> que falla es al pulsar.

---

## 5 · Supabase · el correo de las cuentas

**Authentication → Emails → SMTP Settings**

Se pasa de Gmail a Resend. Adiós a la carpeta de spam.

| Campo | Antes (Gmail) | Ahora (Resend) |
|---|---|---|
| Host | `smtp.gmail.com` | `smtp.resend.com` |
| Port | `465` | `465` |
| Username | tu Gmail | `resend` |
| Password | 16 letras de Google | tu clave `re_...` |
| Sender email | tu Gmail | `no-responder@gobergo.es` |
| Sender name | `Gobergo` | `Gobergo` |

**Los seis campos, todos de Resend.** Mezclar el host de uno con el remitente
del otro es lo que hace que los correos lleguen solo a tu propia dirección.

Y ya puedes activar **Confirm email** en *Sign In / Providers → Email* sin que
eso impida a nadie registrarse.

---

## 6 · Los comunicados a los hermanos

Esto va por su propia función y **no usa el SMTP de arriba**. Es lo único que
hoy no puede funcionar sin dominio.

> Solo la dirección, sin nombre delante. El nombre que ve el hermano lo pone
> cada hermandad: le llega «Hdad. de la Amargura <no-responder@gobergo.es>»,
> con el nombre sacado de su ficha. Así una sola dirección verificada sirve
> para todas, y cada una firma con lo suyo.

**Supabase → Edge Functions → Secrets:**

| Name | Value |
|---|---|
| `RESEND_API_KEY` | tu clave `re_...` |
| `CORREO_REMITENTE` | `no-responder@gobergo.es` |

**Supabase → Edge Functions → Deploy** una función llamada `enviar-correo` con
el contenido de `supabase/functions/enviar-correo/index.ts`.

O desde tu ordenador, si tienes la herramienta de Supabase instalada:

```
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set CORREO_REMITENTE=no-responder@gobergo.es
supabase functions deploy enviar-correo
```

Después: Gobergo → **Configuración → Correo** → activar → **Enviar correo de
prueba**. Si falla, ahí sale el motivo de verdad.

---

## 7 · Los textos legales

Quedan **seis huecos** por rellenar con tus datos, que eres el encargado del
tratamiento:

```
[RAZÓN SOCIAL]                            [NIF O CIF]
[DIRECCIÓN]                               [DIRECCIÓN COMPLETA]
[CORREO DE CONTACTO]                      [RAZÓN SOCIAL O NOMBRE DEL RESPONSABLE]
```

La aplicación te los marca en rojo: **Configuración → Puesta en marcha**.

El correo de contacto pásalo al del dominio (`hola@gobergo.es`), que es lo que
va a ver la gente en el aviso legal.

> Esto no es opcional. El censo de una hermandad revela convicciones religiosas
> y es **categoría especial** del RGPD, el nivel más alto de protección.

---

## 8 · El dominio de UNA HERMANDAD (esto es otra cosa)

Lo de arriba es tu dominio, el de Gobergo. Una hermandad puede además comprar
**el suyo** y que su web se vea ahí. Son dos cosas distintas y conviene no
confundirlas:

| Dirección | Qué se ve |
|---|---|
| `gobergo.es` | la página de venta de Gobergo |
| `gobergo.es/w/hdad-de-triana` | la web de esa hermandad, dentro de Gobergo |
| `hermandaddetriana.es` | **la misma web**, en su propio dominio |

### Qué hace la hermandad

Nada técnico: en **Web → Ajustes → Dominio propio** escribe el dominio que ha
comprado. Hay un botón de comprobación que le dice si ya apunta aquí.

### Qué haces tú (una vez por hermandad)

1. **Vercel → Settings → Domains → Add** → `hermandaddetriana.es`
2. Le pasas a la hermandad los dos registros que da Vercel, para que los meta
   en el panel de donde compró el dominio:
   ```
   A      @      76.76.21.21
   CNAME  www    cname.vercel-dns.com
   ```
3. Ya está. No hay que dar de alta nada más, ni tocar código, ni desplegar: la
   aplicación mira qué hermandad tiene puesto ese dominio y sirve su web.

El certificado HTTPS lo genera Vercel solo, en cuanto detecta los registros.

### Lo que cambia para ellos en cuanto apunta

- Su web abre en la raíz: `hermandaddetriana.es`
- Y sus páginas cuelgan de ahí: `hermandaddetriana.es/n/cartel-2027`,
  `/t/cristo-de-la-salud`, `/noticias`
- Al pegar el enlace en el grupo de WhatsApp sale **su** nombre y **su** foto,
  no los de Gobergo
- El `sitemap.xml` y el `robots.txt` pasan a ser los suyos

### Lo que NO cambia

El correo. Los avisos a sus hermanos se siguen mandando desde tu dirección
(`no-responder@gobergo.es`) firmando con el nombre de la hermandad. Que ellos
manden desde `hola@hermandaddetriana.es` es otra cosa distinta y hoy no está
hecha: haría falta verificar el dominio de cada hermandad en Resend.

---

## 9 · La comprobación final

Una por una, y en este orden:

- [ ] `https://gobergo.es` abre y el candado del navegador sale cerrado
- [ ] `https://www.gobergo.es` redirige al anterior
- [ ] Te llega un correo a `jaime@gobergo.es` desde fuera (Workspace)
- [ ] Registras una cuenta con un correo que **no** es el tuyo y llega la
      confirmación
- [ ] Ese correo llega **a la bandeja de entrada**, no a spam
- [ ] El enlace del correo abre en `gobergo.es`, no en `vercel.app`
- [ ] Configuración → Correo → «Enviar correo de prueba» funciona
- [ ] Mandas un comunicado de prueba a dos hermanos y les llega
- [ ] Configuración → Puesta en marcha: sin nada en rojo
- [ ] `npm run prelanzamiento` pasa las 23 comprobaciones

Y si además has apuntado el dominio de alguna hermandad:

- [ ] `https://sudominio.es` abre **su** web, no la página de venta
- [ ] `https://sudominio.es/noticias` abre el listado de noticias
- [ ] Una noticia suya abre en `https://sudominio.es/n/<lo-que-sea>`
- [ ] Pegas ese enlace en WhatsApp y la vista previa dice el nombre de la
      hermandad, no «Gobergo»
- [ ] `https://sudominio.es/robots.txt` nombra su `sitemap.xml`

Si algo del correo falla, el motivo real está siempre en el mismo sitio:
**Supabase → Logs → Auth**.

---

## Lo que NO hay que tocar

- **El código.** No lleva ningún dominio dentro.
- **El SQL.** Ya está todo ejecutado.
- **Las claves de Supabase** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  El proyecto es el mismo; solo cambia la dirección desde la que se abre.
