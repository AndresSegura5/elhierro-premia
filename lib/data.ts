import type { Business, Race } from "./types";

export const raceDefaults: Race[] = [
  {
    id: "bestial",
    name: "Bestial Race El Hierro",
    shortName: "Bestial",
    couponQuantity: 400,
    startDate: "2026-10-03",
    validityDays: 7,
    color: "#d9462f",
    description: "Carrera de obstáculos entre pinares, pensada para poner a prueba tu fuerza y tu agilidad.",
    logoPath: "/branding/races/bestial-race.png",
    cardImagePath: "/images/races/bestial.jpg",
    cardImagePosition: "center 22%",
  },
  {
    id: "bimbache",
    name: "Bimbache Trail",
    shortName: "Bimbache",
    couponQuantity: 600,
    startDate: "2026-11-07",
    validityDays: 7,
    color: "#0f766e",
    description: "Trail por los senderos volcánicos del interior, entre bosques de laurisilva y fayal-brezal.",
    logoPath: "/branding/races/bimbache-trail-mark.png",
    cardImagePath: "/images/races/bimbache.jpg",
    cardImagePosition: "center top",
  },
  {
    id: "meridiano",
    name: "Maratón del Meridiano",
    shortName: "Maratón del Meridiano",
    couponQuantity: 1200,
    startDate: "2027-02-06",
    validityDays: 7,
    color: "#071626",
    description: "La prueba reina: una travesía de costa a costa siguiendo el meridiano cero.",
    logoPath: "/branding/races/maraton-meridiano-2026.png",
    cardImagePath: "/images/races/meridiano.jpg",
    cardImagePosition: "center",
  }
];

export const businesses: Business[] = [
  {
    id: "los-mocanes",
    name: "Tienda Los Mocanes",
    category: "Alimentación y producto local",
    municipality: "La Frontera",
    area: "Los Mocanes",
    phone: "922 55 00 14",
    address: "Calle Los Mocanes, 18, La Frontera",
    lat: 27.7568,
    lng: -18.0192,
    openingHours: "L-S 09:00-14:00 y 17:00-20:00",
    image: "/images/businesses/los-mocanes.jpg",
    description: "Comercio de cercanía con productos frescos, básicos para viaje y selección herreña."
  },
  {
    id: "deportes-valverde",
    name: "Deportes Valverde",
    category: "Material deportivo",
    municipality: "Valverde",
    area: "Centro",
    phone: "922 55 12 40",
    address: "Calle Doctor Quintero, 9, Valverde",
    lat: 27.8097,
    lng: -17.9158,
    openingHours: "L-V 10:00-13:30 y 16:30-20:00",
    image: "/images/businesses/deportes-valverde.jpg",
    description: "Equipamiento de montaña, running y artículos técnicos para deportistas."
  },
  {
    id: "sabores-pinar",
    name: "Sabores de El Pinar",
    category: "Restaurante",
    municipality: "El Pinar",
    area: "Taibique",
    phone: "922 55 85 22",
    address: "Av. Antonio García, 34, El Pinar",
    lat: 27.6991,
    lng: -17.9772,
    openingHours: "M-D 12:00-22:00",
    image: "/images/businesses/sabores-pinar.jpg",
    description: "Cocina local para recuperar fuerzas tras la carrera, con productos de la isla."
  },
  {
    id: "farmacia-frontera",
    name: "Farmacia Frontera",
    category: "Salud",
    municipality: "La Frontera",
    area: "Tigaday",
    phone: "922 55 60 03",
    address: "Calle Tigaday, 22, La Frontera",
    lat: 27.7544,
    lng: -18.0002,
    openingHours: "L-S 09:00-13:30 y 16:30-20:00",
    image: "/images/businesses/farmacia-frontera.jpg",
    description: "Atención sanitaria, recuperación muscular y productos de cuidado personal."
  },
  {
    id: "artesania-nisdafe",
    name: "Artesanía Nisdafe",
    category: "Artesanía y regalos",
    municipality: "Valverde",
    area: "San Andrés",
    phone: "922 55 21 77",
    address: "Carretera San Andrés, 11, Valverde",
    lat: 27.7755,
    lng: -17.9526,
    openingHours: "L-S 10:00-18:00",
    image: "/images/businesses/artesania-nisdafe.jpg",
    description: "Recuerdos, piezas artesanales y detalles hechos por creadores de la isla."
  }
];

export const couponRules = [
  "El bono tiene un saldo inicial de 30 € y solo puede utilizarse en el comercio asignado.",
  "Puede gastarse en varias compras dentro de su periodo de vigencia, hasta agotar el saldo.",
  "No se entrega cambio ni se canjea por efectivo.",
  "La fecha de inicio y el plazo de validez dependen de la carrera y figuran en el bono."
];

export const siteContentDefaults = {
  "home.hero": {
    titleTop: "El Hierro",
    titleHighlight: "premia",
    titleBottom: "a sus deportistas",
    offerLead: "Bono de",
    offerAmount: "30€",
    offerDescription: "Pensado para llevarte a descubrir el comercio de la isla",
    linkText: "Consulta tu bono",
    linkUrl: "/bono",
  },
  "coupon.page": {
    titleLead: "Cómo funciona",
    titleAccent: "tu bono",
    steps: [
      { icon: "ticket", title: "Recoge tu bono con el dorsal.", body: "Al retirar el dorsal de tu carrera recibes un bono de 30 € de esa prueba y válido en un comercio concreto de la isla." },
      { icon: "store", title: "Visita el comercio asignado.", body: "Cada bono va ligado a un único comercio local. La asignación es equitativa y prioriza los negocios con menos bonos de esa carrera." },
      { icon: "qr", title: "Presenta tu código QR.", body: "En el comercio, muestra el QR o el código. Puedes gastar el saldo en varias compras, siempre en el mismo negocio y antes del vencimiento." },
    ],
    racesHeading: "Tu carrera, tu bono",
    faqHeading: "Preguntas frecuentes",
    faqs: [
      { q: "¿En qué comercio puedo usar mi bono?", a: "Solo en el comercio que aparece en tu bono. Se asigna al emitir los bonos para repartir las visitas entre los negocios participantes, no según tu dorsal." },
      { q: "¿Qué pasa si no lo canjeo a tiempo?", a: "Cada carrera tiene una fecha de inicio y un plazo de vigencia propios. Consulta la fecha de vencimiento en tu bono." },
      { q: "¿Me pueden dar cambio o usarlo parcialmente?", a: "Puedes gastarlo en varias compras dentro del mismo comercio asignado, hasta agotar el saldo. No se entrega cambio en efectivo." },
      { q: "¿Puedo gastar más dinero del que ofrece el bono?", a: "Sí. Si el importe de la compra supera el saldo disponible del bono, puedes utilizarlo y abonar la diferencia restante mediante el medio de pago aceptado por el comercio. El bono quedará agotado cuando se consuma todo su saldo." },
      { q: "¿Puedo consultar el estado de mi bono?", a: "Sí, introduce tu código en el buscador para consultar el saldo, los gastos y la fecha de vencimiento." },
      { q: "He perdido mi bono, ¿qué hago?", a: "Si tienes una foto del código QR o del código alfanumérico, es suficiente: en el comercio pueden validar el bono escaneando el QR o introduciendo el código. Si no conservas ninguno, comunícalo a la organización en el punto de información; no es posible localizar el bono usando el dorsal porque no se vinculan al emitirlo." },
    ],
  },
} as const;

export function getBusiness(id: string) {
  return businesses.find((business) => business.id === id);
}
