-- Programa el recordatorio "tu cita te espera" (2 horas antes de la cita).
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase, sustituyendo los dos placeholders.
-- No va en supabase/migrations porque contiene el service role key: no debe versionarse
-- ni aplicarse con `supabase db push`.
--
--   <PROJECT_URL>       -> https://xxxxxxxxxxxx.supabase.co
--   <SERVICE_ROLE_KEY>  -> Settings > API > service_role (secret)

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Los secretos se guardan cifrados en Vault, no en la definición del cron.
select vault.create_secret('<PROJECT_URL>',      'project_url');
select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');

-- Cada 15 min: la función revisa qué citas caen dentro de las próximas 2 horas.
-- Correr seguido es barato (una query con índice parcial) y hace que una reserva
-- creada con poca anticipación siga recibiendo su recordatorio a tiempo.
select cron.schedule(
  'send-appointment-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Verificar que quedó programado:
--   select * from cron.job;
-- Ver las últimas corridas:
--   select * from cron.job_run_details order by start_time desc limit 20;
-- Quitar el cron:
--   select cron.unschedule('send-appointment-reminders');
