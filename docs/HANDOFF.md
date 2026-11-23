# CHECKPOINT — Claude Code retoma após Codex, 23/11/2026 (~19h45 UTC)

## Trabalho interrompido do Codex (recuperado, nada descartado)

- Encontrado sem commit sobre 7d44a71 (nenhum commit/deploy posterior): (1) tratamento de produto removido da Patoloco (redirect para /pagina-nao-encontrada → `RemovedProduct`, nova tentativa em 24 h, sem seguir redirect) + fixture de kit sem preço; (2) 13 templates do Supabase Auth + manifesto + teste + script de payload; (3) gerador de e-mail de alerta `lib/email-templates.ts` ainda não ligado ao envio; (4) migration `20261123191425_notification_delivery_claims.sql` **vazia**. Completados e commitados em 07bad93, 17e20fa, 6c1e4ed.

## E-mails

- Alertas (Nodemailer): assunto com nome compacto + preço verificado (`Baixou! 🔔 X atingiu R$`, `📉 X caiu para R$` com histórico, `🔥 X por R$` abaixo das lojas comparadas), HTML em tabelas com preheader, imagem da loja (hosts permitidos), loja/vendedor/pagamento, motivo + evidência apenas comprovada, botão para o Baixou!, link direto da loja, gerenciar alertas (`/?conta=notificacoes` abre a tela) e desativar; versão texto; `List-Unsubscribe` one-click (POST /api/unsubscribe?token=).
- **Bug corrigido:** o envio filtrava por `safeUrl`, que não inclui Mercado Livre — alertas de 433 anúncios ML nunca seriam enviados. Agora usa a lista de hosts de e-mail.
- Idempotência no Postgres (migration 20261123191425 aplicada): `claim_notification`/`finish_notification` (service_role apenas). Um envio por usuário/produto/dia (fuso SP), reserva atômica entre Vercel e Actions, falha SMTP temporária repete até 3x com espera 10/20/40 min, 5xx é permanente, `sending` sem resposta >15 min vira `unknown` e não é reenviado. `notification_state` só é gravado no sucesso. Ensaio com rollback: tests/notification-claims.sql (todas as verificações passaram).
- Prévia real: workflow manual `email-preview.yml` → rota assinada `?check=preview` (SMTP só existe na Vercel; Actions não tem SMTP_* configurados) → envia SOMENTE ao SMTP_USER, assunto `[TESTE]`, faixa amarela de teste. Execução 45249778514: aceito pelo SMTP, assunto `[TESTE] Baixou! 🔔 Headset Gamer Redragon Cadmus atingiu R$ 189,90`. **Recebimento/renderização dependem de confirmação do proprietário.**
- Supabase Auth: 6 templates de acesso publicados por `config push` (diff conferido: só 12 campos assunto/conteúdo; SMTP e flags intocados). 7 avisos de segurança só preparados. Nenhum e-mail Auth disparado nesta sessão.
- **Não homologado com e-mail real:** disparo de alerta por condição verdadeira na conta do proprietário (perfil com email_enabled=false e 0 alertas no banco; navegador sem sessão; Claude in Chrome desconectado). Testes automatizados cobrem preço máximo, queda R$/%, AND, histórico mínimo, teto global, alerta pausado, lista de desejos, escape/hosts, dedupe e retries.

## Perfil e Notificações

- Notificações ganhou: pausar/reativar, editar condições (mantém ≥1), excluir com confirmação, nome do produto em alertas de produto, preferência "Avisar quedas da lista de desejos" (coluna já existia sem UI). Deep links `?conta=notificacoes|perfil`. RLS `own_alerts` (ALL) cobre update. Sem sessão o link abre o login (verificado no navegador). Validação logada pendente.

## Preço

- `historical_max` (migration 20261123194500 aplicada: coluna, `price_history_stats` com max, view catalog_offers recriada mantendo grants/security_invoker). Gravado só com ≥5 amostras em ≥3 dias, portanto **nulo até ~26/11** (histórico começou 23/11). Desconto anunciado é limitado também pela diferença para o maior preço observado; card mostra "Preço "de" não praticado nos N dias monitorados"; detalhe explica.
- G305: no banco só KaBuM (kabum-97092, R$ 169,99, "de" R$ 488,62 = 65% anunciado, mpn G305, título com 910-005281). Sem outra loja nem histórico: aparece só como "Anunciada", sem prioridade. Amazon R$ 161,91 é observação do proprietário, NÃO integrada/validada. Regressão em tests/market.test.ts.

## Homologação real com a conta do proprietário (20:30 UTC)

- Login feito pelo proprietário no navegador do app. Perfil e Notificações separados; deep links ok; Perfil salva; lista de desejos salva/remove (4 favoritos do proprietário intactos); alertas criados pela UI (categoria RAM + DDR3 + 4 GB ≤ R$ 50; produto Redragon Cobra M711 ≤ R$ 70), editados (50→55), pausados/reativados e excluídos — tudo conferido no banco. Modo escuro e 375 px ok. Bug corrigido: galeria do detalhe vazava para 456 px no celular (0aca1b3).
- **Disparo real:** rechecagens 20:32:57 e 20:33:35 → e-mails enviados 20:33:22 e 20:33:45 (status sent, 1 tentativa, message_id). Condições verdadeiras com preços reais (R$ 49,99 e R$ 69,99), nada fabricado. Assuntos esperados no formato `Baixou! 🔔 … atingiu R$ …`. Rodada continuou chamando o notificador com as mesmas ofertas: continuou com 2 registros (deduplicação ok). **Recebimento na caixa depende de confirmação do proprietário.**
- **Bug encontrado e corrigido (45350f9):** no Actions o envio só rodava após ~5 min de coleta, e rechecagens (processadas primeiro) já estavam fora da janela de 5 min. Agora o coletor chama o notificador (idempotente) a cada 2 min.
- Limpeza: alertas de teste excluídos pela UI, e-mail voltou a desligado (estado original), notification_state dos 2 produtos de teste removido para não bloquear alertas futuros; notification_log mantido como auditoria.
- Não homologado com e-mail real: queda absoluta/percentual (histórico <3 dias até ~26/11), lista de desejos por queda, e-mails Auth com o novo visual. Cobertos por testes automatizados.
- **Capacidade KaBuM:** 161 rechecagens devidas, fila ~20 min atrasada (a mesma folga entre rechecagem e TTL); ofertas podem vencer brevemente antes da reconfirmação. Rodada verifica ~85/13 min. Não aumentamos volume/frequência; próximo passo é medir e, se necessário, reduzir descoberta da KaBuM enquanto houver atraso (respeitando a faixa mínima de 10%).
- Pichau/Terabyte/Amazon: ver MAJOR_STORES.md (redes de afiliados) e mensagens prontas em ACCESS_GUIDE.md. Amazon: cl. 6(y) das políticas proíbe rastreamento/alerta de preço sem aprovação escrita.

## Operação (19:33 UTC)

- Ativas no TTL: KaBuM 366, WAZ 163, Guerra 168, Patoloco 249, ML 433. Vencidas disponíveis: WAZ 2, ML 1. Actions 45246942562 e anteriores verdes. Fila: Patoloco 1.925 candidatos (1.381 devidos, 16 com falha), KaBuM 1.213 (655 devidos) — backlog de descoberta, não falha. Banco 24 MB, 6.301 observações.
- Catálogo: 2,94 MB JSON descomprimido, mas **~430 KB transferidos** (brotli, CDN HIT). Facetas no servidor não são urgentes; atualização por minuto agora pausa com a aba oculta.

---

# CHECKPOINT FINAL — Codex, 23/11/2026, 15h57 São Paulo

## Entrega e publicação verificadas

- Partiu do checkout limpo 5183ec7, preservando as cinco fontes, filtros, conta, favoritos, alertas e infraestrutura. Commits por etapa: a1fa7c9 (referência), 375e3cd (catálogo/menu), 4d776f7 (códigos divergentes), 9f990f2 (feedback do preço riscado), cd79143 (desempenho). Todos enviados a main. O commit documental deste checkpoint vem depois.
- Produção para cd79143: READY, dpl_HErXePWTQSC51R7HKZCqeUK8eJZ3; domínio https://baixouofertas.vercel.app. CI 45243024830 verde. CI 45242462992 de 9f990f2 também verde. O conector Vercel não tem acesso ao workspace; inspeção foi feita pelo CLI já autenticado, sem mudar permissões/secrets.
- 70 testes unitários, typecheck e build passaram. tests/market-reference.sql e tests/persistence-rls.sql passaram no projeto dedicado, com rollback. Ambas as migrations novas foram aplicadas e conferidas. Nada foi deletado de favoritos/alertas/histórico.
- Navegador de produção: menu abre por clique; seleção RAM/DDR5 mostrou 29 resultados, checkbox DDR5 selecionado e contador Catálogo completo29. Escape fecha/retorna foco; ArrowDown abre/foca a primeira categoria. Temas claro e escuro conferidos com tela móvel390×844, contraste corrigido. Tentativa de viewport desktop pelo controle não foi aplicada pelo navegador (window.innerWidth permaneceu390); não declarar inspeção visual desktop1280. Implementação de hover/desktop está no código, mas falta essa inspeção visual específica.
- Revisão final do teclado: Enter/clique numa categoria e seta para direita levam o foco ao submenu, permitindo selecionar facetas da primeira categoria sem percorrer todas as demais. Tipos e build passaram após esse ajuste; a inspeção visual já descrita refere-se ao código anterior a ele.
- Card e detalhe reais do Ryzen7800X3D mostraram R$1.679,99 e referência correta R$2.164,63 (mediana de duas outras lojas), cobertura parcial visível; preço riscado de R$4.235,28 não fica no destaque. Percentuais meramente anunciados passaram a selo textual. Abaixo das lojas comparadas NÃO significa menor de todo o mercado.

