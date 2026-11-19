import { z } from "zod";
import { CLOSED_DATES } from "@/consts/schedule";
import { suggestEmailFix } from "@/lib/emailTypos";

const contactFields = {
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "El correo electrónico es requerido")
    .max(254, "Ingresa un correo electrónico válido")
    .email("Ingresa un correo electrónico válido")
    .refine(val => !suggestEmailFix(val), val => ({ message: `¿Quisiste decir ${suggestEmailFix(val)}?` })),
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .regex(/^[a-zA-ZÀ-ÿ\s]{2,}$/, "El nombre solo debe contener letras y espacios"),
  phone: z
    .string()
    .min(1, "El teléfono es requerido")
    .regex(/^\d{10}$/, "Ingresa un número de teléfono válido (10 dígitos)"),
  rememberContact: z.boolean(),
};

export const bookingFormSchema = z.object({
  ...contactFields,
  services: z.array(z.string()).min(1, "Debes seleccionar al menos un servicio"),
  date: z
    .string()
    .min(1, "La fecha es requerida")
    .refine(val => !CLOSED_DATES.includes(val), {
      message: "La barbería permanecerá cerrada en esta fecha. Por favor selecciona otro día.",
    }),
  time: z.string().min(1, "La hora es requerida"),
});

export type BookingFormData = z.infer<typeof bookingFormSchema>;
