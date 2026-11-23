begin;
create table public.catalog_products(id uuid primary key default gen_random_uuid(),brand text not null,mpn text,gtin text,variant jsonb not null default '{}',created_at timestamptz not null default now(),check(mpn is not null or gtin is not null));
create unique index canonical_mpn on public.catalog_products(brand,mpn) where mpn is not null;
create unique index canonical_gtin on public.catalog_products(gtin) where gtin is not null;
alter table public.catalog_products enable row level security;
create policy read_catalog_products on public.catalog_products for select to anon,authenticated using(true);
grant select on public.catalog_products to anon,authenticated;grant all on public.catalog_products to service_role;
alter table public.offers add column product_id uuid references public.catalog_products(id);
alter table public.offers add column gtin text;
alter table public.offers add column variant jsonb not null default '{}';
create index offers_product on public.offers(product_id);
alter table public.alerts add column product_id uuid references public.catalog_products(id);
alter table public.alerts add column product_variant jsonb not null default '{}';
alter table public.profiles add column wishlist_email_enabled boolean not null default true;
create table public.notification_state(user_id uuid not null references auth.users(id) on delete cascade,notification_key text not null,last_price numeric(12,2) not null,last_sent_at timestamptz not null default now(),primary key(user_id,notification_key));
alter table public.notification_state enable row level security;
revoke all on public.notification_state from anon,authenticated;grant all on public.notification_state to service_role;
alter table public.notification_log add column notification_key text;
update public.notification_log set notification_key='offer:'||offer_id;
alter table public.notification_log alter column notification_key set not null;
create unique index notification_product_day on public.notification_log(user_id,notification_key,day);
create function public.resolve_catalog_product(p_brand text,p_mpn text,p_gtin text,p_variant jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; candidate record; ids uuid[]; k text;
begin
 if p_brand is null or p_brand='' or (p_mpn is null and p_gtin is null) then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('product:'||p_brand,0));
 select array_agg(distinct id) into ids from public.catalog_products where (p_mpn is not null and brand=p_brand and mpn=p_mpn) or (p_gtin is not null and gtin=p_gtin);
 if coalesce(array_length(ids,1),0)>1 then return null;end if;
 if coalesce(array_length(ids,1),0)=1 then
 result:=ids[1];select * into candidate from public.catalog_products where id=result for update;
 if candidate.brand<>p_brand then return null;end if;
 for k in select jsonb_object_keys(coalesce(p_variant,'{}')) loop
 if candidate.variant ? k and candidate.variant->k<>p_variant->k then return null;end if;
 end loop;
 update public.catalog_products set mpn=coalesce(mpn,p_mpn),gtin=coalesce(gtin,p_gtin),variant=variant||coalesce(p_variant,'{}') where id=result;
 else insert into public.catalog_products(brand,mpn,gtin,variant) values(p_brand,p_mpn,p_gtin,coalesce(p_variant,'{}')) returning id into result;end if;
 return result;
end $$;
revoke all on function public.resolve_catalog_product(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_catalog_product(text,text,text,jsonb) to service_role;
create function public.attach_alert_product() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.offer_id is not null then select product_id,variant into new.product_id,new.product_variant from public.offers where id=new.offer_id;end if;return new;
end $$;
create trigger alert_identity before insert or update of offer_id on public.alerts for each row execute function public.attach_alert_product();
create function public.backfill_alert_identity() returns trigger language plpgsql security definer set search_path=public as $$
begin update public.alerts set product_id=new.product_id,product_variant=new.variant where offer_id=new.id and product_id is null;return new;end $$;
create trigger offer_identity after update of product_id on public.offers for each row when(new.product_id is not null) execute function public.backfill_alert_identity();
revoke all on function public.attach_alert_product(),public.backfill_alert_identity() from public;
commit;
