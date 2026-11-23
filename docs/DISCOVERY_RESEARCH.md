# Descoberta de ofertas — LinksBR

Pesquisa em 23/11/2026. Escopo: somente leitura pública e documentação oficial; nenhum contato, conta, bot, acesso a servidor ou integração foi criado.

## Resultado

O [Linktree oficial](https://linktr.ee/LinksBrazil), também referenciado pelo canal Telegram, publica Telegram, WhatsApp, Discord e X. Não foi encontrado contrato público de API, RSS ou webhook nessa página nem nas páginas oficiais da comunidade consultadas. Isso é ausência de evidência pública, não prova de inexistência de integração privada.

| Fonte | Evidência observada | Estado recomendado |
| --- | --- | --- |
| Telegram público | [Prévia](https://t.me/s/LinksBrazil) acessível com mensagens reais, preços, cupons e links de afiliados | descoberta possível, automatização desabilitada até política/robots e uso autorizados serem confirmados |
| Telegram Bot API | eventos de canais onde o bot foi adicionado; token não dá acesso a canais arbitrários | desabilitado sem bot autorizado e canal permitido |
| Discord | convite público só entrega aplicação JavaScript, sem conteúdo dos canais | desabilitado sem canal de destino autorizado, bot e permissões |
| X | página do perfil retornou 403; API oficial cobra por uso | desabilitado por exigência de custo zero |

## Telegram

A prévia pública mostra posts com links `meli.la`, `mercadolivre.com/sec`, `link.amazon` e `s.shopee.com.br`. Há ofertas dependentes de aplicativo, cupom resgatado e Pix; também houve correção posterior de uma oferta de TV com divergência de tamanho. Portanto, a mensagem é apenas pista de descoberta, nunca comprovação atual de preço, estoque, especificação ou reputação.

Contagem de visualizações, inscritos ou reações do canal não comprova unidades vendidas do anúncio.

A [FAQ oficial de bots](https://core.telegram.org/bots/faq#what-messages-will-my-bot-get) limita recebimento de mensagens de canais àqueles dos quais o bot participa. A [Bot API](https://core.telegram.org/bots/api#update) fornece `channel_post` e `edited_channel_post`; adicionar um bot a um canal de terceiros depende do responsável pelo canal. Não usar sessão pessoal/MTProto para contornar essa exigência nem presumir que um token BotFather permite ler o LinksBR. Um webhook HTTPS no aplicativo pode receber eventos sem processo local permanente, quando o acesso ao canal estiver autorizado. Validar segredo do webhook, canal permitido e deduplicação por update/message ID.

O `robots.txt` de `t.me` não pôde ser confirmado pela ferramenta web desta pesquisa. Não ativar coleta automática da prévia com base somente na acessibilidade da página. Os [termos de API Telegram](https://core.telegram.org/api/terms) também devem ser avaliados para qualquer implementação futura.

## Discord

O [endpoint oficial Follow Announcement Channel](https://docs.discord.com/developers/resources/channel#follow-announcement-channel) copia anúncios para outro canal Discord e exige `MANAGE_WEBHOOKS` no destino. Isso não é RSS nem webhook de saída arbitrário para o Baixou!.

A leitura posterior no canal permitido pode usar [Get Channel Messages](https://docs.discord.com/developers/resources/message#get-channel-messages), com `VIEW_CHANNEL` e `READ_MESSAGE_HISTORY`, bot adicionado ao servidor e [Message Content Intent](https://docs.discord.com/developers/events/gateway#message-content-intent) habilitado/aprovado quando aplicável. O intent afeta também a API HTTP: conteúdo, embeds e anexos podem vir vazios sem ele. Não usar token pessoal/self-bot. Polling REST pode rodar em job hospedado; Gateway exige conexão persistente e não deve ser confundido com Vercel Function curta.

A regra da comunidade fornecida pelo usuário autoriza seguir anúncios para o próprio servidor Discord. Como decisão de projeto, não interpretar essa regra como licença automática para republicar mensagens, imagens e links em site externo. Antes de habilitar, obter autorização compatível com o uso ou limitar a integração a pistas de produtos e validação direta nas lojas, sem copiar o conteúdo editorial.

## X

A [documentação oficial de preços](https://docs.x.com/x-api/getting-started/pricing) informa créditos pré-pagos e cobrança por leitura; na consulta, posts custavam US$ 0,005 por recurso retornado. Incentivos de créditos não equivalem a operação gratuita permanente. Não habilitar API, recarga, proxy pago ou coletor que burle o 403. A fonte permanece desabilitada sob o requisito de gasto zero.

## Contrato recomendado de descoberta

1. Fontes sociais geram candidatos, separados das ofertas publicadas.
2. Armazenar ID e URL da publicação, data, URL original, cupom e condições; evitar copiar textos e imagens editoriais completos.
3. Expandir links curtos somente com redirecionamentos limitados, HTTPS, validação de cada host/IP e bloqueio de redes privadas. Jamais `fetch` irrestrito de URL vinda da mensagem.
4. Submeter o destino a adaptador de loja permitido. Capturar vendedor, MPN, preço final, estoque e avaliações da loja.
5. Não publicar preço de cupom sem verificar elegibilidade/condições; não tratar preço riscado como histórico ou valor real.
6. Expirar ofertas por TTL; processar correções/edições. Falha de coleta é desconhecido, não esgotado.
7. Credenciais somente no servidor e fontes desabilitadas por padrão até acesso e autorização confirmados.

Nenhuma dessas fontes sociais foi implementada ou declarada operacional nesta pesquisa.

## Atualização de validação HTTP direta em 23/11/2026
O robots.txt de t.me foi agora consultado diretamente: HTTP 404; a prévia LinksBR retornou HTTP 200. Portanto não há evidência de bloqueio por robots. A decisão sobre coleta externa deve usar o texto específico https://telegram.org/tos/content-licensing e não uma hipótese de robots. Consulte PRIMARY_SOURCES.md para requisitos concretos, testes e fontes. Não foi comprovado como LinksBR obtém as ofertas.