## Fotografia real — 15:56:52 São Paulo

| Fonte | Ativas no TTL |
| --- | ---: |
| KaBuM! | 358 |
| WAZ | 162 |
| Guerra Digital | 167 |
| Patoloco | 249 |
| Mercado Livre (parcial) | 432 |
| Total | 1.368 |

- API pública: quatro páginas, 2.877.599 bytes JSON não comprimidos; 638 anúncios com product_id, 603 modelos canônicos representados. Auditoria conservadora aceitou22 grupos entre vendedores independentes;3 grupos legados com divergências são excluídos do agrupamento/transferência pela regra, não contados como correspondência confiável. Não equivalem a validação manual individual de todo o catálogo.
- 1 modelo com referência válida de pelo menos2 outros vendedores;1 anúncio abaixo da amostra comparada (7800X3D). Zero quedas históricas: ainda não há3 dias mínimos. Zero divergências de categoria versus classify() nessa fotografia. Não interpretar observação diária como histórico de35 dias já formado.
- Banco às15:56:59 confirmou os mesmos1.368 ativos; disponíveis com TTL vencido0 nas quatro lojas diretas,1 no ML (ausência em vitrine não é esgotamento). Sete vínculos isolados continuavam sem product_id após a coleta hospedada;432 anúncios ML já receberam seller_key. Não presumir que esse cenário se mantém entre ciclos.

## Operação e limitações reais

- Coleta 45242650075 (9f990f2): collect×4, connectors e report verdes. Relay ainda in_progress no checkpoint, aguardando sua janela; não declarar execução inteira concluída antes de terminar.
- Patoloco registrou6 erros de produto apesar do job verde: cinco HTTP302 e um Preço BRL inválido (logs do job conferidos pela API GitHub). Foram mantidos como falhas, sem inventar esgotamento/renovar TTL. Não seguir redirecionamento indiscriminado nem alterar preço para esconder falha. Demais fontes registraram0 falhas no lote consultado.
- pg_net HTTP200 reais em18:15/18:30/18:45 UTC. Crons lote*/15 e recuperação2/17/32/47 continuam; antigos individuais inativos. Não alteramos frequência, volume, SMTP, Secrets ou plano.
- Banco mediu~24,2MB e5.076 observações antes da última rodada. Não foi obtido consumo mensal real de Vercel Usage/Supabase Egress; não prometer folga sustentável. Payload~2,88MB e polling de1min justificam mover facetas/contagens/filtros ao servidor como próxima etapa de escala. Otimização de agrupamento já publicada reduziu846,55ms→2,42ms sobre1.305 ofertas reais, com os mesmos ids/ordem/preços.
- Perfil/Notificações separados existem, RLS/favoritos/alerta absoluto verificados no banco. UI com sessão autenticada, cadastro novo, senha final e e-mail disparado por condição real continuam sem homologação completa nesta sessão. Não há credencial de teste; nenhum e-mail foi enviado nem SMTP reconfigurado.

## Expansão gratuita

- Pesquisa inclui APIs não oficiais e projetos comunitários, conforme nova orientação. Resultados e links primários em MAJOR_STORES.md; pedidos prontos em ACCESS_GUIDE.md. Pichau/Terabyte diretas e Amazon continuam não operacionais.
- TelePromo usa GraphQL /api/pichau?query= (caminho já bloqueado pelo robots); o scraper Terabyte antigo repete HTML bloqueado; AmzPy usa impersonação/proxies; parser Pangolin só interpreta HTML local. Nenhum foi executado como contorno.
- Candidata concreta: Falcon Data Hub. Endpoint público de lojas HTTP200, nove redes incluindo Pichau/Terabyte. Free8/h sem cartão, mas FAQ indica coleta diária e política exige autorização escrita para redistribuir em massa. Faltam autorização de publicação/origem e teste com preço, vendedor, estoque e pagamento recentes. Não criar conta nem publicar seus dados por suposição; pedido preparado, não enviado.
- Amazon Creators API continua dependendo de elegibilidade da conta; nenhuma alternativa comunitária permitida e operacional foi comprovada nesta etapa. Não depender de aprovação incerta para continuar as melhorias independentes.

---

# CHECKPOINT — desempenho de agrupamento (Codex, 23/11/2026)

- Catálogo cresceu para ~1.300 anúncios. A validação no navegador revelou pausas na interação. Benchmark local de 1.305 ofertas reais: agrupamento anterior 846,55 ms; indexado 2,42 ms, com a mesma lista/ordem de ids e mesmos menores preços. Cada filtro/modo fazia sua própria varredura quadrática; agora o índice limita candidatos e sameProduct continua validando todos os critérios. Não altera correspondências nem critérios.
- Reproduzir: npm run pricing:audit -- --benchmark. 70 testes e build/tipos passaram.
- Payload público medido ~2,78 MB não comprimidos em quatro páginas. Já se recomenda migrar filtros/facetas/contagens ao servidor antes de expansão expressiva: cache diminui leituras ao Supabase, mas cada miss ainda lê o conjunto inteiro e há atualização por minuto. Não confundir bytes JSON com cobrança medida de tráfego. O consumo mensal real de Usage/Egress não foi obtido nesta sessão; não aumentar volume/frequência.
- Orientação adicional do proprietário: investigar também APIs/bibliotecas comunitárias gratuitas e permitidas; não restringir pesquisa a oficial. Sem bypass, CAPTCHA, rotação para contorno ou condições contratuais incompatíveis. Pesquisa em andamento em MAJOR_STORES.md; nenhuma fonte nova foi ativada.

---

# CHECKPOINT — referência exibida e cobertura parcial (Codex, 23/11/2026)

- Feedback do proprietário: R$4.235,28 riscado no 7800X3D não é preço normal de mercado; há preços menores em lojas ainda não integradas. Corrigido: card não mostra referência riscada do vendedor. Quando há selo numérico, mostra a mediana histórica/comparativa realmente usada. Valor anunciado fica somente em seção recolhida do detalhe, com explicação.
- Renomeado o modo para **Abaixo das lojas comparadas** e explicitada cobertura parcial no card/detalhe. Não afirmar menor preço do mercado inteiro. O selo de 22% do exemplo vem de R$1.679,99 vs mediana R$2.164,625 de duas outras lojas, nunca dos R$4.235,28 anunciados. Essa amostra não inclui todo o varejo nem invalida preços mais baixos de fora.
- Anúncios sem evidência independente recebem selo textual Anunciada; percentual anunciado não vira destaque numérico nem prioridade padrão.
- Departamentos: corrigido contraste de botões herdado do cabeçalho. Contadores das modalidades agora respeitam também os filtros técnicos selecionados. Navegação desktop DDR5 validada em produção com 29 resultados e checkbox correspondente. Viewport móvel 390×844 revelou o contraste corrigido; validar versão final clara/escura, toque/teclado.
- 70 testes, tipos e build passaram após esses ajustes. Pendentes apenas confirmação final de CI/deploy/browser, auditoria final e checkpoint de publicação.

---

# CHECKPOINT — auditoria real e códigos divergentes (Codex, 23/11/2026, ~18h46 UTC)

