# Cómo trabajar en este proyecto

Instrucciones de trabajo para Claude (y para cualquiera que retome esto). Están
escritas a partir de los problemas reales que han ido apareciendo, para no
repetirlos.

---

## 1. Antes de dar nada por bueno

Los tres, siempre, antes de entregar:

```bash
npm run typecheck   # tsc en modo estricto
npm run lint        # ESLint (debe salir SIN avisos)
npm run build       # que compile de verdad
```

`npm run lint` está en cero: **si aparece un aviso nuevo, es de este cambio**.
No se entrega con avisos. Si un aviso es intencionado (por ejemplo, un hook que
a propósito no depende de todo), se silencia con
`// eslint-disable-next-line ...` **y un comentario explicando por qué**.

### Comprobación de verdad, no de palabra

Que compile no significa que funcione. Para lo que se toca, hay que **abrirlo y
mirarlo**: `npm run dev` y una comprobación con Playwright (navegador ya
instalado en `/opt/pw-browsers`). Bugs que compilaban perfectamente y estaban
rotos en esta misma app:

- El QR se generaba bien, pero al escanearlo daba «código no válido».
- La impresión funcionaba, pero en tema oscuro salía el papel en blanco.
- Un token de CSS inexistente dejaba media interfaz **sin bordes**.

Ninguno lo habría cazado el compilador.

---

## 2. Cómo se entrega el código

**Desde las sesiones remotas no se puede hacer `git push`** (devuelve 403: el
acceso es de solo lectura). La entrega va en un zip, y hay que hacerlo así:

1. Trabajar sobre lo que está **realmente desplegado**:
   `git fetch origin main && git checkout -B <rama> origin/main`.
2. Generar el parche: `git diff origin/main HEAD > cambios.patch`.
3. **Verificarlo sobre un árbol limpio** antes de entregar:
   ```bash
   git worktree add /tmp/verify origin/main
   cd /tmp/verify && git apply --check ../cambios.patch   # ¿aplica?
   git apply ../cambios.patch && npm run typecheck && npm run build
   ```
4. El zip lleva **los archivos en su ruta real** (`src/…`, `supabase/…`) más el
   parche. **Nada en la raíz del repo.**

> ⚠️ **El error que costó media sesión:** un zip con los archivos dentro de una
> carpeta `archivos/` se copió tal cual a la raíz del repo. Resultado: ningún
> cambio llegó a `src/` y durante días se estuvo mirando una versión antigua sin
> entender por qué. **El zip debe extraerse directamente sobre el repo y quedar
> en su sitio.**

En el LEEME del zip: qué entra, cómo aplicarlo (`git apply`) y qué archivos
sueltos hay que borrar de la raíz si quedaron de entregas anteriores.

---

## 3. Cómo está montado esto

- **Vite + React + TypeScript**, CSS plano en un único `src/styles/global.css`.
- **Sin base de datos todavía.** Los datos viven en `localStorage` y los módulos
  los leen con `useSupabaseTable`, que ya sabe hablar con Supabase cuando esté
  configurado. Ver `src/lib/supabaseSync.ts`.
- **Modo demostración**: la clave `cabildo-demo-modo` fuerza la lectura local.
  Ver `src/lib/demo.ts` (demo llena y demo vacía).
- **Tema claro y oscuro** con tokens CSS. Un color definido **solo** dentro de
  `@media (prefers-color-scheme)` o `[data-theme]` no aplica en el estado por
  defecto: es el bug clásico y ya ha aparecido varias veces aquí.
- Los datos de ejemplo son **deterministas** a propósito (nada de `Math.random()`
  ni `Date.now()`): la demo no debe cambiar sola entre cargas.

---

## 4. Reglas de estilo

- **Todo en español**: nombres, comentarios y textos de pantalla.
- Los comentarios explican **por qué**, no qué. Si algo parece raro pero es
  deliberado, se dice ahí mismo.
- Nada de emojis en la interfaz del panel: la estética es sobria y con serifas.
- **No prometer lo que no hace.** Si algo está simulado (correos, cobros), el
  texto en pantalla lo dice.

---

## 5. Al terminar una fase

1. Comprobarla de verdad en el navegador.
2. Dar una **check-list** de qué se puede probar y cómo.
3. Entregar el zip verificado.
4. Actualizar `docs/HOJA-DE-RUTA.md`.

Y ser honesto con lo que queda a medias: los bugs conocidos se apuntan en la
hoja de ruta, no se esconden.

---

## 6. Trampas conocidas de este repo

- **Fechas.** `toISOString()` da la fecha en UTC: en España, de madrugada,
  devuelve el día anterior. Todas las fechas del usuario van en hora local.
  Ya hubo un desfase de un día en **todos** los cobros por esto.
- **Estado obsoleto.** Calcular con la lista del render y guardar después
  (sobre todo tras un `await`) duplica números de hermano y pierde cambios.
  Va **dentro** del updater: `setX(prev => …)`. ESLint avisa; hay que hacerle caso.
- **Supabase no lanza excepciones.** Devuelve `{ error }` en la respuesta. Si no
  se mira, un guardado fallido pasa inadvertido y la pantalla miente.
- **`var()` sin valor invalida la declaración entera.** `border: 1px solid
  var(--noExiste)` no deja un borde por defecto: **quita el borde**.
- **Impresión.** Anclar `inset: 0` hace que el documento mida exactamente una
  página y los largos se corten. Y hay que forzar tinta negra sobre blanco: el
  navegador no imprime los fondos.
- **Los hermanos de baja tienen `numero: 0`**, no un número real. Al ordenar,
  van al final (`a.numero || Infinity`), y no entran en el reparto del cortejo.
