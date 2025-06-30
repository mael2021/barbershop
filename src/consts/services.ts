import type { Service } from "@/types";

export const services: Service[] = [
  {
    name: "Corte Clásico",
    description: "Corte tradicional corto en los laterales y parte posterior de la cabeza.",
    price: 90,
    duration: "25 min",
    image: "/images/services/classic-cut.jpg",
  },
  {
    name: "Corte Moderno",
    description: "Corte donde el cabello se degrada progresivamente desde la parte superior hacia los lados y la nuca.",
    price: 100,
    duration: "30 min",
    image: "/images/services/modern-cut.jpg",
  },
  {
    name: "Grecas",
    description: "Diseños artísticos rasurados o dibujados en los laterales o parte posterior del cabello.",
    price: 25,
    duration: "10 min",
    image: "/images/services/designs.jpg",
  },
  {
    name: "Arreglo de Barba",
    description: "Recorte de precisión para una barba uniforme y bien definida.",
    price: 50,
    duration: "20 min",
    image: "/images/services/beard.jpg",
  },
];
