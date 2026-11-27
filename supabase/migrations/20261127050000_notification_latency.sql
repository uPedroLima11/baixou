-- Latência real dos avisos: quando a oferta foi verificada (offer_checked_at), quando a decisão reservou o aviso
-- (created_at) e quando o canal aceitou/enviou (sent_at). Último ciclo automático do WhatsApp para o diagnóstico.
alter table public.notification_log add column if not exists created_at timestamptz not null default now();
alter table public.notification_log add column if not exists offer_checked_at timestamptz;
alter table public.whatsapp_sender add column if not exists last_cycle_at timestamptz;
alter table public.whatsapp_sender add column if not exists last_cycle jsonb;
