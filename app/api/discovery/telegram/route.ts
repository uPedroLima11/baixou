import {NextResponse} from 'next/server';import {adminDb} from '@/lib/server';import {extractLinks,isFresh,secretMatches} from '@/lib/discovery';
export const runtime='nodejs';
export async function POST(req:Request){if(Number(req.headers.get('content-length')??0)>65536)return NextResponse.json({error:'too_large'},{status:413});let db;try{db=adminDb()}catch{return NextResponse.json({error:'unavailable'},{status:503})}
 const sourceId=new URL(req.url).searchParams.get('source')??'linksbr-telegram';if(sourceId.length>80)return NextResponse.json({error:'invalid'},{status:400});
 const {data:s}=await db.from('discovery_sources').select('*').eq('id',sourceId).single();
 if(!s?.enabled||s.kind!=='telegram'||!secretMatches(req.headers.get('x-telegram-bot-api-secret-token')??'',s.secret_hash))return NextResponse.json({error:'unauthorized'},{status:401});
 const body=await req.text();if(body.length>65536)return NextResponse.json({error:'too_large'},{status:413});let b;try{b=JSON.parse(body)}catch{return NextResponse.json({error:'invalid_json'},{status:400})}
 const post=b.channel_post??b.edited_channel_post;if(!post||String(post.chat?.id)!==s.channel_id)return NextResponse.json({accepted:0});
 const postedAt=new Date(Number(post.edit_date??post.date)*1000).toISOString();if(!isFresh(postedAt))return NextResponse.json({accepted:0,reason:'stale'});
 const text=String(post.text??post.caption??'');const links=extractLinks(text,post.entities??post.caption_entities??[]);const external=String(b.update_id);if(!/^\d{1,25}$/.test(external))return NextResponse.json({error:'invalid'},{status:400});
 const {count}=await db.from('discovery_events').select('id',{head:true,count:'exact'}).eq('source_id',sourceId).gt('received_at',new Date(Date.now()-60000).toISOString());if((count??0)>200)return NextResponse.json({error:'rate_limited'},{status:429});
 const rows=links.map(url=>({source_id:sourceId,external_id:external,original_url:url,posted_at:postedAt,coupon_hint:text.match(/cupom[:\s-]+([A-Z0-9_-]{4,32})/i)?.[1]??null}));if(rows.length){const {error}=await db.from('discovery_events').upsert(rows,{onConflict:'source_id,external_id,original_url',ignoreDuplicates:true});if(error)return NextResponse.json({error:'queue_failed'},{status:503});}
 return NextResponse.json({accepted:rows.length});}
