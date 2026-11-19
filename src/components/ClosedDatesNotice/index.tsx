import { CalendarX } from "lucide-react";
import { formatClosedDatesGroup } from "@/consts/schedule";

export const ClosedDatesNotice = ({ dates }: { dates: string[] }) => (
  <div
    role="status"
    className="mx-auto flex w-fit max-w-full items-center gap-2.5 rounded-lg border border-spray-orange/25 bg-graffiti-dark px-3 py-1.5 text-left"
  >
    <CalendarX aria-hidden="true" className="size-4 shrink-0 text-spray-orange" />
    <div className="min-w-0">
      <p className="text-xs leading-4 font-medium text-gray-300">Cierre temporal</p>
      <p className="text-sm leading-[1.125rem] font-semibold text-pretty text-white">{formatClosedDatesGroup(dates)}</p>
    </div>
  </div>
);
