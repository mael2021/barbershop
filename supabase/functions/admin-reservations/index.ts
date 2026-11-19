import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
const adminCode = Deno.env.get("ADMIN_ACCESS_CODE") ?? "";
const encoder = new TextEncoder();
const signingKey = crypto.subtle.importKey(
  "raw",
  encoder.encode(serviceKey),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);
const sessionDuration = 12 * 60 * 60 * 1000;

const accessCodeInput = (code: string) => encoder.encode(JSON.stringify(["admin-reservations:login", code]));
const sessionInput = (expires: string) => encoder.encode(JSON.stringify(["admin-reservations:session", expires, adminCode]));

const issueSession = async () => {
  const expires = String(Date.now() + sessionDuration);
  const signature = await crypto.subtle.sign("HMAC", await signingKey, sessionInput(expires));
  const hex = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
  return `${expires}.${hex}`;
};

const isValidSession = async (token: unknown) => {
  const session = typeof token === "string" && /^(\d{13})\.([a-f0-9]{64})$/.exec(token);
  if (!session || Number(session[1]) <= Date.now()) return false;

  const signature = Uint8Array.from(session[2].match(/../g)!, pair => parseInt(pair, 16));
  return crypto.subtle.verify("HMAC", await signingKey, signature, sessionInput(session[1]));
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (adminCode.length < 24) return json({ error: "El acceso de administración no está configurado" }, 503);

  const body = await request.json().catch(() => null);

  try {
    if (body?.action === "login") {
      const code = body.accessCode;
      if (typeof code !== "string" || code.length < 24 || code.length > 256) {
        return json({ error: "Código incorrecto" }, 401);
      }
      const key = await signingKey;
      const expected = await crypto.subtle.sign("HMAC", key, accessCodeInput(adminCode));
      if (!await crypto.subtle.verify("HMAC", key, expected, accessCodeInput(code))) {
        return json({ error: "Código incorrecto" }, 401);
      }

      const response = json({ token: await issueSession() });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    if (!await isValidSession(body?.token)) return json({ error: "Sesión de administración inválida o vencida" }, 401);
    if (body?.action === "session") return json({ authenticated: true });
    if (body?.action !== "delete") return json({ error: "Acción inválida" }, 400);

    const reservationId = body.reservationId;
    if (typeof reservationId !== "string" || !/^[1-9]\d{0,18}$/.test(reservationId) || BigInt(reservationId) > 9223372036854775807n) {
      return json({ error: "ID de reserva inválido" }, 400);
    }

    const { data, error } = await supabase.from("reservations").delete().eq("id", reservationId).select("id");
    if (error) throw error;

    return json({ deleted: Boolean(data?.length) });
  } catch (error) {
    console.error("Error administrando reservas:", error);
    return json({ error: "No se pudo completar la operación" }, 500);
  }
});
