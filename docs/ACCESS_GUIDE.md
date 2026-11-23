# Guia de acessos oficiais — custo zero (23/11/2026)

Regra: nada pago, nenhum depósito, nenhuma assinatura. Se algum painel pedir pagamento, pare e avise. Nenhum cadastro foi feito em seu nome.

Credenciais nunca vão pelo chat. Grave cada uma você mesmo, num terminal já autenticado no GitHub (o valor é pedido sem aparecer na tela):

```powershell
gh secret set NOME --repo uPedroLima11/baixou
```

Quando o conector rodar também na Vercel, use `npx vercel env add NOME production` (marque como Sensitive). Depois, me diga apenas os nomes que gravou.

Uma integração só é considerada ativa depois de consultas reais devolverem produtos com preço, disponibilidade e vendedor, e de passarem pelas regras de `lib/connectors/policy.ts`. Concluir o cadastro não basta.

---

## 1. Mercado Livre (comece por aqui: sem aprovação de afiliado)

**Cadastro:** https://developers.mercadolivre.com.br/devcenter. Entre com sua conta do Mercado Livre e clique em "Criar uma aplicação".

**O que preencher:**
- Nome e descrição: "Baixou! — comparador de ofertas de tecnologia".
- URI de redirect: `https://baixouofertas.vercel.app/api/integrations/mercadolivre/callback`.
- Permissões: somente leitura e `offline_access` (renovação do acesso). Não marque escrita, vendas, mensagens nem pagamentos.
- Tópicos de notificação: nenhum.

**Elegibilidade e custo:** gratuito. O DevCenter pode exigir que a conta tenha dados validados (CPF/telefone). Não há plano pago para esses endpoints.

**Credenciais:** `MERCADOLIVRE_CLIENT_ID` e `MERCADOLIVRE_CLIENT_SECRET`, no GitHub e na Vercel. Depois eu implemento a rota de callback; você autoriza uma vez pelo link que eu enviar. O token de renovação é rotativo e fica numa tabela privada do Supabase, acessível só ao servidor.

**O que a API permite (a confirmar com o seu token):**
- Catálogo: `/products/search?site_id=MLB&q=…`, `/products/{id}` e `/products/{id}/items` (anúncios que competem pelo produto, com preço).
- Anúncios: `/items?ids=…` (preço, preço original, condição, estoque informado como faixa, vendedor) e `/items/{id}/sale_price` (preço promocional vigente).
- Vendedor: `/users/{id}` (`seller_reputation`, nível e status MercadoLíder) para filtrar reputação.
- Mais vendidos: `/highlights/MLB/category/{id}`, além da árvore de categorias.
- Risco conhecido: `/sites/MLB/search` responde 403 para muitos apps mesmo com token. Se for o caso aqui, usamos o catálogo e os destaques.
- Ofertas relâmpago de campanhas são ferramenta de vendedor; aparecem para nós só como preço promocional do anúncio.

## 2. Shopee — Programa de Afiliados + Open API

**Cadastro:** https://affiliate.shopee.com.br. Entre com sua conta Shopee e conclua a inscrição.

**O que preencher:**
- Dados pessoais e de recebimento de comissão. É gratuito: a Shopee paga você, não o contrário.
- Canal: informe `https://baixouofertas.vercel.app` como site.

**Elegibilidade e custo:** a inscrição passa por análise. Depois de aprovado, abra https://affiliate.shopee.com.br/open_api e solicite acesso. O painel informa se há critério adicional (por exemplo, histórico de cliques). Não há cobrança.

**Credenciais:** `SHOPEE_AFFILIATE_APP_ID` e `SHOPEE_AFFILIATE_SECRET`.

**O que a API permite:**
- GraphQL `https://open-api.affiliate.shopee.com.br/graphql`, assinado com SHA256 (AppID + timestamp + corpo + Secret).
- Consulta `productOfferV2` por palavra-chave, categoria, loja ou item, ordenável por relevância, vendas ou preço. Traz nome, preço, faixa de preço, taxa de desconto, vendas, nota, loja, tipo de loja (oficial/indicada) e link afiliado.
- Não informa estoque exato: o anúncio precisa ser conferido antes de aparecer como disponível.

## 3. AliExpress — Portals + Open Platform

**Cadastro em dois portais:**
1. https://portals.aliexpress.com: cadastro de afiliado com sua conta AliExpress. Em "Ad Settings"/"Tracking ID", crie um ID (ex.: `baixou`).
2. https://openservice.aliexpress.com: registre-se como desenvolvedor (pessoa física). Em "App Management", crie um App da categoria **Affiliates API** e aguarde a aprovação.

