# Estado em 27/11/2026 01h UTC
- Liberado para todos (WHATSAPP_MODE=on). Disparo automático: pg_cron baixou-alerts (1/min) + coletas; ciclo conecta só com fila/código/≥15 min ocioso. Latência medida: 7 s e 32 s da verificação ao recibo de entrega. Pendente: números internacionais; homologar código novo, alerta de cartão e recuperação (ver CONTINUIDADE_CODEX.md).

# Atualização 27/11/2026 (madrugada) — confirmação por código enviado pelo Baixou!

- Fluxo do usuário: número com DDD + autorização → **Enviar código** → o remetente confere se o número tem WhatsApp (`onWhatsApp`, grava o JID real) e envia "🔐 Baixou! Seu código de confirmação é: NNNNNN…" → o usuário digita o código no site → confirmado e ativado. O fluxo antigo (usuário enviar "BAIXOU código") deixou de ser oferecido; o processamento de PARAR continua.
- Proteções: código com hash por usuário, 10 min, uso único, 5 tentativas; 60 s entre pedidos, 3/h e 6/dia por usuário; número já confirmado em outra conta recusado; máximo 40 códigos/h no sistema; tentativa registrada antes do envio; remetente desconectado/ocupado/número sem WhatsApp informados na tela. Nenhum alerta antes da confirmação. Pedido para o mesmo número já confirmado não rebaixa a confirmação.
- Administração em tela própria ("Administrar WhatsApp" no menu da conta, só `WHATSAPP_ADMIN_USERS`; `/api/whatsapp/sender` recusa os demais no servidor): status, número, última conexão, pareamento, ciclo manual, desconectar, envios 24 h/7 dias, falhas recentes e diagnóstico.

# Alertas pelo WhatsApp — remetente central (Claude Code, 27/11/2026)

O proprietário recusou o CallMeBot (cada usuário teria de criar uma chave). Ele foi **removido**. Modelo atual: um número remetente do Baixou!, pareado uma única vez pelo proprietário; o usuário só informa o número e confirma.

## Comparação (27/11/2026)

| Opção | Centralizado | Custo / onde roda | Situação |
| --- | --- | --- | --- |
| Meta Cloud API (oficial) | Sim | Cobrança por mensagem (templates utility cobrados desde 01/10/2026), exige forma de pagamento | Descartada (custo) |
| Evolution API / WAHA / WPPConnect | Sim | Precisam de processo ligado 24/7 com sessão persistente; não há hospedagem gratuita sem cartão (Render dorme/disco efêmero, Koyeb/Fly pedem cartão, HF Docker pago) | Descartadas (infraestrutura) |
| n8n Community | — | Só orquestra; precisaria de um dos gateways acima e de servidor | Descartado |
| Whapi / Green-API / TextMeBot | Sim | 3–5 conversas/mês grátis ou pagos | Descartados |
| CallMeBot | **Não** (chave por usuário) | Grátis | Removido a pedido do proprietário |
| **Baileys (biblioteca oficial da WhiskeySockets, v7.0.0-rc14) em ciclos curtos na Vercel** | **Sim** | Grátis: funções que já rodam a cada ~15 min (pg_cron do Supabase e Actions) abrem a sessão por segundos, enviam e fecham; sessão criptografada no Supabase | **Implementado** |

Evolution/WAHA usam o mesmo protocolo de "aparelho conectado" por baixo; usar a biblioteca diretamente elimina o servidor.

## Requisitos e riscos reais (explicados ao proprietário antes de parear)

1. **Número remetente**: um WhatsApp ativo em um celular. Recomendado um **número dedicado** (chip pré-pago/eSIM) com WhatsApp ou WhatsApp Business. Usar o número pessoal funciona, mas um eventual bloqueio atingiria o número pessoal.
2. **Celular do remetente**: precisa abrir o WhatsApp com internet pelo menos a cada ~14 dias; senão o WhatsApp desconecta os aparelhos conectados. A tela de administração mostra "Desconectado pelo celular" e basta parear de novo.
3. **Regras do WhatsApp**: clientes não oficiais e automação não são permitidos pelos termos; existe risco de bloqueio do número. Mitigações: só escrevemos para quem nos escreveu primeiro (confirmação "BAIXOU código"), volume baixo, 2–4 s entre mensagens, sem grupos, sem mídia, "PARAR" atendido na hora.
4. **Latência**: sem servidor ligado, a entrega acontece no próximo ciclo (normalmente até ~15 min; mensagens com mais de 60 min na fila vencem para não avisar preço velho). Confirmação do número: na hora em que o usuário toca "Já enviei, conferir".
5. **Biblioteca**: Baileys segue em release candidate (rc14, julho/2026); mudanças do WhatsApp podem exigir atualizar a dependência.

## Fluxo

- **Proprietário (uma vez)**: Conta → Notificações → "Remetente do Baixou! no WhatsApp" → número remetente → "Gerar código de pareamento" → no celular remetente: Aparelhos conectados → Conectar aparelho → Conectar com número de telefone → digitar o código (≈2 min). O código só aparece nessa resposta autenticada (nunca em log, banco ou Actions público).
- **Usuário**: informa o celular com DDD e marca a autorização → toca "Abrir o WhatsApp e enviar" (link `wa.me` com `BAIXOU <código>`) → envia → "Já enviei, conferir". O código vale 30 min, 5 tentativas, 3 códigos/h e 6/dia. A mensagem precisa vir **do número informado** (PN do WhatsApp; LID resolvido pela própria sessão; 9º dígito tratado). Depois: pausar, alterar, remover; responder PARAR desativa na hora.

