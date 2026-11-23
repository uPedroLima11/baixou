# Expansão do Baixou! — 23/11/2026

## Medição real no Supabase

Snapshot de 23/11/2026 às 10:47:26 (São Paulo), equivalente a 13:47:26 UTC. Contagens mudam com coleta e expiração.

| Fonte operacional | Anúncios detalhados persistidos | Disponíveis dentro do TTL | Com desconto anunciado ou comprovado |
| --- | ---: | ---: | ---: |
| KaBuM! | 113 | 113 | 97 |
| WAZ | 65 | 65 | 4 |
| Guerra Digital | 94 | 58 | 0 |
| Patoloco | 134 | 134 | 122 |
| Total | 406 | 370 | 223 |

Há 828 URLs candidatas e 204 páginas na descoberta progressiva. Candidatas não são produtos validados. Uma consulta posterior confirmou 209 identidades canônicas representadas e 193 anúncios sem identificador forte. Três correspondências reais entre lojas foram revisadas por marca/MPN e variantes: Kingston KF432C16BB1/16 e KF556C40BB-16 entre KaBuM/Guerra Digital; KF432C16BB/8 entre KaBuM/Patoloco. Isso não transforma todos os anúncios em modelos únicos; não usamos título aproximado para fundi-los.

Quedas históricas comprovadas: **zero neste snapshot**. Ainda faltam dias mínimos de observação. As 223 ofertas são descontos anunciados pelas lojas, com preço e estoque consultados, e não 223 quedas comprovadas. Produtos sem desconto continuam monitorados para construir histórico, mas não entram por isso na modalidade de promoções. Diferença de pagamento/parcelamento e AggregateOffer.highPrice não viram preço histórico.

## Categorias com disponibilidade confirmada

Distribuição detalhada da medição anterior, às 10:31:29. Todas as 14 categorias continuavam com estoque ativo às 10:47:26.

| Categoria | Disponíveis | Com desconto |
| --- | ---: | ---: |
| Memória RAM | 24 | 10 |
| Placas de vídeo | 33 | 10 |
| Processadores | 33 | 21 |
| Placas-mãe | 21 | 9 |
| SSDs e HDs | 15 | 12 |
| Monitores | 14 | 13 |
| Cadeiras | 5 | 5 |
| Mouses | 7 | 7 |
| Teclados | 6 | 6 |
| Periféricos, incluindo áudio/headsets | 38 | 34 |
| Computadores completos | 10 | 0 |
| Notebooks | 4 | 3 |
| Kits | 1 | 1 |
| Outros eletrônicos | 37 | 18 |

## Evidência e resultados

- Coletas 45181716254 e 45182440333 gravaram produtos das novas fontes, mas falharam no conjunto devido ao HTTP 403 da Oficina dos Bits. Isso não foi declarado sucesso geral.
- As rodadas seguintes revelaram um ciclo ocioso tratado incorretamente como erro no CLI e uma falha KaBuM cuja mensagem antiga era apenas “Falha”. O ciclo ocioso foi corrigido; mensagens seguras do PostgREST agora são preservadas. Uma revalidação posterior da KaBuM na Vercel respondeu HTTP 200, confirmou dois produtos e descobriu 24 novas URLs, sem falhas. Não atribuímos a falha histórica a estoque ou HTTP 403 sem evidência.
- A rodada 45185654640 terminou com **sucesso nos quatro jobs**, após a remoção da fonte bloqueada e os ajustes de confiabilidade. O relatório de cobertura também rodou no ambiente hospedado.
- Os 38 testes de motor/parsers passaram, assim como TypeScript, build e CI. Incluem vendedor próprio, Pix, mainEntity versus recomendações, indisponibilidade sem preço, marca genérica, identidade/variantes, URL, diversidade e alertas de categoria entre marcas, modelos e lojas.
- Privilégios das filas foram verificados: anon não lê product_candidates; authenticated não lê collection_state; service_role lê. RLS sem política nessas tabelas é uma negação intencional de acesso público.
- Os crons retornaram HTTP 200 e gravaram ofertas. Houve também uma falha de transmissão HTTP/2; ela não foi convertida em esgotamento. Conferir a resposta do pg_net, não apenas o sucesso do SQL do cron.

