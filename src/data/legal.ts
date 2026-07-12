/**
 * Textos legales de Cabildo. Son plantillas razonables para una plataforma
 * SaaS española (RGPD/LOPDGDD, LSSI-CE), pero NO sustituyen el asesoramiento
 * de un profesional: antes de publicarlos de verdad hay que rellenar los
 * datos entre corchetes [...] con los del titular real y revisarlos con un
 * abogado. La app muestra un aviso visible mientras queden corchetes.
 */

export interface SeccionLegal {
  titulo?: string
  parrafos?: string[]
  lista?: string[]
}

export interface DocumentoLegal {
  slug: string
  titulo: string
  actualizado: string
  intro: string
  secciones: SeccionLegal[]
}

const ACTUALIZADO = 'julio de 2026'

export const DOCUMENTOS_LEGALES: DocumentoLegal[] = [
  {
    slug: 'aviso-legal',
    titulo: 'Aviso legal',
    actualizado: ACTUALIZADO,
    intro:
      'En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se facilitan los datos identificativos del titular de esta plataforma.',
    secciones: [
      {
        titulo: '1. Titular',
        lista: [
          'Titular: [RAZÓN SOCIAL O NOMBRE DEL RESPONSABLE]',
          'NIF/CIF: [NIF O CIF]',
          'Domicilio: [DIRECCIÓN COMPLETA]',
          'Correo de contacto: [CORREO DE CONTACTO]',
          'Nombre comercial: Cabildo',
        ],
      },
      {
        titulo: '2. Objeto',
        parrafos: [
          'Cabildo es una plataforma de software para la gestión de hermandades y cofradías (censo de hermanos, cuotas, papeletas de sitio, cortejo, tesorería, comunicaciones y documentación).',
          'El uso de la plataforma atribuye la condición de usuario e implica la aceptación de este aviso legal y del resto de textos legales publicados.',
        ],
      },
      {
        titulo: '3. Propiedad intelectual e industrial',
        parrafos: [
          'El código, el diseño, la marca «Cabildo», los textos y demás elementos de la plataforma son titularidad del responsable o de terceros que han autorizado su uso, y están protegidos por la normativa de propiedad intelectual e industrial.',
          'Los datos que cada hermandad introduce (hermanos, cuotas, documentos, etc.) son de su exclusiva titularidad; la plataforma solo los trata para prestar el servicio.',
        ],
      },
      {
        titulo: '4. Responsabilidad',
        parrafos: [
          'El titular trabaja para que la plataforma funcione correctamente, pero no garantiza la ausencia de errores ni la disponibilidad ininterrumpida del servicio.',
          'El titular no se responsabiliza del uso que cada hermandad haga de los datos que gestiona a través de la plataforma, que es la responsable del tratamiento de los datos de sus hermanos.',
        ],
      },
      {
        titulo: '5. Legislación aplicable',
        parrafos: [
          'Este aviso legal se rige por la legislación española. Para cualquier controversia serán competentes los juzgados y tribunales que correspondan conforme a la normativa vigente.',
        ],
      },
    ],
  },
  {
    slug: 'privacidad',
    titulo: 'Política de privacidad',
    actualizado: ACTUALIZADO,
    intro:
      'Esta política explica cómo se tratan los datos personales conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD).',
    secciones: [
      {
        titulo: '1. Responsable del tratamiento',
        parrafos: [
          'Respecto a los datos de la cuenta y el uso de la plataforma, el responsable es el titular indicado en el aviso legal: [RAZÓN SOCIAL], NIF [NIF O CIF], con domicilio en [DIRECCIÓN] y correo de contacto [CORREO DE CONTACTO].',
          'Respecto a los datos de los hermanos que cada hermandad gestiona con Cabildo, la responsable del tratamiento es la propia hermandad; Cabildo actúa como encargada del tratamiento y los trata únicamente siguiendo sus instrucciones.',
        ],
      },
      {
        titulo: '2. Datos que se tratan',
        lista: [
          'Datos de la cuenta de gestión: nombre, correo electrónico, contraseña y datos de la hermandad.',
          'Datos de los hermanos, introducidos por la hermandad: identificativos (nombre, DNI/NIE), de contacto (correo, teléfono, dirección), económicos (cuotas, IBAN) y de participación (papeletas, cortejo).',
          'Datos de navegación estrictamente necesarios para que la plataforma funcione.',
        ],
      },
      {
        titulo: '3. Finalidad y base jurídica',
        parrafos: [
          'Los datos se tratan para prestar el servicio de gestión de la hermandad: mantener el censo, emitir y cobrar cuotas, gestionar papeletas y cortejo, llevar la tesorería y enviar comunicaciones.',
          'La base jurídica es la ejecución del contrato de servicio y, respecto a los hermanos, la relación entre la hermandad y sus miembros y el interés legítimo o el consentimiento, según el caso. Las comunicaciones no esenciales se basan en el consentimiento del interesado.',
        ],
      },
      {
        titulo: '4. Conservación',
        parrafos: [
          'Los datos se conservan mientras se mantenga la relación de servicio y, después, durante los plazos legales de prescripción de las obligaciones (por ejemplo, contables y fiscales). Cuando dejan de ser necesarios se suprimen o se anonimizan.',
        ],
      },
      {
        titulo: '5. Destinatarios y encargados',
        parrafos: [
          'Los datos se alojan en proveedores de infraestructura (por ejemplo, servicios de base de datos y alojamiento) que actúan como encargados del tratamiento con las debidas garantías. No se ceden a terceros salvo obligación legal.',
          'Si algún proveedor está fuera del Espacio Económico Europeo, la transferencia se ampara en las garantías previstas por el RGPD (cláusulas contractuales tipo u otras).',
        ],
      },
      {
        titulo: '6. Derechos de las personas',
        parrafos: [
          'Cualquier persona puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a [CORREO DE CONTACTO], acreditando su identidad.',
          'Dentro de la plataforma, cada hermano puede descargar sus datos o solicitar su supresión desde su área personal (apartado «Mis datos y privacidad»).',
          'Si considera que sus datos no se tratan correctamente, puede reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
        ],
      },
      {
        titulo: '7. Seguridad',
        parrafos: [
          'Se aplican medidas técnicas y organizativas razonables para proteger los datos. Aun así, ningún sistema es totalmente infalible; ante cualquier incidencia de seguridad se actuará conforme a la normativa vigente.',
        ],
      },
    ],
  },
  {
    slug: 'condiciones',
    titulo: 'Condiciones de uso del servicio',
    actualizado: ACTUALIZADO,
    intro:
      'Estas condiciones regulan el acceso y el uso de la plataforma Cabildo. Al registrarse o utilizar el servicio, el usuario las acepta.',
    secciones: [
      {
        titulo: '1. Objeto del servicio',
        parrafos: [
          'Cabildo ofrece herramientas en línea para la gestión de hermandades y cofradías. El servicio se presta «tal cual» y puede evolucionar con nuevas funciones o cambios.',
        ],
      },
      {
        titulo: '2. Registro y cuenta',
        parrafos: [
          'Para gestionar una hermandad hay que crear una cuenta con datos veraces. El usuario es responsable de mantener la confidencialidad de sus credenciales y de toda actividad realizada con ellas.',
          'La hermandad es responsable de dar de alta y baja a su personal y de asignar los cargos y permisos de acceso adecuados.',
        ],
      },
      {
        titulo: '3. Uso correcto',
        lista: [
          'No usar la plataforma para fines ilícitos ni contrarios a la buena fe.',
          'No introducir datos de terceros sin base legítima para ello.',
          'No intentar acceder a datos de otras hermandades ni alterar el funcionamiento del servicio.',
          'Cumplir la normativa de protección de datos respecto a los hermanos cuyos datos se gestionan.',
        ],
      },
      {
        titulo: '4. Datos de la hermandad',
        parrafos: [
          'Los datos que la hermandad introduce son de su titularidad. La hermandad puede exportarlos y descargar copias de seguridad en cualquier momento desde la propia plataforma.',
          'A la finalización del servicio, la hermandad dispondrá de un plazo razonable para recuperar sus datos antes de su supresión.',
        ],
      },
      {
        titulo: '5. Disponibilidad y responsabilidad',
        parrafos: [
          'El titular procurará la máxima disponibilidad, pero no garantiza un servicio ininterrumpido ni libre de errores. No será responsable de daños derivados de un uso indebido de la plataforma por parte del usuario.',
        ],
      },
      {
        titulo: '6. Precios y contratación',
        parrafos: [
          'Las condiciones económicas del servicio (planes, precios e impuestos) serán las publicadas o las pactadas en su caso. Cualquier cambio se comunicará con antelación razonable.',
        ],
      },
      {
        titulo: '7. Modificaciones y legislación',
        parrafos: [
          'Estas condiciones pueden actualizarse; la versión vigente será la publicada en la plataforma. Se rigen por la legislación española.',
        ],
      },
    ],
  },
  {
    slug: 'cookies',
    titulo: 'Política de cookies',
    actualizado: ACTUALIZADO,
    intro:
      'Esta política informa sobre el uso de cookies y tecnologías similares (como el almacenamiento local del navegador) en la plataforma Cabildo.',
    secciones: [
      {
        titulo: '1. Qué usamos',
        parrafos: [
          'Cabildo utiliza únicamente almacenamiento técnico estrictamente necesario para que la plataforma funcione: mantener la sesión iniciada y recordar preferencias básicas (por ejemplo, el tema claro/oscuro). Este almacenamiento se guarda en tu propio navegador.',
          'No se utilizan cookies de publicidad ni de seguimiento de terceros con fines comerciales.',
        ],
      },
      {
        titulo: '2. Almacenamiento necesario',
        lista: [
          'Sesión de acceso: para mantener tu sesión mientras usas la plataforma.',
          'Preferencias: por ejemplo, el tema de color elegido.',
          'Datos de trabajo en el navegador: mientras no haya base de datos conectada, algunos datos se guardan localmente para que no se pierdan al recargar.',
        ],
      },
      {
        titulo: '3. Gestión',
        parrafos: [
          'Al tratarse de almacenamiento técnico necesario, no requiere consentimiento previo conforme a la normativa. Puedes borrarlo en cualquier momento desde la configuración de tu navegador; ten en cuenta que, si lo haces, se cerrará tu sesión y se perderán las preferencias guardadas.',
        ],
      },
      {
        titulo: '4. Cambios',
        parrafos: [
          'Si en el futuro se incorporan cookies de análisis o de terceros, se actualizará esta política y, cuando la ley lo exija, se solicitará tu consentimiento previo.',
        ],
      },
    ],
  },
]

export function getDocumentoLegal(slug: string): DocumentoLegal | undefined {
  return DOCUMENTOS_LEGALES.find((d) => d.slug === slug)
}
