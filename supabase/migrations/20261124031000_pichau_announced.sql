-- Pichau parcial: preços anunciados pela própria loja no canal t.me/pichauofertas (links pelo encurtador de marca
-- pruuu.me, que a Pichau usa no YouTube oficial). Site bloqueia robôs; página do produto não conferida.
begin;
update public.store_registry set status='partial',verified_at=now(),trust_policy='Parcial: preços anunciados no canal da Pichau no Telegram (t.me/pichauofertas; encurtador de marca pruuu.me também usado no YouTube oficial @pichauinfo). Site bloqueia robôs; página do produto não conferida.' where id='pichau';
commit;
