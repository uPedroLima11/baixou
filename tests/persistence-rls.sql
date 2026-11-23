-- Run in the dedicated project. All test users/data are rolled back; no fake offers.
begin;
select set_config('qa.user_a',gen_random_uuid()::text,true),set_config('qa.user_b',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('qa.user_a')::uuid),(current_setting('qa.user_b')::uuid);
insert into public.wishlist(user_id,offer_id) select current_setting('qa.user_a')::uuid,id from public.offers limit 1;
insert into public.alerts(user_id,category,max_price,min_discount,min_drop_amount) values(current_setting('qa.user_a')::uuid,'ram',null,null,200);
select set_config('request.jwt.claim.sub',current_setting('qa.user_a'),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.wishlist where user_id=current_setting('qa.user_a')::uuid)<>1 then raise exception 'Own favorite unavailable';end if;
 if exists(select 1 from public.profiles where id=current_setting('qa.user_b')::uuid) then raise exception 'Cross-user profile exposed';end if;
 if not exists(select 1 from public.alerts where max_price is null and min_drop_amount=200) then raise exception 'Absolute-only alert unavailable';end if;
 begin
  insert into public.alerts(user_id,category,max_price) values(current_setting('qa.user_b')::uuid,'all',500);
  raise exception 'Cross-user alert insert accepted';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.user_b'),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.wishlist where user_id=current_setting('qa.user_a')::uuid) or exists(select 1 from public.alerts where user_id=current_setting('qa.user_a')::uuid) then raise exception 'Cross-user saved data exposed';end if;
end $$;
reset role;
do $$ begin
 begin
  delete from public.offers where id=(select offer_id from public.wishlist where user_id=current_setting('qa.user_a')::uuid limit 1);
  raise exception 'Saved product deletion accepted';
 exception when foreign_key_violation then null;end;
end $$;
rollback;
select 'RLS isolation, independent absolute alert and favorite deletion protection passed; test data rolled back' as result;
