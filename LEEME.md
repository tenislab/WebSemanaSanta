# Modo local (sin base de datos) — alta y acceso de usuarios

Estos archivos hacen que la aplicación funcione **al 100 % sin base de datos**:
se pueden crear personal y hermanos, y esas cuentas pueden iniciar sesión, todo
en el navegador (localStorage). Pensado para trabajar mientras Supabase esté en
pausa o sin conectar.

## Cómo se activa el modo local

Es automático: si **no** hay variables de entorno de Supabase, la app entra en
modo local.

- En **Vercel**: NO definas `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY` (o
  bórralas) y vuelve a desplegar.
- En **local**: si tienes un `.env` con esas claves, usará Supabase. Bórralo o
  renómbralo para probar el modo local.

## Acceso de un clic (login relleno)

En `/login`, en modo local, el formulario **ya viene relleno con el titular** y
debajo aparecen botones de acceso rápido, uno por cargo. Cada botón muestra su
correo y contraseña y, al pulsarlo, rellena el formulario y entra directamente.
No hay que teclear ni recordar nada.

## 7 usuarios de prueba (uno por cargo)

Todos en la «Hermandad de prueba». Entra por `/login`:

| Cargo                          | Correo                       | Contraseña   |
|--------------------------------|------------------------------|--------------|
| Hermano Mayor (titular)        | demo@cabildo.app             | demo1234     |
| Secretario/a                   | secretaria@tuhermandad.org   | secre123     |
| Tesorero/a                     | tesorero@tuhermandad.org     | tesoro123    |
| Fiscal                         | fiscal@tuhermandad.org       | fiscal123    |
| Mayordomo/Prioste              | mayordomo@tuhermandad.org    | mayordo123   |
| Diputado/a Mayor de Gobierno   | diputado@tuhermandad.org     | diputa123    |
| Vocal                          | vocal@tuhermandad.org        | vocal123     |

Cada cargo ve solo los módulos permitidos (Personal → Permisos por cargo). El
titular tiene acceso completo.

## Alta de usuarios desde la hermandad

- **Personal** (`/app/personal` → «Nuevo acceso»): correo + contraseña, y ya
  puede iniciar sesión en modo local.
- **Hermanos** (`/app/hermanos` → «Nuevo hermano»): su **usuario es su DNI** y
  la **contraseña provisional también es su DNI**. Entra por `/hermano` con
  DNI + DNI y puede cambiarla desde su área.

## Cómo aplicar esta entrega

Descomprime en la raíz del repositorio respetando las rutas (`src/...`),
sobrescribiendo los archivos existentes. Después:

    npm install       # si hiciera falta
    npm run build     # comprueba que compila

y sube los cambios a tu rama.

> `.env` NO se incluye ni debe subirse (está en `.gitignore`).
