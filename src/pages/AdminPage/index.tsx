import { useState, useEffect } from "react";
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    // Verificar si hay un código de acceso guardado
    const storedCode = localStorage.getItem('adminAccessCode');
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
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
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
            window.history.replaceState(null, '', window.location.pathname);
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
        const { data: { session } } = await supabase.auth.getSession();
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[DEBUG] Auth state changed:", event, session?.provider_token ? "has_provider_token" : "no_provider_token");
      
      if (event === 'SIGNED_IN' && session?.provider_token && session?.provider_refresh_token) {
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
      } else if (event === 'SIGNED_OUT') {
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
    const { data: { session } } = await supabase.auth.getSession();
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
      
      if (data.status === 'reauth_required') {
        setIsLinked(false);
        toast.error({
          text: "Conexión Expirada",
          description: "Tu conexión con Google ha expirado. Por favor, vincula tu cuenta de nuevo.",
        });
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
        localStorage.setItem('adminAccessCode', accessCode);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("No hay sesión activa");
        return;
      }

      // Usar la fecha seleccionada o la fecha pasada como parámetro
      const targetDate = dateToLoad || selectedDate;
      const [year, month, day] = targetDate.split('-').map(Number);
      
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
        console.error("Error al obtener eventos:", errorData);
        
        // Handle token expiration gracefully
        if (errorData.error === 'ADMIN_REAUTH_REQUIRED') {
            setIsLinked(false);
            toast.error({
                text: "Conexión Expirada",
                description: "Tu conexión con Google ha expirado. Por favor, vincula tu cuenta de nuevo.",
            });
            return;
        }
        
        throw new Error(errorData.error || "No se pudieron cargar las citas");
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

  // Función para eliminar una cita
  const deleteAppointment = async (appointmentId: string) => {
    setDeletingAppointment(appointmentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No hay sesión activa");
      }

      // Obtener el token de Google Calendar directamente de la función edge
      const tokenResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "retrieve",
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error("Error al obtener token:", errorData);
        
        if (errorData.error === 'REAUTH_REQUIRED' || errorData.error === 'ADMIN_REAUTH_REQUIRED') {
          setIsLinked(false);
          toast.error({
            text: "Conexión Expirada",
            description: "Tu conexión con Google ha expirado. Por favor, vincula tu cuenta de nuevo.",
          });
          return;
        }
        
        throw new Error(`Error al obtener token: ${errorData.error || tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      if (!tokenData.token) {
        throw new Error("No se encontró token de Google");
      }

      // Eliminar evento directamente con la API de Google Calendar
      const deleteResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${appointmentId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${tokenData.token}`,
          "Content-Type": "application/json",
        },
      });

      if (!deleteResponse.ok) {
        if (deleteResponse.status === 404) {
          // El evento ya no existe, actualizar la lista
          setTodayAppointments(prev => prev.filter(apt => apt.id !== appointmentId));
          toast.success({
            text: "Cita eliminada",
            description: "La cita ya no existía en el calendario.",
          });
          return;
        }
        
        if (deleteResponse.status === 401) {
          // Token expirado
          setIsLinked(false);
          toast.error({
            text: "Conexión Expirada",
            description: "Tu conexión con Google ha expirado. Por favor, vincula tu cuenta de nuevo.",
          });
          return;
        }
        
        throw new Error(`Error al eliminar evento: ${deleteResponse.status}`);
      }

      // Actualizar la lista de citas
      setTodayAppointments(prev => prev.filter(apt => apt.id !== appointmentId));
      
      toast.success({
        text: "Cita eliminada",
        description: "La cita ha sido eliminada exitosamente.",
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
      const { data: { session } } = await supabase.auth.getSession();
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
        localStorage.removeItem('adminAccessCode');
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
                <Label htmlFor="accessCode" className="text-white font-semibold">
                  Código de Acceso
                </Label>
                <Input
                  id="accessCode"
                  type="password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Ingresa el código"
                  className="mt-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                  required
                />
                {codeError && (
                  <p className="mt-2 text-sm text-red-400">{codeError}</p>
                )}
              </div>

              <div className="flex items-center">
                <Input
                  id="rememberCode"
                  type="checkbox"
                  checked={rememberCode}
                  onChange={(e) => setRememberCode(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-offset-gray-800 focus:ring-blue-600"
                />
                <Label htmlFor="rememberCode" className="ml-2 block text-sm text-gray-300">
                  Recordar código
                </Label>
              </div>
              
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 flex items-center justify-center gap-2"
              >
                <Lock className="h-4 w-4" />
                Verificar Código
              </Button>
            </form>

            <div className="mt-6 text-center">
              <a
                href="/"
                className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
              >
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
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
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
                        <RefreshCw className={`h-4 w-4 ${loadingAppointments ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>

                    {/* Selector de fecha interactivo */}
                    <div className="relative mb-4">
                      <Label className="text-sm text-gray-300 mb-2 block">
                        Seleccionar fecha:
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                        className="w-full justify-start text-left font-normal bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>{selectedDate}</span>
                      </Button>
                      {isCalendarOpen && (
                        <div className="absolute z-10 top-full mt-2">
                          <CalendarComponent
                            value={selectedDate}
                            onChange={(date) => {
                              setSelectedDate(date);
                              loadTodayAppointments(date);
                              setIsCalendarOpen(false);
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {loadingAppointments ? (
                      <div className="text-center text-gray-400 py-4">
                        <p>Cargando citas...</p>
                      </div>
                    ) : todayAppointments.length === 0 ? (
                      <div className="text-center text-gray-400 py-6">
                        <Calendar className="mx-auto h-12 w-12 mb-2 opacity-50" />
                        <p>No hay citas programadas para esta fecha</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {todayAppointments.map((appointment) => {
                          const startTime = appointment.start.dateTime 
                            ? new Date(appointment.start.dateTime).toLocaleTimeString('es-ES', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })
                            : 'Todo el día';
                          
                          const clientInfo = appointment.description 
                            ? appointment.description.split('\n').find(line => line.includes('Cliente:'))?.replace('Cliente: ', '') || 'Cliente no especificado'
                            : 'Cliente no especificado';

                          return (
                            <div
                              key={appointment.id}
                              className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Clock className="h-4 w-4 text-blue-400" />
                                  <span className="text-white font-medium">{startTime}</span>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  <User className="h-4 w-4 text-green-400" />
                                  <span className="text-gray-300 text-sm">{clientInfo}</span>
                                </div>
                                <p className="text-gray-400 text-sm">
                                  {appointment.summary?.replace('Cita: ', '') || 'Sin servicios especificados'}
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

            <div className="mt-6 text-center">
              <a
                href="/"
                className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
              >
                ← Volver al inicio
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};