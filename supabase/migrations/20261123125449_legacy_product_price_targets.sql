-- The old product form only asked for a maximum price, but silently inserted 5%.
-- Preserve the user's price target; category rules and explicitly configured new rules stay unchanged.
update public.alerts set min_discount=null
where offer_id is not null and max_price is not null and min_discount=5
 and min_drop_amount is null and spec_filters='{}'::jsonb
 and created_at < timestamptz '2026-11-23 12:41:39+00';
