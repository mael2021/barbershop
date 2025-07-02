import { format } from "@formkit/tempo";
import { SummaryItem } from "@/components";
import { services } from "@/consts/services";

interface BookingSummaryProps {
  services: string[];
  date: string;
  time: string;
}

export const BookingSummary = ({ services: selectedServices, date, time }: BookingSummaryProps) => {
  // Calcular el precio total
  const totalPrice = selectedServices.reduce((total, serviceName) => {
    const service = services.find(s => s.name === serviceName);
    return total + (service?.price || 0);
  }, 0);

  // Obtener la duración total estimada (asumiendo que los servicios se hacen secuencialmente)
  const totalDuration = selectedServices.reduce((total, serviceName) => {
    const service = services.find(s => s.name === serviceName);
    if (service?.duration === "1 hora") return total + 60;
    const minutes = parseInt(service?.duration?.match(/\d+/)?.[0] || "0");
    return total + minutes;
  }, 0);

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hora${hours > 1 ? 's' : ''}`;
      }
      return `${hours}h ${remainingMinutes}min`;
    }
    return `${minutes} min`;
  };

  return (
    <div className="rounded-lg border border-gray-600 bg-graffiti-dark p-4">
      <h4 className="graffiti-text graffiti-shadow mb-3 text-2xl font-bold text-white uppercase">Resumen de la cita</h4>
      <div className="space-y-2">
        <div>
          <span className="text-sm font-bold text-gray-300 uppercase">Servicios:</span>
          <div className="mt-1 space-y-1">
            {selectedServices.map((serviceName) => {
              const service = services.find(s => s.name === serviceName);
              return (
                <div key={serviceName} className="flex justify-between text-sm">
                  <span className="text-white">{serviceName}</span>
                  <span className="text-spray-orange">${service?.price} MXN</span>
                </div>
              );
            })}
            <div className="border-t border-gray-600 pt-1 flex justify-between font-bold">
              <span className="text-white">Total:</span>
              <span className="text-spray-orange">${totalPrice} MXN</span>
            </div>
          </div>
        </div>
        <SummaryItem label="Fecha" value={format(date, "full")} />
        <SummaryItem label="Hora" value={time} />
        <SummaryItem label="Duración estimada" value={formatDuration(totalDuration)} />
      </div>
    </div>
  );
};
