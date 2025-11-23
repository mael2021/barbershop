import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CalendarProps {
  value?: string;
  onChange?: (date: string) => void;
  minDate?: string;
  className?: string;
}

export const Calendar = ({ value, onChange, minDate, className }: CalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    if (value) {
      const date = new Date(value + "T00:00:00");
      setSelectedDate(date);
      setCurrentMonth(date);
    }
  }, [value]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Agregar días vacíos al inicio
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Agregar los días del mes
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const handleDateClick = (date: Date) => {
    // Verificar fecha mínima si se proporciona
    if (minDate) {
      const minDateObj = new Date(minDate + "T00:00:00");
      const selectedDateAtMidnight = new Date(date);
      selectedDateAtMidnight.setHours(0, 0, 0, 0);
      minDateObj.setHours(0, 0, 0, 0);

      if (selectedDateAtMidnight < minDateObj) return;
    }

    // No permitir seleccionar fechas pasadas (pero SÍ permitir hoy)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateAtMidnight = new Date(date);
    selectedDateAtMidnight.setHours(0, 0, 0, 0);

    // Solo bloquear si es estrictamente menor que hoy (no igual)
    if (selectedDateAtMidnight < today) return;

    setSelectedDate(date);
    if (onChange) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      onChange(`${year}-${month}-${day}`);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  const dayNames = ["D", "L", "M", "X", "J", "V", "S"];

  const isDateDisabled = (date: Date) => {
    if (!date) return true;

    // Deshabilitar domingos y lunes
    if (date.getDay() === 0 || date.getDay() === 1) return true;

    // Verificar fecha mínima si se proporciona
    if (minDate) {
      const minDateObj = new Date(minDate + "T00:00:00");
      const dateAtMidnight = new Date(date);
      dateAtMidnight.setHours(0, 0, 0, 0);
      minDateObj.setHours(0, 0, 0, 0);

      if (dateAtMidnight < minDateObj) return true;
    }

    // Deshabilitar fechas pasadas (pero NO hoy)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateAtMidnight = new Date(date);
    dateAtMidnight.setHours(0, 0, 0, 0);

    // Solo deshabilitar si es estrictamente menor que hoy (no igual)
    return dateAtMidnight < today;
  };

  const isSameDay = (date1: Date | null, date2: Date | null) => {
    if (!date1 || !date2) return false;
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return isSameDay(date, today);
  };

  return (
    <div className="flex w-full items-center justify-center py-4">
      <div
        className={cn(
          "w-full max-w-sm rounded-2xl border border-gray-600/40 bg-gradient-to-br from-graffiti-dark/90 to-graffiti-dark/95 p-4 shadow-2xl ring-1 ring-white/5 backdrop-blur-md",
          className
        )}
      >
        {/* Header del calendario */}
        <div className="mb-4 flex items-center justify-between px-2">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="group rounded-xl p-2 transition-all duration-300 hover:scale-110 hover:bg-gray-700/40"
          >
            <ChevronLeft className="h-4 w-4 text-gray-400 transition-colors group-hover:text-white" />
          </button>

          <div className="text-center">
            <h3 className="bg-gradient-to-r from-spray-orange to-electric-blue bg-clip-text text-base font-bold tracking-wide text-transparent text-white">
              {monthNames[currentMonth.getMonth()]}
            </h3>
            <p className="text-xs font-medium text-gray-400">{currentMonth.getFullYear()}</p>
          </div>

          <button
            type="button"
            onClick={goToNextMonth}
            className="group rounded-xl p-2 transition-all duration-300 hover:scale-110 hover:bg-gray-700/40"
          >
            <ChevronRight className="h-4 w-4 text-gray-400 transition-colors group-hover:text-white" />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="mb-3 grid grid-cols-7 gap-1 px-1">
          {dayNames.map((day, index) => (
            <div
              key={day}
              className={cn(
                "rounded-lg py-2 text-center text-xs font-bold",
                index === 0 ? "bg-red-500/5 text-red-400" : "bg-gray-700/20 text-gray-400"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Días del mes */}
        <div className="grid grid-cols-7 gap-1 px-1">
          {getDaysInMonth(currentMonth).map((date, index) => (
            <div key={index} className="flex aspect-square items-center justify-center">
              {date && (
                <button
                  type="button"
                  onClick={() => handleDateClick(date)}
                  disabled={isDateDisabled(date)}
                  className={cn(
                    "relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl text-sm font-semibold transition-all duration-300",
                    // Estados base
                    isDateDisabled(date)
                      ? "cursor-not-allowed text-gray-600 opacity-30"
                      : "cursor-pointer hover:scale-110 hover:bg-gray-700/30 hover:text-white hover:shadow-lg",
                    // Día seleccionado
                    isSameDay(date, selectedDate) && !isDateDisabled(date)
                      ? "scale-110 bg-gradient-to-r from-spray-orange to-electric-blue text-white shadow-xl ring-2 ring-white/20"
                      : "text-gray-300",
                    // Día actual
                    isToday(date) && !isSameDay(date, selectedDate)
                      ? "border-2 border-neon-green/40 bg-gradient-to-r from-neon-green/15 to-urban-purple/15 text-neon-green shadow-lg"
                      : "",
                    // Domingos y lunes
                    (date.getDay() === 0 || date.getDay() === 1) &&
                      "border border-red-500/20 bg-red-900/10 text-red-400/50"
                  )}
                >
                  {date.getDate()}
                  {/* Indicador especial para el día actual */}
                  {isToday(date) && !isSameDay(date, selectedDate) && (
                    <div className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 transform rounded-full bg-neon-green shadow-lg"></div>
                  )}
                  {/* Efecto de brillo para día seleccionado */}
                  {isSameDay(date, selectedDate) && !isDateDisabled(date) && (
                    <div className="absolute inset-0 rounded-xl bg-white/10"></div>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Mensaje informativo más elegante */}
        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-600/30 bg-gray-800/40 px-4 py-2 text-xs text-gray-400 backdrop-blur-sm">
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-500 opacity-70"></div>
            <span className="font-medium">Lunes y domingos cerrado</span>
          </div>
        </div>
      </div>
    </div>
  );
};
