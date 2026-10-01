export type LegalSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
  links?: { label: string; href: string }[];
  table?: { headings: string[]; rows: string[][] };
};

export type LegalContent = {
  title: string;
  summary: string;
  updatedAt: string;
  sections: LegalSection[];
};

export const legalNavigation = [
  { key: "legal.notice", href: "/aviso-legal", label: "Aviso legal" },
  { key: "legal.privacy", href: "/politica-privacidad", label: "Privacidad" },
  { key: "legal.cookies", href: "/politica-cookies", label: "Cookies" },
  { key: "legal.accessibility", href: "/accesibilidad", label: "Accesibilidad" },
] as const;

export type LegalContentKey = (typeof legalNavigation)[number]["key"];

export const legalContentDefaults: Record<LegalContentKey, LegalContent> = {
  "legal.notice": {
    title: "Aviso legal",
    summary: "Titularidad del sitio y condiciones de uso de El Hierro Premia Deportistas.",
    updatedAt: "2026-10-01",
    sections: [
      {
        id: "titular", title: "Titular y contacto",
        items: [
          "Titular: Excmo. Cabildo Insular de El Hierro.",
          "CIF: P3800003J.",
          "Domicilio institucional: Calle Doctor Quintero, 11, 38900 Valverde, El Hierro, España.",
          "Contacto del programa: Área de Deportes del Cabildo de El Hierro. Teléfono: 922 554 132.",
        ],
        links: [
          { label: "deportes@elhierro.es", href: "mailto:deportes@elhierro.es" },
          { label: "Información institucional del Cabildo", href: "https://www.elhierro.es/es/aviso-legal" },
        ],
      },
      {
        id: "finalidad", title: "Finalidad del sitio",
        paragraphs: [
          "El Hierro Premia Deportistas informa sobre el programa de bonos para participantes en pruebas deportivas de la isla, muestra los comercios adheridos y permite consultar el saldo y la vigencia de los bonos. Los comercios y administradores disponen de áreas de acceso para gestionar el programa y registrar los gastos.",
          "Las condiciones de utilización y las fechas aplicables se muestran en la información del programa y en cada bono. La presencia de un comercio en el directorio no supone una garantía sobre sus productos o servicios.",
        ],
        links: [{ label: "Consultar cómo funciona el bono", href: "/bono" }],
      },
      {
        id: "premios", title: "Bases de los premios y asignación de los bonos",
        paragraphs: [
          "El programa entrega bonos de compra de 30 € vinculados a una carrera y a un único comercio adherido. La entrega se realiza al retirar el dorsal conforme a las condiciones de la prueba. El sistema no selecciona participantes ganadores ni asigna previamente un código a un dorsal: los bonos emitidos pueden entregarse en cualquier orden.",
          "Los bonos se reparten de forma equilibrada entre los comercios adheridos a cada carrera. Cada vez que se emite uno, el sistema comprueba cuántos tiene asignados cada comercio y lo entrega a uno de los que menos han recibido. Así, por ejemplo, si tres comercios tienen 5, 5 y 4 bonos, el siguiente se asigna al que tiene 4; el reparto quedaría en 5, 5 y 5.",
          "El sistema aplica la misma regla a todos los comercios, sin elegirlos por la persona que recibe el bono ni por su dorsal. Si varios comercios tienen la misma cantidad, el orden alfabético sirve únicamente para resolver ese empate de manera automática. Mientras se mantenga el mismo grupo de comercios activos, ninguno puede acumular más de un bono de diferencia respecto a los demás. La asignación queda guardada en el bono.",
          "Cada bono tiene un saldo inicial de 30 €, solo puede gastarse en el comercio asignado y admite varias compras durante el periodo de validez indicado en el propio bono. No se canjea por efectivo ni genera cambio.",
          "Este apartado explica el funcionamiento técnico del sistema. Los requisitos para participar, la forma de entrega, el número de bonos y las demás condiciones oficiales de la convocatoria corresponden a las bases aprobadas por la organización y deben consultarse en su publicación oficial; este resumen no las sustituye.",
        ],
        links: [
          { label: "Cómo funciona el bono", href: "/bono" },
          { label: "Consultar dudas al programa", href: "mailto:deportes@elhierro.es" },
        ],
      },
      {
        id: "uso", title: "Uso responsable",
        paragraphs: [
          "Utiliza el sitio de forma lícita, facilita información correcta y conserva tus credenciales de acceso. No está permitido acceder a cuentas ajenas, buscar códigos de bonos mediante consultas automatizadas, alterar saldos ni interferir en el funcionamiento del servicio.",
          "El código y el QR permiten consultar un bono. Evita publicarlos o compartirlos con personas ajenas a su utilización. La consulta pública del saldo no autoriza a utilizar un bono que no te corresponde.",
        ],
      },
      {
        id: "contenidos", title: "Contenidos y enlaces",
        paragraphs: [
          "Los textos, fotografías, logotipos, diseños y demás contenidos pueden estar sujetos a derechos del Cabildo o de terceros. Su reutilización debe respetar los derechos aplicables y, cuando sea necesaria, contar con la autorización de su titular.",
          "Los datos de los comercios pueden actualizarse. Para confirmar horarios, disponibilidad o servicios, contacta con el establecimiento. Los mapas, rutas y otros enlaces externos corresponden a servicios de terceros sujetos a sus propias condiciones.",
          "El servicio puede interrumpirse por mantenimiento o incidencias técnicas. Si detectas un error en la información o en tu bono, comunícalo al contacto del programa.",
        ],
      },
      {
        id: "normativa", title: "Normativa aplicable",
        paragraphs: [
          "El uso del sitio se rige por la normativa española y europea que resulte aplicable, incluidas las normas sobre protección de datos, propiedad intelectual y accesibilidad. Las controversias se tramitarán ante los órganos competentes conforme a la ley, respetando los derechos de las personas usuarias.",
        ],
        links: [
          { label: "Política de privacidad", href: "/politica-privacidad" },
          { label: "Política de cookies", href: "/politica-cookies" },
        ],
      },
    ],
  },
  "legal.privacy": {
    title: "Privacidad",
    summary: "Cómo se utiliza la información en las consultas de bonos y en las cuentas del programa.",
    updatedAt: "2026-10-01",
    sections: [
      {
        id: "responsable", title: "Responsable del tratamiento",
        paragraphs: [
          "El responsable es el Excmo. Cabildo Insular de El Hierro, CIF P3800003J, con domicilio en Calle Doctor Quintero, 11, 38900 Valverde, El Hierro. Puedes contactar con el Delegado de Protección de Datos en dpd@elhierro.es y con el programa en deportes@elhierro.es.",
        ],
        links: [
          { label: "Contactar con Protección de Datos", href: "mailto:dpd@elhierro.es" },
          { label: "Política de privacidad institucional", href: "https://www.elhierro.es/es/politica-de-privacidad" },
        ],
      },
      {
        id: "datos", title: "Información que se trata",
        items: [
          "Cuentas: usuario, nombre, apellidos y correo de los administradores; cuenta y comercio asociado para los accesos de los establecimientos. Las contraseñas se guardan mediante un resumen criptográfico con sal, no como texto legible.",
          "Comercios: nombre, actividad, dirección, municipio, teléfono, horario, descripción, imágenes y coordenadas para el directorio y el mapa. Los datos de contacto de una persona física pueden ser datos personales.",
          "Bonos y gastos: código, carrera, comercio asignado, fechas, importe, saldo y movimientos de compra. En esta aplicación los bonos no se vinculan al nombre, DNI ni dorsal del participante.",
          "Seguridad y funcionamiento: identificadores de sesión, consultas, intentos de acceso y datos técnicos de conexión. La limitación de consultas utiliza un identificador derivado de la dirección IP mediante HMAC; ese identificador sigue siendo un dato seudonimizado.",
          "Comunicaciones: los datos que incluyas si contactas con el programa por correo u otros canales de atención.",
        ],
      },
      {
        id: "finalidades", title: "Finalidades y base jurídica",
        paragraphs: [
          "La información se utiliza para gestionar el programa, mantener las cuentas, publicar el directorio, emitir y consultar bonos, registrar gastos y prevenir accesos o consultas abusivas. La gestión pública del programa se encuadra en el cumplimiento de una misión de interés público y, cuando corresponda, de obligaciones legales (artículos 6.1.e y 6.1.c del RGPD). Esta política no sustituye las bases de la convocatoria ni la información específica de otros trámites del Cabildo.",
          "Las comunicaciones que envíes se atienden para responder y tramitar tu solicitud. Cuando un tratamiento requiera consentimiento, se solicitará para esa finalidad y podrás retirarlo sin afectar al tratamiento realizado previamente.",
          "No se utilizan estos datos para publicidad personalizada ni para elaborar perfiles comerciales. Los controles automáticos de seguridad pueden limitar temporalmente el acceso; puedes comunicar una incidencia para que se revise.",
        ],
      },
      {
        id: "consulta", title: "Consulta de bonos, cámara y mapas",
        paragraphs: [
          "La ficha de un bono es accesible a quien conoce su código: muestra el comercio, la carrera, la vigencia, el saldo y los importes y fechas de los gastos. Conserva el código y el QR y evita su difusión pública.",
          "Los lectores QR de la consulta de bonos y del área de comercios solicitan permiso para usar la cámara. La lectura de las imágenes se realiza en el dispositivo; la aplicación utiliza el código leído para consultar o validar el bono y no almacena ni sube las imágenes de la cámara. También puedes introducir el código manualmente.",
          "Los mapas cargan cartografía de OpenFreeMap, basada en datos de OpenStreetMap. Sus servidores reciben datos técnicos de conexión, como la IP y las solicitudes de mapas; el proveedor informa de registros técnicos anonimizados y posibles registros temporales de seguridad. El servicio de mapas no utiliza cookies. La aplicación no solicita tu ubicación para mostrar los comercios. La búsqueda de direcciones de establecimientos utiliza Nominatim, de OpenStreetMap, y envía la dirección que se quiere localizar. Al abrir una ruta o un enlace externo se aplican las condiciones del servicio de destino.",
        ],
        links: [{ label: "Política de privacidad de OpenFreeMap", href: "https://openfreemap.org/privacy/" }],
      },
      {
        id: "proveedores", title: "Proveedores y destinatarios",
        paragraphs: [
          "Vercel presta el alojamiento y Supabase el servicio de base de datos. La base de datos del proyecto está configurada en Irlanda. La ubicación europea de la base de datos no excluye posibles accesos o transferencias internacionales derivados de los proveedores y sus subencargados; sus condiciones de tratamiento contemplan mecanismos como las cláusulas contractuales tipo.",
          "Los comercios acceden a la información necesaria para validar los bonos que tienen asignados y registrar su gasto. Los administradores autorizados gestionan el programa. También podrá comunicarse información a las autoridades cuando exista una obligación legal.",
        ],
        links: [
          { label: "Condiciones de tratamiento de Vercel", href: "https://vercel.com/legal/dpa" },
          { label: "Condiciones de tratamiento de Supabase", href: "https://supabase.com/legal/customer-resources/data-processing-addendum" },
        ],
      },
      {
        id: "conservacion", title: "Conservación",
        paragraphs: [
          "Las cuentas se conservan mientras sean necesarias para gestionar el programa. La sesión de la aplicación caduca a las 12 horas o se cierra al salir de la cuenta. Los registros de seguridad se mantienen durante el tiempo necesario para prevenir e investigar incidencias.",
          "Los bonos, gastos y comunicaciones se conservan para la gestión y justificación del programa y durante los plazos exigidos por la normativa administrativa, contable y de archivo aplicable. Cuando proceda, los datos se bloquearán para atender responsabilidades antes de su supresión.",
        ],
      },
      {
        id: "derechos", title: "Tus derechos",
        paragraphs: [
          "Puedes solicitar acceso, rectificación, supresión, limitación y oposición, así como portabilidad cuando resulte aplicable. Dirige tu solicitud al Cabildo, identificando el derecho que deseas ejercer, por su sede electrónica, por registro o mediante el contacto del Delegado de Protección de Datos. Solo se pedirá información de identidad adicional cuando sea necesaria para tramitarla.",
          "También puedes presentar una reclamación ante la Agencia Española de Protección de Datos. Para dudas sobre un saldo o una compra, contacta con el programa en deportes@elhierro.es.",
        ],
        links: [
          { label: "Sede electrónica del Cabildo", href: "https://elhierro.sedelectronica.es/" },
          { label: "Agencia Española de Protección de Datos", href: "https://www.aepd.es/" },
        ],
      },
    ],
  },
  "legal.cookies": {
    title: "Cookies",
    summary: "Información sobre la sesión de acceso y las tecnologías utilizadas por este sitio.",
    updatedAt: "2026-10-01",
    sections: [
      {
        id: "que-son", title: "Qué son las cookies",
        paragraphs: [
          "Las cookies son pequeños datos que un sitio guarda en el navegador y recibe en visitas posteriores. Pueden servir para mantener una sesión, recordar preferencias o medir actividad. Esta aplicación utiliza una cookie técnica para los accesos de comercios y administradores.",
        ],
      },
      {
        id: "cookie-sesion", title: "Cookie de la aplicación",
        table: {
          headings: ["Nombre", "Finalidad", "Duración", "Tipo"],
          rows: [["bonos_session", "Identificar la sesión de un comercio o administrador tras iniciar sesión.", "12 horas; se elimina del navegador al cerrar sesión.", "Propia, técnica y necesaria."]],
        },
        paragraphs: [
          "La cookie contiene un identificador de sesión, no la contraseña. Se configura como HttpOnly, para evitar su lectura desde JavaScript, con SameSite=Lax y transmisión segura por HTTPS en producción. Al cambiar de cuenta se sustituye la sesión anterior.",
          "El código de la aplicación no incorpora cookies de publicidad ni herramientas de analítica de audiencia. La consulta pública de bonos no necesita iniciar una sesión de comercio o administrador.",
        ],
      },
      {
        id: "servicios", title: "Servicios externos",
        paragraphs: [
          "La protección de acceso del alojamiento de Vercel puede utilizar sus propios mecanismos de autenticación, distintos de la sesión de esta aplicación. Cuando se muestre ese control, se aplicarán las condiciones de Vercel.",
          "Los mapas solicitan cartografía a OpenFreeMap, que recibe datos técnicos de conexión y no utiliza cookies. Abrir una ruta o visitar un enlace externo lleva a un servicio con su propia política. Puedes consultar más información sobre estos tratamientos en la página de Privacidad.",
        ],
        links: [{ label: "Privacidad y servicios de mapas", href: "/politica-privacidad#consulta" }],
      },
      {
        id: "control", title: "Cómo gestionarlas",
        paragraphs: [
          "Puedes eliminar o bloquear las cookies desde la configuración de privacidad de tu navegador. Si bloqueas bonos_session, no podrás mantener el acceso a las áreas privadas. Para finalizar la sesión utiliza también la opción «Cerrar sesión» de tu cuenta.",
          "Las cookies estrictamente necesarias para prestar un servicio solicitado están exceptuadas del consentimiento previo conforme al artículo 22.2 de la Ley 34/2002. Si se incorporan cookies que requieran consentimiento, deberán ofrecerse las opciones de aceptarlas o rechazarlas antes de instalarlas y esta política se actualizará.",
        ],
        links: [{ label: "Guía sobre el uso de cookies de la AEPD", href: "https://www.aepd.es/guias/guia-cookies.pdf" }],
      },
    ],
  },
  "legal.accessibility": {
    title: "Accesibilidad",
    summary: "Acceso a la información del programa y canales para comunicar dificultades de uso.",
    updatedAt: "2026-10-01",
    sections: [
      {
        id: "compromiso", title: "Compromiso y alcance",
        paragraphs: [
          "El Cabildo Insular de El Hierro trabaja para que la información de El Hierro Premia Deportistas pueda utilizarse por todas las personas. Esta página se refiere al sitio y a sus áreas de consulta, comercios y administración.",
          "El marco de referencia es el Real Decreto 1112/2018 sobre accesibilidad del sector público y los requisitos aplicables de la norma EN 301 549, que incluyen criterios WCAG de nivel AA.",
        ],
        links: [{ label: "Real Decreto 1112/2018", href: "https://www.boe.es/buscar/act.php?id=BOE-A-2018-12699" }],
      },
      {
        id: "estado", title: "Situación de cumplimiento",
        paragraphs: [
          "El nivel de conformidad del sitio está pendiente de una evaluación completa. Esta información describe las funciones disponibles y las alternativas de acceso; no acredita el cumplimiento total o parcial de la norma. La declaración se actualizará con el resultado y las limitaciones concretas que se identifiquen en esa evaluación.",
          "Fecha de preparación de esta información: 1 de octubre de 2026. Se ha elaborado a partir de las funciones de la aplicación, sin una auditoría completa de accesibilidad.",
        ],
      },
      {
        id: "alternativas", title: "Alternativas de acceso",
        items: [
          "Directorio de comercios: junto al mapa hay un listado con información de los establecimientos. Puedes utilizarlo sin seleccionar puntos en el mapa.",
          "Consulta de bonos: introduce el código para consultar el saldo, las fechas y los gastos; no necesitas escanear el QR.",
          "Validación en comercios: el código puede introducirse manualmente como alternativa al lector de cámara.",
          "Documentos: si necesitas la información de un bono o de una exportación en un formato accesible, puedes solicitarla al contacto del programa.",
        ],
        links: [
          { label: "Listado de comercios", href: "/comercios" },
          { label: "Consultar un bono", href: "/bono" },
        ],
      },
      {
        id: "comunicaciones", title: "Comunicar una dificultad",
        paragraphs: [
          "Si encuentras una barrera, una información difícil de utilizar o necesitas una alternativa accesible, escribe a deportes@elhierro.es o llama al 922 554 132. Indica la página, la dificultad y, si lo conoces, el navegador o la tecnología de apoyo que utilizas. Incluye un medio de contacto si necesitas respuesta.",
          "Puedes presentar solicitudes de información accesible, quejas y reclamaciones a través del registro o de la sede electrónica del Cabildo, identificando el sitio y el motivo. Si una respuesta no resuelve tu solicitud, puedes presentar una reclamación conforme al procedimiento previsto en el Real Decreto 1112/2018.",
        ],
        links: [
          { label: "deportes@elhierro.es", href: "mailto:deportes@elhierro.es" },
          { label: "922 554 132", href: "tel:922554132" },
          { label: "Sede electrónica del Cabildo", href: "https://elhierro.sedelectronica.es/" },
        ],
      },
    ],
  },
};
