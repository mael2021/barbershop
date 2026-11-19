import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, User, X, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { supabase } from "@/supabase/client";
import { services, DESVANECIDO_LAVADO_AUTO, DESVANECIDO_LAVADO_AUTO_CALENDAR_COLOR_ID } from "@/consts/services";
import { toast } from "@pheralb/toast";
import { BookingSummary } from "@/components";
import { ClosedDatesNotice } from "@/components/ClosedDatesNotice";
import { celebrateBooking } from "@/lib/confetti";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  CLOSED_DATES,
  getSpecialSchedule,
  getUpcomingClosedDateGroups,
  toDateKey,
} from "@/consts/schedule";
import { ContactFields } from "./ContactFields";
import { ServicePicker } from "./ServicePicker";
import { forgetBookingContact, rememberBookingContact } from "./rememberedContact";
import { bookingFormSchema, type BookingFormData } from "./schema";

// Eliminado: interfaz de eventos de Google ya no usada en disponibilidad local

interface BookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedService?: string;
  excludedServices?: string[];
}

const stepFields: Exclude<keyof BookingFormData, "rememberContact">[][] = [["services"], ["date"], ["time"], ["email", "name", "phone"]];

export const BookingForm = ({ isOpen, onClose, preSelectedService, excludedServices = [] }: BookingFormProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Set<string>>(new Set());
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    mode: "onTouched",
    defaultValues: {
      services: [],
      date: "",
      time: "",
      name: "",
      phone: "",
      email: "",
      rememberContact: false,
    },
  });

  const { handleSubmit, setValue, watch, formState: { errors }, trigger, reset } = form;
  const formData = watch();
  const currentFields = stepFields[currentStep - 1];
  const isCurrentStepValid = currentFields.every(field => formData[field].length > 0);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentStep]);

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

  // Devuelve los horarios que aplican a una fecha concreta (YYYY-MM-DD)
  const getSlotsForDate = (date: string): string[] => {
    const specialSchedule = getSpecialSchedule(date);
    if (specialSchedule) return specialSchedule.slots;

    const selectedDate = new Date(date + "T00:00:00");
    return selectedDate.getDay() === 0 ? sundayTimeSlots : timeSlots;
  };

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

  // Efecto para manejar el servicio preseleccionado
  useEffect(() => {
    if (isOpen && preSelectedService) {
      setValue("services", [preSelectedService], { shouldValidate: true });
    }
  }, [preSelectedService, isOpen, setValue]);

  // Efecto para resetear el formulario cuando se cierra
  useEffect(() => {
    if (!isOpen) {
      reset({
        services: [],
        date: "",
        time: "",
        name: "",
        phone: "",
        email: "",
        rememberContact: false,
      });
      setCurrentStep(1);
    }
  }, [isOpen, reset, setCurrentStep]);

  // Función para verificar disponibilidad consultando la base de datos (sin Google)
  const checkGoogleCalendarAvailability = async (date: string): Promise<Set<string>> => {
    try {
      // Los días con horario especial abren aunque caigan en domingo
      const specialSchedule = getSpecialSchedule(date);
      const selectedDate = new Date(date + "T00:00:00");
      const isSunday = selectedDate.getDay() === 0;

      // Si es domingo sin horario especial, devolver un conjunto vacío (sin horarios disponibles)
      if (isSunday && !specialSchedule) {
        return new Set();
      }

      // Fechas cerradas específicas
      if (CLOSED_DATES.includes(date)) {
        return new Set();
      }

      const daySlots = getSlotsForDate(date);

      const { data, error } = await supabase
        .from("reservations")
        .select("time, status")
        .eq("date", date)
        .eq("status", "confirmed");

      if (error) {
        console.error("Error al consultar reservas:", error);
        // Usar el horario del día como respaldo
        return filterPastTimeSlots(date, new Set(daySlots));
      }

      const reservedTimes = new Set<string>((data || []).map((r: { time: string }) => r.time));
      const available = new Set<string>(daySlots.filter((t) => !reservedTimes.has(t)));

      return filterPastTimeSlots(date, available);
    } catch (err) {
      console.error("Error al consultar disponibilidad en BD:", err);
      // Usar el horario del día como respaldo
      return filterPastTimeSlots(date, new Set(getSlotsForDate(date)));
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
    if (currentStep < stepFields.length && await trigger(currentFields)) setCurrentStep(currentStep + 1);
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
      const { data: createdReservations, error: supabaseError } = await supabase
        .from("reservations")
        .insert([
          {
            services: data.services,
            date: data.date,
            time: data.time,
            customer_name: data.name,
            phone: data.phone,
            email: data.email,
            status: "confirmed",
          },
        ])
        .select("id");

      if (supabaseError) {
        toast.error({
          text: "Upps, algo salió mal",
          description: "No se pudo crear tu reserva. Por favor, intenta nuevamente.",
        });
        return;
      }

      // Correo de confirmación (Resend). La reserva ya está guardada, así que un fallo
      // aquí no debe romper el flujo: se registra y el recordatorio sigue su curso.
      const reservationId = createdReservations?.[0]?.id;
      if (data.rememberContact && reservationId) {
        void rememberBookingContact(data.email, data.phone, reservationId);
      } else if (!data.rememberContact) {
        forgetBookingContact(data.email);
      }

      if (reservationId) {
        supabase.functions
          .invoke("send-confirmation-email", { body: { reservationId } })
          .catch(emailError => console.error("No se pudo enviar el correo de confirmación:", emailError));
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
        ...(data.services.includes(DESVANECIDO_LAVADO_AUTO) && {
          colorId: DESVANECIDO_LAVADO_AUTO_CALENDAR_COLOR_ID,
        }),
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

      celebrateBooking();

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
    <div className="fixed inset-x-0 top-0 z-50 flex h-dvh items-center justify-center bg-black/80 p-2 backdrop-blur-sm [container-name:booking-viewport] [container-type:size] sm:p-4">
      <Card className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden border-gray-600 bg-graffiti-gray sm:max-h-[90dvh]">
        <form className="flex min-h-0 flex-col" noValidate onSubmit={event => {
          event.preventDefault();
          if (currentStep < stepFields.length) {
            void nextStep();
          } else if (!isSubmitting) {
            void handleSubmit(onSubmit)(event);
          }
        }}>
          <CardHeader className="relative shrink-0 space-y-1 border-b border-gray-600 px-10 py-2 booking-roomy:py-2.5 sm:space-y-1.5 sm:p-6">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cerrar formulario"
              onClick={onClose}
              className="absolute top-1 right-1 cursor-pointer text-gray-400 hover:text-white sm:top-4 sm:right-4"
            >
              <X className="h-4 w-4" />
            </Button>

            <CardTitle className="text-center text-xl leading-tight text-white uppercase booking-roomy:text-2xl sm:text-3xl sm:leading-none">Reserva tu cita</CardTitle>
            <div className="flex items-center gap-2 sm:block">
              <CardDescription className="shrink-0 text-center text-xs text-white booking-roomy:text-sm sm:text-sm">
                Paso {currentStep} de {stepFields.length}
                <span className="hidden sm:inline"> - ¡Vamos a que te veas genial!</span>
              </CardDescription>
              <div className="h-1.5 w-full rounded-full bg-gray-700 sm:mt-4 sm:h-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-spray-orange to-electric-blue transition-all duration-300"
                  style={{ width: `${(currentStep / stepFields.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </CardHeader>

          <CardContent ref={contentRef} className="min-h-0 overflow-y-auto overscroll-contain px-3 py-2 booking-roomy:px-4 booking-roomy:py-2.5 sm:px-6 sm:pt-6 sm:pb-8">
            {/* Step 1: Service Selection */}
            {currentStep === 1 && (
              <div className="animate-fade-in space-y-3 booking-roomy:space-y-4 sm:space-y-6">
                <div className="text-center">
                  <div className="mx-auto mb-4 hidden h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-spray-orange to-electric-blue sm:flex">
                    <Calendar className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white booking-roomy:text-xl sm:mb-2 sm:text-2xl">Elige tus servicios</h3>
                  <p className="hidden text-white sm:block">¿Qué estilos vamos a elegir hoy?</p>
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
                    <div className="p-3 text-center text-sm text-gray-400 sm:p-8 sm:text-base">
                      <Calendar className="mx-auto mb-4 hidden h-12 w-12 opacity-50 sm:block" />
                      <p>No has seleccionado ningún servicio</p>
                    </div>
                  )}

                  <ServicePicker
                    services={services.filter(service => !excludedServices.includes(service.name) && !formData.services.includes(service.name))}
                    onSelect={addService}
                  />

                  {errors.services && <p className="mt-1 text-sm text-red-500">{errors.services.message}</p>}
                </div>
              </div>
            )}

            {/* Step 2: Date Selection */}
            {currentStep === 2 && (
              <div className="animate-fade-in space-y-2.5 sm:space-y-6">
                <div className="text-center">
                  <div className="mx-auto mb-4 hidden h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-neon-green to-urban-purple sm:flex">
                    <User className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white booking-roomy:text-xl sm:mb-2 sm:text-2xl">Selecciona tu fecha</h3>
                </div>

                <div className="space-y-2.5 sm:space-y-4">
                  {getUpcomingClosedDateGroups().map(group => <ClosedDatesNotice key={group[0]} dates={group} />)}

                  <CalendarComponent
                    value={formData.date}
                    onChange={(date) => setValue("date", date, { shouldValidate: true })}
                    minDate={toDateKey(new Date())}
                  />

                  {errors.date && <p className="mt-1 text-sm text-red-500">{errors.date.message}</p>}
                </div>
              </div>
            )}

            {/* Step 3: Time Selection */}
            {currentStep === 3 && (
              <div className="animate-fade-in space-y-3 sm:space-y-6">
                <div className="text-center">
                  <div className="mx-auto mb-4 hidden h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-hot-pink to-spray-orange sm:flex">
                    <Clock className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-1 text-lg font-bold text-white booking-roomy:text-xl sm:mb-2 sm:text-2xl">Selecciona tu hora</h3>
                  <p className="text-xs text-white sm:text-base">
                    {(() => {
                      if (!formData.date) return "Horarios disponibles (citas de 1 hora)";
                      const specialSchedule = getSpecialSchedule(formData.date);
                      if (specialSchedule) {
                        return `Horario especial: ${specialSchedule.hours} (citas de 1 hora)`;
                      }
                      const selectedDate = new Date(formData.date + "T00:00:00");
                      const isSunday = selectedDate.getDay() === 0;
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
                  <div className="space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                      {(() => {
                        // Determinar qué horarios mostrar según el día seleccionado
                        if (!formData.date) return timeSlots;
                        return getSlotsForDate(formData.date);
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
                            } h-9 cursor-pointer px-2 transition-all duration-300 booking-roomy:h-10 sm:h-10 sm:px-4`}
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

                      // Solo mostrar el botón de WhatsApp en días normales
                      // (no domingos, días cerrados ni días con horario especial)
                      if (isSunday || getSpecialSchedule(formData.date) || CLOSED_DATES.includes(formData.date)) return null;
                      
                      return (
                        <div className="mt-3 border-t border-gray-600/30 pt-2 sm:mt-6 sm:pt-4">
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

            <div hidden={currentStep !== 4}>
              <ContactFields form={form} isActive={currentStep === 4} />
              {currentStep === 4 && (
                <div className="mt-2 booking-roomy:mt-2.5 sm:mt-6">
                  <BookingSummary services={formData.services} date={formData.date} time={formData.time} />
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="shrink-0 justify-between gap-2 border-t border-gray-600 px-3 py-2 booking-roomy:px-4 booking-roomy:py-2.5 sm:border-t-0 sm:px-6 sm:pt-0 sm:pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="h-11 cursor-pointer border-gray-600 text-gray-300 uppercase hover:border-spray-orange hover:text-spray-orange disabled:opacity-50 booking-roomy:h-12 booking-roomy:text-sm sm:h-10"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Atrás
            </Button>

            {currentStep < stepFields.length ? (
              <Button
                key="next-step"
                type="button"
                onClick={nextStep}
                disabled={!isCurrentStepValid}
                className={`h-11 cursor-pointer bg-gradient-to-r from-spray-orange to-electric-blue text-white uppercase hover:from-electric-blue hover:to-spray-orange disabled:cursor-not-allowed disabled:opacity-50 booking-roomy:h-12 booking-roomy:text-sm sm:h-10 ${
                  !isCurrentStepValid ? "opacity-50" : ""
                }`}
              >
                Siguiente
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                key="confirm-booking"
                type="submit"
                disabled={!isCurrentStepValid || isSubmitting}
                className={`h-11 bg-gradient-to-r from-neon-green to-urban-purple font-bold text-white uppercase hover:from-urban-purple hover:to-neon-green disabled:cursor-not-allowed disabled:opacity-50 booking-roomy:h-12 booking-roomy:text-sm sm:h-10 ${
                  !isCurrentStepValid || isSubmitting ? "opacity-50" : ""
                }`}
              >
                {isSubmitting ? "Creando cita..." : "Confirmar cita 🔥"}
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
