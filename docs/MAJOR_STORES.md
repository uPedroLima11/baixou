# Pichau, Terabyte e Amazon — caminhos novos (Claude Code, 24/11/2026 ~01h UTC)

Nova frente: **canais oficiais de ofertas das próprias lojas no Telegram**, lidos pela prévia pública da web (`https://t.me/s/<canal>`; t.me não tem robots.txt), sem conta, bot ou login. São anúncios de primeira mão: produto, preço à vista, parcelado e link.

| Loja | Canal | Oficialidade | Conteúdo | Decisão |
| --- | --- | --- | --- | --- |
| Terabyte | `t.me/terabyteshopoficial` (119 mil inscritos, ~20 posts/h) | **Confirmada**: link no rodapé de www.terabyteshop.com.br (conferido uma vez no navegador do app) | Título com part number, "💰 R$ X" ou "A partir de R$ X" (= preço à vista Pix/boleto, 15% abaixo do cartão), link `/produto/<id>/<slug>` | **Integrado** como preço anunciado (ver abaixo) |
| Pichau | `t.me/pichauofertas` (97 mil inscritos, desde 2022) | **Não confirmada**: nome "Pichau", links pelo encurtador `pruuu.me` (Bitly de marca; raiz redireciona para pichau.com.br; "Pru Pru" é a marca da página de bloqueio da própria Pichau). Nenhuma página da Pichau acessível mostra o canal | "Oferta a partir de R$ X" (à vista) + "Ou Parcelado R$ Y" | Parser pronto e testado; **desligado** até o proprietário confirmar no rodapé de pichau.com.br |
| Amazon | `t.me/amazonbr` | Não é da Amazon (spam de 2021, 115 inscritos) | — | Descartado |

Conferência amostral (Terabyte, RTX 5060 Ghost 44165): post R$ 3.139,99 = página "R$ 3.139,99 · 15% de desconto à vista no boleto ou pix", cartão 12× R$ 307,84, "Vendido por: Terabyte", "Restam 4", "Pronta entrega".

Outras alternativas novas examinadas e descartadas:
- `igor-navarro/price-tracker` (atualizado em 23/11/2026, diz que Terabyte "funciona"): só funciona com User-Agent falso de Chrome na página bloqueada — impersonação, não usada.
- `Gabrielcodebr/price-scraping` (Amazon no GitHub Actions): Selenium headless com "aquecimento" e atrasos humanos — contorno e contra as Condições de Uso.
- `lukeSkywallk/price-checker` (2020) e similares: mesmas páginas bloqueadas.
- Pichau: o encurtador `pruuu.me` só devolve o redirecionamento (sem preço). Host de origem Magento não usado.
- Amazon: nenhum canal público próprio encontrado; continua dependente de Associados/Creators API ou aprovação.
- O navegador do app foi usado só para conferir o rodapé da Terabyte e um produto; o acesso à Pichau pelo navegador foi bloqueado pela política de permissões (não insistido).

Regras do conector (lib/connectors/telegram-channels.ts):
- `verification_status='announced'`, `checked_at` = horário do post, validade de 6 h; o post mais recente de cada produto vence.
- Não grava histórico, não entra na referência de mercado nem nos alertas por e-mail (que exigem 'verified').
- Rejeita post com cupom, open box/usado/vitrine/pré-venda, link fora da loja, preço ambíguo ou título que não confere com o slug do link.
- Preço = único valor da linha de preço (ou "De X por Y"); parcelado vai para a nota de pagamento, nunca para "preço antigo".
- Marca: só entre marcas já registradas no catálogo, primeira ocorrência no título; part number pelo fim do título (mesma regra das lojas).
- UI: "à vista · anunciado pela loja", "Anunciado pela loja no canal oficial do Telegram há X", e na comparação "anunciado pela loja, não conferido".

# Pichau, Terabyte e Amazon — investigação sem cadastro (Claude Code, 24/11/2026 ~00h UTC)

Diretriz: nenhuma conta, campanha, credencial ou e-mail comercial; nenhum contorno de Cloudflare/CAPTCHA, proxy ou cookie de terceiros; não substituir por outras lojas. Sondagens com o UA identificado do coletor (`BaixouBot/1.0`), uma requisição por URL, local e no runner (probe.yml, execução 45294199182).

