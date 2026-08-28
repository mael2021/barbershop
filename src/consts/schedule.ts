// Fechas en las que la barbería permanece cerrada (formato YYYY-MM-DD)
export const CLOSED_DATES = ["2026-04-03", "2026-04-04"];

interface SpecialSchedule {
  hours: string;
  slots: string[];
}

// Horario especial de 8:00 AM a 6:00 PM (citas de 1 hora)
const EXTENDED_MORNING_SLOTS = [
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
];

const EXTENDED_MORNING_SCHEDULE: SpecialSchedule = {
  hours: "8:00 AM - 6:00 PM",
  slots: EXTENDED_MORNING_SLOTS,
};

// Días con horario distinto al habitual. Sobrescriben el horario del día de la
// semana (incluidos los domingos, que normalmente están cerrados).
export const SPECIAL_SCHEDULES: Record<string, SpecialSchedule> = {
  "2026-08-29": EXTENDED_MORNING_SCHEDULE,
  "2026-08-30": EXTENDED_MORNING_SCHEDULE,
};

// Convierte un Date a la clave YYYY-MM-DD usada en las constantes de arriba
export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getSpecialSchedule = (date: string): SpecialSchedule | undefined => SPECIAL_SCHEDULES[date];

// Días con horario especial que todavía no han pasado, para anunciarlos en la web
export const getUpcomingSpecialSchedules = () => {
  const todayKey = toDateKey(new Date());
  return Object.entries(SPECIAL_SCHEDULES)
    .filter(([date]) => date >= todayKey)
    .sort(([a], [b]) => a.localeCompare(b));
};

// "2026-08-29" -> "Sábado 29 de agosto"
export const formatSpecialDate = (date: string) => {
  const formatted = new Date(date + "T00:00:00").toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};
