-- Teto da fila por rodada: 200 -> 400. KaBuM (26/11) tinha 838 vivas, 606 devidas e 400 vencidas com 200 itens/rodada;
-- o workflow passou a pedir 380 em 620 s (mesmo ritmo por requisição). Demais lojas continuam pedindo 200.
-- Definição idêntica à vigente (pg_get_functiondef), só o limite muda.
begin;
CREATE OR REPLACE FUNCTION public.due_rechecks(p_store text, p_limit integer)
 RETURNS TABLE(url text, category text, failures integer, priority integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
 limit greatest(0,least(p_limit,400))
$function$

;
commit;
