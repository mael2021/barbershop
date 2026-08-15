-- Columnas de control para el envío de correos con Resend.
-- Sirven para que ambos correos sean idempotentes: una reserva nunca recibe
-- el mismo correo dos veces, aunque la función se invoque varias veces.

alter table public.reservations
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists reminder_sent_at     timestamptz;

comment on column public.reservations.confirmation_sent_at is
  'Momento en que se envió el correo de confirmación. NULL = aún no se envía.';
comment on column public.reservations.reminder_sent_at is
  'Momento en que se envió el recordatorio "tu cita te espera". NULL = aún no se envía.';

-- El cron de recordatorios filtra por fecha + pendientes de enviar.
-- Índice parcial: solo indexa las filas que el cron realmente puede llegar a tocar.
create index if not exists reservations_pending_reminder_idx
  on public.reservations (date)
  where reminder_sent_at is null and status = 'confirmed';
