# Expansão do Baixou! — 23/11/2026

## Medição real no Supabase

Snapshot de23/11/2026 às10:31:29 (SãoPaulo), equivalente a13:31:29UTC. Contagens mudam com coleta e expiração.

| Fonte operacional | Anúncios detalhados persistidos | Disponíveis dentro do TTL | Com desconto anunciado ou comprovado |
| --- | ---: | ---: | ---: |
| KaBuM! | 76 | 76 | 64 |
| WAZ | 42 | 42 | 1 |
| Guerra Digital | 71 | 42 | 0 |
| Patoloco | 88 | 88 | 84 |
| Total | 277 | 248 | 149 |

Há529URLs candidatas e190páginas na descoberta progressiva; candidatas não são produtos validados.141identidades canônicas representadas no banco não significam que todos os277anúncios sejam modelos únicos: itens sem identificador forte não são fundidos por suposição. Nenhum produto foi inventado para preencher catálogo.

Quedas históricas comprovadas:0neste snapshot. O histórico ainda não tem os dias mínimos.149écontagemdeofertasanunciadaspelaslojas, não149quedascomprovadas. Produtos sem desconto continuam monitorados para construir histórico, mas não entram por isso na modalidade de promoções. Não usamos diferença de parcelamento/Pix como histórico nem WAZAggregateOffer.highPrice como preço anterior.

## Categorias com disponibilidade confirmada

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

- Coleta45181716254:WAZ,GuerraDigital,Patoloco eKaBuM gravaram ofertas reais; Bitsfalhou403. Coleta45182440333 confirmou novamente asnovasfontes, comBits403no caminhodememória. Não declaramos esseworkflow geralverde.
- Após removerBitsdarotina,45183518357 confirmou as três novasfontes;KaBuMteveumcicloocioso marcadoerro(posteriormentecorrigido).45184422060 tevefalhaKaBuM cuja mensagemantigaeraapenasFalha; diagnósticosforam melhorados. RevalidaçãoVercel posteriorHTTP200/2produtos/24novasURLs/0falhas. Não ocultar falhas dos testes.
-37testesunitários/parsers passaram;types/build eCI passaram. Testes incluem vendedor próprio, preçoPix, mainEntity versus recomendados, indisponibilidade sempreço, marca/genérico, GTIN/MPN, URL/robots guard, diversidade ealertas decategoria entre marcas/modelos/lojas.
- Filas privadas foram verificadas: anon não lêproduct_candidates;authenticated não lêcollection_state;service_role lê. InfoRLSsem política é negaçãointencional, não demanda abrirpolíticaspúblicas.
- Cronsporloja retornaramHTTP200e ofertas gravadas; houveum errotransitório deHTTP2natransmissão, sem converter emesgotamento. Verificarrespostasneteúltimosucesso porfonte.

## Estrutura e limites

Fila privada de páginas e URLs, cursor persistente, revalidação alternada com novidades diversas e backoff por erro. Cada loja tem lease ecronpróprios de5min;Actions fazrodadamaior a cada30min. Os limites são orçamento, não garantia: até10detalhes/35s naVercel,50detalhes/4minporjobActions; timeout8s,8MB epausa1,5s.2000candidatosporloja. TTLregular60min; quedahistóricaforte15min. Falha não renovaTTL.

Em geral, ciclo curto validou5–8produtos; latência/estoque/erros podem diminuir esse número. Ao crescer o conjunto, comparar revalidações porhora com número de ofertas monitoradas. Não ampliarTTLautomaticamente para mascarar atraso, nemapagar favoritos para aliviarcoleta. A oferta que ultrapassa validade sai do catálogo, masproduto/lista/alerta permanecem.

## Bloqueadas e alternativas

- Oficina dos Bits: adaptador/fixtures reais, mas403emcategoriasnoGitHub runner. Saiudadarotina; aguarda feed/acesso autorizado. Não trocarIP, automatizarchallenge ou usarAPIprivada.
- Terabyte/Pichau/Gigantec: bloqueios/challenge documentados; não repetir403a cadaciclo. Alternativasdeparceiro/feed sem contrato/acesso comprovado ainda nãoestãointegradas.
- Amazon:CreatorsAPI exigecontaelegível;MercadoLivre/MagaluAPIsdeseller nãoequivalemacatálogoglobal. Shopee/AliExpress precisam deconta/aprovação/documentaçãoatual. Fontes oficiais econdições emdocs/PRIMARY_SOURCES.md. Nenhuma delas foi declarada operacional nestaetapa.

## Reproduzir e continuar

npm run collect:report (emambiente comSupabaseServiceRole autorizado) consulta dadosreais egeraresumoMarkdownnoActions. NãoexportarSecretspara executarlocalmente. ConsultarActions eSupabaseCron;ofuncionamentohospedado nãodepende do computador.

Próximo foco: sustentara revalidação conforme apoolcresce, aprimorar identidade/specs conservadoras, ampliar fontes comacessoreal e validar feeds oficiais quando oproprietário já tiver credenciais/autorização. Alertas dequeda não podem ser homologados comhistóricofictício.
