-- Histórico de longo prazo econômico: um resumo diário por anúncio (dia de São Paulo), mantido por gatilho a partir
-- das observações brutas (price_history, retenção 35 dias). Valores em centavos (int4) para caber no plano gratuito:
-- ~120 bytes/linha com índice; ~2,3 mil anúncios/dia ≈ 100 MB/ano. Retenção de 400 dias (limpeza no coletor).
-- Só observações reais entram (o coletor grava histórico apenas de anúncios disponíveis); nada é interpolado.
begin;
create table if not exists public.price_daily(
 offer_id text not null references public.offers(id) on delete cascade,
 day date not null,
 min_cents integer not null check(min_cents>0),
 max_cents integer not null check(max_cents>=min_cents),
 close_cents integer not null check(close_cents>0),
 samples smallint not null default 1,
 primary key(offer_id,day)
);
create index if not exists price_daily_day on public.price_daily(day);
alter table public.price_daily enable row level security;
drop policy if exists public_price_daily on public.price_daily;
create policy public_price_daily on public.price_daily for select to anon,authenticated using(true);
grant select on public.price_daily to anon,authenticated;
grant all on public.price_daily to service_role;

create or replace function public.roll_price_daily() returns trigger language plpgsql security definer set search_path='' as $$
declare c integer := round(new.price*100)::integer;
begin
 insert into public.price_daily as p(offer_id,day,min_cents,max_cents,close_cents,samples)
 values(new.offer_id,(new.observed_at at time zone 'America/Sao_Paulo')::date,c,c,c,1)
 on conflict(offer_id,day) do update set
  min_cents=least(p.min_cents,excluded.min_cents),
  max_cents=greatest(p.max_cents,excluded.max_cents),
  close_cents=excluded.close_cents,
  samples=least(p.samples+1,32767);
 return null;
end $$;
revoke all on function public.roll_price_daily() from public,anon,authenticated;
drop trigger if exists price_history_daily on public.price_history;
create trigger price_history_daily after insert on public.price_history for each row execute function public.roll_price_daily();

-- Backfill a partir do bruto existente (fechamento = última observação do dia).
insert into public.price_daily(offer_id,day,min_cents,max_cents,close_cents,samples)
select offer_id,day,min(c),max(c),(array_agg(c order by observed_at desc))[1],least(count(*),32767)
from (select offer_id,(observed_at at time zone 'America/Sao_Paulo')::date as day,round(price*100)::integer as c,observed_at from public.price_history) h
group by offer_id,day
on conflict(offer_id,day) do nothing;

-- Variação por anúncio entre um dia-base (fechamento até 3 dias antes da âncora) e o último fechamento.
-- Base para painéis de amostra consistente: só anúncios observados nos dois momentos entram na comparação.
create or replace function public.price_changes(p_ids text[],p_days integer)
returns table(offer_id text,base_day date,base_price numeric,last_day date,last_price numeric,low numeric,high numeric,days integer)
language sql stable security invoker set search_path='' as $$
 with t as (select (now() at time zone 'America/Sao_Paulo')::date today),
 w as (select d.* from public.price_daily d,t
       where d.offer_id=any(p_ids[1:600]) and d.day>=t.today-least(greatest(p_days,0),400)-3)
 select x.offer_id,b.day,b.close_cents/100.0,l.day,l.close_cents/100.0,x.low,x.high,x.days
 from (select w.offer_id,min(w.min_cents)/100.0 as low,max(w.max_cents)/100.0 as high,count(*)::integer as days from w group by 1) x
 cross join lateral (select w.day,w.close_cents from w where w.offer_id=x.offer_id order by w.day desc limit 1) l
 left join lateral (select w.day,w.close_cents from w,t where w.offer_id=x.offer_id and w.day<=t.today-p_days and w.day>=t.today-p_days-3 order by w.day desc limit 1) b on true
$$;

-- Índice encadeado: para cada dia, mediana da razão fechamento(d)/fechamento(d-1) dos anúncios observados nos
-- dois dias consecutivos. Não é afetado pela entrada de produtos novos ou de outra faixa de preço.
create or replace function public.price_index(p_ids text[],p_days integer)
returns table(day date,offers integer,ratio numeric,lowest numeric)
language sql stable security invoker set search_path='' as $$
 with t as (select (now() at time zone 'America/Sao_Paulo')::date today),
 d as (select x.* from public.price_daily x,t where x.offer_id=any(p_ids[1:600]) and x.day>=t.today-least(greatest(p_days,1),400)-1)
 select a.day,count(b.offer_id)::integer,
  (percentile_cont(0.5) within group (order by a.close_cents::numeric/nullif(b.close_cents,0)) filter (where b.offer_id is not null))::numeric,
  min(a.min_cents)/100.0
 from d a left join d b on b.offer_id=a.offer_id and b.day=a.day-1
 group by a.day order by a.day
$$;
revoke all on function public.price_changes(text[],integer),public.price_index(text[],integer) from public;
grant execute on function public.price_changes(text[],integer),public.price_index(text[],integer) to anon,authenticated,service_role;
commit;
