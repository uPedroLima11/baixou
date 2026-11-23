# Handoff Baixou! — checkpoint 23/11/2026
Leia AGENTS.md primeiro. Preserve o que funciona. Este documento descreve o estado efetivo, não uma promessa de cobertura.
## Identidade e infraestrutura
- Pasta autoritativa: D:\PROJETOS\baixou (projeto transferido de Documents; não continuar no caminho antigo).
- GitHub: https://github.com/uPedroLima11/baixou . Visibilidade final PÚBLICA por autorização explícita, para usar runners padrão sem franquia privada. Segredos permanecem nos serviços.
- Vercel: projeto baixou no workspace pessoal upedrolima11s-projects, plano Hobby. Domínio https://baixou-iota.vercel.app . GitHub conectado.
- Supabase: projeto dedicado baixou, ref slmhkfqqeyptngjubfhn, organização do proprietário, região sa-east-1. Outro projeto na conta NÃO pertence a esta tarefa; não alterar.
- Primeiro deploy pronto: dpl_EU5Z1RPGDzKV2TtzBQSLrDzKe8ku. Deploy com banco confirmado READY: dpl_GVeWUuJZdBFxTNUsuoQYkiSfHhYj. Commits posteriores podem gerar novo deploy; conferir Vercel/CLI antes de afirmar qual é atual.
- Código-base antes deste checkpoint: b430c97. O commit documental será posterior; consultar git log -5 e o relatório da conversa para o hash final.
## Funciona e foi validado
- Next/React/TS compilou; 12 testes de motor passaram, também em GitHub CI.
- Logo Imagegen integrada, temas claro/escuro, responsividade, React Bits AnimatedContent com movimento reduzido.
- Catálogo real hospedado, filtros de categoria/loja/preço/desconto, busca sem acento, favoritos, detalhes, fotos, especificações e resumo de avaliações, histórico gráfico, link Ir para loja.
- KaBuM: extração real de HTML __NEXT_DATA__, vendedor próprio (sellerId0, nome KaBuM!, flags marketplacefalse), preço final/estoque/fotos/specs. Não confundir avaliações com vendas.
- Primeira coleta gravou21 produtos; consultas posteriores confirmaram23–27 ativos e13–16 descontos anunciados. Contagens variam; não cristalizar como cobertura permanente.
- Actions executou coleta REAL sem computador: https://github.com/uPedroLima11/baixou/actions/runs/45106844145 (sucesso, ~95s). Pipeline CI45106820698 também sucesso.
- Migrations001–004 aplicadas. RLS declarada para dados privados; falta auditoria end-to-end com dois usuários reais/de teste.
- Auth: domínio, URLs callback/reset e senha mínima10 configurados no Supabase. E-mail exige SMTP próprio: login/cadastro/reset NÃO estão homologados ponta a ponta.
## Estado parcial e bloqueios reais
- SMTP: Nodemailer no servidor, dispatch HMAC via Actions e opt-in implementados; Gmail host465/remetente preparados. Falta senha de aplicativo fornecida diretamente pelo proprietário nos painéis. Nenhum e-mail recebido validado. Ver docs/EMAIL_SETUP.md.
- Alertas atuais nasceram por oferta/categoria. Usuário pediu identidade global do produto (EAN/GTIN/MPN + variantes), novas lojas futuras e dedup de condição. Comparação visual já usa marca+MPN conservador; NÃO equivale a produto canônico global. Ver commits posteriores: esta é prioridade de desenvolvimento se ainda não concluída.
- Melhorias de busca por termos/unidades e agrupamento conservador adicionadas após primeiro deploy; precisam testes adicionais de regressão e novo deploy.
- Usuário pediu UX: selecionar automaticamente ofertas anunciadas se não houver quedas históricas; respeitar seleção manual; destacar controles com contagens e CTA no fim das quedas. Ver commits posteriores; pendente neste checkpoint-base.
- Terabyte: produto/robots403. Pichau: produto/categorias403. Retentativas limitadas, sem bypass. Não marcar integradas.
- LinksBR: não habilitado. Bot Telegram exige acesso ao canal; Discord bot REST requer canal autorizado/intent conforme conteúdo. Não usar self-bot, token pessoal, canal privado, Gateway contínuo em Vercel. Prévia pública Telegram200, robots404; motivo de não ativar coleta externa é termo específico documentado, não hipótese de robots. Não há API/RSS LinksBR publicada encontrada. Não contatamos comunidade.
- Cupons: sinais preservados, nunca subtraídos do preço sem validação. Sem motor checkout de cupons homologado.
- Outras lojas: 40 no cadastro central, pendentes com domínio nulo até investigação. WAZ/Bits/Guerra/Patoloco têm produto+catálogo200 e fixtures, mas SEM adaptador integrado. Gigantec retorna challenge. Ler docs/EXPANSION.md.
## Coletor
- Schedule Actions: a cada5min, best effort. Node22, npm ci, bot oficial quando autorizado, resolver de links, coletor24produtos/fonte/ciclo, notificações no servidor.
- Pausa1,5s entre requests, timeout12s, resposta máx8MB, lista de hosts, robotsfail-closed, lease de execução emPostgres.
- Descoberta prioriza eventos recentes e revalida ofertas antigas; cobertura limitada por ciclo e rotação de categorias. Não promete detectar toda promoção de minutos.
- FalhaHTTP não significa esgotado: TTL30min remove sem confirmação nova. Estoque falso retira após coleta bem-sucedida que detectar.
- Histórico uma observação/hora, retenção35dias. Mediana30dias requer5observações em3dias, exclui última hora; queda mínima5%. Preço riscado é evidência retailer, não history.
- Uma oferta porSKUde loja; URLs canônicas deduplicam comunidades. Attribution preservada emdiscoveries, textoeditorial não armazenado.
## Banco
001_initial.sql: offers, price_history, source_status, profiles, wishlist, alerts, notification_log, Authtrigger, avatarbucket eRLS.
002_discovery.sql: discovery_sources (segredo somentehash), discovery_events, cupons eatribuição. Fontes sociais desativadas por padrão.
003_collector_lease.sql: job_leases eRPCs de claim/release sóservice_role.
004_registry.sql: store_registry,40lojas, constraintFK ampliaoffers.
Migrations foram aplicadas via CLI db query remoto; não supor que a tabela de histórico de migrations do CLI já está preenchida. Não reaplicar001 em banco existente.
## Variáveis — nomes e destinos, sem valores
| Nome | Destino | Situação |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | VercelProduction eGitHubSecrets | configurada |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | VercelProduction | configurada; pública por design, protegida porRLS |
| SUPABASE_SERVICE_ROLE_KEY | VercelSecret eGitHubActionsSecret | configurada; autorização explícita para esses destinos |
| NEXT_PUBLIC_SITE_URL | VercelProduction eGitHubVariable | configurada |
| CRON_SECRET | VercelSecret | configurada; endpoint de coleta curto não agendado para evitar duplicação |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM | VercelProduction | preparados comGmail; conferir último deploy |
| SMTP_PASS | VercelSecret eSupabaseAuthSMTPpassword | FALTA ação do proprietário; jamaischat/Git |
| COLLECT_STORES, COLLECT_MAX_PRODUCTS | Actionsenv | configuradas no workflow |
| OFFER_TTL_MINUTES, NOTIFY_MAX_EMAILS | servidor/worker opcionais | defaults delimitados |
| DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID | ActionsSecret/Variable | ausentes; requer autorização |
Nada de tokens ou senhas no repo. .env*, .vercel, node_modules, work e supabase/.temp ignorados. Varredura de padrões de credenciais e arquivos de ambiente privados foi feita antes de tornar público; repetir antes do handoff final.
## Acessos para Claude
GitHubCLI autenticado no computador do proprietário na sessão desta tarefa. VercelCLI eSupabaseCLI autorizados por login oficial. Credenciais podem expirar; outro agente/máquina não herda essas sessões nem plugins automaticamente.
Preferir CLIs oficiais e secretsjáexistentes. Não revelar service_role para inspecionar. Não remover proteção, ampliar permissões ou contratar plano pago. App hospedado independe dessas sessões.
## Próximos passos em ordem
1. Concluir SMTP_PASS somente nos painéis, verificar envio e recuperação; não considerar pronto antes de receber e-mail real.
2. Implementar/testar produto canônico + alertas cross-store + variantes e dedup; migraralertaslegados com cautela. Não juntar kits2x16com1x32.
3. UXmodalidades com fallback automático, escolha manual, contagens e destaque.
4. Auditoria RLS de dois usuários e teste de favoritos/perfil/alertas/recuperação.
5. Expandir adaptadores pelas4fontes reais candidatas, especialmente identidade e preçoPix, antes de marcaroperacional.
6. VerificarCI+Actions+produção apósqualquerpush; manter logssemsegredos e documentarpêndencias.

