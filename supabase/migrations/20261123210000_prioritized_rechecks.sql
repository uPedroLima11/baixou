-- Fila de rechecagem por prioridade (substitui "ordem de next_attempt_at" pura):
--  0) anúncios disponíveis acompanhados por alguém com e-mail ligado: alerta de produto/anúncio, alerta de categoria
--     cujo preço máximo está perto (<=120% do preço atual) ou favorito;
--  1) demais anúncios disponíveis, pelo vencimento mais próximo (evita sair do catálogo por TTL);
--  2) indisponíveis, com falha, excluídos ou ainda sem oferta, por next_attempt_at.
-- Só itens já devidos (next_attempt_at <= now()). Não altera TTL nem marca nada como verificado.
create index if not exists offers_url on public.offers(url);
create index if not exists alerts_offer on public.alerts(offer_id) where offer_id is not null;
create index if not exists alerts_product on public.alerts(product_id) where product_id is not null;
create index if not exists wishlist_offer on public.wishlist(offer_id);

create or replace function public.due_rechecks(p_store text,p_limit integer)
returns table(url text,category text,failures integer,priority integer)
language sql stable security invoker set search_path='' as $$
 with due as (
  select c.url,c.category,c.failures,c.next_attempt_at,o.id offer_id,o.product_id,o.category offer_category,o.price,o.available,o.expires_at
  from public.product_candidates c
  left join public.offers o on o.url=c.url
  where c.store=p_store and c.last_attempt_at is not null and c.next_attempt_at<=now()
 ), watchers as (
  select a.offer_id,a.product_id,a.category,a.max_price,(a.offer_id is null and a.product_id is null) is_category
  from public.alerts a join public.profiles p on p.id=a.user_id
  where a.enabled and p.email_enabled
 )
 select d.url,d.category,d.failures,
  case when d.available and (
    exists(select 1 from watchers w where (w.offer_id=d.offer_id) or (d.product_id is not null and w.product_id=d.product_id)
                                       or (w.is_category and (w.category='all' or w.category=d.offer_category) and (w.max_price is null or d.price<=w.max_price*1.2)))
    or exists(select 1 from public.wishlist wl join public.profiles p on p.id=wl.user_id where p.email_enabled and p.wishlist_email_enabled and wl.offer_id=d.offer_id)
  ) then 0 when d.available then 1 else 2 end::integer priority
 from due d
 order by priority, case when d.available then d.expires_at end nulls last, d.next_attempt_at
 limit greatest(0,least(p_limit,200))
$$;
revoke execute on function public.due_rechecks(text,integer) from public,anon,authenticated;
grant execute on function public.due_rechecks(text,integer) to service_role;