- Auditoria pública reproduzível: npm run pricing:audit (sem service_role, só leitura, todas as páginas; falha explícita em HTTP não OK). Mediu 1.325 anúncios ativos às 18:44:52 UTC, 21 grupos entre fontes sem divergência detectada pela regra atual, 2 grupos legados conflitantes, 1 modelo com referência de 2 outros vendedores e 1 preço abaixo da amostra. Zero divergências entre classificação armazenada e classify() nessa fotografia. Contagens variam com TTL/cache/coleta; não tratar como auditoria manual de todo modelo.
- Achado adicional: Ryzen 5 5500 no título, mas MPN de 5800X3D na ficha de KaBuM/Guerra. Não escolher um código por palpite. manufacturerConflict detecta códigos da mesma família divergentes; impede identidade, agrupamento, enriquecimento e propagação de alertas para outro produto. Modelo e código de peça com formatos distintos (Acer AG15/NX, Ryzen 9600X/100-...) não são tratados automaticamente como contradição.
- Migration 20261123184447 aplicada após ensaio com rollback; isolou 7 vínculos com códigos divergentes, preservando preço/histórico/favoritos. Alertas ligados a esses anúncios permanecem vinculados ao anúncio original. RX7600 PRO continua sem referência de mercado por conflito com canônico; não presumir equivalência.
- Favorito de kit agora renova a mesma URL/id mesmo sem identidade canônica; regressão adicionada.
- Banco: ~24,2 MB, 5.076 observações de preço; histórico começa hoje (não há 3 dias mínimos). pg_net teve HTTP 200 em 18:15/18:30/18:45 UTC. Nenhum agendamento/volume foi aumentado. Em 18:40 havia TTL vencido KaBuM52/Patoloco15/ML48; depois do ciclo o conjunto recuperou. Ausência em vitrine ML não comprova esgotamento. Ainda acompanhar oscilação/capacidade, sem ampliar TTL.
- CI 45240836238 (375e3cd) verde; produção READY dpl_3JSSsNVNTVNApVU3EEPCQ9WpbS77 para 375e3cd. Coleta 45240551077: collect×4/connectors/report verdes, relay ainda aguardando. Código novo de quarentena aguarda publicação e validação hospedada.
- Reconsulta de expansão em MAJOR_STORES.md: Pichau/Terabyte dependem de aprovação/feed/liberação; Amazon exige elegibilidade. Mensagem pronta em ACCESS_GUIDE.md, canal Terabyte confirmado. Nenhum contato/cadastro feito.
- Ajustes de apresentação e feedback do proprietário sobre referência riscada seguem no próximo commit.

---

# CHECKPOINT — catálogo completo, oportunidades e Departamentos (Codex, 23/11/2026)

- Segunda etapa: menu Departamentos separado dos filtros móveis; categorias/facetas/contagens vêm do catálogo válido e do mesmo offerFacets usado por filtros/alertas. Seleção abre Catálogo completo e limpa restrições anteriores para não levar a resultado vazio. Mouse, clique, Tab/Enter/Escape e toque previstos; validar browser após publicação.
- Nova modalidade Catálogo completo preserva produtos sem desconto. Padrão de ordenação Relevância e oportunidades: correspondência da consulta, evidência histórica/mercado, economia comprovada, identidade e atualidade; desconto riscado não dá prioridade. Menor preço continua disponível. Sugestões usam a mesma classificação, sem porcentagem inflada bruta.
- Atualização do catálogo só substitui a última resposta bem-sucedida após receber todas as páginas; 5xx mantém o catálogo anterior, cujo TTL continua sendo respeitado.
- Detalhes e cards não afirmam Pix para ML sem confirmação; não mostram nota fictícia. Nenhuma alteração de SMTP, preferências privadas, frequência ou volume de coleta.
- 67 testes, typecheck e build passaram antes do commit. Validação visual/CI/deploy e levantamento final continuam na etapa seguinte.

---

# CHECKPOINT — retomada Codex, inteligência de preços (23/11/2026)

- Base recebida: 5183ec7, checkout limpo, remoto consultado; CI desse commit verde. Não foram refeitos SMTP, agendamentos ou integrações.
- Migration nova 20261123183154 aplicada no Supabase dedicado, previamente ensaiada com rollback. Referência por vendedor (KaBuM/Pichau no ML não contam como outra empresa; demais vitrines usam seller_id), pagamento à vista equivalente, menor preço por vendedor, mediana, extremos e expiração pela primeira referência/15 minutos. ML sem Pix explícito permanece no catálogo, fora da referência. Novos seller_key/payment_basis chegam por rechecagem.
- Não declarar abaixo do mercado se a referência maior superar 1,5× a menor ou existir concorrente mais barato. Anunciado é limitado pelo menor preço comparável; nenhuma redução de amostra mínima. Referência expirada é ignorada. Histórico decide os 5% antes de arredondar.
- Auditoria real: em 18:30 UTC havia 1.298 ofertas ativas, zero com duas outras lojas. Exemplos com identidade: Ryzen 5 5500 (Patoloco R$634,03/WAZ R$689,99), Ryzen 7 5700X (KaBuM R$1.099,99/Guerra R$1.289,14), ASUS TUF B550M-Plus (KaBuM R$719,99/Guerra R$859,14). São comparações de duas lojas, insuficientes para afirmar mercado.
- Achado concreto: vínculo legado da RX 7600 Challenger/Challenger PRO, com MPNs diferentes. SQL exclui vínculo incompatível com código canônico; agrupamento/alternativas/enriquecimento também rejeitam códigos conflitantes. Mantém produtos/favoritos, sem adivinhar equivalência.
- 67 testes passaram; typecheck passou; build passou antes dos últimos ajustes de apresentação (revalidar na etapa UI). tests/market-reference.sql executado sobre ofertas reais com rollback: grants privados, view security_invoker, limites/validade/códigos. tests/persistence-rls.sql passou integralmente com rollback.
- Advisors: somente avisos prévios de unaccent no public e proteção de senhas vazadas desativada; RLS sem políticas nas filas privadas é intencional. Nenhum plano pago habilitado.
- UI/menu/classificação de oportunidades em implementação no próximo commit; publicação e métricas finais ainda precisam ser confirmadas.

---

# CHECKPOINT — categorias, identidade, preço de mercado, filtros e alertas (Claude Code, 23/11/2026, ~18h30 UTC)

Expansão de lojas pausada a pedido do proprietário. Etapas em ordem, cada uma com commit próprio:

1. **Categorias** (3c7fc9c): a auditoria das 1.379 ofertas achou celulares e cartões microSD em RAM, coolers e Smart TV em processadores, webcams/cabos "Full HD" em SSD, suportes e carregadores como o produto principal, MacBooks em "outros" e placas-mãe que começam pela marca em RAM. classify() agora decide primeiro pelo início do título. 40 títulos reais em tests/classify.test.ts. Migration 20261123175542 reclassificou 207 ofertas, só onde a categoria antiga ainda batia; o único trigger de offers reage a product_id.
2. **Identidade** (e17a6ff): manufacturerCode() e aliases de marca. Simulação nas 1.282 ofertas ativas: identidade forte 484 → 621, chaves entre lojas 16 → 26. Ofertas ganham a identidade nova na próxima verificação. "3.200MHz" virava 200 MHz; corrigido (joinThousands), e a migration 20261123180601 removeu a frequência inválida de 13 produtos canônicos e 10 ofertas.
3. **Preço de mercado** (1b48a6a): colunas market_* em offers, função refresh_market_reference() (service_role) e view catalog_offers recriada com as colunas (migration 20261123180020). Na primeira execução: 477 ofertas avaliadas, 27–31 com 1 outra loja e nenhuma com 2 ou mais, então "Abaixo do mercado" ainda mostra 0 (correto: referência insuficiente). Exemplos de desconto anunciado limitado pelo mercado: KaBuM Ryzen 5 8500G anunciava 52% a R$ 799,99 contra R$ 859,14 em outra loja. Recalculado a cada ciclo no job report (`npm run market:refresh`).
4. **Especificações** (86ea620, ba0f2ad): lib/specs.ts compartilhado. /api/product devolve a ficha técnica do mesmo produto canônico de outra loja, com a origem indicada. Vitrines de varejistas do ML usam a marca do título só quando há exatamente um fabricante (nunca em PC/kit; AMD/Intel só para CPU). Sem avaliações no ML; nada transferido.
5. **Filtros dinâmicos** (634178e): facetas por categoria geradas do catálogo elegível, com contagens cruzadas. Verificado em produção: Placas de vídeo → Chip gráfico (NVIDIA 39, AMD 7), GPU, Memória de vídeo e Fabricante da placa; NVIDIA filtra 46 → 39.
6. **Alertas** (86ea620, 634178e): spec_filters aceita listas e `_min`; a regra de alerta usa o mesmo extrator. Testes com os exemplos do proprietário (DDR5 16 GB R$ 100 abaixo do histórico; NVIDIA ≥12 GB).
7. **Perfil e Notificações** separados no menu da conta (634178e). NÃO verificado com usuário logado (sem credencial de teste nesta sessão).

- **Falhas:** a rodada da coleta com código e17a6ff teve Patoloco/WAZ vermelhas por Cloudflare 522 no gateway Supabase (a API de gestão também deu 502 no mesmo horário). O passo de coleta ganhou uma nova tentativa.
- **Pendências:** validar Perfil/Notificações logado; acompanhar se "Abaixo do mercado" ganha itens à medida que as identidades novas se propagam; o catálogo ainda baixa ~1,5 MB por visita (todas as páginas) para facetas e contagens exatas. Se crescer muito, mover facetas para o servidor.

---

# CHECKPOINT — Mercado Livre por vitrines de lojas oficiais (Claude Code, 23/11/2026, ~17h30 UTC)