| Método | Pichau | Terabyte | Amazon |
| --- | --- | --- | --- |
| robots.txt | 200: `Allow: /`, bloqueia `/api/`, `/checkout`, toda URL com `?` | 403 Cloudflare ("Just a moment") local e no runner | 200: permite `/*/dp/`, `/s?`, `/gp/product/` para `*` |
| llms.txt | 200, institucional (categorias, pagamentos: Pix com desconto, 12x). Sem feed | Existe (lido por ferramenta de terceiros, não pelo nosso UA): aponta sitemap e páginas de produto para preço/estoque; para nós é 403 Cloudflare | 404 |
| Sitemap | **200**, `/media/sitemap.xml` (4,2 MB, 19.064 URLs com lastmod; slugs trazem MPN). Sem preço/estoque | 403 Cloudflare | não testado (robots permite `/sitemaps`, mas não há preço) |
| Categoria/produto (HTML) | 403: local = desafio Cloudflare; runner = página "Site em Manutenção - Pru Pru" (121 KB) | 403 Cloudflare em todas as rotas | Não coletado: Condições de Uso proíbem robôs/mineração de dados (independe do robots) |
| JSON/GraphQL | `/api/pichau` (GraphQL usado pelo site e pelo TelePromo) bloqueado pelo robots | — | — |
| Origem Magento `media.pichau.com.br` | robots próprio (bloqueia `/api/`, `/graphql/`). **Não consultada**: usar o host de mídia/origem para obter páginas que o site principal bloqueia seria contornar o bloqueio | — | — |
| Feeds públicos | Nenhum publicado. Feed Merchant só sob autorização (conector pronto, desligado) | idem | RSS de mais vendidos foi descontinuado (404) |
| OSS/comunitário | hardware-price-scraper-api (2021, Heroku, mesmo HTML bloqueado), Selenium/monitor (navegador automatizado = desafio anti-bot) | webscraper 2018 (mesmo HTML 403); artigo TabNews usa busca do site (bloqueada) | AmzPy (impersonação/proxies), Pangolin (parser), Apify (pago) |
| Agregadores | Buscapé/Zoom: categoria 200, mas Termos de Uso cl. (v) proíbem "mineração de dados", "robôs" e (vi) reprodução/distribuição do conteúdo. Pelando/Promobit: ofertas postadas por usuários, sem como confirmar preço na loja (página bloqueada) | idem | idem; Buscapé lista Amazon, mas mesmo veto |
| Marketplace | Loja oficial no Mercado Livre (já coletada, `partial`; **não** é integração direta) | Sem loja oficial no ML | — |

Conclusão (classificação pedida pelo proprietário):
- **Pichau: parcialmente acessível.** Catálogo de URLs/MPN público via sitemap, mas nenhum preço, estoque ou condição de pagamento acessível sem passar por bloqueio. Dados diretos dependem de autorização (feed ou liberação do UA). O sitemap pode servir no futuro para casar identidade, nunca como oferta.
- **Terabyte: tecnicamente bloqueada após investigação.** Cloudflare responde 403 até ao robots.txt e ao próprio llms.txt que convida agentes. Depende de liberação/feed.
- **Amazon: dependente de autorização.** Robots permite páginas de produto, mas as Condições de Uso vedam robôs, e a política de Associados (cl. 6(y)) veda rastreamento/alerta de preço sem aprovação escrita; Creators API exige conta aceita e 10 vendas/30 dias.
- Nenhuma das três foi integrada. Nenhum dado de terceiros foi publicado como oferta verificada.

# Alternativas comunitárias — avaliação concreta (Codex, 23/11/2026)

Pesquisa adicional autorizada: API não oficial e código aberto são elegíveis quando gratuitos e permitidos. Repositório público não concede licença sobre dados da loja. Nenhuma nova tentativa aos produtos bloqueados, nenhum código de terceiros executado.

