# 🔧 Conectar Gobergo — todo en uno

Guía para hacerlo de un tirón. Marca las casillas según vayas.

```
1. SUPABASE   gratis    30 min   ← imprescindible
2. RESEND     gratis    15 min   ← el correo
3. VERCEL     gratis    20 min   ← ponerlo online
4. DOMINIO    12 €/año  1 día    ← cuando sea real
5. STRIPE     comisión  30 min   ← solo si cobras con tarjeta
```

Con **1 y 2** ya puedes probarlo todo, gratis, en tu ordenador.

---

# 1️⃣ SUPABASE — la base de datos

Sin esto, todo lo que guardas vive solo en tu navegador: no lo ve nadie más de
la junta, y si borras los datos de navegación, se pierde.

## 1.1 Crear el proyecto

- [ ] Entra en **supabase.com** → *Start your project*
- [ ] Entra con GitHub
- [ ] *New project*

| Campo | Valor |
|---|---|
| Name | `cabildo` |
| Database Password | genérala y **guárdala donde no se pierda** |
| **Region** | **Frankfurt (eu-central-1)** o **Ireland (eu-west-1)** |

> ⚠️ **La región NO se puede cambiar después.** Tiene que ser Europa: el censo
> de una hermandad revela convicciones religiosas (dato de categoría especial
> del RGPD) y sacarlo de la UE te obliga a papeleo legal extra.

Tarda unos 2 minutos en crearse.

## 1.2 Crear las tablas

Menú izquierdo → **SQL Editor** → *New query*.

Abre cada archivo de la carpeta `supabase/` del proyecto, **copia todo su
contenido**, pégalo en el editor y dale a **Run**. Uno por uno y en este orden:

- [ ] `1  schema.sql`
- [ ] `2  rls-cargos.sql`
- [ ] `3  rls-endurecer.sql`  ⚠️
- [ ] `4  hermano-auth.sql`
- [ ] `5  web-publica.sql`
- [ ] `6  mensajes-web.sql`
- [ ] `7  storage-archivo.sql`

> ⚠️ **El 3 es crítico y no se puede dejar para luego.** Sin él, cualquiera que
> se registre en `/registro` obtiene permiso de escritura sobre TODA tu base de
> datos. Léelo antes de ejecutarlo: al final explica cómo darte de alta a ti
> como titular.

## 1.3 Copiar las claves

⚙️ **Project Settings → API**

- [ ] Copia **Project URL** → `https://xxxxx.supabase.co`
- [ ] Copia **anon public** → `eyJhbGci...`

> 🚫 **La `service_role` no se usa NUNCA en esta aplicación.** Da acceso total
> saltándose todos los permisos. Si aparece en el navegador, es un agujero.

## 1.4 Pegarlas en el proyecto

- [ ] Crea un archivo llamado `.env` en la raíz del proyecto:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

- [ ] Reinicia:

```
npm run dev
```

## ✅ Cómo saber que ha funcionado

- [ ] Entra en la app → **Configuración → Puesta en marcha**
- [ ] El aviso **«Los datos solo están en este navegador»** tiene que haber
      **desaparecido**

Si sigue ahí: o el `.env` está mal escrito, o no reiniciaste.

---

# 2️⃣ RESEND — el correo

Hasta aquí los avisos llegan al buzón que cada hermano tiene en su área. Si no
entra, no se entera. Con esto, además le llega a su bandeja.

## 2.1 Crear la cuenta

- [ ] Entra en **resend.com** y regístrate
- [ ] **API Keys** → *Create API Key*
- [ ] Copia la clave (`re_...`)

Plan gratuito: **3.000 correos al mes, 100 al día**. De sobra para una
hermandad.

## 2.2 Desplegar la función de envío

Desde el ordenador, en la carpeta del proyecto:

```
npm i -g supabase
supabase login
supabase link --project-ref TU-REF
supabase secrets set RESEND_API_KEY=re_xxx
supabase functions deploy enviar-correo
```

