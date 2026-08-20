# Cuando tengas dominio y correo de empresa

Todo lo que hay que cambiar, y solo eso. **No hay que tocar código**: la
aplicación usa siempre la dirección desde la que se abre, así que no lleva
ningún dominio escrito dentro. Es todo configuración.

Supongamos que el dominio es `cabildo.es`. Cambia el nombre por el tuyo.

---

## Antes de nada: quién manda cada correo

Con dominio propio hay **dos remitentes** y conviene no mezclarlos:

| Tipo de correo | Quién lo manda | Ejemplo |
|---|---|---|
| Personas escribiendo a personas | **Google Workspace** | `jaime@cabildo.es` |
| Los que manda la máquina | **Resend** | `no-responder@cabildo.es` |

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
TXT  _dmarc  v=DMARC1; p=none; rua=mailto:jaime@cabildo.es
```

`p=none` es «solo avísame, no rechaces nada». Se empieza así y se endurece
más adelante, cuando lleves semanas viendo que todo llega bien.

---

## 3 · Vercel

**Settings → Domains → Add** → `cabildo.es`

Te dice qué registros DNS poner (los `A`/`CNAME` de arriba). Cuando los
detecte, el certificado HTTPS se genera solo.

Añade también `www.cabildo.es` redirigiendo al principal, que la gente lo
escribe.

### Y una variable más, el día que abras al público

**Settings → Environment Variables:**

```
VITE_SIN_MODO_LOCAL=1
```

Sin ella, si Supabase deja de responder la aplicación sigue funcionando con
los datos del navegador. Eso está bien mientras se monta y es un problema con
hermandades de verdad: la secretaría trabajaría contra un censo que no es el
suyo. Con la variable puesta, se cae con su error y se vuelve en un rato.

> Después de añadirla, **Redeploy**. Vercel no aplica las variables a lo que ya
> está construido.

---

## 4 · Supabase · las direcciones

**Authentication → URL Configuration**

| Campo | Valor |
|---|---|
| Site URL | `https://cabildo.es` |

**Redirect URLs** — se añaden, no se sustituyen:

```
https://cabildo.es/login
https://cabildo.es/hermano
https://www.cabildo.es/login
https://www.cabildo.es/hermano
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
| Sender email | tu Gmail | `no-responder@cabildo.es` |
| Sender name | `Cabildo` | `Cabildo` |

**Los seis campos, todos de Resend.** Mezclar el host de uno con el remitente
del otro es lo que hace que los correos lleguen solo a tu propia dirección.

Y ya puedes activar **Confirm email** en *Sign In / Providers → Email* sin que
eso impida a nadie registrarse.

---

## 6 · Los comunicados a los hermanos

Esto va por su propia función y **no usa el SMTP de arriba**. Es lo único que
hoy no puede funcionar sin dominio.

**Supabase → Edge Functions → Secrets:**

| Name | Value |
|---|---|
| `RESEND_API_KEY` | tu clave `re_...` |
| `CORREO_REMITENTE` | `Cabildo <no-responder@cabildo.es>` |

**Supabase → Edge Functions → Deploy** una función llamada `enviar-correo` con
el contenido de `supabase/functions/enviar-correo/index.ts`.

O desde tu ordenador, si tienes la herramienta de Supabase instalada:

```
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set CORREO_REMITENTE="Cabildo <no-responder@cabildo.es>"
supabase functions deploy enviar-correo
```

Después: Cabildo → **Configuración → Correo** → activar → **Enviar correo de
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

El correo de contacto pásalo al del dominio (`hola@cabildo.es`), que es lo que
va a ver la gente en el aviso legal.

> Esto no es opcional. El censo de una hermandad revela convicciones religiosas
> y es **categoría especial** del RGPD, el nivel más alto de protección.

---

## 8 · La comprobación final

Una por una, y en este orden:

- [ ] `https://cabildo.es` abre y el candado del navegador sale cerrado
- [ ] `https://www.cabildo.es` redirige al anterior
- [ ] Te llega un correo a `jaime@cabildo.es` desde fuera (Workspace)
- [ ] Registras una cuenta con un correo que **no** es el tuyo y llega la
      confirmación
- [ ] Ese correo llega **a la bandeja de entrada**, no a spam
- [ ] El enlace del correo abre en `cabildo.es`, no en `vercel.app`
- [ ] Configuración → Correo → «Enviar correo de prueba» funciona
- [ ] Mandas un comunicado de prueba a dos hermanos y les llega
- [ ] Configuración → Puesta en marcha: sin nada en rojo
- [ ] `npm run prelanzamiento` pasa las 23 comprobaciones

Si algo del correo falla, el motivo real está siempre en el mismo sitio:
**Supabase → Logs → Auth**.

---

## Lo que NO hay que tocar

- **El código.** No lleva ningún dominio dentro.
- **El SQL.** Ya está todo ejecutado.
- **Las claves de Supabase** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  El proyecto es el mismo; solo cambia la dirección desde la que se abre.
