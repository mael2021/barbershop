import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, User, Phone, X, ChevronLeft, ChevronRight, Plus, MessageCircle } from "lucide-react";
import { supabase } from "@/supabase/client";
import { services } from "@/consts/services";
import { toast } from "@pheralb/toast";
import { BookingSummary } from "@/components";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

// Eliminado: interfaz de eventos de Google ya no usada en disponibilidad local

interface BookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedService?: string;
  excludedServices?: string[];
}

const bookingFormSchema = z.object({
  services: z.array(z.string()).min(1, "Debes seleccionar al menos un servicio"),
  date: z.string().min(1, "La fecha es requerida"),
  time: z.string().min(1, "La hora es requerida"),
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .regex(/^[a-zA-ZÀ-ÿ\s]{2,}$/, "El nombre solo debe contener letras y espacios"),
  phone: z
    .string()
    .min(1, "El teléfono es requerido")
    .regex(/^[0-9]{10}$/, "Ingresa un número de teléfono válido (10 dígitos)")
    .transform(val => val.replace(/\D/g, "")),
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

export const BookingForm = ({ isOpen, onClose, preSelectedService, excludedServices = [] }: BookingFormProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Set<string>>(new Set());
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isCurrentStepValid, setIsCurrentStepValid] = useState(false);
  const serviceSetRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, touchedFields },
    trigger,
    reset,
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    mode: "onTouched",
    defaultValues: {
      services: [],
      date: "",
      time: "",
      name: "",
      phone: "",
    },
  });

  const formData = watch();

  // Función para obtener la fecha mínima formateada
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const timeSlots = [
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

  const sundayTimeSlots = [
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
  ];

  // Viernes usa horario estándar (10:00 AM - 8:00 PM) => no se requiere arreglo especial

  const filterPastTimeSlots = (date: string, availableSlots: Set<string>): Set<string> => {
    const today = new Date();
    const selectedDate = new Date(date + "T00:00:00");
    
    if (selectedDate.toDateString() !== today.toDateString()) {
      return availableSlots;
    }
    
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    
    const filteredSlots = new Set<string>();
    
    availableSlots.forEach(timeSlot => {
      const timeMatch = timeSlot.match(/(\d+):(\d+)\s*(AM|PM)/);
      if (!timeMatch) return;
      
      const [, hours, minutes, period] = timeMatch;
      let slotHour = parseInt(hours);
      const slotMinute = parseInt(minutes);
      
      if (period === "AM" && slotHour === 12) {
        slotHour = 0;
      } else if (period === "PM" && slotHour !== 12) {
        slotHour += 12;
      }
      
      const slotEndTime = new Date();
      slotEndTime.setHours(slotHour, slotMinute + 30, 0, 0); 
      
      const currentTime = new Date();
      currentTime.setHours(currentHour, currentMinute, 0, 0);
      
      if (slotEndTime > currentTime) {
        filteredSlots.add(timeSlot);
      }
    });
    
    return filteredSlots;
  };

  // Función para añadir un servicio
  const addService = (serviceName: string) => {
    const currentServices = formData.services || [];
    if (!currentServices.includes(serviceName)) {
      setValue("services", [...currentServices, serviceName], { shouldValidate: true });
    }
  };

  // Función para remover un servicio
  const removeService = (serviceName: string) => {
    const currentServices = formData.services || [];
    setValue("services", currentServices.filter(s => s !== serviceName), { shouldValidate: true });
  };

  // Función para obtener el precio total
  const getTotalPrice = () => {
    const selectedServices = formData.services || [];
    return selectedServices.reduce((total, serviceName) => {
      const service = services.find(s => s.name === serviceName);
      return total + (service?.price || 0);
    }, 0);
  };

  // Memoize validateCurrentStep to avoid infinite loops
  const validateCurrentStep = useCallback(async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = Boolean(formData.services && formData.services.length > 0);
        break;
      case 2:
        isValid = Boolean(formData.date);
        break;
      case 3:
        isValid = Boolean(formData.time);
        break;
      case 4:
        isValid = Boolean(formData.name && formData.phone);
        break;
    }

    setIsCurrentStepValid(isValid);
  }, [currentStep, formData.services, formData.date, formData.time, formData.name, formData.phone]);

  // Efecto para validar cuando cambia el paso o los datos
  useEffect(() => {
    validateCurrentStep();
  }, [validateCurrentStep]);

  // Efecto para manejar el servicio preseleccionado
  useEffect(() => {
    if (isOpen && preSelectedService && !serviceSetRef.current) {
      setValue("services", [preSelectedService], { shouldValidate: true });
      serviceSetRef.current = true;
      validateCurrentStep();
    }
  }, [preSelectedService, isOpen, setValue, validateCurrentStep]);

  // Efecto para resetear el formulario cuando se cierra
  useEffect(() => {
    if (!isOpen) {
      reset({
        services: [],
        date: "",
        time: "",
        name: "",
        phone: "",
      });
      serviceSetRef.current = false;
      setCurrentStep(1);
    }
  }, [isOpen, reset, setCurrentStep]);

  // Función para verificar disponibilidad consultando la base de datos (sin Google)
  const checkGoogleCalendarAvailability = async (date: string): Promise<Set<string>> => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("time, status")
        .eq("date", date)
        .eq("status", "confirmed");

      if (error) {
        console.error("Error al consultar reservas:", error);
        // Determinar si es domingo para usar horarios correctos
        const selectedDate = new Date(date + "T00:00:00");
        const isSunday = selectedDate.getDay() === 0;
        const slotsToUse = isSunday ? sundayTimeSlots : timeSlots;
        return filterPastTimeSlots(date, new Set(slotsToUse));
      }

      const reservedTimes = new Set<string>((data || []).map((r: { time: string }) => r.time));
      
      // Determinar si es domingo para usar horarios correctos
      const selectedDate = new Date(date + "T00:00:00");
      const isSunday = selectedDate.getDay() === 0;
      const slotsToUse = isSunday ? sundayTimeSlots : timeSlots;
      
      const available = new Set<string>(slotsToUse.filter((t) => !reservedTimes.has(t)));

      return filterPastTimeSlots(date, available);
    } catch (err) {
      console.error("Error al consultar disponibilidad en BD:", err);
      // Determinar si es domingo para usar horarios correctos
      const selectedDate = new Date(date + "T00:00:00");
      const isSunday = selectedDate.getDay() === 0;
      const slotsToUse = isSunday ? sundayTimeSlots : timeSlots;
      return filterPastTimeSlots(date, new Set(slotsToUse));
    }
  };

  // Función para cargar los horarios disponibles
  const loadAvailableSlots = async (date: string) => {
    if (!date) return;

    setIsLoadingSlots(true);
    try {
      const available = await checkGoogleCalendarAvailability(date);
      setAvailableSlots(available);
    } catch (error) {
      console.error("Error al cargar horarios disponibles:", error);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // Efecto para cargar los horarios cuando cambia la fecha
  useEffect(() => {
    if (formData.date) {
      loadAvailableSlots(formData.date);
    }
  }, [formData.date]);

  const nextStep = async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = await trigger("services");
        break;
      case 2:
        isValid = await trigger("date");
        break;
      case 3:
        isValid = await trigger("time");
        break;
      case 4:
        isValid = await trigger(["name", "phone"]);
        break;
    }

    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);

    try {
      // Verificar disponibilidad una última vez antes de crear la reserva
      const availableSlots = await checkGoogleCalendarAvailability(data.date);
      if (!availableSlots.has(data.time)) {
        toast.error({
          text: "Horario no disponible",
          description: "Lo sentimos, este horario ya ha sido reservado. Por favor, selecciona otro horario.",
        });
        setIsSubmitting(false);
        return;
      }

      // Insert into Supabase
      const { error: supabaseError } = await supabase
        .from("reservations")
        .insert([
          {
            services: data.services,
            date: data.date,
            time: data.time,
            customer_name: data.name,
            phone: data.phone,
            email: "no-email@barberia.com", // Valor por defecto
            status: "confirmed",
          },
        ])
        .select();

      if (supabaseError) {
        toast.error({
          text: "Upps, algo salió mal",
          description: "No se pudo crear tu reserva. Por favor, intenta nuevamente.",
        });
        return;
      }

      // Crear evento en Google Calendar usando la función edge
      const timeMatch = data.time.match(/(\d+):(\d+)\s*(AM|PM)/);
      if (!timeMatch) {
        throw new Error("Formato de hora inválido");
      }

      const [hours, minutes, period] = timeMatch.slice(1);
      const hour = parseInt(hours) + (period === "PM" && hours !== "12" ? 12 : 0);
      const minute = parseInt(minutes);

      // Asegurarnos de que la fecha se mantenga exactamente como la seleccionó el usuario
      const [year, month, day] = data.date.split("-").map(Number);

      // Crear la fecha de inicio
      const startDateTime = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;

      // Crear la fecha de fin (1 hora después)
      const endHour = (hour + 1) % 24;
      const endDateTime = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(endHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;

      const event = {
        summary: `Cita: ${data.services.join(", ")}`,
        description: `Cliente: ${data.name}\nTeléfono: ${data.phone}`,
        start: {
          dateTime: startDateTime,
          timeZone: "America/Mexico_City",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "America/Mexico_City",
        },
      };

      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: "create_event",
            event_data: event,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = typeof errorData.error === 'object' 
              ? errorData.error.message || JSON.stringify(errorData.error)
              : errorData.error;

          console.error("Error creating Google Calendar event:", errorMessage);
          if (errorMessage && errorMessage.includes('ADMIN_REAUTH_REQUIRED')) {
            toast.warning({
              text: "Reserva creada con advertencia",
              description: "La reserva se guardó, pero hay un problema con la sincronización de Google. Contacta al administrador.",
            });
          } else {
            toast.warning({
              text: "Reserva creada, pero hubo un error al sincronizar",
              description: "Tu reserva se guardó, pero no pudo aparecer en el calendario. Contacta al administrador.",
            });
          }
        } else {
          const result = await response.json();
          console.log("Evento creado exitosamente:", result);
        }

      } catch (calendarError) {
        console.error("Error creating Google Calendar event:", calendarError);
        toast.warning({
          text: "Reserva creada, pero hubo un error al sincronizar",
          description: "Tu reserva se guardó, pero no pudo aparecer en el calendario. Contacta al administrador.",
        });
      }

      toast.success({
        text: "¡Reserva confirmada! 🔥",
        description: "Tu cita ha sido agendada. ¡Te vemos en Master Cuts!",
      });

      onClose();
      setCurrentStep(1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast.error({
        text: "Upps, algo salió mal",
        description: `Ocurrió un error inesperado: ${errorMessage}. Por favor, intenta nuevamente.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWhatsApp = () => {
    const phoneNumber = "5212462021022";
    const message = encodeURIComponent(
      `¡Hola! 👋\n\nEstoy interesado en agendar una cita después de las 8:00 PM.\n\n📅 Fecha deseada: ${formData.date || 'Por definir'}\n💇‍♂️ Servicios: ${formData.services?.join(', ') || 'Por definir'}\n\n¿Hay disponibilidad?`
    );
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-gray-600 bg-graffiti-gray">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader className="relative border-b border-gray-600 p-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute top-4 right-4 cursor-pointer text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>

            <CardTitle className="text-center text-3xl text-white uppercase">Reserva tu cita</CardTitle>
            <CardDescription className="text-center text-white">
              Paso {currentStep} de 4 - ¡Vamos a que te veas genial!
            </CardDescription>

            {/* Progress Bar */}
            <div className="mt-4 h-2 w-full rounded-full bg-gray-700">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-spray-orange to-electric-blue transition-all duration-300"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              ></div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Step 1: Service Selection */}
            {currentStep === 1 && (
              <div className="animate-fade-in space-y-6">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-spray-orange to-electric-blue">
                    <Calendar className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-2 text-2xl font-bold text-white">Elige tus servicios</h3>
                  <p className="text-white">¿Qué estilos vamos a elegir hoy?</p>
                </div>

                <div className="space-y-4">
                  {/* Servicios seleccionados */}
                  {formData.services && formData.services.length > 0 ? (
                    <div className="space-y-3">
                      {formData.services.map((serviceName) => {
                        const service = services.find(s => s.name === serviceName);
                        return (
                          <div key={serviceName} className="flex items-center justify-between rounded-lg border border-gray-600 bg-graffiti-dark p-4">
                            <div>
                              <h5 className="font-bold text-white uppercase">{serviceName}</h5>
                              <div className="flex items-center gap-4 text-sm text-gray-400">
                                <span>${service?.price} MXN</span>
                                <span>{service?.duration}</span>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeService(serviceName)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                      
                      {/* Total */}
                      <div className="rounded-lg border border-spray-orange/30 bg-spray-orange/5 p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">Total:</span>
                          <span className="text-spray-orange font-bold text-lg">${getTotalPrice()} MXN</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8 text-gray-400">
                      <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p>No has seleccionado ningún servicio</p>
                    </div>
                  )}

                  {/* Botón para agregar servicio */}
                  <div className="text-center">
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value) addService(value);
                      }}
                    >
                      <SelectTrigger className="border-gray-600 bg-graffiti-dark text-white hover:border-spray-orange transition-colors">
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-spray-orange" />
                          <span>Agregar servicio</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="border-gray-600 bg-graffiti-dark">
                        {services
                          .filter(service => 
                            !excludedServices.includes(service.name) && 
                            !formData.services?.includes(service.name)
                          )
                          .map((service) => (
                            <SelectItem 
                              key={service.name} 
                              value={service.name} 
                              className="text-white hover:bg-gray-600 focus:bg-gray-600"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{service.name}</span>
                                <span className="text-sm text-gray-400">${service.price} MXN • {service.duration}</span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {errors.services && <p className="mt-1 text-sm text-red-500">{errors.services.message}</p>}
                </div>
              </div>
            )}

            {/* Step 2: Date Selection */}
            {currentStep === 2 && (
              <div className="animate-fade-in space-y-6">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-neon-green to-urban-purple">
                    <User className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-2 text-2xl font-bold text-white">Selecciona tu fecha</h3>
                  <p className="text-white">¿Cuándo harémos tu cita?</p>
                </div>

                <div className="space-y-4">
                  {/* Calendario para escritorio */}
                  <div className="hidden md:block">
                    <CalendarComponent
                      value={formData.date}
                      onChange={(date) => setValue("date", date, { shouldValidate: true })}
                      minDate={new Date().toISOString().split("T")[0]}
                    />
                  </div>

                  {/* Input de fecha para móvil */}
                  <div className="md:hidden">
                    <Label className="font-bold text-white uppercase">Fecha</Label>
                    <Input
                      type="date"
                      {...register("date")}
                      className={`border-gray-600 bg-graffiti-dark text-white placeholder-gray-400 ${
                        errors.date ? "border-red-500 focus-visible:ring-red-500" : ""
                      }`}
                      min={getTodayDate()}

                    />
                  </div>
                  
                  {errors.date && <p className="mt-1 text-sm text-red-500">{errors.date.message}</p>}
                </div>
              </div>
            )}

            {/* Step 3: Time Selection */}
            {currentStep === 3 && (
              <div className="animate-fade-in space-y-6">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-hot-pink to-spray-orange">
                    <Clock className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-2 text-2xl font-bold text-white">Selecciona tu hora</h3>
                  <p className="text-white">
                    {(() => {
                      if (!formData.date) return "Horarios disponibles (citas de 1 hora)";
                      const selectedDate = new Date(formData.date + "T00:00:00");
                      const isSunday = selectedDate.getDay() === 0;
                      const isFriday = selectedDate.getDay() === 5;
                      if (isSunday) {
                        return "Horarios de domingo: 11:00 AM - 5:00 PM (citas de 1 hora)";
                      }
                      // Viernes usa horario estándar
                      return "Horarios disponibles (citas de 1 hora)";
                    })()} 
                  </p>
                </div>

                {isLoadingSlots ? (
                  <div className="text-center text-white">Cargando horarios disponibles...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {(() => {
                        // Determinar qué horarios mostrar según el día seleccionado
                        if (!formData.date) return timeSlots;
                        const selectedDate = new Date(formData.date + "T00:00:00");
                        const isSunday = selectedDate.getDay() === 0;
                        // Viernes usa horario estándar
                        return isSunday ? sundayTimeSlots : timeSlots;
                      })().map(time => {
                        const isAvailable = availableSlots.has(time);
                        return (
                          <Button
                            key={time}
                            type="button"
                            variant={formData.time === time ? "default" : "outline"}
                            onClick={() => isAvailable && setValue("time", time)}
                            disabled={!isAvailable}
                            className={`${
                              formData.time === time
                                ? "bg-gradient-to-r from-spray-orange to-electric-blue text-white"
                                : isAvailable
                                  ? "border-gray-600 text-gray-300 hover:border-spray-orange hover:text-spray-orange"
                                  : "cursor-not-allowed border-gray-600 text-gray-500 opacity-50"
                            } cursor-pointer transition-all duration-300`}
                          >
                            {time}
                            {!isAvailable && " (Ocupado)"}
                          </Button>
                        );
                      })}
                    </div>
                    
                    {/* Botón de WhatsApp para horarios después de 8:00 PM (solo en días normales) */}
                    {(() => {
                      if (!formData.date) return null;
                      const selectedDate = new Date(formData.date + "T00:00:00");
                      const isSunday = selectedDate.getDay() === 0;
                      
                      // Solo mostrar el botón de WhatsApp en días normales (no domingos)
                      if (isSunday) return null;
                      
                      return (
                        <div className="mt-6 pt-4 border-t border-gray-600/30">
                          <div className="text-center mb-2">
                            <p className="text-xs text-gray-400">¿Necesitas una cita después de las 8:00 PM?</p>
                          </div>
                          <Button
                            type="button"
                            onClick={openWhatsApp}
                            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-all duration-300 flex items-center justify-center gap-2 text-sm py-2"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Consultar disponibilidad por WhatsApp
                          </Button>
                        </div>
                      );
                    })()} 
                  </div>
                )}
                {errors.time && <p className="mt-1 text-sm text-red-500">{errors.time.message}</p>}
              </div>
            )}

            {/* Step 4: Contact Information */}
            {currentStep === 4 && (
              <div className="animate-fade-in space-y-6">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-urban-purple to-neon-green">
                    <Phone className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-2 text-2xl font-bold text-white uppercase">Tus datos</h3>
                  <p className="text-balance text-white">
                    Solo necesitamos algunos datos de contacto para confirmar tu cita
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="font-bold text-white uppercase">Nombre completo</Label>
                    <Input
                      {...register("name", {
                        onBlur: () => trigger("name"),
                      })}
                      placeholder="Ingresa tu nombre"
                      className={`border-gray-600 bg-graffiti-dark text-white placeholder-gray-400 ${
                        errors.name && touchedFields.name ? "border-red-500 focus-visible:ring-red-500" : ""
                      }`}
                    />
                    {errors.name && touchedFields.name && (
                      <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="font-bold text-white uppercase">Teléfono</Label>
                    <Input
                      {...register("phone", {
                        onBlur: () => trigger("phone"),
                      })}
                      placeholder="Ingresa tu teléfono"
                      className={`border-gray-600 bg-graffiti-dark text-white placeholder-gray-400 ${
                        errors.phone && touchedFields.phone ? "border-red-500 focus-visible:ring-red-500" : ""
                      }`}
                    />
                    {errors.phone && touchedFields.phone && (
                      <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>
                    )}
                  </div>
                </div>

                {/* Booking Summary */}
                <BookingSummary services={formData.services} date={formData.date} time={formData.time} />
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="cursor-pointer border-gray-600 text-gray-300 uppercase hover:border-spray-orange hover:text-spray-orange disabled:opacity-50"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Atrás
              </Button>

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!isCurrentStepValid}
                  className={`cursor-pointer bg-gradient-to-r from-spray-orange to-electric-blue text-white uppercase hover:from-electric-blue hover:to-spray-orange disabled:cursor-not-allowed disabled:opacity-50 ${
                    !isCurrentStepValid ? "opacity-50" : ""
                  }`}
                >
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!isCurrentStepValid || isSubmitting}
                  className={`bg-gradient-to-r from-neon-green to-urban-purple font-bold text-white uppercase hover:from-urban-purple hover:to-neon-green disabled:cursor-not-allowed disabled:opacity-50 ${
                    !isCurrentStepValid || isSubmitting ? "opacity-50" : ""
                  }`}
                >
                  {isSubmitting ? "Creando cita..." : "Confirmar cita 🔥"}
                </Button>
              )}
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
};