- **Contexto:** conta Developers bloqueada, sem OAuth. Investigação completa em `docs/MERCADOLIVRE_RESEARCH.md`. API sem token 401/403; produto/lista redirecionam para verificação de conta; sem sitemap; bibliotecas comunitárias dependem desses mesmos caminhos.
- **Implementado:** conector `mercadolivre-lojas-oficiais` (`lib/connectors/mercadolivre-stores.ts`) lê as vitrines públicas `/loja/{slug}` de 25 lojas oficiais de tecnologia. Executor `scripts/connectors.ts` (lease, política de marketplace, persistência igual à do coletor em `lib/connectors/persist.ts`). Job `connectors` em collect.yml, paralelo à matriz.
- **Validação hospedada:** probe 45225406075 (200 no runner) e coleta 45226618462: 329 anúncios gravados, 169 com desconto anunciado, 0 rejeitados, 0 erros. Amostras no banco: kits upgrade da Pichau ("Kit Upgrade Gamer AMD Ryzen 5 5500 + A520M + 8GB DDR4", R$ 1.349, antes R$ 2.200), RTX 5070 Gigabyte, notebooks Lenovo/Dell/Acer. `store_registry.mercadolivre = partial`, com produto de teste (migration 20261123172551).
- **Rotina:** execução 45229429860 (9efdf20, 17:36 UTC) com collect×4, connectors e report verdes. Conector gravou 377 anúncios com 0 falhas. Ofertas ativas: ML 377, KaBuM 337, Patoloco 249, Guerra 160, WAZ 159 (1.282 no total), todas com 0 vencidas. Na interface: 633 produtos na modalidade de ofertas (antes 452), Mercado Livre no filtro de lojas.
- **Classificador:** monitor "Full HD" não cai mais em SSD; notebook com CPU móvel (H/HX/HS/U) e RTX não cai mais em placa de vídeo.
- **Ferramentas:** `probe.yml` (sondagem manual a partir do runner) e `connectors.yml` (validação manual de conectores).
- **Pendências:** unificar a persistência de `lib/collector.ts` com `lib/connectors/persist.ts`; ampliar slugs de lojas oficiais (validar cada um com probe.yml); itens do ML não têm MPN, então não há comparação entre lojas por identidade.

---

# CHECKPOINT — acessos oficiais, paginação e conectores (Claude Code, 23/11/2026, ~16h UTC)

Regra do proprietário: custo zero absoluto (sem depósito, assinatura ou API paga).

- **Acessos:** `docs/ACCESS_GUIDE.md` traz o passo a passo de Mercado Livre (app no DevCenter, só leitura + offline_access, redirect `/api/integrations/mercadolivre/callback`), Shopee (afiliados + Open API) e AliExpress (Portals + app Affiliates API), com nomes de secrets e o que cada API devolve, além da mensagem para Pichau/Terabyte. Amazon (sem elegibilidade) e Magalu (Awin pede depósito) ficam em espera. Nenhum cadastro foi feito; aguardando o proprietário.
- **Conectores:** `lib/connectors/` tem contrato, política de publicação para marketplace e conversão para `ParsedProduct`, com testes. Os três conectores estão registrados como NÃO implementados. Ao receber credenciais: implementar `listings()`, rota OAuth do ML com refresh token rotativo numa tabela privada (service_role), extrair a persistência de `lib/collector.ts` para reuso e só então marcar `implemented=true` após consulta hospedada real.
- **Paginação:** `/api/catalog?page=N` (400 por página). Verificado em produção: página 0 = 400, página 1 = 356, total 756, página inválida = 400 (Bad Request); sem descrição longa na listagem. A interface mostrou 48 cards, "Mostrar mais (404 restantes)" e 96 após clicar; altura da página ~10.800 px (antes ~105.000). Contagens usam o conjunto completo: 452 produtos na modalidade de ofertas. Limitação: páginas buscadas em instantes diferentes; deduplicação por id evita repetição, mas uma oferta pode mudar de posição entre páginas e só aparecer no próximo carregamento.
- **View `catalog_offers`** (migration 20261123160626, aplicada via db query): security_invoker, anon com SELECT, specs sem "Descrição do fabricante". Payload de 756 ofertas: 2,0 MB → 1,55 MB.
- **Descoberta:** rotas cadastradas antes de subcategorias descobertas (antes, a ordem alfabética punha monitor-portátil/macbook-air na frente de kit-upgrade, e cursores pares visitavam 1 página). A KaBuM descarta itens de marketplace já na listagem (48 dos 60 na de kits). "Ofertas do dia" da KaBuM carrega via cliente (0 links no HTML) e não foi incluída.
- **Kits no catálogo hospedado (16:52 UTC):** a RPC `diverse_candidates` (migration 20261123164224, só service_role) corrigiu a fome de categorias novas: antes o coletor lia os 300 candidatos mais antigos da loja, e os kits recém-descobertos nunca entravam. Confirmados no banco: "Processador AMD Ryzen 5 8500G + Placa Mãe ASUS B650M-AYW Wi-Fi" (R$ 1.578,99) e "Kit Upgrade AMD Ryzen 5 5500 + Placa-Mãe MSI A520M-A PRO" (R$ 849,99), disponíveis, com componentes nas specs e `product_id` nulo. Sem preço riscado na KaBuM (`evidence=none`), então não aparecem nas modalidades de oferta até haver desconto anunciado ou queda comprovada (≥3 dias de histórico). Isso é a regra do produto, não falha.
- **Estado medido às ~16h UTC:** 756 ofertas ativas (KaBuM 260, Patoloco 248, WAZ 125, Guerra 123), zero vencidas; cadeia relay ininterrupta desde 14:42 UTC. Kits: a página de kits da KaBuM ainda não tinha sido visitada no momento da medição (código de prioridade publicado depois). Conferir `select count(*) from offers where category='kit' and available`.

---

# CHECKPOINT — grandes lojas, variedade e kits upgrade (Claude Code, 23/11/2026, noite)

Prioridade do proprietário: grandes lojas (Mercado Livre, Amazon, Terabyte, Pichau, Magalu, Shopee, AliExpress) antes de lojas menores. iByte e similares ficam para depois.

- Grandes lojas: nenhuma integrável sem ação do proprietário. Sondagem atual e passos exatos (cadastros, permissões, nomes de secrets) em `docs/MAJOR_STORES.md`. Ordem recomendada: Shopee, AliExpress, Pichau/Terabyte (pedido de feed ou liberação do robô), Mercado Livre (testar token), Awin/Magalu, Amazon. Não implementar adaptadores de API sem credencial real para testar.
- Kits upgrade: categoria `kit` agora significa CPU + placa-mãe (com/sem RAM), rótulo "Kits upgrade". Exclui PC completo, kit de memória e combos teclado/mouse (vão para periféricos). Componentes do título viram specs "Componente do kit: …". Kits nunca recebem identidade canônica (`identityForOffer` retorna null), então não casam com o processador avulso nem disparam alertas de produto exato da CPU. Títulos iniciados por "Processador" não caem mais em placas-mãe. Ofertas antigas são reclassificadas na próxima verificação; nenhum alerta usava `kit`.
- Descoberta: o caminho KaBuM `/kits-gamer` retornava 0 produtos. O real é `/hardware/kit-hardware/kit-upgrade` (60 por página). Adicionados notebooks, PCs, cadeiras gamer, headsets e páginas 2/3 (KaBuM `page_number`, aceito pelo robots e agora pelo filtro de URL), WAZ cadeiras, Guerra Digital kit-upgrade/computadores. Patoloco não tem página de kits listável (redireciona para monte-seu-pc).
- Volume Actions: 90 detalhes, prazo 330 s, 3 páginas de categoria por loja por execução, timeout 9 min, relay aguarda 420 s (cadência ~15 min). Vercel inalterada (prazo próprio, 1 página). A admissão continua capacidade-primeiro: crescimento de anúncios novos fica limitado quando há rechecagens devidas.
- Barra lateral: `components/useScrollingSidebar.ts` faz a barra acompanhar a rolagem nos dois sentidos (desktop ≥601 px), sem rolagem interna. Algoritmo validado no DOM de produção com 1.163 px de barra e janela de 800 px. Validação visual pós-deploy ainda pendente.
- Verificado em produção: execuções 45204350287 e 45206601558 (código 862e716) verdes em collect×4, relay e report. Relatório após a primeira: rechecagens com atraso máximo de 4 min e disponíveis com TTL vencido KaBuM 0, Patoloco 0, Guerra 0, WAZ 1. Notebooks ao vivo foram de 9 para 23; KaBuM descobriu 124 URLs numa execução. Em produção, a barra lateral recebe `position: sticky` com `top` dinâmico (−169 px após rolar) e o bloco "Kits upgrade" aparece; captura visual não feita porque o painel do navegador estava oculto.
- Kits: validação local na listagem real da KaBuM (44 de 60 slugs como kit) e em páginas de produto reais (vendedor KaBuM!, preço, estoque, componentes). A página de kits ainda estava na fila de categorias (11 páginas nunca visitadas à frente, 3 por execução), então os kits hospedados devem aparecer na próxima hora. Conferir `select count(*) from offers where category='kit'`. Kits da KaBuM geralmente não têm preço riscado: sem histórico, aparecem como monitorados, não como promoção.
- Falha 45199413698: coleta OK nas 4 lojas; só o relatório falhou por Cloudflare 522 no gateway Supabase (transitório). Relatório agora roda uma vez, com uma nova tentativa.
- Pendências: paginação da listagem pública (página tinha ~105.000 px e limite de 500 anúncios); retirar descrição do payload do catálogo; acompanhar capacidade com o volume maior.

