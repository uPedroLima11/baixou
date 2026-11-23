# CHECKPOINT — acessos oficiais, paginação e conectores (Claude Code, 23/11/2026, ~16h UTC)

Regra do proprietário: custo zero absoluto (sem depósito, assinatura ou API paga).

- **Acessos:** `docs/ACCESS_GUIDE.md` traz o passo a passo de Mercado Livre (app no DevCenter, só leitura + offline_access, redirect `/api/integrations/mercadolivre/callback`), Shopee (afiliados + Open API) e AliExpress (Portals + app Affiliates API), com nomes de secrets e o que cada API devolve, além da mensagem para Pichau/Terabyte. Amazon (sem elegibilidade) e Magalu (Awin pede depósito) ficam em espera. Nenhum cadastro foi feito; aguardando o proprietário.
- **Conectores:** `lib/connectors/` tem contrato, política de publicação para marketplace e conversão para `ParsedProduct`, com testes. Os três conectores estão registrados como NÃO implementados. Ao receber credenciais: implementar `listings()`, rota OAuth do ML com refresh token rotativo numa tabela privada (service_role), extrair a persistência de `lib/collector.ts` para reuso e só então marcar `implemented=true` após consulta hospedada real.
- **Paginação:** `/api/catalog?page=N` (400 por página). Verificado em produção: página 0 = 400, página 1 = 356, total 756, página inválida = 400 (Bad Request); sem descrição longa na listagem. A interface mostrou 48 cards, "Mostrar mais (404 restantes)" e 96 após clicar; altura da página ~10.800 px (antes ~105.000). Contagens usam o conjunto completo: 452 produtos na modalidade de ofertas. Limitação: páginas buscadas em instantes diferentes; deduplicação por id evita repetição, mas uma oferta pode mudar de posição entre páginas e só aparecer no próximo carregamento.
- **View `catalog_offers`** (migration 20261123160626, aplicada via db query): security_invoker, anon com SELECT, specs sem "Descrição do fabricante". Payload de 756 ofertas: 2,0 MB → 1,55 MB.
- **Descoberta:** rotas cadastradas antes de subcategorias descobertas (antes, a ordem alfabética punha monitor-portátil/macbook-air na frente de kit-upgrade, e cursores pares visitavam 1 página). A KaBuM descarta itens de marketplace já na listagem (48 dos 60 na de kits). "Ofertas do dia" da KaBuM carrega via cliente (0 links no HTML) e não foi incluída.
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
