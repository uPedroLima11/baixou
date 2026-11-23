-- Candidatos nunca tentados, até p_per_category por categoria (mais antigos primeiro em cada uma).
-- Antes o coletor lia só os 300 mais antigos da loja inteira; categorias recém-descobertas (ex.: kits upgrade)
-- ficavam fora da janela e nunca recebiam vaga no rodízio por categoria.
create or replace function public.diverse_candidates(p_store text, p_per_category integer default 20)
returns table(url text, category text, failures integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.url, c.category, c.failures
  from (
    select pc.url, pc.category, pc.failures,
           row_number() over (partition by pc.category order by pc.discovered_at, pc.url) as rn
    from public.product_candidates pc
    where pc.store = p_store and pc.last_attempt_at is null and pc.next_attempt_at <= now()
  ) c
  where c.rn <= least(greatest(p_per_category, 1), 100)
  order by c.rn, c.category
$$;

revoke execute on function public.diverse_candidates(text, integer) from public, anon, authenticated;
grant execute on function public.diverse_candidates(text, integer) to service_role;