**Elegibilidade e custo:** gratuito. A aprovação do App pode levar alguns dias.

**Credenciais:** `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET` e `ALIEXPRESS_TRACKING_ID`.

**O que a API permite:**
- Gateway `https://api-sg.aliexpress.com/sync` (assinatura SHA256).
- Métodos: `aliexpress.affiliate.product.query` (busca por palavra/categoria/faixa de preço), `aliexpress.affiliate.hotproduct.query` (populares), `aliexpress.affiliate.productdetail.get` e `aliexpress.affiliate.featuredpromo.get` (campanhas promocionais).
- Campos: preço de venda e original, desconto, vendas recentes, avaliação, loja e link afiliado.
- Usaremos `target_currency=BRL`, `target_language=PT` e `ship_to_country=BR`. Impostos de importação dependem da regra de entrega no Brasil e do valor: o card terá de mostrar a condição informada, nunca "preço final" sem confirmação.

## 4. Pichau e Terabyte — pedido de acesso oficial

As duas bloqueiam robôs com Cloudflare; só a loja pode liberar. Envie pelos canais dos programas de parceiros:
- Pichau: https://afiliados.pichau.com.br (cadastro gratuito, depois contato do time de parceiros).
- Terabyte: https://landing.terabyteshop.com.br/parceiros/ — contato oficial publicado: parceiros@terabyteshop.com.br

Guarde as respostas: elas são a autorização documentada que o projeto exige.

**Mensagem (ajuste a saudação para cada loja):**

> Olá, equipe de parceiros da [Pichau/Terabyte].
>
> Sou Pedro, responsável pelo Baixou! (https://baixouofertas.vercel.app), um comparador gratuito de ofertas de hardware que direciona o usuário para a página da loja, sem intermediar vendas.
>
> Gostaríamos de exibir produtos da [loja] com preço e estoque corretos, incluindo kits upgrade. Precisamos de uma opção gratuita, sem depósito, assinatura ou taxa por acesso. Há alguma destas opções disponível para parceiros?
> 1. Feed de produtos (XML, CSV ou JSON) com preço à vista/Pix, condição de pagamento, estoque, vendedor, URL, imagem e MPN/GTIN quando disponíveis; ou
> 2. Autorização para coleta limitada das páginas públicas pelo robô identificado "BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)", com no máximo uma requisição a cada 1,5 s, respeitando o robots.txt.
>
> Usamos links de afiliado da [loja] quando aprovados e removemos qualquer dado mediante solicitação.
>
> Obrigado,
> Pedro — Baixou!

## 5. Amazon e Magalu — em espera, sem insistir

- **Amazon:** o caminho oficial verificado é a Creators API, que exige conta de Associados aceita e 10 vendas qualificadas nos últimos 30 dias. Páginas são proibidas aos robôs pelos termos. Retomar quando houver vendas por links de Associados.
- **Magalu:** a Open API é só para sellers, e o programa Influenciador Magalu oferece links, não catálogo. A rota Awin cita depósito, o que viola a regra de custo zero: **não seguir**. O site bloqueia o robô (403 até no robots.txt). Sem alternativa gratuita verificada.

## O que já está pronto no código

`lib/connectors/` define o contrato de conector independente e as regras de publicação para marketplaces: preço, moeda, disponibilidade, vendedor, reputação mínima, condição nova e URL do domínio da loja. Os conectores ficam desativados até existirem credenciais e uma consulta real aprovada.

## Alternativa terceira: Falcon Data Hub (ainda não autorizada para publicação)

[Contato do fornecedor](https://datahub.falcon-server.com.br/contato). A documentação anuncia plano gratuito sem cartão, mas a política requer autorização escrita para redistribuir dados em massa. Não criar conta nem depender do serviço antes de resolver isso.

Mensagem pronta, não enviada:

> Olá! Somos o Baixou! (https://baixouofertas.vercel.app), catálogo gratuito de ofertas de tecnologia. Encontramos a API de preços com Pichau/Terabyte. Antes de considerar uma integração, vocês autorizam por escrito exibir preços e comparações em nosso catálogo público no plano gratuito, sem depósito, assinatura, cartão ou cobrança excedente? Precisamos também confirmar a autorização das fontes originais, a cota disponível para preços, horário da última observação, vendedor, MPN/GTIN, condição nova, estoque e base Pix/à vista. A coleta é diária ou há confirmação recente por anúncio? Sem esses dados não podemos anunciar estoque atual nem promoção comprovada. Obrigado!
