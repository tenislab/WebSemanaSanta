# Modo local + tolerancia a Supabase en pausa

Esta entrega hace que la aplicación **siempre se pueda usar**, con o sin base de
datos, esté Supabase encendido, en pausa o sin configurar.

## Lo importante (por qué antes «fallaba el modo demo»)

En el plan gratuito, **Supabase se PAUSA** tras unos días sin uso. Si tu web
tenía Supabase configurado y el proyecto estaba pausado, el login se caía y ni
siquiera aparecían los botones de demostración.

Ahora, al arrancar, la app **comprueba si Supabase responde**:

- **Responde** → funciona normal, con base de datos real.
- **No responde (pausado/caído) o no está configurado** → pasa a **modo local**
  automáticamente: muestra los accesos de demostración, deja iniciar sesión y
  usa los datos guardados en el navegador. Cuando Supabase vuelve, se recupera
  solo el modo normal.

Resultado: la web que tienes **siempre entra**, aunque Supabase esté dormido.

## Acceso de un clic (login relleno)

En `/login`, en modo local, el formulario **viene relleno con el titular** y
debajo hay un botón por cada cargo. Cada botón **muestra su correo y contraseña**
y, al pulsarlo, entra directamente. No hay que teclear ni recordar nada.

## 7 usuarios de prueba (uno por cargo)

Todos en la «Hermandad de prueba». Por `/login`:

| Cargo                          | Correo                       | Contraseña   |
|--------------------------------|------------------------------|--------------|
| Hermano Mayor (titular)        | demo@cabildo.app             | demo1234     |
| Secretario/a                   | secretaria@tuhermandad.org   | secre123     |
| Tesorero/a                     | tesorero@tuhermandad.org     | tesoro123    |
| Fiscal                         | fiscal@tuhermandad.org       | fiscal123    |
| Mayordomo/Prioste              | mayordomo@tuhermandad.org    | mayordo123   |
| Diputado/a Mayor de Gobierno   | diputado@tuhermandad.org     | diputa123    |
| Vocal                          | vocal@tuhermandad.org        | vocal123     |

## Alta de usuarios desde la hermandad

- **Personal** (`/app/personal` → «Nuevo acceso»): correo + contraseña; ya puede
  iniciar sesión.
- **Hermanos** (`/app/hermanos` → «Nuevo hermano»): su **usuario es su DNI** y la
  **contraseña provisional también es su DNI**. Entra por `/hermano` (elige la
  hermandad → DNI + DNI) y puede cambiarla desde su área.

## Verificado

Probado con navegador en modo local y en modo «Supabase pausado»:
- login de los 7 cargos ✔
- crear personal y entrar con él ✔
- crear hermano (usuario/clave = DNI) y entrar en su área ✔
- con Supabase inalcanzable, la app cae a modo local y entra igual ✔
- sin errores de JavaScript y `tsc` limpio ✔

## Cómo aplicar

Descomprime en la raíz del repositorio respetando las rutas (`src/...`),
sobrescribiendo. Después:

    npm install
    npm run build

y sube los cambios a tu rama.

> Nota: si quieres modo local puro (sin base de datos), en Vercel no definas
> `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY`. Con esta entrega ya no es
> imprescindible: aunque las dejes puestas, si Supabase está en pausa la app
> entra en modo local sola. `.env` no se incluye ni debe subirse.
