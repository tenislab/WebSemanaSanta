# Actualizar la base de datos — septiembre de 2026

Guía corta para poner al día una hermandad que **ya está funcionando**.

---

## Lo único que hay que hacer

1. Entra en tu proyecto en **supabase.com**
2. Menú de la izquierda → **SQL Editor** → **New query**
3. Abre `ACTUALIZAR.sql`, cópialo **entero**, pégalo y dale a **RUN**

Al terminar sale **una tabla** diciendo qué hay puesto y qué no. Es lo único
que devuelve. Si sale todo en `t` (verdadero) menos `pg_cron`, ya está.

> `pg_cron` sale en `f` a propósito: se enciende a mano desde el panel de
> Supabase (Database → Extensions) y solo hace falta para las copias
> automáticas.

**Es seguro repetirlo.** Todo está escrito para no romperse si ya existía, y
nada de lo que hay ahí borra ni sobrescribe datos.

---

## Si empiezas de cero

`ACTUALIZAR.sql` **no** vale para una base vacía: solo trae lo que se ha ido
añadiendo después de la instalación. Para montar una base nueva usa
**`TODO-EN-UNO.sql`**, que lo crea todo.

Ejecutar los dos tampoco rompe nada, solo sobra.

---

## Qué añade esta tanda

Tres cosas nuevas, con sus tablas y sus permisos:

| Fichero | Qué es |
|---|---|
| `campanas-y-proyectos.sql` | Campañas de recaudación con su barra, y proyectos a largo plazo |
| `reglas-de-reparto.sql` | Gastos porcentuales enlazados a una partida, para pérdidas y ganancias |
| `tienda-web.sql` | La tienda en la web pública: reservar por internet y pagar al recoger |

Y un arreglo que **no crea nada** pero hace falta:

| Fichero | Qué arregla |
|---|---|
| `cuenta-por-hermandad.sql` | El `gen_random_bytes ... does not exist` que rompía el correo de contraseña del hermano |

`pgcrypto` está instalada en tu proyecto, pero en el esquema `extensions`, y las
funciones no la encontraban. Ya viene corregido dentro de `ACTUALIZAR.sql`: con
volver a ejecutarlo entero queda arreglado.

Los tres van dentro de `ACTUALIZAR.sql`, así que **no hay que ejecutarlos
sueltos**: con pegar `ACTUALIZAR.sql` entero es suficiente.

### Un módulo de permisos nuevo: «campañas»

Con las campañas y los proyectos aparece un módulo nuevo en **Personal y
permisos**. El SQL se lo siembra al Hermano Mayor, al Secretario, al Tesorero
y al Mayordomo, que son los cargos a los que le pega.

Si en tu hermandad lo lleva otra persona, se le da desde
**Personal y permisos**, como cualquier otro.

> Solo se le añade a los cargos que tu hermandad **ya reconoce**. Si nunca
> tuviste un «Vocal», no se te inventa uno ahora. Y lo que le hayas quitado a
> alguien a propósito se respeta: esto solo añade lo que nunca estuvo.

---

## Lo otro que hay que hacer, y que NO es SQL

**Volver a desplegar la función de correo.** El diagnóstico de correo nuevo
—el botón de Configuración que dice por qué no llegan los mensajes— no
funciona con la versión antigua:

```
supabase functions deploy enviar-correo
```

---

## Si algo sale mal

Ejecuta `DIAGNOSTICO.sql` en el mismo SQL Editor. Dice qué falta y por qué,
en cristiano, y no toca nada.

Para el caso concreto de «no me deja hacer X y no sé por qué», está
`POR-QUE-NO-PUEDO.sql`, que mira los permisos de una cuenta en concreto.
