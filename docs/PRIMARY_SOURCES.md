# Fontes primárias e integrações gratuitas reais

Pesquisa em 23/11/2026. Nenhum cadastro, compra, contato ou autorização de terceiros foi realizado. HTTP foi testado com Node fetch público e timeout; não houve bypass de CAPTCHA/403. Requisições autenticadas não foram testadas sem credenciais.

## Conclusão acionável

**Implementável agora, sem API paga e sem conta de afiliado:** coletar as páginas públicas da KaBuM, cujo HTML e estado estruturado foram validados com HTTP 200; descobrir produtos pelas categorias e confirmar oferta, vendedor e estoque no detalhe. Isso é um adaptador HTML público, não uma API oficial. Medir saúde no ambiente hospedado antes de anunciar cobertura: o comportamento pode diferir do teste.

**Expansão estruturada preferível, quando houver contas elegíveis:** feed oficial de afiliado (Awin/KaBuM), Amazon Creators API ou API Mercado Livre autorizada. Esses caminhos têm requisitos concretos; não substituí-los por promessa de API pública irrestrita. Não encontrei feed/API público de preço consumidor documentado por Terabyte, Pichau ou Magalu nas fontes abaixo.

## Matriz de fontes

| Fonte | Interface comprovada | Custo e acesso | Pode ativar agora? |
| --- | --- | --- | --- |
| KaBuM consumidor | HTML público com `__NEXT_DATA__` e JSON-LD, categorias e detalhes HTTP 200 | sem credencial e sem taxa de API; respeitar robots/limites | sim, com monitoramento e validação do destino hospedado |
| KaBuM afiliado | programa oficial via Awin; Awin documenta feeds | conta Publisher, chave de feed e acesso ao anunciante; cadastro Awin pode exigir depósito | não presumir acesso nem adesão zero custo |
| KaBuM API Mirakl | API oficial para sellers por shop | cadastro/homologação e API Key por seller | não serve como catálogo consumidor global |
| Terabyte | programa oficial de parceiros e páginas públicas | adesão/análise; não encontrei contrato público de API/feed de preços | HTML produto e robots deram 403 no teste; retentar com backoff sem bypass |
| Pichau | programa oficial gratuito, links e alertas para parceiros | cadastro e aprovação manual; feed de alertas não equivale a endpoint de catálogo | produto HTTP 403; API/feed público não identificado |
| Amazon | Creators API oficial | associado aceito, credenciais e vendas qualificadas; quotas por desempenho | somente após elegibilidade e credenciais verificadas |
| Mercado Livre | API oficial com exemplos Bearer/OAuth para buscas | aplicação, token e permissões; nenhum preço por chamada comprovado na documentação lida | sem token, endpoints testados deram 403; não declarar operacional |
| Magalu | Open API de Sellers, preços/estoques/webhooks de portfolio | OAuth, tenant/seller e escopos | não é API global de ofertas para afiliado |
| Pelando RSS | RSS publicado por equipe em post antigo | originalmente público, sem credencial | endpoints atuais testados retornam 404 |
| Telegram LinksBR | prévia pública HTML HTTP 200 | tecnicamente sem credencial; termos de uso restringem acesso externo | não ativar como coletor externo sem resolver termos aplicáveis |

## KaBuM / Awin

