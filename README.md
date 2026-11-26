# Baixou!
Catálogo brasileiro de ofertas de tecnologia, com validação na loja, histórico próprio e alertas.
- Produção: https://baixouofertas.vercel.app
- Código: https://github.com/uPedroLima11/baixou
- Diretório de trabalho atual: D:\PROJETOS\baixou
**Comece por AGENTS.md e docs/HANDOFF.md. Não é necessário reconstruir a arquitetura.**
## Stack
Next.js 16 / React 19 / TypeScript, Supabase Postgres + Auth + Storage, Nodemailer, GitHub Actions e Vercel Hobby. React Bits AnimatedContent/GSAP com licença incluída.
O sistema hospedado não depende do computador do usuário. Comandos locais servem somente ao desenvolvimento e publicação.
## Desenvolvimento
Node 22+, npm.
~~~sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev
~~~
Copie apenas os nomes de .env.example para um arquivo ignorado se precisar testar integração. Nunca publique .env. O frontend usa chave pública anon; service_role é exclusivamente servidor/Actions.
## Operação
~~~sh
npm run collect:check
npm run collect:report
npm run pricing:audit
npm run discover:social
npm run discover
npm run collect
npm run notifications
gh workflow run collect.yml --repo uPedroLima11/baixou
gh run list --repo uPedroLima11/baixou --limit 5
npx vercel deploy --yes --prod --scope upedrolima11s-projects
~~~
collect:check consulta lojas reais sem gravar no banco. As demais rotinas de banco exigem segredos nos ambientes autorizados.
## Banco e publicação
Migrations em supabase/migrations; 001–005 e migrations com timestamp de alertas/agendamento aplicadas no projeto dedicado Baixou!. Consulte o HANDOFF antes de executar. Não reaplicar arquivos aplicados: não são todos idempotentes. Nunca operar no outro projeto da conta.
~~~sh
npx supabase db query --remote=slmhkfqqeyptngjubfhn --file supabase/migrations/NOVA.sql --yes
npx supabase config diff --remote=slmhkfqqeyptngjubfhn
npx supabase config push --remote=slmhkfqqeyptngjubfhn --yes
~~~
Usar CLI oficial autenticado; Claude pode precisar que o usuário reautorize. Nunca colocar tokens em argumentos, Git ou documentação.
## Cobertura
Sete fontes diretas com coleta hospedada comprovada: KaBuM!, WAZ, Guerra Digital, Patoloco, iByte, ChipArt e Shopinfo. Mercado Livre possui cobertura parcial por vitrines de lojas oficiais. Pichau e Terabyte publicam preços anunciados pelos canais das lojas no Telegram, com página/estoque não conferidos, separados de preços verificados, Score e alertas. Amazon permanece sem fonte utilizável comprovada nas condições de custo zero e sem cadastro. Oficina dos Bits está bloqueada no runner. Estado atual, métricas e limitações em docs/HANDOFF.md.

## Documentação
- docs/HANDOFF.md: estado real, acessos, testes e continuidade.
- docs/ARCHITECTURE.md: pipeline, evidência, segurança e expansão.
- docs/EMAIL_SETUP.md: Gmail existente e validações de envio/recuperação, sem credenciais.
- docs/COLLECTOR_RESEARCH.md e docs/PRIMARY_SOURCES.md: pesquisa já feita.
- docs/DISCOVERY_RESEARCH.md: LinksBR, Discord e Telegram.
- docs/EXPANSION.md: dezenas de lojas planejadas e quatro novos candidatos testados por HTTP.


## Comparação e navegação
Catálogo completo inclui produtos válidos sem desconto. Departamentos utiliza categorias e facetas reais, compartilhadas com filtros e alertas. A ordenação inicial prioriza relevância/evidências, sem pontuar preço riscado.

Abaixo das lojas comparadas é uma amostra parcial de vendedores monitorados, não garantia de menor preço do mercado. A mediana exige o mesmo produto e dois outros vendedores independentes, pagamento equivalente e referências válidas. Preço riscado da loja não comprova preço normal nem queda histórica. A auditoria somente leitura `npm run pricing:audit` mede a API publicada sem credenciais de servidor.

Estatísticas recorta DDR4/DDR5 desktop a partir de 8 GB (módulos e kits separados) e GPUs GeForce RTX/Radeon RX recentes; outros produtos continuam no catálogo. Gráficos usam apenas pontos reais. O histórico anunciado das lojas pode mostrar 120 dias e nunca é misturado ao histórico verificado.
