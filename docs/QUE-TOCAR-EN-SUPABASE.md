# Qué hay que tocar en Supabase

Con lo que se ha hecho hasta hoy. Ordenado por cuándo hace falta.

---

## AHORA — un solo SQL

**SQL Editor → New query → pegar `supabase/apuntes-automaticos.sql` → Run.**

Añade una columna a la tabla de movimientos que enlaza cada apunte con el
recibo, la papeleta o el donativo que lo generó. Sin ella, la aplicación no
puede saber si un cobro ya está apuntado y acabaría metiéndolo dos veces.

Es seguro repetirlo y no toca ningún dato.

### Cómo saber que ha entrado

```sql
select column_name from information_schema.columns
where table_name = 'movimientos' and column_name = 'origen';
```

Tiene que devolver una fila.

---

## AHORA — una casilla, si quieres el «he olvidado mi contraseña»

**Authentication → Sign In / Providers → Email**

Ahí abajo, en *Password recovery*, tiene que estar habilitado (viene de serie).

Y en **URL Configuration → Redirect URLs**, comprueba que está:

```
https://web-semana-santa.vercel.app/hermano
```

Es a donde vuelve el hermano desde el enlace del correo. Si no está, el correo
le llega, pulsa, y Supabase le rechaza la vuelta sin decirle por qué.

> Con «Confirm email» desactivada, la recuperación **sigue funcionando**. Son
> dos cosas distintas: una es confirmar que el correo es suyo al registrarse,
> la otra es recuperar el acceso. Puedes tener la segunda sin la primera.

---

## NADA MÁS, POR AHORA

El resto de lo hecho estos días es aplicación, no base de datos:

| Qué | ¿Toca Supabase? |
|---|---|
| El cambio de nombre a Gobergo | No |
| Los huecos legales | No |
| El correo por hermandad | No (hasta desplegar la función) |
| La web en su dominio propio | No |
| La copia local entre hermandades | No |
| La vista previa de importar | No |
| El «he olvidado mi contraseña» | Solo la Redirect URL de arriba |

---

## CUANDO COMPRES EL DOMINIO

Todo junto en `CUANDO-TENGA-DOMINIO.md`. En Supabase concretamente:

1. **URL Configuration** → Site URL y Redirect URLs con el dominio nuevo
2. **Authentication → Emails → SMTP** → cambiar de Gmail a Resend
3. **Edge Functions → Secrets** → `RESEND_API_KEY` y `CORREO_REMITENTE`
4. **Edge Functions → Deploy** → la función `enviar-correo`

> `CORREO_REMITENTE` ahora es **solo la dirección**, sin nombre delante:
> `no-responder@gobergo.es`. El nombre lo pone cada hermandad, sacado de su
> ficha, y al hermano le llega «Hdad. de la Amargura <no-responder@gobergo.es>».

---

## CUANDO PAGUES EL PLAN

**Database → Backups.** En el gratuito no hay copias automáticas.

Es el riesgo que más me preocupa de todos: la hermandad mete su censo durante
una semana, algo se pierde, y no hay vuelta atrás. Eso no lo perdona nadie y te
cierra esa puerta para siempre.

---

## Si algo falla

**Logs → Auth** para todo lo de cuentas y correos. Ahí sale el motivo de
verdad, no el «error» que enseña el navegador. Es donde se vio que el 500 del
registro era el correo saliente y no la aplicación.
