import { useCallback, useEffect, useRef, useState } from "react";
import { type UseFormReturn } from "react-hook-form";
import { Check, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/supabase/client";
import { bookingFormSchema, type BookingFormData } from "./schema";
import { forgetBookingContact, getRememberedContact } from "./rememberedContact";

type SavedContact = { name: string; phone: string };

const fields = [
  { name: "name", label: "Nombre completo", autoComplete: "name", placeholder: "Ingresa tu nombre" },
  { name: "phone", label: "Teléfono", autoComplete: "tel-national", placeholder: "Ingresa tu teléfono" },
] as const;

export const ContactFields = ({ form, isActive }: { form: UseFormReturn<BookingFormData>; isActive: boolean }) => {
  const { register, setValue, getValues, watch, formState: { errors } } = form;
  const email = watch("email");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const requestId = useRef(0);
  const filledValues = useRef<Partial<Pick<BookingFormData, "name" | "phone">>>({});
  const lookedUpEmail = useRef<string | undefined>(undefined);
  const editedEmail = useRef(false);

  useEffect(() => () => { requestId.current += 1; }, []);

  const lookupContact = useCallback(async (address?: string) => {
    const stored = getRememberedContact();
    if (!stored) return;

    const parsedEmail = bookingFormSchema.shape.email.safeParse(address ?? stored.email);
    if (!parsedEmail.success || parsedEmail.data !== stored.email || lookedUpEmail.current === stored.email) return;

    const { email, token } = stored;
    lookedUpEmail.current = email;
    const id = ++requestId.current;
    setIsLookingUp(true);

    const { data, error } = await supabase.functions.invoke<{ contact: SavedContact | null }>("booking-contact", {
      body: { action: "lookup", email, token },
    });
    if (id !== requestId.current) return;
    setIsLookingUp(false);

    if (error || !data) {
      lookedUpEmail.current = undefined;
      return;
    }
    if (!data.contact) {
      forgetBookingContact(email, token);
      return;
    }

    const currentEmail = getValues("email").trim().toLowerCase();
    if (currentEmail && currentEmail !== email) return;
    if (address === undefined && !currentEmail) {
      setValue("email", email, { shouldValidate: true, shouldDirty: true });
    }
    const contact = { name: data.contact.name.trim(), phone: data.contact.phone };
    for (const { name } of fields) {
      const value = contact[name];
      if (!getValues(name).trim() && bookingFormSchema.shape[name].safeParse(value).success) {
        setValue(name, value, { shouldValidate: true, shouldDirty: true });
        filledValues.current[name] = value;
      }
    }
    setValue("rememberContact", true);
  }, [getValues, setValue]);

  useEffect(() => {
    if (isActive && !editedEmail.current && !getValues("email").trim()) void lookupContact();
  }, [getValues, isActive, lookupContact]);

  const handleEmailChange = (nextEmail: string) => {
    if (nextEmail.trim().toLowerCase() === email.trim().toLowerCase()) return;

    editedEmail.current = true;
    requestId.current += 1;
    setIsLookingUp(false);
    if (lookedUpEmail.current) setValue("rememberContact", false);
    lookedUpEmail.current = undefined;

    for (const { name } of fields) {
      if (filledValues.current[name] === getValues(name)) {
        setValue(name, "", { shouldDirty: true });
      }
    }
    filledValues.current = {};
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-urban-purple to-neon-green">
          <Phone className="h-8 w-8 text-white" />
        </div>
        <h3 className="mb-2 text-2xl font-bold text-white uppercase">Tus datos</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="booking-email" className="font-bold text-white uppercase">Correo electrónico</Label>
          <Input
            id="booking-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register("email", {
              onChange: event => handleEmailChange(event.target.value),
              onBlur: event => { void lookupContact(event.target.value); },
            })}
            placeholder="Ingresa tu correo"
            className="border-gray-600 bg-graffiti-dark text-white placeholder-gray-400"
          />
          {errors.email && <p role="alert" className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
        </div>

        {isLookingUp && <p role="status" className="text-sm text-gray-300">Buscando tus datos guardados…</p>}

        {fields.map(({ name, label, autoComplete, placeholder }) => (
          <div key={name}>
            <Label htmlFor={`booking-${name}`} className="font-bold text-white uppercase">{label}</Label>
            <Input
              id={`booking-${name}`}
              {...register(name)}
              type={name === "phone" ? "tel" : "text"}
              autoComplete={autoComplete}
              placeholder={placeholder}
              aria-invalid={Boolean(errors[name])}
              className="border-gray-600 bg-graffiti-dark text-white placeholder-gray-400"
            />
            {errors[name] && <p role="alert" className="mt-1 text-sm text-red-500">{errors[name].message}</p>}
          </div>
        ))}

        <label className="relative flex cursor-pointer items-start gap-3 rounded-xl border border-gray-600 bg-graffiti-dark/70 p-4 transition-colors hover:border-spray-orange/70 has-checked:border-spray-orange/70 has-checked:bg-spray-orange/10">
          <input
            type="checkbox"
            {...register("rememberContact")}
            className="peer sr-only"
            aria-labelledby="booking-remember-label"
            aria-describedby="booking-remember-description"
          />
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-gray-500 bg-graffiti-dark text-transparent transition-colors peer-checked:border-spray-orange peer-checked:bg-spray-orange peer-checked:text-graffiti-dark peer-focus-visible:ring-2 peer-focus-visible:ring-electric-blue peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-graffiti-dark"
          >
            <Check className="size-4 stroke-3" />
          </span>
          <span>
            <span id="booking-remember-label" className="block text-sm font-semibold text-white">
              Recordar mis datos en este dispositivo
            </span>
            <span id="booking-remember-description" className="mt-1 block text-xs leading-relaxed text-gray-300">
              Autocompleta tu correo, nombre y teléfono cuando vuelvas a reservar en este navegador.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
};
