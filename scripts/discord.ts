import {adminDb} from '../lib/server';import {extractLinks,isFresh} from '../lib/discovery';
const token=process.env.DISCORD_BOT_TOKEN,channel=process.env.DISCORD_CHANNEL_ID;if(!token||!channel){console.log('Discord não configurado; fonte permanece desativada.');process.exit(0);}
if(!/^\d{15,25}$/.test(channel))throw Error('Canal inválido');
const db=adminDb();const {data:source,error}=await db.from('discovery_sources').select('*').eq('id','linksbr-discord').single();if(error)throw error;
if(!source.enabled||!source.permission_note||source.channel_id!==channel){console.log('Discord depende de autorização registrada e canal permitido.');process.exit(0);}
const r=await fetch('https://discord.com/api/v10/channels/'+channel+'/messages?limit=30',{headers:{Authorization:'Bot '+token,'User-Agent':'Baixou (https://github.com/uPedroLima11/baixou,1.0)'},signal:AbortSignal.timeout(12000)});
if(r.status===429){console.log('Discord limitou acesso; retomar no próximo ciclo.');process.exit(0);}if(!r.ok)throw Error('Discord HTTP '+r.status);
const messages=await r.json();if(!Array.isArray(messages))throw Error('Resposta inesperada');
let count=0;for(const m of messages){const posted=m.edited_timestamp??m.timestamp;if(!isFresh(posted))continue;const text=String(m.content??'');const links=extractLinks(text);
for(const embed of m.embeds??[]){if(embed.url)links.push(embed.url);for(const f of embed.fields??[])links.push(...extractLinks(String(f.value??'')));}
const rows=[...new Set(links)].filter(u=>u.startsWith('https://')&&u.length<2048).slice(0,10).map(u=>({source_id:source.id,external_id:String(m.id)+'-'+String(posted),original_url:u,posted_at:posted,coupon_hint:text.match(/cupom[:\s-]+([A-Z0-9_-]{4,32})/i)?.[1]??null}));
if(rows.length){const {error}=await db.from('discovery_events').upsert(rows,{onConflict:'source_id,external_id,original_url',ignoreDuplicates:true});if(error)throw error;count+=rows.length;}}
console.log(count+' links candidatos de canal autorizado. Nenhum texto editorial armazenado.');
