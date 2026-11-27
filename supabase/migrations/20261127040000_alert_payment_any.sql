-- Alertas com forma de pagamento "Pix ou cartão" (any): dispara se a oferta atender às condições no Pix OU no cartão,
-- cada modalidade avaliada com seus próprios preço, habitual e queda (nunca misturando). Padrão para alertas NOVOS;
-- alertas existentes mantêm o valor gravado (pix/card).
alter table public.alerts drop constraint if exists alerts_payment_check;
alter table public.alerts add constraint alerts_payment_check check (payment in ('pix','card','any'));
alter table public.alerts alter column payment set default 'any';
