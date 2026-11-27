-- Estatísticas na modalidade cartão: mesmas regras de group_daily/price_changes, lendo SOMENTE as colunas do cartão
-- do resumo diário (card_*_cents). Dias sem preço de cartão observado não existem (nada vem do Pix). As funções Pix
-- ficam como estavam.
create or replace function public.group_daily_card(p_ids text[], p_days integer)
 returns table(day date, offers integer, lowest numeric, lowest_offer text, median_low numeric, pairs integer, ratio numeric)
 language sql stable set search_path to '' as $function$
 with t as (select (now() at time zone 'America/Sao_Paulo')::date as today),
 d as (select x.offer_id,x.day,x.card_min_cents as min_cents from public.price_daily x,t
       where x.offer_id=any(p_ids[1:600]) and x.card_min_cents is not null and x.day>=t.today-least(greatest(p_days,1),400))
 select a.day,count(*)::integer,min(a.min_cents)/100.0,(array_agg(a.offer_id order by a.min_cents,a.offer_id))[1],
  (percentile_cont(0.5) within group (order by a.min_cents))::numeric/100.0,count(b.offer_id)::integer,
  (percentile_cont(0.5) within group (order by a.min_cents::numeric/nullif(b.min_cents,0)) filter (where b.offer_id is not null))::numeric
 from d a left join d b on b.offer_id=a.offer_id and b.day=a.day-1
 group by a.day order by a.day
$function$;

create or replace function public.price_changes_card(p_ids text[],p_days integer)
returns table(offer_id text,base_day date,base_price numeric,last_day date,last_price numeric,low numeric,high numeric,days integer)
language sql stable security invoker set search_path='' as $$
 with t as (select (now() at time zone 'America/Sao_Paulo')::date today),
 w as (select d.offer_id,d.day,d.card_min_cents as min_cents,d.card_max_cents as max_cents,d.card_close_cents as close_cents from public.price_daily d,t
       where d.offer_id=any(p_ids[1:600]) and d.card_close_cents is not null and d.day>=t.today-least(greatest(p_days,0),400)-3)
 select x.offer_id,b.day,b.close_cents/100.0,l.day,l.close_cents/100.0,x.low,x.high,x.days
 from (select w.offer_id,min(w.min_cents)/100.0 as low,max(w.max_cents)/100.0 as high,count(*)::integer as days from w group by 1) x
 cross join lateral (select w.day,w.close_cents from w where w.offer_id=x.offer_id order by w.day desc limit 1) l
 left join lateral (select w.day,w.close_cents from w,t where w.offer_id=x.offer_id and w.day<=t.today-p_days and w.day>=t.today-p_days-3 order by w.day desc limit 1) b on true
$$;
grant execute on function public.group_daily_card(text[],integer) to anon,authenticated,service_role;
grant execute on function public.price_changes_card(text[],integer) to anon,authenticated,service_role;