O [programa oficial KaBuM](https://www.kabum.com.br/hotsite/afiliados/) direciona cadastro para Awin. A [documentação oficial Awin de feeds](https://help.awin.com/developers/docs/downloading-a-list-of-your-product-feeds) exige Publisher ID e data feed key; a lista retorna feeds permitidos para a conta, data da atualização e URL de download. Nomes, imagens, preços, deeplinks e outros campos dependem do anunciante. Não foi verificado se uma conta concreta tem feed KaBuM disponível.

A [FAQ de feeds](https://success.awin.com/articles/en_US/Knowledge/Product-Data-Feed-FAQ) recomenda verificar disponibilidade do feed por anunciante e estabelece limites de download. A [orientação Awin de cadastro](https://www.awin.com/us/how-to-use-awin/awin-guide-on-how-to-start-affiliate-marketing) menciona depósito de US$5 reembolsável; a quantia/regra regional deve ser confirmada no cadastro. Portanto não fazer adesão nem pagamento sob a exigência de gasto zero.

A [API oficial KaBuM/Mirakl](https://www.kabum.com.br/hotsite/documentacao-hubscore/) opera com credenciais por shop, homologação, produtos/ofertas/pedidos do seller. Não usar a existência dessa documentação como prova de API gratuita para consultar todas as promoções do varejista.

## Terabyte e Pichau

O [portal oficial Terabyte](https://landing.terabyteshop.com.br/parceiros/) confirma links de parceiro, comissões e acesso antecipado a promoções. Não publica contrato de API, feed CSV/XML ou webhook consumidor nas páginas consultadas.

O [Pichau Creator Network](https://afiliados.pichau.com.br/) anuncia cadastro gratuito, aprovação manual, deep links e alertas para parceiros. A expressão feed de alertas da página não identifica por si só RSS/API utilizável. Não foi criado cadastro. A ausência de endpoint encontrado é resultado desta pesquisa, não prova de inexistência de integração privada.

## Amazon

A [documentação de onboarding brasileira](https://associados.amazon.com.br/creatorsapi/docs/en-us/onboarding/register-for-creators-api) exige conta de Associados com aceitação final. A [documentação de erros](https://associados.amazon.com.br/creatorsapi/docs/en-us/troubleshooting/error-codes-and-messages) informa elegibilidade de 10 vendas qualificadas nos últimos 30 dias. O [limite de uso](https://associados.amazon.com.br/creatorsapi/docs/en-us/concepts/api-rates) é vinculado ao desempenho e há perda de acesso sem vendas referenciadas qualificadas pelo período descrito. Não basta criar uma conta nova. Não apresentar PA-API legado como solução imediata sem verificar migração e elegibilidade atuais.

## Mercado Livre

A [documentação oficial de buscas](https://developers.mercadolivre.com.br/en_us/items-and-searches) exemplifica `Authorization: Bearer` em `/sites/{site}/search`. A documentação distingue recursos públicos de busca de recursos privados da conta do vendedor. Isso não garante que qualquer aplicativo/token tenha acesso irrestrito ao catálogo. Quantidade disponível pode ser uma faixa referencial, não número exato.

Teste sem token: `/sites/MLB/search?q=memoria%20ddr4&limit=1` retornou HTTP 403 JSON `forbidden`; `/trends/MLB` retornou 403 `PA_UNAUTHORIZED_RESULT_FROM_POLICIES`. Não houve tentativa de contornar. Um futuro token deve ser validado com requisição real antes de habilitar.

O [portal oficial de afiliados](https://www.mercadolivre.com.br/l/visite-o-portal-de-afiliados) descreve gerador de links, etiquetas e listas; não encontrei ali contrato de API de afiliado para extração automática global. Não confundir API de vendedor com gerador de links afiliados e não copiar cookies de sessão de ferramentas terceiras.

## Magalu

A [visão geral oficial](https://developers.magalu.com/docs/apis/promotions/visao-geral/index.html) identifica expressamente a Open API de Sellers e participação em campanhas do lojista. Os [webhooks de produtos](https://developers.magalu.com/docs/apis/products/webhooks/index.html) usam escopos como `open:portfolio-prices-seller:read` e apontam recursos do portfolio seller. Eles avisam alterações dos dados autorizados desse seller, não toda queda de preço do Magalu. Não foi achado contrato público equivalente para catálogo consumidor afiliado na documentação primária consultada.

## Comunidades e RSS

O [post da equipe Pelando](https://www.pelando.com.br/d/voc-j-conhecia-essas-fun-es-do-pelando-b7dd), de janeiro de 2022, divulga `/rss/highlights`, `/rss/hot` e `/rss/recents`. Links do próprio post retornaram 404 na ferramenta web. HTTP direto de `/rss/hot` e `/rss/recents`, sem query, também retornou 404 em 23/11/2026. Não usar apenas o anúncio histórico como prova de feed ativo. Não encontrei RSS/API público oficial de ofertas do Promobit; endpoints internos citados em repositórios terceiros não são documentação oficial.

## LinksBR / Telegram: separar evidência de hipótese

O [Linktree oficial](https://linktr.ee/LinksBrazil) e a [prévia Telegram](https://t.me/s/LinksBrazil) comprovam publicação de ofertas com links curtos de lojas, cupons e condições. Não revelam como a equipe descobre os produtos: uso de API, scraping, grupos ou curadoria humana não foi comprovado e não deve ser apresentado como fato.

HTTP direto: `https://t.me/robots.txt` retornou **404**, e a prévia retornou **200** com cerca de 111 KB. Portanto a restrição não é um robots proibitivo ou impossibilidade técnica. O motivo concreto para não ativar coleta externa automática é o [texto oficial de Content Licensing](https://telegram.org/tos/content-licensing), que restringe acesso além do uso ordinário pretendido e descreve exceções limitadas para clientes, bots e mini apps. Não há exceção expressa de coleta de links para catálogo externo no texto consultado. Remover texto/imagens editoriais reduz cópia de conteúdo, mas não cria por si uma permissão que o documento não oferece. Esta é uma decisão conservadora de implementação baseada no texto específico; não declarar que todo link público exige licença em qualquer contexto.

O caminho Bot API é diferente: bot adicionado pelo responsável ao canal autorizado, recebendo `channel_post`/edições. Isso não dá acesso automático ao LinksBR. Regras da comunidade que permitem seguir anúncios no Discord não comprovam autorização de espelhamento externo.

## Duas APIs públicas suplementares encontradas e testadas

- [CupomDescontos API](https://cupomdescontos.com/api-docs): documentação própria permite consulta sem chave com atribuição, condições e links indicados; HTTP `/api/coupons?store=mercado-livre&limit=1` retornou 200 JSON. Exemplo tinha validade nula e condição de conferir na loja. Pode alimentar candidatos de cupom, nunca preço final garantido; atualização declarada de seis horas não atende ofertas de minutos.
- [Recomendo para desenvolvedores](https://www.recomendo.org/para-desenvolvedores/): endpoint `/api/v1/ofertas.json` retornou 200 e 116 entradas, mas `gerado_em` era 03/11/2026 e a primeira entrada já tinha expirado nessa data. Não habilitar como fonte atual sem filtro de expiração/frescor. HTTP200 não comprova qualidade ou atualidade.

Essas APIs são de agregadores, não fontes primárias das lojas nem prova de estoque. Também não preenchem a exigência de histórico real do produto.

## Plano implementável

1. KaBuM HTML público como fonte real inicial; comparação histórica própria e confirmação de estoque com TTL.
2. Interface de importação de feeds autorizados preparada, mas conectores sem credenciais permanecem honestamente desabilitados.
3. Awin/Amazon/ML entram somente depois de teste autenticado do acesso já disponível ao usuário, sem pagar nem criar cobranças.
4. Terabyte/Pichau ficam em retentativa limitada; nenhuma troca de IP, CAPTCHA solver ou API interna para burlar bloqueio.
5. Cupons públicos documentados podem ser candidatos com fonte/validade/condições; só entram no cálculo da oferta após confirmação.
6. Manter observabilidade por fonte: último sucesso, status HTTP, cobertura observada, atraso, idade do dado e motivo de indisponibilidade. Não prometer internet inteira ou tempo real universal.
