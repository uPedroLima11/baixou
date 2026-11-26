# Alertas pelo WhatsApp (Claude Code, 26/11/2026)

## Decisão: CallMeBot com chave de cada usuário

Pesquisa de 26/11/2026 (fontes conferidas nesta data):

| Opção | Custo / infraestrutura | Manutenção | Situação |
| --- | --- | --- | --- |
| API oficial (Meta Cloud API) | Cobrança por mensagem; templates utility também cobrados desde 01/10/2026; exige forma de pagamento | Baixa | **Descartada** (custo) |
| Baileys / WAHA / Evolution API / WPPConnect | Processo ligado 24/7 com sessão (sem hospedagem gratuita sem cartão: Render dorme, Koyeb/Fly pedem cartão, HF Docker pago) ou job curto no Actions com sessão no banco | Chip dedicado; celular remetente precisa abrir o WhatsApp a cada 14 dias; risco de banimento (cliente não oficial, IP de datacenter variável) | **Descartada** (viola regras da plataforma, chip, manutenção) |
| n8n Community | Precisa de servidor e, por baixo, de um dos gateways acima | Alta | **Descartada** |
| TextMeBot / Whapi sandbox / Green-API Developer | Pago após teste, ou 3–5 conversas/mês | — | **Descartadas** |
| **CallMeBot (chave por usuário)** | Gratuito; um GET HTTPS por alerta, feito pela Vercel/Actions que já existem | Nenhum servidor, nenhum número remetente, nenhum QR Code | **Implementada** (experimental) |

Por que é a mais simples: o próprio usuário ativa o bot no WhatsApp dele (mensagem `I allow callmebot to send me messages`) e recebe uma chave. A chave só envia para o número que a ativou — consentimento e posse comprovados pelo provedor. O Baixou! ainda confirma com um código de 6 dígitos.

Riscos conhecidos (não esconder do usuário):
- Termos do CallMeBot dizem "Free API only for personal use" e "send messages to yourself". Cada usuário envia para si mesmo com a própria chave, mas o uso por um app multiusuário é zona cinzenta. Recomenda-se que o proprietário pergunte ao autor (Telegram @callmebot_com) antes de liberar para todos. Nenhuma mensagem foi enviada ao CallMeBot em nome do proprietário.
- A página do CallMeBot pode informar que o bot está lotado para ativações novas (espera de dias).
- Serviço de uma pessoa, sem SLA; o número do bot pode mudar ou ser banido. Só texto (sem imagem do produto).
- Terceiro recebe o número e o texto do alerta (consentimento explícito na tela).

## Arquitetura

- `lib/whatsapp.ts`: normalização de celular BR com DDD, máscara, código (hash SHA-256 por usuário, 10 min, 5 tentativas, 3 códigos/h e 6/dia), mensagem curta e classificação da resposta do provedor. A URL do provedor contém a chave e nunca é registrada.
- `lib/notifications.ts`: **mesma decisão** (`notificationReason`: preço máximo, queda R$/%, categoria, marcas, specs, favoritos limitados por alertas ativos, alerta pausado não carregado, oferta verificada há ≤5 min e no TTL). Depois da decisão, um laço por canal: e-mail e WhatsApp têm reserva (`claim_notification(..., p_channel)`), deduplicação (`notification_state` por canal) e falhas independentes. Falha/limite do WhatsApp nunca bloqueia o e-mail e vice-versa; o WhatsApp funciona mesmo sem SMTP.
- `notification_log.status='accepted'`: o provedor só confirma que aceitou a mensagem, nunca a entrega. Não tratar como entregue.
- Falha permanente (chave/número recusados) ou 5 falhas seguidas → contato `status='error'`, canal suspenso até o usuário reconfirmar. Falha temporária → mesma política de nova tentativa do e-mail (até 3, espera crescente); envio interrompido vira `unknown` e não é reenviado.
- Ritmo: ≥2,5 s entre mensagens; teto por execução `NOTIFY_MAX_WHATSAPP` (padrão 10; lote Vercel = 1); um aviso por usuário/produto/dia/canal e só novo aviso abaixo do último preço avisado nesse canal.
- `whatsapp_contacts`: RLS ligado e **nenhuma** política/privilégio para anon/authenticated. A tela usa `/api/whatsapp` (JWT conferido no servidor), que devolve só o número mascarado e nunca a chave. Remover apaga número e chave na hora.
- UI: Notificações → "Alertas pelo WhatsApp" (cadastrar, confirmar, pausar, alterar, remover). Lista de desejos/limites valem para os dois canais.

## Liberação (`WHATSAPP_MODE`)

- `off` (padrão, também se ausente): nenhum envio e a seção não aparece.
- `test`: só os IDs de usuário em `WHATSAPP_TEST_USERS` (separados por vírgula) veem a seção e recebem.
- `on`: todos os usuários.
- Configurar igual na Vercel (Production) e nas variáveis do repositório (`vars.WHATSAPP_MODE`, `vars.WHATSAPP_TEST_USERS`), porque os alertas saem dos dois lugares. Não há segredo novo.

## Homologação

- Sem envio externo: `tests/whatsapp.test.ts` (telefone, código, liberação, classificação aceito/recusado, mensagem com valores reais, RAM DDR4 16 GB ≤ R$ 850 dispara a 799,99 e não a 850,01, título malicioso sem formatação/link extra) e o teste SQL em transação revertida (`work/channel-isolation.sql`, local): reserva de e-mail e WhatsApp do mesmo produto independentes, duplicata bloqueada, falha só no WhatsApp com e-mail `sent`, nova tentativa e status final `accepted`, estado de deduplicação por canal.
- Envio controlado real: **depende do proprietário** ativar o CallMeBot no próprio número (passos acima) e confirmar o código na tela. Ver HANDOFF para o estado atual.
- Custo recorrente: nenhum (sem conta, plano, servidor ou chip).
