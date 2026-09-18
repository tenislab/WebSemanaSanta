/**
 * «DAR DE ALTA» DESDE NOTIFICACIONES TIENE QUE DAR DE ALTA.
 *
 * ============================================================================
 * DE DÓNDE SALE ESTO
 * ============================================================================
 *
 * Llegó dicho así: «si le doy a dar de alta en notificaciones no funciona,
 * tengo que irme a Hermanos». Y tenía razón — el botón prometía un alta y solo
 * cambiaba de pantalla, que es una promesa rota.
 *
 * Se arregló con un parámetro en la dirección: Notificaciones enlaza a
 * `/app/hermanos?aprobar=<id>` y el censo, al llegar, aprueba esa solicitud.
 * Y NO copiando el alta al otro lado: dar de alta son ciento cuarenta líneas
 * —número correlativo, control de DNI repetido, cuenta de acceso, correo de
 * bienvenida, caso aparte para los menores— y duplicarlo sería tener dos altas
 * distintas, con la copia quedándose atrás a la primera.
 *
 * ============================================================================
 * POR QUÉ SE ESCRIBE AHORA
 * ============================================================================
 *
 * Son DOS EXTREMOS DE UN CABLE en ficheros distintos, y no había nada que
 * comprobara que siguen unidos. Al partir el censo, el extremo de este lado se
 * mudó a `censo/solicitudesDeAlta.ts` — y si en esa mudanza se hubiera quedado
 * atrás, todo habría seguido compilando y en verde: el botón volvería a llevar
 * a una pantalla que no hace nada, exactamente como al principio.
 */
export default async function ({ caso }) {
  const { fuenteDe, fuente } = await import('./fuentes.mjs')

  // El extremo que manda: el enlace de Notificaciones.
  const notis = await fuente('src/pages/app/Notificaciones.tsx')
  caso('Notificaciones enlaza con «?aprobar=»', true, /\?aprobar=\$\{a\.refId\}/.test(notis))
  caso('y solo para un alta de hermano', true, /a\.tipo === 'altaHermano' \?/.test(notis))

  // El extremo que recibe: el censo, esté en el fichero que esté.
  const censo = await fuenteDe('src/pages/app/Hermanos.tsx')
  caso('el censo lee ese parámetro', true, /params\.get\('aprobar'\)/.test(censo))
  caso('y aprueba esa solicitud de verdad', true, /aprobarSolicitud\(sol\)/.test(censo))
  caso('y solo si sigue pendiente', true, /estado === 'Pendiente'/.test(censo))
  /*
   * Y LIMPIA EL PARÁMETRO. Si se quedara, recargar la página volvería a
   * intentar aprobar a alguien que ya está dado de alta.
   */
  caso('y limpia el parámetro al terminar', true, /limpio\.delete\('aprobar'\)/.test(censo))

  /*
   * NO SE APRUEBA DOS VECES, y el cómo importa: con un `useRef` se daba de
   * alta DOS VECES a la misma persona, porque React monta, desmonta y vuelve a
   * montar en desarrollo y el ref vuelve a empezar. Se veía en el censo —la
   * misma persona repetida— y el control de DNI no lo pillaba porque las dos
   * aprobaciones leían la lista antes de que ninguna terminara. Un `Set` del
   * módulo sobrevive al remontaje.
   */
  caso('lo ya aprobado se apunta fuera del componente', true, /YA_APROBADAS/.test(censo))
  caso('y en un Set de módulo, no en un useRef', true,
    /const YA_APROBADAS = new Set<string>\(\)/.test(censo))
  caso('se apunta ANTES de empezar a aprobar', true,
    /YA_APROBADAS\.add\(id\)[\s\S]{0,80}aprobarSolicitud\(sol\)/.test(censo))
  caso('y no se vuelve a intentar lo ya apuntado', true,
    /YA_APROBADAS\.has\(id\)\) return/.test(censo))
}
