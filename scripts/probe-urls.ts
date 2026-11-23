// Sondagem de acesso a partir do ambiente hospedado (GitHub runner): status, tamanho, redirecionamento e robots.
// Uma requisição por URL, User-Agent identificado do coletor, pausa de 1,5 s. Não tenta contornar bloqueios.
import robotsParser from 'robots-parser';
const agent='BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)';
const urls=(process.env.PROBE_URLS??process.argv.slice(2).join(' ')).split(/[\s,]+/).filter(u=>/^https:\/\//.test(u)).slice(0,20);
const robots=new Map<string,ReturnType<typeof robotsParser>>();
for(const url of urls){
 const origin=new URL(url).origin;
 if(!robots.has(origin)){try{const r=await fetch(origin+'/robots.txt',{headers:{'User-Agent':agent},signal:AbortSignal.timeout(8000)});robots.set(origin,robotsParser(origin+'/robots.txt',r.ok?await r.text():''));}catch{robots.set(origin,robotsParser(origin+'/robots.txt',''));}}
 const allowed=robots.get(origin)!.isAllowed(url,agent)!==false;
 if(!allowed){console.log(JSON.stringify({url,robots:'disallow'}));continue;}
 await new Promise(r=>setTimeout(r,1500));
 try{const res=await fetch(url,{headers:{'User-Agent':agent,Accept:'text/html,application/json'},redirect:'manual',signal:AbortSignal.timeout(10000)});const body=await res.text();
  console.log(JSON.stringify({url,status:res.status,location:res.headers.get('location')?.slice(0,120)??null,bytes:body.length,priceMarks:(body.match(/andes-money-amount__fraction/g)??[]).length,cards:(body.match(/poly-component__title/g)??[]).length,title:body.match(/<title>([^<]{0,80})/)?.[1]??null}));}
 catch(e){console.log(JSON.stringify({url,error:e instanceof Error?e.message:'erro'}));}
}
