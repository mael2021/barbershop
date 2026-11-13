// Fechas en las que la barbería permanece cerrada (formato YYYY-MM-DD)
export const CLOSED_DATES = [
  "2026-04-03",
  "2026-04-04",
  "2026-11-23",
  "2026-11-24",
  "2026-11-25",
  "2026-11-26",
  "2026-11-27",
  "2026-11-28",
];

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

// Horario especial con apertura temprana de 7:00 AM a 8:00 PM (citas de 1 hora)
const EARLY_OPENING_SLOTS = [
  "7:00 AM",
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
  "7:00 PM",
  "8:00 PM",
];

const EARLY_OPENING_SCHEDULE: SpecialSchedule = {
  hours: "7:00 AM - 8:00 PM",
  slots: EARLY_OPENING_SLOTS,
};

// Horario especial de 10:00 AM a 6:00 PM (citas de 1 hora)
const SUNDAY_10_TO_6_SLOTS = [
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

const SUNDAY_10_TO_6_SCHEDULE: SpecialSchedule = {
  hours: "10:00 AM - 6:00 PM",
  slots: SUNDAY_10_TO_6_SLOTS,
};

// Días con horario distinto al habitual. Sobrescriben el horario del día de la
// semana (incluidos los domingos, que normalmente están cerrados).
export const SPECIAL_SCHEDULES: Record<string, SpecialSchedule> = {
  "2026-08-29": EXTENDED_MORNING_SCHEDULE,
  "2026-08-30": EXTENDED_MORNING_SCHEDULE,
  "2026-09-22": EARLY_OPENING_SCHEDULE,
  "2026-09-23": EARLY_OPENING_SCHEDULE,
  "2026-11-15": SUNDAY_10_TO_6_SCHEDULE,
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

// Grupos de días cerrados consecutivos que aún están vigentes o por venir
export const getUpcomingClosedDateGroups = (): string[][] => {
  const todayKey = toDateKey(new Date());
  const sorted = [...CLOSED_DATES].sort((a, b) => a.localeCompare(b));
  const groups: string[][] = [];

  for (const date of sorted) {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup) {
      groups.push([date]);
      continue;
    }
    const prevDate = new Date(lastGroup[lastGroup.length - 1] + "T00:00:00");
    const currDate = new Date(date + "T00:00:00");
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      lastGroup.push(date);
    } else {
      groups.push([date]);
    }
  }

  return groups.filter((group) => group[group.length - 1] >= todayKey);
};

// Formatea un grupo de fechas cerradas (ej. ["2026-11-23", ..., "2026-11-28"] -> "23, 24, 25, 26, 27 y 28 de noviembre")
export const formatClosedDatesGroup = (dates: string[]): string => {
  if (dates.length === 0) return "";

  const parsed = dates.map((d) => new Date(d + "T00:00:00"));
  const days = parsed.map((d) => d.getDate());
  const months = Array.from(
    new Set(parsed.map((d) => d.toLocaleDateString("es-MX", { month: "long" })))
  );

  const daysText =
    days.length === 1
      ? `${days[0]}`
      : `${days.slice(0, -1).join(", ")} y ${days[days.length - 1]}`;

  return `${daysText} de ${months.join(" / ")}`;
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