---

# CHECKPOINT — confiabilidade da coleta (Claude Code, 23/11/2026, tarde)

Este bloco prevalece sobre os anteriores no que se refere a agendamento e capacidade.

## Agendamento GitHub: causa e correção

- Fato medido: `gh run list --workflow collect.yml --event schedule` vazio e API `actions/runs?event=schedule` com total 0. O workflow existe desde 03:35 UTC; o cron antigo de 5 min (≈115 janelas) e o de 30 min nunca geraram execução. Também após re-registrar o cron (`4,19,34,49 * * * *`, push às 14:19 UTC) a janela de 14:34 não disparou. Workflow `active`, Actions habilitado, YAML válido (dispatch funciona), repositório público com atividade. Não há causa de configuração identificável no repositório: o agendador do GitHub não está entregando `schedule` aqui. Não afirmar outra causa sem evidência.
- Correção sem credencial nova: job `relay` em collect.yml. Ao fim de cada execução (inclusive com falha de uma loja), espera 540 s e despacha a próxima com o `GITHUB_TOKEN` efêmero (`workflow_dispatch` é a exceção documentada que cria nova execução). Cadência efetiva ≈15 min. Para sozinho se houver run `schedule` nos últimos 45 min. Desligar: variável de repositório `COLLECT_RELAY=off`. Duplicatas colapsam pelo grupo de concorrência (uma pendente). Se a cadeia morrer (cancelamento, incidente GitHub), reiniciar com `gh workflow run collect.yml`; o lote Supabase→Vercel continua como base mínima.
- Verificado: execução 45196999712 (14:42 UTC, commit 91e3fc5) terminou verde nas quatro lojas e no relay, que despachou sozinho a 45199413698 às 14:55 UTC. Totais: WAZ 59 (33 esgotamentos confirmados, zero "Pix diverge"), Patoloco 58, KaBuM 41 (19 exclusões de vendedor), Guerra 15. Relatório ao fim de um job: devidas KaBuM 37/Patoloco 48/WAZ 16; disponíveis com TTL vencido KaBuM 19/Patoloco 25/WAZ 1. O backlog ainda convergia; NÃO declarar capacidade sustentável antes de acompanhar várias horas de relatórios com vencidas próximas de zero.
- Alternativa mais robusta, NÃO ativada: pg_cron despachando o workflow pela API do GitHub. Exige token fine-grained só deste repositório com Actions: read/write, criado pelo proprietário e guardado no Vault (`baixou_github_dispatch`). Não criar nem pedir o token pelo chat.

## Capacidade de revalidação (medida)

- Antes: 50 anúncios com estoque e TTL vencido (KaBuM 40) às 14:16 UTC; só o lote Vercel rodava (~8 verificações/15 min ≈32/h) contra ~390 disponíveis com TTL 60 min. Mesmo com Actions a cada 30 min, 50 por loja com metade das vagas para candidatos novos não cobria KaBuM/Patoloco.
- Agora (`lib/collection-policy.ts`): admissão capacidade-primeiro (`planBatch`): rechecagens devidas antes de candidatos novos; faixa mínima de 10% para descoberta em lotes ≥10 (lote Vercel de 2 só revalida quando há devidas). Rechecagem marcada 20 min antes do TTL (`recheckMinutes`: 40 min para TTL 60, 5 min para TTL 15; indisponível 180 min). Actions: 60 detalhes por loja por execução. TTL NÃO foi alterado.
- Primeira execução com a política (45193091233): 211 verificações em uma rodada (antes ~100), zero falhas de loja; KaBuM vencidas 40→21. Necessidade estimada com o conjunto atual: KaBuM ~40/execução, Patoloco ~45/execução a cada 15 min; cabe em 60. Crescimento do conjunto ativo fica limitado pela faixa de 10%.
- `npm run collect:report` agora inclui por loja: rechecagens devidas, atraso máximo e disponíveis com TTL vencido. Usar isso para decidir aumento de volume.

## Orçamento gratuito

- GitHub Actions: repositório público, minutos de runners padrão sem cobrança. ~4 execuções/h × (4 jobs de coleta ~3–4 min + relay ~9 min ocioso).
- Supabase egress: o coletor baixava até 1.000 linhas de histórico por verificação; com 30 dias de buckets horários e ~400 verificações/h a projeção passava de 10 GB/mês (franquia gratuita 5 GB). Migration `20261123142040_price_history_stats.sql` (aplicada via db query, service_role apenas; anon/authenticated sem EXECUTE, verificado) agrega mediana/amostras/dias no Postgres com a mesma regra; teste de equivalência em tests/engine.test.ts; valores gravados conferidos em produção.
- Catálogo público: ~1,16 MB do Supabase por cache miss (specs = 43%: descrição do fabricante). Cache de borda subiu para `s-maxage=60, stale-while-revalidate=240`; o cliente revalida `expires_at` no instante da renderização, então cache não exibe oferta vencida. PENDENTE: retirar a descrição da listagem (view/RPC) e carregá-la no detalhe; acompanhar Egress no painel Supabase com tráfego real.
- Vercel: lote inalterado (*/15, 2 por loja). Não aumentar sem medir CPU no Usage.

## Outras correções

- WAZ: 37 de 50 tentativas falhavam como "Preço Pix diverge do schema". Página amostrada: vendedor WAZ com `OutOfStock` no schema e sem preço Pix exibido. Agora é `ConfirmedUnavailable` (atualiza só estoque de oferta existente, reagenda 3 h), nunca oferta com preço do schema. Fixture real reduzida `tests/fixtures/expansion/waz-out-of-stock.html`.
- 44 testes, typecheck e build passam. CI verde em todos os commits desta etapa; deploy de produção READY.

## Expansão: situação

- Mercado Livre, Amazon, Magalu, Shopee e AliExpress: exigem conta/aprovação/OAuth do proprietário (ver PRIMARY_SOURCES.md). Pichau/Terabyte: 403 já documentado. Nenhuma integrável sem essas autorizações; não simular.
- Sondagem leve (robots + home com UA do coletor) entre pendentes: iByte responde 200 e é VTEX com JSON-LD (mesma plataforma da WAZ) — próxima candidata. Chipart/Nagem 200 sem JSON-LD na home; FGTec Magento; Hardstore/Shopinfo redirecionam. Nada disso é integração: exige adaptador, fixtures, vendedor próprio e teste hospedado.

---

# CHECKPOINT ANTERIOR — 23/11/2026

## Começar aqui

Código validado e publicado: **bcb4bce**. Este bloco é o checkpoint documental posterior; consulte git log -1 para seu hash. Pasta autoritativa: D:\PROJETOS\baixou. Repositório: https://github.com/uPedroLima11/baixou . Produção: https://baixouofertas.vercel.app . Leia AGENTS.md, este bloco e docs/EXPANSION_REPORT.md; não reconstruir o projeto.

- 41 testes passaram, assim como TypeScript e build. CI45191497674 aprovado para o código validado; deploy baixou-hm8xjh492-upedrolima11s-projects.vercel.app confirmado READY.
- Última coleta manual hospedada45189145295 terminou com sucesso nas quatro lojas. As execuções manuais comprovam coleta; não comprovam o disparo do agendamento GitHub.
- Nenhuma alteração de SMTP ou recriação de segredo foi feita nesta etapa final. Não pedir senha ou token pelo chat.

## Métricas e contadores confirmados

Medição Supabase de23/11/2026 às11:11:02 (SãoPaulo), seguida de validação contra a API pública já publicada:

| Loja | Anúncios coletados | Disponíveis no TTL | Anúncios com desconto |
| --- | ---: | ---: | ---: |
| KaBuM! | 133 | 132 | 113 |
| WAZ | 78 | 78 | 8 |
| Guerra Digital | 97 | 59 | 0 |
| Patoloco | 156 | 156 | 144 |
| Total | 464 | 425 | 265 |

A listagem sem filtros continha262produtos após agrupar anúncios do mesmo modelo. A API retornava425anúncios, sem truncamento. “Todas as ofertas” e a modalidade passaram a usar o mesmo conjunto elegível e agrupado dos cards; ambos deram262na validação pública. Busca, loja, preço e desconto participam das contagens. Os números mudam com a coleta e o TTL.

