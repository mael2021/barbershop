-- Lista de supresión: direcciones a las que NO se debe volver a escribir.
--
-- Se llena sola desde el webhook de Resend cuando un correo rebota duro (buzón
-- inexistente) o el destinatario marca spam. Seguir escribiendo a esas direcciones
-- es lo que destruye la reputación del dominio remitente.

create table if not exists public.email_suppressions (
  email       text primary key,
  reason      text        not null check (reason in ('bounced', 'complained')),
  detail      text,
  created_at  timestamptz not null default now()
);

comment on table  public.email_suppressions            is 'Direcciones bloqueadas por rebote duro o queja de spam.';
comment on column public.email_suppressions.reason     is 'bounced = buzón inexistente/rechazo permanente. complained = marcó como spam.';
comment on column public.email_suppressions.detail     is 'Mensaje crudo que reportó Resend, para diagnóstico.';

-- Solo las Edge Functions (service role) tocan esta tabla. RLS activo sin políticas
-- deja fuera a anon y authenticated; el service role la ignora por diseño.
alter table public.email_suppressions enable row level security;
