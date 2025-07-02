import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabase/client";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google";
import { toast } from "@pheralb/toast";
import { Trash2 } from "lucide-react";

export const AdminPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isLinked, setIsLinked] = useState(false);

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
        toast.success({
          text: "Cuenta desvinculada",
          description: "Se ha eliminado la conexión con Google Calendar.",
        });
        
        // También cerrar sesión de Supabase
        await supabase.auth.signOut();
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
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white">Panel de Administración</h2>
          <p className="mt-2 text-gray-300">Vincula tu cuenta de Google Calendar</p>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="text-center text-white">
              <p>Verificando estado de vinculación...</p>
            </div>
          ) : isLinked ? (
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
      </div>
    </div>
  );
};