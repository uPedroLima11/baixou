# Expansão em validação — 23/11/2026

Adaptadores candidatos WAZ, Oficina dos Bits, Guerra Digital e Patoloco implementados, com HTML atual HTTP200 e35testes aprovados. A migration20261123130748_progressive_collection_queue já foi aplicada, com RLS privada e status das novas lojas PARCIAL. Ainda não promover operacional sem execução hospedada e confirmação de offers reais.

Fila persistente separa páginas/candidatos; descoberta diversa e revalidação têm faixas alternadas; lease por loja permite paralelismo. Páginas navegam por links públicos observados e paginação permitida pelo robots, sem APIs internas. Falhas têm backoff. TTL padrão60min; queda histórica>=20% usa15min; estoque confirmado continua obrigatório. Não estender checked_at em falhas. Agendamentos por loja ainda precisam ser ativados após deploy. Actions agora tem matrix por loja a cada30min; Supabase manterá verificações curtas por fonte a cada5min.

Classificação corrigida: kit RAM e módulo de notebook são RAM; GDDR5 de placa de vídeo não é RAM. Testes validam alerta de categoria para Kingston/Corsair/XPG/Husky e modelos/lojas diferentes usando mediana própria, sem marca obrigatória. Produto exato continua identidade canônica separada.

Próximo passo obrigatório desta etapa: publicar/testar host, consultar banco e atualizar este bloco com os resultados reais. O checkpoint-base abaixo descreve o estado anterior.

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
