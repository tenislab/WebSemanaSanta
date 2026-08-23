# Cuotas, caja e inventario de prueba

Para probar el traspaso **antes** de subir lo de verdad. Son las tres tablas
que una hermandad pierde el día que cambia de programa si no hay forma de
traérselas.

Cada una viene en los dos formatos. **Súbelos tal cual**: no hay que convertir
nada.

| Archivo | Qué trae |
|---|---|
| `historial-de-cuotas-de-prueba.xlsx` / `.csv` | 14 recibos de varios años |
| `libro-de-caja-de-prueba.xlsx` / `.csv` | 12 apuntes de ingresos y gastos |
| `inventario-de-prueba.xlsx` / `.csv` | 10 piezas con su valor de seguro |

## El orden importa: primero el censo

Los recibos se enganchan a la ficha de cada hermano por su DNI. Así que
**antes de las cuotas hay que importar el censo** (está en
`docs/censo-de-prueba/`). Si no, todos los recibos saldrán como «No hay ningún
hermano con el DNI…», que es exactamente lo que tiene que decir.

Los DNI de estas hojas son los del censo de prueba, así que el recorrido
completo funciona.

## Dónde está cada botón

| Tabla | Dónde |
|---|---|
| Historial de cuotas | Panel → **Cuotas** → menú **Más** → *Traer el historial de cuotas* |
| Libro de caja | Panel → **Tesorería** → *Traer vuestro libro de caja* |
| Inventario | Panel → **Inventario** → *Traer vuestro inventario* |

En los tres es el mismo asistente de cuatro pasos, y el tercero es el que
importa: **antes de tocar nada dice fila a fila qué va a pasar**. Si no era lo
que esperabas, **Deshacer** lo devuelve todo como estaba.

## 1. Historial de cuotas

**Lo que tiene que salir (con el censo ya importado y la tesorería vacía):
10 recibos nuevos y 4 filas que no se pueden importar.**

Las cuatro están mal a propósito, y son los cuatro líos que trae siempre un
histórico de verdad:

| Qué tiene | Qué debe decir |
|---|---|
| El mismo recibo dos veces (Utrera Zamora, 2025, cuota anual) | «…está repetido en el archivo», **en las dos filas** |
| Un DNI que no está en el censo (`99999999R`) | «No hay ningún hermano con el DNI…» |
| Una fila sin ejercicio ni fecha | «No se sabe de qué ejercicio es» |

El recibo repetido sale **en las dos filas** a propósito: dos recibos del mismo
hermano, del mismo año y del mismo concepto son un cobro doble, y hay que mirar
las dos para saber cuál vale.

Lo de la fila sin año no es tiquismiquis. Toda la pantalla de Cuotas habla de
**un** ejercicio: un histórico sin año caería entero en el año en curso, y
entonces los recibos de 2019 dirían que este año está pagado.

Y además, para comprobar que se leen bien:

- Un importe con millares y el euro pegado: **1.234,56 €**. Tiene que entrar
  como mil doscientos treinta y cuatro con cincuenta y seis, no como ciento
  veintitrés mil.
- Un recibo del **mismo hermano y del mismo año pero de otro concepto** (una
  extraordinaria). Ese **no** es un repetido y tiene que entrar.
- Los cuatro estados: pagada, pendiente, devuelta y en mora.

### El aviso que hay que leer

Antes de importar sale en amarillo: **«2 recibos entran pendientes y
domiciliados: saldrán en la próxima remesa al banco»**.

No es un adorno. Un recibo histórico que entra pendiente y domiciliado es un
cargo de verdad en la cuenta de un hermano la próxima vez que se prepare una
remesa. Si vuestro histórico ya está cobrado, marcadlo como pagado en la hoja
antes de subirla.

## 2. Libro de caja

**Lo que tiene que salir: 12 movimientos nuevos, ninguno con problemas.**

Esta hoja lleva las **entradas y las salidas en dos columnas**, como el libro
de caja de toda la vida. También se entiende una sola columna con el signo (el
extracto del banco, con los gastos en negativo) o una columna de importe más
otra que diga si es ingreso o gasto.

### El cuadre, antes de importar

Sale en amarillo: **«Entran 5 ingresos por 4.867,35 € y 7 gastos por
5.691,90 €. Saldo: -824,55 €»**.

Es lo primero que mira un tesorero, y es lo que delata que el signo se ha leído
al revés. Si el archivo entero entrara como ingresos, se vería aquí y no
después de haber metido setecientos apuntes.

También avisa de que la partida **«Traslados»** no está en el catálogo y cae en
«Otros gastos extraordinarios». De las categorías cuelga el estado de cuentas
que se lleva al cabildo, así que si la queréis separada, se añade en
Configuración y se vuelve a subir.

### Volver a subir un extracto que se solapa

Es lo que pasa de verdad: se importa el extracto de enero y en abril se
descarga el del trimestre, que trae enero otra vez. **Prueba a subir el mismo
archivo dos veces**: la segunda tiene que decir *12 ya estaban* y **0 nuevos**.
Un apunte se reconoce por fecha, concepto, tipo e importe.

## 3. Inventario

**Lo que tiene que salir: 10 piezas nuevas.**

- Una pieza **sin valor asegurado** (el banco de la presidencia). Tiene que
  quedar *sin asegurar*, **no** valorada en cero euros: el total del seguro es
  justo lo que se le enseña a la compañía.
- Una categoría que no está en el catálogo (**Documentación**). Se respeta lo
  que pone la hoja y se avisa, porque hasta que no la añadáis en Configuración
  no sale en los filtros.
- El estado de conservación escrito en minúscula («regular», «mal»).
- El año de alta escrito como fecha entera en una de las piezas.

Las piezas se reconocen por el nombre, así que subir la hoja dos veces
**actualiza** las que ya estaban en vez de duplicarlas — y no les borra lo que
la hoja no traiga: si subís una hoja solo con ubicaciones, el valor de seguro
que ya tuvieran se queda.

## Si sale otra cosa

Es un fallo. Cuéntalo con el botón **«Contar un fallo»** del panel.

## Cómo se regeneran

```
node scripts/tablas-de-prueba.mjs docs/tablas-de-prueba
```
