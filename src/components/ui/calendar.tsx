import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CLOSED_DATES, SPECIAL_SCHEDULES, toDateKey } from "@/consts/schedule";

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
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
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
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const dayNames = ["D", "L", "M", "X", "J", "V", "S"];

  const isDateDisabled = (date: Date) => {
    if (!date) return true;

    const dateKey = toDateKey(date);
    const hasSpecialSchedule = Boolean(SPECIAL_SCHEDULES[dateKey]);

    // Deshabilitar domingos, salvo los que tienen horario especial
    if (date.getDay() === 0 && !hasSpecialSchedule) return true;

    // Deshabilitar fechas cerradas específicas
    if (CLOSED_DATES.includes(dateKey)) return true;
    
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
    <div className="flex w-full items-center justify-center sm:py-4">
      <div className={cn(
        "bg-gradient-to-br from-graffiti-dark/90 to-graffiti-dark/95 backdrop-blur-md border border-gray-600/40 rounded-2xl px-2 py-1.5 sm:p-4 max-w-sm w-full shadow-2xl ring-1 ring-white/5",
        className
      )}>
        {/* Header del calendario */}
        <div className="mb-1 flex items-center justify-between px-2 sm:mb-4">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={goToPreviousMonth}
            className="group flex size-8 items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 hover:bg-gray-700/40"
          >
            <ChevronLeft className="h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />
          </button>
          
          <div className="flex items-baseline gap-1.5 text-center sm:block">
            <h3 className="text-white font-bold text-base tracking-wide bg-gradient-to-r from-spray-orange to-electric-blue bg-clip-text text-transparent">
              {monthNames[currentMonth.getMonth()]}
            </h3>
            <p className="text-gray-400 text-xs font-medium">
              {currentMonth.getFullYear()}
            </p>
          </div>
          
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={goToNextMonth}
            className="group flex size-8 items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 hover:bg-gray-700/40"
          >
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="mb-1.5 grid grid-cols-7 gap-1 sm:mb-3 sm:px-1">
          {dayNames.map((day, index) => (
            <div
              key={day}
              className={cn(
                "rounded-lg py-1 text-center text-xs font-bold sm:py-2",
                index === 0 ? "text-red-400 bg-red-500/5" : "text-gray-400 bg-gray-700/20"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Días del mes */}
        <div className="grid grid-cols-7 gap-x-1 gap-y-0.5 sm:gap-y-1 sm:px-1">
          {getDaysInMonth(currentMonth).map((date, index) => (
            <div key={index} className="flex h-[clamp(2rem,5.7dvh,2.5rem)] items-center justify-center sm:aspect-square sm:h-auto">
              {date && (
                <button
                  type="button"
                  aria-pressed={isSameDay(date, selectedDate)}
                  onClick={() => handleDateClick(date)}
                  disabled={isDateDisabled(date)}
                  className={cn(
                    "w-full h-full rounded-xl transition-all duration-300 text-sm font-semibold relative overflow-hidden flex items-center justify-center",
                    // Estados base
                    isDateDisabled(date)
                      ? "text-gray-600 cursor-not-allowed opacity-30"
                      : "hover:bg-gray-700/30 hover:text-white cursor-pointer hover:scale-110 hover:shadow-lg",
                    // Día seleccionado
                    isSameDay(date, selectedDate) && !isDateDisabled(date)
                      ? "bg-gradient-to-r from-spray-orange to-electric-blue text-white shadow-xl scale-110 ring-2 ring-white/20"
                      : "text-gray-300",
                    // Día actual
                    isToday(date) && !isSameDay(date, selectedDate)
                      ? "bg-gradient-to-r from-neon-green/15 to-urban-purple/15 text-neon-green border-2 border-neon-green/40 shadow-lg"
                      : "",
                    // Domingos cerrados y fechas cerradas
                    (date.getDay() === 0 || CLOSED_DATES.includes(toDateKey(date))) &&
                      isDateDisabled(date) &&
                      "bg-red-900/10 text-red-400/50 border border-red-500/20"
                  )}
                >
                  {date.getDate()}
                  {/* Indicador especial para el día actual */}
                  {isToday(date) && !isSameDay(date, selectedDate) && (
                    <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-neon-green rounded-full shadow-lg"></div>
                  )}
                  {/* Efecto de brillo para día seleccionado */}
                  {isSameDay(date, selectedDate) && !isDateDisabled(date) && (
                    <div className="absolute inset-0 bg-white/10 rounded-xl"></div>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Mensaje informativo más elegante */}
        <div className="mt-1 flex justify-center sm:mt-4">
          <div className="inline-flex items-center gap-2 text-xs text-gray-400 sm:rounded-full sm:border sm:border-gray-600/30 sm:bg-gray-800/40 sm:px-4 sm:py-2 sm:backdrop-blur-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full opacity-70 animate-pulse"></div>
            <span className="font-medium">Domingos cerrados</span>
          </div>
        </div>
      </div>
    </div>
  );
};
