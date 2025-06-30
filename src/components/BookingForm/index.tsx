import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, User, Phone, X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/supabase/client";
import { services } from "@/consts/services";
import { toast } from "@pheralb/toast";
import { BookingSummary } from "@/components";

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

interface BookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedService?: string;
  excludedServices?: string[];
}

const bookingFormSchema = z.object({
  service: z.string().min(1, "El servicio es requerido"),
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
  email: z.string().min(1, "El email es requerido").email("Ingresa un email válido"),
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

export const BookingForm = ({ isOpen, onClose, preSelectedService, excludedServices = [] }: BookingFormProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Set<string>>(new Set());
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
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
      service: "",
      date: "",
      time: "",
      name: "",
      phone: "",
      email: "",
    },
  });

  const formData = watch();

  const timeSlots = [
    "9:00 AM",
    "9:30 AM",
    "10:00 AM",
    "10:30 AM",
    "11:00 AM",
    "11:30 AM",
    "12:00 PM",
    "12:30 PM",
    "1:00 PM",
    "1:30 PM",
    "2:00 PM",
    "2:30 PM",
    "3:00 PM",
    "3:30 PM",
    "4:00 PM",
    "4:30 PM",
    "5:00 PM",
    "5:30 PM",
  ];

  // Memoize validateCurrentStep to avoid infinite loops
  const validateCurrentStep = useCallback(async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = Boolean(formData.service);
        break;
      case 2:
        isValid = Boolean(formData.date);
        break;
      case 3:
        isValid = Boolean(formData.time);
        break;
      case 4:
        isValid = Boolean(formData.name && formData.phone && formData.email);
        break;
    }

    setIsCurrentStepValid(isValid);
  }, [currentStep, formData.service, formData.date, formData.time, formData.name, formData.phone, formData.email]);

  // Efecto para validar cuando cambia el paso o los datos
  useEffect(() => {
    validateCurrentStep();
  }, [validateCurrentStep]);

  // Efecto para manejar el servicio preseleccionado
  useEffect(() => {
    if (isOpen && preSelectedService) {
      setValue("service", preSelectedService, { shouldValidate: true });
      serviceSetRef.current = true;
      validateCurrentStep();
    }
  }, [preSelectedService, isOpen, setValue, validateCurrentStep]);

  // Efecto para resetear el formulario cuando se cierra
  useEffect(() => {
    if (!isOpen) {
      reset({
        service: "",
        date: "",
        time: "",
        name: "",
        phone: "",
        email: "",
      });
      serviceSetRef.current = false;
      setCurrentStep(1);
    }
  }, [isOpen, reset, setCurrentStep]);

  // Función para verificar disponibilidad en Google Calendar
  const checkGoogleCalendarAvailability = async (date: string): Promise<Set<string>> => {
    try {
      // Calcular timeMin y timeMax para el día seleccionado
      const [year, month, day] = date.split("-").map(Number);
      const dayStart = new Date(year, month - 1, day, 0, 0, 0).toISOString();
      const dayEnd = new Date(year, month - 1, day, 23, 59, 59).toISOString();

      // Llamar a la Edge Function para obtener los eventos
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "get_events",
          timeMin: dayStart,
          timeMax: dayEnd,
          timeZone: "America/Mexico_City",
        }),
      });

      const { events, error } = await response.json();
      if (error) {
        console.error("Error al obtener eventos:", error);
        return new Set(timeSlots); // Si hay error, todos los horarios están disponibles
      }

      if (!events || events.length === 0) {
        return new Set(timeSlots);
      }

      // Crear un conjunto con todos los horarios disponibles
      const availableSlots = new Set(timeSlots);

      // Marcar como no disponibles los horarios que tienen eventos
      events.forEach((event: GoogleCalendarEvent) => {
        const eventStartStr = event.start.dateTime || event.start.date;
        const eventEndStr = event.end.dateTime || event.end.date;
        if (!eventStartStr || !eventEndStr) return;
        const eventStart = new Date(eventStartStr);
        const eventEnd = new Date(eventEndStr);
        timeSlots.forEach(time => {
          const [hours, minutes, period] = time.match(/(\d+):(\d+)\s*(AM|PM)/)?.slice(1) || [];
          const slotHour = parseInt(hours) + (period === "PM" && hours !== "12" ? 12 : 0);
          const slotMinute = parseInt(minutes);
          const slotTime = new Date(year, month - 1, day, slotHour, slotMinute);
          if (slotTime >= eventStart && slotTime < eventEnd) {
            availableSlots.delete(time);
          }
        });
      });
      return availableSlots;
    } catch (error) {
      console.error("Error al consultar disponibilidad:", error);
      return new Set(timeSlots);
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
        isValid = await trigger("service");
        break;
      case 2:
        isValid = await trigger("date");
        break;
      case 3:
        isValid = await trigger("time");
        break;
      case 4:
        isValid = await trigger(["name", "phone", "email"]);
        break;
    }

    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const [isCurrentStepValid, setIsCurrentStepValid] = useState(false);

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
            service: data.service,
            date: data.date,
            time: data.time,
            customer_name: data.name,
            phone: data.phone,
            email: data.email,
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

      // Obtener el token almacenado
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: "retrieve" }),
      });

      const { token } = await response.json();
      if (token) {
        // Create event in Google Calendar
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

        // Crear la fecha de fin (30 minutos después)
        const endMinute = (minute + 30) % 60;
        const endHour = minute + 30 >= 60 ? (hour + 1) % 24 : hour;
        const endDateTime = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}:00`;

        const event = {
          summary: `Cita: ${data.service}`,
          description: `Cliente: ${data.name}\nTeléfono: ${data.phone}\nEmail: ${data.email}`,
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
          const calendarResponse = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
          });

          if (!calendarResponse.ok) {
            const errorData = await calendarResponse.json();
            console.error("Error creating Google Calendar event:", errorData);
            throw new Error(errorData.error?.message || "Error al crear evento en Google Calendar");
          }
        } catch (calendarError) {
          console.error("Error creating Google Calendar event:", calendarError);
          toast.warning({
            text: "Reserva creada, pero hubo un error al sincronizar con Google Calendar",
            description:
              "La reserva se ha guardado correctamente, pero no se pudo crear en el calendario. Por favor, contacta al administrador.",
          });
        }
      }

      toast.success({
        text: "¡Reserva confirmada! 🔥",
        description: "Tu cita ha sido agendada. ¡Te vemos en Thug Style!",
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
                  <h3 className="mb-2 text-2xl font-bold text-white">Elige tu servicio</h3>
                  <p className="text-white">¿Qué estilo vamos a elegir hoy?</p>
                </div>

                <div className="space-y-3">
                  <Label className="font-bold text-white uppercase">Servicio</Label>
                  <Select
                    value={formData.service || preSelectedService || ""}
                    onValueChange={value => {
                      setValue("service", value, { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger className="border-gray-600 bg-graffiti-dark text-white uppercase">
                      <SelectValue placeholder="Elige un servicio" />
                    </SelectTrigger>
                    <SelectContent className="border-gray-600 bg-graffiti-dark">
                      {services
                        .filter(service => !excludedServices.includes(service.name))
                        .map(({ name, price }) => (
                          <SelectItem key={name} value={name} className="text-white uppercase hover:bg-gray-600">
                            {name} - ${price} MXN
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {errors.service && <p className="mt-1 text-sm text-red-500">{errors.service.message}</p>}
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
                  <div>
                    <Label className="font-bold text-white uppercase">Fecha</Label>
                    <Input
                      type="date"
                      {...register("date")}
                      className={`border-gray-600 bg-graffiti-dark text-white placeholder-gray-400 ${
                        errors.date ? "border-red-500 focus-visible:ring-red-500" : ""
                      }`}
                      min={new Date().toISOString().split("T")[0]}
                    />
                    {errors.date && <p className="mt-1 text-sm text-red-500">{errors.date.message}</p>}
                  </div>
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
                  <p className="text-white">Nuestros horarios disponibles</p>
                </div>

                {isLoadingSlots ? (
                  <div className="text-center text-white">Cargando horarios disponibles...</div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {timeSlots.map(time => {
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

                  <div>
                    <Label className="font-bold text-white uppercase">Email</Label>
                    <Input
                      type="email"
                      {...register("email", {
                        onBlur: () => trigger("email"),
                      })}
                      placeholder="tu@email.com"
                      className={`border-gray-600 bg-graffiti-dark text-white placeholder-gray-400 ${
                        errors.email && touchedFields.email ? "border-red-500 focus-visible:ring-red-500" : ""
                      }`}
                    />
                    {errors.email && touchedFields.email && (
                      <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                {/* Booking Summary */}
                <BookingSummary service={formData.service} date={formData.date} time={formData.time} />
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
