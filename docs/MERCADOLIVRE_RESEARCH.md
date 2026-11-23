# Mercado Livre sem DevCenter — investigação e resultado (23/11/2026)

Restrição do proprietário: conta Developers bloqueada para criar aplicações, então sem OAuth. Custo zero. Sem cookies, contas automatizadas, CAPTCHA, proxies ou troca de User-Agent. Todas as requisições usaram `BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)`, uma por URL, com pausa de 1,5 s.

## Resultado

**Viável e em produção (cobertura parcial): vitrines públicas de lojas oficiais** (`https://www.mercadolivre.com.br/loja/{slug}`).

- Respondem 200 também no runner do GitHub (probe 45225406075: NVIDIA 30 cards, ASUS 40, Pichau 15).
- O robots.txt de www não bloqueia o nosso User-Agent nesses caminhos. Ele bloqueia crawlers de IA nomeados e alguns caminhos internos.
- Cada loja oficial pertence a um único vendedor verificado pelo Mercado Livre (`official_store_id` e `seller_id` na página).
- Os cards trazem título, IDs de catálogo e de anúncio, preço atual (geralmente Pix), preço anterior anunciado, preço em outros meios e imagem.
- Coleta hospedada 45226618462: 329 anúncios gravados no Supabase, 169 com desconto anunciado, 0 rejeitados, 0 erros, 25 lojas sem falha.

Limites, sem disfarce:
- Só os itens exibidos na vitrine (≈5–120 por loja), não o catálogo inteiro.
- Disponibilidade inferida da vitrine ativa. Item que some da vitrine vence pelo TTL, sem ser marcado esgotado.
- Sem MPN/GTIN, então não casa com outras lojas por identidade.
- "Antes" é preço de referência anunciado pelo ML: entra como desconto anunciado, nunca como queda comprovada.
- Vendedores comuns do marketplace não são coletados.
- Mudanças de HTML (`poly-card`) quebram o parser; o fixture real em `tests/fixtures/expansion/mercadolivre-loja-pichau.html` detecta isso no CI.

## Alternativas testadas

| Alternativa | Resultado concreto |
| --- | --- |
| API sem token: `/products/{id}`, `/highlights/...` | 401 `authorization value not present` |
| API sem token: `/items`, `/users`, `/products/{id}/items`, `/sites/MLB/categories` | 403 `PA_UNAUTHORIZED_RESULT_FROM_POLICIES` |
| API sem token: `/sites/MLB/search` | 403 `forbidden` (também relatado com token por terceiros) |
| API sem token: `/categories/{id}` | 200, só metadados. O robots.txt da API recusa o nosso robô, então não usamos. |
| Página de produto `/p/MLB…` e listagens `lista.mercadolivre.com.br` | 302 para `/gz/account-verification` (local e no runner). Não contornar. |
| Sitemaps | robots.txt de www não declara sitemap |
| JSON-LD | páginas de produto bloqueadas; vitrines não têm JSON-LD, mas têm cards renderizados no servidor |
| Bibliotecas/SDKs comunitários | todos dependem da API (exige token) ou das páginas de produto/lista (verificação de conta). Nenhum caminho próprio sem contorno. |
| Google Shopping / comparadores (Buscapé, Zoom) | sem API gratuita de preços; raspar terceiros reproduz conteúdo alheio e não verifica o anúncio. Não usado. |
| LinksBR (Telegram/Discord) | só descoberta, e os termos do Telegram restringem coleta externa (ver PRIMARY_SOURCES.md). Mesmo com links, a página de produto não pode ser verificada. Pendente de autorização. |

## Lojas oficiais monitoradas

Lista em `lib/connectors/mercadolivre-stores.ts` (25): Pichau, KaBuM!, Gigabyte, ASUS, NVIDIA, Corsair, XPG, ADATA, SanDisk, Logitech G, Logitech, Redragon, Pcyes, Mancer, Samsung, LG, AOC, Philips, Acer, Lenovo, Dell, HP, Positivo, JBL, Edifier.

Slugs inexistentes redirecionam para `/lojas-oficiais` (ex.: amd, intel, msi, galax, terabyteshop, western-digital, crucial). O diretório completo é paginado via JavaScript; novos slugs devem ser conferidos com `probe.yml` antes de entrar na lista.

## Operação

- Job `connectors` em collect.yml, em paralelo à matriz das lojas HTML, a cada ~15 min (relay). Cerca de 25 requisições ao ML por execução.
- Desligar: variável de repositório `ML_STOREFRONTS=off`.
- Validar mudanças: `connectors.yml` (manual) e `probe.yml` (acesso a partir do runner).
- Cadastro: `store_registry.mercadolivre = partial` (cobertura parcial).
