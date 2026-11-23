# Expansão de lojas — pesquisa e prioridades

23/11/2026. Escopo desta rodada: Gigantec, WAZ, Oficina dos Bits, Guerra Digital e Patoloco. Foram consultados os domínios oficiais, robots e um catálogo por loja; nas quatro lojas com catálogo real acessível, também um detalhe. HTTP 200 com challenge não conta como integração funcional. Nenhum adaptador foi adicionado nesta pesquisa.

## Prioridade técnica

| Prioridade | Loja e domínio confirmado | Robots / catálogo / detalhe | Próximo passo |
| --- | --- | --- | --- |
| 1 | [WAZ](https://www.waz.com.br/) | 200 / 200 / 200; JSON-LD Product e seller explícito | adaptador com AggregateOffer, teste de identidade e preço à vista |
| 2 | [Oficina dos Bits](https://www.oficinadosbits.com.br/) | 200 / 200 / 200; Product Offer e Store | validar vendedor próprio por identidade da loja e DOM, não inferir marketplace |
| 3 | [Guerra Digital](https://www.guerradigital.com.br/) | 200 / 200 / 200; Product principal aninhado em WebPage.mainEntity | resolver produto principal, preço Pix e comparação com preço regular |
| 4 | [Patoloco](https://patoloco.com.br/) | 200 / 200 / 200; microdata, sem JSON-LD na amostra | adaptador DOM específico e teste de vendedor/MPN |
| 5 | [Gigantec](https://www.gigantec.com.br/) | robots200; home200 com challenge JS de segurança, sem catálogo | aguardar HTML acessível/feed autorizado; não executar challenge para burlar proteção |

WAZ, Oficina dos Bits, Guerra Digital e Patoloco têm status **parcial: HTTP testado; adaptador ainda não integrado**. Os status foram observados em requisições públicas com timeout, identificação BaixouResearch e espaçamento entre chamadas. Repetir checks no runner hospedado antes de ativar: acesso pode mudar por origem e momento. Não foi avaliada reputação comercial completa dessas lojas nesta rodada; domínio oficial confirmado não é auditoria de confiança.

## WAZ

Catálogo validado: `/hardware/placa-de-video--vga-`. Há links públicos de detalhes terminando `/p` e JSON-LD ItemList com produtos. [Detalhe consultado](https://www.waz.com.br/placa-de-video-nvidia-quadro-rtx-pro-4000-blackwell-gpu-pny-vcnrtxpro4000b-pb-24gb-gddr7-pcie-5-0-x16-131176-html/p): Product, imagem, brand, `AggregateOffer.offers[]`, preço BRL, InStock e seller `waz`. Avaliações não apareceram no schema da amostra.

Cuidado decisivo: `mpn=131176` e `gtin=00131176` eram códigos internos, não o código PNY VCNRTXPRO4000B-PB identificado no título. Não cruzar produtos entre lojas usando qualquer campo chamado mpn/gtin sem validação. Aceitar somente Offer do vendedor permitido; não interpretar highPrice como antigo preço histórico.

[Robots](https://www.waz.com.br/robots.txt) permite caminhos públicos, restringe filtros/ordenações e conta/checkout. Não recorrer à API interna VTEX só porque o site usa essa plataforma. O HTML categoria tinha aproximadamente 1,85 MB e detalhe 1 MB: impor limite de bytes com margem suficiente e não registrar corpo inteiro em produção.

## Oficina dos Bits

Catálogo validado: [`/categoria/hardware-memoria/`](https://www.oficinadosbits.com.br/categoria/hardware-memoria/). Links `/produto/.../` descobertos no HTML. [Detalhe consultado](https://www.oficinadosbits.com.br/produto/memoria-8gb-ddr4-3200mhz-synex-dissipador-preto-sx8gb-d4-3200hz/): Product Offer BRL499.99 InStock; DOM confirma o mesmo preço Pix, com preço padrão diferente. Store JSON-LD identifica Oficina dos Bits.

O Offer da amostra não tinha seller, Product não tinha MPN e `sku=40147` era interno. A marca do schema era Diversos apesar de título Synex. Não inventar marca ou vendedor a partir desses campos; estabelecer regra explícita de loja própria e confirmar sinais no detalhe antes de admitir o adaptador. Preço Pix e desconto por forma de pagamento devem permanecer identificados.

[Robots](https://www.oficinadosbits.com.br/robots.txt) permite produto/categoria básicos, bloqueia busca, avaliações separadas, carrinho, clientes, filtros de ordem e paths profundos de categoria. Usar os dados já presentes no produto, sem endpoints separados proibidos. Catálogo aproximadamente 682 KB, detalhe 250 KB.

## Guerra Digital

Catálogo validado: [`/hardware/memoria/ddr4/`](https://www.guerradigital.com.br/hardware/memoria/ddr4/). Plataforma Nuvemshop declarada no robots, produtos `/produtos/{slug}/`. [Detalhe consultado](https://www.guerradigital.com.br/produtos/patriot-viper-elite-32gb-1x32gb-ddr4-3600mhz-cl20-vermelha-pve2432g360c0/): schema principal é `WebPage.mainEntity` contendo Product, SKU do fabricante, preço regular1999, InStock, inventoryLevel e seller Guerra Digital. O Pix anunciado na interface tem desconto de14%: não publicar1999 como Pix e não aplicar uma taxa global sem confirmar a condição no produto.

Scripts Product na raiz da página eram recomendações de outros itens; parser que pega o primeiro Product root importaria produto errado. Traversal de `mainEntity`, `@graph`, arrays e validação da URL/identidade são obrigatórios. Catálogo renderizado pela busca e detalhe real mostravam estados diferentes de estoque; detalhe atual é necessário. Preços zero em elementos decorativos/referências não são oferta gratuita.

[Robots](https://www.guerradigital.com.br/robots.txt) bloqueia busca, checkout, conta, frete e preview. Descobrir por categorias/sitemap e remover tracking `entry_path` antes de persistir. Não inferir estoque pelos relacionados nem tratar inventoryLevel como vendas. Catálogo540KB, detalhe626KB.

## Patoloco

[Catálogo](https://patoloco.com.br/produtos/placa-de-video) retornou HTML com links de produtos fora do prefixo de categoria `/produtos/`. [Detalhe consultado](https://patoloco.com.br/placa-de-video-galax-geforce-rtx-5060-ti-1-click-oc-v2-8gb-8gb-gddr7-128-bit-56isn8mdeher) tinha microdata `[itemtype$='/Product']`, `[itemprop=name]`, `[itemprop=sku]`, `[itemprop=brand]` e `[itemprop=offers] [itemprop=price][content]`. Valor à vista BRL3457.31, condição Pix/boleto, InStock. Sem Product JSON-LD, sem seller ou mpn microdata. SKU PV.GX.2539 era referência interna; fabricante56ISN8MDEHER constava no título.

Avaliação zero/convite para primeira avaliação deve ficar sem nota, não como produto reprovado. Não usar preço de relacionados ou preço parcelado no card à vista. [Termos oficiais](https://patoloco.com.br/documentos/termos) identificam o domínio da loja. [Robots](https://patoloco.com.br/robots.txt) bloqueia admin/ajax/integracao/includes/cron e outros internos; nenhum deles foi acessado. Categoria310KB, detalhe163KB.

## Gigantec

Domínio confirmado pelo [site institucional oficial](https://institucional.gigantec.com.br/politicas/termos-e-condicoes-do-site.html). [Robots](https://www.gigantec.com.br/robots.txt) retornou200 e bloqueia checkout/customer/search/catalogsearch, além de tracking srsltid. Home retornou200, mas apenas528bytes de página Verificação de Segurança com challenge.js, sem produto. Deve ser classificada como bloqueio/challenge, não sucesso do adaptador.

Existe [página oficial de APIs](https://api.gigantec.com.br/) pedindo chave ao desenvolvimento e apontando integrações Magazine Luiza/Walmart/Bling. Isso não prova API pública de preço consumidor nem acesso grátis: não foram solicitadas chaves nem chamados endpoints restritos. Próximo caminho é feed ou acesso autorizado/documentado já disponível ao usuário.

## Demais lojas e arquitetura para dezenas

Fontes já pesquisadas: KaBuM, Terabyte, Pichau, Amazon, Mercado Livre e Magalu — ver `PRIMARY_SOURCES.md`. Isso cobre onze nomes confirmados nesta documentação com as cinco novas. Novos nomes do pedido entram na fila como aguardando investigação, sem gerar domínio por adivinhação e sem exibir selo de integração ativa. Cobertura ampla é objetivo arquitetural; esta rodada não ativou dezenas de lojas.

| Fila | Nomes solicitados | Estado nesta rodada |
| --- | --- | --- |
| Hardware especializado seguinte | FGTEC, iByte, Nagem, Hardstore, ChipArt, Shopinfo | aguardando investigação; domínios não verificados por este agente |
| Marketplaces adicionais | Shopee, AliExpress | aguardando investigação de API oficial, seller e custo; não presumir uso irrestrito |
| Varejo geral | Casas Bahia, Ponto, Extra, Americanas, Carrefour, Fast Shop, Kalunga, Havan | aguardando investigação; domínios/estoque/reputação por vendedor ainda não verificados |
| Fabricantes de computadores e eletrônicos | Dell, Lenovo, Acer, ASUS, Samsung, LG, Motorola, HP, Avell | aguardando investigação; priorizar preço público, domínio brasileiro e estoque real |
| Marcas de periféricos e áudio | Logitech, JBL, Edifier, Redragon | aguardando investigação; distinguir loja própria de revendedores |
| Comparadores e descoberta | Buscapé, Zoom, Google Shopping, PCFinder | aguardando investigação de integração autorizada; referência secundária, não prova de disponibilidade |
| Comunidades já pesquisadas | Pelando, Promobit, LinksBR | pesquisa em PRIMARY_SOURCES.md/DISCOVERY_RESEARCH.md; não integradas nesta rodada |

Essa fila preserva todos os nomes informados sem inventar URLs. Antes de adicionar qualquer domínio à allowlist, confirmar sua vinculação oficial e executar o mesmo protocolo robots/catálogo/detalhe. A conclusão da hospedagem atual tem precedência sobre investigar toda a fila agora.

Prioridade por capacidade: (1) lojas próprias hardware com HTML completo e preço/estoque verificáveis; (2) feeds oficiais de afiliado já autorizados; (3) varejo geral e marketplaces com vendedor e reputação disponíveis; (4) fabricantes/periféricos/cadeiras especializados após confirmar domínio; (5) comunidades como descoberta separada, jamais prova de estoque.

Cada entrada do registro de fontes deve declarar: domínio canônico e hosts de imagem, categorias, método, chave requerida, estado `research/ready/blocked/disabled`, robots revisado, política de preço, política de vendedor, limite de páginas/bytes/concorrência, intervalo/backoff e TTL. Catálogo apenas aceita resultados de adaptadores habilitados e validados; source descoberta pode existir sem produtos publicados. O contrato comum deve tolerar avaliações/vendas desconhecidas sem inventar zero ou prova de reputação.

## Critérios para integrar qualquer nova loja

- Detalhe atual e identidade certos, inclusive `WebPage.mainEntity` e `AggregateOffer`.
- Preço positivo BRL e condição de pagamento explícita; preço riscado não é histórico.
- Estoque do produto principal confirmado; zero estoque exclui, falha de coleta expira por TTL.
- Vendedor admitido por política e evidência; schema sem seller não equivale automaticamente a marketplace confiável.
- MPN/GTIN reais antes de cruzar lojas; SKU interno fica isolado por loja.
- Imagens HTTPS em hosts permitidos, sem HTML remoto renderizado.
- Fixtures de sucesso, esgotado, challenge, relacionado enganoso e mudança de layout.
- Teste HTTP no ambiente hospedado e observabilidade por fonte antes de declarar ativa.

Fixtures reduzidos de pesquisa foram adicionados em `tests/fixtures/research/`; não são dados de catálogo nem testes completos de adaptador. A implementação fica a cargo do agente responsável pelo aplicativo.
