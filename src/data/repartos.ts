/**
 * LAS REGLAS PORCENTUALES DE LA DEMO.
 *
 * Una de cada clase, porque son dos cosas distintas y hay que ver las dos
 * funcionando —el porqué, entero, en `lib/repartos.ts`—:
 *
 *   · UN REPARTO, que trocea un gasto real y NO cambia el total.
 *   · UN COMPROMISO, que aparta parte de un ingreso y sí suma un gasto que en
 *     el libro no está.
 */
import type { Reparto } from '../lib/repartos'

export const REPARTOS_INICIALES: Reparto[] = [
  {
    id: 'rep-luz',
    nombre: 'Luz y agua: la parte del almacén',
    tipo: 'reparto',
    categoriaBase: 'Mantenimiento',
    porcentajeCent: 4000, // 40 %
    categoriaDestino: 'Gastos varios menores',
    activo: true,
    // Sin «imputar»: la demo es lo primero que lee una hermandad, y si el
    // ejemplo usa la palabra del gestor, la palabra del gestor es la que se
    // copia. Ver `comoSeLeeElReparto` en `lib/repartos.ts`.
    nota: 'El contador es único para la casa hermandad y el almacén de enseres. '
      + 'Se acordó cargarle el 40 % al almacén.',
    creadoEn: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'rep-caridad',
    nombre: 'El diezmo de caridad',
    tipo: 'compromiso',
    categoriaBase: 'Donativos, Ofrendas y Cepillos',
    porcentajeCent: 1000, // 10 %
    categoriaDestino: 'Obras Benéficas y Sociales',
    activo: true,
    // La nota es para el POR QUÉ —de dónde viene la decisión—, no para repetir
    // lo que la regla hace: eso ya lo dice su propia línea ahora.
    nota: 'Cabildo de enero: se aparta el 10 % de lo que se recoja en donativos '
      + 'para la bolsa de caridad.',
    creadoEn: '2026-01-15T10:05:00.000Z',
  },
]
