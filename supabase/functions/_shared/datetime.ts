// La tabla `reservations` guarda la cita como hora de pared local:
//   date = "2026-08-15"  |  time = "9:00 AM"
// No hay zona horaria en la BD, así que aquí la resolvemos explícitamente.
export const TIMEZONE = Deno.env.get("BARBERSHOP_TIMEZONE") ?? "America/Mexico_City";

/** "9:00 AM" -> { hour: 9, minute: 0 } | "1:00 PM" -> { hour: 13, minute: 0 } */
export const parseTimeSlot = (time: string): { hour: number; minute: number } | null => {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  const [, rawHour, rawMinute, meridiem] = match;
  let hour = Number(rawHour) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;

  return { hour, minute: Number(rawMinute) };
};

/** Offset de la zona horaria (en ms) vigente en un instante dado. */
const timeZoneOffsetMs = (instant: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const at = (type: string) => Number(parts.find(p => p.type === type)?.value ?? "0");
  const asIfUtc = Date.UTC(at("year"), at("month") - 1, at("day"), at("hour") % 24, at("minute"), at("second"));

  return asIfUtc - instant.getTime();
};

/**
 * Convierte una hora de pared local ("2026-08-15" + 9:00 en TIMEZONE) al instante UTC real.
 * Se recalcula el offset una segunda vez para caer del lado correcto en cambios de horario
 * de verano (México ya no aplica DST, pero así queda correcto si cambia la zona).
 */
export const appointmentToUtc = (date: string, time: string, timeZone = TIMEZONE): Date | null => {
  const parsed = parseTimeSlot(time);
  const [year, month, day] = date.split("-").map(Number);
  if (!parsed || !year || !month || !day) return null;

  const wallClock = Date.UTC(year, month - 1, day, parsed.hour, parsed.minute);
  const firstPass = wallClock - timeZoneOffsetMs(new Date(wallClock), timeZone);
  const secondPass = wallClock - timeZoneOffsetMs(new Date(firstPass), timeZone);

  return new Date(secondPass);
};

/** "2026-08-15" -> "sábado, 15 de agosto de 2026" */
export const formatLongDate = (date: string, timeZone = TIMEZONE): string => {
  const asUtcNoon = new Date(`${date}T12:00:00Z`);
  const formatted = new Intl.DateTimeFormat("es-MX", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(asUtcNoon);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

/** Fecha de "hoy" (YYYY-MM-DD) en la zona de la barbería, no en UTC. */
export const todayInTimeZone = (now: Date, timeZone = TIMEZONE): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