A diferença relatada pelo usuário (378/230/227) vinha de comparar três etapas diferentes: todos os anúncios disponíveis, anúncios com desconto e produtos agrupados. Não era correto usar a primeira contagem nos filtros do modo de promoção. lib/catalog-selection.ts agora centraliza a seleção, e os testes cobrem essa divergência.

As quatro lojas estavam presentes na resposta pública. Guerra Digital tinha59produtos disponíveis, mas zero descontos elegíveis: não forçar preços normais para preencher o catálogo. WAZ tinha8ofertas elegíveis. O código não pré-seleciona KaBuM/Patoloco. Agora escolhas manuais de loja são preservadas em sessionStorage; ausência de filtro inclui todas. A janela “Origem dos preços” mostra o funil por loja e o resultado no filtro atual.

A função pública catalog_coverage() é SECURITY INVOKER, usa somente dados de ofertas já públicos e respeita RLS. Migration20261123140847_catalog_coverage_counts.sql aplicada. A API inclui coverage e truncated; não expõe filas ou usuários. O limite de500anúncios por resposta permanece e deve receber paginação antes de crescer além disso. Nesta validação não havia truncamento.

## PRIORIDADE 1: revalidação e disparo automático do GitHub

A medição encontrou171rechecagens devidas: KaBuM76(até12min), WAZ24(até12min), Guerra20(até8min), Patoloco51(até13min). Nenhum anúncio disponível estava expirado porTTL nessa fotografia. A fila “devida” antecipa o TTL, mas a margem já está curta: NÃO declarar capacidade sustentável de longo prazo nem ignorar risco de expiração futura.

O GitHub workflow está ativo e configurado para cada30min, porém a consulta gh run list --event schedule retornou lista vazia durante esta etapa. A causa não foi investigada até o fim por orientação expressa do proprietário para encerrar. Verificar por que o GitHub não está produzindo execuções agendadas é a primeira retomada: o lote conservador da Vercel sozinho não foi dimensionado para sustentar todo o conjunto crescente. Não confundir sucesso manual com agendamento comprovado.

O Supabase tem ativos:
- baixou-collect-batch: */15 * * * *, lote das quatro fontes, até dois detalhes por fonte, descoberta de categoria apenas após30minsem descoberta recente;
- baixou-collect-retry: minutos2/17/32/47, recuperação única se nenhum worker iniciou nos últimos5min.

Os quatro crons individuais antigos estão inativos. Não reativá-los em paralelo. O pg_net teve erro intermitente HTTP/2; tentativa seguinte chegou ao worker. Observar net._http_response e collection_runs, inclusive exclusões de política, não só cron.job_run_details=succeeded. Estoque/favoritos/histórico não são apagados por falhas.

O parser foi trocado pelo export documentado cheerio/slim após benchmark em páginas reais:672ms versus141ms de CPU para16documentos, com título/canonical/JSON/preço idênticos. Os41testes passaram após a troca. Isso é medição local do parser, NÃO homologação de um lote maior na Vercel. Não aumentar frequência/volume sem medir CPU/duração hospedadas e franquia. O lote anterior reduzido mediu2061ms deCPU/9811ms de duração; a medição ainda precedia o parser otimizado.

Próximas ações, nesta ordem:
1. Confirmar e corrigir o disparo automático GitHub, documentando o motivo real se encontrado.
2. Medir taxas de revalidação e o backlog por loja; priorizar ofertas/favoritos e ajustar admissão/volume com orçamento medido. Não estender TTL para esconder atraso nem inventar estoque.
3. Implementar paginação/filtros no servidor antes de ultrapassar o limite público de500anúncios; manter contagens honestas.
4. Validar visualmente os contadores/filtros na sessão autenticada. A igualdade foi testada com dados reais da API e pela função usada pela UI; teste visual completo ainda não foi feito.
5. Prosseguir na expansão das lojas autorizadas. Bits/Terabyte/Pichau permanecem bloqueadas; não repetir403ou recriar pesquisas já registradas.

## Retomada sem plugins

Claude pode não herdar os plugins nem sessões desta tarefa. Clone/leitura do GitHub público não exigem chave; push exige autenticação com permissão no repositório. Vercel e Supabase exigem login oficial no ambiente do próximo agente. Não há necessidade de trocar secrets existentes.

~~~sh
git clone https://github.com/uPedroLima11/baixou.git
cd baixou
npm ci
npm test
npm run typecheck
npm run build
gh auth status
gh run list --repo uPedroLima11/baixou --workflow collect.yml --limit 5
gh run list --repo uPedroLima11/baixou --workflow collect.yml --event schedule --limit 5
gh workflow run collect.yml --repo uPedroLima11/baixou
npx vercel project inspect baixou --non-interactive
npx vercel deploy --prod --yes --scope upedrolima11s-projects
npx supabase db query --remote=slmhkfqqeyptngjubfhn --read-only "select public.catalog_coverage()"
~~~

Se desconectado, usar gh auth login, npx vercel login e npx supabase login pelos fluxos oficiais, com o proprietário quando necessário. Confirmar escopo e projeto antes de qualquer escrita. Supabase dedicado: slmhkfqqeyptngjubfhn; não alterar o outro projeto da conta. Criar novas migrations com o CLI e não reaplicar as já executadas via db query. Não executar db push cegamente: histórico de migrations do CLI pode estar incompleto.

Segredos existentes, somente nomes/destinos:
- Vercel: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL; SUPABASE_SERVICE_ROLE_KEY e CRON_SECRET como Secret; SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM, SMTP_PASS no servidor.
- GitHub Actions Secrets: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. GitHub Variable: NEXT_PUBLIC_SITE_URL. GITHUB_TOKEN é efêmero do Actions, não criar token pessoal como substituto silencioso.
- Supabase Vault: baixou_collector_secret, cópia exclusiva de CRON_SECRET aprovada pelo usuário. Supabase Auth mantém SMTP Gmail configurado. Não guardar service_role no Vault.

vercel env run não exporta Secrets; não tentar baixá-los para inspecionar. Use os ambientes hospedados já configurados. npm run collect:report depende das variáveis autorizadas do worker e escreve resumo real no Actions. Fonte de dados, filas, migrations e decisões detalhadas seguem abaixo.

---

# Ajuste adicional de contadores — 23/11/2026

O usuário relatou 378 em “Todas as ofertas”, 230 na modalidade e 227 cards. A causa era usar a base monitorada inteira nos filtros, descontos no modo e agrupamento de produto somente nos cards. Agora lib/catalog-selection.ts fornece a mesma elegibilidade e agrupamento para filtros, modos e listagem. Respeita loja, preço, busca, desconto e validade em um mesmo instante. Favoritos continuam incluindo indisponíveis e não exibem modos de promoção que não se aplicam a eles. 41 testes passaram, incluindo três regressões específicas. Validar no navegador após o deploy deste ajuste.

# Estado atual: expansão do motor — 23/11/2026

Leia primeiro AGENTS.md e docs/EXPANSION_REPORT.md. Este bloco prevalece sobre o checkpoint-base abaixo. Domínio padrão: https://baixouofertas.vercel.app . A interface foi preservada.

## Concluído e testado nesta etapa

- Quatro lojas operacionais após coleta hospedada e gravação real no Supabase: KaBuM!, WAZ, Guerra Digital e Patoloco. Oficina dos Bits possui parser e fixtures atuais, mas duas categorias retornaram HTTP 403 no GitHub runner. Foi removida da rotina, sem bypass. Terabyte e Pichau continuam bloqueadas.
- Na medição de 10:47:26 (São Paulo): 828 URLs candidatas, 204 páginas de descoberta, 406 anúncios detalhados persistidos, 370 disponíveis dentro do TTL e 223 com desconto anunciado. Todas as 14 categorias tinham estoque ativo. Zero quedas comprovadas: ainda faltam dias mínimos de histórico. Não confundir anúncios com modelos únicos.
- Existem correspondências reais entre lojas pela identidade canônica. Foram revisados três modelos Kingston, com MPN e variantes consistentes entre KaBuM/Guerra Digital e KaBuM/Patoloco. O banco tinha 209 identidades canônicas representadas e 193 anúncios sem identificador forte na consulta posterior. Não fundir esses anúncios por título aproximado.
- Alertas de categoria sem marca/modelo foram testados com Kingston, Corsair, XPG e Husky, modelos e lojas diferentes, usando a mediana própria. Kits RAM e módulos de notebook classificam como RAM; notebook RTX não classifica como GPU. Produto exato continua sendo uma regra separada por identidade/variante.
- 38 testes de motor/parsers passaram; TypeScript e build passaram. Rodada hospedada 45185654640 terminou com sucesso nos quatro jobs, incluindo o relatório real de cobertura. Commits posteriores devem ser conferidos no CI/deploy atual.
- Filas privadas tiveram privilégios conferidos: anon não lê product_candidates; authenticated não lê collection_state; service_role lê. RLS sem política nas tabelas do worker é intencional.

## Coleta e orçamento gratuito

