# Modo local + modelo de papeleta + acceso de hermano

Todo funciona con o sin base de datos, esté Supabase encendido, en pausa o sin
configurar. Novedades de esta entrega:

## 1. Entrar como hermano (antes solo se podía como hermandad)

El portal del hermano (`/hermano`) ahora también funciona en modo local aunque
Supabase esté configurado pero en pausa. Y trae **accesos rápidos de un clic**,
igual que el panel de la hermandad:

- En `/hermano`, en modo local, salen varios **hermanos de prueba**; pulsas uno
  y entras directo a su área (con sus cuotas y su papeleta).
- También puedes entrar escribiendo **DNI + contraseña**. En el censo de
  ejemplo, la contraseña de todos es `hermano123`. Ejemplos:
  - Ana Sánchez del Río — DNI `12345678A`
  - María Reyes Ortega — DNI `23456789B`
  - Juan Luis Cabrera — DNI `34567890C`
  - Francisco Gómez Nieto — DNI `45678901D`
- A los hermanos que des de alta tú, su usuario y contraseña provisional es su
  **DNI**.

> Nota: el acceso del panel (tesorero, secretaría, etc., en `/login`) y el
> acceso del hermano (`/hermano`) son dos entradas distintas. Si quieres que las
> mismas personas de cada cargo puedan entrar además como hermanos, dilo y lo
> enlazo.

## 2. Modelo de papeleta personalizado (NUEVO)

En **Panel → Papeletas → «Modelo de papeleta»**:

1. Sube la **imagen de tu modelo** de papeleta (una foto o un escaneo; da igual
   el diseño).
2. Pulsa **«+ Añadir dato»** y **arrastra** cada dato a su sitio sobre la
   imagen: nombre, nº de hermano, DNI, tramo/puesto, modalidad, importe, estado,
   nº de papeleta, fechas, nombre de la hermandad, o texto fijo (etiquetas).
3. Ajusta tamaño, color, alineación y negrita de cada dato.

A partir de ahí, la papeleta de **cada hermano** se imprime sobre ese modelo con
**sus datos reales** (botón «Imprimir / Descargar»), tanto en el panel como en el
área del hermano. Si borras el modelo, se vuelve a usar la papeleta estándar.

Todo se guarda en el navegador; no necesita base de datos.

## 3. Tolerancia a Supabase en pausa (de la entrega anterior)

Al arrancar, la app comprueba si Supabase responde. Si está en pausa/caído (o
sin configurar), pasa sola a **modo local**: accesos de demostración, login y
datos del navegador. Cuando Supabase vuelve, recupera el modo normal.

## 7 usuarios del panel (uno por cargo), por `/login`

| Cargo                        | Correo                     | Contraseña |
|------------------------------|----------------------------|------------|
| Hermano Mayor (titular)      | demo@cabildo.app           | demo1234   |
| Secretario/a                 | secretaria@tuhermandad.org | secre123   |
| Tesorero/a                   | tesorero@tuhermandad.org   | tesoro123  |
| Fiscal                       | fiscal@tuhermandad.org     | fiscal123  |
| Mayordomo/Prioste            | mayordomo@tuhermandad.org  | mayordo123 |
| Diputado/a Mayor de Gobierno | diputado@tuhermandad.org   | diputa123  |
| Vocal                        | vocal@tuhermandad.org      | vocal123   |

## Cómo aplicar

Lo más fácil, el parche (un solo archivo, aplica los 18 archivos de golpe):

    git apply cambios-modo-local.patch
    npm install
    npm run build

O descomprime el zip en la raíz respetando `src/...` y sobrescribe.

## Verificado (navegador headless)

- entrar como hermano de un clic y por DNI ✔
- subir modelo de papeleta, colocar datos y que persista ✔
- la papeleta se imprime sobre el modelo con datos reales ✔
- Supabase en pausa → la app cae a modo local ✔
- `tsc` limpio, 0 errores JS ✔
