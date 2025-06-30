import { format } from "@formkit/tempo";
import { SummaryItem } from "@/components";

interface BookingSummaryProps {
  service: string;
  date: string;
  time: string;
}

export const BookingSummary = ({ service, date, time }: BookingSummaryProps) => {
  return (
    <div className="rounded-lg border border-gray-600 bg-graffiti-dark p-4">
      <h4 className="graffiti-text graffiti-shadow mb-3 text-2xl font-bold text-white uppercase">Resumen de la cita</h4>
      <div className="space-y-2">
        <SummaryItem label="Servicio" value={service} />
        <SummaryItem label="Fecha" value={format(date, "full")} />
        <SummaryItem label="Hora" value={time} />
      </div>
    </div>
  );
};
