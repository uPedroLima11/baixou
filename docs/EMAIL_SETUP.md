# Gmail SMTP — completar sem compartilhar senha
## Estado
Nodemailer implementado no servidor Vercel. Host SMTP, porta, usuário e remetente foram configurados no ambiente Production com o endereço fornecido pelo proprietário; nenhum valor de credencial fica neste documento.
O worker GitHub chama /api/jobs/notifications com HMAC e timestamp. Não precisa copiar a senha Gmail para GitHub Actions. SMTP_PASS ausente retorna configured:false e não envia mensagens.
Supabase Auth fornece confirmação de cadastro e recuperação de senha. URLs de retorno já configuradas. Envio real dessas mensagens depende do SMTP customizado.
**Nenhum envio de email foi validado ainda. Falta a senha de aplicativo. Não marcar completo até enviar e receber mensagem real e testar recuperação.**
## Ação do proprietário
1. Ativar a verificação em duas etapas na conta Google, caso ainda não esteja ativa, e gerar uma senha de aplicativo chamada Baixou!: https://myaccount.google.com/apppasswords . Requisitos oficiais: https://support.google.com/mail/answer/185833?hl=pt-BR .
2. No projeto Baixou! da Vercel, Settings > Environment Variables, adicionar SMTP_PASS para Production como Secret/Sensitive. Colar a senha de app apenas ali, nunca no chat, Git, arquivo de documentação ou issue. Host/porta/remetente já foram preparados.
3. No Supabase, abrir o projeto dedicado Baixou! (slmhkfqqeyptngjubfhn), Authentication > Email > SMTP Settings (a navegação pode variar). Ativar custom SMTP, host smtp.gmail.com, porta465, username o Gmail remetente, password a MESMA senha de app, sender email o Gmail e sender name Baixou!. Confirmar os campos preparados antes de salvar. Referência oficial: https://supabase.com/docs/guides/auth/auth-smtp .
4. Fazer redeploy da Vercel após adicionar SMTP_PASS. Não é necessário baixar ou executar o sistema localmente.
5. Avisar o agente sem informar a senha. O agente deve verificar a configuração e realizar um envio real autorizado para o proprietário; depois testar confirmação e recuperação de senha.
## Validação de aceite
- Nodemailer transport.verify() bem-sucedido, sem imprimir detalhes de autenticação.
- E-mail recebido (SMTP aceito não comprova entrega).
- Cadastro com confirmação e reset de senha abrem no domínio público correto.
- Preferência email_enabled respeitada, só usuário confirmado recebe avisos.
- Alertas repetidos não disparam cópias; cancelamento /cancelar funciona.
- Modelo de alerta entre lojas e melhorias de deduplicação: conferir estado no HANDOFF.
- Revogar senha de app ao desativar o projeto. Ao trocar remetente, atualizar Vercel e Supabase Auth.

