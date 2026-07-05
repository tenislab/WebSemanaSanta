# Cabildo

**El software para gestionar hermandades y cofradías.** Hermanos, cuotas,
papeletas de sitio, cortejo, tesorería y comunicaciones en una única
plataforma, pensada para cualquier corporación del tamaño que sea.

> Estado actual: **maqueta funcional de la parte pública + acceso**. La web
> pública (landing) y la autenticación (iniciar sesión / crear hermandad)
> están operativas y preparadas para conectarse con Supabase. El área privada
> de gestión se construirá sobre esta base.

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
```

## Conectar Supabase

La autenticación ya está cableada; solo faltan las claves.

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

## Estructura

```
src/
  components/
    AuthForm.tsx       formulario de acceso/registro (validación, estados)
    AuthLayout.tsx     pantalla partida premium para /login y /registro
    Logo.tsx           marca de Cabildo (hornacina con punto de luz)
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

El nombre "Cabildo" y la marca viven en `src/components/Logo.tsx` (y en los
textos). Es un cambio de un solo sitio si en algún momento se decide otra marca.