> `TU-REF` es el código que sale en la URL de tu proyecto:
> `https://XXXXX.supabase.co` → tu ref es `XXXXX`

> 🔒 **Por qué la clave va aquí y no en el navegador:** permite mandar correo
> EN NOMBRE DE LA HERMANDAD. En el código del navegador cualquiera la sacaría
> en diez segundos y podría suplantarla ante sus mil hermanos.

## 2.3 Encenderlo

- [ ] En Gobergo → **Configuración → Correo**
- [ ] Marca *Mandar los avisos también por correo*
- [ ] Escribe tu dirección y dale a **«Enviar prueba»**

## ✅ Cómo saber que ha funcionado

- [ ] Te llega el correo de prueba
- [ ] **Mira también la carpeta de spam.** Si ha caído ahí, falta el paso 4.

> 📌 **Sin dominio propio, Resend solo puede escribirte A TI** (a la dirección
> con la que te registraste), usando `onboarding@resend.dev` como remitente.
> Es justo lo que hace falta para comprobar que el circuito funciona. Para
> escribir a los hermanos, sigue al paso 4.

---

# 3️⃣ VERCEL — ponerlo online

Solo hace falta cuando quieras que lo vea alguien que no seas tú.

## 3.1 Desplegar

- [ ] Entra en **vercel.com** con GitHub
- [ ] *Add New → Project* → importa el repositorio
- [ ] *Deploy* (Vercel detecta la configuración solo, no toques nada)

## 3.2 Las variables de entorno

Settings → **Environment Variables**. Son **CUATRO**, no dos:

| Nombre | Valor |
|---|---|
| `VITE_SUPABASE_URL` | la Project URL |
| `VITE_SUPABASE_ANON_KEY` | la clave anon |
| `SUPABASE_URL` | **la misma URL** |
| `SUPABASE_ANON_KEY` | **la misma clave** |

> ⚠️ Las dos de abajo (sin `VITE_`) son para las funciones del servidor. Las
> `VITE_*` se incrustan en el navegador al compilar y las funciones no pueden
> leerlas. Sin ellas: al pegar el enlace en WhatsApp la vista previa sale
> genérica y el sitemap vuelve vacío.

- [ ] **Redesplegar** después de añadirlas: Deployments → ⋯ → *Redeploy*

## ✅ Comprobar a mano

- [ ] Carga la portada
- [ ] Recarga estando en `/app/hermanos` → **no** debe dar 404
- [ ] `/robots.txt` responde y nombra el sitemap
- [ ] `/sitemap.xml` responde
- [ ] Registras una cuenta en `/registro` y sale el asistente de alta

---

# 4️⃣ DOMINIO — para escribir de verdad a los hermanos

## 4.1 Comprarlo

- [ ] IONOS, Namecheap, Dinahosting, GoDaddy… unos **12 € al año** un `.es`

## 4.2 Apuntarlo a la web

- [ ] En Vercel → Settings → **Domains** → añade **los dos**:

```
hermandaddetriana.es
www.hermandaddetriana.es     ← media España escribe el www
```

- [ ] Vercel te dice qué registro DNS poner (un **A** y un **CNAME**)
- [ ] Lo pones en el panel de donde compraste el dominio
- [ ] El certificado HTTPS lo emite Vercel solo

## 4.3 Verificarlo para el correo

- [ ] En Resend → **Domains** → *Add Domain*
- [ ] Te da tres registros que hay que añadir en el mismo panel del registrador:

| Registro | Para qué |
|---|---|
| **SPF** | Dice qué servidores pueden enviar en nombre del dominio |
| **DKIM** | Firma cada correo para que se compruebe que no está falsificado |
| **DMARC** | Dice qué hacer con los que no pasen las dos anteriores |

> ⚠️ **Esto no es opcional.** Sin verificar, los correos van a spam o se
> rechazan. Una convocatoria de cabildo en spam es peor que no mandarla.

## 4.4 Cambiar el remitente

