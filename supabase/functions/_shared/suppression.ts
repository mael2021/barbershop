import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ¿Está bloqueada la dirección por rebote duro o queja de spam?
 *
 * Ante un error de consulta devuelve `false` (deja pasar el envío) a propósito: es
 * preferible mandar un correo de más que romper la confirmación de una cita real por
 * una falla transitoria de la BD.
 */
export const isSuppressed = async (supabase: SupabaseClient, email: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("email_suppressions")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("No se pudo consultar email_suppressions:", error.message);
    return false;
  }

  return Boolean(data);
};