- Filas persistentes: collection_state, collection_pages, product_candidates e collection_runs. Cursores não dependem de módulo do relógio. Cada loja tem lease próprio; falha de uma fonte não bloqueia as demais.
- Descoberta alterna categorias conhecidas, links públicos observados e paginação permitida pelo robots. Também lê JSON-LD ItemList: fixture WAZ contém 12 produtos sem depender de âncoras. Não chamar APIs internas como contorno.
- Novidades diversas e revalidações vencidas têm faixas alternadas. Falhas recebem backoff de 15 minutos a seis horas. Estoque explicitamente indisponível sem preço na Patoloco é reconsultado após três horas; não criar preço zero. Vendedor/condição excluídos são reagendados após 24 horas, sem fingir esgotamento nem falha técnica.
- Limites: 2.000 candidatos por loja, até 150 novos links por página, 8 MB por resposta, timeout de oito segundos e pausa de 1,5 segundo por domínio. Logs têm retenção de sete dias; histórico mantém 35 dias. Favoritos/alertas não expiram.
- TTL regular de 60 minutos; queda histórica de pelo menos 20% usa 15 minutos. Falha não renova TTL. Alertas exigem confirmação recente em cinco minutos. Esses limites não reservam estoque nem garantem capturar promoções de minutos.
- **Agendamento final:** Supabase Cron baixou-collect-batch ativo em */15, chamando /api/jobs/collect?batch=1. Uma invocação compartilha memória entre as quatro lojas, até dois detalhes por fonte e orçamento de 35 segundos. Categorias só são revisitadas pelo fallback após 30 minutos sem descoberta recente. Actions continua com matriz das quatro fontes a cada 30 minutos, até 50 detalhes por fonte e deadline de quatro minutos.
- O lote amplo inicial mediu 4.167 ms de CPU, alto demais para extrapolar chamadas frequentes no Hobby. O lote reduzido rodou nas quatro lojas: sete verificações, zero falhas, 9.811 ms de duração e 2.061 ms de CPU. A frequência de 15 minutos deixa margem para descoberta periódica e uso público. São amostras, não medição mensal nem garantia de franquia ilimitada; acompanhar Usage na Vercel.
- Existe falha intermitente de transporte HTTP/2 no pg_net. A tentativa seguinte chegou ao worker com HTTP 200. O job baixou-collect-retry roda aos minutos 2/17/32/47 e só envia uma recuperação se nenhum worker começou nos últimos cinco minutos. Não repete um lote que já chegou à aplicação, mesmo se a resposta se perder. Verificar net._http_response e collection_runs, não apenas o status SQL do cron.
- Os quatro crons individuais antigos ficaram inativos somente na mesma transação que ativou o lote testado. Não reativá-los em paralelo, pois isso consome franquia redundante.

## Migrations adicionais aplicadas via CLI

- 20261123130748_progressive_collection_queue.sql: filas, cursores, observabilidade e RLS privada.
- 20261123131654_per_store_collection_schedule.sql: promoção condicionada a ofertas reais e primeiros crons por loja (agora inativos).
- 20261123134010_batched_collection_budget.sql: prepara o job em lote inicialmente inativo.
- 20261123134605_activate_batched_collection.sql: troca atômica para lote de 15 minutos, após teste hospedado.
- 20261123135330_excluded_product_state.sql: verification_status=excluded, preservando disponibilidade e favorito quando vendedor/condição não são aceitos.
- 20261123135509_collector_transport_retry.sql: recuperação limitada do transporte e índice de heartbeat.

Não reaplicar migrations. O histórico CLI pode estar incompleto por terem sido aplicadas via db query. Não copiar chaves do Vault para documentos ou logs.

## Falhas e próximos passos

As primeiras rodadas foram parcialmente vermelhas por Bits 403, ciclo ocioso tratado como erro e mensagens de banco genéricas. Corrigimos a classificação de ciclo ocioso e preservamos mensagens seguras. Logs posteriores esclareceram que erros recentes KaBuM eram rejeições de vendedores terceiros: agora são exclusões de política, não esgotamento nem falha técnica. Não inventar uma causa para erros históricos sem mensagem recuperável.

Próximos passos: acompanhar idade/CPU/franquia; aumentar capacidade somente com medição; aprofundar identificação/especificações conservadoras; ampliar fontes com acesso realmente autorizado. Amazon/Shopee/AliExpress dependem de conta e aprovação; APIs de seller Mercado Livre/Magalu não são feed global. Pesquisa e links oficiais estão em docs/PRIMARY_SOURCES.md. Não simular credenciais ou integração.

npm run collect:report consulta os dados reais e escreve o resumo do Actions. Reportar separadamente candidatos, anúncios persistidos, estoque dentro do TTL, descontos anunciados, quedas comprovadas e identidades fortes. O catálogo API ainda limita a resposta a 500 anúncios: preparar paginação antes de ampliar a listagem pública além disso. A fila de descoberta pode ser maior sem transformar todo candidato em card.

O checkpoint-base abaixo registra arquitetura, e-mail e decisões anteriores. Referências antigas a KaBuM única, TTL de 30 minutos ou cron global de cinco minutos foram substituídas pelas decisões acima.

---

# Baixou! — continuidade em 23/11/2026

Leia também AGENTS.md e README.md. Preserve a implementação; não recomece o projeto.

## Projeto e acessos

- Pasta autoritativa: D:\PROJETOS\baixou. A cópia antiga em Documents não é o projeto atual.
- Código público autorizado: https://github.com/uPedroLima11/baixou . Credenciais nunca entram no Git.
- Domínio padrão autorizado: https://baixouofertas.vercel.app . O alias antigo redireciona; não chamar jobs autenticados através dele, pois o cabeçalho Authorization pode se perder.
- Vercel: projeto baixou, workspace upedrolima11s-projects, plano Hobby, GitHub main conectado.
- Supabase dedicado: slmhkfqqeyptngjubfhn, região sa-east-1, plano gratuito. NÃO alterar o outro projeto da conta.
- CLIs GitHub, Vercel e Supabase foram autorizados pelo proprietário. Claude em outra máquina não herda esses logins; pode precisar de nova autorização oficial.

## Arquitetura

Next.js 16 / React 19 / TypeScript. Supabase fornece Postgres, Auth e Storage de avatares. Nodemailer roda somente no servidor. GitHub Actions faz descoberta/coleta ampla; Supabase Cron chama um worker curto na Vercel a cada cinco minutos. Não depende do computador do proprietário ligado.

A interface existente inclui temas claro/escuro, busca sem acentos, filtros, detalhes, imagens, especificações, histórico, favoritos e configurações. React Bits AnimatedContent/GSAP tem licença incluída e respeita movimento reduzido. Não reformular o layout sem necessidade.

## Diagnóstico e correções desta etapa

O catálogo vazio foi causado por ofertas vencidas: 29 registros continuavam no banco com estoque positivo, mas tinham cerca de nove horas sem verificação e TTL de 30 minutos. Não houve evidência de esgotamento nem exclusão desses produtos. O workflow GitHub estava ativo, mas só execuções manuais foram observadas no período.

A lista de desejos também consultava exclusivamente o catálogo ativo. Agora consulta wishlist com suas ofertas pela sessão autenticada, independentemente de estoque, desconto ou TTL. Produtos salvos continuam visíveis sem anunciar preço vencido como atual. Novas ofertas do mesmo produto canônico podem ser mostradas sem substituir o vínculo salvo. Exclusão de offers vinculadas a wishlist/alerts é impedida por FK RESTRICT. Não há expiração automática de favoritos ou alertas.

Estados distintos: available=false significa estoque indisponível confirmado; TTL vencido significa verificação expirada; verification_status=failed registra falha de consulta, sem alterar o último preço, checked_at ou inventar esgotamento. O catálogo público mantém somente ofertas disponíveis dentro do TTL.

## Alertas e identidade

- lib/alert-rules.ts permite max_price, min_drop_amount e min_discount opcionais e independentes. Pelo menos uma condição é obrigatória; condições fornecidas são combinadas com AND.
- Queda absoluta de R$ 200 funciona sem teto de preço. Queda absoluta/percentual exige mediana com cinco observações em três dias. Não usar preço riscado ou percentual arredondado para decidir a condição.
- brands e spec_filters permitem geração/capacidade/módulos/frequência de RAM, VRAM, painel/resolução/Hz de monitor, capacidade/interface de SSD, socket/núcleos de CPU e conexão de periféricos. Extração é conservadora e ainda não cobre todas as especificações possíveis. Dados desconhecidos não devem casar por suposição.
- lib/identity.ts normaliza marca, MPN e GTIN com checksum; variantes distinguem kits e módulos. O banco resolve produto canônico e associa alertas legados quando a oferta recebe identidade. Sem identificador forte, manter alerta na oferta original, evitando correspondências por título aproximado.
- Notificações procuram todas as ofertas integradas do produto, inclusive futuras, e selecionam a mais barata. notification_state impede repetir preço igual ou maior; notification_log limita por produto/dia. Falhas de envio ainda precisam de retry idempotente: claim falho permanece até o dia seguinte.
- Só recebe quem habilitou e-mail e confirmou a conta. Respeitar limite global. Favoritos notificam quedas históricas; metas de preço explícitas podem funcionar sem histórico, sem afirmar queda comprovada.
- Antes de enviar, exige estoque ativo, TTL válido e verificação bem-sucedida nos últimos cinco minutos. Não equivale a reserva ou validação de checkout de cupom.

