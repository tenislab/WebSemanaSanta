# Qué lleva esta entrega

Seis bloques, todos probados: `tsc`, `lint`, `build` y **3.934 pruebas** que
pasan con y sin zona horaria de Madrid. El SQL se instala sobre un Postgres de
verdad, no solo se lee.

---

## 1. La introducción de datos, capada

Lo que pediste: «hay que revisar la introducción de datos y caparlo, por
ejemplo que en el DNI solo se puedan poner 9 números y una letra».

**El DNI son 8 números y una letra** (`12345678Z`), no 9 — nueve es lo que
ocupa el documento entero contando la letra. Y hacía falta contemplar también
el **NIE** (`X1234567L`), que en una hermandad los hay.

**No se valida contando caracteres, sino comprobando la letra**, que sale de
dividir el número entre 23. Contando caracteres, `12345679Z` pasaría — y ese
es justo el error que se comete al copiar de un papel.

Además, con la misma regla en todas las pantallas:

- **Teléfono**, y el del **Bizum** aparte: Bizum solo funciona con móviles
  españoles, así que un fijo perfectamente válido ahí no funciona jamás.
- **NIF de la hermandad**, que va en todas las facturas de la tienda.
- **Identificador de acreedor SEPA**: si está mal, el banco no devuelve unos
  recibos, **tumba la remesa entera**.
- **Código postal**, con el cero de delante.
- **IBAN** en los tres sitios donde se tecleaba sin comprobarlo: Configuración,
  el alta de hermandad, y la cuenta de donativos de la web.

Tres cosas que aparecieron por el camino:

- **Los datos de la demo no pasaban sus propias comprobaciones.** El CIF, el
  IBAN y el identificador estaban inventados a ojo y los tres eran inválidos.
  Quien abriera la demo se habría encontrado tres avisos rojos nada más entrar.
- **«Sin datos» se pintaba dentro del campo del teléfono** en el área del
  hermano. Había que borrarlo para escribir el suyo, y muchos escribían detrás.
- **La web pública tenía su propia regla de teléfono**, más floja. Dos reglas
  para el mismo dato significa que la web acepta lo que la ficha rechaza.

Se valida **al teclear, nunca al importar**: un censo de hace quince años trae
erratas, y rechazar la importación dejaría fuera a gente de verdad.

---

## 2. Campañas y proyectos

Lo de Víctor: «que las campañas sean recolecciones de dinero con una barra
hasta que se llegue al objetivo, y los proyectos que sean como tareas pero a
largo plazo».

**Lo recaudado no se guarda: se cuenta desde Tesorería.** No hay ninguna
columna «recaudado». La barra suma los apuntes del libro que llevan la marca de
la campaña.

Es la respuesta directa a la otra queja del mismo mensaje —«el concepto de
cuota no se pasa a tesorería»—: **si la barra sube, el tesorero lo tiene**,
porque son el mismo dato. Un contador aparte se descuadra en cuanto alguien
corrige un apunte, y entonces hay dos verdades sobre el mismo dinero: la que
enseña la barra y la que dice el libro.

Los gastos de la campaña se restan: enseñar lo bruto como si fuera lo
disponible es mentir sobre cuánto falta.

**Los proyectos no son eventos.** Un evento es un día con cosas que preparar;
un proyecto tiene un final, un responsable, y pasada la fecha **no se archiva
solo** — se queda, y en rojo. Hay un estado «idea» para lo que se habló en un
cabildo y quedó ahí, que si no se pierde entre un acta y la siguiente.

---

## 3. Cuenta de pérdidas y ganancias, con gastos porcentuales

«Al crear informe crear cuenta de pérdidas y ganancias y opción de añadir
gastos porcentuales a los ingresos, gastos, etc. que se pueda enlazar.»

**No sustituye al Estado de Cuentas**: contesta otra pregunta. El Estado de
Cuentas es el papel de la diócesis y cuenta el dinero. Este contesta si la
hermandad se sostiene, y por eso trae el año anterior al lado, el peso de cada
partida sobre el total, y las partidas de mayor a menor en vez de por orden
alfabético — un informe de cuentas se lee por arriba.

**Los gastos porcentuales son dos cosas y están las dos.** La frase admite dos
lecturas y el «a los ingresos, **gastos**, etc.» dice que la regla se engancha a
cualquiera de los dos, así que se elige al crearla:

- **Reparto** — trocear un gasto **real** entre partidas. «La luz: 60 % a la
  casa hermandad, 40 % al almacén.» El dinero ya salió y el total **no cambia**.
- **Compromiso** — apartar un % de lo que entre por una partida. «El 10 % de la
  lotería va a caridad.» Ahí no ha salido dinero todavía.

**Ninguna de las dos escribe un apunte en Tesorería.** Un compromiso no es un
gasto: es dinero que sigue en la cuenta. Apuntarlo rompería dos cosas a la vez —
el saldo dejaría de cuadrar con el banco, y el día que se pague de verdad se
contaría dos veces.

