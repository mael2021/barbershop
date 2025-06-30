import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabase/client";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google";
import { toast } from "@pheralb/toast";

export const AdminButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    // Verificar si ya está vinculado al cargar el componente
    const checkGoogleLink = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLinked(!!session?.provider_token);
    };
    checkGoogleLink();
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
          },
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error({
          text: "Error al conectar con Google",
          description: `Detalles del error: ${error.message}. Por favor, intenta nuevamente.`,
        });
        return;
      }

      // Verificar la sesión después de la autenticación
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.provider_token) {
        setIsLinked(true);
        toast.success({
          text: "¡Cuenta vinculada exitosamente! 🎉",
          description:
            "Tu cuenta de Google Calendar ha sido vinculada correctamente. Ahora las reservas se sincronizarán automáticamente.",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast.error({
        text: "Error inesperado",
        description: `Ocurrió un error al intentar conectar con Google: ${errorMessage}. Por favor, intenta nuevamente.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={isLinked ? "default" : "outline"}
      onClick={handleGoogleLogin}
      disabled={isLoading}
      className="fixed top-4 right-4 z-50"
    >
      {isLoading ? "Conectando..." : isLinked ? "Cuenta Vinculada ✅" : "Administrador"}
    </Button>
  );
};
