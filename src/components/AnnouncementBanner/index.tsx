import { services, DESVANECIDO_LAVADO_AUTO } from "@/consts/services";
import { formatClosedDatesGroup, getUpcomingClosedDateGroups } from "@/consts/schedule";

export const AnnouncementBanner = ({ onBookService }: { onBookService: (service: string) => void }) => {
  const combo = services.find((s) => s.name === DESVANECIDO_LAVADO_AUTO);
  const closedGroups = getUpcomingClosedDateGroups();

  if (!combo && closedGroups.length === 0) return null;

  return (
    <div>
      {closedGroups.map((group) => {
        const formattedDates = formatClosedDatesGroup(group);
        return (
          <div
            key={group[0]}
            role="status"
            className="-mx-4 block w-[calc(100%+2rem)] border-b border-red-500/30 bg-red-950/60 px-4 py-2.5 backdrop-blur-sm"
          >
            <span className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 text-center text-xs sm:gap-3 sm:text-sm">
              <span className="rounded-full border border-red-500/40 bg-red-500/20 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-red-300 uppercase">
                Aviso
              </span>
              <span className="text-gray-200">
                Los días <span className="font-bold text-white">{formattedDates}</span> estaremos cerrados.
              </span>
            </span>
          </div>
        );
      })}
      {combo && (
        <button
          type="button"
          onClick={() => onBookService(DESVANECIDO_LAVADO_AUTO)}
          className="group -mx-4 block w-[calc(100%+2rem)] cursor-pointer border-b border-white/10 bg-black/40 px-4 py-2.5 backdrop-blur-sm transition-colors duration-300 hover:bg-black/60"
        >
          <span className="mx-auto flex max-w-4xl items-center justify-center gap-3 text-xs sm:text-sm">
            <span className="rounded-full bg-spray-orange/15 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-spray-orange uppercase">
              Nuevo
            </span>
            <span className="text-gray-300">
              {combo.name} · <span className="font-semibold text-white">${combo.price} MXN</span>
            </span>
            <span className="hidden font-semibold text-electric-blue transition-transform duration-300 group-hover:translate-x-0.5 sm:inline">
              Reservar →
            </span>
          </span>
        </button>
      )}
    </div>
  );
};
