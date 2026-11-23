-- Ensaio com rollback das reservas de envio (npx supabase db query --remote=slmhkfqqeyptngjubfhn --yes --file tests/notification-claims.sql).
begin;
create temp table r(step text,v text) on commit drop;
do $$ declare u uuid; o text; a bigint; b bigint; c bigint; d bigint;
begin
 select id into u from public.profiles limit 1; select id into o from public.offers limit 1;
 a:=public.claim_notification(u,'test:claim',o,100,'price'); insert into r values('first claim',a::text);
 b:=public.claim_notification(u,'test:claim',o,100,'price'); insert into r values('concurrent duplicate is null',coalesce(b::text,'null'));
 perform public.finish_notification(a,false,false,'SMTP 421',null);
 c:=public.claim_notification(u,'test:claim',o,100,'price'); insert into r values('retry before backoff null',coalesce(c::text,'null'));
 update public.notification_log set next_attempt_at=now()-interval '1 second' where id=a;
 c:=public.claim_notification(u,'test:claim',o,100,'price'); insert into r values('retry after backoff',coalesce(c::text,'null'));
 perform public.finish_notification(c,true,false,null,'<m@id>');
 insert into r select 'state price',last_price::text from public.notification_state where user_id=u and notification_key='test:claim';
 d:=public.claim_notification(u,'test:claim',o,90,'price'); insert into r values('after sent same day null',coalesce(d::text,'null'));
 insert into r select 'log',status||'/'||attempts from public.notification_log where id=a;
 insert into r select 'anon exec', has_function_privilege('anon','public.claim_notification(uuid,text,text,numeric,text)','execute')::text;
 insert into r select 'auth exec', has_function_privilege('authenticated','public.finish_notification(bigint,boolean,boolean,text,text)','execute')::text;
end $$;
select * from r;
rollback;
