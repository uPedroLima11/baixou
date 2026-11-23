# Coleta direta de lojas — evidência

Verificação em 22–23/11/2026. Nenhum bloqueio foi contornado. Requisições Node públicas passaram pela aprovação de rede do ambiente.

## KaBuM — validado por HTTP real

Produto [172365](https://www.kabum.com.br/produto/172365/memoria-ram-kingston-fury-beast-8gb-3200mhz-ddr4-cl16-preto-kf432c16bb-8), [robots](https://www.kabum.com.br/robots.txt) e categorias retornaram HTTP 200.

Detalhe: `script#__NEXT_DATA__` → `props.pageProps.product`. Usar `prices.priceWithDiscount` para preço final; `prices.oldPrice` é só referência anunciada. Exigir vendedor próprio (`sellerId === 0`, `sellerName === 'KaBuM!'`, flags de marketplace falsas). Estoque: `available`, `flags.isAvailable`, `flags.isActive`; excluir pré-venda e openbox conforme política. Imagens em `medias[].images.gg/g`; avaliações em `rating.score/count`; especificações em `technicalInformation.text` (HTML não confiável a sanitizar). MPN extraído do campo Modelo nas especificações, não do SKU interno.

JSON-LD Product tem preço, moeda, estoque e avaliações, mas não fornece vendedor nesse produto. JSON-LD sozinho não valida vendedor. Não há contador de vendas no fixture: contagem de avaliações não deve ser convertida em vendas.

Categorias: `props.pageProps.data` é uma string JSON. Após parse, `catalogServer.data` contém os produtos. URL reconstruída: `https://www.kabum.com.br/produto/{code}/{friendlyName}`. Não depender apenas de `a[href]`: nesta amostra não havia links comuns de produto no HTML. Base `priceWithDiscount` na categoria pode diferir do preço promocional `offer.priceWithDiscount`; confirmar no detalhe antes de publicar.

Categorias verificadas por HTTP: `/hardware`, `/hardware/memoria-ram`, `/promocao/blackfriday`, 60 itens cada. Demais categorias devem ser descobertas dos links públicos e verificadas antes de declarar cobertura. Não coletar endpoints privados ou queries proibidas pelo robots.

## Terabyte — bloqueado por HTTP direto

Produto e robots retornaram 403 neste ambiente. A ferramenta web conseguiu ler [robots](https://www.terabyteshop.com.br/robots.txt), catálogo e produto; isso não comprova funcionamento do coletor. Manter domínio em falha/retentativa com backoff e falhar fechado se robots não puder ser confirmado.

Caminhos de categoria confirmados na navegação pública: `/hardware/memorias`, `/hardware/placas-de-video`, `/hardware/processadores`, `/hardware/placas-mae`, `/hardware/ssd`, `/fontes`, `/gabinetes`, `/monitores`, `/cadeira`, `/perifericos`, `/perifericos/mouse`, `/perifericos/combos`, `/pc-gamer`, `/kit-upgrade`. Os quatro primeiros e monitores/cadeiras/mouse/combos/PC/kit tiveram páginas renderizadas acessíveis pela ferramenta web. `/hardware/placa-de-video` singular estava incorreto.

Robots público permite produto e categorias; bloqueia `/busca`, `/content/api/`, `/Avaliacoes` e várias queries de filtro/rastreamento. Não consultar API interna nem endpoint separado de avaliações.

Produto renderizado mostra título, código do fabricante, vendedor, unidades vendidas, restantes, preço Pix, preço anterior, garantia e avaliações. Parser real de classes CSS/JSON-LD não foi validado porque HTML direto foi bloqueado. Evitar regex de preço/estoque sobre página inteira: inclui relacionados, combos e preço zero no modal de compartilhamento.

## Pichau — bloqueado por HTTP direto

[Robots](https://www.pichau.com.br/robots.txt) retornou 200, mas produto retornou 403. Robots permite caminhos públicos, bloqueia `/api/` e toda URL com query. Não consultar GraphQL/API como contorno. Ferramenta web leu produto com título, SKU/MPN, fotos, preço, garantia e especificações; avaliações ausentes devem continuar ausentes. Alguns anúncios removidos redirecionam para categoria: exigir identidade de produto para não importar categoria como oferta.

Categorias públicas vistas: `/hardware/memorias`, `/perifericos`, `/monitores`, `/cadeiras`, `/computadores`, `/kit-upgrade`. A cobertura só pode ser declarada após execução HTTP bem-sucedida do coletor.

## Fixtures

`tests/fixtures/kabum-product-trimmed.html` é uma redução dos scripts reais obtidos por HTTP 200: não contém página completa, rastreamento ou conteúdo editorial. Serve para testar parsing dos campos observados, não comprova estado atual do anúncio. Fixture de categoria reduzido preserva a dupla serialização JSON real. O diretório `work/collector` contém amostras maiores de pesquisa e não deve virar dados de produção.
