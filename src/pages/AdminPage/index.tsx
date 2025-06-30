import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabase/client";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google";
import { toast } from "@pheralb/toast";

export const AdminPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    const checkAndStoreTokens = async () => {
      try {
        // Verificar si hay un hash en la URL (después del login)
        const hash = window.location.hash;
        if (hash) {
          console.log("[DEBUG] Hash completo:", hash);
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const refresh_token = params.get("provider_refresh_token");
          console.log("[DEBUG] Provider refresh token encontrado:", refresh_token);

          if (!refresh_token || !refresh_token.startsWith("1//")) {
            console.log("[DEBUG] No se encontró un provider refresh token válido");
            return;
          }

          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.provider_token) {
            console.log("[DEBUG] No se encontró el provider token");
            return;
          }

          console.log("[DEBUG] Enviando tokens a la Edge Function");
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              action: "store",
              token: session.provider_token,
              refresh_token,
            }),
          });

          console.log("[DEBUG] Respuesta de la Edge Function:", response.status);
          if (response.ok) {
            setIsLinked(true);
            toast.success({
              text: "¡Tokens guardados correctamente! 🎉",
              description: "Los tokens de Google Calendar han sido guardados exitosamente.",
            });
            // Limpiar el fragmento de la URL
            window.location.hash = "";
          } else {
            const errorData = await response.json();
            console.error("[DEBUG] Error al guardar tokens:", errorData);
            toast.error({
              text: "Error al guardar los tokens",
              description: "Hubo un problema al guardar los tokens de Google Calendar.",
            });
          }
        } else {
          // Si no hay hash, solo verificamos si ya está vinculado
          const {
            data: { session },
          } = await supabase.auth.getSession();
          setIsLinked(!!session?.provider_token);
        }
      } catch (error) {
        console.error("[DEBUG] Error en checkAndStoreTokens:", error);
        toast.error({
          text: "Error al verificar la vinculación",
          description: "Ocurrió un error al verificar el estado de la vinculación.",
        });
      }
    };

    checkAndStoreTokens();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: GOOGLE_CALENDAR_SCOPES.join(" "),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
            response_type: "code",
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
        return;
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-gray-800 p-8 shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white">Panel de Administración</h2>
          <p className="mt-2 text-gray-300">Vincula tu cuenta de Google Calendar</p>
        </div>

        <div className="mt-8">
          {isLinked ? (
            <div className="text-center text-green-400">
              <p className="text-lg font-semibold">✅ Cuenta vinculada</p>
              <p className="mt-2 text-sm text-gray-300">La cuenta de Google Calendar está correctamente configurada.</p>
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
      </div>
    </div>
  );
};