Por eso el informe enseña **siempre las dos cifras** —el resultado del ejercicio
y el de después de compromisos— y el papel dice cuál cuadra con el banco.

---

## 4. La pantalla en blanco del navegador principal

Estaba pasando que en el navegador de siempre se quedaba en blanco y en
privado no. Era un dato guardado con una forma que la aplicación ya no
esperaba: se leía, se le llamaba `.filter` a algo que no era una lista, y la
pantalla entera se caía sin decir nada — en privado no pasaba porque no había
nada guardado.

Ahora se comprueba la forma antes de usarlo, y si algo revienta hay una
pantalla que lo cuenta con el error entero para copiar, en vez de un folio en
blanco. El botón de vaciar borra **solo** lo de la aplicación, nunca el resto.

---

## 5. La tanda de fallos del 28

Seis cosas, y varias resultaron ser **el mismo tipo de fallo**: leer de donde
no era.

**«Registro una papeleta y se borran todos los datos»** — el grave.

RLS **no da error cuando deniega**: devuelve cero filas con `error` a nulo,
indistinguible de una tabla vacía. La aplicación recarga en cada cambio de
sesión, y al refrescarse el token hay un instante en que todas las políticas
deniegan a la vez. El código trataba eso como «no hay nada»: vaciaba la pantalla
**y machacaba la copia local de respaldo**. Eso último es lo peor — destruye la
red de seguridad justo antes de necesitarla, y explica el «se ha solventado pero
faltan datos» de después.

Ahora un cero donde había datos se reintenta antes de darlo por bueno. Si el
segundo intento también viene vacío, se acepta: si alguien borra el censo desde
otro ordenador, este se tiene que enterar.

**«Cerrar sesión no cierra bien»** — había **dos sesiones** en el mismo
navegador y cada «cerrar sesión» limpiaba solo la suya. El panel dejaba puesta
la del área del hermano. Por eso al volver a entrar se iba al área del hermano
en vez de a la de gestión.

En la casa de hermandad es además un problema de verdad: el ordenador lo usan
varios, y el siguiente veía el nombre, las cuotas y la papeleta del anterior.

**«La notificación de papeleta no llega a Notificaciones»** — leía la copia de
*ese* navegador. La solicitud la manda el hermano desde su móvil.

**Y buscando más de lo mismo apareció otro que nadie había reportado**: la
portada del panel contaba **cero altas pendientes** habiendo gente esperando,
por la misma razón. Es la pantalla que se abre por la mañana y su trabajo entero
es que no haga falta ir módulo por módulo.

Como ya iban tres, hay una prueba que vigila **la clase entera**: ninguna
pantalla del panel puede leer de la copia local una colección que llega de
fuera.

**«Asigno tarea a hermano y no llega notificación»** — Eventos no avisaba a
nadie. Ni una llamada en toda la pantalla.

**«No deja asignar hermanos en tareas de redes»** — solo se ofrecía a quien
tuviera cargo, y la razón escrita en el código era falsa: decía que un hermano
sin cargo «no podría verlo porque no entra al panel», cuando la tarea le sale en
su propia área — que es para lo que se hizo el módulo.

**«No deja imprimir factura»** — el botón se quedaba apagado diciendo «Trayendo
los artículos…» para siempre cuando la consulta fallaba. Un fallo se veía igual
que una carga lenta. Ahora se distinguen los tres estados y se puede reintentar.

---

## 6. El correo de contraseña del hermano: `gen_random_bytes`

`pgcrypto` **sí** está instalada en Supabase, pero en el esquema `extensions`.
Nuestras funciones estaban declaradas con `search_path = public`, así que no la
encontraban. El error habla de una función que no existe cuando lo que pasa es
que está en otro sitio.

Arreglado en el SQL. **Las pruebas no lo cazaron porque montaban pgcrypto en
`public`** — o sea, probaban contra una base que no existe en ninguna parte.
Ahora la montan como Supabase, y el fallo se reproduce aquí antes de salir.

---

# Lo que tienes que hacer tú

1. **Ejecutar `ACTUALIZAR.sql`** — está explicado paso a paso en
   `supabase/LEEME-ACTUALIZAR.md`.
2. **Volver a desplegar la función de correo**, para que funcione el
   diagnóstico nuevo:
   ```
   supabase functions deploy enviar-correo
   ```

---

# Lo que sigue pendiente

- **Los informes de cuentas están mal** — Víctor dijo «eso me encargo yo de
  mandártelo para que la máquina sepa qué tiene que coger de cada lugar».
  Sigo esperando eso: no quiero adivinarlo.
- **La pantalla en blanco de gobergo.com** se resolvió sola. Puede ser el
  proyecto de Supabase despertando de la pausa (plan gratuito). Si vuelve a
  pasar, hay que mirarlo con el navegador abierto.
- **Leer el fichero de devoluciones del banco** (19-44 / pain.002).
- **Pago con tarjeta del hermano** para cuota y papeleta.
