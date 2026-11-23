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

Associados: https://associados.amazon.com.br. A Creators API exige conta aceita e 10 vendas qualificadas nos últimos 30 dias, com cota proporcional ao desempenho. Até lá não há caminho legítimo; HTML é proibido pelas Condições de Uso.

## Ordem recomendada

Shopee e AliExpress (API gratuita e ampla), Pichau/Terabyte (kits upgrade, depende de resposta das lojas), Mercado Livre (teste com token), Awin/Magalu (bloqueado por custo), Amazon (depende de vendas). Cada integração nova roda como job próprio na matriz do Actions, então não reduz a capacidade de revalidação das quatro lojas atuais.

iByte (VTEX, home 200 com JSON-LD) e outras lojas menores ficam registradas para uma etapa futura.
