import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { supabase } from "@/supabase/client";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google";
import { toast } from "@pheralb/toast";
import { Trash2, Lock, Shield, Calendar, Clock, User, RefreshCw } from "lucide-react";

interface Appointment {
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
  description?: string;
}

interface DbReservation {
  id: string | number;
  date: string;
  time: string;
  customer_name: string;
  phone?: string;
  services?: string[];
  status?: string;
}

export const AdminPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isLinked, setIsLinked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [rememberCode, setRememberCode] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [deletingAppointment, setDeletingAppointment] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dbReservations, setDbReservations] = useState<DbReservation[]>([]);
  const [loadingDbReservations, setLoadingDbReservations] = useState(false);
  const [deletingDbReservation, setDeletingDbReservation] = useState<string | number | null>(null);
  const [isDbCalendarOpen, setIsDbCalendarOpen] = useState(false);
  const [isSyncingDbToGoogle, setIsSyncingDbToGoogle] = useState(false);
  const hasAutoSyncedRef = useRef(false);

  useEffect(() => {
    // Verificar si hay un código de acceso guardado
    const storedCode = localStorage.getItem("adminAccessCode");
    if (storedCode === "cris2025F") {
      setIsAuthenticated(true);
      toast.success({
        text: "Acceso automático",
        description: "Bienvenido de nuevo al panel de administración.",
      });
    }
  }, []);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Obtener la sesión actual
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[DEBUG] Error al obtener la sesión:", sessionError);
          setIsLoading(false);
          return;
        }

        if (session?.provider_token && session?.provider_refresh_token) {
          console.log("[DEBUG] Tokens encontrados en la sesión, guardando...");

          // Almacenar los tokens en la base de datos
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action: "store",
              token: session.provider_token,
              refresh_token: session.provider_refresh_token,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            console.log("[DEBUG] Tokens guardados exitosamente:", result);
            setIsLinked(true);
            toast.success({
              text: "¡Cuenta vinculada exitosamente! 🎉",
              description: "Tu cuenta de Google Calendar ha sido vinculada correctamente.",
            });
            // Limpiar la URL
            window.history.replaceState(null, "", window.location.pathname);
          } else {
            const errorData = await response.json();
            console.error("[DEBUG] Error al guardar tokens:", errorData);
            toast.error({
              text: "Error al guardar los tokens",
              description: "Hubo un problema al guardar los tokens de Google Calendar.",
            });
          }
        } else {
          // No hay tokens de proveedor, verificar si ya existe una vinculación
          await checkExistingLink();
        }
      } catch (error) {
        console.error("[DEBUG] Error en handleAuthCallback:", error);
        toast.error({
          text: "Error al verificar la vinculación",
          description: "Ocurrió un error al verificar el estado de la vinculación.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    const checkExistingLink = async () => {
      try {
        console.log("[DEBUG] Verificando vinculación existente...");

        // Obtener el JWT del usuario actual
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setIsLinked(false);
          return;
        }

        // Verificar si existen tokens en la base de datos
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "retrieve",
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setIsLinked(!!result.token);
          console.log("[DEBUG] Estado de vinculación:", !!result.token);
        } else {
          console.log("[DEBUG] No hay tokens guardados");
          setIsLinked(false);
        }
      } catch (error) {
        console.error("[DEBUG] Error al verificar vinculación existente:", error);
        setIsLinked(false);
      }
    };

    handleAuthCallback();

    // Escuchar cambios en la autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        "[DEBUG] Auth state changed:",
        event,
        session?.provider_token ? "has_provider_token" : "no_provider_token"
      );

      if (event === "SIGNED_IN" && session?.provider_token && session?.provider_refresh_token) {
        // Nuevo login exitoso con tokens
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action: "store",
              token: session.provider_token,
              refresh_token: session.provider_refresh_token,
            }),
          });

          if (response.ok) {
            setIsLinked(true);
            toast.success({
              text: "¡Cuenta vinculada exitosamente! 🎉",
              description: "Tu cuenta de Google Calendar ha sido vinculada correctamente.",
            });
          }
        } catch (error) {
          console.error("[DEBUG] Error storing tokens:", error);
        }
      } else if (event === "SIGNED_OUT") {
        setIsLinked(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Cargar citas cuando la cuenta esté vinculada
  useEffect(() => {
    if (isAuthenticated && isLinked && !isLoading) {
      loadTodayAppointments();
    }
  }, [isAuthenticated, isLinked, isLoading]);

  // Auto-sincronizar BD -> Google una vez al vincular
  useEffect(() => {
    const runAutoSync = async () => {
      if (!isAuthenticated || !isLinked || isLoading) return;
      if (hasAutoSyncedRef.current) return;
      try {
        await loadDbReservations(selectedDate);
        await syncDbReservationsToGoogle();
        hasAutoSyncedRef.current = true;
      } catch (e) {
        // Silencioso: ya se notifican errores en dentro de las funciones
      }
    };
    runAutoSync();
  }, [isAuthenticated, isLinked, isLoading, selectedDate]);

  // Verificar el estado del token periódicamente
  useEffect(() => {
    if (isAuthenticated && isLinked) {
      // Verificar inmediatamente al cargar
      checkTokenStatus();

      const interval = setInterval(checkTokenStatus, 15 * 60 * 1000); // Cada 15 minutos
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isLinked]);

  // Función para verificar el estado de la conexión con Google
  const checkTokenStatus = async () => {
    console.log("[DEBUG] Verificando estado del token de Google...");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return; // No hacer nada si no hay sesión

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "check_token_status" }),
      });

      if (!response.ok) {
        console.error("Error al verificar estado del token:", response.status);
        return;
      }

      const data = await response.json();
      console.log("[DEBUG] Estado del token:", data);

      if (data.status === "reauth_required") {
        setIsLinked(false);
        toast.error({
          text: "Conexión Expirada",
          description: "Tu conexión con Google ha expirado. Por favor, vincula tu cuenta de nuevo.",
        });
      } else if (data.status === "valid") {
        console.log("[DEBUG] Token válido, renovación automática exitosa");
        // El token se renovó automáticamente, no necesitamos hacer nada más
      }
    } catch (error) {
      console.error("Error al verificar estado del token:", error);
    }
  };

  // Función para verificar el código de acceso
  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctCode = "cris2025F";

    if (accessCode === correctCode) {
      setIsAuthenticated(true);
      setCodeError("");
      toast.success({
        text: "Acceso autorizado",
        description: "Bienvenido al panel de administración.",
      });
      // Cargar citas del día cuando se autentica
      loadTodayAppointments();

      // Guardar el código si "Recordar" está marcado
      if (rememberCode) {
        localStorage.setItem("adminAccessCode", accessCode);
      }
    } else {
      setCodeError("Código incorrecto. Inténtalo nuevamente.");
      setAccessCode("");
      toast.error({
        text: "Código incorrecto",
        description: "El código de acceso no es válido.",
      });
    }
  };

  // Función para cargar las citas del día seleccionado
  const loadTodayAppointments = async (dateToLoad?: string) => {
    if (!isLinked) return;

    setLoadingAppointments(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        console.log("No hay sesión activa");
        return;
      }

      // Usar la fecha seleccionada o la fecha pasada como parámetro
      const targetDate = dateToLoad || selectedDate;
      const [year, month, day] = targetDate.split("-").map(Number);

      const dayStart = new Date(year, month - 1, day, 0, 0, 0).toISOString();
      const dayEnd = new Date(year, month - 1, day, 23, 59, 59).toISOString();

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "get_events",
          timeMin: dayStart,
          timeMax: dayEnd,
          timeZone: "America/Mexico_City",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage =
          typeof errorData.error === "object"
            ? errorData.error.message || JSON.stringify(errorData.error)
            : errorData.error;

        console.error("Error al obtener eventos:", errorMessage);

        if (
          errorMessage &&
          (errorMessage.includes("ADMIN_REAUTH_REQUIRED") || errorMessage.includes("REAUTH_REQUIRED"))
        ) {
          setIsLinked(false);
          toast.error({
            text: "Conexión Expirada",
            description: "Tu conexión con Google ha expirado. Por favor, vincula tu cuenta de nuevo.",
          });
          return;
        }

        throw new Error(errorMessage || "No se pudieron cargar las citas");
      }

      const data = await response.json();

      if (data && data.events) {
        setTodayAppointments(data.events);
      } else {
        setTodayAppointments([]);
      }
    } catch (error) {
      console.error("Error al cargar citas:", error);
      toast.error({
        text: "Error al cargar citas",
        description: "No se pudieron cargar las citas del día.",
      });
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Función para el botón de refresh
  const handleRefreshAppointments = () => {
    loadTodayAppointments();
  };

  // Cargar reservas desde la BD (sin depender de Google)
  const loadDbReservations = async (dateToLoad?: string) => {
    setLoadingDbReservations(true);
    try {
      const targetDate = dateToLoad || selectedDate;
      const { data, error } = await supabase
        .from("reservations")
        .select("id, services, date, time, customer_name, phone, status")
        .eq("date", targetDate);

      if (error) {
        throw error;
      }

      setDbReservations((data as DbReservation[]) || []);
    } catch (error) {
      console.error("Error al cargar reservas de BD:", error);
      toast.error({
        text: "Error al cargar reservas",
        description: "No se pudieron cargar las reservas de la base de datos.",
      });
    } finally {
      setLoadingDbReservations(false);
    }
  };

  // Eliminar reserva en BD
  const deleteDbReservation = async (reservationId: string | number) => {
    setDeletingDbReservation(reservationId);
    try {
      // Normalizar ID numérico si viene como string
      const idAsNumber =
        typeof reservationId === "string" && /^\d+$/.test(reservationId) ? Number(reservationId) : reservationId;
      const idAsString = String(reservationId);

      // 1) Intento por ID (numérico si aplica)
      const { data: deletedByIdRaw, error: deleteByIdError } = await supabase
        .from("reservations")
        .delete()
        .eq("id", idAsNumber)
        .select("id");

      if (deleteByIdError) {
        throw deleteByIdError;
      }

      const deletedById = deletedByIdRaw as unknown as Array<{ id: string | number }> | null;
      if (Array.isArray(deletedById) && deletedById.length > 0) {
        setDbReservations(prev => prev.filter(r => String(r.id) !== String(reservationId)));
        toast.success({ text: "Reserva eliminada", description: "La reserva se ha eliminado de la base de datos." });
        return;
      }

      // 1b) Segundo intento por ID en formato string (para columnas bigint)
      const { data: deletedByIdStrRaw, error: deleteByIdStrError } = await supabase
        .from("reservations")
        .delete()
        .eq("id", idAsString)
        .select("id");

      if (deleteByIdStrError) {
        throw deleteByIdStrError;
      }

      const deletedByIdStr = deletedByIdStrRaw as unknown as Array<{ id: string | number }> | null;
      if (Array.isArray(deletedByIdStr) && deletedByIdStr.length > 0) {
        setDbReservations(prev => prev.filter(r => String(r.id) !== String(reservationId)));
        toast.success({ text: "Reserva eliminada", description: "La reserva se ha eliminado de la base de datos." });
        return;
      }

      // 2) Fallback: intentar por combinación única (fecha, hora, nombre, teléfono)
      const target = dbReservations.find(r => String(r.id) === String(reservationId));
      if (target) {
        const { data: deletedByCompositeRaw, error: deleteByCompositeError } = await supabase
          .from("reservations")
          .delete()
          .match({ date: target.date, time: target.time, customer_name: target.customer_name, phone: target.phone });

        if (deleteByCompositeError) {
          throw deleteByCompositeError;
        }

        const deletedByComposite = deletedByCompositeRaw as unknown as Array<{ id: string | number }> | null;
        if (Array.isArray(deletedByComposite) && deletedByComposite.length > 0) {
          setDbReservations(prev => prev.filter(r => String(r.id) !== String(reservationId)));
          toast.success({ text: "Reserva eliminada", description: "La reserva se ha eliminado de la base de datos." });
          return;
        }
      }

      // 3) Verificar existencia para avisar si es un tema de permisos RLS o realmente no existe
      const { data: existing, error: checkError } = await supabase
        .from("reservations")
        .select("id")
        .eq("id", idAsNumber)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existing) {
        toast.error({
          text: "No se pudo eliminar",
          description: "La reserva existe pero no se pudo eliminar. Verifica las políticas RLS de DELETE en Supabase.",
        });
      } else {
        // Intento de verificación por string
        const { data: existingStr } = await supabase
          .from("reservations")
          .select("id")
          .eq("id", idAsString)
          .maybeSingle();

        if (existingStr) {
          toast.error({
            text: "No se pudo eliminar",
            description:
              "La reserva existe (por id string) pero no se pudo eliminar. Verifica las políticas RLS de DELETE en Supabase.",
          });
          return;
        }
        toast.warning({
          text: "No se encontró la reserva",
          description: "No se eliminó ningún registro. Verifica el ID de la reserva.",
        });
      }
    } catch (error) {
      console.error("Error al eliminar reserva BD:", error);
      toast.error({
        text: "Error al eliminar",
        description: "No se pudo eliminar la reserva de la base de datos.",
      });
    } finally {
      setDeletingDbReservation(null);
    }
  };

  // Cargar reservas BD cuando hay autenticación o cambia la fecha
  useEffect(() => {
    if (isAuthenticated) {
      loadDbReservations();
    }
  }, [isAuthenticated, selectedDate]);

  // Helpers para sincronización BD -> Google
  const parseTime12hTo24 = (timeStr: string) => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return { hour: 0, minute: 0 };
    const [, hh, mm, period] = match;
    let hour = parseInt(hh, 10);
    const minute = parseInt(mm, 10);
    const p = period.toUpperCase();
    if (p === "AM" && hour === 12) hour = 0;
    if (p === "PM" && hour !== 12) hour += 12;
    return { hour, minute };
  };

  const buildEventFromReservation = (r: DbReservation) => {
    const [year, month, day] = r.date.split("-").map(Number);
    const { hour, minute } = parseTime12hTo24(r.time);
    const startDateTime = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    const end = new Date(year, month - 1, day, hour, minute);
    end.setMinutes(end.getMinutes() + 60);
    const endDateTime = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}T${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}:00`;
    const servicesText = Array.isArray(r.services) ? r.services.join(", ") : "";
    return {
      summary: `Cita: ${servicesText}`,
      description: `Cliente: ${r.customer_name}\nTeléfono: ${r.phone || ""}`,
      start: { dateTime: startDateTime, timeZone: "America/Mexico_City" },
      end: { dateTime: endDateTime, timeZone: "America/Mexico_City" },
    };
  };

  const getDayBounds = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return {
      timeMin: new Date(y, m - 1, d, 0, 0, 0).toISOString(),
      timeMax: new Date(y, m - 1, d, 23, 59, 59).toISOString(),
    };
  };

  const fetchGoogleEventsForDate = async (dateStr: string) => {
    const { timeMin, timeMax } = getDayBounds(dateStr);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: "get_events", timeMin, timeMax, timeZone: "America/Mexico_City" }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(typeof err.error === "string" ? err.error : err.message || "Error al obtener eventos");
      }
      const payload = await response.json();
      return Array.isArray(payload.events) ? payload.events : [];
    } catch (e) {
      throw e;
    }
  };

  const eventsMatchReservation = (event: any, r: DbReservation) => {
    if (!event?.start?.dateTime || !event?.end?.dateTime) return false;
    const eventStart = new Date(event.start.dateTime);
    const eventEnd = new Date(event.end.dateTime);
    const [y, m, d] = r.date.split("-").map(Number);
    const { hour, minute } = parseTime12hTo24(r.time);
    const rStart = new Date(y, m - 1, d, hour, minute, 0);
    const rEnd = new Date(rStart.getTime());
    rEnd.setMinutes(rEnd.getMinutes() + 60);
    // Considerar matching si el evento traslapa y summary/desc concuerdan
    const overlaps = !(eventEnd <= rStart || eventStart >= rEnd);
    const desc = event.description || "";
    const phone = (r.phone || "").toString();
    const hasClient = desc.includes("Cliente:") && (phone === "" || desc.includes(phone));
    const summaryOk = typeof event.summary === "string" && event.summary.startsWith("Cita:");
    return overlaps && (hasClient || summaryOk);
  };

  const syncDbReservationsToGoogle = async () => {
    if (dbReservations.length === 0) {
      toast.warning({ text: "Sin reservas", description: "No hay reservas para sincronizar en esta fecha." });
      return;
    }
    setIsSyncingDbToGoogle(true);
    try {
      // Obtener eventos actuales de Google para evitar duplicados
      let googleEvents: any[] = [];
      try {
        googleEvents = await fetchGoogleEventsForDate(selectedDate);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ADMIN_REAUTH_REQUIRED") || msg.includes("No hay administrador")) {
          toast.error({ text: "Conecta Google", description: "Vincula una cuenta de Google Calendar en el panel." });
          setIsSyncingDbToGoogle(false);
          return;
        }
        throw err;
      }

      let created = 0;
      for (const r of dbReservations.filter(x => (x.status || "confirmed") === "confirmed")) {
        const alreadyExists = googleEvents.some(ev => eventsMatchReservation(ev, r));
        if (alreadyExists) continue;
        const event = buildEventFromReservation(r);
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ action: "create_event", event_data: event }),
        });
        if (resp.ok) {
          created += 1;
        } else {
          const err = await resp.json().catch(() => ({}));
          console.error("Error al crear evento:", err);
        }
      }

      toast.success({
        text: "Sincronización completada",
        description:
          created > 0 ? `Se crearon ${created} evento(s) en Google Calendar.` : "No había eventos por crear.",
      });
    } catch (error) {
      console.error("Error al sincronizar BD -> Google:", error);
      toast.error({ text: "Error al sincronizar", description: "Revisa la conexión con Google o intenta más tarde." });
    } finally {
      setIsSyncingDbToGoogle(false);
    }
  };

  // Función para eliminar una cita
  const deleteAppointment = async (appointmentId: string) => {
    setDeletingAppointment(appointmentId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No hay sesión activa");
      }

      // Eliminar evento usando la función edge que maneja renovación automática
      const deleteResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "delete_event",
          event_id: appointmentId,
        }),
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        console.error("Error al eliminar evento:", errorData);

        if (errorData.error === "REAUTH_REQUIRED" || errorData.error === "ADMIN_REAUTH_REQUIRED") {
          setIsLinked(false);
          toast.error({
            text: "Conexión Expirada",
            description: "Tu conexión con Google ha expirado. Por favor, vincula tu cuenta de nuevo.",
          });
          return;
        }

        throw new Error(`Error al eliminar evento: ${errorData.error || deleteResponse.status}`);
      }

      const result = await deleteResponse.json();

      // Actualizar la lista de citas
      setTodayAppointments(prev => prev.filter(apt => apt.id !== appointmentId));

      toast.success({
        text: "Cita eliminada",
        description: result.message || "La cita ha sido eliminada exitosamente.",
      });
    } catch (error) {
      console.error("Error al eliminar cita:", error);
      toast.error({
        text: "Error al eliminar",
        description: error instanceof Error ? error.message : "No se pudo eliminar la cita. Inténtalo nuevamente.",
      });
    } finally {
      setDeletingAppointment(null);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      console.log("[DEBUG] Iniciando proceso de autenticación con Google");

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: GOOGLE_CALENDAR_SCOPES.join(" "),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          redirectTo: `${window.location.origin}/admin`,
        },
      });

      if (error) {
        console.error("[DEBUG] Error en OAuth:", error);
        toast.error({
          text: "Error al conectar con Google",
          description: `Detalles del error: ${error.message}. Por favor, intenta nuevamente.`,
        });
      }
    } catch (error) {
      console.error("[DEBUG] Error durante la autenticación:", error);
      toast.error({
        text: "Error al conectar con Google",
        description: "Ocurrió un error durante el proceso de autenticación.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlink = async () => {
    setIsLoading(true);
    try {
      console.log("[DEBUG] Desvinculando cuenta...");

      // Obtener el JWT del usuario actual
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No hay una sesión activa");
      }

      // Eliminar tokens de la base de datos
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "store",
          token: null,
          refresh_token: null,
        }),
      });

      if (response.ok) {
        setIsLinked(false);
        // También cerrar sesión de Supabase
        await supabase.auth.signOut();

        // Limpiar el código de acceso guardado y estado de autenticación
        localStorage.removeItem("adminAccessCode");
        setIsAuthenticated(false);

        toast.success({
          text: "Cuenta desvinculada",
          description: "Se ha eliminado la conexión con Google Calendar.",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al desvincular en el servidor");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido";
      console.error("[DEBUG] Error al desvincular:", error);
      toast.error({
        text: "Error al desvincular",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-gray-800 p-8 shadow-lg">
        {!isAuthenticated ? (
          // Formulario de código de acceso
          <>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-red-600">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">Acceso Restringido</h2>
              <p className="mt-2 text-gray-300">Ingresa el código de acceso para continuar</p>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-6">
              <div>
                <Label htmlFor="accessCode" className="font-semibold text-white">
                  Código de Acceso
                </Label>
                <Input
                  id="accessCode"
                  type="password"
                  value={accessCode}
                  onChange={e => setAccessCode(e.target.value)}
                  placeholder="Ingresa el código"
                  className="mt-1 border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500"
                  required
                />
                {codeError && <p className="mt-2 text-sm text-red-400">{codeError}</p>}
              </div>

              <div className="flex items-center">
                <Input
                  id="rememberCode"
                  type="checkbox"
                  checked={rememberCode}
                  onChange={e => setRememberCode(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-600 focus:ring-offset-gray-800"
                />
                <Label htmlFor="rememberCode" className="ml-2 block text-sm text-gray-300">
                  Recordar código
                </Label>
              </div>

              <Button
                type="submit"
                className="flex w-full items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800"
              >
                <Lock className="h-4 w-4" />
                Verificar Código
              </Button>
            </form>

            <div className="mt-6 text-center">
              <a href="/" className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
                ← Volver al inicio
              </a>
            </div>
          </>
        ) : (
          // Panel de administración (contenido original)
          <>
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white">Panel de Administración</h2>
              <p className="mt-2 text-gray-300">Vincula tu cuenta de Google Calendar</p>
            </div>

            <div className="mt-8 space-y-6">
              {isLoading ? (
                <div className="text-center text-white">
                  <p>Verificando estado de vinculación...</p>
                </div>
              ) : isLinked ? (
                <>
                  <div className="space-y-4 text-center">
                    <div className="text-green-400">
                      <p className="text-lg font-semibold">✅ Cuenta vinculada</p>
                      <p className="mt-2 text-sm text-gray-300">
                        La cuenta de Google Calendar está correctamente configurada.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={handleUnlink}
                      disabled={isLoading}
                      className="w-full bg-red-600 text-white hover:bg-red-700"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isLoading ? "Desvinculando..." : "Desvincular cuenta"}
                    </Button>
                  </div>

                  {/* Sección de citas del día */}
                  <div className="border-t border-gray-600 pt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                        <Calendar className="h-5 w-5" />
                        Citas del Día
                      </h3>
                      <Button
                        onClick={handleRefreshAppointments}
                        disabled={loadingAppointments}
                        size="sm"
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400"
                      >
                        <RefreshCw className={`h-4 w-4 ${loadingAppointments ? "animate-spin" : ""}`} />
                      </Button>
                    </div>

                    {/* Selector de fecha interactivo */}
                    <div className="relative mb-4">
                      <Label className="mb-2 block text-sm text-gray-300">Seleccionar fecha:</Label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                        className="w-full justify-start border-gray-600 bg-gray-700 text-left font-normal text-white hover:bg-gray-600"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>{selectedDate}</span>
                      </Button>
                      {isCalendarOpen && (
                        <div className="absolute top-full z-10 mt-2">
                          <CalendarComponent
                            value={selectedDate}
                            onChange={date => {
                              setSelectedDate(date);
                              loadTodayAppointments(date);
                              setIsCalendarOpen(false);
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {loadingAppointments ? (
                      <div className="py-4 text-center text-gray-400">
                        <p>Cargando citas...</p>
                      </div>
                    ) : todayAppointments.length === 0 ? (
                      <div className="py-6 text-center text-gray-400">
                        <Calendar className="mx-auto mb-2 h-12 w-12 opacity-50" />
                        <p>No hay citas programadas para esta fecha</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {todayAppointments.map(appointment => {
                          const startTime = appointment.start.dateTime
                            ? new Date(appointment.start.dateTime).toLocaleTimeString("es-ES", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Todo el día";

                          const clientInfo = appointment.description
                            ? appointment.description
                                .split("\n")
                                .find(line => line.includes("Cliente:"))
                                ?.replace("Cliente: ", "") || "Cliente no especificado"
                            : "Cliente no especificado";

                          return (
                            <div
                              key={appointment.id}
                              className="flex items-center justify-between rounded-lg bg-gray-700 p-4"
                            >
                              <div className="flex-1">
                                <div className="mb-1 flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-blue-400" />
                                  <span className="font-medium text-white">{startTime}</span>
                                </div>
                                <div className="mb-1 flex items-center gap-2">
                                  <User className="h-4 w-4 text-green-400" />
                                  <span className="text-sm text-gray-300">{clientInfo}</span>
                                </div>
                                <p className="text-sm text-gray-400">
                                  {appointment.summary?.replace("Cita: ", "") || "Sin servicios especificados"}
                                </p>
                              </div>
                              <Button
                                onClick={() => deleteAppointment(appointment.id)}
                                disabled={deletingAppointment === appointment.id}
                                size="sm"
                                variant="destructive"
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {deletingAppointment === appointment.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Button
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-spray-orange to-electric-blue text-white hover:opacity-90"
                >
                  {isLoading ? "Conectando..." : "Vincular cuenta de Google Calendar"}
                </Button>
              )}
            </div>

            {/* Sección de citas desde Base de Datos */}
            <div className="mt-6 border-t border-gray-600 pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Calendar className="h-5 w-5" />
                  Citas en Base de Datos
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => loadDbReservations()}
                    disabled={loadingDbReservations}
                    size="sm"
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingDbReservations ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    onClick={syncDbReservationsToGoogle}
                    disabled={isSyncingDbToGoogle || !isLinked}
                    size="sm"
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:border-green-500 hover:text-green-400"
                    title={isLinked ? "Sincronizar a Google Calendar" : "Vincula Google Calendar para sincronizar"}
                  >
                    {isSyncingDbToGoogle ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <span>Sincronizar a Google</span>
                    )}
                  </Button>
                </div>
              </div>

              {/* Selector de fecha para BD */}
              <div className="relative mb-4">
                <Label className="mb-2 block text-sm text-gray-300">Seleccionar fecha:</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDbCalendarOpen(!isDbCalendarOpen)}
                  className="w-full justify-start border-gray-600 bg-gray-700 text-left font-normal text-white hover:bg-gray-600"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>{selectedDate}</span>
                </Button>
                {isDbCalendarOpen && (
                  <div className="absolute top-full z-10 mt-2">
                    <CalendarComponent
                      value={selectedDate}
                      onChange={date => {
                        setSelectedDate(date);
                        loadDbReservations(date);
                        setIsDbCalendarOpen(false);
                      }}
                    />
                  </div>
                )}
              </div>

              {loadingDbReservations ? (
                <div className="py-4 text-center text-gray-400">
                  <p>Cargando citas...</p>
                </div>
              ) : dbReservations.length === 0 ? (
                <div className="py-6 text-center text-gray-400">
                  <Calendar className="mx-auto mb-2 h-12 w-12 opacity-50" />
                  <p>No hay reservas en la base de datos para esta fecha</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dbReservations.map(reservation => {
                    const servicesText = Array.isArray(reservation.services) ? reservation.services.join(", ") : "";
                    return (
                      <div
                        key={reservation.id}
                        className="flex items-center justify-between rounded-lg bg-gray-700 p-4"
                      >
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-400" />
                            <span className="font-medium text-white">{reservation.time}</span>
                          </div>
                          <div className="mb-1 flex items-center gap-2">
                            <User className="h-4 w-4 text-green-400" />
                            <span className="text-sm text-gray-300">{reservation.customer_name}</span>
                          </div>
                          <p className="text-sm text-gray-400">{servicesText || "Sin servicios especificados"}</p>
                        </div>
                        <Button
                          onClick={() => deleteDbReservation(reservation.id)}
                          disabled={deletingDbReservation === reservation.id}
                          size="sm"
                          variant="destructive"
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deletingDbReservation === reservation.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 text-center">
              <a href="/" className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
                ← Volver al inicio
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
