# Qué haría yo ahora — plan por fases

Escrito el 22 de agosto de 2026, después de la tanda de los cargos y del cortejo.

---

## El hilo que ata todo esto

Los cuatro fallos gordos de esta semana **eran invisibles en modo demostración**:

- los tramos que no se guardaban (faltaba una columna),
- la convocatoria que no mandaba ni un correo,
- la lista de precios que podía desaparecer al guardarla,
- la fecha de hoy calculada en UTC.

Ninguno se ve sin Supabase conectado. Eso no es mala suerte: es estructural. La
aplicación tiene dos modos y solo se prueba uno. **Quedan más de esa familia**,
casi con seguridad, y se van a ir descubriendo de uno en uno y con una hermandad
delante.

Por eso la fase 1 no es una función nueva.

---

## Fase 0 — Poner en marcha lo de esta semana

**Tú, veinte minutos, hoy.**

1. Ejecutar `TODO-EN-UNO.sql` en Supabase.
2. Subir el zip (eso arregla el 500).
3. Comprobar tres cosas, por este orden:
   - que tú sigues entrando y viéndolo todo,
   - que creas un tramo y sigue ahí después de recargar,
   - que gobergo.com abre sin el 500.
4. Borrar la hermandad de pruebas `ijwbchijec` y cuadrar «particular» con «Real
   Hermandad del Nazareno».

Hasta que esto esté hecho, lo demás no importa.

---

## Fase 1 — Que se pueda probar contra una base de verdad

**Lo primero, y es lo que más rinde de todo el plan.**

Ahora mismo no hay forma de saber si algo funciona con Supabase conectado hasta
que falla con datos reales delante. Eso es lo que ha pasado esta semana cuatro
veces.

Qué hace falta:

- **Un segundo proyecto de Supabase**, gratis, solo para pruebas. Nunca datos
  reales.
- **Un guion que recorra el año entero** contra esa base: crear hermandad →
  importar censo → configurar cuerpos y tramos → emitir cuotas → cobrar →
  convocar papeletas → sacarlas → repartir el cortejo → imprimir → cerrar
  ejercicio.
- Que ese guion **compruebe lo que quedó guardado**, no lo que se pintó en
  pantalla. Ese es el matiz: los cuatro fallos de esta semana pintaban bien.
- **Las políticas de seguridad, probadas de verdad**: entrar como cada cargo y
  comprobar qué puede leer y escribir. Hoy `PRUEBA-AISLAMIENTO.sql` comprueba
  que dos hermandades no se ven, que es lo más importante, pero no comprueba
  qué puede hacer cada cargo dentro de la suya.

Coste: una tanda larga. Beneficio: todo lo que venga después se puede verificar
antes de que lo sufra nadie.

---

## Fase 2 — La deuda de seguridad

**Antes de que entren datos de verdad de una hermandad que no sea la tuya.**

Son tres cosas que encontré y no arreglé, porque son anteriores a lo de esta
semana y merecen una tanda propia. Las tres van juntas:

1. **La contraseña inicial de un hermano es su DNI**, y el DNI está en su ficha.
   Quien pueda leer el censo puede entrar como cualquier hermano que no la haya
   cambiado — y nadie le obliga a cambiarla.
2. **`clave_acceso` se guarda en claro** en la tabla, y la ficha la imprime en
   pantalla. Las contraseñas viven en Supabase Auth, donde no las lee nadie: esa
   columna es una copia que no hace falta.
3. **El registro de actividad lo escribe el navegador, no la base.** Un cambio
   hecho por fuera de la aplicación no deja rastro, y quien tenga cargo puede
   meter apuntes que luego no se pueden borrar.

Qué haría: clave de un solo uso mandada por correo, cambio obligatorio en el
primer acceso, quitar la columna, y disparadores de registro en la base.

Por qué antes de crecer: esto es lo único de toda la lista que puede terminar
con el proyecto. Ochocientos DNI con IBAN y notas de salud es categoría especial
del RGPD. Y arreglarlo con tres hermandades dentro cuesta diez veces más que
ahora.

---

## Fase 3 — Una hermandad de verdad, un ciclo entero

**No «que la prueben»: que la usen.**

Una sola hermandad, la que mejor te lleves con ella, haciendo su trabajo normal
durante una temporada. Con su censo de verdad importado.

Lo que hay que mirar, y no es la lista de funciones:

- **Cuánto tarda en estar operativa** desde cero. Importar el censo es la
  barrera más alta que tiene este producto: si eso son dos tardes, no lo compra
  nadie.
- **Qué preguntan por teléfono.** Cada llamada a secretaría es una pantalla que
  no se explica sola.
- **Qué siguen haciendo en Excel** a pesar de tener la aplicación. Eso dice
  exactamente qué falta.

De aquí sale la lista de mejoras de verdad, que no se parecerá a la que
tendríamos ahora.

---

## Fase 4 — Cobrar

Hasta que esto funcione no hay negocio, hay un proyecto.

- Stripe de verdad: webhook, estados de la suscripción, y —lo que casi siempre
  se olvida— **qué pasa cuando un pago falla**. Una hermandad no puede quedarse
  fuera de su propio censo en Semana Santa porque caducó una tarjeta.
- Periodo de prueba y qué se ve durante él.
- Facturas, que una hermandad las necesita para su contabilidad.

Va después del piloto a propósito: cobrar por algo que todavía no sabes si
resuelve el problema es la forma más rápida de quemar al primer cliente.

---

## Fase 5 — Lo que puede esperar

Sin prisa, y en este orden si acaso:

- **Entrar con Google.** Cómodo, no urgente.
- **Remesas SEPA**, más allá de la validación que ya hay. Cada hermandad la
  gestiona con su banco, así que lo que aporta la aplicación es el fichero bien
  hecho y avisar de lo que va mal.
- **La web pública como escaparate.** Es lo que ven las otras hermandades, así
  que a medio plazo es el mejor comercial que tienes — pero solo cuando la
  gestión ya funcione sola.

---

## Si solo hay tiempo para una cosa

**La fase 1.**

No es la más vistosa, y es la única que evita que la fase 3 se convierta en la
hermandad piloto descubriendo fallos por ti. Esta semana han salido cuatro, y
los cuatro estaban ahí desde hacía meses.