```
supabase secrets set CORREO_REMITENTE="Hdad. de X <avisos@tudominio.es>"
supabase functions deploy enviar-correo
```

## 4.5 Decírselo a Gobergo

- [ ] Web pública → Estilo y secciones → *Usar un dominio propio*
- [ ] Escribe el dominio
- [ ] Dale a **«Comprobar si ya apunta aquí»**

---

# 5️⃣ STRIPE — solo si quieres cobrar con tarjeta

**No hace falta para empezar.** Sin esto ya funciona el Bizum: el hermano ve el
Bizum y el IBAN con el concepto escrito, avisa de que ha pagado, y a la
tesorería le salta para confirmarlo en un clic.

Con Stripe, el pago **se marca solo**, con justificante. Y Stripe también
admite Bizum, o sea Bizum automático.

- [ ] stripe.com → alta **con el CIF de la hermandad**
- [ ] Payment Links → crear un enlace de pago
- [ ] Gobergo → Web pública → Donativos → *Cobrar con tarjeta* → pegar el enlace

> 💰 Comisión de en torno al **1,5 % + 0,25 €** por cobro con tarjeta europea.
>
> 🏦 **El dinero va siempre a la cuenta de la hermandad, nunca a la tuya.** Por
> eso el alta la hace ella, con su CIF.

---

# ⚠️ LO LEGAL — antes de meter un solo hermano

- [ ] Rellenar `[NOMBRE]`, `[NIF]`, `[CORREO DE CONTACTO]` en `src/data/legal.ts`
- [ ] **Firmar el contrato de encargo del tratamiento** con cada hermandad
      (plantilla en `docs/CONTRATO-ENCARGO.md`)
- [ ] Que un abogado de protección de datos revise el aviso legal, la política
      de privacidad, las condiciones y ese contrato

> El contrato es **obligatorio y por escrito** (art. 28 del RGPD). Sin él, la
> hermandad incumple desde el primer hermano que mete, y quien responde ante la
> Agencia de Protección de Datos es ella.
>
> Y ten presente que **el censo de una hermandad es dato de categoría especial**
> (art. 9 RGPD): revela convicciones religiosas. No es un censo de socios de un
> club, y las garantías exigidas son mayores.

---

# 🆘 Si algo falla

| Lo que ves | Lo que suele ser |
|---|---|
| 404 al recargar en `/app/algo` | Falta el `vercel.json` o no se aplicó |
| «Los datos solo están en este navegador» | `.env` mal escrito, o no reiniciaste |
| Vista previa genérica al compartir en WhatsApp | Faltan `SUPABASE_URL` y `SUPABASE_ANON_KEY` (sin el `VITE_`) |
| El correo de prueba no llega | Mira spam. Sin dominio, Resend solo te escribe a ti |
| «El proveedor ha rechazado el envío» | Casi siempre: dominio sin verificar |
| Un cargo ve módulos que no le tocan | No ejecutaste `rls-endurecer.sql` |
| Un hermano importado no puede entrar | Normal: se le da acceso desde su ficha |
| «No se pudo guardar» al subir fotos | Se llenó el navegador. Con Supabase conectado no pasa |

**Marcha atrás en Vercel:** Deployments → el despliegue anterior → *Promote to
Production*. Vuelve en segundos y **los datos no se tocan**.

---

# 📋 Antes de desplegar, siempre

```
npm run typecheck && npm run lint && npm test && npm run build
npm run prelanzamiento
```

Lo último comprueba 23 cosas que solo se notan el día del despliegue: claves
expuestas, rutas que darían 404, el orden de los SQL y los documentos legales
obligatorios.

---

# 🗺️ El orden que yo seguiría

1. **Supabase** (paso 1)
2. **Una hermandad de mentira**: regístrate y deja que el asistente te pida los
   datos
3. **Importa un CSV** con veinte hermanos inventados
4. **Resend** con el remitente de prueba (paso 2)
5. **Mándate un comunicado a ti mismo**

En una tarde tienes el circuito completo funcionando y sabes qué falla.
