// Importação única de publicações ANTIGAS dos canais das lojas no Telegram para o "Histórico de preços anunciados".
// Só datas e preços realmente publicados. Nunca altera uma oferta existente (pode ser mais nova que o post antigo):
// anúncio inexistente é criado já vencido (fora do catálogo); depois, cada post vira uma linha diária deduplicada.
// Uso: workflow manual telegram-backfill.yml (BACKFILL_DAYS, padrão 30, máx. 120). 1,5 s entre páginas do Telegram.
import {adminDb} from '../lib/server';
import {connectors} from '../lib/connectors/registry';
import {acceptListing} from '../lib/connectors/policy';
import {listingToProduct} from '../lib/connectors/convert';
import {persistVerifiedProduct} from '../lib/connectors/persist';
import {ANNOUNCED_TTL_MINUTES} from '../lib/connectors/telegram-channels';
import {loadKnownCodes,enrichListing,announcedProduct,recordAnnouncement} from '../lib/connectors/announce';
const skipDays=Math.max(0,Math.min(119,Number(process.env.BACKFILL_SKIP_DAYS)||0));let skipped=0;
const db=adminDb(),days=Math.min(120,Math.max(1,Number(process.env.BACKFILL_DAYS)||30)),deadline=Date.now()+Math.min(45,Number(process.env.BACKFILL_MINUTES)||30)*60000;
const {known,brands}=await loadKnownCodes(db);
const onlyChannels=(process.env.BACKFILL_CHANNELS??'').split(',').map(s=>s.trim()).filter(Boolean);
for(const c of connectors.filter(c=>c.id.endsWith('-telegram')&&c.implemented&&(!onlyChannels.length||onlyChannels.includes(c.id)))){
 const existing=new Set<string>();const store=c.id.replace('-telegram','');
 for(let from=0;from<50000;from+=1000){const r=await db.from('offers').select('id').eq('store',store).range(from,from+999);if(r.error)throw r.error;for(const x of r.data??[])existing.add(x.id);if((r.data?.length??0)<1000)break;}
 let posts=0,created=0,recorded=0,rejected=0,errors=0,oldest='';const started=Date.now();
 const env={...process.env,TELEGRAM_LOOKBACK_HOURS:String(days*24),TELEGRAM_MAX_PAGES:'600'};
 for await(const listing of c.listings({env,fetch,deadline,maxListings:100000})){
  posts++;oldest=listing.announcement?.postedAt??oldest;
  // Dias mais recentes já importados podem ser pulados (BACKFILL_SKIP_DAYS): só a paginação passa por eles.
  if(skipDays&&Date.parse(listing.announcement?.postedAt??'')>Date.now()-skipDays*86400000){skipped++;continue;}
  if(!acceptListing(listing,{hosts:c.hosts,marketplace:c.marketplace}).ok){rejected++;continue;}
  const id=listingToProduct(listing,c.name).id;
  try{
   if(!existing.has(id)){enrichListing(listing,known,brands);const a=listing.announcement!;
    await persistVerifiedProduct(db,announcedProduct(listing,c.name),{at:a.postedAt,ttlMinutes:ANNOUNCED_TTL_MINUTES,post:a.channel+'/'+a.postId,insertOnly:true});existing.add(id);created++;recorded++;}
   else if(await recordAnnouncement(db,listing,c.name))recorded++;else errors++;
  }catch(e){errors++;console.error(c.id,e&&typeof e==='object'&&'message' in e?String(e.message).slice(0,200):'erro');}
 }
 console.log(JSON.stringify({connector:c.id,days,skip_days:skipDays,skipped_recent:skipped,posts,created_offers:created,recorded_posts:recorded,rejected,errors,oldest_post:oldest,seconds:Math.round((Date.now()-started)/1000)}));
}
