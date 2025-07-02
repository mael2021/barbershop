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
    
    // Verificar fecha mínima si se proporciona
    if (minDate) {
      const minDateObj = new Date(minDate + "T00:00:00");
      if (date < minDateObj) return;
    }
    
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
    
    // Verificar fecha mínima si se proporciona
    if (minDate) {
      const minDateObj = new Date(minDate + "T00:00:00");
      if (date < minDateObj) return true;
    }
    
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
    <div className="flex justify-center items-center w-full py-4">
      <div className={cn(
        "bg-gradient-to-br from-graffiti-dark/90 to-graffiti-dark/95 backdrop-blur-md border border-gray-600/40 rounded-2xl p-4 max-w-sm w-full shadow-2xl ring-1 ring-white/5",
        className
      )}>
        {/* Header del calendario */}
        <div className="flex items-center justify-between mb-4 px-2">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-700/40 rounded-xl transition-all duration-300 hover:scale-110 group"
          >
            <ChevronLeft className="h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />
          </button>
          
          <div className="text-center">
            <h3 className="text-white font-bold text-base tracking-wide bg-gradient-to-r from-spray-orange to-electric-blue bg-clip-text text-transparent">
              {monthNames[currentMonth.getMonth()]}
            </h3>
            <p className="text-gray-400 text-xs font-medium">
              {currentMonth.getFullYear()}
            </p>
          </div>
          
          <button
            type="button"
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-700/40 rounded-xl transition-all duration-300 hover:scale-110 group"
          >
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-3 px-1">
          {dayNames.map((day, index) => (
            <div
              key={day}
              className={cn(
                "text-center text-xs font-bold py-2 rounded-lg",
                index === 0 ? "text-red-400 bg-red-500/5" : "text-gray-400 bg-gray-700/20"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Días del mes */}
        <div className="grid grid-cols-7 gap-1 px-1">
          {getDaysInMonth(currentMonth).map((date, index) => (
            <div key={index} className="aspect-square flex items-center justify-center">
              {date && (
                <button
                  type="button"
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
                    // Domingos
                    date.getDay() === 0 && "bg-red-900/10 text-red-400/50 border border-red-500/20"
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
        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center gap-2 text-xs text-gray-400 bg-gray-800/40 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-600/30">
            <div className="w-2 h-2 bg-red-500 rounded-full opacity-70 animate-pulse"></div>
            <span className="font-medium">Domingos cerrado</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 