# Gmail SMTP — configuração existente preservada

Em23/11/2026, o teste hospedado confirmou conexão TLS/autenticação Nodemailer e aceitação pelo Gmail. O proprietário confirmou recebimento da mensagem de teste e da recuperação de senha, e abertura do formulário noBaixou!. Senha não foi alterada pelo agente. Novo cadastro com uma segunda caixa ainda não foi homologado.

- Não refazerSMTP. HostGmail porta465 continua configurado naVercel eSupabaseAuth.
- Domínio padrão https://baixouofertas.vercel.app ; callbacks/reset atualizados sem sobrescrever as propriedadesSMTP remotas.
- WorkerGitHub chama/api/jobs/notifications comHMAC+timestamp. SenhaGmail sóVercel/SupabaseAuth, nuncaGitHub/chat/código.
- Diagnóstico hospedado assinado permiteverify eenvio somenteaoSMTP_USER; não exportarSecrets para inspecionar. vercel env run não baixaSecrets.
- Ao trocarGmail, o proprietário atualizaSMTP_USER/SMTP_FROM/SMTP_PASS naVercel e camposcorrespondentes doSupabaseAuth; fazerredeploy. Nuncaenviarsenhapelochat.
- Alertas exigemopt-in/emailconfirmado, estoqueativo echecagemrecente. Preferências persistemapósexpiração. Retençãohistory35dias éindependente dosfavoritos.
- Ainda testar: notificação real produzida porregra depreçoatingida (não forçarpreçofictício), cancelamento e cadastro emsegundacaixa. Recebimentoda mensagemdiagnóstica nãoequivaleahomologar todosessesfluxos.
