# Censo de prueba

Para probar el traspaso de datos **antes** de subir el censo de verdad.

- `censo-de-prueba.xlsx` — súbelo tal cual. No hay que convertirlo a nada.
- `censo-de-prueba.csv` — el mismo censo, por si prefieres ese camino.

## Cómo se prueba

1. Panel → **Hermanos** → botón **Exportar** → **Traer vuestro censo (Excel o CSV)**.
2. Elegir el archivo. Las diez columnas se emparejan solas.
3. Mirar el ensayo: dice fila a fila qué va a pasar **antes** de tocar nada.
4. Confirmar. Y si no era, **Deshacer**.

## Qué trae a propósito

Son 30 hermanos, y cuatro filas están mal aposta para que se vea que el
importador las caza y dice por qué. Es lo que trae siempre un censo real:

| Fila | Qué tiene | Qué debe decir |
|---|---|---|
| 2 y 27 | El mismo DNI (`12345678Z`), la misma persona metida dos veces | «El DNI está repetido en el archivo» |
| 28 | Sin DNI | «Falta el DNI» |
| 29 | Sin nombre | «Falta el nombre» |

Y además, para comprobar que se leen bien:

- **Acentos y eñes** en todos los nombres. Es lo que se rompe al guardar como
  CSV con la opción equivocada de Excel: sale «MarÃ­a» en la ficha.
- Un **IBAN con espacios**, como se copia de la libreta.
- La columna de situación titulada **«¿Está de baja?»**, que significa lo
  contrario que «Situación». Dos hermanos tienen «Sí»: tienen que entrar como
  baja, no como activos.
- La fecha de alta escrita de dos maneras: solo el año y la fecha entera.

## Lo que tiene que salir

**26 hermanos nuevos, 0 actualizados, 4 filas que no se pueden importar.**

Si sale otra cosa, es un fallo: cuéntalo con el botón «Contar un fallo» del
panel.

## Y después del censo

El censo no es lo único que se puede traer. En
[`../tablas-de-prueba/LEEME.md`](../tablas-de-prueba/LEEME.md) están las hojas
de ensayo del **historial de cuotas**, el **libro de caja** y el
**inventario**. Los DNI son los mismos que los de aquí, así que el recorrido
completo funciona: primero el censo, después las cuotas.
