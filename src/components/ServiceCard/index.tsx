import type { Service } from "@/types/service";
import { QuoteViaWhatsApp } from "@/components";

export const ServiceCard = ({ name, description, duration, onBookNow, isCustomPriced, ...priceProps }: Service) => {
  const price = "price" in priceProps ? priceProps.price : undefined;
  const customPrice = "customPrice" in priceProps ? priceProps.customPrice : undefined;

  return (
    <article className="spray-effect group relative flex transform flex-col gap-y-4 overflow-hidden rounded-lg border-gray-600 bg-graffiti-gray p-5 transition-all duration-300 hover:scale-105 hover:border-electric-blue">
      <header>
        <h3 className="font-graffiti graffiti-shadow mb-2 text-3xl font-bold text-pretty text-white uppercase">
          {name}
        </h3>
        <p className="line-clamp-3 text-base text-pretty text-gray-300">{description}</p>
      </header>
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-neon-green tabular-nums">
            {isCustomPriced ? customPrice : `$${price} MXN`}
          </span>
          <span className="text-gray-400">⏱️{duration}</span>
        </div>
      </div>
      <div className="mt-auto w-full">
        {isCustomPriced ? (
          <QuoteViaWhatsApp nameService={name} />
        ) : (
          <button
            className="w-full cursor-pointer rounded-md bg-gradient-to-r from-urban-purple to-spray-orange px-4 py-2 text-center text-sm leading-tight font-bold tracking-wide text-nowrap text-white uppercase transition-all duration-300 hover:from-spray-orange hover:to-urban-purple"
            onClick={onBookNow}
          >
            Reservar ahora
          </button>
        )}
      </div>
    </article>
  );
};
