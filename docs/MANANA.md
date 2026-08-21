# Mañana

Lo que quedó de la noche del 21, y en qué orden.

---

## FASE 0 · Los tres bugs · *yo solo, sin Jaime*

Es lo primero. Dos de ellos están vivos en producción ahora mismo.

### 0.1 · Entrar siempre lleva al área del hermano

**Lo más grave, y lo que bloquea todo lo demás.** Jaime no ha podido
comprobar ni el zip ni las plantillas de correo por esto.

Lo que cuenta él: pulsa «gestionar hermandad», y acaba en el área del
hermano. Y desde ahí no deja entrar. Le pasa **también en incógnito**, así
que no es sesión vieja ni caché: es la aplicación.

Lo que ya está descartado: los enlaces de la pantalla de entrada
(`EntradaUnificada.tsx`) apuntan bien, a `/hermano` y a `/login`. El desvío
pasa después. Hay que seguir el camino entero —entrada → login → el marco
del panel— con sesión y sin ella, y mirar de cerca `ProtectedRoute` y la
redirección de `AppShell`.

Sospecha principal: algo decide «esta cuenta es de hermano» antes de saberlo
de verdad, igual que pasaba con el cargo y con el asistente de alta. Los dos
se arreglaron esperando a la respuesta en vez de decidir en el primer
pintado; este puede ser el tercero de la familia.

### 0.2 · El 500 de la portada

`vercel.json` manda la raíz de gobergo.com a `api/w.ts`. Esa función **no
tiene try/catch por arriba**: si algo revienta dentro, la puerta principal
se cae entera con un FUNCTION_INVOCATION_FAILED.

Dos cosas que mirar:

- La importación de `src/lib/seoWeb` dentro de la función. Es código pensado
  para el navegador corriendo en el servidor; el propio fichero ya evita
  importar `src/lib/dominio.ts` por ese mismo motivo (lee `import.meta.env`,
  que en el servidor no existe). Puede que `seoWeb` arrastre lo mismo por
  alguna de sus importaciones.
- Que falte la variable `DOMINIO_APP=gobergo.com` en Vercel. Sin ella,
  `esCasa('gobergo.com')` da falso y la portada consulta a Supabase en cada
  visita, cuando debería no consultar nada.

Y pase lo que pase: **red de seguridad por arriba**. Que un fallo ahí
devuelva el `index.html` de siempre y nunca un 500.

### 0.3 · El parpadeo al cambiar de pestaña

Es mío: al partir la aplicación en trozos, cada sección se pide al pulsarla.
Jaime dice que es «muy tonto» y no corre prisa, pero se quita traiéndose el
trozo por lo bajini mientras se mira la pantalla.

---

## Cuando Jaime vuelva · *comprobar de una vez*

Todo esto está hecho pero **sin comprobar**, porque el bug 0.1 lo impedía:

1. El zip de anoche subido: panel sin muro de pago, icono de la pestaña
   granate, las pestañas sin parpadeo.
2. Las dos plantillas de correo (Reset Password y Confirm signup): pedir un
   cambio de contraseña y ver llegar el correo en español.
3. La portada de gobergo.com, a ver si sigue el 500.

---

## Apuntado, sin prisa

- **Sobra una hermandad de prueba** en la base: `aad5d9ec-…` («ijwbchijec»).
  Les sale a los hermanos al elegir hermandad. Borrarla **después** de
  confirmar que la buena va bien.
- **Dos nombres para la misma hermandad.** En la tabla `hermandades` se llama
  «particular» —que es lo que ven los hermanos al elegir— y firma los correos
  como «Real Hermandad del Nazareno», que es el nombre legal de
  Configuración. Un hermano buscaría «Nazareno» y no lo encontraría.
- **Los dos avisos de seguridad**, recién activados en Supabase (Auth →
  Security): «Password changed» y «Email address changed». Están bien puestos
  —son lo único que le dice a un hermano que le han entrado en la cuenta— pero
  tienen su propia plantilla y vienen en inglés. Faltan por traducir.

- **Entrar con Google.** Preguntado, y aparcado a propósito. No es difícil —una
  tarde— pero:
    · A los hermanos NO les serviría: entran con DNI + clave, no con cuenta de
      Supabase. Y el DNI tiene una ventaja que Gmail no tiene: la secretaría se
      lo sabe y está en la ficha. Un señor de setenta años puede no tener Gmail,
      o no acordarse de cuál usa.
    · A la junta sí, pero abre la puerta a que cualquiera con un Gmail se cree
      una cuenta que la aplicación no sabe clasificar: sin fila en `titulares`
      ni en `personal`, entra sin permisos a una pantalla vacía. Que es
      EXACTAMENTE el bug 0.1 de arriba.
  Se retoma después de la Fase 0 y la Fase 3, y si se hace, solo para la junta.
  No conviene abrir una puerta nueva mientras la que hay está rota.

---

## Las fases que vienen después

| | | |
|---|---|---|
| **3** | Probar la aplicación en serio: veinte hermanos de verdad, cuotas, papeletas, imprimir | los dos |
| **4** | Las remesas. **No** es mandar una al banco: cada hermandad gestiona la suya. Lo que hay que dejar fino es que el fichero salga bien pase lo que pase, que avise ANTES de lo que no cuadra (IBAN mal, importes raros, mandatos sin fecha) y que haya guía para un tesorero que no ha hecho una en su vida | yo |
| **5** | Stripe: el webhook, para que el pago desbloquee la cuenta solo | yo |

---

## Ya hecho, para no repetirlo

- `TODO-EN-UNO.sql` pasado en Supabase ✓
- Suscripción activada: `e2d94b35-…` · activa · pack todo · anual ✓
- La función `enviar-correo` desplegada, con sus dos secretos ✓
- El correo funciona de verdad: prueba y comunicado, los dos en Recibidos ✓
