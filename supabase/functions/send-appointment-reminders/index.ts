import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { isSendableEmail, reminderEmail, type Reservation } from "../_shared/emails.ts";
import { sendEmail } from "../_shared/resend.ts";
import { appointmentToUtc, todayInTimeZone } from "../_shared/datetime.ts";
import { isSuppressed } from "../_shared/suppression.ts";

// Cuánto antes de la cita se manda el recordatorio.
const LEAD_MINUTES = Number(Deno.env.get("REMINDER_LEAD_MINUTES") ?? "120");

// Si la reserva se acaba de crear, el cliente ya recibió la confirmación:
// no tiene sentido mandarle el recordatorio pegado.
const MIN_AGE_MINUTES = 30;

interface PendingReservation extends Reservation {
  created_at: string;
  reminder_sent_at: string | null;
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Solo el cron (o un admin) puede dispararlo: exige el service role key.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (bearer !== serviceRoleKey) return json({ error: "No autorizado" }, 401);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const now = new Date();

    // Las citas viven como fecha + hora local, así que no se pueden filtrar por
    // instante en SQL. Se traen las de hoy y mañana (barato: índice parcial) y se
    // resuelve la ventana en JS. "Mañana" cubre el cruce de medianoche en UTC.
    const today = todayInTimeZone(now);
    const tomorrow = todayInTimeZone(new Date(now.getTime() + 24 * 60 * 60 * 1000));

    const { data, error } = await supabase
      .from("reservations")
      .select("id, services, date, time, customer_name, phone, email, status, created_at, reminder_sent_at")
      .in("date", [today, tomorrow])
      .eq("status", "confirmed")
      .is("reminder_sent_at", null);

    if (error) throw error;

    const windowEnd = now.getTime() + LEAD_MINUTES * 60 * 1000;
    const newestAllowed = now.getTime() - MIN_AGE_MINUTES * 60 * 1000;

    const due = ((data ?? []) as PendingReservation[]).filter(reservation => {
      if (!isSendableEmail(reservation.email)) return false;
      if (new Date(reservation.created_at).getTime() > newestAllowed) return false;

      const startsAt = appointmentToUtc(reservation.date, reservation.time);
      if (!startsAt) return false;

      // Dentro de las próximas LEAD_MINUTES y todavía sin ocurrir.
      return startsAt.getTime() > now.getTime() && startsAt.getTime() <= windowEnd;
    });

    const results: Array<{ id: number; sent: boolean; error?: string }> = [];

    // Secuencial a propósito: Resend limita a ~2 req/s y el volumen por corrida es bajo.
    for (const reservation of due) {
      // Se marca ANTES de enviar, condicionado a que siga en NULL. Si dos corridas del
      // cron se traslapan, solo una gana el UPDATE y la otra recibe 0 filas: el cliente
      // nunca recibe el recordatorio duplicado.
      const { data: claimed, error: claimError } = await supabase
        .from("reservations")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", reservation.id)
        .is("reminder_sent_at", null)
        .select("id");

      if (claimError || !claimed?.length) {
        results.push({ id: reservation.id, sent: false, error: "ya reclamada por otra corrida" });
        continue;
      }

      try {
        if (await isSuppressed(supabase, reservation.email)) {
          results.push({ id: reservation.id, sent: false, error: "dirección suprimida" });
          continue;
        }

        const { subject, html, text } = reminderEmail(reservation);
        await sendEmail({ to: reservation.email, subject, html, text });
        results.push({ id: reservation.id, sent: true });
      } catch (sendError) {
        // Se libera la marca para que el siguiente cron lo reintente.
        await supabase.from("reservations").update({ reminder_sent_at: null }).eq("id", reservation.id);

        const message = sendError instanceof Error ? sendError.message : "Error desconocido";
        console.error(`Reserva ${reservation.id}:`, message);
        results.push({ id: reservation.id, sent: false, error: message });
      }
    }

    return json({
      checked: data?.length ?? 0,
      due: due.length,
      sent: results.filter(r => r.sent).length,
      failed: results.filter(r => !r.sent).length,
      results,
    });
  } catch (error) {
    console.error("send-appointment-reminders:", error);
    return json({ error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
});
