begin;
alter table public.offers drop constraint offers_verification_status_check;
alter table public.offers add constraint offers_verification_status_check check(verification_status in ('verified','failed','excluded'));
commit;
