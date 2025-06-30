import { getWhatsAppLink } from "@/lib/serviceLinks";

interface QuoteViaWhatsAppProps {
  nameService: string;
}

export const QuoteViaWhatsApp = ({ nameService }: QuoteViaWhatsAppProps) => {
  return (
    <a
      href={getWhatsAppLink(nameService)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-[#1c1e21] bg-[#25d366] px-4 py-2 text-sm leading-tight font-bold tracking-wide text-nowrap text-black uppercase"
    >
      Cotizar por WhatsApp
    </a>
  );
};
