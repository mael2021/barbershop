const WHATSAPP_PHONE = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER;

export function getWhatsAppLink(name: string, phone: string = WHATSAPP_PHONE): string {
  const message = `Hola, quiero cotizar el servicio de ${name}. ¿Me puedes dar más detalles?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
