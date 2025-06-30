import { services } from "@/consts/services";
import { ServiceCard } from "@/components";
import type { Service } from "@/types/service";

interface ServiceSectionProps {
  onBookService?: (service: string) => void;
}

export const ServiceSection = ({ onBookService }: ServiceSectionProps) => {
  const handleBookNow = (service: Service) => {
    onBookService?.(service.name);
  };

  return (
    <section>
      <header className="mb-12">
        <h2 className="graffiti-shadow mb-4 text-center font-anton text-5xl font-bold tracking-wide text-white uppercase">
          Nuestros servicios
        </h2>
        <p className="text-center text-sm leading-tight font-bold tracking-wide text-pretty text-gray-300 uppercase">
          Desde cortes clásicos hasta degradados modernos, llevamos la calle a tu estilo
        </p>
        <div className="mx-auto mt-3 h-1 w-24 bg-gradient-to-r from-electric-blue to-hot-pink"></div>
      </header>

      <div className="responsive-grid mx-auto max-w-4xl">
        {services.map((service, index) => (
          <ServiceCard key={index} {...service} onBookNow={() => handleBookNow(service)} />
        ))}
      </div>
    </section>
  );
};
