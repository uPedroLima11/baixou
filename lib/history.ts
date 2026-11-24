// Histórico de preços: funções puras usadas pelo gráfico, pelo detalhe do produto e pelas estatísticas.
// Regras: só observações reais; lacunas de coleta interrompem a linha (nada é interpolado); períodos só
// aparecem com dados que os cubram; tendência é descritiva e exige histórico mínimo (sem previsão).
export type RawPoint={t:number;p:number};
export type DailyPoint={day:string;min:number;max:number;close:number;samples?:number};
export const DAY=86400000;
export const PERIODS=[{days:7,label:'7 dias'},{days:30,label:'30 dias'},{days:90,label:'90 dias'},{days:180,label:'6 meses'},{days:365,label:'1 ano'}] as const;
// Dia de São Paulo (UTC-3, sem horário de verão desde 2019) no formato AAAA-MM-DD.
export const spDay=(t:number)=>new Date(t-3*3600000).toISOString().slice(0,10);
export const dayStart=(day:string)=>Date.parse(day+'T03:00:00Z');
// Divide a série em trechos contínuos: um intervalo maior que maxGap entre duas observações é lacuna de coleta.
// `seg` opcional força quebra (ex.: série encadeada que recomeçou por falta de amostra).
export function segments<T extends {t:number;seg?:number}>(points:T[],maxGap:number){const out:T[][]=[];let cur:T[]=[];for(const p of [...points].sort((a,b)=>a.t-b.t)){const prev=cur[cur.length-1];if(prev&&(p.t-prev.t>maxGap||p.seg!==prev.seg)){out.push(cur);cur=[];}cur.push(p);}if(cur.length)out.push(cur);return out;}
export function median(values:number[]){const v=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;}
// Período disponível: o primeiro sempre; os demais só quando o histórico já ultrapassa o período anterior.
export function availablePeriods(firstObserved:number|null,now=Date.now()){const span=firstObserved==null?0:(now-firstObserved)/DAY;return PERIODS.map((p,i)=>({...p,enabled:i===0||span>PERIODS[i-1].days}));}
// Fechamento do dia N dias atrás (ou do dia anterior mais próximo, até 1 dia antes), a partir do resumo diário.
export function closeDaysAgo(daily:DailyPoint[],n:number,now=Date.now(),field:'close'|'min'='close'){const target=spDay(now-n*DAY),floor=spDay(now-(n+1)*DAY);const hit=[...daily].filter(d=>d.day<=target&&d.day>=floor).sort((a,b)=>b.day.localeCompare(a.day))[0];return hit?hit[field]:null;}
// Série diária do gráfico: um ponto por dia de São Paulo = MENOR preço observado no dia. O dia atual é parcial e
// inclui o preço atual verificado (pode ser mais novo que a última observação horária gravada). Dias sem coleta
// simplesmente não têm ponto.
export type DayPoint={day:string;t:number;p:number;max:number;close:number;samples:number;partial:boolean};
export function dailySeries(daily:DailyPoint[],days:number,current:number|null,now=Date.now()):DayPoint[]{
 const today=spDay(now),from=spDay(now-(days-1)*DAY),rows=daily.filter(d=>d.day>=from&&d.day<=today).map(d=>({...d}));
 if(current!=null){const t=rows.find(d=>d.day===today);if(t){t.min=Math.min(t.min,current);t.max=Math.max(t.max,current);t.close=current;}else rows.push({day:today,min:current,max:current,close:current,samples:1});}
 return rows.sort((a,b)=>a.day.localeCompare(b.day)).map(d=>({day:d.day,t:dayStart(d.day)+12*3600000,p:d.min,max:d.max,close:d.close,samples:d.samples??1,partial:d.day===today}));
}
export function periodStats(points:RawPoint[]){if(!points.length)return null;const sorted=[...points].sort((a,b)=>a.t-b.t),prices=sorted.map(p=>p.p);const low=Math.min(...prices),high=Math.max(...prices),first=sorted[0],last=sorted[sorted.length-1];
 return {low,high,median:median(prices)!,first,last,change:first.p>0?(last.p-first.p)/first.p:0,lowAt:sorted.find(p=>p.p===low)!.t,highAt:sorted.find(p=>p.p===high)!.t,count:sorted.length};}
export type Trend={kind:'forming';availableFrom:string}|{kind:'ready';signals:{tone:'good'|'bad'|'neutral';text:string}[];days:number};
const pct=(x:number)=>Math.floor(Math.abs(x)*1000)/10;
const fmt=(x:number)=>pct(x).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
// Indicadores descritivos a partir do resumo diário (últimos 30 dias) e do preço atual verificado.
// Mínimo: 3 dias distintos e 5 observações (mesma régua da queda comprovada). Nenhuma probabilidade é estimada.
export function describeTrend(daily:DailyPoint[],current:number|null,now=Date.now()):Trend{
 const since=spDay(now-30*DAY),window=daily.filter(d=>d.day>=since).sort((a,b)=>a.day.localeCompare(b.day));
 const samples=window.reduce((s,d)=>s+(d.samples??1),0);
 if(window.length<3||samples<5||current==null){const first=daily.map(d=>d.day).sort()[0];return {kind:'forming',availableFrom:first?spDay(dayStart(first)+2*DAY):spDay(now+3*DAY)};}
 const low=Math.min(...window.map(d=>d.min)),high=Math.max(...window.map(d=>d.max)),med=median(window.map(d=>d.close))!,signals:{tone:'good'|'bad'|'neutral';text:string}[]=[];
 if(current<=low*1.005)signals.push({tone:'good',text:'No menor preço observado em '+window.length+' dias'});
 else if(current<=low*1.03)signals.push({tone:'good',text:'Até 3% acima do menor preço observado ('+window.length+' dias)'});
 const vsMed=(current-med)/med;
 if(vsMed>=0.03)signals.push({tone:'bad',text:fmt(vsMed)+' acima da mediana observada ('+window.length+' dias)'});
 else if(vsMed<=-0.03)signals.push({tone:'good',text:fmt(vsMed)+' abaixo da mediana observada ('+window.length+' dias)'});
 const week=closeDaysAgo(daily,7,now);
 if(week){const ch=(current-week)/week;if(ch<=-0.02)signals.push({tone:'good',text:'Caiu '+fmt(ch)+' em 7 dias'});else if(ch>=0.02)signals.push({tone:'bad',text:'Subiu '+fmt(ch)+' em 7 dias'});}
 if(window.length>=7&&(high-low)/med<=0.02)signals.push({tone:'neutral',text:'Estável há '+window.length+' dias (variação até 2%)'});
 if(!signals.length)signals.push({tone:'neutral',text:'Dentro da faixa observada ('+window.length+' dias)'});
 return {kind:'ready',signals,days:window.length};
}
// Menor preço observado por dia entre vários anúncios do mesmo modelo (cada valor é uma observação real).
export function dailyLowest(series:{label:string;daily:DailyPoint[]}[]){const map=new Map<string,{day:string;price:number;label:string}>();for(const s of series)for(const d of s.daily){const prior=map.get(d.day);if(!prior||d.min<prior.price)map.set(d.day,{day:d.day,price:d.min,label:s.label});}return [...map.values()].sort((a,b)=>a.day.localeCompare(b.day));}
