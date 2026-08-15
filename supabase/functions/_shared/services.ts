// Catálogo de precios para armar el desglose del correo.
//
// ⚠️ Mantener en sync con src/consts/services.ts — las Edge Functions corren en Deno
// y no pueden importar del bundle de Vite (alias "@/..." no resuelve fuera de Vite).
// Si un servicio no aparece aquí, el correo lo lista sin precio y no rompe el total.
const PRICES: Record<string, number> = {
  "Desvanecido": 100,
  "Desvanecido + Lavado de Auto": 230,
  "Corte Normal": 100,
  "Corte a Tijera": 100,
  "Delineado de Barba": 50,
  "Desvanecido de Barba": 35,
  "Pigmentación": 30,
  "Afeitado con Navaja": 40,
  "Limpieza de Ceja": 20,
};

export type PricedService = { name: string; price: number | null };

export const priceServices = (names: string[]): { items: PricedService[]; total: number } => {
  const items = names.map(name => ({ name, price: PRICES[name] ?? null }));
  const total = items.reduce((sum, item) => sum + (item.price ?? 0), 0);

  return { items, total };
};
