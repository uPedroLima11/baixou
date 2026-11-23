# Estado de execução

## Objetivo
Catálogo de promoções reais brasileiro Baixou!, hospedado em Vercel + Supabase e coleta independente via GitHub Actions. Nenhuma rotina deve depender do computador do usuário.

## Infraestrutura encontrada
- Diretório novo e repositório Git local iniciado.
- GitHub CLI tem conta uPedroLima11, porém token inválido (verificado sem expor token).
- Nenhuma variável Vercel/Supabase disponível. Conexões sugeridas ao usuário.
- Não foi criado repositório remoto, banco ou deployment ainda.

## Decisões
- Comparação com mediana histórica precisa de observações anteriores reais; antes disso, preço riscado da loja é somente desconto anunciado.
- Estoque removido na próxima coleta bem-sucedida; dados sem nova confirmação expiram. Nada promete detecção instantânea.
- Supabase Auth para senha, confirmação, recuperação; SMTP personalizado precisa ser configurado no Auth e no worker com a mesma conta.
- Vercel Hobby não oferece cron de cinco minutos. Coletor em GitHub Actions: agendamento sujeito a atraso e quota. Começar em 15 minutos, reduzir apenas após validar orçamento/robots.

## Próximas atualizações
Este arquivo será atualizado após implementação e validação. Consulte commits Git para etapas completas.
