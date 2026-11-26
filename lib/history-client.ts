// Cache do histórico no navegador: a página do produto pré-carrega a mesma consulta que a aba "Histórico de preços"
// usa, então a aba abre sem nova espera e o resumo do histórico aparece logo ao lado da foto.
export type HistorySeries={id:string;raw:[number,number][];daily:[string,number,number,number,number][];announced?:[string,number,string,string,number,number][]};
const cache=new Map<string,Promise<{series:HistorySeries[]}>>();
export function historyKey(ids:string[]){return ids.join(',');}
// pay='card': séries do total no cartão (começam em 27/11/2026; nada anterior é estimado).
export function fetchHistory(ids:string[],pay:'pix'|'card'='pix'){const key=historyKey(ids)+(pay==='card'?'|card':'');let p=cache.get(key);
 if(!p){p=fetch('/api/history?ids='+encodeURIComponent(historyKey(ids))+'&days=2'+(pay==='card'?'&pag=cartao':'')).then(r=>{if(!r.ok)throw Error('history');return r.json();});p.catch(()=>cache.delete(key));cache.set(key,p);}
 return p;}
