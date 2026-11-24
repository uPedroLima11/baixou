import type {Connector} from './types';
import {mercadoLivreOfficialStores} from './mercadolivre-stores';import {terabyteFeed,pichauFeed} from './merchant-feed';import {terabyteTelegram,pichauTelegram} from './telegram-channels';
// Conectores independentes. As APIs oficiais abaixo NÃO estão implementadas: faltam credenciais e consulta real aprovada.
// Trocar `implemented` para true SOMENTE após teste hospedado com produtos, preços, disponibilidade e vendedores reais.
// Passos de acesso: docs/ACCESS_GUIDE.md.
async function* notImplemented(){}
export const connectors:Connector[]=[
 // Canais oficiais das lojas no Telegram (prévia pública t.me/s): preço anunciado pela loja, gravado como 'announced'.
 // Primeiro na fila: poucas páginas, e o prazo compartilhado não deve cortá-los.
 terabyteTelegram,pichauTelegram,
 // Sem credencial: vitrines públicas de lojas oficiais (validado no runner hospedado; ver HANDOFF).
 mercadoLivreOfficialStores,
 // Feeds autorizados (padrão Google Merchant). Desligados até autorização e teste hospedado.
 terabyteFeed,pichauFeed,
 {id:'mercadolivre',name:'Mercado Livre',marketplace:true,requiredEnv:['MERCADOLIVRE_CLIENT_ID','MERCADOLIVRE_CLIENT_SECRET'],hosts:['www.mercadolivre.com.br','produto.mercadolivre.com.br'],implemented:false,listings:notImplemented},
 {id:'shopee',name:'Shopee',marketplace:true,requiredEnv:['SHOPEE_AFFILIATE_APP_ID','SHOPEE_AFFILIATE_SECRET'],hosts:['shopee.com.br'],implemented:false,listings:notImplemented},
 {id:'aliexpress',name:'AliExpress',marketplace:true,requiredEnv:['ALIEXPRESS_APP_KEY','ALIEXPRESS_APP_SECRET','ALIEXPRESS_TRACKING_ID'],hosts:['pt.aliexpress.com','www.aliexpress.com'],implemented:false,listings:notImplemented},
];
export function connectorStatus(env:Record<string,string|undefined>){
 return connectors.map(c=>{const missing=c.requiredEnv.filter(n=>!env[n]?.trim());return {id:c.id,name:c.name,implemented:c.implemented,configured:missing.length===0,missing,runnable:c.implemented&&missing.length===0};});
}
