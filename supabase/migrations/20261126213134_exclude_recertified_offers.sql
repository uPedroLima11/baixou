-- Evidência direta no título: duas GPUs recertificadas publicadas como novas.
-- Exclusão de política, nunca esgotamento: preservar available, preço, checked_at, histórico e vínculos salvos.
begin;
update public.offers
set expires_at=least(expires_at,now()), verification_status='excluded', last_attempt_at=now()
where store='guerradigital'
  and id in ('guerradigital-df330e365608db4d8192','guerradigital-12877d82a939b1b25039')
  and title ~* '\mRECERTIFICADA\M';
update public.product_candidates c
set next_attempt_at=now()+interval '24 hours',last_attempt_at=now(),failures=0
from public.offers o
where c.store=o.store and c.url=o.url and o.store='guerradigital'
  and o.id in ('guerradigital-df330e365608db4d8192','guerradigital-12877d82a939b1b25039')
  and o.verification_status='excluded';
commit;