## Estrutura e limites

A fila persiste páginas e URLs, mantém cursores, alterna revalidações com novidades diversas e aplica backoff por erro. Cada loja possui lease próprio. O Actions executa uma matriz das quatro fontes a cada 30 minutos. O worker da Vercel agrupa as quatro lojas em uma invocação a cada 15 minutos, com até dois detalhes por fonte. Descoberta de categorias pelo fallback ocorre após 30 minutos sem descoberta recente. Os leases e filas continuam separados.

Os limites são orçamento, não garantia: até 50 detalhes em quatro minutos por job Actions; 8 MB por resposta, timeout de oito segundos e pausa de 1,5 segundo por domínio; 2.000 candidatos por loja. TTL regular de 60 minutos e 15 minutos para queda histórica forte. Falha não renova TTL. Logs de execução têm retenção de sete dias; histórico mantém a retenção anterior de 35 dias, sem apagar favoritos ou alertas.

O lote reduzido confirmou sete verificações nas quatro lojas sem falhas, em 9,8 segundos de duração e 2,1 segundos de CPU. O ciclo curto individual anterior validava em geral cinco a oito produtos; latência, estoque e erros podem diminuir esse número. Compare revalidações por hora com o tamanho do conjunto monitorado. Não ampliar TTL para esconder atraso nem apagar favoritos para aliviar a coleta. Ofertas vencidas saem do catálogo, mas o produto salvo e seus alertas permanecem.

## Bloqueadas e alternativas

- **Oficina dos Bits:** adaptador e fixtures reais, mas duas categorias retornaram HTTP 403 no GitHub runner. Foi removida da rotina. Aguarda feed/acesso autorizado; sem troca de IP, challenge automatizado ou API privada como contorno.
- **Terabyte, Pichau e Gigantec:** bloqueios/challenge já documentados. Não repetir 403 a cada ciclo. Programas de parceiros não provam acesso a um feed consumidor.
- **Amazon:** Creators API exige conta elegível. **Mercado Livre/Magalu:** APIs de seller não equivalem a catálogo global. **Shopee/AliExpress:** dependem de conta, aprovação e documentação vigente. Fontes oficiais e condições estão em docs/PRIMARY_SOURCES.md. Nenhuma foi declarada operacional nesta etapa.

## Reproduzir e continuar

Execute npm run collect:report em um ambiente autorizado com as variáveis Supabase do worker. Ele consulta dados reais e escreve o resumo Markdown do Actions. Não exportar Secrets para inspecionar; o funcionamento hospedado não depende do computador do proprietário.

Próximos passos: acompanhar idade/capacidade e franquia, ampliar fontes com acesso real e aprimorar identidade/especificações conservadoras. Alertas de queda histórica não podem ser homologados usando histórico fictício. Novas credenciais de afiliados, caso o proprietário já possua acesso autorizado, devem ser inseridas somente nos serviços apropriados.

## Orçamento medido e recuperação

A primeira versão em lote consumiu 4.167 ms de CPU. Reduzimos o volume e evitamos repetir categorias recentes: a amostra final consumiu 2.061 ms de CPU e 9.811 ms de duração. Mantido esse perfil base a cada 15 minutos por 30 dias, seriam aproximadamente 1,65 hora de CPU; descoberta periódica, recuperação e tráfego público acrescentam consumo. É projeção de amostra, não franquia garantida. A referência oficial é a [precificação de Functions](https://vercel.com/docs/functions/usage-and-pricing): Hobby inclui quatro horas de CPU ativa e 360 GB-h de memória. Não foi contratado serviço pago.

O pg_net apresentou erro intermitente de transmissão HTTP/2. A tentativa seguinte retornou HTTP 200 e executou o worker. Há uma recuperação condicional dois minutos após cada lote principal: ela só envia se nenhum worker começou nos últimos cinco minutos. A execução manual do lote e o transporte pg_net foram testados; acompanhar as execuções futuras e os resultados efetivos por fonte.

Os crons individuais antigos estão inativos. Não reativá-los junto do lote. O relatório e o HANDOFF registram os limites em vez de prometer coleta infinita ou captura de toda promoção de poucos minutos.
