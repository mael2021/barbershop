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
    // No permitir seleccionar domingos
    if (date.getDay() === 0) return;
    
    // No permitir seleccionar fechas pasadas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return;

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
    
    // Deshabilitar domingos
    if (date.getDay() === 0) return true;
    
    // Deshabilitar fechas pasadas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
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
    <div className={cn("bg-graffiti-dark/80 backdrop-blur-sm border border-gray-600/50 rounded-xl p-3 max-w-xs mx-auto shadow-2xl", className)}>
      {/* Header del calendario */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="p-1.5 hover:bg-gray-700/50 rounded-lg transition-all duration-200 hover:scale-105"
        >
          <ChevronLeft className="h-4 w-4 text-gray-400 hover:text-white" />
        </button>
        
        <h3 className="text-white font-bold text-sm tracking-wide">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        
        <button
          type="button"
          onClick={goToNextMonth}
          className="p-1.5 hover:bg-gray-700/50 rounded-lg transition-all duration-200 hover:scale-105"
        >
          <ChevronRight className="h-4 w-4 text-gray-400 hover:text-white" />
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day, index) => (
          <div
            key={day}
            className={cn(
              "text-center text-xs font-medium py-1.5",
              index === 0 ? "text-red-400" : "text-gray-500"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Días del mes */}
      <div className="grid grid-cols-7 gap-1">
        {getDaysInMonth(currentMonth).map((date, index) => (
          <div key={index} className="aspect-square">
            {date && (
              <button
                type="button"
                onClick={() => handleDateClick(date)}
                disabled={isDateDisabled(date)}
                className={cn(
                  "w-full h-full rounded-lg transition-all duration-200 text-xs font-medium relative overflow-hidden",
                  // Estados base
                  isDateDisabled(date)
                    ? "text-gray-600 cursor-not-allowed opacity-40"
                    : "hover:bg-gray-700/50 hover:text-white cursor-pointer hover:scale-105",
                  // Día seleccionado
                  isSameDay(date, selectedDate) && !isDateDisabled(date)
                    ? "bg-gradient-to-r from-spray-orange to-electric-blue text-white shadow-lg scale-105"
                    : "text-gray-300",
                  // Día actual
                  isToday(date) && !isSameDay(date, selectedDate)
                    ? "bg-gradient-to-r from-neon-green/20 to-urban-purple/20 text-neon-green border border-neon-green/30"
                    : "",
                  // Domingos
                  date.getDay() === 0 && "bg-red-900/10 text-red-500/60 border border-red-500/20"
                )}
              >
                {date.getDate()}
                {/* Indicador especial para el día actual */}
                {isToday(date) && !isSameDay(date, selectedDate) && (
                  <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-neon-green rounded-full"></div>
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Mensaje informativo más elegante */}
      <div className="mt-3 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-gray-400 bg-gray-800/30 px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 bg-red-500 rounded-full opacity-60"></div>
          <span>Domingos cerrado</span>
        </div>
      </div>
    </div>
  );
}; 