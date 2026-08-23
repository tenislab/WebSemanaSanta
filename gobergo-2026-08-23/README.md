# Gobergo

**El software para gestionar hermandades y cofradías.** Hermanos, cuotas,
papeletas de sitio, cortejo, tesorería y comunicaciones en una única
plataforma, pensada para cualquier corporación del tamaño que sea.

> Estado actual: **aplicación completa en modo local**. Los quince módulos del
> panel, el área del hermano y la web pública funcionan de principio a fin con
> datos de ejemplo guardados en el navegador. Lo que falta (correos reales,
> cobros, multidispositivo) necesita conectar la base de datos.
>
> 📋 **[Hoja de ruta](docs/HOJA-DE-RUTA.md)** — qué está hecho y qué falta.
> 🛠️ **[Cómo trabajar](docs/COMO-TRABAJAR.md)** — normas de trabajo y trampas del repo.

## Tecnología

- **Vite** + **React 18** + **TypeScript**
- **React Router** para el enrutado (`/`, `/login`, `/registro`, `/app`)
- **Supabase** (`@supabase/supabase-js`) para autenticación
- CSS propio con sistema de tokens y **modo claro/oscuro**

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellena tus claves de Supabase
npm run dev
```

La app queda en `http://localhost:5173`.

Otros comandos:

```bash
npm run build      # compila para producción (carpeta dist/)
npm run preview    # sirve la build de producción
npm run typecheck  # comprueba tipos con TypeScript
npm run lint       # revisión con ESLint (debe salir sin avisos)
npm run lint:fix   # arregla lo que se pueda solo
```

Antes de dar por buena cualquier tarea: `typecheck`, `lint` y `build`, los tres.

## Conectar Supabase

La app entera está cableada; solo faltan las claves. Para crear las tablas:
`supabase/rls-endurecer.sql` **es obligatorio**: sin él, cualquiera que se
registre en `/registro` obtiene acceso de escritura a toda la base de datos.
Léelo antes de ejecutarlo: al final explica que hay que dar de alta al titular
a mano.

`supabase/schema.sql` (base nueva) o `supabase/migracion-2026-08.sql` (base ya
creada con una versión anterior). Después, `supabase/web-publica.sql` y
`supabase/mensajes-web.sql`: la web pública y el buzón donde caen los
formularios de la web (contacto, donativos y lotería).

**¿Vas a lanzarla?** El paso a paso está en
[`docs/LANZAMIENTO.md`](docs/LANZAMIENTO.md), y antes de desplegar:

```
npm run prelanzamiento
```

Comprueba las 23 cosas que solo se notan el día del despliegue (claves
expuestas, rutas, orden de los SQL, documentos legales obligatorios).

**¿Está para salir al público?** La respuesta honrada, con lo que falta y lo
que no, en [`docs/ESTA-PARA-SALIR.md`](docs/ESTA-PARA-SALIR.md).

**Todo lo que hay que conectar —base de datos, correo, cobros y dominio— está
explicado paso a paso en [`docs/CONECTAR.md`](docs/CONECTAR.md)**, y dentro de
la aplicación en Configuración → Puesta en marcha.

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **Project Settings → API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
3. Pégalas en tu archivo `.env` (usa `.env.example` como plantilla).
4. Reinicia `npm run dev`.

> Mientras no haya claves, la interfaz funciona en **modo demostración**: se ve
> y navega igual, pero el acceso muestra un aviso en lugar de autenticar.

### Qué hace ya la autenticación

- **Iniciar sesión** → `supabase.auth.signInWithPassword`
- **Crear hermandad** (registro) → `supabase.auth.signUp`, guardando el nombre
  de la hermandad en los metadatos del usuario
- Sesión persistente y protección de la ruta `/app` (redirige a `/login` si no
  hay sesión)
- Mensajes de error de Supabase traducidos al español

En el panel de Supabase puedes activar/desactivar la **confirmación por email**
en *Authentication → Providers → Email*. La interfaz contempla ambos casos.

## Desplegar en Vercel

El proyecto **no es un sitio estático**: tiene funciones de servidor (`api/w.ts`
sirve las webs públicas de las hermandades, `api/seo.ts` el sitemap y el
robots), y en `vercel.json` hasta la portada `/` está redirigida a una de
ellas. Subir solo la carpeta `dist/` deja la web sin portada.

### El repositorio tiene que ser público

En el plan **Hobby**, Vercel bloquea los despliegues de un repositorio
**privado** cuando el commit lo firma alguien que no es el dueño de la cuenta
—lo llama «colaboración», y es de pago—. Aquí se cumple: el repositorio es de
`tenislab` y los commits los firma `JRRjaime`, que son dos cuentas distintas.

Mientras el repositorio es **público** esa regla no se aplica y despliega solo
con cada push. En cuanto se pone en privado, se bloquean todos los despliegues
con el mensaje:

> The deployment was blocked because the commit author did not have
> contributing access to the project on Vercel.

Y **no basta con volver a ponerlo público y darle a «Redeploy»**: los
despliegues ya bloqueados se quedan bloqueados. Hay que hacer un commit nuevo
para que Vercel lo evalúe otra vez.

Alternarlo público/privado para colar cada despliegue no vale: al pasar de
público a privado GitHub **no borra los forks**, los deja como repositorios
públicos independientes de quien los hizo. Basta un fork en esa ventana —hay
bots que clonan repositorios nuevos en segundos— para que el código quede
público para siempre.

### Si hace falta que siga privado

Desplegar a mano, que se salta la comprobación porque no pasa por Git:

```bash
npm i -g vercel
vercel login
vercel link      # elegir el proyecto
vercel --prod
```

Hay que repetirlo en cada actualización. La otra salida es el plan Pro, que
admite varios autores en repositorios privados.

### Las claves no están en el repositorio

`.env` está en `.gitignore` y nunca se ha subido. El build de Vercel necesita
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` puestas en *Settings →
Environment Variables* del proyecto. Si la web despliega pero sale sin datos,
es que faltan.

## Estructura

```
src/
  components/
    AuthForm.tsx       formulario de acceso/registro (validación, estados)
    AuthLayout.tsx     pantalla partida premium para /login y /registro
    Logo.tsx           marca de Gobergo (hornacina con punto de luz)
    ProtectedRoute.tsx protege rutas según la sesión
    ThemeToggle.tsx    conmutador de tema claro/oscuro
  context/
    AuthContext.tsx    estado de sesión + signIn / signUp / signOut
  lib/
    supabase.ts        cliente de Supabase (según variables de entorno)
  pages/
    Landing.tsx        web pública (portada del producto)
    Login.tsx          página de acceso
    Signup.tsx         página de alta de hermandad
    Dashboard.tsx      marcador del área privada (tras iniciar sesión)
  styles/
    global.css         tokens de color, tipografía y estilos
```

## Cambiar el nombre o el logo

El nombre "Gobergo" y la marca viven en `src/components/Logo.tsx` (y en los
textos). Es un cambio de un solo sitio si en algún momento se decide otra marca.
