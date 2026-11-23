# Templates de e-mail do Supabase Auth

Treze mensagens em português com a identidade Baixou!: seis fluxos de acesso e sete avisos de segurança. HTML com tabelas, estilos inline, preheader e links de fallback. `manifest.json` registra os assuntos e os arquivos. Os `.txt` são cópias para revisão: a configuração documentada do Supabase Auth não oferece campo separado de texto simples; não afirmar que esse MIME foi aplicado. Os alertas Nodemailer têm implementação HTML/text própria.

## Preparação e aplicação hospedada

`npx tsx scripts/auth-email-config.ts` valida o manifesto e mostra somente os nomes dos campos. Com `--json`, produz o payload público dos templates. Não lê chaves nem faz requisições. O destino autorizado é exclusivamente `slmhkfqqeyptngjubfhn`.

Aplicar esse payload por **PATCH** em `https://api.supabase.com/v1/projects/slmhkfqqeyptngjubfhn/config/auth`, usando a autenticação de gestão existente em um ambiente autorizado, sem imprimir/exportar a credencial. O payload contém somente `mailer_subjects_*` e `mailer_templates_*_content`: não inclui SMTP, flags de envio, confirmação, URLs, hooks ou secrets. Não usar um `config push` amplo para publicar esses templates. O arquivo `config.toml` associa os seis templates de acesso ao ambiente local; os arquivos por si só não comprovam publicação hospedada.

Preservar as configurações atuais das notificações de segurança: preparar seu conteúdo não as habilita. Após o PATCH, comparar exclusivamente os campos esperados com o conteúdo local e registrar a contagem conferida, sem exibir a resposta completa de configuração. Qualquer backup precisa conter somente esses campos, não o objeto Auth inteiro.

## Homologação sem revelar tokens

1. Conferir os templates por conteúdo/assunto antes de qualquer envio; a validação de template não demonstra entrega.
2. A recuperação/confirmação usa `{{ .ConfirmationURL }}` original, preservando os destinos configurados pela chamada de Auth. Não fabricar URLs/token_hash ou registrar o link renderizado.
3. Se autorizado, solicitar recuperação apenas para a conta do proprietário. Registrar horário, assunto e resultado de aceitação/recebimento. Não copiar o link/código para logs ou relatório. O proprietário deve concluir qualquer alteração de senha.
4. Confirmação de novo cadastro exige uma conta/caixa autorizada própria para esse fluxo. E-mail de recuperação recebido não homologa cadastro.
5. Não provocar troca de e-mail, senha, telefone ou MFA só para disparar avisos. Permanecem preparados, sem homologação desses eventos até ocorrer um caso autorizado real.

Fontes oficiais consultadas em 23/11/2026: [variáveis e edição hospedada](https://supabase.com/docs/guides/auth/auth-email-templates), [configuração local](https://supabase.com/docs/guides/local-development/customizing-email-templates) e [PATCH parcial de configuração](https://supabase.com/docs/reference/api/v1-update-auth-service-config).

## Estado hospedado (23/11/2026, Claude Code)

- Aplicados ao projeto `slmhkfqqeyptngjubfhn` os **seis templates de acesso** (confirmation, recovery, invite, magic_link, email_change, reauthentication: assunto + HTML) via `npx supabase config push --remote=slmhkfqqeyptngjubfhn`. O CLI 3.x mostrou o diff antes (somente esses 12 campos) e deixa propriedades não declaradas (SMTP, limites, MFA, OTP) inalteradas; `config diff` posterior não mostra nenhuma diferença declarada. `config diff` não compara `content_path`; o `config push` sim.
- Os sete avisos de segurança continuam apenas preparados (não declarados em config.toml, portanto nem conteúdo nem habilitação foram alterados).
- Recuperação/cadastro com o novo visual ainda dependem de recebimento confirmado pelo proprietário.
