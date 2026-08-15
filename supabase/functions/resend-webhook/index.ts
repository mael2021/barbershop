import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

// Este endpoint lo llama Resend, no la app: no lleva JWT de Supabase.
// Debe deployarse con --no-verify-jwt, y la autenticidad se valida con la firma Svix.
//
// Resend firma con Svix: HMAC-SHA256 de "<svix-id>.<svix-timestamp>.<body>" usando el
// secret (whsec_<base64>) decodificado, y manda el resultado en base64.
const verifySignature = async (
  secret: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  body: string,
): Promise<boolean> => {
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;

  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(rawSecret), c => c.charCodeAt(0)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${svixId}.${svixTimestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // El header puede traer varias firmas ("v1,xxx v1,yyy") durante una rotación de secret.
  return svixSignature
    .split(" ")
    .map(part => part.split(",")[1])
    .some(candidate => candidate === expected);
};

// Rechaza reenvíos viejos: sin esto, un atacante que capture un webhook válido podría
// repetirlo indefinidamente.
const TOLERANCE_SECONDS = 5 * 60;

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return json({ error: "Falta el secret RESEND_WEBHOOK_SECRET" }, 500);

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return json({ error: "Faltan headers de firma" }, 401);

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(svixTimestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return json({ error: "Timestamp fuera de rango" }, 401);

  // Hay que leer el cuerpo crudo: la firma se calcula sobre los bytes exactos, así que
  // no se puede usar req.json() antes de verificar.
  const body = await req.text();
  if (!(await verifySignature(secret, svixId, svixTimestamp, svixSignature, body))) {
    return json({ error: "Firma inválida" }, 401);
  }

  try {
    const event = JSON.parse(body);
    const type: string = event?.type ?? "";
    const recipients: string[] = event?.data?.to ?? [];

    const reason = type === "email.bounced" ? "bounced" : type === "email.complained" ? "complained" : null;

    // Otros eventos (delivered, opened, clicked) se aceptan sin hacer nada: devolver 200
    // evita que Resend los reintente.
    if (!reason || recipients.length === 0) return json({ ignored: type });

    // Solo los rebotes permanentes suprimen. Un "soft bounce" (buzón lleno, servidor
    // caído) es transitorio y bloquear al cliente por eso sería un error.
    if (reason === "bounced") {
      const bounceType: string = event?.data?.bounce?.type ?? "";
      if (bounceType && bounceType.toLowerCase() !== "hard" && bounceType.toLowerCase() !== "permanent") {
        return json({ ignored: `bounce_${bounceType}` });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rows = recipients.map(email => ({
      email: email.trim().toLowerCase(),
      reason,
      detail: JSON.stringify(event?.data?.bounce ?? event?.data?.complaint ?? null).slice(0, 500),
    }));

    const { error } = await supabase.from("email_suppressions").upsert(rows, { onConflict: "email" });
    if (error) throw error;

    console.log(`Suprimidas ${rows.length} direcciones por ${reason}`);
    return json({ suppressed: rows.length, reason });
  } catch (error) {
    console.error("resend-webhook:", error);
    return json({ error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
});