## Coletor e fontes

lib/collector.ts consulta robots, limita hosts HTTPS, tamanho de resposta, timeout e taxa. Não contornar 403, CAPTCHA ou políticas. Eventos de descoberta são priorizados; revalidação consulta registros antigos; descoberta de categorias rotaciona. Lease Postgres impede execução simultânea. Revalidação ordena por última tentativa (nulos primeiro) e depois por última confirmação: uma URL que falha não pode monopolizar a fila eternamente.

KaBuM tem coleta real testada: HTML __NEXT_DATA__, preço final, estoque, fotos e specs, vendedor próprio confirmado por flags e identificação. Avaliações não são unidades vendidas. Terabyte e Pichau continuam parciais/bloqueadas; não anunciar como integradas.

Cadastro central prevê 40 lojas. WAZ, Oficina dos Bits, Guerra Digital e Patoloco tiveram páginas HTTP 200 investigadas, mas ainda não possuem adaptadores validados. Marketplaces exigem reputação do vendedor, não somente da plataforma. Ler docs/EXPANSION.md, PRIMARY_SOURCES.md e COLLECTOR_RESEARCH.md antes de repetir pesquisa.

LinksBR não está ativo. Não encontramos API/RSS pública publicada. Discord REST requer bot autorizado e permissões; Telegram requer bot com acesso ao canal. Infraestrutura de webhook/fila existe, fontes desativadas até autorização. Sem self-bots, tokens pessoais ou coleta privada. Ler docs/DISCOVERY_RESEARCH.md. Publicações são apenas descoberta; cards devem usar informações verificadas na loja. Cupons sugeridos não alteram preço sem validação.

TTL padrão 30 minutos. Histórico: uma observação por hora, retenção documentada de 35 dias; mediana de 30 dias exclui a última hora e requer cinco observações em três dias. Retenção de histórico não remove produtos salvos. Infraestrutura gratuita não garante descobrir toda oferta de minutos; acompanhar tamanho do conjunto versus capacidade de revalidação.

## Banco e migrations aplicadas

- 001_initial.sql: ofertas, histórico, perfis, favoritos, alertas, logs, RLS e avatares.
- 002_discovery.sql: fontes/eventos privados, atribuição e cupons.
- 003_collector_lease.sql: lease e RPCs só service_role.
- 004_registry.sql: cadastro central de lojas.
- 005_product_identity.sql: catalog_products, variantes, identidade de alertas, notification_state e deduplicação por produto.
- 20261123122001_flexible_alerts_persistence.sql: condições independentes, specs/marcas, FKs RESTRICT, estado de verificação; revoga execução pública explícita dos triggers SECURITY DEFINER.
- 20261123123751_hosted_collector_schedule.sql: pg_cron/pg_net, segredo dedicado no Vault e job inicialmente desativado.
- 20261123124649_activate_canonical_collector.sql: domínio canônico e ativação do job.
- 20261123125449_legacy_product_price_targets.sql: remove queda de 5% que o formulário antigo impunha silenciosamente em metas de produto; preserva categorias e regras novas. Uma regra legada foi corrigida.

Foram aplicadas via CLI db query. Não presumir que o histórico de migrations CLI esteja preenchido; não reaplicar arquivos já aplicados. Criar novas migrations pelo CLI. RLS sem políticas em tabelas de serviço é intencional: negar acesso público. catalog_products é leitura pública; dados privados permanecem isolados por usuário.

## Agendamento e publicação

Supabase Cron job baixou-collector está ATIVO em */5. Usa segredo exclusivo do Vault, sincronizado com Vercel CRON_SECRET por autorização expressa, sem armazenar service_role no Vault. Headers/segredos nunca devem ser impressos.

Primeira execução autônoma confirmada em 23/11 às 12:50 UTC (09:50 São Paulo): net._http_response HTTP 200, total=8, failures=0, skipped=false. Segundo ciclo às 12:55 UTC também HTTP 200, total=5, failures=0 e notifications={sent:0,configured:true}. Havia 41 ofertas ativas às 12:55:37 UTC. Confirmar resposta HTTP, não apenas cron.job_run_details=succeeded, pois pg_net é assíncrono.

Worker Vercel tem orçamento de 35 segundos para até oito produtos e, após sucesso, tenta um e-mail com orçamento curto. Actions tem deadline interno de quatro minutos e timeout de seis, mantendo descoberta mais ampla e envio maior. Escala futura exige fila/fairness; não prometer volume ilimitado no plano gratuito.

NEXT_PUBLIC_SITE_URL e URLs Auth foram alinhadas ao domínio canônico. Config push alterou somente site_url e additional_redirect_urls; SMTP e demais propriedades remotas não declaradas foram preservados. URLs antigas de callback continuam autorizadas por compatibilidade.

Deploy READY confirmado: dpl_4rWQ9Ked5y8Qg2W6rKcrBBgUNNVE para código d0e0210. Commits posteriores geram novos deploys; conferir status atual antes de afirmar a versão publicada. Consultar git log para o checkpoint mais recente.

## Testes e validação real

- 27 testes unitários passaram; TypeScript e build de produção passaram.
- CI 45178513424 (d0e0210) passou. Coleta Actions 45176953142 passou com 21 produtos reais e zero notificações, sem simular condições de preço.
- tests/persistence-rls.sql executado no Supabase com dois usuários temporários e uma oferta real, integralmente revertido: isolamento de perfis/favoritos/alertas, rejeição de escrita para outro usuário, alerta apenas de queda absoluta e bloqueio de exclusão de produto salvo.
- Catálogo público observado no navegador com ofertas reais e seleção automática de ofertas das lojas quando não há quedas históricas.
- Nodemailer hospedado validou TLS/autenticação e aceitação da mensagem pelo Gmail. Proprietário confirmou recebimento do diagnóstico e recuperação, e abertura do formulário. O agente não alterou senha. Novo cadastro em segunda caixa e notificação gerada por meta real ainda não homologados ponta a ponta.
- Não confundir testes de motor/banco com homologação completa da nova interface autenticada de filtros/favoritos.

## Variáveis: somente nomes e destinos

| Nomes | Destino |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Vercel e GitHub Secrets |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Vercel; chave pública protegida por RLS |
| SUPABASE_SERVICE_ROLE_KEY | Vercel Secret e GitHub Actions Secret |
| NEXT_PUBLIC_SITE_URL | Vercel e GitHub Variable |
| CRON_SECRET | Vercel Secret; cópia dedicada em Vault baixou_collector_secret |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM, SMTP_PASS | Vercel; campos correspondentes no Supabase Auth |
| COLLECT_STORES, COLLECT_MAX_PRODUCTS | workflow Actions |
| OFFER_TTL_MINUTES, NOTIFY_MAX_EMAILS | opcionais servidor/worker |
| DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID | somente quando autorizado; atualmente ausentes |

Não baixar Secrets para inspecionar. vercel env run não exporta esses valores. Diagnóstico SMTP hospedado tem HMAC e timestamp; check=smtp assina smtp:<true|false>:<timestamp>, com x-baixou-send-owner=yes para envio somente ao próprio remetente. Nunca publicar chave, link de recuperação ou destinatário nos logs.

## Comandos

~~~sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev
npm run collect:check
gh workflow run collect.yml --repo uPedroLima11/baixou
gh run list --repo uPedroLima11/baixou --limit 5
npx vercel project inspect baixou --non-interactive
npx vercel deploy --prod --yes --scope upedrolima11s-projects
npx supabase migration new nome_da_mudanca
npx supabase db query --remote=slmhkfqqeyptngjubfhn --file tests/persistence-rls.sql --yes
~~~

Os comandos de desenvolvimento não são necessários ao funcionamento hospedado. Banco exige CLI autorizado; confirmar sempre o projeto dedicado.

## Próximos passos

1. Validar a nova interface autenticada de filtros, preservação de favoritos e retorno de uma oferta real em outra loja quando houver integração adicional.
2. Homologar cadastro novo, cancelamento de notificações e disparo de alerta por condição real, respeitando opt-in e sem manipular preço para aparentar sucesso.
3. Melhorar retries de e-mail com idempotência e distribuição justa entre usuários; observar duração, limites e capacidade do worker versus TTL.
4. Expandir adaptadores com produtos reais nas fontes já investigadas. Só alterar status para operacional após teste hospedado.
5. Manter commits, push e este documento atualizados. Nunca declarar integração ou entrega sem evidência.
