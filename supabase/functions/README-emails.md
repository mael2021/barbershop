# Correos con Resend

Dos correos transaccionales, ambos en Edge Functions porque la API key de Resend no puede
vivir en el frontend (todo lo que empieza con `VITE_` se empaqueta en el bundle público).

| Función | Cuándo corre | Disparador |
|---|---|---|
| `send-confirmation-email` | Al crear la reserva | El cliente la invoca con el `reservationId` |
| `send-appointment-reminders` | 2 h antes de la cita | `pg_cron` cada 15 min |

Remitente: `Master Cuts <no-reply@newbloom.com.mx>` (dominio ya verificado en Resend).

## Diseño

**El correo destino nunca viaja en el request.** `send-confirmation-email` recibe solo un ID,
busca la reserva con el service role key y usa el correo guardado en la BD. Así el endpoint no
sirve para mandar correo a direcciones arbitrarias aunque sea públicamente invocable.

**Ambos envíos son idempotentes.** Las columnas `confirmation_sent_at` y `reminder_sent_at` se
marcan *después* de que Resend confirma el envío. Si Resend falla, la columna queda en `NULL` y
el envío se reintenta; si el cliente reintenta la invocación, no se duplica el correo.

`send-appointment-reminders` exige el service role key en el header `Authorization`, así que
solo el cron puede dispararlo (el anon key no alcanza).

**Se descarta el correo placeholder.** Antes de que el formulario pidiera el correo, la app
guardaba `no-email@barberia.com` en todas las reservas (~3.6k filas históricas). Esa cadena
tiene `@`, así que pasaría una validación ingenua; `isSendableEmail()` en `_shared/emails.ts`
la rechaza explícitamente. Enviarle correo generaría hard bounces contra un dominio ajeno y
eso quema la reputación de envío de `newbloom.com.mx`. Si en el futuro aparece otro relleno,
agregarlo a `PLACEHOLDER_EMAILS`.

## Puesta en marcha

### 1. Migración

```bash
supabase db push
```

Agrega `confirmation_sent_at` y `reminder_sent_at` a `reservations`, más el índice parcial que
usa el cron.

### 2. Secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
```

Opcionales (tienen default):

| Secret | Default | Para qué |
|---|---|---|
| `RESEND_FROM` | `Master Cuts <no-reply@newbloom.com.mx>` | Cambiar el remitente |
| `BARBERSHOP_TIMEZONE` | `America/Mexico_City` | Zona de la barbería (Panotla, Tlax.) |
| `REMINDER_LEAD_MINUTES` | `120` | Cuánto antes se manda el recordatorio |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los inyecta Supabase.

### 3. Deploy

```bash
supabase functions deploy send-confirmation-email
supabase functions deploy send-appointment-reminders
```

### 4. Cron

Ejecutar `supabase/cron/schedule-reminders.sql` en el SQL Editor, sustituyendo `<PROJECT_URL>`
y `<SERVICE_ROLE_KEY>`.

## Probar

Confirmación de una reserva existente (poner `confirmation_sent_at` en `NULL` para reenviar):

```bash
curl -X POST "$PROJECT_URL/functions/v1/send-confirmation-email" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reservationId": 1}'
```

Recordatorios (devuelve cuántas revisó, cuántas tocaban y cuántas mandó):

```bash
curl -X POST "$PROJECT_URL/functions/v1/send-appointment-reminders" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

Para forzar que una cita entre en la ventana sin esperar, subir el lead temporalmente:
`supabase secrets set REMINDER_LEAD_MINUTES=1440` (un día completo).

## Mantenimiento

`_shared/services.ts` duplica los precios de `src/consts/services.ts` — Deno no puede importar
del bundle de Vite (el alias `@/...` no resuelve fuera de Vite). **Al cambiar un precio hay que
tocar los dos archivos.** Un servicio que falte en el mapa se lista como "A consultar" y no
rompe el correo.