| Candidata | Caminho verificado | Decisão nesta etapa |
| --- | --- | --- |
| [TelePromo/Pichau.py](https://github.com/Sergio-Daniel-Pires/TelePromo/blob/14c29898bc2e415a6d03c45f65f5f3bc1b37d461/project/bots/Pichau.py) | Código MIT, última atualização do repo em 2024. Usa GraphQL em /api/pichau?query=, com campos Pix/estoque. | Caminho /api/ e queries já recusados pelo robots documentado em COLLECTOR_RESEARCH.md. Não consultar como alternativa ao 403. Pode ser útil com autorização explícita da Pichau. |
| [webscraper-terabyteshop](https://github.com/fernandosutter/webscraper-terabyteshop/blob/master/Web%20Scraping%20Terabyte%20Shop.py) | requests + BeautifulSoup na categoria pública, exporta título/preço a CSV. Último push 2018; sem licença declarada. | Repete a mesma página já bloqueada; não traz feed ou canal independente. Não resolve acesso nem comprova disponibilidade. |
| [fastAPI-zero](https://github.com/eusouanderson/fastAPI-zero) | Agregador com httpx, sitemap, JSON-LD e HTML. | API é a interface do próprio scraper; não demonstra feed autorizado independente. Não muda o acesso à origem. |
| [AmzPy](https://github.com/theonlyanil/amzpy) | MIT; descreve impersonação de navegador, retentativas após detecção e proxies. | Descartado para esta tarefa por depender de mecanismos de contorno e do HTML sujeito às restrições Amazon. |
| [Pangolin parser](https://github.com/Pangolin-spg/amazon-scraper-api) | Código aberto interpreta HTML local já obtido; serviço hospedado separado. | Parser não fornece aquisição permitida dos dados. Cota hospedada não comprova licença de redistribuição nem resolve políticas da origem. Não integrado. |
| [Falcon Data Hub](https://datahub.falcon-server.com.br/) | Candidata de API terceirizada com Pichau/Terabyte, documentação pública, Free 8 requisições/h (+até 2 bônus), sem cartão. A FAQ descreve coleta diária. | Não descartada por ser terceira: examinada documentação, custo e termos. A [política de uso](https://datahub.falcon-server.com.br/uso-aceitavel) exige autorização escrita para redistribuição em massa/base concorrente; [termos](https://datahub.falcon-server.com.br/termos) também remetem às licenças originais. Precisa confirmação de republicação e dados frescos de vendedor/estoque/pagamento antes de servir ao Baixou!. |

[Docs Falcon](https://datahub.falcon-server.com.br/docs): produtos por EAN, busca e histórico exigem chave; apenas /public/v1/stores é documentado como público. Teste único do endpoint público /public/v1/stores: HTTP200, 2.326 bytes, nove redes incluindo Pichau e Terabyte. Confirma metadados de lojas, não preços/estoque. Nenhum cadastro/chave obtido. Não há comprovação de preço/estoque atual suficiente para nosso TTL/alertas. A autorização de republicação é um bloqueio concreto, não uma preferência por API oficial. Pedido adicional em ACCESS_GUIDE.md.

---

# Atualização Codex — 23/11/2026

Reconsulta das fontes oficiais, sem repetir 403 de produtos nem fazer cadastros:

- [Pichau Creator Network](https://afiliados.pichau.com.br/): cadastro gratuito com análise manual, links e canal de alertas; não publica contrato de feed XML/CSV/JSON ou API de catálogo. Pedido pronto em ACCESS_GUIDE.md. A existência de alertas não autoriza leitura automatizada de canais privados.
- [Terabyte Parceiros](https://landing.terabyteshop.com.br/parceiros/): inscrição por formulário e aprovação por e-mail; canal publicado **parceiros@terabyteshop.com.br**. Não documenta feed de catálogo. A busca encontrou documentação de ferramenta interna de relatórios sob domínio da loja, exigindo usuário Manager/ACL: não é uma API pública para parceiros e não foi usada nem autenticada.
- [Amazon onboarding](https://associados.amazon.com.br/creatorsapi/docs/en-us/onboarding/register-for-creators-api) e [elegibilidade](https://associados.amazon.com.br/creatorsapi/docs/en-us/troubleshooting/error-codes-and-messages): aceitação final em Associados e 10 vendas qualificadas nos últimos 30 dias. Sem credenciais/conta elegível comprovada, conector continua desativado. Nenhum catálogo HTML coletado.
- Pichau via vitrine ML continua sendo cobertura parcial do marketplace, sem integração direta. Nenhuma das três lojas foi promovida a operacional nesta etapa.
- Regra atual é custo zero absoluto: Awin/Magalu não deve ser recomendado enquanto houver depósito. O trecho antigo abaixo que admite decidir por pagamento está superado.

---

# Grandes lojas e marketplaces — caminhos oficiais (23/11/2026)

Complementa `docs/PRIMARY_SOURCES.md`; não repetir a pesquisa registrada lá. Nenhum cadastro, pagamento ou contorno foi feito.

## Sondagem atual (uma requisição por URL, User-Agent `BaixouBot/1.0`, sem retentativa)

| Loja | robots.txt | Página de categoria | Conclusão |
| --- | --- | --- | --- |
| Mercado Livre | 200 (não bloqueia o Baixou) | 302 para `/gz/account-verification` | HTML exige verificação de conta: não coletar. API oficial com OAuth. |
| Magazine Luiza | 403 | 403 | Bloqueio total ao robô. Sem API consumidora pública. |
| Pichau | 200, `Allow: /` | 403 Cloudflare "Just a moment" | Robots permite, mas há desafio anti-bot. Não resolver desafio. |
| TerabyteShop | 403 Cloudflare | 403 Cloudflare | Bloqueio total. |
| Amazon | 200 | não testado | Condições de Uso proíbem robôs e mineração de dados. Só Creators API. |
| Shopee | 200 | não testado | SPA; caminho é a Affiliate Open API. |
| AliExpress | 200, bloqueia `/item*`, `/product/*`, `/api/*` | não testado | Caminho é a Affiliate API do Open Platform. |

Nenhuma das sete é integrável hoje sem uma ação do proprietário. Não há integração "viável sem você" que seja legítima.

## O que o proprietário precisa fazer, por prioridade

Credenciais NUNCA vão pelo chat. Depois de obtê-las, grave você mesmo no GitHub, num terminal autenticado:

```powershell
gh secret set NOME_DO_SECRET --repo uPedroLima11/baixou
```

O comando pede o valor sem exibi-lo. Avise só os nomes gravados.

### 1. Shopee — Programa de Afiliados + Open API (gratuito)

1. Entre em https://affiliate.shopee.com.br com sua conta Shopee e conclua a inscrição no Programa de Afiliados. A Shopee pede dados pessoais e de recebimento de comissão e faz análise.
2. Após aprovado, abra https://affiliate.shopee.com.br/open_api e solicite acesso à Open API. Você recebe **AppID** e **Secret**.
3. Secrets: `SHOPEE_AFFILIATE_APP_ID`, `SHOPEE_AFFILIATE_SECRET`.

Uso previsto: GraphQL `https://open-api.affiliate.shopee.com.br/graphql`, consulta `productOfferV2` por palavra-chave/categoria/loja com assinatura SHA256. Traz preço, loja, avaliações e link afiliado. Antes de ativar: testar requisição real, conferir campos de preço original/desconto e filtrar lojas (oficiais/indicadas) e anúncios, pois é marketplace.

### 2. AliExpress — Portals + Open Platform (gratuito)

1. Cadastre-se como afiliado em https://portals.aliexpress.com e anote o **Tracking ID**.
2. Registre-se como desenvolvedor em https://openservice.aliexpress.com, crie um App do tipo **Affiliates API** e aguarde aprovação. Você recebe **AppKey** e **AppSecret**.
3. Secrets: `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_TRACKING_ID`.

Uso previsto: `aliexpress.affiliate.product.query` e `hotproduct.query` com `target_currency=BRL`, `target_language=PT`, `ship_to_country=BR`. O preço depende da política de impostos do país de entrega; a interface terá de mostrar a condição informada pela API, nunca preço sem impostos como se fosse final.

### 3. Pichau e Terabyte — programas de parceiros + pedido de acesso (gratuito)

São as fontes principais de **kits upgrade**. O bloqueio é Cloudflare: só a própria loja pode liberar.

1. Pichau Creator Network: https://afiliados.pichau.com.br (cadastro gratuito, análise manual).
2. Terabyte Parceiros: https://landing.terabyteshop.com.br/parceiros/
3. Após aprovado, peça por escrito ao time de parceiros uma destas opções: (a) feed de produtos XML/CSV/JSON com preço, estoque e URL; ou (b) liberação do robô `BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)`, limitado a 1 requisição a cada 1,5 s, nas páginas de categoria/produto. Guarde a resposta; ela é a autorização que o projeto exige.
4. Se vier feed com chave: secrets `PICHAU_FEED_URL`/`TERABYTE_FEED_URL` (e chave, se houver). Se vier liberação: nenhum secret; basta reativar a fonte e testar no runner.

### 4. Mercado Livre — aplicação no DevCenter (gratuito, resultado incerto)

1. Em https://developers.mercadolivre.com.br/devcenter, crie uma aplicação com sua conta. Redirect URI: `https://baixouofertas.vercel.app/api/integrations/mercadolivre/callback`. Escopos: leitura (`read`) e `offline_access`. Sem tópicos de notificação.
2. Você recebe **Client ID** e **Client Secret**: secrets `MERCADOLIVRE_CLIENT_ID`, `MERCADOLIVRE_CLIENT_SECRET`.
3. Depois implemento o callback e você autoriza uma vez. O refresh token é rotativo e ficará numa tabela privada do Supabase (só service_role).

Risco documentado: desenvolvedores relatam `403` em `/sites/MLB/search` mesmo com token válido ([relatos públicos](https://www.reclameaqui.com.br/mercado-livre/erro-403-forbidden-ao-acessar-endpoint-sitesmlbsearch-da-api-do-mercado-livre_4HqcUyVoCdJmt4Lv/)). Com o token, testar também `/products/search`, `/products/{id}/items` e `/highlights/MLB/category/{id}`. Só declarar operacional após teste real; marketplace exige filtrar vendedor (reputação, loja oficial) e condição "novo".

### 5. Magazine Luiza — rede Awin (desativada pelo custo de adesão)

A Open API do Magalu é só para sellers, e o programa Parceiro/Influenciador Magalu oferece links, não catálogo. Fontes de terceiros citam Magalu na Awin, mas isso não foi confirmado em fonte oficial.

Não prosseguir com Awin: depósito viola custo zero. Só retomar com alternativa oficialmente gratuita verificada.

### 6. Amazon — só após vendas qualificadas

Associados: https://associados.amazon.com.br. A Creators API exige conta aceita e 10 vendas qualificadas nos últimos 30 dias, com cota proporcional ao desempenho. Não foi verificada outra alternativa compatível nesta pesquisa; HTML permanece sujeito às restrições das Condições de Uso.

## Ordem recomendada

Shopee e AliExpress (API gratuita e ampla), Pichau/Terabyte (kits upgrade, depende de resposta das lojas), Mercado Livre (teste com token), Awin/Magalu (bloqueado por custo), Amazon (depende de vendas). Cada integração nova roda como job próprio na matriz do Actions, então não reduz a capacidade de revalidação das quatro lojas atuais.

iByte (VTEX, home 200 com JSON-LD) e outras lojas menores ficam registradas para uma etapa futura.

## Redes de afiliados brasileiras (Claude Code, 23/11/2026, só leitura; nenhum cadastro/contato)

| Fonte | Grátis | Dados de produto | Pichau/Terabyte/Amazon | Exibir preço em comparador |
|---|---|---|---|---|
| [Lomadee](https://www.lomadee.com.br/llms.txt) (ex-Social Soul) | Sim, sem depósito citado | Oficialmente só links/cupons + MCP de marcas. API de busca de produtos citada apenas por terceiro ([Content Egg](https://ce-docs.keywordrush.com/modules/affiliate/lomadeeproducts)), ~10 req/min, sem atualização por ID — **não verificada** | **Terabyte** ([página da marca](https://www.lomadee.com.br/en/brands/terabyte), 2%, cookie 1 dia). Pichau/Amazon não | Não encontrado; terceiro ([Cuelinks](https://www.cuelinks.com/campaigns/terabyteshop-affiliate-program)) diz que a Terabyte veda deals/cupons — **não verificado** |
| [Afilio](https://www.afilio.com.br/) | Sim | Não encontrado | Nenhuma | — |
| [Actionpay](https://actionpay.com.br/) | Não verificado | Não encontrado | Nenhuma | — |
| Rakuten Advertising | Não verificado no BR | Feed/API globais | Nenhuma encontrada | Por anunciante |
| [Pichau Creator Network](https://afiliados.pichau.com.br/) | Sim, aprovação manual 3–5 dias | Só links (feed/API não mencionados; site 403 ao robô) | Pichau | Não verificado |
| [Terabyte Parceiros](https://www.terabyteshop.com.br/site/regras-programa-de-parceiros) | Sim (conta de cliente) | Não mencionado (403 ao robô) | Terabyte | Não verificado |
| [Amazon Associados](https://associados.amazon.com.br/help/operating/policies) | Sim | Só Creators API | Amazon | Preço só via API; **cl. 6(y): site não pode ter rastreamento/alerta de preço sem aprovação da Amazon** |

Conclusões: (1) Lomadee/Terabyte é o único caminho novo plausível, mas a API de produtos e o direito de exibir preço precisam ser confirmados no painel/por escrito; (2) Pichau só oferece links — pedir feed na candidatura; (3) **Amazon: mesmo com Creators API, histórico e alertas de preço (núcleo do Baixou!) exigem aprovação escrita da Amazon.** Isso rebaixa a Amazon abaixo de Pichau/Terabyte. O caso G305 (Amazon R$ 161,91) não pode virar coleta.
