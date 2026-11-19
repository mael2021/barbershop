import { supabase } from "@/supabase/client";

const storageKey = "master-cuts:booking-contact";

export const getRememberedContact = (): { email: string; token: string } | undefined => {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (typeof stored?.email === "string" && typeof stored.token === "string") {
      return { email: stored.email, token: stored.token };
    }
  } catch {
    // El formulario también funciona cuando el navegador bloquea el almacenamiento.
  }
};

export const forgetBookingContact = (email: string, expectedToken?: string) => {
  const stored = getRememberedContact();
  if (stored?.email !== email || (expectedToken && stored.token !== expectedToken)) return;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // El almacenamiento puede no estar disponible.
  }
};

export const rememberBookingContact = async (email: string, phone: string, reservationId: number | string) => {
  const { data } = await supabase.functions.invoke<{ token: string }>("booking-contact", {
    body: { action: "remember", email, phone, reservationId },
  });
  if (!data?.token) return;

  try {
    localStorage.setItem(storageKey, JSON.stringify({ email, token: data.token }));
  } catch {
    // La cita ya está confirmada aunque el navegador no pueda recordar el contacto.
  }
};
