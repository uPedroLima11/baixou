-- Prioridade de rechecagem (due_rechecks): alertas/favoritos de quem recebe por QUALQUER canal ativo (e-mail ou WhatsApp
-- confirmado e ligado). Antes só e-mail contava. Resto da função idêntico ao vigente.
create or replace function public.due_rechecks(p_store text, p_limit integer)
 returns table(url text, category text, failures integer, priority integer)
 language sql stable set search_path to '' as $function$
 with due as (
  select c.url,c.category,c.failures,c.next_attempt_at,o.id offer_id,o.product_id,o.category offer_category,o.price,o.available,o.expires_at
  from public.product_candidates c
  left join public.offers o on o.url=c.url
  where c.store=p_store and c.last_attempt_at is not null and c.next_attempt_at<=now()
 ), receivers as (
  select p.id,p.wishlist_email_enabled from public.profiles p
  where p.email_enabled or exists(select 1 from public.whatsapp_contacts w where w.user_id=p.id and w.status='confirmed' and w.enabled)
 ), watchers as (
  select a.offer_id,a.product_id,a.category,a.max_price,(a.offer_id is null and a.product_id is null) is_category
  from public.alerts a join receivers r on r.id=a.user_id
  where a.enabled
 )
 select d.url,d.category,d.failures,
  case when d.available and (
    exists(select 1 from watchers w where (w.offer_id=d.offer_id) or (d.product_id is not null and w.product_id=d.product_id)
                                       or (w.is_category and (w.category='all' or w.category=d.offer_category) and (w.max_price is null or d.price<=w.max_price*1.2)))
    or exists(select 1 from public.wishlist wl join receivers r on r.id=wl.user_id where r.wishlist_email_enabled and wl.offer_id=d.offer_id)
  ) then 0 when d.available then 1 else 2 end::integer priority
 from due d
 order by priority, case when d.available then d.expires_at end nulls last, d.next_attempt_at
 limit greatest(0,least(p_limit,600))
$function$;
