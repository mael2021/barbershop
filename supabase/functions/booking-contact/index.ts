import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { isSendableEmail } from "../_shared/emails.ts";

const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
const encoder = new TextEncoder();
const signingKey = crypto.subtle.importKey(
  "raw",
  encoder.encode(serviceKey),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);
const lifetimeMs = 180 * 24 * 60 * 60 * 1000;
const tokenPattern = /^([1-9]\d{0,18})\.(\d{1,13})\.([a-f0-9]{64})$/;

const signatureInput = (id: string, expires: string, email: string, phone: string) =>
  encoder.encode(JSON.stringify(["remembered-booking-contact", id, expires, email, phone]));

const contactResponse = (body: unknown) => {
  const response = json(body);
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const getReservationContact = async (id: string, email: string) => {
  const { data, error } = await supabase
    .from("reservations")
    .select("email, customer_name, phone")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (data?.email?.trim().toLowerCase() !== email || typeof data?.phone !== "string") return null;

  const phone = data.phone.replace(/\D/g, "");
  return /^\d{10}$/.test(phone) ? { name: data.customer_name, phone } : null;
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !isSendableEmail(email)) return json({ error: "Correo inválido" }, 400);

  try {
    if (body.action === "remember") {
      const id = typeof body.reservationId === "number" || typeof body.reservationId === "string"
        ? String(body.reservationId)
        : "";
      if (!/^[1-9]\d{0,18}$/.test(id) || typeof body.phone !== "string" || !/^\d{10}$/.test(body.phone)) {
        return json({ error: "Contacto inválido" }, 400);
      }

      const contact = await getReservationContact(id, email);
      if (!contact || contact.phone !== body.phone) return json({ error: "Contacto no encontrado" }, 404);

      const expires = String(Date.now() + lifetimeMs);
      const signature = await crypto.subtle.sign("HMAC", await signingKey, signatureInput(id, expires, email, contact.phone));
      const hex = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
      return contactResponse({ token: `${id}.${expires}.${hex}` });
    }

    if (body.action !== "lookup") return json({ error: "Acción inválida" }, 400);

    const token = typeof body.token === "string" && body.token.match(tokenPattern);
    if (!token) return contactResponse({ contact: null });
    const [, id, expires, hex] = token;
    if (Number(expires) <= Date.now()) return contactResponse({ contact: null });

    const contact = await getReservationContact(id, email);
    if (!contact) return contactResponse({ contact: null });

    const signature = Uint8Array.from(hex.match(/../g)!, pair => parseInt(pair, 16));
    const valid = await crypto.subtle.verify("HMAC", await signingKey, signature, signatureInput(id, expires, email, contact.phone));
    return contactResponse({ contact: valid ? contact : null });
  } catch (error) {
    console.error("Error al recuperar el contacto de reserva:", error);
    return json({ error: "No se pudo consultar el contacto" }, 500);
  }
});