## Arquitetura

- `lib/notifications.ts`: **mesma decisão** do e-mail (`notificationReason`). Para o WhatsApp, reserva (`claim_notification(..., 'whatsapp')`) e coloca a mensagem pronta na fila (`notification_log.status='queued'`, `body`). E-mail e WhatsApp têm reserva, deduplicação e falhas independentes.
- `lib/whatsapp-session.ts`: `withWhatsApp` (lease exclusivo `whatsapp`, abre, aguarda 2,5 s por mensagens pendentes, executa, fecha), `processInbox` (BAIXOU/PARAR), `deliverQueue` (até 15 por ciclo, `accepted` com aceite do servidor, `delivered` só com recibo observado, `sending` antigo → `unknown` sem reenvio, fila >60 min → vencida), `whatsappPulse` (só conecta com fila, confirmação aguardando, ou a cada 2 h para manter a sessão e receber PARAR), `startPairing`, `unlinkSender`.
- Chamado por `/api/jobs/notifications` (Actions, após cada coleta) e `/api/jobs/collect` (pg_cron do Supabase, independe do GitHub) no tempo que sobrar.
- Sessão: `whatsapp_auth` com valores AES-256-GCM (chave `WHATSAPP_STATE_KEY`, só na Vercel, sensível) e ids HMAC (sem número em texto claro). `whatsapp_sender`, `whatsapp_auth` e `whatsapp_contacts`: RLS ligado, sem privilégio para anon/authenticated.
- Desconexão pelo celular (401) apaga a sessão e marca `logged_out`; e-mail segue normal.

## Configuração

- Vercel (Production): `WHATSAPP_MODE` (off/test/on), `WHATSAPP_TEST_USERS`, `WHATSAPP_ADMIN_USERS` (proprietário), `WHATSAPP_STATE_KEY` (sensível; se perdida, basta parear de novo). Repositório: `vars.WHATSAPP_MODE`/`WHATSAPP_TEST_USERS` (os jobs do Actions só chamam a rota da Vercel).
- Diagnóstico sem conexão: `POST /api/jobs/notifications?check=whatsapp` com a mesma assinatura HMAC das demais ações (escopo `whatsapp:`).
- Liberar `on` só depois do envio controlado documentado no HANDOFF.

## Mensagens recebidas entre os ciclos (27/11/2026)

- O número remetente é um "aparelho conectado". Enquanto a sessão está fechada, o servidor do WhatsApp guarda as mensagens destinadas a esse aparelho e as entrega quando ele reconecta (dentro do período em que o aparelho continua vinculado; o celular precisa abrir o WhatsApp a cada ~14 dias).
- No Baileys 7 (Socket/socket.js), ao conectar os eventos ficam retidos até o nó `ib/offline`, que marca o fim das pendências; então são liberados como `messages.upsert` ("append") e é emitido `receivedPendingNotifications: true`. O ciclo espera esse sinal (até 12 s) antes de processar a caixa de entrada; o que chegar depois é lido no fim do mesmo ciclo ou no seguinte.
- Confirmação "BAIXOU código": o botão "Já enviei, conferir" abre um ciclo na hora; além disso, enquanto houver código aguardando, todo ciclo de alertas (a cada poucos minutos) conecta e confere. O código vale 30 min.
- PARAR: cada ciclo processa a caixa de entrada ANTES de enviar a fila, então nenhuma mensagem sai depois de um PARAR já recebido pelo servidor. Sem outros eventos, a sessão abre pelo menos a cada 2 h e responde ao PARAR. O botão da tela desativa na hora.
- Latência dos alertas: a decisão coloca a mensagem na fila e a mesma execução (rota de alertas da Vercel) abre a sessão e envia em seguida — na prática o mesmo tempo do e-mail. Mensagem com mais de 60 min na fila vence (preço pode ter mudado).
- Prioridade de rechecagem (`due_rechecks`) agora considera alertas/favoritos de quem recebe por WhatsApp, não só por e-mail.

## Roteiro do proprietário

1. Ter um WhatsApp ativo no número remetente (recomendado chip dedicado) em um celular.
2. Entrar em https://baixouofertas.vercel.app com a conta do proprietário → menu da conta → **Notificações** → seção **"Remetente do Baixou! no WhatsApp"** (só aparece para `WHATSAPP_ADMIN_USERS`).
3. Digitar o número remetente com DDD → **Gerar código de pareamento**. No celular do remetente: WhatsApp → **Aparelhos conectados** → **Conectar aparelho** → **Conectar com número de telefone** → digitar o código de 8 caracteres (≈2 min). A tela mostra "Conectado".
4. Primeiro teste: na mesma página, seção **"Alertas pelo WhatsApp"**, informar o SEU número pessoal (diferente do remetente), marcar a autorização → **Continuar** → **Abrir o WhatsApp e enviar** (mensagem "BAIXOU código" para o remetente) → **Já enviei, conferir**. Você recebe "✅ Número confirmado".
5. Envio real: criar/usar um alerta que uma oferta atual atenda (Pix ou cartão) → no máximo um ciclo depois chegam e-mail e WhatsApp. Responder **PARAR** desativa.

## Homologação (preencher no HANDOFF)
Confirmação do número · alerta real · alerta de cartão · e-mail + WhatsApp simultâneos · nenhuma duplicata (notification_log por canal) · PARAR · recuperação da sessão (aguardar >2 h e conferir que o ciclo reconecta; desconectar pelo celular → painel mostra "Desconectado pelo celular", e-mail segue). Só então `WHATSAPP_MODE=on`.
