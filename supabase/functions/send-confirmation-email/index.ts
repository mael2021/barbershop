import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { confirmationEmail, isSendableEmail, type Reservation } from "../_shared/emails.ts";
import { sendEmail } from "../_shared/resend.ts";
import { isSuppressed } from "../_shared/suppression.ts";

// Se invoca desde el cliente justo después de insertar la reserva.
// El cliente solo manda el ID: el correo destino sale de la BD, nunca del request,
// así que este endpoint no puede usarse para mandar correo a direcciones arbitrarias.
serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { reservationId } = await req.json();
    if (!reservationId) return json({ error: "Falta reservationId" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: reservation, error } = await supabase
      .from("reservations")
      .select("id, services, date, time, customer_name, phone, email, status, confirmation_sent_at")
      .eq("id", reservationId)
      .single();

    if (error || !reservation) return json({ error: "Reserva no encontrada" }, 404);

    // Idempotencia: si ya se envió, no se reenvía aunque el cliente reintente.
    if (reservation.confirmation_sent_at) {
      return json({ skipped: "already_sent", sentAt: reservation.confirmation_sent_at });
    }

    if (!isSendableEmail(reservation.email)) {
      return json({ skipped: "no_email" });
    }

    // Rebotó duro antes o marcó spam: no se le vuelve a escribir.
    if (await isSuppressed(supabase, reservation.email)) {
      return json({ skipped: "suppressed" });
    }

    const { subject, html, text } = confirmationEmail(reservation as Reservation);
    const { id: messageId } = await sendEmail({ to: reservation.email, subject, html, text });

    // Se marca después de enviar: si Resend falla, queda pendiente y se puede reintentar.
    const { error: stampError } = await supabase
      .from("reservations")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", reservation.id);

    if (stampError) console.error("Correo enviado pero no se pudo marcar la reserva:", stampError);

    return json({ sent: true, messageId });
  } catch (error) {
    console.error("send-confirmation-email:", error);
    return json({ error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
});
