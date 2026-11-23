# Arquitetura
## Dados e evidência
store_registry: cadastro central público de lojas, status operacional/parcial/bloqueado/pendente, domínio e produto de teste. Pending não é integração. Domínios só são preenchidos depois de confirmar fonte oficial.
offers: uma oferta por SKU de loja (não por texto de comunidade); upsert preserva IDs. price_history: observações reais, no máximo uma por hora, retenção 35 dias. A mediana usa 30 dias, mínimo 5 observações em 3 dias, exclui última hora.
Cartões agrupados somente quando marca e MPN coincidem com segurança; manter cada loja e preço no banco e na comparação do detalhe. Sem juntar variantes por título parecido.
source_status: saúde de cada tentativa. Uma falha não marca estoque esgotado: TTL retira ofertas antigas sem nova confirmação. Estoque falso retira na primeira coleta bem-sucedida que o detectar.
## Descoberta extensível
discovery_sources controla autorização e tipo; discovery_events recebe URL, data, ID externo e cupom sugerido. Não armazenar texto editorial. Um link é um candidato, nunca um cartão.
Telegram webhook oficial: segredo verificado por hash, channel_id autorizado, post/edição recente; LinksBR desativado até acesso e condições resolvidos.
Discord: polling REST oficial com token de BOT e canal explicitamente permitido. Sem self-bot, conta pessoal ou Gateway persistente. Fonte desativada por padrão.
Webhook genérico: segredo, validação Zod, limites de tamanho e taxa, idempotência; somente fontes habilitadas pelo operador.
Resolver: HTTPS, hosts conhecidos, máximo 6 saltos, DNS validado/pinado em cada salto, rejeição de rede privada e credenciais em URL. Não seguir destinos arbitrários. URLs afiliadas de origem permanecem no registro privado para atribuição; o URL canônico é usado no upsert. Não trocar afiliado de terceiros por código próprio.
Worker resolve pendentes, prioriza sinais recentes, consulta produto no adaptador da loja e somente então publica dados extraídos da loja. Preserva atribuição no campo discoveries. Cupons ficam não validados e nunca entram no preço final sem confirmação da condição.
## Hospedagem
Vercel Hobby: aplicação React/Next, APIs de leitura e endpoints autenticados; nenhuma dependência de computador ligado.
Supabase Free: Postgres, Auth, Storage avatars e RLS. Chave anon/publishable é pública por projeto; service_role e senhas jamais no frontend, Git ou logs.
GitHub Actions em repositório PÚBLICO, conforme decisão final do usuário: coleta padrão a cada cinco minutos (best effort), revisão/build no push. Sem garantia de pontualidade. Limites de requisições/ciclo, pausa entre requests e lease impedem execução concorrente. Instalação/cache/timeout mantêm uso delimitado. Se retornar ao privado, reduzir o schedule antes para respeitar franquia.
Vercel /api/jobs/collect é uma alternativa curta protegida, não foi agendada no Supabase por padrão para não duplicar varreduras.
## Expansão
Um adaptador deve fornecer descoberta, identidade (SKU/MPN/marca), preço, pagamento, estoque, vendedor, imagens, especificações e evidência de reviews/vendas quando presentes. Só marcar operacional após teste real no ambiente hospedado. API oficial/feed elegível preferível a HTML. Marketplaces precisam política de vendedor e anúncio, não basta domínio.
A lista de prioridades do usuário é cadastro de planejamento, não cobertura anunciada. Fontes: Pelando, Promobit, Buscapé, Zoom, Google Shopping, PCFinder e LinksBR dependem de mecanismo legítimo e teste; endpoints internos não são tratados como APIs oficiais.

