import { useRef } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { Service } from "@/types/service";

const ServiceOption = ({ service }: { service: Service }) => (
  <span className="flex flex-col">
    <span className="font-medium text-white">{service.name}</span>
    <span className="text-xs text-gray-300 sm:text-sm sm:text-gray-400">
      {service.isCustomPriced ? service.customPrice || "Precio a consultar" : `$${service.price} MXN`} · {service.duration}
    </span>
  </span>
);

export const ServicePicker = ({ services, onSelect }: { services: Service[]; onSelect: (name: string) => void }) => {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  if (!services.length) return null;

  return (
    <>
      <details ref={detailsRef} className="group sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-gray-600 bg-graffiti-dark px-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-electric-blue [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <Plus aria-hidden="true" className="size-4 text-spray-orange" />
            Agregar servicio
          </span>
          <ChevronDown aria-hidden="true" className="size-4 text-gray-400 transition-transform group-open:rotate-180" />
        </summary>
        <ul
          aria-label="Servicios disponibles"
          className="relative mt-2 max-h-[min(14rem,36dvh)] divide-y divide-white/20 overflow-y-auto overscroll-contain rounded-lg border border-spray-orange/45 bg-graffiti-dark [scrollbar-color:var(--color-gray-500)_transparent] [scrollbar-width:thin]"
        >
          {services.map(service => (
            <li key={service.name}>
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-inset"
                onClick={() => {
                  const details = detailsRef.current;
                  if (details) {
                    details.open = false;
                    details.querySelector("summary")?.focus();
                  }
                  onSelect(service.name);
                }}
              >
                <ServiceOption service={service} />
              </button>
            </li>
          ))}
        </ul>
      </details>

      <div className="hidden sm:block">
        <Select value="" onValueChange={onSelect}>
          <SelectTrigger className="border-gray-600 bg-graffiti-dark text-white transition-colors hover:border-spray-orange">
            <span className="flex items-center gap-2">
              <Plus aria-hidden="true" className="size-4 text-spray-orange" />
              Agregar servicio
            </span>
          </SelectTrigger>
          <SelectContent
            align="center"
            sideOffset={4}
            collisionPadding={16}
            className="max-h-[min(24rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] border-gray-600 bg-graffiti-dark"
          >
            {services.map(service => (
              <SelectItem key={service.name} value={service.name} className="text-white hover:bg-gray-600 focus:bg-gray-600">
                <ServiceOption service={service} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
};
